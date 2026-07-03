/**
 * cn 单元测试 —— 锁定 `tailwind-merge(clsx(...))` 的合并契约。
 *
 * 重点回归约束：
 * - Tailwind 冲突类「后者覆盖前者」（朴素拼接做不到，是本次升级动机）；
 * - 自定义 @theme 字号 token（text-caption 等）不被 text-color 任意值校验器吞并
 *   （全仓 229 行 text-{size}+text-{color} 同串共现，关乎大面积回归）；
 * - 默认字号 / 任意值字号 / 颜色组行为不回归；
 * - Routine Tooltip 真实类串：max-w 覆盖 + 字号与颜色并存。
 */
import { describe, it, expect } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  describe("基础合并（clsx 语义）", () => {
    it("拼接无冲突类", () => {
      expect(cn("a", "b")).toBe("a b");
    });

    it("过滤 falsy 值", () => {
      expect(cn("a", false, null, undefined, "", 0 as never, "b")).toBe("a b");
    });

    it("条件布尔表达式", () => {
      expect(cn("a", false && "x", "b", true && "c")).toBe("a b c");
    });

    it("嵌套数组", () => {
      expect(cn(["a", ["b", false && "c"], "d"])).toBe("a b d");
    });

    it("对象写法（ClassDictionary）", () => {
      expect(cn({ a: true, b: false, c: true })).toBe("a c");
    });
  });

  describe("Tailwind 冲突类：后者覆盖前者", () => {
    it("padding 冲突", () => {
      expect(cn("px-2", "px-4")).toBe("px-4");
    });

    it("任意值 max-width 覆盖具名（Routine Tooltip 背板宽度根因）", () => {
      expect(cn("max-w-sm", "max-w-[92vw]")).toBe("max-w-[92vw]");
    });

    it("颜色冲突：后者胜", () => {
      expect(cn("text-white", "text-zinc-400")).toBe("text-zinc-400");
    });

    it("默认字号冲突：后者胜", () => {
      expect(cn("text-lg", "text-xl")).toBe("text-xl");
    });
  });

  describe("自定义 @theme token 不被误判（核心回归约束）", () => {
    // 229 处 text-{size} + text-{color} 同串共现——字号与颜色必须并存
    it.each<[string, string]>([
      ["text-caption", "text-white"],
      ["text-caption", "text-zinc-400"],
      ["text-micro", "text-sky-600"],
      ["text-body", "text-foreground"],
      ["text-body-lg", "text-primary"],
      ["text-display", "text-primary"],
      ["text-h2", "text-foreground"],
      ["text-h4", "text-zinc-500"],
    ])("%s + %s 并存（字号≠颜色）", (a, b) => {
      expect(cn(a, b)).toBe(`${a} ${b}`);
    });

    it("自定义字号同组：后者覆盖前者", () => {
      expect(cn("text-caption", "text-micro")).toBe("text-micro");
    });

    it("默认字号与自定义字号同组：后者覆盖", () => {
      expect(cn("text-base", "text-caption")).toBe("text-caption");
      expect(cn("text-caption", "text-base")).toBe("text-base");
      expect(cn("text-xs", "text-caption")).toBe("text-caption");
    });

    it("任意值字号（text-[13px]）仍被识别为字号组", () => {
      expect(cn("text-caption", "text-[13px]")).toBe("text-[13px]");
    });

    it.each(["rounded-modal", "tracking-overline", "animate-fade-in", "duration-base", "leading-body"])(
      "%s 单独使用保留",
      (cls) => {
        expect(cn(cls)).toBe(cls);
      },
    );
  });

  describe("真实场景：Routine Tooltip 类串", () => {
    const STRUCTURAL =
      "z-[60] rounded-md border border-border bg-zinc-800 px-3 py-2 text-caption text-white shadow-lg dark:bg-zinc-700 dark:text-zinc-100";

    it("结构类 + w-max/max-w-[92vw] 覆盖：字号与颜色并存、max-w 正确落地", () => {
      const merged = cn(STRUCTURAL, "w-max max-w-[92vw]");
      // 字号 text-caption 与颜色 text-white 必须并存（旧朴素拼接本就并存，升级后仍并存）
      expect(merged).toContain("text-caption");
      expect(merged).toContain("text-white");
      // 宽度策略正确落地
      expect(merged).toContain("w-max");
      expect(merged).toContain("max-w-[92vw]");
      expect(merged).not.toContain("max-w-sm");
    });

    it("即便基类仍残留 max-w-sm，调用方 max-w-[92vw] 亦能覆盖（cn 升级独立可修复）", () => {
      // 模拟 fix#1 之前的旧基类（含 max-w-sm），验证 cn 升级本身即可消除宽度冲突
      const oldBase = `${STRUCTURAL} max-w-sm`;
      const merged = cn(oldBase, "w-max max-w-[92vw]");
      expect(merged).toContain("max-w-[92vw]");
      expect(merged).not.toContain("max-w-sm");
    });
  });
});
