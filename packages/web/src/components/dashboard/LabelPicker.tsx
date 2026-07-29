import { useMemo, useState } from 'react';
import { ChevronLeft, Pencil, Tag } from 'lucide-react';
import { Button, Input, Label, Popover } from '@heroui/react';
import { TextField } from 'react-aria-components';

import {
  DEFAULT_LABEL_COLOR,
  LABEL_COLORS,
  type LabelColor,
  type LabelDto,
} from '@gloo/shared';

import { AppCheckbox } from '@/components/common/AppCheckbox';
import { SearchField } from '@/components/common/SearchField';
import { useCreateLabel, useDeleteLabel, useLabels, useUpdateLabel } from '@/hooks/queries/labels';
import { LABEL_BG_CLASS } from '@/theme/labelColors';
import { actionPill } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

/** The popover is either browsing labels or editing one — never both. */
type View = { kind: 'list' } | { kind: 'edit'; label: LabelDto | null };

function ColorGrid({
  value,
  onChange,
}: {
  value: LabelColor;
  onChange: (color: LabelColor) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {LABEL_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={color}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
          className={`h-8 rounded-lg transition-transform hover:scale-105 ${LABEL_BG_CLASS[color]} ${
            value === color ? 'ring-2 ring-foreground ring-offset-2 ring-offset-surface' : ''
          }`}
        />
      ))}
    </div>
  );
}

function LabelEditor({
  label,
  onDone,
  onBack,
}: {
  /** Null when creating. */
  label: LabelDto | null;
  onDone: () => void;
  onBack: () => void;
}) {
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const deleteLabel = useDeleteLabel();

  const [name, setName] = useState(label?.name ?? '');
  const [color, setColor] = useState<LabelColor>(label?.color ?? DEFAULT_LABEL_COLOR);

  const isPending = createLabel.isPending || updateLabel.isPending || deleteLabel.isPending;
  const trimmed = name.trim();

  function handleSave() {
    const input = { name: trimmed, color };
    const options = { onSuccess: onDone };
    if (label) updateLabel.mutate({ id: label.id, ...input }, options);
    else createLabel.mutate(input, options);
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <Button isIconOnly size="sm" variant="ghost" aria-label={strings.label.back} onPress={onBack}>
          <ChevronLeft className="size-4" />
        </Button>
        <h3 className="flex-1 text-center text-sm font-semibold text-foreground">
          {label ? strings.label.editHeading : strings.label.createHeading}
        </h3>
        {/* Balances the back button so the heading stays optically centred. */}
        <span className="size-8" aria-hidden />
      </header>

      {/* Live preview of what the pill will look like. */}
      <div className="flex justify-center rounded-xl bg-default p-3">
        <span
          className={`rounded-lg px-3 py-1.5 text-sm text-black ${LABEL_BG_CLASS[color]}`}
        >
          {trimmed || strings.label.namePlaceholder}
        </span>
      </div>

      <TextField value={name} onChange={setName} className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-foreground">{strings.label.nameLabel}</Label>
        <Input fullWidth placeholder={strings.label.namePlaceholder} />
      </TextField>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">{strings.label.colorLabel}</span>
        <ColorGrid value={color} onChange={setColor} />
      </div>

      <div className="flex justify-between gap-2 border-t border-border pt-3">
        <Button isDisabled={!trimmed || isPending} onPress={handleSave}>
          {strings.common.save}
        </Button>
        {label ? (
          <Button
            variant="danger-soft"
            isDisabled={isPending}
            onPress={() => deleteLabel.mutate(label.id, { onSuccess: onDone })}
          >
            {strings.common.delete}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Attaches labels to the routine being edited, and doubles as the place labels
 * are created and edited. Labels are shared across routines, so creating one
 * here makes it available everywhere — and editing or deleting one changes it
 * on every routine wearing it.
 *
 * Selection is local to the modal's form (`selectedIds`), while the labels
 * themselves are server state — the two are deliberately separate: ticking a
 * label saves with the routine, editing one saves immediately.
 */
export function LabelPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: labels = [] } = useLabels();
  const [view, setView] = useState<View>({ kind: 'list' });
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? labels.filter((label) => label.name.toLowerCase().includes(term)) : labels;
  }, [labels, search]);

  function toggle(id: string, selected: boolean) {
    onChange(selected ? [...selectedIds, id] : selectedIds.filter((current) => current !== id));
  }

  return (
    <Popover
      // Reset to the list whenever the popover closes, so it never reopens
      // mid-edit on a label the user has moved on from.
      onOpenChange={(open) => !open && setView({ kind: 'list' })}
    >
      <Button variant="outline" size="sm" fullWidth className={actionPill}>
        <Tag className="size-4" />
        {strings.routine.labels}
      </Button>

      <Popover.Content className="w-72">
        <Popover.Dialog>
          {view.kind === 'edit' ? (
            <LabelEditor
              label={view.label}
              onDone={() => setView({ kind: 'list' })}
              onBack={() => setView({ kind: 'list' })}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <h3 className="text-center text-sm font-semibold text-foreground">
                {strings.label.title}
              </h3>

              <SearchField
                value={search}
                onChange={setSearch}
                placeholder={strings.label.search}
              />

              {visible.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">{strings.label.empty}</p>
              ) : (
                <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                  {visible.map((label) => (
                    <li key={label.id} className="flex items-center gap-2">
                      <AppCheckbox
                        isSelected={selectedIds.includes(label.id)}
                        onChange={(selected) => toggle(label.id, selected)}
                      >
                        <span className="sr-only">{label.name}</span>
                      </AppCheckbox>

                      <span
                        className={`min-w-0 flex-1 truncate rounded-lg px-3 py-1.5 text-sm text-black ${
                          LABEL_BG_CLASS[label.color]
                        }`}
                      >
                        {label.name}
                      </span>

                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        className="text-muted"
                        aria-label={strings.label.edit}
                        onPress={() => setView({ kind: 'edit', label })}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <Button
                variant="outline"
                fullWidth
                className="rounded-full"
                onPress={() => setView({ kind: 'edit', label: null })}
              >
                {strings.label.create}
              </Button>
            </div>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
