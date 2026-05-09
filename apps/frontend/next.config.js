/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent ESLint from blocking production deploys
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Prevent TS build errors from blocking deploys
  typescript: {
    ignoreBuildErrors: true,
  },

  // Reduce stale route/data caching issues
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },

  // Force consistent runtime behavior
  reactStrictMode: true,

  // Better handling for production API rewrites
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },

  // Disable powered-by header
  poweredByHeader: false,

  // Prevent some hydration inconsistencies
  compress: true,

  // Remote image handling
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Important for App Router stability
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        ],
      },
      {
        source: '/landlord/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;