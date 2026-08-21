import { describe, expect, it } from 'vitest';

import type { TaskListItemDto } from '@gloo/shared';

import { PerformancePeriod, buildPerformance, completionPunctuality } from './taskPerformance';

const HOUR = 3_600_000;
/** The instant every test below stands at, so a window is a fixed span. */
const NOW = new Date('2026-08-20T12:00:00Z').getTime();
const DAY = 24 * HOUR;

/** buildPerformance standing at a fixed instant, over everything by default. */
function perf(tasks: TaskListItemDto[], period: PerformancePeriod = PerformancePeriod.ALL) {
  return buildPerformance(tasks, period, NOW);
}

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
    const result = perf([
      task({ id: '1', workedMs: 2 * HOUR, completedAt: '2026-08-10T12:00:00Z' }),
      task({ id: '2', workedMs: 4 * HOUR, completedAt: '2026-08-11T12:00:00Z' }),
      // Dragged straight from "A fazer" to "Feita": no stretch to measure, so
      // it must not pull the mean towards zero.
      task({ id: '3', workedMs: 0, completedAt: '2026-08-12T12:00:00Z' }),
    ]);

    expect(result.averageMs).toBe(3 * HOUR);
  });

  it('averages the headline across every priority', () => {
    const result = perf([
      task({ id: '1', priority: 'LOW', workedMs: HOUR, completedAt: '2026-08-10T12:00:00Z' }),
      task({ id: '2', priority: 'HIGH', workedMs: 3 * HOUR, completedAt: '2026-08-11T12:00:00Z' }),
    ]);

    expect(result.averageMs).toBe(2 * HOUR);
  });

  it('leaves unfinished tasks out', () => {
    const result = perf([task({ id: '1', workedMs: HOUR, completedAt: null })]);

    expect(result.averageMs).toBeNull();
    expect(result.bars.every((bar) => bar.averageMs === null)).toBe(true);
  });

  it('draws one bar per priority, low to high, whatever the data holds', () => {
    const result = perf([
      task({ id: '1', priority: 'HIGH', workedMs: 4 * HOUR, completedAt: '2026-08-10T12:00:00Z' }),
      task({ id: '2', priority: 'HIGH', workedMs: 2 * HOUR, completedAt: '2026-08-11T12:00:00Z' }),
      task({ id: '3', priority: 'LOW', workedMs: HOUR, completedAt: '2026-08-12T12:00:00Z' }),
    ]);

    expect(result.bars).toEqual([
      { priority: 'LOW', averageMs: HOUR, count: 1 },
      // No medium task has ever been finished: the bar still stands in the row,
      // with nothing to draw.
      { priority: 'MEDIUM', averageMs: null, count: 0 },
      { priority: 'HIGH', averageMs: 3 * HOUR, count: 2 },
    ]);
  });

  it('only counts completions inside the chosen window', () => {
    const inside = new Date(NOW - 3 * DAY).toISOString();
    const outside = new Date(NOW - 40 * DAY).toISOString();

    const tasks = [
      task({ id: 'recent', workedMs: 2 * HOUR, completedAt: inside }),
      task({ id: 'old', workedMs: 10 * HOUR, completedAt: outside }),
    ];

    // A week reaches neither back far enough to see the old one...
    expect(perf(tasks, PerformancePeriod.WEEK_1).averageMs).toBe(2 * HOUR);
    // ...a month does not either, at forty days back...
    expect(perf(tasks, PerformancePeriod.MONTH_1).averageMs).toBe(2 * HOUR);
    // ...and three months holds both, so the mean moves.
    expect(perf(tasks, PerformancePeriod.MONTH_3).averageMs).toBe(6 * HOUR);
    expect(perf(tasks, PerformancePeriod.ALL).averageMs).toBe(6 * HOUR);
  });

  it('narrows punctuality by the window too, not just the times', () => {
    const tasks = [
      task({
        id: 'recent',
        workedMs: HOUR,
        dueDate: '2026-08-19T00:00:00Z',
        completedAt: new Date(NOW - 1 * DAY).toISOString(),
      }),
      task({
        id: 'old',
        workedMs: HOUR,
        dueDate: '2026-01-01T00:00:00Z',
        completedAt: new Date(NOW - 200 * DAY).toISOString(),
      }),
    ];

    expect(perf(tasks, PerformancePeriod.WEEK_1)).toMatchObject({ onTime: 1, late: 0 });
    expect(perf(tasks, PerformancePeriod.ALL)).toMatchObject({ onTime: 1, late: 1 });
  });

  it('splits the finished tasks by whether they met their deadline', () => {
    const result = perf([
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
    ]);

    expect(result).toMatchObject({ onTime: 1, late: 1, noDeadline: 1 });
  });
});
