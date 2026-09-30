/** P0 每轮从头读（p0-01..16，4 镜 2 cue）——分镜 0-A…0-D。
 *
 *  cue 清单（2，全落 plan-panorama）：
 *   0-B desk-reread@p0-07（全景左半一瞥：台面＋读扫主轴；本片首图 → 默认入场）
 *   0-D five-devices@p0-15（五装置总览一闪；距前 cue 空窗 7 句 → 默认入场）
 *
 *  ★ 0-A 的 3D 五层栈由 components/harness-stack.tsx 的 HarnessStackP0 承担
 *    （落板/本集层「规划与协调」呼吸/缩退全在其内）；scene 侧补主问题字卡、
 *    中央台面立锚（DeskPlane 首现，useDraw 描线生长）与底盘传送带慢转。
 *  ★ Badge 顶边带冲突处理（沿 ep1 先例）：frozen ChapterProgress 占 y14–42，
 *    HarnessStackP0 内置交叉淡入的常驻条钉在 top:12——在 crossAt 处把整个
 *    HarnessStackP0 包 5 帧淡杀，同拍淡入本集 top:64 Badge（零双影的调用点侧解法）。
 *  ★ 恒定空间契约自此幕生效：台面（DeskPlane，coreDeep 描边大矩形〔M-001〕）
 *    恒居画面中央（DESK 几何，motifs.tsx SSOT），本镜后永不换位；五装置剪影
 *    自台面右缘挂入（0-D）。「安排台面」的动效只作用于台面内容物。
 *  ★ 0-C 四坑全部落在台面内容物上（嘱托卡摊薄/文件堆长住/大部头压垫纸角/
 *    程序窗格熄火），台面框体恒静——坑的是台面，不是框。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {DESK, DeskPlane, Footnote, LoopRing, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge, HarnessStackP0, harnessStackCrossAt} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {
  DUR,
  clamp01,
  progress,
  useBreathe,
  useDraw,
  useEnter,
  useFlowDash,
  useImpulse,
  useProgress,
  useReveal,
  useStagger,
} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位：与 P1–P6 同值（顶边 y<56 归 frozen ChapterProgress；Integrate 统一核对）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** 底盘传送带慢转节律（3s 一圈——工坊心跳，恒速无强调〔M-002〕） */
const LAP_FRAMES = 90;

/** hex + 动态透明度（帧驱动，无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 师傅剪影（text 白，无彩）——立于台面后侧 */
const Person: React.FC<{x: number; y: number; color: string; scale?: number; opacity?: number}> = ({
  x,
  y,
  color,
  scale = 1,
  opacity = 0.9,
}) => (
  <svg
    width={120 * scale}
    height={180 * scale}
    viewBox="0 0 120 180"
    style={{position: 'absolute', left: x, top: y, opacity}}
  >
    <circle cx={60} cy={34} r={28} fill={color} />
    <path d="M0 180 Q0 76 60 70 Q120 76 120 180 Z" fill={color} />
  </svg>
);

/** 台面内容物·消息行（每轮被从头读的「东西」）：5 行 dim 条＋发言点。
 *  0-A 随传送带起转落位 / 0-B 被扫描线读过 / 0-C 压暗作四坑的底。 */
const ROW_Y = [482, 518, 554, 590, 626] as const;
const ROW_W = [860, 640, 900, 560, 780] as const;

const DeskRows: React.FC<{vis: readonly number[]; dim?: number}> = ({vis, dim = 1}) => (
  <>
    {ROW_Y.map((y, i) => {
      const o = (vis[i] ?? 0) * dim;
      if (o <= 0) {
        return null;
      }
      return (
        <div key={y} style={{position: 'absolute', left: 520, top: y, height: 14, opacity: o}}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: -3,
              width: 14,
              height: 14,
              borderRadius: 999,
              background: theme.dim,
              opacity: 0.65,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 30,
              top: 0,
              width: ROW_W[i],
              height: 14,
              borderRadius: 4,
              background: theme.dim,
              opacity: 0.5,
            }}
          />
        </div>
      );
    })}
  </>
);

/** 台面内容物·嘱托卡：开工嘱托的三行底账——0-A 落位、0-B 在读、0-C 坑一逐行摊薄。 */
const MandateCard: React.FC<{inP: number; rowO?: readonly number[]}> = ({inP, rowO}) => (
  <div
    style={{
      position: 'absolute',
      left: 516,
      top: 302,
      width: 216,
      height: 136,
      opacity: inP,
      transform: `translateY(${(1 - inP) * 14}px)`,
    }}
  >
    <Panel style={{width: '100%', height: '100%', boxSizing: 'border-box', padding: '14px 18px'}}>
      <div style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 600, color: theme.dim}}>
        {'嘱托'}
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: [172, 148, 160][i],
            height: 12,
            borderRadius: 4,
            background: theme.dim,
            opacity: 0.55 * (rowO ? rowO[i] ?? 1 : 1),
            marginTop: 14,
          }}
        />
      ))}
    </Panel>
  </div>
);

// ── 0-A 五层栈开卷 + 台面立锚 ────────────────────────────────────────────

/** 开卷：3D 栈落板/本集层呼吸/缩退在 HarnessStackP0；本组件管主问题字卡
 *  （「谁」mech 紫点睛）、台面首现描线（useDraw）与底盘传送带慢转。 */
const OpeningScene: React.FC<{dur01: number; at02: number; at05: number}> = ({
  dur01,
  at02,
  at05,
}) => {
  const frame = useCurrentFrame();
  // 栈缩退锚：p0-02「场景请出来」句起不久（栈呼吸已收束）——场景接管画面
  const recedeAt = Math.max(70, at02 + DUR.f3);
  const crossAt = harnessStackCrossAt(recedeAt);
  // 内置 top:12 常驻条可见前的整层淡杀（f3 快于内置 8 帧交叉，零双影）
  const kill = useProgress(crossAt, DUR.f3);
  const badgeIn = useProgress(crossAt, 8);

  // 台面立锚：大矩形描线生长（~1.4s beat 级动作，时长标尺外保留显式帧数——同 ep1
  // 环首现先例）。useDraw 产 pathLength 归一化三元组，DeskPlane 吃数值进度——
  // 在此解包（描线仍由 useDraw 的 decelerate 曲线驱动）。
  const deskAt = recedeAt + DUR.f4;
  const deskDraw = 1 - useDraw(deskAt, 42).strokeDashoffset;
  const deskFill = useProgress(deskAt + 42, DUR.f4);

  // 主问题字卡：p0-01 后半进场（栈呼吸收束后），p0-05 传送带起转时退场
  const atCard = Math.max(56, Math.round(dur01 * 0.55));
  const cardIn = useProgress(atCard, DUR.f5);
  const cardOut = useProgress(at05 - DUR.f5, DUR.f5);
  // 「谁」字 mech 紫点睛：一次性强调（sin 包络自衰减）
  const shui = useImpulse({at: atCard + DUR.f3, dur: DUR.f6, peak: 1});

  // 台面首批内容物：嘱托卡随台面落位；消息行随 p0-05 传送带起转逐行落位
  const mandateIn = useProgress(deskAt + 42, DUR.f4);
  const rowSlots = useStagger(ROW_Y.length, {at: at05 + 6, stride: 5, dur: DUR.f3});

  // 底盘传送带：p0-05 描线首现 + 慢转（恒速〔M-002〕；光点随描线后才上路）
  const beltDraw = useProgress(at05, 36);
  const beltT = Math.max(0, frame - (at05 + 36));
  const laps = beltT / LAP_FRAMES;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{opacity: 1 - kill}}>
        <HarnessStackP0 recedeAt={recedeAt} />
      </div>
      <HarnessBadge style={{...BADGE_STYLE, opacity: badgeIn}} />

      {/* 底盘传送带（环在台面框体之下）：LoopRing core 橙恒定线宽〔M-001〕 */}
      <div style={{position: 'absolute', left: 865, top: 681}}>
        <LoopRing
          size={190}
          draw={beltDraw}
          dotProgress={beltDraw > 0 ? beltDraw + laps : undefined}
          showLabels={false}
          showExit={false}
        />
      </div>

      {/* 中央台面首现：coreDeep 描边大矩形，全片恒定主视觉（M-001 立锚） */}
      <DeskPlane draw={deskDraw} />
      <div style={{position: 'absolute', inset: 0, opacity: deskFill}}>
        <MandateCard inP={mandateIn} />
        <DeskRows vis={rowSlots} />
      </div>

      {/* 主问题字卡（≤6 字形态；「谁」字 mech 紫点睛） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 150,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 66,
          fontWeight: 700,
          color: theme.text,
          opacity: cardIn * (1 - cardOut),
          transform: `translateY(${(1 - cardIn) * 18}px)`,
        }}
      >
        <span
          style={{
            color: theme.mech,
            display: 'inline-block',
            transform: `translateY(${-4 * shui}px) scale(${1 + 0.08 * shui})`,
            textShadow: `0 0 ${26 * shui}px ${withAlpha(theme.mech, 0.9)}`,
          }}
        >
          {'谁'}
        </span>
        <span>{'定的？'}</span>
      </div>

      <Footnote delay={deskAt}>{'context window'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 0-B 师傅立于台面后侧，每轮从头读 ────────────────────────────────────

/** 从头读装置：师傅剪影淡入 → 视线扫描线自左向右匀速扫过台面内容物（dim 行进
 *  虚线）。p0-07 全景窗整句让位（幕组装层 ArchifyYield），窗尾交叉淡回时线已
 *  行至右缘——「读毕回落自制扫描线收尾」由让位层的连续进度天然兑现。 */
const FreshReadScan: React.FC<{dur06: number; span: number}> = ({dur06, span}) => {
  const frame = useCurrentFrame();
  // 师傅剪影淡入（text 白无彩），立于台面后侧（脚被台面框体遮住）
  const person = useEnter('fade', {at: DUR.f3, dur: DUR.f5});
  // 扫描线：p0-06 后半起扫、beat 末抵右缘——匀速线性（机械的「读」，无强调〔M-002〕）
  const scanStart = DUR.f4 + Math.round(dur06 * 0.5);
  const scanDur = Math.max(1, span - scanStart - DUR.f2);
  const scanP = progress(frame, scanStart, scanDur);
  const scanX = 520 + scanP * 880;
  // 行进虚线（dim）：同一元素上只作线型动画，不与描画动画挤（红线三同源纪律）
  const flow = useFlowDash({dash: 10, gap: 12, period: 34});
  const contentsIn = useProgress(DUR.f4, DUR.f4);

  return (
    <AbsoluteFill>
      <Person x={820} y={104} color={theme.text} scale={0.95} opacity={person.opacity} />
      <DeskPlane />
      <div style={{position: 'absolute', inset: 0, opacity: contentsIn}}>
        <MandateCard inP={1} />
        <DeskRows vis={[1, 1, 1, 1, 1]} />
      </div>

      {/* 视线扫描线：竖直 dim 虚线自左向右扫过台面内容物 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <line
          x1={scanX}
          y1={296}
          x2={scanX}
          y2={778}
          stroke={theme.dim}
          strokeWidth={3.5}
          {...flow}
        />
        <circle cx={scanX} cy={288} r={7} fill={theme.dim} opacity={0.85} />
      </svg>
      {/* 扫描题词（关键词锚点，随线头行进） */}
      <div
        style={{
          position: 'absolute',
          left: Math.min(scanX + 14, 1436),
          top: 268,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
          opacity: scanP > 0 ? 0.9 : 0,
        }}
      >
        {'从头读'}
      </div>

      <Footnote delay={DUR.f3}>{'context window'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 0-C 四坑四联卡：全部落在台面内容物上 ────────────────────────────────

const PITS = [
  {no: '坑一', zh: '摊薄', en: 'diluted'},
  {no: '坑二', zh: '长住', en: 'resident'},
  {no: '坑三', zh: '全付', en: 'full price'},
  {no: '坑四', zh: '白干', en: 'wasted'},
] as const;

/** 台面内容物·文件图标（坑二：为一条线索翻的文件从此长住台面） */
const FileGlyph: React.FC<{x: number; y: number; o: number}> = ({x, y, o}) => (
  <svg width={46} height={56} style={{position: 'absolute', left: x, top: y, opacity: o}}>
    <path
      d="M4 2 H30 L42 14 V54 H4 Z"
      fill={theme.panel}
      stroke={theme.dim}
      strokeWidth={2.5}
    />
    <path d="M30 2 V14 H42" fill="none" stroke={theme.dim} strokeWidth={2} opacity={0.7} />
  </svg>
);

/** 台面内容物·大部头（坑三：三份规范印死在垫纸，每轮全额付费） */
const Tome: React.FC<{x: number; y: number; o: number}> = ({x, y, o}) => (
  <svg width={92} height={148} style={{position: 'absolute', left: x, top: y, opacity: o}}>
    <rect x={3} y={3} width={86} height={142} rx={5} fill={theme.panel} stroke={theme.dim} strokeWidth={3} />
    <line x1={16} y1={3} x2={16} y2={145} stroke={theme.dim} strokeWidth={3} opacity={0.7} />
    {[36, 60, 84, 108].map((yy) => (
      <line key={yy} x1={28} y1={yy} x2={76} y2={yy} stroke={theme.dim} strokeWidth={2.5} opacity={0.45} />
    ))}
  </svg>
);

const FourPits: React.FC<{at09: number; at10: number; at11: number; at12: number}> = ({
  at09,
  at10,
  at11,
  at12,
}) => {
  // 四联卡骨架依次入场（快闪）
  const slots = useStagger(PITS.length, {at: DUR.f3, stride: 7, dur: DUR.f4});
  // 逐句激活（帧序即口播序：坑一 p0-09 … 坑四 p0-12）；坑名逐字打出
  const acts = [
    useProgress(at09, DUR.f4),
    useProgress(at10, DUR.f4),
    useProgress(at11, DUR.f4),
    useProgress(at12, DUR.f4),
  ];
  const kws = [
    useReveal(PITS[0].zh, {at: at09 + DUR.f2, cps: 3}),
    useReveal(PITS[1].zh, {at: at10 + DUR.f2, cps: 3}),
    useReveal(PITS[2].zh, {at: at11 + DUR.f2, cps: 3}),
    useReveal(PITS[3].zh, {at: at12 + DUR.f2, cps: 3}),
  ];

  // 坑一：嘱托三行逐条变淡（摊薄到 0.2——还在，但读不清了）
  const mFade = [
    useProgress(at09 + 4, DUR.f4),
    useProgress(at09 + 12, DUR.f4),
    useProgress(at09 + 20, DUR.f4),
  ];
  const mandateRows = mFade.map((p) => 1 - 0.8 * p);
  // 坑二：十个文件图标堆进台面（长住）
  const fileSlots = useStagger(10, {at: at10 + 2, stride: 4, dur: DUR.f3});
  // 坑三：三大部头压上垫纸角（垫纸属 P4 修复后的紫装置，此处是被压坏的 dim 前身）
  const tomeSlots = useStagger(3, {at: at11 + 2, stride: 7, dur: DUR.f4});
  const padSquash = useProgress(at11 + DUR.f5, DUR.f4);
  // 坑四：程序窗格熄火＋末卡 deny 红脉冲（decay 包络自衰减）
  const paneIn = useProgress(at12, DUR.f4);
  const paneDark = useProgress(at12 + DUR.f4, DUR.f5);
  const die = useImpulse({at: at12, dur: DUR.f6, peak: 1});
  // 消息行退为底账（四坑的受害者是台面整体）
  const rowsDim = useProgress(at09 - DUR.f3, DUR.f5);

  return (
    <AbsoluteFill>
      {/* 台面框体恒静〔M-001〕——坑的是内容物，不是框 */}
      <DeskPlane />
      <div style={{position: 'absolute', inset: 0}}>
        <MandateCard inP={1} rowO={mandateRows} />
        <DeskRows vis={[1, 1, 1, 1, 1]} dim={1 - 0.7 * rowsDim} />
        {/* 坑二：文件堆（5×2 网格，长住台面） */}
        {fileSlots.map((o, i) => (
          <FileGlyph key={i} x={780 + (i % 5) * 62} y={302 + Math.floor(i / 5) * 74} o={o} />
        ))}
        {/* 坑三：垫纸角（dim 薄层）＋三大部头压上 */}
        <div
          style={{
            position: 'absolute',
            left: 1108,
            top: 728,
            width: 336,
            height: 10,
            borderRadius: 3,
            background: theme.dim,
            opacity: 0.4 * tomeSlots[0],
            transform: `scaleY(${1 - 0.3 * padSquash})`,
          }}
        />
        {tomeSlots.map((o, i) => (
          <Tome key={i} x={1128 + i * 106} y={566} o={o} />
        ))}
        {/* 坑四：程序窗格熄火（渐黑 + deny 描边一闪） */}
        <div
          style={{
            position: 'absolute',
            left: 640,
            top: 636,
            width: 320,
            height: 152,
            borderRadius: 10,
            border: `3px solid ${withAlpha(theme.deny, 0.25 + 0.75 * die)}`,
            background: `rgba(0,0,0,${0.25 + 0.72 * paneDark})`,
            opacity: paneIn,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 6,
              padding: '8px 12px',
              borderBottom: `2px solid ${withAlpha(theme.panelBorder, 1 - paneDark)}`,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{width: 9, height: 9, borderRadius: 999, background: theme.dim, opacity: 1 - paneDark}}
              />
            ))}
          </div>
          <div style={{padding: '12px 14px'}}>
            {[252, 196].map((wd, i) => (
              <div
                key={i}
                style={{
                  width: wd,
                  height: 12,
                  borderRadius: 4,
                  background: theme.dim,
                  opacity: (0.5 - 0.45 * paneDark) * paneIn,
                  marginBottom: 12,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 四坑四联卡（压在台面上缘外，随口播逐张激活） */}
      {PITS.map((p, i) => {
        const a = acts[i];
        const isDeny = i === 3;
        const accent = isDeny ? theme.deny : theme.mech;
        return (
          <div
            key={p.no}
            style={{
              position: 'absolute',
              left: DESK.left + i * 244,
              top: 150,
              width: 228,
              opacity: slots[i],
              transform: `translateY(${(1 - slots[i]) * 18}px)`,
            }}
          >
            <Panel
              accent={a > 0.5 ? accent : theme.panelBorder}
              style={{
                boxSizing: 'border-box',
                padding: '12px 18px',
                boxShadow:
                  a > 0.5
                    ? isDeny
                      ? `0 0 ${16 * Math.max(a, die)}px ${withAlpha(theme.deny, 0.5 * Math.max(a, die))}`
                      : `0 0 ${14 * a}px ${withAlpha(theme.mech, 0.4 * a)}`
                    : undefined,
              }}
            >
              <div style={{fontFamily: theme.sans, fontSize: 20, color: a > 0.5 ? accent : theme.dim}}>
                {p.no}
              </div>
              <div
                style={{
                  fontFamily: theme.sans,
                  fontSize: 34,
                  fontWeight: 700,
                  color: a > 0.5 ? theme.text : theme.dim,
                  minHeight: 44,
                  marginTop: 2,
                }}
              >
                {kws[i] || ' '}
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{p.en}</div>
            </Panel>
          </div>
        );
      })}

      <Footnote delay={DUR.f2}>{'context window'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 0-D 立碑：更聪明的师傅划线否掉 + 五装置预告 ──────────────────────────

/** 五装置预告剪影（mech 紫 ×5：卡／副台／抽屉／垫纸／梯）——自台面右缘挂入，
 *  作用于台面内容物、不触碰装置形体。 */
const HANGS = [
  {zh: '工序卡', en: 'todo card'},
  {zh: '副台', en: 'side desk'},
  {zh: '抽屉', en: 'drawer'},
  {zh: '垫纸', en: 'pad'},
  {zh: '补救梯', en: 'ladder'},
] as const;

/** 金句卡预告态：横带衬底（只罩台面区，右缘五剪影不卷入）——终态全幅定格留给 P6。 */
const BandQuote: React.FC = () => {
  const o = useProgress(DUR.f3, DUR.f4);
  return (
    <div
      style={{
        position: 'absolute',
        left: 430,
        top: 556,
        width: 1060,
        height: 224,
        background: withAlpha(theme.bg, 0.86 * o),
        borderRadius: 18,
        overflow: 'hidden',
      }}
    >
      {/* caption-dup-ok: 金句卡定格记忆点，主字已压短非逐字（storyboard 0-D 同款豁免） */}
      <QuoteCard zh="看见什么 · 不由它" />
    </div>
  );
};

const Monument: React.FC<{at13: number; at14: number; at15: number; at16: number; span: number}> = ({
  at13,
  at14,
  at15,
  at16,
  span,
}) => {
  // 立碑字卡进场
  const cardIn = useProgress(2, DUR.f4);
  // 「更聪明的师傅」划线否掉（decelerate；否定语义走 deny）
  const strike = useProgress(at14 + 8, DUR.f5, 'decelerate');
  // 根子题词（p0-14 后半：一个根子）
  const rootIn = useProgress(at14 + DUR.f5, DUR.f4);
  // 五剪影：p0-15 全景窗内滑入挂位（ArchifyYield 窗下进度不重置），窗尾淡回即已挂好
  const hang0 = useEnter('slideR', {at: at15 + 2, dur: DUR.f5, dist: 70});
  const hang1 = useEnter('slideR', {at: at15 + 7, dur: DUR.f5, dist: 70});
  const hang2 = useEnter('slideR', {at: at15 + 12, dur: DUR.f5, dist: 70});
  const hang3 = useEnter('slideR', {at: at15 + 17, dur: DUR.f5, dist: 70});
  const hang4 = useEnter('slideR', {at: at15 + 22, dur: DUR.f5, dist: 70});
  const hangs = [hang0, hang1, hang2, hang3, hang4];
  const glows = [
    useBreathe({period: 46, amp: 0.4, base: 0.6}),
    useBreathe({period: 46, amp: 0.4, base: 0.6, offset: 12}),
    useBreathe({period: 46, amp: 0.4, base: 0.6, offset: 24}),
    useBreathe({period: 46, amp: 0.4, base: 0.6, offset: 36}),
    useBreathe({period: 46, amp: 0.4, base: 0.6, offset: 48}),
  ];
  // 立碑句压暗台面旧账（四个坑的现场清场，让位给碑文）
  const deskDim = useProgress(at13, DUR.f5);

  return (
    <AbsoluteFill>
      {/* 台面恒静：空台（四坑现场已在 0-C 收束，此处是抽象的「根子」台面） */}
      <DeskPlane opacity={1 - 0.35 * deskDim} />

      {/* 立碑：「更聪明的师傅」→ 划线否掉 */}
      <div style={{position: 'absolute', left: 735, top: 330, width: 450, opacity: cardIn}}>
        <Panel style={{padding: '24px 30px', textAlign: 'center'}}>
          <span style={{fontFamily: theme.sans, fontSize: 42, fontWeight: 600, color: theme.dim}}>
            {'更聪明的师傅'}
          </span>
        </Panel>
        <svg width={450} height={16} viewBox="0 0 450 16" style={{position: 'absolute', left: 0, top: 44}}>
          <line
            x1={26}
            y1={8}
            x2={424}
            y2={8}
            stroke={theme.deny}
            strokeWidth={6}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - strike}
          />
        </svg>
      </div>
      {/* 根子题词 */}
      <div
        style={{
          position: 'absolute',
          left: DESK.left,
          top: 470,
          width: DESK.w,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 30,
          color: theme.dim,
          opacity: rootIn,
        }}
      >
        {'一个根子 · 从头读'}
      </div>

      {/* 五装置预告剪影：自台面右缘挂入（mech 常驻辉光，不触碰台面框体） */}
      {HANGS.map((h, i) => (
        <div key={h.zh} style={{position: 'absolute', left: 1494, top: 150 + i * 136, ...hangs[i]}}>
          <Panel
            accent={theme.mech}
            style={{
              width: 292,
              boxSizing: 'border-box',
              padding: '16px 22px',
              boxShadow: `0 0 ${18 * glows[i]}px ${withAlpha(theme.mech, 0.45 * glows[i])}`,
            }}
          >
            <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
              <span style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 600, color: theme.mech}}>
                {h.zh}
              </span>
              <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{h.en}</span>
            </div>
          </Panel>
        </div>
      ))}

      {/* 金句卡预告态（p0-16 定格；横带衬底，五剪影仍在带外呼吸） */}
      <Sequence from={at16} durationInFrames={Math.max(1, span - at16)}>
        <BandQuote />
      </Sequence>

      <Footnote delay={DUR.f4}>{'Harness'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P0Reread: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p0-01', 'p0-05');
  const bB = w('p0-06', 'p0-07');
  const bC = w('p0-08', 'p0-12');
  const bD = w('p0-13', 'p0-16');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 五层栈开卷＋台面立锚（3D）">
        <SceneTag chapter="Fresh Read" tagline="每轮从头读" />
        <OpeningScene
          dur01={dur('p0-01')}
          at02={at('p0-02') - bA.from}
          at05={at('p0-05') - bA.from}
        />
      </Sequence>

      <Sequence {...bB} name="0-B 师傅从头读">
        <HarnessBadge style={BADGE_STYLE} />
        {/* 可见岛 p0-06／扫描线收尾；窗 = 本镜 1 条 cue 窗 */}
        <ArchifyYield cues={[{at: at('p0-07') - bB.from, durationInFrames: dur('p0-07')}]}>
          <FreshReadScan dur06={dur('p0-06')} span={bB.durationInFrames} />
        </ArchifyYield>
        {/* cue 1/2：plan-panorama/desk-reread（全景左半一瞥；本片首图 → 默认入场） */}
        <ArchifyRecap
          slug="plan-panorama"
          caption="规划全景"
          cues={[
            {chapterId: 'desk-reread', at: at('p0-07') - bB.from, durationInFrames: dur('p0-07')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="0-C 四坑四联卡">
        <HarnessBadge style={BADGE_STYLE} />
        <FourPits
          at09={at('p0-09') - bC.from}
          at10={at('p0-10') - bC.from}
          at11={at('p0-11') - bC.from}
          at12={at('p0-12') - bC.from}
        />
      </Sequence>

      <Sequence {...bD} name="0-D 立碑·五装置预告">
        <HarnessBadge style={BADGE_STYLE} />
        {/* 可见岛 p0-13..14／p0-16；窗 = 本镜 1 条 cue 窗 */}
        <ArchifyYield cues={[{at: at('p0-15') - bD.from, durationInFrames: dur('p0-15')}]}>
          <Monument
            at13={at('p0-13') - bD.from}
            at14={at('p0-14') - bD.from}
            at15={at('p0-15') - bD.from}
            at16={at('p0-16') - bD.from}
            span={bD.durationInFrames}
          />
        </ArchifyYield>
        {/* cue 2/2：plan-panorama/five-devices（五装置总览一闪；空窗 7 句 → 默认入场） */}
        <ArchifyRecap
          slug="plan-panorama"
          caption="规划全景"
          cues={[
            {chapterId: 'five-devices', at: at('p0-15') - bD.from, durationInFrames: dur('p0-15')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0Reread;
