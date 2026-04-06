'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');

  // Load persisted preference on mount
  useEffect(() => {
    const stored = localStorage.getItem('grimoire-theme');
    const preferred = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    apply(preferred);
  }, []);

  const apply = (t) => {
    document.documentElement.setAttribute('data-theme', t);
    setTheme(t);
    localStorage.setItem('grimoire-theme', t);
  };

  const toggleTheme = () => apply(theme === 'light' ? 'dark' : 'light');
  const setLight = () => apply('light');
  const setDark  = () => apply('dark');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setLight, setDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
