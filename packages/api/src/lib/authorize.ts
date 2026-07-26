import type { AuthUser } from '../plugins/auth';

/**
 * Shared admin-or-creator-or-assignee rule for mutating tasks/subtasks/routines.
 * A non-admin who created an entity keeps edit/delete rights on it even if they
 * didn't assign themselves; a non-admin assignee also gets edit/delete rights,
 * not just status changes.
 */
export function canMutate(
  user: AuthUser,
  entity: { createdById: string; assigneeIds: string[] },
): boolean {
  return (
    user.role === 'ADMIN' ||
    entity.createdById === user.id ||
    entity.assigneeIds.includes(user.id)
  );
}
