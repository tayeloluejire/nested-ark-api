/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Rewrite /api/* → Render backend.
   * All frontend API calls use relative /api/* paths.
   * This eliminates CORS entirely — browser never sees cross-origin request.
   */
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
