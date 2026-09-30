"""按仓内运动令牌生成 door-lock.json（P4 隔间硬阻断门体强调——本集 Lottie 点缀）。

口径与 gen_plug_pulse.py / gen_clock_swing.py 同源（脚本生成、非设计工具导出；
LottieEmphasis 四条断言把关）。本资产只承担**锁死瞬间的强调脉冲**——「薄帘门→
铁门」的门体形变由场景侧 SVG 门以 useProgress 持续驱动（分镜 4-D 动效列分工：
门体变厚锁死 = useProgress，LottieEmphasis = 脉冲）：
  - 门栓射出（deny）：scaleX 0→snap 过冲 109.5%→100（DUR.f4 强调 + f3 收束）；
  - 外环脉冲（deny）：f6 扩散 26%→132%（decelerate——大位移仓内标准曲线）；
  - 内环回响：f2 错峰起跳，f5 收敛（同 plug-pulse 双环语汇）；
  - 落门闪光（deny 面片）：f3 内 accelerate 淡出（出场快于入场）。

颜色硬编码 theme.deny #EF6461（拒绝/拦截唯一语义——「直接拦下」；theme.ts 改色
须重跑本脚本，同 plug-pulse 维护债）。
"""
import json
import math
from pathlib import Path

FR, OP = 30, 22
W = H = 200
DENY = [0.9373, 0.3922, 0.3765, 1]  # #EF6461

DUR = {'f2': 3, 'f3': 5, 'f4': 7, 'f5': 12, 'f6': 21}
M3 = {
    'standard': (0.2, 0.0, 0.0, 1.0),
    'decelerate': (0.05, 0.7, 0.1, 1.0),
    'accelerate': (0.3, 0.0, 0.8, 0.15),
}
ZETA = 12 / (2 * math.sqrt(100 * 1))
OVERSHOOT = 1 + math.exp(-math.pi * ZETA / math.sqrt(1 - ZETA ** 2))  # 1.0948
PEAK = round(OVERSHOOT * 100, 1)


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


def stroke(width, color=DENY, opacity=100, cap=2, join=2):
    return {'ty': 'st', 'c': static(color), 'o': static(opacity), 'w': static(width),
            'lc': cap, 'lj': join}


def fill(color, opacity=100):
    return {'ty': 'fl', 'c': static(color), 'o': static(opacity)}


def shape_layer(ind, name, shapes, ks, ip=0, op=OP):
    return {'ddd': 0, 'ind': ind, 'ty': 4, 'nm': name, 'sr': 1, 'ks': ks,
            'ao': 0, 'shapes': shapes, 'ip': ip, 'op': op, 'st': 0, 'bm': 0}


# ── 图层 4（最底）：落门闪光——门板落定瞬间的 deny 面片，f3 内淡出
slam = shape_layer(
    4, 'slam-flash',
    [{'ty': 'gr', 'nm': 'g', 'it': [
        {'ty': 'rc', 'nm': 'r', 'p': static([0, 0]), 's': static([120, 176]), 'r': 8},
        fill(DENY, 34),
        transform(),
    ]}],
    {'o': anim([kf(0, 62, M3['accelerate']), kf(DUR['f3'], 0, last=True)]),
     'r': static(0), 'p': static([W / 2, H / 2, 0]), 'a': static([0, 0, 0]),
     's': anim([kf(0, [96, 96, 100], M3['decelerate']), kf(DUR['f4'], [100, 100, 100], last=True)])},
)

# ── 图层 3：外环脉冲——f6 扩散（decelerate），同 plug-pulse 外环语汇
ring_outer = shape_layer(
    3, 'pulse-ring-outer',
    [{'ty': 'gr', 'nm': 'g', 'it': [
        {'ty': 'el', 'nm': 'e', 'p': static([0, 0]), 's': static([128, 128]), 'd': 1},
        stroke(anim([kf(0, 5.0, M3['decelerate']), kf(DUR['f6'], 1.4, last=True)])),
        transform(),
    ]}],
    {'o': anim([kf(0, 74, M3['decelerate']), kf(DUR['f6'], 0, last=True)]),
     'r': static(0), 'p': static([W / 2, H / 2, 0]), 'a': static([0, 0, 0]),
     's': anim([kf(0, [26, 26, 100], M3['decelerate']), kf(DUR['f6'], [132, 132, 100], last=True)])},
)

# ── 图层 2：内环回响——f2 错峰起跳、f5 收敛
ring_inner = shape_layer(
    2, 'pulse-ring-inner',
    [{'ty': 'gr', 'nm': 'g', 'it': [
        {'ty': 'el', 'nm': 'e', 'p': static([0, 0]), 's': static([128, 128]), 'd': 1},
        stroke(anim([kf(DUR['f2'], 3.4, M3['decelerate']), kf(DUR['f2'] + DUR['f5'], 1.1, last=True)])),
        transform(),
    ]}],
    {'o': anim([kf(DUR['f2'], 50, M3['decelerate']), kf(DUR['f2'] + DUR['f5'], 0, last=True)]),
     'r': static(0), 'p': static([W / 2, H / 2, 0]), 'a': static([0, 0, 0]),
     's': anim([kf(DUR['f2'], [22, 22, 100], M3['decelerate']),
                kf(DUR['f2'] + DUR['f5'], [86, 86, 100], last=True)])},
)

# ── 图层 1（最上）：门栓射出——scaleX snap 过冲 109.5% 落回（与场景侧弹簧同源同公式）
bolt_settle = DUR['f4'] + DUR['f3']
bolt = shape_layer(
    1, 'bolt-shoot',
    [{'ty': 'gr', 'nm': 'g', 'it': [
        # 锚在左端（门框左立柱），rect 自锚点向右伸出
        {'ty': 'rc', 'nm': 'r', 'p': static([34, 0]), 's': static([68, 15]), 'r': 4},
        fill(DENY),
        transform(),
    ]}],
    {'o': anim([kf(0, 100, M3['accelerate']), kf(OP - DUR['f2'], 100, M3['accelerate']),
                kf(OP, 0, last=True)]),
     'r': static(0), 'p': static([W / 2 - 62, H / 2, 0]), 'a': static([0, 0, 0]),
     's': anim([kf(0, [0, 100, 100], M3['decelerate']),
                kf(DUR['f4'], [PEAK, 100, 100], M3['standard']),
                kf(bolt_settle, [100, 100, 100], last=True)])},
)

doc = {'v': '5.9.0', 'fr': FR, 'ip': 0, 'op': OP, 'w': W, 'h': H,
       'nm': 'door-lock', 'ddd': 0, 'assets': [],
       'layers': [bolt, ring_inner, ring_outer, slam]}

out = str(Path(__file__).with_name('door-lock.json'))
with open(out, 'w') as f:
    json.dump(doc, f, ensure_ascii=False, indent=1)
    f.write('\n')
print(f'写入 {out}')
print(f'  门栓：f4={DUR["f4"]}f 射出 + snap 过冲 {PEAK}% → f3 收束')
print(f'  外环：f6={DUR["f6"]}f 扩散 26→132%；内环 f2 错峰 f5 收敛；闪光 f3 淡出')
