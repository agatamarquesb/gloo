import type { CalendarSyncResultDto } from '@gloo/shared';

import { prisma } from '../../../lib/prisma';
import { nextAgendaColor } from '../provision';
import { sanitizeNotes } from '../../../lib/sanitizeHtml';
import { googleFetch, GoogleAuthError } from './client';
import {
  attendeeEmails,
  isAllDay,
  parseEventTime,
  parseRecurrence,
  type GoogleEvent,
} from './mapper';

/**
 * Pulling Google's calendars and events into ours.
 *
 * Lazy rather than scheduled: this repo has no cron (the README says so, and
 * routines reset per request for the same reason), so a sync runs when the
 * calendar page asks for one — on mount, on an interval while it is open, and
 * on the refresh button. Google's push channels would need a public HTTPS
 * webhook, which localhost cannot have.
 *
 * Everything below awaits in sequence, and `no-await-in-loop` is turned off for
 * this directory in .oxlintrc.json because of it. That is deliberate rather
 * than lazy: paging events.list is inherently serial (each request needs the
 * pageToken the last response returned), and running the per-event writes in
 * parallel would both hammer Postgres and trip Google's per-user rate limit,
 * which costs the whole sync rather than one event.
 */

/** How far back a first-ever sync reaches. Later syncs are incremental. */
const INITIAL_WINDOW_DAYS = 180;
/** Guard against an account with a pathological number of events. */
const MAX_PAGES = 20;

interface AccountRow {
  id: string;
  userId: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}

interface CalendarListEntry {
  id: string;
  summary?: string;
  summaryOverride?: string;
  accessRole?: string;
  primary?: boolean;
  deleted?: boolean;
}

/**
 * Import the account's calendar list as agendas.
 *
 * Colours come from our palette rather than Google's — theirs are a fixed set
 * of 24 that have nothing to do with this design system. Assigned once, on
 * first import, and never touched again so a user's own recolouring survives
 * every later sync.
 */
async function importAgendas(account: AccountRow): Promise<number> {
  const response = await googleFetch(account, '/users/me/calendarList?minAccessRole=reader');
  // The body carries Google's own reason ("insufficient authentication scopes",
  // "API has not been used in project N"), which the status alone never says.
  if (!response.ok) {
    throw new GoogleAuthError(`calendarList failed: ${response.status} ${await response.text()}`);
  }

  const { items = [] } = (await response.json()) as { items?: CalendarListEntry[] };

  const existing = await prisma.agenda.findMany({
    where: { accountId: account.id },
    select: { googleCalendarId: true, removedAt: true },
  });
  const known = new Map(existing.map((agenda) => [agenda.googleCalendarId, agenda]));

  const used = await prisma.agenda.findMany({
    where: { userId: account.userId },
    select: { color: true },
  });
  const usedColors = used.map((agenda) => agenda.color);

  let imported = 0;
  let order = 0;

  for (const entry of items) {
    order += 1;
    if (entry.deleted) continue;

    const already = known.get(entry.id);
    // A calendar the user removed from the list stays removed — walking it back
    // in on the next sync is exactly what removedAt exists to prevent.
    if (already?.removedAt) continue;

    const name = entry.summaryOverride ?? entry.summary ?? entry.id;
    // "owner" and "writer" can take events; "reader" and "freeBusyReader"
    // cannot, and their agendas are marked so the UI stops offering to edit.
    const isReadOnly = entry.accessRole !== 'owner' && entry.accessRole !== 'writer';

    if (already) {
      await prisma.agenda.update({
        where: {
          accountId_googleCalendarId: { accountId: account.id, googleCalendarId: entry.id },
        },
        // Name and access can change on Google's side; colour and visibility
        // are the user's and are left alone.
        data: { name, isReadOnly },
      });
      continue;
    }

    // nextAgendaColor rather than a find-or-grey: past ten agendas the palette
    // is exhausted and falling back to a fixed colour gave two calendars the
    // same grey, which is exactly what colouring them was for. Cycling at least
    // keeps neighbours apart.
    const color = nextAgendaColor(usedColors);
    usedColors.push(color);

    await prisma.agenda.create({
      data: {
        accountId: account.id,
        userId: account.userId,
        name,
        color,
        isReadOnly,
        googleCalendarId: entry.id,
        sortOrder: order,
      },
    });
    imported += 1;
  }

  return imported;
}

/**
 * Pull one calendar's events.
 *
 * `singleEvents=false` so a recurring event arrives once, as its RRULE, rather
 * than as hundreds of instances — our own model stores it the same way, and
 * expanding is the API's job on read.
 *
 * The first run is bounded by `timeMin`; the `nextSyncToken` it returns carries
 * that bound forward, so every later run is a true delta.
 */
async function importEvents(
  account: AccountRow,
  agenda: { id: string; googleCalendarId: string | null; googleSyncToken: string | null },
): Promise<{ imported: number; removed: number }> {
  if (!agenda.googleCalendarId) return { imported: 0, removed: 0 };

  // Google names attendees by email; Gloo names them by user. Anyone we can
  // match becomes a real assignee, and only the rest stay "external".
  //
  // Without this split every assignee came back from a round-trip as an
  // external guest *as well*, so the same person was counted twice — the
  // confirmation dialog offered to notify "2 pessoas" for a one-guest meeting,
  // and their address was pushed back to Google alongside their own invitation.
  const gloUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  const userIdByEmail = new Map(gloUsers.map((user) => [user.email.toLowerCase(), user.id]));

  const calendarId = encodeURIComponent(agenda.googleCalendarId);
  let pageToken: string | undefined;
  let syncToken = agenda.googleSyncToken;
  let imported = 0;
  let removed = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ singleEvents: 'false', maxResults: '250' });
    if (pageToken) params.set('pageToken', pageToken);
    if (syncToken) params.set('syncToken', syncToken);
    else {
      params.set(
        'timeMin',
        new Date(Date.now() - INITIAL_WINDOW_DAYS * 86_400_000).toISOString(),
      );
    }

    const response = await googleFetch(account, `/calendars/${calendarId}/events?${params}`);

    // 410 means the sync token has aged out. Google's instruction is to drop it
    // and do a full sync again, which is what clearing it here arranges.
    if (response.status === 410) {
      await prisma.agenda.update({
        where: { id: agenda.id },
        data: { googleSyncToken: null },
      });
      return { imported, removed };
    }
    if (!response.ok) {
      throw new GoogleAuthError(
        `events.list failed: ${response.status} ${await response.text()}`,
      );
    }

    const body = (await response.json()) as {
      items?: GoogleEvent[];
      nextPageToken?: string;
      nextSyncToken?: string;
    };

    for (const item of body.items ?? []) {
      // Deleted on Google's side. Incremental syncs report these as tombstones.
      if (item.status === 'cancelled') {
        const { count } = await prisma.calendarEvent.deleteMany({
          where: { agendaId: agenda.id, googleEventId: item.id },
        });
        removed += count;
        continue;
      }

      const startsAt = parseEventTime(item.start);
      const endsAt = parseEventTime(item.end);
      // An event with no usable time cannot be placed on a grid; skipping is
      // better than inventing a slot for it.
      if (!startsAt || !endsAt) continue;

      const rule = parseRecurrence(item.recurrence);

      // An exception Google sends for an instance of a series we may not have
      // imported yet. Matched by the master's Google id, which we do store.
      const master = item.recurringEventId
        ? await prisma.calendarEvent.findFirst({
            where: { agendaId: agenda.id, googleEventId: item.recurringEventId },
            select: { id: true },
          })
        : null;

      const originalStart = parseEventTime(item.originalStartTime);

      const attendees = attendeeEmails(item);
      const matchedUserIds = [
        ...new Set(
          attendees.flatMap((email) => {
            const id = userIdByEmail.get(email.toLowerCase());
            return id ? [id] : [];
          }),
        ),
      ];
      const unmatched = attendees.filter((email) => !userIdByEmail.has(email.toLowerCase()));

      const data = {
        title: item.summary ?? '',
        description: sanitizeNotes(item.description ?? null),
        location: item.location ?? null,
        startsAt,
        endsAt,
        isAllDay: isAllDay(item),
        // Google reports the zone the event was authored in; keeping it is what
        // lets our own expansion hold the series to its wall clock.
        timeZone: item.start?.timeZone ?? 'UTC',
        recurrence: rule?.recurrence ?? null,
        recurrenceUntil: rule?.until ?? null,
        byWeekdays: rule?.byWeekdays ?? [],
        recurringEventId: master?.id ?? null,
        originalStart,
        googleEventId: item.id,
        googleICalUid: item.iCalUID ?? null,
        googleEtag: item.etag ?? null,
        externalAttendees: unmatched,
        lastSyncedAt: new Date(),
      };

      const existing = await prisma.calendarEvent.findFirst({
        where: { agendaId: agenda.id, googleEventId: item.id },
        select: { id: true },
      });

      // Assignees are replaced wholesale rather than merged: Google's attendee
      // list is authoritative for an event it owns, and a merge would make a
      // guest removed there impossible to remove here.
      const assignees = {
        deleteMany: {},
        create: matchedUserIds.map((userId) => ({ userId })),
      };

      if (existing) {
        await prisma.calendarEvent.update({
          where: { id: existing.id },
          data: { ...data, assignees },
        });
      } else {
        await prisma.calendarEvent.create({
          data: {
            ...data,
            agendaId: agenda.id,
            createdById: account.userId,
            assignees: { create: matchedUserIds.map((userId) => ({ userId })) },
          },
        });
        imported += 1;
      }
    }

    if (body.nextSyncToken) {
      syncToken = body.nextSyncToken;
      await prisma.agenda.update({
        where: { id: agenda.id },
        data: { googleSyncToken: syncToken },
      });
    }

    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }

  return { imported, removed };
}

/**
 * Sync every Google account this user has linked.
 *
 * One account failing does not stop the others: a revoked grant on a personal
 * account should not silently stop a work one from updating. The failure is
 * recorded on the account (needsReauth, set by the token refresh) and reported
 * back so the UI can offer "Reconectar".
 */
export async function syncUserCalendars(
  userId: string,
  /**
   * Where a failure goes. Required rather than optional: this used to swallow
   * every error that wasn't an auth one, so a calendar list that came back 403
   * looked exactly like an account with no calendars — a silent zero, with
   * nothing in the log to say otherwise.
   */
  log: (error: unknown, context: string) => void,
): Promise<CalendarSyncResultDto> {
  const accounts = await prisma.calendarAccount.findMany({
    where: { userId, provider: 'GOOGLE' },
  });

  const result: CalendarSyncResultDto = {
    agendasImported: 0,
    eventsImported: 0,
    eventsRemoved: 0,
    accountsNeedingReauth: [],
  };

  for (const account of accounts) {
    try {
      result.agendasImported += await importAgendas(account);

      const agendas = await prisma.agenda.findMany({
        where: { accountId: account.id, removedAt: null },
        select: { id: true, googleCalendarId: true, googleSyncToken: true },
      });

      for (const agenda of agendas) {
        try {
          const counts = await importEvents(account, agenda);
          result.eventsImported += counts.imported;
          result.eventsRemoved += counts.removed;
        } catch (caught) {
          // One unreadable calendar must not cost the account its other ones —
          // a single shared calendar with odd permissions is common.
          log(caught, `events for agenda ${agenda.id}`);
        }
      }
    } catch (caught) {
      log(caught, `account ${account.id}`);

      // needsReauth is set by the refresh path itself; re-read it rather than
      // assuming every failure here is an auth one.
      const current = await prisma.calendarAccount.findUnique({
        where: { id: account.id },
        select: { needsReauth: true },
      });
      if (current?.needsReauth) result.accountsNeedingReauth.push(account.id);
    }
  }

  return result;
}
