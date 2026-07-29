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

/**
 * An `&` that has to be escaped, which is not the same as every `&`.
 *
 * Escaping all of them made the sanitiser destructive on its own output: a note
 * containing `&nbsp;` came back as `&amp;nbsp;`, the editor then displayed that
 * literally, and the next save escaped it again — so a note decayed a little
 * further every time it was touched, into `&amp;amp;amp;nbsp;` and worse. An `&`
 * that already opens an entity is therefore left alone, which makes the function
 * idempotent: sanitising twice gives what sanitising once gave.
 *
 * `&lt;` and `&gt;` are left alone too, which is what makes it idempotent for
 * angle brackets as well: the browser re-escapes them when it serialises the
 * editor, so exempting them is the only way `1 < 2` survives being saved twice.
 * The cost is that text which merely *looks* like a tag can be promoted into a
 * real one by the allowlist below — typing `<b>` gets you bold rather than the
 * characters. That is a change in meaning but never a dangerous one: the tag
 * list is closed, and attributes are never re-allowed at all.
 */
const BARE_AMPERSAND = /&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#[xX][0-9a-fA-F]+);)/g;

function escapeHtml(input: string): string {
  // Ampersands first: the two replacements after it produce `&lt;`/`&gt;` of
  // their own, and those must not be escaped a second time.
  return input.replace(BARE_AMPERSAND, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Markup that survived the allowlist, which is now inert text — and which the
 * editor duly showed as text. Pasting a couple of paragraphs out of Notion put a
 * visible `<p>` at the head of every one and left its tracking comment on the
 * end, because escaping a tag makes it harmless but does not make it go away.
 *
 * The tag pattern requires a letter after the bracket so that prose keeps its
 * angle brackets: `1 < 2` is not a tag and is not touched.
 */
const ESCAPED_COMMENT = /&lt;!--[\s\S]*?--&gt;/g;
const ESCAPED_TAG = /&lt;\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s(?:(?!&lt;)[\s\S])*?)?\/?&gt;/g;

/**
 * The end of a block is a line break: dropping `</p>` outright would run two
 * pasted paragraphs into one sentence, which loses the author's meaning rather
 * than just their markup.
 */
const ESCAPED_BLOCK_END = /&lt;\/(?:p|div|li|h[1-6]|tr|blockquote)&gt;/gi;

/**
 * Strips the inert markup above, repeatedly, until a pass changes nothing.
 *
 * Once rather than repeatedly leaves the result unstable, because escaped tags
 * can be nested: cutting the inner one out of `&lt;sc&lt;script&gt;ript&gt;`
 * closes the two halves of the outer one up into `&lt;script&gt;`, which the
 * next save would then strip in turn. What a splice like that can produce is
 * always more *escaped* text — the `<` and `>` on either side of it are still
 * entities — so this is a question of the value settling, not of safety. It
 * terminates because every pass that changes anything shortens the string.
 */
function stripInertMarkup(input: string): string {
  let current = input;

  for (;;) {
    const next = current
      // Comments first: one can contain anything, including something the tag
      // pattern would otherwise take a bite out of.
      .replace(ESCAPED_COMMENT, '')
      .replace(ESCAPED_BLOCK_END, '<br>')
      .replace(ESCAPED_TAG, '');

    if (next === current) return current;
    current = next;
  }
}

/** Empty (including markup that renders as nothing) becomes null. */
export function sanitizeNotes(input: string | null | undefined): string | null {
  if (!input) return null;

  const withAllowed = escapeHtml(input).replace(
    ALLOWED_PATTERN,
    (_match, slash: string, tag: string) => `<${slash}${tag.toLowerCase()}>`,
  );

  const safe = stripInertMarkup(withAllowed)
    // The breaks those blocks turned into arrive in runs once the opening tags
    // are gone, and a note should not begin or end with one.
    .replace(/(?:<br>\s*){3,}/g, '<br><br>')
    .replace(/^(?:\s*<br>)+\s*/, '')
    .replace(/(?:\s*<br>)+\s*$/, '');

  // A note of only line breaks and whitespace is an empty note.
  const withoutMarkup = safe.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  return withoutMarkup.trim() ? safe : null;
}
