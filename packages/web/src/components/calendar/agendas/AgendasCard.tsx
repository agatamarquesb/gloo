import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Input } from '@heroui/react';
import { TextField } from 'react-aria-components';

import { CalendarProvider, type AgendaDto } from '@gloo/shared';

import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { useCalendarAccounts, useCreateAgenda } from '@/hooks/queries/calendar';
import { menuRow } from '@/theme/styleConstants';
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
      <DashboardCard title={strings.calendar.agendas.title}>
        {isPending ? (
          <p className="text-sm text-muted">{strings.common.loading}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {accounts.map((account) => (
              <AccountGroup
                key={account.id}
                account={account}
                onRequestRemoveAgenda={(agenda, provider) => setRemoving({ agenda, provider })}
              />
            ))}

            <div className="flex flex-col gap-1">
              {draftName === null ? (
                <button type="button" className={menuRow} onClick={() => setDraftName('')}>
                  <Plus className="size-4" />
                  {strings.calendar.agendas.newAgenda}
                </button>
              ) : (
                <TextField
                  aria-label={strings.calendar.agendas.newAgenda}
                  value={draftName}
                  onChange={setDraftName}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitNewAgenda();
                    if (event.key === 'Escape') setDraftName(null);
                  }}
                  // Same as the account rename: the field appears because
                  // "Nova agenda" was pressed, so the caret belongs in it.
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

              <Button
                variant="outline"
                size="sm"
                fullWidth
                className="rounded-full border-dashed"
                onPress={onLinkGoogle}
              >
                <Plus className="size-4" />
                {strings.calendar.agendas.addAccount}
              </Button>
            </div>
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

