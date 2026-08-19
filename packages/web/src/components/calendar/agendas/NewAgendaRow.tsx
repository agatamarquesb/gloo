import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button, Input } from '@heroui/react';
import { TextField } from 'react-aria-components';

import type { PaletteColor } from '@gloo/shared';

import { FLAT_INPUT, GREEN_UNDERLINE } from '@/theme/fieldStyles';
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
 * The swatch shows the colour and does not offer to change it. Making an agenda
 * is naming it; the colour it opens on is the one the palette had spare, and the
 * one place it is chosen is the menu on the finished row — see AgendaMenu. A
 * picker here made the first thing a new agenda asked for the least important
 * thing about it, and put a second way of doing something the row already has a
 * way of doing.
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

  /** Enter, the tick, or clicking away — an empty name means it was abandoned. */
  function commit() {
    const trimmed = name.trim();
    if (trimmed) onSave(trimmed, defaultColor);
    else onCancel();
  }

  return (
    <li className="flex items-center gap-2 py-0.5">
      {/* The same box a finished row wears, and nothing more: it says what
          colour the agenda will be, in the place that colour will appear. */}
      <span
        aria-hidden
        {...colorFill(defaultColor, 'size-[18px] shrink-0 rounded-[2px]')}
      />

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
