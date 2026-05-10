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
