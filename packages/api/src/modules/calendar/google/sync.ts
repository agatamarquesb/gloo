import { CalendarItemKind, dateInZone, type CalendarSyncResultDto } from '@gloo/shared';

import { prisma } from '../../../lib/prisma';
import { nextAgendaColor } from '../provision';
import { sanitizeNotes } from '../../../lib/sanitizeHtml';
import { googleFetch, googleTasksFetch, GoogleAuthError } from './client';
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

/**
 * What Google's own `eventType` says this is.
 *
 * Only two of its values change anything here. `appointment` is a slot booked
 * through an appointment schedule — the third thing the "criar" menu offers, and
 * the one a reader wants told apart from an ordinary meeting. Everything else —
 * `default`, `focusTime`, `outOfOffice`, `workingLocation`, `fromGmail`,
 * `birthday` — is an event: they differ in what they *mean* to Google, not in
 * what they are to a calendar.
 *
 * Tasks are not here at all: they come from a different API entirely, and are
 * marked TASK where they are imported — see importTasks.
 */
function kindFor(eventType: string | undefined): CalendarItemKind {
  return eventType === 'appointment' ? CalendarItemKind.APPOINTMENT : CalendarItemKind.EVENT;
}

interface CalendarListEntry {
  id: string;
  summary?: string;
  summaryOverride?: string;
  accessRole?: string;
  primary?: boolean;
  deleted?: boolean;
  /**
   * The calendar's colour as Google shows it, `#rrggbb` — the one the user
   * actually picked over there, not the id of a swatch we would have to map.
   */
  backgroundColor?: string;
}

/**
 * Import the account's calendar list as agendas.
 *
 * Colours are Google's own, taken from `backgroundColor` and kept in step on
 * every sync: a calendar the user recognises by its colour over there has to be
 * the same colour here, and ours — a palette of ten assigned by order of import
 * — made "Feriados" a different colour in each place.
 *
 * The cost is that recolouring a Google agenda inside Gloo no longer sticks: the
 * next sync writes Google's value back over it. That is the same trade the name
 * already makes, and it is what "exactly the colour it is in Google" means.
 * Agendas in the Gloo account are untouched by any of this — they have no
 * calendar upstream and keep the palette.
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
        // Name, access and colour all belong to Google; visibility is the user's
        // and is left alone. A calendar with no colour in the response keeps
        // whatever it has rather than being reset to grey.
        data: { name, isReadOnly, ...(entry.backgroundColor ? { color: entry.backgroundColor } : {}) },
      });
      continue;
    }

    // Google's colour when it sent one. The fallback is the old behaviour, for
    // the calendar that arrives without one: nextAgendaColor rather than a
    // find-or-grey, because past ten agendas the palette is exhausted and a
    // fixed fallback gave two calendars the same grey — which is exactly what
    // colouring them was for.
    const color = entry.backgroundColor ?? nextAgendaColor(usedColors);
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

interface GoogleTaskList {
  id: string;
  title?: string;
}

interface GoogleTask {
  id: string;
  title?: string;
  notes?: string;
  status?: string;
  /** RFC 3339, and always midnight UTC: a Google task is due on a *day*. */
  due?: string;
  deleted?: boolean;
  hidden?: boolean;
  updated?: string;
}

/**
 * Google's task lists, as agendas.
 *
 * A task list is not a calendar — different API, different ids — but it is the
 * same thing to a reader: a named bucket of dated items with a colour. Modelling
 * it as an agenda is what lets the grid, the day summary, the dot colours and
 * the `···` filter all work on tasks without knowing they are tasks.
 *
 * Read-only, because everything a calendar lets you do to an event — drag it,
 * resize it, change its hours — is meaningless for a task. The one thing a task
 * *can* do is be ticked off, which goes through its own route.
 */
async function importTaskLists(
  account: AccountRow,
  log: (error: unknown, context: string) => void,
): Promise<GoogleTaskList[]> {
  const response = await googleTasksFetch(account, '/users/@me/lists?maxResults=100');

  // A refusal here is not a failed sync: an account linked before this app asked
  // for the Tasks scope answers 403, and the calendar half is untouched by that.
  // But it is *reported* — Google says which of the several reasons it is
  // ("insufficient authentication scopes", "Tasks API has not been used in
  // project N"), and swallowing that left no way to tell a missing consent from
  // a disabled API.
  if (response.status === 403 || response.status === 401) {
    log(
      new Error(`tasklists refused: ${response.status} ${await response.text()}`),
      `tasks for account ${account.id}`,
    );
    return [];
  }
  if (!response.ok) {
    throw new GoogleAuthError(`tasklists failed: ${response.status} ${await response.text()}`);
  }

  const { items = [] } = (await response.json()) as { items?: GoogleTaskList[] };
  const used = await prisma.agenda.findMany({
    where: { userId: account.userId },
    select: { color: true },
  });
  const usedColors = used.map((agenda) => agenda.color);

  for (const list of items) {
    const existing = await prisma.agenda.findFirst({
      where: { accountId: account.id, googleTaskListId: list.id },
      select: { id: true },
    });
    const name = list.title ?? 'Tasks';

    if (existing) {
      // `isReadOnly: false` on the way past as well as on creation: the lists
      // imported before this app could write to Tasks were stored read-only,
      // and one sync is what turns them writable rather than a migration.
      await prisma.agenda.update({
        where: { id: existing.id },
        data: { name, isReadOnly: false },
      });
      continue;
    }

    const color = nextAgendaColor(usedColors);
    usedColors.push(color);
    await prisma.agenda.create({
      data: {
        accountId: account.id,
        userId: account.userId,
        name,
        color,
        // Writable, in the sense the app means it: a task can be opened,
        // renamed and given an hour *here*. None of that is sent back — see the
        // PATCH route — but read-only is what stops the dialog opening at all,
        // and a task you cannot place on your own day is the thing this whole
        // integration was for.
        isReadOnly: false,
        googleTaskListId: list.id,
      },
    });
  }

  return items;
}

/**
 * One task list's tasks, as calendar rows.
 *
 * Stored as all-day items on the day they are due — which is the only placement
 * a Google task has: its `due` is a date, not an hour. A task with no due date
 * is not on any day and is skipped; it lives in Google's own list, which is
 * where it belongs until it is scheduled.
 *
 * Completed tasks are imported too, ticked: a day's list reading "three things,
 * two done" is the point of showing them at all.
 */
async function importTasks(
  account: AccountRow,
  agenda: { id: string; googleTaskListId: string | null },
): Promise<{ imported: number; removed: number }> {
  if (!agenda.googleTaskListId) return { imported: 0, removed: 0 };

  const listId = encodeURIComponent(agenda.googleTaskListId);
  const params = new URLSearchParams({
    maxResults: '100',
    showCompleted: 'true',
    showHidden: 'true',
    dueMin: new Date(Date.now() - INITIAL_WINDOW_DAYS * 86_400_000).toISOString(),
  });

  const response = await googleTasksFetch(account, `/lists/${listId}/tasks?${params}`);
  if (response.status === 403) return { imported: 0, removed: 0 };
  if (!response.ok) {
    throw new GoogleAuthError(`tasks failed: ${response.status} ${await response.text()}`);
  }

  const { items = [] } = (await response.json()) as { items?: GoogleTask[] };
  let imported = 0;
  let removed = 0;

  for (const task of items) {
    if (task.deleted) {
      const { count } = await prisma.calendarEvent.deleteMany({
        where: { agendaId: agenda.id, googleTaskId: task.id },
      });
      removed += count;
      continue;
    }

    if (!task.due) continue;

    const startsAt = new Date(task.due);
    if (Number.isNaN(startsAt.getTime())) continue;

    const data = {
      title: task.title?.trim() || '(sem título)',
      description: sanitizeNotes(task.notes ?? null),
      startsAt,
      // A day, as the rest of the app stores all-day items: midnight to
      // midnight, end exclusive.
      endsAt: new Date(startsAt.getTime() + 86_400_000),
      isAllDay: true,
      timeZone: 'UTC',
      kind: CalendarItemKind.TASK,
      isDone: task.status === 'completed',
      googleTaskId: task.id,
      googleTaskListId: agenda.googleTaskListId,
      // What Google said this time, so the next sync can tell whether it has
      // changed its mind about the day — see the update below.
      googleTaskDue: startsAt,
      lastSyncedAt: new Date(),
    };

    const existing = await prisma.calendarEvent.findFirst({
      where: { agendaId: agenda.id, googleTaskId: task.id },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        isAllDay: true,
        timeZone: true,
        googleTaskDue: true,
      },
    });

    if (existing) {
      /*
       * When a task is scheduled here, it stays scheduled here.
       *
       * Google's `due` is a date — the Tasks API discards the time of day, which
       * is why a task Google Calendar itself draws at 11:00 arrives at this
       * endpoint as midnight UTC. Taking that at face value would undo a drag
       * onto 11:00 on the very next sync: the task would jump back into the
       * all-day strip, every few minutes, for as long as the page was open.
       *
       * So the two sides own different halves of the answer. Google owns the
       * *day*, and when it changes the day it wins — the task moves, keeping
       * whatever hour it had here. Gloo owns the hour, always. `googleTaskDue`
       * is what tells those apart: it is the date Google last said, so a `due`
       * that still matches it means Google has said nothing new and every local
       * placement stands.
       */
      const googleMovedIt =
        existing.googleTaskDue === null ||
        existing.googleTaskDue.getTime() !== startsAt.getTime();

      const schedule = googleMovedIt
        ? movedTo(startsAt, existing)
        : {
            startsAt: existing.startsAt,
            endsAt: existing.endsAt,
            isAllDay: existing.isAllDay,
            timeZone: existing.timeZone,
          };

      await prisma.calendarEvent.update({
        where: { id: existing.id },
        data: { ...data, ...schedule },
      });
    } else {
      await prisma.calendarEvent.create({
        data: { ...data, agendaId: agenda.id, createdById: account.userId },
      });
      imported += 1;
    }
  }

  return { imported, removed };
}

/**
 * The same task, on the day Google has just moved it to.
 *
 * A task that had been given an hour here keeps it: only the date changes, and
 * the block simply moves across the grid. One that was still all-day stays
 * all-day. Either way the length it had is the length it keeps.
 */
function movedTo(
  due: Date,
  existing: { startsAt: Date; endsAt: Date; isAllDay: boolean; timeZone: string },
): { startsAt: Date; endsAt: Date; isAllDay: boolean; timeZone: string } {
  if (existing.isAllDay) {
    return {
      startsAt: due,
      endsAt: new Date(due.getTime() + 86_400_000),
      isAllDay: true,
      timeZone: 'UTC',
    };
  }

  // The wall-clock time it is at now, on the new date. Built from the parts
  // rather than by adding a difference in milliseconds, so a move across a clock
  // change lands on the same hour rather than an hour beside it.
  const [year, month, day] = dateInZone(due, 'UTC')
    .split('-')
    .map((part) => Number(part));
  const at = new Date(existing.startsAt);
  const startsAt = new Date(
    year,
    month - 1,
    day,
    at.getHours(),
    at.getMinutes(),
    0,
    0,
  );

  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + (existing.endsAt.getTime() - existing.startsAt.getTime())),
    isAllDay: false,
    timeZone: existing.timeZone,
  };
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
        kind: kindFor(item.eventType),
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
      // Task lists become agendas of their own, so the loop below walks them
      // exactly as it walks calendars — see importTaskLists.
      await importTaskLists(account, log);

      const agendas = await prisma.agenda.findMany({
        where: { accountId: account.id, removedAt: null },
        select: { id: true, googleCalendarId: true, googleSyncToken: true, googleTaskListId: true },
      });

      for (const agenda of agendas) {
        try {
          const counts = agenda.googleTaskListId
            ? await importTasks(account, agenda)
            : await importEvents(account, agenda);
          result.eventsImported += counts.imported;
          result.eventsRemoved += counts.removed;
        } catch (caught) {
          // One unreadable calendar or list must not cost the account its other
          // ones — a single shared calendar with odd permissions is common.
          log(caught, `items for agenda ${agenda.id}`);
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
