import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

import { hiddenScrollbar } from '@/theme/styleConstants';

/**
 * How a section inside the task dialog scrolls.
 *
 * The dialog itself does not: its rules, its columns and its property list are
 * fixed, and only what a section *holds* — the note, the subtasks, the files —
 * moves. So each of those is its own scroll area, filling whatever height its
 * quadrant was given and no more.
 *
 * `min-h-0` on the wrapper is what makes that work at all: a flex child's
 * default minimum is its content, so without it a long list grows its section
 * rather than scrolling inside it, and the dialog gets taller than the screen.
 */
const WRAPPER = 'relative flex min-h-0 flex-1 flex-col';

/**
 * The fade at whichever edge has more content past it.
 *
 * A gradient laid over the scroller rather than a mask on it — HeroUI's
 * ScrollShadow, which is what the Routines card wears, thins the content itself,
 * and anything pinned inside the scroll area (the "+" below) would thin with it.
 * Painted in the dialog's own ground, `--overlay`, so it follows the theme.
 *
 * 14px, and no more: at the component's default 40 the fade swallowed a whole
 * row of a five-row list. It marks the edge the content is cut on rather than
 * putting a band across the section.
 */
const FADE = 'pointer-events-none absolute inset-x-0 z-10 h-[14px]';
const FADE_TOP = `${FADE} top-0 bg-[linear-gradient(to_bottom,var(--overlay),transparent)]`;
const FADE_BOTTOM = `${FADE} bottom-0 bg-[linear-gradient(to_top,var(--overlay),transparent)]`;

/** Both edges are within a pixel of the end — sub-pixel scroll heights are real. */
const EDGE_SLACK = 1;

/**
 * Which ends of a scroller have content past them.
 *
 * Exported because the fade is not only a dialog's: the Calendar page's
 * right-hand column is a scroller too, and it needs the same answer to draw the
 * same soft edge in its own ground. What differs between the two is what the
 * gradient is painted in, which is the caller's business — this only says
 * whether there is anything up there or down there.
 *
 * Remeasured on resize as well as on scroll: a section's height comes from the
 * box around it, and a list that fitted at one window size overflows at the
 * next. ResizeObserver on the content rather than the window, so adding a row is
 * caught too.
 */
export function useScrollEdges(
  ref: RefObject<HTMLElement | null>,
  /** Re-observed when this changes — the children, as a rule. */
  content?: unknown,
) {
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const top = el.scrollTop > EDGE_SLACK;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - EDGE_SLACK;
    setEdges((current) =>
      current.top === top && current.bottom === bottom ? current : { top, bottom },
    );
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  }, [ref, measure, content]);

  return { edges, measure };
}

/**
 * How the scroller itself behaves: down only, and with no bar of its own.
 *
 * `overflow-x-hidden` is not decoration. A box with `overflow-y: auto` and the
 * other axis left `visible` computes *both* to `auto`, so every section had a
 * horizontal scrollbar the moment anything inside it reached the edge — which is
 * also why nothing may overhang these rows: it must wrap instead.
 *
 * The bar is hidden rather than thinned. These are short lists inside a dialog
 * whose edges already fade to say there is more; a scrollbar in each of three
 * boxes was three more lines in a layout made of lines.
 */
const SCROLLER = `min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${hiddenScrollbar}`;

/**
 * A section's scrolling content, with a soft edge wherever it continues past the
 * box.
 */
export function SectionScroll({
  children,
  className = '',
}: {
  children: ReactNode;
  /** The scroller's own classes — the list's layout, as a rule. */
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { edges, measure } = useScrollEdges(ref, children);

  return (
    <div className={WRAPPER}>
      {edges.top ? <div aria-hidden className={FADE_TOP} /> : null}

      <div ref={ref} onScroll={measure} className={`${SCROLLER} ${className}`}>
        {children}
      </div>

      {edges.bottom ? <div aria-hidden className={FADE_BOTTOM} /> : null}
    </div>
  );
}
