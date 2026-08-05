import { ChevronRight } from 'lucide-react';

import { UserAvatar } from '@/components/common/UserAvatar';
import { isNotesEmpty, RichNotes } from '@/components/common/RichNotes';
import { hiddenScrollbar, modalDivider } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import { formatSummaryDate, formatSummaryTime, type DayItem } from './dayAgenda';

/**
 * An item's own heading: 14px, medium — a step under the card titles around it,
 * because this names one thing *inside* a card rather than the card.
 */
const ITEM_TITLE = 'text-sm font-medium text-surface-foreground';

/**
 * A label/value pair, on the property rows' own grid.
 *
 * The label column is fixed rather than sized to its text, so Tipo, Data, Hora
 * and Responsável all answer on one vertical line — the thing that makes four
 * short rows read as a table instead of as four sentences.
 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 py-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="min-w-0 text-xs text-foreground">{children}</span>
    </div>
  );
}

/** One thing on the day: its name, the four facts about it, and any note. */
function DayItemBlock({ item, onOpenCalendar }: { item: DayItem; onOpenCalendar: () => void }) {
  const time = formatSummaryTime(item);
  const hasNote = !isNotesEmpty(item.description ?? '');

  return (
    <li className="flex flex-col">
      {/* Name on the left, the way through on the right — the reference's own
          header row. The chevron is the only thing in the panel that leaves it:
          everything here is a summary, and the calendar is where you act on it. */}
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

      <Row label={strings.dashboard.day.type}>{strings.dashboard.day.kind[item.kind]}</Row>
      <Row label={strings.dashboard.day.date}>{formatSummaryDate(item.day)}</Row>
      <Row label={strings.dashboard.day.time}>{time ?? strings.dashboard.day.noTime}</Row>

      {item.assignees.length > 0 ? (
        <Row label={strings.dashboard.day.assignee}>
          {/* Faces alone, no names: the panel is narrow, and the whole point of
              an avatar row is that you recognise a team without reading it.
              Overlapped and ringed in the card's own surface, so a stack reads
              as several people rather than as one smear. */}
          <span className="flex items-center -space-x-1.5">
            {item.assignees.map((user) => (
              <span key={user.id} className="rounded-full ring-2 ring-surface" title={user.name}>
                <UserAvatar
                  name={user.name}
                  avatarUrl={user.avatarUrl}
                  size="sm"
                  className="size-5"
                />
              </span>
            ))}
          </span>
        </Row>
      ) : null}

      {hasNote ? (
        // Small and mid-grey, under a rule of its own: the note is the one thing
        // here that is prose rather than a fact, so it is set apart from the
        // rows and reads a step quieter than they do.
        //
        // And capped. A note is as long as somebody felt like making it, and one
        // of them ran the summary past the bottom of the window and pushed the
        // Timer off the screen with it. Six lines, then it scrolls inside itself
        // — with no bar, like every other scroller in the app.
        <div
          className={`mt-2 max-h-24 overflow-y-auto border-t border-border pt-2 text-xs text-muted ${hiddenScrollbar} [&_*]:text-xs [&_*]:text-muted`}
        >
          {/* Through the same renderer the modals read a note with, locked —
              this markup comes from the rich-text editor and nothing else in
              the app turns stored notes into DOM. */}
          <RichNotes
            compact
            isEditing={false}
            title={null}
            value={item.description ?? ''}
            onChange={() => undefined}
            placeholder=""
            ariaLabel={item.title}
          />
        </div>
      ) : null}
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
  onOpenCalendar,
}: {
  items: DayItem[];
  /** The chevron on each item — through to that day on the calendar page. */
  onOpenCalendar: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 pt-3">
      {/* The rule that separates the answer from the month above it. */}
      <div className={modalDivider} />

      {items.length === 0 ? (
        // 10px and pale: nothing to report is not news, and saying so in the
        // panel's own type would give an empty day the weight of a full one.
        <p className="py-1 text-[10px] text-muted/70">{strings.dashboard.day.empty}</p>
      ) : (
        // Each thing separated by a rule rather than by air alone: a day with
        // three items on it is three blocks of label/value rows, and without a
        // line between them the rows run together into one long table.
        <ul className="flex flex-col gap-3 [&>li+li]:border-t [&>li+li]:border-border [&>li+li]:pt-3">
          {items.map((item) => (
            <DayItemBlock key={item.id} item={item} onOpenCalendar={onOpenCalendar} />
          ))}
        </ul>
      )}
    </div>
  );
}
