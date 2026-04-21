'use client';

import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { LastVisitedProvider } from '@/context/LastVisitedContext';
import { TabStateProvider } from '@/context/TabStateContext';

const chakraTheme = extendTheme({
  config: {
    initialColorMode: 'system',
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
          <LastVisitedProvider>
            <TabStateProvider>
              {children}
            </TabStateProvider>
          </LastVisitedProvider>
        </AuthProvider>
      </ThemeProvider>
    </ChakraProvider>
  );
}
