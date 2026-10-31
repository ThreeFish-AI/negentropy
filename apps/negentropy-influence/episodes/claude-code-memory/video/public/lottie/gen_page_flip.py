"""按仓内运动令牌生成交付级 page-flip.json（P4 扉页翻页脉冲）。

与 gen_plug_pulse.py 同一纪律：时序与缓动一律取 video/src/motion/tokens.ts 的
权威值（DUR f3/f4/f5 = 5/7/12 帧；M3 三条控制点），M3 曲线逐字写进 i/o 字段，
使本资产与全片运动模型逐帧同源。色取本集维度色 mech #A9C46C（记忆绿）。
画面：页面轮廓淡入 → 折角棱线描出 → 角页绕棱线端点掀起（decelerate）→
掀开面（棱线内侧三角）渐显——读作「翻过一页」。
"""
import json
import math
from pathlib import Path

FR, OP = 30, 30
W = H = 120
MECH = [0.6627, 0.7686, 0.4235, 1]  # #A9C46C

DUR = {'f1': 2, 'f2': 3, 'f3': 5, 'f4': 7, 'f5': 12}
M3 = {
    'standard':   (0.2, 0.0, 0.0, 1.0),
    'decelerate': (0.05, 0.7, 0.1, 1.0),
    'accelerate': (0.3, 0.0, 0.8, 0.15),
}

# 页面矩形（留边 18），右下角折页：角三角 (102,72)(102,102)(72,102)，
# 棱线 = (102,72)-(72,102)；掀开面 = 棱线内侧三角 (102,72)(72,102)(72,72)。
FLAP_PIVOT = [102, 72]  # 掀起旋转锚（棱线上端点）


def kf(t, s, ease=None, last=False):
    k = {'t': t, 's': s if isinstance(s, list) else [s]}
    if not last:
        if ease:
            x1, y1, x2, y2 = ease
            n = len(k['s'])
            k['i'] = {'x': [x2] * n, 'y': [y2] * n}
            k['o'] = {'x': [x1] * n, 'y': [y1] * n}
        else:
            k['i'] = {'x': [0.5], 'y': [0.5]}
            k['o'] = {'x': [0.5], 'y': [0.5]}
    return k


def anim(frames):
    return {'a': 1, 'k': frames}


def static(v):
    return {'a': 0, 'k': v}


def shape_layer(ind, name, shapes, ks, ip=0, op=OP):
    return {'ddd': 0, 'ind': ind, 'ty': 4, 'nm': name, 'sr': 1, 'ks': ks,
            'ao': 0, 'shapes': shapes, 'ip': ip, 'op': op, 'st': 0, 'bm': 0}


def stroke(width, opacity=100):
    return {'ty': 'st', 'c': static(MECH), 'o': static(opacity), 'w': static(width),
            'lc': 2, 'lj': 2}


def tr(pos=(0, 0), anchor=(0, 0)):
    return {'ty': 'tr', 'p': static(list(pos)), 'a': static(list(anchor)),
            's': static([100, 100]), 'r': static(0), 'o': static(100)}


def tri(points, closed=True):
    return {'ty': 'sh', 'nm': 'p', 'ks': static({
        'i': [[0, 0]] * len(points), 'o': [[0, 0]] * len(points),
        'v': [list(p) for p in points], 'c': closed})}


# ── 图层 3（最底）：页面轮廓 —— f3 淡入后静置
page = shape_layer(
    3, 'page-frame',
    [{'ty': 'gr', 'nm': 'g', 'it': [
        {'ty': 'rc', 'nm': 'r', 'p': static([60, 60]), 's': static([84, 84]), 'r': static(6), 'd': 1},
        stroke(4.5),
        tr(),
    ]}],
    {'o': anim([kf(0, 0, M3['standard']), kf(DUR['f3'], 100, last=True)]),
     'r': static(0), 'p': static([0, 0, 0]), 'a': static([0, 0, 0]), 's': static([100, 100, 100])},
)

# ── 图层 2：折角棱线 —— f3→f3+f4 描出（standard）
crease = shape_layer(
    2, 'crease-draw',
    [{'ty': 'gr', 'nm': 'g', 'it': [
        {'ty': 'sh', 'nm': 'p', 'ks': static({
            'i': [[0, 0], [0, 0]], 'o': [[0, 0], [0, 0]],
            'v': [[102, 72], [72, 102]], 'c': False})},
        {'ty': 'tm', 'nm': 'trim', 's': static(0),
         'e': anim([kf(DUR['f3'], 0, M3['standard']), kf(DUR['f3'] + DUR['f4'], 100, last=True)]),
         'o': static(0), 'm': 1},
        stroke(4),
        tr(),
    ]}],
    {'o': static(100), 'r': static(0), 'p': static([0, 0, 0]), 'a': static([0, 0, 0]), 's': static([100, 100, 100])},
)

# ── 图层 1（最上）：角页掀起 —— 绕棱线上端点旋转 0→-118°（decelerate），尾部淡出
flap = shape_layer(
    1, 'corner-flap',
    [{'ty': 'gr', 'nm': 'g', 'it': [
        tri([(102, 72), (102, 102), (72, 102)]),
        {'ty': 'fl', 'nm': 'f', 'c': static(MECH), 'o': static(26), 'r': 1},
        stroke(4),
        {'ty': 'tr', 'p': static([0, 0]), 'a': static(FLAP_PIVOT), 's': static([100, 100]),
         'r': anim([kf(DUR['f4'], 0, M3['decelerate']), kf(DUR['f4'] + DUR['f5'], -118, last=True)]),
         'o': anim([kf(DUR['f4'], 100, M3['accelerate']), kf(OP, 22, last=True)])},
    ]}],
    {'o': static(100), 'r': static(0), 'p': static([0, 0, 0]), 'a': static([0, 0, 0]), 's': static([100, 100, 100])},
)

# ── 图层 0：掀开面（棱线内侧三角）—— 掀起过半后渐显，读作「翻过来的那一面」
turned = shape_layer(
    0, 'turned-face',
    [{'ty': 'gr', 'nm': 'g', 'it': [
        tri([(102, 72), (72, 102), (72, 72)]),
        {'ty': 'fl', 'nm': 'f', 'c': static(MECH), 'o': static(16), 'r': 1},
        stroke(3, opacity=80),
        tr(),
    ]}],
    {'o': anim([kf(DUR['f4'] + 5, 0, M3['standard']), kf(DUR['f4'] + DUR['f5'], 92, last=True)]),
     'r': static(0), 'p': static([0, 0, 0]), 'a': static([0, 0, 0]), 's': static([100, 100, 100])},
)

doc = {'v': '5.9.0', 'fr': FR, 'ip': 0, 'op': OP, 'w': W, 'h': H,
       'nm': 'page-flip', 'ddd': 0, 'assets': [], 'layers': [flap, turned, crease, page]}

out = str(Path(__file__).with_name('page-flip.json'))
with open(out, 'w') as f:
    json.dump(doc, f, ensure_ascii=False, indent=1)
    f.write('\n')
print(f'写入 {out}')
print(f'  页框 f3=5f 淡入；棱线 f3→f3+f4 描出；角页 f4→f4+f5 绕棱端掀 -118°(decelerate)')
print(f'  掀开面 f4+5→f4+f5 渐显；角页尾部 accelerate 淡出到 22%')
