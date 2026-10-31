# 《拆解 Agent Context Layer：上下文怎么供给、治理、装配》科普视频工程

> 交付状态：**v3 已交付**（2026-10-22 lead 裁决重渲归档）：`~/Documents/video/context-layer/拆解 Agent Context Layer：上下文怎么供给、治理、装配 v3.mp4`（1080p30 h264+aac，时长 = 49553 帧 @30fps = 1651.77s = 27:31.77，窗口 [21,29.5] 内、距 30 分钟硬顶余量 148s）。v1（2026-10-21）克隆终声首交付后经 review-once 评审修复四处画面缺陷并重渲：P4 幕级角标锚点误减镜偏移（Snowflake/n² 角标提前可见）、P7 7-K 引入条未随结论淡出、P0 0-G 补 p0-26b hold cue（cue 136→137 与分镜对齐、消漏窗与重入弹簧）、RecapDim 三份实现收敛 components/ 单源（P1/P2 可见行为不变，v1/v2 A/B 对拍 0.0%）；v3 按作者裁决给 1-Eb 镜首补 lead={false}，与全片跨实例背靠背惯例统一（v2/v3 对拍差异仅在 p1-17b 镜界、其余抽样 0.0%）；逐字稿 v7（351 句 8291 字，三路缺口增补 + ④⑤独立评审清零）、分镜 v5（101 镜 / 137 cue）、画面 z 序修复 + 新增装置（登记行解剖 / 预算走查 / RankFusion / AuditCard 等）；终声＝IndexTTS-2.5 本人克隆 story 档 df=1.0（用户显式授权 `--final-voice`），`--plan` 口径 148 块全量缓存。全幕抽帧 QA FAIL 0 / WARN 0（含尾幕；beat-heads×4 全片）。发布顺序见 [../../../series.json](../../../series.json)（工作区根）。（I-234：旁白/屏上字用词整改已落库，成片待重制）

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
P=$W/episodes/context-layer

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

# ③ 配音（当前冻结档＝IndexTTS-2.5 本人克隆终声 story 档，实跑须带 --final-voice 具名授权；参数全部取自 pipeline.toml）
uv run --no-project $T/scripts/pipeline.py --project $P tts          # 克隆合成非秒级；块级全量缓存后增量恢复分钟级

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
