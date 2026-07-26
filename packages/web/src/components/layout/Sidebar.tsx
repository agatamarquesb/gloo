import { LogOut, Moon, Sun } from 'lucide-react';
import { Button } from '@heroui/react';
import { NavLink } from 'react-router';

import { UserAvatar } from '@/components/common/UserAvatar';
import { useLogout, useMe } from '@/hooks/queries/auth';
import { useTheme } from '@/hooks/ui/useTheme';
import { strings } from '@/strings/pt-BR';

import { navItems } from './navItems';
import { useProfileModal } from './ProfileContext';

export function Sidebar() {
  const logout = useLogout();
  const { data: me } = useMe();
  const { theme, toggle } = useTheme();
  const profile = useProfileModal();

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 md:flex">
      <div className="mb-8 flex items-center gap-2 px-2">
        <span className="flex size-8 items-center justify-center rounded-xl bg-main text-sm font-bold text-tertiary">
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

      <div className="mt-2 flex flex-col gap-1 border-t border-border pt-3">
        {me ? (
          <button
            type="button"
            onClick={profile.open}
            className="flex items-center gap-2 rounded-full px-2 py-1.5 text-left transition-colors hover:bg-default"
          >
            <UserAvatar name={me.name} avatarUrl={me.avatarUrl} size="sm" />
            <span className="flex-1 truncate text-sm font-medium text-surface-foreground">
              {me.name}
            </span>
          </button>
        ) : null}

        <Button variant="ghost" fullWidth className="justify-start gap-3 text-muted" onPress={toggle}>
          {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          {theme === 'dark' ? strings.theme.light : strings.theme.dark}
        </Button>

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
