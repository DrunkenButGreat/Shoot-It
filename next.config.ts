import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  cacheComponents: false,
  // ffmpeg/ffprobe ship native binaries — keep them external so their binaries
  // resolve at runtime, and make sure they're traced into the standalone output.
  serverExternalPackages: ['fluent-ffmpeg', 'ffmpeg-static', 'ffprobe-static'],
  outputFileTracingIncludes: {
    '/api/**': [
      './node_modules/ffmpeg-static/ffmpeg',
      './node_modules/ffprobe-static/bin/**',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // Next.js 16 requires explicit allowlists for local image optimization.
    formats: ['image/avif', 'image/webp'],
    qualities: [72, 85], // 72 = grid thumbnails, 85 = previews
    localPatterns: [{ pathname: '/api/uploads/**' }],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
    proxyClientMaxBodySize: 100 * 1024 * 1024,
  },
}

export default nextConfig
