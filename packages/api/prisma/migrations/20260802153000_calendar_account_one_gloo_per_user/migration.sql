-- One Gloo account per user, enforced in the database.
--
-- The model's @@unique([userId, provider, googleSub]) covers linked Google
-- accounts, but cannot cover this one: the Gloo account has a null googleSub,
-- and Postgres treats nulls as distinct, so that constraint lets a user hold
-- any number of Gloo accounts. Two simultaneous first-ever calendar requests
-- would each find none and each create one.
--
-- Written by hand because a partial index has no schema syntax in Prisma. It is
-- what makes ensureCalendarProvisioned's create/re-read race safe.
CREATE UNIQUE INDEX "calendar_accounts_one_gloo_per_user"
  ON "calendar_accounts" ("userId")
  WHERE "provider" = 'GLOO';
