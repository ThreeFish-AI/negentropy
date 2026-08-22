---
name: science-video-pipeline
description: 把论文/综述做成动效图解科普视频的九阶段流水线（论文精读提取→策划→逐字稿 SSOT→双重校验→分镜→TTS 声音克隆→Remotion 场景实现→草渲抽帧 QA→终渲交付）。Use when producing or iterating an apps/negentropy-influence/episodes/*-video/ episode: narration.md, storyboard.md, IndexTTS voice cloning, Remotion scenes, frame QA, or final render; or when scaffolding a new episode.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# 科普视频制作流水线（导航壳）

本 Skill 是路由层：内容 SSOT 在 `apps/negentropy-influence/pipeline/skills/01–09.md`，工具 SSOT 在
`apps/negentropy-influence/pipeline/scripts/`，不在此复制任何正文（防第二事实源）。

## 九阶段速查

| Stage | 做什么 | 规格链接 | 工具/命令（编排入口 `pipeline.py`） | 通过门 |
|---|---|---|---|---|
| ① 信源精读取证 | **A 型论文**：并行子代理逐章 + 官方站点补充；**B 型文档/代码/课程站点**：固定提交取证 + 证据三级 | [01](../../../apps/negentropy-influence/pipeline/skills/01-source-extraction.md) | A 型 `paper_extract.py`（map/text/captions/find/render）；B 型 `source_ledger.py`（fetch/list/verify/sync/audit——sync/audit 消费系列级 [source-map](../../../apps/negentropy-influence/source-map/claude-code-explained.md)） | 全部断言可回溯；RISKY=0 |
| ② 策划 | 受众/结构/视觉契约（色彩语义） | [02](../../../apps/negentropy-influence/pipeline/skills/02-planning.md) | — | planning.md 六节齐 |
| ③ 逐字稿 | narration.md ★单一事实源 | [03](../../../apps/negentropy-influence/pipeline/skills/03-narration.md) | `pipeline.py build` | `build_narration.py` 通过 |
| ④⑤ 双重校验 + 分镜 | 真实性回溯 + 易懂性；beat 覆盖性 | [04](../../../apps/negentropy-influence/pipeline/skills/04-verification.md) / [05](../../../apps/negentropy-influence/pipeline/skills/05-storyboard.md) | `pipeline.py check`（+`--check-scenes`） | RISKY=0；覆盖率无缺句 |
| ⑥ TTS 配音 | 本人音色克隆（IndexTTS-2.5） | [07](../../../apps/negentropy-influence/pipeline/skills/07-tts-voice.md) | `pipeline.py tts --plan` | refs 指纹门 + 试听 + ETA |
| ⑦ Remotion 场景 | 代码动画实现 | [06](../../../apps/negentropy-influence/pipeline/skills/06-remotion-implementation.md) | `tsc --noEmit` | 七条渲染红线 |
| ⑧ 草渲 + 抽帧 QA | 半分辨率快速迭代 | [08](../../../apps/negentropy-influence/pipeline/skills/08-render-qa.md) | `pipeline.py render` + `qa` | 自动体检零 FAIL |
| ⑨ 终渲 + 交付 | 1080p30 + srt/vtt | [09](../../../apps/negentropy-influence/pipeline/skills/09-final-render.md) | `render --final` + `captions` | 实测时长在预算窗 |

## 关键不变量

- 逐字稿只改 `narration.md`；`narration.json`/`manifest.json` 是派生物。
- **口播永不出现他集标题与集数序号**——顺序只在视觉层与 [series.json](../../../apps/negentropy-influence/series.json)（校验：`check_series.py`）。
  多系列（顶层 `seriesList[]`）语义：反串线规则**跨系列全局**，顺序类规则**按系列内**判定。
- **证据分级**：B 型信源里「他人对闭源产品源码的分析」属三级证据，口播必须带归属句，
  不得表述为产品既成事实；活数据（行数、总量、star 数）不进口播。
- 每集 `pipeline.toml` 是可执行参数的唯一来源；README 不复制命令行参数。
- 时序常数只在 `video/src/timing.json`（timing.ts 与 Python 共读）。
- 声音样本是生物特征：不入库（`voices/refs.toml` 只存指纹），试听后即删。
- 新集脚手架与复用边界（Python 集中 SSOT / Remotion 复制不共享）见 [pipeline/README.md](../../../apps/negentropy-influence/pipeline/README.md)。
