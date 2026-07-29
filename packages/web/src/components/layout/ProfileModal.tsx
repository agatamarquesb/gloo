import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button, Input, Label, Modal } from '@heroui/react';
import { TextField } from 'react-aria-components';

import type { UserDto } from '@gloo/shared';

import { ImageCropper } from '@/components/common/ImageCropper';
import { UserAvatar } from '@/components/common/UserAvatar';
import { useMe, useUpdateProfile, useUploadAvatar } from '@/hooks/queries/auth';
import { SecondaryButton } from '@/components/common/SecondaryButton';
import { strings } from '@/strings/pt-BR';

/**
 * Edits are staged locally and committed together by Save, rather than each
 * control writing on change: picking a photo shows a local preview and nothing
 * leaves the browser until the user confirms, so closing the modal discards the
 * draft instead of half-applying it.
 */
function ProfileForm({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const uploadAvatar = useUploadAvatar();
  const updateProfile = useUpdateProfile();
  const inputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user.name);
  const [jobTitle, setJobTitle] = useState(user.jobTitle ?? '');
  const [file, setFile] = useState<File | null>(null);
  /** The just-picked file, held while it is being cropped and before it is staged. */
  const [cropping, setCropping] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const trimmedName = name.trim();
  const trimmedJobTitle = jobTitle.trim();
  const hasFieldChanges =
    trimmedName !== user.name || trimmedJobTitle !== (user.jobTitle ?? '');
  // An empty name blocks saving outright rather than only being skipped: the
  // server rejects it, and letting Save through with a photo attached would
  // upload the photo and then surface an error for the name. An empty job title
  // is fine — it clears the field.
  const isDirty = trimmedName !== '' && (file !== null || hasFieldChanges);
  const isSaving = uploadAvatar.isPending || updateProfile.isPending;

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (selected) {
      setError(null);
      // Straight into the cropper: the staged file is always a finished 1:1
      // crop, so the preview and what gets uploaded can never disagree.
      setCropping(selected);
    }
    // Reset so picking the same file again still fires a change event.
    event.target.value = '';
  }

  async function handleSave() {
    setError(null);
    try {
      // Sequential, not parallel: both endpoints return the full user, and
      // racing them would let the earlier response overwrite the later one.
      if (file) await uploadAvatar.mutateAsync(file);
      if (hasFieldChanges) {
        await updateProfile.mutateAsync({
          name: trimmedName,
          jobTitle: trimmedJobTitle || null,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : strings.profile.saveError);
    }
  }

  return (
    <Modal.Dialog className="sm:max-w-sm">
      <Modal.CloseTrigger />
      <Modal.Header>
        <Modal.Heading>{strings.profile.title}</Modal.Heading>
      </Modal.Header>

      {/* Cropping takes over the whole dialog rather than sitting alongside the
          fields: it needs the width, and the profile's own Save must not be
          reachable while the photo is still an unfinished crop. */}
      {cropping ? (
        <Modal.Body>
          <ImageCropper
            file={cropping}
            onCancel={() => setCropping(null)}
            onConfirm={(cropped) => {
              setFile(cropped);
              setCropping(null);
            }}
          />
        </Modal.Body>
      ) : (
        <>
          <Modal.Body className="flex flex-col items-center gap-4">
            <UserAvatar
              name={trimmedName || user.name}
              avatarUrl={preview ?? user.avatarUrl}
              size="lg"
            />

            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              variant="secondary"
              isDisabled={isSaving}
              onPress={() => inputRef.current?.click()}
            >
              <Upload className="size-4" />
              {strings.profile.changePhoto}
            </Button>
            <p className="text-center text-xs text-muted">{strings.profile.hint}</p>

            <TextField
              value={name}
              onChange={setName}
              isDisabled={isSaving}
              className="flex w-full flex-col gap-1.5"
            >
              <Label className="text-sm font-medium text-foreground">
                {strings.profile.nameLabel}
              </Label>
              <Input fullWidth />
            </TextField>

            {/* The display label under the user's name, not the ADMIN/EMPLOYEE
                permission role — that one is a DB-only change and is not
                editable from here. */}
            <TextField
              value={jobTitle}
              onChange={setJobTitle}
              isDisabled={isSaving}
              className="flex w-full flex-col gap-1.5"
            >
              <Label className="text-sm font-medium text-foreground">
                {strings.profile.jobTitleLabel}
              </Label>
              <Input fullWidth placeholder={strings.profile.jobTitlePlaceholder} />
            </TextField>

            <p className="text-sm text-muted">{user.email}</p>

            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </Modal.Body>

          <Modal.Footer className="justify-end gap-2">
            <SecondaryButton isDisabled={isSaving} onPress={onClose}>
              {strings.common.cancel}
            </SecondaryButton>
            <Button isDisabled={!isDirty || isSaving} onPress={handleSave}>
              {isSaving ? strings.profile.saving : strings.common.save}
            </Button>
          </Modal.Footer>
        </>
      )}
    </Modal.Dialog>
  );
}

export function ProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: me } = useMe();

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        {me ? (
          // Keyed on the open state so each opening remounts the form: a draft
          // abandoned by closing the modal never survives into the next visit.
          <ProfileForm key={isOpen ? 'open' : 'closed'} user={me} onClose={onClose} />
        ) : null}
      </Modal.Container>
    </Modal.Backdrop>
  );
}
