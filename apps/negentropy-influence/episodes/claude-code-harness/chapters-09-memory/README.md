# 《Memory：索引与按需加载》科普视频工程

> 交付状态：**文案轮完成、待用户审批**（2026-10-31）——系列《Claude Code 的 20 个核心机制》（claude-code-chapters，20 章 1:1 拆集）第 9 集（s09_memory 单章）；Stage ①–⑤ 已完成（钉点复核翻钉 main `7226f555` + C 型冻结现行 173 同代次 + 策划 + 逐字稿 55 句 1355 字（v2） + 三路双重校验 + 成文优化一轮），机器门 build / pre-tts / ledger audit+verify 全绿（check_series 由系列层统一跑）；**审批通过后进入制作**（⑥分镜/建图 → ⑦TTS → ⑧场景 → ⑨QA → ⑩交付）。标题随审批落定（候选见 planning.md §0）。发布顺序见 [../../series.json](series.json)（工作区根）。

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

- **翻钉 main `7226f555`**（自旧钉 `ce8f9f18` 前移 13 提交复核翻钉，三理由）：① 站点轨 s09 循环与提取触发均写 `response.stop_reason != "tool_use"`，直引必与 ep1 所教「认内容不认字段」自相矛盾（ep2 同款翻钉理由），main 轨用内容块判据；② 站点轨 s09 code.py 内嵌 s08 压缩管线，main 轨压缩完全交还 s08——「压缩管会话内、记忆管跨会话」的架构分家正合 ep8/ep9 一章一集骨架；③ 本集核心记忆点「记忆不能脏」的机制正源只在 main 做厚（`should_store_memory` 五重检查 / 路径防御三道闸 / `RECALL_CHAR_LIMIT = 20000` / consolidate 快照回滚）。
- **站点轨 `67a9126c` 降为附录正源**：s09 独有「深入 CC 源码」附录（memoryScan / Sonnet side-query / Dream 四层门控 / sessionMemoryCompact）经台账 `s09f-*` 补登，断言恒【三】级，本集只取 Dream 整理一档（P4 集中归属）。
- **核心消融本集复算【一】级**（2026-10-31 selftest 21 项全绿）：关掉写入门控 → 两轮提取落盘 3→5 条、「这次别建文件」类临时嘱咐入库变永久规矩；辅证消融去掉整理回滚 → 库 2→0 条。
- **官方两页语义面复核在场**（doc-memory / doc-context-window，指纹钉 2026-10-31 态）：MEMORY.md 索引每会话加载、压缩幸存表「Auto memory 从磁盘重注入」——本集所引【二】级条款全部成立。
- 双钉唯一登记处：[source-map/claude-code-chapters.md](source-map/claude-code-chapters.md)。

## 复现流水线

```bash
# 在工作区内执行。$T/$W/$P/$V 的定义见 vibe-video skill 的 references/PIPELINE.md 路径变量约定（唯一定义处）
P=$W/episodes/claude-code-harness/chapters-09-memory

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
- 观众层信源标识只许首尾既定署源位（豁免登记工作区 `vibe-video.toml [check_series.source_credit]`，RSI I-080；本集条目由系列层落账，见 planning.md §六）。
- 骨架冻结档位见 [vibe-video skill 的 skeleton.toml](https://github.com/ThreeFish-AI/vibe-video/blob/main/assets/video-skeleton/skeleton.toml)；
  改动前先跑 `uv run --no-project $T/scripts/verify_skeleton.py`。

## 许可

源课程 [Learn Claude Code](https://github.com/shareAI-lab/learn-claude-code)（MIT）版权归原作者；本工程为解读与再创作，画面与口播为原创，成片首尾部署源说明（系列 2026-10-29 审批定制）。
