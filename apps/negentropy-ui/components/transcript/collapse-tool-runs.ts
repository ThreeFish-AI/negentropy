/**
 * 连续 ≥3 个工具调用折叠为 ``tool_summary`` 行（Conductor 范式）：减少工具刷屏。
 *
 * - 仅折叠**连续**的 ``tool`` 项（被任何非 tool 项打断即 flush）；
 * - < 3 个不折叠，原样保留；
 * - 在途运行中（``running``）的工具不参与折叠，避免折叠实时态。
 *
 * 抽离自 Routine ``normalize-transcript``：纯 ``TranscriptItem[]`` → ``TranscriptItem[]``
 * 变换，无 Routine 事件耦合，供 Routine 归一化层与 Studio 适配器共用。
 */
import type { TranscriptItem } from "./types";

export function collapseToolRuns(items: TranscriptItem[]): TranscriptItem[] {
  const out: TranscriptItem[] = [];
  let run: Extract<TranscriptItem, { kind: "tool" }>[] = [];

  const flush = () => {
    if (run.length === 0) return;
    if (run.length < 3) {
      out.push(...run);
    } else {
      const toolNames = [...new Set(run.map((t) => t.toolName).filter(Boolean))];
      const first = run[0];
      out.push({
        kind: "tool_summary",
        seq: first.seq,
        id: `tool-summary-${first.id}`,
        count: run.length,
        toolNames,
        collapsed: run,
      });
    }
    run = [];
  };

  for (const item of items) {
    if (item.kind === "tool" && !item.running) {
      run.push(item);
    } else {
      flush();
      out.push(item);
    }
  }
  flush();
  return out;
}
