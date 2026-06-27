"""PatrolMemoryStore 单测 — 契约解析（纯函数）+ persist_contract 分发逻辑（无 DB/网络）。

DB 落库的 SQL 由 FakeStore 捕获调用断言；parse_contract / contract_score 为纯函数全覆盖。
"""

from __future__ import annotations

from typing import Any

from negentropy.engine.routine.patrol_memory import (
    PatrolMemoryStore,
    contract_score,
    parse_contract,
)

# ---------------------------------------------------------------------------
# parse_contract / contract_score（纯函数）
# ---------------------------------------------------------------------------


def test_parse_contract_explicit_fence():
    summary = (
        "一些描述\n"
        "```pdf-fidelity-contract\n"
        '{"doc_id": "d1", "score": 88, "status": "progressing", "defects": [], '
        '"unfixable_regions": [], "patterns": [], "perceives_diff_summary": "", "non_regression": "n/a"}'
        "\n```\n"
    )
    c = parse_contract(summary)
    assert c is not None
    assert c["doc_id"] == "d1"
    assert contract_score(c) == 88


def test_parse_contract_fence_with_json_lang():
    summary = '```json\n{"doc_id":"d2","score":100,"status":"done"}' + "\n```"
    c = parse_contract(summary)
    assert c == {"doc_id": "d2", "score": 100, "status": "done"}


def test_parse_contract_trailing_bare_json():
    summary = '分析文字……\n{"doc_id":"d3","score":42,"status":"unfixable"}'
    c = parse_contract(summary)
    assert c is not None and c["status"] == "unfixable"


def test_parse_contract_none_and_malformed():
    assert parse_contract(None) is None
    assert parse_contract("") is None
    assert parse_contract("无任何 JSON 的纯文本") is None


def test_contract_score_invalid():
    assert contract_score(None) is None
    assert contract_score({"score": "N/A"}) is None
    assert contract_score({}) is None
    assert contract_score({"score": "73"}) == 73


# ---------------------------------------------------------------------------
# persist_contract 分发逻辑（FakeStore 捕获调用，无 DB）
# ---------------------------------------------------------------------------


class _FakeStore(PatrolMemoryStore):
    """覆写所有 DB 触达方法，仅记录调用。"""

    def __init__(self) -> None:  # 不调用父类 __init__（无需 db/mem）
        self.done: list[dict[str, Any]] = []
        self.doc_unfixable: list[dict[str, Any]] = []
        self.regions: list[dict[str, Any]] = []
        self.patterns: list[dict[str, Any]] = []
        self._existing_regions: set[str] = set()

    async def record_done(self, *, doc_id, score, routine_id):  # type: ignore[override]
        self.done.append({"doc_id": doc_id, "score": score, "routine_id": routine_id})

    async def record_doc_unfixable(self, *, doc_id, score, routine_id):  # type: ignore[override]
        self.doc_unfixable.append({"doc_id": doc_id, "score": score, "routine_id": routine_id})

    async def get_unfixable_regions(self, doc_id):  # type: ignore[override]
        return [{"locator": loc} for loc in self._existing_regions]

    async def record_unfixable_region(self, *, doc_id, locator, attempts, reason, suspected_module=""):  # type: ignore[override]
        self.regions.append({"doc_id": doc_id, "locator": locator, "attempts": attempts, "reason": reason})
        self._existing_regions.add(locator)

    async def record_pattern(self, *, doc_id, defect_type, fix_summary, module):  # type: ignore[override]
        if not fix_summary.strip():  # 对齐真实 record_pattern 的空摘要守卫
            return
        self.patterns.append(
            {"doc_id": doc_id, "defect_type": defect_type, "fix_summary": fix_summary, "module": module}
        )


def test_persist_contract_done_with_regions_and_patterns():
    store = _FakeStore()
    contract = {
        "doc_id": "d-done",
        "score": 100,
        "status": "done",
        "unfixable_regions": [
            {"locator": "page3-table2", "attempts": 5, "reason": "扫描版", "suspected_module": "ops/pdf.py"},
            {"locator": "page7-formula1", "attempts": 6, "reason": "OCR 失败"},
        ],
        "patterns": [
            {"defect_type": "table", "fix_summary": "调 TableFormer 阈值", "module": "pipeline/stages/pdf/"},
            {"defect_type": "image", "fix_summary": "", "module": ""},  # 空摘要应被跳过
        ],
    }
    import asyncio

    asyncio.run(store.persist_contract(contract=contract, routine_id="r1"))

    assert store.done == [{"doc_id": "d-done", "score": 100, "routine_id": "r1"}]
    assert len(store.regions) == 2
    assert {r["locator"] for r in store.regions} == {"page3-table2", "page7-formula1"}
    assert len(store.patterns) == 1  # 空 fix_summary 的那条被跳过
    assert store.patterns[0]["defect_type"] == "table"


def test_persist_contract_unfixable_status():
    store = _FakeStore()
    contract = {"doc_id": "d-x", "score": 60, "status": "unfixable", "unfixable_regions": [], "patterns": []}
    import asyncio

    asyncio.run(store.persist_contract(contract=contract, routine_id="r2"))
    assert store.doc_unfixable == [{"doc_id": "d-x", "score": 60, "routine_id": "r2"}]
    assert store.done == []


def test_persist_contract_no_doc_id_skipped():
    store = _FakeStore()
    import asyncio

    asyncio.run(store.persist_contract(contract={"score": 50, "status": "done"}, routine_id="r3"))
    assert store.done == [] and store.regions == [] and store.patterns == []


def test_persist_contract_dedup_existing_region():
    store = _FakeStore()
    store._existing_regions.add("page1-img")  # 已存在
    contract = {
        "doc_id": "d-d",
        "score": 99,
        "status": "done",
        "unfixable_regions": [
            {"locator": "page1-img", "attempts": 5, "reason": "已有"},  # 应跳过
            {"locator": "page2-tbl", "attempts": 5, "reason": "新"},
        ],
        "patterns": [],
    }
    import asyncio

    asyncio.run(store.persist_contract(contract=contract, routine_id="r4"))
    assert [r["locator"] for r in store.regions] == ["page2-tbl"]
