"""docs/user-guide.md 文档完整性测试。"""

import re

import pytest
from tests.unit.doc_contracts import (
    assert_doc_exists,
    assert_relative_links_resolve,
    assert_required_frontmatter,
    read_doc,
)

USER_GUIDE_DOC = "user-guide.md"


@pytest.fixture(scope="module")
def doc_content() -> str:
    """读取用户指南文档内容。"""
    return read_doc(USER_GUIDE_DOC)


class TestDocExists:
    """文档文件存在性验证。"""

    def test_user_guide_doc_exists(self):
        """user-guide.md 文件存在。"""
        assert_doc_exists(USER_GUIDE_DOC)


class TestFrontmatter:
    """Frontmatter 完整性验证。"""

    def test_has_frontmatter(self, doc_content: str):
        """文档包含 YAML frontmatter。"""
        assert_required_frontmatter(doc_content)


class TestRelativeLinks:
    """文档内相对路径链接有效性验证。"""

    LINK_PATTERN = re.compile(r"\[.*?\]\((\.\.?/[^)#]+?)(?:#[^)]*)?\)")

    def test_all_relative_links_resolve(self, doc_content: str):
        """所有相对路径链接指向的文件存在。"""
        assert_relative_links_resolve(doc_content)


class TestSectionStructure:
    """文档章节结构验证。"""

    REQUIRED_H2_SECTIONS = [
        "概述",
        "快速入门",
        "开发者命令速查",
        "MCP Server 配置",
        "MCP 工具",
        "API 编程接口",
        "高级使用场景",
        "常见问题",
    ]

    FORBIDDEN_H2_SECTIONS = [
        "配置详解",
        "最佳实践",
        "使用技巧",
    ]

    H2_PATTERN = re.compile(r"^## (.+)$", re.MULTILINE)

    def test_has_required_sections(self, doc_content: str):
        """文档包含所有必需的二级标题。"""
        h2_titles = self.H2_PATTERN.findall(doc_content)
        for section in self.REQUIRED_H2_SECTIONS:
            assert any(section in title for title in h2_titles), (
                f"缺少必需章节: '## {section}'"
            )

    @pytest.mark.parametrize("section", FORBIDDEN_H2_SECTIONS)
    def test_no_redundant_section(self, doc_content: str, section: str):
        """文档不包含冗余章节: {section}。"""
        h2_titles = self.H2_PATTERN.findall(doc_content)
        assert not any(section == title.strip() for title in h2_titles), (
            f"文档包含冗余章节 '## {section}'，应链接到对应权威文档"
        )


class TestOrthogonalityConstraints:
    """正交性约束验证 -- 确保 User Guide 不包含属于其他文档的内容。"""

    def test_no_dev_install_commands(self, doc_content: str):
        """文档不包含开发依赖安装命令。"""
        assert "uv sync --group dev" not in doc_content, (
            "User Guide 不应包含开发依赖安装命令，应链接到 development.md"
        )

    def test_no_git_clone_instructions(self, doc_content: str):
        """文档不包含 git clone 安装说明。"""
        assert "git clone" not in doc_content, (
            "User Guide 不应包含从源码克隆的安装说明，应链接到 development.md"
        )

    def test_has_cross_reference_to_development(self, doc_content: str):
        """文档包含到开发指南的交叉引用链接。"""
        assert "development.md" in doc_content, "缺少到 development.md 的交叉引用链接"

    def test_has_env_var_reference_section(self, doc_content: str):
        """文档包含环境变量完整参考章节（原 configuration.md 内容已迁入）。"""
        assert "### 环境变量完整参考" in doc_content, (
            "缺少 '### 环境变量完整参考' 章节（configuration.md 内容应已迁入）"
        )


class TestMcpToolCompleteness:
    """MCP 工具文档完整性验证。"""

    EXPECTED_TOOL_COUNT = 6
    TOOL_HEADING_PATTERN = re.compile(r"^### (\d+)\. ", re.MULTILINE)
    _H2_PATTERN = re.compile(r"^## ", re.MULTILINE)

    @staticmethod
    def _extract_mcp_tool_section(content: str) -> str:
        """提取「MCP 工具」章节的内容，避免误匹配其他章节的编号。"""
        start = content.find("## MCP 工具")
        if start == -1:
            return ""
        next_h2 = TestMcpToolCompleteness._H2_PATTERN.search(content, start + 1)
        end = next_h2.start() if next_h2 else len(content)
        return content[start:end]

    def test_all_tools_documented(self, doc_content: str):
        """文档包含所有 6 个 MCP 工具的文档。"""
        tool_section = self._extract_mcp_tool_section(doc_content)
        tool_numbers = [int(n) for n in self.TOOL_HEADING_PATTERN.findall(tool_section)]
        assert len(tool_numbers) >= self.EXPECTED_TOOL_COUNT, (
            f"仅找到 {len(tool_numbers)} 个工具文档，期望 {self.EXPECTED_TOOL_COUNT}"
        )

    def test_tool_numbers_continuous(self, doc_content: str):
        """工具编号从 1 到 6 连续无遗漏。"""
        tool_section = self._extract_mcp_tool_section(doc_content)
        tool_numbers = sorted(
            int(n) for n in self.TOOL_HEADING_PATTERN.findall(tool_section)
        )
        for i in range(1, self.EXPECTED_TOOL_COUNT + 1):
            assert i in tool_numbers, f"缺少工具 #{i} 的文档"


def _extract_bash_blocks(content: str) -> list[str]:
    """提取文档中所有 bash 代码块内容。"""
    return re.findall(r"```bash\n(.*?)```", content, re.DOTALL)


class TestDeveloperCommandsSection:
    """开发者命令速查章节完整性验证（原 test_docs_commands.py 核心断言迁移）。"""

    EXPECTED_COMMAND_SECTIONS = [
        "服务器启动",
        "代码质量检查",
        "项目依赖管理",
        "项目维护",
        "系统调试与诊断",
    ]

    @pytest.mark.parametrize("section", EXPECTED_COMMAND_SECTIONS)
    def test_has_command_section(self, doc_content: str, section: str):
        """开发者命令速查包含必需子章节: {section}。"""
        assert section in doc_content, f"开发者命令速查缺少子章节: '{section}'"

    def test_server_start_commands_present(self, doc_content: str):
        """文档包含基本服务器启动命令。"""
        assert "uv run negentropy-perceives" in doc_content, (
            "缺少基本服务器启动命令 'uv run negentropy-perceives'"
        )

    def test_dependency_management_commands_present(self, doc_content: str):
        """文档包含依赖管理命令。"""
        assert "uv add" in doc_content, "缺少依赖添加命令 'uv add'"
        assert "uv remove" in doc_content, "缺少依赖移除命令 'uv remove'"

    def test_diagnostic_commands_present(self, doc_content: str):
        """文档包含系统调试与诊断命令。"""
        assert "printenv | grep" in doc_content or "printenv" in doc_content, (
            "缺少环境变量检查命令"
        )
        assert "from negentropy.perceives.config import settings" in doc_content, (
            "缺少配置验证命令"
        )


class TestCommandsEnvVarAccuracy:
    """开发者命令速查中环境变量与 config.py 一致性验证（原 TestEnvVarAccuracy 迁移）。"""

    ENV_VAR_PATTERN = re.compile(r"NEGENTROPY_PERCEIVES_(\w+)")

    def test_no_nonexistent_env_vars(self, doc_content: str):
        """命令速查 bash 代码块中引用的 NEGENTROPY_PERCEIVES_ 变量在 config.py 中有对应字段。"""
        from negentropy.perceives.config import NegentropyPerceivesSettings

        valid_fields = {
            name.upper() for name in NegentropyPerceivesSettings.model_fields
        }

        _bash_blocks = _extract_bash_blocks(doc_content)
        # 仅扫描「开发者命令速查」章节范围内的环境变量
        commands_section = doc_content[
            doc_content.find("## 开发者命令速查") : doc_content.find(
                "## MCP Server 配置"
            )
            if "## MCP Server 配置" in doc_content
            else len(doc_content)
        ]
        doc_vars: set[str] = set()
        for block in _extract_bash_blocks(commands_section):
            doc_vars.update(self.ENV_VAR_PATTERN.findall(block))

        invalid = [
            f"NEGENTROPY_PERCEIVES_{var}" for var in doc_vars if var not in valid_fields
        ]

        assert invalid == [], f"以下环境变量在 config.py 中不存在: {invalid}"


class TestCommandsNoRedundancy:
    """验证开发者命令速查不包含应由权威文档覆盖的冗余命令（原 TestNoRedundancy 迁移）。"""

    def test_no_setup_sh_execution(self, doc_content: str):
        """环境设置命令应由 development.md 覆盖。"""
        for block in _extract_bash_blocks(doc_content):
            assert "./scripts/dev/setup.sh" not in block, (
                "文档不应包含 ./scripts/dev/setup.sh 执行命令（已由 development.md 覆盖）"
            )

    def test_no_pytest_commands(self, doc_content: str):
        """pytest 命令应由 development.md 覆盖。"""
        for block in _extract_bash_blocks(doc_content):
            assert "uv run pytest" not in block, (
                "文档不应包含 pytest 命令（已由 development.md 覆盖）"
            )

    def test_no_uv_sync_commands(self, doc_content: str):
        """uv sync 命令应由 development.md 覆盖。"""
        for block in _extract_bash_blocks(doc_content):
            assert "uv sync" not in block, (
                "文档不应包含 uv sync 命令（已由 development.md 覆盖）"
            )

    def test_no_uv_build_command(self, doc_content: str):
        """构建命令应由 development.md 覆盖。"""
        for block in _extract_bash_blocks(doc_content):
            assert "uv build" not in block, (
                "文档不应包含 uv build 命令（已由 development.md 覆盖）"
            )


class TestSectionNumberContinuity:
    """章节内子编号连续性验证，防止编号重复或跳跃。"""

    @staticmethod
    def _extract_section_numbers(
        doc_content: str, start_heading: str, end_heading: str
    ) -> list[int]:
        """提取两个 H2 标题之间的 ### N. 编号列表。"""
        start = doc_content.find(start_heading)
        end = (
            doc_content.find(end_heading, start + 1)
            if end_heading
            else len(doc_content)
        )
        if start == -1:
            return []
        section = doc_content[start : end if end != -1 else len(doc_content)]
        return [int(n) for n in re.findall(r"^### (\d+)\.", section, re.MULTILINE)]

    def test_advanced_scenarios_numbering_continuous(self, doc_content: str):
        """高级使用场景子编号 1-N 连续无重复。"""
        numbers = self._extract_section_numbers(
            doc_content, "## 高级使用场景", "## 常见问题"
        )
        assert numbers, "未找到高级使用场景子编号"
        assert numbers == list(range(1, len(numbers) + 1)), (
            f"高级使用场景编号不连续: {numbers}，期望 {list(range(1, len(numbers) + 1))}"
        )

    def test_faq_numbering_continuous(self, doc_content: str):
        """常见问题子编号 1-N 连续无重复。"""
        numbers = self._extract_section_numbers(
            doc_content, "## 常见问题", "## 安全与合规"
        )
        assert numbers, "未找到常见问题子编号"
        assert numbers == list(range(1, len(numbers) + 1)), (
            f"常见问题编号不连续: {numbers}，期望 {list(range(1, len(numbers) + 1))}"
        )
