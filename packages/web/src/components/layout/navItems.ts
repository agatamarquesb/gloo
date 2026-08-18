import { CalendarDays, CircleCheck, LayoutDashboard } from 'lucide-react';

import { strings } from '@/strings/pt-BR';

/**
 * Single source of nav entries, shared by the desktop sidebar and the mobile
 * bottom bar — adding a page only needs an entry here.
 *
 * CalendarDays rather than lucide's Calendar: the latter collides by name with
 * HeroUI's Calendar component, and the two do end up in the same file often
 * enough that the import would need aliasing every time.
 *
 * CircleCheck for Tarefas — the same glyph the "Concluídas" summary tile wears,
 * which is what a task is *for*. The list icon it replaces said "this page has
 * rows on it", which is true of every page in the app.
 */
export const navItems = [
  { to: '/', label: strings.nav.dashboard, icon: LayoutDashboard, end: true },
  { to: '/tasks', label: strings.nav.tasks, icon: CircleCheck, end: false },
  { to: '/calendar', label: strings.nav.calendar, icon: CalendarDays, end: false },
] as const;
