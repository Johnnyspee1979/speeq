import React, { createContext, useContext, useMemo, useState } from 'react';
import { darkTheme, lightTheme, type Theme } from './theme';

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // Default theme = light Govtech (Lovable design + SpeeQ groen accent).
  // Dark theme blijft beschikbaar via toggleTheme.
  const [theme, setTheme] = useState<Theme>(lightTheme);

  const toggleTheme = () => {
    setTheme((current) => (current.name === 'dark' ? lightTheme : darkTheme));
  };

  const value = useMemo(() => ({ theme, toggleTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
};
