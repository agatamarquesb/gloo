import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  AgendaDto,
  CalendarAccountDto,
  CalendarEventDto,
  CreateAgendaInput,
  CalendarSyncResultDto,
  CreateEventInput,
  RecurrenceScope,
  UpdateAgendaInput,
  UpdateEventInput,
} from '@gloo/shared';

import { apiClient } from '@/lib/apiClient';
import { calendarKeys } from '@/lib/queryKeys';

export function useCalendarAccounts() {
  return useQuery({
    queryKey: calendarKeys.accounts,
    queryFn: () => apiClient.get<CalendarAccountDto[]>('/calendar/accounts'),
  });
}

/**
 * Every agenda the user can see, flattened out of its account.
 *
 * The grid needs to look an agenda up by id — for its colour, and to know
 * whether it is hidden — and walking the account tree at every event would be
 * noise. Derived from the same query, so there is still one request.
 */
export function useAgendasById() {
  const { data: accounts = [] } = useCalendarAccounts();
  return new Map<string, AgendaDto>(
    accounts.flatMap((account) => account.agendas.map((agenda) => [agenda.id, agenda])),
  );
}

/**
 * Anything that changes an agenda can change which events are on the grid — a
 * colour, the eye icon, a deletion that moves events elsewhere — so both
 * queries go at once. Events are keyed by date range, hence invalidating the
 * whole branch rather than one range.
 */
function useInvalidateCalendar() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: calendarKeys.accounts });
    queryClient.invalidateQueries({ queryKey: calendarKeys.events });
  };
}

export function useUpdateCalendarAccount() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      displayName?: string;
      isCollapsed?: boolean;
    }) => apiClient.patch<CalendarAccountDto>(`/calendar/accounts/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDisconnectCalendarAccount() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/calendar/accounts/${id}`),
    onSuccess: invalidate,
  });
}

export function useCreateAgenda() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: (input: CreateAgendaInput) => apiClient.post<AgendaDto>('/calendar/agendas', input),
    onSuccess: invalidate,
  });
}

export function useUpdateAgenda() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateAgendaInput) =>
      apiClient.patch<AgendaDto>(`/calendar/agendas/${id}`, input),
    onSuccess: invalidate,
  });
}

/** "Mostrar apenas esta" — one request, so a partial failure can't half-apply it. */
export function useShowOnlyAgenda() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/calendar/agendas/${id}/only`, {}),
    onSuccess: invalidate,
  });
}

export function useDeleteAgenda() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/calendar/agendas/${id}`),
    onSuccess: invalidate,
  });
}

/**
 * Every occurrence overlapping a window.
 *
 * The window is the grid's own visible range, so paging a week refetches — and
 * caches — that week alone. Recurring events arrive already expanded, so what
 * comes back is one entry per block on screen.
 */
export function useCalendarEvents(from: string, to: string) {
  return useQuery({
    queryKey: calendarKeys.eventRange(from, to),
    queryFn: () =>
      apiClient.get<CalendarEventDto[]>(
        `/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
  });
}

/**
 * Which occurrences a write applies to.
 *
 * `originalStart` is what identifies the one being edited — a generated
 * occurrence has no id of its own, so the slot is the only handle on it.
 */
interface EventScope {
  scope?: RecurrenceScope;
  originalStart?: string | null;
  /**
   * Whether Google should email the other attendees. Always explicit, never
   * inferred — the API treats a missing flag as "no", so a caller that forgets
   * it silently sends nothing rather than silently mailing a team.
   */
  notify?: boolean;
}

function eventQuery({ scope, originalStart, notify }: EventScope): string {
  const params = new URLSearchParams();
  if (scope) {
    params.set('scope', scope);
    if (originalStart) params.set('originalStart', originalStart);
  }
  if (notify) params.set('notify', 'true');

  const query = params.toString();
  return query ? `?${query}` : '';
}

export function useCreateEvent() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: ({ notify, ...input }: CreateEventInput & { notify?: boolean }) =>
      apiClient.post<CalendarEventDto>(`/calendar/events${eventQuery({ notify })}`, input),
    onSuccess: invalidate,
  });
}

export function useUpdateEvent() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: ({
      id,
      scope,
      originalStart,
      notify,
      ...input
    }: { id: string } & EventScope & UpdateEventInput) =>
      apiClient.patch<CalendarEventDto>(
        `/calendar/events/${id}${eventQuery({ scope, originalStart, notify })}`,
        input,
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteEvent() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: ({ id, scope, originalStart, notify }: { id: string } & EventScope) =>
      apiClient.delete(`/calendar/events/${id}${eventQuery({ scope, originalStart, notify })}`),
    onSuccess: invalidate,
  });
}

/**
 * Begin linking a Google account.
 *
 * The API builds the authorize URL — it is the only side that holds the client
 * ID and the PKCE verifier — and the browser is sent to it as a full-page
 * navigation rather than a popup, because Google refuses to render its consent
 * screen inside a frame and popups are blocked as often as not.
 */
export function useConnectGoogle() {
  return useMutation({
    mutationFn: () => apiClient.get<{ authUrl: string }>('/calendar/google/connect'),
    onSuccess: ({ authUrl }) => {
      window.location.href = authUrl;
    },
  });
}

/**
 * Pull anything new from Google.
 *
 * There is no cron and no webhook (a Google push channel needs a public HTTPS
 * URL), so the page asks: once on arrival, then on a slow interval while it is
 * open. `refetchOnWindowFocus` catches the common case of coming back to the
 * tab after making a change in Google Calendar itself.
 *
 * A query rather than a mutation despite being a POST, purely so React Query
 * does the scheduling — it dedupes concurrent calls and stops when the page is
 * unmounted, neither of which a mutation offers.
 */
export function useGoogleSync(hasGoogleAccount: boolean) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: calendarKeys.sync,
    queryFn: async () => {
      const result = await apiClient.post<CalendarSyncResultDto>('/calendar/google/sync', {});
      // Only disturb the cache when something actually arrived — an idle poll
      // that invalidated every window would refetch the grid every minute.
      if (result.agendasImported > 0 || result.eventsImported > 0 || result.eventsRemoved > 0) {
        queryClient.invalidateQueries({ queryKey: calendarKeys.accounts });
        queryClient.invalidateQueries({ queryKey: calendarKeys.events });
      }
      return result;
    },
    enabled: hasGoogleAccount,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * How many events the confirmation modal has to warn about.
 *
 * Only fetched while that modal is open — `enabled` is what keeps opening a
 * `···` menu from counting events on an agenda nobody is deleting.
 */
export function useAgendaEventCount(agendaId: string | null) {
  return useQuery({
    queryKey: calendarKeys.agendaEventCount(agendaId ?? ''),
    queryFn: () => apiClient.get<{ count: number }>(`/calendar/agendas/${agendaId}/event-count`),
    enabled: agendaId !== null,
  });
}
