# 《Tool Use：多加一个工具，只加一行》科普视频工程

> 交付状态：**已交付 v1**（2026-11-01）——系列《Claude Code 的 20 个核心机制》（claude-code-chapters，20 章 1:1 拆集）第 2 集（s02_tool_use 单章）；文案 2026-10-31 用户审批通过（基线 v1 + 制作轮微改进 5 句 → v2，50 句 1326 字）；⑥ 22 镜六场景分镜 v1（零建图原生路线，G1 对抗核验 1 RISKY + 4 WARN 全修）→ ⑦ me-bright/story 本人克隆声 TTS 50 句（MPS 水位 0 根治后续跑收官）→ ⑧ 六场景 3225 行 + 系列片头孪生挂载（Main 指纹与 ep1 同族 1c779384d763，drift 已登记）+ theme 概念色（琥珀 #EFB13C 对照表母题）；tsc/check --check-scenes/check_series 全绿。→ ⑨ QA 修复轮 13 项（3-A 插曲退场锚与全景 opacity 双根因、p5-04 未拦截活态等；帧级核验 5 直证+3 补帧确证）→ ⑩ 终渲 162s / 8742 帧 @30fps = 4 分 51.4 秒落窗，`~/Documents/video/claude-code-chapters/Tool Use：多加一个工具，只加一行 v1.mp4`。发布顺序见 [../../../series.json](../../../series.json)（工作区根）。

## 目录结构

| 路径 | 说明 |
|---|---|
| `research/` | Stage ① 取证产物：全部口播断言须可回溯至此（gl-notes.md = C 型冻结件；source-archive/ = 双轨字节归档） |
| `script/planning.md` | Stage ② 策划案（六节齐，含本集视觉契约） |
| `script/narration.md` | Stage ③ 逐字稿 **★单一事实源**（勿改 narration.json） |
| `script/storyboard.md` | Stage ⑥ 分镜表（镜号 ↔ 句 id 区间 ↔ 画面 ↔ 动效 ↔ Visual Lock） |
| `script/narration.cues.toml` | story 档配音台本（块情绪 + say 覆写） |
| `scripts/*.py` | 薄包装 → vibe-video skill 的 scripts/（解析器定位，保 CLI 契约） |
| `video/` | Remotion 独立 pnpm 工程（嵌套 workspace 自锚隔离） |
| `out/` | 渲染产物（gitignored） |
| `pipeline.toml` | 本集可执行参数的唯一来源（字段表见 [vibe-video skill 的 references/PIPELINE.md](https://github.com/ThreeFish-AI/vibe-video/blob/main/references/PIPELINE.md)） |

## 信源与钉选（本集要点）

- **翻钉 main `7226f555`**（自系列建档的站点轨规划态钉复核翻钉）：站点轨 s02 判据仍写收尾字段、直引必与本系列 ep1 所教「认内容不认字段」自相矛盾；main 前移新增「Bash 已经能做这些事，为什么还要加工具？」接口论证一节（本集 P1/P5 叙事正源）。
- **站点轨 `67a9126c` 降为附录正源**：s02 独有「深入 CC 源码」附录（isConcurrencySafe / 分区算法 / 五步验证 / 结果落盘）经台账 `s02f-*` 补登，断言恒【三】级。
- **实验 2 本集复算【一】级**（2026-10-29 selftest）：拔掉 tool_use_id 配对 → pairing_errors 0→2、轮次 10/10 不退化。
- 双钉唯一登记处：[source-map/claude-code-chapters.md](../../../source-map/claude-code-chapters.md)。

## 复现流水线

```bash
# 在工作区内执行。$T/$W/$P/$V 的定义见 vibe-video skill 的 references/PIPELINE.md 路径变量约定（唯一定义处）
P=$W/episodes/claude-code-harness/chapters-02-tooluse

# ① 信源核验
uv run --no-project $T/scripts/source_ledger.py --project $P verify

# ② 逐字稿派生 + 内容门
uv run --no-project $T/scripts/pipeline.py --project $P build
uv run --no-project $T/scripts/pipeline.py --project $P check --check-scenes

# ③ 配音（参数全部取自 pipeline.toml）
uv run --no-project $T/scripts/pipeline.py --project $P tts --plan
uv run --no-project $T/scripts/pipeline.py --project $P tts          # 长跑，建议 nohup
# 配音提速 1.25×（速率 SSOT=video/src/timing.json narrationTempo；源取 tts-store raw，幂等；tts 复跑/恢复后须重跑）
uv run --no-project $W/scripts/tempo_audio.py --project $P
uv run --no-project $W/scripts/tempo_audio.py --project $P --check   # 渲染前门

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
- 配音速率只在同一文件的 `narrationTempo`（仅 `scripts/tempo_audio.py` 读取，timing.ts/timeline.py 忽略）；`tts` 复跑或恢复会带回 1.0× raw，须重跑该脚本，`--check` 为渲染前门。
- **口播永不出现他集标题与集数序号**——顺序只在视觉层与 series.json（`check_series.py` 执法）。
- 观众层信源标识只许首尾既定署源位（豁免登记工作区 `vibe-video.toml [check_series.source_credit]`，RSI I-080）。
- 骨架冻结档位见 [vibe-video skill 的 skeleton.toml](https://github.com/ThreeFish-AI/vibe-video/blob/main/assets/video-skeleton/skeleton.toml)；
  改动前先跑 `uv run --no-project $T/scripts/verify_skeleton.py`。

## 许可

源课程 [Learn Claude Code](https://github.com/shareAI-lab/learn-claude-code)（MIT）版权归原作者；本工程为解读与再创作，画面与口播为原创，成片首尾部署源说明（系列 2026-10-29 审批定制）。
