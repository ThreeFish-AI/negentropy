"""
去重检测逻辑单元测试

测试两阶段去重策略的纯逻辑：
1. Cosine similarity ≥ 0.85 → 直接判定重复
2. Cosine similarity ∈ [0.80, 0.85) + Jaccard ≥ 0.7 → 判定重复

参考文献:
[37] A. Broder, "On the resemblance and containment of documents,"
     *Proc. Compression and Complexity of Sequences*, pp. 21-29, 1997.
[40] M. Henzinger, "Finding near-duplicate web pages: a large-scale evaluation,"
     *Proc. 29th SIGIR*, pp. 284-291, 2006.
"""

from __future__ import annotations

import pytest

# ---------------------------------------------------------------------------
# 从 PostgresMemoryService._check_duplicate 提取的纯逻辑函数
# ---------------------------------------------------------------------------


def check_dedup_logic(
    similarity: float,
    jaccard: float,
    cosine_threshold: float = 0.85,
    jaccard_threshold: float = 0.7,
) -> bool:
    """两阶段去重判断（无 DB 依赖的纯逻辑）

    1. similarity >= cosine_threshold → True
    2. similarity >= 0.80 且 jaccard >= jaccard_threshold → True
    """
    if similarity >= cosine_threshold:
        return True
    if similarity >= 0.80 and jaccard >= jaccard_threshold:
        return True
    return False


def compute_jaccard(text_a: str, text_b: str) -> float:
    """计算两段文本的 Jaccard 词重叠系数"""
    words_a = set(text_a.lower().split())
    words_b = set(text_b.lower().split())
    if not words_a or not words_b:
        return 0.0
    return len(words_a & words_b) / len(words_a | words_b)


# ===================================================================
# 1. Cosine Similarity 阶段
# ===================================================================


class TestCosineThreshold:
    """Cosine similarity 阈值判定"""

    def test_similarity_above_085_is_duplicate(self) -> None:
        """similarity >= 0.85 → 始终判定重复"""
        assert check_dedup_logic(similarity=0.85, jaccard=0.0) is True
        assert check_dedup_logic(similarity=0.90, jaccard=0.0) is True
        assert check_dedup_logic(similarity=1.0, jaccard=0.0) is True

    def test_similarity_below_080_not_duplicate(self) -> None:
        """similarity < 0.80 → 不重复（不考虑 Jaccard）"""
        assert check_dedup_logic(similarity=0.79, jaccard=1.0) is False
        assert check_dedup_logic(similarity=0.50, jaccard=1.0) is False
        assert check_dedup_logic(similarity=0.0, jaccard=1.0) is False

    def test_similarity_exactly_085(self) -> None:
        """边界值 0.85 刚好判定为重复"""
        assert check_dedup_logic(similarity=0.85, jaccard=0.0) is True

    def test_similarity_08499_not_duplicate_alone(self) -> None:
        """0.8499 低于阈值，需要 Jaccard 二次校验"""
        assert check_dedup_logic(similarity=0.8499, jaccard=0.0) is False


# ===================================================================
# 2. Jaccard 二次校验阶段
# ===================================================================


class TestJaccardSecondaryCheck:
    """Cosine ∈ [0.80, 0.85) + Jaccard 二次校验"""

    def test_medium_similarity_high_jaccard_is_duplicate(self) -> None:
        """similarity ∈ [0.80, 0.85) + jaccard >= 0.7 → 重复"""
        assert check_dedup_logic(similarity=0.82, jaccard=0.7) is True
        assert check_dedup_logic(similarity=0.80, jaccard=0.7) is True
        assert check_dedup_logic(similarity=0.84, jaccard=0.8) is True

    def test_medium_similarity_low_jaccard_not_duplicate(self) -> None:
        """similarity ∈ [0.80, 0.85) + jaccard < 0.7 → 不重复"""
        assert check_dedup_logic(similarity=0.82, jaccard=0.69) is False
        assert check_dedup_logic(similarity=0.80, jaccard=0.5) is False
        assert check_dedup_logic(similarity=0.84, jaccard=0.0) is False

    def test_jaccard_threshold_boundary(self) -> None:
        """jaccard 刚好 0.7 时判定为重复"""
        assert check_dedup_logic(similarity=0.82, jaccard=0.70) is True

    def test_jaccard_just_below_threshold(self) -> None:
        """jaccard 0.699 不满足阈值"""
        assert check_dedup_logic(similarity=0.82, jaccard=0.699) is False


# ===================================================================
# 3. Jaccard 计算
# ===================================================================


class TestJaccardComputation:
    """compute_jaccard 文本相似度计算"""

    def test_exact_same_text_jaccard_one(self) -> None:
        """完全相同的文本 → Jaccard = 1.0"""
        text = "the user prefers dark mode in the application"
        assert compute_jaccard(text, text) == 1.0

    def test_completely_different_text_jaccard_near_zero(self) -> None:
        """完全不同的文本 → Jaccard = 0.0"""
        text_a = "alpha beta gamma"
        text_b = "delta epsilon zeta"
        assert compute_jaccard(text_a, text_b) == 0.0

    def test_empty_text_jaccard_zero(self) -> None:
        """空文本 → Jaccard = 0.0"""
        assert compute_jaccard("", "hello world") == 0.0
        assert compute_jaccard("hello world", "") == 0.0
        assert compute_jaccard("", "") == 0.0

    def test_one_word_overlap(self) -> None:
        """仅一个词重叠 → Jaccard 很低"""
        text_a = "the user likes dark mode"
        text_b = "the system runs dark theme"
        # intersection: {"the", "dark"} → 2 words
        # union: {"the", "user", "likes", "dark", "mode", "system", "runs", "theme"} → 8 words
        j = compute_jaccard(text_a, text_b)
        assert j == 2 / 8
        assert j < 0.7  # 不足以触发 Jaccard 阈值

    def test_case_insensitive(self) -> None:
        """Jaccard 计算不区分大小写"""
        text_a = "Hello World Python"
        text_b = "hello world python"
        assert compute_jaccard(text_a, text_b) == 1.0

    def test_subset_text(self) -> None:
        """子集文本的 Jaccard"""
        text_a = "hello world"
        text_b = "hello world python"
        # intersection: {"hello", "world"} → 2
        # union: {"hello", "world", "python"} → 3
        assert compute_jaccard(text_a, text_b) == pytest.approx(2 / 3, abs=0.01)

    def test_partial_overlap_moderate_jaccard(self) -> None:
        """部分重叠产生中等 Jaccard"""
        text_a = "user prefers dark mode and light theme"
        text_b = "user prefers light mode and dark theme"
        # 两个集合相同（same words），Jaccard = 1.0
        assert compute_jaccard(text_a, text_b) == 1.0

    def test_single_word_identical(self) -> None:
        """单词完全相同 → Jaccard = 1.0"""
        assert compute_jaccard("hello", "hello") == 1.0

    def test_single_word_different(self) -> None:
        """单词不同 → Jaccard = 0.0"""
        assert compute_jaccard("hello", "world") == 0.0

    def test_whitespace_only_text_jaccard_zero(self) -> None:
        """纯空白文本 → Jaccard = 0.0（split 后为空集）"""
        assert compute_jaccard("   ", "hello") == 0.0
        assert compute_jaccard("hello", "   ") == 0.0


# ===================================================================
# 4. 综合边界场景
# ===================================================================


class TestDedupEdgeCases:
    """去重判定综合边界测试"""

    def test_threshold_boundary_0_8499(self) -> None:
        """0.8499 + jaccard=0.7 → 重复（>= 0.80 区间 + Jaccard 达标）"""
        assert check_dedup_logic(similarity=0.8499, jaccard=0.7) is True

    def test_threshold_boundary_0_85_exact(self) -> None:
        """0.85 精确命中 cosine 阈值，无需 Jaccard"""
        assert check_dedup_logic(similarity=0.85, jaccard=0.0) is True

    def test_similarity_exactly_080(self) -> None:
        """0.80 精确进入 Jaccard 校验区间"""
        assert check_dedup_logic(similarity=0.80, jaccard=0.7) is True
        assert check_dedup_logic(similarity=0.80, jaccard=0.69) is False

    def test_similarity_0799_not_in_jaccard_range(self) -> None:
        """0.799 不在 Jaccard 校验区间"""
        assert check_dedup_logic(similarity=0.799, jaccard=1.0) is False

    def test_zero_similarity_zero_jaccard(self) -> None:
        """全零输入 → 不重复"""
        assert check_dedup_logic(similarity=0.0, jaccard=0.0) is False

    def test_negative_similarity(self) -> None:
        """负 similarity（理论上不应出现）→ 不重复"""
        assert check_dedup_logic(similarity=-0.5, jaccard=0.9) is False

    def test_custom_thresholds(self) -> None:
        """自定义阈值生效"""
        # 降低 cosine 阈值到 0.80
        assert check_dedup_logic(similarity=0.82, jaccard=0.0, cosine_threshold=0.80) is True
        # 提高 Jaccard 阈值到 0.9
        assert check_dedup_logic(similarity=0.82, jaccard=0.8, jaccard_threshold=0.9) is False
        assert check_dedup_logic(similarity=0.82, jaccard=0.9, jaccard_threshold=0.9) is True

    def test_end_to_end_duplicate_detection(self) -> None:
        """端到端：两段高度相似的文本被正确判定为重复"""
        text_a = "The user prefers dark mode in the application settings"
        text_b = "The user prefers dark mode in the application settings"
        # 完全相同 → Jaccard = 1.0
        j = compute_jaccard(text_a, text_b)
        assert j == 1.0
        # 模拟高 similarity
        assert check_dedup_logic(similarity=0.95, jaccard=j) is True

    def test_end_to_end_not_duplicate(self) -> None:
        """端到端：两段不同文本不被判定为重复"""
        text_a = "The user prefers dark mode in the application"
        text_b = "System maintenance scheduled for next Tuesday"
        j = compute_jaccard(text_a, text_b)
        assert j == 0.0
        assert check_dedup_logic(similarity=0.30, jaccard=j) is False
