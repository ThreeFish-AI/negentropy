# 《AI 如何自己变强？》科普视频工程

> 基于 [arXiv:2607.13104《Self-Improvements in Modern Agentic Systems: A Survey》](https://arxiv.org/html/2607.13104v1) 的动效图解式科普视频（B 站/YouTube，约 17 分钟）。
> 形态：**本人音色克隆配音**（IndexTTS-2.5，passionate 激情风格）+ Remotion 代码动画，无真人出镜。
> （v3 前为 edge-tts 预置音色，两种引擎 manifest 契约一致，可随时切回。）

## 目录结构

| 路径 | 说明 |
|---|---|
| `research/paper-notes.md` | 论文精读笔记——全部口播内容的**单一事实源**（9 个并行提取代理逐节产出） |
| `script/planning.md` | 策划案：受众、叙事策略、视觉语言（蓝=改大脑 θ / 橙=改装备 Σ） |
| `script/narration.md` | 逐字稿（唯一维护处），`- [句id] 文本` 一句一行 |
| `script/narration.json` | 派生物：拆句结果，供 TTS 与字幕消费（勿手改） |
| `script/storyboard.md` | 分镜表：镜号 ↔ 句 id 区间 ↔ 画面动效（场景组件实现规格） |
| `scripts/build_narration.py` | narration.md → narration.json |
| `scripts/tts.py` | 逐句配音合成 + 时长 manifest（幂等；indextts 本人克隆 / edge 预置双引擎） |
| `scripts/qa_frames.py` | 按句 id 从渲染产物抽帧做视觉 QA |
| `video/` | Remotion 工程（独立 pnpm 项目，`ignore-workspace` 与主仓隔离） |
| `out/` | 渲染产物（gitignored） |

## 复现流水线

```bash
# 1. 改稿后重建逐句 JSON
uv run --no-project scripts/build_narration.py

# 2. 合成配音（本人音色克隆，增量幂等；参数读自本集 pipeline.toml（复现已上线音频的档：passionate + me-1.wav）；
#    需先启动 IndexTTS 服务，见 ../../pipeline/VOICE-CLONING.md）
uv run --no-project ../../pipeline/scripts/pipeline.py --project . tts

# 3. 预览（工具一律 ./node_modules/.bin/ 直调，防 pnpm run 污染根 workspace node_modules）
cd video && pnpm install --ignore-workspace && ./node_modules/.bin/remotion studio

# 4. 草渲（半分辨率快速迭代）
cd video && ./node_modules/.bin/remotion render Main ../out/draft.mp4 --scale=0.5 --jpeg-quality=60

# 5. 抽帧 QA（在根目录）
uv run --no-project scripts/qa_frames.py out/draft.mp4 --scene P2

# 6. 终渲 1080p30
cd video && ./node_modules/.bin/remotion render Main ../out/final.mp4
```

## 音画同步机制

每句一段 MP3；`tts.py` 产出 `video/public/audio/manifest.json`（含每句实测时长）；Remotion `calculateMetadata` 读取 manifest 计算全片时间轴（句间 0.32s、幕间 +0.9s、片头 0.6s、片尾 2s）——改稿后**只需重跑 1→2→4**，无需手工对轨。

## 内容修改守则

- 口播内容改动只发生在 `script/narration.md`；所有论文断言须可回溯 `research/paper-notes.md`；
- 新增/修改句后，受影响 beat 的 `beatWindow` 句 id 需在对应场景组件（`video/src/scenes/`）同步；
- 双色语义是全片视觉契约：蓝 `#4A9EFF` = 改大脑，橙 `#FF9F45` = 改装备。

## 许可注意

Remotion 对超过 3 人的公司需商业授权（个人/小团队免费）；若本视频转为公司用途，请评估许可或迁移 MIT 协议的 Motion Canvas。配音为**本人声音的自愿克隆**（IndexTTS-2.5，按 bilibili 模型使用许可：个人/研究用途可用，商用需联系 indexspeech@bilibili.com；克隆他人声音须获本人书面同意，详见 [VOICE-CLONING.md](../../pipeline/VOICE-CLONING.md) §八）。发布前请自行确认平台对合成语音的标注要求。
