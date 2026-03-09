import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    // Pin the module resolution root so Turbopack stays stable in worktrees/symlinked checkouts.
    root: path.resolve(__dirname, "../.."),
  },
  images: {
    localPatterns: [
      {
        pathname: "/api/auth/avatar",
      },
    ],
  },
  typescript: {
    tsconfigPath: "./tsconfig.json",
  },
};

export default nextConfig;
