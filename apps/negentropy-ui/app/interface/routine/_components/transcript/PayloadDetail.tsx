"use client";

import { JsonViewer } from "@/components/ui/JsonViewer";

import { MarkdownText } from "../MarkdownText";

/** 长文本字段 —— 以 Markdown 渲染（人类可读文本）。 */
const MARKDOWN_FIELDS = new Set(["text", "reflection"]);
/** 长文本字段 —— 以等宽 pre 渲染（代码/命令/原始输出）。 */
const PREFORMATTED_FIELDS = new Set(["output", "result", "prompt", "raw", "command"]);
const ALL_TEXT_FIELDS = new Set([...MARKDOWN_FIELDS, ...PREFORMATTED_FIELDS]);

/**
 * 通用 payload 明细渲染：长文本字段拆出（Markdown / 等宽 pre），其余结构化字段交 JsonViewer。
 * 由 EngineMessageBlock（raw 明细）与 system 行复用。
 */
export function PayloadDetail({ payload }: { payload: Record<string, unknown> }) {
  const markdownBlocks: Array<{ key: string; value: string }> = [];
  const preformattedBlocks: Array<{ key: string; value: string }> = [];
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (ALL_TEXT_FIELDS.has(k) && typeof v === "string" && v.length > 0) {
      if (MARKDOWN_FIELDS.has(k)) markdownBlocks.push({ key: k, value: v });
      else preformattedBlocks.push({ key: k, value: v });
    } else if (v !== null && v !== undefined && v !== "") {
      rest[k] = v;
    }
  }

  return (
    <>
      {markdownBlocks.map(({ key, value }) => (
        <div key={key}>
          <div className="mb-1 text-caption font-medium uppercase tracking-overline text-text-secondary">{key}</div>
          <div className="max-h-72 overflow-auto rounded-md border border-border bg-muted/40 p-2">
            <MarkdownText content={value} />
          </div>
        </div>
      ))}
      {preformattedBlocks.map(({ key, value }) => (
        <div key={key}>
          <div className="mb-1 text-caption font-medium uppercase tracking-overline text-text-secondary">{key}</div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-2 font-mono text-caption leading-relaxed text-text-secondary">
            {value}
          </pre>
        </div>
      ))}
      {Object.keys(rest).length > 0 && (
        <div className="rounded-md border border-border bg-muted/30 p-2">
          <JsonViewer data={rest} />
        </div>
      )}
    </>
  );
}
