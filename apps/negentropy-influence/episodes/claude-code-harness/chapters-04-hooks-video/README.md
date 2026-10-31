# 《Hooks：扩展不进循环》科普视频工程

> 交付状态：**文案轮完成、待用户审批**（2026-10-31）——系列《Claude Code 的 20 个核心机制》（claude-code-chapters，20 章 1:1 拆集）第 4 集（s04_hooks 单章）；Stage ①–⑤ 已完成（信源重钉 main `7226f555` + C 型冻结现行 171 同代次 + 策划 + 逐字稿 55 句 1305 字 + 三路双重校验 + 成文优化两轮），机器门 build / pre-tts / ledger audit+verify 全绿；**审批通过后进入制作**（⑥分镜/建图 → ⑦TTS → ⑧场景 → ⑨QA → ⑩交付）。标题随审批落定（候选见 planning.md §0）。发布顺序见 [../../series.json](series.json)（工作区根）。

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

- **翻钉 main `7226f555`**（自系列建档的站点轨规划态钉复核翻钉，与 ep1/ep2 同构）：其一，站点轨 s04 循环判据仍写 `stop_reason` 收尾字段，直引必与本系列 ep1 所教「认内容不认字段」自相矛盾；其二，main 把 Stop 强制续跑写进教学正文（README :51 事件行 + :80「`Stop` 返回非 `None` 时，循环继续」）——本集最反直觉记忆点（§6.3）的正源措辞，站点轨把同一能力括注成「CC 还支持强制续跑」，归属说反。
- **站点轨 `67a9126c` 降为附录正源**：s04 独有「深入 CC 源码」附录（27 事件 / 14 字段 HookResult / allow 压不过 deny-ask 不变式 / stopHookActive）经台账 `s04f-*` 补登，断言恒【三】级。
- **实验 5 本集复算【一】级**（2026-10-31 selftest）：忽略 Stop 续跑指令 → stop_continued 1→0、turns 10/10→8/10、checkpoints 5/5→4/5（核对轮没发生）——「退出权也是扩展点」的消融正例；实验 4（注销 PreToolUse 权限回调 → 越界写出 0→1、问询 2→0）同升【一】级。
- **官方 hooks 页 `doc-hooks` 活增长**：2026-10-31 指纹重钉基线，deny/ask 不变式官方原文逐字在场；事件总数只趋势化进口播（「三十多个」），现值不口播。
- 双钉唯一登记处：[source-map/claude-code-chapters.md](source-map/claude-code-chapters.md)。

## 复现流水线

```bash
# 在工作区内执行。$T/$W/$P/$V 的定义见 vibe-video skill 的 references/PIPELINE.md 路径变量约定（唯一定义处）
P=$W/episodes/claude-code-harness/chapters-04-hooks-video

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
- 观众层信源标识只许首尾既定署源位（豁免登记工作区 `vibe-video.toml [check_series.source_credit]`，RSI I-080）。
- 骨架冻结档位见 [vibe-video skill 的 skeleton.toml](https://github.com/ThreeFish-AI/vibe-video/blob/main/assets/video-skeleton/skeleton.toml)；
  改动前先跑 `uv run --no-project $T/scripts/verify_skeleton.py`。

## 许可

源课程 [Learn Claude Code](https://github.com/shareAI-lab/learn-claude-code)（MIT）版权归原作者；本工程为解读与再创作，画面与口播为原创，成片首尾部署源说明（系列 2026-10-29 审批定制）。
