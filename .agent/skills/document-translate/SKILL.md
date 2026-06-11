---
name: document-translate
description: 将 Knowledge / Documents 文档的英文 Markdown 正文按段落分块高保真翻译为中文：代码块、行内代码、URL、图片路径、LaTeX 公式、HTML 标签、front-matter 键名逐字节保留不翻，Markdown 结构与原文一一对应，逐块翻译禁止合并/拆分/遗漏。Use when translating chunked Markdown documents (source/chunk_NNNN.md → translated/chunk_NNNN.md) in a translation workdir.
allowed-tools: Read, Write, Glob, Grep, Bash
---

# Translate (文档翻译 / Document Translate)

> SSOT：本文件与 `apps/negentropy/src/negentropy/agents/skill_templates/document_translate.yaml` 同源
> （文件技能供 Claude Code 工作目录发现，DB 技能供一核五翼）。两处正文骨架须保持一致。

你是「Markdown 高保真翻译」执行者。任务：把工作目录下 `source/` 内的分块文件
（`chunk_0000.md` 起按序零填充编号）翻译为目标语言（默认中文），逐块写入
`translated/` 下的**同名文件**。

## 输入

- `workdir`：翻译工作目录绝对路径（含 `source/` 与 `translated/` 子目录）
- `chunk_count`：`source/` 下待翻译分块文件数
- `target_language`：目标语言（默认 `中文`）

## 翻译铁律（缺一即失败）

1. 以下内容**逐字节保留、绝不翻译/改写**：
   - 代码块（``` 或 ~~~ 围栏，含语言标记与围栏本身）与行内代码（`...`）；
   - URL / 链接目标 / 图片路径（`[text](url)` 仅译 text，url 原样）；
   - LaTeX 公式（`$...$` / `$$...$$` / `\(...\)` / `\[...\]`）；
   - HTML 标签及其属性（标签内可读文本可译）；
   - front-matter（`---` 围栏）键名与结构（值中的自然语言可译）；
   - 文件名、命令、标识符、版本号、转义符等特殊英文符号。
2. Markdown 结构与原文**一一对应**：标题层级、列表缩进与标记、表格行列、引用块、
   分隔线、空行布局均不得增删。
3. 每个 `source/chunk_NNNN.md` 必须产出**非空**的 `translated/chunk_NNNN.md`，
   禁止合并、拆分、跳过任何分块；不得丢失任何原文内容。
4. 只翻译自然语言散文（段落、标题文字、列表文字、表格单元格文本、图片 alt 文本）；
   专业术语首次出现可附原文括注，保持全篇术语一致。

## 逐块流程

1. 列出 `source/` 下全部分块文件并确认数量 == `chunk_count`；
2. 按编号升序逐块：读取 → 翻译 → 写入 `translated/` 同名文件；
3. 全部完成后自检：`translated/` 文件数 == `chunk_count` 且逐块非空、
   代码围栏数量与原块一致。

## 反模式（严禁）

- 翻译/改写代码块、行内代码、URL、图片路径、公式、HTML 标签；
- 合并、拆分或跳过分块；省略段落、列表项或表格行；
- 改变标题层级、列表缩进、表格列数等结构布局。

## 完成判据

`translated/` 分块齐全非空 + 铁律自检通过；服务端将做确定性校验（代码块还原、
结构对比、内容完整性），不达标即整体失败。
