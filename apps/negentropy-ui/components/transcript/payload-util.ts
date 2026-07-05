/**
 * payload 字段解包工具。
 *
 * 后端对超长字段降级为 ``{_truncated:true, preview}`` 形态（见
 * ``claude_code/service.py::_cap_json``），渲染层需统一解包，否则会把对象
 * 误当结构化数据丢给 JsonViewer。
 */

/** 将 payload 中的「文本」字段归一为字符串：直接字符串透传，截断预览取 ``preview``，否则 null。 */
export function unwrapText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (o._truncated === true && typeof o.preview === "string") return o.preview;
  }
  return null;
}
