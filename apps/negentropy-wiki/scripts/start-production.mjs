import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

function linkRuntimeAsset(sourcePath, targetPath) {
  if (!existsSync(sourcePath)) {
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

function prepareStandaloneRuntime(projectRoot) {
  const releaseServerEntry = path.join(projectRoot, "server.js");
  if (existsSync(releaseServerEntry)) {
    return {
      cleanup: () => {},
      serverEntry: releaseServerEntry,
    };
  }

  const standaloneRoot = path.join(projectRoot, ".next", "standalone");
  const standaloneServerEntry = path.join(standaloneRoot, "server.js");
  if (!existsSync(standaloneServerEntry)) {
    return {
      cleanup: () => {},
      serverEntry: null,
    };
  }

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
