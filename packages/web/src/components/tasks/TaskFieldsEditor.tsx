import { Input, Label, ListBox, Select, TextArea } from '@heroui/react';
import { TextField } from 'react-aria-components';

import type { SectorDto, TaskPriority, UserDto } from '@gloo/shared';

import { DateField } from '@/components/common/DateField';
import { listboxPopover } from '@/theme/fieldStyles';
import { strings } from '@/strings/pt-BR';

const PRIORITY_OPTIONS: TaskPriority[] = ['HIGH', 'MEDIUM', 'LOW'];

export interface TaskFieldsValue {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string;
  sectorId: string;
  assigneeIds: string[];
}

export function TaskFieldsEditor({
  value,
  onChange,
  sectors,
  users,
  disabled = false,
}: {
  value: TaskFieldsValue;
  onChange: (value: TaskFieldsValue) => void;
  sectors: SectorDto[];
  users: UserDto[];
  disabled?: boolean;
}) {
  const set = <K extends keyof TaskFieldsValue>(key: K, val: TaskFieldsValue[K]) =>
    onChange({ ...value, [key]: val });

  return (
    <div className="flex flex-col gap-4">
      <TextField
        aria-label={strings.task.fields.title}
        value={value.title}
        onChange={(v) => set('title', v)}
        isDisabled={disabled}
        className="flex flex-col gap-1.5"
      >
        <Label className="text-sm font-medium text-foreground">{strings.task.fields.title}</Label>
        <Input fullWidth />
      </TextField>

      <TextField
        aria-label={strings.task.fields.description}
        value={value.description}
        onChange={(v) => set('description', v)}
        isDisabled={disabled}
        className="flex flex-col gap-1.5"
      >
        <Label className="text-sm font-medium text-foreground">{strings.task.fields.description}</Label>
        <TextArea fullWidth rows={3} className="resize-none" />
      </TextField>

      <div className="grid grid-cols-2 gap-4">
        <Select
          isDisabled={disabled}
          value={value.priority}
          onChange={(key) => set('priority', String(key) as TaskPriority)}
        >
          <Label>Prioridade</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover {...listboxPopover}>
            <ListBox>
              {PRIORITY_OPTIONS.map((priority) => (
                <ListBox.Item key={priority} id={priority} textValue={strings.task.priority[priority]}>
                  {strings.task.priority[priority]}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <DateField
          label={strings.task.fields.dueDate}
          value={value.dueDate}
          onChange={(v) => set('dueDate', v)}
          isDisabled={disabled}
        />
      </div>

      <Select
        isDisabled={disabled}
        value={value.sectorId}
        onChange={(key) => set('sectorId', String(key))}
      >
        <Label>{strings.task.fields.sector}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover {...listboxPopover}>
          <ListBox>
            {sectors.map((sector) => (
              <ListBox.Item key={sector.id} id={sector.id} textValue={sector.name}>
                {sector.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <Select
        isDisabled={disabled}
        selectionMode="multiple"
        value={value.assigneeIds}
        onChange={(keys) => set('assigneeIds', (keys as (string | number)[]).map(String))}
      >
        <Label>{strings.task.fields.assignees}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover {...listboxPopover}>
          <ListBox selectionMode="multiple">
            {users.map((user) => (
              <ListBox.Item key={user.id} id={user.id} textValue={user.name}>
                {user.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}
