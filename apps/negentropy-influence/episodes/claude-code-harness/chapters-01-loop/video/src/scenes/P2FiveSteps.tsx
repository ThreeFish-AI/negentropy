/** P2 五步工作原理（p2-01..p2-12，7 镜）——分镜 2-A..2-G（storyboard v5）。
 *
 *  ★ 三联画舞台（全幕常驻）：左＝真实代码编辑器（每步源码行落定、步内高亮 core、
 *    已步行 dim——代码逐字取 pinned 源码）；右＝消息列表四格（角色色块：assistant
 *    陶土橙系 / user·tool_result 青碧系）；右上角＝环体 mini（五站位随步点亮）。
 *    每步一次三联动：代码行落定 → 消息块生长 → 环体走一格。
 *  ★ 2-A 舞台装配 + 步一（问题入列）；2-B 步二（打包流光调模型）；2-C 步三
 *    （回答存档 + 扫描检出/未检出两态 + 绿出口预亮）；2-D 步四（执行脉冲 + #01
 *    配对签）；2-E 步五（user 身份回塞 + 回流箭头 + 整圈走完）；2-F 身份解读 ECU
 *    →拉回全函数五括号全亮；2-G 分工铭牌 + 匿名方块叠环（循环不变宣示）。
 *  ★ 红线：动画时点一律句边界推导（词落位=句首+句长分数）；pathLength 描线与像素
 *    dasharray 分属不同元素；消息角色色块到 2-E 才揭示 user 语义（此前中性签）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel, SceneTag, type RingNode} from '../components/motifs';
import {DUR, useDraw, useEnter, useFlowDash, useImpulse, useProgress, usePushIn, useStagger} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const polar = (cx: number, cy: number, r: number, deg: number): {x: number; y: number} => {
  const rad = (deg * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
};

/** 五步站位（与 P1 同构；牌位文字 2–4 字） */
const STATIONS: RingNode[] = [
  {label: '进消息', angle: -90},
  {label: '调模型', angle: -18},
  {label: '查信号', angle: 54},
  {label: '执行', angle: 126},
  {label: '回塞', angle: 198},
];

/** 三联布局 */
const CODE = {x: 120, y: 210, w: 640, lineH: 30} as const;
const MSG = {x: 1392, y: 240, w: 420, slotH: 76, gap: 16} as const;
const slotTop = (i: number) => MSG.y + i * (MSG.slotH + MSG.gap);
const RING = {size: 150, x: 1680, y: 96} as const;
/** 环心（回流弧/走格用；RING 挂点几何） */
const RC = {cx: RING.x + RING.size / 2, cy: RING.y + RING.size / 2, r: RING.size / 2 - 20} as const;

/** 每步源码行（pinned 源码 verbatim，仅缩排；step 0 基） */
const STEP_CODE: {step: number; text: string}[] = [
  {step: 0, text: 'messages = [{"role": "user",'},
  {step: 0, text: '              "content": query}]'},
  {step: 1, text: 'response = client.messages.create('},
  {step: 1, text: '    model=MODEL, system=SYSTEM,'},
  {step: 1, text: '    messages=messages, tools=TOOLS,'},
  {step: 1, text: '    max_tokens=8000,)'},
  {step: 2, text: 'messages.append({"role": "assistant",'},
  {step: 2, text: '    "content": response.content})'},
  {step: 2, text: 'tool_calls = [b for b in response.content'},
  {step: 2, text: '    if b.type == "tool_use"]'},
  {step: 2, text: 'if not tool_calls: return'},
  {step: 3, text: 'output = run_bash(block.input["command"])'},
  {step: 3, text: 'results.append({"type": "tool_result",'},
  {step: 3, text: '    "tool_use_id": block.id,'},
  {step: 3, text: '    "content": output})'},
  {step: 4, text: 'messages.append({"role": "user",'},
  {step: 4, text: '    "content": results})'},
];

type MsgFill = {slot: number; role: 'user' | 'assistant' | 'tool'; label: string; at: number; accent?: string; pair?: boolean};

/** ── Stage：act 级三联舞台（代码窗 + 消息列 + 环 mini；跨镜状态累积） ── */
const Stage: React.FC<{
  /** 各步代码行落定时点（步 0..4，scene 局部帧） */
  codeAt: [number, number, number, number, number];
  /** 当前活跃步（由镜组件按帧门控传入的锚表推导，这里按 frame 比较） */
  activeStepAt: [number, number, number, number, number];
  fills: MsgFill[];
  /** 环走格锚（每步过站；2-E 整圈收尾锚） */
  lapAt?: number;
}> = ({codeAt, activeStepAt, fills, lapAt}) => {
  const frame = useCurrentFrame();
  const winIn = useEnter('slideL', {at: 0, dur: DUR.f5, dist: 40});
  const listO = useProgress(DUR.f3, DUR.f4);
  const ringO = useProgress(0, DUR.f4);
  const slots = useStagger(4, {at: 6, stride: 8, dur: DUR.f3});
  // 当前活跃步：最后一个已过的步锚
  let active = -1;
  activeStepAt.forEach((t, i) => {
    if (frame >= t) active = i;
  });
  // 代码行：本步行 reveal（stagger f3 内），历史行 dim、活跃行高亮 core
  const rowShows = STEP_CODE.map((row, i) => {
    const stepAt = codeAt[row.step];
    const idxInStep = STEP_CODE.filter((r, j) => r.step === row.step && j < i).length;
    return useProgressSafe(frame, stepAt + idxInStep * 4, DUR.f3);
  });
  // 环 mini：每步走一格（dot 随 active 前进；lapAt 起补完整圈）
  const dot =
    lapAt !== undefined && frame >= lapAt
      ? 0.1 + clamp01((frame - lapAt) / 34) * 0.9
      : Math.max(0, active) >= 0
        ? active * 0.2
        : 0;
  return (
    <>
      {/* 右上角环 mini（M-001 缩悬；五站位随步点亮） */}
      <div style={{position: 'absolute', left: RING.x, top: RING.y, opacity: 0.95 * ringO}}>
        <LoopRing
          size={RING.size}
          nodes={STATIONS}
          showLabels={false}
          showExit={false}
          dotProgress={dot}
          activeNode={active >= 0 ? active : undefined}
          activeAccent={theme.core}
          dimNodes={active >= 0}
        />
      </div>

      {/* 左：代码窗（编辑器框架 + 逐步行落定） */}
      <div style={{position: 'absolute', left: CODE.x, top: CODE.y, width: CODE.w, ...winIn}}>
        <Panel style={{boxSizing: 'border-box', padding: '14px 18px', position: 'relative'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 8}}>
            <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'code.py'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.panelBorder, marginLeft: 'auto'}}>
              {'agent_loop'}
            </span>
          </div>
          {STEP_CODE.map((row, i) => {
            const isActive = row.step === active;
            const o = rowShows[i];
            return (
              <div key={i} style={{position: 'relative', height: CODE.lineH, opacity: o}}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontFamily: theme.mono,
                    fontSize: 18.5,
                    lineHeight: `${CODE.lineH}px`,
                    whiteSpace: 'pre',
                    background: isActive ? `${theme.core}1E` : 'transparent',
                    borderLeft: isActive ? `3.5px solid ${theme.core}` : '3.5px solid transparent',
                    paddingLeft: 8,
                    borderRadius: 4,
                  }}
                >
                  <span style={{width: 20, textAlign: 'right', color: theme.panelBorder, opacity: isActive ? 1 : 0.65}}>
                    {i + 1}
                  </span>
                  <span style={{color: isActive ? theme.text : theme.dim}}>{row.text}</span>
                </div>
              </div>
            );
          })}
        </Panel>
      </div>

      {/* 右：消息列表四格 */}
      <div style={{position: 'absolute', left: MSG.x, top: MSG.y - 42, fontFamily: theme.mono, fontSize: 20, color: theme.dim, opacity: listO}}>
        {'messages'}
      </div>
      {[0, 1, 2, 3].map((i) => {
        const fill = fills.find((f) => f.slot === i);
        const shown = fill !== undefined && frame >= fill.at;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: MSG.x,
              top: slotTop(i),
              width: MSG.w,
              height: MSG.slotH,
              borderRadius: 10,
              border: `2px ${shown && fill ? 'solid' : 'dashed'} ${shown && fill ? (fill.accent ?? theme.panelBorder) : theme.panelBorder}`,
              background: shown && fill && fill.accent ? `${fill.accent}12` : 'transparent',
              opacity: slots[i] * (shown ? 1 : 0.55),
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '0 18px',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            {shown && fill ? (
              <>
                <span style={{fontFamily: theme.mono, fontSize: 17, color: fill.accent ?? theme.dim}}>{fill.role}</span>
                <span style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 600, color: theme.text}}>{fill.label}</span>
                {fill.pair ? (
                  <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginLeft: 'auto', padding: '1px 8px', borderRadius: 6, border: `1.5px solid ${theme.panelBorder}`}}>
                    {'#01'}
                  </span>
                ) : null}
              </>
            ) : (
              <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.panelBorder}}>{String(i + 1).padStart(2, '0')}</span>
            )}
          </div>
        );
      })}
    </>
  );
};

/** 无 hooks 的安全进度（Stage rowShows 内联用——hooks 数组按 STEP_CODE 恒长，合规） */
const useProgressSafe = (frame: number, at: number, dur: number): number => {
  const t = (frame - at) / Math.max(1, dur);
  return Math.min(1, Math.max(0, t));
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 2-A 括号巡指：「正好五步」词窗——代码窗左缘五枚 › 锚顺序点亮一圈（幻灯片感防治：逐个 3 帧错峰） */
const BracketSweep: React.FC<{at: number}> = ({at}) => {
  const glows = useStagger(5, {at, stride: 3, dur: DUR.f3});
  const rows = [0, 2, 6, 11, 15];
  return (
    <svg width={40} height={520} style={{position: 'absolute', left: CODE.x - 34, top: CODE.y + 34, overflow: 'visible', pointerEvents: 'none'}}>
      {rows.map((row, i) => (
        <text key={row} x={0} y={row * CODE.lineH + 20} fontFamily={theme.mono} fontSize={20} fontWeight={700} fill={theme.core} opacity={glows[i]}>
          {'⟩'}
        </text>
      ))}
    </svg>
  );
};

// ── 2-B 步二特写件：工具清单打包流光 + 模型脑 ───────────────────────────

const TOOLS = [
  {zh: '读文件', en: 'read_file'},
  {zh: '写文件', en: 'write_file'},
  {zh: '命令行', en: 'bash'},
] as const;

const BrainChip: React.FC<{litAt: number}> = ({litAt}) => {
  const enter = useProgress(2, DUR.f4);
  const lit = useImpulse({at: litAt, dur: DUR.f6});
  return (
    <div style={{position: 'absolute', left: 880, top: 130, opacity: enter}}>
      <div style={{boxShadow: `0 0 ${36 * lit}px ${theme.core}`}}>
        <Panel style={{padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12}}>
          <svg width={44} height={44} viewBox="0 0 52 52">
            <circle cx={26} cy={26} r={23} fill={theme.panel} stroke={theme.dim} strokeWidth={2.5} />
            <g fill={theme.core} opacity={0.35 + 0.65 * lit}>
              <circle cx={17} cy={19} r={3.4} />
              <circle cx={33} cy={16} r={3.4} />
              <circle cx={22} cy={34} r={3.4} />
              <circle cx={36} cy={31} r={3.4} />
            </g>
            <g stroke={theme.dim} strokeWidth={1.6} opacity={0.7}>
              <line x1={17} y1={19} x2={33} y2={16} />
              <line x1={17} y1={19} x2={22} y2={34} />
              <line x1={33} y1={16} x2={36} y2={31} />
              <line x1={22} y1={34} x2={36} y2={31} />
            </g>
          </svg>
          <div>
            <div style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{'模型'}</div>
            <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'model'}</div>
          </div>
        </Panel>
      </div>
    </div>
  );
};

const CallPack: React.FC<{cardsAt: number; packAt: number; brainAt: number}> = ({cardsAt, packAt, brainAt}) => {
  const cards = useStagger(TOOLS.length, {at: cardsAt, stride: 4, dur: DUR.f4});
  const pack = useProgress(packAt, DUR.f4);
  const flow = useFlowDash({dash: 14, gap: 18, period: 24});
  return (
    <AbsoluteFill>
      <BrainChip litAt={brainAt} />
      {/* 工具清单小卡（打包时抬升压暗——内容并入流光） */}
      {TOOLS.map((t, i) => (
        <div
          key={t.en}
          style={{
            position: 'absolute',
            left: 800,
            top: 300 + i * 58,
            width: 300,
            height: 46,
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
            padding: '0 16px',
            boxSizing: 'border-box',
            borderRadius: 10,
            border: `2px solid ${theme.panelBorder}`,
            background: theme.panel,
            opacity: cards[i] * (1 - 0.62 * pack),
            transform: `translateY(${(1 - cards[i]) * 12 - 10 * pack}px)`,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 600, color: theme.text}}>{t.zh}</span>
          <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginLeft: 'auto'}}>{t.en}</span>
        </div>
      ))}
      {/* 流光：消息列 → 掠工具卡 → 入环 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <path d={`M1380 300 C1240 330 1100 330 1000 300 C920 276 860 240 ${RC.cx + 30} ${RC.cy + 60}`} fill="none" stroke={theme.core} strokeWidth={4} strokeLinecap="round" opacity={0.5 * pack} />
        <path d={`M1380 300 C1240 330 1100 330 1000 300 C920 276 860 240 ${RC.cx + 30} ${RC.cy + 60}`} fill="none" stroke={theme.core} strokeWidth={5} strokeLinecap="round" opacity={pack} {...flow} />
      </svg>
    </AbsoluteFill>
  );
};

// ── 2-C 步三特写件：回答存档 + 扫描两态 ─────────────────────────────────

const ANS = {x: 790, y: 300, w: 520, h: 300} as const;

const ScanVerdict: React.FC<{
  ansAt: number;
  scanAt: number;
  scanDur: number;
  chipAt: number;
  emptyAt: number;
  exitPrevAt: number;
}> = ({ansAt, scanAt, scanDur, chipAt, emptyAt, exitPrevAt}) => {
  const panel = useEnter('rise', {at: ansAt, dur: DUR.f5, dist: 26, restBottom: ANS.y + ANS.h});
  const scanP = useProgress(scanAt, scanDur, 'linear');
  const chipLit = useProgress(chipAt, DUR.f3);
  const chipPulse = useImpulse({at: chipAt, dur: DUR.f5});
  const chipO = useProgress(chipAt, DUR.f3) * (1 - useProgress(emptyAt, DUR.f3));
  // 未检出态（p2-05 词窗）：空缺一拍 + 出口绿光预亮（绿=确认色首次亮相，P3 正门前情）
  const vacPulse = useImpulse({at: emptyAt, dur: DUR.f6, peak: 0.07});
  const exitO = useProgress(exitPrevAt, DUR.f4);
  const exitGlow = useImpulse({at: exitPrevAt, dur: DUR.f6});
  const scanX = ANS.x + 26 + scanP * (ANS.w - 60);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: ANS.x, top: ANS.y, ...panel}}>
        <Panel style={{width: ANS.w, boxSizing: 'border-box', padding: 18, minHeight: ANS.h, position: 'relative'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
            <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'assistant'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.text}}>{'回答'}</span>
          </div>
          <div style={{height: 13, borderRadius: 6, background: theme.panelBorder, width: 380, marginTop: 20, opacity: 0.55}} />
          <div style={{height: 13, borderRadius: 6, background: theme.panelBorder, width: 290, marginTop: 13, opacity: 0.55}} />
          {/* 检出态：tool_use 调用块（扫描扫到才亮）；未检出态同位虚线空框 + 脉一拍 */}
          <div
            style={{
              marginTop: 18,
              width: 240,
              height: 58,
              boxSizing: 'border-box',
              borderRadius: 8,
              border: `2.5px solid ${chipLit > 0.5 ? theme.tool : theme.panelBorder}`,
              background: chipLit > 0.5 ? `${theme.tool}26` : 'transparent',
              boxShadow: `0 0 ${30 * chipPulse}px ${theme.tool}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 12px',
              transform: `scale(${1 + 0.06 * chipPulse + vacPulse})`,
              opacity: chipLit > 0.5 ? 1 : 0.85,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 15, color: chipLit > 0.5 ? theme.tool : theme.dim}}>{'tool_use'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 600, color: chipLit > 0.5 ? theme.text : theme.dim}}>
              {chipLit > 0.5 ? '工具调用' : '∅'}
            </span>
          </div>
          <div style={{height: 13, borderRadius: 6, background: theme.panelBorder, width: 210, marginTop: 18, opacity: 0.55}} />
        </Panel>
      </div>
      {/* 扫描线：单向一次（线性=机器语义豁免） */}
      {scanP > 0 && scanP < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: scanX,
            top: ANS.y + 22,
            width: 3,
            height: ANS.h - 44,
            borderRadius: 2,
            background: theme.text,
            boxShadow: `0 0 14px ${theme.text}`,
          }}
        />
      ) : null}
      {/* 出口绿光预亮（p2-05「循环就此退出」词位；P3 正门开启的视觉前情） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <g opacity={exitO}>
          <line x1={1330} y1={RC.cy} x2={1392} y2={RC.cy} stroke={theme.ok} strokeWidth={3} strokeDasharray="6 8" />
          <circle cx={1424} cy={RC.cy} r={13 + 10 * exitGlow} fill="none" stroke={theme.ok} strokeWidth={3.5} opacity={0.85} />
          <text x={1424} y={RC.cy - 30} textAnchor="middle" fontFamily={theme.mono} fontSize={17} fill={theme.ok}>
            {'exit'}
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

// ── 2-D 步四特写件：执行脉冲 + #01 配对 ─────────────────────────────────

const BAY = {x: 850, y: 660, w: 300, h: 104} as const;

const ExecPair: React.FC<{callAt: number; paramAt: number; pulseAt: number; resultAt: number}> = ({
  callAt,
  paramAt,
  pulseAt,
  resultAt,
}) => {
  const call = useEnter('pop', {at: callAt, dur: DUR.f4});
  const paramO = useProgress(paramAt, DUR.f3);
  const pulse = useImpulse({at: pulseAt, dur: DUR.f6});
  const corners = 'M2 26 V2 H26 M272 2 H298 V26 M298 78 V102 H274 M26 102 H2 V78';
  const result = useEnter('pop', {at: resultAt, dur: DUR.f4});
  const PairTag: React.FC = () => (
    <span
      style={{
        position: 'absolute',
        top: -12,
        right: -10,
        fontFamily: theme.mono,
        fontSize: 13,
        color: theme.dim,
        padding: '1px 6px',
        borderRadius: 6,
        border: `1.5px solid ${theme.panelBorder}`,
        background: theme.panel,
      }}
    >
      {'#01'}
    </span>
  );
  return (
    <AbsoluteFill>
      {/* 调用块（携参数签）→ 执行位 */}
      <div style={{position: 'absolute', left: 900, top: 480, ...call}}>
        <div style={{position: 'relative'}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              padding: '10px 16px',
              borderRadius: 10,
              border: `2.5px solid ${theme.tool}`,
              background: `${theme.tool}26`,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.tool}}>{'tool_use'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 600, color: theme.text}}>{'调用'}</span>
          </div>
          <PairTag />
          <div
            style={{
              position: 'absolute',
              left: '100%',
              top: 6,
              marginLeft: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              borderRadius: 8,
              border: `1.5px solid ${theme.panelBorder}`,
              background: theme.panel,
              opacity: paramO,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 15, color: theme.dim}}>{'参数'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'input'}</span>
          </div>
        </div>
      </div>
      {/* 执行位（脉冲一闪；输出滚出由 Footnote/消息列承接） */}
      <div style={{position: 'absolute', left: BAY.x, top: BAY.y, width: BAY.w, height: BAY.h}}>
        <svg width={BAY.w} height={BAY.h} style={{position: 'absolute', left: 0, top: 0}}>
          <path d={corners} fill="none" stroke={theme.panelBorder} strokeWidth={3} strokeLinecap="round" />
          <path d={corners} fill="none" stroke={theme.tool} strokeWidth={4} strokeLinecap="round" opacity={pulse} />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 600, color: theme.text, textShadow: `0 0 ${22 * pulse}px ${theme.tool}`}}>
            {'执行'}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'run_bash'}</div>
        </div>
      </div>
      {/* 结果条（同 #01 签；2-E 回塞承接） */}
      <div style={{position: 'absolute', left: 900, top: 810, ...result}}>
        <div style={{position: 'relative'}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              padding: '9px 16px',
              borderRadius: 11,
              border: `2.5px solid ${theme.tool}`,
              background: `${theme.tool}26`,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 600, color: theme.text}}>{'工具结果'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.tool}}>{'tool_result'}</span>
          </div>
          <PairTag />
        </div>
      </div>
      <Footnote delay={4}>{'run_bash · tool_use_id'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-E 步五回塞（p2-08）：user 身份 + 回流箭头 + 整圈 ──────────────────

const RoleReveal: React.FC<{flashA: number; flashB: number; arrowAt: number; lapAt: number}> = ({
  flashA,
  flashB,
  arrowAt,
  lapAt,
}) => {
  const a = useImpulse({at: flashA, dur: DUR.f5, peak: 0.9});
  const b = useImpulse({at: flashB, dur: DUR.f6, peak: 1.7});
  const flash = Math.max(a, b);
  const arrow = useDraw(arrowAt, DUR.f5);
  const lapGlow = useImpulse({at: lapAt + 20, dur: DUR.f6});
  return (
    <AbsoluteFill>
      {/* 角色标签对比（ECU：两行居中放大；user 行第二闪加重） */}
      <div style={{position: 'absolute', left: 700, top: 380, display: 'flex', flexDirection: 'column', gap: 34}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 28}}>
          <div style={{width: 72, height: 72, borderRadius: 16, background: theme.core, boxShadow: `0 0 ${34 * a}px ${theme.core}`, transform: `scale(${1 + 0.07 * a})`}} />
          <div>
            <span style={{fontFamily: theme.mono, fontSize: 23, color: theme.dim}}>{'assistant'}</span>
            <div style={{fontFamily: theme.sans, fontSize: 50, fontWeight: 700, color: theme.text}}>{'我要调工具'}</div>
          </div>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 28}}>
          <div style={{width: 72, height: 72, borderRadius: 16, background: theme.tool, boxShadow: `0 0 ${40 * b}px ${theme.tool}`, transform: `scale(${1 + 0.08 * b})`}} />
          <div>
            <span style={{fontFamily: theme.mono, fontSize: 23, color: theme.dim}}>{'user · tool_result'}</span>
            <div style={{fontFamily: theme.sans, fontSize: 50, fontWeight: 700, color: theme.text}}>{'这是你要的结果'}</div>
          </div>
        </div>
      </div>
      {/* 回流箭头：自消息列弯回环 mini 步二站位（「回到第二步」词位接通） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <path
          d={`M1392 ${slotTop(2) + MSG.slotH / 2} C1240 ${slotTop(2) + 180} 1080 ${RC.cy + 180} ${RC.cx} ${RC.cy + RC.r}`}
          fill="none"
          stroke={theme.core}
          strokeWidth={4}
          strokeLinecap="round"
          {...arrow}
        />
        <circle cx={RC.cx} cy={RC.cy} r={RC.r} fill="none" stroke={theme.core} strokeWidth={7} opacity={0.6 * lapGlow} />
      </svg>
      <Footnote delay={6}>{'role: user'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-F/2-G 收束件 ──────────────────────────────────────────────────────

/** 2-F 前半：身份解读细线——自消息列指向「对话输入侧」空槽容器（落点是容器不是悬空字） */
const InputSlotLine: React.FC<{at: number}> = ({at}) => {
  const line = useDraw(at, DUR.f5);
  const slotO = useProgress(at + DUR.f4, DUR.f4);
  return (
    <>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <path d="M1660 640 L1560 730" fill="none" stroke={theme.dim} strokeWidth={3} {...line} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 1448,
          top: 714,
          width: 118,
          height: 42,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          border: `2px dashed ${theme.dim}`,
          fontFamily: theme.mono,
          fontSize: 18,
          color: theme.dim,
          opacity: 0.55 * slotO,
        }}
      >
        {'输入'}
      </div>
    </>
  );
};

/** 五括号全亮的全函数缩览（2-F 后半；P1-C 的回照） */
const AnchorsAll: React.FC<{at: number; stepRows: number[]}> = ({at, stepRows}) => {
  const enter = useProgress(at, DUR.f4);
  const glows = useStagger(stepRows.length, {at: at + 4, stride: 4, dur: DUR.f3});
  return (
    <div style={{position: 'absolute', left: 460, top: 170, width: 1000, opacity: enter}}>
      <Panel style={{padding: '16px 22px'}}>
        {STEP_CODE.map((row, i) => (
          <div key={i} style={{position: 'relative', height: 24, display: 'flex', alignItems: 'center'}}>
            <span
              style={{
                position: 'absolute',
                left: -10,
                top: 0,
                height: 24,
                fontFamily: theme.mono,
                fontSize: 15,
                color: theme.core,
                opacity: stepRows.includes(i) ? glows[stepRows.indexOf(i)] : 0,
                fontWeight: 700,
              }}
            >
              {'⟩'}
            </span>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 15.5,
                lineHeight: '24px',
                whiteSpace: 'pre',
                color: stepRows.includes(i) ? theme.text : theme.dim,
                opacity: stepRows.includes(i) ? glows[stepRows.indexOf(i)] * 0.7 + 0.3 : 0.6,
              }}
            >
              {row.text}
            </span>
          </div>
        ))}
      </Panel>
    </div>
  );
};

const WrapUp: React.FC<{plateA: number; plateB: number; chipsAt: number; pulseAt: number}> = ({
  plateA,
  plateB,
  chipsAt,
  pulseAt,
}) => {
  // @pushIn 负增量：把五步收束为全局分工定理（变换原点钉在环心）
  const push = usePushIn(0, {scale: -0.05, dur: DUR.f6});
  const plateAe = useEnter('pop', {at: plateA, dur: DUR.f5, springPreset: 'settle'});
  const plateBe = useEnter('pop', {at: plateB, dur: DUR.f5, springPreset: 'settle'});
  const chips = useStagger(5, {at: chipsAt, stride: 5, dur: DUR.f4});
  // 「循环本身始终不变」词位：环体本体一次确认绿描边脉冲（环上唯一绿——恒定宣示）
  const greenPulse = useImpulse({at: pulseAt, dur: DUR.f6});
  const CX = 960;
  const CY = 470;
  const R = 210;
  return (
    <AbsoluteFill style={{transform: push, transformOrigin: '960px 470px'}}>
      {/* 环体居中放大（M-001 主角；五站位全亮） */}
      <div style={{position: 'absolute', left: CX - 260, top: CY - 260}}>
        <LoopRing size={520} nodes={STATIONS} showLabels={false} showExit={false} />
      </div>
      {/* 匿名小方块叠环外缘（后续章节意象：无名无序号；环体描边线宽纹丝不动） */}
      {[0, 1, 2, 3, 4].map((i) => {
        const p = polar(CX, CY, R + 52, -50 + i * 46);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.x - 17,
              top: p.y - 17,
              width: 34,
              height: 34,
              borderRadius: 8,
              border: `2.5px solid ${theme.panelBorder}`,
              background: theme.panel,
              opacity: chips[i] * 0.9,
              transform: `translateY(${(1 - chips[i]) * 14}px)`,
            }}
          />
        );
      })}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        {/* 恒定宣示：确认绿描边脉冲一拍（唯一落在环体上的绿） */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={theme.ok} strokeWidth={5} opacity={0.85 * greenPulse} />
      </svg>
      {/* 分工铭牌（两行随词落定） */}
      <div style={{position: 'absolute', left: 0, top: 770, width: 1920, textAlign: 'center', ...plateAe}}>
        <span style={{display: 'inline-flex', alignItems: 'center', gap: 16}}>
          <span style={{width: 18, height: 18, borderRadius: 5, background: theme.core}} />
          <span style={{fontFamily: theme.sans, fontSize: 42, fontWeight: 700, color: theme.text}}>{'模型 = 决策'}</span>
        </span>
      </div>
      <div style={{position: 'absolute', left: 0, top: 840, width: 1920, textAlign: 'center', ...plateBe}}>
        <span style={{display: 'inline-flex', alignItems: 'center', gap: 16}}>
          <span style={{width: 18, height: 18, borderRadius: 5, background: theme.tool}} />
          <span style={{fontFamily: theme.sans, fontSize: 42, fontWeight: 700, color: theme.text}}>{'程序 = 执行'}</span>
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P2FiveSteps: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p2-01', 'p2-02');
  const bB = w('p2-03');
  const bC = w('p2-04', 'p2-05');
  const bD = w('p2-06', 'p2-07');
  const bE = w('p2-08');
  const bF = w('p2-09', 'p2-10');
  const bG = w('p2-11', 'p2-12');

  // 各步代码行落定 + 站位过站锚（scene 局部）
  const stepAt: [number, number, number, number, number] = [
    wa('p2-02', 0.42),
    at('p2-03') + 4,
    wa('p2-04', 0.18),
    at('p2-06') + 4,
    wa('p2-08', 0.24),
  ];
  // 消息格填充锚
  const fill0 = wa('p2-02', 0.55);
  const fill1 = wa('p2-04', 0.3);
  const fill2 = wa('p2-08', 0.62);
  // 步三扫描窗与两态
  const scanAt = wa('p2-04', 0.55);
  const scanDur = Math.round(dur('p2-04') * 0.26);
  const chipAt = scanAt + Math.round(scanDur * 0.62);
  const emptyAt = wa('p2-05', 0.24);
  const exitPrevAt = wa('p2-05', 0.62);
  // 步四/步五锚
  const paramAt = wa('p2-06', 0.4);
  const pulseAt = wa('p2-06', 0.78);
  const resultAt = wa('p2-07', 0.72);
  const flashA = Math.round(dur('p2-08') * 0.42);
  const flashB = wa('p2-08', 0.66) - bE.from;
  const arrowAt = wa('p2-08', 0.85) - bE.from;
  // 2-F：身份解读线锚（句内）+ 全函数括号全亮锚
  const lineAt = wa('p2-09', 0.55);
  const anchorsAt = wa('p2-10', 0.42);
  // 2-G
  const plateA = wa('p2-11', 0.42);
  const plateB = wa('p2-11', 0.78);
  const chipsAt = wa('p2-12', 0.36);
  const pulseAtG = wa('p2-12', 0.72);

  return (
    <AbsoluteFill>
      <SceneTag chapter="工作原理" tagline="五步 · 三十行" accent={theme.core} />
      <Stage
        codeAt={stepAt}
        activeStepAt={[wa('p2-02', 0.42), at('p2-03') + 4, wa('p2-04', 0.18), at('p2-06') + 4, wa('p2-08', 0.24)]}
        lapAt={arrowAt + bE.from}
        fills={[
          {slot: 0, role: 'user', label: '问题', at: fill0},
          {slot: 1, role: 'assistant', label: '回答 · 调用', at: fill1, accent: theme.core, pair: true},
          {slot: 2, role: 'user', label: '工具结果', at: fill2, accent: theme.tool, pair: true},
        ]}
      />

      <Sequence {...bA} name="2-A 舞台+步一">
        <BracketSweep at={wa('p2-01', 0.5) - bA.from} />
        <Footnote delay={10}>{'messages[0]'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="2-B 步二">
        <CallPack
          cardsAt={wa('p2-03', 0.4) - bB.from}
          packAt={wa('p2-03', 0.62) - bB.from}
          brainAt={wa('p2-03', 0.88) - bB.from}
        />
      </Sequence>

      <Sequence {...bC} name="2-C 步三">
        <ScanVerdict
          ansAt={wa('p2-04', 0.1) - bC.from}
          scanAt={scanAt - bC.from}
          scanDur={scanDur}
          chipAt={chipAt - bC.from}
          emptyAt={emptyAt - bC.from}
          exitPrevAt={exitPrevAt - bC.from}
        />
      </Sequence>

      <Sequence {...bD} name="2-D 步四">
        <ExecPair
          callAt={wa('p2-06', 0.14) - bD.from}
          paramAt={paramAt - bD.from}
          pulseAt={pulseAt - bD.from}
          resultAt={resultAt - bD.from}
        />
      </Sequence>

      <Sequence {...bE} name="2-E 步五">
        <RoleReveal flashA={flashA} flashB={flashB} arrowAt={arrowAt} lapAt={bE.durationInFrames} />
      </Sequence>

      <Sequence {...bF} name="2-F 身份与组装">
        <InputSlotLine at={lineAt - bF.from} />
        <AnchorsAll at={anchorsAt - bF.from} stepRows={[0, 2, 6, 11, 15]} />
        <Footnote delay={4}>{'tool_use · tool_result'}</Footnote>
      </Sequence>

      <Sequence {...bG} name="2-G 分工与不变">
        <WrapUp plateA={plateA - bG.from} plateB={plateB - bG.from} chipsAt={chipsAt - bG.from} pulseAt={pulseAtG - bG.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2FiveSteps;
