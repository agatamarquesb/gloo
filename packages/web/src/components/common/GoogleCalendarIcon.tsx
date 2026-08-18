/**
 * Google Calendar's own mark, for the one row that leaves the app for it.
 *
 * Drawn rather than pulled from an icon set for the same reason the calendar
 * glyphs beside it are: nothing in the app's icon library carries a brand, and a
 * grey outline calendar next to "Adicionar Google Agenda" said nothing that the
 * words did not already. It keeps its own colours — a brand mark recoloured to
 * the row's ink stops being the thing it is pointing at.
 *
 * The 24-unit box and the size classes are lucide's, so it sits in a menu beside
 * lucide icons at the same weight.
 */
export function GoogleCalendarIcon({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none">
      {/* The clip along the top, with its two holes. */}
      <rect x="6" y="2" width="12" height="3.2" rx="1.2" fill="#bdc1c6" />
      <circle cx="9" cy="3.6" r="0.85" fill="#f8f9fa" />
      <circle cx="15" cy="3.6" r="0.85" fill="#f8f9fa" />

      {/* The body, in the two blues the mark is split into. */}
      <path d="M3.4 6a1.6 1.6 0 0 1 1.6-1.6h14a1.6 1.6 0 0 1 1.6 1.6v6H3.4z" fill="#1a73e8" />
      <path d="M3.4 12h17.2v6a1.6 1.6 0 0 1-1.6 1.6H5A1.6 1.6 0 0 1 3.4 18z" fill="#2b8ef5" />

      {/* Filled rather than stroked: at 14px a stroked digit is a smudge — the
          same reason CalendarGlyph writes its day as type. */}
      <text
        x="12"
        y="16.6"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="#e8eaed"
      >
        31
      </text>
    </svg>
  );
}
