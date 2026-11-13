/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig = {
  output: "standalone",
  images: {
    // The /_next/image optimizer is disabled. With a wildcard remotePattern it
    // was an unauthenticated (middleware skips it) proxy that could fetch
    // arbitrary hosts, including internal ones. Product/vehicle images are
    // user-supplied URLs or data: URIs and render fine unoptimized.
    unoptimized: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
  },
};

export default nextConfig;
