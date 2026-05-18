"""Adaptive Engine Selector — 基于文档画像的 Stage 路由策略。

设计目标
========

把 :class:`pipeline.models._pdf.DocumentCharacteristics`（由 ``quick_scan``
Stage 产出）从「死字段」激活为「路由信号」，对每个并行 Stage 的
``tool_configs`` 进行**动态重排**或**短路跳过**，进一步降低无效计算：

- 扫描版 PDF：``text_extraction`` 路径优先 Marker / Docling 而非 PyMuPDF。
- 小文档（<5 页且非扫描）：``layout_analysis`` 跳过 Docling 10s 冷启动，直接走
  PyMuPDF 兜底。
- 无表格/公式/代码/图片：对应 Stage **整体跳过**，返回带 metadata
  ``selector_decision="skipped:no_<feature>"`` 的成功空结果。

设计模式
========

采用 Strategy Pattern：
    - :class:`EngineSelector` 协议定义 ``reorder_tools`` 接口；
    - :class:`IdentitySelector` 保留 YAML 顺序，向后兼容；
    - :class:`ProfileAwareSelector` 实现完整规则集；
    - :func:`build_selector` 根据 ``settings.pipeline_engine_selector`` 工厂构造。

观测性
======

- 每条决策返回 :class:`SelectionDecision`，包含原 tools / 新 tools / skip 标志
  / 决策原因（字符串），由 orchestrator 写入 ``StageResult.metadata``。
- 规则保守：未识别的特征落到 YAML 默认，绝不引入 worse-than-baseline 退化。

References:
    [1] Strategy Pattern, Gang of Four 1994.
    [2] negentropy-perceives plan: PR2 章节
       ``.claude/plans/system-instruction-you-are-working-federated-snowglobe.md``
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Protocol

from .models import DocumentCharacteristics


@dataclass(frozen=True)
class SelectionDecision:
    """单 Stage 路由决策结果。

    Attributes:
        tools: 重排后（或原样）的 tool_configs；当 ``skip=True`` 时**忽略**。
        skip: 是否跳过整个 Stage。``True`` 时 orchestrator 应返回带 metadata
            ``engine_used="skipped:<reason>"`` 的成功空结果。
        reason: 决策原因短语（如 ``"profile:no_tables"`` /
            ``"profile:scanned"``），用于写入 metadata 便于审计。
    """

    tools: List[Dict[str, Any]] = field(default_factory=list)
    skip: bool = False
    reason: str = ""


@dataclass(frozen=True)
class SelectionContext:
    """传给 Selector 的运行时上下文。

    Attributes:
        characteristics: 来自 ``quick_scan`` 的 DocumentCharacteristics；
            ``None`` 表示 quick_scan 未执行/失败，selector 必须**保守**回退默认。
        device: 通过 ``hardware/detection.get_device_for_docling`` 解析得到的
            设备字符串（``"cpu"`` / ``"mps"`` / ``"cuda"`` / ``"xpu"``）。该解析
            会优先尊重 ``settings.accelerator_device`` /
            ``NEGENTROPY_PERCEIVES_ACCELERATOR_DEVICE`` 与 ``force_cpu`` 开关,
            未指定时回落到 ``detect_device()`` 自动探测。值统一为小写字符串,
            避免 ``str``-mixin Enum 在 Python 3.13 上 ``__str__`` 返回
            ``'DeviceType.MPS'`` 这类陷阱。``None`` 表示设备未知, selector 应
            保守走 YAML 默认。
    """

    characteristics: Optional[DocumentCharacteristics] = None
    device: Optional[str] = None


class EngineSelector(Protocol):
    """Stage 路由策略协议。"""

    def select(
        self,
        stage_name: str,
        default_tools: List[Dict[str, Any]],
        ctx: SelectionContext,
    ) -> SelectionDecision:
        """对单个 Stage 的 tools 执行决策。

        Args:
            stage_name: Stage 名称（如 ``"text_extraction"``）。
            default_tools: YAML 中声明的 tool_configs（已应用 engine_gates）。
            ctx: SelectionContext，含 characteristics + device。

        Returns:
            SelectionDecision：重排后的 tools 或 skip 标志。
        """
        ...


# ---------------------------------------------------------------------------
# Identity（保持 YAML 顺序）
# ---------------------------------------------------------------------------


class IdentitySelector:
    """直通策略：保持 YAML 顺序，不重排不跳过。

    用作默认/兼容路径，便于通过单一开关回退到 PR2 之前的行为。
    """

    def select(
        self,
        stage_name: str,
        default_tools: List[Dict[str, Any]],
        ctx: SelectionContext,
    ) -> SelectionDecision:
        return SelectionDecision(
            tools=list(default_tools), skip=False, reason="identity"
        )


# ---------------------------------------------------------------------------
# Profile-Aware（基于 DocumentCharacteristics 路由）
# ---------------------------------------------------------------------------


class ProfileAwareSelector:
    """基于 DocumentCharacteristics 的动态路由策略。

    规则集（保守、可审计）:
        - ``text_extraction``：扫描版 → 优先 marker/docling；
          小文档（<5 页非扫描） → 仅 pymupdf 快路径。
        - ``layout_analysis``：非复杂布局且 <5 页 → 仅 pymupdf。
        - ``table_extraction`` / ``formula_extraction`` /
          ``image_extraction`` / ``code_detection``：对应特征 False →
          **跳过整个 Stage**。
        - 其他 Stage / 缺失 characteristics → IdentitySelector 行为。
    """

    # 单一来源：哪些特征 False 时对应 Stage 应该跳过。
    SKIPPABLE_STAGES_BY_FEATURE: Dict[str, str] = {
        # stage_name -> characteristics 字段名
        "table_extraction": "has_tables",
        "formula_extraction": "has_formulas",
        "code_detection": "has_code_blocks",
        "image_extraction": "has_images",
    }

    # 小文档阈值（页数 < 此值且非扫描时启用快路径）
    SMALL_DOC_PAGE_THRESHOLD: int = 5

    def select(
        self,
        stage_name: str,
        default_tools: List[Dict[str, Any]],
        ctx: SelectionContext,
    ) -> SelectionDecision:
        chars = ctx.characteristics

        # 缺失 characteristics：保守回退（YAML 默认）。
        if chars is None:
            return SelectionDecision(
                tools=list(default_tools),
                skip=False,
                reason="profile:missing_characteristics",
            )

        # 规则 1：可跳过的特征驱动型 Stage（带 complex_layout 保护性兜底）
        feature_attr = self.SKIPPABLE_STAGES_BY_FEATURE.get(stage_name)
        if feature_attr is not None:
            has_feature = bool(getattr(chars, feature_attr, True))
            if not has_feature:
                # 保护: complex_layout 文档不应因 quick_scan 启发式误判而跳过
                # table/formula/code stage。PR #163 + #164 矩阵实测显示, Context
                # Engineering 2.0 这类「数字版 + 多种富内容」PDF 上, quick_scan
                # 偶有漏报 (例如 native find_tables 在某些 PDF 上零命中却确实有
                # 表格)。complex_layout=True 是更鲁棒的"文档非简单"信号 (来自多个
                # 启发式的 OR 组合), 此时让 stage 走 YAML 默认顺序而非短路跳过,
                # 即便实际无该元素 stage 也仅多花 ~5s 但能避免 word_count 丢失。
                if stage_name in ("table_extraction", "code_detection") and getattr(
                    chars, "has_complex_layout", False
                ):
                    return SelectionDecision(
                        tools=list(default_tools),
                        skip=False,
                        reason=f"profile:no_{feature_attr}_but_complex_layout",
                    )
                return SelectionDecision(
                    tools=[],
                    skip=True,
                    reason=f"profile:no_{feature_attr}",
                )

        # 规则 2：text_extraction 路由
        if stage_name == "text_extraction":
            return self._select_text_extraction(default_tools, chars)

        # 规则 3：layout_analysis 小文档快路径
        if stage_name == "layout_analysis":
            return self._select_layout_analysis(default_tools, chars)

        # 规则 4: formula_extraction 按设备路由 (PR #164: device 信号激活)
        if stage_name == "formula_extraction":
            return self._select_formula_extraction(default_tools, chars, ctx.device)

        # 规则 5: table_extraction 按文档画像路由
        if stage_name == "table_extraction":
            return self._select_table_extraction(default_tools, chars)

        # 规则 6: code_detection 按 mlx_vlm 可用性路由 (与 DoclingCodeDetector 对齐)
        if stage_name == "code_detection":
            return self._select_code_detection(default_tools, chars, ctx.device)

        # 默认：YAML 顺序
        return SelectionDecision(
            tools=list(default_tools),
            skip=False,
            reason="profile:default",
        )

    # ------------------------------------------------------------------
    # 子规则
    # ------------------------------------------------------------------

    def _select_text_extraction(
        self,
        default_tools: List[Dict[str, Any]],
        chars: DocumentCharacteristics,
    ) -> SelectionDecision:
        """text_extraction 路由：
        - 扫描版 → marker / docling / opendataloader / pymupdf / pypdf；
        - 非扫描 + 小文档 → 仅 pymupdf；
        - 默认 → YAML 顺序。
        """
        if chars.is_scanned:
            preferred_order = [
                "marker",
                "docling",
                "opendataloader",
                "pymupdf",
                "pypdf",
            ]
            reordered = _reorder_by_name(default_tools, preferred_order)
            return SelectionDecision(
                tools=reordered, skip=False, reason="profile:scanned"
            )

        if chars.page_count and chars.page_count < self.SMALL_DOC_PAGE_THRESHOLD:
            fast_path = _filter_by_names(default_tools, {"pymupdf"})
            if fast_path:
                return SelectionDecision(
                    tools=fast_path,
                    skip=False,
                    reason=f"profile:small_doc_{chars.page_count}p",
                )

        return SelectionDecision(
            tools=list(default_tools),
            skip=False,
            reason="profile:default",
        )

    def _select_formula_extraction(
        self,
        default_tools: List[Dict[str, Any]],
        chars: DocumentCharacteristics,
        device: Optional[str],
    ) -> SelectionDecision:
        """formula_extraction 路由 (PR #164):

        矩阵实测 (Context Engineering 2.0, M4): docling formula_extraction
        在 mps 路径耗时 87-104s, 占总耗时 ~70-78%, 是端到端最大瓶颈。
        MinerU ``vlm-auto-engine`` 在 Apple Silicon 上命中 ``mlx-engine``,
        据上游 changelog 加速 100-200%。当 device 是 mps 时优先 mineru,
        非 mps (cpu/cuda) 时维持 YAML 默认 (docling Granite formula 路径稳定)。

        References:
            [1] OpenDataLab MinerU changelog: "vlm-mlx-engine 100-200% speedup
                vs transformers", accessed 2026-05-17.
        """
        device_norm = (device or "").lower()
        if device_norm == "mps":
            preferred_order = ["mineru", "docling", "marker"]
            reordered = _reorder_by_name(default_tools, preferred_order)
            if reordered and reordered[0].get("name") == "mineru":
                return SelectionDecision(
                    tools=reordered,
                    skip=False,
                    reason="profile:formula_mps_mineru",
                )

        return SelectionDecision(
            tools=list(default_tools),
            skip=False,
            reason="profile:formula_default",
        )

    def _select_table_extraction(
        self,
        default_tools: List[Dict[str, Any]],
        chars: DocumentCharacteristics,
    ) -> SelectionDecision:
        """table_extraction 路由 (PR #164):

        矩阵实测 (Context Engineering 2.0): docling TableFormer 5.0-5.5s
        提取 3 个表格, 是数字版 + 复杂布局 PDF 的最佳路径。维持 YAML
        默认顺序 (docling rank=1), 仅显式标注 reason 便于审计。复杂布局
        + 已确认有表格时不重排, 让 scheduler 走 YAML 顺序。
        """
        if getattr(chars, "has_complex_layout", False):
            return SelectionDecision(
                tools=list(default_tools),
                skip=False,
                reason="profile:table_complex_docling",
            )
        return SelectionDecision(
            tools=list(default_tools),
            skip=False,
            reason="profile:table_default",
        )

    def _select_code_detection(
        self,
        default_tools: List[Dict[str, Any]],
        chars: DocumentCharacteristics,
        device: Optional[str],
    ) -> SelectionDecision:
        """code_detection 路由 (PR #164, 与 DoclingCodeDetector 对齐):

        当 device=mps 且 mlx_vlm 不可用时, docling 的 code enrichment 会被
        ``_configure_mps_code_formula_options`` 静默禁用 (避免 pipeline 退回
        CPU)。此时把 docling 从 code_detection 候选中前置过滤, 省去 docling
        10s 冷启动并直接走 algorithm_detector (启发式扫描, CPU-only)。

        DoclingCodeDetector 的 ``_run`` 也做了 early-return 兜底 (PR #164
        commit 52b9379), 双重防护避免静默漏检。
        """
        device_norm = (device or "").lower()
        if device_norm == "mps":
            from importlib.util import find_spec

            if find_spec("mlx_vlm") is None:
                filtered = [t for t in default_tools if t.get("name") != "docling"]
                if filtered:
                    return SelectionDecision(
                        tools=filtered,
                        skip=False,
                        reason="profile:code_mps_no_mlx_vlm_skip_docling",
                    )

        return SelectionDecision(
            tools=list(default_tools),
            skip=False,
            reason="profile:code_default",
        )

    def _select_layout_analysis(
        self,
        default_tools: List[Dict[str, Any]],
        chars: DocumentCharacteristics,
    ) -> SelectionDecision:
        """layout_analysis 路由：
        - 非复杂布局 + 小文档 + 非扫描 → 仅 pymupdf（跳过 docling 10s 冷启动）；
        - 默认 → YAML 顺序。
        """
        if (
            not chars.has_complex_layout
            and not chars.is_scanned
            and chars.page_count
            and chars.page_count < self.SMALL_DOC_PAGE_THRESHOLD
        ):
            fast_path = _filter_by_names(default_tools, {"pymupdf"})
            if fast_path:
                return SelectionDecision(
                    tools=fast_path,
                    skip=False,
                    reason=f"profile:simple_layout_{chars.page_count}p",
                )

        return SelectionDecision(
            tools=list(default_tools),
            skip=False,
            reason="profile:default",
        )


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------


def _reorder_by_name(
    tools: List[Dict[str, Any]],
    preferred_order: List[str],
) -> List[Dict[str, Any]]:
    """根据偏好顺序重排 tools；缺失的 tool 按原顺序追加在末尾。"""
    name_to_tool: Dict[str, Dict[str, Any]] = {}
    for tool in tools:
        name = tool.get("name", "")
        if name and name not in name_to_tool:
            name_to_tool[name] = tool

    reordered: List[Dict[str, Any]] = []
    placed: set[str] = set()
    for name in preferred_order:
        if name in name_to_tool:
            reordered.append(name_to_tool[name])
            placed.add(name)

    # 追加 YAML 中存在但未列入 preferred_order 的 tool
    for tool in tools:
        name = tool.get("name", "")
        if name and name not in placed:
            reordered.append(tool)

    return reordered


def _filter_by_names(
    tools: List[Dict[str, Any]],
    keep_names: set[str],
) -> List[Dict[str, Any]]:
    """仅保留指定名称的 tool，顺序按 YAML。"""
    return [t for t in tools if t.get("name", "") in keep_names]


# ---------------------------------------------------------------------------
# 工厂
# ---------------------------------------------------------------------------


def build_selector(policy: Optional[str] = None) -> EngineSelector:
    """根据策略字符串构造 EngineSelector。

    Args:
        policy: ``"identity"`` / ``"profile_aware"`` / ``None``（读 settings 默认）。

    Returns:
        EngineSelector 实例。
    """
    if policy is None:
        try:
            from ..config import settings

            policy = str(
                getattr(settings, "pipeline_engine_selector", "profile_aware")
            ).lower()
        except (ImportError, AttributeError):
            policy = "profile_aware"

    if policy == "identity":
        return IdentitySelector()
    return ProfileAwareSelector()
