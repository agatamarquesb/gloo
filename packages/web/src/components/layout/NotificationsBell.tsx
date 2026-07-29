import { useState } from 'react';
import { AlarmClock, Bell, Eye, TriangleAlert, X } from 'lucide-react';
import { Button, Popover } from '@heroui/react';

import type { RoutineDto } from '@gloo/shared';

import { RoutineModal } from '@/components/dashboard/RoutineModal';
import { TaskModal } from '@/components/tasks/TaskModal';
import {
  useNotifications,
  type AppNotification,
  type NotificationKind,
} from '@/hooks/queries/notifications';
import { strings } from '@/strings/pt-BR';

const ICON_BY_KIND: Record<NotificationKind, typeof Bell> = {
  TASK_OVERDUE: TriangleAlert,
  ROUTINE_DUE_SOON: AlarmClock,
};

function NotificationRow({
  notification,
  onView,
  onDismiss,
}: {
  notification: AppNotification;
  onView: () => void;
  onDismiss: () => void;
}) {
  const Icon = ICON_BY_KIND[notification.kind];
  const viewLabel =
    notification.target.kind === 'TASK'
      ? strings.notifications.viewTask
      : strings.notifications.viewRoutine;

  return (
    // Same treatment as a task row on the Dashboard: outlined card on the
    // card's own background rather than a filled block.
    <li className="relative rounded-2xl border border-outline-green bg-transparent p-3">
      {/* Both controls sit together in the corner: view first, then dismiss. */}
      <div className="absolute top-1 right-1 flex items-center">
        {/* title on a wrapper, not the Button — HeroUI's Button doesn't forward
            it, and the icon-only control needs a hover hint as well as its
            accessible name. */}
        <span title={viewLabel}>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="text-muted"
            aria-label={viewLabel}
            onPress={onView}
          >
            <Eye className="size-4" />
          </Button>
        </span>

        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="text-muted"
          aria-label={strings.notifications.dismiss}
          onPress={onDismiss}
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* pr-16 keeps the title clear of the two buttons in the corner. */}
      <div className="flex items-start gap-2 pr-16">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">{notification.title}</p>
          <p className="text-xs text-muted">{notification.detail}</p>
        </div>
      </div>
    </li>
  );
}

export function NotificationsBell() {
  const { notifications, dismiss } = useNotifications();
  const [isOpen, setOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [openRoutine, setOpenRoutine] = useState<RoutineDto | null>(null);

  const hasUnread = notifications.length > 0;

  function view(notification: AppNotification) {
    // Close the popover first: the detail modal replaces it rather than
    // stacking on top of it, and dismissing the modal returns to the page
    // underneath — the Dashboard, wherever it was opened from.
    setOpen(false);
    if (notification.target.kind === 'TASK') setOpenTaskId(notification.target.taskId);
    else setOpenRoutine(notification.target.routine);
  }

  return (
    <>
      <Popover isOpen={isOpen} onOpenChange={setOpen}>
        <Button
          isIconOnly
          variant="ghost"
          className="relative rounded-full text-muted"
          aria-label={strings.notifications.open}
        >
          <Bell className="size-5" />
          {hasUnread ? (
            <>
              {/* Presence only, no count: the popover carries the detail, and a
                  number on a 20px icon reads as noise. Ringed in the header bar's
                  own surface so it stays legible over the icon. */}
              <span
                aria-hidden
                className="absolute top-1 right-1 size-2.5 rounded-full bg-danger ring-2 ring-surface"
              />
              <span className="sr-only">{strings.notifications.title}</span>
            </>
          ) : null}
        </Button>

        <Popover.Content className="max-w-80 min-w-72">
          <Popover.Dialog>
            <div className="flex flex-col gap-2">
              <h2 className="px-1 text-sm font-semibold text-foreground">
                {strings.notifications.title}
              </h2>

              {notifications.length === 0 ? (
                <p className="px-1 py-4 text-center text-sm text-muted">
                  {strings.notifications.empty}
                </p>
              ) : (
                // Unbounded on purpose: the list only ever holds what is late or
                // due within two days, so it stays short by construction. The
                // max height is there for the day that stops being true.
                <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
                  {notifications.map((notification) => (
                    <NotificationRow
                      key={notification.id}
                      notification={notification}
                      onView={() => view(notification)}
                      onDismiss={() => dismiss(notification.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>

      {/* Rendered outside the Popover so the modal survives it closing, and so
          it overlays whatever page is behind the header. Both close paths —
          the X and a click on the backdrop — run through onClose. */}
      {openTaskId ? (
        <TaskModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
      ) : null}

      {openRoutine ? (
        <RoutineModal isOpen onClose={() => setOpenRoutine(null)} routine={openRoutine} />
      ) : null}
    </>
  );
}
