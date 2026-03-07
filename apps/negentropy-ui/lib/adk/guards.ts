/**
 * ADK 兼容入口
 *
 * 运行时校验已下沉到 `@/lib/agui/schema`，
 * 事件构造已迁移到 `@/lib/agui/factories`。
 * 该文件仅保留兼容导出，避免旧调用面直接断裂。
 */

import type { BaseEvent } from "@ag-ui/core";
import { parseBaseEvent, safeParseBaseEventProps } from "@/lib/agui/schema";
import type { BaseEventProps } from "@/types/agui";

export {
  createActivitySnapshotEvent,
  createCustomEvent,
  createMessageWithMeta,
  createMessagesSnapshotEvent,
  createRawEvent,
  createStateDeltaEvent,
  createStateSnapshotEvent,
  createStepFinishedEvent,
  createStepStartedEvent,
  createTextMessageContentEvent,
  createTextMessageEndEvent,
  createTextMessageStartEvent,
  createToolCallArgsEvent,
  createToolCallEndEvent,
  createToolCallResultEvent,
  createToolCallStartEvent,
} from "@/lib/agui/factories";
export { createOptimisticTextEvents } from "@/types/agui";

/**
 * 兼容旧调用面的基础事件属性检查。
 *
 * 新代码应直接使用 `@/lib/agui/schema` 中的 validator。
 */
export function hasBaseEventProps(obj: unknown): obj is BaseEventProps {
  return safeParseBaseEventProps(obj).success;
}

/**
 * 兼容旧调用面的 BaseEvent 解析。
 *
 * 新代码应直接使用 `parseBaseEvent` / `parseAgUiEvent`。
 */
export function asBaseEvent(event: unknown): BaseEvent {
  return parseBaseEvent(event);
}
