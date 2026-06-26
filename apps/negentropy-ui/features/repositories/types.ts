/**
 * Repository 资源类型 —— 与后端 /interface/repositories 序列化契约（RepositoryResponse）对齐。
 *
 * Repository 注册「引擎主机上已 clone 的本地仓库根路径 + GitHub 地址 + 基线分支」，供 Routine
 * 下拉选择并派生隔离 worktree 配置（见 features/routine 的 repository_id）。
 */

export interface RepositoryDTO {
  id: string;
  owner_id: string;
  visibility: string;
  name: string;
  display_name: string | null;
  description: string | null;
  github_url: string;
  local_path: string;
  baseline_branch: string;
  default_remote: string;
  is_enabled: boolean;
  is_builtin: boolean;
  config: Record<string, unknown>;
  sort_order: number;
}

/** 创建请求体（name/github_url/local_path/baseline_branch 必填）。 */
export interface RepositoryCreatePayload {
  name: string;
  display_name?: string | null;
  description?: string | null;
  github_url: string;
  local_path: string;
  baseline_branch: string;
  default_remote?: string;
  is_enabled?: boolean;
  visibility?: string;
}

/** 更新请求体（全可选）。 */
export type RepositoryUpdatePayload = Partial<RepositoryCreatePayload>;

/** 分支枚举端点返回：给定 local_path 的本地 + 远端跟踪分支。 */
export interface BranchInspectResponse {
  local: string[];
  remote: string[];
  default_remote: string;
}
