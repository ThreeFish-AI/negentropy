"use client";

import { JsonViewer } from "@/components/ui/JsonViewer";
import { cn } from "@/lib/utils";

import { CODE_BLOCK } from "./style";
import type { ToolCallDetail } from "./types";

/** 展开区空内容占位。 */
function Empty() {
  return <div className="px-2.5 py-2 text-caption text-text-muted">（无可展开内容）</div>;
}

/** 把多行文本渲染为 diff 行（+ 绿 / - 红）。 */
function diffLines(text: string, sign: "+" | "-") {
  const add = sign === "+";
  return text.split("\n").map((line, i) => (
    <div
      key={i}
      className={cn(
        "whitespace-pre px-2.5",
        add
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "bg-red-500/10 text-red-700 dark:text-red-300",
      )}
    >
      <span className="select-none opacity-60">{sign} </span>
      {line}
    </div>
  ));
}

/** Edit / MultiEdit / NotebookEdit 的 old→new diff。 */
function EditDiff({ edits, output }: { edits: Array<{ oldString: string | null; newString: string | null }>; output: string | null }) {
  const meaningful = edits.filter((e) => e.oldString || e.newString);
  if (meaningful.length === 0) {
    return output ? <div className={cn(CODE_BLOCK, "whitespace-pre-wrap break-words text-text-secondary")}>{output}</div> : <Empty />;
  }
  return (
    <div className="max-h-[400px] select-text overflow-auto py-1 font-mono text-[12.5px] leading-relaxed">
      {meaningful.map((e, i) => (
        <div key={i} className={i > 0 ? "mt-2 border-t border-border/60 pt-2" : undefined}>
          {e.oldString ? diffLines(e.oldString, "-") : null}
          {e.newString ? diffLines(e.newString, "+") : null}
        </div>
      ))}
    </div>
  );
}

/**
 * 按 ``ToolCallDetail.type`` 渲染展开区内容（仿 paseo buildDetailSections）。
 * 外层连接边框由 ExpandableToolCallRow 提供，这里只渲染内部内容。
 */
export function ToolDetailSections({ detail, isError }: { detail: ToolCallDetail; isError: boolean }) {
  const outputColor = isError ? "text-red-600 dark:text-red-400" : "text-text-secondary";

  switch (detail.type) {
    case "shell":
      return (
        <div className={cn(CODE_BLOCK, "whitespace-pre")}>
          <span className="text-text-muted">$ </span>
          <span className="text-foreground">{detail.command}</span>
          {detail.output ? <span className={outputColor}>{`\n\n${detail.output}`}</span> : null}
        </div>
      );

    case "read":
    case "write":
      return detail.content ? (
        <div className={cn(CODE_BLOCK, "whitespace-pre text-text-secondary")}>{detail.content}</div>
      ) : (
        <Empty />
      );

    case "edit":
      return <EditDiff edits={detail.edits} output={detail.output} />;

    case "search":
      return detail.output ? (
        <div className={cn(CODE_BLOCK, "whitespace-pre", outputColor)}>{detail.output}</div>
      ) : detail.query ? (
        <div className={cn(CODE_BLOCK, "whitespace-pre-wrap break-words text-text-secondary")}>{detail.query}</div>
      ) : (
        <Empty />
      );

    case "fetch":
    case "sub_agent": {
      const text = detail.output;
      return text ? (
        <div className={cn(CODE_BLOCK, "whitespace-pre-wrap break-words", outputColor)}>{text}</div>
      ) : (
        <Empty />
      );
    }

    case "plan":
      return detail.text ? (
        <div className={cn(CODE_BLOCK, "whitespace-pre-wrap break-words text-text-secondary")}>{detail.text}</div>
      ) : (
        <Empty />
      );

    case "generic":
      return (
        <div className="space-y-2 px-2.5 py-2">
          {detail.input !== null && detail.input !== undefined ? <JsonViewer data={detail.input} /> : null}
          {detail.output ? (
            <pre className={cn("max-h-[400px] overflow-auto whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed", outputColor)}>
              {detail.output}
            </pre>
          ) : null}
        </div>
      );
  }
}
