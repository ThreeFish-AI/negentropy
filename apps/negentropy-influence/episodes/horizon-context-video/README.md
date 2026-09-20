# 《拆解 Horizon Context：功能、治理、安全与开放性》

Context Layer 系列首集。信源为本仓 [Snowflake Horizon Context 精读笔记](../../../../docs/research/cognitive-context/011-horizon-context.md)
与配套最小原型（B 型 · 仓内固定提交 `097076eb`），逐条断言回溯 [research/source-notes.md](./research/source-notes.md)。

**交付状态**：v5 终渲待审（2026-09-20，动效图例扩产 + 高清重制，口播零改动）。
**15:11.63 = 27349 帧 @30fps · 1920×1080**（音频复用 v4，时长不变）。
187 句 / 4256 字 / 45 镜；archify 工程图 **33 张 / 86 章逐章高清录制，73 个 cue 进片**
（v4 为 14 图 43 章 29 cue）：覆盖率 15.5% → **39.0%**，P0/P6 结束整幕零锚，D1–D10 实证全部有图。

**v5 改了什么**：① 图例扩产 2.36×——新增 19 张严格锚定逐字稿的工程图（复印机陷阱 D1 / 去重 D2 /
先聚后除 D7 / 末快照 D3 / 关系消歧 / 语法×业务 / 治理破坏台 D5 / 选错页 / 双柱信任 / 万能钥匙 /
纳管缺口 / 多数派近道 D4 / 证据分级 / 落地鸿沟 / 安全周界 / 上游塌方 477 vs 48 / 裸库基线 /
口径打架 / 失忆实习生）+ 既有图增补 4 章（执行开关分化 / 木牌vs承重墙 / 双层防线 / 工牌双钟 D9）；
② 录制清晰度重制——绕开 Playwright 硬编码 VP8@1Mbps 编码器（driver 源码实证无质量旋钮），改
CDP JPEG q100 @DSF2（物理 4K）采集 + ffmpeg h264 CRF16 交付 2560×1440、恒定 CFR25（lead/rate
数学零改动），白闪零点加 300ms 预滚防竞态（86/86 全命中）；inset 画框 460×259 → 640×360（+39%
显示面积），全 16 个 inset 镜逐帧像素审计零侵入；③ 覆盖度自动阈门上线——
`check_archify_coverage.py` 三维度执法（句级锚定率 / 图·cue·章比地板 / 分镜声明↔cue 双向对账 +
单调性），由 `pipeline.py check` 自动串联，本集阈值定稿 28 图 / 58 cue / 30% / 70%（先红后绿留证
`.temp/coverage-gate-red-before.txt`）。

**验收**：`check_script --check-scenes --check-motion` FAIL 0 · `check_archify` FAIL 0（WARN 2 =
两张录制留档未落镜 + 1 条合法叙事重组逆序）· 覆盖门 FAIL 0 · WARN 3（同前，均为有意保留）·
`tsc --noEmit` 绿 · rate 预演 73 cue = 变速铺满 40 · 冻结补足 31 · 裁切 2 ·
估算与实测双口径均落在 `[13.0, 15.4]`（口播未动，实测与 v4 一致）。

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
# 仓库根执行。$I/$R/$V 的定义见 ../../pipeline/README.md 路径变量约定（唯一定义处）
P=$I/episodes/horizon-context-video

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
  # ↑ chapter 模式默认 cdp 高清采集（CDP JPEG q100 @DSF2 → h264 CRF16 @2560×1440）；
  #   需要旧 screencast 行为时加 --capture playwright。
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
5. 改骨架前先跑 `verify_skeleton.py`；archify 回放改动后必须重跑 `archify_manifest.py`；图例对逐字稿的覆盖/丰富/匹配（含分镜 archify 标注对账）已由 `pipeline.py check` 自动串联（check_archify_coverage.py，阈值见 pipeline.toml `[archify]`）。
