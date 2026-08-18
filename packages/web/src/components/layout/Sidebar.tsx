import { useState } from 'react';
import { ChevronDown, FolderKanban, LogOut } from 'lucide-react';
import { Button } from '@heroui/react';
import { NavLink } from 'react-router';

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
 * Labels and nothing else for now: neither page exists yet, so these are the
 * shape of the menu rather than two ways into it. The moment there is somewhere
 * to go they become NavLinks like the rows above.
 */
const PROJECT_ITEMS = [strings.nav.allProjects, strings.nav.projectsCalendar];

/**
 * Navigation and Sign Out only. Identity (the user chip, the profile modal) and
 * appearance (the theme toggle) belong to PageHeader — see the note there.
 */
export function Sidebar() {
  const logout = useLogout();
  const [isProjectsOpen, setProjectsOpen] = useState(false);
  /**
   * Which of the two is on screen. Component state for now, and the one place
   * this list will not need changing when the pages exist: it becomes the route
   * match, and the green stretch of the rule follows it by itself.
   */
  const [selectedProject, setSelectedProject] = useState(0);

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
            className={`${NAV_ROW} ${NAV_ROW_IDLE} w-full cursor-pointer justify-between`}
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
              {PROJECT_ITEMS.map((label, index) => {
                const isSelected = index === selectedProject;

                return (
                  // The rule down the left is what says these belong to the row
                  // above: one segment per item, so the line is continuous and
                  // the selected item can thicken its own stretch of it without
                  // breaking the run.
                  <li key={label} className="flex items-stretch gap-3 pl-6">
                    {/* A fixed 4px lane with the mark centred in it, rather than
                        the mark itself being the column: grown from the left
                        edge, the selected segment thickened rightwards and the
                        line took a step sideways at whichever item was on. Now
                        the thin grey and the thick green share one axis. */}
                    <span aria-hidden className="flex w-1 shrink-0 justify-center">
                      <span
                        className={`rounded-full transition-[width,background-color] ${
                          isSelected ? 'w-full bg-accent' : 'w-0.5 bg-border'
                        }`}
                      />
                    </span>
                    <button
                      type="button"
                      aria-current={isSelected ? 'page' : undefined}
                      onClick={() => setSelectedProject(index)}
                      className={`flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-default ${
                        isSelected
                          ? 'font-medium text-surface-foreground'
                          : 'text-muted hover:text-default-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
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
