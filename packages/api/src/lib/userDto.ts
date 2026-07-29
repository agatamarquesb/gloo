import type { UserDto } from '@gloo/shared';

/**
 * Prisma user → the shared DTO. Every route that returns a user goes through
 * here, so the public shape (notably: never the password hash) is defined once.
 */
export function toUserDto(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  jobTitle: string | null;
  avatarUrl: string | null;
}): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserDto['role'],
    jobTitle: user.jobTitle,
    avatarUrl: user.avatarUrl,
  };
}
