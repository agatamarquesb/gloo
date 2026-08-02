import { describe, expect, it } from 'vitest';

import { clipToDay, layoutAllDay, layoutDay, utcDayKey, type LayoutEvent } from './eventLayout';

/** Midnight UTC on the day every test below draws. */
const DAY = new Date('2026-09-16T00:00:00.000Z');

function at(id: string, from: string, to: string): LayoutEvent {
  return { id, startsAt: `2026-09-16T${from}:00.000Z`, endsAt: `2026-09-16T${to}:00.000Z` };
}

/** id → "column/columns", which is all most of these assertions care about. */
function lanes(positioned: ReturnType<typeof layoutDay>) {
  return Object.fromEntries(
    positioned.map((entry) => [entry.event.id, `${entry.column}/${entry.columns}`]),
  );
}

describe('clipToDay', () => {
  it('converts a same-day event to minutes from midnight', () => {
    expect(clipToDay(at('a', '09:00', '10:30'), DAY)).toEqual({
      startMinute: 540,
      endMinute: 630,
    });
  });

  it('clips the tail of an event that runs into the next day', () => {
    const event = {
      id: 'a',
      startsAt: '2026-09-16T23:00:00.000Z',
      endsAt: '2026-09-17T01:00:00.000Z',
    };
    expect(clipToDay(event, DAY)).toEqual({ startMinute: 1380, endMinute: 1440 });
  });

  it('clips the head of an event that began the previous day', () => {
    const event = {
      id: 'a',
      startsAt: '2026-09-15T23:00:00.000Z',
      endsAt: '2026-09-16T01:00:00.000Z',
    };
    expect(clipToDay(event, DAY)).toEqual({ startMinute: 0, endMinute: 60 });
  });

  it('returns null for an event on another day', () => {
    expect(clipToDay(at('a', '09:00', '10:00'), new Date('2026-09-17T00:00:00.000Z'))).toBeNull();
  });

  it('returns null for an event ending exactly at midnight', () => {
    const event = {
      id: 'a',
      startsAt: '2026-09-15T22:00:00.000Z',
      endsAt: '2026-09-16T00:00:00.000Z',
    };
    expect(clipToDay(event, DAY)).toBeNull();
  });
});

/** Stored as Google stores them: UTC midnight, end exclusive. */
function allDay(id: string, first: string, lastExclusive: string): LayoutEvent {
  return { id, startsAt: `${first}T00:00:00.000Z`, endsAt: `${lastExclusive}T00:00:00.000Z` };
}

function placed(result: ReturnType<typeof layoutAllDay>) {
  return Object.fromEntries(
    result.map((entry) => [
      entry.event.id,
      `col${entry.columnStart}+${entry.columnSpan}/row${entry.row}`,
    ]),
  );
}

describe('all-day placement', () => {
  /** A week of Sunday 13 → Saturday 19 September 2026. */
  const week = [
    '2026-09-13',
    '2026-09-14',
    '2026-09-15',
    '2026-09-16',
    '2026-09-17',
    '2026-09-18',
    '2026-09-19',
  ];

  it('reads the day in UTC, not the viewer time zone', () => {
    // The bug this exists for: converted to a UTC−3 local day, midnight on the
    // 16th is 21:00 on the 15th, and the bar landed a day early.
    expect(utcDayKey('2026-09-16T00:00:00.000Z')).toBe('2026-09-16');
  });

  it('puts a one-day event in its own column', () => {
    const result = layoutAllDay([allDay('a', '2026-09-16', '2026-09-17')], week);
    expect(placed(result)).toEqual({ a: 'col3+1/row0' });
  });

  it('spans a multi-day event across the columns it covers', () => {
    const result = layoutAllDay([allDay('trip', '2026-09-14', '2026-09-17')], week);
    expect(placed(result)).toEqual({ trip: 'col1+3/row0' });
  });

  it('stacks overlapping bars into rows', () => {
    const result = layoutAllDay(
      [allDay('trip', '2026-09-14', '2026-09-17'), allDay('birthday', '2026-09-15', '2026-09-16')],
      week,
    );
    expect(placed(result)).toEqual({ trip: 'col1+3/row0', birthday: 'col2+1/row1' });
  });

  it('reuses a row once the earlier bar has ended', () => {
    const result = layoutAllDay(
      [allDay('a', '2026-09-13', '2026-09-15'), allDay('b', '2026-09-16', '2026-09-18')],
      week,
    );
    expect(placed(result)).toEqual({ a: 'col0+2/row0', b: 'col3+2/row0' });
  });

  it('clips a bar that starts before the week', () => {
    const result = layoutAllDay([allDay('holiday', '2026-09-10', '2026-09-16')], week);
    expect(placed(result)).toEqual({ holiday: 'col0+3/row0' });
  });

  it('clips a bar that runs past the week', () => {
    const result = layoutAllDay([allDay('holiday', '2026-09-18', '2026-09-25')], week);
    expect(placed(result)).toEqual({ holiday: 'col5+2/row0' });
  });

  it('drops a bar entirely outside the week', () => {
    expect(layoutAllDay([allDay('a', '2026-10-01', '2026-10-02')], week)).toEqual([]);
    expect(layoutAllDay([allDay('a', '2026-09-01', '2026-09-02')], week)).toEqual([]);
  });

  it('gives the longer bar the top row when two start together', () => {
    const result = layoutAllDay(
      [allDay('short', '2026-09-14', '2026-09-15'), allDay('long', '2026-09-14', '2026-09-18')],
      week,
    );
    expect(placed(result)).toEqual({ long: 'col1+4/row0', short: 'col1+1/row1' });
  });

  it('handles a single-column week, as the day view has', () => {
    const result = layoutAllDay([allDay('a', '2026-09-16', '2026-09-17')], ['2026-09-16']);
    expect(placed(result)).toEqual({ a: 'col0+1/row0' });
  });

  it('returns nothing when there are no all-day events', () => {
    expect(layoutAllDay([], week)).toEqual([]);
  });
});

describe('layoutDay', () => {
  it('gives a lone event the full width', () => {
    expect(lanes(layoutDay([at('a', '09:00', '10:00')], DAY))).toEqual({ a: '0/1' });
  });

  it('splits two overlapping events into two lanes', () => {
    const result = layoutDay([at('a', '09:00', '11:00'), at('b', '10:00', '12:00')], DAY);
    expect(lanes(result)).toEqual({ a: '0/2', b: '1/2' });
  });

  it('keeps consecutive events full width', () => {
    // b starts exactly when a ends: they never coexist, so neither should be
    // narrowed. This is the case a naive "any event today" grouping gets wrong.
    const result = layoutDay([at('a', '09:00', '10:00'), at('b', '10:00', '11:00')], DAY);
    expect(lanes(result)).toEqual({ a: '0/1', b: '0/1' });
  });

  it('splits three mutually overlapping events three ways', () => {
    const result = layoutDay(
      [at('a', '09:00', '12:00'), at('b', '09:30', '12:00'), at('c', '10:00', '12:00')],
      DAY,
    );
    expect(lanes(result)).toEqual({ a: '0/3', b: '1/3', c: '2/3' });
  });

  it('reuses a freed lane later in the same cluster', () => {
    // a runs all morning; b and c are short and sequential beside it, so both
    // belong in lane 1 rather than c opening a third.
    const result = layoutDay(
      [at('a', '09:00', '12:00'), at('b', '09:00', '10:00'), at('c', '10:00', '11:00')],
      DAY,
    );
    expect(lanes(result)).toEqual({ a: '0/2', b: '1/2', c: '1/2' });
  });

  it('starts a fresh cluster once nothing is still running', () => {
    // The morning pair must not narrow the unrelated afternoon event.
    const result = layoutDay(
      [at('a', '09:00', '11:00'), at('b', '10:00', '12:00'), at('c', '14:00', '15:00')],
      DAY,
    );
    expect(lanes(result)).toEqual({ a: '0/2', b: '1/2', c: '0/1' });
  });

  it('puts the longer of two events starting together on the left', () => {
    const result = layoutDay([at('short', '09:00', '09:30'), at('long', '09:00', '11:00')], DAY);
    expect(lanes(result)).toEqual({ long: '0/2', short: '1/2' });
  });

  it('gives two zero-length events at the same instant their own lanes', () => {
    // Strict overlap would say these miss each other entirely and stack them.
    const result = layoutDay([at('a', '09:00', '09:00'), at('b', '09:00', '09:00')], DAY);
    expect(lanes(result)).toEqual({ a: '0/2', b: '1/2' });
  });

  it('drops events belonging to another day', () => {
    const result = layoutDay(
      [at('a', '09:00', '10:00'), { id: 'b', startsAt: '2026-09-18T09:00:00.000Z', endsAt: '2026-09-18T10:00:00.000Z' }],
      DAY,
    );
    expect(result).toHaveLength(1);
    expect(result[0].event.id).toBe('a');
  });

  it('carries the clipped minutes through to the result', () => {
    const [entry] = layoutDay([at('a', '09:00', '10:30')], DAY);
    expect(entry.startMinute).toBe(540);
    expect(entry.endMinute).toBe(630);
  });

  it('returns nothing for an empty day', () => {
    expect(layoutDay([], DAY)).toEqual([]);
  });

  it('handles a long event spanning several short clusters', () => {
    // The all-day-ish block stays in lane 0 the whole time and everything else
    // fits beside it, in one cluster, two wide.
    const result = layoutDay(
      [
        at('all', '08:00', '18:00'),
        at('x', '09:00', '10:00'),
        at('y', '11:00', '12:00'),
        at('z', '13:00', '14:00'),
      ],
      DAY,
    );
    expect(lanes(result)).toEqual({ all: '0/2', x: '1/2', y: '1/2', z: '1/2' });
  });
});
