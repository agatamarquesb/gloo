import { ClipboardList, Plus, Trash2, X } from 'lucide-react';
import { Button, Input } from '@heroui/react';
import { TextArea, TextField } from 'react-aria-components';

import type { ChecklistItemDto, RoutineChecklistDto } from '@gloo/shared';

import { AppCheckbox } from '@/components/common/AppCheckbox';
import { playSound } from '@/lib/sounds';
import { FLAT_INPUT, GREEN_UNDERLINE } from '@/theme/fieldStyles';
import {
  blockBox,
  blockBoxBare,
  blockDivider,
  blockLeadColumn,
  blockTitle,
} from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

/** How many blank rows a fresh checklist starts with. */
export const SEED_ITEM_COUNT = 4;

/**
 * An item's text, in both modes.
 *
 * The line breaks at 48 characters rather than at whatever width the dialog
 * happens to be: `ch` is the width of a "0" in the current font, which is as
 * close as a proportional face gets to counting characters. `field-sizing-content`
 * is what lets the editable version grow to the lines it wrapped into — where
 * it isn't supported the field simply stays one row, which is where it was
 * before.
 */
const ITEM_TEXT =
  'block w-full max-w-[48ch] text-sm break-words whitespace-pre-wrap';

/** Holds the checkbox to the height of the item's first line, so a wrapped item
 *  keeps it beside the line it starts on rather than centred on the whole block. */
const ITEM_LEAD = `${blockLeadColumn} h-5`;

export const emptyChecklist = (): RoutineChecklistDto => ({
  title: '',
  items: Array.from({ length: SEED_ITEM_COUNT }, () => ({ text: '', done: false })),
});

/**
 * One of a routine's checklist blocks. Unlike a task's subtasks — which are rows
 * with their own endpoints — this is edited entirely in local state and saved
 * with the routine, so nothing is written until the modal's Save.
 */
export function RoutineChecklist({
  checklist,
  onChange,
  onDelete,
  isEditing,
  canToggle = true,
}: {
  checklist: RoutineChecklistDto;
  onChange: (checklist: RoutineChecklistDto) => void;
  onDelete: () => void;
  /**
   * Outside edit mode the block is a read-only list with one exception: the
   * checkboxes still toggle. Ticking something off is using the routine, not
   * editing it.
   */
  isEditing: boolean;
  /**
   * ...which is exactly why a deleted routine withholds it. There is no using a
   * routine that is in the bin, and nothing done to one there would be saved.
   */
  canToggle?: boolean;
}) {
  const { title, items } = checklist;

  function setItems(next: ChecklistItemDto[]) {
    onChange({ ...checklist, items: next });
  }

  function update(index: number, patch: Partial<ChecklistItemDto>) {
    onChange({
      ...checklist,
      items: items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });
  }

  return (
    // Green outline while editing, same as a task row on the Dashboard — the
    // modal's blocks and the task rows are the same kind of object. Locked, the
    // frame comes off and it is just a list.
    <section className={isEditing ? blockBox : blockBoxBare}>
      {/* Same header shape as the attachments block: icon, name, delete. The one
          difference is that this name is editable, which the green rule under it
          signals — the same marker the routine title uses. */}
      <div className="flex items-center gap-2">
        <span className={blockLeadColumn}>
          <ClipboardList className="size-4 text-foreground" aria-hidden />
        </span>

        {/* Locked, this is a heading rather than a field left switched off. A
            read-only Input still behaves like one — HeroUI draws its edge under
            the cursor, so hovering a routine you are only reading lit up a rule
            under the name. Plain text has nothing to light up. */}
        {isEditing ? (
          <TextField
            aria-label={strings.routine.checklistTitlePlaceholder}
            value={title}
            onChange={(next) => onChange({ ...checklist, title: next })}
            className="min-w-0 flex-1"
          >
            <Input
              fullWidth
              placeholder={strings.routine.checklistTitlePlaceholder}
              className={`${FLAT_INPUT} ${GREEN_UNDERLINE} ${blockTitle(true)}`}
            />
          </TextField>
        ) : (
          /* Colon appended here rather than stored on the title: it punctuates
             the heading against the items below it, so it belongs to how the
             name is presented and not to the name itself. */
          <span className={`min-w-0 flex-1 truncate text-foreground ${blockTitle(false)}`}>
            {title ? `${title}:` : ''}
          </span>
        )}

        {isEditing ? (
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="shrink-0 text-muted"
            aria-label={strings.routine.deleteChecklist}
            onPress={() => {
              playSound('delete');
              onDelete();
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          // Index keys: rows have no id, and there is no reordering — only
          // append and remove, which React handles correctly by position.
          // eslint-disable-next-line react/no-array-index-key
          <div key={index} className="group flex items-start gap-2">
            <span className={ITEM_LEAD}>
              {/* The rounded square the Dashboard's routine rows use, not a
                  circle — an item of a checklist is the same kind of thing you
                  tick off there — but on the quiet edge: a list of them is a lot
                  of boxes, and a green rule on every one was all anyone saw. */}
              <AppCheckbox
                quiet
                isDisabled={!canToggle}
                isSelected={item.done}
                onChange={(done) => update(index, { done })}
              >
                <span className="sr-only">
                  {item.text || strings.routine.checklistItemPlaceholder}
                </span>
              </AppCheckbox>
            </span>

            {/* A textarea rather than an input, and plain text once locked: an
                input cannot wrap, so the line an item breaks at while you type
                has to be the one you see afterwards. Both are bare — no padding
                and no chrome — so the two versions and the heading above all
                start on one left edge. */}
            {isEditing ? (
              <TextField
                aria-label={strings.routine.checklistItemPlaceholder}
                value={item.text}
                onChange={(text) => update(index, { text })}
                className="min-w-0 flex-1"
              >
                <TextArea
                  rows={1}
                  placeholder={strings.routine.checklistItemPlaceholder}
                  className={`${ITEM_TEXT} field-sizing-content resize-none bg-transparent outline-none placeholder:text-muted ${
                    item.done ? 'text-muted line-through' : 'text-foreground'
                  }`}
                />
              </TextField>
            ) : (
              <span
                className={`${ITEM_TEXT} ${
                  item.done ? 'text-muted line-through' : 'text-foreground'
                }`}
              >
                {item.text}
              </span>
            )}

            {isEditing ? (
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                className="text-muted opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={strings.routine.removeChecklistItem}
                onPress={() => setItems(items.filter((_, i) => i !== index))}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        ))}
      </div>

      {/* -ml-3 cancels the button's own padding so its icon sits on the same
          left edge as the header icon and every checkbox above it. */}
      {isEditing ? (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 self-start rounded-full text-muted"
          onPress={() => setItems([...items, { text: '', done: false }])}
        >
          <Plus className="size-4" />
          {strings.routine.addChecklistItem}
        </Button>
      ) : null}

      {/* Closes the checklist off from whatever follows it. Only needed once the
          frame is gone: editing, the box's own edge already does this. */}
      {isEditing ? null : <div className={blockDivider} />}
    </section>
  );
}
