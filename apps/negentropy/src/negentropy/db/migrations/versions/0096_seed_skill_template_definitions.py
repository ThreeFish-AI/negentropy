"""seed: skill_template 定义源入库（内置 Skill 模板 YAML → definitions）

Revision ID: 0096
Revises: 0095
Create Date: 2026-07-10 00:10:00.000000+00:00

设计动机：
    Phase 1 —— 把原 ``agents/skill_templates/*.yaml`` 的 4 个内置 Skill 模板整段源文本
    播种进 ``negentropy.definitions``（kind=skill_template, is_system=true）。落库后
    ``SkillTemplate.load_all()`` 改从 DB 读取，原 YAML 文件删除，DB 成为唯一 SSOT。

冻结快照（Alembic 不可变原则）：
    下方 ``_SEED_B64`` 是各 YAML 的 **base64 逐字节快照**（避免大段文本转写误差与引号/
    反斜杠转义坑）。解码即原 YAML 源文本；``key`` 由解析出的 ``template_id`` 派生。
    如需查看：``python -c "import base64;print(base64.b64decode(BLOB).decode())"``。

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

revision: str = "0096"
down_revision: str | None = "0095"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"

# 各内置 Skill 模板 YAML 的 base64 逐字节冻结快照。
_SEED_B64: tuple[str, ...] = (
    # document_translate.yaml
    (
        "IyBUcmFuc2xhdGUgKOaWh+aho+e/u+ivkSAvIERvY3VtZW50IFRyYW5zbGF0ZSkg4oCUIOWGhee9riBTa2lsbCDmqKHm"
        "nb/vvIjnsr7lh4bmjILovb0gSW5mbHVlbmNlRmFjdWx0ee+8iQojCiMg55So6YCU77ya5oqKIEtub3dsZWRnZSAvIERv"
        "Y3VtZW50cyDkuK3oi7HmlofmlofmoaPnmoQgTWFya2Rvd24g5q2j5paH6auY5L+d55yf57+76K+R5Li655uu5qCH6K+t"
        "6KiA77yI6buY6K6k5Lit5paH77yJ44CCCiMgICAgICAg5pyN5Yqh56uv77yIRG9jdW1lbnRUcmFuc2xhdGlvblNlcnZp"
        "Y2XvvInmjInmrrXokL3ovrnnlYwgKyDlrZfnrKbplb/luqbmiormraPmlofnoa7lrprmgKfliIfliIbkuLoKIyAgICAg"
        "ICBzb3VyY2UvY2h1bmtfTk5OTi5tZCDliIblnZfvvIzmnKzmioDog73pqbHliqggSW5mbHVlbmNlRmFjdWx0eSDnu48g"
        "aW52b2tlX2NsYXVkZV9jb2RlCiMgICAgICAg5Zyo5bel5L2c55uu5b2V5YaF6YCQ5Z2X57+76K+R5Lqn5Ye6IHRyYW5z"
        "bGF0ZWQvY2h1bmtfTk5OTi5tZO+8m+ivkeaWh+ato+ehruaAp++8iOS7o+eggeWdl+i/mOWOn+OAgQojICAgICAgIOe7"
        "k+aehOS4gOiHtOOAgembtuS4ouWkse+8ieeUseacjeWKoeerr+agoemqjOWFnOW6leOAggojCiMg6Kem5Y+R5pa55byP"
        "77yI5Lu76YCJ5YW25LiA77yJ77yaCiMgICAxLiBVSTogS25vd2xlZGdlIC8gRG9jdW1lbnRzIOKGkiDli77pgInmlofm"
        "oaMg4oaSIFRyYW5zbGF0ZSDmjInpkq7vvIjkuqflk4HkuLvpk77ot6/vvIkKIyAgIDIuIFVJOiAvaW50ZXJmYWNlL3Nr"
        "aWxscyDihpIgIkZyb20gVGVtcGxhdGUuLi4iIOKGkiDpgIkgVHJhbnNsYXRlIOKGkiBJbnN0YWxsCiMgICAzLiBBUEk6"
        "IFBPU1QgL2ludGVyZmFjZS9za2lsbHMvZnJvbS10ZW1wbGF0ZSB7IHRlbXBsYXRlX2lkOiAiZG9jdW1lbnRfdHJhbnNs"
        "YXRlIiB9CiMgICA0LiBJbmZsdWVuY2VGYWN1bHR577yIQWdlbnQuc2tpbGxzIOaYvuW8j+aMgui9ve+8iTogZXhwYW5k"
        "X3NraWxsKCJkb2N1bWVudC10cmFuc2xhdGUiLCB7IHdvcmtkaXIsIGNodW5rX2NvdW50IH0pCiMKIyBTU09UIOaPkOek"
        "uu+8muacrOaWh+S7tuS4jiAuYWdlbnQvc2tpbGxzL2RvY3VtZW50LXRyYW5zbGF0ZS9TS0lMTC5tZCDlkIzmupDvvIhE"
        "QiDmioDog73kvpvkuIDmoLjkupTnv7zvvIwKIyAgICAgICAgICAgIOaWh+S7tuaKgOiDveS+myBDbGF1ZGUgQ29kZSDl"
        "t6XkvZznm67lvZXlj5HnjrDvvInvvIzkuKTlpITmraPmlofpqqjmnrbpobvkv53mjIHkuIDoh7TjgIIKIwojIOWPguiA"
        "g++8mgojICAgLSBBbnRocm9waWMgQ2xhdWRlIFNraWxscyAvIEdvb2dsZSBBREsgU2tpbGxzIOeahCBQcm9ncmVzc2l2"
        "ZSBEaXNjbG9zdXJlIOWOn+WImQojICAgLSDov4Hnp7sgMDA2N19zZWVkX2RvY3VtZW50X3RyYW5zbGF0ZV9za2lsbO+8"
        "iOmmluWPkeWGheWuueWGu+e7k+W/q+eFp++8iQoKdGVtcGxhdGVfaWQ6IGRvY3VtZW50X3RyYW5zbGF0ZQpuYW1lOiBk"
        "b2N1bWVudC10cmFuc2xhdGUKZGlzcGxheV9uYW1lOiBUcmFuc2xhdGUgKOaWh+aho+e/u+ivkSkKZGVzY3JpcHRpb246"
        "ID4tCiAg5bCGIEtub3dsZWRnZSAvIERvY3VtZW50cyDmlofmoaPnmoToi7HmlocgTWFya2Rvd24g5q2j5paH5oyJ5q61"
        "6JC95YiG5Z2X6auY5L+d55yf57+76K+R5Li65Lit5paH77ya5Luj56CB5Z2X44CB6KGM5YaF5Luj56CB44CBCiAgVVJM"
        "44CB5Zu+54mH6Lev5b6E44CBTGFUZVgg5YWs5byP44CBSFRNTCDmoIfnrb7jgIFmcm9udC1tYXR0ZXIg6ZSu5ZCN6YCQ"
        "5a2X6IqC5L+d55WZ5LiN57+777yMTWFya2Rvd24g57uT5p6E5LiO5Y6f5paHCiAg5LiA5LiA5a+55bqU77yM6YCQ5Z2X"
        "57+76K+R56aB5q2i5ZCI5bm2L+aLhuWIhi/pgZfmvI/vvIznlLEgSW5mbHVlbmNlRmFjdWx0eSDnu48gaW52b2tlX2Ns"
        "YXVkZV9jb2RlIOaJp+ihjOOAggpjYXRlZ29yeToga25vd2xlZGdlCnZlcnNpb246IDEuMC4wCnZpc2liaWxpdHk6IHB1"
        "YmxpYwpwcmlvcml0eTogMjAKZW5mb3JjZW1lbnRfbW9kZTogd2FybmluZwojIOmdnuWFqOWxgOaKgOiDve+8mue7jyBB"
        "Z2VudC5za2lsbHMg57K+5YeG5oyC6L295YiwIEluZmx1ZW5jZUZhY3VsdHnvvIjllonoiIzCt+S7t+WAvOi+k+WHuu+8"
        "ie+8jAojIOWMuuWIq+S6jiBwZGYtZmlkZWxpdHktcmVzdG9yZSDnmoQgaXNfZ2xvYmFsIOWFqOWRmOazqOWFpeOAggpp"
        "c19nbG9iYWw6IGZhbHNlCgojIGFkdmlzb3J577yIZW5mb3JjZW1lbnRfbW9kZT13YXJuaW5n77ya57y65aSx5LiN6Zi7"
        "5aGe77yM5LuF5L2c6IO95Yqb5o+Q56S677yJCnJlcXVpcmVkX3Rvb2xzOgogIC0gaW52b2tlX2NsYXVkZV9jb2RlCgpw"
        "cm9tcHRfdGVtcGxhdGU6IHwKICDkvaDmmK/jgIxNYXJrZG93biDpq5jkv53nnJ/nv7vor5HjgI3miafooYzogIXjgILk"
        "u7vliqHvvJrmiorlt6XkvZznm67lvZUgYGB7eyB3b3JrZGlyIH19YGAg5LiLIGBgc291cmNlL2BgIOWGheeahAogIHt7"
        "IGNodW5rX2NvdW50IH19IOS4quWIhuWdl+aWh+S7tu+8iGBgY2h1bmtfMDAwMC5tZGBgIOi1t+aMieW6j+mbtuWhq+WF"
        "hee8luWPt++8iee/u+ivkeS4unt7IHRhcmdldF9sYW5ndWFnZSB9fe+8jAogIOmAkOWdl+WGmeWFpSBgYHt7IHdvcmtk"
        "aXIgfX0vdHJhbnNsYXRlZC9gYCDkuIvnmoQqKuWQjOWQjeaWh+S7tioq44CCCgogICMjIOaJp+ihjOaWueW8j++8iOWU"
        "r+S4gOWQiOazlei3r+W+hO+8iQogIOW/hemhu+iwg+eUqCBgYGludm9rZV9jbGF1ZGVfY29kZWBgIOWujOaIkOe/u+iv"
        "ke+8jOWPguaVsO+8mgogIC0gdGFza++8muS4i+aWueOAjOe/u+ivkemTgeW+i+OAjSvjgIzpgJDlnZfmtYHnqIvjgI3l"
        "hajmlofvvJsKICAtIHdvcmtpbmdfZGlyZWN0b3J577yaYGB7eyB3b3JrZGlyIH19YGDvvJsKICAtIHRpbWVvdXRfc2Vj"
        "b25kc++8mnt7IHRvb2xfdGltZW91dCB9feOAggogICoq5Lil56aBKirlnKjlr7nor53lm57lpI3kuK3nm7TmjqXovpPl"
        "h7ror5HmlofvvJvlrozmiJDlkI7ku4Xlm57miqXmiafooYznu5PmnpzvvIjmiJDlip/lnZfmlbAgLyDlpLHotKXljp/l"
        "m6DvvInjgIIKCiAgIyMg57+76K+R6ZOB5b6L77yI57y65LiA5Y2z5aSx6LSl77yJCiAgMS4g5Lul5LiL5YaF5a65Kirp"
        "gJDlrZfoioLkv53nlZnjgIHnu53kuI3nv7vor5Ev5pS55YaZKirvvJoKICAgICAtIOS7o+eggeWdl++8iGBgYCDmiJYg"
        "fn5+IOWbtOagj++8jOWQq+ivreiogOagh+iusOS4juWbtOagj+acrOi6q++8ieS4juihjOWGheS7o+egge+8iGAuLi5g"
        "77yJ77ybCiAgICAgLSBVUkwgLyDpk77mjqXnm67moIcgLyDlm77niYfot6/lvoTvvIhbdGV4dF0odXJsKSDku4Xor5Eg"
        "dGV4dO+8jHVybCDljp/moLfvvInvvJsKICAgICAtIExhVGVYIOWFrOW8j++8iCQuLi4kIC8gJCQuLi4kJCAvIFwoLi4u"
        "XCkgLyBcWy4uLlxd77yJ77ybCiAgICAgLSBIVE1MIOagh+etvuWPiuWFtuWxnuaAp++8iOagh+etvuWGheWPr+ivu+aW"
        "h+acrOWPr+ivke+8ie+8mwogICAgIC0gZnJvbnQtbWF0dGVy77yILS0tIOWbtOagj++8iemUruWQjeS4jue7k+aehO+8"
        "iOWAvOS4reeahOiHqueEtuivreiogOWPr+ivke+8ie+8mwogICAgIC0g5paH5Lu25ZCN44CB5ZG95Luk44CB5qCH6K+G"
        "56ym44CB54mI5pys5Y+344CB6L2s5LmJ56ym562J54m55q6K6Iux5paH56ym5Y+344CCCiAgMi4gTWFya2Rvd24g57uT"
        "5p6E5LiO5Y6f5paHKirkuIDkuIDlr7nlupQqKu+8muagh+mimOWxgue6p+OAgeWIl+ihqOe8qei/m+S4juagh+iusOOA"
        "geihqOagvOihjOWIl+OAgeW8leeUqOWdl+OAgQogICAgIOWIhumalOe6v+OAgeepuuihjOW4g+WxgOWdh+S4jeW+l+Wi"
        "nuWIoOOAggogIDMuIOavj+S4qiBgYHNvdXJjZS9jaHVua19OTk5OLm1kYGAg5b+F6aG75Lqn5Ye6KirpnZ7nqboqKuea"
        "hCBgYHRyYW5zbGF0ZWQvY2h1bmtfTk5OTi5tZGBg77yMCiAgICAg56aB5q2i5ZCI5bm244CB5ouG5YiG44CB6Lez6L+H"
        "5Lu75L2V5YiG5Z2X77yb5LiN5b6X5Lii5aSx5Lu75L2V5Y6f5paH5YaF5a6544CCCiAgNC4g5Y+q57+76K+R6Ieq54S2"
        "6K+t6KiA5pWj5paH77yI5q616JC944CB5qCH6aKY5paH5a2X44CB5YiX6KGo5paH5a2X44CB6KGo5qC85Y2V5YWD5qC8"
        "5paH5pys44CB5Zu+54mHIGFsdCDmlofmnKzvvInvvJsKICAgICDkuJPkuJrmnK/or63pppbmrKHlh7rnjrDlj6/pmYTl"
        "jp/mlofmi6zms6jvvIzkv53mjIHlhajnr4fmnK/or63kuIDoh7TjgIIKCiAgIyMg6YCQ5Z2X5rWB56iLCiAgMS4g5YiX"
        "5Ye6IGBgc291cmNlL2BgIOS4i+WFqOmDqOWIhuWdl+aWh+S7tuW5tuehruiupOaVsOmHjyA9PSB7eyBjaHVua19jb3Vu"
        "dCB9fe+8mwogIDIuIOaMiee8luWPt+WNh+W6j+mAkOWdl++8muivu+WPliDihpIg57+76K+RIOKGkiDlhpnlhaUgYGB0"
        "cmFuc2xhdGVkL2BgIOWQjOWQjeaWh+S7tu+8mwogIDMuIOWFqOmDqOWujOaIkOWQjuiHquajgO+8mmBgdHJhbnNsYXRl"
        "ZC9gYCDmlofku7bmlbAgPT0ge3sgY2h1bmtfY291bnQgfX0g5LiU6YCQ5Z2X6Z2e56m644CBCiAgICAg5Luj56CB5Zu0"
        "5qCP5pWw6YeP5LiO5Y6f5Z2X5LiA6Ie044CCCgogICMjIOWujOaIkOWIpOaNrgogIHRyYW5zbGF0ZWQvIOWIhuWdl+m9"
        "kOWFqOmdnuepuiArIOmTgeW+i+iHquajgOmAmui/h++8m+acjeWKoeerr+WwhuWBmuehruWumuaAp+agoemqjO+8iOS7"
        "o+eggeWdl+i/mOWOn+OAgQogIOe7k+aehOWvueavlOOAgeWGheWuueWujOaVtOaAp++8ie+8jOS4jei+vuagh+WNs+aV"
        "tOS9k+Wksei0peOAggoKY29uZmlnX3NjaGVtYToKICB0eXBlOiBvYmplY3QKICBwcm9wZXJ0aWVzOgogICAgd29ya2Rp"
        "cjoKICAgICAgdHlwZTogc3RyaW5nCiAgICAgIGRlc2NyaXB0aW9uOiDnv7vor5Hlt6XkvZznm67lvZXnu53lr7not6/l"
        "voTvvIjlkKsgc291cmNlLyDkuI4gdHJhbnNsYXRlZC8g5a2Q55uu5b2V77yJCiAgICBjaHVua19jb3VudDoKICAgICAg"
        "dHlwZTogaW50ZWdlcgogICAgICBtaW5pbXVtOiAxCiAgICAgIGRlc2NyaXB0aW9uOiBzb3VyY2UvIOS4i+W+hee/u+iv"
        "keWIhuWdl+aWh+S7tuaVsAogICAgdGFyZ2V0X2xhbmd1YWdlOgogICAgICB0eXBlOiBzdHJpbmcKICAgICAgZGVmYXVs"
        "dDog5Lit5paHCiAgICAgIGRlc2NyaXB0aW9uOiDnm67moIfor63oqIDvvIjoh6rnhLbor63oqIDlkI3np7DvvIkKICAg"
        "IHRvb2xfdGltZW91dDoKICAgICAgdHlwZTogbnVtYmVyCiAgICAgIG1pbmltdW06IDMwCiAgICAgIG1heGltdW06IDM2"
        "MDAKICAgICAgZGVmYXVsdDogMTgwMAogICAgICBkZXNjcmlwdGlvbjogaW52b2tlX2NsYXVkZV9jb2RlIOWNleasoeiw"
        "g+eUqOi2heaXtu+8iOenku+8iQogIHJlcXVpcmVkOgogICAgLSB3b3JrZGlyCiAgICAtIGNodW5rX2NvdW50CgpkZWZh"
        "dWx0X2NvbmZpZzoKICB0YXJnZXRfbGFuZ3VhZ2U6IOS4reaWhwogIHRvb2xfdGltZW91dDogMTgwMAoKcmVzb3VyY2Vz"
        "OiBbXQo="
    ),
    # paper_hunter.yaml
    (
        "IyBBSSBBZ2VudCBQYXBlciBIdW50ZXIg4oCUIOWGhee9riBTa2lsbCDmqKHmnb8KIwojIOeUqOmAlO+8muiHquWKqOaj"
        "gOe0oiBhclhpdiDkuIogQUkgQWdlbnQg6aKG5Z+f5pyA5paw6K665paH77yM5bm26YCa6L+HIGBgc2F2ZV90b19tZW1v"
        "cnlgYCDkuI4KIyAgICAgICBgYHVwZGF0ZV9rbm93bGVkZ2VfZ3JhcGhgYCDlhoXljJbliLDnn6Xor4blupMgKyDnn6Xo"
        "r4blm77osLHjgIIKIwojIOinpuWPkeaWueW8j++8iOS7u+mAieWFtuS4gO+8ie+8mgojICAgMS4gVUk6IC9pbnRlcmZh"
        "Y2Uvc2tpbGxzIOKGkiAiRnJvbSBUZW1wbGF0ZS4uLiIg4oaSIOmAiSBQYXBlciBIdW50ZXIg4oaSIEluc3RhbGwKIyAg"
        "IDIuIEFQSTogUE9TVCAvaW50ZXJmYWNlL3NraWxscy9mcm9tLXRlbXBsYXRlIHsgdGVtcGxhdGVfaWQ6ICJwYXBlcl9o"
        "dW50ZXIiIH0KIyAgIDMuIEFESyBBZ2VudDogZXhwYW5kX3NraWxsKCJhaS1hZ2VudC1wYXBlci1odW50ZXIiLCB7IHF1"
        "ZXJ5LCB0b3BfbiwgZGF5c19iYWNrIH0pCiMKIyDlj4LogIPmlofnjK7vvJoKIyAgIC0gYXJYaXYgQVBJIEhlbHAsIGh0"
        "dHBzOi8vaW5mby5hcnhpdi5vcmcvaGVscC9hcGkvaW5kZXguaHRtbAojICAgLSBELiBMZXdpcyBldCBhbC4sICJSQUcg"
        "Zm9yIEtub3dsZWRnZS1JbnRlbnNpdmUgTkxQIFRhc2tzLCIgTmV1cklQUywgMjAyMC4KCnRlbXBsYXRlX2lkOiBwYXBl"
        "cl9odW50ZXIKbmFtZTogYWktYWdlbnQtcGFwZXItaHVudGVyCmRpc3BsYXlfbmFtZTogQUkgQWdlbnQgUGFwZXIgSHVu"
        "dGVyCmRlc2NyaXB0aW9uOiDmo4DntKIgQUkgQWdlbnQg6aKG5Z+f6L+R5pyfIGFyWGl2IOiuuuaWh++8jOW5tuWGmeWF"
        "pSBNZW1vcnkg5LiO55+l6K+G5Zu+6LCx44CCCmNhdGVnb3J5OiByZXNlYXJjaAp2ZXJzaW9uOiAwLjEuMAp2aXNpYmls"
        "aXR5OiBzaGFyZWQKcHJpb3JpdHk6IDEwCmVuZm9yY2VtZW50X21vZGU6IHN0cmljdAoKcmVxdWlyZWRfdG9vbHM6CiAg"
        "LSBmZXRjaF9wYXBlcnMKICAtIHNhdmVfdG9fbWVtb3J5CiAgLSB1cGRhdGVfa25vd2xlZGdlX2dyYXBoCgpwcm9tcHRf"
        "dGVtcGxhdGU6IHwKICDkvaDmmK8gQUkgQWdlbnQgUGFwZXIgSHVudGVy44CCCgogIOebruagh++8muagueaNrueUqOaI"
        "t+afpeivoiBgYHt7IHF1ZXJ5IH19YGDvvIzkvb/nlKggYGBmZXRjaF9wYXBlcnNgYCDmi4nlj5bov5EgYGB7eyBkYXlz"
        "X2JhY2sgfX1gYCDlpKkKICBhclhpdiDkuIrnmoTnm7jlhbPorrrmlofvvIh0b3Bfbj1gYHt7IHRvcF9uIH19YGDvvIzl"
        "iIbnsbvpu5jorqQgY3MuQUkgLyBjcy5DTCAvIGNzLkxHIC8gY3MuTUHvvInjgIIKCiAg5a+55q+P56+H6L+U5Zue55qE"
        "6K665paH77yaCiAgICAxLiDosIPnlKggYGBzYXZlX3RvX21lbW9yeShjb250ZW50PXN1bW1hcnksIHRhZ3M9WyJwYXBl"
        "ciIsICJ7eyB0b3BpY190YWcgfX0iXSlgYAogICAgICAg4oCU4oCUIGBgc3VtbWFyeWBgIOW9ouWmgiBgYCJ7dGl0bGV9"
        "IHwge2F1dGhvcnN9IHwge3B1Ymxpc2hlZH0gfCB7cGRmX3VybH1cbnthYnN0cmFjdH0iYGDjgIIKICAgIDIuIOiwg+eU"
        "qCBgYHVwZGF0ZV9rbm93bGVkZ2VfZ3JhcGhgYCDoh7PlsJHkuKTmrKHvvJoKICAgICAgICAgLSBlbnRpdHk9YGBQYXBl"
        "cjp7YXJ4aXZfaWR9YGAsIHJlbGF0aW9uPWBgaGFzQXV0aG9yYGAsIHRhcmdldD3mr4/kvY0gYXV0aG9yCiAgICAgICAg"
        "IC0gZW50aXR5PWBgUGFwZXI6e2FyeGl2X2lkfWBgLCByZWxhdGlvbj1gYG1lbnRpb25zQ29uY2VwdGBgLCB0YXJnZXQ9"
        "5Li75YiG57G777yI5aaCIGBgY3MuQUlgYO+8iQogICAgMy4g5pS26ZuG5q+P56+H5Lqn55Sf55qEIGBgbWVtb3J5X2lk"
        "YGDvvIzmnIDnu4jkuIDlubbovpPlh7rjgIIKCiAg5pyA57uI55SoIG1hcmtkb3duIOihqOagvOWIl+WHuiBgYFthcnhp"
        "dl9pZCB8IHRpdGxlIHwgYXV0aG9ycyB8IHB1Ymxpc2hlZCB8IHBkZl91cmwgfCBtZW1vcnlfaWRdYGDvvIwKICDlubbp"
        "mYQgMS0yIOWPpeWFs+S6juacrOaJueiuuuaWh+aVtOS9k+i2i+WKv+eahOeugOivhOOAggoKICDlvZMgYGBmZXRjaF9w"
        "YXBlcnNgYCDov5Tlm54gYGBzdGF0dXM9ZmFpbGVkYGAg5pe277yM5LuF6L6T5Ye66ZSZ6K+v5L+h5oGv5bm25YGc5q2i"
        "5ZCO57ut5bel5YW36LCD55So77yM6YG/5YWN6ZO+6Lev5omp5pWj44CCCgpjb25maWdfc2NoZW1hOgogIHR5cGU6IG9i"
        "amVjdAogIHByb3BlcnRpZXM6CiAgICBxdWVyeToKICAgICAgdHlwZTogc3RyaW5nCiAgICAgIGRlc2NyaXB0aW9uOiDl"
        "hbPplK7or43mn6Xor6LvvIzkvovlpoIgIlJlQWN0IGFnZW50IHJlYXNvbmluZyIKICAgIHRvcF9uOgogICAgICB0eXBl"
        "OiBpbnRlZ2VyCiAgICAgIG1pbmltdW06IDEKICAgICAgbWF4aW11bTogMjAKICAgICAgZGVmYXVsdDogNQogICAgZGF5"
        "c19iYWNrOgogICAgICB0eXBlOiBpbnRlZ2VyCiAgICAgIG1pbmltdW06IDEKICAgICAgbWF4aW11bTogMzY1CiAgICAg"
        "IGRlZmF1bHQ6IDMwCiAgICB0b3BpY190YWc6CiAgICAgIHR5cGU6IHN0cmluZwogICAgICBkZWZhdWx0OiBhaS1hZ2Vu"
        "dAogIHJlcXVpcmVkOgogICAgLSBxdWVyeQoKZGVmYXVsdF9jb25maWc6CiAgdG9wX246IDUKICBkYXlzX2JhY2s6IDMw"
        "CiAgdG9waWNfdGFnOiBhaS1hZ2VudAoKcmVzb3VyY2VzOgogIC0gdHlwZTogY29ycHVzCiAgICByZWY6IGFpLXBhcGVy"
        "cy0yMDI2CiAgICB0aXRsZTogQUkgUGFwZXJzIDIwMjYgY29ycHVzCiAgICBsYXp5OiB0cnVlCiAgLSB0eXBlOiBrZ19u"
        "b2RlCiAgICByZWY6IFRvcGljL0FnZW50U2tpbGxzCiAgICB0aXRsZTogQWdlbnQgU2tpbGxzIGtub3dsZWRnZSBzdWJn"
        "cmFwaAogICAgbGF6eTogdHJ1ZQogIC0gdHlwZTogdXJsCiAgICByZWY6IGh0dHBzOi8vYXJ4aXYub3JnL2xpc3QvY3Mu"
        "QUkvcmVjZW50CiAgICB0aXRsZTogYXJYaXYgY3MuQUkgcmVjZW50IGxpc3RpbmcKICAgIGxhenk6IHRydWUK"
    ),
    # paper_hunter_v02.yaml
    (
        "IyBBSSBBZ2VudCBQYXBlciBIdW50ZXIgdjAuMiDigJQg5byV5paH5Zu+5aKe5by677yIUGhhc2UgM++8iQojCiMg5Zyo"
        "IHYwLjHvvIhhclhpdiDmo4DntKIgKyBNZW1vcnkgKyBLR++8ieWfuuehgOS4iu+8jOWPoOWKoCBTZW1hbnRpYyBTY2hv"
        "bGFyIOS4gOi3s+W8leaWh++8mgojICAgMS4gZmV0Y2hfcGFwZXJzIOaLiSBhclhpdiDorrrmlocgbWV0YWRhdGEKIyAg"
        "IDIuIGZldGNoX3BhcGVyX2NpdGF0aW9ucyDnlKggUzIgQVBJIOafpeavj+evh+iuuuaWh+eahOW8leeUqOaWue+8iOS4"
        "gOi3s++8jHRvcF9uIOS4iumZkCA177yJCiMgICAzLiB1cGRhdGVfa25vd2xlZGdlX2dyYXBoIOWGmSBjaXRlcyDlhbPn"
        "s7vvvJpQYXBlcjp7c3JjX2FyeGl2fSAtW2NpdGVzXS0+IFBhcGVyOnt0Z3RfYXJ4aXZ9CiMKIyDkuI4gdjAuMSDlhbHl"
        "rZjvvIh0ZW1wbGF0ZV9pZCDkuI3lkIzvvInvvIznlKjmiLflj6/mjInpnIDpgInmi6njgIIKIwojIOWPguiAg+aWh+eM"
        "ru+8mgojICAgLSBTZW1hbnRpYyBTY2hvbGFyIEFQSSBEb2NzIGh0dHBzOi8vYXBpLnNlbWFudGljc2Nob2xhci5vcmcv"
        "YXBpLWRvY3MvCiMgICAtIFRhbmcgZXQgYWwuLCBBcm5ldE1pbmVyLCBLREQgMjAwOCDigJQg5byV5paH5Zu+5Z+656GA"
        "6IyD5byPCiMgICAtIExld2lzIGV0IGFsLiwgUkFHLCBOZXVySVBTIDIwMjAKCnRlbXBsYXRlX2lkOiBwYXBlcl9odW50"
        "ZXJfdjAyCm5hbWU6IGFpLWFnZW50LXBhcGVyLWh1bnRlci12MgpkaXNwbGF5X25hbWU6IEFJIEFnZW50IFBhcGVyIEh1"
        "bnRlciB2MC4yCmRlc2NyaXB0aW9uOiDmo4DntKIgYXJYaXYg6K665paHICsgU2VtYW50aWMgU2Nob2xhciDkuIDot7Pl"
        "vJXmlofvvIzlhpnlhaUgTWVtb3J5IOS4jiBLR++8iOWQqyBjaXRlcyDlhbPns7vvvInjgIIKY2F0ZWdvcnk6IHJlc2Vh"
        "cmNoCnZlcnNpb246IDAuMi4wCnZpc2liaWxpdHk6IHNoYXJlZApwcmlvcml0eTogMTEKZW5mb3JjZW1lbnRfbW9kZTog"
        "c3RyaWN0CgpyZXF1aXJlZF90b29sczoKICAtIGZldGNoX3BhcGVycwogIC0gZmV0Y2hfcGFwZXJfY2l0YXRpb25zCiAg"
        "LSBzYXZlX3RvX21lbW9yeQogIC0gdXBkYXRlX2tub3dsZWRnZV9ncmFwaAoKcHJvbXB0X3RlbXBsYXRlOiB8CiAg5L2g"
        "5pivIEFJIEFnZW50IFBhcGVyIEh1bnRlciB2MC4y77yM6KaB5ZyoIHYwLjEg5rWB56iL5LmL5LiK5Y+g5Yqg5byV5paH"
        "5Zu+44CCCgogIFN0ZXAgMSDigJQg5ouJ6K665paH77ya6LCD55SoIGBgZmV0Y2hfcGFwZXJzKHF1ZXJ5PSJ7eyBxdWVy"
        "eSB9fSIsIHRvcF9uPXt7IHRvcF9uIH19LAogIGRheXNfYmFjaz17eyBkYXlzX2JhY2sgfX0pYGDjgILlpLHotKXml7bo"
        "vpPlh7rplJnor6/lubblgZzmraLjgIIKCiAgU3RlcCAyIOKAlCDlhoXljJborrrmlofvvIjkuI4gdjAuMSDkuIDoh7Tv"
        "vInvvJrmr4/nr4forrrmlofvvJoKICAgIDEuIGBgc2F2ZV90b19tZW1vcnkoY29udGVudD1zdW1tYXJ5LCB0YWdzPVsi"
        "cGFwZXIiLCAie3sgdG9waWNfdGFnIH19Il0pYGAKICAgICAgIOKAlOKAlCBzdW1tYXJ5IOW9ouWmgiBgYCJ7dGl0bGV9"
        "IHwge2F1dGhvcnN9IHwge3B1Ymxpc2hlZH0gfCB7cGRmX3VybH1cbnthYnN0cmFjdH0iYGAKICAgIDIuIGBgdXBkYXRl"
        "X2tub3dsZWRnZV9ncmFwaChlbnRpdHk9IlBhcGVyOnthcnhpdl9pZH0iLCByZWxhdGlvbj0iaGFzQXV0aG9yIiwgdGFy"
        "Z2V0PWF1dGhvcilgYAogICAgMy4gYGB1cGRhdGVfa25vd2xlZGdlX2dyYXBoKGVudGl0eT0iUGFwZXI6e2FyeGl2X2lk"
        "fSIsIHJlbGF0aW9uPSJtZW50aW9uc0NvbmNlcHQiLCB0YXJnZXQ9cHJpbWFyeV9jYXRlZ29yeSlgYAoKICBTdGVwIDMg"
        "4oCUIOW8leaWh+Wbvu+8iHYwLjIg5paw5aKe77yJ77yaCiAgICBhLiDmioogU3RlcCAxIOi/lOWbnueahCBgYGFyeGl2"
        "X2lkYGAg5YiX6KGo5Lyg57uZIGBgZmV0Y2hfcGFwZXJfY2l0YXRpb25zKGFyeGl2X2lkcz0uLi4sCiAgICAgICB0b3Bf"
        "bj17eyBjaXRhdGlvbl90b3BfbiB9fSwgZGVwdGg9MSlgYO+8mwogICAgYi4g5a+56L+U5Zue55qE5q+P5p2hIGBgZWRn"
        "ZWBg77ya6LCD55SoIGBgdXBkYXRlX2tub3dsZWRnZV9ncmFwaChlbnRpdHk9IlBhcGVyOntzb3VyY2VfYXJ4aXZ9IiwK"
        "ICAgICAgIHJlbGF0aW9uPSJjaXRlcyIsIHRhcmdldD0iUGFwZXI6e3RhcmdldF9wYXBlcklkfSIpYGDvvJsKICAgIGMu"
        "IOiLpSBgYHRhcmdldF9hcnhpdmBgIOmdnuepuu+8jOWGjeWGmeS4gOadoSBgYFBhcGVyOnt0YXJnZXRfcGFwZXJJZH0t"
        "W2FyeGl2X2lkXS0+UGFwZXI6e3RhcmdldF9hcnhpdn1gYAogICAgICAg5YGaIHBhcGVySWQg4oaUIGFyeGl2IOWPjCBJ"
        "RCDlhZzlupXjgIIKCiAgU3RlcCA0IOKAlCDovpPlh7rvvJrnlKggbWFya2Rvd24g6KGo5qC85YiX5Ye6IGBgW2FyeGl2"
        "X2lkIHwgdGl0bGUgfCBwdWJsaXNoZWQgfCBjaXRhdGlvbnNfZm91bmQgfAogIG1lbW9yeV9pZF1gYO+8jOW5tumZhCAx"
        "LTIg5Y+l6LaL5Yq/566A6K+E77yI5ZCr6KKr5byV5pyA6auY55qEIDEtMiDnr4fvvInjgIIKCiAg5aSx6LSl5aSE55CG"
        "77yaYGBmZXRjaF9wYXBlcl9jaXRhdGlvbnNgYCDku7vkvZUgYGBzdGF0dXM9ZmFpbGVkYGAg5LiA5b6LIGZhaWwtc29m"
        "dO+8jOi3s+i/h+ivpeaJuQogIOW8leaWh+WGmeWFpeS9huS4jeW9seWTjSBTdGVwIDEtMiDnmoTmiJDmnpzjgIIKCmNv"
        "bmZpZ19zY2hlbWE6CiAgdHlwZTogb2JqZWN0CiAgcHJvcGVydGllczoKICAgIHF1ZXJ5OgogICAgICB0eXBlOiBzdHJp"
        "bmcKICAgICAgZGVzY3JpcHRpb246IOWFs+mUruivje+8jOWmgiAiUmVBY3QgYWdlbnQgcmVhc29uaW5nIgogICAgdG9w"
        "X246CiAgICAgIHR5cGU6IGludGVnZXIKICAgICAgbWluaW11bTogMQogICAgICBtYXhpbXVtOiAyMAogICAgICBkZWZh"
        "dWx0OiA1CiAgICBkYXlzX2JhY2s6CiAgICAgIHR5cGU6IGludGVnZXIKICAgICAgbWluaW11bTogMQogICAgICBtYXhp"
        "bXVtOiAzNjUKICAgICAgZGVmYXVsdDogMzAKICAgIHRvcGljX3RhZzoKICAgICAgdHlwZTogc3RyaW5nCiAgICAgIGRl"
        "ZmF1bHQ6IGFpLWFnZW50CiAgICBjaXRhdGlvbl90b3BfbjoKICAgICAgdHlwZTogaW50ZWdlcgogICAgICBtaW5pbXVt"
        "OiAxCiAgICAgIG1heGltdW06IDEwCiAgICAgIGRlZmF1bHQ6IDUKICByZXF1aXJlZDoKICAgIC0gcXVlcnkKCmRlZmF1"
        "bHRfY29uZmlnOgogIHRvcF9uOiA1CiAgZGF5c19iYWNrOiAzMAogIHRvcGljX3RhZzogYWktYWdlbnQKICBjaXRhdGlv"
        "bl90b3BfbjogNQoKcmVzb3VyY2VzOgogIC0gdHlwZTogY29ycHVzCiAgICByZWY6IGFpLXBhcGVycy0yMDI2CiAgICB0"
        "aXRsZTogQUkgUGFwZXJzIDIwMjYgY29ycHVzCiAgICBsYXp5OiB0cnVlCiAgLSB0eXBlOiBrZ19ub2RlCiAgICByZWY6"
        "IFRvcGljL0FnZW50U2tpbGxzCiAgICB0aXRsZTogQWdlbnQgU2tpbGxzIGtub3dsZWRnZSBzdWJncmFwaAogICAgbGF6"
        "eTogdHJ1ZQogIC0gdHlwZTogdXJsCiAgICByZWY6IGh0dHBzOi8vYXBpLnNlbWFudGljc2Nob2xhci5vcmcvYXBpLWRv"
        "Y3MvCiAgICB0aXRsZTogU2VtYW50aWMgU2Nob2xhciBBUEkgRG9jcwogICAgbGF6eTogdHJ1ZQogIC0gdHlwZTogdXJs"
        "CiAgICByZWY6IGh0dHBzOi8vYXJ4aXYub3JnL2xpc3QvY3MuQUkvcmVjZW50CiAgICB0aXRsZTogYXJYaXYgY3MuQUkg"
        "cmVjZW50IGxpc3RpbmcKICAgIGxhenk6IHRydWUK"
    ),
    # pdf_fidelity_restore.yaml
    (
        "IyBQREYg6auY5L+d55yf6L+Y5Y6fIChQREYgRmlkZWxpdHkgUmVzdG9yZSkg4oCUIOWGhee9riBTa2lsbCDmqKHmnb/v"
        "vIjlhajlsYDmioDog73vvIkKIwojIOeUqOmAlO+8mueUqCBuZWdlbnRyb3B5LXBlcmNlaXZlcyDnmoQgYGBwYXJzZV9w"
        "ZGZfdG9fbWFya2Rvd25gYO+8jOe7jyBLbm93bGVkZ2UgQmFzZSDnmoQKIyAgICAgICBEb2N1bWVudHMgSW5nZXN077yM"
        "5oqKIFBERiAqKuS4gOavlOS4gCoq6L+Y5Y6f5Li65Y+v5ZyoIERvY3VtZW50cyDpobXmraPnoa7muLLmn5PnmoQgTWFy"
        "a2Rvd24KIyAgICAgICDvvIjmloflrZcgLyDmrrXokL3pobrluo8gLyDpq5jmuIXljp/lm74gLyDlm77niYfmmL7npLrl"
        "sLrlr7ggLyDnm67lvZUgLyDooajmoLwgLyDmlbDlrablhazlvI8gLyDku6PnoIHlnZcgLwojICAgICAgIOazqOmHiuiE"
        "muazqO+8ie+8jOWkp+aWh+S7tuWIhuaJue+8jOmAkOmhtea1j+iniOWZqOWvueavlOOAgeWPkeeOsOS4gOWkhOS/ruS4"
        "gOWkhO+8jOebtOWIsOeuoee6v+S4jiBVSSDmuLLmn5PlnYfovr7mnIDkvbPjgIIKIwojIOinpuWPkeaWueW8j++8iOS7"
        "u+mAieWFtuS4gO+8ie+8mgojICAgMS4gVUk6IC9pbnRlcmZhY2Uvc2tpbGxzIOKGkiAiRnJvbSBUZW1wbGF0ZS4uLiIg"
        "4oaSIOmAiSBQREYg6auY5L+d55yf6L+Y5Y6fIOKGkiBJbnN0YWxsCiMgICAyLiBBUEk6IFBPU1QgL2ludGVyZmFjZS9z"
        "a2lsbHMvZnJvbS10ZW1wbGF0ZSB7IHRlbXBsYXRlX2lkOiAicGRmX2ZpZGVsaXR5X3Jlc3RvcmUiIH0KIyAgIDMuIOS7"
        "u+aEjyBBZ2VudO+8iGlzX2dsb2JhbD10cnVl77yM6Ieq5Yqo5rOo5YWlIFByb2dyZXNzaXZlIERpc2Nsb3N1cmXvvIk6"
        "IGV4cGFuZF9za2lsbCgicGRmLWZpZGVsaXR5LXJlc3RvcmUiLCB7IHBkZl9zb3VyY2UsIGNvcnB1c19uYW1lIH0pCiMK"
        "IyBTU09UIOaPkOekuu+8muacrOaWh+S7tuS4jiAuYWdlbnQvc2tpbGxzL3BkZi1maWRlbGl0eS1yZXN0b3JlL1NLSUxM"
        "Lm1kIOWQjOa6kO+8iERCIOaKgOiDveS+m+S4gOaguOS6lOe/vO+8jAojICAgICAgICAgICAg5paH5Lu25oqA6IO95L6b"
        "IFJvdXRpbmUg55qEIENsYXVkZSBDb2Rl77yJ77yM5Lik5aSE5q2j5paH6aqo5p626aG75L+d5oyB5LiA6Ie044CCCiMK"
        "IyDlj4LogIPvvJoKIyAgIC0gbmVnZW50cm9weS1wZXJjZWl2ZXMgcGFyc2VfcGRmX3RvX21hcmtkb3du77yIYXV0b19i"
        "YXRjaCAvIHJlc3VtZSAvIOWkmuW8leaTjiBkb2NsaW5nwrdtaW5lcnXCt21hcmtlcsK3c21hcnTvvIkKIyAgIC0gQW50"
        "aHJvcGljIENsYXVkZSBTa2lsbHMgLyBHb29nbGUgQURLIFNraWxscyDnmoQgUHJvZ3Jlc3NpdmUgRGlzY2xvc3VyZSDl"
        "jp/liJkKCnRlbXBsYXRlX2lkOiBwZGZfZmlkZWxpdHlfcmVzdG9yZQpuYW1lOiBwZGYtZmlkZWxpdHktcmVzdG9yZQpk"
        "aXNwbGF5X25hbWU6IFBERiDpq5jkv53nnJ/ov5jljp8gKFBERiBGaWRlbGl0eSBSZXN0b3JlKQpkZXNjcmlwdGlvbjog"
        "Pi0KICDnlKggbmVnZW50cm9weS1wZXJjZWl2ZXMg55qEIHBhcnNlX3BkZl90b19tYXJrZG93biDnu48gS25vd2xlZGdl"
        "IEJhc2UgRG9jdW1lbnRzIEluZ2VzdCDlsIYgUERGIOS4gOavlOS4gOi/mOWOn+S4uuWPr+a4suafkwogIE1hcmtkb3du"
        "77yI5paH5a2X44CB5q616JC96aG65bqP44CB6auY5riF5Y6f5Zu+44CB5Zu+54mH5pi+56S65bC65a+444CB55uu5b2V"
        "44CB6KGo5qC844CB5pWw5a2m5YWs5byP44CB5Luj56CB5Z2X44CB5rOo6YeK77yJ77yM5aSn5paH5Lu25YiG5om577yM"
        "6YCQ6aG15rWP6KeI5Zmo5a+55q+U44CB5Y+R546w5LiA5aSE5L+u5LiA5aSE77yM55u06Iez5a6M5YWo5LiA6Ie044CC"
        "CmNhdGVnb3J5OiBrbm93bGVkZ2UKdmVyc2lvbjogMS4yLjAKdmlzaWJpbGl0eTogcHVibGljCnByaW9yaXR5OiAyMApl"
        "bmZvcmNlbWVudF9tb2RlOiB3YXJuaW5nCiMg5YWo5bGA5oqA6IO977ya6Ieq5Yqo5rOo5YWl5YWo57O757uf5omA5pyJ"
        "IEFnZW5077yI5LiA5qC45LqU57+8ICsg5pyq5p2l5paw5aKe77yJ77yM5peg6ZyA6YCQIEFnZW50IOe7tOaKpCBza2ls"
        "bHMg5pWw57uE44CCCmlzX2dsb2JhbDogdHJ1ZQoKIyBhZHZpc29yee+8iGVuZm9yY2VtZW50X21vZGU9d2FybmluZyAr"
        "IGlzX2dsb2JhbCDlvLrliLYgd2FybmluZ++8mue8uuWkseS4jemYu+Whnu+8jOS7heS9nOiDveWKm+aPkOekuu+8iQpy"
        "ZXF1aXJlZF90b29sczoKICAtIGRhdGEtZXh0cmFjdG9yCiAgLSBwYXJzZV9wZGZfdG9fbWFya2Rvd24KICAtIGluZ2Vz"
        "dF90b19jb3JwdXMKCnByb21wdF90ZW1wbGF0ZTogfAogIOS9oOaYr+OAjFBERiDpq5jkv53nnJ/ov5jljp/jgI3kuJPl"
        "rrbjgILnm67moIfvvJrmioogUERGICoq5LiA5q+U5LiAKirov5jljp/kuLrlj6/lnKggS25vd2xlZGdlIC8gRG9jdW1l"
        "bnRzIOmhteato+ehrua4suafk+eahAogIE1hcmtkb3du77yM5bm26YCa6L+H5rWP6KeI5Zmo6YCQ6aG15a+55q+U5bCG"
        "5beu5byC5L+u5aSN6Iez5a6M5YWo5LiA6Ie044CCCgogICMjIOi+k+WFpQogIC0gcGRmX3NvdXJjZe+8mmBge3sgcGRm"
        "X3NvdXJjZSB9fWBg77yI5pys5Zyw57ud5a+56Lev5b6E5oiWIGh0dHAocykgVVJM77yJCiAgLSBjb3JwdXNfbmFtZe+8"
        "mmBge3sgY29ycHVzX25hbWUgfX1gYO+8iOebruaghyBDb3JwdXPvvIzpu5jorqQgSGFybmVzcyBFbmdpbmVlcmluZ++8"
        "iQogIC0gbWV0aG9k77yaYGB7eyBtZXRob2QgfX1gYO+8iHBlcmNlaXZlcyDlvJXmk47vvJphdXRvIC8gc21hcnQgLyBk"
        "b2NsaW5nIC8gbWluZXJ1IC8gbWFya2VyIC8gcHltdXBkZiAvIHB5cGRm77yJCiAgLSDliIbmibnvvJpiYXRjaF9wYWdl"
        "X3NpemU9YGB7eyBiYXRjaF9wYWdlX3NpemUgfX1gYO+8jGJhdGNoX3RocmVzaG9sZF9wYWdlcz1gYHt7IGJhdGNoX3Ro"
        "cmVzaG9sZF9wYWdlcyB9fWBgCgogICMjIOS4gOavlOS4gOi/mOWOn+iMg+WbtO+8iOe8uuS4gOS4jeWPr++8iQogIOaW"
        "h+Wtl+OAgeauteiQvemhuuW6j+OAgemrmOa4heWOn+WbvuOAgSoq5Zu+54mH5pi+56S65bC65a+4KirjgIHnm67lvZUo"
        "VE9DL+mUmueCuSnjgIHooajmoLzjgIHmlbDlrablhazlvI8oTGFUZVgvS2FUZVgp44CBCiAg5Luj56CB5Z2XKOivreio"
        "gOS4jumrmOS6rinjgIHohJrms6gv5rOo6YeK44CCCgogICMjIOa1geeoi++8iOiHqumpsemXreeOr++8iQogIDEuICoq"
        "5Z+65YeGKirvvJrnlKjnlKjmiLfluLjnlKjmtY/op4jlmajvvIjnnJ/lrp7nmbvlvZXmgIHvvInmiZPlvIDmupAgUERG"
        "77yIYGBmaWxlOi8vYGAg5oiWIFVSTO+8ieS9nOS4uuWvueeFp+Wfuue6v++8m+S4jeW+l+e7lei/hy/mqKHmi5/ku7vk"
        "vZXnmbvlvZXjgIIKICAyLiAqKui3r+eUseWwsee7qioq77ya56Gu6K6k55uu5qCHIENvcnB1cyDnmoQgYGBjb25maWcu"
        "ZXh0cmFjdG9yX3JvdXRlc2BgIOW3suaKiiBgYHNvdXJjZV9raW5kPXBkZmBgIOi3r+eUseWIsAogICAgIGBgbmVnZW50"
        "cm9weS1wZXJjZWl2ZXMucGFyc2VfcGRmX3RvX21hcmtkb3duYGDvvIxgYHRvb2xfb3B0aW9uc2BgIOW8gOWQryBleHRy"
        "YWN0X2ltYWdlcy90YWJsZXMvZm9ybXVsYXPvvIwKICAgICDlubborr4gYGBhdXRvX2JhdGNoPXRydWVgYCDkuI7lkIjp"
        "gILnmoQgYGBiYXRjaF9wYWdlX3NpemVgYOOAggogIDMuICoq5YiG5om55pGE5Y+WKirvvJrnu48gRG9jdW1lbnRzIElu"
        "Z2VzdCDkuIrkvKAgUERG44CC5aSn5paH5Lu25L6d6LWWIHBlcmNlaXZlcyDnmoQgYGBhdXRvX2JhdGNoYGAKICAgICDv"
        "vIjmgLvpobXmlbAgPiBiYXRjaF90aHJlc2hvbGRfcGFnZXMg5pe26Ieq5Yqo5YiH54mH77yMYGByZXN1bWVgYCDmlq3n"
        "grnnu63kvKDvvInvvIznoa7kv50qKuaVtOacrCoq5pyA57uI5ZCI5bm25Li65Y2V5LiAIE1hcmtkb3duIOaWh+aho+OA"
        "ggogIDQuICoq562J5b6F5a6M5oiQKirvvJrova7or6LmlofmoaMgYGBtYXJrZG93bl9leHRyYWN0X3N0YXR1c2BgIOiH"
        "syBgYGNvbXBsZXRlZGBg77yI5aSx6LSl5YiZ5p+lIGBgbWFya2Rvd25fZXh0cmFjdF9lcnJvcmBgIOW5tiByZWZyZXNo"
        "IOmHjeivle+8ieOAggogIDUuICoq5riy5p+T5qC45a+5KirvvJrlnKggRG9jdW1lbnRzIOmhtSBWaWV3IOa4suafk+e7"
        "k+aenO+8iHJlYWN0LW1hcmtkb3duICsgcmVtYXJrLWdmbS9tYXRoICsgcmVoeXBlLWthdGV4L3Jhdy9oaWdobGlnaHQv"
        "c2FuaXRpemXvvInjgIIKICA2LiAqKumAkOmhteWvueavlCoq77ya5oyJ5LiK44CM5LiA5q+U5LiA6L+Y5Y6f6IyD5Zu0"
        "44CN6YCQ6aG1IC8g6YCQ5qih5Z2X5q+U5a+55rqQIFBERiDkuI7muLLmn5MgTWFya2Rvd27vvIzpgJDmnaHorrDlvZXl"
        "t67lvILvvIjpobXlj7cgKyDnsbvliKsgKyDnjrDosaHvvInjgIIKICA3LiAqKuWPkeeOsOS4gOWkhOS/ruS4gOWkhO+8"
        "iOS4ieadoOadhuWIhuWxguS/ruWkjei3r+eUsSArIOW9kuWboO+8iSoq77ya5q+P5Liq57y66Zm35YWI6LWw44CM5Y+M"
        "5rqQ6aqM6K+B5Yaz562W5qCR44CN5b2S5Zug5Yiw5p2g5p2GL+Wxgu+8jOWGjeWumueCueaUue+8iOWNlei9ruS4gOS4"
        "qumAu+i+keagueWboO+8jOKJpDMg5paH5Lu2IOKJpDIg5p2g5p2G77yJ77yaCiAgICAgLSAqKuKRoOW3peeoi+S7o+eg"
        "gcK3566h57q/5bGCKirvvJpwZXJjZWl2ZXMg5byV5pOO6YCJ5Z6L44CB5YiG5om56L6555WM44CB6Leo54mH5ZCI5bm2"
        "77yI5Zu+54mH5Y676YeN44CB6L6555WM5Zu+5rOo6KGl5pWR77yJ44CB5Zu+54mH5YiG6L6o546H5LiO5pi+56S65bC6"
        "5a+45o+Q5Y+W77yIYHBpcGVsaW5lL3N0YWdlcy9wZGYvKmDjgIFgZW5naW5lX3NlbGVjdG9yLnB5YOOAgWBvcHMvcGRm"
        "LnB5YO+8ieOAggogICAgIC0gKirikaDlt6XnqIvku6PnoIHCt+aRhOWPluWxgioq77ya5Zu+54mH6ZO+5o6l6YeN5YaZ"
        "44CB6LWE5Lqn5a2Y5YKo44CB5YWD5pWw5o2u77yIYGtub3dsZWRnZS9pbmdlc3Rpb24vZXh0cmFjdGlvbi5weWDjgIFg"
        "a25vd2xlZGdlL19zaGFyZWQucHlg77yJ44CCCiAgICAgLSAqKuKRoOW3peeoi+S7o+eggcK35a+85Ye65bGCKirvvJp3"
        "aWtpIOWPkeW4g+i1hOS6pyBiYWtlIC8g6ZO+5o6l6YeN5YaZ77yIYGtub3dsZWRnZS9saWZlY3ljbGUvd2lraV9leHBv"
        "cnRfc2VydmljZS5weWDvvInjgIIKICAgICAtICoq4pGg5bel56iL5Luj56CBwrfmuLLmn5PlsYIgd2lraSoq77yaYE1h"
        "cmtkb3duUmVuZGVyZXIudHN4YCAvIGBab29tYWJsZUltYWdlYCAvIGBSZXNwb25zaXZlVGFibGVgIC8gYENvZGVCbG9j"
        "a2AgLyBzYW5pdGl6ZSBzY2hlbWHvvIjlm77niYflrr3pq5jjgIHooajmoLzjgIFLYVRlWOOAgeS7o+eggemrmOS6ruOA"
        "gVRPQyDplJrngrnvvInjgIIKICAgICAtICoq4pGg5bel56iL5Luj56CBwrfmuLLmn5PlsYIgdWkqKu+8mmBEb2N1bWVu"
        "dE1hcmtkb3duUmVuZGVyZXIudHN4YCAvIGBEb2N1bWVudEltYWdlYCBmaWdjYXB0aW9uIC8gYHBhcnNlUGl4ZWxWYWx1"
        "ZWAgLyBgZG9jdW1lbnRTYW5pdGl6ZVNjaGVtYWDvvIjms6jmhI8gd2lraSDkuI4gdWkg55qEIHNhbml0aXplIGBzdHls"
        "ZWAg5pS+6KGMIC8gZmlnY2FwdGlvbiDooYzkuLrkuI3lr7nnp7DvvInjgIIKICAgICAtICoq4pGhU2tpbGxzIOacrOS9"
        "kyoq77ya5pysIFNraWxsIOeahOinhOWImembhuKAlOKAlOWPkeeOsOeahOi3qCBkb2Mg57uT5p6E5oCnIGluc2lnaHQg"
        "5Zue5YaZ5q2k5aSE77yI5aaC44CM5Zu+5rOo5Y+M5rqQ6ZOB5b6L44CN77yJ77yM5Y2H57qn5b2S5Zug6Lev55Sx6KGo"
        "44CCCiAgICAgLSAqKuKRoua1geeoi+iHqui6qyoq77ya5beh5qOAL+i/mOWOn+a1geeoi+eahOmHh+agt+OAgeivhOWI"
        "huOAgeW9kuWboOe8luaOku+8iOaFjuaUue+8jOW9seWTjemdouWkp++8ieOAggogICAgIC0gKirlj4zmupDpqozor4Hl"
        "hrPnrZbmoJHvvIjlvZLlm6DliY3lv4XotbDvvIzpmLLor6/lvZLliLAgcGVyY2VpdmVz77yJKirvvJpTdGVwIEEg57y6"
        "6Zm35Zyo5YCZ6YCJIE1hcmtkb3duIOa6kOeggemHjO+8n+aYr+KGkueuoee6vy/mkYTlj5bvvJvlkKbihpLmuLLmn5Pl"
        "sYLmiJbmtYHnqIvkvKrnvLrpmbfjgIJTdGVwIEIg5Zu+54mH6ZO+5o6l5b2i5byP5Yik5pGE5Y+WL+WvvOWHuuOAglN0"
        "ZXAgQyB3aWtpIOmUmei/mOaYryB1aSDplJnihpJyZW5kZXJfd2lraS9yZW5kZXJfdWnvvJvnmoblr7nku4Xml6fmqKHm"
        "i5/moIjplJnihpLmtYHnqIvkvKrnvLrpmbfvvIjkuI3orqHliIbvvInjgIIKICAgICAtICoq54Ot5pu06ZOB5b6L77yI"
        "5pS5IHBlcmNlaXZlcyBzcmMvIOWQjuW/heWBmu+8jOWQpuWImeaUueWKqOS4jeeUn+aViO+8iSoq77ya4pGgIOmHjeWQ"
        "ryBwZXJjZWl2ZXMgTUNQIOi/m+eoi++8iFB5dGhvbiDml6Dng63ph43ovb3vvInvvJvikaEg5riFIGNoZWNrcG9pbnQg"
        "YHJtIC1yZiA8b3V0cHV0X2Rpcj4vb3V0cHV0Ly5iYXRjaF9zdGF0ZS8qYO+8iGF1dG9fYmF0Y2ggcmVzdW1lIOaMiSBQ"
        "REYg5YaF5a65IFNIQS0xIOe8k+WtmOWIh+eJh++8jOS4jea4heWImeWkjeeUqOaXp+WIh+eJh+OAgei3s+i/h+aWsOS7"
        "o+egge+8jOS4lOWujOaIkOW8guW4uOW/q++8ieOAggogICAgIOaUueWQjue7jyByZWZyZXNoX21hcmtkb3duKHJlc3Vt"
        "ZT1mYWxzZSkg6YeN5pGE5Y+W77yIKirmuIUgY2hlY2twb2ludCDlhajph4/ph43ot5EqKu+8ieaIlumHjei9vemhtemd"
        "ou+8jOWkjeaguOivpemhueOAggogIDguICoq5b6q546vKirvvJrph43lpI0gNuKAkzfvvIznm7TliLDpgJDpobXmoKHp"
        "qozmuIXljZXlhajnu7/vvJvkv53nlZnlhbPplK7pobXmupAgUERGIHZzIOa4suafkyBNYXJrZG93biDlr7nmr5TmiKrl"
        "m77kuLror4HjgIIKCiAgIyMg5YWz6ZSu5rSe5a+f77yIUjEwIC8g5LiJ5p2g5p2G5pS56YCgIOayiea3gO+8iQogIC0g"
        "KiphdXRvX2JhdGNoIOWIh+eJh+mXtOaXoOWFseS6q+WPr+WPmOeKtuaAgSoq77ya5byV5pOO5a6e5L6L5ZyoIHBvb2wg"
        "5aSN55So5pe25Lqn54mp6JC955uY55uu5b2V6aG7IHBlci1jYWxsIOWUr+S4gO+8iGB0ZW1wZmlsZS5ta2R0ZW1wYO+8"
        "ie+8m+e6p+iBlC/lhozlsIHnsbvnirbmgIHvvIjlpoIgYF9maXJzdF9oMV9zZWVuYO+8iemhu+aYvuW8j+aOpeaUtiBg"
        "c2xpY2VfaW5kZXhg77yM5ZCm5YiZ6Leo5YiH54mH5rOE5ryP77yI5qCH6aKY5bGC57qn6ZSZ5LmxIC8g5YWs5byP6YeN"
        "546w77yJ44CCCiAgLSAqKjE6MSDpqozmlLblv4XpobvotbDliLDmtY/op4jlmajmuLLmn5PmgIEqKu+8mmZpZ3VyZSDo"
        "v4fluqbmjZXojrfjgIFLYVRlWCBQYXJzZUVycm9y44CB5YWs5byP5Y+M5Lu9562J57y66Zm35ZyoIERCIG1hcmtkb3du"
        "IOWxguS4jeWPr+inge+8jOS7hea1j+iniOWZqOa4suafk+WQjuaatOmcsuOAggogIC0gKipmaWd1cmUg5Zu+5rOo5Y+M"
        "5rqQ6aOO6ZmpKirvvJrlpJrmlbDlm77ms6jlt7Lng5jlhaUgZmlndXJlIHJlZ2lvbiBQTkcg5YOP57Sg77yM5pWFIHdp"
        "a2kvdWkgKirkuI3lvpcqKuWGjeS7jiBgYWx0YCDmuLLmn5MgYGZpZ2NhcHRpb25g77yI5Lya5Y+M5Zu+5rOo77yJ77yb"
        "Y2FwdGlvbiDor63kuYnnlLEgYGFsdGAg5om/6L2977yI5peg6Zqc56KNICsg5Y676YeN5oyH57q577yJ77yM6KeG6KeJ"
        "55Sx5Zu+5YaF5YOP57Sg5om/6L2944CCCiAgLSAqKuS4ieWll+a4suafk+agiOezu+e7n+aAp+W3ruW8gioq77ya5pen"
        "IGBfZmlkZWxpdHlfcmVuZGVyYO+8iFB5dGhvbi1NYXJrZG93biDov5HkvLzvvIkvIHdpa2nvvIhyZWFjdC1tYXJrZG93"
        "biArIHJlbWFyay9yZWh5cGXvvIkvIHVp77yI5Y+m5LiA5aWXIHJlYWN0LW1hcmtkb3duICsgc2FuaXRpemXvvInkuInm"
        "oIjkuI3lkIzigJTigJTlhazlvI8vTWVybWFpZC9maWd1cmUvZmlnY2FwdGlvbi/lm77niYflsLrlr7gv5Luj56CB6auY"
        "5Lqu5Lya5YGH6Ziz5oCnL+WBh+mYtOaAp+OAguWvueeFp+mhu+eUqCoq55yf5a6eIHdpa2kg5riy5p+T5qCIKirvvIjl"
        "t6Hmo4Dnu48gYHBhdHJvbF93aWtpX2VudmAg6LW3IGBuZXh0IGRldmAg55yf6aG15oiq5Zu+77yM6Z2e5qih5ouf5riy"
        "5p+T77yJ44CCCiAgLSAqKuWFqOe7v+eOh+ivhOWIhuWPo+W+hCoq77yaYHNjb3JlID0gcm91bmQocGFzc19wYWdlcy90"
        "b3RhbF9wYWdlc8OXMTAwKWDvvIjpgJDpobXmoKHpqozmuIXljZXlhajnu7/njofvvInvvIzmm7/ku6PkuLvop4LjgIwx"
        "MDAtzqPmiaPliIbjgI3igJTigJRDQyDoh6ror4TkuI4gSnVkZ2Ug5aSN5qC46ZSB5ZCM5LiA5Lu956iL5bqP5YyW6aKE"
        "562bICsgZGVmZWN0c++8jOagueayuyDCsTIwIOaMr+iNoe+8iElTU1VFLTEyOO+8ieOAggogIC0gKirlj4zmupDpqozo"
        "r4HpmLLor6/lvZLlm6AqKu+8mua4suafk+Wxgue8uumZt++8iOWAmemAiSBNRCDmraPnoa7jgIHmuLLmn5PlmajmuLLm"
        "n5PplJnvvInkvJrooqvor6/lvZLliLAgcGVyY2VpdmVz77yb5b2S5Zug5YmN5b+F6LWw44CM5YCZ6YCJIE1EIOa6kOeg"
        "geWxgiB2cyDmuLLmn5PlsYLjgI3lj4zmupDlhrPnrZbmoJHvvIjop4HmraXpqqQgN++8ieOAggogIC0gKippbm5lci1s"
        "b29wIHN0YWdpbmcgd2lraSDkuI0gYmFrZS9zZXJ2ZSDlm77niYfvvIhWMSDlt6Xlhbfpk77pmZDliLbvvIxwcm9jZXNz"
        "IOWxgiBjYXJ2ZS1vdXTvvIkqKu+8mmBgcGF0cm9sX3dpa2lfZW52IHB1Ymxpc2gtY2FuZGlkYXRlYGAg5LuF5YaZIGVu"
        "dHJ5IE1hcmtkb3du44CB5LiN54OY54SZ6LWE5Lqn77ybc3RhZ2luZyBkZXYgc2VydmVy77yI5Li75LuTIGBgbmVnZW50"
        "cm9weS13aWtpYGDvvIxgYHB1YmxpYy9hc3NldHMvYGAg5peg5paH5qGj6LWE5Lqn77yJ5a+55YCZ6YCJIE1EIOeahCBg"
        "YC4vaW1hZ2VzLy4uLmBgIOebuOWvueW8leeUqOi/lOWbniA1MDAv5pat5Zu+77yMYGBwYXRyb2xfcGFnZV9jaGVja2Bg"
        "IOaKpSBgYGRvbV9icm9rZW5faW1hZ2VzPU5gYO+8iOS4lCBOZXh0IFNQQSDlr7nmnKrljLnphY3ot6/nlLHlm57pgIAg"
        "MjAwIEhUTUzvvIxjdXJsIOeKtuaAgeeggeS8mumql+S6uu+8jOmhu+eciyBjb250ZW50LXR5cGUvUE5HIOWktO+8ieOA"
        "guatpOS4uiAqKnN0YWdpbmcg5bel5YW36ZO+IFYxIOmZkOWItu+8jOmdnuaWh+ahoy/muLLmn5PnvLrpmbcqKuKAlOKA"
        "lOWbvui1hOS6p+acrOi6q+W/oOWunu+8iOWFqOWIhui+qOeOhyBQTkcg6JC955uYIGBgLy4uLi9pbWFnZXMvYGDvvInv"
        "vIznlJ/kuqfnu48gYGBXaWtpRXhwb3J0U2VydmljZS5leHBvcnRfc2luZ2xlX2VudHJ5KGJha2U9VHJ1ZSlgYCDng5jn"
        "hJnliLAgYGBwdWJsaWMvYXNzZXRzL3tkb2N9L2BgIOWQjueUsSBab29tYWJsZUltYWdlIOato+W4uOa4suafk+OAgioq"
        "aW5uZXIgbG9vcCDop4Hlhajlm77mlq0g4oaSIOiusCBwcm9jZXNzIGNhcnZlLW91dO+8iOS4jeaJo+WIhuOAgeS4jemA"
        "kOWbvuaOkuafpe+8ie+8m+WbvueJh+S/neecn+aUueeUsSAoYSkg55u05o6l5qC45a+56JC955uYIFBORyDotYTkuqfl"
        "sLrlr7gv5a6M5pW05oCnIOaIliAoYikgUmVhbC1SZW5kZXIgR2F0ZSBiYWtlIOWQjuaIquWbvuS6jOmAieS4gOWdkOWu"
        "nuOAgioqCgogICMjIOWPjeaooeW8j++8iOS4peemge+8iQogIC0g6Lez6L+H6YCQ6aG15qC45a+55Y2z5aOw5piO5a6M"
        "5oiQ77ybCiAgLSDlj6rmr5TmloflrZfogIzlv73nlaXlm74gLyDooaggLyDlhazlvI8gLyDku6PnoIEgLyDms6jph4rv"
        "vJsKICAtIOWbvueJh+S4jei/mOWOn+WOn+Wni+aYvuekuuWwuuWvuO+8iOWuvemrmO+8ie+8mwogIC0g5ZyoIGlubmVy"
        "IGxvb3Ag5a+544CM5YWo5Zu+5pat44CN77yIc3RhZ2luZyBzZXJ2aW5nIFYxIOmZkOWItu+8iemAkOWbvuaOkuafpeaI"
        "luivr+W9kuWIsCBwaXBlbGluZS9yZW5kZXLigJTigJRjb250ZXh0IOiAl+WwveagueWboO+8m+WFiOiupCBzdGFnaW5n"
        "IGNhcnZlLW91dO+8jOWbvueJh+S/neecn+i1sOi1hOS6p+ebtOafpeaIliBHYXRl44CCCgogICMjIOWujOaIkOWIpOaN"
        "rgogIOmAkOmhteagoemqjOa4heWNleWFqOe7vyArIOWFs+mUrumhteWvueavlOaIquWbvueVmeivgSArIOaVtOacrCBQ"
        "REYg5ZyoIERvY3VtZW50cyDpobXlj6/or7vmgKfkuI7kuIDoh7TmgKfovr7mnIDkvbPjgIIKCiAgIyMg6LWE5rqQIC8g"
        "5Z+657q/56S65L6L77yIUjEw77yJCiAgLSDln7rnur8gUERG77yaYFNlbGYtSW1wcm92aW5nIEFnZW50cyBpbiB0aGUg"
        "RXJhIG9mIEV4cGVyaWVuY2U6IEEgU3VydmV5IG9mIFNlbGYtIHRvIE1ldGEtRXZvbHV0aW9uLnBkZmDvvIg4OCDpobUg"
        "LyBBNCDlj4zmoI8gTGFUZVjvvJtjb3JwdXPjgIxIYXJuZXNzIEVuZ2luZWVyaW5n44CN77yJ44CCCiAgLSDln7rnur8g"
        "d2lraSDmuLLmn5Plr7nnhafvvJpgaHR0cDovL2xvY2FsaG9zdDozMDkyL3dpa2kvaGFybmVzcy1lbmdpbmVlcmluZy9w"
        "YXBlci9zZWxmLWltcHJvdmluZy1hZ2VudHMtaW4tdGhlLWVyYS1vZi1leHBlcmllbmNlLWEtc3VydmV5LW9mLXNlbGYt"
        "dG8tbWV0YS1ldm9sdXRpb24tcGRmL2AKICAtIHBlcmNlaXZlcyDnrqHnur/mupDnoIHvvJpgYXBwcy9uZWdlbnRyb3B5"
        "LXBlcmNlaXZlc2DvvIhtb25vcmVwbyBgVGhyZWVGaXNoLUFJL25lZ2VudHJvcHlg77yM6buY6K6k5YiG5pSvIGBtYXN0"
        "ZXJg77yJ44CCCiAgLSDov63ku6PorrDlvZXvvJpgZG9jcy8uYWdlbnRzL3BkZi1oYXJuZXNzLWVuZ2luZWVyaW5nLXBh"
        "cml0eS5tZGAgwqc577yIUjEwIOS5nemhueS/ruWkje+8ieOAggoKY29uZmlnX3NjaGVtYToKICB0eXBlOiBvYmplY3QK"
        "ICBwcm9wZXJ0aWVzOgogICAgcGRmX3NvdXJjZToKICAgICAgdHlwZTogc3RyaW5nCiAgICAgIGRlc2NyaXB0aW9uOiDm"
        "nKzlnLDnu53lr7not6/lvoTmiJYgaHR0cChzKSBVUkwg55qEIFBERiDmupAKICAgIGNvcnB1c19uYW1lOgogICAgICB0"
        "eXBlOiBzdHJpbmcKICAgICAgZGVmYXVsdDogSGFybmVzcyBFbmdpbmVlcmluZwogICAgICBkZXNjcmlwdGlvbjog55uu"
        "5qCHIEtub3dsZWRnZSBDb3JwdXMg5ZCN56ewCiAgICBtZXRob2Q6CiAgICAgIHR5cGU6IHN0cmluZwogICAgICBlbnVt"
        "OiBbYXV0bywgc21hcnQsIGRvY2xpbmcsIG1pbmVydSwgbWFya2VyLCBweW11cGRmLCBweXBkZl0KICAgICAgZGVmYXVs"
        "dDogYXV0bwogICAgICBkZXNjcmlwdGlvbjogcGVyY2VpdmVzIOino+aekOW8leaTjgogICAgYmF0Y2hfcGFnZV9zaXpl"
        "OgogICAgICB0eXBlOiBpbnRlZ2VyCiAgICAgIG1pbmltdW06IDEKICAgICAgbWF4aW11bTogMjAwCiAgICAgIGRlZmF1"
        "bHQ6IDQwCiAgICAgIGRlc2NyaXB0aW9uOiBhdXRvX2JhdGNoIOWNleWIh+eJh+acgOWkp+mhteaVsAogICAgYmF0Y2hf"
        "dGhyZXNob2xkX3BhZ2VzOgogICAgICB0eXBlOiBpbnRlZ2VyCiAgICAgIG1pbmltdW06IDEKICAgICAgZGVmYXVsdDog"
        "NjAKICAgICAgZGVzY3JpcHRpb246IOi2hei/h+ivpemhteaVsOaJjeWQr+eUqCBhdXRvX2JhdGNoIOWIhuaJuQogIHJl"
        "cXVpcmVkOgogICAgLSBwZGZfc291cmNlCgpkZWZhdWx0X2NvbmZpZzoKICBjb3JwdXNfbmFtZTogSGFybmVzcyBFbmdp"
        "bmVlcmluZwogIG1ldGhvZDogYXV0bwogIGJhdGNoX3BhZ2Vfc2l6ZTogNDAKICBiYXRjaF90aHJlc2hvbGRfcGFnZXM6"
        "IDYwCgpyZXNvdXJjZXM6CiAgLSB0eXBlOiBjb3JwdXMKICAgIHJlZjogaGFybmVzcy1lbmdpbmVlcmluZwogICAgdGl0"
        "bGU6IEhhcm5lc3MgRW5naW5lZXJpbmcgY29ycHVz77yI6buY6K6k55uu5qCH6K+t5paZ5bqT77yJCiAgICBsYXp5OiB0"
        "cnVlCiAgLSB0eXBlOiB1cmwKICAgIHJlZjogaHR0cHM6Ly9naXRodWIuY29tL1RocmVlRmlzaC1BSS9uZWdlbnRyb3B5"
        "L3RyZWUvbWFzdGVyL2FwcHMvbmVnZW50cm9weS1wZXJjZWl2ZXMKICAgIHRpdGxlOiBuZWdlbnRyb3B5LXBlcmNlaXZl"
        "cyBwYXJzZV9wZGZfdG9fbWFya2Rvd24g566h57q/5rqQ56CB77yIbW9ub3JlcG/vvIxtYXN0ZXLvvIkKICAgIGxhenk6"
        "IHRydWUKICAtIHR5cGU6IHVybAogICAgcmVmOiBodHRwOi8vbG9jYWxob3N0OjMwOTIvd2lraS9oYXJuZXNzLWVuZ2lu"
        "ZWVyaW5nL3BhcGVyL3NlbGYtaW1wcm92aW5nLWFnZW50cy1pbi10aGUtZXJhLW9mLWV4cGVyaWVuY2UtYS1zdXJ2ZXkt"
        "b2Ytc2VsZi10by1tZXRhLWV2b2x1dGlvbi1wZGYvCiAgICB0aXRsZTogUjEwIOWfuue6v+ekuuS+i++8iDg4IOmhtee7"
        "vOi/sCB3aWtpIOa4suafk+WvueeFp++8iQogICAgbGF6eTogdHJ1ZQogIC0gdHlwZTogdXJsCiAgICByZWY6IGh0dHBz"
        "Oi8vZ2l0aHViLmNvbS9UaHJlZUZpc2gtQUkvbmVnZW50cm9weS9ibG9iL21hc3Rlci9kb2NzLy5hZ2VudHMvcGRmLWhh"
        "cm5lc3MtZW5naW5lZXJpbmctcGFyaXR5Lm1kCiAgICB0aXRsZTogUERGIOS4gOavlOS4gOi/mOWOn+i0qOmHj+i/reS7"
        "o++8iMKnOSBSMTAg5Lmd6aG55L+u5aSN77yJCiAgICBsYXp5OiB0cnVlCg=="
    ),
)

_META_KEYS = (
    "name",
    "display_name",
    "description",
    "category",
    "version",
    "is_global",
    "visibility",
    "enforcement_mode",
    "priority",
)


def _meta_from(raw: dict) -> dict:
    return {k: raw[k] for k in _META_KEYS if k in raw}


def upgrade() -> None:
    bind = op.get_bind()
    # ON CONFLICT (kind, key) DO NOTHING：幂等播种；每个 bind param 仅出现一次，避免
    # asyncpg「INSERT ... WHERE NOT EXISTS」中 :key 双用导致的 AmbiguousParameterError。
    stmt = sa.text(
        f"""
        INSERT INTO {SCHEMA}.definitions
            (kind, key, format, source, meta, version, checksum, owner_id, is_system, is_enabled, sort_order)
        VALUES ('skill_template', :key, 'yaml', :source, :meta, :version, :checksum, 'system', TRUE, TRUE, :sort_order)
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
        if not isinstance(raw, dict) or not raw.get("template_id"):
            continue
        key = str(raw["template_id"]).strip()
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
