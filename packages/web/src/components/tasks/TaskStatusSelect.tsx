import { Label, ListBox, Select } from '@heroui/react';

import { TaskStatus } from '@gloo/shared';

import { strings } from '@/strings/pt-BR';

const STATUS_OPTIONS = Object.values(TaskStatus);

export function TaskStatusSelect({
  value,
  onChange,
  isDisabled = false,
}: {
  value: TaskStatus;
  onChange: (status: TaskStatus) => void;
  isDisabled?: boolean;
}) {
  return (
    <Select
      isDisabled={isDisabled}
      value={value}
      onChange={(key) => onChange(String(key) as TaskStatus)}
    >
      <Label>Status</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {STATUS_OPTIONS.map((status) => (
            <ListBox.Item key={status} id={status} textValue={strings.task.status[status]}>
              {strings.task.status[status]}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
