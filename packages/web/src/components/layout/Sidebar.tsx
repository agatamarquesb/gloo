import { LogOut } from 'lucide-react';
import { Button } from '@heroui/react';
import { NavLink } from 'react-router';

import { useLogout } from '@/hooks/queries/auth';
import { strings } from '@/strings/pt-BR';

import { navItems } from './navItems';

/**
 * Navigation and Sign Out only. Identity (the user chip, the profile modal) and
 * appearance (the theme toggle) belong to PageHeader — see the note there.
 */
export function Sidebar() {
  const logout = useLogout();

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 md:flex">
      {/* 20px under the wordmark rather than 32: the rail is one column of
          things and that much air read as a header sitting on its own page. */}
      <div className="mb-5 flex items-center gap-2 px-2">
        <span className="flex size-8 items-center justify-center rounded-xl bg-green text-sm font-bold text-black">
          G
        </span>
        <span className="text-lg font-semibold text-surface-foreground">{strings.appName}</span>
      </div>

      {/* Shorter rows, further apart: the two go together, since the space
          between two rows only reads as space once the rows themselves stop
          filling it. */}
      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              // Squarer than the pill it was: at a full radius the row read as a
              // capsule floating in the rail, and four capsules stacked up said
              // "four buttons" where the nav is one list. 16px keeps the corner
              // soft — and it is the same shape the hover takes, since the fill
              // and the active state are the same box.
              `flex items-center gap-3 rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted hover:bg-default hover:text-default-foreground'
              }`
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-2 border-t border-border pt-3">
        <Button
          variant="ghost"
          fullWidth
          // Same corner as the nav rows above it: this is the fourth thing in
          // the rail and its hover is the same shape as theirs.
          className="justify-start gap-3 rounded-2xl text-muted"
          onPress={() => logout.mutate()}
        >
          <LogOut className="size-5" />
          {strings.nav.signOut}
        </Button>
      </div>
    </aside>
  );
}
