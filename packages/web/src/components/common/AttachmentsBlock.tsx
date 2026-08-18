import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Download, Eye, FileText, Globe, Paperclip, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { Button, Input, Label, Modal, Popover } from '@heroui/react';
// react-aria's own Button for the compact "+", not a plain `<button>`: HeroUI's
// Popover is a react-aria DialogTrigger, which hands its press handling down
// through a PressResponder that only a pressable component picks up. A bare DOM
// button receives nothing at all and the panel never opens.
import { Button as AriaButton, TextField } from 'react-aria-components';

import { AttachmentKind, type AttachmentDto } from '@gloo/shared';

import { useUploadFile } from '@/hooks/queries/uploads';
import { assetUrl } from '@/lib/assetUrl';
import { playSound } from '@/lib/sounds';
import { BUTTON_LIKE_FIELD, FLAT_INPUT } from '@/theme/fieldStyles';
import {
  blockActionCluster,
  blockBox,
  blockHeaderRow,
  blockHeadingLead,
  blockLeadColumn,
  blockRow,
  blockRowList,
  blockRowAction,
  blockRowActionOnHover,
  blockTitle,
  outlineControl,
  taskBlockBox,
  taskAttachmentRow,
  taskBlockRowTitle,
} from '@/theme/styleConstants';
import { SectionScroll } from '@/components/common/SectionScroll';
import { SecondaryButton } from '@/components/common/SecondaryButton';
import { strings } from '@/strings/pt-BR';

const ICON_BY_KIND = {
  [AttachmentKind.LINK]: Globe,
  [AttachmentKind.FILE]: FileText,
};

/**
 * A file's name: wrapped in the task dialog, cut in the routine's. Nothing in
 * the task dialog scrolls sideways, so the name that does not fit takes a second
 * line instead of an ellipsis.
 */
const TITLE_WRAP = (compact: boolean) => (compact ? 'break-words' : 'truncate');

/** Shared height, so the link field and the file button line up exactly. */
const CONTROL_HEIGHT = 'h-9';

/**
 * The panel the "+" opens: the app's field-panel geometry — 8px corners, a
 * hairline — but with all four corners kept, since it hangs from a button rather
 * than joining a field below it.
 */
const ADD_PANEL = 'w-64 rounded-[8px] border border-border/50';

/**
 * The link field is styled as the twin of the "choose file" button beside it:
 * outlined pill, no fill.
 */
const LINK_FIELD = `${FLAT_INPUT} ${BUTTON_LIKE_FIELD} ${CONTROL_HEIGHT} rounded-full pr-10 [--field-radius:9999px]`;

/**
 * Saves an attachment to disk rather than navigating to it.
 *
 * The `download` attribute is silently ignored on a cross-origin href — the
 * browser navigates instead — and uploads are served by the API, which is a
 * different origin from the web app. So the bytes are fetched and handed to the
 * anchor as a same-origin blob. The API sends CORS headers for this origin, but
 * an arbitrary pasted link need not, hence the fall back to simply opening it.
 */
async function downloadAttachment(attachment: AttachmentDto) {
  const href = assetUrl(attachment.url);
  if (!href) return;

  try {
    const response = await fetch(href);
    if (!response.ok) throw new Error(String(response.status));

    const objectUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = attachment.title;
    anchor.click();
    // Not immediately: revoking in the same tick can cut the download off
    // before the browser has read the blob.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  } catch {
    window.open(href, '_blank', 'noreferrer');
  }
}

/** Falls back to the host so a pasted URL gets a readable name, not the full href. */
function titleFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function AttachmentEditor({
  attachment,
  onClose,
  onSave,
}: {
  attachment: AttachmentDto;
  onClose: () => void;
  onSave: (attachment: AttachmentDto) => void;
}) {
  const uploadFile = useUploadFile();
  const inputRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState(attachment);
  const isLink = draft.kind === AttachmentKind.LINK;

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    uploadFile.mutate(file, {
      onSuccess: ({ url, filename }) =>
        setDraft((current) => ({
          ...current,
          kind: AttachmentKind.FILE,
          url,
          // Keep a title the user already chose; only adopt the filename when
          // the field is still showing the previous default.
          title: current.title && current.title !== titleFromUrl(current.url) ? current.title : filename,
        })),
    });
  }

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-sm">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{strings.attachment.editHeading}</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="flex flex-col gap-4">
            <TextField
              value={draft.title}
              onChange={(title) => setDraft({ ...draft, title })}
              className="flex flex-col gap-1.5"
            >
              <Label className="text-sm font-medium text-foreground">
                {strings.attachment.titleLabel}
              </Label>
              <Input fullWidth placeholder={strings.attachment.titlePlaceholder} />
            </TextField>

            {isLink ? (
              <TextField
                value={draft.url}
                onChange={(url) => setDraft({ ...draft, url })}
                className="flex flex-col gap-1.5"
              >
                <Label className="text-sm font-medium text-foreground">
                  {strings.attachment.urlLabel}
                </Label>
                <Input fullWidth placeholder={strings.attachment.linkPlaceholder} />
              </TextField>
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  {strings.attachment.replaceFile}
                </span>
                <p className="truncate text-xs text-muted">{draft.url}</p>
                <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
                <Button
                  variant="secondary"
                  isDisabled={uploadFile.isPending}
                  onPress={() => inputRef.current?.click()}
                >
                  <Upload className="size-4" />
                  {uploadFile.isPending
                    ? strings.attachment.uploading
                    : strings.attachment.replaceFile}
                </Button>
              </div>
            )}
          </Modal.Body>

          <Modal.Footer className="justify-end gap-2">
            <SecondaryButton onPress={onClose}>
              {strings.common.cancel}
            </SecondaryButton>
            <Button
              isDisabled={!draft.url.trim() || uploadFile.isPending}
              onPress={() => onSave({ ...draft, title: draft.title.trim() || titleFromUrl(draft.url) })}
            >
              {strings.common.save}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/**
 * The list of files, plain in a routine and a scroll area in the task dialog.
 *
 * The `<ul>` is the same either way — the rows are list items and have to stay
 * ones — so the scroller is a wrapper around it rather than a different element
 * in its place.
 */
function ListScroller({ compact, children }: { compact: boolean; children: ReactNode }) {
  const list = <ul className={blockRowList}>{children}</ul>;
  if (!compact) return list;

  return <SectionScroll>{list}</SectionScroll>;
}

/**
 * The attachments a routine or a task carries: pasted links and uploaded files
 * in one list. Files upload immediately (they need a URL before they can be
 * listed), but the list itself is form state and only persists with the owning
 * entity's Save.
 */
export function AttachmentsBlock({
  attachments,
  onChange,
  isEditing,
  canOpen = true,
  compact = false,
}: {
  attachments: AttachmentDto[];
  onChange: (attachments: AttachmentDto[]) => void;
  /** Outside edit mode the list is still readable, and still links out. */
  isEditing: boolean;
  /**
   * The block as one quadrant of the task dialog rather than the last section of
   * a routine.
   *
   * Three things follow. The paperclip goes — a routine's three block headings
   * share a left edge and that icon is what marks the column; a task's Anexos has
   * nothing beside it, and with the icon gone the file tiles start on the
   * heading's own edge instead of overhanging it. The gap under the heading
   * halves, since the dialog's sections close up against their titles. And the
   * list fills the height it is given and scrolls inside it, because the dialog
   * itself does not scroll.
   */
  compact?: boolean;
  /**
   * Whether the files can be reached at all — false for a deleted routine, whose
   * attachments are on their way out with it. The list still shows what it had,
   * as plain names rather than links.
   */
  canOpen?: boolean;
}) {
  const uploadFile = useUploadFile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkDraft, setLinkDraft] = useState('');
  /** Whether the add panel is open — closed by adding, from either control. */
  const [isAdding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = attachments.find((attachment) => attachment.id === editingId) ?? null;

  function add(attachment: AttachmentDto) {
    onChange([...attachments, attachment]);
  }

  /** Enter in the field and Salvar are the same act — hence the optional event. */
  function addLink(event?: FormEvent) {
    event?.preventDefault();
    const url = linkDraft.trim();
    if (!url) return;
    add({
      id: crypto.randomUUID(),
      kind: AttachmentKind.LINK,
      url,
      title: titleFromUrl(url),
    });
    setLinkDraft('');
    setAdding(false);
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    uploadFile.mutate(file, {
      onSuccess: ({ url, filename }) => {
        add({ id: crypto.randomUUID(), kind: AttachmentKind.FILE, url, title: filename });
        setAdding(false);
      },
    });
  }

  /**
   * One way in: the two controls it holds — paste a link, pick a file — used to
   * sit in the block itself, where they were the first thing you read about a
   * task's files whether you were adding one or not. The block now shows what it
   * has, and this asks for more.
   *
   * In the routine modal it opens from the heading; in the task dialog it ends
   * the list, under the last file — see ListScroller.
   */
  const addControl = isEditing ? (
    <Popover isOpen={isAdding} onOpenChange={setAdding}>
      {compact ? (
        // The bare glyph on the heading's right end, which is where the rule
        // above this block ends — see blockRowAction. AriaButton rather than a
        // plain one so the trigger is actually pressable; see the import.
        <AriaButton className={blockRowAction} aria-label={strings.attachment.add}>
          <Plus className="size-4" />
        </AriaButton>
      ) : (
        <Button isIconOnly size="sm" variant="ghost" className="shrink-0 text-muted" aria-label={strings.attachment.add}>
          <Plus className="size-4" />
        </Button>
      )}

      <Popover.Content className={ADD_PANEL} placement="bottom end">
        <Popover.Dialog className="flex flex-col gap-2 p-3">
          {/* A form, so Enter is the same as pressing Salvar — both add the
              link and close the panel. */}
          <form onSubmit={addLink}>
            <TextField
              aria-label={strings.attachment.linkPlaceholder}
              value={linkDraft}
              onChange={setLinkDraft}
            >
              <Input
                fullWidth
                className={LINK_FIELD}
                placeholder={strings.attachment.linkPlaceholder}
              />
            </TextField>
          </form>

          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} />
          <Button
            size="sm"
            variant="outline"
            className={`${CONTROL_HEIGHT} w-full rounded-full ${outlineControl}`}
            isDisabled={uploadFile.isPending}
            onPress={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" />
            {uploadFile.isPending ? strings.attachment.uploading : strings.attachment.chooseFile}
          </Button>

          <Button
            size="sm"
            className={`${CONTROL_HEIGHT} w-full rounded-full`}
            isDisabled={!linkDraft.trim()}
            onPress={() => addLink()}
          >
            {strings.common.save}
          </Button>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  ) : null;

  return (
    // No gap of its own: the block's default is what sets the distance from a
    // heading to what it heads, and Notas, the checklists and this one all have
    // to sit at the same one.
    <section
      className={`${compact ? taskBlockBox('gap-1.5') : blockBox} ${
        compact ? 'h-full min-h-0' : ''
      }`}
    >
      <div className={`${blockHeaderRow} ${compact ? 'shrink-0' : ''}`}>
        {/* The shared column, so this heading starts exactly where Notas' and a
            checklist's titles do. Dropped in the task modal — see `compact`. */}
        {compact ? null : (
          <span className={blockHeadingLead}>
            <Paperclip className="size-4 text-foreground" aria-hidden />
          </span>
        )}
        <span className={`flex-1 text-foreground ${blockTitle(isEditing, compact)}`}>
          {strings.attachment.title}
        </span>
        {addControl}
      </div>

      {attachments.length === 0 ? (
        // Compact — the task dialog, where the block is a quadrant with a height
        // of its own — the line takes that whole height and sits in the middle
        // of it, level with the same sentence in the note beside it. In the
        // routine modal the blocks are stacked and have no spare height, so it
        // stays where it was.
        <p
          className={`text-xs text-muted ${
            compact ? 'flex flex-1 items-center justify-center text-center' : ''
          }`}
        >
          {strings.attachment.empty}
        </p>
      ) : (
        // Compact, the list is the part of the block that moves: it takes the
        // height left under the heading and scrolls inside it, softening
        // whichever edge has more past it — see SectionScroll.
        <ListScroller compact={compact}>
          {attachments.map((attachment) => {
            const Icon = ICON_BY_KIND[attachment.kind];
            return (
              // No fill on the row itself — the icon's green tile is what marks
              // it, the same way a status chip carries the color on a task row.
              // gap-3 rather than the gap-2 elsewhere: the tile overhangs its
              // column by a couple of pixels either side, which eats into the
              // gap. The extra puts the visible distance from tile to title back
              // on a par with a checklist's checkbox to its item.
              <li key={attachment.id} className={compact ? taskAttachmentRow : blockRow}>
                {/* The pencil leads the row in the task dialog, on the tile's
                    left: it acts on the file rather than on the list, and at the
                    far end it was one of three glyphs competing for the row's
                    right edge. */}
                {compact && isEditing ? (
                  <button
                    type="button"
                    className={blockRowAction}
                    aria-label={strings.attachment.edit}
                    onClick={() => setEditingId(attachment.id)}
                  >
                    <Pencil className="size-4" />
                  </button>
                ) : null}
                {/* In the shared lead column, which is the tile's own 28px wide
                    (see blockLeadColumn): the tile sits under the Paperclip in
                    the heading, every row's title starts on the heading's own
                    left edge, and nothing hangs out past the section on either
                    side — which it did while the column was 20.

                    Compact, there is no Paperclip to sit under and no column to
                    centre on, so the tile simply starts on the block's own left
                    edge — level with the word "Anexos" above it. */}
                {compact ? (
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-md bg-green text-black"
                  >
                    <Icon className="size-4" />
                  </span>
                ) : (
                  <span className={blockLeadColumn}>
                    <span
                      aria-hidden
                      className="flex size-7 shrink-0 items-center justify-center rounded-md bg-green text-black"
                    >
                      <Icon className="size-4" />
                    </span>
                  </span>
                )}
                {/* Wrapped in the task dialog, cut in the routine's: nothing in
                    that dialog scrolls sideways, so a long name comes down onto
                    a second line. Either way its middle sits on the tile's —
                    the row centres them (see taskAttachmentRow) and the name is
                    a box at least as tall as the tile (taskBlockRowTitle), so
                    one line and three both come out on the same axis. */}
                {canOpen ? (
                  <a
                    href={assetUrl(attachment.url)}
                    target="_blank"
                    rel="noreferrer"
                    className={`min-w-0 flex-1 text-sm font-medium text-foreground hover:underline ${TITLE_WRAP(compact)} ${
                      compact ? taskBlockRowTitle : ''
                    }`}
                  >
                    {attachment.title}
                  </a>
                ) : (
                  <span
                    className={`min-w-0 flex-1 text-sm font-medium text-foreground ${TITLE_WRAP(compact)} ${
                      compact ? taskBlockRowTitle : ''
                    }`}
                  >
                    {attachment.title}
                  </span>
                )}

                {/* Editing, all that is left on this end is the ×: the pencil
                    moved to the head of the row. In the task dialog it is the
                    bare glyph, on the block's own right edge and only while the
                    row is under the cursor; the routine keeps its pair of
                    buttons, which `contents` leaves exactly as they were. */}
                {isEditing ? (
                  compact ? (
                    <button
                      type="button"
                      className={`${blockRowAction} ${blockRowActionOnHover}`}
                      aria-label={strings.attachment.remove}
                      onClick={() => {
                        playSound('delete');
                        onChange(attachments.filter((current) => current.id !== attachment.id));
                      }}
                    >
                      <X className="size-4" />
                    </button>
                  ) : (
                    <span className="contents">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-muted"
                        aria-label={strings.attachment.edit}
                        onPress={() => setEditingId(attachment.id)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-muted"
                        aria-label={strings.attachment.remove}
                        onPress={() => {
                          playSound('delete');
                          onChange(attachments.filter((current) => current.id !== attachment.id));
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </span>
                  )
                ) : canOpen ? (
                  /* Locked, an attachment is something you take away with you
                     rather than change: save it, or look at it without leaving
                     the routine — the preview opens in its own tab. Neither is
                     offered for a deleted routine. */
                  compact ? (
                    /* Bare glyphs on the row's right edge, the same column the
                       × takes while editing. */
                    <span className={`${blockActionCluster} gap-2`}>
                      <button
                        type="button"
                        className={blockRowAction}
                        aria-label={strings.attachment.download}
                        onClick={() => void downloadAttachment(attachment)}
                      >
                        <Download className="size-4" />
                      </button>
                      <button
                        type="button"
                        className={blockRowAction}
                        aria-label={strings.attachment.preview}
                        onClick={() => window.open(assetUrl(attachment.url), '_blank', 'noreferrer')}
                      >
                        <Eye className="size-4" />
                      </button>
                    </span>
                  ) : (
                    <span className="contents">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-muted"
                        aria-label={strings.attachment.download}
                        onPress={() => void downloadAttachment(attachment)}
                      >
                        <Download className="size-4" />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-muted"
                        aria-label={strings.attachment.preview}
                        onPress={() =>
                          window.open(assetUrl(attachment.url), '_blank', 'noreferrer')
                        }
                      >
                        <Eye className="size-4" />
                      </Button>
                    </span>
                  )
                ) : null}
              </li>
            );
          })}
        </ListScroller>
      )}

      {editing ? (
        <AttachmentEditor
          attachment={editing}
          onClose={() => setEditingId(null)}
          onSave={(next) => {
            onChange(attachments.map((current) => (current.id === next.id ? next : current)));
            setEditingId(null);
          }}
        />
      ) : null}
    </section>
  );
}
