import { useEffect, useState } from 'react';
import { Button, Input, Label, ListBox, Modal, Select } from '@heroui/react';
import { TextField } from 'react-aria-components';

import { RoutineRecurrence, type RoutineDto } from '@gloo/shared';

import { useCreateRoutine, useUpdateRoutine } from '@/hooks/queries/routines';
import { useMe } from '@/hooks/queries/auth';
import { useUsers } from '@/hooks/queries/users';
import { strings } from '@/strings/pt-BR';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

interface FormState {
  description: string;
  recurrence: RoutineRecurrence;
  weekday: number;
  dayOfMonth: number;
  assigneeId: string;
}

const emptyForm = (assigneeId: string): FormState => ({
  description: '',
  recurrence: RoutineRecurrence.WEEKLY,
  weekday: 1,
  dayOfMonth: 1,
  assigneeId,
});

export function RoutineModal({
  isOpen,
  onClose,
  routine,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Present when editing; omitted when creating. */
  routine?: RoutineDto;
}) {
  const { data: me } = useMe();
  const { data: users = [] } = useUsers();
  const createRoutine = useCreateRoutine();
  const updateRoutine = useUpdateRoutine();

  const [form, setForm] = useState<FormState>(() => emptyForm(me?.id ?? ''));

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      routine
        ? {
            description: routine.description,
            recurrence: routine.recurrence,
            weekday: routine.weekday ?? 1,
            dayOfMonth: routine.dayOfMonth ?? 1,
            assigneeId: routine.assignee.id,
          }
        : emptyForm(me?.id ?? ''),
    );
  }, [isOpen, routine, me?.id]);

  const isWeekly = form.recurrence === RoutineRecurrence.WEEKLY;
  const canSubmit = form.description.trim() && form.assigneeId;

  function handleSubmit() {
    const payload = {
      description: form.description.trim(),
      recurrence: form.recurrence,
      weekday: isWeekly ? form.weekday : null,
      dayOfMonth: isWeekly ? null : form.dayOfMonth,
      assigneeId: form.assigneeId,
    };

    const onSuccess = () => onClose();
    if (routine) updateRoutine.mutate({ id: routine.id, ...payload }, { onSuccess });
    else createRoutine.mutate(payload, { onSuccess });
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container scroll="inside">
        <Modal.Dialog className="sm:max-w-md">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>
              {routine ? strings.common.edit : strings.routine.addRoutine}
            </Modal.Heading>
          </Modal.Header>

          <Modal.Body className="flex flex-col gap-4">
            <TextField
              aria-label={strings.task.fields.description}
              value={form.description}
              onChange={(description) => setForm((f) => ({ ...f, description }))}
              className="flex flex-col gap-1.5"
            >
              <Label className="text-sm font-medium text-foreground">
                {strings.task.fields.description}
              </Label>
              <Input fullWidth />
            </TextField>

            <Select
              value={form.recurrence}
              onChange={(key) =>
                setForm((f) => ({ ...f, recurrence: String(key) as RoutineRecurrence }))
              }
            >
              <Label>{strings.routine.recurrenceLabel}</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {Object.values(RoutineRecurrence).map((value) => (
                    <ListBox.Item
                      key={value}
                      id={value}
                      textValue={strings.routine.recurrence[value]}
                    >
                      {strings.routine.recurrence[value]}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            {isWeekly ? (
              <Select
                value={String(form.weekday)}
                onChange={(key) => setForm((f) => ({ ...f, weekday: Number(key) }))}
              >
                <Label>{strings.routine.weekdayLabel}</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {WEEKDAYS.map((label, index) => (
                      <ListBox.Item key={label} id={String(index)} textValue={label}>
                        {label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            ) : (
              <Select
                value={String(form.dayOfMonth)}
                onChange={(key) => setForm((f) => ({ ...f, dayOfMonth: Number(key) }))}
              >
                <Label>{strings.routine.dayOfMonthLabel}</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {MONTH_DAYS.map((day) => (
                      <ListBox.Item key={day} id={String(day)} textValue={String(day)}>
                        {day}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            )}

            <Select
              value={form.assigneeId}
              onChange={(key) => setForm((f) => ({ ...f, assigneeId: String(key) }))}
            >
              <Label>{strings.routine.assigneeLabel}</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {users.map((user) => (
                    <ListBox.Item key={user.id} id={user.id} textValue={user.name}>
                      {user.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" slot="close">
              {strings.common.cancel}
            </Button>
            <Button
              isDisabled={!canSubmit || createRoutine.isPending || updateRoutine.isPending}
              onPress={handleSubmit}
            >
              {strings.common.save}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
