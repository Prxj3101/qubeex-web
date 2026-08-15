import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the app's WebView (loading this dev server over the LAN IP instead
  // of localhost) talk to Next.js dev-only resources like the webpack-HMR
  // socket, which are blocked cross-origin by default for safety.
  allowedDevOrigins: ["192.168.0.105"],
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vggykhnjqbubxikmnolt.supabase.co",
        pathname: "/storage/v1/**",
      },
      {
        protocol: "https",
        hostname: "files.qubeex.in",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
