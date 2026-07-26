import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button, Modal } from '@heroui/react';

import { UserAvatar } from '@/components/common/UserAvatar';
import { useMe, useUploadAvatar } from '@/hooks/queries/auth';
import { strings } from '@/strings/pt-BR';

export function ProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: me } = useMe();
  const uploadAvatar = useUploadAvatar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    uploadAvatar.mutate(file, {
      onError: (err) => setError(err instanceof Error ? err.message : strings.profile.uploadError),
    });
    // Reset so picking the same file again still fires a change event.
    event.target.value = '';
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-sm">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{strings.profile.title}</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="flex flex-col items-center gap-4">
            {me ? <UserAvatar name={me.name} avatarUrl={me.avatarUrl} size="lg" /> : null}
            <div className="text-center">
              <p className="font-medium text-foreground">{me?.name}</p>
              <p className="text-sm text-muted">{me?.email}</p>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              variant="secondary"
              isDisabled={uploadAvatar.isPending}
              onPress={() => inputRef.current?.click()}
            >
              <Upload className="size-4" />
              {uploadAvatar.isPending ? strings.profile.uploading : strings.profile.changePhoto}
            </Button>

            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <p className="text-center text-xs text-muted">{strings.profile.hint}</p>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
