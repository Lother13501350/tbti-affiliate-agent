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
        <template
          dangerouslySetInnerHTML={{
            __html: `<!--
THESIS: The sample workspace makes report deduplication and reviewed product changes visible through real controls.
OWN-WORLD: Extend the existing neutral operations interface with system type, thin dividers, and restrained green actions.
STORY: Import a report, replay it, change a status, then approve or reject a fixed suggestion and inspect its effect.
FIRST VIEWPORT: Task header and role/reset controls above a wider import workspace and a narrower review queue; stack on mobile.
FORM: A precise extension of the existing operations surface, code-led, without a concept tournament.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
