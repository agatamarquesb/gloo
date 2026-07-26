import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Input } from '@heroui/react';
import { TextField } from 'react-aria-components';

import type { SubtaskDto } from '@gloo/shared';

import { AppCheckbox } from '@/components/common/AppCheckbox';
import { useAddSubtask, useDeleteSubtask, useUpdateSubtask } from '@/hooks/queries/tasks';
import { strings } from '@/strings/pt-BR';

export function SubtaskChecklist({
  taskId,
  subtasks,
  canEdit,
}: {
  taskId: string;
  subtasks: SubtaskDto[];
  canEdit: boolean;
}) {
  const [newText, setNewText] = useState('');
  const addSubtask = useAddSubtask(taskId);
  const updateSubtask = useUpdateSubtask();
  const deleteSubtask = useDeleteSubtask();

  function handleAdd() {
    const text = newText.trim();
    if (!text) return;
    addSubtask.mutate(text, { onSuccess: () => setNewText('') });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{strings.task.fields.subtasks}</span>

      {subtasks.map((subtask) => (
        <div key={subtask.id} className="group flex items-center gap-2 rounded-xl px-1 py-1">
          <AppCheckbox
            isSelected={subtask.done}
            isDisabled={!canEdit}
            onChange={(done) => updateSubtask.mutate({ id: subtask.id, done })}
          >
            <span className={subtask.done ? 'text-muted line-through' : 'text-foreground'}>
              {subtask.text}
            </span>
          </AppCheckbox>

          {canEdit ? (
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={strings.common.delete}
              className="ml-auto opacity-0 transition-opacity group-hover:opacity-100"
              onPress={() => deleteSubtask.mutate(subtask.id)}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      ))}

      {canEdit ? (
        <div className="flex items-center gap-2">
          <TextField
            aria-label={strings.task.fields.subtasks}
            value={newText}
            onChange={setNewText}
            className="flex-1"
          >
            <Input fullWidth placeholder="Nova subtarefa" />
          </TextField>
          <Button
            isIconOnly
            size="sm"
            variant="secondary"
            aria-label={strings.common.save}
            isDisabled={!newText.trim() || addSubtask.isPending}
            onPress={handleAdd}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
