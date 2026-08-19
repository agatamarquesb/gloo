import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, MoreVertical, Pencil, Unlink } from 'lucide-react';
import { Button, Input, Popover } from '@heroui/react';
import { TextField } from 'react-aria-components';

import { CalendarProvider, type AgendaDto, type CalendarAccountDto } from '@gloo/shared';

import {
  useDisconnectCalendarAccount,
  useUpdateCalendarAccount,
} from '@/hooks/queries/calendar';
import { FIELD_PANEL } from '@/theme/fieldStyles';
import { dotsMenuButton, menuRow, quietTextButton } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import { AgendaRow } from './AgendaRow';


/**
 * One account and the agendas under it, foldable.
 *
 * The fold state is on the server rather than in component state: it is a
 * preference, and a user who collapses a noisy work account expects it to stay
 * collapsed on the next visit. Written through the same PATCH that renames the
 * account.
 */
export function AccountGroup({
  account,
  onRequestRemoveAgenda,
  draft,
}: {
  account: CalendarAccountDto;
  onRequestRemoveAgenda: (agenda: AgendaDto, provider: CalendarProvider) => void;
  /**
   * The agenda being made, if one is and it belongs here — rendered as the last
   * line of this list so it is written where it will end up. Only the Gloo
   * account is ever given one: a Google agenda has to be made in Google.
   */
  draft?: ReactNode;
}) {
  const updateAccount = useUpdateCalendarAccount();
  const disconnect = useDisconnectCalendarAccount();
  const [renaming, setRenaming] = useState<string | null>(null);

  const isGoogle = account.provider === CalendarProvider.GOOGLE;

  function commitRename() {
    const name = renaming?.trim();
    if (name && name !== account.displayName) {
      updateAccount.mutate({ id: account.id, displayName: name });
    }
    setRenaming(null);
  }

  return (
    <section className="flex flex-col gap-1">
      <header className="group flex items-center gap-1">
        <button
          type="button"
          className={`${quietTextButton} min-w-0 flex-1 gap-1.5`}
          aria-expanded={!account.isCollapsed}
          onClick={() =>
            updateAccount.mutate({ id: account.id, isCollapsed: !account.isCollapsed })
          }
        >
          {account.isCollapsed ? (
            <ChevronRight className="size-3.5 shrink-0" />
          ) : (
            <ChevronDown className="size-3.5 shrink-0" />
          )}
          {renaming === null ? (
            <span className="min-w-0 flex-1 truncate text-left text-xs font-medium">
              {account.displayName}
              {/* The address is only worth appending once the group has been
                  renamed to something else — a freshly linked account is named
                  after its own email, and showing both read as
                  "ana@gmail.com · ana@gmail.com". */}
              {account.googleEmail && account.googleEmail !== account.displayName ? (
                <span className="text-muted"> · {account.googleEmail}</span>
              ) : null}
            </span>
          ) : null}
        </button>

        {renaming !== null ? (
          <TextField
            aria-label={strings.calendar.agendas.rename}
            value={renaming}
            onChange={setRenaming}
            // Enter commits, Escape abandons — the same two keys the routine
            // and task titles answer to.
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRename();
              if (event.key === 'Escape') setRenaming(null);
            }}
            // The field only exists because "Renomear" was just pressed, so the
            // caret has to arrive with it — focus following a deliberate
            // action, which is what the rule is there to protect.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            className="min-w-0 flex-1"
          >
            <Input className="h-7 text-xs" onBlur={commitRename} />
          </TextField>
        ) : null}

        {/* The Gloo account is built in: there is nothing to rename it away
            from and nothing to disconnect, so it carries no menu at all. */}
        {isGoogle ? (
          <Popover>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className={`${dotsMenuButton} size-5 min-w-0 p-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100`}
              aria-label={strings.calendar.agendas.manageAccount}
            >
              {/* Vertical and on the row's own right-hand end, like the one on
                  an agenda under it — and, like that one, only there while the
                  pointer is on the row. */}
              <MoreVertical className="size-4" />
            </Button>

            <Popover.Content placement="bottom end" className={`w-52 ${FIELD_PANEL}`}>
              <Popover.Dialog className="p-1">
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    className={menuRow}
                    onClick={() => setRenaming(account.displayName)}
                  >
                    <Pencil className="size-4" />
                    {strings.calendar.agendas.rename}
                  </button>
                  <button
                    type="button"
                    className={`${menuRow} text-danger hover:text-danger`}
                    onClick={() => disconnect.mutate(account.id)}
                  >
                    <Unlink className="size-4" />
                    {strings.calendar.agendas.disconnect}
                  </button>
                </div>
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
        ) : null}
      </header>

      {account.needsReauth ? (
        <p className="px-2 text-xs text-danger">{strings.calendar.agendas.reauthNeeded}</p>
      ) : null}

      {/* A collapsed group still opens for a draft: the alternative is pressing
          "Criar nova agenda" and watching nothing happen.

          `gap-0.5` puts the hair of space between the rows on the list rather
          than in the rows themselves: padding inside a row grows the ground that
          lights up under it, and that band is meant to stay tight to the name. */}
      {account.isCollapsed && !draft ? null : (
        <ul className="flex flex-col gap-0.5">
          {account.agendas.map((agenda) => (
            <AgendaRow
              key={agenda.id}
              agenda={agenda}
              onRequestRemove={() => onRequestRemoveAgenda(agenda, account.provider)}
            />
          ))}
          {draft}
        </ul>
      )}
    </section>
  );
}
