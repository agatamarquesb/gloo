import type { UserDto } from '@gloo/shared';

import { UserAvatar } from '@/components/common/UserAvatar';
import { strings } from '@/strings/pt-BR';

const MAX_VISIBLE = 4;

/**
 * HeroUI has no avatar-group component, so this stacks its Avatar primitive
 * with overlap + a "+N" overflow indicator, following the same visual
 * pattern used throughout the reference designs.
 */
export function AssigneeAvatars({
  assignees,
  compact = false,
  withName = false,
}: {
  assignees: UserDto[];
  /**
   * A 20px stack instead of the 32px one, for the Tasks page's project folders.
   * Who is on a project is the least of the three facts on that row and can
   * afford to be the smallest thing in it.
   */
  compact?: boolean;
  /**
   * Write the person's name beside their face, when there is exactly one of
   * them.
   *
   * Only then, and that is the whole rule: a stack of overlapping discs is a
   * shorthand for "these four", which a name cannot be written for without
   * writing four. One disc is not a stack — it is a person, and a card with room
   * on that line should say who rather than make you hover a 20px circle to find
   * out.
   */
  withName?: boolean;
}) {
  const visible = assignees.slice(0, MAX_VISIBLE);
  const overflow = assignees.length - visible.length;

  // Nobody on it: an empty disc, dashed, exactly where a face would be.
  //
  // Drawing nothing was the alternative and it read as a card that had lost
  // something rather than as one nobody has taken — and on a row it let
  // everything before it slide across by an avatar's width. A dashed outline is
  // how this app says "a slot with nothing in it" (see the board's own columns),
  // so the shape says which fact is missing without a word for it.
  if (assignees.length === 0) {
    return (
      <span
        aria-hidden
        // Two pixels of the muted ink rather than one of the control outline:
        // that edge is tuned for a *filled* control, where a fill sits inside it
        // and does half the work of finding it. There is nothing inside this
        // one, so at a hairline it read as a smudge on the card.
        className={`block shrink-0 rounded-full border-2 border-dashed border-muted ${
          compact ? 'size-5' : 'size-8'
        }`}
        title={strings.task.noAssignees}
      />
    );
  }

  const sole = withName && assignees.length === 1 ? assignees[0] : null;

  // The ring is the brand green rather than the surface behind it: it still cuts
  // one overlapping face from the next, and on a task row it reads as the same
  // green edge the row itself is drawn with instead of as a gap in the stack.
  return (
    // `-space-x-2` only while the faces actually overlap: with a name after a
    // single disc the negative margin would pull the words back over it.
    <div className={`flex min-w-0 items-center ${sole ? 'gap-1.5' : '-space-x-2'}`}>
      {visible.map((user) => (
        <div key={user.id} className="rounded-full">
          <UserAvatar
            name={user.name}
            avatarUrl={user.avatarUrl}
            size="sm"
            className={compact ? 'size-5 text-[9px]' : undefined}
          />
        </div>
      ))}
      {sole ? (
        <span
          className={`min-w-0 truncate text-muted ${compact ? 'text-xs' : 'text-sm'}`}
          title={sole.name}
        >
          {sole.name}
        </span>
      ) : null}
      {overflow > 0 ? (
        <div
          className={`flex items-center justify-center rounded-full bg-default font-medium text-default-foreground ${
            compact ? 'size-5 text-[9px]' : 'size-8 text-xs'
          }`}
        >
          +{overflow}
        </div>
      ) : null}
    </div>
  );
}
