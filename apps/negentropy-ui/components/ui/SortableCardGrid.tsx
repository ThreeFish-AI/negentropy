"use client";

import { type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import {
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

interface SortableCardGridProps {
  /** 排序项 ID 列表（传给 SortableContext）。 */
  itemIds: Array<string | number>;
  /** 拖拽结束回调。 */
  onDragEnd: (event: DragEndEvent) => void;
  /** 网格子元素（每张可排序卡片）。 */
  children: ReactNode;
  /** 额外 grid className。默认为 "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"。 */
  className?: string;
}

/**
 * 可排序卡片网格。
 *
 * 封装 DndContext + SortableContext + 响应式 grid 布局，
 * 统一全站 Interface 页面的卡片网格交互。
 */
export function SortableCardGrid({
  itemIds,
  onDragEnd,
  children,
  className = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3",
}: SortableCardGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={itemIds} strategy={rectSortingStrategy}>
        <div className={className}>
          {children}
        </div>
      </SortableContext>
    </DndContext>
  );
}
