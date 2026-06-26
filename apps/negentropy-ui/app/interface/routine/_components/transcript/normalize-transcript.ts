/**
 * 机制层：把扁平的 ``RoutineIterationEventDTO[]`` 折叠为 ``TranscriptItem[]``。
 *
 * - 先建 ``Map<tool_use_id, tool_result>``，再单遍发射：``tool_use`` 取配对 result 的
 *   output/is_error；无配对且处于在途实时态 → ``running``。``tool_result`` 自身被消费，不再单独发射。
 * - 空 assistant（仅 ``{raw}``，无 text）丢弃，避免空气泡。
 * - Engine 事件（plan_review/gate/evaluation/result）原样携带，交 EngineMessageBlock 渲染。
 * - 配对键：``tool_use.payload.tool_id === tool_result.payload.tool_use_id``。
 */

import type { RoutineIterationEventDTO } from "@/features/routine";

import { deriveTaskStatus, eventGroup } from "../status-style";
import { unwrapText } from "./payload-util";
import type { TranscriptItem } from "./types";

export function normalizeTranscript(
  events: RoutineIterationEventDTO[],
  opts: { live: boolean },
): TranscriptItem[] {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);

  // 一遍预扫：tool_use_id → tool_result 事件
  const resultByToolId = new Map<string, RoutineIterationEventDTO>();
  for (const ev of sorted) {
    if (ev.event_type === "tool_result") {
      const id = ev.payload?.tool_use_id;
      if (typeof id === "string") resultByToolId.set(id, ev);
    }
  }

  const items: TranscriptItem[] = [];
  for (const ev of sorted) {
    switch (ev.event_type) {
      case "tool_result":
        continue; // 已被对应 tool_use 消费

      case "assistant": {
        const text = typeof ev.payload?.text === "string" ? ev.payload.text : "";
        if (!text.trim()) continue; // 空 / 仅 raw → 丢弃
        items.push({ kind: "assistant", seq: ev.seq, id: ev.id, text, thinking: ev.title === "thinking" });
        break;
      }

      case "tool_use": {
        const toolId = typeof ev.payload?.tool_id === "string" ? (ev.payload.tool_id as string) : null;
        const result = toolId ? resultByToolId.get(toolId) : undefined;
        const output = result ? unwrapText(result.payload?.output) : null;
        const isError = result ? result.payload?.is_error === true : false;
        items.push({
          kind: "tool",
          seq: ev.seq,
          id: ev.id,
          toolName: ev.tool_name ?? "",
          title: ev.title,
          input: ev.payload?.input,
          output,
          isError,
          running: !result && opts.live,
          taskStatus: deriveTaskStatus(ev),
        });
        break;
      }

      case "plan_review":
      case "gate":
      case "evaluation":
      case "result":
        items.push({ kind: "engine", seq: ev.seq, id: ev.id, event: ev, group: eventGroup(ev.event_type) });
        break;

      case "_truncated":
        items.push({ kind: "truncated", seq: ev.seq, id: ev.id, title: ev.title });
        break;

      default:
        // system / system_retry / system_compact / unknown 等
        items.push({ kind: "system", seq: ev.seq, id: ev.id, event: ev });
        break;
    }
  }

  return items;
}
