-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('GLOO', 'GOOGLE');

-- CreateEnum
CREATE TYPE "EventRecurrence" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "calendar_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "displayName" TEXT NOT NULL,
    "isCollapsed" BOOLEAN NOT NULL DEFAULT false,
    "googleSub" TEXT,
    "googleEmail" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "grantedScope" TEXT,
    "needsReauth" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendas" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isReadOnly" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "googleCalendarId" TEXT,
    "googleSyncToken" TEXT,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "agendaId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "timeZone" TEXT NOT NULL,
    "recurrence" "EventRecurrence",
    "recurrenceUntil" TIMESTAMP(3),
    "recurringEventId" TEXT,
    "originalStart" TIMESTAMP(3),
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "googleEventId" TEXT,
    "googleICalUid" TEXT,
    "googleEtag" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "externalAttendees" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_assignees" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "calendar_event_assignees_pkey" PRIMARY KEY ("eventId","userId")
);

-- CreateTable
CREATE TABLE "google_oauth_states" (
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_oauth_states_pkey" PRIMARY KEY ("state")
);

-- CreateIndex
CREATE INDEX "calendar_accounts_userId_idx" ON "calendar_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_accounts_userId_provider_googleSub_key" ON "calendar_accounts"("userId", "provider", "googleSub");

-- CreateIndex
CREATE INDEX "agendas_userId_idx" ON "agendas"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "agendas_accountId_googleCalendarId_key" ON "agendas"("accountId", "googleCalendarId");

-- CreateIndex
CREATE INDEX "calendar_events_agendaId_startsAt_idx" ON "calendar_events"("agendaId", "startsAt");

-- CreateIndex
CREATE INDEX "calendar_events_startsAt_idx" ON "calendar_events"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_recurringEventId_originalStart_key" ON "calendar_events"("recurringEventId", "originalStart");

-- CreateIndex
CREATE INDEX "calendar_event_assignees_userId_idx" ON "calendar_event_assignees"("userId");

-- CreateIndex
CREATE INDEX "google_oauth_states_expiresAt_idx" ON "google_oauth_states"("expiresAt");

-- AddForeignKey
ALTER TABLE "calendar_accounts" ADD CONSTRAINT "calendar_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendas" ADD CONSTRAINT "agendas_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "calendar_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendas" ADD CONSTRAINT "agendas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "agendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_recurringEventId_fkey" FOREIGN KEY ("recurringEventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_assignees" ADD CONSTRAINT "calendar_event_assignees_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_assignees" ADD CONSTRAINT "calendar_event_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_oauth_states" ADD CONSTRAINT "google_oauth_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
