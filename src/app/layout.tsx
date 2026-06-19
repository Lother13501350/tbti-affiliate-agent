import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TBTI 聯盟商品 Agent",
  description: "聯盟商品與分潤連結生命週期管理（獨立服務 + 後台）",
  // 內部工具：禁止索引
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}
