import { describe, expect, it } from "vitest";

import { bucketSessionsByRecency } from "@/utils/session";

// 固定"现在"= 2026-07-01 12:00（本地），使分档边界确定、跨日不 flaky。
const NOW = new Date(2026, 6, 1, 12, 0, 0);
const sec = (d: Date) => Math.floor(d.getTime() / 1000);

type Item = { id: string; lastUpdateTime?: number };

describe("bucketSessionsByRecency", () => {
  it("按今天/昨天/7 天内/30 天内/更早分档，且顺序固定、空桶跳过", () => {
    const items: Item[] = [
      { id: "today", lastUpdateTime: sec(new Date(2026, 6, 1, 9, 0, 0)) },
      { id: "yesterday", lastUpdateTime: sec(new Date(2026, 5, 30, 9, 0, 0)) },
      { id: "within7d", lastUpdateTime: sec(new Date(2026, 5, 28, 9, 0, 0)) },
      { id: "within30d", lastUpdateTime: sec(new Date(2026, 5, 15, 9, 0, 0)) },
      { id: "older", lastUpdateTime: sec(new Date(2026, 4, 15, 9, 0, 0)) },
    ];

    const groups = bucketSessionsByRecency(items, NOW);

    expect(groups.map((g) => g.key)).toEqual([
      "today",
      "yesterday",
      "7d",
      "30d",
      "earlier",
    ]);
    expect(groups.map((g) => g.label)).toEqual([
      "今天",
      "昨天",
      "7 天内",
      "30 天内",
      "更早",
    ]);
    expect(groups.map((g) => g.items.map((it) => it.id))).toEqual([
      ["today"],
      ["yesterday"],
      ["within7d"],
      ["within30d"],
      ["older"],
    ]);
  });

  it("缺失或非法 lastUpdateTime 归入「更早」", () => {
    const items: Item[] = [
      { id: "no-ts" },
      { id: "nan", lastUpdateTime: Number.NaN },
      { id: "today", lastUpdateTime: sec(new Date(2026, 6, 1, 8, 0, 0)) },
    ];
    const groups = bucketSessionsByRecency(items, NOW);
    expect(groups.map((g) => g.key)).toEqual(["today", "earlier"]);
    expect(groups[1].items.map((it) => it.id)).toEqual(["no-ts", "nan"]);
  });

  it("空桶被跳过：仅今天有数据时只返回一个分组", () => {
    const groups = bucketSessionsByRecency(
      [{ id: "a", lastUpdateTime: sec(new Date(2026, 6, 1, 1, 0, 0)) }],
      NOW,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("today");
  });

  it("保留桶内原始相对顺序", () => {
    const t = sec(new Date(2026, 6, 1, 6, 0, 0));
    const groups = bucketSessionsByRecency(
      [
        { id: "a", lastUpdateTime: t },
        { id: "b", lastUpdateTime: t },
        { id: "c", lastUpdateTime: t },
      ],
      NOW,
    );
    expect(groups[0].items.map((it) => it.id)).toEqual(["a", "b", "c"]);
  });

  it("空输入返回空数组", () => {
    expect(bucketSessionsByRecency([], NOW)).toEqual([]);
  });
});
