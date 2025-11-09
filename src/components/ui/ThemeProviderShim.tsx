import type { ReactNode } from 'react';

interface ThemeProviderProps {
  children: ReactNode;
  attribute?: 'class' | 'data-theme';
  defaultTheme?: 'light' | 'dark' | 'system';
  enableSystem?: boolean;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  // No-op ThemeProvider to avoid hook/runtime issues
  return <>{children}</>;
};
