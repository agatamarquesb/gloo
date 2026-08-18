import { Check, MoreHorizontal } from 'lucide-react';
import { Button, Popover } from '@heroui/react';

import type { AgendaDto } from '@gloo/shared';

import { FIELD_PANEL } from '@/theme/fieldStyles';
import { colorFill } from '@/theme/labelColors';
import { modalDivider } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

/**
 * The Dashboard calendar's `···`: which agendas mark the days of its month.
 *
 * Same menu as the Routines card's — the `···` in a card's header corner opens a
 * panel of rows — except that these rows are things that can each be on or off
 * rather than places to go.
 *
 * The tick is drawn *in* the agenda's own colour chip rather than in a box beside
 * it: the chip is already a square that says which agenda this is, and a second
 * square next to it made every row read as two controls. One square, two states.
 *
 * Grouped by account and ruled off between groups, exactly as the Calendar page
 * lists them — with eight agendas across two accounts a flat list gives no clue
 * which are the work ones. Agendas the eye has hidden on that page are left out:
 * they have nothing to offer a filter, and showing one ticked here would promise
 * dots the card would never draw.
 */
export function CalendarAgendaMenu({
  accounts,
  hiddenIds,
  onToggle,
}: {
  /** The account's name and what to list under it — all this menu reads of one. */
  accounts: { id: string; displayName: string; agendas: AgendaDto[] }[];
  hiddenIds: Set<string>;
  onToggle: (agendaId: string) => void;
}) {
  return (
    <Popover>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        // This button lives inside HeroUI's Calendar, whose header hands every
        // Button below it a context that demands a "previous"/"next" slot — a
        // bare one throws before it can render. `null` is React Aria's own way
        // of saying this control is not one of the calendar's parts.
        slot={null}
        className="shrink-0 text-muted"
        aria-label={strings.dashboard.calendarAgendas.title}
      >
        <MoreHorizontal className="size-4" />
      </Button>

      <Popover.Content className={`w-60 ${FIELD_PANEL}`}>
        <Popover.Dialog className="p-1">
          <div className="flex flex-col gap-0.5">
            <p className="px-2 pt-1 pb-1.5 text-xs font-medium text-muted">
              {strings.dashboard.calendarAgendas.title}
            </p>

            {accounts.length === 0 ? (
              <p className="px-2 pb-1 text-sm text-muted">
                {strings.dashboard.calendarAgendas.empty}
              </p>
            ) : (
              accounts.map((account) => (
                <div key={account.id} className="flex flex-col gap-0.5">
                  <span aria-hidden className={`my-1 ${modalDivider}`} />
                  {/* The account's own name — "Gloo", or the address a Google
                      one was linked with. Truncated: an email is longer than
                      this panel and the agendas under it are what matters. */}
                  <p
                    className="truncate px-2 pb-0.5 text-xs font-medium text-muted"
                    title={account.displayName}
                  >
                    {account.displayName}
                  </p>

                  {account.agendas.map((agenda) => {
                    const isShown = !hiddenIds.has(agenda.id);

                    return (
                      // A real checkbox, hidden, with the colour chip drawn in
                      // its place: the control has to be painted per agenda and
                      // a native box cannot be, but everything that makes a
                      // checkbox a checkbox — the role, the state, Space, and a
                      // label that toggles it on click — comes free this way and
                      // would have had to be rebuilt on a button.
                      <label
                        key={agenda.id}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-default/50"
                      >
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={isShown}
                          onChange={() => onToggle(agenda.id)}
                        />

                        {/* Unticked, the chip keeps its colour at a third
                            strength: the row still says which agenda it is,
                            while the ones that are on are the ones that read as
                            solid. `text-black` is only for the palette colours —
                            on a hex the user mixed, colorFill sets a readable
                            ink inline and that wins. The ring is the focus the
                            hidden input can no longer show for itself. */}
                        <span
                          {...colorFill(
                            agenda.color,
                            `flex size-4 shrink-0 items-center justify-center rounded-sm text-black peer-focus-visible:ring-2 peer-focus-visible:ring-green peer-focus-visible:ring-offset-1 ${
                              isShown ? '' : 'opacity-30'
                            }`,
                          )}
                        >
                          {isShown ? <Check className="size-3" strokeWidth={3} /> : null}
                        </span>

                        <span className="min-w-0 truncate text-sm" title={agenda.name}>
                          {agenda.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
