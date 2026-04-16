/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow images from any Nested Ark backend or CDN
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'nested-ark-api-v3.onrender.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  // Silence the "react" peer dep warning during build on Vercel
  experimental: {
    esmExternals: false,
  },
};

module.exports = nextConfig;
