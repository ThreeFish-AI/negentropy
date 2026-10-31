# 《综合回合：机制很多，循环一个》科普视频工程

> 交付状态：**文案轮完成、待用户审批**（2026-10-31）——系列《Claude Code 的 20 个核心机制》（claude-code-chapters，20 章 1:1 拆集）第 20 集（s20_comprehensive 单章 · 系列终章）；Stage ①–⑤ 已完成（信源复核维持站点轨钉选 + C 型冻结现行 175（附录 A 类比表承袭旧系列 ep5 冻结件）+ 策划 + 逐字稿 56 句 1334 字 + 三路双重校验 + 成文优化四层 pass·修正三轮），机器门 build / pre-tts / ledger audit+verify 全绿（check_series 由主代理系列层统一跑）；**审批通过后进入制作**（⑥分镜/建图 → ⑦TTS → ⑧场景 → ⑨QA → ⑩交付）。标题随审批落定（候选见 planning.md §0）。发布顺序见 [../../series.json](../../series.json)（工作区根）。

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

- **站点轨 `67a9126c` 维持钉选**（开工复核不翻钉）：终章叙事件——「结束亦是开始」收束节（五行 while True 收束代码块 +「机制很多，循环一个」结语，冻结正文 §9 末段引文原身）与「相对 s19 的变化」11 行全量回归表仅此轨在册；20 章版是本系列集制骨架，s20 终章位与 ep20 收束身份同构。
- **main 轨 `7226f555` 对照在册**（s20m-* 台账，字节归档随集）：扩写增量（s08 压缩管线量化 + s13 加固语义回灌）属 ep8/ep15 集叙事面、非本集正源级，尾节「接下来 s16」非终点章框架；两轨判据句同向（认 tool_use block 不认收尾字段），无 ep2 型翻钉被迫性。
- **实验 E5 本集复算【一】级**（2026-10-31 selftest）：连接新服务沿用旧工具池 → `Unknown tool: mcp__docs__search`、每轮重组后恢复到手；selftest 18 断言全绿 / 128 行日志与冻结正文 §11 逐字互证；内置工具 27 件逐项可数（main 对照 26 件经 B.2 复算校正弃用不引）。
- 双钉唯一登记处：[source-map/claude-code-chapters.md](../../source-map/claude-code-chapters.md)。

## 复现流水线

```bash
# 在工作区内执行。$T/$W/$P/$V 的定义见 vibe-video skill 的 references/PIPELINE.md 路径变量约定（唯一定义处）
P=$W/episodes/claude-code-chapters-comprehensive-video

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
- **口播永不出现他集标题与集数序号**——顺序只在视觉层与 series.json（`check_series.py` 执法）；终章无下期，收尾只回扣系列开篇的循环主线。
- 观众层信源标识只许首尾既定署源位（片头角标 p0-01 + 片尾署源句 p5-08/p5-09；豁免登记工作区 `vibe-video.toml [check_series.source_credit]`，RSI I-080——ep20 白名单行随系列层登记 series.json 时同步补 `narration_ids = ["p0-01", "p5-08"]`）。
- 骨架冻结档位见 [vibe-video skill 的 skeleton.toml](https://github.com/ThreeFish-AI/vibe-video/blob/main/assets/video-skeleton/skeleton.toml)；
  改动前先跑 `uv run --no-project $T/scripts/verify_skeleton.py`。

## 许可

源课程 [Learn Claude Code](https://github.com/shareAI-lab/learn-claude-code)（MIT）版权归原作者；本工程为解读与再创作，画面与口播为原创，成片首尾部署源说明（系列 2026-10-29 审批定制）。
