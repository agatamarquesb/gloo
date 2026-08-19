import type { Ref } from 'react';
import { Clock, Tag } from 'lucide-react';

import type { AgendaDto, CalendarEventDto } from '@gloo/shared';

import { CalendarDayGlyph } from '@/components/common/CalendarGlyph';
import {
  OVERVIEW_BAR,
  OVERVIEW_ICON,
  OVERVIEW_TITLE,
  OverviewChevron,
  OverviewRow,
} from '@/components/common/OverviewCard';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { CALENDAR_LOCALE } from '@/lib/weekStart';
import { colorFill } from '@/theme/labelColors';
import { strings } from '@/strings/pt-BR';

import { formatEventTime } from './EventBlock';

/**
 * The date in its short form — `22 ago. 2026`.
 *
 * Assembled from the parts rather than taken as a whole, because pt-BR writes a
 * short date as "22 de ago. de 2026" and the two "de"s are three quarters of the
 * width of the row for none of its meaning. Dropping every literal and joining
 * on a space leaves the day, the month and the year, in whatever order the
 * locale puts them.
 */
function formatEventDate(iso: string, isAllDay: boolean): string {
  return new Intl.DateTimeFormat(CALENDAR_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    // An all-day date is floating: read in the viewer's zone it would name the
    // day before for anyone west of Greenwich.
    ...(isAllDay ? { timeZone: 'UTC' } : {}),
  })
    .formatToParts(new Date(iso))
    .filter((part) => part.type !== 'literal')
    .map((part) => part.value)
    .join(' ');
}

/** The number written inside the little calendar, read the same way the row above it is. */
function dayOfMonth(iso: string, isAllDay: boolean): number {
  const date = new Date(iso);
  return isAllDay ? date.getUTCDate() : date.getDate();
}

/**
 * The selected event, read-only, with a chevron through to the dialog that can
 * change it.
 *
 * The Dashboard's day summary drawn a second time — the same box, the same bar
 * in the agenda's colour, the same rows at the same size. All of that lives in
 * OverviewCard; what is here is only which facts this side has to tell and how
 * they are formatted.
 *
 * Headingless, and the rows are read by their icons — see OverviewRow's
 * `hideLabel`. Four facts and no more: when, how long, what kind of thing it
 * is, and whose agenda it is on. The description, the place and the guests are
 * all in the dialog the chevron opens — this card is the glance, not the record,
 * and a note of any length turned the column under it into a scroll.
 *
 * Everything is formatted in the viewer's own zone, for the same reason the
 * blocks are — see formatEventTime.
 */
export function EventDetailsCard({
  event,
  agenda,
  onEdit,
  ref,
}: {
  /** Always something: the page does not render this card with nothing to show. */
  event: CalendarEventDto;
  agenda: AgendaDto | undefined;
  onEdit: () => void;
  /** The page holds this to tell a click inside the card from one outside it. */
  ref?: Ref<HTMLElement>;
}) {
  return (
    // No heading on screen. The card appears only because something was just
    // clicked and it names that thing on its own first line — a word saying
    // "Detalhes" above it was a label for something the reader had already been
    // told. Kept for screen readers, which arrive at the card without having
    // seen the click that opened it.
    <DashboardCard
      ref={ref}
      hideTitle
      title={strings.calendar.details.title}
      titleClassName={OVERVIEW_TITLE}
    >
      {/* The card *is* the box. OVERVIEW_BOX — the bordered, padded frame the
          Dashboard's day panel draws round each of its items — put a second
          rounded outline 20px inside the card's own, and its padding stacked on
          the card's to leave the rows floating in the middle of the column. That
          frame is there to separate one item from the next; here there is only
          ever one. Only the agenda's colour bar survives it. */}
      <div className="flex gap-2.5">
        <span aria-hidden {...colorFill(agenda?.color ?? 'gray', OVERVIEW_BAR)} />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* The event's own name is the heading of the box, with the way out on
              the right of it — exactly as an item on the Dashboard's day panel
              reads. */}
          <div className="flex items-start justify-between gap-2 pb-1">
            <span className={`${OVERVIEW_TITLE} min-w-0 break-words`}>
              {event.title || strings.calendar.event.untitled}
            </span>
            {/* A Google calendar we may only read has nothing to open — a way in
                that leads to a dialog which cannot save is worse than none. */}
            {event.isReadOnly ? null : (
              <OverviewChevron label={strings.common.edit} onClick={onEdit} />
            )}
          </div>

          <OverviewRow
            icon={
              <CalendarDayGlyph
                day={dayOfMonth(event.startsAt, event.isAllDay)}
                className={OVERVIEW_ICON}
              />
            }
            label={strings.calendar.details.date}
            hideLabel
          >
            {formatEventDate(event.startsAt, event.isAllDay)}
          </OverviewRow>

          <OverviewRow
            icon={<Clock className={OVERVIEW_ICON} />}
            label={strings.calendar.details.time}
            hideLabel
          >
            {event.isAllDay
              ? strings.calendar.event.allDay
              : `${formatEventTime(event.startsAt)} – ${formatEventTime(event.endsAt)}`}
          </OverviewRow>

          {/* What this is: an event, a Google task, or a booked appointment slot.
              A tag, which is what a kind is — the `Shapes` glyph it wore said
              "geometry" rather than "category" at 14px. */}
          <OverviewRow
            icon={<Tag className={OVERVIEW_ICON} />}
            label={strings.dashboard.day.type}
            hideLabel
          >
            {strings.dashboard.day.itemKind[event.kind]}
          </OverviewRow>

          <OverviewRow
            // A dot in the agenda's own colour rather than a little calendar.
            // Every other row here is headed by a glyph naming its *kind* of
            // fact; this row's fact is which agenda, and an agenda is its colour
            // — the same dot the month above draws, and the same colour as the
            // bar down the left of this box. Sized to the 14px the glyphs beside
            // it occupy, so the four icons still stack into one column.
            icon={
              <span aria-hidden className={`${OVERVIEW_ICON} flex items-center justify-center`}>
                <span {...colorFill(agenda?.color ?? 'gray', 'size-2.5 rounded-full')} />
              </span>
            }
            label={strings.calendar.details.category}
            hideLabel
          >
            <span className="min-w-0 break-words">{agenda?.name ?? '—'}</span>
          </OverviewRow>
        </div>
      </div>
    </DashboardCard>
  );
}
