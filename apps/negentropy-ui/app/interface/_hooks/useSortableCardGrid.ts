"use client";

import { useCallback } from "react";
import {
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

interface SortableItem {
  id: UniqueIdentifier;
  sort_order?: number;
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
 * 封装拖拽结束处理与 arrayMove 逻辑，返回可直接传给 SortableCardGrid 的 props。
 * 传感器配置由 SortableCardGrid 组件内部管理，无需在此重复创建。
 *
 * 使用方式：
 * ```tsx
 * const { sortableItemIds, handleDragEnd } = useSortableCardGrid({
 *   items: sortedAgents,
 *   onReorder: async (reordered) => {
 *     await fetch("/api/interface/agents/reorder", { ... });
 *   },
 * });
 *
 * return (
 *   <SortableCardGrid itemIds={sortableItemIds} onDragEnd={handleDragEnd}>
 *     {items.map(item => <Card key={item.id} ... />)}
 *   </SortableCardGrid>
 * );
 * ```
 */
export function useSortableCardGrid<T extends SortableItem>({
  items,
  onReorder,
}: UseSortableCardGridOptions<T>) {
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((a) => a.id === active.id);
      const newIndex = items.findIndex((a) => a.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(items, oldIndex, newIndex);
      // 为每个元素赋予新的序号；void 显式忽略返回的 Promise
      const withOrder = reordered.map((item, i) => ({ ...item, sort_order: i }));
      void onReorder(withOrder);
    },
    [items, onReorder],
  );

  return {
    sortableItemIds: items.map((a) => a.id),
    handleDragEnd,
  };
}
