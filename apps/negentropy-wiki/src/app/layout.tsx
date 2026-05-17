import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Negentropy Wiki — 知识库发布站点",
  description: "基于 Negentropy 系统的知识文档浏览与检索平台",
  icons: {
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

const THEME_INIT = `
(function(){
  try {
    var t = localStorage.getItem('wiki:theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
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
    <html lang="zh-CN" data-theme="default" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="wiki-body">
        <a href="#wiki-main" className="skip-link">
          跳到主要内容
        </a>
        <div id="wiki-root">{children}</div>
      </body>
    </html>
  );
}
