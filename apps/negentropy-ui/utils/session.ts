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
