import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Preserve the loopback listener origin so proxy rewrites stay inside this server.
  skipProxyUrlNormalize: true,
};

export default nextConfig;
