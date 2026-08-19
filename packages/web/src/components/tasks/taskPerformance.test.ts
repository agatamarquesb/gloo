import { describe, expect, it } from 'vitest';

import type { TaskListItemDto } from '@gloo/shared';

import { buildPerformance, completionPunctuality } from './taskPerformance';

const HOUR = 3_600_000;

function task(overrides: Partial<TaskListItemDto>): TaskListItemDto {
  return {
    id: 'a',
    title: 'Tarefa',
    description: null,
    dueDate: null,
    priority: 'HIGH',
    status: 'DONE',
    isOverdue: false,
    progress: 100,
    sector: { id: 's', name: 'Setor' },
    assignees: [],
    createdById: 'u',
    subtaskCount: 0,
    attachmentCount: 0,
    workedMs: 0,
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

describe('completionPunctuality', () => {
  it('counts the whole deadline day as on time', () => {
    // The deadline is stored as midnight UTC on the day itself, so finishing at
    // ten to midnight on that same day is not late.
    expect(completionPunctuality('2026-08-19T00:00:00Z', '2026-08-19T23:50:00Z')).toBe('ON_TIME');
  });

  it('calls the next day late', () => {
    expect(completionPunctuality('2026-08-19T00:00:00Z', '2026-08-20T00:10:00Z')).toBe('LATE');
  });

  it('has nothing to say without a deadline or a completion', () => {
    expect(completionPunctuality(null, '2026-08-19T10:00:00Z')).toBe('NONE');
    expect(completionPunctuality('2026-08-19T00:00:00Z', null)).toBe('NONE');
  });
});

describe('buildPerformance', () => {
  it('averages only the tasks that were actually worked on', () => {
    const result = buildPerformance(
      [
        task({ id: '1', workedMs: 2 * HOUR, completedAt: '2026-08-10T12:00:00Z' }),
        task({ id: '2', workedMs: 4 * HOUR, completedAt: '2026-08-11T12:00:00Z' }),
        // Dragged straight from "A fazer" to "Feita": no stretch to measure, so
        // it must not pull the mean towards zero.
        task({ id: '3', workedMs: 0, completedAt: '2026-08-12T12:00:00Z' }),
      ],
      'HIGH',
    );

    expect(result.averageMs).toBe(3 * HOUR);
    expect(result.bars.map((bar) => bar.id)).toEqual(['1', '2']);
  });

  it('leaves other priorities and unfinished tasks out', () => {
    const result = buildPerformance(
      [
        task({ id: '1', priority: 'LOW', workedMs: HOUR, completedAt: '2026-08-10T12:00:00Z' }),
        task({ id: '2', priority: 'HIGH', workedMs: HOUR, completedAt: null }),
      ],
      'HIGH',
    );

    expect(result.averageMs).toBeNull();
    expect(result.bars).toEqual([]);
  });

  it('averages across every priority under ALL', () => {
    const result = buildPerformance(
      [
        task({ id: '1', priority: 'LOW', workedMs: HOUR, completedAt: '2026-08-10T12:00:00Z' }),
        task({ id: '2', priority: 'HIGH', workedMs: 3 * HOUR, completedAt: '2026-08-11T12:00:00Z' }),
      ],
      'ALL',
    );

    expect(result.averageMs).toBe(2 * HOUR);
    expect(result.bars).toHaveLength(2);
  });

  it('orders the bars by when each task was finished', () => {
    const result = buildPerformance(
      [
        task({ id: 'late', workedMs: HOUR, completedAt: '2026-08-14T12:00:00Z' }),
        task({ id: 'early', workedMs: HOUR, completedAt: '2026-08-01T12:00:00Z' }),
      ],
      'HIGH',
    );

    expect(result.bars.map((bar) => bar.id)).toEqual(['early', 'late']);
  });

  it('splits the finished tasks by whether they met their deadline', () => {
    const result = buildPerformance(
      [
        task({
          id: '1',
          workedMs: HOUR,
          dueDate: '2026-08-10T00:00:00Z',
          completedAt: '2026-08-10T18:00:00Z',
        }),
        task({
          id: '2',
          workedMs: HOUR,
          dueDate: '2026-08-10T00:00:00Z',
          completedAt: '2026-08-13T09:00:00Z',
        }),
        // No deadline: counted, but in neither column.
        task({ id: '3', workedMs: HOUR, completedAt: '2026-08-11T09:00:00Z' }),
      ],
      'HIGH',
    );

    expect(result).toMatchObject({ onTime: 1, late: 1, noDeadline: 1 });
  });
});
