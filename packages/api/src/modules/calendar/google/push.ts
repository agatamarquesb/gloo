import { countOtherAttendees, googleColorIdFor, isPaletteColor } from '@gloo/shared';

import { prisma } from '../../../lib/prisma';
import { googleFetch, googleTasksFetch } from './client';
import { parseEventTime, toRRule } from './mapper';

/**
 * Pushing our events to Google.
 *
 * Every write is best-effort and never fails the request that caused it: the
 * event is already saved on our side, and refusing a save because Google was
 * briefly unreachable would lose the user's work to somebody else's outage.
 * A failed push leaves `googleEventId` unset, and the next inbound sync
 * reconciles.
 */

interface PushableEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  isAllDay: boolean;
  timeZone: string;
  recurrence: string | null;
  recurrenceUntil: Date | null;
  byWeekdays: number[];
  googleEventId: string | null;
  color: string | null;
  agendaId: string;
  createdById: string;
  externalAttendees: unknown;
  assignees: { userId: string; user: { email: string } }[];
}

function toGoogleTime(instant: Date, isAllDay: boolean, timeZone: string) {
  if (isAllDay) return { date: instant.toISOString().slice(0, 10) };
  return { dateTime: instant.toISOString(), timeZone };
}

/** Guests Google knows about that have no Gloo user — see the JSON column. */
function externalEmails(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

/**
 * What Google should do about email for this write.
 *
 * `all` makes Google send invitations and, on a later change, "this event has
 * moved" notices. It is only ever used when the caller explicitly asked for it
 * *and* somebody other than the organiser is on the event — so an unchecked box
 * and a solo event both come out silent, and a drag can never surprise anyone.
 */
function sendUpdates(notify: boolean, event: PushableEvent): 'all' | 'none' {
  if (!notify) return 'none';

  const others = countOtherAttendees({
    createdById: event.createdById,
    assigneeIds: event.assignees.map((link) => link.userId),
    externalAttendees: externalEmails(event.externalAttendees),
  });

  return others > 0 ? 'all' : 'none';
}

/**
 * What Google should be told this event's colour is.
 *
 * Three answers, and the difference between two of them is the whole point:
 *
 *   - `null` — the event has no colour of its own, so clear whatever Google is
 *     holding and let it wear its calendar's, exactly as it does here.
 *   - an id — the colour is one of Google's eleven, and it goes over as that id.
 *     This is the only colour field on an event Google lets anything write, so
 *     it is the only way a colour picked here can also be a colour seen there.
 *   - `undefined` — the colour is one Google has no id for: the app's own
 *     palette, or something a user mixed. Omitted rather than cleared, because
 *     "I cannot say this in your vocabulary" is not the same as "there is no
 *     colour", and clearing would silently undo a colour set on the Google side.
 *
 * The dialog only offers the eleven for an event on a Google agenda, so the
 * third case is what happens to an event moved onto one after being coloured
 * somewhere else — not something a user can walk into.
 *
 * Google's *event labels* are not reachable from here at all. They are what
 * colours a card without any colorId, and the API returns an opaque id with no
 * colour attached, resolves it nowhere, and ignores the field on write.
 */
function colorIdFor(color: string | null): string | null | undefined {
  if (color === null) return null;
  if (!isPaletteColor(color)) return undefined;
  return googleColorIdFor(color) ?? undefined;
}

function toGoogleBody(event: PushableEvent) {
  return {
    summary: event.title,
    colorId: colorIdFor(event.color),
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    start: toGoogleTime(event.startsAt, event.isAllDay, event.timeZone),
    end: toGoogleTime(event.endsAt, event.isAllDay, event.timeZone),
    recurrence: toRRule(event.recurrence, event.recurrenceUntil, event.byWeekdays),
    // Assignees become Google attendees, matched by the address they log in
    // with. Someone with no Google account simply never accepts.
    //
    // External guests are carried back too. A PATCH replaces the whole
    // attendees list, so sending only our own assignees would un-invite every
    // guest who was on a Google-authored event — silently, and for everyone.
    // Deduped by address: an assignee and an external guest can be the same
    // person if the two lists ever drift, and sending one address twice is not
    // something Google should have to sort out for us.
    attendees: [
      ...new Set([
        ...event.assignees.map((link) => link.user.email),
        ...externalEmails(event.externalAttendees),
      ]),
    ].map((email) => ({ email })),
  };
}

/**
 * The id Google addresses one occurrence of a series by.
 *
 * A single occurrence of a repeating event is not a new event over there — it is
 * an *instance*, with an id derived from the series and the slot it fills
 * (`abc123_20260819T220000Z`). Editing one means PATCHing that id; POSTing the
 * occurrence instead creates a second, unrelated event, which is what this
 * exists to prevent. See pushEvent, which is where that went wrong: our
 * exception row starts with no googleEventId of its own, and "no id" used to
 * mean "create".
 *
 * Asked for rather than constructed. The format above is Google's and is stable,
 * but it has more than one shape — the corpus here holds `..._R20260809T220000`
 * alongside `..._20260814T220000Z`, and a series that has itself been split
 * answers under the *root* id rather than the one we hold — so a guess that
 * misses lands us back on creating a duplicate.
 *
 * Asked for by window rather than by Google's own `originalStart` parameter,
 * which returns an empty list here for instances that plainly exist. A day
 * either side and an exact match on `originalStartTime` is what actually finds
 * the slot; a daily series returns three of them and only one can match.
 *
 * Returns null when Google cannot name the instance, and the caller then does
 * nothing at all: a missing mirror is a much smaller problem than a second copy
 * of a meeting in somebody's calendar.
 */
async function instanceIdFor(
  account: { id: string; accessToken: string | null; refreshToken: string | null; tokenExpiresAt: Date | null },
  calendarId: string,
  masterGoogleEventId: string,
  originalStart: Date,
  log: (error: unknown) => void,
): Promise<string | null> {
  const DAY_MS = 24 * 60 * 60_000;
  const timeMin = new Date(originalStart.getTime() - DAY_MS).toISOString();
  const timeMax = new Date(originalStart.getTime() + DAY_MS).toISOString();

  try {
    const response = await googleFetch(
      account,
      `/calendars/${calendarId}/events/${encodeURIComponent(
        masterGoogleEventId,
      )}/instances?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(
        timeMax,
      )}&maxResults=50`,
    );

    if (!response.ok) {
      log(new Error(`instances lookup failed: ${response.status} ${await response.text()}`));
      return null;
    }

    const body = (await response.json()) as {
      items?: { id?: string; originalStartTime?: { dateTime?: string; date?: string } }[];
    };

    const wanted = originalStart.getTime();
    for (const item of body.items ?? []) {
      const slot = parseEventTime(item.originalStartTime);
      if (item.id && slot && slot.getTime() === wanted) return item.id;
    }
    return null;
  } catch (caught) {
    log(caught);
    return null;
  }
}

/**
 * Create or update the event's mirror on Google.
 *
 * Called after our own write has committed, so a failure here costs the mirror
 * and not the event.
 */
export async function pushEvent(
  eventId: string,
  log: (error: unknown) => void,
  /** Whether the user asked for attendees to be emailed about this change. */
  notify = false,
): Promise<void> {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    include: {
      assignees: { include: { user: { select: { email: true } } } },
      // The series this row overrides, if it overrides one — an exception has to
      // be pushed as that series' instance rather than as an event of its own.
      recurringEvent: { select: { googleEventId: true } },
      agenda: {
        select: {
          googleCalendarId: true,
          isReadOnly: true,
          account: true,
        },
      },
    },
  });

  // Nothing to do for a Gloo-local agenda, or one we may only read.
  if (!event?.agenda.googleCalendarId || event.agenda.isReadOnly) return;
  if (event.agenda.account.provider !== 'GOOGLE') return;

  const calendarId = encodeURIComponent(event.agenda.googleCalendarId);
  const body = JSON.stringify(toGoogleBody(event));
  const updates = sendUpdates(notify, event);

  /**
   * Which Google event this row is, if Google already has one.
   *
   * Two ways to have one. Most rows carry their own `googleEventId`. An
   * exception carries none until its first push, but it is not a new event
   * either — it is one occurrence of a series Google holds, and its id has to
   * be asked for. See instanceIdFor.
   */
  let targetId = event.googleEventId;
  if (!targetId && event.recurringEvent?.googleEventId && event.originalStart) {
    targetId = await instanceIdFor(
      event.agenda.account,
      calendarId,
      event.recurringEvent.googleEventId,
      event.originalStart,
      log,
    );
    // Google holds the series but could not name the occurrence. Creating one
    // would put a duplicate in the user's calendar that no later sync could
    // tell from a real event, so this push simply does not happen.
    if (!targetId) return;
  }

  try {
    const response = targetId
      ? await googleFetch(
          event.agenda.account,
          `/calendars/${calendarId}/events/${encodeURIComponent(
            targetId,
          )}?sendUpdates=${updates}`,
          { method: 'PATCH', body },
        )
      : await googleFetch(
          event.agenda.account,
          `/calendars/${calendarId}/events?sendUpdates=${updates}`,
          { method: 'POST', body },
        );

    if (!response.ok) {
      log(new Error(`Google push failed: ${response.status} ${await response.text()}`));
      return;
    }

    const created = (await response.json()) as { id?: string; etag?: string; colorId?: string };
    await prisma.calendarEvent.update({
      where: { id: event.id },
      data: {
        googleEventId: created.id ?? targetId,
        googleEtag: created.etag ?? null,
        // What Google now holds, taken from its own answer rather than from what
        // we sent — an id it declined to apply must not be recorded as applied.
        // This is what stops the next sync reading its own echo as a change and
        // writing it back over the colour that has just been chosen.
        googleColorId: created.colorId ?? null,
        lastSyncedAt: new Date(),
      },
    });
  } catch (caught) {
    log(caught);
  }
}

/** Remove the mirror. Called before our own row goes, while we can still read it. */
export async function deleteRemoteEvent(
  eventId: string,
  log: (error: unknown) => void,
  /** Whether attendees should be told the meeting is cancelled. */
  notify = false,
): Promise<void> {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    include: {
      assignees: { include: { user: { select: { email: true } } } },
      agenda: { select: { googleCalendarId: true, isReadOnly: true, account: true } },
    },
  });

  if (!event?.googleEventId || !event.agenda.googleCalendarId || event.agenda.isReadOnly) return;
  if (event.agenda.account.provider !== 'GOOGLE') return;

  try {
    await googleFetch(
      event.agenda.account,
      `/calendars/${encodeURIComponent(
        event.agenda.googleCalendarId,
      )}/events/${encodeURIComponent(event.googleEventId)}?sendUpdates=${sendUpdates(
        notify,
        event,
      )}`,
      { method: 'DELETE' },
    );
  } catch (caught) {
    log(caught);
  }
}

/**
 * Create a real secondary calendar on Google, for "Nova agenda" pointed at a
 * linked account.
 *
 * Returns the new calendar's id, or null if Google refused — in which case the
 * caller must not create a local row claiming to be a mirror of it.
 */
export async function createRemoteCalendar(
  account: { id: string; accessToken: string | null; refreshToken: string | null; tokenExpiresAt: Date | null },
  name: string,
  log: (error: unknown) => void,
): Promise<string | null> {
  try {
    const response = await googleFetch(account, '/calendars', {
      method: 'POST',
      body: JSON.stringify({ summary: name }),
    });

    if (!response.ok) {
      log(new Error(`calendars.insert failed: ${response.status} ${await response.text()}`));
      return null;
    }

    const created = (await response.json()) as { id?: string };
    return created.id ?? null;
  } catch (caught) {
    log(caught);
    return null;
  }
}

/**
 * Carry a rename or a recolour back to the calendar on Google's side.
 *
 * Through `calendarList` rather than `calendars`, and that is the whole design:
 * the calendarList entry is *this account's view* of a calendar, so it accepts
 * both fields for every calendar the user can see — including the holiday feed
 * and the one a colleague shared at reader access, neither of which
 * `calendars.patch` would let us touch. `summaryOverride` is also exactly what
 * importAgendas reads back first, so the next sync agrees with what we sent
 * instead of walking the old name in again.
 *
 * `colorRgbFormat=true` is what lets us send our own hex at all: without it
 * Google takes only a `colorId` out of its own two dozen, and an agenda the user
 * coloured here would arrive over there as the nearest thing Google had.
 * `foregroundColor` is required alongside it — black on every colour in our
 * palette, which is what the app itself draws on them.
 *
 * Best-effort like every other push in this file: the agenda is already saved on
 * our side, and Google being briefly unreachable must not fail the rename.
 */
export async function updateRemoteCalendar(
  account: { id: string; accessToken: string | null; refreshToken: string | null; tokenExpiresAt: Date | null },
  googleCalendarId: string,
  changes: { name?: string; color?: string },
  log: (error: unknown) => void,
): Promise<void> {
  const body: Record<string, string> = {};
  if (changes.name !== undefined) body.summaryOverride = changes.name;
  if (changes.color !== undefined) {
    body.backgroundColor = changes.color;
    body.foregroundColor = '#000000';
  }
  if (Object.keys(body).length === 0) return;

  try {
    const response = await googleFetch(
      account,
      `/users/me/calendarList/${encodeURIComponent(googleCalendarId)}?colorRgbFormat=true`,
      { method: 'PATCH', body: JSON.stringify(body) },
    );

    if (!response.ok) {
      const failure = await response.text();
      log(new Error(`calendarList.patch failed: ${response.status} ${failure}`));

      // An account linked before this app asked to *write* the calendar list
      // holds a token carrying only `calendar.calendarlist.readonly`, and Google
      // answers 403 ACCESS_TOKEN_SCOPE_INSUFFICIENT however well-formed the
      // request is. Nothing here can fix that — only the user re-consenting can
      // — so the account is flagged and the card offers to reconnect it, rather
      // than every rename quietly failing to arrive with no way to find out why.
      //
      // Narrow on purpose: a 403 for any other reason (a calendar shared at a
      // level that forbids this) is a fact about one calendar, not about the
      // link, and must not send the user round an OAuth flow that would change
      // nothing.
      if (response.status === 403 && failure.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
        await prisma.calendarAccount.update({
          where: { id: account.id },
          data: { needsReauth: true },
        });
      }
    }
  } catch (caught) {
    log(caught);
  }
}

/**
 * Tick a Google task off, or put it back — the one write this app makes against
 * the Tasks API.
 *
 * Unlike every other push in this file, this one is *not* best-effort: its
 * caller reports the failure and leaves our own row untouched. A tick is a fact
 * about the task rather than about our copy of it, and the two disagreeing is
 * worse than the tick not taking.
 */
export async function setRemoteTaskStatus(
  accountId: string,
  taskListId: string,
  taskId: string,
  done: boolean,
): Promise<void> {
  const account = await prisma.calendarAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error('Conta do Google não encontrada');

  const response = await googleTasksFetch(
    account,
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: done ? 'completed' : 'needsAction',
        // Google keeps a completion instant beside the status and rejects a
        // "needsAction" that still carries one.
        completed: done ? new Date().toISOString() : null,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`task patch failed: ${response.status} ${await response.text()}`);
  }
}
