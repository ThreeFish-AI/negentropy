/**
 * Auth Feature Module
 *
 * 导出认证相关的组件、hooks 和类型
 *
 * 职责：
 * - 认证状态管理
 * - 登录/登出流程
 * - 认证守卫
 */

// Hooks (re-export from providers/ for now)
export { useAuth } from "@/components/providers/AuthProvider";
