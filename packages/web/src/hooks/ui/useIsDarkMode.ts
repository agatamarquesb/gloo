import { useEffect, useState } from 'react';

function readIsDark(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/**
 * Tracks the `dark` class the theme toggle stamps on <html>, so JS-side
 * consumers (charts, which need literal color values) restyle on theme change
 * the same way CSS-side consumers do.
 */
export function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(readIsDark);

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(readIsDark()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
