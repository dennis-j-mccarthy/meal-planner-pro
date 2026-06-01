import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
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
