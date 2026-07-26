# gloo

You are a Senior Software Engineer. Create a task management application from scratch. Setup the frontend, backend, databases required and APIs. 

Front-end stack:
- React
- Vite
- Typescript
- Tailwind
- TanstackQuery
- Oxc for linting and formatting

Backend-stack: 
- Node
- Postgres

Coding Patterns:
- Make sure to reuse code as much as possible
- Keep components small, single-purpose, self-contained
- Avoid duplicating code

Coding Process:
- If something isn't clear, ask. Do not assume
- Always test your changes with typescript and run formatting
- Make follow-up questions to better refine the requirements
- Use coding best practices
- Avoid coding smells

Persona:
This app will be used internally by single company, which is composed of a the company owner (admin) and, in the future, 2 employees which should have non-admin access. 

Roles:
- Admins are allowed to do all possible actions, at all possible entities
- Non-admins are only allowed to create entities, or edit/delete entities they're tagged as assignee

Logged Out Pages:
- Login

Logged In Pages:
- Dashboard (homepage)
- Tasks 
- Calendar

Login Page:
- Create a login page with email/password protection

Logged In App Structure:
- There should be a sidepanel at the leftmost side with pages
- Except the header, pages should have a header row stating the page name
- Sign Out button in the side panel

Admin User:
- Insert the very first user in the DB, email: "linemarques316@gmail.com", password: "Bezzosz@12"
- For now, we won't add any non-admin users, so no need for an account creation flow
- Make sure to setup the roles in the DB so it's easy to add them in the future

Auth:
- Do not store plain text passwords. Encode/decode them properly to guarantee security.

Colour Pallete:

Create a file containing all colours used. Always reuse from this file, to make changing later easy. Do not hardcode colours. 

Main - #FFCA26
Secondary - #F3E8CC 
Tertiary - #19532B
Fourtiary - #9ABC04

Night Mode:
Prepare all colours for a night mode version

Design System:
- Use heroui for design system components
- Setup the colour pallete through themes
- Do not recreate components from scratch unless not available at heroui. Even then, ask me first.
- Animations is a top-priority. Make sure to cover them where applicable, and that they're performatic.
- Slim and simplistic design. More is less. Visual overhead is not desired. Light pastel colours preferred. Enough padding and spacing to not have cramped content.
- Fonts, paddings and colours should be standard accross all pages. Create styling contants and reuse for easier code maintenance.

Responsiveness:
- All pages, charts and functions should render properly on tablet and mobile devices
- Resizing the window should not break the layout, components should adapt gracefully
- Don't hardcode sizes, flexbox preferred

Tasks Page:
- Header row
- Tasks container containing 3 rows: Search/SortBy, Filters and Tasks
- Search bar on the top-left
- Sort By [due date, priority, progress] button on the top-right, alongside Filter By [assignee, sector, due date] button
- Filters should be big pills containing the statuses [All, To Do, In Progress, Overdue, Done]
- List of tasks below inside a card, each displaying title, due date, tags, status,  progress bar, assignee pictures
- Add task button at the end
- Clicking a task should open it inside a modal in front, at the same page, fully displaying properties
- Specific tasks should be directly acessible through the URI
- Editing can happen inline for each property, or at the task modal

Dashboard Page:
- Will follow a modular card structure
- Task Summary Card: Add new task button and card showing "Upcoming/In Progress/Completed/Overdue" tasks. Clicking navigate to tasks applying filters.
- My Tasks Card: show a simplified version of the list of tasks assigned to the logged user, with no search, sort or filter buttons. Just the status filter pills, at a slim version. "+" button as a short cut to add a new one. 
- Open Tasks By Sector Chart: Donut chart at the left, with pills at the right showing how many tasks are pending per each sector. Clicking pills navigates to task pages with filters applied.
- Time Blocking Card: Pré-set options [5m,10m,15m,30m,1h,+] as pills, which resets the timer at the top. "+" inputs a custom time. 
- Routines Card: Show a timeline of open routines assigned to the logged user, infinite scroll style, grouped per month. Should allow checking routines inline, as well as creating new routines through a modal. Hovering rotuines should allow editing/deleting them. Most close to the due date on the top. Max 4 visible at a time. 
- Calendar Card: slim and lightweight calendar which indicators when there are tasks with due date on each day. Clicking navigates to tasks page filtering by that due date.


Task Properties:
- Title
- Description
- Priority: [high/medium/low]
- Sub-tasks
- Progress: % calculated from sub-task closure 
- Due Date
- Status: [To Do, In Progress, In Review, Done]
- Sector
- Assignees (non-admins assigned should be able to change the status)

Subtasks:
- Should display as a simple checklist inside the task-itself with no properties

Taxonomy:
Although i'm giving you english instructions, this app should be fully in PT-BR. Translate all content. Some examples:
- Task Properties: [Alta/Média/Baixa]
- Status: [To Do, Em Progresso, Em Review, Concluído]

There are a couple of exceptions where we'd like to keep the term in EN-US:
- "Tasks"
- "Dashboard" 

Sector Entity:
- Should be available as first-class citizens for tagging tasks
- Available sectors (can hardcode at the DB): ["Gestão", "Comercial", "Marketing & Aquisição", "Produto & Serviço"] 

Routines Entity:
- Lightweight tasks that occur in a weekly or montly basis
- Properties include only: Description, recurrence [weekly/montly], Due Date (if weekly  weekday, if montly month day)
- Status is just "To Do/Done" (just a simple checkbox)
- Assignee

How Routines Work:
- For weekly routines: when the week flips, they should be unchecked automatically
- For montly routines: when the month flips, they shoudl be unchecked automatically
- This processing can happen at the initial page load

For each page and card, i have several pictures of how i intend them to look like, please use them as reference when constructing the layout. Can i send them over?
---

# Running the app

Everything runs through Docker Compose (Postgres + API + web).

```bash
cp .env.example .env      # first time only; set JWT_SECRET to any long random string
docker compose up         # starts postgres, api (:3001) and web (:5173)
```

First-time database setup, once the containers are up:

```bash
docker compose exec api pnpm exec prisma migrate dev   # create the schema
docker compose exec api pnpm exec prisma db seed       # 4 sectors + the admin user
```

Then open **http://localhost:5173** and sign in with the seeded admin account.

## Day-to-day

| Task | Command |
|---|---|
| Typecheck everything | `pnpm typecheck` |
| Lint / format | `pnpm lint` · `pnpm format` |
| Create a migration | `docker compose exec api pnpm exec prisma migrate dev --name <name>` |
| Re-seed | `docker compose exec api pnpm exec prisma db seed` |
| Browse the DB | `docker compose exec api pnpm exec prisma studio` |
| Tail logs | `docker compose logs -f api` |

Both containers run `pnpm install` at startup, so after adding a dependency on
the host just `docker compose restart api web` — no image rebuild needed.

## Layout

```
packages/
  shared/   enums + DTOs used by both sides (single source of truth for types)
  api/      Fastify + Prisma; routes grouped per resource under src/modules/
  web/      React + Vite; pages/, components/, hooks/queries/ (one file per resource)
```

## Conventions worth knowing

- **Colors** live in `packages/web/src/styles/globals.css` (brand/UI) and
  `packages/web/src/theme/chartColors.ts` (chart series, which need literal
  values in JS). Nothing else defines a hex.
- **Copy** lives in `packages/web/src/strings/pt-BR.ts`. Components never inline
  user-facing text.
- **Permissions** are enforced server-side by `canMutate` in
  `packages/api/src/lib/authorize.ts` (admin, creator, or assignee). The
  frontend mirror in `lib/permissions.ts` only hides controls — it is not the
  gate.
- **Adding a page** is one entry in `packages/web/src/components/layout/navItems.ts`;
  the desktop sidebar and mobile bottom bar both read from it.
- **Adding an employee** is a DB insert (role `EMPLOYEE`) — no code change.
