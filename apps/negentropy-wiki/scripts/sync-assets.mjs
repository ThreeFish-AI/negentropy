#!/usr/bin/env node
/**
 * sync-assets.mjs — 把 wiki 内容根的 `assets/`（烘焙图片）幂等镜像到 `public/assets/`。
 *
 * 背景：主站 `WikiExportService`（bake_assets=true）把图片字节写到内容根
 * `assets/{doc}/{file}`，markdown 引用为 `/assets/{doc}/{file}`。但 Next.js
 * `output:"export"` 只复制 `public/` → `out/`，不会自动纳入内容根的 `assets/`。
 * 本脚本在 dev/build 前把内容根 `assets/` 镜像到 `public/assets/`，使 dev
 * （next dev 自动 serve `public/`）、build（`public/` → `out/`）、Pages
 * （`pnpm build` 触发本脚本）三场景图片皆可达。
 *
 * 源解析与 `src/lib/content-source.ts` 的 `resolveContentDir` 同构
 * （`WIKI_CONTENT_DIR` > `content/` 有 index.json > `content.fixture/`），
 * 保证镜像源与运行期读取的内容根一致。
 *
 * 容错：源缺失/为空时清空目标后 no-op（Docker 镜像构建、CI build-smoke 仅含
 * fixture 兜底时不会挂）。幂等：源存在时先清空目标再复制，防陈旧 doc 图片残留。
 *
 * 可测性：核心逻辑 `syncAssets` / `resolveContentDir` 导出供单测；仅直接运行时
 * 执行 `main`（ESM 入口守卫）。
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const wikiRoot = path.resolve(__dirname, "..");

/** 解析内容根（与 src/lib/content-source.ts resolveContentDir 同构）。 */
export function resolveContentDir(root = wikiRoot) {
  if (process.env.WIKI_CONTENT_DIR) {
    return path.resolve(process.env.WIKI_CONTENT_DIR);
  }
  const real = path.join(root, "content");
  if (existsSync(path.join(real, "index.json"))) {
    return real;
  }
  return path.join(root, "content.fixture");
}

/** 递归统计目录下普通文件数。 */
function countFiles(dir) {
  let count = 0;
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) {
      count += countFiles(p);
    } else {
      count += 1;
    }
  }
  return count;
}

/** 目录是否为空（读取失败视为空，容错非目录/权限异常）。 */
function isEmptyDir(dir) {
  try {
    return readdirSync(dir).length === 0;
  } catch {
    return true;
  }
}

/**
 * 把 `src`（内容根 assets/）幂等镜像到 `dest`（public/assets/）。
 *
 * - `src` 缺失/为空：清空 `dest` 后返回 `{ skipped: true, copied: 0 }`（no-op，
 *   保证 fixture 兜底 / Docker / CI smoke 不挂）。
 * - `src` 存在：先清空 `dest` 再递归复制（等价 rsync --delete，防陈旧 doc 残留）。
 */
export async function syncAssets(src, dest) {
  const srcPresent = existsSync(src) && !isEmptyDir(src);
  if (!srcPresent) {
    if (existsSync(dest)) {
      await rm(dest, { recursive: true, force: true });
    }
    return { skipped: true, copied: 0 };
  }
  await rm(dest, { recursive: true, force: true });
  await cp(src, dest, { recursive: true });
  return { skipped: false, copied: countFiles(dest) };
}

async function main() {
  const src = path.join(resolveContentDir(), "assets");
  const dest = path.join(wikiRoot, "public", "assets");
  const { copied, skipped } = await syncAssets(src, dest);
  if (skipped) {
    console.log("[sync-assets] 内容根无 assets/，跳过（public/assets/ 已清空或不存在）。");
  } else {
    console.log(`[sync-assets] 已同步 ${copied} 个图片文件 → public/assets/`);
  }
}

// 仅直接运行时执行 main（ESM 入口守卫；单测 import 时 process.argv[1] 非本文件，跳过）。
const invokedDirectly =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(__filename).href;
if (invokedDirectly) {
  main().catch((err) => {
    console.error("[sync-assets] 同步失败：", err);
    process.exit(1);
  });
}
