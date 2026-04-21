/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.igdb.com' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/config',
        destination: `${process.env.INTERNAL_API_URL || 'http://grimoire-backend:3001'}/api/config`,
      },
    ];
  },
};

module.exports = nextConfig;
