import { describe, expect, it } from "vitest";

import { ensureTrailingSlash, entryHref, graphHref, pubHref } from "@/lib/wiki-api";

// 内链 href 规范化（单一事实源）：`trailingSlash: true` 静态导出产出目录式 HTML，
// 全站内链须经 helper 带尾斜杠，方能在 nginx / static-web-server / Pages 下稳定命中。
describe("ensureTrailingSlash", () => {
  it("站内绝对路径补尾斜杠；已带斜杠幂等", () => {
    expect(ensureTrailingSlash("/negentropy/readme")).toBe("/negentropy/readme/");
    expect(ensureTrailingSlash("/foo/bar")).toBe("/foo/bar/");
    expect(ensureTrailingSlash("/foo/")).toBe("/foo/");
  });

  it("根路径不产出双斜杠，顺带保护根级 hash/query", () => {
    expect(ensureTrailingSlash("/")).toBe("/");
    expect(ensureTrailingSlash("/#anchor")).toBe("/#anchor");
    expect(ensureTrailingSlash("/?q=1")).toBe("/?q=1");
  });

  it("外部 URL 与同页 hash 原样返回（非路由）", () => {
    expect(ensureTrailingSlash("https://example.com/y")).toBe("https://example.com/y");
    expect(ensureTrailingSlash("http://example.com")).toBe("http://example.com");
    expect(ensureTrailingSlash("#anchor")).toBe("#anchor");
  });

  it("query / hash 后置于尾斜杠之后", () => {
    expect(ensureTrailingSlash("/foo?q=1")).toBe("/foo/?q=1");
    expect(ensureTrailingSlash("/foo#x")).toBe("/foo/#x");
    expect(ensureTrailingSlash("/foo?q=1#x")).toBe("/foo/?q=1#x");
  });

  it("Materialized Path 形 entry slug（含 /）正常补尾斜杠", () => {
    expect(ensureTrailingSlash("/wiki/harness-engineering/getting-started")).toBe(
      "/wiki/harness-engineering/getting-started/",
    );
  });

  it("空串原样返回", () => {
    expect(ensureTrailingSlash("")).toBe("");
  });
});

describe("链接构建器（entryHref / pubHref / graphHref）", () => {
  it("产出规范尾斜杠路径", () => {
    expect(entryHref("negentropy", "readme")).toBe("/negentropy/readme/");
    expect(entryHref("wiki", "harness-engineering/getting-started")).toBe(
      "/wiki/harness-engineering/getting-started/",
    );
    expect(pubHref("wiki")).toBe("/wiki/");
    expect(graphHref("wiki")).toBe("/wiki/graph/");
  });
});
