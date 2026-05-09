"""一次性运维脚本（操作型 CLI）。

与主 ``cli.py`` 区分：``cli.py`` 是常驻 CLI 入口（serve / init），本包下的工具
是一次性数据清算 / 修复脚本，通过 ``python -m negentropy.scripts.<tool>`` 运行。
"""
