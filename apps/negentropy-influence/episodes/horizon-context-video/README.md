# 《拆解 Horizon Context：功能、治理、安全与开放性》

Context Layer 系列首集。信源为本仓 [Snowflake Horizon Context 精读笔记](../../../../docs/research/cognitive-context/011-horizon-context.md)
与配套最小原型（B 型 · 仓内固定提交 `097076eb`），逐条断言回溯 [research/source-notes.md](./research/source-notes.md)。

**交付状态**：v3 终渲待审（2026-09-19，评审意见修复后重渲）。
**15:11.63 = 27349 帧 @30fps · 1920×1080 · 48.1 MB**。
脚本层对齐 2026-09-17 重评选后的 M1–M7；187 句 / 4256 字 / 45 镜；
archify 工程图逐章录制 14 张 / 43 章（182s），**进片 12 张 / 29 章**，29 个 cue 按「一章锚一句」与台词对齐。

**验收**：七幕 + 尾幕抽帧体检 **FAIL 0 · WARN 0**（尾幕渐黑 PASS）· WCAG 七色全过 ·
`check_archify` FAIL 0（2 条 WARN = 两张录制留档未落镜，见 source-notes §十二）·
逐 cue K1/K4 像素差自检 **29/29** 确认句内有动效（最小 1.23%）·
估算与实测双口径均落在 `[13.0, 15.4]`（实测语速 303 字/分，与基线 301 吻合）。

## 目录

| 路径 | 作用 |
| --- | --- |
| `pipeline.toml` | 本集可执行参数**唯一来源**（预算窗 / TTS 样本与风格） |
| `script/planning.md` | 策划案六节（定位 / 叙事 / 视觉语言 / 幕结构 / 管线 / 边界） |
| `script/narration.md` | **逐字稿 SSOT**——只改这里，`narration.json` 由 build 派生 |
| `script/storyboard.md` | 45 镜分镜表，镜号与 `scenes/*.tsx` 的 `<Sequence name>` 一一对应 |
| `research/sources.toml` | 信源台账（pinned commit，`source_ledger.py verify` 执法） |
| `video/src/scenes/` | 七幕场景（P0Cold / P1Intern / P2Manual / P3Gate / P4Ledger / P5Badge / P6Ending） |
| `video/src/components/devices.tsx` | 本集视觉装置库（大厦剖面母图 / 七格 HUD / 对照台 / 数字对撞 / 证据角标） |
| `video/public/archify/views/` | 14 张工程图的引导故事定义（**入库**；webm 为派生产物） |
| `scripts/` | 薄包装 + 本集专用：`archify_lead.py`（场记板测定）/ `archify_manifest.py` |

## 复现

```bash
I=apps/negentropy-influence; R=$I/pipeline/scripts; P=$I/episodes/horizon-context-video; V=$I/pipeline/voices

# ① 信源核验
uv run --no-project $R/source_ledger.py --project $P verify

# ② 逐字稿派生 + 内容门
uv run --no-project $R/pipeline.py --project $P build
uv run --no-project $R/pipeline.py --project $P check --check-scenes --check-motion

# ③ archify 动效：补 views → 逐章录制 → 测定 lead → 生成 manifest
uv run --with playwright python $R/record_archify.py \
  "$PWD/docs/assets/architecture/cognitive-context/horizon-context--<slug>.html" /dev/null \
  "$P/video/public/archify/<slug>.json" --mode chapter --all-chapters \
  --out-dir "$PWD/$P/video/public/archify" --views "$PWD/$P/video/public/archify/views/<slug>.json"
cd $P && uv run --no-project --with pillow python scripts/archify_lead.py && uv run --no-project python scripts/archify_manifest.py

# ④ 配音（先 refs.py rebuild --name me-bright 重建样本）
uv run --no-project $R/pipeline.py --project $P tts --plan
uv run --no-project $R/pipeline.py --project $P tts

# ⑤ 草渲 + 体检 + 终渲
uv run --no-project $R/pipeline.py --project $P render
uv run --no-project $R/pipeline.py --project $P qa --video out/draft.mp4 --last-n 6 --check
uv run --no-project $R/pipeline.py --project $P render --final
uv run --no-project $R/pipeline.py --project $P captions
```

## 内容修改守则

1. **逐字稿只改 `script/narration.md`**；`narration.json` 是派生物，手改必被 build 覆盖。
2. 时序常数只在 `video/src/timing.json`；口播永不出现他集标题与集数序号（`check_series.py` 规则 1）。
3. **破坏性实验编号（D1–D10）与裸 `Context`/`Agent` 不进口播**——只进角标与终端输出。
4. 每个承重机制必须走满四拍：类比 → 机制不变量 → 破坏性实验反证 → 一句话收口。
5. 改骨架前先跑 `verify_skeleton.py`；archify 回放改动后必须重跑 `archify_manifest.py`。
