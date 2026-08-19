import { useState } from 'react';
import { CalendarPlus, MoreHorizontal } from 'lucide-react';
import { Button, Popover } from '@heroui/react';

import { CalendarProvider, LABEL_COLORS, type AgendaDto, type PaletteColor } from '@gloo/shared';

import { GoogleCalendarIcon } from '@/components/common/GoogleCalendarIcon';
import { OVERVIEW_TITLE } from '@/components/common/OverviewCard';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { useCalendarAccounts, useCreateAgenda } from '@/hooks/queries/calendar';
import { FIELD_PANEL } from '@/theme/fieldStyles';
import { dotsMenuButton, menuRow } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import { AccountGroup } from './AccountGroup';
import { NewAgendaRow } from './NewAgendaRow';
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
  /** True while an agenda is being written — see NewAgendaRow. */
  const [isDrafting, setDrafting] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [removing, setRemoving] = useState<RemovalTarget | null>(null);

  const glooAccount = accounts.find((account) => account.provider === CalendarProvider.GLOO);
  const allAgendas = accounts.flatMap((account) => account.agendas);
  const defaultAgendaName = allAgendas.find((agenda) => agenda.isDefault)?.name ?? '';

  /**
   * What the new row opens on: the first palette colour nothing else is wearing,
   * or the top of the palette once all ten are taken. The same rule the API used
   * to apply on its own, moved to where it can now be seen and changed.
   */
  const takenColors = new Set(allAgendas.map((agenda) => agenda.color));
  const nextColor: PaletteColor =
    LABEL_COLORS.find((color) => !takenColors.has(color)) ?? LABEL_COLORS[0];

  function commitNewAgenda(name: string, color: PaletteColor) {
    if (glooAccount) createAgenda.mutate({ accountId: glooAccount.id, name, color });
    setDrafting(false);
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
        // The name of the list sits just above it: at the card's usual gap-4 the
        // word floated halfway between the month above and the first agenda.
        bodyGap="gap-1"
        // `grow shrink-0`: the card takes any height the column has spare, and
        // keeps its full content height when it hasn't — so the list is never
        // cut, and what scrolls is the row around it.
        className="grow shrink-0"
        action={
          <Popover isOpen={isMenuOpen} onOpenChange={setMenuOpen}>
            {/* 20px, which is also the height of the title beside it: at
                HeroUI's 32px the button sat 6px lower than the word it belongs
                to, since the header aligns its two ends to the top. */}
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className={`${dotsMenuButton} size-5 min-w-0 p-0`}
              aria-label={strings.calendar.agendas.manage}
            >
              <MoreHorizontal className="size-4" />
            </Button>

            {/* Right-aligned under the `···` and narrower than it was: at 240px
                a panel hanging off a button in the card's top corner ran past
                the card's own edge and out over the page. 224px is as narrow as
                it goes with "Adicionar Google Agenda" on one line. */}
            <Popover.Content placement="bottom end" className={`w-56 ${FIELD_PANEL}`}>
              <Popover.Dialog className="p-1">
                <div className="flex flex-col gap-0.5">
                  {/* Creates it in the Gloo account: it is the only one whose
                      agendas are ours to make — a Google agenda has to be made
                      in Google. */}
                  <button
                    type="button"
                    className={menuRow}
                    onClick={() => {
                      setDrafting(true);
                      // The row it opens is under this panel. Leaving the menu
                      // up meant answering it and then having to dismiss it to
                      // see what you had asked for.
                      setMenuOpen(false);
                    }}
                    disabled={!glooAccount}
                  >
                    <CalendarPlus className="size-4" />
                    {strings.calendar.agendas.createAgenda}
                  </button>
                  <button
                    type="button"
                    className={menuRow}
                    onClick={() => {
                      onLinkGoogle();
                      setMenuOpen(false);
                    }}
                  >
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
          // No scroller of its own: the card is as tall as the whole list, and
          // the second row of the column is the one place a long list is
          // scrolled. Two nested scrollers meant the agendas moved under the
          // pointer while the card they were in stayed put.
          <div className="flex flex-1 flex-col gap-4">
            {accounts.map((account) => (
              <AccountGroup
                key={account.id}
                account={account}
                onRequestRemoveAgenda={(agenda, provider) => setRemoving({ agenda, provider })}
                // A new agenda is written at the end of the Gloo list, where it
                // will appear — see NewAgendaRow. It has no button of its own:
                // the `···` beside the title is what asks for one.
                draft={
                  isDrafting && account.id === glooAccount?.id ? (
                    <NewAgendaRow
                      defaultColor={nextColor}
                      onSave={commitNewAgenda}
                      onCancel={() => setDrafting(false)}
                    />
                  ) : undefined
                }
              />
            ))}
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

