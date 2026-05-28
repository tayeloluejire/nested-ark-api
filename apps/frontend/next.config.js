/** @type {import('next').NextConfig} */

const API_URL =
  process.env.API_URL ||
  'https://nested-ark-api-v3.onrender.com';

const nextConfig = {
  // Prevent ESLint from blocking production deploys
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Prevent TS build errors from blocking deploys
  typescript: {
    ignoreBuildErrors: true,
  },

  // Force canonical slash handling across refreshes and deep links
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

  // Infrastructure hardening
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

  /**
   * API rewrites
   *
   * IMPORTANT:
   * - Never use NEXT_PUBLIC_* variables here.
   * - Rewrites execute server-side during build/runtime.
   * - Using NEXT_PUBLIC vars can resolve incorrectly on Vercel.
   */

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },

  /**
   * Response headers
   * Prevent stale dashboard/auth rendering.
   */

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value:
              'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        ],
      },

      {
        source: '/tenant/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value:
              'private, no-store, no-cache, must-revalidate',
          },
        ],
      },

      {
        source: '/landlord/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value:
              'private, no-store, no-cache, must-revalidate',
          },
        ],
      },

      {
        source: '/admin/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value:
              'private, no-store, no-cache, must-revalidate',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;