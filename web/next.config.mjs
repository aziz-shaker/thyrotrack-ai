/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Server-only native/heavy packages: keep them out of the webpack bundle
    serverComponentsExternalPackages: ["playwright-core", "@sparticuz/chromium", "@prisma/client", "bcryptjs"],
  },
  async headers() {
    // Baseline security headers for every route
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
