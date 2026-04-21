import './globals.css';
import { Providers } from './providers';
import { ColorModeScript } from '@chakra-ui/react';

export const metadata = {
  title: 'Grimoire',
  description: 'Your personal video game backlog manager',
  icons: {
    icon: '/grimoire.png',
    shortcut: '/grimoire.png',
    apple: '/grimoire.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head />
      <body>
        <ColorModeScript initialColorMode="system" storageKey="chakra-ui-color-mode" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
