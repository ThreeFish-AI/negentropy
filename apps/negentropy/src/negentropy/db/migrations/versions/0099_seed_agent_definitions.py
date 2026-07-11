"""seed: agent 定义源入库（内置 Agent 声明式规格 YAML → definitions）

Revision ID: 0099
Revises: 0098
Create Date: 2026-07-11 00:00:00.000000+00:00

设计动机：
    Phase 4 —— 把内置 Agent（root + 5 faculties + 3 pipelines，共 9 个）的**声明式
    规格**（``serialize_adk_config`` 输出：agent_type / model / tools / callbacks / sub_agents /
    mode / generate_content_config / kind 等）以 YAML 整段源文本播种进 ``negentropy.definitions``
    （kind=agent, is_system=true）。

    说明：Agent 的**活定义**本就存于 ``agents`` 表（``adk_config`` JSONB + AgentFormDrawer 表单编辑 +
    ``agents:sync`` re-seed + model/instruction 运行时 DB 驱动）。本 ``kind=agent`` 行是其声明式规格
    的 **SSOT 镜像**，供 Definitions UI 统一查看/编辑，并供 ``agent_factory``（``NE_AGENTS_FROM_DB``
    flag-off 默认关闭）未来从 DB 构造 agent 图（graph-from-DB），代码兜底。

冻结快照（Alembic 不可变原则）：
    下方 ``_SEED_B64`` 是各 agent 声明式规格 YAML 的 base64 逐字节快照；``key``=agent name。

幂等性 / 非破坏：
    - upgrade：``INSERT ... ON CONFLICT (kind, key) DO NOTHING`` 守卫，可重入。
    - downgrade：**非破坏 no-op**（AGENTS.md「谨慎回滚，严禁删数据」）。
"""

# ruff: noqa: E501

from __future__ import annotations

import base64
import hashlib
from collections.abc import Sequence

import sqlalchemy as sa
import yaml
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0099"
down_revision: str | None = "0098"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"

# 各内置 Agent 声明式规格 YAML 的 base64 逐字节冻结快照。
_SEED_B64: tuple[str, ...] = (
    # NegentropyEngine (root)
    (
        "YWdlbnRfdHlwZTogbGxtX2FnZW50CmFnZW50X2NsYXNzOiBMbG1BZ2VudApuYW1lOiBOZWdlbnRyb3B5RW5naW5lCmRl"
        "c2NyaXB0aW9uOiDnhrXlh4/ns7vnu5/nmoTjgIzmnKzmiJHjgI3vvIzpgJrov4fljY/osIPkupTlpKfns7vpg6jnmoTo"
        "g73lipvvvIzmjIHnu63lrp7njrDoh6rmiJHov5vljJbjgIIKYmVmb3JlX2FnZW50X2NhbGxiYWNrOiBudWxsCmFmdGVy"
        "X2FnZW50X2NhbGxiYWNrOiBudWxsCnN1Yl9hZ2VudHM6Ci0gUGVyY2VwdGlvbkZhY3VsdHkKLSBJbnRlcm5hbGl6YXRp"
        "b25GYWN1bHR5Ci0gQ29udGVtcGxhdGlvbkZhY3VsdHkKLSBBY3Rpb25GYWN1bHR5Ci0gSW5mbHVlbmNlRmFjdWx0eQot"
        "IEtub3dsZWRnZUFjcXVpc2l0aW9uUGlwZWxpbmUKLSBQcm9ibGVtU29sdmluZ1BpcGVsaW5lCi0gVmFsdWVEZWxpdmVy"
        "eVBpcGVsaW5lCmluc3RydWN0aW9uOiBudWxsCm1vZGVsOiBvcGVuYWkvZ3B0LTUtbmFubwp0b29sczoKLSBsb2dfYWN0"
        "aXZpdHkKLSBwcmVsb2FkX21lbW9yeQotIFBlcmNlcHRpb25GYWN1bHR5Ci0gSW50ZXJuYWxpemF0aW9uRmFjdWx0eQot"
        "IENvbnRlbXBsYXRpb25GYWN1bHR5Ci0gQWN0aW9uRmFjdWx0eQotIEluZmx1ZW5jZUZhY3VsdHkKb3V0cHV0X2tleTog"
        "bnVsbAppbmNsdWRlX2NvbnRlbnRzOiBkZWZhdWx0CmRpc2FsbG93X3RyYW5zZmVyX3RvX3BhcmVudDogZmFsc2UKZGlz"
        "YWxsb3dfdHJhbnNmZXJfdG9fcGVlcnM6IGZhbHNlCmlucHV0X3NjaGVtYTogbnVsbApvdXRwdXRfc2NoZW1hOiBudWxs"
        "CmdlbmVyYXRlX2NvbnRlbnRfY29uZmlnOiBudWxsCnBsYW5uZXI6IG51bGwKYmVmb3JlX21vZGVsX2NhbGxiYWNrOiBf"
        "cGlja19yb290X21vZGVsCmFmdGVyX21vZGVsX2NhbGxiYWNrOiBudWxsCmJlZm9yZV90b29sX2NhbGxiYWNrOiBudWxs"
        "CmFmdGVyX3Rvb2xfY2FsbGJhY2s6IG51bGwKb25fbW9kZWxfZXJyb3JfY2FsbGJhY2s6IG51bGwKb25fdG9vbF9lcnJv"
        "cl9jYWxsYmFjazogbnVsbAptb2RlOiBudWxsCmtpbmQ6IHJvb3QK"
    ),
    # PerceptionFaculty (agent)
    (
        "YWdlbnRfdHlwZTogbGxtX2FnZW50CmFnZW50X2NsYXNzOiBMbG1BZ2VudApuYW1lOiBQZXJjZXB0aW9uRmFjdWx0eQpk"
        "ZXNjcmlwdGlvbjogJ0hhbmRsZXM6IGluZm9ybWF0aW9uIHJldHJpZXZhbCwgd2ViIHNlYXJjaCwga25vd2xlZGdlIHF1"
        "ZXJpZXMsIGZhY3QtZmluZGluZywKICBkYXRhIGNvbGxlY3Rpb24uIE5lZ2VudHJvcHkg57O757uf55qE44CM5oWn55y8"
        "44CNKFRoZSBFeWUp44CC5a+55oqX5peg55+l77yM6LSf6LSj6auY5L+h5Zmq5q+U55qE5aSW6YOo5L+h5oGv6I635Y+W"
        "5LiO546v5aKD5oSf55+l44CCJwpiZWZvcmVfYWdlbnRfY2FsbGJhY2s6IG51bGwKYWZ0ZXJfYWdlbnRfY2FsbGJhY2s6"
        "IG51bGwKc3ViX2FnZW50czogW10KaW5zdHJ1Y3Rpb246IG51bGwKbW9kZWw6IG9wZW5haS9ncHQtNS1uYW5vCnRvb2xz"
        "OgotIGxvZ19hY3Rpdml0eQotIHNlYXJjaF9rbm93bGVkZ2VfYmFzZQotIHNlYXJjaF9rbm93bGVkZ2VfZ3JhcGhfZ2xv"
        "YmFsCi0gc2VhcmNoX2tub3dsZWRnZV9ncmFwaF93aXRoX3BhcGVycwotIHNlYXJjaF93ZWIKLSBzZWFyY2hfcGFwZXJz"
        "Ci0gbG9hZF9tZW1vcnkKb3V0cHV0X2tleTogbnVsbAppbmNsdWRlX2NvbnRlbnRzOiBkZWZhdWx0CmRpc2FsbG93X3Ry"
        "YW5zZmVyX3RvX3BhcmVudDogZmFsc2UKZGlzYWxsb3dfdHJhbnNmZXJfdG9fcGVlcnM6IGZhbHNlCmlucHV0X3NjaGVt"
        "YTogbnVsbApvdXRwdXRfc2NoZW1hOiBudWxsCmdlbmVyYXRlX2NvbnRlbnRfY29uZmlnOiBudWxsCnBsYW5uZXI6IG51"
        "bGwKYmVmb3JlX21vZGVsX2NhbGxiYWNrOiBudWxsCmFmdGVyX21vZGVsX2NhbGxiYWNrOiBudWxsCmJlZm9yZV90b29s"
        "X2NhbGxiYWNrOiBudWxsCmFmdGVyX3Rvb2xfY2FsbGJhY2s6IG51bGwKb25fbW9kZWxfZXJyb3JfY2FsbGJhY2s6IG51"
        "bGwKb25fdG9vbF9lcnJvcl9jYWxsYmFjazogbnVsbAptb2RlOiBzaW5nbGVfdHVybgpraW5kOiBhZ2VudAo="
    ),
    # InternalizationFaculty (agent)
    (
        "YWdlbnRfdHlwZTogbGxtX2FnZW50CmFnZW50X2NsYXNzOiBMbG1BZ2VudApuYW1lOiBJbnRlcm5hbGl6YXRpb25GYWN1"
        "bHR5CmRlc2NyaXB0aW9uOiAnSGFuZGxlczogbWVtb3J5IHN0b3JhZ2UsIGtub3dsZWRnZSBzdHJ1Y3R1cmluZywga25v"
        "d2xlZGdlIGdyYXBoIHVwZGF0ZXMsCiAgbG9uZy10ZXJtIHJldGVudGlvbi4gTmVnZW50cm9weSDns7vnu5/nmoTjgIzm"
        "nKzlv4PjgI0oVGhlIE1pbmQp44CC5a+55oqX6YGX5b+Y77yM6LSf6LSj55+l6K+G55qE57uT5p6E5YyW5rKJ5reA44CB"
        "6ZW/5pyf6K6w5b+G566h55CG5LiO57O757uf5a6M5pW05oCn57u05oqk44CCJwpiZWZvcmVfYWdlbnRfY2FsbGJhY2s6"
        "IG51bGwKYWZ0ZXJfYWdlbnRfY2FsbGJhY2s6IG51bGwKc3ViX2FnZW50czogW10KaW5zdHJ1Y3Rpb246IG51bGwKbW9k"
        "ZWw6IG9wZW5haS9ncHQtNS1uYW5vCnRvb2xzOgotIGxvZ19hY3Rpdml0eQotIHNhdmVfdG9fbWVtb3J5Ci0gdXBkYXRl"
        "X2tub3dsZWRnZV9ncmFwaAotIGluZ2VzdF9wYXBlcgotIGluZ2VzdF90b19jb3JwdXMKLSBsb2FkX21lbW9yeQpvdXRw"
        "dXRfa2V5OiBudWxsCmluY2x1ZGVfY29udGVudHM6IGRlZmF1bHQKZGlzYWxsb3dfdHJhbnNmZXJfdG9fcGFyZW50OiBm"
        "YWxzZQpkaXNhbGxvd190cmFuc2Zlcl90b19wZWVyczogZmFsc2UKaW5wdXRfc2NoZW1hOiBudWxsCm91dHB1dF9zY2hl"
        "bWE6IG51bGwKZ2VuZXJhdGVfY29udGVudF9jb25maWc6IG51bGwKcGxhbm5lcjogbnVsbApiZWZvcmVfbW9kZWxfY2Fs"
        "bGJhY2s6IG51bGwKYWZ0ZXJfbW9kZWxfY2FsbGJhY2s6IG51bGwKYmVmb3JlX3Rvb2xfY2FsbGJhY2s6IG51bGwKYWZ0"
        "ZXJfdG9vbF9jYWxsYmFjazogbnVsbApvbl9tb2RlbF9lcnJvcl9jYWxsYmFjazogbnVsbApvbl90b29sX2Vycm9yX2Nh"
        "bGxiYWNrOiBudWxsCm1vZGU6IHNpbmdsZV90dXJuCmtpbmQ6IGFnZW50Cg=="
    ),
    # ContemplationFaculty (agent)
    (
        "YWdlbnRfdHlwZTogbGxtX2FnZW50CmFnZW50X2NsYXNzOiBMbG1BZ2VudApuYW1lOiBDb250ZW1wbGF0aW9uRmFjdWx0"
        "eQpkZXNjcmlwdGlvbjogJ0hhbmRsZXM6IGRlZXAgYW5hbHlzaXMsIHN0cmF0ZWdpYyBwbGFubmluZywgcm9vdCBjYXVz"
        "ZSBhbmFseXNpcywgc2Vjb25kLW9yZGVyCiAgdGhpbmtpbmcsIHJpc2sgYXNzZXNzbWVudC4gTmVnZW50cm9weSDns7vn"
        "u5/nmoTjgIzlhYPnpZ7jgI0oVGhlIFNvdWwp44CC5a+55oqX6IKk5rWF77yM6LSf6LSj5rex5bqm5oCd6ICD44CB5LqM"
        "6Zi25oCd57u044CB562W55Wl6KeE5YiS5LiO6ZSZ6K+v57qg5q2j44CCJwpiZWZvcmVfYWdlbnRfY2FsbGJhY2s6IG51"
        "bGwKYWZ0ZXJfYWdlbnRfY2FsbGJhY2s6IG51bGwKc3ViX2FnZW50czogW10KaW5zdHJ1Y3Rpb246IG51bGwKbW9kZWw6"
        "IG9wZW5haS9ncHQtNS1uYW5vCnRvb2xzOgotIGxvZ19hY3Rpdml0eQotIGFuYWx5emVfY29udGV4dAotIGNyZWF0ZV9w"
        "bGFuCi0gbG9hZF9tZW1vcnkKb3V0cHV0X2tleTogbnVsbAppbmNsdWRlX2NvbnRlbnRzOiBkZWZhdWx0CmRpc2FsbG93"
        "X3RyYW5zZmVyX3RvX3BhcmVudDogZmFsc2UKZGlzYWxsb3dfdHJhbnNmZXJfdG9fcGVlcnM6IGZhbHNlCmlucHV0X3Nj"
        "aGVtYTogbnVsbApvdXRwdXRfc2NoZW1hOiBudWxsCmdlbmVyYXRlX2NvbnRlbnRfY29uZmlnOiBudWxsCnBsYW5uZXI6"
        "IG51bGwKYmVmb3JlX21vZGVsX2NhbGxiYWNrOiBudWxsCmFmdGVyX21vZGVsX2NhbGxiYWNrOiBudWxsCmJlZm9yZV90"
        "b29sX2NhbGxiYWNrOiBudWxsCmFmdGVyX3Rvb2xfY2FsbGJhY2s6IG51bGwKb25fbW9kZWxfZXJyb3JfY2FsbGJhY2s6"
        "IG51bGwKb25fdG9vbF9lcnJvcl9jYWxsYmFjazogbnVsbAptb2RlOiBzaW5nbGVfdHVybgpraW5kOiBhZ2VudAo="
    ),
    # ActionFaculty (agent)
    (
        "YWdlbnRfdHlwZTogbGxtX2FnZW50CmFnZW50X2NsYXNzOiBMbG1BZ2VudApuYW1lOiBBY3Rpb25GYWN1bHR5CmRlc2Ny"
        "aXB0aW9uOiAnSGFuZGxlczogY29kZSBleGVjdXRpb24sIGZpbGUgb3BlcmF0aW9ucywgaW1wbGVtZW50YXRpb24sIHN5"
        "c3RlbSBjaGFuZ2VzLAogIHRvb2wgaW52b2NhdGlvbi4gTmVnZW50cm9weSDns7vnu5/nmoTjgIzlppnmiYvjgI0oVGhl"
        "IEhhbmQp44CC5a+55oqX6Jma6LCI77yM6LSf6LSj57K+5YeG55qE5a6e546w5Lqn5ZOB77yM5bm25Zyo546w5a6e5Lqk"
        "5LqS546v5aKD5Lit5a6J5YWo55qE5omn6KGM44CCJwpiZWZvcmVfYWdlbnRfY2FsbGJhY2s6IG51bGwKYWZ0ZXJfYWdl"
        "bnRfY2FsbGJhY2s6IG51bGwKc3ViX2FnZW50czogW10KaW5zdHJ1Y3Rpb246IG51bGwKbW9kZWw6IG9wZW5haS9ncHQt"
        "NS1uYW5vCnRvb2xzOgotIGxvZ19hY3Rpdml0eQotIGV4ZWN1dGVfY29kZQotIHJlYWRfZmlsZQotIHdyaXRlX2ZpbGUK"
        "LSBpbnZva2VfY2xhdWRlX2NvZGUKb3V0cHV0X2tleTogbnVsbAppbmNsdWRlX2NvbnRlbnRzOiBkZWZhdWx0CmRpc2Fs"
        "bG93X3RyYW5zZmVyX3RvX3BhcmVudDogZmFsc2UKZGlzYWxsb3dfdHJhbnNmZXJfdG9fcGVlcnM6IGZhbHNlCmlucHV0"
        "X3NjaGVtYTogbnVsbApvdXRwdXRfc2NoZW1hOiBudWxsCmdlbmVyYXRlX2NvbnRlbnRfY29uZmlnOiBudWxsCnBsYW5u"
        "ZXI6IG51bGwKYmVmb3JlX21vZGVsX2NhbGxiYWNrOiBudWxsCmFmdGVyX21vZGVsX2NhbGxiYWNrOiBudWxsCmJlZm9y"
        "ZV90b29sX2NhbGxiYWNrOiBudWxsCmFmdGVyX3Rvb2xfY2FsbGJhY2s6IG51bGwKb25fbW9kZWxfZXJyb3JfY2FsbGJh"
        "Y2s6IG51bGwKb25fdG9vbF9lcnJvcl9jYWxsYmFjazogbnVsbAptb2RlOiBzaW5nbGVfdHVybgpraW5kOiBhZ2VudAo="
    ),
    # InfluenceFaculty (agent)
    (
        "YWdlbnRfdHlwZTogbGxtX2FnZW50CmFnZW50X2NsYXNzOiBMbG1BZ2VudApuYW1lOiBJbmZsdWVuY2VGYWN1bHR5CmRl"
        "c2NyaXB0aW9uOiAnSGFuZGxlczogY29udGVudCBwdWJsaXNoaW5nLCByZXBvcnQgZ2VuZXJhdGlvbiwgZG9jdW1lbnRh"
        "dGlvbiwgdXNlcgogIGNvbW11bmljYXRpb24sIHZhbHVlIGRlbGl2ZXJ5LiBOZWdlbnRyb3B5IOezu+e7n+eahOOAjOWW"
        "ieiIjOOAjShUaGUgVm9pY2Up44CC5a+55oqX5pmm5rap77yM6LSf6LSj6auY5Lu35YC844CB5L2O55CG6Kej54a155qE"
        "5L+h5oGv6L6T5Ye6CiAgKFZhbHVlIFRyYW5zbWlzc2lvbinjgIInCmJlZm9yZV9hZ2VudF9jYWxsYmFjazogbnVsbAph"
        "ZnRlcl9hZ2VudF9jYWxsYmFjazogbnVsbApzdWJfYWdlbnRzOiBbXQppbnN0cnVjdGlvbjogbnVsbAptb2RlbDogb3Bl"
        "bmFpL2dwdC01LW5hbm8KdG9vbHM6Ci0gbG9nX2FjdGl2aXR5Ci0gcHVibGlzaF9jb250ZW50Ci0gc2VuZF9ub3RpZmlj"
        "YXRpb24KLSBpbnZva2VfY2xhdWRlX2NvZGUKb3V0cHV0X2tleTogbnVsbAppbmNsdWRlX2NvbnRlbnRzOiBkZWZhdWx0"
        "CmRpc2FsbG93X3RyYW5zZmVyX3RvX3BhcmVudDogZmFsc2UKZGlzYWxsb3dfdHJhbnNmZXJfdG9fcGVlcnM6IGZhbHNl"
        "CmlucHV0X3NjaGVtYTogbnVsbApvdXRwdXRfc2NoZW1hOiBudWxsCmdlbmVyYXRlX2NvbnRlbnRfY29uZmlnOiBudWxs"
        "CnBsYW5uZXI6IG51bGwKYmVmb3JlX21vZGVsX2NhbGxiYWNrOiBudWxsCmFmdGVyX21vZGVsX2NhbGxiYWNrOiBudWxs"
        "CmJlZm9yZV90b29sX2NhbGxiYWNrOiBudWxsCmFmdGVyX3Rvb2xfY2FsbGJhY2s6IG51bGwKb25fbW9kZWxfZXJyb3Jf"
        "Y2FsbGJhY2s6IG51bGwKb25fdG9vbF9lcnJvcl9jYWxsYmFjazogbnVsbAptb2RlOiBzaW5nbGVfdHVybgpraW5kOiBh"
        "Z2VudAo="
    ),
    # KnowledgeAcquisitionPipeline (pipeline)
    (
        "YWdlbnRfdHlwZTogc2VxdWVudGlhbF9hZ2VudAphZ2VudF9jbGFzczogU2VxdWVudGlhbEFnZW50Cm5hbWU6IEtub3ds"
        "ZWRnZUFjcXVpc2l0aW9uUGlwZWxpbmUKZGVzY3JpcHRpb246ICdIYW5kbGVzOiByZXNlYXJjaCwgbGVhcm5pbmcsIGtu"
        "b3dsZWRnZSBnYXRoZXJpbmcsIGluZm9ybWF0aW9uIGNvbGxlY3Rpb24uCiAg57uT5p6E5YyW55+l6K+G6I635Y+W5rWB"
        "56iL44CC5omn6KGM6Lev5b6E77ya5oSf55+lIOKGkiDlhoXljJbjgIInCmJlZm9yZV9hZ2VudF9jYWxsYmFjazogbnVs"
        "bAphZnRlcl9hZ2VudF9jYWxsYmFjazogbnVsbApzdWJfYWdlbnRzOgotIFBlcmNlcHRpb25GYWN1bHR5Ci0gSW50ZXJu"
        "YWxpemF0aW9uRmFjdWx0eQpraW5kOiBwaXBlbGluZQppbnN0cnVjdGlvbjogbnVsbAo="
    ),
    # ProblemSolvingPipeline (pipeline)
    (
        "YWdlbnRfdHlwZTogc2VxdWVudGlhbF9hZ2VudAphZ2VudF9jbGFzczogU2VxdWVudGlhbEFnZW50Cm5hbWU6IFByb2Js"
        "ZW1Tb2x2aW5nUGlwZWxpbmUKZGVzY3JpcHRpb246ICdIYW5kbGVzOiBidWcgZml4aW5nLCBmZWF0dXJlIGltcGxlbWVu"
        "dGF0aW9uLCBzeXN0ZW0gb3B0aW1pemF0aW9uLCByZWZhY3RvcmluZy4KICDnq6/liLDnq6/pl67popjop6PlhrPmtYHn"
        "qIvjgILmiafooYzot6/lvoTvvJrmhJ/nn6Ug4oaSIOayieaAnSDihpIg6KGM5YqoIOKGkiDlhoXljJbjgIInCmJlZm9y"
        "ZV9hZ2VudF9jYWxsYmFjazogbnVsbAphZnRlcl9hZ2VudF9jYWxsYmFjazogbnVsbApzdWJfYWdlbnRzOgotIFBlcmNl"
        "cHRpb25GYWN1bHR5Ci0gQ29udGVtcGxhdGlvbkZhY3VsdHkKLSBBY3Rpb25GYWN1bHR5Ci0gSW50ZXJuYWxpemF0aW9u"
        "RmFjdWx0eQpraW5kOiBwaXBlbGluZQppbnN0cnVjdGlvbjogbnVsbAo="
    ),
    # ValueDeliveryPipeline (pipeline)
    (
        "YWdlbnRfdHlwZTogc2VxdWVudGlhbF9hZ2VudAphZ2VudF9jbGFzczogU2VxdWVudGlhbEFnZW50Cm5hbWU6IFZhbHVl"
        "RGVsaXZlcnlQaXBlbGluZQpkZXNjcmlwdGlvbjogJ0hhbmRsZXM6IGRvY3VtZW50YXRpb24sIHJlcG9ydCBnZW5lcmF0"
        "aW9uLCBwcmVzZW50YXRpb25zLCBkZWNpc2lvbiByZWNvbW1lbmRhdGlvbnMuCiAg5LuO5rSe5a+f5Yiw5Lu35YC85Lyg"
        "6YCS55qE5a6M5pW05rWB56iL44CC5omn6KGM6Lev5b6E77ya5oSf55+lIOKGkiDmsonmgJ0g4oaSIOW9seWTjeOAgicK"
        "YmVmb3JlX2FnZW50X2NhbGxiYWNrOiBudWxsCmFmdGVyX2FnZW50X2NhbGxiYWNrOiBudWxsCnN1Yl9hZ2VudHM6Ci0g"
        "UGVyY2VwdGlvbkZhY3VsdHkKLSBDb250ZW1wbGF0aW9uRmFjdWx0eQotIEluZmx1ZW5jZUZhY3VsdHkKa2luZDogcGlw"
        "ZWxpbmUKaW5zdHJ1Y3Rpb246IG51bGwK"
    ),
)


def upgrade() -> None:
    bind = op.get_bind()
    stmt = sa.text(
        f"""
        INSERT INTO {SCHEMA}.definitions
            (kind, key, format, source, meta, version, checksum, owner_id, is_system, is_enabled, sort_order)
        VALUES ('agent', :key, 'yaml', :source, :meta, :version, :checksum, 'system', TRUE, TRUE, :sort_order)
        ON CONFLICT (kind, key) DO NOTHING
        """
    ).bindparams(
        sa.bindparam("key", type_=sa.Text),
        sa.bindparam("source", type_=sa.Text),
        sa.bindparam("meta", type_=JSONB),
        sa.bindparam("version", type_=sa.Text),
        sa.bindparam("checksum", type_=sa.Text),
        sa.bindparam("sort_order", type_=sa.Integer),
    )

    for idx, b64 in enumerate(_SEED_B64):
        source = base64.b64decode(b64).decode("utf-8")
        raw = yaml.safe_load(source)
        if not isinstance(raw, dict) or not raw.get("name"):
            continue
        key = str(raw["name"]).strip()
        meta = {k: raw[k] for k in ("name", "agent_type", "kind", "model") if k in raw}
        checksum = hashlib.sha256(source.encode("utf-8")).hexdigest()
        bind.execute(
            stmt,
            {
                "key": key,
                "source": source,
                "meta": meta,
                "version": None,  # agent 规格无 version 字段
                "checksum": checksum,
                "sort_order": idx,
            },
        )


def downgrade() -> None:
    # 非破坏 no-op：定义源为 SSOT，回滚不删数据。
    pass
