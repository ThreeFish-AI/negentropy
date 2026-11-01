/** P1 红线与大件落盘（p1-01..p1-09，4 镜）——分镜 1-A / 1-B / 1-C / 1-D。
 *
 *  叙事链：1-A 开帧蓝面消息列全景一拍（环体缩悬列侧上角、阶梯缩影右上在位）
 *  → @pushIn 急推消息列特写：一条「调用」块永远牵着一条「结果」块、配对小锁
 *  咔哒锁上；红线自 0-C 屏底位迁入列下缘驻位（Morph Continuity：色值/线宽/
 *  水平姿态逐帧不变，仅位置变化）；p1-02 剪刀试图切进两块之间被红线弹开一拍、
 *  合法切口落在配对之外的空隙绿闪一次（躲开的正解）→ 1-B 边界实验一拍（单句
 *  实测帧）：左右双帧——左「拆掉切口保护」剪刀落切、结果块孤立闪珊瑚红无人
 *  认领、0-A 同款拒收红章缩小版砸下；右「红线在位」切口绕开配对、成对保全
 *  （确认绿框）→ 1-C 第一步装置：末条消息聚拢一批结果块、紫面首亮（磁盘面板
 *  自右缘滑入——蓝左紫右双平面自此定形）、批预算水位条沿列侧立起逼近二十万、
 *  最大的块抽离成磁盘文件卡（蓝→紫双色箭头首演）、原位留「路径＋预览」小条、
 *  阶梯缩影第一格点亮 → 1-D 走查数字特写：五块按大小排队（80k/60k/30k/20k/
 *  10k 面积可比）、计数滚至 200,000 贴线 → 再落 5k 小块红线破位（205,000）、
 *  八万块沿箭头落盘留两千预览、水位回落定格 ≈127,000（1–2s 重音——
 *  205,000−80,000+2,000 闭合）、停手静持；p1-09 紫面磁盘卡轻闪（已存原文是
 *  后面步骤的保险——钩子）。
 *
 *  空间契约：调用-结果成对同锁、红线连续无断点、合法切口不落配对之间；左红
 *  右绿恒定、左帧红章与 0-A 同款同形（缩小版）、右帧配对完整；蓝左紫右方位
 *  自 1-C 定立、落盘件必带路径签、水位刻度以二十万为准；五块面积比与标注
 *  数字一致、计数终值 ≈127,000 与口播一致、落盘次序=从大到小、五千小块不计
 *  入排队五块。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；tool_use · tool_result ·
 *  tool_result_budget · LARGE_RESULT_CHAR_LIMIT 只进角标；计数读数
 *  Math.round(有界值) 直取、禁过冲、中间值保持 ≥15 帧。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  DiskCard,
  LoopRing,
  MessageColumn,
  PathStub,
  RedStamp,
  Redline,
  StepLadder,
  ThresholdWaterline,
  TransferArrow,
} from '../components/motifs';
import {LADDER_MINI} from './P0FillingPaper';
import {DUR, clamp01, progress, useImpulse, useProgress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 双平面全局位（1-C 定形、全片恒定方位：蓝左紫右） */
export const STAGE = {
  blue: {x: 150, y: 240, w: 700, h: 580},
  purple: {x: 1120, y: 240, w: 640, h: 580},
} as const;

/** 蓝面消息列行型（1-A 配对特写 / 1-C 末条聚拢共用行型） */
const ROWS = ['msg', 'call', 'result', 'msg', 'call', 'result'] as const;

/** 剪刀图标（SVG——两刃+双环柄；落切/被弹开由调用方给位移与角度） */
const Scissors: React.FC<{x: number; y: number; rot?: number; scale?: number; lit?: number}> = ({x, y, rot = 0, scale = 1, lit = 1}) => (
  <svg width={86} height={72} viewBox="0 0 86 72" style={{position: 'absolute', left: x, top: y, overflow: 'visible', opacity: clamp01(lit), transform: `rotate(${rot}deg) scale(${scale})`}}>
    <circle cx={14} cy={16} r={10} fill="none" stroke={theme.text} strokeWidth={5} />
    <circle cx={14} cy={56} r={10} fill="none" stroke={theme.text} strokeWidth={5} />
    <line x1={22} y1={22} x2={78} y2={62} stroke={theme.text} strokeWidth={5} strokeLinecap="round" />
    <line x1={22} y1={50} x2={78} y2={10} stroke={theme.text} strokeWidth={5} strokeLinecap="round" />
  </svg>
);

// ── 1-A 配对锁与红线：全景一拍 → 急推特写 → 剪刀弹开 → 合法切口 ──────────

const OneA: React.FC<{atLock: number; atSnip: number; atBounce: number; atGood: number}> = ({atLock, atSnip, atBounce, atGood}) => {
  const frame = useCurrentFrame();
  // @pushIn（动机：p1-01 红线规矩压向配对锁主角）——开帧全景一拍后急推
  const push = usePushIn(atLock - 24, {scale: 0.07, dur: DUR.f6});
  // 「硬规矩」红线自 0-C 屏底位（y≈946 全局系）迁入列下缘驻位（Morph：色值/
  // 线宽/水平姿态不变，仅位置——局部坐标内 y 自 +120 到 0）
  const redMove = useProgress(atLock, DUR.f5, 'decelerate');
  // 「一次工具调用，必须跟着它的结果」配对锁咔哒锁上
  const lock = useProgress(atLock + 6, DUR.f4);
  const lockFlash = useImpulse({at: atLock + 6, dur: DUR.f5, peak: 1});
  // 「拆散任何一边」剪刀试图切进两块之间（自右上落下切向接缝）
  const snip = clamp01(progress(frame, atSnip, DUR.f5));
  // 「被红线弹开」一拍（下弹回落——弹开方向远离配对）
  const bounce = clamp01(progress(frame, atBounce, DUR.f5));
  const bounceT = Math.sin(Math.PI * bounce);
  // 「切口躲着调用和它的结果」合法切口落在配对之外的空隙（绿闪一次——躲开的正解）
  const good = useProgress(atGood, DUR.f4);
  const goodFlash = useImpulse({at: atGood, dur: DUR.f6, peak: 1});
  // 列特写位（急推后主景——列底+红线驻位整体收在字幕安全带 y<920 之上）
  const COL = {x: 480, y: 176, w: 960, rowH: 104};
  const dot = ((frame / 80) % 1 + 1) % 1;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '40% 46%'}}>
        {/* 环体缩悬列侧上角（M-001——全景锚遗留位） */}
        <div style={{position: 'absolute', left: 190, top: 84, opacity: 0.85}}>
          <LoopRing size={120} nodes={[]} showExit={false} dotProgress={dot} />
        </div>
        {/* 阶梯缩影（右上恒驻——第一格未亮） */}
        <StepLadder x={LADDER_MINI.x} y={LADDER_MINI.y} mode="mini" litMask={0} />
        {/* 消息列特写（调用牵着结果、配对锁在接缝） */}
        <div style={{position: 'absolute', left: COL.x, top: COL.y}}>
          <MessageColumn x={0} y={0} w={COL.w} rowH={COL.rowH} rows={ROWS} rowsLit={6} pairLock={lock} lockFlash={lockFlash} />
          {/* 剪刀（切向第 2/3 行接缝——被红线弹开回落） */}
          <Scissors x={COL.w / 2 - 40 + 60 * (1 - snip)} y={-70 + 190 * snip + 90 * bounceT} rot={-18 + 26 * snip - 30 * bounceT} lit={snip > 0.02 ? 1 : 0} />
          {/* 合法切口（配对之外的空隙——第 3/4 行之间；绿闪一次） */}
          {good > 0.02 ? (
            <div
              style={{
                position: 'absolute',
                left: 60,
                top: COL.rowH * 3 + 24 - 3,
                width: COL.w - 120,
                height: 6,
                borderRadius: 3,
                background: theme.ok,
                boxShadow: `0 0 ${20 * goodFlash}px ${withAlpha(theme.ok, 0.7)}`,
                opacity: good,
              }}
            />
          ) : null}
          {goodFlash > 0.04 ? (
            <div style={{position: 'absolute', left: COL.w - 240, top: COL.rowH * 3 - 16, fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.ok, whiteSpace: 'nowrap', opacity: goodFlash}}>
              {'切口 · 躲开配对'}
            </div>
          ) : null}
        </div>
        {/* 红线（0-C 屏底位 → 列下缘驻位——迁移中色值/线宽/水平姿态不变；
            驻位 y=856 收在字幕安全带之上） */}
        <Redline x={COL.x - 40} y={COL.y + COL.rowH * 6 + 8 * 6 + 4 + 120 * (1 - redMove)} w={COL.w + 80} lit={1} />
        <div style={{position: 'absolute', left: COL.x - 36, top: COL.y + COL.rowH * 6 + 8 * 6 + 18, fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap', opacity: redMove}}>
          {'红线 · 调用必须跟着结果'}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'tool_use ↔ tool_result · 拆散即非法'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-B 边界实验一拍（单句实测帧）：左红右绿双帧并置 ─────────────────────

const OneB: React.FC<{atCut: number; atOrphan: number; atStamp: number}> = ({atCut, atOrphan, atStamp}) => {
  const frame = useCurrentFrame();
  // 左帧：「拆掉切口保护」剪刀落切（守卫摘除）
  const cut = clamp01(progress(frame, atCut, DUR.f5));
  // 「没人认领」孤立结果块警示红闪（脱离调用、无人认领）
  const orphan = useProgress(atOrphan, DUR.f4);
  const orphanFlash = useImpulse({at: atOrphan, dur: DUR.f6, peak: 1});
  // 「当场拒收」0-A 同款红章回扣砸下（缩小版）+ 右帧绿框确认一闪
  const stamp = useProgress(atStamp, DUR.f4, 'accelerate');
  const stampFlash = useImpulse({at: atStamp + DUR.f3, dur: DUR.f6, peak: 1});
  const confirm = useProgress(atStamp + 3, DUR.f5);
  // 双帧几何（左拆保护 / 右红线在位——左红右绿恒定）
  const FR = {y: 190, w: 800, h: 560} as const;
  const Frame: React.FC<{x: number; accent: string; title: string; tag: string}> = ({x, accent, title, tag}) => (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: FR.y,
        width: FR.w,
        height: FR.h,
        boxSizing: 'border-box',
        borderRadius: 16,
        border: `3.5px solid ${accent}`,
        background: withAlpha(theme.panel, 0.93),
        padding: '16px 22px',
      }}
    >
      <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
        <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: accent}}>{title}</span>
        <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, border: `2px solid ${theme.panelBorder}`, borderRadius: 6, padding: '1px 8px'}}>{tag}</span>
      </div>
    </div>
  );
  return (
    <AbsoluteFill>
      {/* 左帧：拆掉切口保护（红） */}
      <Frame x={120} accent={theme.danger} title={'拆掉切口保护'} tag={'unguarded'} />
      {/* 左帧内：调用块（上）与结果块（下）——剪刀切断后结果块孤立偏移 */}
      <div style={{position: 'absolute', left: 220, top: 330, width: 560}}>
        <div style={{height: 92, borderRadius: 9, border: `2.5px solid ${withAlpha(theme.mech, 0.8)}`, background: withAlpha(theme.mech, 0.12), display: 'flex', alignItems: 'center', paddingLeft: 16, fontFamily: theme.sans, fontSize: 18, fontWeight: 600, color: theme.text}}>
          {'调用 tool_use'}
        </div>
        {/* 断口（剪刀切开的缝——两半错位） */}
        <div style={{height: 26 * cut, position: 'relative'}}>
          <div style={{position: 'absolute', left: 60, top: 13 * cut, width: 440, height: 4, background: withAlpha(theme.danger, 0.9 * cut), transform: 'rotate(-2deg)'}} />
        </div>
        <div
          style={{
            height: 92,
            borderRadius: 9,
            border: `2.5px solid ${withAlpha('#EF6461', 0.9)}`,
            background: withAlpha('#EF6461', 0.1 + 0.14 * clamp01(orphanFlash)),
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 16,
            gap: 14,
            transform: `translateX(${34 * orphan}px) rotate(${1.6 * orphan}deg)`,
            opacity: 0.75 + 0.25 * orphan,
            boxShadow: orphanFlash > 0.05 ? `0 0 ${26 * clamp01(orphanFlash)}px ${withAlpha(theme.danger, 0.55)}` : 'none',
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 18, fontWeight: 600, color: theme.text}}>{'结果 tool_result'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 14, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap', opacity: orphan}}>{'孤立 · 没人认领'}</span>
        </div>
        <Scissors x={80} y={-6 + 108 * cut} rot={-24 + 40 * cut} lit={cut > 0.02 && cut < 0.92 ? 1 : 0} />
      </div>
      {/* 左帧红章（0-A 同款缩小版——回扣砸下） */}
      <RedStamp x={520} y={640} p={stamp} flash={stampFlash} scale={0.55} rot={-10} />
      {/* 右帧：红线在位（绿——配对保全） */}
      <Frame x={990} accent={theme.ok} title={'红线在位'} tag={'guarded'} />
      <div style={{position: 'absolute', left: 1090, top: 330, width: 560}}>
        <div style={{height: 92, borderRadius: 9, border: `2.5px solid ${withAlpha(theme.mech, 0.8)}`, background: withAlpha(theme.mech, 0.12), display: 'flex', alignItems: 'center', paddingLeft: 16, fontFamily: theme.sans, fontSize: 18, fontWeight: 600, color: theme.text}}>
          {'调用 tool_use'}
        </div>
        {/* 配对锁（在位——锁扣完整） */}
        <div style={{height: 30, position: 'relative'}}>
          <div style={{position: 'absolute', left: 240, top: 2, width: 44, height: 26, borderRadius: 6, border: `3px solid ${theme.text}`, background: theme.panel, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.sans, fontSize: 12, fontWeight: 700, color: theme.text}}>
            {'锁'}
          </div>
        </div>
        <div style={{height: 92, borderRadius: 9, border: `2.5px solid ${withAlpha(theme.mech, 0.8)}`, background: withAlpha(theme.mech, 0.12), display: 'flex', alignItems: 'center', paddingLeft: 16, fontFamily: theme.sans, fontSize: 18, fontWeight: 600, color: theme.text}}>
          {'结果 tool_result'}
        </div>
        {/* 确认绿框（一闪——成对保全） */}
        <div
          style={{
            position: 'absolute',
            inset: -14,
            borderRadius: 14,
            border: `3.5px solid ${theme.ok}`,
            opacity: clamp01(confirm),
            boxShadow: `0 0 ${22 * clamp01(confirm)}px ${withAlpha(theme.ok, 0.5)}`,
            pointerEvents: 'none',
          }}
        />
        <div style={{position: 'absolute', right: 0, bottom: -44, fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.ok, whiteSpace: 'nowrap', opacity: clamp01(confirm)}}>
          {'切口绕开配对 · 成对保全'}
        </div>
        {/* 切口落在配对之外（绿线——右帧的正解切口） */}
        <div style={{position: 'absolute', left: 40, top: 260, width: 480, height: 5, borderRadius: 3, background: theme.ok, opacity: 0.85}} />
      </div>
      {/* 工况角标（实测 · 边界） */}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 200, textAlign: 'center', fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>
        {'实测 · 边界'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'orphan tool_result · 当场拒收'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-C 第一步装置：紫面首亮 + 大块抽离落盘 + 原位住址条 ─────────────────

const OneC: React.FC<{atGather: number; atPurple: number; atWater: number; atPull: number; atStub: number; atL1: number}> = ({
  atGather,
  atPurple,
  atWater,
  atPull,
  atStub,
  atL1,
}) => {
  const frame = useCurrentFrame();
  // 「单批超标」「最后一条消息」批结果块聚拢进末条消息
  const gather = useProgress(atGather, DUR.f5);
  // 紫面首亮（磁盘面板自右缘滑入——蓝左紫右双平面自此定形）
  const purple = useProgress(atPurple, DUR.f6, 'decelerate');
  // 「总量一到二十万字符」批预算水位条沿列侧立起、逼近二十万刻度
  const water = useProgress(atWater, DUR.f6, 'decelerate');
  // 「超三万的整份写进磁盘」最大块沿蓝→紫箭头抽离落成磁盘卡（+大件长度标尺小签）
  const pull = clamp01(progress(frame, atPull, DUR.f6));
  const pullFlash = useImpulse({at: atPull + DUR.f5, dur: DUR.f5, peak: 1});
  // 「磁盘路径」「前两千预览」原位小条亮出（路径签+预览签两件——住址语义首立）
  const stub = useProgress(atStub, DUR.f4);
  const stubPath = useProgress(atStub + 3, DUR.f4);
  const stubPrev = useProgress(atStub + 8, DUR.f4);
  // 阶梯缩影第一格点亮（大件落盘）
  const l1 = useProgress(atL1, DUR.f4);
  const l1Flash = useImpulse({at: atL1, dur: DUR.f5, peak: 1});
  // 大块飞行（蓝面末条 → 紫面磁盘卡位——下凸弧线，避免穿水位条）
  const flyX = STAGE.blue.x + 420 + (STAGE.purple.x + 120 - STAGE.blue.x - 420) * pull;
  const flyY = 470 + 60 * Math.sin(Math.PI * pull);
  const dot = ((frame / 80) % 1 + 1) % 1;
  return (
    <AbsoluteFill>
      {/* 环体缩悬列侧上角 */}
      <div style={{position: 'absolute', left: 120, top: 76, opacity: 0.85}}>
        <LoopRing size={120} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {/* 阶梯缩影（右上恒驻——第一格点亮） */}
      <StepLadder x={LADDER_MINI.x} y={LADDER_MINI.y} mode="mini" litMask={l1} />
      {/* 蓝面容器（消息列） */}
      <div
        style={{
          position: 'absolute',
          left: STAGE.blue.x,
          top: STAGE.blue.y,
          width: STAGE.blue.w,
          height: STAGE.blue.h,
          boxSizing: 'border-box',
          borderRadius: 14,
          border: `3px solid ${withAlpha(theme.mech, 0.6)}`,
          background: withAlpha(theme.panel, 0.55),
        }}
      >
        <div style={{padding: '12px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={{fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.mech}}>{'上下文 · 消息列'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'messages'}</span>
        </div>
        <div style={{position: 'absolute', left: 20, top: 52}}>
          <MessageColumn x={0} y={0} w={STAGE.blue.w - 40} rowH={64} rows={ROWS.slice(0, 4)} rowsLit={4} lastMsgLit={gather} scale={0.94} headerLabel={''} />
        </div>
        {/* 末条消息内聚拢的一批结果块（三个小块——单批超标具象） */}
        <div style={{position: 'absolute', left: 40, top: 380, width: 460}}>
          <div style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, marginBottom: 6, opacity: gather}}>{'末条消息 · 一轮连发的结果'}</div>
          {[74, 52, 38].map((hh, i) => {
            const p = clamp01(gather * 3 - i);
            return (
              <div
                key={i}
                style={{
                  height: hh,
                  width: 380 - i * 40,
                  marginBottom: 8,
                  boxSizing: 'border-box',
                  borderRadius: 7,
                  border: `2.5px solid ${i === 0 ? theme.mech : withAlpha(theme.mech, 0.55)}`,
                  background: withAlpha(theme.mech, 0.08 + 0.06 * p),
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 12,
                  fontFamily: theme.mono,
                  fontSize: 13,
                  color: theme.dim,
                  whiteSpace: 'nowrap',
                  opacity: 0.35 + 0.65 * p,
                  // 最大块抽离后原位让位给住址条
                  transform: i === 0 ? `translateX(${-40 * pull}px)` : 'none',
                }}
              >
                {i === 0 ? '大结果 · 80,000 字符' : `结果 ${3 - i}`}
              </div>
            );
          })}
        </div>
        {/* 原位小条（路径＋预览——大块搬走后原位留的「住址条」） */}
        <div style={{position: 'absolute', left: 40, top: 384, width: 560, opacity: clamp01(stub) * pull}}>
          <PathStub x={0} y={0} w={560} lit={stub * pull} pathLit={stubPath} previewLit={stubPrev} />
        </div>
      </div>
      {/* 水位条（列侧立起——逼近二十万刻度） */}
      <ThresholdWaterline x={STAGE.blue.x + STAGE.blue.w + 24} y={STAGE.blue.y + 30} h={STAGE.blue.h - 60} level={water * 0.93} lit={water} />
      {/* 蓝→紫双色箭头（首演——恒向右） */}
      <TransferArrow x={STAGE.blue.x + STAGE.blue.w + 40} y={430} w={STAGE.purple.x - STAGE.blue.x - STAGE.blue.w - 80} p={pull} lit={pull > 0.02 ? 1 : 0} flowPhase={frame / 30} />
      {/* 紫面容器（磁盘面板——自右缘滑入首亮） */}
      <div
        style={{
          position: 'absolute',
          left: STAGE.purple.x + 320 * (1 - purple),
          top: STAGE.purple.y,
          width: STAGE.purple.w,
          height: STAGE.purple.h,
          opacity: clamp01(purple * 1.6),
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            borderRadius: 14,
            border: `3px solid ${theme.archive}`,
            background: withAlpha(theme.panel, 0.6),
            position: 'relative',
          }}
        >
          <div style={{padding: '12px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
            <span style={{fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.archive}}>{'磁盘 · 留档面'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.archive}}>{'.task_outputs/'}</span>
          </div>
          {/* 磁盘文件卡（落盘件——必带路径签） */}
          <DiskCard x={90} y={120} w={460} h={330} rowsLit={8 * pull} flash={pullFlash} sizeTag={'超 30,000'} sizeTagLit={pull} />
        </div>
      </div>
      {/* 大块飞行体（蓝→紫途中——半透明块剪影） */}
      {pull > 0.02 && pull < 0.9 ? (
        <div style={{position: 'absolute', left: flyX, top: flyY, width: 300, height: 120, borderRadius: 10, border: `3px solid ${theme.mech}`, background: withAlpha(theme.mech, 0.14), opacity: clamp01(pull * 4) * (1 - clamp01((pull - 0.8) * 5)), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.mono, fontSize: 14, color: theme.text}}>
          {'80,000 字符'}
        </div>
      ) : null}
      {/* 第一格点亮闪注（阶梯缩影——budget） */}
      {l1Flash > 0.04 ? (
        <div style={{position: 'absolute', left: LADDER_MINI.x - 60, top: LADDER_MINI.y + 116, fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.core, whiteSpace: 'nowrap', opacity: l1Flash}}>
          {'① 大件落盘'}
        </div>
      ) : null}
      {/* 角标（tool_result_budget · LARGE_RESULT_CHAR_LIMIT） */}
      <div style={{position: 'absolute', left: STAGE.blue.x + 4, top: STAGE.blue.y + STAGE.blue.h + 16, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>
        {'tool_result_budget · LARGE_RESULT_CHAR_LIMIT 30,000'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'第一步 · 大件先落盘 留住址'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-D 走查数字特写：五块排队 → 加五千破线 → 八万落盘 → 回落定格 ────────

/** 五块走查数据（数字旁标 + 面积可比——柱高∝字符数，满高 400px = 90,000） */
const WALK = [
  {tag: '八万', val: 80000, h: 356},
  {tag: '六万', val: 60000, h: 267},
  {tag: '三万', val: 30000, h: 133},
  {tag: '两万', val: 20000, h: 89},
  {tag: '一万', val: 10000, h: 44},
] as const;

const OneD: React.FC<{atQueue: number; atTotal: number; atSmall: number; atBreach: number; atStore: number; atFall: number; atStop: number; atFlashDisk: number}> = ({
  atQueue,
  atTotal,
  atSmall,
  atBreach,
  atStore,
  atFall,
  atStop,
  atFlashDisk,
}) => {
  const frame = useCurrentFrame();
  // 五块按大小 stagger 排队（面积可比）
  const queue = WALK.map((_, i) => clamp01(progress(frame, atQueue + i * 7, DUR.f5)));
  // 「二十万压线」计数滚至 200,000 贴线（数据本体：五块之和到位即止、禁过冲）
  const total = clamp01(progress(frame, atTotal, DUR.f6));
  // 「再加五千」小块落下（不计入排队五块）
  const small = useProgress(atSmall, DUR.f4, 'accelerate');
  // 「超线」水位破红线一拍（泛警示红——205,000）
  const breach = useProgress(atBreach, DUR.f4);
  const breachFlash = useImpulse({at: atBreach, dur: DUR.f6, peak: 1});
  // 「八万先存盘」最大块沿箭头落进紫面（留两千预览签——80k 柱缩成 2k 短柱）
  const store = clamp01(progress(frame, atStore, DUR.f6));
  const storeFlash = useImpulse({at: atStore + DUR.f5, dur: DUR.f5, peak: 1});
  // 「掉回约十二万七」水位回落滚动至 ≈127,000 定格（205,000−80,000+2,000 闭合）
  const fall = clamp01(progress(frame, atFall, DUR.f6));
  // 「停手」操作停格静持
  const stop = useProgress(atStop, DUR.f3);
  // 「会毁掉原文」紫面磁盘卡轻闪一拍（保险钩子）
  const diskFlash = useImpulse({at: atFlashDisk, dur: DUR.f6, peak: 1});
  // 总量计数（分镜锁定式闭合：0→200,000（贴线）→205,000（破线）→127,000（回落
  // 定格）——每步保持 ≥15 帧：200k 自 atTotal 起定格至 atBreach 词、205k 定格至
  // atFall 词、127k 定格至镜尾）
  const count =
    fall > 0.001
      ? Math.round(205000 - 78000 * fall)
      : breach > 0.5
        ? 205000
        : Math.round(200000 * total);
  // 水位位相（满位 210,000）
  const fullScale = 210000;
  const level = Math.min(1.0, count / fullScale);
  const BAR = {x: 200, base: 800, colW: 128, gap: 34} as const;
  return (
    <AbsoluteFill>
      {/* 阶梯缩影（右上恒驻——第一格亮） */}
      <StepLadder x={LADDER_MINI.x} y={LADDER_MINI.y} mode="mini" litMask={1} />
      {/* 五块排队（按大小——柱高∝字符数、数字旁标） */}
      {WALK.map((wk, i) => {
        const q = queue[i];
        // 八万块：落盘后缩成两千预览短柱（高度 356→12）
        const isBig = i === 0;
        const bigH = store > 0.001 ? 356 - 344 * store : 356;
        const hh = isBig ? q * bigH : q * wk.h;
        return (
          <div key={wk.tag} style={{position: 'absolute', left: BAR.x + i * (BAR.colW + BAR.gap), top: BAR.base - hh, width: BAR.colW}}>
            <div
              style={{
                height: hh,
                boxSizing: 'border-box',
                borderRadius: 8,
                border: `2.5px solid ${isBig ? theme.mech : withAlpha(theme.mech, 0.6)}`,
                background: withAlpha(theme.mech, 0.1 + 0.1 * q),
                opacity: 0.35 + 0.65 * q,
                boxShadow: isBig && store > 0.3 && store < 1 ? `0 0 ${20 * store}px ${withAlpha(theme.mech, 0.5)}` : 'none',
              }}
            />
            {/* 数字旁标（八万=80,000） */}
            <div style={{marginTop: 8, textAlign: 'center', fontFamily: theme.mono, fontSize: 15, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums', opacity: q}}>
              {wk.tag}
              <div style={{fontSize: 11, color: theme.dim, fontWeight: 400}}>{`${(wk.val / 10000).toFixed(1)} 万`}</div>
            </div>
            {/* 八万块的预览签（落盘后——留 2,000 预览） */}
            {isBig && store > 0.6 ? (
              <div style={{marginTop: 6, textAlign: 'center', fontFamily: theme.mono, fontSize: 11, color: theme.archive, opacity: clamp01((store - 0.6) * 2.5), whiteSpace: 'nowrap'}}>
                {'留 2,000 预览'}
              </div>
            ) : null}
          </div>
        );
      })}
      {/* 再加的小块（五千——独立落下、不计入五块） */}
      {small > 0.02 ? (
        <div style={{position: 'absolute', left: BAR.x + 5 * (BAR.colW + BAR.gap), top: BAR.base - 22 * small, width: BAR.colW}}>
          <div style={{height: 22 * small, boxSizing: 'border-box', borderRadius: 6, border: `2.5px dashed ${theme.danger}`, background: withAlpha(theme.danger, 0.08), opacity: 0.9}} />
          <div style={{marginTop: 8, textAlign: 'center', fontFamily: theme.mono, fontSize: 15, fontWeight: 700, color: theme.danger}}>
            {'五千'}
            <div style={{fontSize: 11, color: theme.dim, fontWeight: 400}}>{'0.5 万'}</div>
          </div>
        </div>
      ) : null}
      {/* 水位条 + 总量计数位（列侧） */}
      <ThresholdWaterline x={1080} y={240} h={520} level={level} label={total > 0.02 ? `${count.toLocaleString('en-US')}` : ''} breach={breach * (1 - fall)} breachFlash={Math.max(breachFlash, storeFlash)} caption={'批预算 · 走查'} />
      {/* 蓝→紫箭头（八万块落盘路径） */}
      <TransferArrow x={330} y={420} w={500} p={store} lit={store > 0.02 && store < 0.98 ? 1 : 0} flowPhase={frame / 26} />
      {/* 紫面缩微（磁盘——八万块落进、轻闪一拍） */}
      <div style={{position: 'absolute', left: 1420, top: 250, width: 380}}>
        <div
          style={{
            width: '100%',
            height: 300,
            boxSizing: 'border-box',
            borderRadius: 12,
            border: `3px solid ${theme.archive}`,
            background: withAlpha(theme.panel, 0.6),
            padding: '10px 12px',
            boxShadow: diskFlash > 0.05 ? `0 0 ${26 * clamp01(diskFlash)}px ${withAlpha(theme.archive, 0.55)}` : 'none',
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 14, fontWeight: 700, color: theme.archive}}>{'磁盘 · 留档面'}</div>
          <DiskCard x={30} y={44} w={300} h={210} rowsLit={8 * store} flash={Math.max(storeFlash, diskFlash)} path={'.task_outputs/tool-results/r1.json'} />
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, marginTop: 8, whiteSpace: 'nowrap'}}>{'已存原文 · 后面步骤的保险'}</div>
      </div>
      {/* 停手静持注（操作停格——M-003） */}
      {stop > 0.5 ? (
        <div style={{position: 'absolute', left: 1080, top: 800, fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap', opacity: clamp01((stop - 0.5) * 2)}}>
          {'停手 · 预算内'}
        </div>
      ) : null}
      {/* 工况角标（走查 · 复算口径） */}
      <div style={{position: 'absolute', left: 200, top: 210, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>
        {'走查 · 复算口径'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'80,000 存盘 · 205,000 − 80,000 + 2,000 ≈ 127,000'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P1RedlineBudget: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p1-01', 'p1-02');
  const bB = w('p1-03');
  const bC = w('p1-04', 'p1-06');
  const bD = w('p1-07', 'p1-09');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <OneA
          atLock={wa('p1-01', 0.3) - bA.from}
          atSnip={wa('p1-02', 0.14) - bA.from}
          atBounce={wa('p1-02', 0.32) - bA.from}
          atGood={wa('p1-02', 0.66) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="1-B">
        <OneB atCut={wa('p1-03', 0.18) - bB.from} atOrphan={wa('p1-03', 0.46) - bB.from} atStamp={wa('p1-03', 0.74) - bB.from} />
      </Sequence>
      <Sequence {...bC} name="1-C">
        <OneC
          atGather={wa('p1-04', 0.24) - bC.from}
          atPurple={wa('p1-04', 0.62) - bC.from}
          atWater={wa('p1-05', 0.16) - bC.from}
          atPull={wa('p1-05', 0.46) - bC.from}
          atStub={wa('p1-06', 0.3) - bC.from}
          atL1={wa('p1-06', 0.72) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="1-D">
        <OneD
          atQueue={wa('p1-07', 0.2) - bD.from}
          atTotal={wa('p1-07', 0.66) - bD.from}
          atSmall={wa('p1-08', 0.16) - bD.from}
          atBreach={wa('p1-08', 0.3) - bD.from}
          atStore={wa('p1-08', 0.5) - bD.from}
          atFall={wa('p1-08', 0.72) - bD.from}
          atStop={wa('p1-08', 0.94) - bD.from}
          atFlashDisk={wa('p1-09', 0.4) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1RedlineBudget;
