# 《Autonomous Agents：自己看板，自己认领》科普视频工程

> 交付状态：**文案轮完成、待用户审批**（2026-10-31）——系列《Claude Code 的 20 个核心机制》（claude-code-chapters，20 章 1:1 拆集）第 17 集（s17_autonomous_agents 单章）；Stage ①–⑤ 已完成（信源钉选复核·默认钉成立 + C 型冻结现行 175（§6 自治主线）+ 策划 + 逐字稿 56 句 1343 字 + 三路双重校验 + 成文优化两轮），机器门 build / pre-tts / 台账 audit+verify 全绿；**审批通过后进入制作**（⑥分镜/建图 → ⑦TTS → ⑧场景 → ⑨QA → ⑩交付）。标题随审批落定（候选见 planning.md §0）。发布顺序见 [../../series.json](series.json)（工作区根）。

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

- **钉站点轨 `67a9126c`（默认钉成立，未翻钉）**：`s17_autonomous_agents` 自治单章**仅存在于该轨**（main 轨 s17＝Goal Loop 撞号异物，自治已并入 `s13_agent_teams` 团队整合章、无单章形态）；单章完整覆盖本集机制面（三阶段生命周期 / 扫描三条件 / 身份重注入 / 60 s 超时纪律），且独有「深入 CC 源码」附录＝本集【三】级断言正源。站点页 `s17-site` 与旧系列 multiagent 台账基线零漂移。
- **main `7226f555` 为对照轨（台账 `s17m-*`）**：s13_agent_teams §5–§7 承接冻结正文「main 轨把这步补齐了」——发现与认领两步化、`task_store_lock()` 进程锁＋文件锁双重临界区、锁内重读防 TOCTOU、无固定超时，全部钉点 code.py 可数【一】级。
- **官方页 `doc-agent-teams` 时点快照【二】级**（2026-10-26 dateModified）：「任务认领用文件锁防同时抢任务」关键句同页在场，语义面复核成立。
- **实验 E4 本集复算【一】级**（2026-10-31 selftest，18 断言全绿）：撤掉认领锁→无锁交错双方假成功、终值归后写者；装回锁→同场景仅一人成功＝本集核心消融。
- 双钉唯一登记处：[source-map/claude-code-chapters.md](source-map/claude-code-chapters.md)。

## 复现流水线

```bash
# 在工作区内执行。$T/$W/$P/$V 的定义见 vibe-video skill 的 references/PIPELINE.md 路径变量约定（唯一定义处）
P=$W/episodes/claude-code-harness/chapters-17-autonomousagents

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
- 观众层信源标识只许首尾既定署源位（豁免登记工作区 `vibe-video.toml [check_series.source_credit]`，RSI I-080）。
- 骨架冻结档位见 [vibe-video skill 的 skeleton.toml](https://github.com/ThreeFish-AI/vibe-video/blob/main/assets/video-skeleton/skeleton.toml)；
  改动前先跑 `uv run --no-project $T/scripts/verify_skeleton.py`。

## 许可

源课程 [Learn Claude Code](https://github.com/shareAI-lab/learn-claude-code)（MIT）版权归原作者；本工程为解读与再创作，画面与口播为原创，成片首尾部署源说明（系列 2026-10-29 审批定制）。
