---
name: batch-processor
description: Manage large document processing by splitting into batches and coordinating the full translation workflow (extraction, translation, formatting). Use when handling documents larger than 30 pages, 60 paragraphs, or 6000 words.
allowed-tools: Skill, filesystem, time
---

# Batch Processor

专门管理大文档的批次处理，协调完整的翻译工作流程（提取、翻译、格式化），确保在处理大型文档时的效率和稳定性。

## 批次规则

### 批次大小限制

- **最大页数**: 30 页/批次
- **最大段落数**: 60 段落/批次
- **最大字数**: 6000 字/批次

### 批次划分策略

1. **优先级**: 页数 > 段落数 > 字数
2. **边界处理**: 在章节、段落等自然边界处分割
3. **内容完整性**: 确保每个批次的内容相对完整

## Workflow

### 1. 文档分析

```
输入: 文档路径或内容
输出: 文档分析报告
```

分析内容：

- 文档类型（PDF/Web/Markdown）
- 总页数、段落数、字数
- 建议的批次数量
- 预估处理时间

### 2. 批次规划

```
输入: 文档分析报告
输出: 批次处理计划
```

规划内容：

- 批次数量
- 每个批次的范围
- 处理顺序
- 临时文件命名

### 3. 批次执行

```
输入: 批次处理计划
输出: 批次处理结果
```

执行步骤：

1. 创建工作目录
2. 按顺序处理每个批次
3. 跟踪处理进度
4. 保存中间结果
5. 错误处理和重试

#### 批次内处理流程

```
FOR EACH batch:
    1. 内容提取
       - PDF: 调用 pdf-reader
       - Web: 调用 web-translator
    2. 内容翻译
       - 调用 zh-translator
    3. 格式优化
       - 调用 markdown-formatter
    4. 质量检查
       - 验证输出质量
    5. 保存批次结果
END FOR
```

### 4. 结果合并

```
输入: 所有批次结果
输出: 最终合并文档
```

合并操作：

- 按顺序合并内容
- 处理批次间的衔接
- 清理临时文件
- 生成处理报告

## 使用方法

### 自动批次处理

```
请处理这个大文档，自动分成合适的批次：/path/to/large_document.pdf
```

### 自定义批次大小

```
处理这个文档，每批最多 20 页：/path/to/document.pdf
```

### 恢复中断的处理

```
继续处理上次未完成的文档，从第 3 批开始：/path/to/document.pdf
```

## 批次命名规范

### 临时文件格式

- 批次文件：`{doc_name}_batch_{N}.md`
- 图片目录：`{doc_name}_batch_{N}_images/`
- 进度文件：`{doc_name}_progress.json`
- 错误日志：`{doc_name}_errors.log`

### 最终输出

- 合并文档：`{doc_name}_translated.md`
- 图片目录：`{doc_name}_images/`
- 处理报告：`{doc_name}_report.md`

## 进度跟踪

### 进度信息格式

```json
{
  "document": "document.pdf",
  "total_batches": 5,
  "current_batch": 3,
  "status": "processing",
  "start_time": "2025-12-10T20:00:00Z",
  "estimated_completion": "2025-12-10T20:30:00Z",
  "batches": [
    {
      "batch_id": 1,
      "status": "completed",
      "pages": "1-20",
      "processed_at": "2025-12-10T20:05:00Z"
    },
    {
      "batch_id": 2,
      "status": "completed",
      "pages": "21-40",
      "processed_at": "2025-12-10T20:12:00Z"
    },
    {
      "batch_id": 3,
      "status": "processing",
      "pages": "41-60",
      "started_at": "2025-12-10T20:18:00Z"
    }
  ]
}
```

### 状态更新

- `pending`: 等待处理
- `processing`: 正在处理
- `completed`: 处理完成
- `failed`: 处理失败
- `retry`: 重试中

## 错误处理

### 重试机制

1. **自动重试**: 最多 3 次
2. **退避策略**: 指数退避（1s, 2s, 4s）
3. **批次隔离**: 单个批次失败不影响其他批次

### 错误恢复

- 记录失败批次的详细信息
- 支持从失败点恢复
- 提供手动干预选项

## 性能优化

### 并行处理（可选）

- 对于独立的批次，支持并行处理
- 最大并发数：3（避免系统过载）
- 资源管理和限制

### 内存管理

- 及时释放已处理的批次
- 控制内存使用峰值
- 优化大文件的读写

## 使用示例

### 完整处理流程

```
输入: 大型 PDF 文档（150 页）

1. 分析文档：需要 5 个批次
2. 创建计划：
   - 批次 1: 页 1-30
   - 批次 2: 页 31-60
   - 批次 3: 页 61-90
   - 批次 4: 页 91-120
   - 批次 5: 页 121-150
3. 执行处理：
   - 依次处理每个批次
   - 每批次调用 pdf-reader → zh-translator → markdown-formatter
   - 保存中间结果
4. 合并结果：
   - 组合所有批次
   - 生成最终文档
   - 清理临时文件
```

### 翻译工作流协调

```python
# 处理单个批次的完整流程
async def process_batch(batch_info):
    # 1. 提取内容
    if document_type == 'pdf':
        extracted = await Skill("pdf-reader", {
            "file_path": file_path,
            "page_range": batch_info["range"]
        })
    else:
        extracted = await Skill("web-translator", {
            "url": document_url
        })

    # 2. 翻译内容
    translated = await Skill("zh-translator", {
        "content": extracted["content"]
    })

    # 3. 格式化
    formatted = await Skill("markdown-formatter", {
        "content": translated["translated_content"],
        "post_translation": True
    })

    # 4. 返回结果
    return {
        "batch_id": batch_info["id"],
        "content": formatted["formatted_content"],
        "status": "completed"
    }
```

## 注意事项

1. **存储空间**: 确保有足够空间存储临时文件和图片资源
2. **处理时间**: 大文档翻译处理可能需要较长时间
3. **中断恢复**: 支持处理中断后的恢复，保存详细进度
4. **质量检查**: 每个批次处理完成后进行质量验证
5. **日志记录**: 详细记录处理过程，便于调试
6. **翻译一致性**: 确保批次间术语翻译的一致性
7. **内存管理**: 及时清理已处理的批次，避免内存溢出
