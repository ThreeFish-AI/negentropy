"""Papers management routes."""

import logging
from typing import Any

from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    HTTPException,
    Path,
    Query,
    UploadFile,
)

from cognizes.api.models.paper import (
    BatchProcessRequest,
    PaperListResponse,
    PaperProcessRequest,
    PaperStatus,
    PaperUploadResponse,
)
from cognizes.api.services.paper_service import PaperService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, Any]:
    """
    Health check endpoint.
    """
    return {"status": "healthy", "message": "Service is running"}


# Dependency injection
async def get_paper_service() -> PaperService:
    """Get PaperService instance."""
    return PaperService()


@router.post("/upload", response_model=PaperUploadResponse)
async def upload_paper(
    file: UploadFile = File(...),
    category: str = Query("general", description="Paper category"),
    service: PaperService = Depends(get_paper_service),
) -> PaperUploadResponse:
    """
    Upload a paper file.

    - **file**: PDF file
    - **category**: Paper category (optional)
    """
    if not (file.filename and file.filename.lower().endswith(".pdf")):
        raise HTTPException(status_code=400, detail="只支持 PDF 文件")

    # Read file content to check actual size since file.size is None
    file_content = await file.read()
    file_size = len(file_content)
    await file.seek(0)  # Reset file pointer for further processing

    if file_size > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(status_code=400, detail="文件大小不能超过 50MB")

    try:
        result = await service.upload_paper(file, category)
        return PaperUploadResponse(**result)
    except Exception as e:
        logger.error(f"Error uploading paper: {str(e)}")
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}") from e


@router.post("/{paper_id}/process")
async def process_paper(
    paper_id: str = Path(..., description="Paper ID"),
    request: PaperProcessRequest = Body(...),
    service: PaperService = Depends(get_paper_service),
) -> dict[str, Any]:
    """
    Process a paper (extract/translate/analyze).

    - **paper_id**: Paper ID
    - **workflow**: Workflow type
    """
    try:
        result = await service.process_paper(paper_id, request.workflow, options=request.options)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error processing paper {paper_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}") from e


@router.get("/{paper_id}/status", response_model=PaperStatus)
async def get_paper_status(
    paper_id: str = Path(..., description="Paper ID"),
    service: PaperService = Depends(get_paper_service),
) -> dict[str, Any]:
    """
    Get paper processing status.

    - **paper_id**: Paper ID
    """
    try:
        status = await service.get_status(paper_id)
        return status
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error getting paper status {paper_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}") from e


@router.get("/{paper_id}/content")
async def get_paper_content(
    paper_id: str = Path(..., description="Paper ID"),
    content_type: str = Query("translation", description="Content type: source, translation, heartfelt"),
    service: PaperService = Depends(get_paper_service),
) -> dict[str, Any]:
    """
    Get paper content.

    - **paper_id**: Paper ID
    - **content_type**: Content type
    """
    if content_type not in ["source", "translation", "heartfelt"]:
        raise HTTPException(status_code=400, detail="无效的内容类型")

    try:
        content = await service.get_content(paper_id, content_type)
        return content
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error getting paper content {paper_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get content: {str(e)}") from e


@router.get("/", response_model=PaperListResponse)
async def list_papers(
    category: str | None = Query(None, description="Filter by category"),
    status: str | None = Query(None, description="Filter by status"),
    limit: int = Query(20, ge=1, le=100, description="Return limit"),
    offset: int = Query(0, ge=0, description="Offset"),
    service: PaperService = Depends(get_paper_service),
) -> dict[str, Any]:
    """
    Get list of papers.

    - **category**: Category filter
    - **status**: Status filter
    - **limit**: Return limit
    - **offset**: Offset
    """
    try:
        papers = await service.list_papers(category=category, status=status, limit=limit, offset=offset)
        return papers
    except Exception as e:
        logger.error(f"Error listing papers: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get list: {str(e)}") from e


@router.delete("/{paper_id}")
async def delete_paper(
    paper_id: str = Path(..., description="Paper ID"),
    service: PaperService = Depends(get_paper_service),
) -> dict[str, Any]:
    """
    Delete a paper and its related data.

    - **paper_id**: Paper ID
    """
    try:
        success = await service.delete_paper(paper_id)
        return {"deleted": success, "paper_id": paper_id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error deleting paper {paper_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}") from e


@router.post("/batch", response_model=BatchProcessRequest)
async def batch_process_papers(
    paper_ids: list[str] = Body(...),
    workflow: str = Query("full", description="Processing workflow"),
    service: PaperService = Depends(get_paper_service),
) -> dict[str, Any]:
    """
    Batch process papers.

    - **paper_ids**: List of paper IDs
    - **workflow**: Processing workflow
    """
    if len(paper_ids) > 50:
        raise HTTPException(status_code=400, detail="批量处理最多支持 50 个文件")

    try:
        result = await service.batch_process_papers(paper_ids, workflow)
        return result
    except Exception as e:
        logger.error(f"Error in batch processing: {str(e)}")
        raise HTTPException(status_code=500, detail=f"批量处理失败: {str(e)}") from e


@router.get("/{paper_id}/report")
async def get_paper_report(
    paper_id: str = Path(..., description="Paper ID"),
    service: PaperService = Depends(get_paper_service),
) -> dict[str, Any]:
    """
    Get paper's in-depth reading report.

    - **paper_id**: Paper ID
    """
    try:
        report = await service.get_paper_report(paper_id)
        return report
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error getting paper report {paper_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get report: {str(e)}") from e


@router.post("/{paper_id}/translate")
async def translate_paper(
    paper_id: str = Path(..., description="Paper ID"),
    service: PaperService = Depends(get_paper_service),
) -> dict[str, Any]:
    """
    Translate a paper.

    - **paper_id**: Paper ID
    """
    try:
        result = await service.translate_paper(paper_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error translating paper {paper_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}") from e


@router.post("/{paper_id}/analyze")
async def analyze_paper(
    paper_id: str = Path(..., description="Paper ID"),
    service: PaperService = Depends(get_paper_service),
) -> dict[str, Any]:
    """
    Analyze a paper (in-depth reading).

    - **paper_id**: Paper ID
    """
    try:
        result = await service.analyze_paper(paper_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error analyzing paper {paper_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}") from e
