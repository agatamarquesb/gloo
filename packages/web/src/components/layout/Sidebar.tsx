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
      <div className="mb-8 flex items-center gap-2 px-2">
        <span className="flex size-8 items-center justify-center rounded-xl bg-green text-sm font-bold text-black">
          G
        </span>
        <span className="text-lg font-semibold text-surface-foreground">{strings.appName}</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
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
          className="justify-start gap-3 text-muted"
          onPress={() => logout.mutate()}
        >
          <LogOut className="size-5" />
          {strings.nav.signOut}
        </Button>
      </div>
    </aside>
  );
}
