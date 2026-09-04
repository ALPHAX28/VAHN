/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'vahn.s3.ap-south-2.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'vahnsports.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/collections',
        destination: '/products',
        permanent: false,
      },
      {
        source: '/collections/:path*',
        destination: '/products',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
