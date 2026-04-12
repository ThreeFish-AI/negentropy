/**
 * Activity Log Hook
 *
 * 提供平台活动日志的读取与过滤能力
 * 数据源：localStorage（由 activity-store 管理）
 *
 * 遵循 AGENTS.md 原则：单一职责、复用驱动
 */

import { useCallback, useMemo, useState } from "react";
import {
  readActivities,
  clearActivities,
  type ActivityEntry,
  type ActivityLevel,
} from "@/lib/activity-store";

export interface UseActivityLogOptions {
  /** 初始 level 过滤器（null = 全部） */
  initialFilter?: ActivityLevel | null;
}

export interface UseActivityLogReturnValue {
  /** 当前过滤后的条目（逆序：最新在前） */
  entries: ActivityEntry[];
  /** 当前 level 过滤器 */
  levelFilter: ActivityLevel | null;
  /** 设置 level 过滤器 */
  setLevelFilter: (level: ActivityLevel | null) => void;
  /** 从 localStorage 重新加载 */
  reload: () => void;
  /** 清空全部活动记录 */
  clear: () => void;
  /** 过滤前的总条目数 */
  totalCount: number;
}

export function useActivityLog(
  options: UseActivityLogOptions = {},
): UseActivityLogReturnValue {
  const { initialFilter = null } = options;
  const [allEntries, setAllEntries] = useState<ActivityEntry[]>(() =>
    readActivities().reverse(),
  );
  const [levelFilter, setLevelFilter] = useState<ActivityLevel | null>(
    initialFilter,
  );

  const reload = useCallback(() => {
    const raw = readActivities();
    // 逆序：最新在前
    setAllEntries(raw.reverse());
  }, []);

  const clear = useCallback(() => {
    clearActivities();
    setAllEntries([]);
  }, []);

  const entries = useMemo(
    () =>
      levelFilter
        ? allEntries.filter((e) => e.level === levelFilter)
        : allEntries,
    [allEntries, levelFilter],
  );

  return {
    entries,
    levelFilter,
    setLevelFilter,
    reload,
    clear,
    totalCount: allEntries.length,
  };
}
