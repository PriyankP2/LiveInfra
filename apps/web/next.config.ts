import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure sigma and graphology ESM packages are compiled through Next.js bundler
  transpilePackages: [
    'sigma',
    'graphology',
    'graphology-layout-forceatlas2',
  ],
};

export default nextConfig;
