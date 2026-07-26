import { ArrowDownAZ, ArrowUpAZ, Filter, Search } from 'lucide-react';
import { Button, Input, Label, ListBox, Popover, Select } from '@heroui/react';
import { TextField } from 'react-aria-components';

import type { SectorDto, TaskSortBy, UserDto } from '@gloo/shared';

import { strings } from '@/strings/pt-BR';

const SORT_OPTIONS: { id: TaskSortBy; label: string }[] = [
  { id: 'DUE_DATE', label: 'Data de vencimento' },
  { id: 'PRIORITY', label: 'Prioridade' },
  { id: 'PROGRESS', label: 'Progresso' },
];

export function TaskFiltersBar({
  search,
  onSearchChange,
  sortBy,
  sortDir,
  onSortByChange,
  onSortDirToggle,
  sectorId,
  onSectorChange,
  assigneeId,
  onAssigneeChange,
  sectors,
  users,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  sortBy: TaskSortBy | undefined;
  sortDir: 'ASC' | 'DESC';
  onSortByChange: (value: TaskSortBy | undefined) => void;
  onSortDirToggle: () => void;
  sectorId: string | undefined;
  onSectorChange: (value: string | undefined) => void;
  assigneeId: string | undefined;
  onAssigneeChange: (value: string | undefined) => void;
  sectors: SectorDto[];
  users: UserDto[];
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <TextField
        aria-label={strings.common.search}
        value={search}
        onChange={onSearchChange}
        className="w-full max-w-xs"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input fullWidth className="pl-9" placeholder={strings.common.search} />
        </div>
      </TextField>

      <div className="flex items-center gap-2">
        <Popover>
          <Button variant="outline" className="rounded-full">
            {sortDir === 'ASC' ? <ArrowUpAZ className="size-4" /> : <ArrowDownAZ className="size-4" />}
            {strings.common.sortBy}
          </Button>
          <Popover.Content className="min-w-48">
            <Popover.Dialog>
              <div className="flex flex-col gap-1">
                {SORT_OPTIONS.map((option) => (
                  <Button
                    key={option.id}
                    variant={sortBy === option.id ? 'secondary' : 'ghost'}
                    className="justify-start"
                    onPress={() => onSortByChange(sortBy === option.id ? undefined : option.id)}
                  >
                    {option.label}
                  </Button>
                ))}
                <Button variant="ghost" className="justify-start text-muted" onPress={onSortDirToggle}>
                  {sortDir === 'ASC' ? 'Crescente' : 'Decrescente'}
                </Button>
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>

        <Popover>
          <Button variant="outline" className="rounded-full">
            <Filter className="size-4" />
            {strings.common.filterBy}
          </Button>
          <Popover.Content className="min-w-64">
            <Popover.Dialog>
              <div className="flex flex-col gap-4">
                <Select
                  placeholder="Todos os setores"
                  value={sectorId ?? null}
                  onChange={(key) => onSectorChange(key ? String(key) : undefined)}
                >
                  <Label>{strings.task.fields.sector}</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
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
                  placeholder="Todos os responsáveis"
                  value={assigneeId ?? null}
                  onChange={(key) => onAssigneeChange(key ? String(key) : undefined)}
                >
                  <Label>{strings.task.fields.assignees}</Label>
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
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      </div>
    </div>
  );
}
