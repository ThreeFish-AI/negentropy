"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { defaultRemarkPlugins, defaultRehypePlugins } from "@/utils/markdown-plugins";
import { cn } from "@/lib/utils";
import { MermaidDiagram } from "@/components/ui/MermaidDiagram";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

import "./highlight-theme.css";

// 文档场景的 sanitize schema：在 defaultSchema 之上增量放行媒体标签与
// width/height 属性。perceives 端为带尺寸的图片输出内嵌 HTML
// <img …width="X" height="Y" style="…" />，启用 rehype-raw 后必须
// 由 rehype-sanitize 兜底过滤。defaultSchema 已禁用 script/iframe/on*/style，
// 我们只在其基础上"加白"，不削减安全约束。危险的 style 自动被剥离，
// width/height 保留并由外层 CSS [&_img]:h-auto 驱动按比例响应式缩放。
const documentSanitizeSchema: typeof defaultSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "figure",
    "figcaption",
    "video",
    "audio",
    "source",
  ],
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    img: [
      ...((defaultSchema.attributes ?? {}).img ?? []),
      "width",
      "height",
      "loading",
      "decoding",
    ],
    video: [
      "src",
      "controls",
      "poster",
      "width",
      "height",
      "preload",
      "loop",
      "muted",
      "autoplay",
      "playsinline",
    ],
    audio: ["src", "controls", "preload", "loop", "muted", "autoplay"],
    source: ["src", "type", "media", "srcset", "sizes"],
    figure: [],
    figcaption: [],
  },
};

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

/**
 * 将 HTML img 标签的 width/height 属性解析为像素整数值。
 * perceives MCP 输出的 <img width="1000" /> 经过 rehype 后会以 string 传入。
 */
function parsePixelValue(value: number | string | undefined): number | null {
  if (value == null) return null;
  const str = String(value).replace(/px$/i, "").trim();
  const num = Number(str);
  return Number.isFinite(num) && num > 0 ? Math.round(num) : null;
}

type ImageState = "loading" | "loaded" | "error";

function DocumentImage({
  src,
  alt,
  width,
  height,
  corpusId,
  documentId,
  appName,
}: {
  src: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  corpusId: string;
  documentId: string;
  appName?: string;
}) {
  const [imgState, setImgState] = useState<ImageState>("loading");

  const resolvedSrc = isAbsoluteUrl(src)
    ? src
    : buildAssetProxyUrl(extractFilename(src), corpusId, documentId, appName);

  const maxWidthPx = parsePixelValue(width);

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
        width={width}
        height={height}
        style={maxWidthPx ? { maxWidth: `min(${maxWidthPx}px, 100%)` } : undefined}
        className={cn(
          "h-auto rounded-lg border border-zinc-200 dark:border-zinc-700 mx-auto",
          !maxWidthPx && "max-w-full",
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
        // 图片：DocumentImage 已根据 width 属性设置 max-width；h-auto 保证响应式缩放
        "[&_img]:h-auto [&_img]:rounded-lg [&_img]:my-3",
        // 引用块
        "[&_blockquote]:border-l-4 [&_blockquote]:border-zinc-300 [&_blockquote]:dark:border-zinc-600 [&_blockquote]:pl-4 [&_blockquote]:my-3 [&_blockquote]:text-zinc-600 [&_blockquote]:dark:text-zinc-400",
        // 分隔线
        "[&_hr]:border-zinc-200 [&_hr]:dark:border-zinc-700 [&_hr]:my-4",
      )}
    >
      <ReactMarkdown
        remarkPlugins={defaultRemarkPlugins}
        // 顺序至关重要：rehype-raw 先把内嵌 HTML 提升为节点，
        // rehype-sanitize 紧随其后做白名单过滤，最后才是渲染插件。
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, documentSanitizeSchema],
          ...defaultRehypePlugins,
          rehypeHighlight,
        ]}
        components={{
          // 当段落仅含图片时，去掉 <p> 包裹避免 <p><figure> 嵌套违反 HTML 规范。
          // react-markdown 将独立行的 ![alt](src) 包在 <p> 内，但自定义 img
          // 组件渲染 <figure>（块级元素），导致浏览器自动修正 DOM、
          // React 事件委托断裂、图片 onLoad/onError 失效。
          p({ children, node }) {
            // 使用 hast AST 节点判断：段落仅含 img 子节点时去掉 <p> 包裹，
            // 避免 <p><figure> 嵌套违反 HTML 规范。
            // 不能依赖 React 元素的 child.type === "img" 比较，
            // 因为 React Compiler 优化会破坏该严格相等判断。
            const isImageOnly =
              node?.children?.length > 0
              && node.children.every(
                (child: { type: string; tagName?: string }) =>
                  child.type === "element" && child.tagName === "img",
              );
            if (isImageOnly) {
              return <>{children}</>;
            }
            return <p>{children}</p>;
          },
          img({ src, alt, width, height }) {
            if (!src || typeof src !== "string") return null;
            return (
              <DocumentImage
                src={src}
                alt={alt || undefined}
                width={width}
                height={height}
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
