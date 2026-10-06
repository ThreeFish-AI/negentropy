# 《目录常驻，正文按需：Agent Skills 开放标准》科普视频工程

> 交付状态：**v1 成片交付（2026-10-06，210 重学版换代重制）**：12:55.3 @1080p30 · 23,259 帧 · 142 句 3406 字 · edge 草声一档到底（用户拍板，实测 282 字/分）· archify 双图 10 章 12 cue（锚定 8.5%）· 机器门全绿（build/check--check-scenes/check_series/tsc/qa 全 FAIL 0）· 归档 `~/Documents/video/agent-infra/` v1（md5 fc8603e4abcf）+ `_captions/`。信源：[210 重学版精读](../../../../docs/research/agent-infra/210-agent-skills-open-standard.md)（C 型）。复现流水线见下。

## 目录结构

| 路径 | 说明 |
|---|---|
| `research/` | Stage ① 取证产物：gl-notes 冻结快照（本集唯一事实源正文）、sources.toml 活信源台账（14 条）、lab2 复算日志×6、[number-reconciliation](./research/number-reconciliation.md) 数字对账、archify-html 承接（html+mmd） |
| `script/planning.md` | Stage ② 策划案（六节齐 + 钩子候选矩阵 ★H4 拍板记录） |
| `script/narration.md` | Stage ③ 逐字稿 **★单一事实源**（v3，142 句；勿改 narration.json） |
| `script/storyboard.md` | Stage ⑥ 分镜表（33 镜 ↔ 句区间 ↔ 画面 ↔ 动效 ↔ Visual Lock） |
| `scripts/*.py` | 薄包装 → to-video skill 的 scripts/（解析器定位，保 CLI 契约）；`patch-archify-html.py` 为本集专用注入器 |
| `video/` | Remotion 独立 pnpm 工程（嵌套 workspace 自锚隔离；remotion 4.0.533） |
| `out/` | 渲染产物（gitignored） |
| `pipeline.toml` | 本集可执行参数的唯一来源（含 [archify] 覆盖门实测回填注释） |

## 复现流水线

```bash
# 在工作区内执行。$T/$W/$P 见 to-video skill 的 references/PIPELINE.md 路径变量约定
P=$W/episodes/agent-skills-video

# ① 信源核验（C 型：gl-notes 冻结 + 活信源台账 verify）
uv run --no-project $T/scripts/source_ledger.py --project $P verify

# ② 逐字稿派生 + 内容门（分镜覆盖性 / 时长预算双口径 / archify 覆盖门）
uv run --no-project $T/scripts/pipeline.py --project $P build
uv run --no-project $T/scripts/pipeline.py --project $P check --check-scenes

# ③ 配音（edge 草声直行——pipeline tts 即可，秒级幂等）
uv run --no-project $T/scripts/pipeline.py --project $P tts

# ③' archify 双图录制链（源图改动时才需重跑；views/*.json 为录制章集唯一事实源）
uv run --no-project $P/scripts/patch-archify-html.py
uv run --no-project --with playwright $T/scripts/record_archify_all.py --project $P
uv run --no-project --with pillow $T/scripts/archify_lead.py --project $P
uv run --no-project $T/scripts/archify_manifest.py --project $P

# ④ 渲染与体检（工具一律 ./node_modules/.bin/ 直调，防污染根 workspace）
cd $P/video && pnpm install && ./node_modules/.bin/tsc --noEmit
cd - && uv run --no-project $T/scripts/pipeline.py --project $P render
uv run --no-project $T/scripts/pipeline.py --project $P qa --video out/draft.mp4 --check
uv run --no-project $T/scripts/pipeline.py --project $P qa --video out/draft.mp4 --last-n 6 --check   # 尾幕渐黑必查

# ⑤ 交付
uv run --no-project $T/scripts/pipeline.py --project $P captions
uv run --no-project $T/scripts/pipeline.py --project $P render --final
uv run --no-project $T/scripts/pipeline.py --project $P deliver --dry-run   # 核名后实投（TO_VIDEO_DELIVER_ROOT）
```

## 内容修改守则

- 逐字稿只改 `script/narration.md`；`narration.json` / `manifest.json` 是派生物。
- 时序常数只在 `video/src/timing.json`；本集概念色（目录金/路由靛/治理紫）只在 `video/src/design/theme.ts`。
- **口播永不出现他集标题与集数序号**——顺序只在视觉层与 [series.json](../../series.json)（`check_series.py` 执法）。
- archify 章集：`video/public/archify/views/*.json` 是录制章集**唯一事实源**（patcher 会剥除 docs 原件自带的 GL 章容器，防同名遮蔽）；改章后须重录对应图并重跑 lead+manifest。
- 示意算式（6 万 token）与实测账本（16.9×）分属两体系：画面须带「示意估算」角标，不得并排比较（对账表口径）。
- 骨架冻结档位见 [to-video skill 的 skeleton.toml](https://github.com/ThreeFish-AI/to-video/blob/main/assets/video-skeleton/skeleton.toml)；改动前先跑 `uv run --no-project $T/scripts/verify_skeleton.py`。

## 许可

源规范文档 CC-BY-4.0、代码 Apache-2.0，版权归原作者；本工程仅为解读与再创作，画面与口播为原创。
