import React, { createContext, useContext } from 'react';
import { useUIStore } from '../store/ui.store';
import { ThemeMode } from '../config/theme';

interface ThemeContextType {
  themeMode: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { themeMode, setTheme } = useUIStore();

  return (
    <ThemeContext.Provider value={{ themeMode, setTheme }}>
      <div className={themeMode === 'dark' ? 'dark' : ''}>{children}</div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
