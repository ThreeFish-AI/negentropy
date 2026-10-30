/** P2 一次往返（p2-01..p2-09，4 镜）——分镜 2-A…2-D：购物清单走查（Animated Worked Example）。
 *
 *  叙事链：走查舞台全景（指令气泡入首格）→ 第一轮「写文件」（参数签 → 执行脉冲 →
 *  清单长出「牛奶」→ 结果回喂第二格）→ 第二轮「读文件」同构重复（节奏加快、方向反转）
 *  → 第三轮纯文本回答（调用位显式空缺）→ 出口门开启（确认绿）→ 环体停转 →
 *  「3 调用 / 2 执行」计数定格 + 三决策点回放闪。
 *
 *  空间契约（四镜同构，不为求变化改布局）：
 *  - 左：购物清单卡（list.txt）；中：回答条工作区（调用块 + 参数签）；
 *    右：消息列表五格（01..05 线性排开，当前格高亮唯一）。
 *  - 环体缩小悬于右上角保持同形〔M-001〕（LoopRing 小尺寸 + showLabels=false，
 *    act 级单实例驱动 → 巡游跨镜不断相，2-D 出口后冻结即「停转」）。
 *  - 舞台（清单卡/消息格/环体/门/计数）挂在 act 级 Stage 上、由句锚推进——
 *    镜 Sequence 只承载中央工作区（回答条/脉冲/结果条），跨镜状态不丢。
 *  - 牛奶 token 全程同一高亮样式（Milk 组件：白底高亮，不占用任何概念色）贯穿
 *    指令气泡 → 参数签 → 清单行 → 读结果格 → 末轮回答。
 *  - 色彩语义：core=环体/assistant、tool=执行面与调用块、theme.ok=出口门
 *    （2-D 唯一绿色元素）；user 走中性 dim。
 */
import React from 'react';
import {AbsoluteFill, Sequence, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel, SceneTag, type RingNode} from '../components/motifs';
import {DUR, useCount, useDraw, useEnter, useImpulse, useProgress, useSpring, useStagger} from '../motion';

// ── 几何（四镜共用；顶部 y<56 归 frozen ChapterProgress，底部 150 归字幕带）──

/** 环体：右上角同形缩悬（M-001 不消失） */
const RING = {size: 160, x: 1642, y: 82} as const;
/** 巡游节律：2.5s/圈（全片同值） */
const RING_LAP = 75;
/** 本集环体五站（P1 五步同构；小尺寸下不渲染文案，仅保站形） */
const PENT_NODES: RingNode[] = [0, 1, 2, 3, 4].map((i) => ({label: `s${i + 1}`, angle: -90 + i * 72}));

/** 左：购物清单卡 */
const LIST = {x: 150, y: 330, w: 430} as const;
/** 右：消息列表五格 */
const MSG = {x: 1310, y: 300, w: 480, h: 72, gap: 14} as const;
const slotTop = (i: number) => MSG.y + i * (MSG.h + MSG.gap);
const slotCenter = (i: number) => ({x: MSG.x + MSG.w / 2, y: slotTop(i) + MSG.h / 2});
/** 中：回答条工作区 */
const STRIP = {x: 640, y: 310, w: 610} as const;
/** 执行脉冲走线（write 自调用块向清单；read 反向） */
const EXEC_LINE = {
  write: {from: {x: 800, y: 512}, to: {x: 390, y: 452}},
  read: {from: {x: 390, y: 452}, to: {x: 800, y: 512}},
} as const;
/** 结果条起飞点（工作区下方） */
const PILL_FROM = {x: 950, y: 585} as const;

// ── 通用件 ────────────────────────────────────────────────────────────────

/** 牛奶 token：全程同一高亮样式（白底高亮——不占用 core/tool/warn/ok 概念色） */
const Milk: React.FC = () => (
  <span
    style={{
      fontFamily: theme.sans,
      fontWeight: 700,
      fontSize: 25,
      color: theme.text,
      background: `${theme.text}26`,
      borderRadius: 6,
      padding: '2px 10px',
      whiteSpace: 'nowrap',
    }}
  >
    {'牛奶'}
  </span>
);

/** 消息角色（P1 1-E 角色色块的延续：assistant=core / tool=tool / user=中性） */
const ROLE = {
  user: {color: theme.dim, tag: 'user'},
  assistant: {color: theme.core, tag: 'assistant'},
  tool: {color: theme.tool, tag: 'tool'},
} as const;
type RoleKey = keyof typeof ROLE;

const RoleTag: React.FC<{k: RoleKey}> = ({k}) => (
  <span style={{fontFamily: theme.mono, fontSize: 18, color: ROLE[k].color, whiteSpace: 'nowrap'}}>
    {ROLE[k].tag}
  </span>
);

/** 五格的既定内容（回填后单行；slot5 恒空——循环已出口，不跳格不双亮） */
const SLOT_CONTENT: {role: RoleKey; node: React.ReactNode}[] = [
  {role: 'user', node: <>{'+ '}
    <Milk />
    {' · 朗读'}</>},
  {role: 'tool', node: <>{'写入 ✓'}</>},
  {role: 'tool', node: <>{'读出 · '}
    <Milk /></>},
  {role: 'assistant', node: <>{'纯文本 · '}
    <Milk /></>},
];

// ── Stage：act 级舞台（清单卡 + 消息格 + 环体 + 出口门 + 计数角标）─────────

type StageProps = {
  /** 幕总长（act 局部帧；巡游上限推导） */
  span: number;
  /** 清单卡角标「+ 牛奶 · 朗读」（p2-02「念给我听」词落位） */
  atTag: number;
  /** 清单长出「牛奶」行（p2-04「清单多了一行牛奶」词落位） */
  atRow: number;
  /** 读脉冲扫过清单行（= 2-C 执行锚，ToolRound 同源传入） */
  atScan: number;
  /** 四格回填时点（act 局部帧） */
  fillAt: [number, number, number, number];
  /** 各格成为「当前格」的时点（镜界切换，高亮唯一） */
  activeFrom: [number, number, number, number];
  /** 出口门开启（p2-07「循环退出」词落位，确认绿） */
  atGate: number;
  /** 环体停转（dot 冻结） */
  atStop: number;
  /** 计数角标（p2-09 重音） */
  atCounter: number;
  /** 三决策点回放闪（消息格上各闪一次） */
  flashAt: [number, number, number];
};

const Stage: React.FC<StageProps> = ({span, atTag, atRow, atScan, fillAt, activeFrom, atGate, atStop, atCounter, flashAt}) => {
  const frame = useCurrentFrame();
  const card = useEnter('slideL', {at: 0, dur: DUR.f5, dist: 36});
  const slots = useStagger(5, {at: 4, stride: 3, dur: DUR.f3});
  const ringO = useProgress(0, DUR.f5);
  const tag = useEnter('pop', {at: atTag, dur: DUR.f4});
  const rowIn = useSpring('settle', {at: atRow, dur: DUR.f5});
  const rowO = useProgress(atRow, DUR.f3);
  const sweep = useProgress(atScan, DUR.f5, 'decelerate');
  const rowGlow = useImpulse({at: atScan, dur: DUR.f6});
  // 三次回放闪：sin 包络（起于 0 归于 0），只叠亮、不改既定内容
  const flash = [0, 1, 2].map((k) =>
    interpolate(frame, [flashAt[k], flashAt[k] + 3, flashAt[k] + 16], [0, 1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );

  // 当前格：activeFrom 中最后一个已过时点（高亮唯一、不跳格）
  let activeIdx = -1;
  activeFrom.forEach((t, i) => {
    if (frame >= t) activeIdx = i;
  });

  return (
    <>
      {/* 右上角环体（M-001 同形缩悬；巡游 act 级驱动跨镜不断相，atStop 起冻结=停转） */}
      <div style={{position: 'absolute', left: RING.x, top: RING.y, opacity: ringO}}>
        <LoopRing
          size={RING.size}
          dotProgress={((Math.min(frame / RING_LAP, atStop / RING_LAP) % 1) + 1) % 1}
          nodes={PENT_NODES}
          showLabels={false}
          showExit={false}
        />
      </div>
      <ExitGate at={atGate} />
      <CounterBadge at={atCounter} />

      {/* 消息列表标签 */}
      <div
        style={{
          position: 'absolute',
          left: MSG.x,
          top: MSG.y - 38,
          fontFamily: theme.mono,
          fontSize: 20,
          color: theme.dim,
          letterSpacing: 1,
          opacity: slots[0],
        }}
      >
        {'messages'}
      </div>

      {/* 五格（等宽单行；slot5 恒暗态） */}
      {[0, 1, 2, 3, 4].map((i) => {
        const c = SLOT_CONTENT[i];
        const filled = c !== undefined && frame >= fillAt[i];
        const fillO =
          c !== undefined
            ? interpolate(frame, [fillAt[i], fillAt[i] + DUR.f3], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })
            : 0;
        const active = i === activeIdx;
        const color = c ? ROLE[c.role].color : theme.panelBorder;
        const g = c && i >= 1 && i <= 3 ? flash[i - 1] : 0;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: MSG.x,
              top: slotTop(i),
              width: MSG.w,
              height: MSG.h,
              opacity: slots[i],
              transform: `translateY(${(1 - slots[i]) * 14}px)`,
            }}
          >
            <div
              style={{
                height: '100%',
                boxSizing: 'border-box',
                borderRadius: 10,
                border: `2px ${filled ? 'solid' : 'dashed'} ${active || filled ? color : theme.panelBorder}`,
                background: filled ? `${color}14` : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '0 18px',
                boxShadow: active ? `0 0 16px ${color}44` : 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 22, color: active ? color : theme.dim}}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {filled && c ? (
                <span style={{display: 'flex', alignItems: 'center', gap: 12, opacity: fillO}}>
                  <RoleTag k={c.role} />
                  <span style={{fontFamily: theme.sans, fontSize: 25, color: theme.text, display: 'flex', alignItems: 'center'}}>
                    {c.node}
                  </span>
                </span>
              ) : null}
            </div>
            {/* 回放闪：只叠一圈角色色辉光 */}
            {g > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  inset: -4,
                  borderRadius: 13,
                  border: `3px solid ${color}`,
                  boxShadow: `0 0 ${22 * g}px ${color}`,
                  opacity: g,
                  pointerEvents: 'none',
                }}
              />
            ) : null}
          </div>
        );
      })}

      {/* 左：购物清单卡 */}
      <div style={{position: 'absolute', left: LIST.x, top: LIST.y, width: LIST.w, ...card}}>
        <Panel style={{padding: '18px 22px', position: 'relative'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
            <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.text}}>{'购物清单'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'list.txt'}</span>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16}}>
            {/* 牛奶行（写入结果；2-C 读脉冲扫过它） */}
            <div style={{opacity: rowO, transform: `translateY(${(1 - rowIn) * 18}px)`, position: 'relative'}}>
              <div
                style={{
                  height: 56,
                  boxSizing: 'border-box',
                  borderRadius: 8,
                  border: `2px solid ${theme.tool}66`,
                  background: `${theme.tool}12`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '0 14px',
                  boxShadow: `0 0 ${18 * rowGlow}px ${theme.tool}55`,
                }}
              >
                <div style={{width: 24, height: 24, borderRadius: 5, border: `2px solid ${theme.tool}`}} />
                <Milk />
              </div>
              {/* 扫掠光带：读脉冲的单向扫描（仅扫程中可见） */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 64,
                  borderRadius: 8,
                  background: `linear-gradient(90deg, transparent, ${theme.tool}40, transparent)`,
                  transform: `translateX(${sweep * (LIST.w - 92)}px)`,
                  opacity: sweep > 0 && sweep < 1 ? 1 : 0,
                }}
              />
            </div>
            {/* 暗态占位行（保卡高恒定） ×2 */}
            {[0, 1].map((k) => (
              <div
                key={k}
                style={{
                  height: 56,
                  borderRadius: 8,
                  border: `2px dashed ${theme.panelBorder}`,
                  opacity: 0.5,
                }}
              />
            ))}
          </div>
        </Panel>
        {/* 角标：任务关键词（p2-02「念给我听」词落位贴上；恒驻全幕） */}
        <div style={{position: 'absolute', top: -26, right: -12, ...tag}}>
          <Panel
            accent={theme.text}
            style={{padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, background: theme.bg}}
          >
            <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text, display: 'flex', alignItems: 'center'}}>
              {'+ '}
              <Milk />
              {' · 朗读'}
            </span>
          </Panel>
        </div>
      </div>
    </>
  );
};

/** 出口门（2-D 唯一绿色元素：theme.ok）——环体右缘引线 + 对开门开启 + 「出口」 */
const ExitGate: React.FC<{at: number}> = ({at}) => {
  const lead = Math.max(0, at - DUR.f3);
  const line = useDraw(lead, DUR.f4);
  const o = useProgress(lead, DUR.f3);
  const open = useProgress(at, DUR.f5, 'decelerate');
  const ang = 78 * open;
  return (
    <div style={{position: 'absolute', left: 1756, top: 112, opacity: o}}>
      <svg width={160} height={100} style={{overflow: 'visible'}}>
        {/* 引线：自环缘至门（pathLength 归一化描线，红线三：不与像素 dasharray 混用） */}
        <line x1={0} y1={50} x2={44} y2={50} stroke={theme.ok} strokeWidth={3} {...line} />
        {/* 门柱 */}
        <line x1={48} y1={16} x2={48} y2={84} stroke={theme.ok} strokeWidth={3} />
        <line x1={116} y1={16} x2={116} y2={84} stroke={theme.ok} strokeWidth={3} />
        {/* 对开门：外开（左门绕左铰链、右门绕右铰链） */}
        <rect x={50} y={24} width={24} height={52} fill="none" stroke={theme.ok} strokeWidth={3} transform={`rotate(${-ang} 50 50)`} />
        <rect x={90} y={24} width={24} height={52} fill="none" stroke={theme.ok} strokeWidth={3} transform={`rotate(${ang} 116 50)`} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 34,
          top: -26,
          fontFamily: theme.sans,
          fontSize: 22,
          fontWeight: 600,
          color: theme.ok,
          opacity: open,
          whiteSpace: 'nowrap',
        }}
      >
        {'出口'}
      </div>
    </div>
  );
};

/** 底部计数角标：「3 调用 / 2 执行」递增定格（p2-09 重音） */
const CounterBadge: React.FC<{at: number}> = ({at}) => {
  const enter = useEnter('rise', {at, dur: DUR.f4, restBottom: 858, dist: 24});
  const calls = useCount({to: 3, at: at + 2, dur: DUR.f6});
  const execs = useCount({to: 2, at: at + 2, dur: DUR.f6});
  // 定格重音：计数落定后整枚角标弹一拍（sin 包络，不过冲）
  const stamp = useImpulse({at: at + DUR.f4 + DUR.f6, dur: DUR.f6, peak: 0.08});
  const num: React.CSSProperties = {fontFamily: theme.mono, fontSize: 32, fontWeight: 700, color: theme.text};
  const lab: React.CSSProperties = {fontFamily: theme.sans, fontSize: 24, color: theme.dim};
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 170, display: 'flex', justifyContent: 'center', ...enter}}>
      <Panel
        accent={theme.core}
        style={{
          padding: '10px 26px',
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          transform: `scale(${1 + stamp})`,
        }}
      >
        <span style={num}>{Math.round(calls)}</span>
        <span style={lab}>{'调用'}</span>
        <span style={{...lab, opacity: 0.6}}>{'/'}</span>
        <span style={num}>{Math.round(execs)}</span>
        <span style={lab}>{'执行'}</span>
      </Panel>
    </div>
  );
};

// ── 2-A：指令气泡落入首格 ────────────────────────────────────────────────

const ShotA: React.FC<{atBubble: number; atFill: number}> = ({atBubble, atFill}) => {
  const frame = useCurrentFrame();
  const drop = useSpring('settle', {at: atBubble, dur: DUR.f5});
  const o = useProgress(atBubble, DUR.f4);
  // 落定后让位给格内内容（首格回填同锚淡入）
  const gone = interpolate(frame, [atFill - 2, atFill + 4], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: slotCenter(0).x,
          top: slotCenter(0).y - 27,
          transform: `translate(-50%, ${(1 - drop) * -60}px)`,
          opacity: o * gone,
        }}
      >
        <Panel style={{padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10, background: theme.bg}}>
          <RoleTag k="user" />
          <span style={{fontFamily: theme.sans, fontSize: 25, color: theme.text, display: 'flex', alignItems: 'center'}}>
            {'+ '}
            <Milk />
            {' · 朗读'}
          </span>
        </Panel>
      </div>
      <Footnote delay={10}>{'list.txt · messages[0..4]'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-B / 2-C：两轮同构（差异仅调用类型与方向、节奏档）──────────────────

type RoundProps = {
  round: string;
  callZh: string;
  callEn: string;
  params: {k: string; v?: string; milk?: boolean}[];
  mode: 'write' | 'read';
  atStrip: number;
  atCall: number;
  atParam: number;
  atExec: number;
  atFeed: number;
  /** 回喂目标格（0 基） */
  slotIdx: number;
  pillNode: React.ReactNode;
  /** 2-C 加快档：入场/飞行缩一档 */
  fast?: boolean;
  foot: string;
};

const ToolRound: React.FC<RoundProps> = ({round, callZh, callEn, params, mode, atStrip, atCall, atParam, atExec, atFeed, slotIdx, pillNode, fast, foot}) => {
  const frame = useCurrentFrame();
  const strip = useEnter('rise', {at: atStrip, dur: DUR.f4, restBottom: 560});
  const call = useEnter('pop', {at: atCall, dur: DUR.f4});
  const tags = useStagger(params.length, {at: atParam, stride: DUR.f2, dur: DUR.f3});
  const pulse = useProgress(atExec, DUR.f5, 'decelerate');
  const hit = useImpulse({at: atExec + DUR.f5, dur: DUR.f6});
  const pill = useEnter('pop', {at: atFeed, dur: DUR.f3});
  const fly = useSpring('settle', {at: atFeed + DUR.f3, dur: fast ? DUR.f4 : DUR.f5});
  const arrive = atFeed + DUR.f3 + (fast ? DUR.f4 : DUR.f5);
  const gone = interpolate(frame, [arrive - 1, arrive + 3], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const ln = EXEC_LINE[mode];
  const dot = {x: ln.from.x + (ln.to.x - ln.from.x) * pulse, y: ln.from.y + (ln.to.y - ln.from.y) * pulse};
  const tgt = slotCenter(slotIdx);
  const px = PILL_FROM.x + (tgt.x - PILL_FROM.x) * fly;
  const py = PILL_FROM.y + (tgt.y - PILL_FROM.y) * fly;

  return (
    <AbsoluteFill>
      {/* 回答条（角色 assistant；调用块 tool 青为条内唯一执行面元素） */}
      <div style={{position: 'absolute', left: STRIP.x, top: STRIP.y, width: STRIP.w, ...strip}}>
        <Panel style={{padding: '16px 22px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <div style={{width: 10, height: 10, borderRadius: 999, background: ROLE.assistant.color}} />
            <RoleTag k="assistant" />
            <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.dim}}>{round}</span>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 18, marginTop: 14, opacity: call.opacity, transform: call.transform}}>
            <div
              style={{
                border: `2px solid ${theme.tool}`,
                background: `${theme.tool}1F`,
                borderRadius: 8,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.tool}}>{callZh}</span>
              <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.tool, opacity: 0.85}}>{callEn}</span>
            </div>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 12}}>
            {params.map((pm, i) => (
              <div
                key={pm.k}
                style={{
                  border: `2px solid ${theme.panelBorder}`,
                  borderRadius: 8,
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: tags[i],
                  transform: `translateY(${(1 - tags[i]) * 8}px)`,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{pm.k}</span>
                {pm.milk ? <Milk /> : <span style={{fontFamily: theme.mono, fontSize: 21, color: theme.text}}>{pm.v}</span>}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* 执行脉冲走线 + 行进点 + 到站辉光 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <line
          x1={ln.from.x}
          y1={ln.from.y}
          x2={ln.to.x}
          y2={ln.to.y}
          stroke={theme.tool}
          strokeWidth={3}
          opacity={0.3 * pulse}
        />
        {pulse > 0 && pulse < 1 ? <circle cx={dot.x} cy={dot.y} r={10} fill={theme.tool} /> : null}
        <circle
          cx={ln.to.x}
          cy={ln.to.y}
          r={18 + 22 * hit}
          fill="none"
          stroke={theme.tool}
          strokeWidth={3}
          opacity={0.8 * hit}
        />
        {mode === 'write' ? <circle cx={ln.to.x} cy={ln.to.y} r={30} fill={theme.tool} opacity={0.12 * hit} /> : null}
      </svg>

      {/* 结果条（tool 角色；回喂目标格） */}
      <div
        style={{position: 'absolute', left: px, top: py, transform: 'translate(-50%, -50%)', opacity: pill.opacity * gone}}
      >
        <Panel accent={theme.tool} style={{padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, background: theme.bg}}>
          <RoleTag k="tool" />
          <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.text, display: 'flex', alignItems: 'center'}}>
            {pillNode}
          </span>
        </Panel>
      </div>

      <Footnote delay={fast ? 4 : 6}>{foot}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-D：第三轮纯文本 + 空缺一拍 + 回答入档 ─────────────────────────────

const ShotD: React.FC<{atStrip: number; atPill: number; atVacancy: number; slotIdx: number}> = ({
  atStrip,
  atPill,
  atVacancy,
  slotIdx,
}) => {
  const frame = useCurrentFrame();
  const strip = useEnter('rise', {at: atStrip, dur: DUR.f4, restBottom: 560});
  const textO = useProgress(atStrip + DUR.f3, DUR.f4);
  // 空缺位一拍：虚线空框自条入即在场（对照前两轮），「没有工具调用」词落位时脉一拍
  const vacPulse = useImpulse({at: atVacancy, dur: DUR.f6, peak: 0.08});
  const pill = useEnter('pop', {at: atPill, dur: DUR.f3});
  const fly = useSpring('settle', {at: atPill + DUR.f3, dur: DUR.f5});
  const arrive = atPill + DUR.f3 + DUR.f5;
  const gone = interpolate(frame, [arrive - 1, arrive + 3], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const tgt = slotCenter(slotIdx);
  const px = PILL_FROM.x + (tgt.x - PILL_FROM.x) * fly;
  const py = PILL_FROM.y + (tgt.y - PILL_FROM.y) * fly;

  return (
    <AbsoluteFill>
      {/* 回答条：与 2-B/2-C 同构，但调用块位置为显式空缺（虚线空框） */}
      <div style={{position: 'absolute', left: STRIP.x, top: STRIP.y, width: STRIP.w, ...strip}}>
        <Panel style={{padding: '16px 22px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <div style={{width: 10, height: 10, borderRadius: 999, background: ROLE.assistant.color}} />
            <RoleTag k="assistant" />
            <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.dim}}>{'第三轮'}</span>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 18, marginTop: 14}}>
            <div
              style={{
                width: 236,
                height: 52,
                boxSizing: 'border-box',
                border: `2px dashed ${theme.panelBorder}`,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${1 + vacPulse})`,
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'无调用'}</span>
            </div>
            <span
              style={{
                fontFamily: theme.sans,
                fontSize: 26,
                color: theme.text,
                display: 'flex',
                alignItems: 'center',
                opacity: textO,
              }}
            >
              {'清单 · '}
              <Milk />
            </span>
          </div>
        </Panel>
      </div>

      {/* 回答条入档（assistant 角色，回喂第四格） */}
      <div
        style={{position: 'absolute', left: px, top: py, transform: 'translate(-50%, -50%)', opacity: pill.opacity * gone}}
      >
        <Panel accent={theme.core} style={{padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, background: theme.bg}}>
          <RoleTag k="assistant" />
          <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.text, display: 'flex', alignItems: 'center'}}>
            {'纯文本 · '}
            <Milk />
          </span>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P2Walkthrough: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  /** 词窗锚（act 局部帧）：at(id) + 句长分数——旁白实测时长变化时窗口自动重定时 */
  const word = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p2-01', 'p2-02');
  const bB = w('p2-03', 'p2-04');
  const bC = w('p2-05', 'p2-06');
  const bD = w('p2-07', 'p2-09');

  // —— 词落位锚（act 局部；镜内组件再减 beat.from 换算镜内帧）——
  const bubbleAt = word('p2-02', 0.42); // 「加一行牛奶」：指令气泡落入首格
  const tagAt = word('p2-02', 0.8); // 「念给我听」：清单卡角标贴上
  const slot1Fill = bubbleAt + DUR.f5;

  const exec1 = word('p2-04', 0.14); // 「程序执行写入」：执行脉冲
  const rowAt = word('p2-04', 0.48); // 「清单多了一行牛奶」：清单长行
  const feed1 = word('p2-04', 0.8); // 「结果喂回去」：结果条回喂第二格
  const slot2Fill = feed1 + DUR.f3 + DUR.f5;

  const exec2 = word('p2-06', 0.18); // 「再执行」：读脉冲（扫清单）
  const feed2 = word('p2-06', 0.6); // 「再喂回去」：结果回喂第三格
  const slot3Fill = feed2 + DUR.f3 + DUR.f4;

  const pill3 = word('p2-07', 0.35); // 「清单现在是这些」：回答入档第四格
  const vacancyAt = word('p2-07', 0.55); // 「没有工具调用」：空缺位一拍
  const gateAt = word('p2-07', 0.8); // 「循环退出」：出口门开启
  const stopAt = word('p2-07', 0.87); // 环体停转
  const slot4Fill = pill3 + DUR.f3 + DUR.f5;

  const counterAt = word('p2-09', 0.1); // 「三次调用、两次执行」：计数重音
  const flashAt: [number, number, number] = [
    word('p2-09', 0.16),
    word('p2-09', 0.45),
    word('p2-09', 0.72),
  ];

  return (
    <AbsoluteFill>
      <SceneTag chapter="Worked Example" tagline="购物清单 · 一次往返" accent={theme.core} />
      <Stage
        span={bD.from + bD.durationInFrames}
        atTag={tagAt}
        atRow={rowAt}
        atScan={exec2}
        fillAt={[slot1Fill, slot2Fill, slot3Fill, slot4Fill]}
        activeFrom={[slot1Fill, bB.from, bC.from, bD.from]}
        atGate={gateAt}
        atStop={stopAt}
        atCounter={counterAt}
        flashAt={flashAt}
      />

      <Sequence {...bA} name="2-A 走查舞台">
        <ShotA atBubble={bubbleAt - bA.from} atFill={slot1Fill - bA.from} />
      </Sequence>

      <Sequence {...bB} name="2-B 第一轮 · 写文件">
        <ToolRound
          round={'第一轮'}
          callZh={'写文件'}
          callEn={'write_file'}
          params={[{k: '路径', v: 'list.txt'}, {k: '新内容', milk: true}]}
          mode="write"
          atStrip={2}
          atCall={word('p2-03', 0.5) - bB.from} // 「写文件」：调用块弹出（新句该词约 0.5 处）
          atParam={word('p2-03b', 0.32) - bB.from} // 「参数是…」：参数签弹出（拆句后词移至 p2-03b）
          atExec={exec1 - bB.from}
          atFeed={feed1 - bB.from}
          slotIdx={1}
          pillNode={<>{'写入 ✓'}</>}
          foot="write_file(list.txt, 牛奶)"
        />
      </Sequence>

      <Sequence {...bC} name="2-C 第二轮 · 读文件">
        <ToolRound
          round={'第二轮'}
          callZh={'读文件'}
          callEn={'read_file'}
          params={[{k: '路径', v: 'list.txt'}]}
          mode="read"
          atStrip={2}
          atCall={word('p2-05', 0.42) - bC.from}
          atParam={word('p2-05', 0.62) - bC.from}
          atExec={exec2 - bC.from}
          atFeed={feed2 - bC.from}
          slotIdx={2}
          pillNode={
            <>
              {'读出 · '}
              <Milk />
            </>
          }
          fast
          foot="read_file(list.txt)"
        />
      </Sequence>

      <Sequence {...bD} name="2-D 第三轮 · 循环出口">
        <ShotD atStrip={2} atPill={pill3 - bD.from} atVacancy={vacancyAt - bD.from} slotIdx={3} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2Walkthrough;
