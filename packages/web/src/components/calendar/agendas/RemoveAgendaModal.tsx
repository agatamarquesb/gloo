import { Modal } from '@heroui/react';

import { CalendarProvider, type AgendaDto } from '@gloo/shared';

import { RedButton } from '@/components/common/RedButton';
import { SecondaryButton } from '@/components/common/SecondaryButton';
import { useAgendaEventCount, useDeleteAgenda } from '@/hooks/queries/calendar';
import { dialogFooter, dialogPadding } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

/**
 * Confirming the removal of an agenda.
 *
 * The two providers are removed for different reasons and the copy has to say
 * so: a Gloo agenda is deleted and its events move to the default, while a
 * Google one only leaves Gloo's list and nothing at all changes in the user's
 * Google account. Telling the user "12 eventos serão movidos" about a Google
 * calendar would be a lie, and telling them "nada muda no Google" about a local
 * one would be meaningless.
 */
export function RemoveAgendaModal({
  agenda,
  provider,
  defaultAgendaName,
  onClose,
}: {
  /** Null when nothing is being removed — the modal is closed. */
  agenda: AgendaDto | null;
  provider: CalendarProvider | null;
  defaultAgendaName: string;
  onClose: () => void;
}) {
  const deleteAgenda = useDeleteAgenda();
  const { data: eventCount } = useAgendaEventCount(agenda?.id ?? null);

  const isGoogle = provider === CalendarProvider.GOOGLE;
  const count = eventCount?.count ?? 0;

  return (
    <Modal.Backdrop isOpen={agenda !== null} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog className={`max-w-md rounded-2xl ${dialogPadding}`}>
          <Modal.Header className="p-0">
            <Modal.Heading className="text-lg font-semibold">
              {strings.calendar.agendas.remove}
            </Modal.Heading>
          </Modal.Header>

          <Modal.Body className="flex flex-col gap-3 p-0 pt-3">
            <p className="text-sm">
              <span className="font-medium">{agenda?.name}</span>
            </p>

            {isGoogle ? (
              <p className="text-sm text-muted">{strings.calendar.removeAgenda.googleNote}</p>
            ) : count > 0 ? (
              <p className="text-sm text-muted">
                {count}{' '}
                {count === 1
                  ? strings.calendar.removeAgenda.movingOne
                  : strings.calendar.removeAgenda.movingMany}{' '}
                <span className="font-medium text-foreground">{defaultAgendaName}</span>.
              </p>
            ) : null}

            <p className="text-sm text-muted">{strings.calendar.removeAgenda.hideHint}</p>
          </Modal.Body>

          <Modal.Footer className={`${dialogFooter} flex justify-end gap-2`}>
            <SecondaryButton slot="close">{strings.common.cancel}</SecondaryButton>
            <RedButton
              isDisabled={deleteAgenda.isPending}
              onPress={() =>
                agenda && deleteAgenda.mutate(agenda.id, { onSuccess: onClose })
              }
            >
              {strings.calendar.removeAgenda.confirm}
            </RedButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
