import { LayoutDashboard, ListTodo } from 'lucide-react';

import { strings } from '@/strings/pt-BR';

/**
 * Single source of nav entries, shared by the desktop sidebar and the mobile
 * bottom bar — adding a page (e.g. Calendar) only needs an entry here.
 */
export const navItems = [
  { to: '/', label: strings.nav.dashboard, icon: LayoutDashboard, end: true },
  { to: '/tasks', label: strings.nav.tasks, icon: ListTodo, end: false },
] as const;
