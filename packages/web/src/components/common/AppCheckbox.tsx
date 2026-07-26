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
}: {
  isSelected: boolean;
  onChange: (selected: boolean) => void;
  isDisabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
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
      <Checkbox isSelected={isSelected} isDisabled={isDisabled} onChange={onChange}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          {children}
        </Checkbox.Content>
      </Checkbox>
    </div>
  );
}
