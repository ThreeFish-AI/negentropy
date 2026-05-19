"""单元测试配置 — 2 分钟超时保护。

通过 pytestmark 为 tests/unit/ 下所有测试设置 120 秒超时。
pytest-timeout 在 Unix 上使用 signal 方法（SIGALRM），可中断阻塞调用并终止测试进程。
若个别测试需豁免，使用 @pytest.mark.timeout(0) 禁用超时。
"""

import pytest

pytestmark = pytest.mark.timeout(120)
