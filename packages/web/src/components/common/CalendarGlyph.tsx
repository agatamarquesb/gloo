/**
 * A calendar icon with something written inside it.
 *
 * lucide has a calendar for every purpose except the one the day summary needs:
 * one that says *which* day, and one that says "agenda" rather than "a date".
 * Both are the same frame with a different mark in the body, so they are drawn
 * here rather than picked from a set — a folder of 31 files that differ by two
 * glyphs is 31 chances for one of them to drift.
 *
 * The frame is lucide's own: same 24-unit box, same 2-unit stroke, same corner,
 * so these sit in a row of lucide icons without looking imported from elsewhere.
 * The mark inside is filled rather than stroked, because a stroked digit at this
 * size is a smudge.
 */
function CalendarFrame({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18" />
      {children}
    </svg>
  );
}

/**
 * The mark inside, as type.
 *
 * Two digits need a narrower face than one, or "31" reaches the frame on both
 * sides. `textLength` is deliberately not used: it distorts the glyphs, and the
 * size step does the same job honestly.
 */
function GlyphText({ children, size }: { children: string; size: number }) {
  return (
    <text
      x="12"
      y="18.5"
      textAnchor="middle"
      fontSize={size}
      fontWeight="700"
      fill="currentColor"
      stroke="none"
    >
      {children}
    </text>
  );
}

/** The day of the month the item falls on, 1–31, written in the calendar. */
export function CalendarDayGlyph({ day, className = '' }: { day: number; className?: string }) {
  const label = String(day);

  return (
    <CalendarFrame className={className}>
      <GlyphText size={label.length > 1 ? 9 : 10}>{label}</GlyphText>
    </CalendarFrame>
  );
}

/** "A" for agenda — the same calendar, marked with what the row is about. */
export function CalendarAgendaGlyph({ className = '' }: { className?: string }) {
  return (
    <CalendarFrame className={className}>
      <GlyphText size={10}>A</GlyphText>
    </CalendarFrame>
  );
}
