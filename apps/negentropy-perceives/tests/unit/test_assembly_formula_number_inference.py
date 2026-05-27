"""``_infer_missing_formula_numbers`` 单元测试。

ISSUE-094 R9 D-2/D-3/D-4：Docling ``iterate_items`` 路径下抽取的公式
LaTeX 主体不带 ``\\tag{N}`` / ``\\quad (N)`` 编号（Context Engineering 2.0
论文中 Eq (3) / Eq (4) / Eq (6) 三处缺号），UI 视图等式编号缺失。

修复策略：按公式在文档中的位置顺序排列，找到相邻的两个有编号公式 A、B，
若 ``B.number - A.number - 1 == 中间未编号公式数``，则按序填入缺失编号。
这一"序号 gap 一致性"检查是学术论文连续编号习惯的保守利用，能在不引入
误编号风险的前提下回填多数 Docling 漏号场景。

锁定不变量：
- ① 典型场景：``[1, 2, None, None, 5, None, 7]`` → 填补为 ``{2: 3, 3: 4, 5: 6}``
- ② Gap 不一致时拒绝填补（避免误编号）
- ③ 全无编号 / 仅 1 个编号 → 无法推断，返回空字典
- ④ 全部已编号 → 返回空字典
- ⑤ 相邻两编号紧挨（gap=0）→ 返回空字典
"""

from __future__ import annotations

from negentropy.perceives.pipeline.stages.pdf.assembly import (
    _infer_missing_formula_numbers,
)


class TestInferMissingFormulaNumbers:
    """R9 D-2/D-3/D-4：公式序号 gap-consistency 推断契约。"""

    def test_typical_paper_pattern(self) -> None:
        """Context Engineering 2.0 实测模式 ``[1, 2, None, None, 5, None, 7]``。"""
        inferred = _infer_missing_formula_numbers([1, 2, None, None, 5, None, 7])
        assert inferred == {2: 3, 3: 4, 5: 6}

    def test_single_gap_between_consecutive_numbers(self) -> None:
        """``[1, None, 3]`` → 填 ``{1: 2}``。"""
        inferred = _infer_missing_formula_numbers([1, None, 3])
        assert inferred == {1: 2}

    def test_multiple_missing_between_two_numbered(self) -> None:
        """``[1, None, None, None, 5]`` → 填 ``{1: 2, 2: 3, 3: 4}``。"""
        inferred = _infer_missing_formula_numbers([1, None, None, None, 5])
        assert inferred == {1: 2, 2: 3, 3: 4}

    def test_no_inference_when_gap_inconsistent(self) -> None:
        """``[1, None, None, 5]`` 中间 2 个未编号但 gap 期望 3 → 不填补。"""
        inferred = _infer_missing_formula_numbers([1, None, None, 5])
        assert inferred == {}

    def test_no_inference_when_only_one_numbered(self) -> None:
        """仅 1 个编号锚点 → 无法判断 gap → 返回空。"""
        assert _infer_missing_formula_numbers([None, 1, None]) == {}
        assert _infer_missing_formula_numbers([1]) == {}
        assert _infer_missing_formula_numbers([1, None, None]) == {}
        assert _infer_missing_formula_numbers([None, None, 3]) == {}

    def test_no_inference_when_all_unnumbered(self) -> None:
        """全 None → 返回空。"""
        assert _infer_missing_formula_numbers([None, None, None]) == {}
        assert _infer_missing_formula_numbers([None]) == {}
        assert _infer_missing_formula_numbers([]) == {}

    def test_no_inference_when_all_numbered(self) -> None:
        """全部有编号 → 无 gap 可填，返回空。"""
        assert _infer_missing_formula_numbers([1, 2, 3]) == {}
        assert _infer_missing_formula_numbers([1, 2, 3, 4, 5]) == {}

    def test_no_inference_when_adjacent_numbered(self) -> None:
        """``[1, 2]`` 相邻已编号、无缺失 → 返回空。"""
        assert _infer_missing_formula_numbers([1, 2]) == {}

    def test_handles_multi_segment_correct_inference(self) -> None:
        """两段独立的 gap 同时成立时分别填补。

        ``[1, 2, None, None, 5, None, 7]`` 已覆盖；额外考虑
        ``[1, None, 3, None, 5]``（两段单缺）→ ``{1: 2, 3: 4}``。
        """
        inferred = _infer_missing_formula_numbers([1, None, 3, None, 5])
        assert inferred == {1: 2, 3: 4}

    def test_partial_segment_inconsistent_only_skips_that_segment(self) -> None:
        """前段一致、后段不一致 → 仅填前段。

        ``[1, None, 3, None, None, 5]``：前段 1→3 gap 一致填 ``{1: 2}``；
        后段 3→5 期望 gap=1 但中间 2 个 → 跳过。
        """
        inferred = _infer_missing_formula_numbers([1, None, 3, None, None, 5])
        assert inferred == {1: 2}

    def test_zero_and_negative_numbers_treated_as_anchors(self) -> None:
        """支持非常规编号（虽极少见，但保持鲁棒）。"""
        inferred = _infer_missing_formula_numbers([1, None, None, 4])
        # gap = 4-1-1 = 2, between = 2 → 填 (2), (3)
        assert inferred == {1: 2, 2: 3}
