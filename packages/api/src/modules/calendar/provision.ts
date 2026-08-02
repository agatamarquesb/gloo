import { LABEL_COLORS, type LabelColor } from '@gloo/shared';

import { prisma } from '../../lib/prisma';

/**
 * The Gloo account's name, and the two agendas every user starts with.
 *
 * PT-BR like the rest of the page. "Gloo" itself is the product name, so it is
 * the one label here that isn't translated.
 */
const GLOO_ACCOUNT_NAME = 'Gloo';
const DEFAULT_AGENDA_NAME = 'Minha agenda';
const SHARED_INBOX_NAME = 'Compartilhados comigo';

/**
 * The next colour to hand a new agenda.
 *
 * Walks the palette in order and takes the first one the user isn't already
 * using, so the first ten agendas are all visibly different before anything
 * repeats. Falls back to cycling once they are all spoken for — at which point
 * a duplicate is unavoidable and the user can recolour by hand.
 */
export function nextAgendaColor(usedColors: string[]): LabelColor {
  const free = LABEL_COLORS.find((color) => !usedColors.includes(color));
  return free ?? LABEL_COLORS[usedColors.length % LABEL_COLORS.length];
}

/**
 * Make sure the user has a Gloo account, a default agenda and a shared inbox.
 *
 * Lazy rather than done at signup, for the same reason routines reset on read
 * rather than on a schedule: there is no cron and no post-signup hook, and
 * every existing user predates the calendar. Called at the top of every
 * calendar route, and a no-op on all but the first.
 */
export async function ensureCalendarProvisioned(userId: string): Promise<void> {
  // findFirst-then-create rather than upsert: the account's compound unique
  // includes googleSub, which is null here, and Prisma won't take a null in a
  // unique lookup. The real guard against two simultaneous first requests both
  // creating one is the partial unique index on (userId) where provider =
  // 'GLOO' — added by hand in the calendar_account_one_gloo_per_user migration,
  // since a partial index can't be declared in the schema. Losing that race
  // raises P2002, and the re-read below picks up the row the winner made.
  let account = await prisma.calendarAccount.findFirst({
    where: { userId, provider: 'GLOO' },
  });

  if (!account) {
    try {
      account = await prisma.calendarAccount.create({
        data: { userId, provider: 'GLOO', displayName: GLOO_ACCOUNT_NAME },
      });
    } catch {
      account = await prisma.calendarAccount.findFirstOrThrow({
        where: { userId, provider: 'GLOO' },
      });
    }
  }

  const existing = await prisma.agenda.findMany({
    where: { accountId: account.id },
    select: { id: true, isDefault: true, isSharedInbox: true },
  });

  if (!existing.some((agenda) => agenda.isDefault)) {
    await prisma.agenda.create({
      data: {
        accountId: account.id,
        userId,
        name: DEFAULT_AGENDA_NAME,
        color: 'green',
        isDefault: true,
        sortOrder: 0,
      },
    });
  }

  if (!existing.some((agenda) => agenda.isSharedInbox)) {
    await prisma.agenda.create({
      data: {
        accountId: account.id,
        userId,
        name: SHARED_INBOX_NAME,
        color: 'gray',
        isSharedInbox: true,
        // Last in the Gloo group: it is not somewhere the user files things,
        // it is where things arrive.
        sortOrder: 1000,
      },
    });
  }
}

/**
 * The agenda a new event lands on when the user didn't pick one.
 *
 * Never the shared inbox — nothing is authored there — and never a read-only
 * Google calendar, so this cannot hand back an agenda the write would bounce
 * off. Falls back to any writable agenda if the default flag has somehow been
 * lost, which is better than refusing to create the event.
 */
export async function defaultAgendaFor(userId: string) {
  return (
    (await prisma.agenda.findFirst({
      where: { userId, isDefault: true, removedAt: null, isSharedInbox: false },
    })) ??
    (await prisma.agenda.findFirst({
      where: { userId, removedAt: null, isSharedInbox: false, isReadOnly: false },
      orderBy: { sortOrder: 'asc' },
    }))
  );
}
