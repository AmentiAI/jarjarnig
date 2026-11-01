import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'J.A.R.V.I.S. Command Center',
    short_name: 'JARVIS',
    description: 'Personal intelligence system',
    start_url: '/',
    display: 'standalone',
    background_color: '#030b14',
    theme_color: '#030b14',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
