import { Search } from 'lucide-react';
import { Input } from '@heroui/react';
import { TextField } from 'react-aria-components';

import { BUTTON_LIKE_FIELD, FLAT_INPUT } from '@/theme/fieldStyles';
import { strings } from '@/strings/pt-BR';

/**
 * The app's one search input: pill-shaped, magnifier inside the field on the
 * left. Shared so the Tasks filter bar and the Dashboard's "Minhas tarefas"
 * card can't drift apart.
 */
/**
 * Matched to a `size="sm"` Button — the height HeroUI gives the status filter
 * pills this field sits beside on the Dashboard.
 *
 * `py-0` goes with it: the input's own `py-2` plus its text would come to more
 * than the height, and padding is inside the box.
 */
const SLIM_HEIGHT = 'h-9 py-0 md:h-8';

export function SearchField({
  value,
  onChange,
  className = '',
  placeholder = strings.common.search,
  slim = false,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  /** Cut down to the height of a small button, for a filter row of them. */
  slim?: boolean;
}) {
  return (
    <TextField
      aria-label={strings.common.search}
      value={value}
      onChange={onChange}
      className={className}
    >
      {/* A secondary button that happens to take typing: the same outlined pill,
          the same edge colour, and no fill or shadow in any state — see
          BUTTON_LIKE_FIELD, which exists to line a field up with an outline
          Button. The shadow it used to grow on focus is gone with it; the caret
          is enough to say where you are.

          The magnifier and the text keep their own colours. The icon is
          positioned rather than slotted so it sits inside the rounded edge, and
          pl-9 on the input reserves the room. */}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <Input
          fullWidth
          className={`${FLAT_INPUT} ${BUTTON_LIKE_FIELD} ${
            slim ? SLIM_HEIGHT : ''
          } rounded-full pl-9 [--field-radius:9999px] [--field-shadow:none]`}
          placeholder={placeholder}
        />
      </div>
    </TextField>
  );
}
