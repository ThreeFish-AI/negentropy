"use client";

import { useCallback } from "react";
import {
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";

interface SortableItem {
  id: UniqueIdentifier;
  [key: string]: unknown;
}

interface UseSortableCardGridOptions<T extends SortableItem> {
  /** 当前排序后的项目列表。 */
  items: T[];
  /** 项目顺序变更后的回调（用于持久化到后端）。 */
  onReorder: (items: T[]) => void | Promise<void>;
}

/**
 * 可排序卡片网格 hook。
 *
 * 封装 @dnd-kit 的传感器配置、拖拽结束处理、以及 arrayMove 逻辑。
 * 返回可直接传给 DndContext + SortableContext 的 props。
 *
 * 使用方式：
 * ```tsx
 * const { sensors, sortableItems, handleDragEnd, SortableProvider } = useSortableCardGrid({
 *   items: sortedAgents,
 *   onReorder: async (reordered) => {
 *     await fetch("/api/interface/agents/reorder", { ... });
 *   },
 * });
 * ```
 */
export function useSortableCardGrid<T extends SortableItem>({
  items,
  onReorder,
}: UseSortableCardGridOptions<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((a) => a.id === active.id);
      const newIndex = items.findIndex((a) => a.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(items, oldIndex, newIndex);
      // 为每个元素赋予新的序号
      const withOrder = reordered.map((item, i) => ({ ...item, sort_order: i }));
      onReorder(withOrder);
    },
    [items, onReorder],
  );

  return {
    sensors,
    sortableItemIds: items.map((a) => a.id),
    handleDragEnd,
  };
}
