import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Proxy /api to the FastAPI backend in dev. Rewrites are unsupported in the
  // static export output, so this block is excluded from production builds.
  ...(process.env.NODE_ENV === "development" && {
    async rewrites() {
      return [
        {
          source: "/api/:path*",
          destination: "http://localhost:8000/api/:path*",
        },
      ];
    },
  }),
};

export default nextConfig;
