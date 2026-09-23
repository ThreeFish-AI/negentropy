# 《经验淬炼成手册：Agent 的轻量蒸馏与按需装配》科普视频工程

> 交付状态：**v1 终渲待审（2026-09-24）**——成片 15:24.97（27749 帧 @30fps · 1080p30），归档 `~/Documents/video/agent-infra/经验淬炼成手册：Agent 的轻量蒸馏与按需装配 v1.mp4`；信源 17 条（本仓 090 @ `80b456fb` + 上游 agentskills/agentskills @ `69ef37e9` + 3 条站点类外部来源）；逐字稿 v3（200 句 / 4294 字，双重校验清零）；41 镜七幕 · archify 12 图 58 章 49 cue。发布顺序见 [../../series.json](../../series.json)（工作区根）。

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
P=$W/episodes/agent-skills-video

# ① 信源核验（B 型信源；A 型论文集跳过）
uv run --no-project $T/pipeline/scripts/source_ledger.py --project $P verify

# ② 逐字稿派生 + 内容门（分镜覆盖性 / 时长预算双口径 / 淡入不变式）
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P build
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P check --check-scenes

# ②½ archify 逐章录制 + lead 实测 + manifest（换 worktree 必须重录）
uv run --with playwright $T/pipeline/scripts/record_archify_all.py --project $P
uv run --no-project --with pillow $T/pipeline/scripts/archify_lead.py --project $P   # 必跑：录制器恒写 lead_sec=0
uv run --no-project $T/pipeline/scripts/archify_manifest.py --project $P

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
# 交付归档（可选；根 = --root 一次性 或 env TO_VIDEO_DELIVER_ROOT 持久，机器属性不进 toml）
uv run --no-project $T/pipeline/scripts/pipeline.py --project $P deliver
```

## 内容修改守则

- 逐字稿只改 `script/narration.md`；`narration.json` / `manifest.json` 是派生物。
- 时序常数只在 `video/src/timing.json`（timing.ts 与 Python 侧 timeline.py 共读）。
- **口播永不出现他集标题与集数序号**——顺序只在视觉层与 series.json（`check_series.py` 执法）。
- 骨架冻结档位见 [to-video skill 的 skeleton.toml](https://github.com/ThreeFish-AI/to-video/blob/main/pipeline/templates/video-skeleton/skeleton.toml)；
  改动前先跑 `uv run --no-project $T/pipeline/scripts/verify_skeleton.py`。

## 许可

源论文/文档版权归原作者；本工程仅为解读与再创作，画面与口播为原创。
