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
          // CSP temporarily disabled - Trusted Types conflicts with Turnstile
          // TODO: Re-enable with proper configuration
          // {
          //   key: "Content-Security-Policy",
          //   value: "..."
          // },
        ],
      },
    ];
  },

  // Remove X-Powered-By header
  poweredByHeader: false,
};

export default nextConfig;
