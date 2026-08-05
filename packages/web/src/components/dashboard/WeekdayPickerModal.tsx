import { useState } from 'react';
import { Button, Modal } from '@heroui/react';

import { AppCheckbox } from '@/components/common/AppCheckbox';
import { SecondaryButton } from '@/components/common/SecondaryButton';
import { dialogFooter, dialogSection } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import {
  WEEKDAYS_BUSINESS,
  WEEKDAY_INITIALS,
  WEEKDAY_NAMES,
  WEEK_ORDER,
} from './routineWeekdays';

/**
 * One day, as a circle you press.
 *
 * A circle rather than a checkbox because seven of them are read as a *week* —
 * a row of boxes is a list of seven unrelated questions, while a row of caps is
 * the shape of the thing being described. Selected takes the brand fill; the
 * rest sit on the quiet ground the app uses for something resting on a card.
 */
const DAY_BASE =
  'flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-sm font-medium transition-colors';
const DAY_ON = 'bg-green text-black';
const DAY_OFF = 'bg-default/60 text-muted hover:bg-default';

/** The same set, order-insensitive — two schedules, not two arrays. */
function sameDays(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((day) => b.includes(day));
}

/**
 * "Which days does this routine run on?", asked over the routine modal.
 *
 * A dialog rather than another popover: it is a decision with several parts and
 * a Save of its own, and a panel hanging off a property row would have closed
 * the moment the user reached for the second one. It lays over the modal that
 * opened it — the routine underneath is the context for the answer.
 *
 * Nothing is committed until Salvar. The routine modal has its own Cancelar, and
 * a picker that wrote through on every tap would have made those two disagree
 * about what "cancel" undoes.
 */
export function WeekdayPickerModal({
  isOpen,
  initialDays,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  /** What the routine runs on now — the picker opens on it. */
  initialDays: number[];
  onClose: () => void;
  onSave: (days: number[]) => void;
}) {
  const [days, setDays] = useState<number[]>(initialDays);

  // Re-seeded per opening rather than held: the dialog outlives each of its
  // openings, and reopening it on a stale draft would show days the routine no
  // longer runs on. `key` on the caller's side would remount it instead; this
  // keeps the mount stable so the open/close animation still plays.
  const [seededFor, setSeededFor] = useState(isOpen);
  if (isOpen !== seededFor) {
    setSeededFor(isOpen);
    if (isOpen) setDays(initialDays);
  }

  function toggle(day: number) {
    setDays((current) =>
      current.includes(day) ? current.filter((other) => other !== day) : [...current, day],
    );
  }

  /**
   * The two shortcuts, as checkboxes rather than buttons: each one is a *state*
   * the selection can be in — tick it and you are on that schedule, untick it
   * and you are on none — so it stays lit while the days below it say the same
   * thing, and goes out the moment you change one of them by hand.
   */
  const everyDay = [...WEEK_ORDER];
  const isEveryDay = sameDays(days, everyDay);
  const isBusinessDays = sameDays(days, WEEKDAYS_BUSINESS);

  function applyPreset(preset: number[], isOn: boolean) {
    setDays(isOn ? [] : preset);
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog className="rounded-2xl px-6 pt-[18px] pb-[15px] sm:max-w-sm">
          <Modal.Header className={`flex flex-col ${dialogSection}`}>
            <Modal.Heading className="text-base font-semibold text-foreground">
              {strings.routine.weekdayPicker.heading}
            </Modal.Heading>
          </Modal.Header>

          <Modal.Body className={`flex flex-col gap-4 pt-4! ${dialogSection}`}>
            {/* Monday first — a working week, not a calendar grid. The row
                spreads across the dialog so the seven circles divide it evenly
                however wide it happens to be. */}
            <div className="flex items-center justify-between gap-1">
              {WEEK_ORDER.map((day) => {
                const isOn = days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={isOn}
                    aria-label={WEEKDAY_NAMES[day]}
                    className={`${DAY_BASE} ${isOn ? DAY_ON : DAY_OFF}`}
                    onClick={() => toggle(day)}
                  >
                    {WEEKDAY_INITIALS[day]}
                  </button>
                );
              })}
            </div>

            {/* Under the circles, one below the other: they are shorthand for a
                selection you could make by hand up there, so they follow it
                rather than leading it. */}
            <div className="flex flex-col gap-2">
              <AppCheckbox
                accent
                isSelected={isEveryDay}
                onChange={() => applyPreset(everyDay, isEveryDay)}
              >
                <span className="text-sm text-foreground">
                  {strings.routine.weekdayPicker.everyDay}
                </span>
              </AppCheckbox>

              <AppCheckbox
                accent
                isSelected={isBusinessDays}
                onChange={() => applyPreset(WEEKDAYS_BUSINESS, isBusinessDays)}
              >
                <span className="text-sm text-foreground">
                  {strings.routine.weekdayPicker.businessDays}
                </span>
              </AppCheckbox>
            </div>
          </Modal.Body>

          <Modal.Footer className={`flex items-center justify-end gap-2 ${dialogFooter}`}>
            <SecondaryButton onPress={onClose}>{strings.common.cancel}</SecondaryButton>
            {/* Nothing to save with no day ticked: a weekly routine that runs on
                no day of the week is not a schedule, and the API refuses it. */}
            <Button
              className="rounded-full"
              isDisabled={days.length === 0}
              onPress={() => onSave(days)}
            >
              {strings.common.save}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
