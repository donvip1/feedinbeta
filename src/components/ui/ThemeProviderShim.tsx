import type { ReactNode } from 'react';

interface ThemeProviderProps {
  children: ReactNode;
  attribute?: 'class' | 'data-theme';
  defaultTheme?: 'light' | 'dark' | 'system';
  enableSystem?: boolean;
}

// Ultra-light ThemeProvider without React hooks or runtime React import
export const ThemeProvider = ({
  children,
  attribute = 'class',
  defaultTheme = 'system',
  enableSystem = true,
}: ThemeProviderProps) => {
  try {
    if (typeof document !== 'undefined') {
      const systemDark = enableSystem && typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      const theme = defaultTheme === 'system' ? (systemDark ? 'dark' : 'light') : defaultTheme;
      const root = document.documentElement;

      if (attribute === 'class') {
        root.classList.toggle('dark', theme === 'dark');
      } else {
        root.setAttribute(attribute, theme);
      }
    }
  } catch {
    // no-op: theming should never break rendering
  }

  return <>{children}</>;
};
