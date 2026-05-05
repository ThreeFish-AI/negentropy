"""PII 治理（Phase 5 F4）：双引擎抽象 + 三策略写入 + 检索守门员。

向后兼容：
- ``engine/governance/pii_detector.py`` 保持 thin re-export，原 import 路径不变；
- 现有 regex 检测器迁入本目录 ``regex_detector.py``，类型/字段/Luhn 校验保持一致；
- ``factory.py`` 按 ``settings.memory.pii.engine`` 选择 RegexPIIDetector / PresidioPIIDetector；
- Presidio 作为 ``[project.optional-dependencies] pii-presidio`` 可选依赖，导入失败 fallback。

参考文献：
[1] NIST SP 800-122, Apr. 2010 — PII Confidentiality.
[2] GDPR Articles 17 & 25, OJEU L 119, 2016 — Right to erasure / Data protection by design.
[3] O. Mendels et al., "Microsoft Presidio," <https://microsoft.github.io/presidio/>.
"""

from .base import PIIDetectorBase, PIISpan, apply_policy
from .factory import get_pii_detector, reset_pii_detector
from .gatekeeper import PIIGatekeeper
from .regex_detector import RegexPIIDetector

__all__ = [
    "PIIDetectorBase",
    "PIISpan",
    "apply_policy",
    "RegexPIIDetector",
    "PIIGatekeeper",
    "get_pii_detector",
    "reset_pii_detector",
]
