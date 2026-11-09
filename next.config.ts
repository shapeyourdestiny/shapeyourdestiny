import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vrksqhtanhgqltuvbzcr.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://*.cloudflare.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://vrksqhtanhgqltuvbzcr.supabase.co https://*.cloudflare.com",
              "font-src 'self' data:",
              "connect-src 'self' data: https://vrksqhtanhgqltuvbzcr.supabase.co wss://vrksqhtanhgqltuvbzcr.supabase.co https://challenges.cloudflare.com https://*.cloudflare.com",
              "frame-src https://challenges.cloudflare.com https://*.cloudflare.com",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // Remove X-Powered-By header
  poweredByHeader: false,
};

export default nextConfig;
