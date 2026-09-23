# 《自己动手，给 AI 搭一个上下文层》科普视频工程

> 交付状态：**v3 重制待审（2026-09-23 已归档）**：013 重铸版信源 @ `6f643c216dee`（受治理大厦比喻剧场）；15:21 = 27639 帧 @30fps（185 句 4362 字，纯语音 14.4 分）；七幕 40 镜 · archify 12 图 70 章逐章回放（37 cue · 锚定 20.0%）· 代码走廊×10 · **顶部分段章节进度条首装**（frozen 模板 ChapterProgress，drift 已撤销）；sunny-steady 全片重合成；七幕抽帧 + beat-heads + 尾幕渐黑 + WCAG 全绿；归档 `~/Documents/video/context-layer/自己动手，给 AI 搭一个上下文层 v1.mp4`（归档根新启 v1 · 工程版本 v3）。发布顺序见 [../../series.json](../../series.json)。

## 目录结构

| 路径 | 说明 |
|---|---|
| `research/` | Stage ① 取证产物：全部口播断言须可回溯至此 |
| `script/planning.md` | Stage ② 策划案（六节齐，含本集视觉契约） |
| `script/narration.md` | Stage ③ 逐字稿 **★单一事实源**（勿改 narration.json） |
| `script/storyboard.md` | Stage ⑤ 分镜表（镜号 ↔ 句 id 区间 ↔ 画面 ↔ 动效） |
| `scripts/*.py` | 薄包装 → [$T/pipeline/scripts/](https://github.com/ThreeFish-AI/to-video/tree/main/pipeline/scripts)（保 CLI 契约） |
| `video/` | Remotion 独立 pnpm 工程（嵌套 workspace 自锚隔离） |
| `out/` | 渲染产物（gitignored） |
| `pipeline.toml` | 本集可执行参数的唯一来源（字段表见 [$T/pipeline/README.md](https://github.com/ThreeFish-AI/to-video/blob/main/pipeline/README.md)） |

## 复现流水线

```bash
# 在工作区根执行。$T/$W/$P/$V 的定义见 to-video skill 的 pipeline/README.md（唯一定义处：https://github.com/ThreeFish-AI/to-video/blob/main/pipeline/README.md）
P=$W/episodes/context-layer-video

# ① 信源核验（B 型信源；A 型论文集跳过）
uv run --no-project $T/pipeline/scripts/source_ledger.py --project $P verify

# ② 逐字稿派生 + 内容门（分镜覆盖性 / 时长预算双口径 / 淡入不变式）
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P build
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P check --check-scenes

# ③ 配音（参数全部取自 pipeline.toml，勿在命令行另写 --style/--ref）
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P tts --plan   # 排期对账
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P tts          # 长跑，建议 nohup

# ④ 渲染与体检（工具一律 ./node_modules/.bin/ 直调，防污染根 workspace）
cd $P/video && pnpm install && ./node_modules/.bin/tsc --noEmit
cd - && uv run --no-project $T/pipeline/scripts/pipeline.py --project $P render
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P qa --video out/draft.mp4 --check
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P qa --video out/draft.mp4 --last-n 6 --check   # 尾幕渐黑必查（--video 按工程目录解析）

# ⑤ 交付
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P captions
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P render --final
```

## 内容修改守则

- 逐字稿只改 `script/narration.md`；`narration.json` / `manifest.json` 是派生物。
- 时序常数只在 `video/src/timing.json`（timing.ts 与 Python 侧 timeline.py 共读）。
- **口播永不出现他集标题与集数序号**——顺序只在视觉层与 series.json（`check_series.py` 执法）。
- 骨架冻结档位见 [$T/pipeline/templates/video-skeleton/skeleton.toml](https://github.com/ThreeFish-AI/to-video/blob/main/pipeline/templates/video-skeleton/skeleton.toml)；
  改动前先跑 `uv run --no-project $T/pipeline/scripts/verify_skeleton.py`。

## 许可

源论文/文档版权归原作者；本工程仅为解读与再创作，画面与口播为原创。
