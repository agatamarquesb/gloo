import { LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { NavLink } from 'react-router';

import { useLogout } from '@/hooks/queries/auth';
import { useTheme } from '@/hooks/ui/useTheme';
import { strings } from '@/strings/pt-BR';

import { navItems } from './navItems';
import { useProfileModal } from './ProfileContext';

const itemClass =
  'flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors';

/**
 * Below `md` the sidebar is hidden, so navigation, theme, profile and Sign Out
 * move into a bottom bar — the standard mobile-web pattern for a short nav list.
 */
export function MobileNav() {
  const logout = useLogout();
  const { theme, toggle } = useTheme();
  const profile = useProfileModal();

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

      <button type="button" onClick={profile.open} className={`${itemClass} text-muted`}>
        <UserRound className="size-5" />
        {strings.profile.title}
      </button>

      <button
        type="button"
        onClick={toggle}
        aria-label={theme === 'dark' ? strings.theme.light : strings.theme.dark}
        className={`${itemClass} text-muted`}
      >
        {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
        {strings.theme[theme === 'dark' ? 'light' : 'dark'].split(' ')[1]}
      </button>

      <button type="button" onClick={() => logout.mutate()} className={`${itemClass} text-muted`}>
        <LogOut className="size-5" />
        {strings.nav.signOut}
      </button>
    </nav>
  );
}
