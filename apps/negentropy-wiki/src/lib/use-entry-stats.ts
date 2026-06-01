"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface EntryStats {
  view_count: number;
  comment_count: number;
  annotation_count: number;
}

/**
 * 获取 Wiki 条目的动态统计数据（浏览 / 评论 / 注解计数）
 * 并在首次挂载时自动记录一次页面浏览。
 */
export function useEntryStats(entryId: string | null) {
  const [stats, setStats] = useState<EntryStats | null>(null);
  const viewRecorded = useRef(false);

  // 获取统计数据
  useEffect(() => {
    if (!entryId) return;

    fetch(`/api/entries/${entryId}/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setStats({
            view_count: data.view_count ?? 0,
            comment_count: data.comment_count ?? 0,
            annotation_count: data.annotation_count ?? 0,
          });
        }
      })
      .catch(() => {
        // ignore
      });
  }, [entryId]);

  // 记录一次页面浏览（同一挂载只发一次）
  const recordView = useCallback(() => {
    if (!entryId || viewRecorded.current) return;
    viewRecorded.current = true;

    fetch(`/api/entries/${entryId}/view`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setStats((prev) =>
            prev
              ? { ...prev, view_count: data.view_count ?? prev.view_count }
              : prev,
          );
        }
      })
      .catch(() => {
        // ignore
      });
  }, [entryId]);

  // 挂载后自动记录浏览
  useEffect(() => {
    recordView();
  }, [recordView]);

  return { stats };
}
