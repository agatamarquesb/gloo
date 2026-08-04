import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@heroui/react';

import type { AgendaDto } from '@gloo/shared';

import { useUpdateAgenda } from '@/hooks/queries/calendar';
import { colorFill } from '@/theme/labelColors';
import { strings } from '@/strings/pt-BR';

import { AgendaMenu } from './AgendaMenu';

/**
 * One agenda: its colour, its name, and the two controls that appear on hover.
 *
 * The `···` and the eye only show on hover or keyboard focus — a list of eight
 * agendas each carrying two permanent buttons reads as a toolbar rather than a
 * list of names. A hidden agenda is the exception: its eye stays visible
 * whatever the pointer is doing, because a struck-through row with no visible
 * way back would be a dead end.
 */
export function AgendaRow({
  agenda,
  onRequestRemove,
}: {
  agenda: AgendaDto;
  onRequestRemove: () => void;
}) {
  const updateAgenda = useUpdateAgenda();

  return (
    <li className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-default/40">
      <span
        {...colorFill(
          agenda.color,
          `size-3.5 shrink-0 rounded-sm ${agenda.isHidden ? 'opacity-40' : ''}`,
        )}
      />

      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          agenda.isHidden ? 'text-muted line-through decoration-muted/50' : ''
        }`}
        title={agenda.name}
      >
        {agenda.name}
      </span>

      {agenda.isDefault ? (
        <span className="shrink-0 text-xs text-muted">{strings.calendar.agendas.isDefault}</span>
      ) : null}

      <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <AgendaMenu agenda={agenda} onRequestRemove={onRequestRemove} />
      </span>

      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        className={`shrink-0 text-muted transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${
          agenda.isHidden ? '' : 'opacity-0'
        }`}
        aria-label={agenda.isHidden ? strings.calendar.agendas.show : strings.calendar.agendas.hide}
        aria-pressed={!agenda.isHidden}
        onPress={() => updateAgenda.mutate({ id: agenda.id, isHidden: !agenda.isHidden })}
      >
        {agenda.isHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Button>
    </li>
  );
}
