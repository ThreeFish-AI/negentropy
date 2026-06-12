"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { TiltedCard } from "@/components/ui/TiltedCard";

/* ── Context：从 Wrapper 向 DragHandle 传递 sortable props ── */

interface SortableCardContextValue {
  /** 拖拽手柄的 HTML 属性（role、tabIndex 等）。 */
  attributes: Record<string, unknown>;
  /** 拖拽手柄的事件监听器。 */
  listeners: Record<string, unknown> | undefined;
  /** 是否正在拖拽。 */
  isDragging: boolean;
}

const SortableCardContext = createContext<SortableCardContextValue | null>(null);

/**
 * 获取当前 SortableCardWrapper 的 sortable 上下文。
 * 用于 SortableDragHandle 内部消费。
 */
function useSortableCardContext() {
  const ctx = useContext(SortableCardContext);
  if (!ctx) {
    throw new Error("SortableDragHandle must be used inside a SortableCardWrapper");
  }
  return ctx;
}

/* ── SortableDragHandle ── */

/**
 * 拖拽手柄。必须放在 SortableCardWrapper 内部。
 *
 * ```tsx
 * <SortableCardWrapper id={id} onEdit={handleEdit}>
 *   <SortableDragHandle />
 *   <h3>Title</h3>
 * </SortableCardWrapper>
 * ```
 */
export function SortableDragHandle({ className }: { className?: string }) {
  const { attributes, listeners } = useSortableCardContext();
  return (
    <button
      {...attributes}
      {...listeners}
      type="button"
      aria-label="Drag to reorder"
      className={
        "pointer-events-auto mt-0.5 cursor-grab rounded p-1.5 text-text-muted/40 transition-colors hover:bg-muted hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing " +
          (className ?? "")
      }
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

/* ── SortableCardWrapper ── */

interface SortableCardWrapperProps {
  /** 排序唯一标识（实体 ID）。 */
  id: string;
  /** 点击卡片主体时触发（打开编辑对话框/抽屉）。 */
  onEdit?: () => void;
  /** 是否可编辑（影响点击层与悬停样式）。 */
  canEdit?: boolean;
  /** 卡片主体内容。 */
  children: ReactNode;
  /** 额外容器 className。 */
  className?: string;
  /** 透传到外层 div 的 data-testid，供 E2E 测试定位。 */
  dataTestId?: string;
}

/**
 * 可排序卡片包装器。
 *
 * 封装 @dnd-kit/sortable 的 useSortable + TiltedCard disabled 联动 +
 * 不可见点击层。通过 Context 向内部的 SortableDragHandle 传递
 * attributes/listeners，使卡片布局完全灵活。
 *
 * 使用方式：
 * ```tsx
 * <SortableCardWrapper id={agent.id} onEdit={() => handleEdit(agent)} canEdit>
 *   <div className="relative z-20 flex min-h-0 flex-1 flex-col pointer-events-none">
 *     <div className="mb-1 flex min-w-0 items-start justify-between gap-2">
 *       <div className="flex min-w-0 items-start gap-1">
 *         <SortableDragHandle />
 *         <h3 className="truncate text-lg font-semibold text-foreground">{name}</h3>
 *       </div>
 *       <div className="flex shrink-0 items-center gap-1 pointer-events-auto">
 *         <button onClick={onDelete}>Delete</button>
 *       </div>
 *     </div>
 *     <p className="text-sm text-text-muted">Description</p>
 *   </div>
 * </SortableCardWrapper>
 * ```
 */
export function SortableCardWrapper({
  id,
  onEdit,
  canEdit = true,
  children,
  className,
  dataTestId,
}: SortableCardWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const contextValue: SortableCardContextValue = {
    attributes: { ...attributes },
    listeners: listeners ? { ...listeners } : undefined,
    isDragging,
  };

  return (
    <SortableCardContext.Provider value={contextValue}>
      <div
        ref={setNodeRef}
        style={sortableStyle}
        data-testid={dataTestId}
        className={isDragging ? "relative z-10" : undefined}
      >
        <TiltedCard disabled={isDragging}>
          <div
            className={[
              "relative flex h-full flex-col overflow-hidden rounded-xl border bg-card p-4 transition-colors",
              canEdit
                ? "cursor-pointer border-border hover:border-primary/30"
                : "border-border",
              isDragging ? "opacity-50 shadow-lg" : undefined,
              className,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {canEdit && onEdit && (
              <button
                type="button"
                aria-label="Edit"
                onClick={onEdit}
                className="absolute inset-0 z-10 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            )}
            {children}
          </div>
        </TiltedCard>
      </div>
    </SortableCardContext.Provider>
  );
}
