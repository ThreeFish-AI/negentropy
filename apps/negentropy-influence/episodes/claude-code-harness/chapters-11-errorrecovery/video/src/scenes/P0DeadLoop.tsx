/** P0 停摆的循环（p0-01..p0-10，3 镜）——分镜 0-A / 0-B / 0-C。
 *
 *  叙事链：系列片头交棒后冷启动直入（开篇视听合力 I-039）：环体〔M-001〕居中
 *  匀转、「调用模型」段暗橙微光驻位 → p0-01「一出错就当场停摆」词落位红色报错
 *  帧砸中该段——环体当场压黑停转、光流冻结〔M-005〕 → p0-02 死寂静止一拍
 *  （以静写闷〔M-002〕，无任何新动效）→ p0-03 小车剪影掠过环侧（类比 A#6，
 *  ≤2s 即收）→ p0-04「崩」字报错帧炸出红色碎屑 → p0-05 三条退路小图标（重试
 *  环／换路箭头／剪刀）依次弹出又各自灰灭〔M-006〕（退路存在却不走）→ 0-B
 *  熄黑环体退居屏左、右侧生产网格四枚错误图标 stagger 点亮各配红色小场景、
 *  p0-08 三枚缺口标签浮出细线归位（四错归三缺）→ 0-C 压黑→复亮契约色正反打
 *  （重音镜）：环体逐段复亮回陶土橙、恢复转动；三条恢复蓝路径自错误点扇形
 *  展开（端点空签）；p0-10 @pushIn 推近环体段位——morph 后半程路径根部平滑
 *  下滑重接至分类卡下缘、分类卡自收拢点生长入场（先锚后卡，G1 ③）。
 *
 *  空间契约：0-A 环体居中为唯一主体、报错帧砸中「调用模型」段位、署源角标
 *    右下恒定不抢焦；0-B 四图标等距排列、缺口标签 ≤3 枚且 p0-08 前不可见；
 *    0-C 三路径同色恢复蓝、端点空签不显字、环体复亮一次完成不复黑。
 *
 *  红线落实：词落位 = wa(id,f)（manifest 已就位；⑧ 轮已按句内字位复核一轮
 *    微调，词级 silencedetect 实测复核留 ⑨ 轮 QA，超前 >0.3s 即调）；y≥56 /
 *    bottom≥176；529 · overloaded / max_tokens · prompt_too_long · 429 rate
 *    limit 只进角标；四图标文字不成句复述口播；环体在 p0-02 前不恢复转动。
 *
 *  morph 登记（QA 教训 28 口径，0-C→1-A 主路径）：同一 LoopRing DOM 位
 *  （730,190,460）跨 0-A/0-C 不动，压黑/复亮走容器 opacity（0.22↔1）不改
 *  描边契约；三路径在 0-C 末段以根部/端点双插值收拢至分类卡下缘（重接轨迹
 *  连续可追），分类卡（RoutingTable rowsLit=0 空槽态）自收拢点 scale 生长，
 *  1-A 首帧同位承接——文本/槽位零重绘。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CallSegmentGlow, LoopRing, RING_STROKE, RoutingTable} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** ⑨ QA N1：压黑态环体 rim-light（#2A2A30 深灰描边档——状态面色常量留模块内
 *  不进 theme；压黑拍 max 42 亮度对 bg 17.6 几乎融背景，rim 保「环还在」可读） */
const RIM = '#2A2A30';

/** 压黑环的 rim 圈（画在熄黑环体之后一层——同 r 同心、略宽描边） */
const RingRim: React.FC<{cx: number; cy: number; r: number; opacity: number}> = ({cx, cy, r, opacity}) => (
  <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={RIM} strokeWidth={RING_STROKE + 5} opacity={clamp01(opacity)} />
  </svg>
);

/** 署源角标（首部署源位，RSI I-080 豁免登记）：右下常驻，一次淡入后恒定不抢焦；
 *  bottom 168 避开字幕条（承 ep1–ep10 SourceCredit 形态） */
const SourceCredit: React.FC<{lit?: number}> = ({lit = 1}) => (
  <div
    style={{
      position: 'absolute',
      right: 72,
      bottom: 168,
      fontFamily: theme.mono,
      fontSize: 22,
      letterSpacing: 1,
      color: theme.dim,
      opacity: 0.85 * clamp01(lit),
    }}
  >
    Learn Claude Code
  </div>
);

// ── 0-A 冷启动全景：匀转环体 → 报错帧砸停 → 死寂 → 小车 → 碎屑 → 三退路灰灭 ──

/** 环体全局位（0-A/0-C 同位不动——morph 主路径的构造性前提） */
const RING_W = {x: 730, y: 190, size: 460} as const;
const RING_C = {cx: RING_W.x + RING_W.size / 2, cy: RING_W.y + RING_W.size / 2, r: RING_W.size / 2 - 46} as const;
/** 报错帧砸中位 =「调用模型」段中点（段条 -120°..-60° 的中点 -90°＝环顶） */
const HIT = {x: RING_C.cx, y: RING_C.cy - RING_C.r} as const;

const ZeroA: React.FC<{
  atFall: number;
  atImpact: number;
  atCar: number;
  atBurst: number;
  atX1: number;
  atX2: number;
  atX3: number;
}> = ({atFall, atImpact, atCar, atBurst, atX1, atX2, atX3}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 报错帧自屏上方砸下（accelerate——落体感）
  const fall = clamp01(progress(frame, atFall, 13));
  const fallEase = fall * fall;
  const frameY = -120 + (HIT.y + 20 - -120) * fallEase;
  const frameX = HIT.x - 62;
  // 压黑停转（契约色事件：环体 opacity 压到 0.22、光流冻结在砸中帧）
  const dim = clamp01(progress(frame, atImpact, DUR.f4));
  const frozenAt = atImpact + 4;
  const dotPos = Math.min(frame, frozenAt) / (fps * 2.5);
  // 冲击闪（砸中一拍）
  const impact = Math.sin(Math.PI * clamp01(progress(frame, atImpact, 10)));
  // 红色碎屑（「崩」——12 枚确定性散射，禁随机数）
  const burst = clamp01(progress(frame, atBurst, 22));
  // 小车剪影（≤2s 即收——首尾自带淡入淡出）
  const car = clamp01(progress(frame, atCar, 56));
  const carX = -280 + 2400 * car;
  const carOp = Math.sin(Math.PI * clamp01(car * 1.05)) * 0.85;
  // 三条退路小图标：依次弹出又各自灰灭（弹出后 ~26 帧灰灭）
  const exits = [
    {at: atX1, x: 620, label: '重试'},
    {at: atX2, x: 940, label: '换路'},
    {at: atX3, x: 1260, label: '减上下文'},
  ];
  return (
    <AbsoluteFill>
      {/* 环体（匀转 → 压黑停转；压黑＝容器 opacity，描边契约不动） */}
      {/* ⑨ QA N1：压黑拍 rim-light——熄黑环后一层深灰圈，防融背景（前后帧锚） */}
      <RingRim cx={RING_C.cx} cy={RING_C.cy} r={RING_C.r} opacity={0.9 * dim} />
      <div style={{position: 'absolute', left: RING_W.x, top: RING_W.y, opacity: 1 - 0.78 * dim}}>
        <LoopRing size={RING_W.size} nodes={[]} showExit={false} dotProgress={dotPos % 1} />
        <svg width={RING_W.size} height={RING_W.size} viewBox={`0 0 ${RING_W.size} ${RING_W.size}`} style={{position: 'absolute', inset: 0}}>
          {/* 「调用模型」段暗橙微光（砸中位锚定） */}
          <CallSegmentGlow cx={RING_W.size / 2} cy={RING_W.size / 2} r={RING_C.r} segP={1} glowP={0.4 * (1 - dim)} />
        </svg>
      </div>
      {/* 报错帧（警示红——砸中后驻停拍位） */}
      <div
        style={{
          position: 'absolute',
          left: frameX,
          top: frameY,
          width: 124,
          height: 72,
          borderRadius: 10,
          border: `4px solid ${theme.danger}`,
          background: withAlpha(theme.panel, 0.96),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.mono,
          fontSize: 22,
          fontWeight: 700,
          color: theme.danger,
          whiteSpace: 'nowrap',
          opacity: clamp01(progress(frame, atFall, 3)) * (1 - 0.55 * burst),
          boxShadow: `0 0 ${18 * impact}px ${withAlpha(theme.danger, 0.7)}`,
        }}
      >
        {'报错'}
      </div>
      {/* 冲击闪圈 */}
      {impact > 0.03 ? (
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <circle cx={HIT.x} cy={HIT.y + 10} r={26 + 90 * impact} fill="none" stroke={theme.danger} strokeWidth={4} opacity={impact * 0.8} />
        </svg>
      ) : null}
      {/* 红色碎屑（12 枚——角度/距离全确定性） */}
      {burst > 0.02 && burst < 0.98
        ? Array.from({length: 12}, (_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            const d = 26 + 118 * (1 - (1 - burst) * (1 - burst));
            return (
              <div
                key={`sh${i}`}
                style={{
                  position: 'absolute',
                  left: HIT.x + Math.cos(a) * d - 5,
                  top: HIT.y + 10 + Math.sin(a) * d * 0.72 - 5,
                  width: 11,
                  height: 7,
                  borderRadius: 2,
                  background: theme.danger,
                  opacity: 1 - burst,
                  transform: `rotate(${i * 37 + burst * 90}deg)`,
                }}
              />
            );
          })
        : null}
      {/* 小车剪影（一碰就熄火的车——类比 A#6，掠过环侧即收） */}
      {carOp > 0.02 ? (
        <svg width={220} height={90} viewBox="0 0 220 90" style={{position: 'absolute', left: carX, top: 664, opacity: carOp, overflow: 'visible'}}>
          <path d="M 18 62 L 34 34 L 96 30 L 128 12 L 176 14 L 196 40 L 204 62 Z" fill={withAlpha(theme.dim, 0.5)} />
          <rect x="8" y="58" width="204" height="10" rx="4" fill={withAlpha(theme.dim, 0.34)} />
          <circle cx="60" cy="72" r="13" fill="none" stroke={theme.dim} strokeWidth="4" />
          <circle cx="164" cy="72" r="13" fill="none" stroke={theme.dim} strokeWidth="4" />
        </svg>
      ) : null}
      {/* 三条退路小图标（弹出 → 灰灭——退路存在却不走） */}
      {exits.map((e, i) => {
        const pop = clamp01(progress(frame, e.at, DUR.f4));
        const gray = clamp01(progress(frame, e.at + 26, DUR.f4));
        const iconColor = gray > 0.4 ? theme.dim : theme.core;
        return pop > 0.02 ? (
          <div
            key={`ex${i}`}
            style={{
              position: 'absolute',
              left: e.x,
              top: 684,
              width: 168,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              opacity: pop * (1 - 0.62 * gray),
              transform: `translateY(${(1 - pop) * 18}px)`,
            }}
          >
            <svg width={44} height={44} viewBox="0 0 44 44" style={{opacity: 1 - 0.5 * gray}}>
              {i === 0 ? (
                <g stroke={iconColor} strokeWidth={3.4} fill="none" strokeLinecap="round">
                  <path d="M 35 22 A 13 13 0 1 1 22 9" />
                  <path d="M 17 4 L 24 9 L 17 14" strokeLinejoin="round" />
                </g>
              ) : null}
              {i === 1 ? (
                <g stroke={iconColor} strokeWidth={3.4} fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M 6 34 L 18 34 L 30 14 L 38 14" />
                  <path d="M 6 14 L 16 14 L 24 26" strokeDasharray="4 5" />
                  <path d="M 33 9 L 40 14 L 33 19" />
                </g>
              ) : null}
              {i === 2 ? (
                <g stroke={iconColor} strokeWidth={3.4} fill="none" strokeLinecap="round">
                  <path d="M 12 8 L 32 36 M 32 8 L 12 36" />
                  <circle cx="10" cy="6" r="4" />
                  <circle cx="34" cy="6" r="4" />
                </g>
              ) : null}
            </svg>
            <div
              style={{
                padding: '4px 16px',
                borderRadius: 8,
                border: `2.5px solid ${gray > 0.4 ? theme.panelBorder : withAlpha(theme.core, 0.7)}`,
                background: theme.panel,
                fontFamily: theme.sans,
                fontSize: 19,
                fontWeight: 700,
                color: gray > 0.4 ? theme.dim : theme.text,
                whiteSpace: 'nowrap',
              }}
            >
              {e.label}
            </div>
          </div>
        ) : null;
      })}
      <SourceCredit lit={clamp01(progress(frame, 4, DUR.f5))} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'529 · overloaded'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-B 病灶清账：熄黑环体退居屏左 + 生产网格四错误图标 + 四错归三缺 ──────────

/** 熄黑环体背景锚位（屏左小比例非焦点） */
const RING_B = {x: 120, y: 330, size: 220} as const;
const ICON_PANELS = [
  {x: 620, y: 168, name: '截断', kind: 'trunc' as const},
  {x: 1000, y: 168, name: '超限', kind: 'overflow' as const},
  {x: 620, y: 424, name: '限流', kind: 'throttle' as const},
  {x: 1000, y: 424, name: '过载', kind: 'overload' as const},
];

/** 四类错误图标（各配一个红色小场景——SVG 直陈，错误码进角标） */
const ErrorGlyph: React.FC<{kind: 'trunc' | 'overflow' | 'throttle' | 'overload'; lit: number}> = ({kind, lit}) => {
  const hot = clamp01(lit);
  const c = hot > 0.3 ? theme.danger : theme.dim;
  const w = 2.6 + 1.4 * hot;
  return (
    <svg width={150} height={110} viewBox="0 0 150 110">
      {kind === 'trunc' ? (
        <g stroke={c} strokeWidth={w} fill="none" strokeLinecap="round">
          <path d="M 20 22 L 96 22 M 20 40 L 112 40 M 20 58 L 88 58" opacity={0.85} />
          <path d="M 22 76 L 44 70 L 62 80 L 84 72 L 106 78" strokeDasharray={hot > 0.4 ? undefined : '4 5'} />
          <path d="M 118 18 L 118 82" strokeDasharray="5 6" opacity={0.6} />
        </g>
      ) : null}
      {kind === 'overflow' ? (
        <g stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round">
          <rect x="46" y="26" width="66" height="58" rx="6" strokeDasharray="7 6" />
          <rect x="30" y="14" width="86" height="74" rx="8" opacity={0.55} transform={`translate(${4 * hot} ${4 * hot})`} />
        </g>
      ) : null}
      {kind === 'throttle' ? (
        <g stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round">
          <path d="M 48 16 L 102 16 L 102 38 L 75 55 L 102 72 L 102 94 L 48 94 L 48 72 L 75 55 L 48 38 Z" />
          <path d="M 58 26 L 92 26 L 92 36 L 75 47 Z" fill={withAlpha(theme.danger, 0.4 * hot)} />
        </g>
      ) : null}
      {kind === 'overload' ? (
        <g stroke={c} strokeWidth={w} fill="none">
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((k) => (
              <rect key={`sv${r}${k}`} x={34 + k * 34} y={20 + r * 30} width={26} height={22} rx={3} fill={hot > 0.5 ? withAlpha(theme.danger, 0.4) : 'none'} />
            )),
          )}
        </g>
      ) : null}
    </svg>
  );
};

const ZeroB: React.FC<{atDensify: number; atIcons: number[]; atLacks: number}> = ({atDensify, atIcons, atLacks}) => {
  const frame = useCurrentFrame();
  // 网格错误点由零星转密集闪烁（阈值随 densify 提升；hash 确定性选点）
  const dens = clamp01(progress(frame, atDensify, 42));
  const pitch = 46;
  const cols = Math.floor((1860 - 580) / pitch);
  const rows = Math.floor((900 - 150) / pitch);
  const hash = (i: number) => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  // 缺口标签（p0-08 前不可见）+ 四错归三缺连线
  const lacks = [
    {t: '缺额度', x: 700, from: [0]},
    {t: '缺空间', x: 970, from: [1]},
    {t: '欠时间', x: 1240, from: [2, 3]},
  ];
  const lackIn = clamp01(progress(frame, atLacks, DUR.f5));
  return (
    <AbsoluteFill>
      {/* 生产环境背景网格（暗色点阵 + 错误点闪烁） */}
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
        {Array.from({length: cols}, (_, cx) =>
          Array.from({length: rows}, (_, ry) => {
            const i = ry * cols + cx;
            const h = hash(i);
            const isErr = h < 0.05 + 0.3 * dens;
            const blink = isErr ? 0.3 + 0.45 * (0.5 + 0.5 * Math.sin(frame / (3 + h * 6) + h * 40)) : 0;
            return (
              <circle
                key={`g${i}`}
                cx={580 + cx * pitch}
                cy={150 + ry * pitch}
                r={isErr ? 4.2 : 2.2}
                fill={isErr ? theme.danger : theme.panelBorder}
                opacity={isErr ? blink : 0.4}
              />
            );
          }),
        )}
      </svg>
      {/* 熄黑环体（背景锚——压黑态驻位小比例；⑨ QA N1 rim 保可读） */}
      <RingRim cx={RING_B.x + RING_B.size / 2} cy={RING_B.y + RING_B.size / 2} r={RING_B.size / 2 - 46} opacity={0.9} />
      <div style={{position: 'absolute', left: RING_B.x, top: RING_B.y, opacity: 0.3}}>
        <LoopRing size={RING_B.size} nodes={[]} showExit={false} />
      </div>
      {/* 四枚错误图标面板（等距 2×2——各配红色小场景一闪） */}
      {ICON_PANELS.map((p, i) => {
        const lit = clamp01(progress(frame, atIcons[i], DUR.f5));
        const flash = Math.sin(Math.PI * clamp01(progress(frame, atIcons[i] + 3, 14)));
        return (
          <div
            key={p.kind}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: 320,
              height: 226,
              borderRadius: 14,
              border: `3px solid ${lit > 0.3 ? withAlpha(theme.danger, 0.75) : theme.panelBorder}`,
              background: withAlpha(theme.panel, 0.92),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              opacity: 0.45 + 0.55 * lit,
              boxShadow: flash > 0.05 ? `0 0 ${20 * flash}px ${withAlpha(theme.danger, 0.5 * flash)}` : 'none',
            }}
          >
            <ErrorGlyph kind={p.kind} lit={lit} />
            <div style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: lit > 0.3 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{p.name}</div>
          </div>
        );
      })}
      {/* 三枚缺口标签 + 细线归位（四错归三缺的归并关系可视） */}
      {lackIn > 0.02 ? (
        <>
          <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
            {lacks.map((l, li) =>
              l.from.map((fi) => {
                const p = ICON_PANELS[fi];
                const x0 = p.x + 160;
                const y0 = p.y + 226;
                const x1 = l.x + 64;
                const y1 = 726;
                const lp = clamp01(lackIn * 1.6 - li * 0.18);
                return (
                  <path
                    key={`lk${li}${fi}`}
                    d={`M ${x0} ${y0} Q ${(x0 + x1) / 2} ${(y0 + y1) / 2 - 26} ${x1} ${y1}`}
                    fill="none"
                    stroke={withAlpha(theme.dim, 0.65)}
                    strokeWidth={2}
                    strokeDasharray="6 6"
                    opacity={lp}
                  />
                );
              }),
            )}
          </svg>
          {lacks.map((l, li) => {
            const lp = clamp01(lackIn * 1.5 - li * 0.2);
            return lp > 0.02 ? (
              <div
                key={`lc${li}`}
                style={{
                  position: 'absolute',
                  left: l.x,
                  top: 726,
                  padding: '7px 22px',
                  borderRadius: 10,
                  border: `2.5px solid ${withAlpha(theme.dim, 0.8)}`,
                  background: theme.panel,
                  fontFamily: theme.sans,
                  fontSize: 21,
                  fontWeight: 700,
                  color: theme.text,
                  whiteSpace: 'nowrap',
                  opacity: lp,
                  transform: `translateY(${(1 - lp) * 12}px)`,
                }}
              >
                {l.t}
              </div>
            ) : null;
          })}
        </>
      ) : null}
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'max_tokens · prompt_too_long · 429 rate limit'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-C 转场全景：压黑→复亮正反打 + 三路径扇形展开 + pushIn 收拢交棒 ──────────

/** 1-A 分类卡承接位（0-C morph 终态 = 1-A 首帧位） */
const CARD_1A = {x: 1210, y: 180, w: 560, h: 300} as const;
const CHAN_XS = [1310, 1490, 1670] as const;
const PATH_FAN = [
  {x: 1580, y: 300},
  {x: 1660, y: 450},
  {x: 1580, y: 600},
] as const;

const ZeroC: React.FC<{atRelight: number; atPaths: number; atPush: number}> = ({atRelight, atPaths, atPush}) => {
  const frame = useCurrentFrame();
  // 压黑→复亮（契约色正反打：一次完成不复黑）
  const relight = clamp01(progress(frame, atRelight, DUR.f6));
  const ringOp = 0.22 + 0.78 * relight;
  // 光流解冻复转（复亮同拍起转）
  const dotPos = 0.62 + Math.max(0, frame - atRelight) / 75;
  // 三条恢复蓝路径依次展开（端点空签保持暗态）
  const pathPs = [0, 1, 2].map((i) => clamp01(progress(frame, atPaths + i * 7, DUR.f5 + 6)));
  // pushIn 收拢（G1 ③：根部下滑重接 + 分类卡后半程自收拢点生长——先锚后卡）
  const push = clamp01(progress(frame, atPush, 46));
  const rootP = clamp01(progress(frame, atPush + 8, 38));
  const cardIn = clamp01(progress(frame, atPush + 26, 24));
  // 根部自错误点 (HIT) 平滑下滑重接至分类卡下缘中点 (CARD_1A 底边中点)
  const rootX = HIT.x + (1490 - HIT.x) * rootP;
  const rootY = HIT.y + (CARD_1A.y + CARD_1A.h - HIT.y) * rootP;
  const pushTf = usePushIn(atPush, {scale: 0.06, dur: 46});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: pushTf, transformOrigin: `${(HIT.x / 1920) * 100}% ${((HIT.y + 30) / 1080) * 100}%`}}>
        {/* 环体（复亮回陶土橙——恢复转动；⑨ QA N1 复亮前压黑态 rim 随 relight 淡出） */}
        <RingRim cx={RING_C.cx} cy={RING_C.cy} r={RING_C.r} opacity={0.9 * (1 - relight)} />
        <div style={{position: 'absolute', left: RING_W.x, top: RING_W.y, opacity: ringOp}}>
          <LoopRing size={RING_W.size} nodes={[]} showExit={false} dotProgress={dotPos % 1} />
          <svg width={RING_W.size} height={RING_W.size} viewBox={`0 0 ${RING_W.size} ${RING_W.size}`} style={{position: 'absolute', inset: 0}}>
            <CallSegmentGlow cx={RING_W.size / 2} cy={RING_W.size / 2} r={RING_C.r} segP={1} glowP={0.35 + 0.5 * relight} />
          </svg>
        </div>
        {/* 三条恢复蓝路径（扇形展开 → 收拢为卡下通道；端点空签不显字） */}
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          {pathPs.map((pp, i) => {
            if (pp <= 0.02) return null;
            const fan = PATH_FAN[i];
            const endX = fan.x + (CHAN_XS[i] - fan.x) * rootP;
            const endY = fan.y + (CARD_1A.y + CARD_1A.h + 110 - fan.y) * rootP;
            const midX = (rootX + endX) / 2 + (i - 1) * 60 * (1 - rootP);
            const midY = (rootY + endY) / 2 - 40;
            const d = `M ${rootX} ${rootY} Q ${midX} ${midY} ${endX} ${endY}`;
            return (
              <g key={`pa${i}`} opacity={pp}>
                <path d={d} fill="none" stroke={withAlpha(theme.mech, 0.75)} strokeWidth={3.5} strokeDasharray="9 8" />
                {/* 端点空签（暗态空槽——动作名留 P1 逐行点火） */}
                <rect x={endX - 34} y={endY - 22} width={68} height={44} rx={8} fill={withAlpha(theme.panel, 0.92)} stroke={withAlpha(theme.mech, 0.55)} strokeWidth={2.5} strokeDasharray="6 5" />
              </g>
            );
          })}
        </svg>
        {/* 分类卡（morph 后半程自收拢点生长——三行空槽暗态） */}
        {cardIn > 0.02 ? (
          <div style={{position: 'absolute', left: CARD_1A.x, top: CARD_1A.y, width: CARD_1A.w, height: CARD_1A.h, opacity: cardIn, transform: `scale(${0.55 + 0.45 * cardIn})`, transformOrigin: '20% 120%'}}>
            <RoutingTable x={0} y={0} w={CARD_1A.w} h={CARD_1A.h} litP={1} rowsLit={0} />
          </div>
        ) : null}
      </div>
      <SourceCredit />
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0DeadLoop: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p0-01', 'p0-05');
  const bB = w('p0-06', 'p0-08');
  const bC = w('p0-09', 'p0-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A">
        <ZeroA
          atFall={wa('p0-01', 0.34) - bA.from}
          atImpact={wa('p0-01', 0.58) - bA.from}
          atCar={wa('p0-03', 0.62) - bA.from}
          atBurst={wa('p0-04', 0.9) - bA.from}
          atX1={wa('p0-05', 0.1) - bA.from}
          atX2={wa('p0-05', 0.42) - bA.from}
          atX3={wa('p0-05', 0.74) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atDensify={wa('p0-06', 0.42) - bB.from}
          atIcons={[wa('p0-07', 0.1), wa('p0-07', 0.36), wa('p0-07', 0.62), wa('p0-07', 0.88)].map((v) => v - bB.from)}
          atLacks={wa('p0-08', 0.44) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="0-C">
        <ZeroC
          atRelight={wa('p0-09', 0.66) - bC.from}
          atPaths={wa('p0-09', 0.44) - bC.from}
          atPush={wa('p0-10', 0.58) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0DeadLoop;
