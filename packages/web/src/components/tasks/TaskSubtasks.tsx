import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { TextArea, TextField } from 'react-aria-components';

import type { SubtaskDto } from '@gloo/shared';

import { AppCheckbox } from '@/components/common/AppCheckbox';
import { SectionScroll } from '@/components/common/SectionScroll';
import { useAddSubtask, useDeleteSubtask, useUpdateSubtask } from '@/hooks/queries/tasks';
import { playSound } from '@/lib/sounds';
import {
  blockHeaderRow,
  blockRowAction,
  blockRowActionOnHover,
  blockRowList,
  blockTitle,
  taskBlockBox,
  taskBlockRow,
} from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

/**
 * An item's text, in both modes — the routine checklist's measure, so a task's
 * subtasks and a routine's items wrap at the same place. See ITEM_TEXT there for
 * why `ch` and `field-sizing-content`.
 *
 * `font-medium`, like a property's value and an attachment's title: these are
 * the dialog's content, and at a plain weight they read as caption text under
 * headings that are heavier than they are.
 */
const ITEM_TEXT = 'block w-full max-w-[48ch] text-sm font-medium break-words whitespace-pre-wrap';

/**
 * A task's subtasks, wearing a routine checklist's clothes.
 *
 * The two look identical and behave differently underneath, which is the point:
 * a routine's checklist is form state that saves with the routine, while a
 * subtask is a row of its own with its own endpoints — the progress bar above is
 * computed from them server-side, so each change has to reach the server before
 * the bar can move.
 *
 * Text edits are therefore held locally and written on blur: a PATCH per
 * keystroke would be one request per letter, and each response re-renders the
 * whole task.
 */
export function TaskSubtasks({
  taskId,
  subtasks,
  isEditing,
  canEdit,
}: {
  taskId: string;
  subtasks: SubtaskDto[];
  /** The dialog's mode: adding, renaming and removing all belong to editing. */
  isEditing: boolean;
  /**
   * Whether this user may change the task at all. Ticking an item off is using
   * the task rather than editing it — so the checkboxes stay live outside edit
   * mode, exactly as a routine's do, but not for someone who may not touch it.
   */
  canEdit: boolean;
}) {
  const addSubtask = useAddSubtask(taskId);
  const updateSubtask = useUpdateSubtask();
  const deleteSubtask = useDeleteSubtask();

  /**
   * The text being typed, by subtask id. Only holds the rows actually touched
   * since the last server copy arrived; everything else reads straight from
   * props, so another user's rename shows up without being overwritten by a
   * draft nobody is editing.
   */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newText, setNewText] = useState('');
  /**
   * Whether the blank line for a new subtask is open. It is opened by the "+"
   * in the heading rather than standing there permanently — see the heading
   * below, and Anexos, which asks for a new one the same way.
   */
  const [isAdding, setAdding] = useState(false);

  // A row that goes away takes its draft with it, so an id reused by nothing
  // can't resurrect old text.
  useEffect(() => {
    setDrafts((current) => {
      const live = Object.fromEntries(
        Object.entries(current).filter(([id]) => subtasks.some((subtask) => subtask.id === id)),
      );
      return Object.keys(live).length === Object.keys(current).length ? current : live;
    });
  }, [subtasks]);

  // Locking the dialog closes the blank line with it: it is a control, and the
  // locked block shows what the task has rather than offering to add to it.
  useEffect(() => {
    if (!isEditing) {
      setAdding(false);
      setNewText('');
    }
  }, [isEditing]);

  function commit(subtask: SubtaskDto) {
    const draft = drafts[subtask.id];
    if (draft === undefined) return;

    setDrafts((current) => {
      const next = { ...current };
      delete next[subtask.id];
      return next;
    });

    const text = draft.trim();
    // Emptying a row is not a way to delete it — the × is — so a blank draft
    // simply reverts to what the server has.
    if (!text || text === subtask.text) return;
    updateSubtask.mutate({ id: subtask.id, text });
  }

  function handleAdd() {
    const text = newText.trim();
    if (!text) return;
    addSubtask.mutate(text, { onSuccess: () => setNewText('') });
  }

  return (
    // Fills its quadrant rather than growing with the list: the dialog's rules
    // are fixed, so a sixth subtask scrolls inside the section instead of
    // pushing the footer off the screen.
    <section className={`${taskBlockBox('gap-0')} h-full min-h-0`}>
      {/* Just the name — no leading icon. Nothing in this column needs a shared
          left edge to line up against, and a task has exactly one list of
          subtasks, so an icon would only be decoration. The row still takes
          Anexos' heading height, so the two blocks' first rows start level. */}
      <div className={`${blockHeaderRow} shrink-0`}>
        <span className={`text-foreground ${blockTitle(isEditing, true)}`}>
          {strings.task.subtasksTitle}
        </span>

        {/* The way in, on the heading's right end — the same corner the rule
            above this block ends on, and where Anexos keeps its own. The
            progress these rows add up to is a property again, in the list
            above. */}
        {isEditing ? (
          <button
            type="button"
            className={`${blockRowAction} ml-auto`}
            aria-label={strings.task.addSubtask}
            onClick={() => setAdding(true)}
          >
            <Plus className="size-4" />
          </button>
        ) : null}
      </div>

      {/* The same sentence Anexos and the note say, in the same place: centred in
          what is left of the block. Only while the dialog is locked — editing,
          the block is a list you are adding to and "there is nothing here" is
          the state you are busy leaving. */}
      {subtasks.length === 0 && !isEditing ? (
        <p className="flex flex-1 items-center justify-center text-center text-xs text-muted">
          {strings.attachment.empty}
        </p>
      ) : null}

      <SectionScroll className={blockRowList}>
        {subtasks.map((subtask) => (
          // Checkbox, then the text, then the × on the row's right edge — the
          // reading order of the row: what you do to it, what it says, and the
          // way to be rid of it. Top-aligned, so a subtask that wraps starts
          // level with its own checkbox; see taskBlockRow.
          <div key={subtask.id} className={taskBlockRow}>
            {/* On the row's own left edge, not in a slot: a column would centre
                the box in it and leave the tick indented from the line the
                heading above starts on. The nudge puts it on the first line's
                optical centre rather than its box's top. */}
            <AppCheckbox
              quiet
              className="mt-0.5 shrink-0"
              isDisabled={!canEdit}
              isSelected={subtask.done}
              onChange={(done) => updateSubtask.mutate({ id: subtask.id, done })}
            >
              <span className="sr-only">{subtask.text || strings.task.subtaskPlaceholder}</span>
            </AppCheckbox>

            {isEditing ? (
              <TextField
                aria-label={strings.task.subtaskPlaceholder}
                value={drafts[subtask.id] ?? subtask.text}
                onChange={(text) => setDrafts((current) => ({ ...current, [subtask.id]: text }))}
                className="min-w-0 flex-1"
              >
                <TextArea
                  rows={1}
                  placeholder={strings.task.subtaskPlaceholder}
                  onBlur={() => commit(subtask)}
                  className={`${ITEM_TEXT} field-sizing-content resize-none bg-transparent outline-none placeholder:text-muted ${
                    subtask.done ? 'text-muted line-through' : 'text-foreground'
                  }`}
                />
              </TextField>
            ) : (
              <span
                className={`${ITEM_TEXT} ${subtask.done ? 'text-muted line-through' : 'text-foreground'}`}
              >
                {subtask.text}
              </span>
            )}

            {/* An × and nothing else, and only while the row is under the
                cursor: five bins down a list you are reading is five invitations
                to destroy something. It keeps the bin's place exactly. */}
            {isEditing ? (
              <button
                type="button"
                className={`${blockRowAction} ${blockRowActionOnHover} mt-1`}
                aria-label={strings.task.removeSubtask}
                onClick={() => {
                  playSound('delete');
                  deleteSubtask.mutate(subtask.id);
                }}
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        ))}

      {/* A new subtask is typed on a line of its own and committed with Enter,
          unlike a routine's checklist where "add item" appends a blank row: a
          blank row here would be a row on the server, and a task with three
          untitled subtasks reads as broken. The line closes itself when it is
          left empty, so the block goes back to being a list. */}
      {isEditing && isAdding ? (
        <div className={taskBlockRow}>
          <TextField
            aria-label={strings.task.addSubtask}
            value={newText}
            onChange={setNewText}
            className="min-w-0 flex-1"
          >
            {/* The line only exists because "+" was just pressed, so the caret
                has to arrive with it — focus following a deliberate action,
                which is what the rule is there to protect. */}
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <TextArea
              rows={1}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              placeholder={strings.task.addSubtask}
              onKeyDown={(event) => {
                // Enter commits rather than breaking the line: a subtask is one
                // line of text, and the row stays open for the next one.
                if (event.key !== 'Enter' || event.shiftKey) return;
                event.preventDefault();
                handleAdd();
              }}
              onBlur={() => {
                handleAdd();
                setAdding(false);
              }}
              className={`${ITEM_TEXT} field-sizing-content resize-none bg-transparent text-foreground outline-none placeholder:text-muted`}
            />
          </TextField>
        </div>
      ) : null}
      </SectionScroll>
    </section>
  );
}
