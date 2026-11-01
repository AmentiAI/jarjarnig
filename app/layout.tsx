import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './style.css';

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
