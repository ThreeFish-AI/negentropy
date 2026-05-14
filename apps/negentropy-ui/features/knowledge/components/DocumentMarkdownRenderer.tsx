"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { defaultRemarkPlugins, defaultRehypePlugins } from "@/utils/markdown-plugins";
import { cn } from "@/lib/utils";
import { MermaidDiagram } from "@/components/ui/MermaidDiagram";
import rehypeHighlight from "rehype-highlight";

import "./highlight-theme.css";

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

type ImageState = "loading" | "loaded" | "error";

function DocumentImage({
  src,
  alt,
  corpusId,
  documentId,
  appName,
}: {
  src: string;
  alt?: string;
  corpusId: string;
  documentId: string;
  appName?: string;
}) {
  const [imgState, setImgState] = useState<ImageState>("loading");

  const resolvedSrc = isAbsoluteUrl(src)
    ? src
    : buildAssetProxyUrl(extractFilename(src), corpusId, documentId, appName);

  return (
    <figure className="my-3">
      {imgState === "loading" && (
        <div className="flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
        </div>
      )}

      {imgState === "error" && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 dark:border-zinc-600 dark:bg-zinc-800">
          <svg
            className="mb-2 h-8 w-8 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="max-w-xs truncate text-xs text-zinc-500 dark:text-zinc-400">
            {alt || extractFilename(src)}
          </span>
          <span className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
            Image failed to load
          </span>
        </div>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolvedSrc}
        alt={alt || ""}
        loading="lazy"
        className={cn(
          "max-w-full rounded-lg border border-zinc-200 dark:border-zinc-700",
          imgState === "loaded" ? "block" : "hidden",
        )}
        onLoad={() => setImgState("loaded")}
        onError={() => setImgState("error")}
      />

      {alt && imgState === "loaded" && (
        <figcaption className="mt-1.5 text-center text-xs text-zinc-500 dark:text-zinc-400">
          {alt}
        </figcaption>
      )}
    </figure>
  );
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
        "min-w-0 overflow-x-auto break-words whitespace-normal text-sm",
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
        "[&_a]:underline [&_a]:underline-offset-2 [&_a]:text-blue-600 [&_a]:dark:text-blue-400 [&_a]:break-all",
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
        remarkPlugins={defaultRemarkPlugins}
        rehypePlugins={[...defaultRehypePlugins, rehypeHighlight]}
        components={{
          img({ src, alt }) {
            if (!src || typeof src !== "string") return null;
            return (
              <DocumentImage
                src={src}
                alt={alt || undefined}
                corpusId={corpusId}
                documentId={documentId}
                appName={appName}
                // pass through any remaining props via key to suppress warning
                key={`${src}-${alt}`}
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
              <div className="my-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
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
