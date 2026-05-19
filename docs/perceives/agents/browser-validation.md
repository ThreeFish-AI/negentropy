# 浏览器验证协议（Perceives 视角）

> **规范版本**：完整的浏览器验证协议请参阅 [`docs/agents/browser-validation.md`](../../agents/browser-validation.md)。
> 本文件仅保留 Perceives 子项目特有的测试场景与约束。

---

## Perceives 特有测试场景

### PDF Pipeline 浏览器验证

Perceives 的 MCP 工具（如 `parse_pdf_to_markdown`）通过浏览器验证时，需额外关注：

1. **PDF 文件上传路径**：验证 MCP 工具接收文件路径后的端到端处理结果
2. **Stage 短路验证**：确认 `DocumentCharacteristics` 驱动的引擎选择与降级链在 UI 侧表现一致
3. **Apple Silicon GPU 加速**：MPS 策略在浏览器环境下的兼容性检查

### 相关文档

- [Adaptive Engine Selection](./pdf-engine-selection.md) — 引擎选择决策图
- [Apple Silicon Tuning](./apple-silicon-tuning.md) — GPU 调优指南
- [Perceives Framework](../framework.md) — PDF/Webpage 双 Pipeline 架构
