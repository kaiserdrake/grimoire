import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'Grimoire',
  description: 'Your personal video game backlog manager',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
