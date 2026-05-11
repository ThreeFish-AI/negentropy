"""content_validator 单元测试。"""

from __future__ import annotations

from negentropy.engine.governance.content_validator import validate_memory_content


class TestValidateMemoryContent:
    """validate_memory_content 检测逻辑。"""

    def test_natural_language_passes(self) -> None:
        result = validate_memory_content("User prefers TypeScript and React for frontend development")
        assert result.is_natural_language is True
        assert result.detected_format == "natural_language"

    def test_chinese_natural_language_passes(self) -> None:
        result = validate_memory_content("用户偏好深色主题，VSCode 使用 Dracula 配色")
        assert result.is_natural_language is True

    def test_json_object_rejected(self) -> None:
        content = '{"id": "verify-dev-fix", "type": "verification_task", "title": "test"}'
        result = validate_memory_content(content)
        assert result.is_natural_language is False
        assert result.detected_format == "json"

    def test_json_with_nested_object_rejected(self) -> None:
        content = '{"id": "fix:123", "description": {"repo": "api-service", "pr": "#456"}}'
        result = validate_memory_content(content)
        assert result.is_natural_language is False
        assert result.detected_format == "json"

    def test_real_problematic_memory_rejected(self) -> None:
        content = (
            '{"id": "verify-dev-fix:20260510T082741Z",'
            ' "type": "verification_task",'
            ' "title": "VERIFY-DEV-FIX: api-service PR #456",'
            ' "description": {"repo": "api-service", "pr": "#456"},'
            ' "source": "ActionFaculty/user",'
            ' "created_at": "2026-05-10T08:27:41Z"}'
        )
        result = validate_memory_content(content)
        assert result.is_natural_language is False
        assert result.detected_format == "json"

    def test_single_key_json_passes(self) -> None:
        """单 key JSON 视为自然语言（避免误判简单文本）。"""
        result = validate_memory_content('{"key": "value"}')
        assert result.is_natural_language is True

    def test_json_array_passes(self) -> None:
        """纯数组 JSON 不判为结构化（缺少 dict 的语义字段）。"""
        result = validate_memory_content('["item1", "item2"]')
        assert result.is_natural_language is True

    def test_empty_string_passes(self) -> None:
        result = validate_memory_content("")
        assert result.is_natural_language is True

    def test_whitespace_only_passes(self) -> None:
        result = validate_memory_content("   ")
        assert result.is_natural_language is True

    def test_prose_with_curly_braces_passes(self) -> None:
        """自然语言中偶现花括号不应被误判。"""
        result = validate_memory_content("User mentioned the JSON format {key: value} in conversation")
        assert result.is_natural_language is True

    def test_dialogue_format_passes(self) -> None:
        """原始对话格式（由其他路径处理）不被 JSON 检测拦截。"""
        result = validate_memory_content("[User] Hello\n[Assistant] Hi there")
        assert result.is_natural_language is True

    def test_deployment_process_passes(self) -> None:
        result = validate_memory_content(
            "Deployment process: build with pnpm, test with vitest, deploy via GitHub Actions"
        )
        assert result.is_natural_language is True

    def test_standup_schedule_passes(self) -> None:
        result = validate_memory_content("Team standup is at 10am every Monday and Wednesday")
        assert result.is_natural_language is True
