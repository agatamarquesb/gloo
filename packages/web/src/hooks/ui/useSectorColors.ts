import { useMemo } from 'react';

import { getSectorColors } from '@/theme/colors';

import { useIsDarkMode } from './useIsDarkMode';

/**
 * The sector ramp as literal hex values, for JS-side consumers that can't use a
 * Tailwind class (Recharts `fill`, inline `style`).
 *
 * The values live in CSS as per-mode custom properties, so reading them once at
 * module load would freeze whichever theme happened to be active. Depending on
 * useIsDarkMode makes the read happen again whenever the `dark` class flips.
 */
export function useSectorColors(): string[] {
  const isDark = useIsDarkMode();

  // isDark is deliberately a dependency the callback never reads: the values come
  // from CSS custom properties, and this is what re-runs the read on theme flip.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getSectorColors(), [isDark]);
}
