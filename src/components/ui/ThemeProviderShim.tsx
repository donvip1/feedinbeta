import { useEffect, FC, ReactNode } from 'react';

interface ThemeProviderProps {
  children: ReactNode;
  attribute?: 'class' | 'data-theme';
  defaultTheme?: 'light' | 'dark' | 'system';
  enableSystem?: boolean;
}

// Lightweight theme provider shim to avoid external dependency issues
export const ThemeProvider: FC<ThemeProviderProps> = ({
  children,
  attribute = 'class',
  defaultTheme = 'system',
  enableSystem = true,
}) => {
  useEffect(() => {
    try {
      const systemDark = enableSystem && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = defaultTheme === 'system' ? (systemDark ? 'dark' : 'light') : defaultTheme;
      const root = document.documentElement;

      if (attribute === 'class') {
        root.classList.toggle('dark', theme === 'dark');
      } else {
        root.setAttribute(attribute, theme);
      }
    } catch (e) {
      // Fail silently if SSR or environment limitations
    }
  }, [attribute, defaultTheme, enableSystem]);

  return <>{children}</>;
};
