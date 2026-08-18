import { countOtherAttendees } from '@gloo/shared';

import { prisma } from '../../../lib/prisma';
import { googleFetch, googleTasksFetch } from './client';
import { toRRule } from './mapper';

/**
 * Pushing our events to Google.
 *
 * Every write is best-effort and never fails the request that caused it: the
 * event is already saved on our side, and refusing a save because Google was
 * briefly unreachable would lose the user's work to somebody else's outage.
 * A failed push leaves `googleEventId` unset, and the next inbound sync
 * reconciles.
 */

interface PushableEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  isAllDay: boolean;
  timeZone: string;
  recurrence: string | null;
  recurrenceUntil: Date | null;
  byWeekdays: number[];
  googleEventId: string | null;
  agendaId: string;
  createdById: string;
  externalAttendees: unknown;
  assignees: { userId: string; user: { email: string } }[];
}

function toGoogleTime(instant: Date, isAllDay: boolean, timeZone: string) {
  if (isAllDay) return { date: instant.toISOString().slice(0, 10) };
  return { dateTime: instant.toISOString(), timeZone };
}

/** Guests Google knows about that have no Gloo user — see the JSON column. */
function externalEmails(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

/**
 * What Google should do about email for this write.
 *
 * `all` makes Google send invitations and, on a later change, "this event has
 * moved" notices. It is only ever used when the caller explicitly asked for it
 * *and* somebody other than the organiser is on the event — so an unchecked box
 * and a solo event both come out silent, and a drag can never surprise anyone.
 */
function sendUpdates(notify: boolean, event: PushableEvent): 'all' | 'none' {
  if (!notify) return 'none';

  const others = countOtherAttendees({
    createdById: event.createdById,
    assigneeIds: event.assignees.map((link) => link.userId),
    externalAttendees: externalEmails(event.externalAttendees),
  });

  return others > 0 ? 'all' : 'none';
}

function toGoogleBody(event: PushableEvent) {
  return {
    summary: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    start: toGoogleTime(event.startsAt, event.isAllDay, event.timeZone),
    end: toGoogleTime(event.endsAt, event.isAllDay, event.timeZone),
    recurrence: toRRule(event.recurrence, event.recurrenceUntil, event.byWeekdays),
    // Assignees become Google attendees, matched by the address they log in
    // with. Someone with no Google account simply never accepts.
    //
    // External guests are carried back too. A PATCH replaces the whole
    // attendees list, so sending only our own assignees would un-invite every
    // guest who was on a Google-authored event — silently, and for everyone.
    // Deduped by address: an assignee and an external guest can be the same
    // person if the two lists ever drift, and sending one address twice is not
    // something Google should have to sort out for us.
    attendees: [
      ...new Set([
        ...event.assignees.map((link) => link.user.email),
        ...externalEmails(event.externalAttendees),
      ]),
    ].map((email) => ({ email })),
  };
}

/**
 * Create or update the event's mirror on Google.
 *
 * Called after our own write has committed, so a failure here costs the mirror
 * and not the event.
 */
export async function pushEvent(
  eventId: string,
  log: (error: unknown) => void,
  /** Whether the user asked for attendees to be emailed about this change. */
  notify = false,
): Promise<void> {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    include: {
      assignees: { include: { user: { select: { email: true } } } },
      agenda: {
        select: {
          googleCalendarId: true,
          isReadOnly: true,
          account: true,
        },
      },
    },
  });

  // Nothing to do for a Gloo-local agenda, or one we may only read.
  if (!event?.agenda.googleCalendarId || event.agenda.isReadOnly) return;
  if (event.agenda.account.provider !== 'GOOGLE') return;

  const calendarId = encodeURIComponent(event.agenda.googleCalendarId);
  const body = JSON.stringify(toGoogleBody(event));
  const updates = sendUpdates(notify, event);

  try {
    const response = event.googleEventId
      ? await googleFetch(
          event.agenda.account,
          `/calendars/${calendarId}/events/${encodeURIComponent(
            event.googleEventId,
          )}?sendUpdates=${updates}`,
          { method: 'PATCH', body },
        )
      : await googleFetch(
          event.agenda.account,
          `/calendars/${calendarId}/events?sendUpdates=${updates}`,
          { method: 'POST', body },
        );

    if (!response.ok) {
      log(new Error(`Google push failed: ${response.status} ${await response.text()}`));
      return;
    }

    const created = (await response.json()) as { id?: string; etag?: string };
    await prisma.calendarEvent.update({
      where: { id: event.id },
      data: {
        googleEventId: created.id ?? event.googleEventId,
        googleEtag: created.etag ?? null,
        lastSyncedAt: new Date(),
      },
    });
  } catch (caught) {
    log(caught);
  }
}

/** Remove the mirror. Called before our own row goes, while we can still read it. */
export async function deleteRemoteEvent(
  eventId: string,
  log: (error: unknown) => void,
  /** Whether attendees should be told the meeting is cancelled. */
  notify = false,
): Promise<void> {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    include: {
      assignees: { include: { user: { select: { email: true } } } },
      agenda: { select: { googleCalendarId: true, isReadOnly: true, account: true } },
    },
  });

  if (!event?.googleEventId || !event.agenda.googleCalendarId || event.agenda.isReadOnly) return;
  if (event.agenda.account.provider !== 'GOOGLE') return;

  try {
    await googleFetch(
      event.agenda.account,
      `/calendars/${encodeURIComponent(
        event.agenda.googleCalendarId,
      )}/events/${encodeURIComponent(event.googleEventId)}?sendUpdates=${sendUpdates(
        notify,
        event,
      )}`,
      { method: 'DELETE' },
    );
  } catch (caught) {
    log(caught);
  }
}

/**
 * Create a real secondary calendar on Google, for "Nova agenda" pointed at a
 * linked account.
 *
 * Returns the new calendar's id, or null if Google refused — in which case the
 * caller must not create a local row claiming to be a mirror of it.
 */
export async function createRemoteCalendar(
  account: { id: string; accessToken: string | null; refreshToken: string | null; tokenExpiresAt: Date | null },
  name: string,
  log: (error: unknown) => void,
): Promise<string | null> {
  try {
    const response = await googleFetch(account, '/calendars', {
      method: 'POST',
      body: JSON.stringify({ summary: name }),
    });

    if (!response.ok) {
      log(new Error(`calendars.insert failed: ${response.status} ${await response.text()}`));
      return null;
    }

    const created = (await response.json()) as { id?: string };
    return created.id ?? null;
  } catch (caught) {
    log(caught);
    return null;
  }
}

/**
 * Tick a Google task off, or put it back — the one write this app makes against
 * the Tasks API.
 *
 * Unlike every other push in this file, this one is *not* best-effort: its
 * caller reports the failure and leaves our own row untouched. A tick is a fact
 * about the task rather than about our copy of it, and the two disagreeing is
 * worse than the tick not taking.
 */
export async function setRemoteTaskStatus(
  accountId: string,
  taskListId: string,
  taskId: string,
  done: boolean,
): Promise<void> {
  const account = await prisma.calendarAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error('Conta do Google não encontrada');

  const response = await googleTasksFetch(
    account,
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: done ? 'completed' : 'needsAction',
        // Google keeps a completion instant beside the status and rejects a
        // "needsAction" that still carries one.
        completed: done ? new Date().toISOString() : null,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`task patch failed: ${response.status} ${await response.text()}`);
  }
}
