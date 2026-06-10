import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Transpile the shared package so Next.js processes its TypeScript source.
  transpilePackages: ["@effect-mcp/shared"],

  // The MCP SDK uses Node.js child_process and stdio — not available in the
  // Edge runtime. Marking it external tells Next.js to keep it as a native
  // Node.js require() rather than bundling it into the Edge bundle.
  serverExternalPackages: ["@modelcontextprotocol/sdk"],
}

export default nextConfig
