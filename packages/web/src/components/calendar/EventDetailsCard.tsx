import { Clock, MapPin, Shapes, UserRound } from 'lucide-react';

import type { AgendaDto, CalendarEventDto } from '@gloo/shared';

import { AssigneeAvatars } from '@/components/tasks/AssigneeAvatars';
import { CalendarAgendaGlyph, CalendarDayGlyph } from '@/components/common/CalendarGlyph';
import { isNotesEmpty, RichNotes } from '@/components/common/RichNotes';
import {
  OVERVIEW_BAR,
  OVERVIEW_BOX,
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

function formatEventDate(iso: string, isAllDay: boolean): string {
  return new Intl.DateTimeFormat(CALENDAR_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    // An all-day date is floating: read in the viewer's zone it would name the
    // day before for anyone west of Greenwich.
    ...(isAllDay ? { timeZone: 'UTC' } : {}),
  }).format(new Date(iso));
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
 * in the agenda's colour, the same labelled rows at the same size. All of that
 * lives in OverviewCard; what is here is only which facts this side has to tell
 * and how they are formatted.
 *
 * Everything is formatted in the viewer's own zone, for the same reason the
 * blocks are — see formatEventTime. The description is rendered as markup
 * because the modal writes it with the same rich-text editor a task's notes use,
 * and it arrives already sanitised by the API.
 */
export function EventDetailsCard({
  event,
  agenda,
  onEdit,
}: {
  /** Always something: the page does not render this card with nothing to show. */
  event: CalendarEventDto;
  agenda: AgendaDto | undefined;
  onEdit: () => void;
}) {
  return (
    // The heading at the size of the item's own name below it, as on the
    // Agendas card — this is a card naming one thing, not a section of the page.
    <DashboardCard title={strings.calendar.details.title} titleClassName={OVERVIEW_TITLE}>
      <div className={OVERVIEW_BOX}>
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
          >
            {formatEventDate(event.startsAt, event.isAllDay)}
          </OverviewRow>

          <OverviewRow icon={<Clock className={OVERVIEW_ICON} />} label={strings.calendar.details.time}>
            {event.isAllDay
              ? strings.calendar.event.allDay
              : `${formatEventTime(event.startsAt)} – ${formatEventTime(event.endsAt)}`}
          </OverviewRow>

          {/* What this is: an event, a Google task, or a booked appointment slot. */}
          <OverviewRow icon={<Shapes className={OVERVIEW_ICON} />} label={strings.dashboard.day.type}>
            {strings.dashboard.day.itemKind[event.kind]}
          </OverviewRow>

          <OverviewRow
            icon={<CalendarAgendaGlyph className={OVERVIEW_ICON} />}
            label={strings.calendar.details.category}
          >
            <span className="flex min-w-0 items-start gap-2">
              {/* `mt-0.5` rather than centred on the row: a two-line agenda name
                  left the chip floating between its lines instead of beside the
                  first of them. */}
              <span
                aria-hidden
                {...colorFill(agenda?.color ?? 'gray', 'mt-0.5 size-3 shrink-0 rounded-sm')}
              />
              <span className="min-w-0 break-words">{agenda?.name ?? '—'}</span>
            </span>
          </OverviewRow>

          {event.location ? (
            <OverviewRow icon={<MapPin className={OVERVIEW_ICON} />} label={strings.calendar.details.location}>
              {/^https?:\/\//.test(event.location) ? (
                <a
                  href={event.location}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-green-deep underline"
                >
                  {event.location}
                </a>
              ) : (
                event.location
              )}
            </OverviewRow>
          ) : null}

          {event.assignees.length > 0 || event.externalAttendees.length > 0 ? (
            <OverviewRow icon={<UserRound className={OVERVIEW_ICON} />} label={strings.calendar.details.team}>
              <span className="flex flex-wrap items-center gap-2">
                <AssigneeAvatars assignees={event.assignees} />
                {/* Guests Google knows about that have no Gloo user to match.
                    Shown as addresses because that is all we have of them. */}
                {event.externalAttendees.map((email) => (
                  <span key={email} className="text-xs text-muted">
                    {email}
                  </span>
                ))}
              </span>
            </OverviewRow>
          ) : null}

          {isNotesEmpty(event.description ?? '') ? null : (
            <>
              <span className="my-3 h-px w-full bg-border" />
              {/* The same renderer the task and routine modals read a note
                  through, locked. Not dangerouslySetInnerHTML: this markup comes
                  from the rich-text editor and nothing else in the app injects it
                  by hand, so there is one place that decides how stored notes
                  become DOM. */}
              <RichNotes
                value={event.description ?? ''}
                onChange={() => undefined}
                isEditing={false}
                title={null}
                compact
                placeholder=""
                ariaLabel={strings.calendar.event.description}
              />
            </>
          )}
        </div>
      </div>
    </DashboardCard>
  );
}
