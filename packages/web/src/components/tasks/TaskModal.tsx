import { useEffect, useState } from 'react';
import { Link2, Trash2 } from 'lucide-react';
import { Button, Modal } from '@heroui/react';

import type { TaskDetailDto, TaskStatus } from '@gloo/shared';

import { useDeleteTask, useTask, useUpdateTask, useUpdateTaskStatus } from '@/hooks/queries/tasks';
import { useMe } from '@/hooks/queries/auth';
import { useSectors } from '@/hooks/queries/sectors';
import { useUsers } from '@/hooks/queries/users';
import { canMutateEntity } from '@/lib/permissions';
import { strings } from '@/strings/pt-BR';

import { SubtaskChecklist } from './SubtaskChecklist';
import { TaskFieldsEditor, type TaskFieldsValue } from './TaskFieldsEditor';
import { TaskProgressBar } from './TaskProgressBar';
import { TaskStatusSelect } from './TaskStatusSelect';

function toFormValue(task: TaskDetailDto): TaskFieldsValue {
  return {
    title: task.title,
    description: task.description ?? '',
    priority: task.priority,
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    sectorId: task.sector.id,
    assigneeIds: task.assignees.map((a) => a.id),
  };
}

function TaskModalContent({ task, onClose }: { task: TaskDetailDto; onClose: () => void }) {
  const { data: me } = useMe();
  const { data: sectors = [] } = useSectors();
  const { data: users = [] } = useUsers();

  const updateTask = useUpdateTask(task.id);
  const updateStatus = useUpdateTaskStatus(task.id);
  const deleteTask = useDeleteTask();

  const [form, setForm] = useState<TaskFieldsValue>(() => toFormValue(task));

  // Re-sync when the server copy changes (e.g. after a subtask toggle refetch)
  // so the form never shows stale values against a newer task revision.
  useEffect(() => {
    setForm(toFormValue(task));
  }, [task]);

  const canEdit = canMutateEntity(me, {
    createdById: task.createdById,
    assigneeIds: task.assignees.map((a) => a.id),
  });

  const isDirty = JSON.stringify(form) !== JSON.stringify(toFormValue(task));

  function handleSave() {
    updateTask.mutate({
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      sectorId: form.sectorId,
      assigneeIds: form.assigneeIds,
    });
  }

  function handleDelete() {
    deleteTask.mutate(task.id, { onSuccess: onClose });
  }

  return (
    <Modal.Dialog className="sm:max-w-2xl">
      <Modal.CloseTrigger />
      <Modal.Header>
        <Modal.Heading>{task.title}</Modal.Heading>
      </Modal.Header>

      <Modal.Body className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <TaskStatusSelect
            value={task.status}
            isDisabled={!canEdit}
            onChange={(status: TaskStatus) => updateStatus.mutate(status)}
          />
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-foreground">{strings.task.fields.progress}</span>
            <TaskProgressBar value={task.progress} className="w-full" />
          </div>
        </div>

        <TaskFieldsEditor
          value={form}
          onChange={setForm}
          sectors={sectors}
          users={users}
          disabled={!canEdit}
        />

        <SubtaskChecklist taskId={task.id} subtasks={task.subtasks} canEdit={canEdit} />
      </Modal.Body>

      <Modal.Footer className="flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onPress={() => navigator.clipboard.writeText(window.location.href)}
          >
            <Link2 className="size-4" />
            {strings.task.copyLink}
          </Button>
          {canEdit ? (
            <Button variant="danger-soft" isDisabled={deleteTask.isPending} onPress={handleDelete}>
              <Trash2 className="size-4" />
              {strings.common.delete}
            </Button>
          ) : null}
        </div>

        {canEdit ? (
          <Button isDisabled={!isDirty || updateTask.isPending} onPress={handleSave}>
            {strings.common.save}
          </Button>
        ) : null}
      </Modal.Footer>
    </Modal.Dialog>
  );
}

export function TaskModal({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { data: task, isLoading } = useTask(taskId);

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container scroll="inside">
        {isLoading || !task ? (
          <Modal.Dialog className="sm:max-w-2xl">
            <Modal.Body>
              <p className="py-8 text-center text-muted">{strings.common.loading}</p>
            </Modal.Body>
          </Modal.Dialog>
        ) : (
          <TaskModalContent task={task} onClose={onClose} />
        )}
      </Modal.Container>
    </Modal.Backdrop>
  );
}
