import { ProgressBar } from '@heroui/react';

export function TaskProgressBar({
  value,
  className = 'w-28',
  outputFirst = false,
  outputRight = false,
}: {
  value: number;
  className?: string;
  /**
   * The count before the bar rather than after it. Nothing asks for it today —
   * the modal's own bar reads left to right like a task row's — but the option
   * costs a line and the alternative was two components.
   */
  outputFirst?: boolean;
  /**
   * Set the figure against the *right* of its cell rather than the left.
   *
   * The cell is a fixed 36px, wide enough for "100%", so at any smaller number
   * the text stops short of where the cell ends — which is invisible on a row,
   * where something else follows it, and obvious on a board card, where the cell
   * ends on the card's own margin and the line under it ends on the same margin.
   * "0%" sitting 20px inside that edge read as the bar being cut short.
   */
  outputRight?: boolean;
}) {
  const output = (
    <ProgressBar.Output
      className={`w-9 shrink-0 text-xs text-muted ${outputFirst || outputRight ? 'text-right' : ''}`}
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
