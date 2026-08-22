import type { TaskFilters } from '@gloo/shared';

export const taskKeys = {
  all: ['tasks'] as const,
  list: (filters: TaskFilters) => ['tasks', 'list', filters] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
  /** The trash, under the same filters the live list is read with. */
  deleted: (filters: TaskFilters) => ['tasks', 'deleted', filters] as const,
  /** Keyed by the query string, since the summary now takes the list's filters. */
  summary: (query: string) => ['tasks', 'summary', query] as const,
  bySector: ['tasks', 'by-sector'] as const,
  calendar: (from: string, to: string) => ['tasks', 'calendar', from, to] as const,
};

export const sectorKeys = {
  all: ['sectors'] as const,
};

export const userKeys = {
  all: ['users'] as const,
};

export const calendarKeys = {
  accounts: ['calendar', 'accounts'] as const,
  /**
   * The branch every dated event query hangs off, so a mutation can drop them
   * all without knowing which windows happen to be cached.
   */
  events: ['calendar', 'events'] as const,
  eventRange: (from: string, to: string) => ['calendar', 'events', from, to] as const,
  /** The Google pull. Its own key so polling it never touches the grid's cache. */
  sync: ['calendar', 'sync'] as const,
  agendaEventCount: (agendaId: string) =>
    ['calendar', 'agendas', agendaId, 'event-count'] as const,
};
