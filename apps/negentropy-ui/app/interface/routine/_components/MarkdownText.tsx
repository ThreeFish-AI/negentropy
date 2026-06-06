"use client";

import ReactMarkdown from "react-markdown";

import { cn } from "@/lib/utils";
import { defaultRemarkPlugins, defaultRehypePlugins } from "@/utils/markdown-plugins";

// ---------------------------------------------------------------------------
// 样式常量 —— Tailwind arbitrary variants 覆盖 Markdown 各元素
// 字号基准 text-[11px]（text-caption），与 Iteration 视图一致
// 参考 McpServerCard.tsx 的 MARKDOWN_CONTENT_CLASS 模式
// ---------------------------------------------------------------------------

const MARKDOWN_TEXT_CLASS = [
  "overflow-hidden break-words whitespace-normal text-[11px] leading-[1.6] text-text-secondary",

  // 段落
  "[&_p]:my-0",
  "[&_p+*]:mt-2",

  // 标题
  "[&_h1]:text-sm [&_h1]:font-bold [&_h1]:tracking-heading [&_h1]:mb-1.5 [&_h1]:mt-3 [&_h1]:text-foreground",
  "[&_h2]:text-xs [&_h2]:font-bold [&_h2]:tracking-heading [&_h2]:mb-1.5 [&_h2]:mt-2.5 [&_h2]:text-foreground",
  "[&_h3]:text-[11px] [&_h3]:font-semibold [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-foreground",
  "[&_h1+*]:mt-1 [&_h2+*]:mt-1 [&_h3+*]:mt-1",

  // 列表
  "[&_ul]:list-disc [&_ul]:space-y-0.5 [&_ul]:pl-4",
  "[&_ol]:list-decimal [&_ol]:space-y-0.5 [&_ol]:pl-4",
  "[&_li]:leading-snug",

  // 行内代码
  "[&_code]:rounded [&_code]:bg-muted/60 [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.9em]",

  // 代码块
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted/40 [&_pre]:p-2 [&_pre]:text-[11px]",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",

  // 表格
  "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[10px]",
  "[&_thead]:bg-muted/40",
  "[&_th]:border [&_th]:border-border [&_th]:px-1.5 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold [&_th]:text-text-secondary",
  "[&_td]:border [&_td]:border-border [&_td]:px-1.5 [&_td]:py-1 [&_td]:align-top",

  // 链接
  "[&_a]:text-sky-600 [&_a]:underline [&_a]:underline-offset-2 dark:[&_a]:text-sky-400",

  // 引用
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-text-muted",

  // 分割线
  "[&_hr]:my-2 [&_hr]:border-border",
].join(" ");

// ---------------------------------------------------------------------------
// 组件
// ---------------------------------------------------------------------------

interface MarkdownTextProps {
  content: string;
  className?: string;
}

/**
 * 轻量 Markdown 渲染组件，专为 Routine Iteration 视图的文本字段设计。
 *
 * 复用全局 remark/rehype 插件链（GFM + 数学公式），
 * 字号基准 text-[11px]，通过 Tailwind arbitrary variants 样式化输出。
 */
export function MarkdownText({ content, className }: MarkdownTextProps) {
  if (!content) return null;

  return (
    <div className={cn(MARKDOWN_TEXT_CLASS, className)}>
      <ReactMarkdown remarkPlugins={defaultRemarkPlugins} rehypePlugins={defaultRehypePlugins}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
