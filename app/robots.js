export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://shapeyourdestiny.co";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/*",
          "/instructor",
          "/instructor/*",
          "/api",
          "/api/*",
          "/instructor-login",
          "/instructor-login/*",
          "/forgot-password",
          "/reset-password",
          "/auth",
          "/auth/*",
          "/logout",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
