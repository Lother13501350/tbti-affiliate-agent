import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 缺 env 一律 graceful no-op；此服務不依賴外部 image domain。
  // Claude Agent SDK 內含原生執行檔，必須保持 external、不要被打包。
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
};

export default nextConfig;
