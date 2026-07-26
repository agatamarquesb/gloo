import type { UserDto } from '@gloo/shared';

/** Mirrors the backend's canMutate rule (packages/api/src/lib/authorize.ts) for UI affordances only — the server remains the source of truth. */
export function canMutateEntity(
  user: UserDto | undefined,
  entity: { createdById: string; assigneeIds: string[] },
): boolean {
  if (!user) return false;
  return (
    user.role === 'ADMIN' || entity.createdById === user.id || entity.assigneeIds.includes(user.id)
  );
}
