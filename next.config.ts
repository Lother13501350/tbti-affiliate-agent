import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 缺 env 一律 graceful no-op；此服務不依賴外部 image domain。
};

export default nextConfig;
