import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const hookPath = path.join(rootDir, "hooks", "useSessionManager.ts");
const ignoredDirs = new Set([".git", ".next", "build", "coverage", "dist", "node_modules", "playwright-report"]);
const sourceExtensions = new Set([".ts", ".tsx"]);
const importPattern =
  /\b(?:import\s*\(|(?:import|export)\s+[^;]*?\s+from\s*)["']([^"']*useSessionManager(?:\.[^"']+)?)["']/g;

async function collectSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) {
        continue;
      }
      files.push(...(await collectSourceFiles(fullPath)));
      continue;
    }

    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function resolveLineNumber(text, index) {
  return text.slice(0, index).split("\n").length;
}

async function main() {
  const files = await collectSourceFiles(rootDir);
  const violations = [];

  for (const file of files) {
    if (file === hookPath) {
      continue;
    }

    const content = await readFile(file, "utf8");

    for (const match of content.matchAll(importPattern)) {
      const specifier = match[1];
      if (!specifier) {
        continue;
      }

      violations.push({
        file: path.relative(rootDir, file),
        line: resolveLineNumber(content, match.index ?? 0),
        specifier,
      });
    }
  }

  if (violations.length === 0) {
    console.log("No legacy useSessionManager imports found.");
    return;
  }

  console.error("Forbidden legacy useSessionManager imports detected:");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} -> ${violation.specifier}`);
  }
  console.error(
    "Please migrate session list logic to useSessionListService, and session detail/hydration logic to useSessionService.",
  );
  process.exitCode = 1;
}

await main();
