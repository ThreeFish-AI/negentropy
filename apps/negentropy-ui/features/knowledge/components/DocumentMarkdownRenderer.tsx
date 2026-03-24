"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { MermaidDiagram } from "@/components/ui/MermaidDiagram";

interface DocumentMarkdownRendererProps {
  content: string;
  corpusId: string;
  documentId: string;
  appName?: string;
}

function buildAssetProxyUrl(
  assetName: string,
  corpusId: string,
  documentId: string,
  appName?: string,
): string {
  const params = new URLSearchParams();
  if (appName) params.set("app_name", appName);
  const query = params.toString();
  const base = `/api/knowledge/base/${corpusId}/documents/${documentId}/assets/${encodeURIComponent(assetName)}`;
  return query ? `${base}?${query}` : base;
}

function isAbsoluteUrl(src: string): boolean {
  return (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:") ||
    src.startsWith("blob:")
  );
}

/**
 * 从路径中提取文件名（取最后一段）
 * e.g. "./images/image-1.png" → "image-1.png"
 */
function extractFilename(src: string): string {
  return src.split("/").pop() || src;
}

export function DocumentMarkdownRenderer({
  content,
  corpusId,
  documentId,
  appName,
}: DocumentMarkdownRendererProps) {
  return (
    <div
      className={cn(
        "overflow-hidden break-words whitespace-normal text-sm",
        // 段落
        "[&_p]:leading-7 [&_p]:my-1",
        "[&_p+*]:mt-3",
        // 列表
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:my-2",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_ol]:my-2",
        "[&_li]:leading-relaxed",
        // 标题
        "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-5 [&_h1]:text-zinc-900 [&_h1]:dark:text-zinc-100",
        "[&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-zinc-900 [&_h2]:dark:text-zinc-100",
        "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-zinc-800 [&_h3]:dark:text-zinc-200",
        "[&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mb-1 [&_h4]:mt-2",
        // 代码
        "[&_code]:font-mono [&_code]:text-[0.9em]",
        "[&_code]:bg-zinc-100 [&_code]:dark:bg-zinc-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded",
        "[&_pre]:bg-zinc-100 [&_pre]:dark:bg-zinc-800 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-3",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        // 链接
        "[&_a]:underline [&_a]:underline-offset-2 [&_a]:text-blue-600 [&_a]:dark:text-blue-400",
        // 表格
        "[&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:text-sm",
        "[&_thead]:bg-zinc-100 [&_thead]:dark:bg-zinc-800/60",
        "[&_tbody_tr:nth-child(even)]:bg-zinc-50 [&_tbody_tr:nth-child(even)]:dark:bg-zinc-900/30",
        "[&_th]:border [&_th]:border-zinc-200 [&_th]:dark:border-zinc-700 [&_th]:px-3 [&_th]:py-2 [&_th]:font-semibold [&_th]:text-left",
        "[&_td]:border [&_td]:border-zinc-200 [&_td]:dark:border-zinc-700 [&_td]:px-3 [&_td]:py-2",
        // 图片
        "[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-3",
        // 引用块
        "[&_blockquote]:border-l-4 [&_blockquote]:border-zinc-300 [&_blockquote]:dark:border-zinc-600 [&_blockquote]:pl-4 [&_blockquote]:my-3 [&_blockquote]:text-zinc-600 [&_blockquote]:dark:text-zinc-400",
        // 分隔线
        "[&_hr]:border-zinc-200 [&_hr]:dark:border-zinc-700 [&_hr]:my-4",
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img({ src, alt, ...props }) {
            if (!src || typeof src !== "string") return null;

            const resolvedSrc = isAbsoluteUrl(src)
              ? src
              : buildAssetProxyUrl(
                  extractFilename(src),
                  corpusId,
                  documentId,
                  appName,
                );

            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedSrc}
                alt={alt || ""}
                loading="lazy"
                className="max-w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
                onError={(e) => {
                  const el = e.target as HTMLImageElement;
                  el.style.display = "none";
                }}
                {...props}
              />
            );
          },
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isMermaid = match && match[1] === "mermaid";

            if (isMermaid) {
              return (
                <MermaidDiagram
                  code={String(children).replace(/\n$/, "")}
                />
              );
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <pre className="relative">{children}</pre>;
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto">
                <table>{children}</table>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
