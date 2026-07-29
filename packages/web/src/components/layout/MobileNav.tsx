import { LogOut } from 'lucide-react';
import { NavLink } from 'react-router';

import { useLogout } from '@/hooks/queries/auth';
import { strings } from '@/strings/pt-BR';

import { navItems } from './navItems';

const itemClass =
  'flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors';

/**
 * Below `md` the sidebar is hidden, so navigation and Sign Out move into a
 * bottom bar — the standard mobile-web pattern for a short nav list. Profile
 * and theme are not repeated here: they live in PageHeader, which is on screen
 * at every width.
 */
export function MobileNav() {
  const logout = useLogout();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `${itemClass} ${isActive ? 'text-accent-soft-foreground' : 'text-muted'}`
          }
        >
          <Icon className="size-5" />
          {label}
        </NavLink>
      ))}

      <button type="button" onClick={() => logout.mutate()} className={`${itemClass} text-muted`}>
        <LogOut className="size-5" />
        {strings.nav.signOut}
      </button>
    </nav>
  );
}
