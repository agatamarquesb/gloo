import { useState } from 'react';
import { CalendarPlus, MoreHorizontal } from 'lucide-react';
import { Button, Input, Popover } from '@heroui/react';
import { TextField } from 'react-aria-components';

import { CalendarProvider, type AgendaDto } from '@gloo/shared';

import { GoogleCalendarIcon } from '@/components/common/GoogleCalendarIcon';
import { OVERVIEW_TITLE } from '@/components/common/OverviewCard';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { useCalendarAccounts, useCreateAgenda } from '@/hooks/queries/calendar';
import { FIELD_PANEL } from '@/theme/fieldStyles';
import { dotsMenuButton, menuRow } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import { AccountGroup } from './AccountGroup';
import { RemoveAgendaModal } from './RemoveAgendaModal';

/** Which agenda the confirmation modal is about, and where it came from. */
interface RemovalTarget {
  agenda: AgendaDto;
  provider: CalendarProvider;
}

/**
 * The Agendas card: every account the user has, the agendas under each, and the
 * two ways to add more.
 *
 * This is also the calendar's filter. The grid draws whatever is not hidden
 * here, which is why the toolbar above it carries no agenda pills — an agenda
 * stopped being a tag the moment it gained an account, a colour and an eye.
 */
export function AgendasCard({ onLinkGoogle }: { onLinkGoogle: () => void }) {
  const { data: accounts = [], isPending } = useCalendarAccounts();
  const createAgenda = useCreateAgenda();
  const [draftName, setDraftName] = useState<string | null>(null);
  const [removing, setRemoving] = useState<RemovalTarget | null>(null);

  const glooAccount = accounts.find((account) => account.provider === CalendarProvider.GLOO);
  const defaultAgendaName =
    accounts
      .flatMap((account) => account.agendas)
      .find((agenda) => agenda.isDefault)?.name ?? '';

  function commitNewAgenda() {
    const name = draftName?.trim();
    if (name && glooAccount) {
      // No colour in the payload: the API picks the first one the user isn't
      // already using, which is a better default than making them choose before
      // they have seen the agenda exist.
      createAgenda.mutate({ accountId: glooAccount.id, name });
    }
    setDraftName(null);
  }

  return (
    <>
      <DashboardCard
        title={strings.calendar.agendas.title}
        // The name of a list, set at the size the things in the list are named
        // at — see OVERVIEW_TITLE. At the card-title size it was the largest
        // type in the column and read as the heading of everything under it,
        // Detalhes included.
        titleClassName={OVERVIEW_TITLE}
        // The card fills whatever the column has left and the list inside it
        // scrolls — see the wrapper below. The floor is what keeps it a list:
        // squeezed to the few pixels a tall Detalhes card leaves over, it became
        // a title with a scrollbar under it.
        className="min-h-[9rem] flex-1"
        action={
          <Popover>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className={dotsMenuButton}
              aria-label={strings.calendar.agendas.manage}
            >
              <MoreHorizontal className="size-4" />
            </Button>

            <Popover.Content className={`w-60 ${FIELD_PANEL}`}>
              <Popover.Dialog className="p-1">
                <div className="flex flex-col gap-0.5">
                  {/* Creates it in the Gloo account: it is the only one whose
                      agendas are ours to make — a Google agenda has to be made
                      in Google. */}
                  <button
                    type="button"
                    className={menuRow}
                    onClick={() => setDraftName('')}
                    disabled={!glooAccount}
                  >
                    <CalendarPlus className="size-4" />
                    {strings.calendar.agendas.createAgenda}
                  </button>
                  <button type="button" className={menuRow} onClick={onLinkGoogle}>
                    <GoogleCalendarIcon className="size-4" />
                    {strings.calendar.agendas.addGoogle}
                  </button>
                </div>
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
        }
      >
        {isPending ? (
          <p className="text-sm text-muted">{strings.common.loading}</p>
        ) : (
          // The list is what scrolls, not the page: an account with thirty
          // agendas under it used to push the whole column down and take the
          // calendar's own scrollbar with it. The card's height is fixed by the
          // column, and everything past it is reached inside this box.
          <div className="gloo-thin-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            {accounts.map((account) => (
              <AccountGroup
                key={account.id}
                account={account}
                onRequestRemoveAgenda={(agenda, provider) => setRemoving({ agenda, provider })}
              />
            ))}

            {/* Where a new agenda is typed. It has no button of its own any
                more — the `···` above is what asks for one — so it is only ever
                on screen between that press and Enter. */}
            {draftName === null ? null : (
              <TextField
                aria-label={strings.calendar.agendas.newAgenda}
                value={draftName}
                onChange={setDraftName}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitNewAgenda();
                  if (event.key === 'Escape') setDraftName(null);
                }}
                // Same as the account rename: the field appears because
                // "Criar nova agenda" was pressed, so the caret belongs in it.
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              >
                <Input
                  className="h-8 text-sm"
                  placeholder={strings.calendar.agendas.newAgenda}
                  onBlur={commitNewAgenda}
                />
              </TextField>
            )}
          </div>
        )}
      </DashboardCard>

      <RemoveAgendaModal
        agenda={removing?.agenda ?? null}
        provider={removing?.provider ?? null}
        defaultAgendaName={defaultAgendaName}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}

