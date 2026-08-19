import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button, Input, Popover } from '@heroui/react';
import { TextField } from 'react-aria-components';

import type { PaletteColor } from '@gloo/shared';

import { ColorPicker } from '@/components/common/ColorPicker';
import { FIELD_PANEL, FLAT_INPUT, GREEN_UNDERLINE } from '@/theme/fieldStyles';
import { colorFill } from '@/theme/labelColors';
import { dotsMenuButton } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

/**
 * The agenda being made, in the place it will appear.
 *
 * Written as the next row of the Gloo list rather than as a field at the foot of
 * the card: an agenda is a line in that list, and typing it anywhere else meant
 * watching a name you had just written jump somewhere else when you pressed
 * Enter. The swatch, the name and the tick sit on the same three columns every
 * finished row uses, so the row you are typing is the row you will get.
 *
 * The colour is chosen here rather than left to the API, which would otherwise
 * assign one — the name and the colour are the whole of what an agenda is, and
 * choosing the second was a second trip through the `···` menu.
 */
export function NewAgendaRow({
  defaultColor,
  onSave,
  onCancel,
}: {
  /** The first palette colour this user is not already wearing. */
  defaultColor: PaletteColor;
  onSave: (name: string, color: PaletteColor) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<PaletteColor>(defaultColor);

  /** Enter, the tick, or clicking away — an empty name means it was abandoned. */
  function commit() {
    const trimmed = name.trim();
    if (trimmed) onSave(trimmed, color);
    else onCancel();
  }

  return (
    <li className="flex items-center gap-2 px-2 py-0.5">
      {/* The same box a finished row wears, and pressing it opens the app's one
          colour picker — the ten it ships with, plus whatever this browser has
          mixed. */}
      <Popover>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label={strings.calendar.agendas.color}
          {...colorFill(
            color,
            'size-[18px] min-w-0 shrink-0 rounded-[5px] p-0 shadow-none data-[hovered=true]:opacity-80',
          )}
        />
        <Popover.Content className={`w-60 ${FIELD_PANEL}`}>
          <Popover.Dialog className="p-2">
            <ColorPicker value={color} onChange={setColor} />
          </Popover.Dialog>
        </Popover.Content>
      </Popover>

      <TextField
        aria-label={strings.calendar.agendas.newAgenda}
        value={name}
        onChange={setName}
        // Enter saves and Escape abandons — the two keys every other name in the
        // app answers to.
        onKeyDown={(pressed) => {
          if (pressed.key === 'Enter') commit();
          if (pressed.key === 'Escape') onCancel();
        }}
        // The row only exists because "Criar nova agenda" was just pressed, so
        // the caret arrives with it.
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        className="flex min-w-0 flex-1 items-center gap-0.5"
      >
        {/* A single green rule and nothing else — the app's mark for "this line
            is being typed", the same one a routine's title and a checklist's
            wear (see GREEN_UNDERLINE). The boxed field it replaced was the only
            outlined control in a card made of plain rows, and it grew a second
            border under the cursor. */}
        <Input
          className={`${FLAT_INPUT} ${GREEN_UNDERLINE} h-6 min-w-0 flex-1 text-xs`}
          placeholder={strings.calendar.agendas.newAgenda}
        />

        {/* Both keys inside the field, at its right-hand end: they answer the
            line being typed, so they belong on it rather than out in the row
            beside it. */}
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className={`${dotsMenuButton} size-5 min-w-0 p-0`}
          aria-label={strings.common.save}
          onPress={commit}
        >
          <Check className="size-4" />
        </Button>

        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className={`${dotsMenuButton} size-5 min-w-0 p-0`}
          aria-label={strings.common.cancel}
          onPress={onCancel}
        >
          <X className="size-4" />
        </Button>
      </TextField>
    </li>
  );
}
