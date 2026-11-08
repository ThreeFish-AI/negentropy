# 《Cron Scheduler：按时间表生产工作》科普视频工程

> 交付状态：**已交付 v1**（2026-11-01 制作轮收官：⑥ 20 镜零建图 G1 RISKY 0/修 4 WARN → ⑦ me-bright/story 克隆声 49 句 4.6 分 → ⑧ 判时表盘/四层链/防火线/五十格限额装置族+片头孪生（组四 groupOf(14)=4）→ ⑨ QA 0 RISKY 修复 3 项+4 项帧级驳回（0-A 闹钟基态经像素取证证契约兑现）+机器门全绿 → ⑩ 终渲 297.2s=4 分 57 秒落窗，`~/Documents/video/claude-code-chapters/Cron Scheduler：按时间表生产工作 v1.mp4`）

## 目录结构

| 路径 | 说明 |
|---|---|
| `research/` | Stage ① 取证产物：全部口播断言须可回溯至此（gl-notes.md = C 型冻结件；source-archive/ = 双轨字节归档） |
| `script/planning.md` | Stage ② 策划案（六节齐，含本集视觉契约） |
| `script/narration.md` | Stage ③ 逐字稿 **★单一事实源**（勿改 narration.json） |
| `scripts/*.py` | 薄包装 → vibe-video skill 的 scripts/（解析器定位，保 CLI 契约） |
| `video/` | Remotion 独立 pnpm 工程（嵌套 workspace 自锚隔离） |
| `out/` | 渲染产物（gitignored） |
| `pipeline.toml` | 本集可执行参数的唯一来源（字段表见 [vibe-video skill 的 references/PIPELINE.md](https://github.com/ThreeFish-AI/vibe-video/blob/main/references/PIPELINE.md)） |

## 信源与钉选（本集要点）

- **钉站点轨 `67a9126c`（默认钉成立，未翻钉）**：冻结源 176 §4 四层解耦叙事与 s14 README「四层模型」节（Scheduler / Queue / Queue Processor / Consumer）逐节对应，而 main 轨 README 无四层框架；DOM/DOW「或不是且」反直觉明文与本集【三】级断言唯一正源（9 节「深入 CC 源码」附录）均只在站点轨。
- **main `7226f555` 为对照轨（台账 `s14m-*`）**：main 前移独有增量（至少一次交付工程加固四件）在冻结正文属 §5 注记与 §9.2 争议三的对照位、非主线依赖——ep2 式「正源级新增叙事节」翻钉要件不成立。
- **官方文档双页补读【二】级**：`doc-scheduled-tasks` / `doc-desktop-scheduled-tasks` 2026-10-31 语义面逐句复核与冻结正文一致（五十上限/七天过期/OR 语义原文在场；jitter 措辞演化、数值面不变）。
- **实验 e3/e4 本集复算【一】级**（2026-10-31 selftest，对象 = 冻结源 §8 所指 `cc_async_scheduling_lab.py`）：e3「或」改「且」→ 周一 True→False 静默漏触发；e4 核心消融（交付线程无视忙锁硬注入）→ inj_busy False→True、walk_aways 5→0。
- 双钉唯一登记处：[source-map/claude-code-chapters.md](../../../source-map/claude-code-chapters.md)。

## 复现流水线

```bash
# 在工作区内执行。$T/$W/$P/$V 的定义见 vibe-video skill 的 references/PIPELINE.md 路径变量约定（唯一定义处）
P=$W/episodes/claude-code-harness/chapters-14-cronscheduler

# ① 信源核验
uv run --no-project $T/scripts/source_ledger.py --project $P verify

# ② 逐字稿派生 + 内容门
uv run --no-project $T/scripts/pipeline.py --project $P build
uv run --no-project $T/scripts/pipeline.py --project $P check --check-scenes

# ③ 配音（参数全部取自 pipeline.toml）
uv run --no-project $T/scripts/pipeline.py --project $P tts --plan
uv run --no-project $T/scripts/pipeline.py --project $P tts          # 长跑，建议 nohup
# 配音提速 1.25×（速率 SSOT=video/src/timing.json narrationTempo；源取 tts-store raw，幂等；tts 复跑/恢复后须重跑）
uv run --no-project $W/scripts/tempo_audio.py --project $P
uv run --no-project $W/scripts/tempo_audio.py --project $P --check   # 渲染前门

# ④ 渲染与体检（工具一律 ./node_modules/.bin/ 直调，防污染根 workspace）
cd $P/video && pnpm install && ./node_modules/.bin/tsc --noEmit
cd - && uv run --no-project $T/scripts/pipeline.py --project $P render
uv run --no-project $T/scripts/pipeline.py --project $P qa --video out/draft.mp4 --check
uv run --no-project $T/scripts/pipeline.py --project $P qa --video out/draft.mp4 --last-n 6 --check   # 尾幕渐黑必查（--video 按工程目录解析）

# ⑤ 交付
uv run --no-project $T/scripts/pipeline.py --project $P captions
uv run --no-project $T/scripts/pipeline.py --project $P render --final
uv run --no-project $T/scripts/pipeline.py --project $P deliver
```

## 内容修改守则

- 逐字稿只改 `script/narration.md`；`narration.json` / `manifest.json` 是派生物。
- 时序常数只在 `video/src/timing.json`（timing.ts 与 Python 侧 timeline.py 共读）。
- 配音速率只在同一文件的 `narrationTempo`（仅 `scripts/tempo_audio.py` 读取，timing.ts/timeline.py 忽略）；`tts` 复跑或恢复会带回 1.0× raw，须重跑该脚本，`--check` 为渲染前门。
- **口播永不出现他集标题与集数序号**——顺序只在视觉层与 series.json（`check_series.py` 执法）。
- 观众层信源标识只许首尾既定署源位（豁免登记工作区 `vibe-video.toml [check_series.source_credit]`，RSI I-080）。
- 骨架冻结档位见 [vibe-video skill 的 skeleton.toml](https://github.com/ThreeFish-AI/vibe-video/blob/main/assets/video-skeleton/skeleton.toml)；
  改动前先跑 `uv run --no-project $T/scripts/verify_skeleton.py`。

## 许可

源课程 [Learn Claude Code](https://github.com/shareAI-lab/learn-claude-code)（MIT）版权归原作者；本工程为解读与再创作，画面与口播为原创，成片首尾部署源说明（系列 2026-10-29 审批定制）。
