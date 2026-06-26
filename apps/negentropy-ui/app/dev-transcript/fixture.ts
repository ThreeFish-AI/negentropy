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
