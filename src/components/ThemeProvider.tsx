import React, { createContext, useContext, useEffect } from 'react';

interface ThemeContextType {
  theme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'light' });

interface ThemeProviderProps {
  theme: 'light' | 'dark';
  children: React.ReactNode;
}

export default function ThemeProvider({ theme, children }: ThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);