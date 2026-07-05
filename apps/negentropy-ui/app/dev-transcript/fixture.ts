/**
 * Transcript 预览 fixture（仅供 dev 验证，生产路由默认 404）。
 *
 * 覆盖全部渲染分支：system/init、assistant（含 inline code + 列表）、Bash/Read/Edit/Grep、
 * 兜底 mcp 工具、运行态工具、plan_review、gate、evaluation、result。
 * 固定 seq / 省略 created_at，保证截图确定性。
 */

import type { RoutineIterationEventDTO } from "@/features/routine";

function ev(
  seq: number,
  event_type: RoutineIterationEventDTO["event_type"],
  patch: Partial<RoutineIterationEventDTO>,
): RoutineIterationEventDTO {
  return {
    id: `preview-${seq}`,
    iteration_id: "preview-iter",
    routine_id: "preview-routine",
    seq,
    event_type,
    tool_name: null,
    title: null,
    payload: {},
    cost_usd: null,
    created_at: null,
    ...patch,
  };
}

const PR_JSON = `{
  "number": 142,
  "title": "fix: number keys not registering",
  "headRefName": "fix-138-number-keys",
  "headRepositoryOwner": { "login": "getpaseo" }
}`;

const PAGE_TSX = `export default function Page() {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>{n}</button>;
}`;

/** 主转录（已完成态）—— 对标 paseo hero 中栏。 */
export const previewEvents: RoutineIterationEventDTO[] = [
  ev(0, "system", {
    title: "init",
    payload: { model: "claude-opus-4-8", cwd: "/repo", permission_mode: "default", session_id: "c28d917a" },
  }),
  ev(1, "assistant", {
    payload: {
      text: "我先确认当前分支与 PR 142 的真实 head 分支，再据此 checkout 并校验 `HEAD`。",
    },
  }),
  ev(2, "tool_use", {
    tool_name: "Bash",
    title: "Bash: git branch --show-current",
    payload: { tool_id: "t1", input: { command: "git branch --show-current" } },
  }),
  ev(3, "tool_result", { payload: { tool_use_id: "t1", output: "fix-138-number-keys", is_error: false } }),
  ev(4, "tool_use", {
    tool_name: "Bash",
    title: "Bash: gh pr view 142",
    payload: {
      tool_id: "t2",
      input: { command: "gh pr view 142 --json number,title,headRefName,headRepositoryOwner" },
    },
  }),
  ev(5, "tool_result", { payload: { tool_use_id: "t2", output: PR_JSON, is_error: false } }),
  ev(6, "assistant", {
    payload: {
      text: "`gh` 报告 PR 142 的真实 head 分支为 `fix-138-number-keys`。现在用 `git checkout 142` 切过去并核验 HEAD 与分支名。",
    },
  }),
  ev(7, "tool_use", {
    tool_name: "Read",
    title: "Read src/app/page.tsx",
    payload: { tool_id: "t3", input: { file_path: "src/app/page.tsx" } },
  }),
  ev(8, "tool_result", { payload: { tool_use_id: "t3", output: PAGE_TSX, is_error: false } }),
  ev(9, "tool_use", {
    tool_name: "Edit",
    title: "Edit src/app/page.tsx",
    payload: {
      tool_id: "t4",
      input: {
        file_path: "src/app/page.tsx",
        old_string: "  const [n, setN] = useState(0);",
        new_string: "  const [count, setCount] = useState(0);",
      },
    },
  }),
  ev(10, "tool_result", { payload: { tool_use_id: "t4", output: "The file src/app/page.tsx has been updated.", is_error: false } }),
  ev(11, "tool_use", {
    tool_name: "Grep",
    title: "Grep: useState",
    payload: { tool_id: "t5", input: { pattern: "useState" } },
  }),
  ev(12, "tool_result", {
    payload: { tool_use_id: "t5", output: "src/app/page.tsx:2:  const [count, setCount] = useState(0);", is_error: false },
  }),
  ev(13, "tool_use", {
    tool_name: "mcp__playwright__browser_navigate",
    title: "mcp__playwright__browser_navigate: http://localhost:3192",
    payload: { tool_id: "t6", input: { url: "http://localhost:3192" } },
  }),
  ev(14, "tool_result", { payload: { tool_use_id: "t6", output: "navigated to http://localhost:3192", is_error: false } }),
  ev(15, "assistant", {
    payload: {
      text: "正确的 PR 分支已 checkout：\n\n- Branch: `fix-138-number-keys`\n- Commit: `c28d917a4bf4`\n\n`git status` 干净且跟踪 `origin/fix-138-number-keys`。",
    },
  }),
  ev(16, "plan_review", {
    title: "plan_review (refine, score=72)",
    payload: {
      verdict: "refine",
      score: 72,
      module_reviews: [
        { module: "范围界定", status: "pass", comment: "目标分支判定正确" },
        { module: "边缘 Case", status: "warn", comment: "未覆盖 detached HEAD 情形" },
      ],
      feedback: "建议补充 `git checkout 142` 失败时的回退路径，并在校验段加入 `git rev-parse HEAD` 断言。",
      reflection: "首轮规划方向正确，细节稳健性可再加强。",
    },
  }),
  ev(17, "gate", {
    title: "gate",
    payload: { command: "pnpm test", exit_code: 0, output: "Test Suites: 12 passed, 12 total\nTests: 84 passed, 84 total" },
  }),
  ev(18, "evaluation", {
    title: "evaluation (progressing, score=78)",
    payload: { verdict: "progressing", score: 78, reflection: "分支切换链路已闭环，回归通过；下一轮补齐异常分支处理。" },
  }),
  ev(19, "result", {
    title: "success",
    cost_usd: 0.0423,
    payload: { result: "已将本地切换到 PR 142 的真实 head 分支并通过回归测试。", num_turns: 6, is_error: false },
  }),
];

/** 在途态片段（演示运行中工具脉冲 + LIVE）。 */
export const runningEvents: RoutineIterationEventDTO[] = [
  ev(0, "assistant", { payload: { text: "正在运行回归测试以确认改动……" } }),
  ev(1, "tool_use", {
    tool_name: "Bash",
    title: "Bash: pnpm test",
    payload: { tool_id: "r1", input: { command: "pnpm test --filter negentropy-ui" } },
  }),
];

const PLAN_V1 = `## 实现方案 v1

1. 修复 number keys 注册逻辑
2. 补充单测`;

/**
 * 人机交互完整回合（machine ↔ human）—— 演示 6 Agent（人）↔ Claude Code（机）的对话回合：
 *
 * CC 提交 Plan（AskUserQuestion / plan_submit）→ 元神 refine（plan_review）
 *   → CC 完善后再提交 → 元神 approve → CC 实施
 * → 连续 ≥3 工具折叠（tool_summary）
 * → CC 提问（AskUserQuestion / question）→ 本心 answer（auto_answer）
 * → ExitPlanMode → 元神 批准退出（auto_answer / approve_exit）
 *
 * 用于验证 cc_request 待决卡片、human_reply 角色头像（元神/本心）+ ✔/🔄 徽标、工具折叠。
 */
export const humanLoopEvents: RoutineIterationEventDTO[] = [
  ev(0, "system", {
    title: "init",
    payload: { model: "claude-opus-4-8", cwd: "/repo", permission_mode: "plan", session_id: "loop-001" },
  }),
  ev(1, "assistant", { payload: { text: "我先分析需求，然后提交实现方案供审阅。" } }),
  // CC 提交 Plan（plan_submit）—— 无 options 的开放式问题
  ev(2, "tool_use", {
    tool_name: "AskUserQuestion",
    title: "AskUserQuestion: 请审阅实现方案",
    payload: { tool_id: "p1", input: { questions: [{ question: `请审阅以下方案：\n\n${PLAN_V1}` }] } },
  }),
  // 元神 refine（plan_review）
  ev(3, "plan_review", {
    title: "plan_review (refine, score=68)",
    payload: {
      verdict: "refine",
      score: 68,
      module_reviews: [
        { module: "范围界定", status: "pass", comment: "目标明确" },
        { module: "边缘 Case", status: "fail", comment: "未覆盖组合键与连击场景" },
        { module: "测试", status: "warn", comment: "单测仅覆盖正常路径" },
      ],
      feedback: "请补充组合键（如 Shift+数字）与连击去抖的处理，并为边缘场景增加单测。",
      reflection: "首版方案方向正确但鲁棒性不足，需打回完善。",
    },
  }),
  ev(4, "assistant", { payload: { text: "收到审阅意见，已补充组合键与连击处理，重新提交方案。" } }),
  // CC 完善后再次提交 Plan
  ev(5, "tool_use", {
    tool_name: "AskUserQuestion",
    title: "AskUserQuestion: 请审阅完善后的方案",
    payload: {
      tool_id: "p2",
      input: { questions: [{ question: "方案 v2：已补充组合键映射、连击去抖（120ms）与对应单测，请审阅。" }] },
    },
  }),
  // 元神 approve
  ev(6, "plan_review", {
    title: "plan_review (approve, score=88)",
    payload: {
      verdict: "approve",
      score: 88,
      module_reviews: [
        { module: "范围界定", status: "pass", comment: "目标明确" },
        { module: "边缘 Case", status: "pass", comment: "组合键与连击已覆盖" },
        { module: "测试", status: "pass", comment: "单测覆盖正常 + 边缘路径" },
      ],
      feedback: "方案完备，可以实施。",
      reflection: "二轮完善后方案鲁棒性达标，批准实施。",
    },
  }),
  // CC 实施：连续 ≥3 工具（应折叠为 tool_summary）
  ev(7, "assistant", { payload: { text: "Plan 已批准，开始实施。" } }),
  ev(8, "tool_use", { tool_name: "Read", title: "Read src/keys.ts", payload: { tool_id: "t1", input: { file_path: "src/keys.ts" } } }),
  ev(9, "tool_result", { payload: { tool_use_id: "t1", output: "// key handler", is_error: false } }),
  ev(10, "tool_use", {
    tool_name: "Edit",
    title: "Edit src/keys.ts",
    payload: { tool_id: "t2", input: { file_path: "src/keys.ts", old_string: "a", new_string: "b" } },
  }),
  ev(11, "tool_result", { payload: { tool_use_id: "t2", output: "updated", is_error: false } }),
  ev(12, "tool_use", {
    tool_name: "Write",
    title: "Write src/keys.test.ts",
    payload: { tool_id: "t3", input: { file_path: "src/keys.test.ts", content: "test('combo', ...)" } },
  }),
  ev(13, "tool_result", { payload: { tool_use_id: "t3", output: "written", is_error: false } }),
  // CC 提问（question，带 options）→ 本心 answer（auto_answer）
  ev(14, "tool_use", {
    tool_name: "AskUserQuestion",
    title: "AskUserQuestion: 去抖时长？",
    payload: {
      tool_id: "q1",
      input: {
        questions: [
          { question: "连击去抖时长选哪个？", options: [{ label: "80ms" }, { label: "120ms" }, { label: "200ms" }] },
        ],
      },
    },
  }),
  // Phase 2 一等 auto_answer 事件（顶层 answer 全文 + 后端 agent_role 归因本心）
  ev(15, "auto_answer", {
    title: "auto_answer",
    agent_role: "internalization",
    payload: {
      tool_use_id: "q1",
      tool_name: "AskUserQuestion",
      questions: [{ question: "连击去抖时长选哪个？" }],
      answer: "选择 120ms：兼顾响应灵敏度与误触防护，符合既有交互基线。",
    },
  }),
  // ExitPlanMode → 元神 批准退出（auto_answer / approve_exit，agent_role=contemplation）
  ev(16, "tool_use", {
    tool_name: "ExitPlanMode",
    title: "ExitPlanMode",
    payload: { tool_id: "x1", input: { plan: "实施完成，退出 plan 模式。" } },
  }),
  ev(17, "auto_answer", {
    title: "auto_answer",
    agent_role: "contemplation",
    payload: {
      tool_use_id: "x1",
      tool_name: "ExitPlanMode",
      answer: "Plan approved. You may exit plan mode now.",
    },
  }),
  // 评估 + 结果归档
  ev(18, "evaluation", {
    title: "evaluation (succeeded, score=90)",
    payload: { verdict: "succeeded", score: 90, reflection: "组合键与连击均已覆盖，回归通过。" },
  }),
  ev(19, "result", {
    title: "success",
    cost_usd: 0.0512,
    payload: { result: "number keys 注册逻辑已修复，组合键与连击场景通过测试。", num_turns: 8, is_error: false },
  }),
];
