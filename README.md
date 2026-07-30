# Gloo

Internal task management app for a small company: one admin today, non-admin
employees later. Fully PT-BR interface, React + Fastify + Postgres, running
entirely through Docker Compose.

| | |
|---|---|
| **Frontend** | React 19 · Vite 8 · TypeScript · Tailwind 4 · HeroUI 3 · TanStack Query 5 · React Router 8 · Recharts |
| **Backend** | Node 22 · Fastify 5 · Prisma 7 · PostgreSQL 16 |
| **Tooling** | pnpm workspaces · Oxlint (lint + format) · Playwright (screenshots) |
| **Language** | UI copy is PT-BR; code, identifiers and comments are EN-US |

**Contents**

1. [Working agreement](#1-working-agreement) — read this before changing code
2. [Quick start](#2-quick-start)
3. [Commands](#3-commands)
4. [Architecture](#4-architecture)
5. [Design system](#5-design-system)
6. [App sections](#6-app-sections)
7. [Domain model](#7-domain-model)
8. [API reference](#8-api-reference)
9. [Auth and permissions](#9-auth-and-permissions)
10. [Product specification](#10-product-specification)

---

## 1. Working agreement

These rules apply to every change, by a human or an AI agent. They are not
suggestions — a change that breaks one of them is a change that needs redoing.

### 1.1 Non-negotiables

1. **Never hardcode a color.** Every color comes from the tokens in
   `packages/web/src/styles/globals.css`, consumed as a Tailwind class
   (`bg-green`, `text-tile-foreground`) or, when JS needs a literal, through
   `packages/web/src/theme/colors.ts`. A raw hex anywhere else is a bug.
   See [§5.2](#52-color-palette).
2. **Never inline user-facing copy.** All strings live in
   `packages/web/src/strings/pt-BR.ts` and are referenced as
   `strings.<area>.<key>`. New copy is written in PT-BR, except the two
   sanctioned English terms: "Tasks" and "Dashboard".
3. **Never rebuild a component HeroUI already provides.** Compose HeroUI parts
   first. If HeroUI genuinely lacks the component, ask before writing one from
   scratch. The only existing exceptions are documented wrappers in
   `components/common/` — read their header comments before touching them.
4. **Never duplicate a type between client and server.** Enums and DTOs live in
   `packages/shared/src`, imported as `@gloo/shared` by both sides.
5. **Never treat the frontend as a permission gate.** `lib/permissions.ts` only
   hides UI affordances; every mutation must be authorized server-side via
   `canMutate` in `packages/api/src/lib/authorize.ts`.
6. **Never spend a magic number where a constant exists.** Shared spacing,
   radii and widths live in `packages/web/src/theme/styleConstants.ts`; fixed
   sector ordering lives in `components/dashboard/sectorOrder.ts`.
7. **Never break dark mode.** Every UI change must be verified in both themes.
   See [§5.3](#53-dark-mode-night-mode).
8. **Never break small screens.** Layout uses flexbox/grid and relative units;
   sizes are not hardcoded. Verify at phone, tablet and desktop widths.

### 1.2 Coding standards

- Components stay small, single-purpose and self-contained. If a component
  grows past its one job, split it — `TaskModal` composing `NotesBlock`,
  `AttachmentsBlock`, `TaskSubtasks` and `TaskStatusChipSelect` is the
  reference shape.
- Reuse before adding. Before writing a card, chip, checkbox, date field or
  avatar, check `components/common/`, `components/dashboard/DashboardCard.tsx`
  and `components/tasks/`.
- Server data is fetched only through the hooks in `hooks/queries/` — one file
  per resource, keys centralised in `lib/queryKeys.ts`, HTTP through
  `lib/apiClient.ts`. Components never call `fetch` directly.
- API routes are grouped per resource under `packages/api/src/modules/<resource>/`.
  Prisma-model → DTO conversion belongs in that module's `mapper.ts`, never
  inline in a handler.
- Comments explain *why*, not *what*. The existing comments carry real decision
  history (why a wrapper exists, why a dependency array is deliberately
  incomplete, why a barrier was chosen) — preserve them, and match that density
  and tone when adding new ones.
- TypeScript is strict, with `noUnusedLocals` and `noUnusedParameters`. No
  `any`, no `@ts-ignore` — narrow the type instead.

### 1.3 Definition of done

Before declaring a change complete:

```bash
pnpm typecheck     # must pass across all three packages
pnpm lint          # oxlint, zero errors
pnpm format        # oxlint --fix
```

There is no automated test suite. Verification of UI work is visual, and the
repo ships a helper for it:

```bash
pnpm screenshot                  # dashboard, light + dark
pnpm screenshot dashboard tasks  # both pages, both themes
```

It logs in with `GLOO_EMAIL` / `GLOO_PASSWORD` from `.env`, drives the running
app with Playwright, and writes to `.screenshots/` (gitignored). Requires the
stack to be up. Look at the output for both themes before calling a UI change
done.

### 1.4 Ask, don't assume

If a requirement is ambiguous, ask a follow-up question rather than inventing
behaviour. Always ask before: introducing a new dependency, adding a component
HeroUI could have provided, adding a color outside the five brand values, or
changing the shape of an existing API response.

---

## 2. Quick start

Everything runs through Docker Compose (Postgres + API + web). No local Node
setup is required beyond Docker itself.

```bash
cp .env.example .env      # first time only; set JWT_SECRET to a long random string
docker compose up         # postgres, api (:3001), web (:5173)
```

First-time database setup, once the containers are up:

```bash
docker compose exec api pnpm exec prisma migrate dev   # create the schema
docker compose exec api pnpm exec prisma db seed       # 4 sectors + the admin user
```

Open **http://localhost:5173** and sign in with the seeded admin account
(credentials in `packages/api/prisma/seed.ts`).

Both containers run `pnpm install` at startup, so after adding a dependency on
the host just `docker compose restart api web` — no image rebuild needed.

**File watching uses polling on purpose.** Docker Desktop's bind mounts don't
deliver inotify events reliably on macOS, so both watchers were missing host
edits: `tsx watch` served 404s for routes that existed on disk, and Vite served a
*stale transform* of `packages/shared` — which surfaces as a blank page
("does not provide an export named …"), not a build error. `usePolling` in
`vite.config.ts` and `CHOKIDAR_USEPOLLING` on the api service fix both. If you
ever see a blank page right after a change to `packages/shared`, that is the
symptom to suspect; `docker compose restart web` clears it.

### Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | compose | Postgres container bootstrap |
| `DATABASE_URL` | api | Prisma connection string |
| `JWT_SECRET` | api | Signs the auth cookie — required, no default |
| `UPLOADS_DIR` | api | Avatar storage, defaults to `/app/uploads` |
| `WEB_ORIGIN` | api | CORS allow-list, defaults to `http://localhost:5173` |
| `VITE_API_URL` | web | API base, defaults to `http://localhost:3001` |
| `GLOO_EMAIL` / `GLOO_PASSWORD` | screenshots | Login used by `pnpm screenshot` |

---

## 3. Commands

| Task | Command |
|---|---|
| Typecheck everything | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Format (autofix) | `pnpm format` |
| Screenshot the app | `pnpm screenshot [dashboard\|tasks ...]` |
| Create a migration | `docker compose exec api pnpm exec prisma migrate dev --name <name>` |
| Re-seed | `docker compose exec api pnpm exec prisma db seed` |
| Browse the DB | `docker compose exec api pnpm exec prisma studio` |
| Tail logs | `docker compose logs -f api` |

---

## 4. Architecture

### 4.1 Layout

```
packages/
  shared/   enums + DTOs used by both sides — single source of truth for types
  api/      Fastify + Prisma
    prisma/           schema, migrations, seed
    src/config/       env validation (fails fast on missing JWT_SECRET/DATABASE_URL)
    src/lib/          prisma client, bcrypt hashing, canMutate authorization
    src/plugins/      auth plugin: JWT cookie + onRequest guard
    src/modules/      one folder per resource: routes.ts (+ mapper.ts / helpers)
  web/      React + Vite
    src/pages/        one folder per route
    src/components/   common/ · layout/ · dashboard/ · tasks/
    src/hooks/        queries/ (server state, one file per resource) · ui/ (local state)
    src/lib/          apiClient, queryClient, queryKeys, permissions, assetUrl
    src/theme/        colors.ts, chartColors.ts, styleConstants.ts
    src/strings/      pt-BR.ts — all user-facing copy
    src/styles/       globals.css — the palette and the only hex values in the app
scripts/    screenshot.mjs (Playwright)
```

`@/*` resolves to `packages/web/src/*` (configured in both `vite.config.ts` and
`tsconfig.json`). `@gloo/shared` is consumed as TypeScript source, not a build
artifact, so type changes propagate instantly.

### 4.2 Data flow

```
component → hooks/queries/<resource>.ts → lib/apiClient.ts → Fastify route
                                                                  ↓
                          shared DTO ← modules/<r>/mapper.ts ← Prisma → Postgres
```

- Every mutation hook invalidates the `['tasks']` key prefix on success, so
  counts, lists, charts and the calendar stay consistent without manual
  bookkeeping.
- Status changes are the one optimistic update (`useUpdateTaskStatus`): it
  patches list *and* detail caches, snapshots for rollback on error, and
  re-invalidates on settle.
- Task deletion removes the detail cache entry rather than invalidating it,
  which would refetch a task that no longer exists and 404.

---

## 5. Design system

The visual language is deliberately narrow: slim, low-chrome, pastel, generous
spacing. More is less. When in doubt, remove an element rather than add one.

### 5.1 Component sourcing

HeroUI 3 (`@heroui/react`) is the component library, built on React Aria
Components — so accessibility, focus management and keyboard behaviour come for
free and must not be re-implemented by hand. Icons come from `lucide-react`,
charts from `recharts`.

The only hand-written primitives live in `components/common/`, each for a
documented reason:

| Wrapper | Why it exists |
|---|---|
| `AppCheckbox` | HeroUI 3.2.2 / react-aria 3.50.0 ship a checkbox that is keyboard-only — the label press never fires for mouse input. This forwards the row click to the underlying input. Delete it once upstream is fixed, or it will double-toggle. |
| `DateField` | Wraps HeroUI's `DatePicker` composition tree behind the ISO-date (`YYYY-MM-DD`) string API the rest of the app uses. |
| `UserAvatar` | HeroUI `Avatar` plus initials fallback and `assetUrl` resolution for uploaded photos. |
| `SecondaryButton` | The counterpart to a primary action — Cancelar beside Salvar, and anything that dismisses rather than commits. Exists because these had drifted into three different looks (`secondary`, `ghost`, and an outline with a near-black border), so a dialog's two buttons read as unrelated controls. Use it for every cancel; never hand-roll one. |
| `SearchField` | The app's one search input. At rest it is an outline pill matching the status filter buttons; focus brings in the shadow. Magnifier sits inside the field. Shared by the Tasks filter bar and the "Minhas tarefas" card so they can't drift apart. |
| `ImageCropper` | 1:1 crop-and-zoom for a picked image. HeroUI has no cropper, and the whole interaction is a CSS transform over an `<img>` plus one `drawImage` — not worth a dependency. |

`ImageCropper` is worth knowing in detail, since it is the app's only piece of
canvas work. Geometry is one model shared by the preview and the export: a
`zoom` factor over a cover-fit baseline, plus a pan `offset` in viewport pixels,
clamped so the image always covers the square — which is what guarantees the
exported crop is exactly what the round mask showed. Panning is pointer events
(mouse, touch and pen in one path, with `touch-none` so dragging doesn't scroll
the modal); zoom is a HeroUI `Slider`; the viewport width is measured into state
with a `ResizeObserver` rather than read off a ref during render. Export draws
the mapped source square onto an offscreen canvas at up to 512px — never
upscaling — and emits a JPEG `File`.

### 5.2 Color palette

**`packages/web/src/styles/globals.css` is the only file in the app that
contains a hex value.** Everything else references tokens.

Five official brand colors:

| Token | Value | Tailwind | Meaning |
|---|---|---|---|
| `--green` | `#C4D254` | `bg-green` | **PRIMARY.** Buttons, charts, sliders, accents, "done" |
| `--blue` | `#98E0FF` | `bg-blue` | To do |
| `--yellow` | `#FFE868` | `bg-yellow` | In progress |
| `--red` | `#FFD9C9` | `bg-red` | Overdue |
| `--black` | `#000000` | `text-black` | Text that sits on top of any brand color |

Green is primary and is wired into HeroUI's semantic slots, so buttons, focus
rings, checked states and links pick it up automatically:

```
--accent, --success  → --green      (green also serves as "success/done")
--warning            → --yellow
```

`danger` is a separate HeroUI semantic slot, not a brand color. It is used for
genuinely alarming affordances: the HIGH priority chip, the delete button
(`variant="danger-soft"`), inline form errors, and the notes dot on a task row.

**Two outline tokens, both per-mode.** `--outline-control` is the edge of a
control that is *defined* by its edge — the action pills, "Limpar", "Escolher
arquivo", the link field. HeroUI's `--border` is tuned for dividers and sits at
28% lightness in dark mode, which all but vanishes against a near-black surface;
a button findable only by its label is not really outlined. So this one goes
brighter in dark and is unchanged in light. Use `border-outline-control` (or the
`outlineControl` / `actionPill` constants) on any such control.

**Green as an outline.** `--outline-green` is the token for every green
*hairline* — card borders, the rules under editable titles, the checkbox ring —
as opposed to green as a fill. It is `--green` on a light surface, but stepped
down to a desaturated `#6d7350` in dark mode: the brand value is bright enough
that a 1px line of it on near-black reads as neon and pulls focus from the
content it frames. Fills stay `--green` in both themes; only the hairlines
change. Reach for `border-outline-green`, never `border-green`.

**Label colors.** The third sanctioned exception to "five colors", for a
different reason than `--tile-*`: labels are named by the user, so the set has to
be wide enough that two of them can be told apart. Ten `--label-*` tokens are
defined in `globals.css` — the first *is* `--green` — all pastel, all carrying
black text, all mode-invariant so a label keeps its identity between themes.

Two rules keep them honest. The keys must match `LABEL_COLORS` in `@gloo/shared`,
which is what the API validates against, so a color is always a key and never a
hex. And the key → class mapping in `theme/labelColors.ts` is **written out
longhand**, not interpolated as `` `bg-label-${color}` `` — Tailwind only emits
classes it can see as literal strings, so a template would compile to nothing.

**Chart colors.** Charts do not have their own palette. They colour marks from
the tile set via `useTileColors()`, so a sector's donut slice matches the
summary tile in the same slot. `theme/chartColors.ts` holds only `CHART_SURFACE`
— the surface color used for the 2px gap between donut slices. Sector → color
slot mapping is fixed by `components/dashboard/sectorOrder.ts`, shared by the
donut and the calendar dots, so the same sector never gets two different colors.

**Reading colors from JS.** When a raw string is required (Recharts `fill`,
inline `style`), use `theme/colors.ts`:

- `getPaletteColor(key)` / `getPalette()` — the five brand values.
- `getTileColors()` — the four tile values for the *currently active* theme.
- **Prefer the `useTileColors()` hook over calling `getTileColors()` directly.**
  A bare call freezes whichever theme was active at that moment; the hook
  re-reads when the theme flips.

### 5.3 Dark mode (night mode)

Dark mode is a first-class requirement. Every surface, chip, chart and control
must be checked in both themes before a change ships.

**How it is wired.** `hooks/ui/useTheme.ts` toggles a `dark` class on
`<html>` and persists the choice to `localStorage` under `gloo-theme`, falling
back to the OS `prefers-color-scheme` on first visit. Tailwind reads that class
through `@custom-variant dark (&:is(.dark *))`. JS-side consumers read it via
`hooks/ui/useIsDarkMode.ts`, which watches the class with a `MutationObserver`
so charts restyle at exactly the same moment CSS does. The toggle is exposed in
the sidebar (desktop) and the bottom bar (mobile).

**The rule that matters most: the brand palette does not change between
themes.** `--green`, `--blue`, `--yellow`, `--red` and `--black` hold the same
values in light and dark, so a status color never shifts meaning, and buttons,
focus rings, chips and charts look the same either way. Do not add per-mode
overrides for brand tokens.

**The single documented exception** is the Dashboard task-summary tile set,
which has its own tokens precisely so darkening a tile can never leak into
`--green` or anything else:

| Token | Light | Dark |
|---|---|---|
| `--tile-todo` | `--blue` | `#6DA1B6` |
| `--tile-progress` | `--yellow` | `#B69B4D` |
| `--tile-done` | `--green` | `#939E3F` |
| `--tile-overdue` | `--red` | `#B6988E` |
| `--tile-foreground` | `--black` | `#FFFFFF` |
| `--tile-icon-backdrop` | `#FFFFFF` (filled disc) | `transparent` |
| `--tile-icon-border` | `transparent` | `#FFFFFF` (outline) |

Notes an agent must respect when touching these:

- Background and text ride the same token set (`bg-tile-*` +
  `text-tile-foreground`), so a tile and its ink can never fall out of sync.
  Never pair a tile background with an ad-hoc text color.
- The dark steps are a deliberate trade-off: white text lands at ~2.7–2.9:1,
  below the WCAG AA 4.5:1 floor. The darker steps that would clear it were
  rejected as too dull. Do not "fix" this without asking.
- The icon disc keeps identical size and edge in both modes (filled in light,
  outline in dark) so tiles never change height with the theme.
- `StatusChip` reuses the tile tokens, so a status reads identically on a task
  row and in the summary. `IN_REVIEW` has no tile counterpart and keeps the
  neutral default chip.

**Adding a dark-aware color.** Define the token in `:root`, override it in
`.dark`, map it under `@theme inline`, then use the generated Tailwind class.
Never reach for `dark:` with a literal value.

### 5.4 Spacing, radii and typography

Shared layout values live in `theme/styleConstants.ts` and should be extended
there rather than re-typed:

```ts
sidebarWidth: 'w-60'         pageContentPadding: 'p-4 md:p-6'
cardPadding: 'p-4 md:p-5'    cardGap: 'gap-4 md:gap-5'
cardRadius: 'rounded-3xl'    pillRadius: 'rounded-full'
```

Conventions in practice: cards are `rounded-3xl` on `bg-surface` with
`shadow-surface`; rows and tiles inside them are `rounded-2xl`; anything
pill-shaped (status filters, nav links, most buttons) is `rounded-full`. Page
titles are `text-xl font-semibold`, card titles `text-lg font-semibold`, body
copy `text-sm`, secondary copy `text-sm text-muted`. Padding is generous by
default — cramped content is a design bug.

### 5.5 Sound

Two effects, both in `lib/sounds.ts` and both **synthesised with the Web Audio
API rather than shipped as files** — each is a fraction of a second of noise or
tone, so generating one costs less than the request for an asset would.

| Sound | Where | Shape |
|---|---|---|
| `playWoosh()` | Clearing the notes field | White noise through a band-pass sweeping 1800→320Hz over 280ms |
| `playAlarm()` | Time blocking hitting zero | Five 880Hz beeps over ~2s |

The `AudioContext` is created lazily and resumed on use: browsers refuse to
start audio before a user gesture, and both callers are gesture-driven, so by
the time either runs the page has the permission. If audio is unavailable the
functions return silently — a decorative sound is not worth an error.

### 5.6 Motion

Animation is a priority, and it must be cheap. Rules, all enforced in
`globals.css`:

- Animate **transform, opacity and color only** — properties the compositor
  handles without layout work. No animating width, height, top or left.
- Everything is disabled under `prefers-reduced-motion: reduce`. The `gloo-rise`
  entry animation (cards and list rows rising 6px into place) is defined inside
  a `no-preference` media query; decorative hover lifts use Tailwind's
  `motion-safe:` prefix so the color feedback survives while the movement does
  not.
- Theme flips fade surfaces over 200ms instead of snapping.
- Chart entry animation is 450ms (`isAnimationActive` + `animationDuration` on
  the Recharts `Pie`).

### 5.7 Responsiveness

- The `md` breakpoint is the structural pivot: at and above it the desktop
  sidebar shows and the mobile bottom bar hides; below it, the reverse. `main`
  carries `pb-20 md:pb-0` so the fixed bottom bar never covers the last row.
- Prefer flexbox and grid with relative units. Do not hardcode pixel sizes.
- Use **container queries** when a component's width is set by its slot rather
  than by the viewport. `SectorDonutCard` is the reference: it is narrow in a
  wide Dashboard column and full-width on a phone, so it lays out against its
  own width (`@container` + `@[16rem]:flex-row`) rather than a breakpoint.
- Rows collapse rather than crush: `TaskCard` stacks its meta under the title
  below `sm` instead of squeezing the title into an unreadable column.
- Resizing the window must never break a layout. Check the whole range, not
  just the two extremes.
- **No page scrolls sideways.** `main` in `AppShell` carries `min-w-0` (so the
  content column can shrink inside the shell's flex row instead of being held
  open by its widest child) plus `overflow-x-hidden`, which catches what is
  left: a control that deliberately overhangs its column, or a value that
  refuses to wrap. Vertical scrolling is untouched. Fix the cause when you find
  one — this is the floor, not a licence to overflow.

### 5.8 Copy and i18n

All copy comes from `strings/pt-BR.ts`, grouped by area (`nav`, `auth`, `task`,
`routine`, `dashboard`, `profile`, `timeBlocking`, `theme`, `common`). The UI
is PT-BR throughout; "Tasks" and "Dashboard" stay in English by product
decision. Dates are formatted with `Intl` / `toLocaleDateString('pt-BR')`.

---

## 6. App sections

### 6.1 Login (`/login`)

`pages/LoginPage`. Centered card on the app background: app name, e-mail and
password fields (HeroUI `TextField` + `Input`), submit button. Posts to
`/api/auth/login` via `useLogin`, and on success navigates to the Dashboard. A
401 renders `strings.auth.invalidCredentials`; anything else renders the
generic error. There is no signup flow by design — employees are added as DB
rows.

### 6.2 App shell

`ProtectedRoute` guards every logged-in route: it renders a loading state while
`useMe()` resolves, redirects to `/login` on error, and otherwise renders
`AppShell`.

`AppShell` is a full-height flex row — sidebar, scrollable `main` with the
routed `Outlet`, mobile bottom bar — and owns the profile modal, exposed to
descendants through `ProfileContext` so both navs can open it.

- **`Sidebar`** (desktop, `w-60`, hidden below `md`): "G" mark and app name, nav
  links, and Sign Out. The active link is a filled `bg-accent` pill.
- **`MobileNav`** (below `md`): fixed bottom bar with the same nav items plus
  Sign Out, respecting `env(safe-area-inset-bottom)`.
- **`navItems.ts`** is the single source of nav entries for both. **Adding a
  page is one entry here** — do not add a link to either nav directly.
- **`PageHeader`**: a `rounded-4xl bg-surface` bar floating on the page
  background, with the page's own padding on three sides and a bottom gap equal
  to the gap between cards (`gap-4` / `md:gap-5`), so it sits in the same rhythm
  as everything below it rather than reading as chrome bolted on top. Page title
  on the left; on the right, optional actions then a fixed trio — **user chip →
  theme toggle → notifications bell**. Every page renders it as its first child.
  **This header is the app's single home for identity, appearance and alerts**,
  so none of the three is repeated in either nav. The user chip stacks the name
  over the job title ([§7](#7-domain-model)); both are hidden below `sm`, where
  only the avatar fits. The two icon buttons are round and carry their label via
  `aria-label` only.
- **`NotificationsBell`**: bell icon with a red dot (`bg-danger`, ringed in the
  header backdrop) whenever there is anything to report — presence only, never a
  count. Clicking opens a popover; each item is an outlined card matching the
  Dashboard's task rows, with a paired **eye** (open the entity's own modal) and
  **X** (dismiss) in its top-right corner. See [§6.6](#66-notifications).
- **`ProfileModal`**: opened from the user chip. Shows the avatar, a photo
  picker (PNG/JPEG/WebP, **no size cap**), editable **name** and **função**
  (job title) fields, and the e-mail. Clearing the job title stores `NULL`. Picking a photo hands it straight to `ImageCropper`, which takes over
  the dialog until the crop is applied. Edits are staged locally — the cropped
  photo renders as a local `blob:` preview and nothing is sent until **Salvar**,
  which uploads the avatar and then patches the name. Closing discards the
  draft; the form is keyed on the open state so it remounts fresh each time.
  Saving publishes the updated user through `syncUserCaches`, refreshing the
  header, task and routine payloads, and the assignee pickers together.

### 6.3 Dashboard (`/`)

`pages/DashboardPage`. Two independent columns rather than a strict grid, so
cards stack masonry-style at their natural heights instead of padding out rows.
Main column (2/3 at `xl`): summary → routines + sector donut side by side →
my tasks. Side column: calendar → time blocking. Everything collapses to one
column below `xl`.

All six cards are built on **`DashboardCard`**, the shared shell providing the
rounded surface, padding, entry animation, and the bold-title /
optional-subtitle / right-aligned-action header. New cards must use it.

**Task Summary Card** — four stat tiles (A fazer, Em progresso, Concluídas,
Atrasadas) fed by `/tasks/summary`, plus an "Adicionar tarefa" button in the
header. Each tile carries an icon on a disc, the count, and the label, and
navigates to `/tasks?status=<STATUS>`. This card is the origin of the
`--tile-*` palette described in [§5.3](#53-dark-mode-night-mode).

**My Tasks Card** — the logged user's tasks (`assigneeId` filter), with slim
status pills and no sort or filter controls, capped at five visible rows. Its
header carries a `SearchField` (debounced 300ms, same as the Tasks page) beside
an icon-only "+" shortcut to the create modal. Rows are the same `TaskCard` used
on the Tasks page, in its `shortDate` form ("31 de jul. 2026") — the row is half
the width it has on the Tasks page.

Three behaviours belong to this card and nowhere else:

- **Rows are dragged into order.** Press a row and drag it up or down; the whole
  row is the handle, because it already carries a click target and a grip would
  be one more thing to miss. The order lives in `localStorage`
  (`myTasksOrder.ts`) — it is one person's arrangement of a shared list, and the
  server has no column for it, the same reasoning as the dismissed
  notifications. Tasks the order has never seen sort *first*, so a task created
  a moment ago is not hidden off the bottom of a scrolling card.
- **Completing a task sinks it.** `sortByManualOrder` puts DONE last whatever
  the arrangement says: a finished row has nothing left to do on it, and leaving
  it among the live ones means reading past it every time.
- **…and lights "Feitas" for two seconds**, so the row you just ticked off has
  somewhere to go. The green edge eases back to grey over the best part of a
  second (`transition-[border-color]` on the pill), and ticking off four tasks
  in a row flashes once rather than four times — see `useCompletedFlash`, which
  watches for a task that was not DONE and now is, rather than being told by
  whichever of the three places changed it.

Its pills also carry `outlineSelected`: the current filter is marked by a green
edge instead of a green fill. A solid pill directly above a list of green-edged
task rows outweighed everything it was filtering.

**Open Tasks By Sector Card** — Recharts donut on the left, sector pills on the
right, from `/tasks/by-sector` (non-`DONE` counts). Slice order is fixed by
`sortBySectorOrder`, never by value, so a sector keeps its slot and color as
counts change. Hovering a slice or pill dims the others **and paints that pill's
edge in the slice's own colour** — which is what ties row to slice, in both
directions, without a tooltip. Clicking either navigates to
`/tasks?sectorId=<id>&status=TODO`. The pills double as the legend so identity
never rests on color alone. An all-zero dataset renders a flat placeholder ring
rather than collapsing the card. The donut hole holds a recessive neutral icon —
never a tile color, which would read as a fifth category — on the same quiet
grey a routine row and a hovered pill take (`quietSurface`).

Two things about the marks themselves:

- **No stroke, in either theme.** It used to be drawn in the card's own surface
  to widen the gap between slices; that passes for a gap on white and reads as a
  hard black outline around every slice on near-black. The padding angle does
  the separating.
- **`isAnimationActive={false}`, and not by preference.** With recharts 3 the
  entrance animation leaves every sector group empty — no `path` is ever drawn —
  once the data changes shape under it, and the chart silently disappears.
  Verified by toggling that prop alone. Re-enable it only with a recharts
  upgrade and a check that the donut survives a task changing sector.

**Routines Card** — timeline of the user's routines from `/routines`, grouped by
month with the soonest occurrence first, inside a HeroUI `ScrollShadow`. Routines
store a cadence, not a date, so `routineSchedule.ts` projects each onto its next
occurrence to sort and group them (clamping e.g. the 31st in a 30-day month).

Layout details that are load-bearing, not incidental:

- The list has a **fixed** height (`h-40`), sized to show two rows plus a sliver
  of the third — so it always reads as scrollable and the card's height never
  depends on how many routines exist. `overflow-y-scroll` with
  `[scrollbar-width:thin]` keeps the scrollbar permanently visible instead of
  letting the platform hide it until you scroll.
- `-mt-2` pulls the list into the card's header gap, close enough to the title
  that the `ScrollShadow` top fade reads against it.
- A row is checkbox → title (wrapping, plus up to three label pills underneath)
  → date → delete. The checkbox and the date/delete cluster both carry `mt-0.5`,
  putting them on the title's first line, so a title that wraps grows downward
  from a fixed top edge instead of dragging them out of alignment. The title
  wraps rather than truncating; the flex siblings keep it clear of the date.
- **The whole row opens the routine**, via a button stretched behind the content
  rather than a wrapper around it — the row also holds a checkbox and a delete
  button, and buttons can't nest. The content layer is `pointer-events-none` and
  those two opt back in.
- Rows use the same hover treatment as a task row in "Minhas tarefas" — color
  plus a slight lift, the lift behind `motion-safe:` since it is decoration. The
  scroll container carries `px-1.5 py-1` for that: padding *inside* the scroller,
  because the lifted edge is otherwise clipped by it.
- **Clicking the description opens the edit modal** — there is no pencil icon.
  It is a `<button>` around the text rather than a handler on the row, because
  the row already contains a checkbox and a delete button and buttons can't nest.
- The "Adicionar rotina" button carries `mt-auto`, pinning it to the bottom of
  the card so it lines up with the preset grid in the Time blocking card beside
  it instead of floating up when the list is short.

Controls appear only when `canMutateEntity` allows it.

**`RoutineModal`** handles both create and edit, in this order: **Título** →
selected label pills → **Responsável**, **Recorrência** and the weekday /
day-of-month select as one stacked property list → a three-up pill row → the
notes field → whichever blocks the pill row has opened.

The dialog header is a quiet "Editar"/"Adicionar rotina" with a pencil, sitting
top-left — the routine's own title carries the weight instead. The footer pairs
**Copiar link** and **Excluir** on the left with Cancelar/Salvar on the right,
both left-hand actions shown only for a routine that already exists. Since
routines have no route of their own, the copied link is the Dashboard plus a
`?rotina=<id>` param, which `RoutinesCard` consumes once the routine has loaded
and then strips from the URL so a later close doesn't reopen the dialog.

The title owns the top row alone: a larger icon, a larger input, and its green
rule. **Everything below is indented to where that rule starts** (`TITLE_INDENT`,
= the icon's width plus its gap), so the icon has its own column and no box sits
under it; the dialog is widened to `max-w-xl`, with a matching `pr-7` on the body
so the side margins stay even.

The three properties are rows, not columns. Each shares the action-pill row's
three columns — label with its icon in the first, value at the head of the
second — so values begin on the middle pill's left edge, near their labels
rather than stranded against the far side. The value carries no border, fill or
shadow in any state; `w-fit` keeps it as narrow as its text so the chevron
trails the value, and `pr-6` reserves the lane HeroUI's absolutely-positioned
chevron would otherwise share with the last character.

Field styling is done by re-pointing HeroUI's custom properties rather than
fighting its classes with `!important` — that is the supported seam. The shared
combinations live in `theme/fieldStyles.ts`, and three things about them cost a
round trip each to discover, so they are worth reading before restyling a field:

- **The fill is partly an inset shadow.** Clearing `--field-background` alone
  still leaves a visible rounded rectangle; `--field-shadow` has to go too.
- **Hover and focus backgrounds are `--field-hover` and `--field-focus`** —
  *not* `-hover`/`-focus` suffixes on `--field-background`, which is the natural
  guess and leaves the field greying under the cursor while measuring clean at
  rest.
- **Each component also layers its own background variable** over the shared
  set — `--input-bg`, `--textarea-bg`, `--select-trigger-bg`, each with `-hover`
  and `-focus`. `FLAT_INPUT` / `FLAT_TEXTAREA` / `FLAT_SELECT_TRIGGER` bundle
  the right combination per component; use those rather than assembling one.
- **An underline needs an explicit `border-b`.** The field's own border width
  comes from `--border-width-field`, which resolves to nothing once the other
  three sides are zeroed, so the rule is invisible even with its color set.

Applied: the routine title and each checklist title are a single green rule
under the text — the app's marker for "this line is editable", pinned to the
same green on hover since these are typed into, not clicked — while the three
selects are green-outlined, softly-rounded controls of a fixed height. Their
icons sit on the **labels**, not inside the controls, so the fields stay plain
text. The attachments link field borrows `BUTTON_LIKE_FIELD` to match the
outline Button beside it exactly.

The three blocks share `blockBox` from `theme/styleConstants.ts`. Its asymmetric
padding (`pr-3 pl-5`) is deliberate: each header ends in an icon-only button
that carries its own padding, so the left edge needs that much more to make the
two margins read as equal.

The pill row (`Checklist` · `Etiquetas` · `Anexos`) uses the same `grid-cols-3`
of outline pills as the Time blocking presets. Adding a block **scrolls it into
view** — it lands below the fold, so without that the button looks inert. Each
button opens something different:

- **Checklist** appends a `RoutineChecklist` block below the notes, up to five;
  the button disables at the cap. Every block shares one header shape with the
  notes and attachment blocks — icon, name, delete — and the item rows are flat,
  with no field chrome of their own. Item checkboxes are round with a green
  rule, filling green once ticked (`AppCheckbox round`). The "add item" button
  carries `-ml-3` to cancel its own padding, so its icon lands on the same left
  edge as the header icon and every checkbox above it.
- **Etiquetas** opens `LabelPicker`, a popover that is either browsing or
  editing, never both. Browsing lists every label with a checkbox to attach it
  and a pencil to edit it, over a search field, with "Criar uma nova etiqueta"
  at the foot. Editing shows a live pill preview, the name, a 5×2 color grid,
  Salvar and — when editing an existing label — Excluir.
- **Anexos** opens `AttachmentsBlock` (`components/common/`, shared with the
  task modal), below the checklists when both are present. The link field is styled as the twin of the "choose file" button
  beside it — same outline, same height — with the add button *inside* it, so
  the row reads as two controls rather than three; it is a `<form>`, so Enter
  adds the link exactly like pressing "+". Rows have no fill of their own: the
  icon's green tile is what marks them. Each carries a pencil and a trash, and
  the pencil opens a small modal to retitle the attachment or swap the
  link/file.

The notes field wears the same outlined box and header row as the checklist and
attachment blocks, so the three read as one family — the only difference being
that its name is fixed text rather than an editable field. It is **the app's
rich-text field**, and `NotesBlock` (`components/common/`) is that whole block —
box, heading, Limpar — so the routine modal and the task modal wear the same one.
Inside it, `RichNotes` is a `contentEditable` (not a textarea, which cannot hold
formatting) with bold/italic/underline/strike buttons sharing the header row, and
a **Limpar** button that empties it with a woosh.

`routines.notes` and `tasks.description` are therefore the two columns storing
markup, and the API sanitises both on write — `lib/sanitizeHtml.ts`. It works by **escaping everything first and then
re-allowing a closed list of tags** (`b i u s strong em br`), rather than
stripping dangerous ones: anything not on that list is already inert text by the
time the allowlist runs, and attributes are never re-allowed at all, which
removes `href`, `on*` and `style` as a category rather than one at a time. Two
knock-on rules: the editor writes into the DOM only when the value arrives from
outside (assigning on every render would reset the caret), and "empty" means
*renders as nothing*, so a note of only `<br>` is stored as `null`. The dialog body masks
its own scroll edges (`mask-image`), so long content fades out instead of ending
in a hard cut at the margins.

**Opening a routine shows it; it does not hand you a form.** The dialog starts
read-only and only "Editar" in its header unlocks it — `isEditing`, threaded into
`NotesBlock`, `RoutineChecklist` and `AttachmentsBlock`. Read-only means the
action pills, the formatting toolbar, Limpar, "add item", the block delete
icons, the attachment controls and the property chevrons are all gone, and the
title, notes and item text are read-only.

**The one exception is the checkboxes**, which stay live in both modes: ticking
something off is *using* a routine, not editing it. The selects are disabled
rather than hidden, with HeroUI's dimming overridden — the value still has to
read as the routine's content, not as a greyed-out field.

The header row carries the whole action set — **Copiar link**, **Deletar**, and
a single button that is **Editar** while reading and **Salvar** (primary) while
editing — sharing that row with the dialog's close button. The dialog's own
heading is `sr-only`: the routine's title carries it visually, but the dialog
still needs a name. The footer is only **Cancelar**.

Salvar on an existing routine commits and drops back to reading it rather than
closing — it is the counterpart of Editar now, not of Cancelar, and autosave
means the write has usually already happened. On a *new* routine it closes,
since creating it is the whole point of the dialog.

**Editing an existing routine autosaves.** Any change at all — a ticked
checklist item, a new attachment, a swapped assignee, a typed note — persists
~800ms after you stop, and closing the dialog by any route (backdrop, X,
Cancelar) flushes whatever the debounce hasn't written yet. The dirty check
compares a serialised payload against the last state known to be on the server,
so it catches every field without enumerating them, and never fires a no-op
PATCH.

**Creating one does not**, deliberately: a new routine has no id to PATCH, and
autosaving would litter the list with untitled rows. Salvar is what creates it.
That is also why Cancelar only closes — on an existing routine the work is
already saved.

**Empty blocks are saved as empty.** Adding a checklist or opening the
attachments block is itself the edit, so neither is filtered away on save and
both round-trip: a title-less, item-less checklist survives `parseChecklist`,
and `attachments` is nullable end to end — `null` means "no block", `[]` means
"an open but empty one". Nothing is dropped for being blank.

Two things save outside the autosave flow, both deliberate: **files upload immediately** (they need a URL before they
can be listed, which is what `POST /uploads` exists for) and **label edits save
immediately**, since a label is shared and not owned by this routine.

**Calendar Card** — HeroUI `Calendar` for the focused month, fed by
`/tasks/calendar?from&to`. The month heading is centred between the two nav
buttons (`flex-1 text-center`) so it holds still as you page through months of
differing name lengths. Days with due tasks carry up to three dots colored by
sector, using the same fixed sector→slot mapping as the donut. Selecting a day
navigates to `/tasks?dueDateFrom=<date>&dueDateTo=<date>`.

**Time Blocking Card** — purely client-side focus timer; nothing is persisted or
tied to a task. Presets 5m/10m/15m/30m/1h plus a "+" custom entry fill a 3×2
grid; "+" opens a veiled inline form accepting `hh:mm:ss` (lenient: "90" and
"1:30" both parse, right-to-left as seconds/minutes/hours, capped at 24h).
Start/pause and reset sit in the header. The countdown works from a wall-clock
deadline rather than decrementing per tick, so a throttled background tab cannot
make it drift.

### 6.4 Tasks (`/tasks`, `/tasks/:taskId`)

`pages/TasksPage`. Page header, then a single card holding three rows:

1. **`TaskFiltersBar`** — debounced search input (300ms) on the left; "Ordenar
   por" (due date / priority / progress, with an asc-desc toggle) and "Filtrar
   por" (sector, assignee) popovers on the right.
2. **`TaskStatusPills`** — big pills: Todas · To Do · Em Progresso · Atrasada ·
   Concluído. The selected pill is `variant="primary"`, the rest `outline`.
3. **Task list** — `TaskCard` rows, then a full-width "Adicionar tarefa" button.

**Filters live in the URL**, not component state. That is what lets Dashboard
cards deep-link into a pre-filtered view and makes filtered views shareable and
bookmarkable. Recognised params: `status`, `search`, `sectorId`, `assigneeId`,
`sortBy`, `sortDir`, `dueDateFrom`, `dueDateTo`. Keep new filters in the URL.

**`TaskCard`** shows title, due date · sector, status chip, progress bar, a
**subtask marker** (a checklist glyph with a dot when the task has any — always
rendered so columns stay aligned; only the dot is conditional), an attachment
count, and assignee avatars. Below `sm` the meta collapses under the
title. Clicking navigates to `/tasks/:taskId` and stamps the originating route
in router state, so a task opened from the Dashboard closes back to the
Dashboard — a URL pasted straight into the address bar falls back to `/tasks`.

### 6.5 Task modal

`TaskModal` renders over whichever page opened it, driven by the `:taskId`
route param — so any task is directly addressable by URL, and "Copiar link"
in the header copies that address.

**It is the routine modal in a second column.** Same header (Copiar link ·
Deletar · Editar/Editando, then the close button and a rule), same title on a
green underline, same property rows, same blocks — and it shares the code for all
of them: `theme/propertyRow.ts` for the rows, `NotesBlock` and `AttachmentsBlock`
for the blocks. Changing how a property looks means changing it once, for both.

The layout, at `md` and up, is the title across the top and then **one grid of
two rows and two columns**, with the vertical rule as a third column spanning
both rows (inset top and bottom by the same 1.5rem the gap gives it either side).
Below `md` it all stacks and the rule goes away.

|  | Left — what the task *is* | Right — what it *carries* |
|---|---|---|
| Row 1 | Prioridade · Deadline · Setor · Projeto · Status · Responsável · Barra de progresso | `NotesBlock` |
| Row 2 | `TaskSubtasks` | `AttachmentsBlock` |

**One grid rather than two columns of their own**, because the four blocks line
up across as well as down: the rule under the properties and the rule under
Notas are the same line, and they only stay one line if both cells belong to one
row. That row's height is pinned (`TOP_COLUMN_HEIGHT` = seven rows at
`PROPERTY_ROW_HEIGHT` plus a rem of air), the properties set it, and **Notas
scrolls inside whatever is left** rather than growing and dragging its side of
the line down the page. Property rows are a fixed height for the same reason
they are one pitch: a status chip is taller than a line of text and a progress
bar shorter, so padding-driven rows let either shift everything below it.

The footer is only Cancelar and Salvar, with no padding above it — **the last
change scrolls with the content**, as the final line of the body, and slides
under the footer where the body's own mask fades it out.

Every value in the column reads at the routine modal's **14px, in lower case**,
which is why the three selects write their own value instead of leaving it to
`Select.Value` (whose size shifts with the component's own type scale). Every chevron —
HeroUI's on a Select, and `ValueIndicator` on the two properties that open a
popover — is placed the same way: absolute, 8px in from the trigger's right edge,
which the trigger overhangs its column by. That is what keeps the column of
chevrons straight across four different kinds of control.

Property rows worth knowing:

- **Deadline** writes the date out in full — "30 de julho, 2026" — and opens a
  calendar in a popover rather than a segmented date field, because a property
  row shows a *value*, not a field. Due dates are stored as midnight UTC on the
  day chosen and formatted in UTC (`lib/formatDate.ts`); formatting them locally
  showed a task due on the 30th as due on the 29th everywhere in Brazil.
- **Projeto** has nothing to pick yet: there is no projects page or model, so the
  row exists and says "Nenhum projeto criado ainda." when pressed. It is here
  rather than waiting because the property list is the shape of a task.
- Both of those use **react-aria's `Button`, not HeroUI's**: HeroUI's brings its
  own padding, radius and hover fill, and a value that lights up under the
  cursor was the loudest thing in the column.
- **Status** is live in *both* modes, like a routine's checkboxes — moving a task
  along is using it, not editing it, and the same chip select sits on every task
  row. Its four options include **Atrasada**, which is a stored status as well as
  something a passed due date implies; see §5 for how the two coexist.
- **Responsável** shows one person as a face and a name, more than one as the
  faces alone. Once anyone is assigned, a dashed **"+"** takes the chevron's
  place beside them — the way to add the second person belongs next to the
  first, not at the far side of the row. With nobody assigned the chevron stays:
  an empty property still has to say it opens.
- **Barra de progresso** is read-only in both modes: it is what the subtasks come
  to, so it is set by ticking them off.

`TaskSubtasks` wears a routine checklist's clothes and behaves differently
underneath: a routine's items are form state that saves with the routine, while a
subtask is a row with its own endpoints. Text edits are held locally and written
**on blur** — a PATCH per keystroke would be one request per letter, each
response re-rendering the task. Ticking a box stays live outside edit mode. Its
checkboxes sit on the row's **right** edge, so the text starts on the column's
own left edge and the boxes stack into a column of their own; its heading carries
no icon, there being nothing in that column to line up against.

`NotesBlock` is shared with the routine modal and takes `compact` here: the icon
loses its fixed lead column and Limpar loses its label, because heading plus four
format buttons plus a labelled button is one item too many for half a dialog's
width — and a wrapped toolbar costs the block a line it cannot spare.

Behaviour worth preserving:

- **Autosave**, as in the routine modal: an edit persists ~800ms after you stop
  making it, and closing by any route flushes what the debounce hasn't written.
  Salvar commits and drops back to reading the task rather than closing.
- The form is seeded **once per task**, not from every server copy — re-seeding
  from an autosave's response would overwrite whatever was typed while it was in
  flight. Status, progress and subtasks are read straight from the server copy
  and stay live.
- When `canMutateEntity` is false there is no Editar and no Deletar, the status
  is fixed, and the dialog never leaves read-only — but the server is still the
  gate.

### 6.6 Notifications

Notifications are **derived, never stored**: there is no notifications table, no
read/unread state, and no endpoint. `hooks/queries/notifications.ts` recomputes
them from data the app already caches, so ticking off a routine or closing a
task clears its notification on the next refetch, with nothing to reconcile.

Two conditions raise one:

| Condition | Scope | Opens |
|---|---|---|
| A task is overdue (past due, not `DONE`) | All tasks — same scope as the Dashboard's "Atrasadas" tile | `TaskModal` |
| A routine falls due within 2 days | The signed-in user's own — same scope as the Routines card | `RoutineModal` |

Routine timing reuses `nextOccurrence` from `components/dashboard/routineSchedule.ts`
rather than reimplementing the cadence projection; both conditions compare whole
calendar days, not elapsed hours. The list is sorted most-urgent-first.

**Opening one does not navigate.** A notification carries the entity itself
(`target`), not a route, and the bell renders the matching modal as a sibling of
the popover — so it overlays whatever page you were on, and closing it (X or a
click on the backdrop) drops you straight back there rather than on the Tasks
page. This is deliberately unlike `TaskCard`, which does navigate.

**Dismissal is client-side**, persisted under `gloo-dismissed-notifications` in
`localStorage`, because the server has no notification to mark read. The trick
that makes it behave is in the id: it includes the occurrence — a task's due
date, a routine's next date — so dismissing means "this one", not "this task
forever". Reschedule the task, or let the routine come round again next week,
and a fresh notification appears. The stored list is pruned against the live
(unfiltered) set on each dismissal so it cannot grow without bound.

If a third condition is added, put it in that hook — the bell renders whatever
the hook returns and holds no logic of its own.

### 6.7 URL contract

| Route | Renders |
|---|---|
| `/login` | Login page |
| `/` | Dashboard |
| `/tasks` | Tasks list (query params drive filters/sort) |
| `/tasks/:taskId` | Tasks list with the task modal open |

---

## 7. Domain model

Defined in `packages/api/prisma/schema.prisma`; DTOs mirroring it in
`packages/shared/src/types.ts`.

| Model | Key fields |
|---|---|
| `User` | email (unique), passwordHash, name, `role: ADMIN \| EMPLOYEE`, jobTitle, avatarUrl |
| `Sector` | name (unique). Seeded: Gestão, Comercial, Marketing & Aquisição, Produto & Serviço |
| `Task` | title, description (markup — the task's notes), `priority: HIGH \| MEDIUM \| LOW`, dueDate, `status: TODO \| IN_PROGRESS \| DONE \| OVERDUE`, attachments (Json), workedMs, startedAt, completedAt, sector, createdBy |
| `TaskAssignee` | join table, cascades on task/user delete |
| `Subtask` | text, done, order — cascades with its task |
| `Routine` | description (shown as "Título"), `recurrence: WEEKLY \| MONTHLY`, weekday (0–6) or dayOfMonth (1–31), done, lastCompletedAt, notes, checklists (Json), attachments (Json), createdBy |
| `RoutineAssignee` | join table — routines carry multiple assignees, exactly like tasks |
| `Label` | name, color (a key into the `--label-*` palette, never a hex). Shared across routines |
| `RoutineLabel` | join table, cascades on either side |

**Two embedded `Json` columns, deliberately unlike `Task`/`Subtask`.** A
routine's `checklists` (`[{ title, items: [{ text, done }] }]`, capped at
`MAX_ROUTINE_CHECKLISTS` = 5) and `attachments` (`[{ id, kind, url, title }]`)
each belong to exactly one routine, are never queried or filtered on, and save
inside the routine's own PATCH — a join table would buy nothing. The cost is
that Json holds whatever was last written, so `modules/routines/mapper.ts`
re-validates both on the way out and **drops anything malformed** rather than
passing it to the client. The cap is enforced there too, not only in the UI.

Labels go the other way — a real table with a join — because they are *shared*:
the picker lists every label that exists so they can be reused, and editing or
deleting one changes it on every routine wearing it. That is the intent, not a
side effect.

**`role` vs `jobTitle` — do not conflate them.** `role` is the permission level
(`ADMIN`/`EMPLOYEE`) that `canMutate` reads; it is a DB-only change and is
deliberately not accepted by any endpoint. `jobTitle` is the free-text label
shown under the user's name in the header ("Designer") — the "função" field in
the profile modal. It is cosmetic, carries no authorization meaning, and is
therefore safe for a user to edit on themselves.

Two fields are **computed, never stored**:

- **`progress`** — percentage of completed subtasks, from `computeProgress` in
  `modules/tasks/mapper.ts`. Zero when a task has no subtasks.
- **`isOverdue`** — true when the status *is* `OVERDUE`, or when `dueDate` is in
  the past and the status is not `DONE`.

**Late means two things, and they answer as one.** `OVERDUE` is a status you can
set in the task modal — for work that is late without a deadline that says so —
*and* the state a passed due date puts an unfinished task in. `isOverdue` covers
both, so a row shows the same "atrasada" chip either way; the "Atrasada" filter
and the Dashboard's overdue tile both ask for the union (`buildWhere` and
`/tasks/summary` in `modules/tasks/routes.ts`). Keep the two in step: a query
that tests only one of them is a bug.

**The task clock** — `workedMs`, `startedAt`, `completedAt` — is written *only*
by `PATCH /tasks/:id/status`, in `timeTracking()`. Moving a task into
`IN_PROGRESS` starts a stretch (`startedAt`); moving it out banks the elapsed
milliseconds into `workedMs` and clears it; reaching `DONE` stamps
`completedAt`, and reopening the task clears that stamp. Nothing in the UI shows
any of it — it is collected for the **Gráfico de produtividade** planned for the
Tasks page. A stretch rather than one duration, because a task is not worked on
in one sitting; the live total is `elapsedMs()` in `@gloo/shared`, which is the
only place that sum is written down.

**Routine resets** are also derived at read time (`modules/routines/reset.ts`).
Weekly routines uncheck when the ISO week flips, monthly ones when the month
flips; `done`/`lastCompletedAt` stay a historical fact and the effective
"is it done now?" answer is recomputed per request. There is no cron, nothing to
backfill, and no race between readers — keep it that way.

---

## 8. API reference

All routes are prefixed `/api` and require the auth cookie unless marked
public. Static avatars are served from `/uploads/` (public: filenames are UUIDs,
and `<img>` cannot send a token).

| Method | Path | Notes |
|---|---|---|
| `POST` | `/auth/login` | Public. Sets the httpOnly JWT cookie |
| `POST` | `/auth/logout` | Public. Clears the cookie |
| `GET` | `/auth/me` | Current user |
| `GET` | `/users` | All users (for assignee pickers) |
| `PATCH` | `/users/me` | Edit the authenticated user's `name` (1–60 chars) and `jobTitle` (≤60, empty string clears it). Never `role` |
| `POST` | `/users/me/avatar` | Multipart upload, PNG/JPEG/WebP, no size cap |
| `GET` | `/sectors` · `POST` `/sectors` | List / create |
| `GET` | `/tasks` | Filters: `search`, `status` (incl. `OVERDUE`), `sectorId`, `assigneeId`, `dueDateFrom`, `dueDateTo`, `sortBy`, `sortDir` |
| `GET` | `/tasks/summary` | Counts for the four tiles; optional `assigneeId` |
| `GET` | `/tasks/by-sector` | Pending (non-`DONE`) count per sector |
| `GET` | `/tasks/calendar` | `from`/`to`; returns `{ date, sectorIds }` per day |
| `GET` | `/tasks/:id` | Detail DTO (description + attachments + subtasks) |
| `POST` | `/tasks` · `PATCH` `/tasks/:id` · `DELETE` `/tasks/:id` | Mutations gated by `canMutate`. `description` is sanitised as markup; `attachments` replaces the full list |
| `PATCH` | `/tasks/:id/status` | Status-only update, used by the optimistic hook — and the only writer of the task clock |
| `POST` | `/tasks/:taskId/subtasks` | Add a subtask |
| `PATCH` / `DELETE` | `/subtasks/:id` | Update text/done, delete |
| `GET` | `/routines` | Optional `assigneeId`; `done` reflects the current period |
| `POST` | `/routines` · `PATCH` `/routines/:id` · `DELETE` `/routines/:id` | Mutations gated by `canMutate`. `assigneeIds`/`labelIds` replace the full set; a routine must keep ≥1 assignee |
| `PATCH` | `/routines/:id/toggle` | Toggle done for the current period |
| `GET` | `/labels` · `POST` `/labels` · `PATCH` `/labels/:id` · `DELETE` `/labels/:id` | Shared labels. Deleting one detaches it from every routine |
| `POST` | `/uploads` | Multipart, any type, no size cap. Returns `{ url, filename }` **without touching a record**, so an attachment can be added to an unsaved routine |
| `GET` | `/health` | Public liveness check |

Sorting for the task list is applied after DTO mapping, because `progress` and
`isOverdue` are computed rather than columns.

---

## 9. Auth and permissions

**Authentication.** Passwords are bcrypt-hashed (cost 12) — plaintext is never
stored or logged. Login issues a JWT stored in an httpOnly, `sameSite=lax`
cookie with a 7-day TTL. A global `onRequest` hook verifies the token, reloads
the user from the database, and attaches `request.authUser`; routes opt out with
`config: { public: true }`. The frontend sends `credentials: 'include'` on every
request.

**Authorization.** One rule, `canMutate` in `packages/api/src/lib/authorize.ts`:

> A user may edit or delete an entity if they are an **admin**, its **creator**,
> or one of its **assignees**.

Everyone may create. `lib/permissions.ts` on the frontend mirrors this rule for
UI affordances only — it is not the gate. When adding a mutating route, call
`canMutate` and return 403; do not invent a second rule.

**Adding an employee** is a database insert with role `EMPLOYEE` — no code
change required.

---

## 10. Product specification

The original brief this app was built from, kept as the reference for intended
behaviour.

### Persona and roles

Used internally by a single company: the owner (admin) and, in the future, two
employees with non-admin access.

- Admins may perform all actions on all entities.
- Non-admins may create entities, and edit or delete entities they are tagged
  on as assignee.

### Pages

- Logged out: Login.
- Logged in: Dashboard (homepage), Tasks, Calendar.
- A left side panel lists the pages and holds Sign Out. Every page has a header
  row stating the page name.

### Admin user

The first user is inserted directly in the database. There is no account
creation flow; roles are modelled in the DB so employees are easy to add later.
Passwords are never stored in plain text.

### Colour palette

A single file holds every colour, reused everywhere so changing them later is
easy. Nothing hardcodes a colour.

- Green `#C4D254` — **primary**, preferred for buttons, charts, sliders, accents
- Yellow `#FFE868`
- Blue `#98E0FF`
- Red `#FFD9C9`
- Black `#000000`

Status meaning: blue = to do, yellow = in progress, green = done, red =
overdue. Black is the text colour on top of any of them.

### Night mode

All colours are prepared for a night mode version.

### Design system

- HeroUI for components; the palette is wired through its theme.
- Do not recreate components that HeroUI provides. If one is missing, ask first.
- Animations are a top priority — cover them where applicable, and keep them
  performant.
- Slim and simplistic design. More is less; visual overhead is not desired.
  Light pastel colours preferred, with enough padding and spacing that content
  never feels cramped.
- Fonts, paddings and colours are standard across all pages, via shared styling
  constants.

### Responsiveness

All pages, charts and functions render properly on tablet and mobile. Resizing
the window never breaks the layout — components adapt gracefully. Sizes are not
hardcoded; flexbox is preferred.

### Tasks page

Header row, then a tasks container with three rows: search / sort-by, filters,
and the task list. Search sits top-left; Sort By (due date, priority, progress)
and Filter By (assignee, sector, due date) sit top-right. Filters are big pills
for the statuses (All, To Do, In Progress, Overdue, Done). Each task row shows
title, due date, tags, status, progress bar and assignee pictures, with an add
button at the end. Clicking a task opens it in a modal on the same page with all
properties; specific tasks are directly accessible by URI. Editing happens
inline per property or in the modal.

### Dashboard page

A modular card structure:

- **Task Summary Card** — add-task button plus Upcoming / In Progress /
  Completed / Overdue counts; clicking navigates to Tasks with filters applied.
- **My Tasks Card** — simplified list of the logged user's tasks, no search,
  sort or filter buttons, just slim status pills, with a "+" shortcut.
- **Open Tasks By Sector Chart** — donut on the left, pills on the right showing
  pending tasks per sector; clicking a pill navigates to Tasks with filters
  applied.
- **Time Blocking Card** — preset pills (5m, 10m, 15m, 30m, 1h, +) that reset
  the timer at the top; "+" accepts a custom time.
- **Routines Card** — timeline of the user's open routines, infinite-scroll
  style, grouped by month, soonest first, max four visible. Routines can be
  checked inline, created through a modal, and edited or deleted per row.
- **Calendar Card** — slim calendar indicating days that have tasks due;
  clicking navigates to Tasks filtered by that due date.

### Task properties

Title · Description · Priority (high/medium/low) · Sub-tasks · Progress (%
calculated from sub-task closure) · Due Date · Status (To Do, In Progress, In
Review, Done) · Sector · Assignees. Non-admin assignees can change the status.
Subtasks display as a simple checklist inside the task itself, with no
properties of their own.

### Taxonomy

The app is fully PT-BR — all content is translated (priority as Alta / Média /
Baixa; status as To Do, Em Progresso, Em Review, Concluído). "Tasks" and
"Dashboard" stay in EN-US.

### Sector entity

First-class citizens for tagging tasks, hardcoded in the DB: Gestão, Comercial,
Marketing & Aquisição, Produto & Serviço.

### Routines entity

Lightweight tasks recurring weekly or monthly. Properties: description,
recurrence (weekly/monthly), due date (weekday if weekly, month day if monthly),
assignee. Status is a simple To Do / Done checkbox. Weekly routines uncheck when
the week flips, monthly ones when the month flips; the processing happens on
page load.
