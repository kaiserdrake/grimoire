'use client';

import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';

const chakraTheme = extendTheme({
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
  fonts: {
    heading: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
    body:    `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
  },
});

export function Providers({ children }) {
  return (
    <ChakraProvider theme={chakraTheme} resetCSS={false}>
      <ThemeProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ThemeProvider>
    </ChakraProvider>
  );
}
