import withBundleAnalyzer from "@next/bundle-analyzer";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "uploadthing.com",
      },
      {
        protocol: "https",
        hostname: "googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "image.mux.com",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "stream.mux.com",
      },
    ],
  },

  // Security headers
  async headers() {
    const isDev = process.env.NODE_ENV === "development";

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // 'unsafe-eval' only in development (needed for HMR)
              // 'unsafe-inline' is required by Next.js for inline hydration scripts
              // TODO: Investigate nonce/hash-based CSP for production hardening
              `script-src 'self'${isDev ? " 'unsafe-eval'" : ""} 'unsafe-inline'`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: uploadthing.com googleusercontent.com images.unsplash.com avatars.githubusercontent.com image.mux.com api.dicebear.com",
              "media-src 'self' data: blob: stream.mux.com",
              "font-src 'self' data:",
              "connect-src 'self' https://api.anthropic.com https://api.stripe.com https://api.deepgram.com https://api.uploadthing.com https://api.mux.com https://*.upstash.io wss://*.trigger.dev",
              "frame-src 'self' https://js.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

nextConfig.webpack = (config, { isServer }) => {
  if (isServer) {
    // Ensure Node.js built-in modules are externalized (webpack's
    // externalsPresets.node handles bare imports like 'crypto', 'fs',
    // 'path', and the 'node:*' scheme). This is needed because Next.js
    // does not always set externalsPresets.node = true.
    config.externalsPresets = {
      ...config.externalsPresets,
      node: true,
    };

    // Additional modules that use worker threads at runtime and must
    // not be bundled by webpack:
    config.externals = [...(config.externals || []), "prom-client", "pino-pretty", "thread-stream"];
  }
  return config;
};

export default withAnalyzer(nextConfig);
