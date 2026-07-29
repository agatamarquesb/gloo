import { Search } from 'lucide-react';
import { Input } from '@heroui/react';
import { TextField } from 'react-aria-components';

import { strings } from '@/strings/pt-BR';

/**
 * The app's one search input: pill-shaped, magnifier inside the field on the
 * left. Shared so the Tasks filter bar and the Dashboard's "Minhas tarefas"
 * card can't drift apart.
 */
export function SearchField({
  value,
  onChange,
  className = '',
  placeholder = strings.common.search,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <TextField
      aria-label={strings.common.search}
      value={value}
      onChange={onChange}
      className={className}
    >
      {/* At rest it reads as an outline pill, the same shape and weight as the
          status filter buttons; focus brings in the shadow. The icon is
          positioned rather than slotted so it sits inside the rounded edge, and
          pl-9 on the input reserves the room. */}
      <div className="relative rounded-full transition-shadow focus-within:shadow-surface">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <Input
          fullWidth
          className="rounded-full border-border bg-transparent pl-9"
          placeholder={placeholder}
        />
      </div>
    </TextField>
  );
}
