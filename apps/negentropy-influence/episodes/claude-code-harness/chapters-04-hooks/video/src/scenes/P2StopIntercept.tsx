/** P2 连做完了都能拦（p2-01..p2-09，3 镜）——分镜 2-A / 2-B / 2-C。
 *
 *  叙事链：Morph Continuity（1-D→2-A）同一主体 = 环体 Stop 挂点（紫钩 + 被勾
 *  「做完了」文本块）：2-A 开帧环体全景一拍（四紫点在位、第四点 Stop 位高亮
 *  视框）→ 出口门对象放大入场（门体背景渐显——钩形、挂点紫描边、文本块签色
 *  逐帧不变，仅尺度变化）：陶土橙门框半开、判据灯亮「无工具调用」绿签、紫钩
 *  驻门楣、「做完了」块挂钩上；「该退了」门开到一半、「拦下来」紫钩甩下勾住
 *  门缘——门在半开位被拦停（拦停 punch）→ 2-B 机制图：退出前触发标记（紫点）
 *  → 钩子返回气泡（回调蓝）分两路——上路「有内容」：用户消息条塞回消息流、
 *  环体转一圈（续跑一轮）；下路「空」：放行箭头直通出口（唯一确认绿通路）；
 *  两路按句先后单活（互斥语义）→ 2-C 原型日志走查（Animated State Trace）：
 *  左轨消息流（模型侧「我做完了」条 + 注入 user 条）、右轨两行 Stop 日志滑过
 *  （8→9——数字恒由日志行承载）、循环源码面板缩悬左上恒挂「0 行改动」徽标
 *  （重读一拍重音镜）、出口门远位在画、「退出权」三字压门、问号打光定格半拍
 *  收暗（幕尾悬念）。
 *
 *  空间契约：morph 身份线索保两项（挂点紫描边 + 钩形轮廓）；判据灯绿签为 2-A
 *  唯一确认绿元素、门停半开位（不是关上也不是全开）、判据灯不转红（判据没错
 *  ——是钩子拦的）；2-B 两路恒上内容下空、互斥单活、上路消息条恒回调蓝、
 *  下路为唯一确认绿通路；2-C 日志两行次序 8→9、消息条角色恒 user、徽标全程
 *  在场不闪、源码面板零改动痕迹。
 *
 *  红线落实：词落位 = 句首 + 句长比例；消息条只塞向模型侧；环体转圈不加计数
 *  （数字由日志行承载）；y≥56 / bottom≥168。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {HookGlyph, HookPoint, HookRegistry, LogTrace, LoopRing, Panel, SceneTag, ringPt, useRingDot} from '../components/motifs';
import {DUR, clamp01, progress, useFlowDash, useImpulse, useProgress, useSpring} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const Foot2: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 168,
      textAlign: 'center',
      fontFamily: theme.mono,
      fontSize: 22,
      color: theme.dim,
      opacity: 0.85,
    }}
  >
    {children}
  </div>
);

/** 环体几何（2-A 承 1-D 末态同位——morph 连续的前提） */
const RING_2A = {cx: 960, cy: 540, size: 620} as const;
const HOOK_ANGLES = [-90, 0, 90, 180] as const;
/** 出口门（环左——Stop 挂点 180° 邻位；门楣即挂钩位）。1-D 暗门同位——morph
 *  身份线索（挂点紫描边 + 钩形轮廓）由「钩/块绝对不动」保两项成立。 */
const DOOR = {x: 560, y: 400, w: 220, h: 320} as const;

// ── 2-A 出口特写：判据灯 + 半开被拦停（morph 承 1-D） ───────────────────

const ShotA: React.FC<{atFocus: number; atLamp: number; atOpen: number; atCatch: number}> = ({atFocus, atLamp, atOpen, atCatch}) => {
  const cx = RING_2A.cx;
  const cy = RING_2A.cy;
  const r = RING_2A.size / 2 - 46;
  // 门体对象放大入场（门体背景渐显；相机不动——钩/块/紫描边逐帧不变）
  const doorGrow = useProgress(atFocus, DUR.f6, 'decelerate');
  const doorS = 0.86 + 0.14 * doorGrow;
  const ringDim = 1 - 0.6 * doorGrow;
  // 判据灯（「判据说」——绿签亮出：无工具调用）
  const lamp = useProgress(atLamp, DUR.f4);
  const lampPulse = useImpulse({at: atLamp, dur: DUR.f5, peak: 1});
  // 门开度（15% → 「该退了」50%；「拦下来」被钩勾住门缘——恒停半开位）
  const openBase = 0.15 + 0.35 * useProgress(atOpen, DUR.f4);
  const catchSwing = useSpring('snap', {at: atCatch, dur: DUR.f4});
  const catchPulse = useImpulse({at: atCatch + DUR.f3, dur: DUR.f5, peak: 1});
  const open = openBase + 0.06 * catchSwing;
  // 第四点 Stop 位高亮视框（开帧全景坐标锚）
  const stopPt = ringPt(cx, cy, r, 180);
  const frameBoxO = useProgress(0, DUR.f4) * (1 - doorGrow * 0.9);
  const dot = useRingDot(3.4);
  return (
    <AbsoluteFill>
      {/* 环体全景（承 1-D 末态——四紫点在位；随门放大退为背景） */}
      <div style={{position: 'absolute', left: cx - RING_2A.size / 2, top: cy - RING_2A.size / 2, opacity: ringDim}}>
        <LoopRing size={RING_2A.size} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {HOOK_ANGLES.map((a, i) => (
        <div key={`pt${i}`} style={{opacity: ringDim}}>
          <HookPoint cx={ringPt(cx, cy, r, a).x} cy={ringPt(cx, cy, r, a).y} lit={1} />
        </div>
      ))}
      {/* 第四点（Stop 位）高亮视框——全景坐标锚，随门放大淡出 */}
      {frameBoxO > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: stopPt.x - 66,
            top: stopPt.y - 66,
            width: 132,
            height: 132,
            borderRadius: 14,
            border: `3px solid ${theme.mech}`,
            boxShadow: `0 0 ${20 * frameBoxO}px ${withAlpha(theme.mech, 0.6)}`,
            opacity: frameBoxO,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {/* ── 出口门区（对象放大渐显：门框在钩下方生长；钩/块绝对不动） ── */}
      <div
        style={{
          position: 'absolute',
          left: DOOR.x + DOOR.w / 2,
          top: DOOR.y + DOOR.h / 2,
          transform: `translate(-50%,-50%) scale(${doorS})`,
          transformOrigin: 'center',
          opacity: 0.3 + 0.7 * doorGrow,
        }}
      >
        <div style={{position: 'relative', width: DOOR.w, height: DOOR.h}}>
          {/* 门框（陶土橙——循环同源色） */}
          <svg width={DOOR.w} height={DOOR.h} viewBox={`0 0 ${DOOR.w} ${DOOR.h}`} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
            <path
              d={`M 10 ${DOOR.h - 10} L 10 66 Q 10 10, ${DOOR.w / 2} 10 Q ${DOOR.w - 10} 10, ${DOOR.w - 10} 66 L ${DOOR.w - 10} ${DOOR.h - 10}`}
              fill="none"
              stroke={theme.core}
              strokeWidth={7}
            />
            {/* 门扇（左铰链 scaleX 开合——15%→半开；钩住后恒停半开位） */}
            <rect
              x={12}
              y={64}
              width={DOOR.w - 24}
              height={DOOR.h - 76}
              rx={6}
              fill={withAlpha(theme.panel, 0.92)}
              stroke={theme.core}
              strokeWidth={4}
              style={{transform: `scaleX(${1 - clamp01(open)})`, transformOrigin: '12px center'}}
            />
          </svg>
          {/* 判据灯（门楣上方——绿签「无工具调用」为 2-A 唯一确认绿元素） */}
          <div
            style={{
              position: 'absolute',
              left: -96,
              top: -66,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 16px',
              borderRadius: 9,
              border: `2.5px solid ${theme.ok}`,
              background: withAlpha(theme.ok, 0.1 + 0.08 * lampPulse),
              opacity: lamp,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{width: 14, height: 14, borderRadius: 999, background: theme.ok, boxShadow: lampPulse > 0.01 ? `0 0 ${14 * lampPulse}px ${withAlpha(theme.ok, 0.8)}` : 'none'}} />
            <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 600, color: theme.ok}}>{'无工具调用'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'stop criteria'}</span>
          </div>
        </div>
      </div>
      {/* 紫钩驻门楣（1-D 末帧同位绝对不动——morph 身份线索；「拦下来」甩下勾住门缘） */}
      <div style={{position: 'absolute', left: 0, top: 0, transform: `rotate(${14 * (1 - clamp01(catchSwing))}deg)`, transformOrigin: '722px 472px', opacity: 1}}>
        <HookGlyph cx={722} cy={506} s={1.15} extend={1} />
      </div>
      {catchPulse > 0.01 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          <circle cx={688} cy={566} r={14 + 20 * catchPulse} fill="none" stroke={theme.mech} strokeWidth={4} opacity={catchPulse} />
        </svg>
      ) : null}
      {/* 「做完了」文本块（挂钩上——签色/形态与 1-D 末帧逐帧一致，绝对不动） */}
      <div style={{position: 'absolute', left: 600, top: 585, transform: `rotate(${catchSwing * -4}deg)`}}>
        <div
          style={{
            padding: '10px 22px',
            borderRadius: 10,
            border: `2.5px solid ${theme.hook}`,
            background: withAlpha(theme.hook, 0.16),
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{'做完了'}</span>
        </div>
      </div>
      {/* 拦停注记（门在半开位被拦停——不是关上也不是全开） */}
      <div
        style={{
          position: 'absolute',
          left: DOOR.x - 64,
          top: DOOR.y + DOOR.h + 40,
          fontFamily: theme.sans,
          fontSize: 24,
          fontWeight: 700,
          color: theme.mech,
          opacity: clamp01(catchSwing) * 0.95,
          whiteSpace: 'nowrap',
        }}
      >
        {'半开位 · 被拦停'}
      </div>
      <Foot2>{'Stop · 判据：无工具调用'}</Foot2>
    </AbsoluteFill>
  );
};

// ── 2-B 机制图：返回气泡分两路（上内容续跑 / 下空放行） ─────────────────

const ShotB: React.FC<{atTrig: number; atUp: number; atLoop: number; atDown: number}> = ({atTrig, atUp, atLoop, atDown}) => {
  // 「先触发一次」：紫点脉冲沿触发线到钩子（角标 trigger_hooks("Stop", messages)）
  const trig = useProgress(atTrig, DUR.f5, 'linear');
  const trigPulse = useImpulse({at: atTrig, dur: DUR.f5, peak: 1});
  // 上路「有内容」（回调蓝）：气泡展开成用户消息条塞回消息流
  const up = useProgress(atUp, DUR.f5);
  const msgSlide = useProgress(atUp + DUR.f4, DUR.f5, 'decelerate');
  // 「续跑一轮」：环体转一圈（消息条随流转回环内）
  const lap = useProgress(atLoop, DUR.f6, 'linear');
  // 下路「空」：放行箭头绿灯亮、门全开（确认绿——第二次放行的预演）。
  // 两路互斥单活：下路激活后上路连续降档到 0.35 底线（禁二态突变——QA-11）
  const down = useProgress(atDown, DUR.f4);
  const upVis = Math.max(0.35, up * (1 - down * 0.65));
  const flow = useFlowDash({dash: 8, gap: 11, period: 22});
  // 注册表 Stop 行缩微联动（串上一颗回调卡脉冲）
  const pulse = useImpulse({at: atTrig, dur: DUR.f5, peak: 1});
  return (
    <AbsoluteFill>
      <SceneTag chapter="Stop" tagline="两路分支" accent={theme.mech} />
      {/* 退出前触发标记（紫点——机制图起点） */}
      <HookPoint cx={330} cy={440} lit={1} pulse={trigPulse} />
      <div style={{position: 'absolute', left: 258, top: 480, fontFamily: theme.mono, fontSize: 15, color: theme.mech, whiteSpace: 'nowrap'}}>
        {'trigger_hooks("Stop", messages)'}
      </div>
      {/* 触发线（紫点 → 钩子；行进触发影） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}}>
        <line x1={352} y1={440} x2={590} y2={440} stroke={theme.mech} strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01(trig)} />
        {trig > 0.02 && trig < 1 ? <circle cx={352 + 238 * trig} cy={440} r={10} fill={theme.mech} /> : null}
      </svg>
      {/* 钩子（机制图中枢——挂点紫） */}
      <HookGlyph cx={640} cy={430} s={0.9} extend={1} />
      {/* 返回气泡（回调蓝——分叉源） */}
      <div style={{position: 'absolute', left: 586, top: 280, opacity: Math.max(upVis, down * 0.9)}}>
        <div
          style={{
            padding: '8px 16px',
            borderRadius: 12,
            border: `2.5px solid ${theme.hook}`,
            background: withAlpha(theme.hook, 0.14),
            fontFamily: theme.sans,
            fontSize: 19,
            fontWeight: 600,
            color: theme.text,
            whiteSpace: 'nowrap',
          }}
        >
          {'返回值'}
        </div>
      </div>
      {/* ── 上路「有内容」：消息条塞回消息流 → 环体再转一圈 ── */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}}>
        <path d="M 640 340 Q 800 240, 960 300" fill="none" stroke={theme.hook} strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01(up)} opacity={upVis} />
        <path d="M 960 360 Q 1060 400, 1150 430" fill="none" stroke={theme.hook} strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01(lap)} opacity={upVis} />
        {/* 下路「空」：放行箭头直通出口（确认绿——唯一绿通路） */}
        <path d="M 640 500 Q 820 600, 1010 640" fill="none" stroke={theme.ok} strokeWidth={4.5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01(down)} />
        {down > 0.9 ? <path d="M 1002 622 L 1030 642 L 998 656 Z" fill={theme.ok} /> : null}
      </svg>
      {/* 消息流竖列（模型侧 + 塞回的 user 条——上路落点） */}
      <div style={{position: 'absolute', left: 920, top: 260, opacity: upVis}}>
        <div style={{width: 210, height: 52, borderRadius: 9, border: `2px solid ${theme.panelBorder}`, background: theme.panel, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10}}>
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'model'}</span>
        </div>
        {/* user 消息条（回调蓝——塞回对话；随流转回环内） */}
        <div
          style={{
            width: 240,
            height: 56,
            marginTop: 26,
            borderRadius: 9,
            border: `2.5px solid ${theme.hook}`,
            background: withAlpha(theme.hook, 0.16),
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            gap: 10,
            opacity: msgSlide,
            transform: `translateY(${(1 - msgSlide) * -22}px)`,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.hook}}>{'user'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 17, color: theme.text, whiteSpace: 'nowrap'}}>{'还没——理由'}</span>
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 12}}>{'messages'}</div>
      </div>
      {/* 环体（上路终点——续跑一轮：转一圈） */}
      <div style={{position: 'absolute', left: 1150 - 130, top: 430 - 130, opacity: upVis}}>
        <LoopRing size={260} nodes={[]} showExit={false} dotProgress={lap % 1} />
      </div>
      {/* 出口门（下路终点——放行全开：确认绿描边） */}
      <div style={{position: 'absolute', left: 1040, top: 560, opacity: clamp01(down)}}>
        <svg width={120} height={160} viewBox="0 0 120 160" style={{overflow: 'visible'}}>
          <path d="M 8 152 L 8 46 Q 8 8, 60 8 Q 112 8, 112 46 L 112 152" fill="none" stroke={down > 0.5 ? theme.ok : theme.core} strokeWidth={6} />
          <rect x={10} y={44} width={100} height={106} rx={5} fill={withAlpha(theme.panel, 0.9)} stroke={down > 0.5 ? theme.ok : theme.core} strokeWidth={3.5} style={{transform: `scaleX(${1 - clamp01(down)})`, transformOrigin: '10px center'}} />
        </svg>
        {/* 放行绿灯（第二次放行的预演） */}
        <div style={{position: 'absolute', left: 128, top: 30, display: 'flex', alignItems: 'center', gap: 8, opacity: down}}>
          <span style={{width: 13, height: 13, borderRadius: 999, background: theme.ok, boxShadow: `0 0 14px ${withAlpha(theme.ok, 0.8)}`}} />
          <span style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 600, color: theme.ok, whiteSpace: 'nowrap'}}>{'放行'}</span>
        </div>
      </div>
      {/* 两路标签（上内容 / 下空——恒上位内容下空） */}
      <div style={{position: 'absolute', left: 770, top: 228, fontFamily: theme.sans, fontSize: 20, fontWeight: 600, color: theme.hook, opacity: upVis}}>
        {'有内容 · 塞回对话'}
      </div>
      <div style={{position: 'absolute', left: 770, top: 566, fontFamily: theme.sans, fontSize: 20, fontWeight: 600, color: theme.ok, opacity: clamp01(down)}}>
        {'空 · 直通出口'}
      </div>
      {/* 注册表 Stop 行缩微联动（串上一颗回调卡脉冲） */}
      <div style={{position: 'absolute', left: 1430, top: 96, opacity: 0.9}}>
        <HookRegistry
          x={0}
          y={0}
          w={470}
          lit={1}
          dim={0.3}
          scale={0.4}
          rows={[
            {lit: 1, beads: ['注入']},
            {lit: 1, beads: ['权限', '日志']},
            {lit: 1, beads: ['查副作用']},
            {lit: 1, beads: ['收尾'], active: 1, beadPulse: pulse},
          ]}
        />
      </div>
      <Foot2>{'返回内容 → 续跑 ｜ 返回空 → 退出'}</Foot2>
    </AbsoluteFill>
  );
};

// ── 2-C 原型日志走查（MS：消息流 + 日志行 + 0 行改动徽标 + 退出权悬念） ──

const ShotC: React.FC<{atModel: number; atVeto: number; atLog1: number; atInject: number; atLap: number; atLog2: number; atBadge: number; atWorth: number; atDim: number}> = ({
  atModel,
  atVeto,
  atLog1,
  atInject,
  atLap,
  atLog2,
  atBadge,
  atWorth,
  atDim,
}) => {
  const frame = useCurrentFrame();
  // 模型侧「我做完了」条弹出一拍；「还没——理由在这儿」紫钩签贴上（双声部对峙帧）
  const modelPop = useImpulse({at: atModel, dur: DUR.f4, peak: 0.06});
  const vetoO = useProgress(atVeto, DUR.f4);
  // 注入 user 条（回调蓝——塞回消息流）
  const inject = useProgress(atInject, DUR.f5, 'decelerate');
  // 「多跑一轮核对」：环体随消息流转过一圈（不加计数——数字恒由日志行承载）
  const lap = useProgress(atLap, DUR.f6, 'linear');
  // 「0 行改动」徽标重读一拍（重音镜——全程在场不闪，只重读）
  const badgeRead = useImpulse({at: atBadge, dur: DUR.f6, peak: 1});
  // 「退出权」三字压上出口门 + 问号打光定格（幕尾悬念）
  const worth = useProgress(atWorth, DUR.f5, 'decelerate');
  const worthGlow = useImpulse({at: atWorth + DUR.f4, dur: DUR.f6, peak: 1});
  const dimAll = useProgress(atDim, DUR.f4);
  // 循环源码面板（缩悬左上——恒挂 0 行改动徽标，零改动痕迹）
  const SRC_LINES = ['while True:', '  msg = await model()', '  trigger_hooks(...)', '  result = run_tool(msg)'];
  return (
    <AbsoluteFill>
      <SceneTag chapter="Worked Example" tagline="Stop 拦停 · 原型走查" accent={theme.mech} />
      {/* 循环源码面板（缩悬左上——SceneTag 之下；徽标全程在场不闪） */}
      <div style={{position: 'absolute', left: 90, top: 170, opacity: 0.85}}>
        <Panel style={{width: 400, padding: '12px 16px', position: 'relative'}}>
          <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginBottom: 6}}>{'loop source'}</div>
          {SRC_LINES.map((ln) => (
            <div key={ln} style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, lineHeight: 1.5, whiteSpace: 'pre'}}>
              {ln}
            </div>
          ))}
          {/* 「0 行改动」徽标（重音镜重读一拍——ok 绿承载「零改动」正向事实） */}
          <div
            style={{
              position: 'absolute',
              right: -18,
              top: -30,
              padding: '6px 14px',
              borderRadius: 8,
              border: `2.5px solid ${theme.ok}`,
              background: theme.bg,
              fontFamily: theme.mono,
              fontSize: 19,
              fontWeight: 700,
              color: theme.ok,
              transform: `scale(${1 + 0.1 * badgeRead})`,
              boxShadow: badgeRead > 0.01 ? `0 0 ${26 * badgeRead}px ${withAlpha(theme.ok, 0.7)}` : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {'0 行改动'}
          </div>
        </Panel>
      </div>
      {/* 左轨：消息流竖列（模型侧「我做完了」条 + 紫钩签 + 注入 user 条） */}
      <div style={{position: 'absolute', left: 240, top: 360}}>
        <div style={{transform: `scale(${1 + modelPop})`}}>
          <div
            style={{
              width: 320,
              height: 76,
              boxSizing: 'border-box',
              borderRadius: 10,
              border: `2.5px solid ${theme.panelBorder}`,
              background: theme.panel,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '0 16px',
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'model'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 600, color: theme.text}}>{'我做完了'}</span>
          </div>
        </div>
        {/* 紫钩签（「还没——理由在这儿」贴上该条——双声部对峙帧） */}
        <div style={{position: 'absolute', left: 380, top: -64, display: 'flex', alignItems: 'center', gap: 10, opacity: vetoO}}>
          <HookGlyph cx={0} cy={30} s={0.42} extend={1} />
          <span style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.mech, whiteSpace: 'nowrap'}}>{'还没——理由在这儿'}</span>
        </div>
        {/* 注入 user 条（回调蓝——塞回消息流） */}
        <div
          style={{
            width: 320,
            height: 64,
            marginTop: 30,
            borderRadius: 10,
            border: `2.5px solid ${theme.hook}`,
            background: withAlpha(theme.hook, 0.15),
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '0 16px',
            opacity: inject,
            transform: `translateY(${(1 - inject) * -26}px)`,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.hook}}>{'user'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 18, color: theme.text, whiteSpace: 'nowrap'}}>{'注入一条消息'}</span>
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 12}}>{'messages'}</div>
      </div>
      {/* 环体（多跑一轮核对——随流转过一圈） */}
      <div style={{position: 'absolute', left: 720 - 140, top: 620 - 140, opacity: 0.8}}>
        <LoopRing size={280} nodes={[]} showExit={false} dotProgress={lap % 1} />
      </div>
      <div style={{position: 'absolute', left: 660, top: 790, fontFamily: theme.sans, fontSize: 20, color: theme.dim, opacity: clamp01(lap)}}>
        {'核对轮'}
      </div>
      {/* 右轨：日志行滚动区（两行 Stop 日志——8 → 9） */}
      <div style={{position: 'absolute', left: 1120, top: 300}}>
        <LogTrace x={0} y={0} w={660} line1={clamp01(progress(frame, atLog1, DUR.f5))} line2={clamp01(progress(frame, atLog2, DUR.f5))} />
      </div>
      {/* 出口门（远位在画——第二次放行全开，确认绿） */}
      <div style={{position: 'absolute', left: 1520, top: 620, opacity: clamp01(progress(frame, atLog2, DUR.f4))}}>
        <svg width={130} height={170} viewBox="0 0 130 170" style={{overflow: 'visible'}}>
          <path d="M 8 162 L 8 48 Q 8 8, 65 8 Q 122 8, 122 48 L 122 162" fill="none" stroke={theme.ok} strokeWidth={6} />
        </svg>
        <div style={{position: 'absolute', left: 138, top: 34, fontFamily: theme.sans, fontSize: 18, fontWeight: 600, color: theme.ok, whiteSpace: 'nowrap'}}>
          {'放行'}
        </div>
      </div>
      {/* 「退出权」三字压门 + 问号打光定格（幕尾悬念——压在出口门位上） */}
      {worth > 0.01 ? (
        <div style={{position: 'absolute', left: 1500, top: 630, opacity: worth, transform: `translateY(${(1 - worth) * 30}px)`}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
            <span
              style={{
                fontFamily: theme.serif,
                fontSize: 56,
                fontWeight: 700,
                color: theme.text,
                letterSpacing: 6,
                textShadow: worthGlow > 0.01 ? `0 0 ${30 * worthGlow}px ${withAlpha(theme.mech, 0.6)}` : 'none',
              }}
            >
              {'退出权'}
            </span>
            <span
              style={{
                fontFamily: theme.serif,
                fontSize: 64,
                fontWeight: 700,
                color: theme.mech,
                opacity: 0.65 + 0.35 * worthGlow,
                textShadow: `0 0 ${22 * Math.max(0.2, worthGlow)}px ${withAlpha(theme.mech, 0.55)}`,
              }}
            >
              ?
            </span>
          </div>
        </div>
      ) : null}
      {/* 半拍收暗（盖场景不盖字幕） */}
      <AbsoluteFill style={{background: '#000', opacity: 0.7 * dimAll, pointerEvents: 'none'}} />
      <Foot2>{'[HOOK] Stop · tool results 8 → 9'}</Foot2>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P2StopIntercept: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p2-01', 'p2-02');
  const bB = w('p2-03', 'p2-05');
  const bC = w('p2-06', 'p2-09');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A">
        <ShotA
          atFocus={wa('p2-01', 0.06) - bA.from}
          atLamp={wa('p2-01', 0.38) - bA.from}
          atOpen={wa('p2-01', 0.78) - bA.from}
          atCatch={wa('p2-02', 0.55) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <ShotB
          atTrig={wa('p2-03', 0.5) - bB.from}
          atUp={wa('p2-04', 0.12) - bB.from}
          atLoop={wa('p2-04', 0.78) - bB.from}
          atDown={wa('p2-05', 0.25) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <ShotC
          atModel={wa('p2-06', 0.25) - bC.from}
          atVeto={wa('p2-06', 0.6) - bC.from}
          atLog1={wa('p2-07', 0.3) - bC.from}
          atInject={wa('p2-07', 0.6) - bC.from}
          atLap={wa('p2-07', 0.82) - bC.from}
          atLog2={wa('p2-08', 0.15) - bC.from}
          atBadge={wa('p2-08', 0.78) - bC.from}
          atWorth={wa('p2-09', 0.4) - bC.from}
          atDim={at('p2-09') + dur('p2-09') - Math.min(10, dur('p2-09') / 4) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2StopIntercept;
