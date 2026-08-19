import { Modal } from '@heroui/react';

import { RedButton } from '@/components/common/RedButton';
import { SecondaryButton } from '@/components/common/SecondaryButton';
import { dialogFooter, dialogPadding } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

/**
 * What stands between a colour and the Google label it would destroy.
 *
 * Google Calendar has two ways of colouring one card: an *event colour*, which
 * is one of eleven ids and is the only one anything outside Google may write,
 * and an *event label*, which is newer, is what most of this user's coloured
 * cards actually wear, and is unreachable — the API returns an opaque id with no
 * name and no colour attached, resolves it nowhere, and ignores the field on
 * write.
 *
 * The two do not coexist. Setting a colour clears the label, measurably and on
 * Google's side, and nothing can put it back: the write that would restore it is
 * the write Google ignores. So this is not the usual "are you sure" over
 * something a second press could undo — it is the last point at which the label
 * still exists.
 *
 * Which is why it asks *before* the colour is even applied to the form, rather
 * than at Salvar. A warning that arrives after the choice has been made reads as
 * an obstacle; this one is the choice.
 */
export function ConfirmLabelLossModal({
  isOpen,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const copy = strings.calendar.labelLoss;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog className={`max-w-sm rounded-2xl ${dialogPadding}`}>
          <Modal.Header className="p-0">
            <Modal.Heading className="text-lg font-semibold">{copy.title}</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="flex flex-col gap-2 p-0 pt-2">
            <p className="text-sm text-muted">{copy.body}</p>
            {/* The irreversibility on its own line and in the danger colour: it
                is the one fact here that a reader cannot recover from getting
                wrong. */}
            <p className="text-sm font-medium text-danger">{copy.permanent}</p>
          </Modal.Body>

          <Modal.Footer className={`${dialogFooter} flex flex-col gap-2`}>
            {/* Red, because this destroys something — the same button the app
                uses for every other irreversible act. */}
            <RedButton fullWidth className="rounded-full" onPress={onConfirm}>
              {copy.confirm}
            </RedButton>
            <SecondaryButton slot="close" fullWidth>
              {strings.common.cancel}
            </SecondaryButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
