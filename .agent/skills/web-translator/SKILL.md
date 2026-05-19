---
name: web-translator
description: Extract web page content and convert to Markdown format while preserving structure, images, tables, and links. Use when converting web pages to Markdown for further processing.
allowed-tools: data-extractor, web-reader, filesystem
---

# Web Translator (Web Content Extractor)

专门处理网页内容的提取和转换，将网页内容转换为标准的 Markdown 格式，保持原有的结构和格式。

## 核心功能

### 1. 内容提取

- **主要内容提取**：识别并提取文章正文
- **结构保持**：维护标题层级、段落结构
- **媒体资源**：提取图片、视频等媒体信息
- **交互元素**：保存链接、按钮等交互信息

### 2. 格式转换

- **HTML to Markdown**：转换为标准 Markdown 语法
- **表格处理**：将 HTML 表格转换为 Markdown 表格
- **列表转换**：保持有序和无序列表结构
- **链接处理**：正确转换内部和外部链接

## Workflow

### 1. 内容获取

使用适当的工具：

- `data-extractor.convert_webpage_to_markdown` - 主要工具
- `web-reader.webReader` - 备用方案

### 2. 内容解析

- 识别文档结构（标题、段落、列表等）
- 提取元数据（标题、作者、发布时间等）
- 定位媒体资源
- 解析导航和侧边栏

### 3. 内容清理

- 移除广告和无关内容
- 清理脚本和样式
- 简化复杂的 HTML 结构
- 优化可读性

### 4. 格式转换

- 应用 Markdown 语法规则
- 保持视觉层次结构
- 处理特殊元素（表格、代码块）
- 生成干净的 Markdown

## 提取配置

### 基本配置

```yaml
extract_main_content: true # 提取主要内容
include_metadata: true # 包含元数据
embed_images: false # 图片保存为独立文件
extract_links: true # 提取链接信息
preserve_formatting: true # 保持格式
```

### 高级选项

- **选择性提取**：指定 CSS 选择器
- **深度控制**：控制链接追踪深度
- **媒体过滤**：筛选特定类型的媒体

## 输入格式

### 单个 URL

```
https://example.com/article
```

### 多个 URL

```
- https://example.com/doc1
- https://example.com/doc2
- https://example.com/doc3
```

### 本地 HTML 文件

```
/path/to/local/file.html
```

## 输出格式

### Markdown 内容

```markdown
# 文章标题

**作者**: Author Name
**发布时间**: 2025-01-01
**来源**: Example Website

## 摘要

文章摘要内容...

## 正文内容

### 1. 章节标题

章节内容段落...

![图片描述](path/to/image.png)

| 表格标题 |
| -------- |
| 内容     |

- 列表项 1
- 列表项 2
- 列表项 3

[相关链接](https://example.com)
```

### 元数据

```json
{
  "title": "文章标题",
  "author": "Author Name",
  "publish_date": "2025-01-01",
  "source": "Example Website",
  "url": "https://example.com/article",
  "word_count": 1500,
  "reading_time": "5 min"
}
```

### 资源列表

```json
{
  "images": [
    {
      "src": "https://example.com/image1.jpg",
      "alt": "图片描述",
      "local_path": "images/article/image1.jpg"
    }
  ],
  "links": [
    {
      "text": "链接文本",
      "url": "https://example.com/link",
      "type": "external"
    }
  ]
}
```

## 使用方法

### 基本提取

```
提取这个网页的内容：https://example.com/article
```

### 批量提取

```
批量提取这些网页：
- https://example.com/guide1
- https://example.com/guide2
```

### 保存到文件

```
提取网页内容并保存到文件：https://example.com/doc --output doc.md
```

### 指定目录

```
提取网页，保存图片到指定目录：https://example.com --images-dir ./images
```

## 特殊处理

### 代码块

````markdown
```javascript
// 保持原始代码
function example() {
  return true;
}
```
````

````

### 引用块
```markdown
> 这是引用内容
> 可以是多行
````

### 数学公式

```markdown
行内公式：$x^2 + y^2 = z^2$

块级公式：

$$
\sum_{i=1}^{n} x_i = X
$$
```

## 注意事项

1. **版权尊重**：遵守网站的使用条款
2. **频率限制**：避免过于频繁的请求
3. **内容质量**：检查提取内容的完整性
4. **路径处理**：正确处理相对和绝对路径
5. **字符编码**：确保正确的字符编码处理

## 故障排除

### 常见问题

1. **内容提取不完整**

   - 检查网页是否需要 JavaScript
   - 尝试使用 web-reader 作为备选
   - 查看是否有反爬虫措施

2. **格式混乱**

   - 检查原始 HTML 结构
   - 调整提取配置
   - 手动清理结果

3. **图片无法下载**

   - 检查图片 URL 有效性
   - 验证网络连接
   - 处理防盗链

4. **编码问题**
   - 检测页面编码
   - 强制 UTF-8 编码
   - 处理特殊字符
