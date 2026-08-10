import type { ComponentType } from 'react';
import { CalendarDays, ChevronRight, Clock, Tag, UserRound } from 'lucide-react';

import { UserAvatar } from '@/components/common/UserAvatar';
import type { ColorPaint } from '@/theme/labelColors';
import { modalDivider } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import { formatSummaryDate, formatSummaryTime, type DayItem, type DayItemAccent } from './dayAgenda';

/**
 * An item's own heading: 14px, medium — a step under the card titles around it,
 * because this names one thing *inside* a card rather than the card.
 */
const ITEM_TITLE = 'text-sm font-medium text-surface-foreground';

/**
 * One thing on the day, as its own box.
 *
 * The items used to be blocks of rows with a hairline between them, which read
 * as one long table broken up rather than as two or three separate things. A
 * border round each says what the rule was trying to: this is where the meeting
 * ends and the task begins.
 */
const ITEM_BOX = 'flex gap-3 rounded-2xl border border-border p-3';

/**
 * The bar down an item's left edge, in the colour of the agenda or sector it
 * belongs to — the same colour as that day's dot on the month above.
 *
 * `self-stretch` rather than a height: it is as tall as the item beside it,
 * whatever that item turns out to hold. Inside the box's padding rather than on
 * its edge, so the rounded ends read as a mark on the card instead of as a
 * thickened border.
 */
const ITEM_BAR = 'w-1 shrink-0 self-stretch rounded-full';

/**
 * A label/value pair, on the property rows' own grid.
 *
 * The label column is fixed rather than sized to its text, so Data, Hora, Tipo
 * and Responsável all answer on one vertical line — the thing that makes four
 * short rows read as a table instead of as four sentences. Wide enough for
 * "Responsável" with its icon, which is the longest of the four.
 *
 * `py-1` and not the half it was: the rows carry an avatar and icons now, and at
 * 2px of air they were four lines of text touching each other.
 */
function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-center gap-2 py-1">
      {/* The icon at full strength while the word stays grey, as in the two
          entity modals — see LABEL_ICON. At this size a muted glyph is mostly
          gone, and these are what the column is scanned by. */}
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <Icon className="size-3.5 shrink-0 text-foreground" />
        {label}
      </span>
      <span className="min-w-0 text-xs text-foreground">{children}</span>
    </div>
  );
}

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
  onOpenCalendar,
}: {
  item: DayItem;
  paintAccent: (accent: DayItemAccent, className: string) => ColorPaint;
  onOpenCalendar: () => void;
}) {
  const time = formatSummaryTime(item);

  return (
    <li className={ITEM_BOX}>
      <span aria-hidden {...paintAccent(item.accent, ITEM_BAR)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Name on the left, the way through on the right. The chevron is the
            only thing in the panel that leaves it: everything here is a summary,
            and the calendar is where you act on it. */}
        <div className="flex items-start justify-between gap-2 pb-1">
          <span className={`${ITEM_TITLE} min-w-0 break-words`}>{item.title}</span>
          <button
            type="button"
            className="flex shrink-0 cursor-pointer items-center text-muted transition-colors hover:text-surface-foreground"
            aria-label={strings.dashboard.day.openCalendar}
            title={strings.dashboard.day.openCalendar}
            onClick={onOpenCalendar}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* When before what: a day is read as a sequence, so the two rows that
            place the item in it come first and the rows that describe it
            follow. */}
        <Row icon={CalendarDays} label={strings.dashboard.day.date}>
          {formatSummaryDate(item.day)}
        </Row>
        <Row icon={Clock} label={strings.dashboard.day.time}>
          {time ?? strings.dashboard.day.noTime}
        </Row>
        {/* The tag turned flat: lucide's own points down and to the right, and a
            label on a row of labels reads as one lying on its side. */}
        <Row icon={TagHorizontal} label={strings.dashboard.day.type}>
          {strings.dashboard.day.kind[item.kind]}
        </Row>

        {item.assignees.length > 0 ? (
          <Row icon={UserRound} label={strings.dashboard.day.assignee}>
            {/* One person is a face and a name — the same pair the two entity
                modals show, and a lone unlabelled avatar was a riddle. Several
                are faces alone: three names in a column this narrow wrap onto
                three lines, and recognising a team without reading it is what an
                avatar row is for. Overlapped and ringed in the card's own
                surface, so a stack reads as several people rather than as one
                smear.

                16px, down from 20: the avatars are inside a row of 12px text
                now, and at 20 they set the height of every row they appeared in
                — one line of the four standing taller than the other three. */}
            {item.assignees.length === 1 ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <UserAvatar
                  name={item.assignees[0].name}
                  avatarUrl={item.assignees[0].avatarUrl}
                  size="sm"
                  className="size-4 shrink-0"
                />
                <span className="truncate">{item.assignees[0].name}</span>
              </span>
            ) : (
              <span className="flex items-center -space-x-1">
                {item.assignees.map((user) => (
                  <span key={user.id} className="rounded-full ring-2 ring-surface" title={user.name}>
                    <UserAvatar
                      name={user.name}
                      avatarUrl={user.avatarUrl}
                      size="sm"
                      className="size-4"
                    />
                  </span>
                ))}
              </span>
            )}
          </Row>
        ) : null}
      </div>
    </li>
  );
}

/** lucide's Tag, lying flat: its point runs down-right at 45°, so -45° levels it. */
function TagHorizontal({ className = '' }: { className?: string }) {
  return <Tag className={`${className} -rotate-45`} />;
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
  onOpenCalendar,
}: {
  items: DayItem[];
  /** An item's colour, resolved by the card — see DayItemAccent. */
  paintAccent: (accent: DayItemAccent, className: string) => ColorPaint;
  /** The chevron on each item — through to that day on the calendar page. */
  onOpenCalendar: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 pt-3">
      {/* The rule that separates the answer from the month above it. */}
      <div className={modalDivider} />

      {items.length === 0 ? (
        // Pale, and the panel's own smallest type: nothing to report is not
        // news, and saying so any louder would give an empty day the weight of a
        // full one.
        <p className="py-1 text-xs text-muted/70">{strings.dashboard.day.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <DayItemBlock
              key={item.id}
              item={item}
              paintAccent={paintAccent}
              onOpenCalendar={onOpenCalendar}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
