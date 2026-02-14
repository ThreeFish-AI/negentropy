/**
 * 时间线处理工具函数
 *
 * 从 app/page.tsx 提取的时间线处理工具函数
 */

import { BaseEvent, EventType } from "@ag-ui/core";

/**
 * 时间线项目类型
 * 从 components/ui/EventTimeline.tsx 重新导出，避免循环依赖
 */
export type TimelineItem =
  | {
      id: string;
      kind: "tool";
      name: string;
      args: string;
      result: string;
      status: "running" | "done" | "completed";
      timestamp?: number;
      runId?: string;
    }
  | {
      id: string;
      kind: "artifact";
      title: string;
      content: Record<string, unknown>;
      timestamp?: number;
      runId?: string;
    }
  | {
      id: string;
      kind: "state";
      title: string;
      content: unknown;
      timestamp?: number;
      runId?: string;
    }
  | {
      id: string;
      kind: "event";
      title: string;
      content: unknown;
      timestamp?: number;
      runId?: string;
    };

/**
 * 从 AG-UI 事件构建时间线项目
 * @param events AG-UI 事件数组
 * @returns 时间线项目数组
 */
export function buildTimelineItems(events: BaseEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  const toolIndex = new Map<string, number>();

  events.forEach((event) => {
    const runId = "runId" in event ? (event.runId as string) : undefined;

    switch (event.type) {
      case EventType.TOOL_CALL_START: {
        const { toolCallId, toolCallName } = event;
        const item: TimelineItem = {
          id: toolCallId,
          kind: "tool",
          name: toolCallName,
          args: "",
          result: "",
          status: "running",
          timestamp: event.timestamp,
          runId,
        };
        toolIndex.set(toolCallId, items.length);
        items.push(item);
        break;
      }
      case EventType.TOOL_CALL_ARGS: {
        const { toolCallId, delta } = event;
        const index = toolIndex.get(toolCallId);
        if (index !== undefined) {
          const item = items[index];
          if (item.kind === "tool") {
            item.args = `${item.args}${delta}`;
          }
        }
        break;
      }
      case EventType.TOOL_CALL_RESULT: {
        const { toolCallId, content } = event;
        const index = toolIndex.get(toolCallId);
        if (index !== undefined) {
          const item = items[index];
          if (item.kind === "tool") {
            item.result = content;
            item.status = "completed";
          }
        } else {
          items.push({
            id: toolCallId,
            kind: "tool",
            name: "tool_result",
            args: "",
            result: content,
            status: "completed",
            timestamp: event.timestamp,
            runId,
          });
        }
        break;
      }
      case EventType.TOOL_CALL_END: {
        const index = toolIndex.get(event.toolCallId);
        if (index !== undefined) {
          const item = items[index];
          if (item.kind === "tool" && item.status !== "completed") {
            item.status = "done";
          }
        }
        break;
      }
      case EventType.ACTIVITY_SNAPSHOT: {
        if (event.activityType === "artifact") {
          items.push({
            id: event.messageId,
            kind: "artifact",
            title: "Artifact",
            content: event.content,
            timestamp: event.timestamp,
            runId,
          });
        }
        break;
      }
      case EventType.STATE_DELTA: {
        items.push({
          id: `state_${items.length}`,
          kind: "state",
          title: "State Delta",
          content: event.delta,
          timestamp: event.timestamp,
          runId,
        });
        break;
      }
      case EventType.RUN_ERROR: {
        items.push({
          id: `error_${items.length}`,
          kind: "event",
          title: "Run Error",
          content: event.message,
          timestamp: event.timestamp,
          runId,
        });
        break;
      }
      // Phase 1 新增的事件类型处理
      case EventType.STATE_SNAPSHOT: {
        items.push({
          id: `snapshot_${items.length}`,
          kind: "state",
          title: "State Snapshot",
          content: event.snapshot,
          timestamp: event.timestamp,
          runId,
        });
        break;
      }
      case EventType.MESSAGES_SNAPSHOT: {
        // 消息历史快照由外部处理，这里仅记录日志
        // 实际的消息更新逻辑由事件订阅者处理
        break;
      }
      case EventType.STEP_STARTED: {
        items.push({
          id: `step_${event.stepId}_start`,
          kind: "event",
          title: `Step: ${event.stepName}`,
          content: { status: "started" },
          timestamp: event.timestamp,
          runId,
        });
        break;
      }
      case EventType.STEP_FINISHED: {
        items.push({
          id: `step_${event.stepId}_finish`,
          kind: "event",
          title: `Step Complete: ${event.stepId}`,
          content: event.result,
          timestamp: event.timestamp,
          runId,
        });
        break;
      }
      case EventType.RAW:
      case EventType.CUSTOM: {
        items.push({
          id: `custom_${items.length}`,
          kind: "event",
          title: event.type === EventType.RAW ? "Raw Event" : `Custom: ${event.eventType}`,
          content: event.data,
          timestamp: event.timestamp,
          runId,
        });
        break;
      }
      default:
        break;
    }
  });

  return items;
}
