/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable ESLint during production builds.
  // ESLint runs in development via `npm run lint` — not needed as a build gate.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable TypeScript type-check errors blocking production builds.
  // Type errors are caught in the IDE and CI lint step, not the build step.
  typescript: {
    ignoreBuildErrors: true,
  },

  // Rewrite /api/* to Render backend.
  // All frontend API calls use relative /api/* paths.
  // This eliminates CORS — the browser never sees a cross-origin request.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

module.exports = nextConfig;
