import { useState } from 'react';
import { Button, Modal } from '@heroui/react';

import { useCreateTask } from '@/hooks/queries/tasks';
import { useSectors } from '@/hooks/queries/sectors';
import { useUsers } from '@/hooks/queries/users';
import { SecondaryButton } from '@/components/common/SecondaryButton';
import { strings } from '@/strings/pt-BR';

import { TaskFieldsEditor, type TaskFieldsValue } from './TaskFieldsEditor';

const EMPTY_FORM: TaskFieldsValue = {
  title: '',
  description: '',
  priority: 'MEDIUM',
  dueDate: '',
  sectorId: '',
  assigneeIds: [],
};

export function CreateTaskModal({
  isOpen,
  onClose,
  defaultAssigneeId,
}: {
  isOpen: boolean;
  onClose: () => void;
  defaultAssigneeId?: string;
}) {
  const { data: sectors = [] } = useSectors();
  const { data: users = [] } = useUsers();
  const createTask = useCreateTask();

  const [form, setForm] = useState<TaskFieldsValue>({
    ...EMPTY_FORM,
    assigneeIds: defaultAssigneeId ? [defaultAssigneeId] : [],
  });

  const canSubmit = form.title.trim() && form.sectorId;

  function handleCreate() {
    createTask.mutate(
      {
        title: form.title.trim(),
        description: form.description || null,
        priority: form.priority,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        sectorId: form.sectorId,
        assigneeIds: form.assigneeIds,
      },
      {
        onSuccess: () => {
          setForm({ ...EMPTY_FORM, assigneeIds: defaultAssigneeId ? [defaultAssigneeId] : [] });
          onClose();
        },
      },
    );
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container scroll="inside">
        <Modal.Dialog className="sm:max-w-lg">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{strings.task.addTask}</Modal.Heading>
          </Modal.Header>

          <Modal.Body>
            <TaskFieldsEditor value={form} onChange={setForm} sectors={sectors} users={users} />
          </Modal.Body>

          <Modal.Footer>
            <SecondaryButton slot="close">
              {strings.common.cancel}
            </SecondaryButton>
            <Button isDisabled={!canSubmit || createTask.isPending} onPress={handleCreate}>
              {strings.common.save}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
