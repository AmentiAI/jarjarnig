import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['msedge-tts', 'ws', 'bufferutil', 'utf-8-validate'],
};

export default nextConfig;
