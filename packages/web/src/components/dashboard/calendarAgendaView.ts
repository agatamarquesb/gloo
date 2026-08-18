/**
 * Which agendas the Dashboard's calendar card leaves out of its day dots.
 *
 * Kept in `localStorage`, like the Routines card's folded tags and the task
 * order beside it: it is one person's way of reading one card — "on the
 * Dashboard I only want to see work" — and not a fact about the agenda, which
 * is why it deliberately does NOT write the agenda's own `isHidden`. That flag
 * is the Calendar page's eye icon and hides an agenda everywhere; unticking a
 * box here has to leave the page it came from alone.
 *
 * Stored as the *hidden* ids rather than the visible ones, so an agenda created
 * after this preference was written shows up on the card instead of being
 * silently filtered out by a list that never heard of it.
 */
const HIDDEN_KEY = 'gloo-dashboard-calendar-hidden-agendas';

export function readHiddenAgendas(): string[] {
  try {
    const stored = localStorage.getItem(HIDDEN_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    // Anything else in the slot is somebody else's data or an older shape —
    // showing every agenda is the state the card starts in either way.
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    // Private mode, a blocked origin, malformed JSON.
    return [];
  }
}

export function writeHiddenAgendas(ids: string[]) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids));
  } catch {
    // A full quota — which agendas a card draws is a convenience, not the data.
  }
}
