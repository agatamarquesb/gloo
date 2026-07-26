import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'gloo-theme';

export type ThemeMode = 'light' | 'dark';

function initialTheme(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Applies the theme as a `dark` class on <html> — the signal both Tailwind's
 * dark variant and the JS-side chart palette (useIsDarkMode) read.
 */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggle };
}
