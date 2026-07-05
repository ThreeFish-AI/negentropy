import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { HomePageThemeGuard } from "@/components/HomePageThemeGuard";

/**
 * 自托管 Inter（对齐 SquareDocs 字形观感）。
 * 仅加载 latin 子集，CJK 中文由 --wiki-*-font 令牌的系统字体回退兜底。
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Negentropy Wiki — 知识库发布站点",
  description: "基于 Negentropy 系统的知识文档浏览与检索平台",
  icons: {
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f10" },
  ],
  width: "device-width",
  initialScale: 1,
};

/* 主题统一为 SquareDocs 紫罗兰单一主题，仅保留外观（浅/深/系统）的 FOUC 防闪脚本。
 * 首页（路由 "/"）强制暗色：先于 localStorage 判定并直接钉 dark，杜绝「偏好浅色 →
 * 首屏先亮后暗」的闪烁；离开首页后由 HomePageThemeGuard 从 localStorage 恢复偏好。 */
const THEME_INIT = `
(function(){
  try {
    var path = location.pathname;
    if (path === "/" || path === "") {
      document.documentElement.setAttribute("data-color-scheme", "dark");
      return;
    }
    var c = localStorage.getItem('wiki:color-scheme');
    if (c && c !== 'system') document.documentElement.setAttribute('data-color-scheme', c);
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="wiki-body">
        <a href="#wiki-main" className="skip-link">
          跳到主要内容
        </a>
        <HomePageThemeGuard />
        <div id="wiki-root">{children}</div>
      </body>
    </html>
  );
}
