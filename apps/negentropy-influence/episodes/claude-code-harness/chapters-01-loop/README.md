# 《Agent Loop：一个循环，让 Agent 开始了心跳》科普视频工程

> 交付状态：**已交付 v3**（v1 2026-10-30 制作轮收官；v2 术语修订 p1-13「装置→程序」；v3 走查句改写 p2-03 拆两句「模型要求调用写文件」+参数句独立字幕，56→57 句，`~/Documents/video/claude-code-chapters/Agent Loop：一个循环，让 Agent 开始了心跳 v3.mp4`，终渲 4.8 分落窗）——系列《Claude Code 的 20 个核心机制》（claude-code-chapters，20 章 1:1 拆集）建档首集；文案经用户审批定题并修订三处（P4 归属句改「同学们应该知道」、正文去信源作者痕迹、首尾署源制：片头署源角标 + 片尾署源句 p5-07，豁免登记工作区 `vibe-video.toml [check_series.source_credit]`，RSI I-080）；制作轮：⑥ 25 镜六场景 + 系列片头《一个循环》孪生挂载（harness-stack 五大组×20 章数据面）→ ⑦ me-bright/story 本人克隆声 TTS（v1 期 56 句，v3 拆句重配后 57 句）→ ⑨ QA 机器门（全幕内容带/尾幕渐黑/beat 头全 FAIL 0）+ 五帧高风险目检全绿 → ⑩ 终渲交付。发布顺序见 [../../series.json](series.json)（工作区根）。

## 目录结构

| 路径 | 说明 |
|---|---|
| `research/` | Stage ① 取证产物：全部口播断言须可回溯至此 |
| `script/planning.md` | Stage ② 策划案（六节齐，含本集视觉契约） |
| `script/narration.md` | Stage ③ 逐字稿 **★单一事实源**（勿改 narration.json） |
| `script/storyboard.md` | Stage ⑥ 分镜表（镜号 ↔ 句 id 区间 ↔ 画面 ↔ 动效） |
| `scripts/*.py` | 薄包装 → vibe-video skill 的 scripts/（解析器定位，保 CLI 契约） |
| `video/` | Remotion 独立 pnpm 工程（嵌套 workspace 自锚隔离） |
| `out/` | 渲染产物（gitignored） |
| `pipeline.toml` | 本集可执行参数的唯一来源（字段表见 [vibe-video skill 的 references/PIPELINE.md](https://github.com/ThreeFish-AI/vibe-video/blob/main/references/PIPELINE.md)） |

## 复现流水线

```bash
# 在工作区内执行。$T/$W/$P/$V 的定义见 vibe-video skill 的 references/PIPELINE.md 路径变量约定（唯一定义处）
P=$W/episodes/claude-code-harness/chapters-01-loop

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
- 骨架冻结档位见 [vibe-video skill 的 skeleton.toml](https://github.com/ThreeFish-AI/vibe-video/blob/main/assets/video-skeleton/skeleton.toml)；
  改动前先跑 `uv run --no-project $T/scripts/verify_skeleton.py`。

## 许可

源课程 [Learn Claude Code](https://github.com/shareAI-lab/learn-claude-code)（MIT）版权归原作者；本工程为解读与再创作，画面与口播为原创，成片首尾部署源说明（2026-10-29 审批定）。
