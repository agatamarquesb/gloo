import { Clock, Shapes } from 'lucide-react';
import { ScrollShadow } from '@heroui/react';

import { CalendarAgendaGlyph, CalendarDayGlyph } from '@/components/common/CalendarGlyph';
import {
  OVERVIEW_BAR,
  OVERVIEW_BOX,
  OVERVIEW_ICON,
  OVERVIEW_TITLE,
  OverviewChevron,
  OverviewRow,
} from '@/components/common/OverviewCard';

import type { ColorPaint } from '@/theme/labelColors';
import { modalDivider } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import { formatSummaryDate, formatSummaryTime, type DayItem, type DayItemAccent } from './dayAgenda';

/**
 * How much of the day the panel shows before it starts scrolling: two items and
 * the top of a third.
 *
 * A day with eight things on it used to push the Timer below halfway down the
 * page and turn the Dashboard's right-hand column into a list of one day. Two is
 * what the month above can afford to give up — and the sliver of the third is
 * what says there is more, which a clean cut at two would not.
 *
 * A maximum rather than a height: one meeting should not leave two thirds of the
 * panel empty under it.
 */
const LIST_HEIGHT = 'max-h-[17.5rem]';

/**
 * One thing on the day: its name and the four facts about it.
 *
 * Facts only — the note it may carry is deliberately not here. The panel answers
 * "what is on this day", and prose of any length under four one-line rows made
 * the answer a page; the chevron goes to where the whole thing can be read.
 */
function DayItemBlock({
  item,
  paintAccent,
  sourceOf,
  onOpenCalendar,
}: {
  item: DayItem;
  paintAccent: (accent: DayItemAccent, className: string) => ColorPaint;
  sourceOf: (item: DayItem) => string;
  onOpenCalendar: () => void;
}) {
  const time = formatSummaryTime(item);

  return (
    <li className={OVERVIEW_BOX}>
      <span aria-hidden {...paintAccent(item.accent, OVERVIEW_BAR)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Name on the left, the way through on the right. The chevron is the
            only thing in the panel that leaves it: everything here is a summary,
            and the calendar is where you act on it. */}
        <div className="flex items-start justify-between gap-2 pb-1">
          <span className={`${OVERVIEW_TITLE} min-w-0 break-words`}>{item.title}</span>
          <OverviewChevron
            label={strings.dashboard.day.openCalendar}
            onClick={onOpenCalendar}
          />
        </div>

        {/* When before what: a day is read as a sequence, so the two rows that
            place the item in it come first and the rows that describe it
            follow. */}
        {/* The calendar in this row shows the very day it is reporting — see
            CalendarDayGlyph. `item.day` is YYYY-MM-DD, so the day of the month
            is its last two characters. */}
        <OverviewRow
          icon={<CalendarDayGlyph day={Number(item.day.slice(8, 10))} className={OVERVIEW_ICON} />}
          label={strings.dashboard.day.date}
        >
          {formatSummaryDate(item.day)}
        </OverviewRow>
        <OverviewRow icon={<Clock className={OVERVIEW_ICON} />} label={strings.dashboard.day.time}>
          {time ?? strings.dashboard.day.noTime}
        </OverviewRow>
        {/* Shapes rather than a tag: a tag is a thing you *attach*, and the row
            is not about labels — it says what kind of thing this is, which is
            what three different shapes side by side say at a glance. */}
        <OverviewRow icon={<Shapes className={OVERVIEW_ICON} />} label={strings.dashboard.day.type}>
          {strings.dashboard.day.kind[item.kind]}
        </OverviewRow>

        {/* Where it came from, in place of who it is for. The same calendar as
            the Data row, marked with an A: the two rows are about the same
            object seen from two sides — when it is, and which calendar it is in
            — and the pair reads as one family. On this panel the
            question a reader has is which calendar they are looking at — the
            summary is opened from a month whose dots mix both — and the day's
            own tasks are all theirs anyway, so the name added nothing. */}
        <OverviewRow icon={<CalendarAgendaGlyph className={OVERVIEW_ICON} />} label={strings.dashboard.day.source}>
          {sourceOf(item)}
        </OverviewRow>

      </div>
    </li>
  );
}


/**
 * What is on the day you picked, opened underneath the month inside the same
 * card.
 *
 * Part of the calendar card rather than a card of its own: the month is the
 * question and this is the answer, and answering in a second box beside it left
 * the two reading as unrelated. It takes whatever height it needs and the Timer
 * below simply moves down — both are ordinary children of the column, so
 * nothing here can overlap anything there.
 */
export function DayAgendaPanel({
  items,
  paintAccent,
  sourceOf,
  onOpenCalendar,
}: {
  items: DayItem[];
  /** An item's colour, resolved by the card — see DayItemAccent. */
  paintAccent: (accent: DayItemAccent, className: string) => ColorPaint;
  /** Which calendar an item belongs to, resolved by the card. */
  sourceOf: (item: DayItem) => string;
  /** The chevron on each item — through to that day on the calendar page. */
  onOpenCalendar: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 pt-3">
      {/* The rule that separates the answer from the month above it. */}
      <div className={modalDivider} />

      {items.length === 0 ? (
        // Centred, because it is the whole of what the panel has to say and a
        // single short line pinned to the left edge read as a label for the rule
        // above it. Pale, and the panel's own smallest type: nothing to report is
        // not news, and saying so any louder would give an empty day the weight
        // of a full one.
        <p className="py-2 text-center text-xs text-muted/70">{strings.dashboard.day.empty}</p>
      ) : (
        // The negative margin lets the scrollbar sit in the card's own padding
        // rather than over the items' right edge, and the padding puts the items
        // back where they were. Same arrangement the Routines list uses.
        <ScrollShadow className={`${LIST_HEIGHT} gloo-thin-scroll -mr-1.5 overflow-y-auto pr-1.5`}>
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <DayItemBlock
                key={item.id}
                item={item}
                paintAccent={paintAccent}
                sourceOf={sourceOf}
                onOpenCalendar={onOpenCalendar}
              />
            ))}
          </ul>
        </ScrollShadow>
      )}
    </div>
  );
}
