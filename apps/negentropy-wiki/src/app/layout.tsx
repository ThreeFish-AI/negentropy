import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Negentropy Wiki — 知识库发布站点",
  description: "基于 Negentropy 系统的知识文档浏览与检索平台",
  // icon/shortcut 由 App Router 约定（src/app/favicon.ico）自动注入，此处仅声明 apple-touch-icon 指向 logo.png
  icons: {
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" data-theme="default">
      <body className="wiki-body">
        <div id="wiki-root">{children}</div>
      </body>
    </html>
  );
}
