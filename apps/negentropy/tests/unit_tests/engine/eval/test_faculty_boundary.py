"""eval 元层 Faculty 边界反向断言（WS2）。

eval/runner（评测执行器）与 attack_generator（红队）是「元层」——用系统自身当 Judge/攻击者
去评测/攻击被测 target。刻意**不接 FacultyBridge**：走六翼会造成循环偏置（元神评判修改元神
自己的提案）、破坏 holdout 独立性、且多轮 tool-loop 结构与单发 Faculty 范式不兼容。

本测试固化该边界：断言这两个模块的命名空间**未导入** FacultyBridge 相关符号，防止未来
「顺手补齐」引入循环偏置。
"""

from __future__ import annotations

import negentropy.engine.eval.attack_generator as attack_mod
import negentropy.engine.eval.runner as runner_mod

# 禁止 eval 元层导入的 FacultyBridge 符号（任一出现即破坏评测独立性）。
_FORBIDDEN_ATTRS = ("run_faculty_json", "run_faculty", "run_with_fallback", "faculty_bridge")


def test_eval_runner_namespace_excludes_faculty_bridge():
    for attr in _FORBIDDEN_ATTRS:
        assert not hasattr(runner_mod, attr), (
            f"eval/runner 不得导入 FacultyBridge 符号 {attr!r}（评测元层须保持独立，防循环偏置）"
        )


def test_attack_generator_namespace_excludes_faculty_bridge():
    for attr in _FORBIDDEN_ATTRS:
        assert not hasattr(attack_mod, attr), (
            f"attack_generator 不得导入 FacultyBridge 符号 {attr!r}（红队元层须保持独立）"
        )
