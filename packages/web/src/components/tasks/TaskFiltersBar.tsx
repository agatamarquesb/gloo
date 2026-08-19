import type { ReactNode } from 'react';
import { ArrowDownAZ, ArrowUpAZ, Filter } from 'lucide-react';
import { Button, Label, ListBox, Popover, Select } from '@heroui/react';

import type { SectorDto, TaskSortBy, UserDto } from '@gloo/shared';

import { SearchField } from '@/components/common/SearchField';
import { listboxPopover } from '@/theme/fieldStyles';
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
  action,
  isFiltered = false,
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
  /**
   * A control for the far end of the row — the Tasks page's "add".
   *
   * Here rather than anywhere else on the card because this row *is* the top of
   * the section: it is the first thing in the box, and its right edge is the
   * section's top right corner. A button placed anywhere else would need a
   * header row of its own over a card that has never had one.
   */
  action?: ReactNode;
  /**
   * Whether anything behind the "Filtrar por" button is actually narrowing the
   * list — a sector, a person, or the day picked on the month above.
   *
   * The button says so in the brand green, set bold, glyph and all. Three of the
   * four filters live inside a popover and the fourth is a press on a calendar
   * in another card entirely, so without this the only way to tell a filtered
   * list from a short one is to open the popover and look.
   */
  isFiltered?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SearchField value={search} onChange={onSearchChange} className="w-full max-w-xs" />

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
          {/* The ink and nothing else: the button keeps its outline and its white
              ground either way, so the row does not change shape when a filter
              goes on — what changes is that its label is written in green and a
              step heavier. --green-deep rather than --green, which is a fill
              colour and barely legible as words on a light surface. */}
          <Button
            variant="outline"
            className={`rounded-full ${isFiltered ? 'font-semibold text-green-deep' : ''}`}
          >
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
                  placeholder="Todos os responsáveis"
                  value={assigneeId ?? null}
                  onChange={(key) => onAssigneeChange(key ? String(key) : undefined)}
                >
                  <Label>{strings.task.fields.assignees}</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover {...listboxPopover}>
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

        {action}
      </div>
    </div>
  );
}
