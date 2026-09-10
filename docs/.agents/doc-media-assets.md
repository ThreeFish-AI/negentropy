# 文档媒体资产规范（doc-media-assets）

> 适用范围：`docs/**` 与仓库根 `README.md` 内的图片 / 动效 / 视频 / 交互 HTML。
> **本文只写判据与决策，不复述实现**——所有行为描述均指向代码坐标，代码变更时以代码为准。

## 1. 先判一件事：这篇文档进不进 wiki

`docs/**` 有两条正交的渲染链路，媒体写法的选择完全由此决定。判据的单一事实源是
[`WikiDocsSyncSettings`](../../apps/negentropy/src/negentropy/config/knowledge.py)（`include_dirs` /
`include_root_readme` / `exclude_dirs` / `exclude_dir_names`）。

| 文档 | 进 wiki | 可用写法 |
| :--- | :---: | :--- |
| `docs/{concepts,reference,research}/**.md`、`docs/README.md` | ✅ | **仅**纯 markdown `![alt](相对路径)` |
| 根 `README.md`、`docs/i18n/**`、`docs/.agents/**` | ❌ | 可用 `<picture>` / `<img width>` 等 GitHub 富标签 |

原因：[`wiki_docs_ingest.py`](../../apps/negentropy/src/negentropy/knowledge/lifecycle/wiki_docs_ingest.py)
只重写 **markdown 图片语法**的相对路径为 `raw.githubusercontent.com/<owner>/<repo>/<github_ref>/<path>`
（`is_image` 分支，约 `:283-293`）。**HTML 属性里的相对路径不在重写射程内**——`<img src>` /
`<source srcset>` 原样输出，在 wiki 静态站上按站内路径解析即 404。

## 2. 决策表

| 需求 | 写法 | 约束 / 证据 |
| :--- | :--- | :--- |
| 静态图（进 wiki 的文档） | `![alt]` + 指向 `docs/assets/<域>/x.png` 的相对路径 | 被重写为 raw@`github_ref`（默认 `master`） |
| 双主题静态图（不进 wiki 的文档） | `<picture>` + `<source media="(prefers-color-scheme: …)">` | GitHub 官方支持；`<img>` 兜底必填 |
| 就地播放的动效 | **只有 GIF**（`![]()` 或 `<img>`） | `<video>` 在两条链路都被剥离：wiki 侧 [`MarkdownRenderer.tsx`](../../apps/negentropy-wiki/src/components/markdown/MarkdownRenderer.tsx) 只在 `hast-util-sanitize` 的 `defaultSchema` 上加白 `figure`/`figcaption`，而 `defaultSchema.tagNames` 本就不含 `video`/`audio`/`source`；GitHub 的 Markdown 渲染器同样不放行 |
| 高清视频 | 落盘 + markdown 链接，**不内嵌** | 非图片链接被改写为 GitHub blob 页（`_github_blob` 兜底分支），点击可播但不内联 |
| 折叠长文本 / 图示源码 | `<details>` + `<summary>` | 两条链路均放行（`defaultSchema.tagNames` 含二者）；折叠内的 ```mermaid 在 wiki 仍照常渲染（`MermaidDiagram` 在 `useEffect` 内渲染，与折叠态无关） |
| 交互 HTML | markdown 链接 | wiki 侧落到 GitHub 源码页，**无交互**，文案须如实说明「下载到本地打开」 |

## 3. 硬门限

- **单文件 ≤ 1,048,576 B**——[`check-added-large-files --maxkb=1024`](../../.pre-commit-config.yaml)。
  选型阶段就要估算，别等落盘才撞。动效类一律按「帧间差分失效」保守估。
- **`knowledge-map.md` / `CHANGELOG.md` 内引用的资产必须在盘**——`series-consistency-check` 规则 5
  的正则同时命中 `[]()` 与 `![]()`。**资产与索引必须同一次 `git add`**。
- **未合并进 `github_ref`（默认 `master`）的资产，在已发布 wiki 上必然 404**——这是时序，不是缺陷。
  合并前要验 wiki，把 `github_ref` 覆盖为已推送的 commit SHA 再本地重建。

## 4. 已知有界降级

- wiki 的暗色态由 `<html data-color-scheme>` 驱动（[`wiki-color-scheme.ts`](../../apps/negentropy-wiki/src/lib/wiki-color-scheme.ts)），
  而 `<img>` 内嵌 SVG 内部的 `@media (prefers-color-scheme)` 只读**系统**偏好、读不到该属性。
  读者手动把 wiki 主题拨到与系统相反时，双主题 SVG 配色会反向。因导出图自带不透明底色，
  仅是观感差异、不失可读性；**但进 wiki 的正文内嵌一律用单主题 PNG 规避**。
- wiki 与 ui 两个 MarkdownRenderer 的 sanitize 白名单**不对称**：
  [`DocumentMarkdownRenderer.tsx`](../../apps/negentropy-ui/features/knowledge/components/DocumentMarkdownRenderer.tsx)
  显式加白了 `video`/`audio`/`source`，wiki 侧没有，且 `check_twin_files.py` 未登记该对。
  新增媒体标签需求时须同时核两侧。

## 5. 架构图的派生链路（唯一在册案例）

单向链路，顺序不可逆：

1. 改 [`framework.md` §2.1](../concepts/framework.md) `<details>` 内的 Mermaid——**唯一可编辑源**；
2. 跑 [`scripts/capture-arch-media.mjs`](../../scripts/capture-arch-media.mjs) 重新生成
   [`docs/assets/architecture/`](../assets/architecture/) 下的 PNG / SVG / MP4 / GIF；
3. 核三处消费点：[README](../../README.md) · [中文 README](../i18n/zh-CN/README.md) · framework.md §2.1。

**严禁手改** [`architecture-diagram.html`](../concepts/architecture-diagram.html)（15,005 行生成物，
无独立源规格，手改即造成文本源与呈现物分叉）。

采集脚本的关键事实（改脚本前必读）：

- 静态图走产物内置的 `Archify.exportMenu.run()`（`RASTER_SCALE=4` 原生矢量栅格化 → 5120×2880），
  **不用整页截图**——页面内的图受 reader 宽度上限约束，整页截图有效像素远低于内置导出。
- 拦截导出 blob 必须「记录但**透传**」`URL.createObjectURL`：`rasterize()` 会先为中间态 SVG 建一次
  objectURL，吞掉它会让中间态 `Image` 永远 load 不了、导出**静默失败**。取 `seen[seen.length-1]`。
- 内置 WebM 导出**不可用**（本产物 SVG 无 `data-animation="trace"`，`motion.canRecord()` 恒为 false）。
  真实动效是 `guidedViews` 引导叙事，MP4/GIF 由 CDP 逐帧截图 + ffmpeg 自行编码。
- `Archify.guidedViews.activate()` 实为 `activateById`，**收章节 ID 字符串**（`chat-request` /
  `knowledge-ingestion` / `static-delivery` / `model-and-sandbox`），传下标必然返回 `false`。
- 必须把 `prefers-reduced-motion` 仿真为 `no-preference`，否则动效被 CSS 全量关掉。
- 本机 PATH 无 ffmpeg；脚本按 semver 在 pnpm store 内探测 Remotion compositor 自带的 ffmpeg
  （唯一含 `libx264` + `mp4` muxer 的二进制），调用须带 `DYLD_LIBRARY_PATH`。可用 `NE_FFMPEG` 覆盖。
- GIF 体积由**分辨率**主导而非帧率：实测降帧率保住「全程叙事」比截短时长更划算。

## 6. 验收证据

浏览器实机渲染截图落 [`screenshots/architecture-diagram/`](./screenshots/architecture-diagram/)；
视频与静图的机读体检由采集脚本的交付收据打印（逐文件字节 + 1 MiB 门判定）。
