/**
 * Notes are the one field that stores markup — a routine's annotation carries
 * bold/italic/underline/strike from its toolbar.
 *
 * The sanitiser works by **escaping everything first and then re-allowing a
 * closed list of tags**, rather than trying to strip dangerous ones. That
 * inversion is what makes it safe: anything not on the list — a script, an
 * event handler, an attribute of any kind, a malformed tag — is already inert
 * text by the time the allowlist runs, so there is nothing to miss. Attributes
 * are never re-allowed at all, which removes `href`, `on*` and `style` as a
 * category rather than one at a time.
 */
const ALLOWED_TAGS = ['b', 'i', 'u', 's', 'strong', 'em', 'br'] as const;

const ALLOWED_PATTERN = new RegExp(
  `&lt;(/?)(${ALLOWED_TAGS.join('|')})\\s*/?&gt;`,
  'gi',
);

function escapeHtml(input: string): string {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Empty (including markup that renders as nothing) becomes null. */
export function sanitizeNotes(input: string | null | undefined): string | null {
  if (!input) return null;

  const safe = escapeHtml(input).replace(
    ALLOWED_PATTERN,
    (_match, slash: string, tag: string) => `<${slash}${tag.toLowerCase()}>`,
  );

  // A note of only line breaks and whitespace is an empty note.
  const withoutMarkup = safe.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  return withoutMarkup.trim() ? safe : null;
}
