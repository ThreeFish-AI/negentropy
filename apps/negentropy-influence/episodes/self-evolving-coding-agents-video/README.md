# 《会写代码的 AI，开始给自己写代码》科普视频工程

> 基于 H. Zhou, H. Hu, Y. Shang, Q. Zhang, "Self-Evolving Coding Agents: A Survey," arXiv:2608.03392, Aug. 2026（南京理工大学 × 南京大学综述）的动效图解式科普视频（B 站/YouTube，目标 14.5–15.5 分钟）。
> 形态：**本人音色克隆配音**（IndexTTS-2.5，passionate 激情风格）+ Remotion 代码动画，无真人出镜。
> （v3 前为 edge-tts 预置音色，两种引擎 manifest 契约一致，可随时切回。）
> 系列第三集（各集独立成片，口播不出现他集标题与集数序号）：前两集讲通用道理——[《上线之后，AI 才开始上学》](../experience-era-agents-video/README.md)（部署后经验怎么攒）、[《AI 如何自己变强？》](../self-improving-agents-video/README.md)（自我进化改什么）；本集**领域深潜**：自进化最先真实落地的田野——代码（可执行反馈让进化可测量）。片尾三卡回顾，顺序以 [../series.json](../../series.json) 为准。

## 目录结构

| 路径 | 说明 |
|---|---|
| `research/paper-notes.md` | 论文精读笔记——全部口播内容的**单一事实源**（8 个并行提取代理逐章产出） |
| `script/planning.md` | 策划案：受众、七幕结构、双色视觉契约（终端绿=可执行证据 / 洋红=进化动作） |
| `script/narration.md` | 逐字稿（唯一维护处），`- [句id] 文本` 一句一行 |
| `script/narration.json` | 派生物：拆句结果，供 TTS 与字幕消费（勿手改） |
| `script/storyboard.md` | 分镜表：镜号 ↔ 句 id 区间 ↔ 画面动效（场景组件实现规格） |
| `pipeline.toml` | 本集管线配置（配音/渲染/时长预算）——`pipeline.py` 的参数源 |
| `scripts/*.py` | 薄包装 → 公共管线 [$R/](../../pipeline/scripts/)（`--project` 透传） |
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

# 5. 抽帧 QA（在工程根目录；--scene 与句 id 二选一）
uv run --no-project scripts/qa_frames.py out/draft.mp4 --scene P2

# 6. 终渲 1080p30
cd video && ./node_modules/.bin/remotion render Main ../out/final.mp4
```

## 音画同步机制

每句一段 MP3；`tts.py` 产出 `video/public/audio/manifest.json`（含每句实测时长）；Remotion `calculateMetadata` 读取 manifest 计算全片时间轴（句间 0.32s、幕间 +0.9s、片头 0.6s、片尾 2s）——改稿后**只需重跑 1→2→4**，无需手工对轨。

## 内容修改守则

- 口播内容改动只发生在 `script/narration.md`；所有论文断言须可回溯 `research/paper-notes.md`；
- 新增/修改句后，受影响 beat 的句 id 区间需在对应场景组件（`video/src/scenes/`）同步；
- 双色语义是全片视觉契约：终端绿 `#4ADE80` = 可执行证据（测试/编译器/验证，全片主色，本集确认绿 ok 与之合一）、洋红 `#FF6EC7` = 进化动作（自我修改/变异）；警示红 `#FF5C5C` 仅失败态（恒配 ✗）。五对象**不配五色**（反枚举色彩原则）。

## 论文引用（IEEE）

[1] H. Zhou, H. Hu, Y. Shang, and Q. Zhang, "Self-Evolving Coding Agents: A Survey," arXiv:2608.03392, Aug. 2026. [Online]. Available: https://arxiv.org/abs/2608.03392（HTML 全文：https://arxiv.org/html/2608.03392v1；配套论文列表：Awesome-Self-Evolving-Coding-Agents）

## 许可注意

Remotion 对超过 3 人的公司需商业授权（个人/小团队免费）；若本视频转为公司用途，请评估许可或迁移 MIT 协议的 Motion Canvas。配音为**本人声音的自愿克隆**（IndexTTS-2.5，按 bilibili 模型使用许可：个人/研究用途可用，商用需联系 indexspeech@bilibili.com；克隆他人声音须获本人书面同意，详见 [VOICE-CLONING.md](../../pipeline/VOICE-CLONING.md) §八）。发布前请自行确认平台对合成语音的标注要求。
