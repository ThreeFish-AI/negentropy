---
name: heartfelt
description: 仔细阅读并理解目标文档全文，输出一个对目标文档的理解摘要和读后感悟，将之保存到愫读文档中。
allowed-tools: Read, Grep, Glob, filesystem, zai-mcp-server, web-reader, web-search-prime, time
---

# 愫读

**分章节**仔细阅读并深入理解每个章节的内容，以概括的方式提取每个章节的关键内容（可分主次要的内容），将每个章节概要依次输出到「愫读 - #$ARGUMENTS.md」，最终完成整篇文档内容的摘要。
**分章节**仔细阅读并深入理解每个章节的内容，仔细揣摩对每个章节关键内容的理解，并将之依次输出到「愫读 - #$ARGUMENTS.md」文档适当的位置，最终完成整篇文档关键内容的理解记录。
通过对全文关键内容的理解，仔细思考读后的感悟与所得，并将之输出到「愫读 - #$ARGUMENTS.md」文档适当位置。
仔细揣摩每个章节，不要丢失了任何章节的关键内容。

## Instructions

1. Read the target files using Read tool
2. Search for patterns using Grep
3. Find related files using Glob
4. Provide detailed feedback on code quality

## Review checklist

1. Code organization and structure
2. Error handling
3. Performance considerations
4. Security concerns
5. Test coverage

---

**特别注意**：

- 按段落适当分批迭代式进行阅读、摘要、理解、感悟等任务，不要一次处理太多内容，确保对每一段内容细节的理解与处理的准确性和完整性；
- 保持目标「愫读 Markdown 文档」与「原全文 Markdown 文档」中关键内容的一致性；
- 必要时在「愫读 Markdown 文档」中择取全文文档原有的「图」、「表」、「公式」等特殊内容；
- 注意最后需回头对照「原全文 Markdown 文档」，检查「愫读 Markdown 文档」全文关键内容的完整性，保障输出内容的完整性与一致性；
- 注意检查「图」、「表」、「公式」等特殊内容显示的正确性。
- 图片理解：借助 MCP 工具理解图片内容；

**「图」资源特别注意**：

- 从原 Markdown 文档感知「图」资源的所在路径，并在需要在目标 Markdown 文档引用时直接使用该路径；

**「表」资源特别注意**：

- 使用 Markdown 语法重现 PDF 中的表内容；

**「公式」资源特别注意**：

- 使用 LateX 语法重现 PDF 中的数学公式内容；

**路径特别注意**：

- #$ARGUMENTS 中的「/」是目录层级分割符号，不是文件名称的一部分；
