import { Pencil } from 'lucide-react';
import { Button } from '@heroui/react';

import type { AgendaDto, CalendarEventDto } from '@gloo/shared';

import { AssigneeAvatars } from '@/components/tasks/AssigneeAvatars';
import { isNotesEmpty, RichNotes } from '@/components/common/RichNotes';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { CALENDAR_LOCALE } from '@/lib/weekStart';
import { colorFill } from '@/theme/labelColors';
import { strings } from '@/strings/pt-BR';

import { formatEventTime } from './EventBlock';

/** Label/value pairs, the same shape the modals' property rows read as. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-2 py-1">
      <span className="text-sm text-muted">{label}</span>
      <span className="min-w-0 text-sm">{children}</span>
    </div>
  );
}

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

/**
 * The selected event, read-only, with a pencil that opens the modal.
 *
 * Everything here is formatted in the viewer's own zone, for the same reason
 * the blocks are — see formatEventTime. The description is rendered as markup
 * because the modal writes it with the same rich-text editor a task's notes
 * use, and it arrives already sanitised by the API.
 */
export function EventDetailsCard({
  event,
  agenda,
  onEdit,
}: {
  event: CalendarEventDto | null;
  agenda: AgendaDto | undefined;
  onEdit: () => void;
}) {
  if (!event) {
    return (
      <DashboardCard title={strings.calendar.details.title}>
        <p className="text-sm text-muted">{strings.calendar.details.empty}</p>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      title={event.title || strings.calendar.event.untitled}
      action={
        // A Google calendar we may only read has nothing to open — offering a
        // pencil that leads to a dialog which cannot save would be worse than
        // offering none.
        event.isReadOnly ? null : (
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="text-muted"
            aria-label={strings.common.edit}
            onPress={onEdit}
          >
            <Pencil className="size-4" />
          </Button>
        )
      }
    >
      <div className="flex flex-col">
        <Row label={strings.calendar.details.category}>
          <span className="inline-flex items-center gap-2">
            <span
              {...colorFill(agenda?.color ?? 'gray', 'size-3 shrink-0 rounded-sm')}
            />
            {agenda?.name ?? '—'}
          </span>
        </Row>

        <Row label={strings.calendar.details.date}>
          {formatEventDate(event.startsAt, event.isAllDay)}
        </Row>

        <Row label={strings.calendar.details.time}>
          {event.isAllDay
            ? strings.calendar.event.allDay
            : `${formatEventTime(event.startsAt)} – ${formatEventTime(event.endsAt)}`}
        </Row>

        {event.recurrence ? (
          <Row label={strings.calendar.details.repeats}>
            {strings.calendar.recurrence[event.recurrence]}
          </Row>
        ) : null}

        {event.location ? (
          <Row label={strings.calendar.details.location}>
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
          </Row>
        ) : null}

        {event.assignees.length > 0 || event.externalAttendees.length > 0 ? (
          <Row label={strings.calendar.details.team}>
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
          </Row>
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
    </DashboardCard>
  );
}
