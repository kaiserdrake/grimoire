'use client';

import { createContext, useContext } from 'react';
import { useColorMode } from '@chakra-ui/react';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const { colorMode, setColorMode } = useColorMode();

  const setLight = () => setColorMode('light');
  const setDark  = () => setColorMode('dark');
  const toggleTheme = () => setColorMode(colorMode === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme: colorMode, toggleTheme, setLight, setDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
