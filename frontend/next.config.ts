import type { NextConfig } from "next";

const configuredApiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL;

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(configuredApiUrl
    ? {
        env: {
          NEXT_PUBLIC_API_URL: configuredApiUrl,
        },
      }
    : {}),
};

export default nextConfig;
