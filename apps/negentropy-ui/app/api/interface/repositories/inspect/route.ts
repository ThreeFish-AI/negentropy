import { proxyPost } from "@/app/api/interface/_proxy";

/**
 * Repository 分支枚举代理端点
 *
 * POST /api/interface/repositories/inspect
 *   body: { local_path } -> 后端枚举该本地仓库的 git 分支，供注册时基线下拉。
 *
 * 独立静态段（与 [repositoryId] 动态段并存）：枚举发生在 Repo 保存前、尚无 id 时。
 */

export async function POST(request: Request) {
  return proxyPost(request, "/interface/repositories/inspect");
}
