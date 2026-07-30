import { useRef, useState, type FormEvent } from 'react';
import { Download, Eye, FileText, Globe, Paperclip, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Button, Input, Label, Modal } from '@heroui/react';
import { TextField } from 'react-aria-components';

import { AttachmentKind, type AttachmentDto } from '@gloo/shared';

import { useUploadFile } from '@/hooks/queries/uploads';
import { assetUrl } from '@/lib/assetUrl';
import { playSound } from '@/lib/sounds';
import { BUTTON_LIKE_FIELD, FLAT_INPUT } from '@/theme/fieldStyles';
import {
  blockBox,
  blockBoxBare,
  blockLeadColumn,
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
  onDelete,
  isEditing,
  canOpen = true,
}: {
  attachments: AttachmentDto[];
  onChange: (attachments: AttachmentDto[]) => void;
  onDelete: () => void;
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
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = attachments.find((attachment) => attachment.id === editingId) ?? null;

  function add(attachment: AttachmentDto) {
    onChange([...attachments, attachment]);
  }

  // A form, so Enter in the field adds the link exactly like pressing "+".
  function addLink(event: FormEvent) {
    event.preventDefault();
    const url = linkDraft.trim();
    if (!url) return;
    add({
      id: crypto.randomUUID(),
      kind: AttachmentKind.LINK,
      url,
      title: titleFromUrl(url),
    });
    setLinkDraft('');
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    uploadFile.mutate(file, {
      onSuccess: ({ url, filename }) =>
        add({ id: crypto.randomUUID(), kind: AttachmentKind.FILE, url, title: filename }),
    });
  }

  return (
    // No gap of its own: the block's default is what sets the distance from a
    // heading to what it heads, and Notas, the checklists and this one all have
    // to sit at the same one.
    <section className={isEditing ? blockBox : blockBoxBare}>
      <div className="flex items-center gap-2">
        {/* The shared column, so this heading starts exactly where Notas' and a
            checklist's titles do. */}
        <span className={blockLeadColumn}>
          <Paperclip className="size-4 text-foreground" aria-hidden />
        </span>
        <span className={`flex-1 text-foreground ${blockTitle(isEditing)}`}>
          {strings.attachment.title}
        </span>
        {isEditing ? (
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="shrink-0 text-muted"
            aria-label={strings.common.delete}
            onPress={() => {
              playSound('delete');
              onDelete();
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>

      {/* Paste a link, or pick a file — the two ways in, side by side and the
          same height. The add button lives inside the field rather than beside
          it, so the row reads as two controls, not three. Both are ways of
          adding, so the whole row belongs to edit mode. */}
      {isEditing ? (
        <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={addLink} className="relative min-w-40 flex-1">
          <TextField
            aria-label={strings.attachment.linkPlaceholder}
            value={linkDraft}
            onChange={setLinkDraft}
          >
            <Input fullWidth className={LINK_FIELD} placeholder={strings.attachment.linkPlaceholder} />
          </TextField>

          <Button
            type="submit"
            isIconOnly
            size="sm"
            variant="ghost"
            className="absolute top-1/2 right-1 -translate-y-1/2 rounded-full text-muted"
            aria-label={strings.attachment.addLink}
            isDisabled={!linkDraft.trim()}
          >
            <Plus className="size-4" />
          </Button>
        </form>

        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} />
        <Button
          size="sm"
          variant="outline"
          className={`${CONTROL_HEIGHT} rounded-full ${outlineControl}`}
          isDisabled={uploadFile.isPending}
          onPress={() => fileInputRef.current?.click()}
        >
          <Upload className="size-4" />
          {uploadFile.isPending ? strings.attachment.uploading : strings.attachment.chooseFile}
        </Button>
      </div>
      ) : null}

      {attachments.length === 0 ? (
        <p className="text-xs text-muted">{strings.attachment.empty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {attachments.map((attachment) => {
            const Icon = ICON_BY_KIND[attachment.kind];
            return (
              // No fill on the row itself — the icon's green tile is what marks
              // it, the same way a status chip carries the color on a task row.
              // gap-3 rather than the gap-2 elsewhere: the tile overhangs its
              // column by a couple of pixels either side, which eats into the
              // gap. The extra puts the visible distance from tile to title back
              // on a par with a checklist's checkbox to its item.
              <li key={attachment.id} className="flex items-center gap-3">
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
