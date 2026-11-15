/** P1 一个循环就够了（p1-01..p1-05，3 镜）——分镜 1-A..1-C（storyboard v5）。
 *
 *  ★ 1-A（WS）环体闭合接棒（0-C→1-A morph：draw 恒 1、pushIn 承载尺度）：五枚暗态
 *    站位刻度 + 环顶关卡闸门只亮轮廓；p1-01「不停转的循环」环体微转示活（机器语义
 *    匀速豁免）、「调工具就继续」前弧段亮一拍、「不调就停」环体制动一拍。
 *  ★ 1-B（CU）闸门双态演示（次序=口播次序）：卷轴到闸受检——检出态 tool_use 块弹出
 *    → 左牌亮 → 闸门开 → 穿行 → 底部环体走一格（继续的因果完整可见）；未检出态 →
 *    右牌亮 → 侧门开 → 出口绿光一拍 → 环体停（退出的因果完整可见）。牌面纯图形
 *    零成句（画面文字不复述口播）。
 *  ★ 1-C（MS→CU）源码面板首秀：agent_loop 完整函数逐字上屏（pinned 源码 verbatim，
 *    只缩排不改写）、while True 行唯一陶土橙高亮、行号左缘五枚半透明括号锚（五步
 *    占位，P2 下钻）；「三十多行」词位行计数 1→30+ 快滚定格（重音镜）；p1-05 题眼
 *    图形等式（工具方块 + 环体 → Agent 徽记，纯图形）+ @pushIn 推近等式区。
 *  ★ 源码上屏纪律（storyboard 头部契约）：代码逐字取源码归档，仅省略注释。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel, RING_STROKE, SceneTag, type RingNode} from '../components/motifs';
import {AgentLoopMaster} from '../components/AgentLoopMaster';
import {DUR, clamp01, useCount, useEnter, useImpulse, useProgress, usePushIn, useStagger} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const polar = (cx: number, cy: number, r: number, deg: number): {x: number; y: number} => {
  const rad = (deg * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
};

/** 贯穿全片的五步节点与明确主语（与 P2 STATIONS 同构：-90 起每 +72°） */
const STATIONS: (RingNode & {subject: string; sub: string})[] = [
  {label: 's1', subject: 'User', sub: '目标种子', angle: -90},
  {label: 's2', subject: 'Harness', sub: '底座装配', angle: -18},
  {label: 's3', subject: 'LLM', sub: '认知决策', angle: 54},
  {label: 's4', subject: 'Tool', sub: '终端执行', angle: 126},
  {label: 's5', subject: 'Context', sub: '观察回填', angle: 198},
];

/** 0:47 处包容模型与终端的宏大 Harness 大圈 */
const RING_WS = {size: 780, left: 570, top: 140, cx: 960, cy: 530, r: 350} as const;

// ── 1-A 循环形状（p1-01） ────────────────────────────────────────────────

/** 环顶关卡闸门轮廓：双柱 + 楣梁，1-A 只亮轮廓不开合（Visual Lock） */
const GateFrame: React.FC<{o: number}> = ({o}) => (
  <svg width={340} height={190} style={{position: 'absolute', left: 790, top: 120, overflow: 'visible', opacity: o}}>
    <g stroke={theme.dim} strokeWidth={5} fill="none" strokeLinecap="round">
      <line x1={70} y1={182} x2={70} y2={44} />
      <line x1={270} y1={182} x2={270} y2={44} />
      <path d="M52 44 H288" strokeWidth={6} />
    </g>
    {/* 楣顶信号灯（暗态） */}
    <circle cx={160} cy={24} r={10} fill={theme.panel} stroke={theme.dim} strokeWidth={3} />
  </svg>
);

const LoopShape: React.FC<{atSpin: number; atGo: number; atStop: number; atGate: number}> = ({
  atSpin,
  atGo,
  atStop,
}) => {
  // 0-C→1-A 无缝承接：直接沿用同一套 AgentLoopMaster 模型
  const push = usePushIn(2, {scale: 0.06, dur: DUR.f6});
  const frame5 = useProgress(0, DUR.f4);
  // 「不停转的循环」词窗：环体微转一格示活（~36°）
  const spin = clamp01(useProgress(atSpin, 26, 'linear')) * 36;
  // 「调工具就继续」词窗：前弧段亮一拍
  const go = useImpulse({at: atGo, dur: DUR.f6});
  // 「不调就停」词窗：制动一拍
  const stop = useImpulse({at: atStop, dur: DUR.f6});
  const ticks = useStagger(5, {at: 10, stride: 4, dur: DUR.f3});

  return (
    <AbsoluteFill style={{transform: push}}>
      <SceneTag chapter="Agent Loop" tagline="一个循环就够了" accent={theme.core} />
      <AgentLoopMaster
        headerOpacity={frame5}
        coreOpacity={frame5}
        drawProgress={1}
        stationOpacities={ticks.map((t) => t * frame5)}
        footnoteOpacity={frame5}
        spinDeg={spin}
        goImpulse={go}
        stopImpulse={stop}
      />
    </AbsoluteFill>
  );
};

// ── 1-B 闸门双态演示（p1-02..p1-03） ─────────────────────────────────────

/** 闸门几何（1-B 舞台：闸门居中放大，双牌分列左右，底部小环承接走/停） */
const G = {cx: 960, cy: 420, halfW: 150, top: 300, bot: 560} as const;
const MINI_RING = {size: 150, x: 885, y: 720} as const;

/** 信号牌（纯图形零成句）：chip/空托盘 + 环转/门开 icon */
/** 信号牌：精确对齐双信号机制（stop_reason == "tool_use" 与 != "tool_use"） */
const SignPlate: React.FC<{
  x: number;
  lit: boolean;
  litAt: number;
  kind: 'chip' | 'empty';
  icon: 'loop' | 'door';
}> = ({x, lit, litAt, kind, icon}) => {
  const enter = useEnter('rise', {at: 4, dur: DUR.f4, dist: 18});
  const litP = useProgress(litAt, DUR.f4);
  const pop = useImpulse({at: litAt, dur: DUR.f5});
  const accent = lit ? (kind === 'chip' ? theme.core : theme.ok) : theme.panelBorder;
  const isTool = kind === 'chip';

  return (
    <div style={{position: 'absolute', left: x - 150, top: 320, opacity: enter.opacity, transform: enter.transform}}>
      <Panel accent={accent} style={{width: 300, padding: '18px 20px', textAlign: 'center', opacity: lit ? 1 : 0.65}}>
        {/* 信号判断表达式（源页两大信号） */}
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 16,
            fontWeight: 700,
            color: lit ? (isTool ? theme.tool : theme.ok) : theme.dim,
            marginBottom: 12,
            background: '#0D1117',
            padding: '6px 10px',
            borderRadius: 6,
            border: `1px solid ${lit ? accent : theme.panelBorder}`,
          }}
        >
          {isTool ? 'stop_reason == "tool_use"' : 'stop_reason != "tool_use"'}
        </div>

        {/* 图形一：受检物（chip = 实体 tool_use 块 / empty = 纯文本结束） */}
        <div
          style={{
            width: 140,
            height: 44,
            margin: '0 auto',
            boxSizing: 'border-box',
            borderRadius: 8,
            background: isTool && lit ? `${theme.tool}30` : 'transparent',
            border: isTool ? `2.5px solid ${lit ? theme.tool : theme.panelBorder}` : `2.5px dashed ${lit ? theme.ok : theme.panelBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${1 + 0.1 * pop})`,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 15, color: lit ? (isTool ? theme.tool : theme.ok) : theme.dim}}>
            {isTool ? 'tool_use 块' : '∅ 无调用'}
          </span>
        </div>

        {/* 图形二：走向动效（环转 ⟳ / 出口开启） */}
        <svg width={130} height={56} viewBox="0 0 120 56" style={{marginTop: 12, display: 'block', margin: '12px auto 0'}}>
          {icon === 'loop' ? (
            <g stroke={lit ? theme.core : theme.panelBorder} strokeWidth={4.5} fill="none" strokeLinecap="round">
              <path d="M92 28 A 22 22 0 1 1 70 8" />
              <path d="M58 2 L78 8 L62 20 Z" fill={lit ? theme.core : 'none'} stroke="none" />
              <path d="M58 2 L78 8 L62 20" stroke={lit ? theme.core : theme.panelBorder} strokeWidth={3} strokeLinejoin="round" />
            </g>
          ) : (
            <g stroke={lit ? theme.ok : theme.panelBorder} strokeWidth={4.5} fill="none" strokeLinecap="round">
              <line x1={38} y1={10} x2={38} y2={46} />
              <line x1={82} y1={10} x2={82} y2={46} />
              <rect x={42} y={14} width={16} height={28} transform={`rotate(${-28 * litP} 42 28)`} />
              <rect x={62} y={14} width={16} height={28} transform={`rotate(${28 * litP} 78 28)`} />
            </g>
          )}
        </svg>

        <div style={{fontFamily: theme.sans, fontSize: 17, fontWeight: 600, color: lit ? (isTool ? theme.core : theme.ok) : theme.dim, marginTop: 8}}>
          {isTool ? '放行 · 继续循环' : '开启出口 · 退出 return'}
        </div>
      </Panel>
    </div>
  );
};

/** 卷轴（回答缩影）：行进 → 受检；chip 检出后才亮（禁预亮） */
const Scroll: React.FC<{
  at: number;
  scanAt: number;
  scanDur: number;
  chipHitAt: number | null;
  passAt?: number;
  x0: number;
  xGate: number;
}> = ({at, scanAt, scanDur, chipHitAt, passAt, x0, xGate}) => {
  const travel = useProgress(at, DUR.f5, 'decelerate');
  const x = x0 + (xGate - x0) * travel;
  const scanP = useProgress(scanAt, scanDur, 'linear');
  // 哨兵无条件调用（hooks 顺序稳定；chipHitAt=null 时 progress 钳制恒 0）
  const chipLit = useProgress(chipHitAt ?? -999, DUR.f3);
  const passP = passAt !== undefined ? useProgress(passAt, DUR.f5, 'decelerate') : 0;
  const passX = passP * 320;
  const o = useProgress(at, DUR.f3) * (1 - useProgress((passAt ?? 1e9) + DUR.f6, DUR.f4));
  return (
    <div style={{position: 'absolute', left: x + passX, top: G.cy - 48, opacity: o}}>
      <div
        style={{
          width: 330,
          height: 96,
          boxSizing: 'border-box',
          borderRadius: 12,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 回答行（示意字符条 ×3） */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 20,
              top: 16 + i * 24,
              width: 150 - i * 26,
              height: 10,
              borderRadius: 5,
              background: theme.panelBorder,
              opacity: 0.6,
            }}
          />
        ))}
        {/* 检出的 tool_use chip（扫描扫到才亮） */}
        {chipHitAt !== null ? (
          <div
            style={{
              position: 'absolute',
              right: 18,
              top: 26,
              width: 108,
              height: 42,
              borderRadius: 8,
              border: `2.5px solid ${chipLit > 0.5 ? theme.tool : theme.panelBorder}`,
              background: chipLit > 0.5 ? `${theme.tool}26` : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${0.92 + 0.08 * chipLit})`,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 14, color: chipLit > 0.5 ? theme.tool : theme.dim}}>
              {'tool_use'}
            </span>
          </div>
        ) : null}
        {/* 扫描线（单向一次，线性=机器语义豁免） */}
        {scanP > 0 && scanP < 1 ? (
          <div
            style={{
              position: 'absolute',
              left: scanP * 300,
              top: 6,
              width: 3,
              height: 84,
              background: theme.text,
              boxShadow: `0 0 12px ${theme.text}`,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

const GateDuel: React.FC<{
  scan1At: number;
  chip1At: number;
  pass1At: number;
  ring1At: number;
  scan2At: number;
  sideAt: number;
  exitAt: number;
  stopAt: number;
}> = ({scan1At, chip1At, pass1At, ring1At, scan2At, sideAt, exitAt, stopAt}) => {
  const frame = useCurrentFrame();
  const gate = useProgress(0, DUR.f4);
  // 检出态：左牌亮 → 闸门双开 → 卷轴穿行 → 底部小环走一格
  const lit1 = useProgress(chip1At, DUR.f4);
  const door1 = useProgress(pass1At, DUR.f4);
  const dot1 = clamp01(useProgress(ring1At, 30, 'linear')) * 0.2;
  // 未检出态：右牌亮 → 侧门开 → 出口绿光一拍 → 小环停转
  const lit2 = useProgress(scan2At + 20, DUR.f4);
  const side = useProgress(sideAt, DUR.f4);
  const exitGlow = useImpulse({at: exitAt, dur: DUR.f6});
  // 小环巡游：检出态后走一格；stopAt 起冻结（停=退出的体感，dot 停在当前值）
  const miniDot = frame >= stopAt ? Math.min(dot1, 0.2) : dot1;
  return (
    <AbsoluteFill>
      {/* 闸门（居中放大；双开门随检出态开启） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <g opacity={gate} stroke={theme.core} strokeWidth={7} fill="none" strokeLinecap="round">
          <line x1={G.cx - G.halfW} y1={G.bot} x2={G.cx - G.halfW} y2={G.top} />
          <line x1={G.cx + G.halfW} y1={G.bot} x2={G.cx + G.halfW} y2={G.top} />
          <path d={`M${G.cx - G.halfW - 20} ${G.top} H${G.cx + G.halfW + 20}`} strokeWidth={8} />
        </g>
        {/* 楣顶信号灯：检出态亮 core */}
        <circle cx={G.cx} cy={G.top - 22} r={11} fill={lit1 > 0.5 ? theme.core : theme.panel} stroke={theme.core} strokeWidth={3.5} />
        {/* 双开门（外开；检出态） */}
        <g stroke={theme.core} strokeWidth={5} fill="none" opacity={0.9}>
          <rect
            x={G.cx - G.halfW + 10}
            y={G.top + 24}
            width={54}
            height={170}
            transform={`rotate(${-62 * door1} ${G.cx - G.halfW + 10} ${G.top + 24})`}
          />
          <rect
            x={G.cx + G.halfW - 64}
            y={G.top + 24}
            width={54}
            height={170}
            transform={`rotate(${62 * door1} ${G.cx + G.halfW - 10} ${G.top + 24})`}
          />
        </g>
        {/* 侧门（右柱外侧；未检出态开启 → 出口绿光） */}
        <g opacity={lit2}>
          <line x1={G.cx + G.halfW + 60} y1={G.bot} x2={G.cx + G.halfW + 60} y2={G.top + 40} stroke={theme.dim} strokeWidth={5} />
          <rect
            x={G.cx + G.halfW + 66}
            y={G.top + 40}
            width={48}
            height={150}
            fill="none"
            stroke={theme.dim}
            strokeWidth={4.5}
            transform={`rotate(${34 * side} ${G.cx + G.halfW + 66} ${G.top + 40})`}
          />
          {/* 出口绿光一拍（确认绿=出口语义，P3 正门开启的前情） */}
          <circle cx={G.cx + G.halfW + 110} cy={(G.top + G.bot) / 2} r={16 + 14 * exitGlow} fill={theme.ok} opacity={0.75 * Math.max(exitGlow, 0.35 * lit2)} />
        </g>
      </svg>

      <SignPlate x={330} lit={lit1 > 0.5} litAt={chip1At} kind="chip" icon="loop" />
      <SignPlate x={1590} lit={lit2 > 0.5} litAt={scan2At + 20} kind="empty" icon="door" />

      {/* 检出态卷轴（p1-02 问句 + p1-03 前半） */}
      <Scroll at={2} scanAt={scan1At} scanDur={24} chipHitAt={chip1At} passAt={pass1At} x0={320} xGate={G.cx - G.halfW - 360} />
      {/* 未检出态卷轴（p1-03 后半：空手到闸） */}
      <Scroll at={scan2At - 30} scanAt={scan2At} scanDur={24} chipHitAt={null} x0={320} xGate={G.cx - G.halfW - 360} />

      {/* 底部小环：走一格（继续）/ 停（退出）——去向的体感 */}
      <div style={{position: 'absolute', left: MINI_RING.x, top: MINI_RING.y, opacity: 0.95}}>
        <LoopRing size={MINI_RING.size} nodes={STATIONS} showLabels={false} showExit={false} dotProgress={miniDot} />
      </div>

      <Footnote delay={6}>{'tool_use'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-C 源码首秀（p1-04..p1-05） ────────────────────────────────────────

/** agent_loop 完整函数（pinned 源码 verbatim，仅省略注释与空行；23 行） */
const CODE_LINES = [
  'def agent_loop(messages):',
  '    while True:',
  '        response = client.messages.create(',
  '            model=MODEL, system=SYSTEM,',
  '            messages=messages,',
  '            tools=TOOLS, max_tokens=8000,',
  '        )',
  '        messages.append({"role": "assistant",',
  '                         "content": response.content})',
  '        tool_calls = [',
  '            block for block in response.content',
  '            if block.type == "tool_use"',
  '        ]',
  '        if not tool_calls:',
  '            return',
  '        results = []',
  '        for block in tool_calls:',
  '            output = run_bash(block.input["command"])',
  '            results.append({"type": "tool_result",',
  '                            "tool_use_id": block.id,',
  '                            "content": output})',
  '        messages.append({"role": "user",',
  '                         "content": results})',
] as const;

/** 五步括号锚所在行（0 基行号）：入口形参 / create 调用 / 查信号 / 执行 / 回塞 */
const ANCHOR_ROWS: readonly number[] = [0, 2, 9, 16, 21];

/** 面板几何：右侧主位 + 左上角环体缩微常驻 */
const PANEL = {left: 520, top: 118, w: 900, padX: 24, padY: 18} as const;
const lineH = 28;

const CodeDebut: React.FC<{
  atLines: number;
  atCount: number;
  atEq: number;
  atBadge: number;
  span: number;
}> = ({atLines, atCount, atEq, atBadge, span}) => {
  // 面板滑入 + 行 stagger 铺开（落定 ≤0.6·句长——stagger 硬约束 fit 钳制）
  const panelIn = useEnter('slideL', {at: 2, dur: DUR.f5, dist: 90});
  const fitTotal = Math.min(Math.round(span * 0.6), 44);
  const lines = useStagger(CODE_LINES.length, {at: atLines, fit: {total: Math.max(CODE_LINES.length, fitTotal)}});
  const anchors = useStagger(ANCHOR_ROWS.length, {at: atLines + 8, stride: 6, dur: DUR.f3});
  // 「三十多行」词位：行计数 1→30+ 快滚定格（重音镜：规模的数字实感）
  const countN = useCount({from: 1, to: 31, at: atCount, dur: DUR.f5});
  const countPulse = useImpulse({at: atCount + DUR.f5, dur: DUR.f6, peak: 0.12});
  // p1-05 图形等式：工具方块 + 环体相触 → Agent 徽记迸出（AAS：相触前后撤 2 帧）
  const eqA = useEnter('rise', {at: atEq, dur: DUR.f4, dist: 18});
  const eqB = useEnter('rise', {at: atEq + DUR.f3, dur: DUR.f4, dist: 18});
  const touch = useProgress(atBadge - 6, 6, 'accelerate');
  const badge = useEnter('pop', {at: atBadge, dur: DUR.f5, springPreset: 'snap'});
  const badgeGlow = useImpulse({at: atBadge, dur: DUR.f6});
  // 镜内推近等式区（题眼句后半聚焦；transformOrigin 钉在等式区）
  const push = usePushIn(atEq, {scale: 0.045, dur: DUR.f6});
  return (
    <AbsoluteFill style={{transform: push, transformOrigin: '1560px 520px'}}>
      {/* 环体缩微（M-001 常驻，左上角同形） */}
      <div style={{position: 'absolute', left: 190, top: 150}}>
        <LoopRing size={180} nodes={STATIONS} showLabels={false} showExit={false} />
      </div>

      <div style={{position: 'absolute', left: PANEL.left, top: PANEL.top, ...panelIn}}>
        <Panel style={{width: PANEL.w, boxSizing: 'border-box', padding: `${PANEL.padY}px ${PANEL.padX}px`, position: 'relative'}}>
          {/* 面板头行：函数名 + 行计数（「三十多行」词位快滚定格） */}
          <div style={{display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12}}>
            <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'code.py'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 30, fontWeight: 700, color: theme.core, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', transform: `scale(${1 + countPulse})`}}>
              {`${Math.min(31, Math.max(1, Math.round(countN))) > 30 ? '30+' : Math.max(1, Math.round(countN))} 行`}
            </span>
          </div>
          {CODE_LINES.map((ln, i) => {
            const shown = lines[i];
            const isWhile = i === 1;
            return (
              <div key={i} style={{position: 'relative', height: lineH, opacity: shown}}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    fontFamily: theme.mono,
                    fontSize: 20,
                    lineHeight: `${lineH}px`,
                    whiteSpace: 'pre',
                    background: isWhile ? `${theme.core}24` : 'transparent',
                    borderLeft: isWhile ? `4px solid ${theme.core}` : '4px solid transparent',
                    paddingLeft: 8,
                    borderRadius: 4,
                  }}
                >
                  <span style={{width: 30, textAlign: 'right', color: theme.panelBorder}}>{i + 1}</span>
                  <span style={{color: isWhile ? theme.core : theme.text}}>{ln}</span>
                </div>
                {/* 五步括号锚（半透明，不抢焦；P2 下钻位） */}
                {ANCHOR_ROWS.includes(i) ? (
                  <svg width={14} height={lineH} style={{position: 'absolute', left: -6, top: 0, overflow: 'visible', opacity: 0.55 * anchors[ANCHOR_ROWS.indexOf(i)]}}>
                    <path d="M10 2 Q3 14 10 26" fill="none" stroke={theme.core} strokeWidth={2.5} />
                  </svg>
                ) : null}
              </div>
            );
          })}
        </Panel>
      </div>

      {/* 图形等式（p1-05 题眼；纯图形不逐字复述口播）：工具方块 + 环体 → Agent 徽记 */}
      <div style={{position: 'absolute', left: 1470, top: 330, width: 360, height: 380}}>
        <div style={{position: 'absolute', left: 10, top: 40, ...eqA}}>
          <div
            style={{
              width: 110,
              height: 78,
              borderRadius: 12,
              border: `3px solid ${theme.tool}`,
              background: `${theme.tool}1A`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 19,
              color: theme.tool,
              transform: `translateX(${(1 - touch) * -14}px)`,
            }}
          >
            {'bash'}
          </div>
        </div>
        <span style={{position: 'absolute', left: 132, top: 62, fontFamily: theme.sans, fontSize: 40, color: theme.dim, opacity: eqA.opacity}}>+</span>
        <div style={{position: 'absolute', left: 178, top: 16, ...eqB}}>
          <LoopRing size={118} nodes={STATIONS} showLabels={false} showExit={false} />
        </div>
        <span style={{position: 'absolute', left: 150, top: 190, fontFamily: theme.sans, fontSize: 40, color: theme.dim, opacity: eqB.opacity}}>=</span>
        {/* Agent 徽记：迸出定格（AAS 后撤已由 touch 通道承担） */}
        <div style={{position: 'absolute', left: 88, top: 218, ...badge, opacity: badge.opacity}}>
          <div
            style={{
              width: 184,
              height: 118,
              borderRadius: 18,
              border: `3px solid ${theme.core}`,
              background: `${theme.core}14`,
              boxShadow: `0 0 ${34 * badgeGlow}px ${theme.core}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 34,
              fontWeight: 700,
              color: theme.core,
              letterSpacing: 2,
            }}
          >
            {'Agent'}
          </div>
        </div>
      </div>

      <Footnote delay={atLines}>{'while True · tool_use'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P1Solution: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p1-01');
  const bB = w('p1-02', 'p1-03');
  const bC = w('p1-04', 'p1-05');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <LoopShape
          atSpin={wa('p1-01', 0.24) - bA.from}
          atGo={wa('p1-01', 0.62) - bA.from}
          atStop={wa('p1-01', 0.88) - bA.from}
          atGate={wa('p1-01', 0.4) - bA.from}
        />
      </Sequence>

      <Sequence {...bB} name="1-B">
        <GateDuel
          scan1At={wa('p1-02', 0.55) - bB.from}
          chip1At={wa('p1-02', 0.82) - bB.from}
          pass1At={wa('p1-03', 0.12) - bB.from}
          ring1At={wa('p1-03', 0.2) - bB.from}
          scan2At={wa('p1-03', 0.55) - bB.from}
          sideAt={wa('p1-03', 0.72) - bB.from}
          exitAt={wa('p1-03', 0.88) - bB.from}
          stopAt={wa('p1-03', 0.95) - bB.from}
        />
      </Sequence>

      <Sequence {...bC} name="1-C">
        <CodeDebut
          atLines={wa('p1-04', 0.3) - bC.from}
          atCount={wa('p1-04', 0.7) - bC.from}
          atEq={wa('p1-05', 0.16) - bC.from}
          atBadge={wa('p1-05', 0.62) - bC.from}
          span={bC.durationInFrames}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1Solution;
