import { describe, expect, it } from "vitest";

import { countAgentRoles, deriveAgentRole, deriveHumanRole } from "@/features/routine";

/**
 * 多 Agent 归因（ADR 040）单测：
 * - ``deriveHumanRole``：人侧动作 → 一核五翼语义投射；
 * - ``countAgentRoles``：优先后端 agent_role，缺失回退 event_type 推导。
 */

describe("deriveHumanRole 语义投射", () => {
  it("审 Plan / 批准退出 / 评估 → 元神 contemplation", () => {
    expect(deriveHumanRole("plan_review")).toBe("contemplation");
    expect(deriveHumanRole("approve_exit")).toBe("contemplation");
    expect(deriveHumanRole("evaluation")).toBe("contemplation");
  });

  it("回答问题 → 本心 internalization", () => {
    expect(deriveHumanRole("answer_question")).toBe("internalization");
  });

  it("命令门控 / 拒绝工具 → 妙手 action", () => {
    expect(deriveHumanRole("gate")).toBe("action");
    expect(deriveHumanRole("deny_tool")).toBe("action");
  });
});

describe("deriveAgentRole 二分推导（Phase 1 兼容）", () => {
  it("编排/评估/审阅/结果 → engine", () => {
    expect(deriveAgentRole("plan_review")).toBe("engine");
    expect(deriveAgentRole("evaluation")).toBe("engine");
    expect(deriveAgentRole("gate")).toBe("engine");
    expect(deriveAgentRole("result")).toBe("engine");
  });

  it("执行动作 → claude_code", () => {
    expect(deriveAgentRole("assistant")).toBe("claude_code");
    expect(deriveAgentRole("tool_use")).toBe("claude_code");
    expect(deriveAgentRole("auto_answer")).toBe("claude_code");
  });
});

describe("countAgentRoles 后端归因优先", () => {
  it("无 agent_role 时回退 event_type 推导（仅 engine / claude_code 二分）", () => {
    const counts = countAgentRoles([
      { event_type: "assistant" },
      { event_type: "tool_use" },
      { event_type: "plan_review" },
    ]);
    const map = new Map(counts);
    expect(map.get("claude_code")).toBe(2);
    expect(map.get("engine")).toBe(1);
  });

  it("有 agent_role 时显化一核五翼真实角色（元神 / 本心 / 妙手）", () => {
    const counts = countAgentRoles([
      { event_type: "plan_review", agent_role: "contemplation" },
      { event_type: "auto_answer", agent_role: "internalization" },
      { event_type: "gate", agent_role: "action" },
      { event_type: "evaluation", agent_role: "contemplation" },
    ]);
    const map = new Map(counts);
    expect(map.get("contemplation")).toBe(2);
    expect(map.get("internalization")).toBe(1);
    expect(map.get("action")).toBe(1);
  });

  it("非法 agent_role 字符串回退 event_type 推导（防御）", () => {
    const counts = countAgentRoles([{ event_type: "plan_review", agent_role: "bogus" }]);
    expect(new Map(counts).get("engine")).toBe(1);
  });
});
