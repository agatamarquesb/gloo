import { useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, Pencil, Tag } from 'lucide-react';
import { Button, Input, Label, Popover } from '@heroui/react';
import { TextField } from 'react-aria-components';

import { DEFAULT_LABEL_COLOR, type LabelDto, type LabelScope, type PaletteColor } from '@gloo/shared';

import { AppCheckbox } from '@/components/common/AppCheckbox';
import { ColorPicker } from '@/components/common/ColorPicker';
import { SearchField } from '@/components/common/SearchField';
import { useCreateLabel, useDeleteLabel, useLabels, useUpdateLabel } from '@/hooks/queries/labels';
import { colorFill } from '@/theme/labelColors';
import { actionPill } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

/** The popover is either browsing labels or editing one — never both. */
type View = { kind: 'list' } | { kind: 'edit'; label: LabelDto | null };

function LabelEditor({
  label,
  scope,
  onDone,
  onBack,
}: {
  /** Null when creating. */
  label: LabelDto | null;
  /** Which pool a new one is created in — see LabelScope. */
  scope: LabelScope;
  onDone: () => void;
  onBack: () => void;
}) {
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const deleteLabel = useDeleteLabel();

  const [name, setName] = useState(label?.name ?? '');
  const [color, setColor] = useState<PaletteColor>(label?.color ?? DEFAULT_LABEL_COLOR);

  const isPending = createLabel.isPending || updateLabel.isPending || deleteLabel.isPending;
  const trimmed = name.trim();

  function handleSave() {
    const options = { onSuccess: onDone };
    if (label) updateLabel.mutate({ id: label.id, name: trimmed, color }, options);
    else createLabel.mutate({ name: trimmed, color, scope }, options);
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
        <span {...colorFill(color, 'rounded-lg px-3 py-1.5 text-sm text-black')}>
          {trimmed || strings.label.namePlaceholder}
        </span>
      </div>

      <TextField value={name} onChange={setName} className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-foreground">{strings.label.nameLabel}</Label>
        <Input fullWidth placeholder={strings.label.namePlaceholder} />
      </TextField>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">{strings.label.colorLabel}</span>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      {/* Salvar ends the row, where the button that commits a dialog always is;
          destroying the label is the other thing you can do from here and sits
          to its left, named in full so it cannot be mistaken for "discard". */}
      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        {label ? (
          <Button
            variant="danger-soft"
            isDisabled={isPending}
            onPress={() => deleteLabel.mutate(label.id, { onSuccess: onDone })}
          >
            {strings.label.remove}
          </Button>
        ) : null}
        <Button isDisabled={!trimmed || isPending} onPress={handleSave}>
          {strings.common.save}
        </Button>
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
  scope,
  trigger,
  startOn,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /**
   * Whose tags these are. A routine's and a task's are separate vocabularies —
   * this picker lists one of them and creates into it, and never sees the other.
   */
  scope: LabelScope;
  /**
   * What opens the picker. The routine modal's own pill by default; the task
   * modal passes an icon-only button, since its tags live above the title rather
   * than in a row of three labelled actions.
   *
   * Whatever is passed has to be a pressable element — HeroUI takes the
   * popover's first child as its trigger.
   */
  trigger?: ReactNode;
  /**
   * Which panel it opens on. The list, normally — but a tag in the task modal
   * opens straight into its own editor, because pressing the thing you want to
   * change should not first show you a list of everything else.
   */
  startOn?: View;
}) {
  const { data: labels = [] } = useLabels(scope);
  const [view, setView] = useState<View>(startOn ?? { kind: 'list' });
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
      // Back to where it opens from whenever the popover closes, so it never
      // reopens mid-edit on a label the user has moved on from.
      onOpenChange={(open) => !open && setView(startOn ?? { kind: 'list' })}
    >
      {trigger ?? (
        <Button variant="outline" size="sm" fullWidth className={actionPill}>
          <Tag className="size-4" />
          {strings.routine.labels}
        </Button>
      )}

      <Popover.Content className="w-72">
        <Popover.Dialog>
          {view.kind === 'edit' ? (
            <LabelEditor
              scope={scope}
              label={view.label}
              onDone={() => setView(startOn ?? { kind: 'list' })}
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
                        {...colorFill(
                          label.color,
                          'min-w-0 flex-1 truncate rounded-lg px-3 py-1.5 text-sm text-black',
                        )}
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
