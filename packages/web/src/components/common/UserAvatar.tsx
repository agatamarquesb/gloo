import { Avatar } from '@heroui/react';

import { assetUrl } from '@/lib/assetUrl';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts.at(-1)![0]}` : parts[0]?.slice(0, 2);
  return (initials ?? '').toUpperCase();
}

export function UserAvatar({
  name,
  avatarUrl,
  size = 'md',
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  /** Overrides the preset size where the avatar has to match a line of text. */
  className?: string;
}) {
  const src = assetUrl(avatarUrl);

  return (
    <Avatar size={size} className={className}>
      {src ? <Avatar.Image src={src} alt={name} /> : null}
      <Avatar.Fallback>{getInitials(name)}</Avatar.Fallback>
    </Avatar>
  );
}
