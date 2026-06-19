import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 缺 env 一律 graceful no-op；此服務不依賴外部 image domain。
  // Claude Agent SDK 內含原生執行檔，必須保持 external、不要被打包。
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
  // 並把那顆 ~215MB 的平台 binary 從所有函式的檔案追蹤中排除，
  // 避免部署到 Vercel 時超過 serverless 函式大小上限。
  // （優化大腦只在「非 serverless」環境跑；部署版的 /api/admin/optimize 會 graceful 失敗。）
  outputFileTracingExcludes: {
    "**": ["node_modules/@anthropic-ai/claude-agent-sdk-*/**"],
  },
};

export default nextConfig;
