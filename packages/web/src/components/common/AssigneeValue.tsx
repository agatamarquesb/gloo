import { Plus } from 'lucide-react';

import type { UserDto } from '@gloo/shared';

import { UserAvatar } from '@/components/common/UserAvatar';
import { PROPERTY_VALUE } from '@/theme/propertyRow';
import { strings } from '@/strings/pt-BR';

/**
 * Who an entity belongs to, as the property row shows it — a task's Responsável
 * and a routine's.
 *
 * Shared because the two dialogs are the same object seen twice and this row was
 * the last one still drawn twice: the routine's printed a plain wrapping list of
 * faces and names, so a routine with two people looked like a different kind of
 * dialog from a task with two.
 *
 * One person reads as a name with their face beside it. More than one drops the
 * names and keeps the faces: two names in a cell this narrow wrap onto two
 * lines, and recognising a pair without reading them is what an avatar row is
 * for.
 */
export function AssigneeValue({ users, canAdd }: { users: UserDto[]; canAdd: boolean }) {
  if (users.length === 0) {
    return <span className={`${PROPERTY_VALUE} text-muted!`}>{strings.task.noAssignees}</span>;
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      {users.length === 1 ? (
        <span className={`flex min-w-0 items-center gap-2 ${PROPERTY_VALUE}`}>
          <UserAvatar
            name={users[0].name}
            avatarUrl={users[0].avatarUrl}
            size="sm"
            className="size-5"
          />
          <span className="truncate">{users[0].name}</span>
        </span>
      ) : (
        // Overlapped, each ringed in the dialog's own surface so the faces read
        // as a stack rather than a smear. Sized to the row, not to the avatar
        // group on a task card, which sits in a taller row.
        <span className="flex items-center -space-x-1.5">
          {users.map((user) => (
            <span key={user.id} className="rounded-full ring-2 ring-surface" title={user.name}>
              <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" className="size-5" />
            </span>
          ))}
        </span>
      )}

      {/* "Add someone else", in the avatar group's own shape and right where the
          faces end — so the way to add the second person is beside the first
          rather than at the far side of the row. It takes the chevron's place
          once anyone is assigned: an empty property still needs the chevron to
          say it can be opened at all, but a face plus a plus says it better. */}
      {canAdd ? (
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-outline-control text-muted"
        >
          <Plus className="size-3" />
        </span>
      ) : null}
    </span>
  );
}
