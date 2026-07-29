import type { ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@heroui/react';

import { UserAvatar } from '@/components/common/UserAvatar';
import { useMe } from '@/hooks/queries/auth';
import { useTheme } from '@/hooks/ui/useTheme';
import { strings } from '@/strings/pt-BR';

import { NotificationsBell } from './NotificationsBell';
import { useProfileModal } from './ProfileContext';

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  const { data: user } = useMe();
  const { theme, toggle } = useTheme();
  const profile = useProfileModal();

  return (
    // The bar is a surface card floating on the page background: the page's own
    // padding on three sides, and a bottom gap equal to the gap between cards
    // (gap-4 / md:gap-5), so it sits in the same rhythm as everything below it.
    <header className="px-4 pt-4 pb-4 md:px-6 md:pt-6 md:pb-5">
      <div className="flex items-center justify-between gap-3 rounded-4xl bg-surface px-5 py-3 shadow-surface md:px-6">
        <h1 className="text-xl font-semibold text-surface-foreground">{title}</h1>

        {/* The app's single home for identity, appearance and alerts: the user
            chip, the theme toggle and the bell live here and nowhere else, so
            neither nav repeats them. Order is fixed — who you are, then how it
            looks, then what needs attention. */}
        <div className="flex items-center gap-1 sm:gap-2">
          {actions}

          {user ? (
            <button
              type="button"
              onClick={profile.open}
              className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-default"
            >
              <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
              {/* Name over job title, both hidden below sm where only the
                  avatar fits. leading-tight keeps the two lines reading as one
                  block instead of a stacked pair. */}
              <span className="hidden pr-1 text-left leading-tight sm:block">
                <span className="block text-sm font-medium text-surface-foreground">
                  {user.name}
                </span>
                {user.jobTitle ? (
                  <span className="block text-xs text-muted">{user.jobTitle}</span>
                ) : null}
              </span>
            </button>
          ) : null}

          {/* Icon only — a labelled button would crowd the user chip beside it. */}
          <Button
            isIconOnly
            variant="ghost"
            className="rounded-full text-muted"
            aria-label={theme === 'dark' ? strings.theme.light : strings.theme.dark}
            onPress={toggle}
          >
            {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>

          <NotificationsBell />
        </div>
      </div>
    </header>
  );
}
