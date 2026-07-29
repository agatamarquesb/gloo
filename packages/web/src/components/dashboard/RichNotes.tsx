import { useEffect, useRef, type ReactNode } from 'react';
import { Bold, Italic, Strikethrough, Underline } from 'lucide-react';
import { Button } from '@heroui/react';

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
  title,
  isEditing,
  /** Rendered at the end of the toolbar, after the formatting buttons. */
  actions,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
  /** The block's heading, kept on the same row as the toolbar. */
  title: ReactNode;
  /** Read-only outside edit mode: no toolbar, no caret. */
  isEditing: boolean;
  actions?: ReactNode;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Written into the DOM only when the value arrived from outside — loading a
  // routine, or the clear button. Assigning on every render would reset the
  // caret to the start on each keystroke.
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) editor.innerHTML = value;
  }, [value]);

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
      <div className="flex flex-wrap items-center gap-1">
        {title}

        {isEditing
          ? COMMANDS.map(({ command, icon: Icon, label }) => (
              // title on a wrapper, not the Button — HeroUI's Button doesn't
              // forward it, and a lone B or S needs the hover hint to be
              // readable at all.
              <span key={command} title={label}>
                {/* Ghost and icon-only: a toolbar of filled buttons would
                    outweigh the note it formats. */}
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  className="text-muted"
                  aria-label={label}
                  onPress={() => run(command)}
                >
                  <Icon className="size-4" />
                </Button>
              </span>
            ))
          : null}

        {isEditing ? actions : null}
      </div>

      <div className="relative">
        {isNotesEmpty(value) ? (
          <span className="pointer-events-none absolute top-1 left-0 text-sm text-muted">
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
          aria-label={placeholder}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onInput={(event) => onChange(event.currentTarget.innerHTML)}
          className="min-h-16 pt-1 text-sm break-words text-foreground outline-none"
        />
      </div>
    </>
  );
}
