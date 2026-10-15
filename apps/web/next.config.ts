import path from "node:path";
import type { NextConfig } from "next";

// جذر الـ monorepo — عشان الـ standalone output يشمل packages/db و packages/domain
const repoRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  transpilePackages: ["@it/db", "@it/domain"],
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // forbidden() + app/forbidden.tsx لصفحات الصلاحيات
    authInterrupts: true,
  },
  turbopack: {
    root: repoRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
