"""Pytest configuration and fixtures for backend testing."""

import asyncio

# Import the main application
import sys
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from cognizes.api.main import app


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def temp_dir():
    """Create a temporary directory for test files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def sample_pdf_content():
    """Sample PDF content for testing."""
    return b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n179\n%%EOF"


@pytest.fixture
def sample_paper_metadata():
    """Sample paper metadata for testing."""
    return {
        "title": "Test Paper: A Study on AI Agents",
        "authors": ["John Doe", "Jane Smith"],
        "year": 2024,
        "venue": "Conference on AI",
        "abstract": "This is a test abstract about AI agents.",
        "pages": 10,
        "doi": "10.1000/test-paper-2024",
    }


@pytest.fixture
def mock_claude_response():
    """Mock Claude API response."""
    return {
        "content": [
            {
                "text": "这是翻译后的测试内容。This is translated test content.",
                "type": "text",
            }
        ],
        "model": "claude-3-opus-20240229",
        "stop_reason": "end_turn",
        "usage": {"input_tokens": 100, "output_tokens": 50},
    }


@pytest.fixture
def mock_pdf_extract_response():
    """Mock PDF extraction response."""
    return {
        "content": "Extracted PDF content here...",
        "metadata": {
            "pages": 10,
            "title": "Test Paper",
            "authors": ["John Doe", "Jane Smith"],
            "year": 2024,
        },
        "images": [{"path": "image1.png", "caption": "Figure 1: Test Image", "position": 1}],
        "formulas": [{"latex": "E = mc^2", "position": 5}],
    }


@pytest.fixture
def mock_heartfelt_response():
    """Mock heartfelt analysis response."""
    return {
        "summary": "这篇论文提出了一种新的AI Agent架构...",
        "core_contributions": [
            "提出了创新的Agent通信协议",
            "设计了一套完整的评估框架",
            "实现了在多个基准测试上的显著提升",
        ],
        "technical_insights": [
            "Agent架构采用了分层设计模式",
            "通过注意力机制优化了决策过程",
            "引入了元学习以适应新环境",
        ],
        "practical_applications": [
            "可应用于自动驾驶决策系统",
            "适用于智能助手开发",
            "在游戏AI中有巨大潜力",
        ],
        "related_works": [
            "Smith et al., 2023 - Multi-Agent Reinforcement Learning",
            "Jones et al., 2023 - Communication Protocols for AI Agents",
        ],
        "future_directions": [
            "探索更高效的训练方法",
            "扩展到多模态输入场景",
            "研究Agent的可解释性问题",
        ],
    }


@pytest.fixture
def test_client():
    """Create a test client for the FastAPI application."""
    return TestClient(app)


@pytest_asyncio.fixture
async def async_client():
    """Create an async test client for the FastAPI application."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def mock_paper_service():
    """Mock the PaperService."""
    with patch("cognizes.api.services.paper_service.PaperService") as mock:
        service = MagicMock()
        service.upload_paper = AsyncMock()
        service.get_paper = AsyncMock()
        service.process_paper = AsyncMock()
        service.get_status = AsyncMock()
        service.get_content = AsyncMock()
        service.list_papers = AsyncMock()
        service.delete_paper = AsyncMock()
        service.batch_process_papers = AsyncMock()
        service.get_paper_report = AsyncMock()
        service.translate_paper = AsyncMock()
        service.analyze_paper = AsyncMock()
        mock.return_value = service
        yield service


@pytest.fixture
def mock_task_service():
    """Mock the TaskService."""
    with patch("cognizes.api.services.task_service.TaskService") as mock:
        service = MagicMock()
        service.create_task = AsyncMock()
        service.get_task = AsyncMock()
        service.update_task = AsyncMock()
        service.cancel_task = AsyncMock()
        service.list_tasks = AsyncMock()
        mock.return_value = service
        yield service


@pytest.fixture
def mock_workflow_agent():
    """Mock the WorkflowAgent."""
    with patch("cognizes.agents.claude.workflow_agent.WorkflowAgent") as mock:
        agent = MagicMock()
        agent.process_paper = AsyncMock()
        agent.translate_paper = AsyncMock()
        agent.analyze_paper = AsyncMock()
        agent.batch_process = AsyncMock()
        agent.get_status = AsyncMock()
        mock.return_value = agent
        yield agent


@pytest.fixture
def mock_pdf_agent():
    """Mock the PDFProcessingAgent."""
    with patch("cognizes.agents.claude.pdf_agent.PDFProcessingAgent") as mock:
        agent = MagicMock()
        agent.extract_content = AsyncMock()
        agent.extract_images = AsyncMock()
        agent.process_pdf = AsyncMock()
        mock.return_value = agent
        yield agent


@pytest.fixture
def mock_translation_agent():
    """Mock the TranslationAgent."""
    with patch("cognizes.agents.claude.translation_agent.TranslationAgent") as mock:
        agent = MagicMock()
        agent.translate = AsyncMock()
        agent.translate_with_options = AsyncMock()
        agent.validate_translation = AsyncMock()
        mock.return_value = agent
        yield agent


@pytest.fixture
def mock_heartfelt_agent():
    """Mock the HeartfeltAgent."""
    with patch("cognizes.agents.claude.heartfelt_agent.HeartfeltAgent") as mock:
        agent = MagicMock()
        agent.analyze = AsyncMock()
        agent.generate_insights = AsyncMock()
        agent.create_summary = AsyncMock()
        mock.return_value = agent
        yield agent


@pytest.fixture
def mock_skills():
    """Mock Claude Skills."""
    with patch("claude_agent_sdk.tools.Skill") as mock_skill:
        # Mock pdf-reader skill
        pdf_skill = AsyncMock()
        pdf_skill.return_value = {
            "content": "Extracted PDF content",
            "metadata": {"pages": 10},
        }

        # Mock zh-translator skill
        translate_skill = AsyncMock()
        translate_skill.return_value = {
            "translated_content": "翻译后的内容",
            "quality_score": 0.95,
        }

        # Mock heartfelt skill
        heartfelt_skill = AsyncMock()
        heartfelt_skill.return_value = {
            "summary": "论文摘要",
            "insights": ["洞见1", "洞见2"],
        }

        # Configure mock to return appropriate skill based on name
        def skill_side_effect(skill_name, **kwargs):
            if skill_name == "pdf-reader":
                return pdf_skill
            elif skill_name == "zh-translator":
                return translate_skill
            elif skill_name == "heartfelt":
                return heartfelt_skill
            return AsyncMock()

        mock_skill.side_effect = skill_side_effect
        yield mock_skill


@pytest.fixture
def test_paper_file(temp_dir):
    """Create a test PDF file."""
    pdf_file = temp_dir / "test_paper.pdf"
    pdf_file.write_bytes(b"%PDF-1.4\n%Test PDF content")
    return pdf_file


@pytest.fixture
def test_config():
    """Test configuration fixture."""
    return {
        "papers_dir": "tests/fixtures/papers",
        "max_file_size": 100 * 1024 * 1024,  # 100MB
        "allowed_extensions": [".pdf"],
        "claude_api_key": "test_api_key",
        "workflow_timeout": 300,
        "batch_size": 10,
    }


@pytest.fixture
def mock_anthropic_client():
    """Mock Anthropic client."""
    with patch("anthropic.Anthropic") as mock:
        client = MagicMock()
        client.messages = MagicMock()
        client.messages.create = AsyncMock()
        mock.return_value = client
        yield client


@pytest.fixture
def mock_websocket():
    """Mock WebSocket connection."""
    ws = MagicMock()
    ws.accept = AsyncMock()
    ws.send_text = AsyncMock()
    ws.receive_text = AsyncMock()
    ws.send_json = AsyncMock()
    ws.receive_json = AsyncMock()
    ws.close = AsyncMock()
    return ws


# Test data fixtures
@pytest.fixture
def paper_upload_data():
    """Paper upload test data."""
    return {
        "filename": "test_paper.pdf",
        "category": "llm-agents",
        "size": 1024000,  # 1MB
    }


@pytest.fixture
def paper_process_request():
    """Paper processing request test data."""
    return {
        "workflow": "full",
        "options": {
            "extract_images": True,
            "preserve_format": True,
            "translation_style": "academic",
        },
    }


@pytest.fixture
def task_response_data():
    """Task response test data."""
    return {
        "task_id": "task_123",
        "paper_id": "paper_456",
        "workflow": "translate",
        "status": "processing",
        "progress": 0.0,
        "message": "Task started",
        "created_at": "2024-01-15T14:30:22Z",
        "updated_at": "2024-01-15T14:30:22Z",
    }


@pytest.fixture
def paper_status_data():
    """Paper status test data."""
    return {
        "paper_id": "paper_456",
        "filename": "test_paper.pdf",
        "category": "llm-agents",
        "status": "uploaded",
        "upload_time": "2024-01-15T14:30:22Z",
        "updated_at": "2024-01-15T14:30:22Z",
        "workflows": {
            "extract": {
                "status": "completed",
                "progress": 100,
                "message": "Extraction completed",
            },
            "translate": {
                "status": "pending",
                "progress": 0,
                "message": "Waiting to start",
            },
        },
    }


@pytest.fixture
def websocket_message():
    """WebSocket message test data."""
    return {
        "type": "progress_update",
        "task_id": "task_123",
        "paper_id": "paper_456",
        "status": "processing",
        "progress": 50.0,
        "message": "Translation in progress...",
        "timestamp": "2024-01-15T14:35:22Z",
    }


# Custom markers
def pytest_configure(config):
    """Configure custom pytest markers."""
    config.addinivalue_line("markers", "unit: Mark test as a unit test")
    config.addinivalue_line("markers", "integration: Mark test as an integration test")
    config.addinivalue_line("markers", "e2e: Mark test as an end-to-end test")
    config.addinivalue_line("markers", "performance: Mark test as a performance test")
    config.addinivalue_line("markers", "websocket: Mark test as requiring WebSocket")
    config.addinivalue_line("markers", "slow: Mark test as slow running")
