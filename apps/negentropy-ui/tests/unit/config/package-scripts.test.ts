import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(testDir, "../../../package.json");
const startLauncherPath = path.resolve(
  testDir,
  "../../../scripts/start-production.mjs",
);
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
  scripts?: Record<string, string>;
};

describe("package.json scripts", () => {
  it("start 脚本统一走 standalone 生产启动器", () => {
    expect(packageJson.scripts?.start).toBe("node ./scripts/start-production.mjs");
  });

  it("standalone 生产启动器文件已纳入仓库", () => {
    expect(existsSync(startLauncherPath)).toBe(true);
  });
});
