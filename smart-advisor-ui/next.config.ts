import type { NextConfig } from "next";
import path from "node:path";
import webpack from "webpack";

if (typeof global !== "undefined" && typeof global.localStorage !== "undefined" && typeof global.localStorage.getItem !== "function") {
  Object.defineProperty(global, "localStorage", {
    value: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    },
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizeCss: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ['error', 'warn'] } : false,
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.join(__dirname),
    };

    config.resolve.fallback = {
      ...config.resolve.fallback,
      crypto: require.resolve("crypto-browserify"),
      stream: require.resolve("stream-browserify"),
      http: require.resolve("stream-http"),
      https: require.resolve("https-browserify"),
      url: require.resolve("url"),
      buffer: require.resolve("buffer"),
      assert: require.resolve("assert"),
      util: require.resolve("util"),
      querystring: require.resolve("querystring-es3"),
      events: require.resolve("events/"),
    };

    if (!isServer) {
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
          process: ["process/browser.js", "process"],
        })
      );
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self' blob: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://assets.calendly.com https://*.framer.com https://*.framerusercontent.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://assets.calendly.com; img-src 'self' blob: data: https://assets.calendly.com https://*.framer.com https://*.framerusercontent.com; font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://api.google.com https://oauth2.googleapis.com https://www.googleapis.com https://accounts.google.com wss:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; frame-src https://calendly.com https://accounts.google.com;"
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          }
        ]
      }
    ];
  }
};

export default nextConfig;
