"""反事实归因 influence_label 纯函数单测（综述 §8 Counterfactual Trace Auditing）。"""

from __future__ import annotations

from negentropy.engine.eval.attribution import (
    ATTRIBUTION_NEUTRAL_BAND,
    influence_label,
)


def test_neutral_within_band():
    assert influence_label(score_delta=0.0) == "neutral"
    assert influence_label(score_delta=2.9) == "neutral"
    assert influence_label(score_delta=-2.9) == "neutral"


def test_positive_above_band():
    assert influence_label(score_delta=ATTRIBUTION_NEUTRAL_BAND) == "positive"  # 边界：|Δ| not < band
    assert influence_label(score_delta=10.0) == "positive"


def test_negative_below_band():
    assert influence_label(score_delta=-ATTRIBUTION_NEUTRAL_BAND) == "negative"
    assert influence_label(score_delta=-10.0) == "negative"


def test_custom_neutral_band():
    assert influence_label(score_delta=5.0, neutral_band=10.0) == "neutral"
    assert influence_label(score_delta=5.0, neutral_band=2.0) == "positive"
