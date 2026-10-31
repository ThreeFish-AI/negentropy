# 《Worktree Isolation：一个任务，一个房间》科普视频工程

> 交付状态：**文案轮完成、待用户审批**（2026-10-31）——系列《Claude Code 的 20 个核心机制》（claude-code-chapters，20 章 1:1 拆集）第 18 集（s18_worktree_isolation 单章）；Stage ①–⑤ 已完成（信源钉选复核 + 官方 worktrees 页增量补证 + C 型冻结现行 175 换代代次 + 策划 + 逐字稿 50 句 1363 字 + 三路双重校验 + 成文优化两轮），机器门 build / pre-tts / source ledger 全绿（check_series 由系列层统一执法）；**审批通过后进入制作**（⑥分镜/建图 → ⑦TTS → ⑧场景 → ⑨QA → ⑩交付）。标题随审批落定（候选见 planning.md §0）。发布顺序见 [../../../series.json](series.json)（工作区根）。

## 目录结构

| 路径 | 说明 |
|---|---|
| `research/` | Stage ① 取证产物：全部口播断言须可回溯至此（gl-notes.md = C 型冻结件；source-archive/ = 双轨字节归档） |
| `script/planning.md` | Stage ② 策划案（六节齐，含本集视觉契约） |
| `script/narration.md` | Stage ③ 逐字稿 **★单一事实源**（勿改 narration.json） |
| `scripts/*.py` | 薄包装 → vibe-video skill 的 scripts/（解析器定位，保 CLI 契约） |
| `video/` | Remotion 独立 pnpm 工程（嵌套 workspace 自锚隔离） |
| `out/` | 渲染产物（gitignored） |
| `pipeline.toml` | 本集可执行参数的唯一来源（字段表见 [vibe-video skill 的 references/PIPELINE.md](https://github.com/ThreeFish-AI/vibe-video/blob/main/references/PIPELINE.md)） |

## 信源与钉选（本集要点）

- **钉站点轨 `67a9126c`**：s18_worktree_isolation 为 20 章版独有单章（main 无 s18+，团队四课并入 s13_agent_teams 的 §9/§10 两节），单章叙事完整且「深入 CC 源码」附录（EnterWorktree / AgentTool isolation / 名字校验 / 路径分支命名）是本集【三】级断言正源；钉点双件指纹与旧系列 2026-10-02 台账登记逐字一致。
- **main 轨 `7226f555` 对照不钉**：worktree 语义三处加固（移除收敛为宿主侧、assignment lease 重启恢复、绑定损坏认领即失败）作「生产化方向」对照，按【二】级课程讲法处理。
- **官方 worktrees 页增量补证**（台账 `doc-worktrees`，175 参考清单未引、C 型五增量）：退出检查口径（changed/untracked/uncommitted/new commits）与教学版守卫同型 + 子代理 worktree 隔离专节，本集边界句锚定。
- **本集核心消融复算【一】级**（2026-10-31 钉点 code.py 守卫沙箱探针，18 项断言全绿）：守卫在位，房内 1 个未提交文件去拆默认拒绝、房和线都在 ↔ 旁路强删（discard_changes=true）→ 文件无声蒸发、`wt/auth` 分支被 branch -D 连坐删除；lcc 原型零 worktree 代码（E1–E5 无一消融本集机制），消融不取自 GL 原型编号体系。
- 双钉唯一登记处：[source-map/claude-code-chapters.md](source-map/claude-code-chapters.md)。

## 复现流水线

```bash
# 在工作区内执行。$T/$W/$P/$V 的定义见 vibe-video skill 的 references/PIPELINE.md 路径变量约定（唯一定义处）
P=$W/episodes/claude-code-harness/chapters-18-worktreeisolation

# ① 信源核验
uv run --no-project $T/scripts/source_ledger.py --project $P verify

# ② 逐字稿派生 + 内容门
uv run --no-project $T/scripts/pipeline.py --project $P build
uv run --no-project $T/scripts/pipeline.py --project $P check --check-scenes

# ③ 配音（参数全部取自 pipeline.toml）
uv run --no-project $T/scripts/pipeline.py --project $P tts --plan
uv run --no-project $T/scripts/pipeline.py --project $P tts          # 长跑，建议 nohup

# ④ 渲染与体检（工具一律 ./node_modules/.bin/ 直调，防污染根 workspace）
cd $P/video && pnpm install && ./node_modules/.bin/tsc --noEmit
cd - && uv run --no-project $T/scripts/pipeline.py --project $P render
uv run --no-project $T/scripts/pipeline.py --project $P qa --video out/draft.mp4 --check
uv run --no-project $T/scripts/pipeline.py --project $P qa --video out/draft.mp4 --last-n 6 --check   # 尾幕渐黑必查（--video 按工程目录解析）

# ⑤ 交付
uv run --no-project $T/scripts/pipeline.py --project $P captions
uv run --no-project $T/scripts/pipeline.py --project $P render --final
uv run --no-project $T/scripts/pipeline.py --project $P deliver
```

## 内容修改守则

- 逐字稿只改 `script/narration.md`；`narration.json` / `manifest.json` 是派生物。
- 时序常数只在 `video/src/timing.json`（timing.ts 与 Python 侧 timeline.py 共读）。
- **口播永不出现他集标题与集数序号**——顺序只在视觉层与 series.json（`check_series.py` 执法）。
- 观众层信源标识只许首尾既定署源位（豁免登记工作区 `vibe-video.toml [check_series.source_credit]`，RSI I-080；本集条目 p0-01/p5-06 随系列层补录）。
- 骨架冻结档位见 [vibe-video skill 的 skeleton.toml](https://github.com/ThreeFish-AI/vibe-video/blob/main/assets/video-skeleton/skeleton.toml)；
  改动前先跑 `uv run --no-project $T/scripts/verify_skeleton.py`。

## 许可

源课程 [Learn Claude Code](https://github.com/shareAI-lab/learn-claude-code)（MIT）版权归原作者；本工程为解读与再创作，画面与口播为原创，成片首尾部署源说明（系列 2026-10-29 审批定制）。
