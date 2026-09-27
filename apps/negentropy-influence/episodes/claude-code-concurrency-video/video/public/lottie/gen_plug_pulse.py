"""按仓内运动令牌生成交付级 plug-pulse.json。

时序与缓动一律取 video/src/motion/tokens.ts 的权威值：
  DUR f3/f4/f5/f6 = 5/7/12/21 帧；M3 三条控制点；snap 弹簧 ζ=0.6 过冲 9.5%。
Lottie 的关键帧切线本就是贝塞尔控制点 ⇒ M3 曲线可逐字写进 i/o 字段，
使本资产与全片 16 个动效模型逐帧同源（而非事后目测对齐）。
"""
import json, math
from pathlib import Path

FR, OP = 30, 24
W = H = 96
MECH = [0.3922, 0.7686, 0.7529, 1]  # #64C4C0

DUR = {'f1': 2, 'f2': 3, 'f3': 5, 'f4': 7, 'f5': 12, 'f6': 21}
M3 = {
    'standard':   (0.2, 0.0, 0.0, 1.0),
    'decelerate': (0.05, 0.7, 0.1, 1.0),
    'accelerate': (0.3, 0.0, 0.8, 0.15),
}
ZETA = 12 / (2 * math.sqrt(100 * 1))
OVERSHOOT = 1 + math.exp(-math.pi * ZETA / math.sqrt(1 - ZETA ** 2))  # 1.0948


def kf(t, s, ease=None, last=False):
    """一个关键帧。ease=M3 控制点 → 写进 i/o（Lottie 的切线即贝塞尔控制点）。"""
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


def transform(pos=(0, 0), anchor=(0, 0), scale=(100, 100), rot=0, op=100):
    return {'ty': 'tr', 'p': static(list(pos)), 'a': static(list(anchor)),
            's': static(list(scale)), 'r': static(rot), 'o': static(op)}


def stroke(width, color=MECH, opacity=100, cap=2, join=2):
    return {'ty': 'st', 'c': static(color), 'o': static(opacity) if not isinstance(opacity, dict) else opacity,
            'w': static(width) if not isinstance(width, dict) else width, 'lc': cap, 'lj': join}


def shape_layer(ind, name, shapes, ks, ip=0, op=OP):
    return {'ddd': 0, 'ind': ind, 'ty': 4, 'nm': name, 'sr': 1, 'ks': ks,
            'ao': 0, 'shapes': shapes, 'ip': ip, 'op': op, 'st': 0, 'bm': 0}


# ── 图层 3（最底）：外环脉冲 —— f6 扩散，decelerate（大位移的仓内标准曲线）
ring_outer = shape_layer(
    3, 'pulse-ring-outer',
    [{'ty': 'gr', 'nm': 'g', 'it': [
        {'ty': 'el', 'nm': 'e', 'p': static([0, 0]), 's': static([56, 56]), 'd': 1},
        stroke(anim([kf(0, 4.5, M3['decelerate']), kf(DUR['f6'], 1.2, last=True)])),
        transform(),
    ]}],
    {'o': anim([kf(0, 78, M3['decelerate']), kf(DUR['f6'], 0, last=True)]),
     'r': static(0), 'p': static([W / 2, H / 2, 0]), 'a': static([0, 0, 0]),
     's': anim([kf(0, [26, 26, 100], M3['decelerate']), kf(DUR['f6'], [132, 132, 100], last=True)])},
)

# ── 图层 2：内环回响 —— 错峰 f2 起跳（Carbon 快速子项档），略快收敛
ring_inner = shape_layer(
    2, 'pulse-ring-inner',
    [{'ty': 'gr', 'nm': 'g', 'it': [
        {'ty': 'el', 'nm': 'e', 'p': static([0, 0]), 's': static([56, 56]), 'd': 1},
        stroke(anim([kf(DUR['f2'], 3.2, M3['decelerate']), kf(DUR['f2'] + DUR['f5'], 1.0, last=True)])),
        transform(),
    ]}],
    {'o': anim([kf(DUR['f2'], 52, M3['decelerate']), kf(DUR['f2'] + DUR['f5'], 0, last=True)]),
     'r': static(0), 'p': static([W / 2, H / 2, 0]), 'a': static([0, 0, 0]),
     's': anim([kf(DUR['f2'], [22, 22, 100], M3['decelerate']),
                kf(DUR['f2'] + DUR['f5'], [88, 88, 100], last=True)])},
)

# ── 图层 1（最上）：对勾描画 + snap 收束
#    描画 f3→f3+f5（standard）；收束用 snap 的 9.5% 过冲，落回 100（与 P4 弹簧同源）
draw_start, draw_end = DUR['f3'], DUR['f3'] + DUR['f5']
peak = round(OVERSHOOT * 100, 1)
settle_end = draw_end + DUR['f4']
check = shape_layer(
    1, 'check-draw',
    [{'ty': 'gr', 'nm': 'g', 'it': [
        {'ty': 'sh', 'nm': 'p', 'ks': static({
            'i': [[0, 0], [0, 0], [0, 0]], 'o': [[0, 0], [0, 0], [0, 0]],
            'v': [[-15, 1], [-4, 13], [17, -12]], 'c': False})},
        {'ty': 'tm', 'nm': 'trim', 's': static(0),
         'e': anim([kf(draw_start, 0, M3['standard']), kf(draw_end, 100, last=True)]),
         'o': static(0), 'm': 1},
        stroke(6.5),
        transform(),
    ]}],
    {'o': anim([kf(draw_start, 100, M3['accelerate']), kf(OP - DUR['f3'], 100, M3['accelerate']),
                kf(OP, 0, last=True)]),
     'r': static(0), 'p': static([W / 2, H / 2, 0]), 'a': static([0, 0, 0]),
     # snap 收束：描完瞬间 9.5% 过冲再落回（ζ=0.6，overshootPeak 同一公式）
     's': anim([kf(draw_start, [100, 100, 100], M3['standard']),
                kf(draw_end, [peak, peak, 100], M3['standard']),
                kf(settle_end, [100, 100, 100], last=True)])},
)

doc = {'v': '5.9.0', 'fr': FR, 'ip': 0, 'op': OP, 'w': W, 'h': H,
       'nm': 'plug-pulse', 'ddd': 0, 'assets': [], 'layers': [check, ring_inner, ring_outer]}

out = str(Path(__file__).with_name('plug-pulse.json'))
with open(out, 'w') as f:
    json.dump(doc, f, ensure_ascii=False, indent=1)
    f.write('\n')
print(f'写入 {out}')
print(f'  图层 3：外环 f6=21f decelerate 扩散 26→132%')
print(f'  图层 2：内环 f2=3f 错峰起跳，f5=12f 收敛')
print(f'  图层 1：对勾 f3→f3+f5 描画(standard) + snap 过冲 {peak}% 落回(f4)')
