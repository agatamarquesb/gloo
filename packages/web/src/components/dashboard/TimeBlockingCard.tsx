import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Pause, Play, RotateCcw, X } from 'lucide-react';
import { Button, Input } from '@heroui/react';
import { TextField } from 'react-aria-components';

import { playSound } from '@/lib/sounds';
import { strings } from '@/strings/pt-BR';

import { DashboardCard } from './DashboardCard';

/** Five presets plus the custom button fill the 3x2 grid exactly. */
const PRESETS_MINUTES = [5, 10, 15, 30, 60];
const MAX_SECONDS = 24 * 60 * 60;

const pad = (value: number) => String(value).padStart(2, '0');

/** mm:ss under an hour, hh:mm:ss at or above it — the custom field accepts hours. */
function format(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

/** Always hh:mm:ss, for prefilling the custom field. */
function formatFull(totalSeconds: number): string {
  return `${pad(Math.floor(totalSeconds / 3600))}:${pad(
    Math.floor((totalSeconds % 3600) / 60),
  )}:${pad(totalSeconds % 60)}`;
}

/**
 * Parses the custom field. Lenient about how many parts are given so "90" and
 * "1:30" both work, reading right-to-left as seconds, minutes, hours — the same
 * way a stopwatch entry field behaves. Returns null when nothing usable was typed.
 */
function parseDuration(input: string): number | null {
  const parts = input.trim().split(':');
  if (parts.length > 3) return null;

  const numbers = parts.map((part) => (part.trim() === '' ? 0 : Number(part)));
  if (numbers.some((value) => !Number.isFinite(value) || value < 0)) return null;

  const [seconds = 0, minutes = 0, hours = 0] = numbers.toReversed();
  const total = Math.round(hours * 3600 + minutes * 60 + seconds);
  if (total <= 0) return null;

  return Math.min(total, MAX_SECONDS);
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
  const [isCustomOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const deadlineRef = useRef<number | null>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  // Focus imperatively rather than with autoFocus: the popup only ever opens on
  // an explicit click, and selecting the text lets the user just type over it.
  // Escape is bound on the document rather than on the popup so it works even if
  // focus has moved to one of its buttons.
  useEffect(() => {
    if (!isCustomOpen) return;

    customInputRef.current?.select();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCustomOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isCustomOpen]);

  useEffect(() => {
    if (!isRunning) return;

    deadlineRef.current = Date.now() + remaining * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((deadlineRef.current! - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        // The point of a focus timer is that you are looking at something else,
        // so reaching zero has to be audible.
        playSound('countdownEnd');
      }
    }, 250);

    return () => clearInterval(id);
    // `remaining` is intentionally not a dependency: it changes every tick, and
    // re-running this effect would reset the deadline on each one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  function selectDuration(seconds: number) {
    setRunning(false);
    setDurationSeconds(seconds);
    setRemaining(seconds);
  }

  function openCustom() {
    setCustomValue(formatFull(durationSeconds));
    setCustomOpen(true);
  }

  function confirmCustom(event: FormEvent) {
    event.preventDefault();
    const seconds = parseDuration(customValue);
    if (seconds === null) return;
    selectDuration(seconds);
    setCustomOpen(false);
  }

  return (
    <DashboardCard
      title={strings.timeBlocking.title}
      className="relative"
      action={
        <div className="flex gap-2">
          <Button
            size="sm"
            isDisabled={remaining === 0}
            className="rounded-full"
            onPress={() => setRunning((running) => !running)}
          >
            {isRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
            {isRunning ? strings.timeBlocking.pause : strings.timeBlocking.start}
          </Button>
          <Button
            size="sm"
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
      }
    >
      {/* text-3xl font-semibold matches the counts on the task-summary tiles —
          the app's one size for a headline number.

          The vertical padding is not a spacing choice so much as the card's
          height: this is the only slack in the right-hand column, so it is what
          lands this card's bottom edge on the same line as Rotinas and Tarefas
          por setor across the page. 18px is exactly that, and it moves whenever
          anything above it does: the month grid gained a few pixels when its
          days stopped touching (see .gloo-dashboard-calendar), and this came
          down to meet it. The padding is doubled, so it buys twice what it
          says. */}
      <p
        className="py-[18px] text-center text-3xl font-semibold tabular-nums text-foreground transition-colors"
        aria-live="polite"
      >
        {format(remaining)}
      </p>

      {/* 3x2 grid centered under the counter: fullWidth buttons make the two rows
          line up on the same three columns regardless of label width. All five
          presets share one look — the green accent is reserved for "+", so the
          grid carries no selected state. */}
      <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2">
        {PRESETS_MINUTES.map((minutes) => (
          <Button
            key={minutes}
            size="sm"
            fullWidth
            variant="outline"
            className="rounded-full"
            onPress={() => selectDuration(minutes * 60)}
          >
            {presetLabel(minutes)}
          </Button>
        ))}
        <Button
          size="sm"
          fullWidth
          variant="primary"
          className="rounded-full"
          aria-label={strings.timeBlocking.customOpen}
          onPress={openCustom}
        >
          +
        </Button>
      </div>


      {isCustomOpen ? (
        <>
          {/* Veil in the card's own surface color, covering the header too, so the
              whole box reads as dimmed and nothing behind it can be clicked until
              the value is confirmed or dismissed. */}
          <div className="absolute inset-0 z-10 rounded-3xl bg-surface/80" />
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
            <form
              aria-label={strings.timeBlocking.customOpen}
              onSubmit={confirmCustom}
              className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-3 shadow-surface"
            >
              {/* No visible label: the placeholder carries the hh:mm:ss format and
                  the field keeps an accessible name via aria-label. */}
              <TextField
                value={customValue}
                onChange={setCustomValue}
                aria-label={strings.timeBlocking.customLabel}
              >
                <Input
                  ref={customInputRef}
                  className="w-28 text-center tabular-nums"
                  placeholder="hh:mm:ss"
                  inputMode="numeric"
                />
              </TextField>
              <Button
                type="submit"
                isIconOnly
                size="sm"
                className="rounded-full"
                aria-label={strings.timeBlocking.customConfirm}
              >
                <Check className="size-4" />
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                className="rounded-full"
                aria-label={strings.timeBlocking.customCancel}
                onPress={() => setCustomOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </form>
          </div>
        </>
      ) : null}
    </DashboardCard>
  );
}
