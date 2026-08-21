import { useEffect, useState } from 'react';
import { ChevronDown, FolderKanban, LogOut } from 'lucide-react';
import { Button } from '@heroui/react';
import { NavLink, useMatch } from 'react-router';

import { useLogout } from '@/hooks/queries/auth';
import { modalDivider } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import { navItems } from './navItems';

/**
 * A row in the rail, and the two states it can be in.
 *
 * Written down because there are two kinds of row now — the links, and the
 * button Projetos opens with — and a hover that differs between them would say
 * they are different kinds of thing when they are the same list.
 *
 * Squarer than the pill it was: at a full radius the row read as a capsule
 * floating in the rail, and four capsules stacked up said "four buttons" where
 * the nav is one list. 12px keeps the corner soft — and it is the shape the
 * hover takes too, since the fill and the active state are the same box.
 */
const NAV_ROW = 'flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium transition-colors';
const NAV_ROW_ACTIVE = 'bg-accent text-accent-foreground';
const NAV_ROW_IDLE = 'text-muted hover:bg-default hover:text-default-foreground';

/**
 * What Projetos opens onto.
 *
 * Todos os projetos is a route now — the same /projects the Tasks page's folders
 * already lead to, so the rail and the folders are two ways into one page rather
 * than two different ideas of where projects live. Calendário de projetos has
 * nowhere to go yet, so it stays a label; it gets a `to` the moment its page
 * exists and needs nothing else here.
 */
const PROJECT_ITEMS = [
  { label: strings.nav.allProjects, to: '/projects' },
  { label: strings.nav.projectsCalendar, to: null },
] as const;

/**
 * One item under Projetos: the rule's own segment, then the label.
 *
 * The two live together because the green stretch belongs to the item that is
 * on, and the only thing that knows which item is on is the link wrapped around
 * both of them.
 */
function ProjectItem({ label, isSelected }: { label: string; isSelected: boolean }) {
  return (
    <>
      {/* A fixed 4px lane with the mark centred in it, rather than the mark
          itself being the column: grown from the left edge, the selected segment
          thickened rightwards and the line took a step sideways at whichever
          item was on. Now the thin grey and the thick green share one axis. */}
      <span aria-hidden className="flex w-1 shrink-0 justify-center">
        <span
          className={`rounded-full transition-[width,background-color] ${
            isSelected ? 'w-full bg-accent' : 'w-0.5 bg-border'
          }`}
        />
      </span>
      <span
        className={`flex-1 rounded-lg px-2 py-1.5 text-sm transition-colors ${
          isSelected
            ? 'font-medium text-surface-foreground'
            : 'text-muted group-hover:bg-default group-hover:text-default-foreground'
        }`}
      >
        {label}
      </span>
    </>
  );
}

/**
 * Navigation and Sign Out only. Identity (the user chip, the profile modal) and
 * appearance (the theme toggle) belong to PageHeader — see the note there.
 */
export function Sidebar() {
  const logout = useLogout();
  /**
   * Any projects page, the index and a single project alike: the group is about
   * that whole branch of the app, not about one URL in it.
   */
  const isProjectsRoute = useMatch('/projects/*') !== null;
  const [isProjectsOpen, setProjectsOpen] = useState(isProjectsRoute);

  /**
   * Landing on a projects page unfolds the group — otherwise arriving from the
   * Tasks page's folders leaves the rail claiming nothing is open. It fires on
   * the crossing rather than on every render, so folding it away while staying
   * on the page still works.
   */
  useEffect(() => {
    if (isProjectsRoute) setProjectsOpen(true);
  }, [isProjectsRoute]);

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 md:flex">
      <div className="flex items-center gap-2 px-2">
        <span className="flex size-8 items-center justify-center rounded-xl bg-green text-sm font-bold text-black">
          G
        </span>
        <span className="text-lg font-semibold text-surface-foreground">{strings.appName}</span>
      </div>

      {/* The rule under the wordmark, with its own air either side: it closes
          the app's name off from the pages under it, which is the one place in
          this rail where two different kinds of thing meet. Wider below than
          above, so the nav reads as starting after the line rather than
          straddling it. */}
      <div className={`${modalDivider} mt-4 mb-5`} />

      {/* Shorter rows, further apart: the two go together, since the space
          between two rows only reads as space once the rows themselves stop
          filling it. */}
      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `${NAV_ROW} ${isActive ? NAV_ROW_ACTIVE : NAV_ROW_IDLE}`}
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}

        {/* Projetos: the one entry that opens onto other entries instead of a
            page of its own, so it is a button and a list rather than a link.
            Folded shut to begin with — the rail is three lines long and a fourth
            that arrives already unfolded reads as five. */}
        <div className="flex flex-col">
          <button
            type="button"
            aria-expanded={isProjectsOpen}
            onClick={() => setProjectsOpen((open) => !open)}
            /* Folded away on a projects page, the row wears the page's own
               state: the item that would have shown it is not on screen, and a
               rail that says nothing is open while a projects page is open is
               worse than a parent standing in for its child. */
            className={`${NAV_ROW} ${
              isProjectsRoute && !isProjectsOpen ? NAV_ROW_ACTIVE : NAV_ROW_IDLE
            } w-full cursor-pointer justify-between`}
          >
            <span className="flex items-center gap-3">
              {/* A folder seen head-on with its contents showing — and the same
                  glyph the task dialog's Projeto row wears, so one idea keeps one
                  picture across the app. */}
              <FolderKanban className="size-5" />
              {strings.nav.projects}
            </span>
            {/* Points down when the list is out and right when it is away — the
                arrow is the state, which is why it turns rather than swapping
                for another glyph. */}
            <ChevronDown
              className={`size-4 transition-transform ${isProjectsOpen ? '' : '-rotate-90'}`}
            />
          </button>

          {isProjectsOpen ? (
            <ul className="mt-1 flex flex-col">
              {PROJECT_ITEMS.map(({ label, to }) => (
                // The rule down the left is what says these belong to the row
                // above: one segment per item, so the line is continuous and
                // the selected item can thicken its own stretch of it without
                // breaking the run.
                <li key={label} className="flex">
                  {to ? (
                    <NavLink to={to} className="group flex flex-1 items-stretch gap-3 pl-6">
                      {({ isActive }) => <ProjectItem label={label} isSelected={isActive} />}
                    </NavLink>
                  ) : (
                    // No page behind it yet, so no hover and nothing to press:
                    // a row that lights up under the cursor and then does
                    // nothing is a promise the app cannot keep.
                    <span className="flex flex-1 items-stretch gap-3 pl-6">
                      <ProjectItem label={label} isSelected={false} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </nav>

      <div className="mt-2 border-t border-border pt-3">
        <Button
          variant="ghost"
          fullWidth
          // Same corner as the nav rows above it: this is the fourth thing in
          // the rail and its hover is the same shape as theirs.
          className="justify-start gap-3 rounded-xl text-muted"
          onPress={() => logout.mutate()}
        >
          <LogOut className="size-5" />
          {strings.nav.signOut}
        </Button>
      </div>
    </aside>
  );
}
