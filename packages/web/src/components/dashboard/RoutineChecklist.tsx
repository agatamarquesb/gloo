import { Plus, SquareCheckBig, Trash2, X } from 'lucide-react';
import { Button, Input } from '@heroui/react';
import { TextField } from 'react-aria-components';

import type { ChecklistItemDto, RoutineChecklistDto } from '@gloo/shared';

import { AppCheckbox } from '@/components/common/AppCheckbox';
import { FLAT_INPUT, GREEN_UNDERLINE, NO_FIELD_BORDER } from '@/theme/fieldStyles';
import { blockBox } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

/** How many blank rows a fresh checklist starts with. */
export const SEED_ITEM_COUNT = 4;

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
    // Green outline, same as a task row on the Dashboard — the modal's blocks
    // and the task rows are the same kind of object.
    <section className={blockBox}>
      {/* Same header shape as the attachments block: icon, name, delete. The one
          difference is that this name is editable, which the green rule under it
          signals — the same marker the routine title uses. */}
      <div className="flex items-center gap-2">
        <SquareCheckBig className="size-4 shrink-0 text-muted" aria-hidden />

        <TextField
          aria-label={strings.routine.checklistTitlePlaceholder}
          value={title}
          onChange={(next) => onChange({ ...checklist, title: next })}
          isReadOnly={!isEditing}
          className="min-w-0 flex-1"
        >
          <Input
            fullWidth
            placeholder={strings.routine.checklistTitlePlaceholder}
            className={`${FLAT_INPUT} ${GREEN_UNDERLINE} font-medium`}
          />
        </TextField>

        {isEditing ? (
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="shrink-0 text-muted"
            aria-label={strings.routine.deleteChecklist}
            onPress={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        {items.map((item, index) => (
          // Index keys: rows have no id, and there is no reordering — only
          // append and remove, which React handles correctly by position.
          // eslint-disable-next-line react/no-array-index-key
          <div key={index} className="group flex items-center gap-2">
            <AppCheckbox
              round
              isSelected={item.done}
              onChange={(done) => update(index, { done })}
            >
              <span className="sr-only">
                {item.text || strings.routine.checklistItemPlaceholder}
              </span>
            </AppCheckbox>

            <TextField
              aria-label={strings.routine.checklistItemPlaceholder}
              value={item.text}
              onChange={(text) => update(index, { text })}
              isReadOnly={!isEditing}
              className="flex-1"
            >
              <Input
                fullWidth
                placeholder={strings.routine.checklistItemPlaceholder}
                // Flat: the rows are a list, not a stack of form fields, and the
                // checkbox already marks each line.
                className={`${FLAT_INPUT} ${NO_FIELD_BORDER} ${
                  item.done ? 'text-muted line-through' : ''
                }`}
              />
            </TextField>

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
    </section>
  );
}
