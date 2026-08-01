import { BrushCleaning, Pencil } from 'lucide-react';
import { Button } from '@heroui/react';

import { playSound } from '@/lib/sounds';
import {
  blockBox,
  blockBoxBare,
  blockBoxBareTight,
  blockBoxTight,
  blockDivider,
  blockLeadColumn,
  blockTitle,
  outlineControl,
} from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import { isNotesEmpty, RichNotes } from './RichNotes';

/**
 * The "Notas:" block, shared by the routine and task modals — the rich-text
 * field plus the chrome around it: the outlined box while editing, the bare
 * section once locked, the heading, and Limpar.
 *
 * Wrapping `RichNotes` rather than living inside it because the editor is also
 * the thing being wrapped: what differs between a note and any other block is
 * only this frame, and both modals have to wear exactly the same one.
 */
export function NotesBlock({
  value,
  onChange,
  placeholder,
  isEditing,
  title = strings.routine.notesTitle,
  compact = false,
  fill = false,
  showDivider = true,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
  isEditing: boolean;
  /** The block's name. "Notas:" on a routine, "Notas da tarefa" on a task. */
  title?: string;
  /**
   * The block in half a dialog's width rather than a whole one.
   *
   * Two things give way. The icon loses its fixed lead column and sits against
   * the words — that column exists so a routine's notes heading starts on the
   * same left edge as its checklists' and Anexos', and a task's notes have
   * nothing to line up against. And Limpar drops its label, because heading plus
   * four format buttons plus a labelled button is one item too many for the row,
   * and a wrapped toolbar costs the block a line it does not have.
   */
  compact?: boolean;
  /**
   * Fills the height it is given and scrolls the note inside it, rather than
   * growing with what is typed. For the task modal, where the block's closing
   * rule has to stay level with the one in the column beside it.
   */
  fill?: boolean;
  /**
   * The rule that closes the block off from what follows. Off where the layout
   * draws its own — again the task modal, whose rule spans the column rather
   * than the block.
   */
  showDivider?: boolean;
}) {
  function clear() {
    onChange('');
    playSound('sweep');
  }

  return (
    <section
      /* Compact, the block starts on its cell's own top edge and its heading
         takes a property row's height, so the title sits on the same line as
         "Prioridade" and the note itself begins level with "Deadline" — the two
         columns read as one set of rows. */
      className={`${
        compact
          ? isEditing
            ? blockBoxTight
            : blockBoxBareTight
          : isEditing
            ? blockBox
            : blockBoxBare
      } ${fill ? 'h-full min-h-0' : ''}`}
    >
      <RichNotes
        compact={compact}
        isEditing={isEditing}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        // Thin, and only while there is something to scroll: a permanent bar
        // down the side of an empty note reads as a broken box.
        //
        // The editor itself is stretched to the same height, so pressing
        // anywhere in the block puts the caret in the note — without it the
        // field is only as tall as what has been typed, and clicking the empty
        // space below a one-line note did nothing at all.
        contentClassName={
          fill
            ? 'min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] [&>[role=textbox]]:min-h-full'
            : ''
        }
        title={
          /* One flex of its own rather than two children of the toolbar: the
             toolbar's gap is tuned for the formatting buttons, and a routine's
             heading has to sit on the same left edge as its checklist's and
             Anexos', which means the shared column and the gap that goes with
             it. */
          <div className={`flex flex-1 items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
            {/* No icon in the compact block: on a task the heading has nothing
                to line up against — the column that icon sits in exists so a
                routine's three block headings share a left edge — and dropping
                it is what lets the note start level with the properties beside
                it. */}
            {compact ? null : (
              <span className={blockLeadColumn}>
                <Pencil className="size-4 text-foreground" aria-hidden />
              </span>
            )}
            {/* Never wrapped: the toolbar shares this row, and a two-line
                heading beside it pushed the whole block a line taller than the
                column it has to end level with. */}
            <span className={`whitespace-nowrap text-foreground ${blockTitle(isEditing)}`}>
              {title}
            </span>
          </div>
        }
        actions={
          /* Outlined like "Escolher arquivo", and labelled: emptying a field the
             user has typed into deserves a word, not just an icon. The woosh is
             the feedback that it actually happened — the field simply going
             blank is easy to miss. */
          <Button
            size="sm"
            variant="ghost"
            isIconOnly={compact}
            aria-label={strings.routine.clearNotes}
            className={
              compact
                ? // The broom with nothing round it, at the format buttons' own
                  // size: an outlined pill beside four bare glyphs was the
                  // heaviest thing in a row that only labels the note below it.
                  'size-6 shrink-0 rounded-md p-0 text-muted'
                : `h-9 shrink-0 rounded-full ${outlineControl}`
            }
            isDisabled={isNotesEmpty(value)}
            onPress={clear}
          >
            <BrushCleaning className={compact ? 'size-3.5' : 'size-4'} />
            {compact ? null : strings.routine.clearNotes}
          </Button>
        }
      />

      {/* Same rule, and the same clearance, as the one that closes a checklist.
          Locked only: editing, the box's own edge does it. */}
      {showDivider && !isEditing ? <div className={blockDivider} /> : null}
    </section>
  );
}
