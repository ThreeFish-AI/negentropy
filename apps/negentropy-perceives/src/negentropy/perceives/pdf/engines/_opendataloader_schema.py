"""OpenDataLoader PDF JSON 输出的 Pydantic 模型。

OpenDataLoader 的 JSON 输出使用含空格的键名（如 ``"page number"``、
``"bounding box"``、``"heading level"``），此模块提供 Pydantic v2 alias
适配，将空格键名映射为 Python 友好的 snake_case 属性。

JSON 顶层结构::

    {
      "file name": str,
      "number of pages": int,
      "author": str | null,
      "title": str | null,
      "creation date": str | null,
      "modification date": str | null,
      "kids": [ODLElement, ...]
    }

kids 内的元素类型（``type`` 字段区分）：
  - ``heading``：含 ``heading level``、``content``
  - ``paragraph``：含 ``content``
  - ``table``：含嵌套 cell 结构
  - ``image``：含 ``source``（落盘路径）
  - ``list``：含列表项
  - ``caption``：含 ``content``
  - ``formula``：含 LaTeX ``content``（仅 hybrid）
  - ``footer`` / ``header``：页眉页脚

References:
    [1] OpenDataLoader PDF, "JSON Schema Reference,"
        https://opendataloader.org/docs/reference/json-schema, 2026.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class ODLElement(BaseModel):
    """OpenDataLoader JSON 中单个元素的基础模型。

    所有元素共享 ``type``、``id``、``page number``、``bounding box``。
    类型特异字段通过 Optional 提供默认值，非匹配类型时为 None。

    ``model_config`` 设置 ``populate_by_name=True`` 以支持 alias 反序列化。
    """

    model_config = {"populate_by_name": True}

    type: str
    id: Optional[int] = Field(default=None, alias="id")
    page_number: Optional[int] = Field(default=None, alias="page number")
    bounding_box: Optional[List[float]] = Field(default=None, alias="bounding box")
    content: Optional[str] = None

    # heading 特有
    level: Optional[str] = Field(alias="level", default=None)
    heading_level: Optional[int] = Field(alias="heading level", default=None)
    font: Optional[str] = Field(alias="font", default=None)
    font_size: Optional[float] = Field(alias="font size", default=None)
    text_color: Optional[str] = Field(alias="text color", default=None)

    # image 特有
    source: Optional[str] = Field(alias="source", default=None)

    # formula 特有（仅 hybrid）
    formula_content: Optional[str] = Field(alias="formula content", default=None)

    # picture 特有（仅 hybrid）
    description: Optional[str] = Field(alias="description", default=None)


class ODLDocument(BaseModel):
    """OpenDataLoader JSON 输出的顶层文档模型。"""

    model_config = {"populate_by_name": True}

    file_name: str = Field(alias="file name")
    number_of_pages: int = Field(alias="number of pages")
    author: Optional[str] = None
    title: Optional[str] = None
    creation_date: Optional[str] = Field(alias="creation date", default=None)
    modification_date: Optional[str] = Field(alias="modification date", default=None)
    kids: List[ODLElement] = Field(default_factory=list)
