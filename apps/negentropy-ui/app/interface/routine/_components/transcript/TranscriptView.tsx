"use client";

import { useMemo } from "react";

import { ROUTINE_POLICY, TranscriptItemsView } from "@/components/transcript";
import type { TranscriptItem } from "@/components/transcript";
import type { RoutineIterationEventDTO } from "@/features/routine";

import { normalizeTranscript } from "./normalize-transcript";

/**
 * Routine 迭代「人机交互」转录视图（薄壳）。
 *
 * 把扁平 ``RoutineIterationEventDTO[]`` 经 ``normalizeTranscript`` 折叠为
 * ``TranscriptItem[]``，前置合成的 ``task_dispatch`` 开场回合，再交共享渲染器
 * ``TranscriptItemsView`` + ``ROUTINE_POLICY`` 渲染。公共签名与外部引用路径不变，
 * 行为与历史逐像素等价（``ROUTINE_POLICY.roleHeaderFor`` 恒 null、对齐规则保留）。
 */
export function TranscriptView({
  events,
  live,
  openingPrompt,
}: {
  events: RoutineIterationEventDTO[];
  live?: boolean;
  /** 迭代任务 prompt（人下发给 CC 的任务）——非空时合成为开场「人→机」task_dispatch 回合。 */
  openingPrompt?: string | null;
}) {
  const normalized = useMemo(() => normalizeTranscript(events, { live: !!live }), [events, live]);
  const items = useMemo<TranscriptItem[]>(
    () =>
      openingPrompt && openingPrompt.trim()
        ? [{ kind: "task_dispatch", prompt: openingPrompt }, ...normalized]
        : normalized,
    [normalized, openingPrompt],
  );

  return <TranscriptItemsView items={items} live={live} policy={ROUTINE_POLICY} />;
}
