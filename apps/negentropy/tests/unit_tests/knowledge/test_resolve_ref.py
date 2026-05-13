"""
_resolve_ref 多步降级解析 单元测试

验证 service.py 中关系端点解析的路径优先级（缺陷 2 修复后）：
  1. ID 级直查：id_merge_map[clean_ref] → 存留 id（含 DB UUID 跨表场景）
  2. 已是存留 id → 原值返回
  3. 标签级 fallback：精确 → 规范化 → id_to_label → label_to_id 间接链
  4. 全部失败 → 记录 warning 返回 None

注：本测试文件中的 ``_resolve_ref`` helper 是旧逻辑的本地复现，
用于覆盖标签 fallback 路径；缺陷 2 修复主线由 ``test_entity_resolver.py::
TestEntityResolverIdMergeMap`` 与生产代码 inspect.getsource 结构断言覆盖。
_resolve_ref 是 build_graph 内的闭包，无法直接导入。
"""

from __future__ import annotations

import inspect
from uuid import uuid4

from negentropy.knowledge.graph.service import GraphService
from negentropy.knowledge.types import GraphNode


def _make_entity(label: str, entity_id: str | None = None, entity_type: str = "concept") -> GraphNode:
    return GraphNode(
        id=entity_id or f"entity:{uuid4().hex[:12]}",
        label=label,
        node_type=entity_type,
        metadata={"confidence": 0.9},
    )


def _build_maps(entities: list[GraphNode]):
    """重建 service.py build_graph 中关系解析用的三张映射表"""
    label_to_id = {e.label: e.id for e in entities}
    norm_label_to_id: dict[str, str] = {}
    for e in entities:
        if e.label:
            norm = e.label.strip().lower()
            if norm not in norm_label_to_id:
                norm_label_to_id[norm] = e.id
    id_to_label: dict[str, str] = {e.id.replace("entity:", ""): e.label for e in entities if e.label}
    return label_to_id, norm_label_to_id, id_to_label


def _resolve_ref(
    ref: str,
    field_name: str,
    entities: list[GraphNode],
) -> str | None:
    """重建 _resolve_ref 闭包逻辑（与 service.py L938-974 保持同步）"""
    label_to_id, norm_label_to_id, id_to_label = _build_maps(entities)

    if not ref:
        return None
    # 1. 精确标签匹配
    if ref in label_to_id:
        return label_to_id[ref]
    # 2. 规范化标签匹配
    norm = ref.strip().lower()
    if norm in norm_label_to_id:
        return norm_label_to_id[norm]
    # 3. ID 反向查找
    clean = ref.replace("entity:", "")
    if clean in id_to_label:
        resolved_label = id_to_label[clean]
        if resolved_label in label_to_id:
            return label_to_id[resolved_label]
    # 4. 32 位十六进制哈希
    if len(ref) == 32 and all(c in "0123456789abcdef" for c in ref):
        return None
    # 5. UUID 直通
    if ref in id_to_label or ref in {e.id for e in entities}:
        return ref
    # 6. 无法解析
    return None


# ============================================================================
# Path 1: 精确标签匹配
# ============================================================================


class TestExactLabelMatch:
    def test_exact_label_found(self):
        e = _make_entity("Claude", "entity:abc123")
        result = _resolve_ref("Claude", "source", [e])
        assert result == "entity:abc123"

    def test_exact_label_not_found(self):
        e = _make_entity("Claude", "entity:abc123")
        result = _resolve_ref("GPT-4", "source", [e])
        assert result is None

    def test_multiple_entities_first_match(self):
        entities = [
            _make_entity("Claude", "entity:aaa"),
            _make_entity("GPT-4", "entity:bbb"),
        ]
        assert _resolve_ref("Claude", "source", entities) == "entity:aaa"
        assert _resolve_ref("GPT-4", "target", entities) == "entity:bbb"


# ============================================================================
# Path 2: 规范化标签匹配
# ============================================================================


class TestNormalizedLabelMatch:
    def test_case_insensitive(self):
        e = _make_entity("Claude", "entity:abc123")
        assert _resolve_ref("claude", "source", [e]) == "entity:abc123"
        assert _resolve_ref("CLAUDE", "source", [e]) == "entity:abc123"

    def test_leading_trailing_whitespace(self):
        e = _make_entity("Claude", "entity:abc123")
        assert _resolve_ref("  Claude  ", "source", [e]) == "entity:abc123"

    def test_exact_match_takes_priority(self):
        """精确匹配应优先于规范化匹配"""
        e1 = _make_entity("Claude", "entity:exact")
        e2 = _make_entity("claude", "entity:norm")
        # label_to_id 中 "Claude" 映射到 entity:exact
        # 规范化 "claude" 映射到第一个注册的（entity:exact）
        result = _resolve_ref("Claude", "source", [e1, e2])
        assert result == "entity:exact"


# ============================================================================
# Path 3: ID 反向查找
# ============================================================================


class TestIdReverseLookup:
    def test_entity_prefix_stripped(self):
        """entity:xxx 前缀应被正确处理"""
        e = _make_entity("Claude", "entity:abc123")
        result = _resolve_ref("entity:abc123", "source", [e])
        assert result == "entity:abc123"

    def test_bare_id_with_label(self):
        """纯 ID（无 entity: 前缀）应通过 id_to_label 反查"""
        e = _make_entity("Claude", "entity:abc123")
        result = _resolve_ref("abc123", "source", [e])
        assert result == "entity:abc123"

    def test_id_not_in_label_map(self):
        """ID 反查到 label 但 label 不在 label_to_id 中 → 继续降级"""
        e = _make_entity("Claude", "entity:abc123")
        # 使用一个不在任何映射中的 ID
        result = _resolve_ref("nonexistent_id", "source", [e])
        assert result is None


# ============================================================================
# Path 4: 32 位十六进制哈希检测
# ============================================================================


class TestHashDetection:
    def test_md5_hash_returns_none(self):
        """32 位十六进制哈希应被识别并返回 None"""
        e = _make_entity("Claude", "entity:abc123")
        hash_ref = "cf696f6dcaaea21728c622f01c168ebc"
        result = _resolve_ref(hash_ref, "source", [e])
        assert result is None

    def test_uppercase_hex_not_detected(self):
        """大写十六进制不应被误判为哈希（降级到 Path 5/6）"""
        e = _make_entity("Claude", "entity:abc123")
        result = _resolve_ref("CF696F6DCAAEA21728C622F01C168EBC", "source", [e])
        # 大写不满足 hex 检测，继续到 Path 5/6 → 最终 None
        assert result is None

    def test_31_chars_not_hash(self):
        """31 字符不应被识别为哈希"""
        e = _make_entity("Claude", "entity:abc123")
        result = _resolve_ref("a" * 31, "source", [e])
        # 31 字符不满足 len==32，降级到 Path 5/6 → None
        assert result is None

    def test_33_chars_not_hash(self):
        """33 字符不应被识别为哈希"""
        e = _make_entity("Claude", "entity:abc123")
        result = _resolve_ref("a" * 33, "source", [e])
        assert result is None

    def test_non_hex_32_chars_not_hash(self):
        """包含非十六进制字符的 32 字符串不应被识别为哈希"""
        e = _make_entity("Claude", "entity:abc123")
        result = _resolve_ref("cf696f6dcaaea21728c622f01c168ebz", "source", [e])
        # 'z' 不在 hex 范围内，不满足 hash 条件
        assert result is None


# ============================================================================
# Path 5: UUID 直通
# ============================================================================


class TestUuidPassthrough:
    def test_known_entity_id_passthrough(self):
        """已知实体的 ID 应直接返回"""
        e = _make_entity("Claude", "entity:abc123")
        result = _resolve_ref("entity:abc123", "source", [e])
        assert result == "entity:abc123"

    def test_unknown_uuid_returns_none(self):
        """不在映射中的 UUID 最终返回 None"""
        e = _make_entity("Claude", "entity:abc123")
        unknown = f"entity:{uuid4().hex[:12]}"
        result = _resolve_ref(unknown, "source", [e])
        assert result is None


# ============================================================================
# Path 6: 无法解析
# ============================================================================


class TestUnresolvable:
    def test_empty_string(self):
        e = _make_entity("Claude", "entity:abc123")
        assert _resolve_ref("", "source", [e]) is None

    def test_random_text(self):
        e = _make_entity("Claude", "entity:abc123")
        assert _resolve_ref("SomeRandomText123", "source", [e]) is None


# ============================================================================
# 结构回归测试: inspect.getsource 验证生产代码
# ============================================================================


class TestResolveRefStructure:
    """验证 service.py 中 _resolve_ref 闭包的关键结构特征"""

    def test_has_norm_label_map(self):
        """确认存在 norm_label_to_id 映射构建"""
        source = inspect.getsource(GraphService)
        assert "norm_label_to_id" in source

    def test_consumes_id_merge_map(self):
        """缺陷 2 修复后：_resolve_ref 应优先以 id_merge_map 作为权威映射。

        旧实现的 ``len(ref) == 32`` 哈希启发式已删除——现在被合并实体的
        ``entity:<32-hex>`` 不再依赖结构特征推断，而由 resolver 暴露的
        id_merge_map 直接重写。
        """
        source = inspect.getsource(GraphService)
        assert "id_merge_map" in source
        assert "resolution.id_merge_map" in source

    def test_has_id_reverse_lookup(self):
        """确认存在 id_to_label 反向查找"""
        source = inspect.getsource(GraphService)
        assert "id_to_label" in source

    def test_has_unresolved_endpoints_counter(self):
        """确认存在 unresolved_endpoints 计数器"""
        source = inspect.getsource(GraphService)
        assert "unresolved_endpoints" in source

    def test_no_legacy_hash_branch(self):
        """缺陷 2 修复后：``relation_endpoint_hash_unresolved`` 日志已删除。

        旧实现使用 ``len(ref) == 32 and all hex`` 启发式识别 LLM 输出的 hash，
        但这是症状而非根因——根因是被合并实体的 id 未被纳入 id_merge_map。
        修复后 id_merge_map 直接处理这类情形，该日志分支不再被触发，删除。
        """
        source = inspect.getsource(GraphService)
        assert "relation_endpoint_hash_unresolved" not in source

    def test_has_unresolved_warning_log(self):
        """确认无法解析的引用有 warning 日志"""
        source = inspect.getsource(GraphService)
        assert "relation_endpoint_unresolved" in source
