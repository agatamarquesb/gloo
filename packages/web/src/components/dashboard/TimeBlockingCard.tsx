import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@heroui/react';

import { strings } from '@/strings/pt-BR';

import { DashboardCard } from './DashboardCard';

const PRESETS_MINUTES = [5, 10, 15, 30, 60];

function format(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function presetLabel(minutes: number): string {
  return minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`;
}

/**
 * Purely client-side focus timer — nothing here is persisted or tied to a task.
 * Counts down from wall-clock deadlines rather than decrementing on each tick,
 * so a throttled background tab can't make the timer drift.
 */
export function TimeBlockingCard() {
  const [durationSeconds, setDurationSeconds] = useState(PRESETS_MINUTES[0] * 60);
  const [remaining, setRemaining] = useState(PRESETS_MINUTES[0] * 60);
  const [isRunning, setRunning] = useState(false);
  const deadlineRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) return;

    deadlineRef.current = Date.now() + remaining * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((deadlineRef.current! - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setRunning(false);
    }, 250);

    return () => clearInterval(id);
    // `remaining` is intentionally not a dependency: it changes every tick, and
    // re-running this effect would reset the deadline on each one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  function selectPreset(minutes: number) {
    setRunning(false);
    setDurationSeconds(minutes * 60);
    setRemaining(minutes * 60);
  }

  function selectCustom() {
    const input = window.prompt(strings.timeBlocking.customPrompt, '25');
    const minutes = Number(input);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    selectPreset(Math.min(Math.round(minutes), 24 * 60));
  }

  const isSelected = (minutes: number) => durationSeconds === minutes * 60;

  return (
    <DashboardCard title={strings.timeBlocking.title} subtitle={strings.timeBlocking.subtitle}>
      <p
        className="text-center text-5xl font-semibold tabular-nums text-foreground transition-colors"
        aria-live="polite"
      >
        {format(remaining)}
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        {PRESETS_MINUTES.map((minutes) => (
          <Button
            key={minutes}
            size="sm"
            variant={isSelected(minutes) ? 'primary' : 'outline'}
            className="rounded-full"
            onPress={() => selectPreset(minutes)}
          >
            {presetLabel(minutes)}
          </Button>
        ))}
        <Button size="sm" variant="outline" className="rounded-full" onPress={selectCustom}>
          +
        </Button>
      </div>

      <div className="flex justify-center gap-2">
        <Button
          isDisabled={remaining === 0}
          className="rounded-full"
          onPress={() => setRunning((running) => !running)}
        >
          {isRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
          {isRunning ? strings.timeBlocking.pause : strings.timeBlocking.start}
        </Button>
        <Button
          variant="ghost"
          className="rounded-full"
          onPress={() => {
            setRunning(false);
            setRemaining(durationSeconds);
          }}
        >
          <RotateCcw className="size-4" />
          {strings.timeBlocking.reset}
        </Button>
      </div>
    </DashboardCard>
  );
}
