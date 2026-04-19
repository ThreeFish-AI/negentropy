"""单元测试：_serialize_corpus_config 对 config.models 的白名单与 UUID 校验。"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from negentropy.knowledge.api import _serialize_corpus_config, _validate_models_references


class TestSerializeCorpusConfigModels:
    """_serialize_corpus_config 中 config.models 子键处理。"""

    def test_no_models_passes_through(self):
        result = _serialize_corpus_config({"strategy": "recursive", "chunk_size": 800})
        assert "models" not in result

    def test_valid_models_preserved(self):
        eid = str(uuid4())
        lid = str(uuid4())
        result = _serialize_corpus_config(
            {
                "strategy": "recursive",
                "models": {"embedding_config_id": eid, "llm_config_id": lid},
            }
        )
        assert result["models"]["embedding_config_id"] == eid
        assert result["models"]["llm_config_id"] == lid

    def test_non_uuid_values_rejected(self):
        with pytest.raises(HTTPException) as exc_info:
            _serialize_corpus_config(
                {
                    "strategy": "recursive",
                    "models": {"embedding_config_id": "not-a-uuid"},
                }
            )
        assert exc_info.value.status_code == 400
        assert "INVALID_CORPUS_CONFIG" in str(exc_info.value.detail)

    def test_unknown_keys_filtered(self):
        eid = str(uuid4())
        result = _serialize_corpus_config(
            {
                "strategy": "recursive",
                "models": {"embedding_config_id": eid, "unknown_key": "value"},
            }
        )
        assert "unknown_key" not in result.get("models", {})

    def test_none_values_dropped(self):
        result = _serialize_corpus_config(
            {
                "strategy": "recursive",
                "models": {"embedding_config_id": None, "llm_config_id": ""},
            }
        )
        assert "models" not in result

    def test_non_dict_models_rejected(self):
        with pytest.raises(HTTPException) as exc_info:
            _serialize_corpus_config(
                {
                    "strategy": "recursive",
                    "models": "invalid",
                }
            )
        assert exc_info.value.status_code == 400


class TestValidateModelsReferences:
    """_validate_models_references 异步校验。"""

    @pytest.mark.asyncio
    async def test_empty_models_returns_empty(self):
        result = await _validate_models_references(None)
        assert result == {}

        result = await _validate_models_references({})
        assert result == {}

    @pytest.mark.asyncio
    async def test_missing_row_raises_404(self):
        fake_db = AsyncMock()
        fake_result = MagicMock()
        fake_result.scalar_one_or_none.return_value = None
        fake_db.execute.return_value = fake_result

        with patch("negentropy.knowledge.api.AsyncSessionLocal") as mock_session:
            mock_session.return_value.__aenter__ = AsyncMock(return_value=fake_db)
            mock_session.return_value.__aexit__ = AsyncMock(return_value=False)

            with pytest.raises(HTTPException) as exc_info:
                await _validate_models_references({"llm_config_id": str(uuid4())})
        assert exc_info.value.status_code == 400
        assert "MODEL_CONFIG_NOT_FOUND" in str(exc_info.value.detail)
