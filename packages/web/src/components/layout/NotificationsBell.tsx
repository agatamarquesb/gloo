import { useState } from 'react';
import { AlarmClock, Bell, TriangleAlert, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button, Popover } from '@heroui/react';

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
  onOpen,
  onDismiss,
}: {
  notification: AppNotification;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const Icon = ICON_BY_KIND[notification.kind];

  return (
    // Same treatment as a task row on the Dashboard: outlined card on the
    // card's own background rather than a filled block.
    <li className="relative rounded-2xl border border-outline-green bg-transparent transition-colors hover:bg-default/40">
      {/* The row itself is the way in — the whole card, not a control tucked in
          its corner. A notification says one thing and has one answer ("take me
          to it"), so the eye that used to sit beside the × was a second target
          for what pressing the notification should plainly do.

          pr-10 keeps the title clear of the × in the corner, which is the one
          thing on the row that is *not* the way in. */}
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full cursor-pointer items-start gap-2 p-3 pr-10 text-left"
      >
        <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground">{notification.title}</span>
          <span className="block text-xs text-muted">{notification.detail}</span>
        </span>
      </button>

      {/* Outside the button, because buttons cannot nest. */}
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        className="absolute top-1 right-1 text-muted"
        aria-label={strings.notifications.dismiss}
        onPress={onDismiss}
      >
        <X className="size-4" />
      </Button>
    </li>
  );
}

export function NotificationsBell() {
  const { notifications, dismiss } = useNotifications();
  const navigate = useNavigate();
  const [isOpen, setOpen] = useState(false);

  const hasUnread = notifications.length > 0;

  /**
   * Follows the notification to wherever the thing it is about lives — see
   * `path` on AppNotification. The popover shuts on the way, since the page
   * under it is about to be replaced.
   */
  function open(notification: AppNotification) {
    setOpen(false);
    navigate(notification.path);
  }

  return (
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
              className="absolute top-1 right-1 size-2.5 rounded-full bg-danger"
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
              <ul className="gloo-thin-scroll flex max-h-96 flex-col gap-2 overflow-y-auto">
                {notifications.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onOpen={() => open(notification)}
                    onDismiss={() => dismiss(notification.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
