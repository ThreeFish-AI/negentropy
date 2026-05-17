import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const scannedDirs = ["app", "components", "features", "hooks", "utils"];

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return collectFiles(fullPath);
    if (!/\.(ts|tsx)$/.test(entry)) return [];
    return [fullPath];
  });
}

describe("native browser dialogs", () => {
  it("are not used in app code", () => {
    const offenders = scannedDirs
      .flatMap((dir) => collectFiles(path.join(projectRoot, dir)))
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return source
          .split("\n")
          .map((line, index) => ({ line, index }))
          .filter(({ line }) =>
            /window\.(confirm|alert|prompt)\s*\(|\b(alert|prompt)\s*\(/.test(line),
          )
          .map(({ line, index }) => ({
            file: path.relative(projectRoot, file),
            line: index + 1,
            source: line.trim(),
          }));
      });

    expect(offenders).toEqual([]);
  });
});
