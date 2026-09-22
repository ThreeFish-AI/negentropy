# 《翻旧账不花钱：AI 在梦里改章程》科普视频工程

> 交付状态：**v1 终渲待审**（2026-09-23）——时长复算式：**= 18926 帧 @30fps = 630.87s = 10 分 30.87 秒**（含尾静默；
> ffprobe Duration 00:10:30.87 与复算逐位吻合）。120 句 / 2989 字 / 估算 10.7 分（字数口径），实测 10.5 分（含时距口径）。
> archify 混合形态：16 图 / 61 章 / 50 cue，锚定 41.7%（P0 纯 Remotion 豁免）；草渲 QA FAIL 0（含 beat-heads / last-n / 主题对比度三色 ≥11:1）。
> 发布顺序见 [../../series.json](../../series.json)（工作区根）。

## 目录结构

| 路径 | 说明 |
|---|---|
| `research/` | Stage ① 取证产物：全部口播断言须可回溯至此 |
| `script/planning.md` | Stage ② 策划案（六节齐，含本集视觉契约） |
| `script/narration.md` | Stage ③ 逐字稿 **★单一事实源**（勿改 narration.json） |
| `script/storyboard.md` | Stage ⑤ 分镜表（镜号 ↔ 句 id 区间 ↔ 画面 ↔ 动效） |
| `scripts/*.py` | 薄包装 → to-video skill 的 pipeline/scripts/（解析器定位，保 CLI 契约） |
| `video/` | Remotion 独立 pnpm 工程（嵌套 workspace 自锚隔离） |
| `out/` | 渲染产物（gitignored） |
| `pipeline.toml` | 本集可执行参数的唯一来源（字段表见 [to-video skill 的 pipeline/README.md](https://github.com/ThreeFish-AI/to-video/blob/main/pipeline/README.md)） |

## 复现流水线

```bash
# 在工作区内执行。$T/$W/$P/$V 的定义见 to-video skill 的 pipeline/README.md 路径变量约定（唯一定义处）
P=$W/episodes/dream-rsi-video

# ① A 型论文集：paper-notes.md 即事实源（arXiv HTML v1 分章并行提取 + 原型复跑一级证据；本地冻结 PDF 已 gitignore）

# ⑤ archify 全量重录（换 worktree 必跑；串行 ~50min）
cd $P/video && pnpm install && cd - >/dev/null
uv run --with playwright python $T/pipeline/scripts/record_archify_all.py --project $P
cd $P && uv run --no-project --with pillow python scripts/archify_lead.py && uv run --no-project python scripts/archify_manifest.py
# ⚠ 首录后人工审定图型：lifecycle/architecture 无渲染器指纹，嗅探为空——照 dream-rsi-video 的 6 张 sidecar 先例回写 type

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
- 骨架冻结档位见 [to-video skill 的 skeleton.toml](https://github.com/ThreeFish-AI/to-video/blob/main/pipeline/templates/video-skeleton/skeleton.toml)；
  改动前先跑 `uv run --no-project $T/pipeline/scripts/verify_skeleton.py`。

## 许可

源论文/文档版权归原作者；本工程仅为解读与再创作，画面与口播为原创。
