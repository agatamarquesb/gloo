import { useRef, type ReactNode } from 'react';
import { Checkbox } from '@heroui/react';

/**
 * HeroUI's Checkbox is keyboard-only as shipped: React Aria's `useToggle`
 * calls `preventDefault()` on the label's click (killing native label →
 * input forwarding) and instead relies on a `usePress` handler that never
 * fires for mouse input. Verified against HeroUI 3.2.2 / react-aria 3.50.0
 * with HeroUI's own documented example and a bare react-aria-components
 * Checkbox — both fail, while Button/Select/Popover are unaffected.
 *
 * This forwards a click on the row to the underlying input, which does work.
 * Everything else (styling, ARIA, keyboard) stays HeroUI's.
 *
 * Delete this wrapper and use `Checkbox` directly once upstream is fixed —
 * if the label press starts firing too, this would double-toggle.
 */
export function AppCheckbox({
  isSelected,
  onChange,
  isDisabled = false,
  children,
  className = '',
  accent = false,
  round = false,
  quiet = false,
}: {
  isSelected: boolean;
  onChange: (selected: boolean) => void;
  isDisabled?: boolean;
  children: ReactNode;
  className?: string;
  /** Green rule, filling green once ticked. */
  accent?: boolean;
  /** Circular rather than the default rounded square. Implies `accent`. */
  round?: boolean;
  /**
   * The light control edge at 1px instead of the brand green at 2px, still
   * filling green once ticked. For lists where the boxes are the repeated
   * element and a green rule on each one adds up to a lot of colour. Implies
   * `accent`.
   */
  quiet?: boolean;
}) {
  const isAccent = accent || round || quiet;
  const rootRef = useRef<HTMLDivElement>(null);

  function forwardClickToInput(event: React.MouseEvent) {
    if (isDisabled) return;
    // A click that already landed on the input toggles natively; forwarding
    // it again would cancel itself out.
    if ((event.target as HTMLElement).tagName === 'INPUT') return;
    rootRef.current?.querySelector('input')?.click();
  }

  return (
    // No role/key handler on purpose: this div is only a mouse hit-area for
    // the real checkbox nested inside it, which is already focusable and
    // fully keyboard-operable. Giving it its own role or key handler would
    // announce a second control and double-handle Space/Enter.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      ref={rootRef}
      onClick={forwardClickToInput}
      className={`w-fit ${isDisabled ? '' : 'cursor-pointer'} ${className}`}
    >
      <Checkbox
        isSelected={isSelected}
        isDisabled={isDisabled}
        onChange={onChange}
        // `group` so the control can react to the checked state, which React
        // Aria marks with data-selected on this root rather than on the control.
        className={isAccent ? 'group' : undefined}
      >
        <Checkbox.Content>
          <Checkbox.Control
            // The full brand green, not the muted outline token the boxes and
            // rules use: this ring becomes the fill when ticked, so the two
            // states have to be the same colour or the box appears to change
            // hue as you check it.
            //
            // One hairline for every shape and every list: the checklist inside
            // the routine modal sets the weight, and a routine row carrying a
            // heavier ring than the items inside it read as two different
            // controls for the same gesture.
            className={[
              // A ring and a fill, nothing else. HeroUI paints part of a
              // field as an inset shadow, so clearing that needs
              // --field-shadow as well as the box-shadow utility — see the note
              // at the top of fieldStyles.ts. Left in, it reads as a raised
              // chip rather than as a box drawn on the page.
              isAccent
                ? 'shadow-none [--field-shadow:none] group-data-[selected=true]:bg-green'
                : '',
              quiet
                ? // Squarer than HeroUI's default radius, which reads almost
                  // round at this size.
                  'border rounded-sm [--field-radius:0.25rem] [--field-border:var(--outline-control)] [--field-border-hover:var(--outline-control)]'
                : isAccent
                  ? 'border border-green [--field-border:var(--green)] [--field-border-hover:var(--green)]'
                  : '',
              round ? 'rounded-full' : '',
            ].join(' ')}
          >
            <Checkbox.Indicator />
          </Checkbox.Control>
          {children}
        </Checkbox.Content>
      </Checkbox>
    </div>
  );
}
