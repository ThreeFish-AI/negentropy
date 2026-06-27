"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface DocumentPdfViewerProps {
  /** 内联预览 URL（同源 BFF `/preview` 路由，自动携带 cookie 鉴权）。 */
  src: string;
  /** 源文件名，用于无障碍标题与兜底链接文案。 */
  filename?: string;
  className?: string;
}

/**
 * PDF 原文查看器 —— 以原生浏览器 PDF 查看器内联渲染源 PDF 文档。
 *
 * 采用业界「最大兼容」组合：`<object>`（主）内嵌 `<iframe>`（兜底），渲染时走
 * 浏览器/OS 自带查看器（缩放、搜索、打印、翻页、文本选择、CJK 字体均开箱即用），
 * 无需引入 pdf.js / worker / cMaps（熵减 + 最小干预）。顶部始终提供「在新标签打开」
 * 链接作为无障碍逃生通道与终极兜底。
 *
 * src 指向同源 BFF `/preview` 路由，浏览器以 `Content-Type: application/pdf` +
 * `Content-Disposition: inline` 内联渲染；同源子请求自动携带 cookie 完成鉴权。
 */
export function DocumentPdfViewer({
  src,
  filename,
  className,
}: DocumentPdfViewerProps) {
  const title = filename ? `PDF 预览：${filename}` : "PDF 预览";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex justify-end">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-foreground"
        >
          在新标签打开
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5h5m0 0v5m0-5L10 14M5 5v14h14" />
          </svg>
        </a>
      </div>

      <div className="relative h-[calc(100vh-240px)] min-h-[600px] w-full overflow-hidden rounded-lg border border-border bg-background">
        {/* 加载占位层（底层 z-0）：原生查看器渲染后其不透明背景会自然覆盖此层，
            无需 JS 状态、无 `<object>` onLoad 跨浏览器不可靠导致的卡死风险。
            aria-hidden 避免对读屏用户暴露装饰性 loading。 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center gap-3 text-text-muted"
        >
          <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-xs">正在加载 PDF…</p>
        </div>

        {/* object（主）→ iframe（兜底）→ 链接（终极兜底），层级置于占位层之上 */}
        <object data={src} type="application/pdf" aria-label={title} className="relative z-10 h-full w-full">
          <iframe src={src} title={title} className="h-full w-full border-0">
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-text-muted">
              <p>当前浏览器无法内联预览此 PDF。</p>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
              >
                在新标签页打开 PDF
              </a>
            </div>
          </iframe>
        </object>
      </div>
    </div>
  );
}

export default DocumentPdfViewer;
