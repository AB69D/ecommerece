/** @type {import('next').NextConfig} */
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
    ],
  },
  async rewrites() {
    return [
      // Versioned API prefix — primary target for all new client code.
      // Requests to /api/v1/* are proxied to the backend unchanged so the
      // version segment is preserved end-to-end.
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
      // Legacy un-versioned prefix — kept for backwards compatibility.
      // Existing frontend and mobile clients continue to work without change;
      // the backend responds with Deprecation headers on this prefix.
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
