import { Search } from 'lucide-react';
import { Input } from '@heroui/react';
import { TextField } from 'react-aria-components';

import { FLAT_INPUT } from '@/theme/fieldStyles';
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

/**
 * The field at rest, and the field you are typing in.
 *
 * At rest everything about it — edge, magnifier, placeholder — is a step lighter
 * than the controls beside it: nothing is in it yet, so it should ask for less
 * attention than the filter pills it sits next to. Clicking in darkens all three
 * together, which is the whole of the focus treatment; there is no fill and no
 * ring behind it.
 */
/**
 * `border` is set here rather than pulled in with BUTTON_LIKE_FIELD, which
 * declares the same `--field-border` this does: two utilities setting one custom
 * property leave which of them wins to stylesheet order, so the field only ever
 * names it once.
 */
const RESTING =
  'border [--field-border:color-mix(in_oklab,var(--outline-control)_45%,transparent)] [--field-border-hover:color-mix(in_oklab,var(--outline-control)_70%,transparent)] placeholder:text-muted/60';

const FOCUSED =
  '[--field-border-focus:var(--outline-control)] focus:text-foreground focus:placeholder:text-muted';

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
      {/* A secondary button that happens to take typing: the same outlined pill
          and no fill or shadow in any state — only lighter than one at rest, and
          coming up to full strength as you type in it. See RESTING and FOCUSED.

          The icon is positioned rather than slotted so it sits inside the
          rounded edge, and pl-9 on the input reserves the room. `group` is what
          lets the magnifier answer the input's focus: it is a sibling of the
          field, not a child of it, so `focus-within` on the wrapper is the only
          thing both can read. */}
      <div className="group relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted/60 transition-colors group-focus-within:text-foreground" />
        <Input
          fullWidth
          className={`${FLAT_INPUT} ${RESTING} ${FOCUSED} ${
            slim ? SLIM_HEIGHT : ''
          } rounded-full pl-9 text-muted transition-colors [--field-radius:9999px] [--field-shadow:none]`}
          placeholder={placeholder}
        />
      </div>
    </TextField>
  );
}
