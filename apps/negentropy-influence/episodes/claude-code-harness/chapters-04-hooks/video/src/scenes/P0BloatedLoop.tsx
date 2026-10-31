/** P0 改不完的循环（p0-01..p0-06，4 镜）——分镜 0-A / 0-B / 0-C / 0-D（storyboard v1）。
 *
 *  叙事链：冷启动直入（开篇视听合力 I-039）——环体〔M-001〕特写居中偏上、
 *  环内已被杂色检查块占位、转动滞涩〔M-005〕：「每加一道」「烂一分」两词各
 *  落位一枚杂色块填进环体、转速可感地慢一档 → 「闸门越挂越多」环上一道既有
 *  闸卡剪影加重一闪（承 ep3 视觉签名——裁决紫 #7C6FF0，只确认在场不展开）、
 *  「排着队」候场区亮出两枚待挂块小影（任务签不显字）→ 0-B 堆叠加速特写：
 *  四块（日志/检查/提醒/自动提交——灰调白话短标签，次序=口播）stagger 压进
 *  环体、旧功能块压裂（警示红裂纹）、环体轮廓微幅撑变 ≤5%（M-001 辨识优先）、
 *  0-A 候场两枚小影完成入环 → 0-C 病灶透视：扫过杂色块一拍（逐行排除）→
 *  「想扩展的：行为」（回调蓝）与「改到的：核心流程」（警示红）上下对立、
 *  逆向箭头折向下标签、大叉压死（病灶定因帧定格半拍）→ 0-D 标题字卡：
 *  「把扩展挡在循环外面」（挂点紫描边——答案预告色）、卡下缘四枚小槽位
 *  轮廓微亮（P1 四事件预告，不显字）。
 *
 *  空间契约：环体描边色/线宽与系列锚定逐像素一致（转速与撑变不改 M-001
 *  身份）；杂色块全部灰调（非契约主色）；闸卡剪影只确认在场不展开裁决细节
 *  （属前一讲）；署源角标右下常驻不抢焦；0-C 上蓝下红恒定、大叉为唯一落定
 *  元素；0-D 字卡为唯一前景主体、槽位只亮轮廓不显字、背景环体在本镜不再
 *  恶化（病灶变化止于 0-B）。
 *
 *  红线落实：词落位 = 句首 + 句长比例 wa(id,f)；裂纹块是压伤不是脱落（P1 的
 *  拆出才是正规操作）；箭头恒逆向（依赖方向反转是语义）；y≥56 / bottom≥168。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CheckChip, GateCard, LoopRing, Panel, ringPt} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, useProgress} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（首部署源位，RSI I-080）：右下常驻，一次淡入后恒定不抢焦；
 *  bottom 168 避开字幕条（承 ep1–ep3 SourceCredit 形态） */
const SourceCredit: React.FC = () => {
  const o = useProgress(0, DUR.f5);
  return (
    <div
      style={{
        position: 'absolute',
        right: 72,
        bottom: 168,
        fontFamily: theme.mono,
        fontSize: 22,
        letterSpacing: 1,
        color: theme.dim,
        opacity: 0.85 * o,
      }}
    >
      Learn Claude Code
    </div>
  );
};

/** 贴底角标行（bottom 168——字幕带上沿之上） */
const FootTag: React.FC<{children: React.ReactNode}> = ({children}) => (
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

/** 环体几何（0-A/0-B 特写位；0-C/0-D 退居暗层） */
const RING0 = {cx: 960, cy: 460, size: 560} as const;
const R0 = RING0.size / 2 - 46;

/** 环体巡游——分段匀速的滞涩帧数学（每入一块降一档转速；纯函数、无随机）。
 *  stages = [起始帧, 每帧角速]，v 单位 = 圈/帧。 */
const sluggishDot = (frame: number, stages: readonly {at: number; v: number}[]): number => {
  let a = 0;
  for (let i = 0; i < stages.length; i += 1) {
    const s = stages[i];
    const next = stages[i + 1];
    const end = next ? Math.min(frame, next.at) : frame;
    if (end > s.at) {
      a += (end - s.at) * s.v;
    }
  }
  return a % 1;
};

/** 环内杂色块布点（0-B 终态全集；0-A 只显前四枚） */
const MESS_BLOCKS = [
  {label: 'log', x: -180, y: -130, w: 110, from: 0},
  {label: 'check', x: -20, y: -150, w: 120, from: 0},
  {label: 'guard', x: 140, y: -120, w: 116, from: 0},
  {label: 'track', x: 95, y: -40, w: 108, from: 0},
  {label: '', x: 70, y: 115, w: 84, from: 0},
  {label: '', x: 200, y: 95, w: 84, from: 0},
] as const;

/** 0-B 四块白话短标签（次序=口播：日志、检查、提醒、自动提交） */
const FOUR_BLOCKS = [
  {zh: '日志', en: 'log', x: -200, y: 35},
  {zh: '检查', en: 'check', x: -55, y: 30},
  {zh: '提醒', en: 'notify', x: 85, y: 45},
  {zh: '自动提交', en: 'commit', x: -130, y: 105},
] as const;

// ── 0-A 冷启动：杂色块填进 + 闸卡剪影 + 候场小影 ────────────────────────

const ZeroA: React.FC<{atAdd1: number; atAdd2: number; atGate: number; atFlash: number; atQueue: number}> = ({
  atAdd1,
  atAdd2,
  atGate,
  atFlash,
  atQueue,
}) => {
  const frame = useCurrentFrame();
  // 两枚新杂色块填进（「每加一道」「烂一分」各一枚——自右上候场位滑入环内）
  const in1 = useProgress(atAdd1, DUR.f5, 'decelerate');
  const in2 = useProgress(atAdd2, DUR.f5, 'decelerate');
  // 转速降档：入块前 0.0042 圈/帧（≈7.9s/圈）→ 每入一块 -22%
  const dot = sluggishDot(frame, [
    {at: 0, v: 0.0042},
    {at: atAdd1 + DUR.f5, v: 0.0033},
    {at: atAdd2 + DUR.f5, v: 0.0026},
  ]);
  // 既有闸卡剪影加重一闪（承 ep3 签名——ghost 暗态 + 一拍提亮）
  const gateBase = useProgress(atGate, DUR.f4);
  const gateFlash = useImpulse({at: atFlash, dur: DUR.f5, peak: 1});
  // 候场区两枚待挂块小影（任务签不显字——无字灰块）
  const queueO = useProgress(atQueue, DUR.f4);
  const queuePulse = 0.6 + 0.4 * Math.sin(frame / 9);
  const gatePt = ringPt(RING0.cx, RING0.cy, R0, 25);
  return (
    <AbsoluteFill>
      {/* 环体特写（M-001：恒 core 描边 + RING_STROKE；杂色占位、巡游滞涩） */}
      <div style={{position: 'absolute', left: RING0.cx - RING0.size / 2, top: RING0.cy - RING0.size / 2}}>
        <LoopRing size={RING0.size} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {/* 环内既有杂色块（log/check/guard/track——灰调字样块） */}
      {MESS_BLOCKS.slice(0, 4).map((b) => (
        <CheckChip key={b.label} x={RING0.cx + b.x} y={RING0.cy + b.y} w={b.w} label={b.label} lit={1} />
      ))}
      {/* 「每加一道」新块：自右上候场位滑入环内 */}
      <div
        style={{
          position: 'absolute',
          left: 1560 + (RING0.cx - 60 - 1560) * in1,
          top: 200 + (RING0.cy + 20 - 200) * in1,
          opacity: in1,
        }}
      >
        <CheckChip x={0} y={0} w={116} label={'verify'} lit={1} />
      </div>
      {/* 「烂一分」再入一枚（转速再降一档） */}
      <div
        style={{
          position: 'absolute',
          left: 1620 + (RING0.cx + 30 - 1620) * in2,
          top: 260 + (RING0.cy - 55 - 260) * in2,
          opacity: in2,
        }}
      >
        <CheckChip x={0} y={0} w={104} label={'sync'} lit={1} />
      </div>
      {/* 既有闸卡剪影（ep3 裁决紫同形签名——ghost 暗态在场，加重一闪不展开） */}
      <div style={{position: 'absolute', left: gatePt.x - 62, top: gatePt.y - 58, opacity: 0.5 + 0.5 * gateBase}}>
        <GateCard x={0} y={0} w={124} h={116} kind="deny" lit={0.18 + 0.4 * gateFlash} ghost={0.72} />
      </div>
      {/* 候场区（右上——两枚待挂块小影，任务签不显字） */}
      <div style={{position: 'absolute', left: 1620, top: 640, opacity: queueO}}>
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginBottom: 10}}>{'queue'}</div>
        <div style={{display: 'flex', gap: 14}}>
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                width: 92,
                height: 42,
                borderRadius: 8,
                border: `2px solid ${withAlpha(theme.dim, 0.55)}`,
                background: withAlpha(theme.panel, 0.7),
                opacity: queuePulse,
              }}
            />
          ))}
        </div>
      </div>
      <FootTag>{'log / check … · 写死在循环里'}</FootTag>
    </AbsoluteFill>
  );
};

// ── 0-B 堆叠加速：四块压进 + 旧块压裂 + 环体撑变 ────────────────────────

const ZeroB: React.FC<{atPress: number; atLabels: number; atCrack: number; atQueued: number}> = ({
  atPress,
  atLabels,
  atCrack,
  atQueued,
}) => {
  const frame = useCurrentFrame();
  // 四块 stagger 压入（次序=口播；自环缘向内压——「一条条往里堆」）
  const press = [0, 1, 2, 3].map((i) => clamp01(progress(frame, atPress + i * 7, DUR.f5)));
  // 「动一次循环本体」：环体整体震一拍 + 微幅撑变 ≤5%（轮廓辨识优先）
  const fillFrac = (1 + press.filter((p) => p > 0.5).length + 1) / 8;
  const quake = useImpulse({at: atPress - DUR.f3, dur: DUR.f3, peak: 0.012});
  const swell = 1 + 0.035 * clamp01(fillFrac) + quake;
  // 转速再降（四块全入后最滞涩）
  const dot = sluggishDot(frame, [
    {at: 0, v: 0.0026},
    {at: atPress + 3 * 7 + DUR.f5, v: 0.0018},
  ]);
  // 标签逐块点亮（次序=口播）
  const labelLit = [0, 1, 2, 3].map((i) => clamp01(progress(frame, atLabels + i * 6, DUR.f4)));
  // 旧功能块裂纹（「认不出来了」——压伤不是脱落；警示红扩大一闪）
  const crack = useProgress(atCrack, DUR.f4);
  const crackFlash = useImpulse({at: atCrack, dur: DUR.f6, peak: 1});
  // 0-A 候场两枚小影完成入环（排着队的兑现）
  const queuedIn = useProgress(atQueued, DUR.f5, 'decelerate');
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `scale(${swell})`,
          transformOrigin: `${RING0.cx}px ${RING0.cy}px`,
        }}
      >
        {/* 环体（承 0-A 末态——杂色更满、巡游最滞涩） */}
        <div style={{position: 'absolute', left: RING0.cx - RING0.size / 2, top: RING0.cy - RING0.size / 2}}>
          <LoopRing size={RING0.size} nodes={[]} showExit={false} dotProgress={dot} />
        </div>
        {/* 既有杂色块（0-A 末态全集——四字样块 + 两枚新增） */}
        {MESS_BLOCKS.map((b) => (
          <CheckChip key={b.label} x={RING0.cx + b.x} y={RING0.cy + b.y} w={b.w} label={b.label} lit={1} />
        ))}
        <CheckChip key="verify" x={RING0.cx - 60} y={RING0.cy + 20} w={116} label={'verify'} lit={1} />
        <CheckChip key="sync" x={RING0.cx + 30} y={RING0.cy - 55} w={104} label={'sync'} lit={1} />
        {/* 旧功能块（环心偏左——挤压下开裂：压伤不是脱落） */}
        <div style={{position: 'absolute', left: RING0.cx - 105, top: RING0.cy - 10}}>
          <div
            style={{
              width: 150,
              height: 58,
              boxSizing: 'border-box',
              borderRadius: 9,
              border: `2.5px solid ${withAlpha(theme.dim, 0.8)}`,
              background: theme.panel,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'core step'}</span>
            {/* 警示红裂纹（扩大一闪——重音镜 1–2s punch） */}
            {crack > 0.01 ? (
              <svg width={160} height={70} viewBox="0 0 160 70" style={{position: 'absolute', inset: 0, overflow: 'visible', opacity: 0.35 + 0.65 * crack}}>
                <path
                  d="M 82 2 L 70 24 L 84 34 L 66 68"
                  fill="none"
                  stroke={theme.danger}
                  strokeWidth={2 + 2.5 * crack}
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - crack}
                />
                <path
                  d="M 70 24 L 44 18"
                  fill="none"
                  stroke={theme.danger}
                  strokeWidth={1.5 + 2 * crack}
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - clamp01(crack * 1.4 - 0.4)}
                />
              </svg>
            ) : null}
            {crackFlash > 0.01 ? (
              <div
                style={{
                  position: 'absolute',
                  inset: -6,
                  borderRadius: 12,
                  border: `3px solid ${theme.danger}`,
                  boxShadow: `0 0 ${26 * crackFlash}px ${withAlpha(theme.danger, 0.7)}`,
                  opacity: crackFlash,
                  pointerEvents: 'none',
                }}
              />
            ) : null}
          </div>
        </div>
        {/* 四块白话短标签 stagger 压入（自环缘向内；次序=口播） */}
        {FOUR_BLOCKS.map((b, i) => {
          const p = press[i];
          const lit = labelLit[i];
          const fromX = b.x * 1.9;
          const fromY = b.y * 1.9 - 40;
          return (
            <div
              key={b.en}
              style={{
                position: 'absolute',
                left: RING0.cx + fromX + (b.x - fromX) * p,
                top: RING0.cy + fromY + (b.y - fromY) * p,
                opacity: p,
                transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (1 - p) * 8}deg)`,
              }}
            >
              <div
                style={{
                  width: b.zh.length > 2 ? 168 : 120,
                  height: 52,
                  boxSizing: 'border-box',
                  borderRadius: 9,
                  border: `2.5px solid ${withAlpha(theme.dim, 0.8)}`,
                  background: theme.panel,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 600, color: lit > 0.5 ? theme.text : theme.dim}}>{b.zh}</span>
                <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, opacity: lit}}>{b.en}</span>
              </div>
            </div>
          );
        })}
        {/* 0-A 候场两枚完成入环（自右上候场位滑进环内上沿） */}
        {[0, 1].map((i) => (
          <div
            key={`q${i}`}
            style={{
              position: 'absolute',
              left: 1620 + i * 120 + (RING0.cx + 70 + i * 130 - (1620 + i * 120)) * queuedIn,
              top: 640 + (RING0.cy + 115 + i * -20 - 640) * queuedIn,
              opacity: queuedIn,
            }}
          >
            <div
              style={{
                width: 92,
                height: 42,
                borderRadius: 8,
                border: `2px solid ${withAlpha(theme.dim, 0.55)}`,
                background: withAlpha(theme.panel, 0.7),
              }}
            />
          </div>
        ))}
      </div>
      <FootTag>{'循环本体 · 每加一项动一次'}</FootTag>
    </AbsoluteFill>
  );
};

// ── 0-C 病灶透视：逆向箭头 + 大叉（病灶定因帧） ─────────────────────────

const ZeroC: React.FC<{atScan: number; atPair: number; atTop: number; atBottom: number; atArrow: number}> = ({
  atScan,
  atPair,
  atTop,
  atBottom,
  atArrow,
}) => {
  // 「某一行代码」：先扫过环内杂色块一拍（逐行排除——都不在嫌疑现场）
  const scan = useProgress(atScan, DUR.f5, 'linear');
  // 两标签对立亮出（「依赖方向」）；各点火（「想扩展的」「改的却是」）
  const pair = useProgress(atPair, DUR.f4);
  const topLit = useProgress(atTop, DUR.f3);
  const botLit = useProgress(atBottom, DUR.f3);
  // 「核心流程」：逆向箭头折向下标签（draw）→ 大叉压死（draw）→ 定格半拍
  const arrow = useProgress(atArrow, DUR.f4, 'decelerate');
  const cross = useProgress(atArrow + DUR.f4, DUR.f3, 'accelerate');
  const crossGlow = useImpulse({at: atArrow + DUR.f4 + DUR.f3, dur: DUR.f5, peak: 1});
  return (
    <AbsoluteFill>
      {/* 杂色环体退居暗层（0-B 末态剪影——病灶定格在场不抢焦；块随容器同缩放） */}
      <div style={{position: 'absolute', left: 330, top: 130, opacity: 0.16, transform: 'scale(0.62)', transformOrigin: 'left top'}}>
        <LoopRing size={RING0.size} nodes={[]} showExit={false} />
        {MESS_BLOCKS.map((b) => (
          <CheckChip key={b.label} x={RING0.size / 2 + b.x} y={RING0.size / 2 + b.y} w={b.w} label={b.label} lit={1} />
        ))}
      </div>
      {/* 逐行排除扫描线（扫过杂色块一拍——横线 + 拖尾） */}
      {scan > 0.02 && scan < 0.98 ? (
        <div
          style={{
            position: 'absolute',
            left: 320,
            top: 150 + 380 * scan,
            width: 380,
            height: 3,
            background: theme.text,
            opacity: 0.8,
            boxShadow: `-16px 0 18px -6px ${withAlpha(theme.text, 0.4)}`,
          }}
        />
      ) : null}
      {/* 病灶两标签（上=想扩展的：行为〔回调蓝〕；下=改到的：核心流程〔警示红〕） */}
      <div style={{position: 'absolute', left: 760, top: 300, opacity: pair}}>
        <div
          style={{
            width: 460,
            height: 118,
            boxSizing: 'border-box',
            borderRadius: 14,
            border: `3px solid ${theme.hook}`,
            background: withAlpha(theme.hook, 0.08 + 0.1 * topLit),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            opacity: 0.45 + 0.55 * topLit,
          }}
        >
          <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'想扩展的'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 700, color: theme.text}}>{'行为'}</span>
          </div>
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'behavior'}</span>
        </div>
      </div>
      <div style={{position: 'absolute', left: 760, top: 620, opacity: pair}}>
        <div
          style={{
            width: 460,
            height: 118,
            boxSizing: 'border-box',
            borderRadius: 14,
            border: `3px solid ${theme.danger}`,
            background: withAlpha(theme.danger, 0.08 + 0.1 * botLit),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            opacity: 0.45 + 0.55 * botLit,
          }}
        >
          <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'改到的'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 700, color: theme.text}}>{'核心流程'}</span>
          </div>
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'core loop'}</span>
        </div>
      </div>
      {/* 逆向箭头（上标签 → 下标签：依赖方向反转是语义——恒逆向） */}
      <svg width={120} height={280} viewBox="0 0 120 280" style={{position: 'absolute', left: 1180, top: 370, overflow: 'visible', opacity: pair}}>
        <path
          d="M 60 14 L 60 234"
          fill="none"
          stroke={theme.danger}
          strokeWidth={6}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - clamp01(arrow)}
        />
        {arrow > 0.9 ? <path d="M 40 232 L 60 264 L 80 232 Z" fill={theme.danger} /> : null}
      </svg>
      {/* 大叉（压死逆向箭头——唯一落定元素；真被拦语义的封禁符号） */}
      {cross > 0.01 ? (
        <svg width={220} height={220} viewBox="0 0 220 220" style={{position: 'absolute', left: 1090, top: 400, overflow: 'visible'}}>
          <line x1={30} y1={30} x2={190} y2={190} stroke={theme.danger} strokeWidth={13} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01(cross)} />
          <line x1={190} y1={30} x2={30} y2={190} stroke={theme.danger} strokeWidth={13} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01(cross * 1.2 - 0.2)} />
          {crossGlow > 0.01 ? (
            <circle cx={110} cy={110} r={104} fill="none" stroke={theme.danger} strokeWidth={4} opacity={0.7 * crossGlow} />
          ) : null}
        </svg>
      ) : null}
      <FootTag>{'依赖方向 · 逆向'}</FootTag>
    </AbsoluteFill>
  );
};

// ── 0-D 标题字卡：答案预告（四槽位轮廓预告 P1） ─────────────────────────

const ZeroD: React.FC<{atCard: number; atEcho: number; atSlots: number}> = ({atCard, atEcho, atSlots}) => {
  // 字卡自暗处浮起（0.15→1）——「今天的钩子」
  const card = useProgress(atCard, DUR.f6);
  // 「挡在循环外面」：卡面重读排版压一拍（mech 辉光脉冲 + 微放大）
  const echo = useImpulse({at: atEcho, dur: DUR.f6, peak: 0.045});
  const glow = useProgress(atEcho, DUR.f5);
  // 四枚小槽位轮廓同时微亮一次（P1 四事件预告，不显字）
  const slotsBase = useProgress(atCard + DUR.f4, DUR.f4);
  const slotPulse = useImpulse({at: atSlots, dur: DUR.f5, peak: 1});
  return (
    <AbsoluteFill>
      {/* 杂色环体退居暗层背景（病灶定格在场不抢焦；本镜不再恶化） */}
      <div style={{position: 'absolute', left: 1210, top: 200, opacity: 0.13, transform: 'scale(0.5)', transformOrigin: 'left top'}}>
        <LoopRing size={RING0.size} nodes={[]} showExit={false} />
        {MESS_BLOCKS.slice(0, 4).map((b) => (
          <CheckChip key={b.label} x={RING0.size / 2 + b.x} y={RING0.size / 2 + b.y} w={b.w} label={b.label} lit={1} />
        ))}
      </div>
      {/* 标题字卡（唯一前景主体，衬线体、挂点紫描边——答案预告色） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 380,
          display: 'flex',
          justifyContent: 'center',
          opacity: 0.15 + 0.85 * card,
          transform: `translateY(${(1 - card) * 26}px) scale(${1 + echo})`,
        }}
      >
        <Panel accent={theme.mech} style={{padding: '46px 84px', boxShadow: glow > 0.01 ? `0 0 ${34 * glow}px ${withAlpha(theme.mech, 0.45)}` : 'none'}}>
          {/* caption-dup-ok: 标题卡刻意复述（答案预告仪式——本集题面即机制结论，
              承 ep3 0-C 立场空卡→5-A 落字同款生命周期先例，storyboard 前言登记） */}
          <span style={{fontFamily: theme.serif, fontSize: 62, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{'把扩展挡在循环外面'}</span>
        </Panel>
      </div>
      {/* 卡下缘四枚小槽位轮廓（P1 四事件预告——不显字，微亮一次） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 640, display: 'flex', justifyContent: 'center', gap: 26}}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 108,
              height: 44,
              borderRadius: 9,
              border: `2px dashed ${withAlpha(theme.mech, 0.4 + 0.45 * slotPulse)}`,
              opacity: slotsBase * (0.55 + 0.45 * slotPulse),
            }}
          />
        ))}
      </div>
      {/* 「今天的钩子」预告角标（英文机制名进角标） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 730,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 18,
          color: theme.dim,
          opacity: card * 0.8,
        }}
      >
        {'hooks · 注册表预告'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0BloatedLoop: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  // 词落位锚 = 句首 + 句长比例（口播无词级时间戳，比例即词窗；TTS 变更自动重定时）
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p0-01', 'p0-02');
  const bB = w('p0-03', 'p0-04');
  const bC = w('p0-05');
  const bD = w('p0-06');

  return (
    <AbsoluteFill>
      <SourceCredit />
      <Sequence {...bA} name="0-A">
        <ZeroA
          atAdd1={wa('p0-01', 0.25) - bA.from}
          atAdd2={wa('p0-01', 0.62) - bA.from}
          atGate={wa('p0-02', 0.1) - bA.from}
          atFlash={wa('p0-02', 0.22) - bA.from}
          atQueue={wa('p0-02', 0.45) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atPress={wa('p0-04', 0.06) - bB.from}
          atLabels={wa('p0-04', 0.16) - bB.from}
          atCrack={wa('p0-04', 0.8) - bB.from}
          atQueued={wa('p0-04', 0.58) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="0-C">
        <ZeroC
          atScan={wa('p0-05', 0.12) - bC.from}
          atPair={wa('p0-05', 0.4) - bC.from}
          atTop={wa('p0-05', 0.52) - bC.from}
          atBottom={wa('p0-05', 0.7) - bC.from}
          atArrow={wa('p0-05', 0.82) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="0-D">
        <ZeroD atCard={wa('p0-06', 0.12) - bD.from} atEcho={wa('p0-06', 0.58) - bD.from} atSlots={wa('p0-06', 0.75) - bD.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0BloatedLoop;
