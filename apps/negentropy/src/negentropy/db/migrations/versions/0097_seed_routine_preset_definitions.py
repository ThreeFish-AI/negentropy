"""seed: routine_preset 定义源入库（内置 Routine 预设 YAML → definitions）

Revision ID: 0097
Revises: 0096
Create Date: 2026-07-10 00:20:00.000000+00:00

设计动机：
    Phase 2 —— 把原 ``agents/routine_presets/*.yaml`` 的 4 个内置 Routine 预设整段源文本
    播种进 ``negentropy.definitions``（kind=routine_preset, is_system=true）。落库后
    ``RoutinePreset.load_all()`` 改从 DB 读取，原 YAML 文件删除，DB 成为唯一 SSOT。

冻结快照（Alembic 不可变原则）：
    下方 ``_SEED_B64`` 是各 YAML 的 **base64 逐字节快照**（避免大段文本转写误差与引号/
    反斜杠转义坑）。解码即原 YAML 源文本；``key`` 由解析出的 ``preset_id`` 派生。

幂等性 / 非破坏：
    - upgrade：``INSERT ... ON CONFLICT (kind, key) DO NOTHING`` 守卫，可重入；已存在则跳过
      （不覆写用户后续在 UI 的编辑）。每 param 仅出现一次，规避 asyncpg 双用 ``:key`` 的
      AmbiguousParameterError。
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

revision: str = "0097"
down_revision: str | None = "0096"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"

# 各内置 Routine 预设 YAML 的 base64 逐字节冻结快照。
_SEED_B64: tuple[str, ...] = (
    # code_quality_audit.yaml
    (
        "IyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDi"
        "lIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDi"
        "lIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAKIyBSb3V0aW5lIOmihOiuvuaooeeJiCDi"
        "gJQg5Luj56CB6LSo6YeP5a6h6K6h77yIQ29kZSBRdWFsaXR5IEF1ZGl077yJCiMKIyDlrqHmibnmqKHlvI86IGF1dG/v"
        "vIjlhajoh6rkuLvvvIkKIyDlkb3ku6Tpl6jmjqc6IHJ1ZmYgY2hlY2vvvIjlrqLop4LplJrngrnvvIkKIyDlt6XnqIvo"
        "jIPlvI86IEV2YWx1YXRvci1PcHRpbWl6ZXIg5YWo6Ieq5Yqo6Zet546v44CBUmVmbGV4aW9uIOi3qOi/reS7o+WPjeaA"
        "neiusOW/huOAgQojICAgICAgICAgICBMTE0tYXMtSnVkZ2UgKyBDb21tYW5kIEdhdGUg5Y+M6YeN6K+E5Lyw44CBbm9f"
        "cHJvZ3Jlc3Mg5YGc5rue5qOA5rWLCiMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA"
        "4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA"
        "4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSACgpw"
        "cmVzZXRfaWQ6IGNvZGVfcXVhbGl0eV9hdWRpdApkaXNwbGF5X25hbWU6ICLku6PnoIHotKjph4/lrqHorqEiCmRlc2Ny"
        "aXB0aW9uOiA+CiAg6Z2i5ZCR55uu5qCH5qih5Z2X55qE5YWo6Ieq5Li75Luj56CB6LSo6YeP5rK755CG77ya5LulIFJ1"
        "ZmYg5YWo6KeE5YiZ6ZuG77yILS1zZWxlY3QgQUxM77yJ5omr5o+P5Luj56CB5byC5ZGz44CBCiAg5r2c5Zyo57y66Zm3"
        "5LiO5pyA5L2z5a6e6Le16L+d6IOM77yM5oyJ5Lil6YeN57qn5Yir5YiG57G75ZCO6YCQ57G75pyA5bCP5YyW5L+u5aSN"
        "44CCCiAg6YeH55SoIEV2YWx1YXRvci1PcHRpbWl6ZXIg6Zet546v4oCU4oCURW5naW5lIOiHquS4u+e8luaOkuWkmui9"
        "riBDbGF1ZGUgQ29kZSDmiafooYzvvIwKICDmr4/ova7nlLEgTExNLWFzLUp1ZGdlIOe7k+aehOWMluivhOWIhuW5tuaz"
        "qOWFpSBSZWZsZXhpb24g5Y+N5oCd6K6w5b+G6amx5Yqo6ZKI5a+55oCn5pS56L+b77yMCiAg5ZCM5pe25LulIFJ1ZmYg"
        "6YCA5Ye656CB5L2c5Li6IENvbW1hbmQgR2F0ZSDlrqLop4LplJrngrnmipHliLbor4TkvLDlgY/lt67vvJsKICBub19w"
        "cm9ncmVzcyDlgZzmu57mo4DmtYvkuI7ov63ku6MgLyDmiJDmnKzmiqTmoI/lhbHlkIzkv53pmpzmlLbmlZvlj6/mjqfj"
        "gIIKY2F0ZWdvcnk6IHF1YWxpdHkKdmVyc2lvbjogMS4wLjAKZmVhdHVyZXNfc2hvd2Nhc2U6CiAgLSAi5YWo6Ieq5Li7"
        "6Zet546vIOKAlCBhdXRvIOWuoeaJue+8jEVuZ2luZSDoh6rkuLvnvJbmjpLlpJrova7ov63ku6MiCiAgLSAiQ29tbWFu"
        "ZCBHYXRlIOKAlCBSdWZmIOmAgOWHuueggeS9nOS4uuWuouingumqjOivgemUmueCuSIKICAtICJSZWZsZXhpb24g4oCU"
        "IOi3qOi/reS7o+WPjeaAneiusOW/humpseWKqOmSiOWvueaAp+S/ruWkjSIKICAtICJMTE0tYXMtSnVkZ2Ug4oCUIOe7"
        "k+aehOWMluivhOWIhiArIHZlcmRpY3Qg5Yik5a6aIgogIC0gIuWBnOatouaKpOagjyDigJQgbm9fcHJvZ3Jlc3Mg5YGc"
        "5rue5qOA5rWLICsgbWF4X2l0ZXJhdGlvbnMg56Gs5LiK6ZmQIgoKdGl0bGU6ICJDb2RlIFF1YWxpdHkgQXVkaXQiCmdv"
        "YWw6ID4KICDlr7nnm67moIfku6PnoIHmqKHlnZfmiafooYzlhajpnaLnmoTku6PnoIHotKjph4/lrqHorqHjgILmiafo"
        "oYzku6XkuIvmraXpqqTvvJoKCiAgMS4g6L+Q6KGMIHJ1ZmYgY2hlY2sg5omr5o+P5omA5pyJ6L+d6KeE6aG577yIYHJ1"
        "ZmYgY2hlY2sgLS1zZWxlY3QgQUxMYO+8ie+8mwogIDIuIOaMieS4pemHjeeoi+W6puWIhuexu++8mmVycm9yIOKGkiB3"
        "YXJuaW5nIOKGkiByZWZhY3RvciDihpIgY29udmVudGlvbu+8mwogIDMuIOS7juacgOmrmOS4pemHjee6p+WIq+W8gOWn"
        "i+mAkOexu+S/ruWkje+8jOavj+asoeS/ruWkjeWQjuehruiupOacquW8leWFpeaWsOi/neinhO+8mwogIDQuIOWvueS6"
        "jumcgOimgSBub3FhIOazqOmHiuiAjOmdnuS/ruWkjeeahOaDheWGte+8jOa3u+WKoOinhOiMg+WMlueahCBub3FhIOag"
        "h+azqO+8mwogIDUuIOaJgOacieS/ruWkjeW/hemhu+S/neaMgeaooeWdl+eahOWFrOWFsSBBUEkg5ZKM5qC45b+D6L+Q"
        "6KGM5pe26KGM5Li65LiN5Y+Y44CCCgogIOmHjeimgee6puadn++8mumBteW+quacgOWwj+W5sumihOWOn+WIme+8jOav"
        "j+WkhOS/ruWkjeS7heWBmuW/heimgeeahOacgOWwj+WPmOabtOOAggphY2NlcHRhbmNlX2NyaXRlcmlhOiA+CiAgMS4g"
        "YHJ1ZmYgY2hlY2sgLS1zZWxlY3QgQUxMYCDpgIDlh7rnoIHkuLogMO+8iOmbtui/neinhO+8jOaIluS7heWJqeWQiOeQ"
        "hiBub3FhIOazqOmHiu+8ie+8mwogIDIuIOaJgOacieeOsOaciea1i+ivleS7jeeEtumAmui/h++8iOaXoOWbnuW9ku+8"
        "ie+8mwogIDMuIOavj+WkhOS/ruWkjeS4uuacgOWwj+WPmOabtO+8jOS4jeaUueWPmOaooeWdl+WFrOWFsSBBUEkg5ZKM"
        "5qC45b+D6L+Q6KGM5pe26KGM5Li677ybCiAgNC4g5paw5aKe5Luj56CB56ym5ZCI6aG555uuIFJ1ZmYg6KeE5YiZ6ZuG"
        "77yI5LiN5byV5YWl5pawIGxpbnQg6L+d6KeE77yJ44CCCnZlcmlmaWNhdGlvbl9jb21tYW5kOiAidXYgcnVuIHJ1ZmYg"
        "Y2hlY2sgLS1zZWxlY3QgQUxMIgptYXhfaXRlcmF0aW9uczogMTUKbWF4X2Nvc3RfdXNkOiAzLjAKc3VjY2Vzc19zY29y"
        "ZV90aHJlc2hvbGQ6IDkwCm5vX3Byb2dyZXNzX3BhdGllbmNlOiAzCmFwcHJvdmFsX21vZGU6IGF1dG8KY29uZmlnOgog"
        "IHBlcm1pc3Npb25fbW9kZTogYXV0bwo="
    ),
    # documentation_enhancement.yaml
    (
        "IyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDi"
        "lIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDi"
        "lIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAKIyBSb3V0aW5lIOmihOiuvuaooeeJiCDi"
        "gJQg5oqA5pyv5paH5qGj55Sf5oiQ77yIRG9jdW1lbnRhdGlvbiBFbmhhbmNlbWVudO+8iQojCiMg5a6h5om55qih5byP"
        "OiBmaXJzdO+8iOS7hemmluasoeWuoeaJue+8iQojIOWRveS7pOmXqOaOpzog5peg77yI57qvIExMTS1hcy1KdWRnZSDo"
        "r4TkvLDvvIkKIyDlt6XnqIvojIPlvI86IOmmluasoeWuoeaJuemXqOaOp++8iGZpcnN0IOaooeW8j++8ieOAgee6ryBM"
        "TE0g6K+E5a6h5peg5ZG95Luk6Zeo5o6n44CBCiMgICAgICAgICAgIFJlZmxleGlvbiDot6jov63ku6PorrDlv4bjgIFz"
        "ZXNzaW9uIOi/nue7reaApwojIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKU"
        "gOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKU"
        "gOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgAoKcHJlc2V0"
        "X2lkOiBkb2N1bWVudGF0aW9uX2VuaGFuY2VtZW50CmRpc3BsYXlfbmFtZTogIuaKgOacr+aWh+aho+eUn+aIkCIKZGVz"
        "Y3JpcHRpb246ID4KICDpnaLlkJHnm67moIfmqKHlnZfnmoTmlrnlkJHnoa7orqTlvI/mlofmoaPlt6XnqIvvvJrpmIXo"
        "r7vmupDnoIHlkI7kuqflh7rljIXlkKvmqKHlnZfmpoLov7DjgIHmnrbmnoTor7TmmI7jgIEKICBBUEkg5Y+C6ICD44CB"
        "6YWN572u5LiO5omp5bGV5oyH5byV55qE57uT5p6E5YyW5oqA5pyv5paH5qGj44CCCiAg6YeH55SoIGZpcnN0IOWuoeaJ"
        "ueaooeW8j+KAlOKAlOS7hemmlui9ruehruiupOaWh+aho+aWueWQkeS4juiMg+WbtO+8jOS5i+WQjui/m+WFpeWFqOiH"
        "quWKqOi/reS7o++8jAogIOWFvOmhvuS6uuW3peaKiuaOp+S4juaViOeOh+OAgueUseS6juaWh+aho+i0qOmHj+mavuS7"
        "peeUseWRveS7pOihjOW3peWFt+WuouingumqjOivge+8jOmHh+eUqOe6ryBMTE0tYXMtSnVkZ2Ug6K+E5a6h77yMCiAg"
        "5L6d6LWWIFJlZmxleGlvbiDlj43mgJ3orrDlv4blnKjov63ku6Ppl7TmjIHnu63pgLzov5Hpq5jotKjph4/vvJvovbvp"
        "h4/ov63ku6PmiqTmoI/lpZHlkIjmlofmoaPnsbvku7vliqHoioLlpY/jgIIKY2F0ZWdvcnk6IGRvY3VtZW50YXRpb24K"
        "dmVyc2lvbjogMS4wLjAKZmVhdHVyZXNfc2hvd2Nhc2U6CiAgLSAi5pa55ZCR56Gu6K6kIOKAlCBmaXJzdCDlrqHmibnv"
        "vIzku4Xpppbova7noa7orqTmlrnlkJHkuI7ojIPlm7QiCiAgLSAi57qvIExMTS1hcy1KdWRnZSDigJQg5pegIENvbW1h"
        "bmQgR2F0Ze+8jEFJIOivhOWuoeaWh+aho+i0qOmHjyIKICAtICJSZWZsZXhpb24g4oCUIOi3qOi/reS7o+WPjeaAneiu"
        "sOW/huaMgee7reaUuei/m+aWh+ahoyIKICAtICLkvJror53ov57nu63mgKcg4oCUIENsYXVkZSBDb2RlIOS/neaMgeS4"
        "iuS4i+aWhyIKICAtICLovbvph4/ov63ku6PmiqTmoI8g4oCUIOWlkeWQiOaWh+aho+S7u+WKoeeahOi/reS7o+iKguWl"
        "jyIKCnRpdGxlOiAiRG9jdW1lbnRhdGlvbiBFbmhhbmNlbWVudCIKZ29hbDogPgogIOS4uuebruagh+S7o+eggeaooeWd"
        "l+eUn+aIkOaIluabtOaWsOWujOaVtOeahOaKgOacr+aWh+aho+OAguaJp+ihjOS7peS4i+atpemqpO+8mgoKICAxLiDp"
        "mIXor7vnm67moIfmqKHlnZfnmoTlhajpg6jmupDku6PnoIHvvIznkIbop6PmqKHlnZfogYzotKPjgIHlhazlvIAgQVBJ"
        "IOWSjOWGhemDqOaetuaehO+8mwogIDIuIOeUn+aIkOe7k+aehOWMluaWh+aho++8jOWMheWQq+S7peS4i+eroOiKgu+8"
        "mgogICAgIC0g5qih5Z2X5qaC6L+w77yI6IGM6LSj5a6a5L2N44CB6K6+6K6h55CG5b+177yJCiAgICAgLSDmnrbmnoTo"
        "r7TmmI7vvIjmoLjlv4Pnu4Tku7bjgIHmlbDmja7mtYHjgIHkvp3otZblhbPns7vvvIkKICAgICAtIEFQSSDlj4LogIPv"
        "vIjlhazlvIDlh73mlbAv57G755qE562+5ZCN44CB5Y+C5pWw44CB6L+U5Zue5YC844CB5L2/55So56S65L6L77yJCiAg"
        "ICAgLSDphY3nva7or7TmmI7vvIjnjq/looPlj5jph4/jgIHphY3nva7pobnlj4rlhbbpu5jorqTlgLzvvIkKICAgICAt"
        "IOaJqeWxleaMh+W8le+8iOWmguS9leWcqOivpeaooeWdl+WfuuehgOS4iuaJqeWxleaWsOWKn+iDve+8iQogIDMuIOaW"
        "h+aho+ivreiogOS4juaooeWdl+WGheaXouacieazqOmHiuS/neaMgeS4gOiHtO+8iOS4reaWh+aIluiLseaWh++8ie+8"
        "mwogIDQuIOS7o+eggeekuuS+i+mcgOWPr+aJp+ihjOS4lOS4juW9k+WJjSBBUEkg562+5ZCN5LiA6Ie077ybCiAgNS4g"
        "5bCG5paH5qGj5YaZ5YWl5qih5Z2X55uu5b2V5oiW6aG555uuIGRvY3MvIOS4i+eahOWQiOmAguS9jee9ruOAggoKICDp"
        "h43opoHnuqbmnZ/vvJrmlofmoaPlhoXlrrnpnIDlh4bnoa7lj43mmKDku6PnoIHlrp7pmYXooYzkuLrvvIzkuI3oh4bm"
        "tYvmiJbomZrmnoTkuI3lrZjlnKjnmoTlip/og73jgIIKYWNjZXB0YW5jZV9jcml0ZXJpYTogPgogIDEuIOaWh+aho+im"
        "huebluaooeWdl+eahOWFqOmDqOWFrOW8gCBBUEnvvIjlh73mlbDnrb7lkI0gKyDlj4LmlbDor7TmmI4gKyDov5Tlm57l"
        "gLwgKyDnpLrkvovvvInvvJsKICAyLiDljIXlkKvmnrbmnoTor7TmmI7nq6DoioLvvIjnu4Tku7blhbPns7vjgIHmlbDm"
        "ja7mtYHjgIHkvp3otZbvvInvvJsKICAzLiDku6PnoIHnpLrkvovlj6/miafooYzkuJTkuI7lvZPliY0gQVBJIOetvuWQ"
        "jeS4gOiHtO+8mwogIDQuIOaWh+aho+ivreiogOS4juaooeWdl+aXouacieazqOmHiuS4gOiHtO+8mwogIDUuIOaXoOiZ"
        "muaehOWKn+iDveaPj+i/sO+8jOaJgOacieaPj+i/sOWdh+acieS7o+eggeWvueW6lO+8mwogIDYuIE1hcmtkb3duIOag"
        "vOW8j+inhOiMg++8iOagh+mimOWxgue6p+OAgeS7o+eggeWdl+ivreazleOAgemTvuaOpeacieaViO+8ieOAggp2ZXJp"
        "ZmljYXRpb25fY29tbWFuZDogbnVsbAptYXhfaXRlcmF0aW9uczogOAptYXhfY29zdF91c2Q6IDIuMApzdWNjZXNzX3Nj"
        "b3JlX3RocmVzaG9sZDogODUKbm9fcHJvZ3Jlc3NfcGF0aWVuY2U6IDQKYXBwcm92YWxfbW9kZTogZmlyc3QKY29uZmln"
        "OgogIHBlcm1pc3Npb25fbW9kZTogYXV0bwo="
    ),
    # preening_substrate.yaml
    (
        "IyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDi"
        "lIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDi"
        "lIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAKIyBSb3V0aW5lIOmihOiuvuaooeeJiCDi"
        "gJQg6aG555uu5p625p6E5riF5YeP77yIUHJlZW5pbmcgU3Vic3RyYXRl77yJCiMKIyDlrqHmibnmqKHlvI86IGZpcnN0"
        "77yI6aaW6L2u6ZyA5Lq65bel5a6h5om5IHBsYW7vvIkKIyDlkb3ku6Tpl6jmjqc6IHJ1ZmYgY2hlY2vvvIjlrqLop4Lp"
        "lJrngrnvvIkKIyDlt6XnqIvojIPlvI86IOato+S6pOWIhuinoyArIOivreS5ieinhOiMg+WMliArIOS7o+eggea4heWH"
        "j+eahCBFdmFsdWF0b3ItT3B0aW1pemVyIOiHquS4u+i/reS7o++8jAojICAgICAgICAgICDpppbova4gcGxhbiDlrqHm"
        "ibnnoa7kv53mlrnlkJHmraPnoa7vvIzlkI7nu63ov63ku6Plhajoh6rliqjmjqjov5sKIyDilIDilIDilIDilIDilIDi"
        "lIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDi"
        "lIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDi"
        "lIDilIDilIDilIDilIDilIDilIDilIDilIAKCnByZXNldF9pZDogcHJlZW5pbmdfc3Vic3RyYXRlCmRpc3BsYXlfbmFt"
        "ZTogIumhueebruaetuaehOa4heWHjyIKZGVzY3JpcHRpb246ID4KICDpnaLlkJHnm67moIfpobnnm67nmoTnu5PmnoTm"
        "gKfnhrXlh4/vvJrosIPnlKggL3ByZWVuaW5nLXN1YnN0cmF0ZSDmioDog73vvIzmsr/lip/og73nu7Tluqblr7nmqKHl"
        "nZfov5vooYwKICDmraPkuqTliIbop6PjgIHnsr7nroDlhpfkvZnkuI7mrbvku6PnoIHjgIHop4TojIPljJblkb3lkI3k"
        "u6Xnsr7noa7lj43mmKDkuJrliqHor63kuYnjgIIKICDph4fnlKggZmlyc3Qg5a6h5om55qih5byP4oCU4oCU6aaW6L2u"
        "5LulIHBsYW4g5b2i5byP56Gu6K6k6YeN5p6E5pa55ZCR77yM5LmL5ZCO55SxIExMTS1hcy1KdWRnZSArIENvbW1hbmQg"
        "R2F0ZQogIO+8iFJ1ZmbvvInpqbHliqjnmoQgRXZhbHVhdG9yLU9wdGltaXplciDpl63njq/lhajoh6rliqjmjqjov5vv"
        "vJvku6XnjrDmnInmtYvor5Xml6Dlm57lvZLkuI7ooYzmlbDlh4Dlh48g4omlNSUKICDkuLrlrqLop4LpqozmlLbvvIzo"
        "voPpq5jnmoTov63ku6PkuI7miJDmnKzmiqTmoI/ljLnphY3mnrbmnoTnuqfph43mnoTnmoTlpI3mnYLluqbjgIIKY2F0"
        "ZWdvcnk6IGFyY2hpdGVjdHVyZQp2ZXJzaW9uOiAxLjAuMApmZWF0dXJlc19zaG93Y2FzZToKICAtICJQbGFuIOWuoeaJ"
        "uSDigJQgZmlyc3Qg5qih5byP77yM6aaW6L2u5LulIHBsYW4g56Gu6K6k6YeN5p6E5pa55ZCRIgogIC0gIkNvbW1hbmQg"
        "R2F0ZSDigJQgUnVmZiDpgIDlh7rnoIHkvZzkuLrlrqLop4Lpqozor4HplJrngrkiCiAgLSAiUmVmbGV4aW9uIOKAlCDo"
        "t6jov63ku6Plj43mgJ3orrDlv4bpqbHliqjnu5PmnoTmvJTov5siCiAgLSAiTExNLWFzLUp1ZGdlIOKAlCDnu5PmnoTl"
        "jJbor4TliIYgKyB2ZXJkaWN0IOWIpOWumiIKICAtICLpq5jpooTnrpfmiqTmoI8g4oCUIOWMuemFjeaetuaehOe6p+mH"
        "jeaehO+8iDIwIOi9riAvICQxNSDkuIrpmZDvvIkiCgp0aXRsZTogIlByZWVuaW5nIFN1YnN0cmF0ZSIKZ29hbDogPgog"
        "IOWvueebruagh+mhueebruaJp+ihjCAvcHJlZW5pbmctc3Vic3RyYXRlIOWRveS7pO+8jOi/m+ihjOWFqOmdoueahOat"
        "o+S6pOWIhuino+S4juW3peeoi+eGteWHj+OAggogIOivt+S9v+eUqCBTa2lsbCDlt6XlhbfosIPnlKggcHJlZW5pbmct"
        "c3Vic3RyYXRlIOaKgOiDve+8jOWvuemhueebruWQhOS7o+eggeaooeWdl+aJp+ihjO+8mgogIDEuIOato+S6pOWIhuin"
        "oyDigJQg5oyJ5Yqf6IO957u05bqm5a+55a+56LGh44CB5qih5Z6L44CB5Ye95pWw44CB5paH5Lu26L+b6KGM6Kej6ICm"
        "77yM56Gu5L+d5Y2V5LiA6IGM6LSj5LiO5riF5pmw6L6555WM77ybCiAgMi4g5Luj56CB5riF5YePIOKAlCDnsr7nroDl"
        "hpfkvZnpgLvovpHjgIHmrbvku6PnoIHlkozov4fluqbmir3osaHvvIzph4/ljJbmsYfmiqXlj5jmm7TliY3lkI7ooYzm"
        "lbDlt67lvILvvJsKICAzLiDor63kuYnop4TojIPljJYg4oCUIOWuoeinhuaJgOacieWRveWQjeS9v+WFtueyvuehruWP"
        "jeaYoOWunumZheWKn+iDveS4juS4muWKoeivreS5ieOAggoKICDnuqbmnZ/vvJrkuI3lvpfnoLTlnY/njrDmnInlip/o"
        "g73nibnmgKfvvIzkuI3lvpflvJXlhaXmlrDnvLrpmbfjgIIKYWNjZXB0YW5jZV9jcml0ZXJpYTogPgogIDEuIOaJgOac"
        "ieWPmOabtOmAmui/h+eOsOaciea1i+ivleWll+S7tu+8iHV2IHJ1biBweXRlc3TvvIzml6Dlm57lvZLvvInvvJsKICAy"
        "LiDlj5jmm7TliY3lkI7ku6PnoIHooYzmlbDlh4/lsJEg4omlNSXvvIzkuJTml6Dlip/og73mgKflm57lvZLvvJsKICAz"
        "LiDoh7PlsJEgMyDkuKrmqKHlnZflrozmiJDmraPkuqTliIbop6PvvIjogYzotKPljZXkuIDjgIHovrnnlYzmuIXmmbDv"
        "vInvvJsKICA0LiDmiYDmnInlhazlhbEgQVBJIOetvuWQjeWSjOaguOW/g+i/kOihjOaXtuihjOS4uuS4jeWPmO+8mwog"
        "IDUuIFJ1ZmYgbGludCDpm7bmlrDlop7ov53op4TvvIh1diBydW4gcnVmZiBjaGVja++8ieOAggp2ZXJpZmljYXRpb25f"
        "Y29tbWFuZDogInV2IHJ1biBydWZmIGNoZWNrIgptYXhfaXRlcmF0aW9uczogMjAKbWF4X2Nvc3RfdXNkOiAxNS4wCnN1"
        "Y2Nlc3Nfc2NvcmVfdGhyZXNob2xkOiA4NQpub19wcm9ncmVzc19wYXRpZW5jZTogMwphcHByb3ZhbF9tb2RlOiBmaXJz"
        "dApjb25maWc6CiAgd29ya2Zsb3c6IHBoYXNlZCAgICAgICAgIyDlkK/nlKjkuInnm7jkvY3vvJpQTEFOKOS6p+WHuuiu"
        "oeWIkinihpJJTVBMRU1FTlQo6JC95ZywKeKGkkZJTkFMSVpFKOiHquajgCvlu7ogUFIp4oaS5Lq65belIE1lcmdlCiAg"
        "cGVybWlzc2lvbl9tb2RlOiBwbGFuICAgIyBQTEFOIOebuOS9jeWIneWAvO+8m29yY2hlc3RyYXRvciDmjInnm7jkvY3m"
        "jqjov5vliIfliLAgYWNjZXB0RWRpdHPvvIhJTVBMRU1FTlQvRklOQUxJWkXvvIkKICBtYXhfdHVybnM6IDMwCiAgdGlt"
        "ZW91dF9zZWNvbmRzOiAxMDgwMCAgIyDljZXova4gM2gg5LiK6ZmQ77yM6L+c6LaF5penIDMwMHMg6buY6K6k77yM5p2c"
        "57ud5rex5bqm5Lu75Yqh6LaF5pe256m66L2sCg=="
    ),
    # test_enhancement.yaml
    (
        "IyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDi"
        "lIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDi"
        "lIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAKIyBSb3V0aW5lIOmihOiuvuaooeeJiCDi"
        "gJQg5rWL6K+V6KaG55uW5aKe5by677yIVGVzdCBFbmhhbmNlbWVudO+8iQojCiMg5a6h5om55qih5byPOiBldmVyee+8"
        "iOavj+i9ruS6uuW3peWuoeaJue+8iQojIOWRveS7pOmXqOaOpzogcHl0ZXN077yI5rWL6K+V6amx5Yqo6aqM6K+B77yJ"
        "CiMg5bel56iL6IyD5byPOiBIdW1hbi1pbi10aGUtTG9vcCDlrqHmibnpl6jmjqfvvIhldmVyeSDmqKHlvI/vvInjgIFD"
        "b21tYW5kIEdhdGXvvIhweXRlc3TvvInjgIEKIyAgICAgICAgICAgU2Vzc2lvbiDov57nu63mgKfjgIFtYXhfY29zdCDm"
        "iJDmnKzmiqTmoI8KIyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDi"
        "lIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDi"
        "lIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAKCnByZXNldF9pZDog"
        "dGVzdF9lbmhhbmNlbWVudApkaXNwbGF5X25hbWU6ICLmtYvor5Xopobnm5blop7lvLoiCmRlc2NyaXB0aW9uOiA+CiAg"
        "6Z2i5ZCR55uu5qCH5qih5Z2X55qE5Lq65a6h6amx5Yqo5rWL6K+V5aKe5by677ya5YiG5p6Q5YWs5byAIEFQSSDnmoTm"
        "nKropobnm5bot6/lvoTvvIjmraPluLggLyDovrnnlYwgLyDlvILluLjvvInvvIwKICDmjInkvJjlhYjnuqfooaXlhYXn"
        "i6znq4vjgIHlj6/ph43lpI3jgIHml6Dlia/kvZznlKjnmoTljZXlhYPmtYvor5XjgIIKICDph4fnlKggZXZlcnkg5a6h"
        "5om55qih5byP4oCU4oCU5q+P6L2u6L+t5Luj6L+b5YWlIHBlbmRpbmdfYXBwcm92YWwg5b6F5Lq65bel56Gu6K6k5ZCO"
        "5omN5omn6KGM77yMCiAg6YCC55So5LqO5a+55Y+Y5pu05a6J5YWo5oCn6KaB5rGC6auY55qE5Zy65pmv77yb5LulIHB5"
        "dGVzdCDpgIDlh7rnoIHkvZzkuLogQ29tbWFuZCBHYXRlIOWuouingumqjOivgea1i+ivleato+ehruaAp++8jAogIENs"
        "YXVkZSBDb2RlIOS8muivnei3qOi/reS7o+i/nue7reS7pee0r+enr+a1i+ivleetlueVpeS4iuS4i+aWh++8jAogIFJl"
        "ZmxleGlvbiDlj43mgJ3orrDlv4bkuI4gbWF4X2Nvc3Qg5oiQ5pys5oqk5qCP5YWx5ZCM5L+d6Zqc6LSo6YeP5LiO5Y+v"
        "5o6n5oCn44CCCmNhdGVnb3J5OiB0ZXN0aW5nCnZlcnNpb246IDEuMC4wCmZlYXR1cmVzX3Nob3djYXNlOgogIC0gIkh1"
        "bWFuLWluLXRoZS1Mb29wIOKAlCBldmVyeSDlrqHmibnvvIzmr4/ova7ov63ku6PpnIDkurrlt6Xnoa7orqQiCiAgLSAi"
        "Q29tbWFuZCBHYXRlIOKAlCBweXRlc3Qg6YCA5Ye656CB6aqM6K+B5rWL6K+V5q2j56Gu5oCnIgogIC0gIuS8muivnei/"
        "nue7reaApyDigJQgQ2xhdWRlIENvZGUg6Leo6L+t5Luj57Sv56ev5rWL6K+V562W55Wl5LiK5LiL5paHIgogIC0gIlJl"
        "ZmxleGlvbiDigJQg6K+E5Lyw5Y+N6aaI6amx5Yqo5rWL6K+V562W55Wl6Ieq5pS56L+bIgogIC0gIuaIkOacrOaKpOag"
        "jyDigJQgbWF4X2Nvc3Qg57Sv6K6h6LS555So6LaF6ZmQ5Y2z57uI5q2iIgoKdGl0bGU6ICJUZXN0IEVuaGFuY2VtZW50"
        "Igpnb2FsOiA+CiAg5Li655uu5qCH5Luj56CB5qih5Z2X6KGl5YWF6auY6LSo6YeP5Y2V5YWD5rWL6K+V44CC5omn6KGM"
        "5Lul5LiL5q2l6aqk77yaCgogIDEuIOWIhuaekOebruagh+aooeWdl+eahOWFrOW8gOWHveaVsOOAgeexu+WSjOaWueaz"
        "le+8mwogIDIuIOivhuWIq+acquiiq+a1i+ivleimhueblueahOWFs+mUrui3r+W+hO+8iOato+W4uOi3r+W+hOOAgei+"
        "ueeVjOadoeS7tuOAgeW8guW4uOi3r+W+hO+8ie+8mwogIDMuIOaMieS8mOWFiOe6p+eUn+aIkOa1i+ivleeUqOS+i++8"
        "muaguOW/g+mAu+i+kSDihpIg6L6555WM5p2h5Lu2IOKGkiDlvILluLjlpITnkIbvvJsKICA0LiDnoa7kv53miYDmnInm"
        "lrDlop7mtYvor5Xni6znq4vjgIHlj6/ph43lpI3jgIHml6Dlia/kvZznlKjvvJsKICA1LiDmtYvor5Xmlofku7bmlL7n"
        "va7lnKjpobnnm67nmoQgdGVzdHMvIOebruW9leS4i++8jOmBteW+qumhueebruaXouacieeahOa1i+ivlee7hOe7h+in"
        "hOiMg+OAggoKICDph43opoHnuqbmnZ/vvJrmtYvor5XkuI3lupQgbW9jayDlhoXpg6jnp4HmnInmlrnms5XvvIzlupTp"
        "gJrov4flhazlvIDmjqXlj6Ppqozor4HooYzkuLrjgIIKYWNjZXB0YW5jZV9jcml0ZXJpYTogPgogIDEuIGB1diBydW4g"
        "cHl0ZXN0YCDpgIDlh7rnoIHkuLogMO+8iOaJgOaciea1i+ivlemAmui/h++8jOWQq+aWsOWinuWSjOaXouacie+8ie+8"
        "mwogIDIuIOaWsOWinua1i+ivleimhuebluiHs+WwkSAzIOS4quaguOW/g+WHveaVsC/mlrnms5XnmoTlhbPplK7ot6/l"
        "voTvvJsKICAzLiDljIXlkKvoh7PlsJEgMSDkuKrovrnnlYzmnaHku7bmtYvor5XlkowgMSDkuKrlvILluLjlpITnkIbm"
        "tYvor5XvvJsKICA0LiDmtYvor5Xku6PnoIHmuIXmmbDjgIHmnIkgZG9jc3RyaW5nIOivtOaYjua1i+ivleaEj+Wbvu+8"
        "mwogIDUuIOS4jeS/ruaUueebruagh+aooeWdl+eahOa6kOS7o+eggeOAggp2ZXJpZmljYXRpb25fY29tbWFuZDogInV2"
        "IHJ1biBweXRlc3QgLXggLXEiCm1heF9pdGVyYXRpb25zOiAxMAptYXhfY29zdF91c2Q6IDUuMApzdWNjZXNzX3Njb3Jl"
        "X3RocmVzaG9sZDogODUKbm9fcHJvZ3Jlc3NfcGF0aWVuY2U6IDMKYXBwcm92YWxfbW9kZTogZXZlcnkKY29uZmlnOgog"
        "IHBlcm1pc3Npb25fbW9kZTogYXV0bwo="
    ),
)

_META_KEYS = (
    "display_name",
    "description",
    "category",
    "version",
    "approval_mode",
)


def _meta_from(raw: dict) -> dict:
    return {k: raw[k] for k in _META_KEYS if k in raw}


def upgrade() -> None:
    bind = op.get_bind()
    stmt = sa.text(
        f"""
        INSERT INTO {SCHEMA}.definitions
            (kind, key, format, source, meta, version, checksum, owner_id, is_system, is_enabled, sort_order)
        VALUES ('routine_preset', :key, 'yaml', :source, :meta, :version, :checksum, 'system', TRUE, TRUE, :sort_order)
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
        if not isinstance(raw, dict) or not raw.get("preset_id"):
            continue
        key = str(raw["preset_id"]).strip()
        version = str(raw.get("version")) if raw.get("version") is not None else None
        checksum = hashlib.sha256(source.encode("utf-8")).hexdigest()
        bind.execute(
            stmt,
            {
                "key": key,
                "source": source,
                "meta": _meta_from(raw),
                "version": version,
                "checksum": checksum,
                "sort_order": idx,
            },
        )


def downgrade() -> None:
    # 非破坏 no-op：定义源为 SSOT，回滚不删数据。
    pass
