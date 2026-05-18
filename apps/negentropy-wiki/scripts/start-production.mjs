import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export function linkRuntimeAsset(sourcePath, targetPath) {
  if (!existsSync(sourcePath)) {
    return;
  }

  // 幂等性保护：monorepo 分支会把链接直接落在构建产物里、跨进程持久存在；
  // 若不在此处早返回，则二次启动时 `symlinkSync` 因 EEXIST 落入 `cpSync` 兜底，
  // 而 `cpSync` 检测到 src 与 dest 同源会以 ERR_FS_CP_EINVAL 失败。
  // `pnpm build` 会先清空 `.next/standalone`，不会残留陈旧链接。
  if (existsSync(targetPath)) {
    return;
  }

  mkdirSync(path.dirname(targetPath), { recursive: true });

  try {
    const relativeSource = path.relative(path.dirname(targetPath), sourcePath);
    symlinkSync(relativeSource, targetPath, "junction");
  } catch {
    cpSync(sourcePath, targetPath, { recursive: true });
  }
}

export function prepareStandaloneRuntime(projectRoot) {
  const releaseServerEntry = path.join(projectRoot, "server.js");
  if (existsSync(releaseServerEntry)) {
    return {
      cleanup: () => {},
      serverEntry: releaseServerEntry,
    };
  }

  // Next.js standalone 输出根的两种形态：
  // (a) 单一 workspace：`.next/standalone/server.js`
  // (b) monorepo 下（PR #557 之后）：`.next/standalone/apps/negentropy-wiki/server.js`，
  //     共享 node_modules 放在 `.next/standalone/node_modules/`
  //
  // (b) 的情况下 Next 已就位 `server.js` 与共享 `node_modules`，
  // 但按 Next 官方文档限制，`.next/static` 与 `public` 仍需调用方自行同步到
  // 与 `server.js` 同级的 `.next/`、`public/` 下；可直接原位启动，跳过下方 `.temp` 复制逻辑。
  const standaloneRoot = path.join(projectRoot, ".next", "standalone");
  const directEntry = path.join(standaloneRoot, "server.js");
  if (!existsSync(directEntry)) {
    const monorepoEntry = path.join(standaloneRoot, "apps", "negentropy-wiki", "server.js");
    if (existsSync(monorepoEntry)) {
      // 把 .next/static 与 public 同步到 standalone 目录内（Next standalone 不会自动复制）
      const monorepoNextDir = path.join(standaloneRoot, "apps", "negentropy-wiki", ".next");
      linkRuntimeAsset(
        path.join(projectRoot, ".next", "static"),
        path.join(monorepoNextDir, "static"),
      );
      linkRuntimeAsset(
        path.join(projectRoot, "public"),
        path.join(standaloneRoot, "apps", "negentropy-wiki", "public"),
      );
      return {
        cleanup: () => {},
        serverEntry: monorepoEntry,
      };
    }
    return {
      cleanup: () => {},
      serverEntry: null,
    };
  }
  const standaloneServerEntry = directEntry;

  const tempRoot = path.join(projectRoot, ".temp");
  mkdirSync(tempRoot, { recursive: true });
  const runtimeRoot = mkdtempSync(path.join(tempRoot, "negentropy-wiki-runtime-"));
  const runtimeNextRoot = path.join(runtimeRoot, ".next");
  const runtimeServerEntry = path.join(runtimeRoot, "server.js");

  mkdirSync(runtimeNextRoot, { recursive: true });
  cpSync(standaloneServerEntry, runtimeServerEntry);
  linkRuntimeAsset(path.join(standaloneRoot, "node_modules"), path.join(runtimeRoot, "node_modules"));

  for (const name of [
    "app-path-routes-manifest.json",
    "BUILD_ID",
    "build-manifest.json",
    "node_modules",
    "package.json",
    "prerender-manifest.json",
    "required-server-files.json",
    "routes-manifest.json",
    "server",
  ]) {
    linkRuntimeAsset(
      path.join(standaloneRoot, ".next", name),
      path.join(runtimeNextRoot, name),
    );
  }

  linkRuntimeAsset(
    path.join(projectRoot, ".next", "static"),
    path.join(runtimeNextRoot, "static"),
  );
  linkRuntimeAsset(path.join(projectRoot, "public"), path.join(runtimeRoot, "public"));

  return {
    cleanup: () => {
      rmSync(runtimeRoot, { force: true, recursive: true });
    },
    serverEntry: runtimeServerEntry,
  };
}

function isCliEntry() {
  const entryPath = process.argv[1];
  if (!entryPath) {
    return false;
  }
  return fileURLToPath(import.meta.url) === path.resolve(entryPath);
}

function bootstrap() {
  /* 应用默认端口与主机名（可被外部环境变量覆盖） */
  process.env.PORT ??= "3092";
  process.env.HOSTNAME ??= "localhost";

  const projectRoot = process.cwd();
  const { cleanup, serverEntry } = prepareStandaloneRuntime(projectRoot);

  if (!serverEntry) {
    cleanup();
    console.error(
      "找不到 Next.js standalone server 输出，请先执行 `pnpm build`。",
    );
    process.exit(1);
  }

  const child = spawn(process.execPath, [serverEntry], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      if (!child.killed) {
        child.kill(signal);
      }
    });
  }

  child.on("error", (error) => {
    cleanup();
    console.error("启动 standalone server 失败：", error);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    cleanup();
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

if (isCliEntry()) {
  bootstrap();
}
