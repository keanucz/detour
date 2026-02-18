import type { NextConfig } from "next"

const AGENT_BACKEND = process.env.AGENT_API_URL ?? "http://localhost:8000"
const LLM_BACKEND = process.env.LLM_API_URL ?? "http://localhost:11434/v1"

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  env: {
    AGENT_API_URL: AGENT_BACKEND,
    LLM_API_URL: LLM_BACKEND,
  },
  async rewrites() {
    return [
      // /api/agent/* → Python FastAPI agent backend (strips /api prefix)
      {
        source: "/api/agent/:path*",
        destination: `${AGENT_BACKEND}/agent/:path*`,
      },
      // /chat/completion → LLM inference backend
      {
        source: "/chat/completion",
        destination: `${LLM_BACKEND}/chat/completion`,
      },
    ]
  },
}

export default nextConfig
