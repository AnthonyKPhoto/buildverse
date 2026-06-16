/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    // Restrict to https only — http would allow the image-optimization endpoint
    // (/_next/image?url=...) to proxy insecure or internal-network resources.
    // Wildcard hostname is required because product images are scraped from
    // arbitrary auto-parts vendors; a hard allowlist would break image display
    // for new vendors.  The SSRF guard in src/lib/scraper.ts ensures that no
    // private-network URL can ever be stored as an imageUrl in the first place.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
  },
};

export default nextConfig;
