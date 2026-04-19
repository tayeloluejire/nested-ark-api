/** @type {import('next').NextConfig} */

// ── Backend URL (set NEXT_PUBLIC_API_URL in Vercel environment variables) ──────
// This must be the full Render URL, e.g. https://nested-ark-api-v3.onrender.com
// It is only used SERVER-SIDE in the rewrite proxy below — never exposed to the browser.
const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'https://nested-ark-api-v3.onrender.com';

const nextConfig = {
  reactStrictMode: true,

  // ── API Proxy Rewrites ────────────────────────────────────────────────────────
  // ALL browser requests to /api/* are transparently forwarded by the Next.js
  // server to the Render backend.  Because the browser only ever talks to the
  // SAME origin (Vercel), there is NO cross-origin request and therefore
  // NO CORS preflight (OPTIONS) is ever triggered.
  //
  // This permanently fixes every CORS failure across:
  //   /api/auth/login  /api/auth/me  /api/ticker  /api/rates
  //   /api/projects/*  /api/rental/*  /api/health  — and every future endpoint.
  //
  // No changes needed on the Render backend CORS config.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND}/api/:path*`,
      },
    ];
  },

  // Allow images from Nested Ark backend or Cloudinary CDN
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'nested-ark-api-v3.onrender.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },

  // Ignore ESLint and TypeScript errors during build
  eslint:     { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors:  true },

  experimental: {
    esmExternals: false,
  },
};

module.exports = nextConfig;