---
name: pdf-reader
description: Extract text, images, tables, and formulas from PDF documents and convert them to Markdown format while preserving original structure. Use when processing PDF files, extracting content, or converting PDF to Markdown.
allowed-tools: data-extractor, zai-mcp-server, filesystem
---

# PDF Reader

专门处理 PDF 文档的内容提取，保持原文档的结构和格式。

## 核心功能

### 1. 内容提取

- **文本内容**: 保留原始排版和格式
- **图片资源**: 高质量提取并保存
- **表格数据**: 转换为 Markdown 表格格式
- **数学公式**: 保留 LaTeX 格式
- **元数据**: 标题、作者、创建时间等

### 2. 结构保持

- 维持文档的章节结构
- 保留页面编号（如需要）
- 保持标题层级关系
- 维护列表和引用格式

## Workflow

### 单文档处理

使用 `data-extractor.convert_pdf_to_markdown`：

```yaml
参数配置:
  extract_images: true # 提取图片
  extract_tables: true # 提取表格
  extract_formulas: true # 提取公式
  embed_images: false # 图片保存为独立文件
  include_metadata: true # 包含文档元数据
```

### 批量文档处理

使用 `data-extractor.batch_convert_pdfs_to_markdown`：

- 支持多个 PDF 文件同时处理
- 保持每个文档的独立性
- 统一的输出格式

### 页面范围处理（批次支持）

- 指定页面范围：`[start, end]`
- 支持非连续页面处理
- 用于预览或选择性提取
- 批次处理时指定具体页面段

## 图片处理流程

### 1. 图片提取

- 自动识别文档中的所有图片
- 保持原始分辨率
- 支持多种图片格式

### 2. 图片分析

使用 `zai-mcp-server` 分析图片内容：

- 理解图片描述
- 生成合适的文件名
- 创建 alt 文本

### 3. 图片保存

- 保存路径：`/path/to/source/images/pdf_name/`
- 命名规则：`figure_{N}_{description}.png`
- 文件名使用英文，简短且具有描述性

## 输出格式

### Markdown 内容结构

```markdown
# 文档标题

## 元数据

- **标题**: {title}
- **作者**: {author}
- **页数**: {page_count}
- **创建时间**: {creation_date}

## 内容

![Figure 1: 图片描述](../images/pdf_name/figure_1_diagram.png)

### 1. 章节标题

章节内容...

| 表格标题 |
| -------- |
| 内容     |

$$
  数学公式
$$
```

### 返回数据结构

```json
{
  "success": true,
  "content": "Markdown 格式的内容",
  "metadata": {
    "title": "文档标题",
    "author": "作者",
    "page_count": 150,
    "creation_date": "2025-01-01"
  },
  "assets": {
    "images": [
      {
        "filename": "figure_1_diagram.png",
        "path": "../images/pdf_name/figure_1_diagram.png",
        "description": "系统架构图"
      }
    ],
    "tables": 5,
    "formulas": 12
  },
  "statistics": {
    "total_words": 15000,
    "total_paragraphs": 80,
    "processing_time": "2.5s"
  }
}
```

## 使用示例

### 基本用法

```
提取这个 PDF 的内容：/path/to/document.pdf
```

### 指定页面范围

```
提取 PDF 的第 10-20 页：/path/to/document.pdf [10, 20]
```

### 批量处理

```
批量处理这些 PDF：
- /path/to/doc1.pdf
- /path/to/doc2.pdf
- /path/to/doc3.pdf
```

### 高级选项

```
提取 PDF 内容，需要包含所有图片和表格，但不提取公式：/path/to/document.pdf
```

### 指定页面范围（批次处理）

```
提取 PDF 的第 10-20 页（用于批次处理）：/path/to/document.pdf --range 10-20
```

### 批量处理（多批次）

```
批量处理这些 PDF，每个文档独立处理：
- /path/to/doc1.pdf
- /path/to/doc2.pdf
- /path/to/doc3.pdf
```

## 特殊处理

### 加密 PDF

- 支持密码保护的文档
- 需要提供密码参数
- 自动检测加密状态

### 扫描版 PDF

- OCR 文字识别（如果需要）
- 图片质量优化
- 布局重建

### 复杂布局

- 多栏布局处理
- 页眉页脚处理
- 脚注和尾注提取

## 质量保证

### 内容验证

- 检查提取完整性
- 验证图片引用
- 确认公式格式

### 格式检查

- Markdown 语法验证
- 表格格式正确性
- 链接有效性

### 错误处理

- 部分页面提取失败的处理
- 图片提取失败的标记
- 格式转换问题的记录

## 性能优化

### 大文件处理

- 自动启用批次模式（>30 页）
- 内存使用优化
- 进度跟踪

### 并行处理

- 多文档并行提取
- 资源使用控制
- 错误隔离

## 注意事项

1. **文件路径**: 使用绝对路径或相对路径
2. **权限要求**: 确保文件可读
3. **存储空间**: 图片可能需要额外空间
4. **处理时间**: 大文档处理需要时间
5. **质量检查**: 建议人工检查关键内容

## 故障排除

### 常见问题

1. **图片路径错误**: 检查图片目录创建权限
2. **格式混乱**: 检查原始 PDF 质量
3. **提取不完整**: 检查 PDF 是否加密或损坏
4. **内存不足**: 减少批次大小或分批处理
