import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const productionDefaultApiUrl = "https://talentreach-backend.onrender.com/api";

const configuredApiUrl = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  ""
).trim();

// In production, never permit localhost / 127.0.0.1
const effectiveApiUrl = isProduction
  ? (!configuredApiUrl || configuredApiUrl.includes("127.0.0.1") || configuredApiUrl.includes("localhost")
      ? productionDefaultApiUrl
      : configuredApiUrl)
  : (configuredApiUrl || "http://127.0.0.1:8000/api");

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
  env: {
    NEXT_PUBLIC_API_URL: effectiveApiUrl,
  },
};

export default nextConfig;
