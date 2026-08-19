import { Check } from 'lucide-react';

import type { AgendaDto, CalendarProvider } from '@gloo/shared';

import { useUpdateAgenda } from '@/hooks/queries/calendar';
import { colorEdge, colorFill } from '@/theme/labelColors';
import { strings } from '@/strings/pt-BR';

import { AgendaMenu } from './AgendaMenu';

/**
 * One agenda: the box that shows or hides it, its name, and the menu that
 * changes it.
 *
 * The colour and the switch are the same object. An agenda's swatch was a fact
 * about it and the eye beside it was the control, which meant two marks in a
 * 24px row saying one thing between them — and the eye only appeared on hover,
 * so the way to hide an agenda was invisible until you went looking for it.
 * Ticked is on the calendar, cleared is off, and the tick is drawn in the
 * agenda's own colour, which is how every calendar app does it.
 *
 * The way through to that menu still waits for hover: eight agendas each
 * carrying a permanent button read as a toolbar rather than a list of names.
 */
export function AgendaRow({
  agenda,
  provider,
  onRequestRemove,
}: {
  agenda: AgendaDto;
  /** Passed straight through to the menu, which is what turns on it. */
  provider: CalendarProvider;
  onRequestRemove: () => void;
}) {
  const updateAgenda = useUpdateAgenda();
  const isVisible = !agenda.isHidden;

  // Filled in its colour while it is on the calendar, an outline of that colour
  // while it is off — the same box either way, so nothing moves when it is
  // pressed. `text-black` is the tick's ink on the ten palette colours, which
  // are pastel; a colour the user mixed carries its own readable ink as an
  // inline style and overrides it.
  const box = isVisible
    ? colorFill(agenda.color, 'border-transparent text-black')
    : colorEdge(agenda.color, 'bg-transparent');

  return (
    // No padding of its own, which is what puts the two ends of the row on the
    // card's own two edges: the box lands on the same vertical line as the
    // chevron that folds the account above it, and the chevron that opens this
    // agenda's menu lands under the `···` in the card's header. Padding here put
    // both of them 8px inside those lines, which is exactly far enough to read
    // as a list that had slipped.
    //
    // Tight rows, and the faintest ground for the hover: the list is a set of
    // names, and at `py-1` in a 12px type size each one sat in a band half again
    // its own height. A small radius rather than the capsule this wore — with no
    // padding left to fill, a fully rounded ground cut the corners off the box
    // sitting on its left edge.
    <li className="group flex items-center gap-2 rounded-md py-0.5 hover:bg-default/25">
      <label
        className={`relative flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[2px] border ${box.className}`}
        style={box.style}
        title={isVisible ? strings.calendar.agendas.hide : strings.calendar.agendas.show}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={isVisible}
          aria-label={`${agenda.name} — ${
            isVisible ? strings.calendar.agendas.hide : strings.calendar.agendas.show
          }`}
          onChange={(changed) =>
            updateAgenda.mutate({ id: agenda.id, isHidden: !changed.target.checked })
          }
        />
        {isVisible ? <Check className="size-3" strokeWidth={3} /> : null}
      </label>

      {/* 12px, and no longer sharing the row with a "Padrão" tag and an eye:
          which agenda receives an event that names none is a fact for the menu,
          not something worth a permanent word beside the name it pushed out of
          the way. */}
      <span
        className={`min-w-0 flex-1 truncate text-xs ${
          agenda.isHidden ? 'text-muted' : ''
        }`}
        title={agenda.name}
      >
        {agenda.name}
      </span>

      {/* Last in the row, so it sits on the card's own right-hand edge. */}
      <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <AgendaMenu agenda={agenda} provider={provider} onRequestRemove={onRequestRemove} />
      </span>
    </li>
  );
}
