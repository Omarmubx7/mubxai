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
