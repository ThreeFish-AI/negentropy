"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  type CatalogNode,
  updateCatalogNode,
} from "@/features/knowledge";
import { toast } from "@/lib/activity-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DropTarget {
  overId: string;
  position: "before" | "inside" | "after";
}

export interface CatalogTreeDndApi {
  /** DndContext props */
  sensors: ReturnType<typeof useSensors>;
  collisionDetection: typeof closestCenter;
  onDragStart: (event: DragStartEvent) => void;
  onDragMove: (event: DragMoveEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;

  /** Rendering state */
  activeId: UniqueIdentifier | null;
  activeNode: CatalogNode | null;
  dropTarget: DropTarget | null;
  isMoving: boolean;
}

interface UseCatalogTreeDndOptions {
  nodes: CatalogNode[];
  expandedIds: Set<string>;
  catalogId: string | null;
  onMove: (
    nodeId: string,
    parentId: string | null,
    sortOrder: number,
  ) => Promise<void>;
  onExpand: (nodeId: string) => void;
  onRefresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Activation distance (px) to distinguish click from drag */
const ACTIVATION_DISTANCE = 8;

/** Delay (ms) before auto-expanding a collapsed folder during drag-hover */
const AUTO_EXPAND_DELAY = 700;

/** Sort-order spacing between siblings */
const SORT_GAP = 1000;

/** Threshold below which sibling sort_orders are considered too close */
const REINDEX_THRESHOLD = 0.5;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCatalogTreeDnd({
  nodes,
  expandedIds,
  catalogId,
  onMove,
  onExpand,
  onRefresh,
}: UseCatalogTreeDndOptions): CatalogTreeDndApi {
  // ---- state ----
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  // ---- refs (avoid stale-closure in callbacks) ----
  const activeIdRef = useRef<UniqueIdentifier | null>(null);
  const initialPointerRef = useRef({ x: 0, y: 0 });
  const autoExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMovingRef = useRef(false);

  // ---- derived ----
  const activeNode = useMemo(
    () => (activeId ? nodes.find((n) => n.id === activeId) ?? null : null),
    [activeId, nodes],
  );

  // ---- sensors ----
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: ACTIVATION_DISTANCE },
    }),
    useSensor(KeyboardSensor),
  );

  // ---- auto-expand helpers ----
  const clearAutoExpandTimer = useCallback(() => {
    if (autoExpandTimerRef.current !== null) {
      clearTimeout(autoExpandTimerRef.current);
      autoExpandTimerRef.current = null;
    }
  }, []);

  const scheduleAutoExpand = useCallback(
    (nodeId: string) => {
      clearAutoExpandTimer();
      if (!expandedIds.has(nodeId)) {
        autoExpandTimerRef.current = setTimeout(() => onExpand(nodeId), AUTO_EXPAND_DELAY);
      }
    },
    [expandedIds, onExpand, clearAutoExpandTimer],
  );

  // ---------------------------------------------------------------------------
  // findDropTarget — given absolute pointer coords, determine closest node
  // and the drop position (before / inside / after).
  // ---------------------------------------------------------------------------
  const findDropTarget = useCallback(
    (pointerX: number, pointerY: number): DropTarget | null => {
      const currentActiveId = activeIdRef.current;
      if (!currentActiveId) return null;

      const draggedNode = nodes.find((n) => n.id === currentActiveId);
      if (!draggedNode) return null;

      const nodeElements =
        document.querySelectorAll<HTMLElement>("[data-dnd-id]");

      let closestEl: HTMLElement | null = null;
      let closestDist = Infinity;

      for (const el of nodeElements) {
        const nodeId = el.getAttribute("data-dnd-id")!;
        if (nodeId === currentActiveId) continue;
        // Prevent dropping into own subtree
        if (draggedNode.path?.includes(nodeId)) continue;

        const rect = el.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;
        const dist = Math.abs(pointerY - centerY);
        if (dist < closestDist) {
          closestDist = dist;
          closestEl = el;
        }
      }

      if (!closestEl) return null;

      const overId = closestEl.getAttribute("data-dnd-id")!;
      const rect = closestEl.getBoundingClientRect();
      const relY = pointerY - rect.top;
      const h = rect.height;

      let position: "before" | "inside" | "after";
      if (relY < h * 0.25) {
        position = "before";
      } else if (relY > h * 0.75) {
        position = "after";
      } else {
        // Only folders accept "inside" drops
        const targetNode = nodes.find((n) => n.id === overId);
        position =
          targetNode?.node_type === "document_ref" ? "after" : "inside";
      }

      return { overId, position };
    },
    [nodes],
  );

  // ---------------------------------------------------------------------------
  // Sort-order calculation (same logic as before, extracted for clarity)
  // ---------------------------------------------------------------------------
  const calculateMove = useCallback(
    (
      draggedNodeId: string,
      targetNodeId: string,
      position: "before" | "inside" | "after",
    ): { parentId: string | null; sortOrder: number } | null => {
      const targetNode = nodes.find((n) => n.id === targetNodeId);
      if (!targetNode) return null;

      let parentId: string | null;
      let sortOrder: number;

      if (position === "inside") {
        parentId = targetNodeId;
        const children = nodes.filter((n) => n.parent_id === targetNodeId);
        sortOrder = children.length
          ? Math.max(...children.map((n) => n.sort_order)) + SORT_GAP
          : SORT_GAP;
      } else {
        parentId = targetNode.parent_id;
        const siblings = nodes
          .filter((n) => n.parent_id === targetNode.parent_id)
          .sort((a, b) => a.sort_order - b.sort_order);
        const idx = siblings.findIndex((s) => s.id === targetNodeId);

        if (position === "before") {
          const prev = idx > 0 ? siblings[idx - 1].sort_order : 0;
          sortOrder = (prev + targetNode.sort_order) / 2;
        } else {
          const next =
            idx < siblings.length - 1
              ? siblings[idx + 1].sort_order
              : targetNode.sort_order + SORT_GAP * 2;
          sortOrder = (targetNode.sort_order + next) / 2;
        }
      }

      return { parentId, sortOrder };
    },
    [nodes],
  );

  // ---------------------------------------------------------------------------
  // Sort-order reindexing — normalise siblings to SORT_GAP intervals when
  // the fractional-indexing gap drops below the threshold.
  // ---------------------------------------------------------------------------
  const reindexSiblings = useCallback(
    async (parentId: string | null) => {
      if (!catalogId) return;

      const siblings = nodes
        .filter((n) => n.parent_id === parentId)
        .sort((a, b) => a.sort_order - b.sort_order);

      let needsReindex = false;
      for (let i = 1; i < siblings.length; i++) {
        if (siblings[i].sort_order - siblings[i - 1].sort_order < REINDEX_THRESHOLD) {
          needsReindex = true;
          break;
        }
      }
      if (!needsReindex) return;

      await Promise.all(
        siblings.map((s, i) =>
          updateCatalogNode(catalogId, s.id, {
            sort_order: (i + 1) * SORT_GAP,
          }),
        ),
      );
      await onRefresh();
    },
    [catalogId, nodes, onRefresh],
  );

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  const handleDragStart = useCallback((event: DragStartEvent) => {
    activeIdRef.current = event.active.id;
    setActiveId(event.active.id);
    setDropTarget(null);

    const activator = event.activatorEvent as PointerEvent | null;
    if (activator) {
      initialPointerRef.current = { x: activator.clientX, y: activator.clientY };
    }
  }, []);

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const px = initialPointerRef.current.x + event.delta.x;
      const py = initialPointerRef.current.y + event.delta.y;
      const target = findDropTarget(px, py);

      setDropTarget((prev) => {
        if (prev?.overId === target?.overId && prev?.position === target?.position)
          return prev;
        return target;
      });

      if (target?.position === "inside") {
        scheduleAutoExpand(target.overId);
      } else {
        clearAutoExpandTimer();
      }
    },
    [findDropTarget, scheduleAutoExpand, clearAutoExpandTimer],
  );

  const handleDragEnd = useCallback(
    async () => {
      clearAutoExpandTimer();

      const draggedId = activeIdRef.current as string | null;
      activeIdRef.current = null;
      setActiveId(null);
      setDropTarget(null);

      if (!dropTarget || !draggedId || isMovingRef.current) return;

      const move = calculateMove(draggedId, dropTarget.overId, dropTarget.position);
      if (!move) return;

      // Skip if nothing actually changed
      const node = nodes.find((n) => n.id === draggedId);
      if (
        node &&
        node.parent_id === move.parentId &&
        Math.abs(node.sort_order - move.sortOrder) < 0.001
      ) {
        return;
      }

      isMovingRef.current = true;
      setIsMoving(true);
      try {
        await onMove(draggedId, move.parentId, move.sortOrder);
        await reindexSiblings(move.parentId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "移动失败");
      } finally {
        isMovingRef.current = false;
        setIsMoving(false);
      }
    },
    [
      dropTarget,
      calculateMove,
      nodes,
      onMove,
      reindexSiblings,
      clearAutoExpandTimer,
    ],
  );

  const handleDragCancel = useCallback(() => {
    clearAutoExpandTimer();
    activeIdRef.current = null;
    setActiveId(null);
    setDropTarget(null);
  }, [clearAutoExpandTimer]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    sensors,
    collisionDetection: closestCenter,
    onDragStart: handleDragStart,
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
    onDragCancel: handleDragCancel,

    activeId,
    activeNode,
    dropTarget,
    isMoving,
  };
}
