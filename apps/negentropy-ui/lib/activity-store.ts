/**
 * Activity Store
 *
 * 平台活动日志持久化存储（localStorage）
 * 纯模块设计，无 React 依赖
 *
 * 设计模式：Append-Only Log + FIFO 淘汰
 * - 所有 Toast 通知自动收录为 ActivityEntry
 * - FIFO 缓冲上限 500 条，约 100KB
 * - try/catch 包裹所有 localStorage 操作（SSR 安全 + 配额溢出兜底）
 */

const STORAGE_KEY = "negentropy:activity-log";
const MAX_ENTRIES = 500;

export type ActivityLevel = "success" | "error" | "info" | "warning";

export type ActivityEntry = {
  id: string;
  timestamp: number;
  level: ActivityLevel;
  message: string;
  description?: string;
};

/** 追加一条活动记录（FIFO，上限 500 条） */
export function appendActivity(entry: ActivityEntry): void {
  const entries = readActivities();
  entries.push(entry);
  const trimmed = entries.slice(-MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage 不可用或配额溢出——静默失败，Toast 仍正常显示
  }
}

/** 读取全部活动记录 */
export function readActivities(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ActivityEntry[];
  } catch {
    return [];
  }
}

/** 清空全部活动记录 */
export function clearActivities(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silent
  }
}
