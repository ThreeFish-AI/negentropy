"""Paper related data models."""

from typing import Any

from pydantic import BaseModel, Field


class PaperMetadata(BaseModel):
    """论文元数据模型."""

    title: str = Field(..., description="标题")
    authors: list[str] = Field(..., description="作者列表")
    year: int = Field(..., description="发表年份")
    venue: str | None = Field(None, description="发表场所")
    abstract: str | None = Field(None, description="摘要")
    pages: int | None = Field(None, description="页数")
    doi: str | None = Field(None, description="DOI")
    keywords: list[str] = Field(default_factory=list, description="关键词")


class PaperUploadResponse(BaseModel):
    """论文上传响应模型."""

    paper_id: str = Field(..., description="论文ID")
    filename: str = Field(..., description="原始文件名")
    category: str = Field(..., description="论文分类")
    size: int = Field(..., description="文件大小（字节）")
    upload_time: str = Field(..., description="上传时间")


class PaperProcessRequest(BaseModel):
    """论文处理请求模型."""

    workflow: str = Field(default="full", description="处理工作流类型")
    options: dict[str, Any] | None = Field(default=None, description="处理选项")

    model_config = {
        "json_schema_extra": {
            "example": {
                "workflow": "full",
                "options": {"extract_images": True, "preserve_format": True},
            }
        }
    }


class PaperStatus(BaseModel):
    """论文状态模型."""

    paper_id: str = Field(..., description="论文ID")
    status: str = Field(..., description="当前状态")
    workflows: dict[str, dict[str, Any]] = Field(default_factory=dict, description="各工作流状态")
    upload_time: str | None = Field(None, description="上传时间")
    updated_at: str | None = Field(None, description="更新时间")
    category: str | None = Field(None, description="论文分类")
    filename: str | None = Field(None, description="文件名")

    model_config = {
        "json_schema_extra": {
            "example": {
                "paper_id": "llm-agents_20240115_143022_example.pdf",
                "status": "completed",
                "workflows": {
                    "extract": {
                        "status": "completed",
                        "updated_at": "2024-01-15T14:35:00",
                    },
                    "translate": {"status": "processing", "progress": 75},
                },
            }
        }
    }


class PaperContent(BaseModel):
    """论文内容模型."""

    paper_id: str = Field(..., description="论文ID")
    content_type: str = Field(..., description="内容类型")
    format: str = Field(..., description="内容格式")
    content: str | None = Field(None, description="内容文本")
    file_path: str | None = Field(None, description="文件路径")
    word_count: int | None = Field(None, description="字数")
    size: int | None = Field(None, description="文件大小")
    metadata: dict[str, Any] | None = Field(None, description="元数据")


class PaperInfo(BaseModel):
    """论文信息模型."""

    paper_id: str = Field(..., description="论文ID")
    filename: str = Field(..., description="文件名")
    category: str = Field(..., description="分类")
    status: str = Field(..., description="状态")
    upload_time: str = Field(..., description="上传时间")
    updated_at: str | None = Field(None, description="更新时间")
    size: int = Field(..., description="文件大小")
    metadata: PaperMetadata | None = Field(None, description="论文元数据")


class PaperListResponse(BaseModel):
    """论文列表响应模型."""

    papers: list[PaperInfo] = Field(..., description="论文列表")
    total: int = Field(..., description="总数")
    offset: int = Field(..., description="偏移量")
    limit: int = Field(..., description="限制数")


class BatchProcessRequest(BaseModel):
    """批量处理请求模型."""

    batch_id: str = Field(..., description="批次ID")
    total_requested: int = Field(..., description="请求数量")
    total_files: int = Field(..., description="实际文件数")
    workflow: str = Field(..., description="工作流类型")
    stats: dict[str, Any] = Field(..., description="处理统计")
    results: list[dict[str, Any]] = Field(..., description="处理结果")


class PaperReport(BaseModel):
    """论文报告模型."""

    paper_id: str = Field(..., description="论文ID")
    report: dict[str, Any] = Field(..., description="报告内容")
