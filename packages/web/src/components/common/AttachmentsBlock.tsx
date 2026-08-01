import { useRef, useState, type FormEvent } from 'react';
import { Download, Eye, FileText, Globe, Paperclip, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Button, Input, Label, Modal, Popover } from '@heroui/react';
import { TextField } from 'react-aria-components';

import { AttachmentKind, type AttachmentDto } from '@gloo/shared';

import { useUploadFile } from '@/hooks/queries/uploads';
import { assetUrl } from '@/lib/assetUrl';
import { playSound } from '@/lib/sounds';
import { BUTTON_LIKE_FIELD, FLAT_INPUT } from '@/theme/fieldStyles';
import {
  blockBox,
  blockBoxBare,
  blockHeaderRow,
  blockLeadColumn,
  blockRow,
  blockRowList,
  blockTitle,
  outlineControl,
} from '@/theme/styleConstants';
import { SecondaryButton } from '@/components/common/SecondaryButton';
import { strings } from '@/strings/pt-BR';

const ICON_BY_KIND = {
  [AttachmentKind.LINK]: Globe,
  [AttachmentKind.FILE]: FileText,
};

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
}: {
  attachments: AttachmentDto[];
  onChange: (attachments: AttachmentDto[]) => void;
  /** Outside edit mode the list is still readable, and still links out. */
  isEditing: boolean;
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

  return (
    // No gap of its own: the block's default is what sets the distance from a
    // heading to what it heads, and Notas, the checklists and this one all have
    // to sit at the same one.
    <section className={isEditing ? blockBox : blockBoxBare}>
      <div className={blockHeaderRow}>
        {/* The shared column, so this heading starts exactly where Notas' and a
            checklist's titles do. */}
        <span className={blockLeadColumn}>
          <Paperclip className="size-4 text-foreground" aria-hidden />
        </span>
        <span className={`flex-1 text-foreground ${blockTitle(isEditing)}`}>
          {strings.attachment.title}
        </span>
        {/* One way in, opened from the heading: the two controls it holds —
            paste a link, pick a file — used to sit in the block itself, where
            they were the first thing you read about a task's files whether you
            were adding one or not. The block now shows what it has, and this
            asks for more. */}
        {isEditing ? (
          <Popover isOpen={isAdding} onOpenChange={setAdding}>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="shrink-0 text-muted"
              aria-label={strings.attachment.add}
            >
              <Plus className="size-4" />
            </Button>

            <Popover.Content className={ADD_PANEL} placement="bottom end">
              <Popover.Dialog className="flex flex-col gap-2 p-3">
                {/* A form, so Enter is the same as pressing Salvar — both add
                    the link and close the panel. */}
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
        ) : null}
      </div>

      {attachments.length === 0 ? (
        <p className="text-xs text-muted">{strings.attachment.empty}</p>
      ) : (
        <ul className={blockRowList}>
          {attachments.map((attachment) => {
            const Icon = ICON_BY_KIND[attachment.kind];
            return (
              // No fill on the row itself — the icon's green tile is what marks
              // it, the same way a status chip carries the color on a task row.
              // gap-3 rather than the gap-2 elsewhere: the tile overhangs its
              // column by a couple of pixels either side, which eats into the
              // gap. The extra puts the visible distance from tile to title back
              // on a par with a checklist's checkbox to its item.
              <li key={attachment.id} className={blockRow}>
                {/* Centred on the shared lead column rather than sized to it:
                    the tile is wider than the column and overhangs it evenly, so
                    it still sits under the Paperclip in the heading while every
                    row's title stays on the heading's own left edge. */}
                <span className={blockLeadColumn}>
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-md bg-green text-black"
                  >
                    <Icon className="size-4" />
                  </span>
                </span>
                {canOpen ? (
                  <a
                    href={assetUrl(attachment.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-sm text-foreground hover:underline"
                  >
                    {attachment.title}
                  </a>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {attachment.title}
                  </span>
                )}

                {isEditing ? (
                  <>
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
                  </>
                ) : canOpen ? (
                  /* Locked, an attachment is something you take away with you
                     rather than change: save it, or look at it without leaving
                     the routine — the preview opens in its own tab. Neither is
                     offered for a deleted routine. */
                  <>
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
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
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
