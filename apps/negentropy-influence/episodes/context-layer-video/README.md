# 《拆解 Agent Context Layer：上下文怎么供给、治理、装配》科普视频工程

> 交付状态：**v4 零类比重制·edge 草渲待审**（2026-10-17 收敛轮重渲：013 式 5–7 LaTeX 统一、三症状→四类失效全链清零、p7-03 等长改写并入重配（共 5 句）、4 图章节素材重录＋lead/manifest 再生、draft.mp4 重渲过 beat-heads×4 全片＋尾幕渐黑共五项体检（FAIL 0·WARN 0；十项全量体检为 2026-10-16 版结论，终渲前重跑）；此前 2026-10-16 v4 零类比重制，组件直讲：组件名+白话+贯穿请求走查；RequestCard 恒定锚/FiveAxisMap 导航/双管线真名走查；2026-10-19 评审轮已修屏上术语（跨轴组合/沉淀轴段名）与 8-M lead（另同步组件注释术语；p0-09/p0-17/p0-24 口播等长改词、音轨待重配），draft 未随之重渲、终渲前须重渲重配并重跑体检）。终渲与交付待人工确认。发布顺序见 [../../series.json](../../series.json)（工作区根）。

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
P=$W/episodes/context-layer-video

# ① 信源核验（B 型信源；A 型论文集跳过）
uv run --no-project $T/scripts/source_ledger.py --project $P verify

# ② 逐字稿派生 + 内容门（分镜覆盖性 / 时长预算双口径 / 淡入不变式）
uv run --no-project $T/scripts/pipeline.py --project $P build
uv run --no-project $T/scripts/pipeline.py --project $P check --check-scenes

# ②b archify 图集重建（换 worktree 必跑；源图=archify 3.0 无 guided-views，须先注入兼容层再录制）
python3 $P/scripts/patch-archify-html.py                      # docs 原件 → 本集 html/ 桥接副本（SSOT 不动）
uv run --with playwright python $T/scripts/record_archify_all.py --project $P   # 串行 ~30min
uv run --no-project --with pillow $T/scripts/archify_lead.py --project $P      # 漏跑=白闪进片
uv run --no-project $T/scripts/archify_manifest.py --project $P

# ③ 配音（edge 草渲档；参数全部取自 pipeline.toml）
uv run --no-project $T/scripts/pipeline.py --project $P tts          # 秒级；改稿后重配亦秒级

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

源论文/文档版权归原作者；本工程仅为解读与再创作，画面与口播为原创。
