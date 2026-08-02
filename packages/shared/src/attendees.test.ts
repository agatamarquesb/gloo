import { describe, expect, it } from 'vitest';

import { countOtherAttendees } from './types';

/**
 * The rule that decides whether anyone can be emailed at all.
 *
 * Worth testing directly because both sides depend on it for different things —
 * the client to decide whether to ask, the API to decide whether to pass
 * `sendUpdates=all` — and getting it wrong in the permissive direction means
 * mail leaving the building unasked.
 */
describe('countOtherAttendees', () => {
  it('is zero for an event with nobody on it', () => {
    expect(
      countOtherAttendees({ createdById: 'me', assigneeIds: [], externalAttendees: [] }),
    ).toBe(0);
  });

  it('is zero when the only assignee is the creator', () => {
    // The case the whole rule exists for: Google never invites you to your own
    // meeting, so this must not offer to notify anyone.
    expect(
      countOtherAttendees({ createdById: 'me', assigneeIds: ['me'], externalAttendees: [] }),
    ).toBe(0);
  });

  it('counts assignees who are not the creator', () => {
    expect(
      countOtherAttendees({
        createdById: 'me',
        assigneeIds: ['me', 'ana', 'jo'],
        externalAttendees: [],
      }),
    ).toBe(2);
  });

  it('counts an assignee list that does not include the creator at all', () => {
    expect(
      countOtherAttendees({ createdById: 'me', assigneeIds: ['ana'], externalAttendees: [] }),
    ).toBe(1);
  });

  it('counts external guests', () => {
    // Someone with no Gloo account is still a real inbox.
    expect(
      countOtherAttendees({
        createdById: 'me',
        assigneeIds: ['me'],
        externalAttendees: ['cliente@fora.com'],
      }),
    ).toBe(1);
  });

  it('adds assignees and external guests together', () => {
    expect(
      countOtherAttendees({
        createdById: 'me',
        assigneeIds: ['me', 'ana'],
        externalAttendees: ['a@fora.com', 'b@fora.com'],
      }),
    ).toBe(3);
  });

  it('does not credit the creator twice when listed more than once', () => {
    expect(
      countOtherAttendees({
        createdById: 'me',
        assigneeIds: ['me', 'me'],
        externalAttendees: [],
      }),
    ).toBe(0);
  });

  it('treats an unknown creator as not being on the event', () => {
    // A new event has no creator on record; everyone picked so far is someone
    // else, and the dialog should say so.
    expect(
      countOtherAttendees({ createdById: '', assigneeIds: ['ana', 'jo'], externalAttendees: [] }),
    ).toBe(2);
  });
});
