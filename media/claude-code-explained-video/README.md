# 《拆开 Claude Code：让 AI 动手的四层机制》

> 系列「Claude Code 通俗全解」首作（发布顺序 SSOT：[../series.json](../series.json)；口播永不携带集数序号）。
> 选题：开源课程 [Learn Claude Code](https://learn.shareai.run/zh/s01/) 的「工具与执行」四章
> —— s01 Agent Loop / s02 Tool Use / s03 Permission / s04 Hooks。
> 形态：1080p30 横屏，代码动画图解 + 本人音色克隆旁白，无真人出镜、无 BGM。
> 制作走[公共管线](../pipeline/README.md)九阶段；本集的可执行参数唯一来源是 [pipeline.toml](./pipeline.toml)。

## 交付状态

| 项 | 状态 |
|---|---|
| 逐字稿 | ✅ 170 句 / 4048 字 / 7 幕（估算 14.5 分钟，预算窗 13.0–14.6） |
| 分镜 | ✅ 39 镜，`check_script` 覆盖性 FAIL 0 |
| 信源取证 | ✅ 12 条双轨信源入清单（8 条仓库 @ 固定提交 + 4 条站点），`source_ledger verify` FAIL 0 |
| 场景实现 | ✅ 7 幕 / 39 镜，`tsc --noEmit` 通过；39 镜逐镜抽帧冒烟无黑帧、无重复帧 |
| 配音 | ⏳ 合成中（`sunny-steady` + `me-bright.wav`） |
| 草渲 + 抽帧 QA | ⏳ 待配音完成 |
| 终渲交付 | ⏳ 待草渲零 FAIL |

## 目录结构

| 路径 | 作用 |
|---|---|
| [pipeline.toml](./pipeline.toml) | ★可执行参数唯一来源（episode / narration / tts / render） |
| [research/source-notes.md](./research/source-notes.md) | ★**口播的单一事实源**，含证据三级与站点↔仓库分歧清单 |
| [research/sources.toml](./research/sources.toml) | 信源清单（URL / 固定提交 / 取数日期 / 双指纹），`source_ledger.py` 维护 |
| [script/planning.md](./script/planning.md) | 策划案六节（定位 / 叙事 / 视觉语言 / 幕结构 / 管线 / 边界） |
| [script/narration.md](./script/narration.md) | ★逐字稿 SSOT（唯一人工维护处） |
| `script/narration.json` | 派生物，`pipeline.py build` 生成，勿手改 |
| [script/storyboard.md](./script/storyboard.md) | 分镜表（镜号 ↔ 句区间 ↔ 画面 ↔ 动效） |
| `scripts/*.py` | 薄包装，转发到 `../pipeline/scripts/` |
| [video/](./video/) | Remotion 独立 pnpm 工程 |
| `video/src/components/motifs.tsx` | 本集五个视觉母题（终端 / 环形循环 / 分发表 / 闸门 / 插槽） |
| `out/` | 渲染产物（gitignored） |

## 复现流水线

```bash
R=media/pipeline/scripts; P=media/claude-code-explained-video

# ① 信源核验（repo 类固定提交硬校验；site 类只比正文，漂移报 WARN）
uv run --no-project $R/source_ledger.py --project $P verify

# ② 逐字稿派生 + 内容门（分镜覆盖性 / 时长预算双口径 / 淡入不变式）
uv run --no-project $R/pipeline.py --project $P build
uv run --no-project $R/pipeline.py --project $P check --check-scenes

# ③ 配音（参数全部取自 pipeline.toml，勿在命令行另写 --style/--ref）
uv run --no-project --with soundfile --with numpy $R/refs.py rebuild --name me-bright
uv run --no-project $R/pipeline.py --project $P tts --plan   # 排期对账
uv run --no-project $R/pipeline.py --project $P tts          # 长跑，建议 nohup

# ④ 渲染与体检
cd $P/video && pnpm install --ignore-workspace && ./node_modules/.bin/tsc --noEmit
cd - && uv run --no-project $R/pipeline.py --project $P render
uv run --no-project $R/pipeline.py --project $P qa --check --scale 0.5
uv run --no-project $R/pipeline.py --project $P qa --last-n 6 --check   # 尾幕渐黑必查

# ⑤ 交付
uv run --no-project $R/pipeline.py --project $P captions
uv run --no-project $R/pipeline.py --project $P render --final
```

## 音画同步机制

每句一段 MP3 → `tts.py` 把**实测时长**写进 `video/public/audio/manifest.json` →
`Root.tsx` 的 `calculateMetadata` 读 manifest 算全片时间轴 → 画面、字幕、旁白三层共读同一份
`timed[]`。**改稿只需重跑 `build → tts → render`，无需手工对轨。**
时序常数的单一事实源是 `video/src/timing.json`（`timing.ts` 与 Python 侧的 `timeline.py` 读同一文件）。

## 内容修改守则

1. **只改 `script/narration.md`** —— `narration.json` / `manifest.json` 都是派生物。
2. 改动任何一句，必须能回溯到 [research/source-notes.md](./research/source-notes.md)；
   【三级】证据（课程作者对 Claude Code 源码的分析）**必须带归属句**，不得表述为产品既成事实。
3. **不引用活数据**：课程标注的行数、总章数、star 数一律不进口播（禁用清单见事实源 §九）。
4. 英文标识符只进画面角标，不进口播（唯一例外是产品名 Claude Code）。
5. 换配音风格或参考样本 = 整集重合成，且须显式 `--allow-voice-switch`（`.engine` 签名护栏）。

## 信源与引用

- **课程正文**：Learn Claude Code，「工具与执行」s01–s04，https://learn.shareai.run/zh/s01/ ，访问日期 2026-08-21。
- **代码原文**：shareAI-lab/learn-claude-code，固定提交 `f9e8b280f715f9ba107d4517fd39bc5f8ddda618`（2026-08-18），License **MIT**。
  片中所有行数均为该提交上的**实测值**（`wc -l` 与「非空非注释」两个口径，见事实源 §五）。
- ⚠️ 课程站点标注的章节行数（102 / 135 / 180 / 232）在该提交上用任何口径都复算不出，
  应为早期提交的遗留值；本片改用实测值，且口播只说趋势不说绝对数（详见事实源 §六）。

## 许可注意

- Remotion 用于商业用途需遵守其授权条款；本工程仅用于内容创作。
- IndexTTS-2.5 按 bilibili 模型使用许可发布，商用需另行联系；克隆的是**本人**声音。
- 课程内容为 MIT 许可，引用其代码与表述已标注来源与固定提交。
- 不使用任何未经授权的第三方图片/音频素材——**站点配图一律不下载不嵌入**，
  画面全部用 Remotion 代码重建（只取信息结构，不复刻美术）。
- 发布时按平台要求标注 **AI 合成语音**。
