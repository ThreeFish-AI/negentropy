# 《Error Recovery：报错先分类，循环不亡》科普视频工程

> 交付状态：**文案轮完成、待用户审批**（2026-10-31）——系列《Claude Code 的 20 个核心机制》（claude-code-chapters，20 章 1:1 拆集）第 11 集（s11_error_recovery 单章）；Stage ①–⑤ 已完成（开工复核维持站点轨钉 + C 型冻结现行 172 同代次 + 策划 + 逐字稿 56 句 1331 字（v2） + 三路双重校验 + 成文优化一轮收敛），机器门 build / pre-tts / ledger sync·audit·verify 全绿（check_series 由系列层统一跑；正文 est ≈5.2 分在窗 [4.4,5.6]、超幕预算 26 字，+片头 23.5s ≈5.6 分贴窗上沿——承 ep2 同款四舍五入口径，TTS 实测超上沿则删句）；**审批通过后进入制作**（⑥分镜/建图 → ⑦TTS → ⑧场景 → ⑨QA → ⑩交付）。标题随审批落定（候选见 planning.md §0）。发布顺序见 [../../series.json](series.json)（工作区根）。

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

- **钉站点轨 `67a9126c`（开工复核维持系列站点轨钉，与 ep2 翻钉 main 互为镜像——本集正源在站点轨）**：main 轨无 s11 独立章，错误恢复并入 s15_integrated_harness「压缩和恢复」小节（README 层仅 4 项压缩改写列表）；三路径分步走查与六节「深入 CC 源码」深潜（reason/transition 全表 17 行，【三】级断言唯一在场）只在站点轨；教学取值 64K/续写 3/压缩 1/重试 10/529×3 即站点轨 code.py 常量区逐行可数，零换算直引。
- **main `7226f555` 对照轨（台账 `s11m-*`）**：对照三参数 16K/重试 3/529×2 已于该钉逐项复算成立；自冻结正文所记 `ce8f9f18` 前移后，「压缩和恢复」小节恢复列表逐字一致、恢复常量区零改动——「同一门课程两轨两组参数」即 P4 争议三的叙事支点。
- **实验 5（本集核心消融）复算【一】级**（2026-10-31 selftest）：分类恢复改一刀切重试 → 10 次全撞墙、白等 175.6s（standalone 口径恒定；selftest 上下文 173.7s 为另一确定口径，gl-notes 附录 B.2 双登记），对照分类路径压缩一次 0.0s 恢复；episode E 走查基线齐复算（3.7s 恢复不切换、三连 529 切 model-backup 4.1s、压缩一次 messages 9→6、token 路径 8000→64000 续写 3/3）。
- 站点实况零漂移（站点轨分支 HEAD 仍 `67a9126c`、main HEAD 仍钉点 `7226f555`）；双钉唯一登记处：[source-map/claude-code-chapters.md](source-map/claude-code-chapters.md)。

## 复现流水线

```bash
# 在工作区内执行。$T/$W/$P/$V 的定义见 vibe-video skill 的 references/PIPELINE.md 路径变量约定（唯一定义处）
P=$W/episodes/claude-code-harness/chapters-11-errorrecovery

# ① 信源核验
uv run --no-project $T/scripts/source_ledger.py --project $P verify

# ② 逐字稿派生 + 内容门
uv run --no-project $T/scripts/pipeline.py --project $P build
uv run --no-project $T/scripts/pipeline.py --project $P check --check-scenes

# ③ 配音（参数全部取自 pipeline.toml）
uv run --no-project $T/scripts/pipeline.py --project $P tts --plan
uv run --no-project $T/scripts/pipeline.py --project $P tts          # 长跑，建议 nohup

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
- **口播永不出现他集标题与集数序号**——顺序只在视觉层与 series.json（`check_series.py` 执法）。
- 观众层信源标识只许首尾既定署源位（豁免登记工作区 `vibe-video.toml [check_series.source_credit]`，RSI I-080；本集条目 `narration_ids = [p0-01, p5-06]` 随系列层交付统一补登记）。
- 骨架冻结档位见 [vibe-video skill 的 skeleton.toml](https://github.com/ThreeFish-AI/vibe-video/blob/main/assets/video-skeleton/skeleton.toml)；
  改动前先跑 `uv run --no-project $T/scripts/verify_skeleton.py`。

## 许可

源课程 [Learn Claude Code](https://github.com/shareAI-lab/learn-claude-code)（MIT）版权归原作者；本工程为解读与再创作，画面与口播为原创，成片首尾部署源说明（系列 2026-10-29 审批定制）。
