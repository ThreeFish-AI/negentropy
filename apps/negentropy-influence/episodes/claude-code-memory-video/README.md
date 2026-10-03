# 《记忆管理：一张草稿纸和一本卡片册》科普视频工程

> 交付状态：**v3 已交付**（2026-10-03，评审修复三轮 16 项后重渲——173 死链改指 gl-notes/176 §9.3→§9.2 与 137 浮动注记/两图 mmd 回写 HTML 文案同构/P0 0-B 装置接缝精确句窗（886·1098 帧像素实证）/motifs·theme 死代码清除/memory_lab T8b 降级断言 35 checks/destruct 实验4 独立 root/pipeline 注释终声口径/CHANGELOG 与 storyboard 口径；13.15 分 = 789.03s @1080p30，帧数不变 23,670，mdls/manifest 对账，归档 ~/Documents/video/claude-code-explained/ v3 + _captions；v2 = 789.03s 二轮 13 项、v1 = 789.08s 2026-10-02，均见归档/git 历史）。C 型信源=docs 精读 176（钉 ce8f9f18）。发布顺序见 [../../series.json](../../series.json)（工作区根）。

## 目录结构

| 路径 | 说明 |
|---|---|
| `research/` | Stage ① 取证产物：全部口播断言须可回溯至此（C 型：[gl-notes.md](./research/gl-notes.md) 正文=[176 精读](../../../../docs/research/agent-harness/176-learn-claude-code-memory.md) 冻结快照 + 附录 A 类比登记表 + 附录 B 穿透记录） |
| `script/planning.md` | Stage ② 策划案（六节齐，含本集视觉契约） |
| `script/narration.md` | Stage ③ 逐字稿 **★单一事实源**（勿改 narration.json） |
| `script/storyboard.md` | Stage ⑥ 分镜表（镜号 ↔ 句 id 区间 ↔ 画面 ↔ 动效） |
| `scripts/*.py` | 薄包装 → to-video skill 的 scripts/（解析器定位，保 CLI 契约） |
| `video/` | Remotion 独立 pnpm 工程（嵌套 workspace 自锚隔离） |
| `out/` | 渲染产物（gitignored） |
| `pipeline.toml` | 本集可执行参数的唯一来源（字段表见 [to-video skill 的 references/PIPELINE.md](https://github.com/ThreeFish-AI/to-video/blob/main/references/PIPELINE.md)） |

## 复现流水线

```bash
# 在工作区内执行。$T/$W/$P/$V 的定义见 to-video skill 的 references/PIPELINE.md 路径变量约定（唯一定义处）
P=$W/episodes/claude-code-memory-video

# ① 信源核验（C 型信源=docs 精读 176 冻结快照 research/gl-notes.md；活源台账 6 条 @ce8f9f18）
uv run --no-project $T/scripts/source_ledger.py --project $P verify

# ② 逐字稿派生 + 内容门（分镜覆盖性 / 时长预算双口径 / 淡入不变式）
uv run --no-project $T/scripts/pipeline.py --project $P build
uv run --no-project $T/scripts/pipeline.py --project $P check --check-scenes

# ③ 配音（参数全部取自 pipeline.toml，勿在命令行另写 --style/--ref）
uv run --no-project $T/scripts/pipeline.py --project $P tts --plan   # 排期对账
uv run --no-project $T/scripts/pipeline.py --project $P tts          # 长跑，建议 nohup

# ④ 渲染与体检（工具一律 ./node_modules/.bin/ 直调，防污染根 workspace）
cd $P/video && pnpm install && ./node_modules/.bin/tsc --noEmit
cd - && uv run --no-project $T/scripts/pipeline.py --project $P render
uv run --no-project $T/scripts/pipeline.py --project $P qa --video out/draft.mp4 --check
uv run --no-project $T/scripts/pipeline.py --project $P qa --video out/draft.mp4 --last-n 6 --check   # 尾幕渐黑必查（--video 按工程目录解析）

# ⑤ 交付
uv run --no-project $T/scripts/pipeline.py --project $P captions
uv run --no-project $T/scripts/pipeline.py --project $P render --final
# 交付归档（可选；根 = --root 一次性 或 env TO_VIDEO_DELIVER_ROOT 持久，机器属性不进 toml）
uv run --no-project $T/scripts/pipeline.py --project $P deliver
```

## 内容修改守则

- 逐字稿只改 `script/narration.md`；`narration.json` / `manifest.json` 是派生物。
- 时序常数只在 `video/src/timing.json`（timing.ts 与 Python 侧 timeline.py 共读）。
- **口播永不出现他集标题与集数序号**——顺序只在视觉层与 series.json（`check_series.py` 执法）。
- 骨架冻结档位见 [to-video skill 的 skeleton.toml](https://github.com/ThreeFish-AI/to-video/blob/main/assets/video-skeleton/skeleton.toml)；
  改动前先跑 `uv run --no-project $T/scripts/verify_skeleton.py`。

## 许可

源论文/文档版权归原作者；本工程仅为解读与再创作，画面与口播为原创。
