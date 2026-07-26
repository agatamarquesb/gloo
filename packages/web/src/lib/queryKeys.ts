import type { TaskFilters } from '@gloo/shared';

export const taskKeys = {
  all: ['tasks'] as const,
  list: (filters: TaskFilters) => ['tasks', 'list', filters] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
  summary: (assigneeId?: string) => ['tasks', 'summary', assigneeId] as const,
  bySector: ['tasks', 'by-sector'] as const,
  calendar: (from: string, to: string) => ['tasks', 'calendar', from, to] as const,
};

export const sectorKeys = {
  all: ['sectors'] as const,
};

export const userKeys = {
  all: ['users'] as const,
};
