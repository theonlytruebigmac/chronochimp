/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // These features help with module resolution and optimization
    typedRoutes: true,
    optimizePackageImports: ['@radix-ui/react-slot'],
  },
  webpack: (config) => {
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        '@': new URL('./src', import.meta.url).pathname,
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
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
