import {
  AttachmentKind,
  DEFAULT_LABEL_COLOR,
  isLabelColor,
  MAX_ROUTINE_CHECKLISTS,
  type AttachmentDto,
  type ChecklistItemDto,
  type RoutineChecklistDto,
  type RoutineDto,
} from '@gloo/shared';

import { toUserDto } from '../../lib/userDto';
import { Prisma } from '../../../generated/prisma/client';

import { isCurrentlyDone } from './reset';

export const routineInclude = {
  assignees: { include: { user: true } },
  labels: { include: { label: true } },
} satisfies Prisma.RoutineInclude;

export type RoutineWithRelations = Prisma.RoutineGetPayload<{ include: typeof routineInclude }>;

/**
 * `checklist` and `attachments` are Json columns, so what comes back is whatever
 * was last written — including rows from before the column existed, or from an
 * earlier shape. Everything is re-validated on the way out and anything
 * malformed is dropped, so a bad row can never reach the client as a broken
 * checklist or a dead attachment.
 */
function parseItems(value: unknown): ChecklistItemDto[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const { text, done } = entry as Record<string, unknown>;
    return typeof text === 'string' ? [{ text, done: done === true }] : [];
  });
}

/**
 * An empty checklist is still a checklist: opening the block is itself the
 * user's edit, so a title-less, item-less entry round-trips rather than being
 * discarded. Only a non-object is dropped.
 */
function parseChecklist(value: unknown): RoutineChecklistDto | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const { title, items } = value as Record<string, unknown>;
  return {
    title: typeof title === 'string' ? title : '',
    items: parseItems(items),
  };
}

export function parseChecklists(value: unknown): RoutineChecklistDto[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry) => {
      const parsed = parseChecklist(entry);
      return parsed ? [parsed] : [];
    })
    .slice(0, MAX_ROUTINE_CHECKLISTS);
}

/**
 * Null and `[]` mean different things here: null is "the routine has no
 * attachments block", `[]` is "the block is open but still empty". Opening the
 * block is an edit worth persisting, so the distinction survives a round trip.
 */
export function parseAttachments(value: unknown): AttachmentDto[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return null;
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const { id, kind, url, title } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || typeof url !== 'string' || !url) return [];
    return [
      {
        id,
        kind: kind === AttachmentKind.FILE ? AttachmentKind.FILE : AttachmentKind.LINK,
        url,
        title: typeof title === 'string' && title ? title : url,
      },
    ];
  });
}

export function toRoutineDto(routine: RoutineWithRelations): RoutineDto {
  return {
    id: routine.id,
    description: routine.description,
    recurrence: routine.recurrence,
    weekday: routine.weekday,
    dayOfMonth: routine.dayOfMonth,
    // Effective state for "now", not the stored flag — see reset.ts.
    done: isCurrentlyDone(routine),
    notes: routine.notes,
    checklists: parseChecklists(routine.checklists),
    attachments: parseAttachments(routine.attachments),
    labels: routine.labels.map(({ label }) => ({
      id: label.id,
      name: label.name,
      color: isLabelColor(label.color) ? label.color : DEFAULT_LABEL_COLOR,
    })),
    assignees: routine.assignees.map(({ user }) => toUserDto(user)),
    createdById: routine.createdById,
    updatedAt: routine.updatedAt.toISOString(),
    deletedAt: routine.deletedAt?.toISOString() ?? null,
  };
}

/**
 * Prisma types a Json column as its own `InputJsonValue`, which a plain
 * interface doesn't structurally satisfy. Both casts sit at the single point
 * where already-validated data is handed to Prisma.
 *
 * Clearing the column needs `Prisma.JsonNull`, not a bare `null` — for a
 * nullable Json field the latter means "leave it alone".
 */
export function toJsonChecklists(value: unknown): Prisma.InputJsonValue {
  return parseChecklists(value) as unknown as Prisma.InputJsonValue;
}

export function toJsonAttachments(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  const parsed = parseAttachments(value);
  return parsed ? (parsed as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
}
