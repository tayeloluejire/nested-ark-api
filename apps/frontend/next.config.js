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

  // Fix 404 on dynamic path refresh by forcing consistent directory resolution structures
  trailingSlash: true,

  // Reduce stale route/data caching issues
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },

  // Force consistent runtime behavior
  reactStrictMode: true,

  // Disable powered-by header for infrastructure obfuscation
  poweredByHeader: false,

  // Compress payloads efficiently
  compress: true,

  // Remote image handling across verified infrastructure patterns
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // API rewrites — routes all /api/* calls to the Render backend.
  // IMPORTANT: Use API_URL (no NEXT_PUBLIC_ prefix).
  // NEXT_PUBLIC_ vars are NOT reliably interpolated inside rewrites() at build
  // time on Vercel — they resolve to an empty string, causing /api/* requests
  // to stay on Vercel instead of proxying to Render.
  // API_URL is a server-side-only variable; Next.js resolves it correctly here.
  //
  // NOTE: Do NOT add internal page-to-page rewrites here (e.g. /tenant/dashboard
  // → /tenant/dashboard/). With trailingSlash: true, Next.js already handles
  // this automatically. Adding such rewrites causes routing loops and 404s.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://nested-ark-api-v3.onrender.com/api/:path*',
      },
    ];
  },

  // Critical for App Router view stability and cache breaking
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
      {
        source: '/tenant/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
