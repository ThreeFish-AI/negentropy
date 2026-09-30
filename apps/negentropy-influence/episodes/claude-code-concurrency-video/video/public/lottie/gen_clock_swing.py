"""按仓内色彩令牌生成 clock-swing.json（定时钟钟摆强调——本集 Lottie 点缀之二）。

口径与 gen_plug_pulse.py 同源（脚本生成、非设计工具导出；LottieEmphasis 四条断言把关）：
  - 帧率 30、45 帧（1.5s，beat 内一次性强调）；
  - 颜色硬编码 theme.mech #7FB2E0 / theme.mechDeep #5C8FB8 / dim #9AA7B8
    （theme.ts 改色须重跑本脚本）；
  - 摆动曲线：单摆正弦的对称 ease-in-out 近似（0.37, 0, 0.63, 1——两端口径对称，
    非 M3 单边曲线）；振幅按 0.68 / 半摆衰减，半摆 12 帧 ≈ DUR.f5；
  - 末 5 帧（≈DUR.f3）整体 accelerate 淡出（出场快于入场）。
"""
import json
import math
from pathlib import Path

FR, OP = 30, 45
W, H = 200, 280
MECH = [0.498, 0.6984, 0.8784, 1]  # #7FB2E0
MECH_DEEP = [0.3608, 0.5608, 0.7216, 1]  # #5C8FB8
DIM = [0.6039, 0.6549, 0.7216, 1]  # #9AA7B8

EASE_IO = (0.37, 0.0, 0.63, 1.0)  # 对称 ease-in-out：半摆正弦近似
ACCEL = (0.3, 0.0, 0.8, 0.15)  # M3 accelerate（淡出）

HALF = 12  # 半摆帧数 ≈ DUR.f5
DECAY = 0.68  # 每半摆振幅衰减
PIVOT = (100, 44)  # 摆轴（画布坐标）
ROD = 190  # 摆长（摆心半径）
SWING = 16.0  # 起始摆幅（度）


def kf(t, s, ease=None, last=False):
    """一个关键帧。ease 控制点 → 写进 i/o（Lottie 切线即贝塞尔控制点）。"""
    k = {'t': t, 's': s if isinstance(s, list) else [s]}
    if not last:
        x1, y1, x2, y2 = ease if ease else (0.5, 0.5, 0.5, 0.5)
        n = len(k['s'])
        k['i'] = {'x': [x2] * n, 'y': [y2] * n}
        k['o'] = {'x': [x1] * n, 'y': [y1] * n}
    return k


def anim(frames):
    return {'a': 1, 'k': frames}


def static(v):
    return {'a': 0, 'k': v}


def transform(pos=(0, 0), anchor=(0, 0), scale=(100, 100), rot=0, op=100):
    return {'ty': 'tr', 'p': static(list(pos)), 'a': static(list(anchor)),
            's': static(list(scale)), 'r': static(rot), 'o': static(op)}


def stroke(width, color=MECH, opacity=100, cap=2, join=2, dash=None):
    st = {'ty': 'st', 'c': static(color), 'o': static(opacity),
          'w': static(width), 'lc': cap, 'lj': join}
    if dash:
        st['d'] = [{'ty': 'd1', 'nm': 'dash', 'v': static(dash[0])},
                   {'ty': 'd2', 'nm': 'gap', 'v': static(dash[1])}]
    return st


def fill(color, opacity=100):
    return {'ty': 'fl', 'c': static(color), 'o': static(opacity)}


def shape_layer(ind, name, shapes, ks, ip=0, op=OP):
    return {'ddd': 0, 'ind': ind, 'ty': 4, 'nm': name, 'sr': 1, 'ks': ks,
            'ao': 0, 'shapes': shapes, 'ip': ip, 'op': op, 'st': 0, 'bm': 0}


# 摆幅序列：首个全摆幅（-SWING → +SWING）不衰减，此后每半摆 ×DECAY 回摆收拢
swing = [(0, round(-SWING, 1)), (HALF, round(SWING, 1))]
t, amp, sign = 2 * HALF, SWING * DECAY, -1
while amp > 3.0 and t < OP - 8:
    swing.append((t, round(sign * amp, 1)))
    t += max(5, round(HALF * amp / SWING))
    sign, amp = -sign, amp * DECAY
swing.append((t, round(swing[-1][1] * -DECAY, 1)))
swing_times = [s[0] for s in swing]
swing_vals = [s[1] for s in swing]

# ── 图层（layers[0] 最上）：钟摆本体
pendulum = shape_layer(
    1, 'pendulum',
    [{'ty': 'gr', 'nm': 'bob', 'it': [
        {'ty': 'el', 'nm': 'e', 'p': static([0, ROD]), 's': static([52, 52]), 'd': 1},
        stroke(8),
        {'ty': 'el', 'nm': 'hub', 'p': static([0, ROD]), 's': static([11, 11]), 'd': 1},
        fill(MECH),
        transform(),
    ]},
     {'ty': 'gr', 'nm': 'rod', 'it': [
         {'ty': 'rc', 'nm': 'r', 'p': static([0, ROD / 2]), 's': static([6, ROD]), 'r': 3},
         fill(MECH_DEEP),
         transform(),
     ]},
     {'ty': 'gr', 'nm': 'pivot', 'it': [
         {'ty': 'el', 'nm': 'e', 'p': static([0, 0]), 's': static([13, 13]), 'd': 1},
         fill(MECH),
         transform(),
     ]}],
    {'o': anim([kf(0, 0, ACCEL), kf(3, 100), kf(OP - 5, 100, ACCEL), kf(OP, 0, last=True)]),
     'r': anim([kf(tt, vv, EASE_IO, last=(i == len(swing_times) - 1))
                for i, (tt, vv) in enumerate(zip(swing_times, swing_vals))]),
     'p': static([PIVOT[0], PIVOT[1], 0]), 'a': static([0, 0, 0]), 's': static([100, 100, 100])},
)

# ── 图层 2：摆幅弧线（dim 虚线，静置读出摆动范围）
ax = ROD * math.sin(math.radians(SWING))
ay = ROD * math.cos(math.radians(SWING))
arc = shape_layer(
    2, 'swing-arc',
    [{'ty': 'gr', 'nm': 'g', 'it': [
        {'ty': 'sh', 'nm': 'p', 'ks': static({
            'i': [[0, 0], [0, 0], [0, 0]],
            'o': [[0, 0], [0, 0], [0, 0]],
            'v': [[-round(ax, 1), round(ay, 1)], [0, ROD + 6], [round(ax, 1), round(ay, 1)]],
            'c': False})},
        stroke(2.5, DIM, 55, dash=(7, 9)),
        transform(),
    ]}],
    {'o': anim([kf(3, 0, ACCEL), kf(8, 100), kf(OP - 5, 100, ACCEL), kf(OP, 0, last=True)]),
     'r': static(0), 'p': static([PIVOT[0], PIVOT[1], 0]), 'a': static([0, 0, 0]),
     's': static([100, 100, 100])},
)

# ── 图层 3（最底）：壁挂座（dim，静置）
mount = shape_layer(
    3, 'wall-mount',
    [{'ty': 'gr', 'nm': 'g', 'it': [
        {'ty': 'rc', 'nm': 'r', 'p': static([0, 0]), 's': static([56, 12]), 'r': 5},
        stroke(3, DIM),
        transform(),
    ]},
     {'ty': 'gr', 'nm': 'screws', 'it': [
         {'ty': 'el', 'nm': 'a', 'p': static([-17, 0]), 's': static([4, 4]), 'd': 1},
         fill(DIM),
         transform(),
     ]},
     {'ty': 'gr', 'nm': 'screws2', 'it': [
         {'ty': 'el', 'nm': 'b', 'p': static([17, 0]), 's': static([4, 4]), 'd': 1},
         fill(DIM),
         transform(),
     ]}],
    {'o': static(100), 'r': static(0), 'p': static([PIVOT[0], 28, 0]), 'a': static([0, 0, 0]),
     's': static([100, 100, 100])},
)

doc = {'v': '5.9.0', 'fr': FR, 'ip': 0, 'op': OP, 'w': W, 'h': H,
       'nm': 'clock-swing', 'ddd': 0, 'assets': [],
       'layers': [pendulum, arc, mount]}

out = str(Path(__file__).with_name('clock-swing.json'))
with open(out, 'w') as f:
    json.dump(doc, f, ensure_ascii=False, indent=1)
    f.write('\n')
print(f'写入 {out}')
print(f'  摆幅序列 {list(zip(swing_times, swing_vals))}')
print(f'  弧线端点 ±{ax:.1f}px @ y={ay:.1f}')
