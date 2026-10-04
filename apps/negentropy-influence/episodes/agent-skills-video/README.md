# 《刻意做小：Agent Skills 开放标准》科普视频工程

> 交付状态：**v9 终渲待审（2026-10-05，十一轮评审 13+10+3+4+7+17+10+2+8+6+5 条全修）**：13:07.7 @1080p30 · 124 句 3678 字 · archify 双图 16 章 20 cue（锚定 16.1%）· 机器门全绿（check/tsc/qa 全 FAIL 0）· 归档 `~/Documents/video/agent-infra/` v9 + `_captions/`。复现流水线见下。

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
P=$W/episodes/agent-skills-video

# ① 信源核验（C 型信源＝gl-notes 精读产物；A 型论文集跳过）
uv run --no-project $T/scripts/source_ledger.py --project $P verify

# ② 逐字稿派生 + 内容门（分镜覆盖性 / 时长预算双口径 / 淡入不变式）
uv run --no-project $T/scripts/pipeline.py --project $P build
uv run --no-project $T/scripts/pipeline.py --project $P check --check-scenes

# ③ 配音（直呼集侧薄包装 tts.py——它不读 pipeline.toml，参数全部显式；勿经 pipeline tts，df 不透传）
uv run --no-project $T/scripts/pipeline.py --project $P tts --plan   # 排期对账（--plan 免授权门）
# 终稿合成 canonical 命令（RSI-040：--final-voice 为克隆具名授权，缺它硬失败；RSI-022：--with mutagen 必带；长跑建议 nohup）
uv run --no-project --with mutagen $P/scripts/tts.py \
  --engine indextts --final-voice --ref $W/voices/me-bright.wav --expect-ref-sha1 54b699cce97f \
  --style story --duration-factor 1.15

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
