# 《拆解 Horizon Context：功能、治理、安全与开放性》

Context Layer 系列首集。信源为本仓 [Snowflake Horizon Context 精读笔记](../../../../docs/research/cognitive-context/011-horizon-context.md)
与配套最小原型（B 型 · 仓内固定提交 `097076eb`），逐条断言回溯 [research/source-notes.md](./research/source-notes.md)。

**交付状态**：v6 终渲待审（2026-09-20，图例 2× 扩产 + 全屏独占切换 + 阈门六维加固，口播零改动）。
**15:11.63 = 27349 帧 @30fps · 1920×1080**（音频复用 v4，时长不变）。
187 句 / 4256 字 / 45 镜；archify 工程图 **67 张 / 162 章逐章高清录制，156 个 cue 进片**
（v5 为 33 图 86 章 73 cue）：句级锚定率 39.0% → **83.4%**、cue 密度 5.4 → **10.3/分**、
图型 4 → **5 种**（lifecycle 0→7 补空白）、最长无锚 7 → **4 句**，D1–D10 实证全部有图。

**v6 改了什么**：① 图例 2.03× 扩产——新增 34 张严格锚定逐字稿的工程图（密文对译 / 双基线证据链 /
外挂词典漂移 / 官方三句递进 / 七机制×十次拆坏 / 便利贴收拢成册 / 坏定义注册生死簿 D6 / 手册两半剖面 /
临机现算 / 事件扇出 / 多入口一个答案 / 计算纪律四条总纲 / 第一道防线 / 查询期逐页验放 / 三流合一 /
猜名强查拦截 D5 / 编译那一秒 / 藏≠拦 D5 / 核准条目的一生 / 落地两挑战 / 全楼水管台账 / 虚构流水入账 D8 /
逆流溯源 / 信任三段 / 权限交集 / 权限回收两种命运 D9 / 零越权窗口 D9 / 听证会 / 贴标即联动 /
治理≠计算 / 图纸vs地基 / 归因天平 / 租来的聪明 / 下期蓝图）+ 13 个闲置章接线（autopilot-loop /
evolution-timeline 两整图启用）+ 2 处挪锚（declare→p2-04 修复章序逆序、ingest-lane→p4-14a）；
② **inset 画中画退役**——archify 播放期不与自制装置同屏：三分法切换（嵌套子窗 / ArchifyYield 淡出
让位 / 画框直遮），42 处 inset 全部转全屏独占（640×360 → 1298×730 整屏），被图整镜接管的装置按
「视觉主权一句一主」原则退役，独有隐喻装置（半堵墙 / 栅栏立起 / 记忆柱等）保留可见岛；
③ 覆盖门六维加固——新增最长无锚 run / 分幕锚定率 / cue 密度 / 图型多样性 / forbid_inset / 同句排他
（+第 4 道 dur 形态断言），sidecar 落 `type` 字段（record_archify --type + 33 张存量回填），本集阈值
定稿 66 图 / 146 cue / 60% / 9/分 / 5 种（先红后绿留证 `.temp/coverage-gate-red-before-v4.txt`）。

**验收**：`check_script --check-scenes --check-motion` FAIL 0 · `check_archify` FAIL 0 · WARN 0 ·
覆盖门 FAIL 0 · WARN 0（v5 存量 3 WARN 清零：逆序经挪锚修复、两整图接线）· `tsc --noEmit` 绿 ·
rate 预演 156 cue 零越界 · 估算与实测双口径均落在 `[13.0, 15.4]`（口播未动，实测与 v4 一致）。

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
| `video/public/archify/views/` | 67 张工程图的引导故事定义（**入库**；mp4/end PNG 为派生产物） |
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
