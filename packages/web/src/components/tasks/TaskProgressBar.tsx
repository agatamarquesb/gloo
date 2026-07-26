import { ProgressBar } from '@heroui/react';

export function TaskProgressBar({ value, className = 'w-28' }: { value: number; className?: string }) {
  return (
    <ProgressBar aria-label="Progresso" size="sm" value={value} className={`flex items-center gap-2 ${className}`}>
      <ProgressBar.Track className="flex-1">
        <ProgressBar.Fill />
      </ProgressBar.Track>
      <ProgressBar.Output className="w-9 shrink-0 text-xs text-muted" />
    </ProgressBar>
  );
}
