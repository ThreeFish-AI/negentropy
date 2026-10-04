# 《规划与协调：视野错位的五种修正手法》科普视频工程

> 交付状态：**v5 已交付**（2026-10-05；v2 2026-10-02 C 型 176 信源完全重制含评审修复 15 处；v3 = badge 双绘 + 二轮评审 10 处；v4 = 三轮评审 7 处；v5 = 评审循环 R1-R6 共 45 处修复 + ISSUE-208 方案 a 落地〔HoldRevive 唤活装置接入 21 条重灾区扩窗，53 条要点〕重渲）：13:20.73 = 800.7s @1080p30（24020 帧）· 155 句 3428 字 · archify 14 图 47 章逐章回放（锚定 30.3% · 密度 3.5/分 · 5 型全屏独占）· 内容+覆盖门 FAIL 0（内容门 1 条 RSI-039 开篇句式 WARN 为 skill 侧后加规则、系列五集同款）· QA FAIL 0（尾幕 1 条指纹 WARN 经像素 diff 定谳假阳性）· md5 源=档 `b6cc9d94` · 归档新题 v1-v5 + `_captions`×5（v5 字幕与 v4 逐字节同，口播零改动）。ISSUE-208 已按方案 a 关账；评审循环渲染债 11 条已随本次重渲清偿（成片时间戳 ≥ 修复提交，ISSUE-207 验收线）。
> 信源：[research/gl-notes.md](./research/gl-notes.md)（C 型冻结快照：176 精读 + 附录 A 类比登记表 + 附录 C 穿透 73 断言零 FAIL + lab 复算）；台账 [research/sources.toml](./research/sources.toml)（钉 `67a9126c`，verify FAIL 0）；发布顺序见 [../../series.json](../../series.json)。
>
> 复现流水线：`build → check → tts → render → qa --check → captions → render --final → deliver`（入口 `uv run --no-project scripts/pipeline.py --project . <cmd>`，机制见 to-video skill）。

## 目录结构

| 路径 | 说明 |
|---|---|
| `research/` | Stage ① 取证产物：全部口播断言须可回溯至此 |
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
P=$W/episodes/claude-code-planning-video

# ① 信源核验（B 型信源；A 型论文集跳过）
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
