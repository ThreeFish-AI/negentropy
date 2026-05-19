"""单元测试：_engine_worker_entry 内的 convert 结果缓存（LRU + TTL）。

动机：同一 PDF 的 layout_analysis / table_extraction / formula_extraction /
code_detection 四个 Stage 会对 Docling/MinerU 各发起一次 `convert()`。Docling
结果已一次性聚合全部四类信息，完全没必要重复推理。缓存需保证：
1) 同一 PDF + 相同 init_kwargs + 相同 page_range → 命中；
2) PDF 内容/mtime/size 变更 → 失效；
3) init_kwargs 或 page_range 变更 → 不复用；
4) LRU 淘汰按容量上限生效；
5) TTL 过期条目不得命中。
"""

from __future__ import annotations

import os
import tempfile
import time
from pathlib import Path
from unittest.mock import patch

import pytest

from negentropy.perceives.infra._engine_worker_entry import (
    _CACHEABLE_ENGINES,
    _ConvertCache,
    _make_cache_key,
    _pdf_fingerprint,
)


# ── 辅助：在临时目录生成可复用的 fake PDF 字节 ──────────────────────────────


@pytest.fixture
def tmp_pdf_path() -> Path:
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(b"%PDF-1.7\n%fake pdf body for fingerprint test\n")
        path = Path(f.name)
    yield path
    try:
        path.unlink()
    except FileNotFoundError:
        pass


# ── _pdf_fingerprint ────────────────────────────────────────────────────────


class TestPdfFingerprint:
    def test_same_file_same_fingerprint(self, tmp_pdf_path: Path) -> None:
        fp1 = _pdf_fingerprint(str(tmp_pdf_path))
        fp2 = _pdf_fingerprint(str(tmp_pdf_path))
        assert fp1 is not None
        assert fp1 == fp2

    def test_different_content_different_fingerprint(self, tmp_pdf_path: Path) -> None:
        fp1 = _pdf_fingerprint(str(tmp_pdf_path))
        with tmp_pdf_path.open("wb") as f:
            f.write(b"%PDF-1.7\n%totally different content\n")
        # 写入后 mtime_ns 变，内容也变
        fp2 = _pdf_fingerprint(str(tmp_pdf_path))
        assert fp1 != fp2

    def test_missing_file_returns_none(self) -> None:
        assert _pdf_fingerprint("/no/such/file.pdf") is None

    def test_fingerprint_contains_size_and_mtime(self, tmp_pdf_path: Path) -> None:
        fp = _pdf_fingerprint(str(tmp_pdf_path))
        assert fp is not None
        # 格式："size:mtime_ns:digest"
        parts = fp.split(":")
        assert len(parts) == 3
        assert int(parts[0]) == os.path.getsize(tmp_pdf_path)
        assert len(parts[2]) == 32  # blake2b(digest_size=16) hex 长度


# ── _make_cache_key ─────────────────────────────────────────────────────────


class TestMakeCacheKey:
    def test_missing_pdf_path_returns_none(self) -> None:
        key = _make_cache_key("docling", {}, "init_hash")
        assert key is None

    def test_nonexistent_path_returns_none(self) -> None:
        key = _make_cache_key("docling", {"pdf_path": "/no/such/file.pdf"}, "init_hash")
        assert key is None

    def test_valid_key_has_expected_shape(self, tmp_pdf_path: Path) -> None:
        key = _make_cache_key(
            "docling",
            {"pdf_path": str(tmp_pdf_path), "page_range": (0, 10)},
            "init_hash",
        )
        assert key is not None
        assert len(key) == 5
        engine_name, fingerprint, page_range, embed_images, init_hash = key
        assert engine_name == "docling"
        assert isinstance(fingerprint, str)
        assert page_range == (0, 10)
        assert embed_images is False
        assert init_hash == "init_hash"

    def test_list_page_range_coerced_to_tuple(self, tmp_pdf_path: Path) -> None:
        """JSON 反序列化会把 tuple 退化为 list；键必须归一化。"""
        key_list = _make_cache_key(
            "docling",
            {"pdf_path": str(tmp_pdf_path), "page_range": [0, 10]},
            "init_hash",
        )
        key_tuple = _make_cache_key(
            "docling",
            {"pdf_path": str(tmp_pdf_path), "page_range": (0, 10)},
            "init_hash",
        )
        assert key_list == key_tuple

    def test_different_init_hash_different_key(self, tmp_pdf_path: Path) -> None:
        k1 = _make_cache_key("docling", {"pdf_path": str(tmp_pdf_path)}, "h1")
        k2 = _make_cache_key("docling", {"pdf_path": str(tmp_pdf_path)}, "h2")
        assert k1 is not None and k2 is not None
        assert k1 != k2

    def test_different_embed_images_different_key(self, tmp_pdf_path: Path) -> None:
        k1 = _make_cache_key(
            "docling",
            {"pdf_path": str(tmp_pdf_path), "embed_images": False},
            "h",
        )
        k2 = _make_cache_key(
            "docling",
            {"pdf_path": str(tmp_pdf_path), "embed_images": True},
            "h",
        )
        assert k1 != k2


# ── _ConvertCache 本体 ──────────────────────────────────────────────────────


class TestConvertCacheBasic:
    def test_get_miss_returns_none(self) -> None:
        c = _ConvertCache()
        assert c.get(("missing",)) is None

    def test_put_then_get_hit(self) -> None:
        c = _ConvertCache()
        c.put(("k",), "result_A")
        assert c.get(("k",)) == "result_A"

    def test_put_none_is_noop(self) -> None:
        """`convert()` 返回 None 不入缓存以便下次重试。"""
        c = _ConvertCache()
        c.put(("k",), None)
        assert len(c) == 0
        assert c.get(("k",)) is None

    def test_len_reflects_size(self) -> None:
        c = _ConvertCache(capacity=4)
        c.put(("a",), 1)
        c.put(("b",), 2)
        assert len(c) == 2

    def test_clear_removes_all(self) -> None:
        c = _ConvertCache()
        c.put(("a",), 1)
        c.put(("b",), 2)
        c.clear()
        assert len(c) == 0
        assert c.get(("a",)) is None


class TestConvertCacheLRU:
    def test_eviction_when_over_capacity(self) -> None:
        c = _ConvertCache(capacity=2)
        c.put(("a",), 1)
        c.put(("b",), 2)
        c.put(("c",), 3)
        # a 最老，应被淘汰
        assert c.get(("a",)) is None
        assert c.get(("b",)) == 2
        assert c.get(("c",)) == 3

    def test_get_refreshes_lru_order(self) -> None:
        c = _ConvertCache(capacity=2)
        c.put(("a",), 1)
        c.put(("b",), 2)
        # 读取 a 刷新为“最新”
        assert c.get(("a",)) == 1
        c.put(("c",), 3)
        # 此时 b 反而是最老的，被淘汰
        assert c.get(("b",)) is None
        assert c.get(("a",)) == 1
        assert c.get(("c",)) == 3

    def test_repeated_put_updates_value_and_order(self) -> None:
        c = _ConvertCache(capacity=2)
        c.put(("a",), 1)
        c.put(("b",), 2)
        c.put(("a",), 99)  # 更新 a，同时把 a 移到最新
        c.put(("c",), 3)
        # b 是最老的，淘汰
        assert c.get(("b",)) is None
        assert c.get(("a",)) == 99
        assert c.get(("c",)) == 3


class TestConvertCacheTTL:
    def test_entry_expires_after_ttl(self) -> None:
        """TTL 过期的条目应被 get 视为 miss。"""
        c = _ConvertCache(capacity=4, ttl_seconds=10.0)

        fake_now = [1000.0]

        def fake_monotonic() -> float:
            return fake_now[0]

        with patch(
            "negentropy.perceives.infra._engine_worker_entry.time.monotonic",
            side_effect=fake_monotonic,
        ):
            c.put(("k",), "value")
            # TTL 内：命中
            fake_now[0] = 1005.0
            assert c.get(("k",)) == "value"
            # 超过 TTL：miss
            fake_now[0] = 1020.0
            assert c.get(("k",)) is None
            # 过期条目应被清理
            assert len(c) == 0

    def test_zero_ttl_disables_expiry(self) -> None:
        """ttl_seconds=0 视为禁用 TTL（仅 LRU）。"""
        c = _ConvertCache(capacity=4, ttl_seconds=0.0)
        c.put(("k",), "v")
        # 立即 sleep 一小段，应仍命中
        time.sleep(0.01)
        assert c.get(("k",)) == "v"


# ── 集成：缓存 + 指纹 + 键，模拟 Stage 重放 ─────────────────────────────────


class TestCacheReplay:
    """模拟 layout/table/formula/code 四个 Stage 对同一 PDF 连续 convert 的行为。"""

    def test_same_pdf_hits_cache_across_stages(self, tmp_pdf_path: Path) -> None:
        c = _ConvertCache()
        init_hash = "fixed_init"
        # Stage 1 miss → put
        k1 = _make_cache_key(
            "docling",
            {"pdf_path": str(tmp_pdf_path), "page_range": None},
            init_hash,
        )
        assert k1 is not None
        assert c.get(k1) is None
        c.put(k1, {"markdown": "once"})
        # Stage 2/3/4：相同键应直接命中
        for _ in range(3):
            k_next = _make_cache_key(
                "docling",
                {"pdf_path": str(tmp_pdf_path), "page_range": None},
                init_hash,
            )
            assert k_next == k1
            assert c.get(k_next) == {"markdown": "once"}

    def test_pdf_mutation_invalidates_cache(self, tmp_pdf_path: Path) -> None:
        c = _ConvertCache()
        init_hash = "h"
        k_old = _make_cache_key("docling", {"pdf_path": str(tmp_pdf_path)}, init_hash)
        assert k_old is not None
        c.put(k_old, "old_result")
        # 覆盖写 PDF 内容（同一路径，不同 mtime/size/head）
        time.sleep(0.01)
        with tmp_pdf_path.open("wb") as f:
            f.write(b"%PDF-1.7\n%NEW CONTENT for invalidation test XXX\n")
        k_new = _make_cache_key("docling", {"pdf_path": str(tmp_pdf_path)}, init_hash)
        assert k_new is not None
        assert k_new != k_old
        assert c.get(k_new) is None  # 新键 miss

    def test_page_range_variant_does_not_collide(self, tmp_pdf_path: Path) -> None:
        init_hash = "h"
        k_full = _make_cache_key("docling", {"pdf_path": str(tmp_pdf_path)}, init_hash)
        k_partial = _make_cache_key(
            "docling",
            {"pdf_path": str(tmp_pdf_path), "page_range": (0, 5)},
            init_hash,
        )
        assert k_full != k_partial


class TestCacheableEnginesContract:
    """仅 docling/mineru/opendataloader 入白名单；Marker/Fake 引擎不走缓存。"""

    def test_cacheable_set_is_exactly_docling_and_mineru(self) -> None:
        assert _CACHEABLE_ENGINES == frozenset({"docling", "mineru", "opendataloader"})
