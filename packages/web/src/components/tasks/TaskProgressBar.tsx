import { ProgressBar } from '@heroui/react';

export function TaskProgressBar({
  value,
  className = 'w-28',
  outputFirst = false,
}: {
  value: number;
  className?: string;
  /**
   * The count before the bar rather than after it. Nothing asks for it today —
   * the modal's own bar reads left to right like a task row's — but the option
   * costs a line and the alternative was two components.
   */
  outputFirst?: boolean;
}) {
  const output = (
    <ProgressBar.Output
      className={`w-9 shrink-0 text-xs text-muted ${outputFirst ? 'text-right' : ''}`}
    />
  );

  return (
    // size="md" (8px track) rather than "sm" (4px): thin enough to stay recessive
    // next to the row's text, thick enough to read at a glance.
    <ProgressBar aria-label="Progresso" size="md" value={value} className={`flex items-center gap-2 ${className}`}>
      {outputFirst ? output : null}
      <ProgressBar.Track className="flex-1">
        <ProgressBar.Fill />
      </ProgressBar.Track>
      {outputFirst ? null : output}
    </ProgressBar>
  );
}
