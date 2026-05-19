"""GitHub Actions workflow 回归测试。

验证关键工作流的稳定性约束，防止退回到已知脆弱实现。
"""

from pathlib import Path


# 仓库根目录（tests/unit/ → tests/ → negentropy-perceives/ → apps/ → repo root）
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
WORKFLOWS_DIR = REPO_ROOT / ".github" / "workflows"


def _read_workflow(name: str) -> str:
    return (WORKFLOWS_DIR / name).read_text(encoding="utf-8")


class TestReviewWorkflow:
    """negentropy-perceives-review.yml 约束验证。"""

    def test_uses_official_claude_action(self):
        content = _read_workflow("negentropy-perceives-review.yml")
        assert "anthropics/claude-code-action@v1" in content

    def test_removes_legacy_cli_loop(self):
        content = _read_workflow("negentropy-perceives-review.yml")
        assert "npm install -g @anthropic-ai/claude-code" not in content
        assert "review-files.sh" not in content
        assert "review-prompt.txt" not in content
        assert "npx @anthropic-ai/claude-code review" not in content

    def test_non_blocking_failure_policy_is_present(self):
        content = _read_workflow("negentropy-perceives-review.yml")
        assert "continue-on-error: true" in content
        assert "不阻塞工作流" in content

    def test_review_permissions_include_oidc(self):
        content = _read_workflow("negentropy-perceives-review.yml")
        assert "id-token: write" in content

    def test_does_not_reference_secrets_directly_in_if(self):
        content = _read_workflow("negentropy-perceives-review.yml")
        assert "if: ${{ secrets." not in content


class TestWorkflowActionVersions:
    """关键 action 版本约束。"""

    @staticmethod
    def _perceives_workflows():
        """仅迭代 perceives 相关的 workflow 文件。"""
        return list(WORKFLOWS_DIR.glob("negentropy-perceives-*.yml"))

    def test_checkout_not_using_v3(self):
        for workflow in self._perceives_workflows():
            content = workflow.read_text(encoding="utf-8")
            assert "actions/checkout@v3" not in content, (
                f"{workflow.name} 仍在使用 checkout v3"
            )

    def test_no_legacy_action_versions(self):
        for workflow in self._perceives_workflows():
            content = workflow.read_text(encoding="utf-8")
            assert "actions/setup-node@v3" not in content, (
                f"{workflow.name} 仍在使用 setup-node v3"
            )
            assert "actions/github-script@v6" not in content, (
                f"{workflow.name} 仍在使用 github-script v6"
            )
            assert "actions/upload-artifact@v3" not in content, (
                f"{workflow.name} 仍在使用 upload-artifact v3"
            )
            assert "actions/download-artifact@v3" not in content, (
                f"{workflow.name} 仍在使用 download-artifact v3"
            )
            assert "codecov/codecov-action@v4" not in content, (
                f"{workflow.name} 仍在使用 codecov-action v4"
            )

    def test_setup_uv_uses_v5_or_later(self):
        content = (
            REPO_ROOT / ".github" / "actions" / "setup-python-uv" / "action.yml"
        ).read_text(encoding="utf-8")
        assert "astral-sh/setup-uv@v5" in content

    def test_dependencies_workflow_uses_latest_pr_action(self):
        content = _read_workflow("negentropy-perceives-dependencies.yml")
        assert "peter-evans/create-pull-request@v8" in content

    def test_codecov_v5_uses_plural_files_input(self):
        content = _read_workflow("negentropy-perceives-ci.yml")
        assert "codecov/codecov-action@v5" in content
        assert "files:" in content
        assert "file:" not in content


class TestDependenciesWorkflowLocalization:
    """依赖更新 PR 模板本地化验证。"""

    def test_dependency_pr_metadata_is_chinese(self):
        content = _read_workflow("negentropy-perceives-dependencies.yml")
        assert "更新依赖锁文件" in content
        assert (
            "本次自动化任务已将" in content
            and "项目依赖升级到当前可解析的最新兼容版本。" in content
        )
        assert "该 PR 由 GitHub Actions 自动生成。" in content
