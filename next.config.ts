import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    // Recipe-photo imports POST an image to a server action; the client
    // downscales first, but allow headroom for large cookbook photos.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  images: {
    // TODO(security): hostname "**" lets next/image proxy and optimise images
    // from ANY https host. Narrow to the hosts recipe images actually come
    // from (Vercel Blob, Edamam, scraped recipe sites) in a follow-up.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  serverExternalPackages: [
    "puppeteer-core",
    "@sparticuz/chromium-min",
    "puppeteer",
  ],
  transpilePackages: [
    "@tiptap/react",
    "@tiptap/core",
    "@tiptap/pm",
    "@tiptap/starter-kit",
    "@tiptap/extension-link",
    "@tiptap/extension-image",
  ],
};

export default nextConfig;
