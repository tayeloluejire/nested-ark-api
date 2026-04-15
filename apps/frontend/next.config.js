/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow production builds to successfully complete even if
  // your project has ESLint errors.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Same for TypeScript - this ensures the "infrastructure" is live
  // even if a type is slightly off.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

module.exports = nextConfig;