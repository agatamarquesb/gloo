import { useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, Pencil, Tag } from 'lucide-react';
import { Button, Popover } from '@heroui/react';

import { DEFAULT_LABEL_COLOR, type LabelDto, type LabelScope, type PaletteColor } from '@gloo/shared';

import { AppCheckbox } from '@/components/common/AppCheckbox';
import { ColorPicker } from '@/components/common/ColorPicker';
import { SearchField } from '@/components/common/SearchField';
import { useCreateLabel, useDeleteLabel, useLabels, useUpdateLabel } from '@/hooks/queries/labels';
import { FIELD_PANEL } from '@/theme/fieldStyles';
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
    // A fixed shape with one scrolling part in the middle: the colour section
    // grows by 200px the moment the mixer opens, and with the panel sizing
    // itself to its content that growth went straight out of the bottom of the
    // window — Salvar and Excluir with it. Now the panel stops at 70vh and the
    // colours scroll inside it, so the two buttons are always where they were.
    <div className="flex max-h-[70vh] flex-col gap-3">
      <header className="flex shrink-0 items-center gap-2">
        <Button isIconOnly size="sm" variant="ghost" aria-label={strings.label.back} onPress={onBack}>
          <ChevronLeft className="size-4" />
        </Button>
        <h3 className="flex-1 text-center text-sm font-semibold text-foreground">
          {label ? strings.label.editHeading : strings.label.createHeading}
        </h3>
        {/* Balances the back button so the heading stays optically centred. */}
        <span className="size-8" aria-hidden />
      </header>

      {/* The preview *is* the field: what the pill will look like, typed into
          directly. A separate "Título" input under it was a second copy of the
          same words, and the panel had no height to spend on saying anything
          twice.

          A bare input rather than HeroUI's: this one has to be the pill — the
          fill, the ink and the shape all come from the colour chosen below it —
          and every one of those is chrome the component brings with it.
          `field-sizing-content` makes it as wide as what is typed, so it reads as
          a tag rather than as a box across the panel. */}
      <div className="flex shrink-0 justify-center rounded-xl bg-default p-3">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label={strings.label.nameLabel}
          placeholder={strings.label.namePlaceholder}
          // The field is why this panel opened, so the caret belongs in it.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          {...colorFill(
            color,
            'field-sizing-content min-w-24 max-w-full rounded-lg border-0 px-3 py-1.5 text-center text-sm outline-none placeholder:text-current placeholder:opacity-50',
          )}
        />
      </div>

      {/* The colours, and the mixer when it is open — the one part of the panel
          whose height is not knowable. No "Selecionar uma cor" over it: the two
          sections inside name themselves. */}
      <div className="gloo-thin-scroll min-h-0 flex-1 overflow-y-auto pr-1">
        <ColorPicker value={color} onChange={setColor} />
      </div>

      {/* Salvar ends the row, where the button that commits a dialog always is;
          destroying the label is the other thing you can do from here and sits
          to its left, named in full so it cannot be mistaken for "discard". */}
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border pt-3">
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

      {/* From the trigger's left edge rather than centred on it: the trigger is
          a property row that starts on the value column's own line, and a panel
          centred under it stood half a panel to the left of everything else the
          column opens. */}
      <Popover.Content placement="bottom start" className={`w-72 ${FIELD_PANEL}`}>
        {/* The panel's height belongs to the dialog inside it, not to the
            popover: the mixer adds 200px when it opens, and with the height
            living out here the growth was clipped instead of scrolled — the hex
            row was cut in half. `overflow-visible` hands that job to the flex
            column below, which has a max of its own and a scrolling middle. */}
        <Popover.Dialog className="overflow-visible">
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
