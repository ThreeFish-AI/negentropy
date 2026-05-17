"""Graph build_graph 与取消传播测试

从原 test_graph_service.py 中拆出的 build_graph 构建流程与 cancellation 传播测试。
共享辅助工具（Fake Repository、patch helper 等）来自同目录的 conftest.py。
"""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest

from negentropy.knowledge.graph.service import GraphService
from negentropy.knowledge.types import GraphBuildConfig

from .conftest import (
    FailingClearGraphRepository,
    FailingCreateRelationsRepository,
    FakeGraphRepository,
    PhaseTrackingFakeRepository,
    extract_phase_sequence,
    make_fake_extractor_class,
    patch_build_graph,
)


@pytest.mark.asyncio
async def test_build_graph_persists_canonical_model_name():
    repository = FakeGraphRepository()
    service = GraphService(repository=repository, config=GraphBuildConfig(llm_model="openai/gpt-5-mini"))

    with patch_build_graph(repository):
        result = await service.build_graph(
            corpus_id=uuid4(),
            app_name="test-app",
            chunks=[],
        )

    assert result.status in ("completed", "completed_with_errors")
    assert repository.create_build_run_kwargs["model_name"] == "openai/gpt-5-mini"
    assert repository.create_build_run_kwargs["extractor_config"]["llm_model"] == "openai/gpt-5-mini"


# ================================
# Build Phase Progress Tests
# ================================


@pytest.mark.asyncio
async def test_build_graph_emits_phase_milestones_in_order():
    """build_graph 应按 extracting → resolving → syncing → pagerank → communities → summaries 顺序触发 emit_phase。

    回归保护：旧实现只在 chunk 循环每批结束时上报 progress_percent，五个后置阶段
    无任何"开始"日志/进度切换。修复后每个阶段应在执行前调用 emit_phase 写入 _phase 条目，
    SSE 端点据此透传中文标签给 KgBuildProgressPill。
    """
    repository = PhaseTrackingFakeRepository()
    service = GraphService(repository=repository, config=GraphBuildConfig(llm_model="openai/gpt-5-mini"))

    with patch_build_graph(repository):
        result = await service.build_graph(
            corpus_id=uuid4(),
            app_name="test-app",
            chunks=[],  # 空 chunk：跳过实体抽取与持久化阶段，但所有 emit_phase 仍应触发
        )

    assert result.status in ("completed", "completed_with_errors")

    phases = extract_phase_sequence(repository.update_calls)
    expected = ["extracting", "resolving", "syncing", "pagerank", "communities", "summaries"]
    assert phases == expected, f"phase 序列不符合预期，实际={phases}"


@pytest.mark.asyncio
async def test_build_graph_progress_percent_monotonically_increases():
    """build_graph 期间所有 update_build_run 上报的 progress_percent 应单调非递减。

    回归保护：emit_phase 与 maybe_report_chunk_progress 之间若进度计算错误，
    可能导致进度条"倒退"，影响用户对构建进展的判断。
    """
    repository = PhaseTrackingFakeRepository()
    service = GraphService(repository=repository, config=GraphBuildConfig())

    with patch_build_graph(repository):
        await service.build_graph(corpus_id=uuid4(), app_name="test-app", chunks=[])

    progresses = [
        call["progress_percent"]
        for call in repository.update_calls
        if "progress_percent" in call and call["progress_percent"] is not None
    ]
    assert len(progresses) >= 6, "至少应有 6 次进度上报（每个 phase 一次）"
    for prev, curr in zip(progresses, progresses[1:], strict=False):
        assert curr >= prev, f"progress_percent 不应回退：prev={prev} curr={curr}"


@pytest.mark.asyncio
async def test_build_graph_strips_phase_entries_from_terminal_warnings():
    """终态 warnings 中不应残留 _phase 条目（service._strip_phase_entries 行为）。

    回归保护：_phase 是运行期前端实时渲染信号；落入终态 warnings 会污染历史诊断
    （warnings 语义混淆）。前端在 status=completed/failed 时也不依赖 _phase。
    """
    repository = PhaseTrackingFakeRepository()
    service = GraphService(repository=repository, config=GraphBuildConfig())

    with patch_build_graph(repository):
        await service.build_graph(corpus_id=uuid4(), app_name="test-app", chunks=[])

    # 找到终态的最后一次 update 调用
    terminal_call = next(
        (c for c in reversed(repository.update_calls) if c.get("status") in ("completed", "completed_with_errors")),
        None,
    )
    assert terminal_call is not None, (
        "build_graph 应在结束时调用 update_build_run(status='completed' 或 'completed_with_errors')"
    )

    warnings = terminal_call.get("warnings") or []
    phase_entries = [w for w in warnings if isinstance(w, dict) and "_phase" in w]
    assert phase_entries == [], "终态 warnings 不应包含 _phase 运行期条目"

    # _metrics 应保留（与原有 build_graph 行为一致）
    metrics_entries = [w for w in warnings if isinstance(w, dict) and "_metrics" in w]
    assert len(metrics_entries) == 1, "终态 warnings 应包含一条 _metrics 条目"


# ================================
# Failure Path Warnings Persistence
# ================================


@pytest.mark.asyncio
async def test_build_graph_failure_strips_phase_and_persists_warnings_on_early_exception():
    """早期失败：异常发生在 build_warnings/build_metrics 构造之前也不应触发 UnboundLocalError；
    failure 终态 warnings 不应残留 _phase 条目（与 success 分支语义对称）。

    回归保护本 PR 评审 #1：旧实现 except 分支未传 warnings → DB 行保留上一次 emit_phase
    写入的 _phase 运行期标记，且丢失任何已累积的 algorithm warning。
    """
    repository = FailingClearGraphRepository()
    service = GraphService(repository=repository, config=GraphBuildConfig())

    with patch_build_graph(repository):
        result = await service.build_graph(corpus_id=uuid4(), app_name="test-app", chunks=[])

    assert result.status == "failed"
    failed_call = next(
        (c for c in reversed(repository.update_calls) if c.get("status") == "failed"),
        None,
    )
    assert failed_call is not None, "失败终态必须调用 update_build_run(status='failed')"

    # 早期失败路径下 warnings 应为 None（_strip_phase_entries([]) 为空 → 落 None 节流 SQL）
    # 关键不变量：DB 不应残留任何 _phase 条目
    warnings = failed_call.get("warnings") or []
    phase_entries = [w for w in warnings if isinstance(w, dict) and "_phase" in w]
    assert phase_entries == [], "失败终态 warnings 不应包含 _phase 运行期条目"


@pytest.mark.asyncio
async def test_build_graph_failure_preserves_algorithm_warnings():
    """中段失败：build_warnings 中已累积的 algorithm warning 必须随 failed 终态落库。

    构造手法：让 create_relations 抛错。此时 chunks=[] 不会进 chunk 循环抽取，但
    emit_phase(extracting/resolving) 已写过 _phase；failure 分支应剥离 _phase 后落库。
    若有 algorithm warning（本测试用 chunks=[] 路径无法注入，仅验证 _phase 剥离与
    UnboundLocalError 不发生）。
    """
    repository = FailingCreateRelationsRepository()
    service = GraphService(repository=repository, config=GraphBuildConfig())

    with patch_build_graph(repository):
        result = await service.build_graph(corpus_id=uuid4(), app_name="test-app", chunks=[])

    assert result.status == "failed"
    failed_call = next(
        (c for c in reversed(repository.update_calls) if c.get("status") == "failed"),
        None,
    )
    assert failed_call is not None

    warnings = failed_call.get("warnings") or []
    phase_entries = [w for w in warnings if isinstance(w, dict) and "_phase" in w]
    assert phase_entries == [], "失败终态 warnings 不应残留 _phase（应被 _strip_phase_entries 剥离）"


# ================================
# Cancellation Propagation Tests (ISSUE-080)
# ================================
#
# 背景：旧版 chunk 批处理循环 `asyncio.gather(return_exceptions=True)` 误将
# PipelineCancelled 当作普通 chunk 失败吞没，循环继续遍历剩余 batches。叠加
# `maybe_report_chunk_progress` 缺少 cancel 守卫 + `update_build_run` SQL 无状态机
# 守卫，cancelling 信号被 build task 的进度上报反复回写为 running，UI 永远卡住。
#
# 本套测试覆盖修复后的不变量：
# 1. chunk 内抛 PipelineCancelled 必须在 gather 返回后立即 re-raise，不能进入
#    failed_chunk_count 路径，build_graph 终态必须为 cancelled；
# 2. 批次入口的 in-memory cancel 检查必须在下一批 LLM 调用前生效，避免浪费整批
#    chunks 的提取调度；
# 3. `maybe_report_chunk_progress` 必须在 cancel 已 set 时早出，不调用 update_build_run。


@pytest.mark.asyncio
async def test_pipeline_cancelled_in_gather_propagates_to_terminal_cancelled():
    """ISSUE-080 R1：process_chunk 中抛出的 PipelineCancelled 必须穿透 gather
    re-raise，build_graph 终态为 cancelled，而非被静默吞没为 failed_chunk。

    回归保护：旧实现 ``for result in results: if isinstance(result, Exception):
    failed_chunk_count += 1`` 把 PipelineCancelled 也计入失败计数，循环继续遍历
    剩余所有 batches，导致 cancel 信号在 chunk loop 内丢失、UI 永远卡 CANCELLING。
    """
    from negentropy.knowledge.exceptions import PipelineCancelled

    call_count = {"n": 0}

    async def cancelling_extract(*args, **kwargs):
        call_count["n"] += 1
        # 第一次调用即抛 PipelineCancelled；按 batch_size，整批 gather 收到混合异常时
        # 需仍能让外层捕获 cancel 终态。
        raise PipelineCancelled(run_id="test-run", last_stage="extracting")

    FakeExtractorClass = make_fake_extractor_class(cancelling_extract)
    repository = PhaseTrackingFakeRepository()
    service = GraphService(repository=repository, config=GraphBuildConfig())

    chunks = [{"id": f"c{i}", "content": f"text-{i}"} for i in range(4)]

    with (
        patch_build_graph(repository),
        patch(
            "negentropy.knowledge.graph.service.CompositeEntityExtractor",
            FakeExtractorClass,
        ),
        patch(
            "negentropy.knowledge.graph.service.CompositeRelationExtractor",
            FakeExtractorClass,
        ),
    ):
        result = await service.build_graph(corpus_id=uuid4(), app_name="test-app", chunks=chunks)

    assert result.status == "cancelled", (
        f"build_graph 终态必须为 cancelled（PipelineCancelled 必须穿透 gather re-raise），实际={result.status}"
    )
    # cancel 终态写入必须发生
    cancelled_call = next(
        (c for c in reversed(repository.update_calls) if c.get("status") == "cancelled"),
        None,
    )
    assert cancelled_call is not None, "cancel 终态 update_build_run(status='cancelled') 必须被调用"


@pytest.mark.asyncio
async def test_cancel_between_batches_short_circuits_next_batch():
    """ISSUE-080 R2：批次入口的 in-memory cancel 检查必须在下一批 LLM 调用前生效。

    构造：单 chunk 一批，首批正常完成后通过 signal_cancel 触发取消，第二批应被
    批次入口 ``if is_cancelled(run_id): raise PipelineCancelled`` 短路，不再调用
    extractor。
    """
    from negentropy.knowledge.cancellation import (
        _registry_size,
        register_cancellable_run,
        signal_cancel,
    )

    captured_run_ids: list[str] = []

    def capturing_register(run_id: str):
        captured_run_ids.append(run_id)
        return register_cancellable_run(run_id)

    call_count = {"n": 0}

    async def conditional_extract(*args, **kwargs):
        call_count["n"] += 1
        # 第一批的第一个 chunk 完成后立即触发 cancel；下一批不应再被调用。
        if call_count["n"] == 1 and captured_run_ids:
            signal_cancel(captured_run_ids[-1])
        return []  # 返回空实体，避免触发后续 resolver/persistence 路径

    FakeExtractorClass = make_fake_extractor_class(conditional_extract)
    repository = PhaseTrackingFakeRepository()
    # batch_size=1 强制每个 chunk 独立一批；max_concurrency=1 避免 gather 并发干扰断言。
    service = GraphService(
        repository=repository,
        config=GraphBuildConfig(batch_size=1, max_concurrency=1),
    )

    chunks = [{"id": f"c{i}", "content": f"text-{i}"} for i in range(5)]

    initial_registry = _registry_size()
    with (
        patch_build_graph(repository),
        patch(
            "negentropy.knowledge.graph.service.CompositeEntityExtractor",
            FakeExtractorClass,
        ),
        patch(
            "negentropy.knowledge.graph.service.CompositeRelationExtractor",
            FakeExtractorClass,
        ),
        patch(
            "negentropy.knowledge.graph.service.register_cancellable_run",
            side_effect=capturing_register,
        ),
    ):
        result = await service.build_graph(corpus_id=uuid4(), app_name="test-app", chunks=chunks)

    assert result.status == "cancelled", f"build_graph 必须以 cancelled 终态退出，实际={result.status}"
    # 关键不变量：批次入口短路后，extractor 不应被剩余 chunks 调用。
    # entity_extractor 调用 1 次（首批触发 cancel），relation_extractor 也调用 1 次（同一首批），共 ≤ 2 次。
    # 严格断言：≤ 2 << 5（chunks 总数），证明剩余 chunks 未进入 process_chunk。
    assert call_count["n"] <= 2, (
        f"批次入口 in-memory cancel 检查失效——cancel 后仍调用 extractor {call_count['n']} 次（应 ≤ 2）"
    )
    # 注册表必须清理（finally 块的 unregister_cancellable_run 不可回归）
    assert _registry_size() == initial_registry, "cancellation registry 必须在 build_graph 结束后清理"


@pytest.mark.asyncio
async def test_maybe_report_chunk_progress_skips_when_cancelled():
    """ISSUE-080 R3：cancel 已 set 后，chunk 进度上报必须早出，不再发起
    ``update_build_run(status='running', ...)`` 调用——否则原 SQL 守卫修复前会
    把 cancelling 回写为 running（即便修复后 SQL 守卫拒之，多余的调用也是噪音）。

    构造：batch_size=2、chunks=4（两批），首批完成后触发 cancel；统计 cancel 后
    再发出的 ``update_build_run(status='running')`` 调用应为 0。
    """
    from negentropy.knowledge.cancellation import register_cancellable_run, signal_cancel

    captured_run_ids: list[str] = []

    def capturing_register(run_id: str):
        captured_run_ids.append(run_id)
        return register_cancellable_run(run_id)

    cancel_triggered = {"after_call": 2}  # 第二次 extract 调用后触发（首批 2 chunks 完成）
    call_count = {"n": 0}

    async def conditional_extract(*args, **kwargs):
        call_count["n"] += 1
        if call_count["n"] == cancel_triggered["after_call"] and captured_run_ids:
            signal_cancel(captured_run_ids[-1])
        return []

    FakeExtractorClass = make_fake_extractor_class(conditional_extract)
    repository = PhaseTrackingFakeRepository()
    service = GraphService(
        repository=repository,
        config=GraphBuildConfig(batch_size=2, max_concurrency=2),
    )

    chunks = [{"id": f"c{i}", "content": f"text-{i}"} for i in range(4)]

    with (
        patch_build_graph(repository),
        patch(
            "negentropy.knowledge.graph.service.CompositeEntityExtractor",
            FakeExtractorClass,
        ),
        patch(
            "negentropy.knowledge.graph.service.CompositeRelationExtractor",
            FakeExtractorClass,
        ),
        patch(
            "negentropy.knowledge.graph.service.register_cancellable_run",
            side_effect=capturing_register,
        ),
    ):
        result = await service.build_graph(corpus_id=uuid4(), app_name="test-app", chunks=chunks)

    assert result.status == "cancelled"
    # 取出 chunk 节流上报的 running 调用：维度 = (status='running' AND progress 单字段更新)。
    # emit_phase 也会写 status='running' 但带 warnings；maybe_report_chunk_progress 只传 progress。
    chunk_progress_running_calls = [
        c for c in repository.update_calls if c.get("status") == "running" and "warnings" not in c
    ]
    # 首批完成后触发 cancel；理论上 maybe_report_chunk_progress 节流间隔 10s 也可能不触发首次上报。
    # 关键不变量：cancel 后绝无第二次进度上报（即便有首次，count 也 ≤ 1）。
    assert len(chunk_progress_running_calls) <= 1, (
        f"cancel 后 maybe_report_chunk_progress 不应再发起 update_build_run，"
        f"实际节流上报 {len(chunk_progress_running_calls)} 次"
    )
