import { useState } from 'react';
import { ChevronLeft, ChevronRight, CircleDot, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button, Input, Popover } from '@heroui/react';
import { TextField } from 'react-aria-components';

import { CalendarProvider, type AgendaDto } from '@gloo/shared';

import { useShowOnlyAgenda, useUpdateAgenda } from '@/hooks/queries/calendar';
import { ColorPicker } from '@/components/common/ColorPicker';
import { colorFill } from '@/theme/labelColors';
import { FIELD_PANEL } from '@/theme/fieldStyles';
import { dotsMenuButton, menuRow } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

/**
 * The panel is either the menu, the colour list or the name field — never two of
 * them, as in Notion.
 */
type View = 'menu' | 'color' | 'rename';


/**
 * The menu on an agenda row: rename, recolour, make default, show only this,
 * remove.
 *
 * A Popover rather than HeroUI's Menu because of the colour step — a Menu item
 * that opens a submenu in place is not something Menu does, and the app has no
 * other submenu to follow. The views swap inside one panel, the same shape
 * LabelPicker uses for its list/edit switch.
 *
 * This is also the *only* way an agenda's colour is chosen. The row that creates
 * one no longer asks: a new agenda opens on the colour the palette had spare,
 * and changing it is a second thought that belongs where every other second
 * thought about an agenda already is.
 */
export function AgendaMenu({
  agenda,
  provider,
  onRequestRemove,
}: {
  agenda: AgendaDto;
  /**
   * Which account it hangs under. Only one thing turns on it — a Google agenda
   * cannot be the default — but that one thing is not derivable from the agenda
   * itself, since `isReadOnly` marks only the calendars we may not write to and
   * most Google agendas are writable.
   */
  provider: CalendarProvider;
  /** Removal needs a confirmation modal, which belongs above this popover. */
  onRequestRemove: () => void;
}) {
  const [view, setView] = useState<View>('menu');
  const [draftName, setDraftName] = useState(agenda.name);
  const updateAgenda = useUpdateAgenda();
  const showOnly = useShowOnlyAgenda();

  const isGoogle = provider === CalendarProvider.GOOGLE;

  /** Enter or a press on the tick. An empty name is an abandoned edit. */
  function commitRename() {
    const name = draftName.trim();
    if (name && name !== agenda.name) updateAgenda.mutate({ id: agenda.id, name });
    setView('menu');
  }

  // The inbox is not somewhere events are authored and not somewhere the user
  // made, so two of the actions don't apply to it. Nor does a Google agenda
  // qualify: the default is where an event lands when none was named, and
  // sending those to somebody else's calendar — or to a mirror that a lost token
  // stops accepting writes — is not a default anyone chose. Google's own
  // calendars have a primary of their own over there.
  const canBeDefault =
    !agenda.isShared && !agenda.isReadOnly && !agenda.isDefault && !isGoogle;
  // The inbox is named after what lands in it, and a read-only calendar is
  // Google's to name.
  const canRename = !agenda.isShared && !agenda.isReadOnly;
  // The default is as fixed as the inbox: something has to receive events that
  // name no agenda, so it can only be retired by promoting another one first.
  // Offering "Remover" here would open a confirmation the API then refuses.
  const canRemove = !agenda.isShared && !agenda.isDefault;

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) setDraftName(agenda.name);
        else setView('menu');
      }}
    >
      {/* Sized down to the line it ends: HeroUI's small icon button is 32px
          square, which held every agenda row at 32px however tight its own
          padding was. */}
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        className={`${dotsMenuButton} size-5 min-w-0 p-0`}
        aria-label={strings.calendar.agendas.manageAgenda}
      >
        {/* A chevron rather than the card header's `···`: three dots say "more
            of this panel", and what this opens is everything about one agenda —
            the same "through to this line" the details card's own chevron
            means. It ends the row on the card's right edge, directly under the
            `···` in the header above the list. */}
        <ChevronRight className="size-4" />
      </Button>

      {/* Below the row it belongs to and flush with its right-hand end — the
          same placement every dropdown in the app takes (see LabelPicker). It
          used to open centred on the button, which put it over the agenda above
          the one being changed. Narrow enough to stay inside the card. */}
      <Popover.Content placement="bottom end" className={`w-52 ${FIELD_PANEL}`}>
        <Popover.Dialog className="p-1">
          {view === 'rename' ? (
            <div className="flex flex-col gap-1">
              <button type="button" className={menuRow} onClick={() => setView('menu')}>
                <ChevronLeft className="size-4" />
                {strings.calendar.agendas.renameAgenda}
              </button>
              {/* The name is typed in the panel rather than back on the row: the
                  row is 18px of checkbox and a truncated label, and a field
                  opened in it would be narrower than most agenda names. */}
              <div className="p-2">
                <TextField
                  aria-label={strings.calendar.agendas.renameAgenda}
                  value={draftName}
                  onChange={setDraftName}
                  // Enter commits, Escape goes back — the same two keys the
                  // account's own name field answers to.
                  onKeyDown={(pressed) => {
                    if (pressed.key === 'Enter') commitRename();
                    if (pressed.key === 'Escape') setView('menu');
                  }}
                  // The field only exists because "Renomear" was just pressed,
                  // so the caret has to arrive with it.
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  className="w-full"
                >
                  <Input fullWidth className="h-7 text-xs" onBlur={commitRename} />
                </TextField>
              </div>
            </div>
          ) : view === 'color' ? (
            <div className="flex flex-col gap-1">
              <button type="button" className={menuRow} onClick={() => setView('menu')}>
                <ChevronLeft className="size-4" />
                {strings.calendar.agendas.color}
              </button>
              {/* The app's one colour picker — the ten it ships with, and
                  whatever this browser has mixed. Same panel a label opens. */}
              <div className="p-2">
                <ColorPicker
                  value={agenda.color}
                  onChange={(color) => updateAgenda.mutate({ id: agenda.id, color })}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              <button type="button" className={menuRow} onClick={() => setView('color')}>
                <span {...colorFill(agenda.color, 'size-3.5 rounded-sm')} />
                <span className="flex-1 text-left">{strings.calendar.agendas.color}</span>
                <ChevronRight className="size-4" />
              </button>

              {canRename ? (
                <button type="button" className={menuRow} onClick={() => setView('rename')}>
                  <Pencil className="size-4" />
                  {strings.calendar.agendas.renameAgenda}
                </button>
              ) : null}

              {canBeDefault ? (
                <button
                  type="button"
                  className={menuRow}
                  onClick={() => updateAgenda.mutate({ id: agenda.id, isDefault: true })}
                >
                  <CircleDot className="size-4" />
                  {strings.calendar.agendas.makeDefault}
                </button>
              ) : null}

              <button
                type="button"
                className={menuRow}
                onClick={() => showOnly.mutate(agenda.id)}
              >
                <Eye className="size-4" />
                {strings.calendar.agendas.showOnlyThis}
              </button>

              {canRemove ? (
                <>
                  <span className="my-1 h-px w-full bg-border" />
                  <button
                    type="button"
                    className={`${menuRow} text-danger hover:text-danger`}
                    onClick={onRequestRemove}
                  >
                    <Trash2 className="size-4" />
                    {strings.calendar.agendas.remove}
                  </button>
                </>
              ) : null}
            </div>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
