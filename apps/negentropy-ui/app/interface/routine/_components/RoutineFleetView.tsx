"use client";

import { useMemo } from "react";
import { Activity } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { FadeIn } from "@/components/ui/FadeIn";
import { Skeleton } from "@/components/ui/Skeleton";
import type { RoutineDTO, RoutineIterationLite } from "@/features/routine";
import { useFleetSeed } from "@/features/routine";

import { RoutineFleetCard } from "./RoutineFleetCard";

interface RoutineFleetViewProps {
  routines: RoutineDTO[];
  latestByRoutine: Record<string, RoutineIterationLite>;
  loading: boolean;
  seedLatest: (routineId: string, lite: RoutineIterationLite) => void;
  onOpenDetail: (r: RoutineDTO) => void;
  onOpenFull: (r: RoutineDTO) => void;
}

/** 排序权重：待审批 < 运行中 < 暂停。 */
function rank(r: RoutineDTO, lite: RoutineIterationLite | undefined): number {
  if (lite?.status === "pending_approval") return 0;
  if (r.status === "running") return 1;
  return 2; // paused
}

export function RoutineFleetView({
  routines,
  latestByRoutine,
  loading,
  seedLatest,
  onOpenDetail,
  onOpenFull,
}: RoutineFleetViewProps) {
  // Fleet 聚焦「运行中 / 暂停」的活跃任务（其余在 Table 视图查看）。
  const active = useMemo(
    () =>
      routines
        .filter((r) => r.status === "running" || r.status === "paused")
        .sort((a, b) => {
          const ra = rank(a, latestByRoutine[a.id]);
          const rb = rank(b, latestByRoutine[b.id]);
          if (ra !== rb) return ra - rb;
          return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
        }),
    [routines, latestByRoutine],
  );

  // 进入 Live 视图时一次性回填 authoritative started_at（有界探测）。
  useFleetSeed(true, active, latestByRoutine, seedLatest);

  if (loading && routines.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-52 w-full rounded-card" />
        ))}
      </div>
    );
  }

  if (active.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border bg-card">
        <EmptyState
          icon={Activity}
          title="暂无运行中的任务"
          description="当前没有运行或暂停的 Routine。切换到 Table 视图查看全部任务，或新建一个自主任务。"
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {active.map((r, i) => (
        <FadeIn key={r.id} delay={Math.min(i * 30, 240)}>
          <RoutineFleetCard
            routine={r}
            latest={latestByRoutine[r.id]}
            onOpenDetail={onOpenDetail}
            onOpenFull={onOpenFull}
          />
        </FadeIn>
      ))}
    </div>
  );
}
