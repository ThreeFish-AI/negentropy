# 《Team Protocols：对上号，才改状态》科普视频工程

> 交付状态：**文案轮完成、待用户审批**（2026-10-31）——系列《Claude Code 的 20 个核心机制》（claude-code-chapters，20 章 1:1 拆集）第 16 集（s16_team_protocols 单章，多 Agent 组）；Stage ①–⑤ 已完成（信源钉选复核（钉站点轨）+ C 型冻结现行 175 + 策划 + 逐字稿 55 句 1402 字 + 三路双重校验 + 成文优化三轮），机器门 build / check_script --pre-tts / ledger audit+verify 全绿；**审批通过后进入制作**（⑥分镜/建图 → ⑦TTS → ⑧场景 → ⑨QA → ⑩交付）。标题随审批落定（候选见 planning.md §0）。发布顺序见 [../../series.json](series.json)（工作区根）。

## 目录结构

| 路径 | 说明 |
|---|---|
| `research/` | Stage ① 取证产物：全部口播断言须可回溯至此（gl-notes.md = C 型冻结件；source-archive/ = 双轨字节归档 `67a9126c` + `7226f555`） |
| `script/planning.md` | Stage ② 策划案（六节齐，含本集视觉契约） |
| `script/narration.md` | Stage ③ 逐字稿 **★单一事实源**（勿改 narration.json） |
| `scripts/*.py` | 薄包装 → vibe-video skill 的 scripts/（解析器定位，保 CLI 契约） |
| `video/` | Remotion 独立 pnpm 工程（嵌套 workspace 自锚隔离） |
| `out/` | 渲染产物（gitignored） |
| `pipeline.toml` | 本集可执行参数的唯一来源（字段表见 [vibe-video skill 的 references/PIPELINE.md](https://github.com/ThreeFish-AI/vibe-video/blob/main/references/PIPELINE.md)） |

## 信源与钉选（本集要点）

- **钉站点轨 `67a9126c`**（维持系列建档规划钉，同 ep15 逻辑）：s16_team_protocols 是站点 20 章版唯一独立成章的协议课（README 243 行小节链 ProtocolState → 四步协议流程 → dispatch_message → match_response → consume_lead_inbox → 队友 idle loop，code.py 882 行协议专注），独有「深入 CC 源码」附录（teammateMailbox.ts 1184 行 / 三向关机 `:720-763` / ExitPlanModeV2Tool 计划审批 / Zod schema）是本集【三】级断言正源；站点页 s16 零漂移（2026-10-31 fetch 与旧系列 2026-10-02 基线双指纹一致）。
- **main 轨 `7226f555` 降为对照登记**（台账 `s16m-*`）：s13_agent_teams 为团队四课合并章（README.zh.md 448 行 12 节，协议仅剩 §11/§12 两节且删尽 CC 附录），直引必与 20 章 1:1 拆集冲突；真增量（执行闸门 `_run_teammate_tool` + `work_version` 推进使旧批文作废）只作 P4 闸门对照取用、不入主线。
- **实验 E2 本集复算【一】级**（2026-10-31 selftest 18 断言全绿）：拆掉类型校验 → 一条关机回复把 pending 的计划审批硬改成 approved；配套 E3（去掉统一消费入口 → 关机单永远 pending、二读 0 条）与 S2 防重探针（关掉状态检查 → 改写计数 1→2、反话副本翻案至 3）三件皆本集复算升【一】。
- 双钉唯一登记处：[source-map/claude-code-chapters.md](source-map/claude-code-chapters.md)。

## 复现流水线

```bash
# 在工作区内执行。$T/$W/$P/$V 的定义见 vibe-video skill 的 references/PIPELINE.md 路径变量约定（唯一定义处）
P=$W/episodes/claude-code-harness/chapters-16-teamprotocols

# ① 信源核验（B 型信源；A 型论文集跳过）
uv run --no-project $T/scripts/source_ledger.py --project $P verify

# ② 逐字稿派生 + 内容门（分镜覆盖性 / 时长预算双口径 / 淡入不变式）
uv run --no-project $T/scripts/pipeline.py --project $P build
uv run --no-project $T/scripts/pipeline.py --project $P check --check-scenes

# ③ 配音（参数全部取自 pipeline.toml，勿在命令行另写 --style/--ref）
uv run --no-project $T/scripts/pipeline.py --project $P tts --plan   # 排期对账
uv run --no-project $T/scripts/pipeline.py --project $P tts          # 长跑，建议 nohup

# ④ 渲染与体检（工具一律 ./node_modules/.bin/ 直调，防污染根 workspace）
cd $P/video && pnpm install && ./node_modules/.bin/tsc --noEmit
cd - && uv run --no-project $T/scripts/pipeline.py --project $P render
uv run --no-project $T/scripts/pipeline.py --project $P qa --video out/draft.mp4 --check
uv run --no-project $T/scripts/pipeline.py --project $P qa --video out/draft.mp4 --last-n 6 --check   # 尾幕渐黑必查（--video 按工程目录解析）

# ⑤ 交付
uv run --no-project $T/scripts/pipeline.py --project $P captions
uv run --no-project $T/scripts/pipeline.py --project $P render --final
# 交付归档（可选；根 = --root 一次性 或 env VIBE_VIDEO_DELIVER_ROOT 持久，机器属性不进 toml）
uv run --no-project $T/scripts/pipeline.py --project $P deliver
```

## 内容修改守则

- 逐字稿只改 `script/narration.md`；`narration.json` / `manifest.json` 是派生物。
- 时序常数只在 `video/src/timing.json`（timing.ts 与 Python 侧 timeline.py 共读）。
- **口播永不出现他集标题与集数序号**——顺序只在视觉层与 series.json（`check_series.py` 执法）。
- 观众层信源标识只许首尾既定署源位（豁免登记工作区 `vibe-video.toml [check_series.source_credit]`，RSI I-080）。
- 骨架冻结档位见 [vibe-video skill 的 skeleton.toml](https://github.com/ThreeFish-AI/vibe-video/blob/main/assets/video-skeleton/skeleton.toml)；
  改动前先跑 `uv run --no-project $T/scripts/verify_skeleton.py`。

## 许可

源课程 [Learn Claude Code](https://github.com/shareAI-lab/learn-claude-code)（MIT）版权归原作者；本工程为解读与再创作，画面与口播为原创，成片首尾部署源说明（系列 2026-10-29 审批定制）。
