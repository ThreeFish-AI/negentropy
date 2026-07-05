import { describe, expect, it } from "vitest";

import { agentRoleFromAuthor } from "@/features/agent-identity";

describe("agentRoleFromAuthor", () => {
  it("空值或缺省回退 engine（一核 NegentropyEngine 是默认 orchestrator）", () => {
    expect(agentRoleFromAuthor(undefined)).toBe("engine");
    expect(agentRoleFromAuthor(null)).toBe("engine");
    expect(agentRoleFromAuthor("")).toBe("engine");
  });

  it("claude_code 别名（大小写不敏感、子串）", () => {
    expect(agentRoleFromAuthor("claude_code")).toBe("claude_code");
    expect(agentRoleFromAuthor("Claude Code")).toBe("claude_code");
    expect(agentRoleFromAuthor("my-claude-agent")).toBe("claude_code");
  });

  it("一核 NegentropyEngine", () => {
    expect(agentRoleFromAuthor("NegentropyEngine")).toBe("engine");
    expect(agentRoleFromAuthor("negentropy-engine")).toBe("engine");
  });

  it("五翼 Faculty（英文学名 + 中文学名兜底）", () => {
    expect(agentRoleFromAuthor("PerceptionFaculty")).toBe("perception");
    expect(agentRoleFromAuthor("InternalizationFaculty")).toBe("internalization");
    expect(agentRoleFromAuthor("ContemplationFaculty")).toBe("contemplation");
    expect(agentRoleFromAuthor("ActionFaculty")).toBe("action");
    expect(agentRoleFromAuthor("InfluenceFaculty")).toBe("influence");

    // 中文名兜底（万一后端用中文学名）
    expect(agentRoleFromAuthor("慧眼")).toBe("perception");
    expect(agentRoleFromAuthor("本心")).toBe("internalization");
    expect(agentRoleFromAuthor("元神")).toBe("contemplation");
    expect(agentRoleFromAuthor("妙手")).toBe("action");
    expect(agentRoleFromAuthor("喉舌")).toBe("influence");
  });

  it("未知字符串回退 engine", () => {
    expect(agentRoleFromAuthor("random-agent-42")).toBe("engine");
  });
});
