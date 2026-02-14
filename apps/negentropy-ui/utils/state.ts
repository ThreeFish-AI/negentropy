/**
 * 状态相关工具函数
 *
 * 从 app/page.tsx 提取，遵循 AGENTS.md 原则：模块化、复用驱动
 */

import { BaseEvent, EventType } from "@ag-ui/core";

/**
 * 类型守卫：检查事件是否为 STATE_DELTA 事件
 */
function isStateDeltaEvent(
  event: BaseEvent,
): event is BaseEvent & { delta: Record<string, unknown> } {
  return (
    event.type === EventType.STATE_DELTA &&
    "delta" in event &&
    typeof event.delta === "object" &&
    event.delta !== null
  );
}

/**
 * 从 STATE_DELTA 事件重建状态快照
 *
 * 使用事件溯源模式：按顺序应用所有 STATE_DELTA 事件
 *
 * @param events - AG-UI 基础事件数组
 * @returns 状态快照对象，如果没有状态事件则返回 null
 *
 * @example
 * ```ts
 * const snapshot = buildStateSnapshotFromEvents(events);
 * if (snapshot) {
 *   console.log('Current state:', snapshot);
 * }
 * ```
 */
export function buildStateSnapshotFromEvents(
  events: BaseEvent[],
): Record<string, unknown> | null {
  let state: Record<string, unknown> = {};
  let hasState = false;

  for (const event of events) {
    if (isStateDeltaEvent(event)) {
      hasState = true;
      // Apply delta - shallow merge for simplicity
      state = {
        ...state,
        ...event.delta,
      };
    }
  }

  return hasState ? state : null;
}
