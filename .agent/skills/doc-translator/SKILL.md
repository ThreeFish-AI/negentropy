---
name: doc-translator
description: 将 PDF 格式或 Web Page 格式的源文档转换成保持原排版格式的 Markdown 格式精译中文文档。
allowed-tools: Skill, filesystem, data-extractor, zai-mcp-server, web-reader, web-search-prime, time
---

# Document Translator (Coordinator)

按照下文 Workflow，协调各个子技能完成文档的完整翻译流程，包括内容提取、中文翻译、格式化和最终文档生成。

## 协调职责

### 1. 流程编排

- 分析文档类型和大小，选择合适的处理策略
- 协调各子技能的执行顺序
- 管理数据在各技能间的流转
- 处理批次管理和进度跟踪

### 2. 资源管理

- 创建和管理输出目录结构
- 协调图片资源的存储和引用
- 管理临时文件的创建和清理
- 维护工作环境的整洁

### 3. 质量控制

- 监控各步骤的执行状态
- 验证每个阶段的输出质量
- 处理错误和异常情况
- 生成详细的处理报告

## 核心工作流程

### 1. 初始化阶段

```
输入: 源文档路径或 URL
分析:
- 文档类型（PDF/Web）
- 文档大小（页数/字数）
- 处理复杂度评估
- 选择处理策略
```

### 2. 准备工作

```
创建目录结构:
/path/to/source/
├── translate/          # 翻译输出目录
│   ├── {doc_name}.md   # 最终翻译文档
│   └── images/         # 图片资源
│       └── {doc_name}/ # 文档相关图片
└── temp/               # 临时文件目录
    ├── batch_*.md      # 批次处理文件
    └── progress.json   # 进度跟踪文件
```

### 3. 批次处理策略

**批次大小限制**:

- 最大页数: 30 页/批次
- 最大段落数: 60 段落/批次
- 最大字数: 6000 字/批次

**批次划分**:

- 优先级: 页数 > 段落数 > 字数
- 在章节、段落等自然边界处分割
- 确保每个批次的内容相对完整

### 4. 处理流程

#### 小文档直接处理

```
doc-translator (协调器)
    ├── 1. pdf-reader 或 web-translator (内容提取)
    │   └── 输出: 原始 Markdown 内容
    ├── 2. zh-translator (中文翻译)
    │   └── 输出: 中文 Markdown 内容
    ├── 3. markdown-formatter (格式优化)
    │   └── 输出: 格式化的中文 Markdown
    ├── 4. 质量检查和修复
    └── 5. 生成最终文档
```

#### 大文档批次处理

```
doc-translator (协调器)
    ├── batch-processor (批次管理)
    │   ├── 1. 创建批次计划
    │   └── 2. 循环处理每个批次:
    │       ├── pdf-reader/web-translator (提取)
    │       ├── zh-translator (翻译)
    │       ├── markdown-formatter (格式化)
    │       ├── 质量检查
    │       └── 追加到目标文档
    ├── 3. 合并所有批次结果
    ├── 4. 整体格式优化
    └── 5. 生成最终文档和报告
```

## 详细执行步骤

### 步骤 1: 批次规划

1. 根据源文档内容制定批次处理计划
2. 创建目标 Markdown 文档
3. 初始化进度跟踪

### 步骤 2: 批次处理循环

```
FOR EACH batch:
    1. 检查是否所有批次处理完成
    2. 创建批次 Markdown 文档
    3. 内容提取:
       - PDF: pdf-reader
       - Web: web-translator
    4. 内容翻译:
       - zh-translator
    5. 格式化:
       - markdown-formatter
    6. 质量检查:
       - 图片引用验证
       - 格式一致性检查
       - 翻译准确性检查
    7. 追加到目标文档
    8. 清理批次临时文件
END FOR
```

### 步骤 3: 最终处理

1. 检查整体转换与翻译的正确性
2. 修复发现的问题
3. 优化文档整体布局
4. 生成处理报告

## 子技能调用接口

### pdf-reader 调用

```python
result = await Skill("pdf-reader", {
    "file_path": "/path/to/document.pdf",
    "page_range": [start, end],  # 批次处理时使用
    "options": {
        "extract_images": True,
        "extract_tables": True,
        "extract_formulas": True,
        "include_metadata": True
    }
})
```

### web-translator 调用

```python
result = await Skill("web-translator", {
    "url": "https://example.com/article",
    "options": {
        "extract_main_content": True,
        "include_metadata": True,
        "preserve_formatting": True
    }
})
```

### zh-translator 调用

```python
result = await Skill("zh-translator", {
    "content": markdown_content,
    "options": {
        "preserve_code": True,
        "preserve_formulas": True,
        "terminology": terminology_dict
    }
})
```

### markdown-formatter 调用

```python
result = await Skill("markdown-formatter", {
    "content": translated_content,
    "options": {
        "check_links": True,
        "optimize_images": True,
        "fix_tables": True
    }
})
```

### batch-processor 调用

```python
result = await Skill("batch-processor", {
    "document": {
        "type": "pdf",  # or "web"
        "path": "/path/to/document.pdf"
    },
    "batch_size": {
        "max_pages": 30,
        "max_paragraphs": 60,
        "max_words": 6000
    }
})
```

## 错误处理策略

### 子技能失败处理

- **pdf-reader 失败**: 尝试备用提取方案，记录失败部分
- **web-translator 失败**: 使用 web-reader 作为后备
- **zh-translator 失败**: 保持原文，添加翻译标记
- **markdown-formatter 失败**: 使用基础格式化
- **batch-processor 失败**: 切换到单批次处理

### 部分失败恢复

- 记录失败的具体内容
- 继续处理剩余部分
- 在最终报告中详细说明
- 提供手动修复建议

### 进度恢复

- 保存详细的进度信息
- 支持从失败点恢复
- 避免重复处理已完成部分

## 使用方法

### PDF 文档翻译

```
翻译这个 PDF 文档：/path/to/document.pdf
```

### 网页翻译

```
翻译这个网页：https://example.com/article
```

### 批量文档翻译

```
翻译这些文档：
- /path/to/doc1.pdf
- /path/to/doc2.pdf
- https://example.com/article1
```

### 指定输出目录

```
翻译这个文档到指定目录：/path/to/document.pdf --output /custom/path/
```

### 恢复中断的翻译

```
继续翻译上次未完成的文档：/path/to/document.pdf --resume
```

## 输出内容

### 1. 翻译文档

- 位置: `{source_path}/translate/{doc_name}.md`
- 格式: 完整的中文 Markdown 文档
- 包含: 翻译内容、图片引用、表格、公式等

### 2. 处理报告

- 位置: `{source_path}/translate/{doc_name}_report.md`
- 内容: 处理统计、质量检查结果、问题记录等

### 3. 图片资源

- 位置: `{source_path}/images/{doc_name}/`
- 格式: 原始图片文件
- 命名: 有意义的英文名称

## 质量保证检查清单

### 内容一致性

- [ ] 中英文内容对应完整
- [ ] 翻译准确无误
- [ ] 术语使用一致
- [ ] 专业词汇正确

### 格式一致性

- [ ] 目录结构完整
- [ ] 标题层级正确
- [ ] 图片引用有效
- [ ] 表格格式正确
- [ ] 公式显示正常

### 技术规范

- [ ] Markdown 语法正确
- [ ] LaTeX 公式规范
- [ ] 链接可访问
- [ ] 图片路径正确

### 处理完整性

- [ ] 所有页面已处理
- [ ] 无遗漏内容
- [ ] 临时文件已清理
- [ ] 报告生成完整

## 注意事项

1. **文件路径**: 使用源文档所在路径作为工作目录
2. **命名规范**: 遵循预定义的文件和目录命名规则
3. **资源管理**: 及时清理临时文件，保持环境整洁
4. **质量检查**: 严格进行多层次的质量验证
5. **错误处理**: 优雅处理各种异常情况
6. **进度跟踪**: 提供详细的处理进度信息
