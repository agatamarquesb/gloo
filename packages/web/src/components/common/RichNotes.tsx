import { useEffect, useRef, type ReactNode } from 'react';
import { Bold, Italic, Strikethrough, Underline } from 'lucide-react';
import { Button } from '@heroui/react';

import { SectionScroll } from '@/components/common/SectionScroll';
import { strings } from '@/strings/pt-BR';

/**
 * Formatting commands, in the order they appear. `execCommand` is formally
 * deprecated but remains the only cross-browser way to toggle inline formatting
 * inside a contentEditable, and there is no replacement API — every editor
 * library still reaches for it or reimplements it by hand.
 */
const COMMANDS = [
  { command: 'bold', icon: Bold, label: strings.routine.bold },
  { command: 'italic', icon: Italic, label: strings.routine.italic },
  { command: 'underline', icon: Underline, label: strings.routine.underline },
  { command: 'strikeThrough', icon: Strikethrough, label: strings.routine.strikethrough },
] as const;

/** Markup that renders as nothing still counts as an empty note. */
export function isNotesEmpty(html: string): boolean {
  return !html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

/**
 * The routine's annotation: a contentEditable rather than a textarea, because it
 * carries bold/italic/underline/strike. What it stores is HTML, which the API
 * re-sanitises on write down to a closed list of formatting tags with no
 * attributes — see sanitizeHtml.ts.
 */
export function RichNotes({
  value,
  onChange,
  placeholder,
  ariaLabel,
  title,
  isEditing,
  /** Rendered at the end of the toolbar, after the formatting buttons. */
  actions,
  contentClassName = '',
  compact = false,
  scrollFade = false,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
  /**
   * What the field is called, for a screen reader. The placeholder does that job
   * when it reads as one ("Notas sobre esta rotina"); a task's says the note is
   * empty rather than what it is for, so that one is named separately.
   */
  ariaLabel?: string;
  /** The block's heading, kept on the same row as the toolbar. */
  title: ReactNode;
  /** Read-only outside edit mode: no toolbar, no caret. */
  isEditing: boolean;
  actions?: ReactNode;
  /**
   * The block in half a dialog's width — see NotesBlock, which passes its own
   * `compact` straight through. Here it only means the toolbar: smaller glyphs
   * in tighter buttons, so the row measures no more than the heading it shares.
   */
  compact?: boolean;
  /**
   * The area the note is written in. Given `flex-1 min-h-0 overflow-y-auto`, the
   * note scrolls inside the block instead of growing it — which is how the task
   * modal keeps the rule under Notas level with the one across the dialog.
   */
  contentClassName?: string;
  /**
   * Softens the edge a long note is cut on, on whichever side there is more of
   * it — the same fade the Routines card wears, and only while the note actually
   * overflows. Without it a note that runs past the block ends in a hard line
   * through a row of letters.
   */
  scrollFade?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Written into the DOM only when the value arrived from outside — loading a
  // routine, or the clear button. Assigning on every render would reset the
  // caret to the start on each keystroke.
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) editor.innerHTML = value;
  }, [value]);

  /**
   * Pasting brings the source's markup with it — a couple of paragraphs out of
   * Notion arrive as `<p>`s and a tracking comment. None of that survives the
   * API's sanitiser, so taking the plain text here is what the note was going to
   * end up as anyway; doing it at the paste means the editor shows that straight
   * away instead of markup that disappears on save.
   *
   * `insertText` rather than writing to the DOM, so the paste stays on the
   * browser's own undo stack.
   */
  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
    onChange(editorRef.current?.innerHTML ?? '');
  }

  function run(command: string) {
    // The selection has to be inside the editor for the command to apply, and
    // pressing a toolbar button moves focus to the button.
    editorRef.current?.focus();
    document.execCommand(command);
    onChange(editorRef.current?.innerHTML ?? '');
  }

  return (
    <>
      {/* Heading, then the formatting buttons, then whatever the caller adds —
          the toolbar shares the block's header row rather than taking one of
          its own. */}
      {/* Compact, the row is 10px of air and then the heading — the same 10 the
          tags across the gutter sit on, so the two start on one line — and
          nothing under it: the note follows straight on. Centring the heading in
          a 40px row put a second 10px below it, which read as a gap between the
          section and its own content. */}
      <div
        className={`flex gap-1 ${
          compact ? 'h-[34px] shrink-0 items-start pt-[10px]' : 'flex-wrap items-center'
        }`}
      >
        {title}

        {isEditing
          ? COMMANDS.map(({ command, icon: Icon, label }) => (
              // title on a wrapper, not the Button — HeroUI's Button doesn't
              // forward it, and a lone B or S needs the hover hint to be
              // readable at all.
              <span key={command} title={label}>
                {/* Ghost and icon-only: a toolbar of filled buttons would
                    outweigh the note it formats. Compact, they come down again
                    to the size of the heading beside them — the row is a label
                    for the note, not a control panel over it. */}
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  className={compact ? 'size-6 rounded-md p-0 text-muted' : 'text-muted'}
                  aria-label={label}
                  onPress={() => run(command)}
                >
                  <Icon className={compact ? 'size-3.5' : 'size-4'} />
                </Button>
              </span>
            ))
          : null}

        {isEditing ? actions : null}
      </div>

      {/* Flush with the block's own edge, which is where the heading's icon
          starts — the note is the block's content, so it runs the full width
          rather than hanging off the word above it. */}
      <NoteBody scrollFade={scrollFade} className={contentClassName}>
        {/* Compact, the placeholder is an empty state rather than a prompt, and
            takes the size Anexos' own "nothing here" line has — the two sit side
            by side in the task modal and used to say the same thing at two
            different sizes. */}
        {isNotesEmpty(value) ? (
          <span
            // Centred in the body in both dialogs now: the sentence is the
            // whole of what an empty note has to say, and pinned to the top-left
            // corner it read as a caption for the toolbar above it.
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-xs text-muted"

          >
            {placeholder}
          </span>
        ) : null}

        {/* The rule's advice — use an input or textarea — is exactly what this
            field cannot be: neither can hold formatted text. A contentEditable
            div with the textbox role is the only way to express a rich-text
            field, so the role stays and the rule is waived here. */}
        {/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role */}
        <div role="textbox"
          ref={editorRef}
          aria-multiline="true"
          aria-label={ariaLabel ?? placeholder}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onInput={(event) => onChange(event.currentTarget.innerHTML)}
          onPaste={handlePaste}
          // Grey once the task dialog is locked: the note is the longest block
          // of text in it, and at full strength it out-weighed the task's own
          // title. Typing it keeps full contrast — you should see what you are
          // writing at the colour you are writing it.
          className={`min-h-16 text-sm break-words outline-none ${
            compact && !isEditing ? 'text-muted' : 'text-foreground'
          }`}
        />
      </NoteBody>
    </>
  );
}

/**
 * The note's own box: a plain block in a routine, a scroll area with soft edges
 * in the task dialog — see SectionScroll, which is what the lists beside it use
 * so all three sections are cut the same way.
 *
 * `relative` either way, because the placeholder is laid over the first line.
 */
function NoteBody({
  scrollFade,
  className,
  children,
}: {
  scrollFade: boolean;
  className: string;
  children: ReactNode;
}) {
  if (!scrollFade) return <div className={`relative ${className}`}>{children}</div>;

  return <SectionScroll className={`relative ${className}`}>{children}</SectionScroll>;
}
