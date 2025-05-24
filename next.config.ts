import type { NextConfig } from 'next';
import type { Configuration as WebpackConfig } from 'webpack';
import path from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone', // Required for optimized Docker images
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config: WebpackConfig) => {
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        '@': path.join(__dirname, 'src'),
      },
    };
    return config;
  },
  
  // Trust proxy headers when behind Traefik
  poweredByHeader: false,
  generateEtags: false,
  
  // Configure for both development and production environments
  serverRuntimeConfig: {
    // Will only be available on the server side
    trustProxy: process.env.NEXT_PUBLIC_TRUST_PROXY === 'true',
  },
  publicRuntimeConfig: {
    // Will be available on both server and client
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9004',
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '/api',
    allowHttpCookies: process.env.NEXT_PUBLIC_ALLOW_HTTP_COOKIES === 'true',
    bypassAuth: process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true',
  },

  // Images configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  
  async headers() {
    // Get allowed origins from env or use wildcard in development
    const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS || '*';
    
    const corsHeaders = [
      {
        key: 'Access-Control-Allow-Origin',
        value: allowedOrigins
      },
      {
        key: 'Access-Control-Allow-Methods',
        value: 'GET, POST, PUT, DELETE, OPTIONS'
      },
      {
        key: 'Access-Control-Allow-Headers',
        value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
      }
    ];

    // Add additional headers for Traefik in production
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_TRUST_PROXY === 'true') {
      corsHeaders.push({
        key: 'X-Forwarded-Host',
        value: process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || ''
      });
    }

    return [
      {
        source: '/:path*',
        headers: corsHeaders
      },
      {
        // This is specifically for handling /_next/* requests
        source: '/_next/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: allowedOrigins
          }
        ]
      },
      {
        source: '/api/:path*',
        headers: corsHeaders
      }
    ];
  }
};

export default nextConfig;
