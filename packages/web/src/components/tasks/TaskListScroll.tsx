import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { ScrollShadow } from '@heroui/react';

import { LIFT_ROOM_Y, liftRoom } from '@/theme/styleConstants';

/**
 * How many rows the list stands at before the rest become a scroll.
 *
 * Ten is enough that most filtered views are the whole list, and few enough
 * that the section does not run past the bottom of the window and take the
 * page's own scroll with it. The board asks for eight instead — see `rows` —
 * because four columns of ten stacked cards is a page and a half of scrolling
 * before the fourth column's first card.
 */
const DEFAULT_VISIBLE_ROWS = 10;

/**
 * What `liftRoom`'s vertical padding costs, in pixels.
 *
 * The ten-row height has to pay for it, or the tenth row is cut off by exactly
 * that much. Taken from the constant rather than written down again, so the two
 * cannot drift.
 */
const VERTICAL_PADDING = LIFT_ROOM_Y;

/**
 * The task list, so many rows at a time — ten down the page, eight in a board
 * column.
 *
 * The height is measured rather than written down: a row is one line on a wide
 * page and a stack of three on a phone, and a board card is taller than either,
 * so any constant here would be right in one place and wrong everywhere else.
 * What it measures is the last standing row's bottom edge against the first
 * row's top — the exact height those rows and the gaps between them occupy,
 * whatever they happen to be.
 *
 * Nothing is capped while the list is within the cap: a list of three should be
 * three rows tall, not a fraction of the window with white under it.
 */
export function TaskListScroll({
  count,
  rows = DEFAULT_VISIBLE_ROWS,
  children,
}: {
  count: number;
  /** How many rows stand before the rest become a scroll. */
  rows?: number;
  children: ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    // The scroller is the list's own parent — ScrollShadow renders one element
    // and puts its child straight inside it. Reached this way rather than by a
    // second ref because ScrollShadow does not forward `style` or `ref` through
    // to that element, so a height set on the component never lands on it.
    const scroller = list?.parentElement;
    if (!list || !scroller) return;

    function measure() {
      const items = list!.children;

      // At the cap or under it: no maximum at all, so a list of three is three
      // rows tall rather than a tenth of the window with white under it.
      if (items.length <= rows) {
        scroller!.style.maxHeight = '';
        return;
      }

      const first = items[0].getBoundingClientRect();
      const last = items[rows - 1].getBoundingClientRect();
      scroller!.style.maxHeight = `${last.bottom - first.top + VERTICAL_PADDING}px`;
    }

    measure();

    // The rows reflow with the page's width — a meta column that sat beside the
    // title wraps under it — so the ten-row height is re-taken whenever the list
    // changes size. Watching the list and not the window catches the sidebar
    // opening too, which the window never hears about. Capping the *scroller*
    // never resizes the list, so this cannot chase its own tail.
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [count, rows]);

  return (
    // HeroUI's own fade rather than a hand-rolled gradient, as on the Dashboard's
    // task list — it tracks the scroll position, so an edge only softens while it
    // actually has content hidden past it, and the last row dissolves into the
    // card's ground instead of ending on a hard cut.
    //
    // liftRoom is the padding that keeps a row's hover growth from being clipped
    // by the scroller, with the matching negative margin that puts the rows back
    // on the section's own margins — see the constant.
    <ScrollShadow
      variant="fade"
      orientation="vertical"
      size={30}
      className={`gloo-thin-scroll overflow-y-auto ${liftRoom}`}
    >
      {/* The flex column is inside the scroller, not the scroller itself: rows
          are flex items either way, and as children of a height-capped flex
          container they would compress to fit rather than overflow — so the list
          would never scroll at all. */}
      <div ref={listRef} className="flex flex-col gap-2">
        {children}
      </div>
    </ScrollShadow>
  );
}
