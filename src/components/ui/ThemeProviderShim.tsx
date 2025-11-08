import { FC, ReactNode } from 'react';

interface ThemeProviderProps {
  children: ReactNode;
  attribute?: 'class' | 'data-theme';
  defaultTheme?: 'light' | 'dark' | 'system';
  enableSystem?: boolean;
}

// Ultra-light ThemeProvider without React hooks to avoid multi-React issues
export const ThemeProvider: FC<ThemeProviderProps> = ({
  children,
  attribute = 'class',
  defaultTheme = 'system',
  enableSystem = true,
}) => {
  try {
    const systemDark = enableSystem && typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = defaultTheme === 'system' ? (systemDark ? 'dark' : 'light') : defaultTheme;
    const root = typeof document !== 'undefined' ? document.documentElement : null;

    if (root) {
      if (attribute === 'class') {
        if (theme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      } else {
        root.setAttribute(attribute, theme);
      }
    }
  } catch (e) {
    // no-op
  }

  return <>{children}</>;
};
