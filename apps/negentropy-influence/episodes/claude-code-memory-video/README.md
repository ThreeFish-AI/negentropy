# 《记忆层：会丢的和不能丢的》科普视频工程

**已交付**。发布顺序见 [../../series.json](../../series.json)。

## 交付状态

| 项 | 状态 |
|---|---|
| 逐字稿 | ✅ 140 句 / 3900 字 / 7 幕 |
| 分镜 | ✅ 26 镜，覆盖性 FAIL 0 |
| 信源取证 | ✅ 6 条双轨（s08/s09 × readme/code/site）@ `67a9126c`，verify FAIL 0；字节归档 |
| 场景实现 | ✅ 7 幕 26 镜 3571 行，tsc 零错；`--check-scenes` FAIL 0 · WARN 0 |
| 配音 | ✅ 140/140 句 `sunny-steady` + `me-bright.wav`；纯语音 12.36 分，语速 315 字/分 |
| 时长双口径门 | ✅ **实测含时距 13.2 分**，落窗 13.0–14.6 |
| 字幕 | ✅ srt/vtt 各 140 cue |
| 草渲 + 抽帧 QA | ✅ 七幕 **FAIL 0 · WARN 2**（p5-03/05 时间铰链对照期、p6-03/04 金句卡停留，均为刻意设计）；尾幕必查 FAIL 0 · WARN 0 |
| **终渲交付** | ✅ `out/final.mp4` **13:14.47** · 1920×1080@30 · 36.1 MB（时长可复算：`total_duration_in_frames(narration.json, timing.json)` = 23834 帧 @30fps = 794.47s）；全分辨率尾幕末 6 句 **FAIL 0 · WARN 0** |
| 交付件 | ✅ `final.mp4` + `captions.srt` + `captions.vtt` + `cover.png`（标题卡帧 1920×1080） |

## 目录结构

| 路径 | 说明 |
|---|---|
| `research/` | Stage ① 取证产物：全部口播断言须可回溯至此 |
| `script/planning.md` | Stage ② 策划案（六节齐，含本集视觉契约） |
| `script/narration.md` | Stage ③ 逐字稿 **★单一事实源**（勿改 narration.json） |
| `script/storyboard.md` | Stage ⑤ 分镜表（镜号 ↔ 句 id 区间 ↔ 画面 ↔ 动效） |
| `scripts/*.py` | 薄包装 → [../../pipeline/scripts/](../../pipeline/scripts/)（保 CLI 契约） |
| `video/` | Remotion 独立 pnpm 工程（`--ignore-workspace` 隔离） |
| `out/` | 渲染产物（gitignored） |
| `pipeline.toml` | 本集可执行参数的唯一来源（字段表见 [../../pipeline/README.md](../../pipeline/README.md)） |

## 复现流水线

```bash
# 在仓库根执行。$I/$R/$V 的定义见 ../../pipeline/README.md 路径变量约定（唯一定义处）
P=$I/episodes/claude-code-memory-video

# ① 信源核验（B 型信源；A 型论文集跳过）
uv run --no-project $R/source_ledger.py --project $P verify

# ② 逐字稿派生 + 内容门（分镜覆盖性 / 时长预算双口径 / 淡入不变式）
uv run --no-project $R/pipeline.py --project $P build
uv run --no-project $R/pipeline.py --project $P check --check-scenes

# ③ 配音（参数全部取自 pipeline.toml，勿在命令行另写 --style/--ref）
uv run --no-project $R/pipeline.py --project $P tts --plan   # 排期对账
uv run --no-project $R/pipeline.py --project $P tts          # 长跑，建议 nohup

# ④ 渲染与体检（工具一律 ./node_modules/.bin/ 直调，防污染根 workspace）
cd $P/video && pnpm install --ignore-workspace && ./node_modules/.bin/tsc --noEmit
cd - && uv run --no-project $R/pipeline.py --project $P render
uv run --no-project $R/pipeline.py --project $P qa --video out/draft.mp4 --check
uv run --no-project $R/pipeline.py --project $P qa --video out/draft.mp4 --last-n 6 --check   # 尾幕渐黑必查（--video 按工程目录解析）

# ⑤ 交付
uv run --no-project $R/pipeline.py --project $P captions
uv run --no-project $R/pipeline.py --project $P render --final
```

## 内容修改守则

- 逐字稿只改 `script/narration.md`；`narration.json` / `manifest.json` 是派生物。
- 时序常数只在 `video/src/timing.json`（timing.ts 与 Python 侧 timeline.py 共读）。
- **口播永不出现他集标题与集数序号**——顺序只在视觉层与 series.json（`check_series.py` 执法）。
- 骨架冻结档位见 [../../pipeline/templates/video-skeleton/skeleton.toml](../../pipeline/templates/video-skeleton/skeleton.toml)；
  改动前先跑 `uv run --no-project $R/verify_skeleton.py`。

## 许可

源论文/文档版权归原作者；本工程仅为解读与再创作，画面与口播为原创。
