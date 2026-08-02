import { useState } from 'react';
import { Button, Modal } from '@heroui/react';

import { RecurrenceScope } from '@gloo/shared';

import { AppCheckbox } from '@/components/common/AppCheckbox';
import { SecondaryButton } from '@/components/common/SecondaryButton';
import { dialogFooter, dialogPadding } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

export interface EventChangeChoice {
  /** Undefined when the event does not repeat and no scope was asked for. */
  scope?: RecurrenceScope;
  /** Whether Google should email the other attendees about this change. */
  notify: boolean;
}

/**
 * The one dialog that stands between a change and its consequences.
 *
 * Two questions can apply to the same save, and they used to be two separate
 * modals stacked on each other: which occurrences, and whether to email anyone.
 * Asked one after the other, a simple drag could put two dialogs in the user's
 * way — so this asks whichever of the two actually apply, together, and the
 * caller skips it entirely when neither does.
 *
 * Notification defaults to **off**. Rescheduling a recurring meeting is
 * something people do casually — a drag of a few pixels — and the cost of an
 * unwanted mail-out to a whole team is far higher than the cost of ticking a
 * box when the notice was genuinely wanted.
 */
export function ConfirmEventChangeModal({
  isOpen,
  intent,
  isRecurring,
  otherAttendees,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  /** Deleting phrases both questions differently from editing. */
  intent: 'edit' | 'delete';
  /** Whether to ask which occurrences the change is for. */
  isRecurring: boolean;
  /** How many people other than the organiser are on the event. */
  otherAttendees: number;
  onConfirm: (choice: EventChangeChoice) => void;
  onClose: () => void;
}) {
  const [notify, setNotify] = useState(false);

  const canNotify = otherAttendees > 0;
  const copy = intent === 'delete' ? strings.calendar.confirmChange.delete : strings.calendar.confirmChange.edit;

  function choose(scope?: RecurrenceScope) {
    onConfirm({ scope, notify: canNotify && notify });
    // Reset for the next change, which is a different decision entirely.
    setNotify(false);
  }

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (open) return;
        setNotify(false);
        onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className={`max-w-sm rounded-2xl ${dialogPadding}`}>
          <Modal.Header className="p-0">
            <Modal.Heading className="text-lg font-semibold">{copy.title}</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="flex flex-col gap-3 p-0 pt-2">
            {isRecurring ? <p className="text-sm text-muted">{copy.question}</p> : null}

            {canNotify ? (
              <div className="flex flex-col gap-1 rounded-2xl bg-background/50 p-3 dark:bg-default/40">
                <AppCheckbox isSelected={notify} onChange={setNotify}>
                  <span className="text-sm">{copy.notifyLabel}</span>
                </AppCheckbox>
                {/* Says exactly how many inboxes are involved, because "avisar
                    participantes" on a twelve-person meeting and on a two-person
                    one are very different decisions. */}
                <p className="pl-7 text-xs text-muted">
                  {otherAttendees === 1
                    ? strings.calendar.confirmChange.oneAttendee
                    : `${otherAttendees} ${strings.calendar.confirmChange.manyAttendees}`}
                </p>
              </div>
            ) : null}
          </Modal.Body>

          <Modal.Footer className={`${dialogFooter} flex flex-col gap-2`}>
            {isRecurring ? (
              <>
                <Button
                  variant="primary"
                  fullWidth
                  className="rounded-full"
                  onPress={() => choose(RecurrenceScope.THIS)}
                >
                  {strings.calendar.scope.this}
                </Button>
                <Button
                  variant="outline"
                  fullWidth
                  className="rounded-full"
                  onPress={() => choose(RecurrenceScope.ALL)}
                >
                  {strings.calendar.scope.all}
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                fullWidth
                className="rounded-full"
                onPress={() => choose(undefined)}
              >
                {copy.confirm}
              </Button>
            )}

            <SecondaryButton slot="close" fullWidth>
              {strings.common.cancel}
            </SecondaryButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
