import { CalendarDays, LayoutDashboard, ListTodo } from 'lucide-react';

import { strings } from '@/strings/pt-BR';

/**
 * Single source of nav entries, shared by the desktop sidebar and the mobile
 * bottom bar — adding a page only needs an entry here.
 *
 * CalendarDays rather than lucide's Calendar: the latter collides by name with
 * HeroUI's Calendar component, and the two do end up in the same file often
 * enough that the import would need aliasing every time.
 */
export const navItems = [
  { to: '/', label: strings.nav.dashboard, icon: LayoutDashboard, end: true },
  { to: '/tasks', label: strings.nav.tasks, icon: ListTodo, end: false },
  { to: '/calendar', label: strings.nav.calendar, icon: CalendarDays, end: false },
] as const;
