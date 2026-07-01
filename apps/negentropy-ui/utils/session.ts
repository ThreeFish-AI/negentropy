import type { AguiSessionSummary } from "@/lib/agui/session-schema";
import type { SessionRecord } from "@/types/common";

/**
 * 会话相关工具函数
 *
 * 从 app/page.tsx 提取的会话管理工具函数
 */

/**
 * 生成会话标签
 * @param id 会话 ID
 * @returns 格式化的会话标签
 */
export function createSessionLabel(id: string): string {
  return `Session ${id.slice(0, 8)}`;
}

export type SessionListView = "active" | "archived";

export function isSessionArchived(session: {
  state?: { metadata?: { archived?: boolean } };
}): boolean {
  return session.state?.metadata?.archived === true;
}

export function toSessionRecord(session: AguiSessionSummary): SessionRecord {
  return {
    id: session.id,
    label: session.state?.metadata?.title || createSessionLabel(session.id),
    lastUpdateTime: session.lastUpdateTime,
    archived: session.state?.metadata?.archived === true,
    timeLabel: session.lastUpdateTime ? formatRelativeTime(session.lastUpdateTime) : undefined,
  };
}

/** 将 epoch 秒转为相对时间文本（"刚刚" / "3 分钟前" / "昨天" / "5/8"） */
function formatRelativeTime(epochSeconds: number): string {
  const now = Date.now() / 1000;
  const diff = now - epochSeconds;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 172800) return "昨天";
  const d = new Date(epochSeconds * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 会话时间分档键（Doubao 式：今天 / 昨天 / 7 天内 / 30 天内 / 更早）。
 */
export type RecencyBucketKey = "today" | "yesterday" | "7d" | "30d" | "earlier";

export interface RecencyGroup<T> {
  key: RecencyBucketKey;
  label: string;
  items: T[];
}

const RECENCY_LABELS: Record<RecencyBucketKey, string> = {
  today: "今天",
  yesterday: "昨天",
  "7d": "7 天内",
  "30d": "30 天内",
  earlier: "更早",
};

const RECENCY_ORDER: RecencyBucketKey[] = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "earlier",
];

const DAY_MS = 86_400_000;

/**
 * 依据 ``lastUpdateTime``（epoch 秒）将会话分档为有序时间组（Doubao 式会话栏分组）。
 *
 * 约定（以本地日历日为界）：
 * - ``today``    ≥ 今日 0 点
 * - ``yesterday``在 [昨日 0 点, 今日 0 点)
 * - ``7d``       在 [今日 0 点 − 6 日, 昨日 0 点)（含今日共 7 个日历日窗口）
 * - ``30d``      在 [今日 0 点 − 29 日, 7d 下界)（含今日共 30 个日历日窗口）
 * - ``earlier``  更早，或缺失 ``lastUpdateTime``
 *
 * 输入内相对顺序被保留（调用方通常已按 ``lastUpdateTime`` 降序排序），
 * 空桶自动跳过；``now`` 可注入以便单测确定性。纯函数，无副作用。
 */
export function bucketSessionsByRecency<T extends { lastUpdateTime?: number }>(
  items: T[],
  now: Date = new Date(),
): RecencyGroup<T>[] {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfYesterday = startOfToday - DAY_MS;
  const start7d = startOfToday - 6 * DAY_MS;
  const start30d = startOfToday - 29 * DAY_MS;

  const buckets: Record<RecencyBucketKey, T[]> = {
    today: [],
    yesterday: [],
    "7d": [],
    "30d": [],
    earlier: [],
  };

  for (const item of items) {
    const seconds = item.lastUpdateTime;
    if (seconds == null || !Number.isFinite(seconds)) {
      buckets.earlier.push(item);
      continue;
    }
    const ms = seconds * 1000;
    if (ms >= startOfToday) buckets.today.push(item);
    else if (ms >= startOfYesterday) buckets.yesterday.push(item);
    else if (ms >= start7d) buckets["7d"].push(item);
    else if (ms >= start30d) buckets["30d"].push(item);
    else buckets.earlier.push(item);
  }

  return RECENCY_ORDER.filter((key) => buckets[key].length > 0).map((key) => ({
    key,
    label: RECENCY_LABELS[key],
    items: buckets[key],
  }));
}

/**
 * 构建 Agent URL
 * @param sessionId 会话 ID
 * @param userId 用户 ID
 * @param appName 应用名称
 * @returns 完整的 API URL
 */
export function buildAgentUrl(
  sessionId: string,
  userId: string,
  appName: string
): string {
  const params = new URLSearchParams({
    app_name: appName,
    user_id: userId,
    session_id: sessionId,
  });
  return `/api/agui?${params.toString()}`;
}
