/**
 * Transcript 视图模型类型（本地，仅服务于渲染层）。
 *
 * 刻意不放入 ``features/routine/types.ts``——后者是「与后端序列化契约对齐」的层，
 * 而这里是由 ``RoutineIterationEventDTO`` 派生的纯展示中间表示（IR），属 UI 关注点。
 * 仿 paseo：``ToolCallDetail`` 判别联合是单一中间表示，displayName/图标/分节渲染皆基于它。
 */

import type { RoutineIterationEventDTO } from "@/features/routine";

import type { EventGroup, TaskStatus } from "../status-style";

// ---------------------------------------------------------------------------
// 工具调用细节（判别联合）—— 由 (tool_name, input, output) 派生
// ---------------------------------------------------------------------------

/** 单次工具调用的归一化细节，决定展开区如何渲染。 */
export type ToolCallDetail =
  /** Bash / BashOutput：命令 + 输出。 */
  | { type: "shell"; command: string; output: string | null; isError: boolean }
  /** Read：读取的文件路径 + 内容。 */
  | { type: "read"; filePath: string; content: string | null }
  /** Edit / MultiEdit / NotebookEdit：路径 + 一组 old→new 替换。 */
  | { type: "edit"; filePath: string; edits: Array<{ oldString: string | null; newString: string | null }>; output: string | null }
  /** Write：写入的文件路径 + 内容。 */
  | { type: "write"; filePath: string; content: string | null }
  /** Grep / Glob / WebSearch：查询串 + 命中输出。 */
  | { type: "search"; query: string; output: string | null }
  /** WebFetch：URL + 抓取结果。 */
  | { type: "fetch"; url: string; output: string | null }
  /** Task / TaskCreate / TaskUpdate：子代理/任务描述 + 输出。 */
  | { type: "sub_agent"; description: string | null; output: string | null }
  /** ExitPlanMode：规划文本。 */
  | { type: "plan"; text: string }
  /** 兜底（含 mcp__* 及未知工具）：原始 input + output。 */
  | { type: "generic"; input: unknown; output: string | null };

// ---------------------------------------------------------------------------
// 转录项（扁平流的单元）
// ---------------------------------------------------------------------------

/** 一条转录项：Claude Code 的 assistant 文本 / 工具调用，或 Engine / system / 截断标记。 */
export type TranscriptItem =
  | { kind: "assistant"; seq: number; id: string; text: string; thinking: boolean }
  | {
      kind: "tool";
      seq: number;
      id: string;
      toolName: string;
      title: string | null;
      input: unknown;
      output: string | null;
      isError: boolean;
      /** tool_use 无配对 tool_result 且处于在途实时态 → 仍在运行。 */
      running: boolean;
      taskStatus: TaskStatus | null;
    }
  | { kind: "engine"; seq: number; id: string; event: RoutineIterationEventDTO; group: EventGroup }
  | { kind: "system"; seq: number; id: string; event: RoutineIterationEventDTO }
  | { kind: "truncated"; seq: number; id: string; title: string | null };
