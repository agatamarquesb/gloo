import { useState } from 'react';
import { ChevronLeft, ChevronRight, CircleDot, Eye, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button, Popover } from '@heroui/react';

import { LABEL_COLORS, type AgendaDto, type LabelColor } from '@gloo/shared';

import { useShowOnlyAgenda, useUpdateAgenda } from '@/hooks/queries/calendar';
import { LABEL_BG_CLASS } from '@/theme/labelColors';
import { FIELD_PANEL } from '@/theme/fieldStyles';
import { menuRow } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

/** The panel is either the menu or the colour list — never both, as in Notion. */
type View = 'menu' | 'color';


/**
 * The `···` menu on an agenda row: recolour, make default, show only this,
 * remove.
 *
 * A Popover rather than HeroUI's Menu because of the colour step — a Menu item
 * that opens a submenu in place is not something Menu does, and the app has no
 * other submenu to follow. The two views swap inside one panel, the same shape
 * LabelPicker uses for its list/edit switch.
 */
export function AgendaMenu({
  agenda,
  onRequestRemove,
}: {
  agenda: AgendaDto;
  /** Removal needs a confirmation modal, which belongs above this popover. */
  onRequestRemove: () => void;
}) {
  const [view, setView] = useState<View>('menu');
  const updateAgenda = useUpdateAgenda();
  const showOnly = useShowOnlyAgenda();

  // The inbox is not somewhere events are authored and not somewhere the user
  // made, so two of the four actions don't apply to it.
  const canBeDefault = !agenda.isShared && !agenda.isReadOnly && !agenda.isDefault;
  // The default is as fixed as the inbox: something has to receive events that
  // name no agenda, so it can only be retired by promoting another one first.
  // Offering "Remover" here would open a confirmation the API then refuses.
  const canRemove = !agenda.isShared && !agenda.isDefault;

  return (
    <Popover onOpenChange={(open) => !open && setView('menu')}>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        className="text-muted"
        aria-label={strings.calendar.agendas.title}
      >
        <MoreHorizontal className="size-4" />
      </Button>

      <Popover.Content className={`w-60 ${FIELD_PANEL}`}>
        <Popover.Dialog className="p-1">
          {view === 'color' ? (
            <div className="flex flex-col gap-1">
              <button type="button" className={menuRow} onClick={() => setView('menu')}>
                <ChevronLeft className="size-4" />
                {strings.calendar.agendas.color}
              </button>
              <div className="grid grid-cols-5 gap-2 p-2">
                {LABEL_COLORS.map((color: LabelColor) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    aria-pressed={agenda.color === color}
                    onClick={() => updateAgenda.mutate({ id: agenda.id, color })}
                    className={`h-7 rounded-lg transition-transform hover:scale-105 ${
                      LABEL_BG_CLASS[color]
                    } ${
                      agenda.color === color
                        ? 'ring-2 ring-foreground ring-offset-2 ring-offset-surface'
                        : ''
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              <button type="button" className={menuRow} onClick={() => setView('color')}>
                <span className={`size-3.5 rounded-sm ${LABEL_BG_CLASS[agenda.color]}`} />
                <span className="flex-1 text-left">{strings.calendar.agendas.color}</span>
                <ChevronRight className="size-4" />
              </button>

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
