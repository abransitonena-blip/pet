/** @type {import('next').NextConfig} */
const { GLOBAL_SECURITY_HEADERS } = require('./security-headers')

const isProduction = process.env.NODE_ENV === 'production'
const privateHeaders = [
  { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
]

const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  poweredByHeader: false,
  reactStrictMode: true,

  async headers() {
    const hsts = isProduction
      ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
      : []

    return [
      {
        source: '/(.*)',
        headers: [...GLOBAL_SECURITY_HEADERS, ...hsts],
      },
      ...[
        '/admin/:path*', '/familia/:path*', '/walker/:path*', '/supervisor/:path*',
        '/login', '/equipo', '/cancelar', '/api/:path*', '/mi-cuenta/:path*', '/paseador/:path*',
      ].map((source) => ({ source, headers: privateHeaders })),
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
      {
        source: '/:path((?:[^/]+/)*[^/]+\\.(?:png|jpg|jpeg|gif|webp|svg|ico))',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },

  async redirects() {
    return [
      { source: '/mi-cuenta/:path*', destination: '/familia/:path*', permanent: true },
      { source: '/paseador/:path*', destination: '/walker/:path*', permanent: true },
    ]
  },
}

module.exports = nextConfig
