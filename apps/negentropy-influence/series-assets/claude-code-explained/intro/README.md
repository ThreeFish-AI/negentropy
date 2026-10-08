# 系列片头《一个循环》种子（claude-code-explained 系列）

系列统一片头的 canonical 种子目录。分镜、逐字稿、字幕与动效的**单一事实源是
`series-intro.tsx` 组件本体**（头注含六拍分镜、IndexTTS 复现配方；组件内
NARRATION/SUBS/T 表三容器是口播与帧位 SSOT）——本 README 只写流程与指针，
**不复制任何台本正文或实测数字**，防第二事实源。

资产形态契约（独立音轨不入 narration SSOT、静音带实测 T 表方法论、改稿五同步
检查单、NARRATION/SUBS 口播容器命名）以 skill 侧册面为准（RSI-051，随
[vibe-video PR #42](https://github.com/ThreeFish-AI/vibe-video/pull/42) 合入）：
<https://github.com/ThreeFish-AI/vibe-video/blob/main/references/SERIES-INTRO.md>

## 六路径同字节同步（孪生门执法）

本目录种子与五集副本（`episodes/<slug>-video/video/src/components/series-intro.tsx`）
为**逐字节孪生**，由 `scripts/check_twin_files.py` 的 `series-intro-seed` 组执法
（pre-commit + CI 双挂）：

- 改片头 ⇒ 只改本种子，随后六路径同字节覆盖（整组 `git add`，防钩子对部分
  暂存态误报）
- 逐集差异**禁止改副本**：mech 色 / 本集站序号全数据驱动（`IntroOverride`，
  缺省读本集 `theme.mech` 与 `series-layers.json` 的 `activeIndex`，后者由
  build_narration 从工作区 `series.json` 派生），单改某一集副本即孪生门红

## 音轨

- **种子音轨已入 Git**（2026-10-08 登记制）：本目录 `series-intro-zh.mp3`
  登记于 `scripts/media-assets.toml`（sha256 对账，pre-commit/CI 双挂）——
  合成产物随仓分发，换机/新 clone 无需重跑 TTS 即可渲片头。克隆**源样本**
  （`voices/`）仍不入库（生物特征源）。
- 各集 `video/public/audio/series-intro-zh.mp3`（`staticFile` 路径契约）仍为
  **本地放置件**（目录 gitignored）：新 worktree 重渲前从种子副本拷入，
  校验其 sha256 与登记表一致
- 管线对各集副本无存在性预检，缺失即渲染期 Audio 加载失败或静默缺声
- 重配流程（换文案/终声）：见组件头注配方，改后须按 SERIES-INTRO 改稿五同步
  检查单对账，更新登记表 sha256/bytes 并重跑 `--sync`

## 挂载契约（五集同形）

- Main.tsx 挂载块落在 regioned 归一化保留区，五集同字节（归一化指纹
  `78664c3010fd`，`vibe-video.toml` 五条 `[[skeleton.drift]]` 同指纹登记；
  撤销条件=skill 模板吸纳挂载点或片头退役时五条齐撤）
- `timing.json` `leadInSec = 23.5`（组件 `INTRO_FRAMES` 派生自它）：组件副本
  与 leadIn 修改必须**同 commit 落库**——中间态（拷了组件没改 leadIn）会把
  片头静默截断，无任何报错
- 时长预算窗含片头口径：五集 `pipeline.toml` `target_minutes = [13.0, 15.5]`

## 评审面宿主 = E1

五集变体评审面 `intro-gallery.tsx`（独立 Remotion 入口，IntroEp1–5）住在
`episodes/claude-code-explained-video/video/src/`——借 E1 渲染环境渲各集
mech/activeIndex 变体定格。其 VARIANTS 五色取自 series.json accents 的实占值，
是与 series.json 的第二事实源（长期待办：改读 series-layers.json）。

## en 待办（zh-only 现状）

en 交付前须补 en 文案（组件 NARRATION/SUBS 容器）与 `series-intro-en.mp3`；
另存在**机械阻断**——skill `pipeline.py` 的非主语言渲染预检
`check_skeleton_for_lang` 直比 Main.tsx 归一化指纹与 skill 模板、不读 drift
登记，铺开态下五集 en render 预检会 FAIL。en 交付前置 = skill 侧修预检
（认可 drift 登记或模板吸纳挂载点），登记于 ISSUE-209 与 vibe-video.toml
drift reason。
