"use client";

import { useCallback } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { CatalogNode } from "@/features/knowledge";

interface DndTreeNodeProps {
  node: CatalogNode;
  isEditing: boolean;
  isMoving: boolean;
  children: React.ReactNode;
}

/**
 * Wraps each CatalogTreeNode with @dnd-kit drag + drop capabilities.
 *
 * - `useDraggable` enables the node to be dragged (PointerSensor / KeyboardSensor).
 * - `useDroppable` enables the node to receive drops.
 * - Both refs are merged onto the same DOM element via `data-dnd-id`.
 */
export function DndTreeNode({
  node,
  isEditing,
  isMoving,
  children,
}: DndTreeNodeProps) {
  const {
    isDragging,
    listeners,
    attributes,
    setNodeRef: setDragRef,
  } = useDraggable({
    id: node.id,
    data: { node },
    disabled: isEditing || isMoving,
  });

  const { setNodeRef: setDropRef } = useDroppable({
    id: node.id,
    data: { node },
  });

  const setRef = useCallback(
    (el: HTMLElement | null) => {
      setDragRef(el);
      setDropRef(el);
    },
    [setDragRef, setDropRef],
  );

  return (
    <div
      ref={setRef}
      data-dnd-id={node.id}
      className={`relative ${isDragging ? "opacity-40" : ""}`}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
