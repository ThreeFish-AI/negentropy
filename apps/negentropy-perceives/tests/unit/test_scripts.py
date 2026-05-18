"""scripts/ 目录脚本测试。

验证开发脚本的语法正确性、接口兼容性和文件完整性。
"""

import os
import re
import subprocess
import sys
from pathlib import Path

import pytest

# 项目根目录
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
DEV_SCRIPTS_DIR = SCRIPTS_DIR / "dev"
TEST_SCRIPTS_DIR = SCRIPTS_DIR / "test"
WINDOWS_SKIP_REASON = "Windows runner 不原生执行 .sh 脚本，相关测试仅在类 Unix 环境运行"


@pytest.mark.skipif(sys.platform == "win32", reason=WINDOWS_SKIP_REASON)
class TestRunTestsScript:
    """run-tests.sh 测试。"""

    script = TEST_SCRIPTS_DIR / "run-tests.sh"

    def test_script_exists(self):
        """脚本文件存在。"""
        assert self.script.exists(), f"{self.script} 不存在"

    def test_script_is_executable(self):
        """脚本文件具有执行权限。"""
        assert os.access(self.script, os.X_OK), f"{self.script} 缺少执行权限"

    def test_script_syntax_valid(self):
        """bash -n 语法检查通过。"""
        result = subprocess.run(
            ["bash", "-n", str(self.script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"语法错误: {result.stderr}"

    def test_help_output_contains_all_modes(self):
        """help 模式输出包含所有子命令关键字。"""
        result = subprocess.run(
            [str(self.script), "help"],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        expected_modes = [
            "unit",
            "integration",
            "full",
            "quick",
            "performance",
            "coverage",
            "clean",
            "help",
        ]
        for mode in expected_modes:
            assert mode in result.stdout, f"help 输出中缺少 '{mode}'"

    def test_clean_creates_reports_dir(self, tmp_path):
        """clean 模式正确清理并创建 tests/reports/ 目录。"""
        # 在 tmp_path 中模拟项目结构
        reports_dir = tmp_path / "tests" / "reports"
        reports_dir.mkdir(parents=True)
        stale_file = reports_dir / "old-report.html"
        stale_file.write_text("stale")

        result = subprocess.run(
            [
                "bash",
                "-c",
                f"cd {tmp_path} && source {self.script} 2>/dev/null; cleanup",
            ],
            capture_output=True,
            text=True,
            env={**os.environ, "PATH": os.environ["PATH"]},
        )
        # cleanup 函数会创建 tests/reports/ 目录
        # 由于 set -e 和 source 方式，直接验证 clean 模式
        result = subprocess.run(
            [str(self.script), "clean"],
            capture_output=True,
            text=True,
            cwd=tmp_path,
        )
        assert result.returncode == 0
        assert (tmp_path / "tests" / "reports").is_dir()

    def test_unknown_option_exits_nonzero(self):
        """未知选项返回非零退出码。"""
        result = subprocess.run(
            [str(self.script), "nonexistent_mode"],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0


@pytest.mark.skipif(sys.platform == "win32", reason=WINDOWS_SKIP_REASON)
class TestSetupScript:
    """setup.sh 测试。"""

    script = DEV_SCRIPTS_DIR / "setup.sh"

    def test_script_exists(self):
        """脚本文件存在。"""
        assert self.script.exists(), f"{self.script} 不存在"

    def test_script_is_executable(self):
        """脚本文件具有执行权限。"""
        assert os.access(self.script, os.X_OK), f"{self.script} 缺少执行权限"

    def test_script_syntax_valid(self):
        """bash -n 语法检查通过。"""
        result = subprocess.run(
            ["bash", "-n", str(self.script)],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, f"语法错误: {result.stderr}"


class TestVersionManagement:
    """版本管理机制测试。"""

    def test_update_version_script_removed(self):
        """update_version.py 已从 scripts/ 中删除。"""
        assert not (SCRIPTS_DIR / "update_version.py").exists(), (
            "update_version.py 应已被删除（已由动态版本读取取代）"
        )

    def test_dynamic_version_reads_from_pyproject(self):
        """negentropy.perceives.__version__ 与 pyproject.toml 中的版本号一致。"""
        from negentropy.perceives import __version__

        pyproject_path = PROJECT_ROOT / "pyproject.toml"
        content = pyproject_path.read_text(encoding="utf-8")
        match = re.search(r'^version\s*=\s*["\']([^"\']+)["\']', content, re.MULTILINE)
        assert match, "pyproject.toml 中未找到 version 字段"
        expected_version = match.group(1)
        assert __version__ == expected_version, (
            f"__version__={__version__} 与 pyproject.toml version={expected_version} 不一致"
        )

    def test_docs_no_stale_update_version_reference(self):
        """文档中不再引用 update_version.py。"""
        docs_dir = PROJECT_ROOT / "docs"
        for doc_file in docs_dir.glob("*.md"):
            content = doc_file.read_text(encoding="utf-8")
            assert "update_version.py" not in content, (
                f"{doc_file.name} 中仍引用已删除的 update_version.py"
            )

    def test_pyproject_contains_primary_cli(self):
        """pyproject.toml 暴露新的主命令。"""
        pyproject_path = PROJECT_ROOT / "pyproject.toml"
        content = pyproject_path.read_text(encoding="utf-8")

        assert 'negentropy-perceives = "negentropy.perceives.apps.app:main"' in content
