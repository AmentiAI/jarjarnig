import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { IBM_Plex_Mono, Outfit, Syne } from 'next/font/google';
import './style.css';

const display = Syne({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700'] });
const sans = Outfit({ subsets: ['latin'], variable: '--font-sans', weight: ['300', '400', '500', '600'] });
const mono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500'] });

export const metadata: Metadata = {
  title: 'JARVIS | Command Center',
  description: 'Personal intelligence system',
  appleWebApp: {
    capable: true,
    title: 'JARVIS',
    statusBarStyle: 'black-translucent',
  },
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#030b14',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
