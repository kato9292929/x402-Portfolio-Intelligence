import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["x402-next"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
