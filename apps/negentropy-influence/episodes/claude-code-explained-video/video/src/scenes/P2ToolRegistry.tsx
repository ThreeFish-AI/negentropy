/** P2 工具号码簿（p2-01..27，5 镜 16 cue）——分镜 2-A…2-E。
 *
 *  叙事链：翻译层痛点（只认命令行）→ 号码簿查表（dispatch-map）→ 两步注册的暗契约
 *  （registry-contract）→ 托盘三账（tool-batch-layers）→ 第一道围墙（只围文件工具）。
 *  空间契约：LoopRing 内核恒居左中锚位（M-001 同形，只换周边标签）；号码簿、契约卡、
 *  围墙等装置一律在右侧展开、不触碰内核图形。
 *  archify 三图全屏独占：自制装置经 ArchifyYield 让位，只在空窗句（p2-06/12/20/22）回落。
 *  跨实例背靠背（p2-09→p2-11、p2-16→p2-17）的后挂实例一律 lead={false}，且与后续
 *  空窗后重现的章拆成两个实例——lead={false} 会压掉整个实例的入场。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {DispatchTable, Footnote, LoopRing, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {
  DUR,
  useBreathe,
  useDim,
  useDraw,
  useEnter,
  useImpulse,
  useProgress,
  useReveal,
  useShake,
  useStagger,
} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位：顶边 y<56 已归 frozen ChapterProgress，Badge 下移到 SceneTag 同行
 *  （与 P1 同值；P1–P6 统一由 Integrate 核对）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** 内核锚位：环心 (330, 540)，与 P1 1-G 同位同尺——幕间接续不跳位 */
const RING = {size: 300, left: 180, top: 390, cx: 330, cy: 540, r: 104} as const;

/** LoopRing 巡游节律：2.5s/圈（全片同值） */
const LAP_FRAMES = 75;

/** 左中内核：恒定锚 + 匀速巡游光点（span 帧内线性推进，机械感即主题） */
const Kernel: React.FC<{span: number}> = ({span}) => {
  const laps = useProgress(0, Math.max(1, span), 'linear') * (span / LAP_FRAMES);
  return (
    <div style={{position: 'absolute', left: RING.left, top: RING.top}}>
      <LoopRing size={RING.size} dotProgress={laps} showLabels={false} showExit={false} />
    </div>
  );
};

/** 机器卡（border-box 定宽，便于手算布局） */
const Machine: React.FC<{zh: string; en: string; accent?: string; width?: number}> = ({
  zh,
  en,
  accent,
  width = 280,
}) => (
  <Panel accent={accent} style={{width, boxSizing: 'border-box', padding: '16px 20px'}}>
    <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.text}}>{zh}</div>
    <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 4}}>{en}</div>
  </Panel>
);

/** 极简人形剪影（人/师傅一律无彩） */
const Figure: React.FC<{x: number; y: number; color: string; scale?: number}> = ({x, y, color, scale = 1}) => (
  <svg
    width={120 * scale}
    height={180 * scale}
    viewBox="0 0 120 180"
    style={{position: 'absolute', left: x, top: y}}
  >
    <circle cx={60} cy={34} r={28} fill={color} opacity={0.9} />
    <path d="M0 180 Q0 76 60 70 Q120 76 120 180 Z" fill={color} opacity={0.9} />
  </svg>
);

// ── 2-A 翻译层痛点 ──────────────────────────────────────────────────────

const CMD_OK = 'cat path/to/fi';
const CMD_TYPED = `${CMD_OK}el`; // 末两字拼错：file → fiel
const TYPE_CPS = 12;

const TranslationPain: React.FC<{
  span: number;
  atOneMachine: number;
  atWant: number;
  wantDur: number;
}> = ({span, atOneMachine, atWant, wantDur}) => {
  const debt = useEnter('fade', {at: 4, dur: DUR.f5});
  const machine = useEnter('slideL', {at: atOneMachine, dur: DUR.f5});
  const link = useProgress(atOneMachine, DUR.f5);
  const want = useEnter('fade', {at: atWant, dur: DUR.f5});
  const atType = atWant + Math.round(wantDur * 0.35);
  const term = useEnter('rise', {at: atType - DUR.f4, dur: DUR.f4, restBottom: 700});
  const typed = useReveal(CMD_TYPED, {at: atType, cps: TYPE_CPS});
  // 拼错那一刻：末字出现即抖动 + 红闪（decay 包络归零，不常驻）
  const typoAt = atType + Math.ceil(((CMD_OK.length + 1) / TYPE_CPS) * 30);
  const shake = useShake({at: typoAt, amp: 7, decay: true, dur: DUR.f6});
  const flash = useImpulse({at: typoAt, dur: DUR.f6});
  const typoMark = useProgress(typoAt, DUR.f4);

  const okPart = typed.slice(0, CMD_OK.length);
  const badPart = typed.slice(CMD_OK.length);

  return (
    <AbsoluteFill>
      <Kernel span={span} />

      {/* p2-01：能力债开账 */}
      <div style={{position: 'absolute', left: 150, top: 200, ...debt}}>
        <Panel accent={theme.mech} style={{padding: '10px 22px', display: 'flex', alignItems: 'baseline', gap: 14}}>
          <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'#1'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 700, color: theme.mech}}>{'能力债'}</span>
        </Panel>
      </div>

      {/* p2-02：传送带只认一台机器 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <line
          x1={RING.cx + RING.r}
          y1={RING.cy}
          x2={RING.cx + RING.r + 90 * link}
          y2={RING.cy}
          stroke={theme.core}
          strokeWidth={4}
        />
      </svg>
      <div style={{position: 'absolute', left: 530, top: 482, ...machine}}>
        <Machine zh="命令行" en="bash" width={220} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 530,
          top: 610,
          width: 220,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 26,
          color: theme.dim,
          opacity: machine.opacity,
        }}
      >
        {'× 1'}
      </div>

      {/* p2-03：想说的 / 只会拼的 */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: want.opacity}}>
        <Figure x={870} y={250} color={theme.text} scale={0.62} />
        <div style={{position: 'absolute', left: 1000, top: 236, fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
          {'想说的'}
        </div>
        <div style={{position: 'absolute', left: 1000, top: 276, transform: want.transform}}>
          <Panel style={{padding: '18px 30px', borderRadius: 22}}>
            <span style={{fontFamily: theme.sans, fontSize: 42, color: theme.text}}>{'读这个文件'}</span>
          </Panel>
        </div>
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
          <line x1={1140} y1={392} x2={1140} y2={470} stroke={theme.dim} strokeWidth={3} strokeDasharray="6 8" />
          <path d="M1128 458 L1140 474 L1152 458" fill="none" stroke={theme.dim} strokeWidth={3} />
        </svg>
        <div style={{position: 'absolute', left: 1166, top: 414, fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
          {'翻译'}
        </div>
      </div>

      <div style={{position: 'absolute', left: 1000, top: 494, fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: term.opacity}}>
        {'只会拼的'}
      </div>
      <div style={{position: 'absolute', left: 1000, top: 534, ...term}}>
        <div style={{transform: `translateX(${shake}px)`}}>
          <Panel
            accent={flash > 0.05 ? theme.deny : theme.panelBorder}
            style={{
              width: 680,
              boxSizing: 'border-box',
              padding: '22px 28px',
              boxShadow: `0 0 ${30 * flash}px ${theme.deny}`,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 40, whiteSpace: 'pre'}}>
              <span style={{color: theme.core}}>{'$ '}</span>
              <span style={{color: theme.text}}>{okPart}</span>
              <span style={{color: theme.deny, textDecoration: typoMark > 0.5 ? 'underline wavy' : 'none'}}>
                {badPart}
              </span>
            </span>
          </Panel>
        </div>
      </div>

      <Footnote delay={atType}>{'cat path/to/file'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-B 空窗句回落：查号装置一现（p2-06） ─────────────────────────────

const DISPATCH_ROWS = [
  {key: 'bash', value: 'run_bash'},
  {key: 'read_file', value: 'run_read'},
  {key: 'write_file', value: 'run_write'},
  {key: 'edit_file', value: 'run_edit'},
  {key: 'glob', value: 'run_glob'},
];
const HIT_ROW = 1;

const LookupFallback: React.FC<{span: number}> = ({span}) => {
  const table = useEnter('slideR', {at: 0, dur: DUR.f5, dist: 40});
  const label = useProgress(4, DUR.f4);
  // 名字小卡沿转接线滑向号码簿（decelerate：到站减速）
  const arrive = useProgress(10, DUR.f6, 'decelerate');
  const hitAt = 10 + DUR.f6;
  const glow = useImpulse({at: hitAt, dur: DUR.f6});
  const chipX = RING.cx + RING.r + 30 + (1010 - (RING.cx + RING.r + 30) - 170) * arrive;

  return (
    <AbsoluteFill>
      <Kernel span={span} />
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <line
          x1={RING.cx + RING.r}
          y1={RING.cy}
          x2={1060}
          y2={RING.cy}
          stroke={theme.core}
          strokeWidth={4}
          strokeDasharray="10 10"
          opacity={label}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: RING.cx + RING.r + 40,
          top: 470,
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.dim,
          opacity: label,
        }}
      >
        {'查号 → 转接'}
      </div>
      <div style={{position: 'absolute', left: chipX, top: 518, opacity: label * (1 - 0.6 * glow)}}>
        <Panel accent={theme.mech} style={{padding: '4px 14px'}}>
          <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.mech}}>{'read_file'}</span>
        </Panel>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1060,
          top: 356,
          borderRadius: 16,
          boxShadow: `0 0 ${36 * glow}px ${theme.mech}`,
          ...table,
        }}
      >
        {/* 命中行：到站即点亮（DispatchTable 的命中态是离散样式，辉光由外层脉冲承担） */}
        <DispatchTable rows={DISPATCH_ROWS} hit={arrive >= 1 ? HIT_ROW : -1} width={600} />
      </div>
      <Footnote delay={4}>{'TOOL_HANDLERS · TOOLS'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-C 空窗句回落：暗契约文卡（p2-12） ─────────────────────────────────

const ContractCard: React.FC = () => {
  const card = useEnter('rise', {at: 2, dur: DUR.f5, dist: 40, restBottom: 700});
  const tie = useProgress(2 + DUR.f5 + 6, DUR.f5);
  const hot = {color: theme.mech, fontWeight: 700} as const;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 500, top: 300, ...card}}>
        <Panel accent={theme.mech} style={{width: 920, boxSizing: 'border-box', padding: '28px 40px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
            <span
              style={{
                fontFamily: theme.sans,
                fontSize: 22,
                color: theme.mech,
                border: `2px solid ${theme.mech}`,
                borderRadius: 6,
                padding: '2px 10px',
              }}
            >
              {'第三处'}
            </span>
            <span style={{fontFamily: theme.serif, fontSize: 46, fontWeight: 700, color: theme.text}}>
              {'参数名 ＝ 形参名'}
            </span>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 30, lineHeight: 1.8, marginTop: 22}}>
            <div>
              <span style={{color: theme.dim}}>{'schema   '}</span>
              <span style={{color: theme.text}}>{'{ '}</span>
              <span style={hot}>{'"path"'}</span>
              <span style={{color: theme.text}}>{': ... }'}</span>
            </div>
            <div>
              <span style={{color: theme.dim}}>{'handler  '}</span>
              <span style={{color: theme.text}}>{'def run_read('}</span>
              <span style={hot}>{'path'}</span>
              <span style={{color: theme.text}}>{')'}</span>
            </div>
          </div>
          <div
            style={{
              marginTop: 14,
              height: 4,
              borderRadius: 2,
              background: theme.mech,
              width: `${100 * tie}%`,
            }}
          />
        </Panel>
      </div>
      <Footnote delay={2}>{'handler(**block.input)'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-D 空窗句回落：零并发原语对账条（p2-20）+ 【三】归属小卡（p2-22） ───

const ZeroPrimitive: React.FC<{span: number}> = ({span}) => {
  const bar = useEnter('fade', {at: 2, dur: DUR.f5});
  const promise = useDim({at: Math.round(span * 0.4), to: 0.35, dur: DUR.f5});
  const strike = useProgress(Math.round(span * 0.4), DUR.f5);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 360, top: 360, ...bar}}>
        <Panel style={{width: 1200, boxSizing: 'border-box', padding: 0, display: 'flex', overflow: 'hidden'}}>
          <div style={{flex: 1, padding: '28px 36px', opacity: promise, position: 'relative'}}>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'章节索引'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 48, fontWeight: 700, color: theme.text, marginTop: 10}}>
              {'并发'}
            </div>
            <div
              style={{
                position: 'absolute',
                left: 30,
                top: 104,
                height: 4,
                width: 110 * strike,
                background: theme.dim,
              }}
            />
          </div>
          <div style={{width: 2, background: theme.panelBorder}} />
          <div style={{flex: 1.4, padding: '28px 36px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'实测'}</div>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 4}}>
              <span style={{fontFamily: theme.mono, fontSize: 88, fontWeight: 700, color: theme.core}}>{'0'}</span>
              <span style={{fontFamily: theme.sans, fontSize: 36, color: theme.text}}>{'并发原语'}</span>
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'thread pool 0 · async 0'}</div>
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

const AuthorCard: React.FC = () => {
  const card = useEnter('fade', {at: 2, dur: DUR.f5});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 560, top: 390, ...card}}>
        <Panel accent={theme.dim} style={{width: 800, boxSizing: 'border-box', padding: '26px 34px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
            <span
              style={{
                fontFamily: theme.sans,
                fontSize: 22,
                color: theme.dim,
                border: `2px solid ${theme.dim}`,
                borderRadius: 6,
                padding: '2px 10px',
              }}
            >
              {'【三】'}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>{'开源项目作者 · 源码分析'}</span>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 34, color: theme.text, marginTop: 20}}>
            <span style={{fontFamily: theme.serif, fontSize: 52, color: theme.panelBorder}}>{'“'}</span>
            {'批 · 调度'}
          </div>
        </Panel>
      </div>
      <Footnote delay={2}>{'PostToolBatch · parallel tool calls'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-E 围墙装置首现 ────────────────────────────────────────────────────

/** 围栏矩形 x 960–1720 / y 220–760；路径自右缘中点起笔——「从右缘展开」 */
const FENCE = {x0: 960, y0: 220, x1: 1720, y1: 760} as const;
const FENCE_D = `M${FENCE.x1} 490 V${FENCE.y1} H${FENCE.x0} V${FENCE.y0} H${FENCE.x1} Z`;

const FILE_TOOLS = [
  {zh: '读文件', en: 'read_file', x: 1020, y: 290},
  {zh: '写文件', en: 'write_file', x: 1380, y: 290},
  {zh: '改文件', en: 'edit_file', x: 1020, y: 470},
  {zh: '找文件', en: 'glob', x: 1380, y: 470},
] as const;

/** 越界箭头：自「找文件」下沿向围栏底边 */
const BREACH = {x: 1520, y0: 596, y1: FENCE.y1 - 8} as const;

const FenceDevice: React.FC<{span: number; atBreach: number; atLeak: number}> = ({span, atBreach, atLeak}) => {
  const machines = useStagger(FILE_TOOLS.length, {at: 2, stride: 5, dur: DUR.f4});
  const bash = useEnter('fade', {at: 2, dur: DUR.f5});
  const fence = useDraw(DUR.f5, DUR.f6);
  const fenceTitle = useProgress(DUR.f5 + DUR.f6, DUR.f4);
  const arrow = useProgress(atBreach, DUR.f5, 'accelerate');
  const hitAt = atBreach + DUR.f5;
  const hit = useImpulse({at: hitAt, dur: DUR.f6});
  const err = useProgress(hitAt, DUR.f4);
  const leakIn = useProgress(atLeak, DUR.f5);
  // 低频呼吸（period 60 ≈ 2s）：警示而非报警
  const leak = useBreathe({period: 60, base: 0.55, amp: 0.45});

  return (
    <AbsoluteFill>
      <Kernel span={span} />
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        {/* 内核到两侧机器的转接线（无彩走线，数据流一律 dim） */}
        <path
          d={`M${RING.cx + RING.r} ${RING.cy} H${FENCE.x0}`}
          stroke={theme.dim}
          strokeWidth={3}
          fill="none"
          opacity={0.5 * bash.opacity}
        />
        <path
          d={`M${RING.cx + RING.r - 10} ${RING.cy + 40} L560 700`}
          stroke={theme.dim}
          strokeWidth={3}
          fill="none"
          opacity={0.5 * bash.opacity}
        />
        {/* 围栏：pathLength 归一化描线（红线三），越界撞框时叠一层 deny 闪 */}
        <path
          d={FENCE_D}
          fill="none"
          stroke={theme.mech}
          strokeWidth={3}
          strokeLinejoin="round"
          {...fence}
        />
        <path d={FENCE_D} fill="none" stroke={theme.deny} strokeWidth={6} strokeLinejoin="round" opacity={hit} />
        {/* 越界箭头 */}
        <line
          x1={BREACH.x}
          y1={BREACH.y0}
          x2={BREACH.x}
          y2={BREACH.y0 + (BREACH.y1 - BREACH.y0) * arrow}
          stroke={theme.deny}
          strokeWidth={4}
          opacity={arrow > 0 ? 1 : 0}
        />
        <path
          d={`M${BREACH.x - 22} ${BREACH.y1 - 22} L${BREACH.x + 22} ${BREACH.y1 + 22} M${BREACH.x + 22} ${BREACH.y1 - 22} L${BREACH.x - 22} ${BREACH.y1 + 22}`}
          stroke={theme.deny}
          strokeWidth={6}
          strokeLinecap="round"
          opacity={err}
        />
      </svg>

      <div
        style={{
          position: 'absolute',
          left: FENCE.x0 + 20,
          top: FENCE.y0 - 46,
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          opacity: fenceTitle,
        }}
      >
        <span style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.mech}}>{'工作区'}</span>
        <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'WORKDIR'}</span>
      </div>

      {FILE_TOOLS.map((t, i) => (
        <div
          key={t.en}
          style={{
            position: 'absolute',
            left: t.x,
            top: t.y,
            opacity: machines[i],
            transform: `translateY(${(1 - machines[i]) * 14}px)`,
          }}
        >
          <Machine zh={t.zh} en={t.en} width={300} />
        </div>
      ))}

      <div
        style={{
          position: 'absolute',
          left: BREACH.x + 24,
          top: 640,
          fontFamily: theme.mono,
          fontSize: 22,
          color: theme.deny,
          opacity: arrow > 0 ? arrow : 0,
        }}
      >
        {'../outside'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: BREACH.x + 40,
          top: FENCE.y1 + 14,
          fontFamily: theme.mono,
          fontSize: 24,
          fontWeight: 700,
          color: theme.deny,
          opacity: err,
        }}
      >
        {'Error'}
      </div>

      {/* 框外：命令行机器 + 警示点（镜尾埋雷） */}
      <div style={{position: 'absolute', left: 560, top: 650, ...bash}}>
        <Machine zh="命令行" en="bash" width={240} accent={leakIn > 0.5 ? theme.deny : undefined} />
        <div
          style={{
            position: 'absolute',
            right: -10,
            top: -10,
            width: 24,
            height: 24,
            borderRadius: 999,
            background: theme.deny,
            opacity: leakIn * leak,
            boxShadow: `0 0 ${18 * leak}px ${theme.deny}`,
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 560,
          top: 790,
          width: 240,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
          opacity: leakIn,
        }}
      >
        {'围墙外'}
      </div>

      <Footnote delay={DUR.f5 + DUR.f6}>{'safe_path · is_relative_to(WORKDIR)'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P2ToolRegistry: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（某句起始帧）；dur() = 与 at 对称的单句取长（cue 窗必须落在同一句 id 上）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p2-01', 'p2-03');
  const bB = w('p2-04', 'p2-09');
  const bC = w('p2-11', 'p2-16');
  const bD = w('p2-17', 'p2-24');
  const bE = w('p2-25', 'p2-27');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="2-A 翻译层痛点">
        <SceneTag chapter="Tool Use" tagline="号码簿与托盘" />
        <TranslationPain
          span={bA.durationInFrames}
          atOneMachine={at('p2-02') - bA.from}
          atWant={at('p2-03') - bA.from}
          wantDur={dur('p2-03')}
        />
      </Sequence>

      <Sequence {...bB} name="2-B 号码簿">
        {/* 可见岛 p2-06；窗 = 本镜 5 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p2-04') - bB.from, durationInFrames: dur('p2-04')},
            {at: at('p2-05') - bB.from, durationInFrames: dur('p2-05')},
            {at: at('p2-07') - bB.from, durationInFrames: dur('p2-07')},
            {at: at('p2-08') - bB.from, durationInFrames: dur('p2-08')},
            {at: at('p2-09') - bB.from, durationInFrames: dur('p2-09')},
          ]}
        >
          {/* 多挂 f3 帧：让位淡出盖满后再卸载 */}
          <Sequence from={at('p2-06') - bB.from} durationInFrames={dur('p2-06') + DUR.f3}>
            <LookupFallback span={dur('p2-06') + DUR.f3} />
          </Sequence>
        </ArchifyYield>
        {/* 前镜无图 → 首章默认入场；p2-06 空窗后 four-new-tools 由实例内判定自动恢复入场 */}
        <ArchifyRecap
          slug="dispatch-map"
          caption="转接号码簿"
          cues={[
            {chapterId: 'switch-line', at: at('p2-04') - bB.from, durationInFrames: dur('p2-04')},
            {chapterId: 'name-handler', at: at('p2-05') - bB.from, durationInFrames: dur('p2-05')},
            {chapterId: 'four-new-tools', at: at('p2-07') - bB.from, durationInFrames: dur('p2-07')},
            {chapterId: 'ledger-grows', at: at('p2-08') - bB.from, durationInFrames: dur('p2-08')},
            {chapterId: 'belt-still', at: at('p2-09') - bB.from, durationInFrames: dur('p2-09')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="2-C 两步注册与暗契约">
        {/* 可见岛 p2-12；窗 = 本镜 5 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p2-11') - bC.from, durationInFrames: dur('p2-11')},
            {at: at('p2-13') - bC.from, durationInFrames: dur('p2-13')},
            {at: at('p2-14') - bC.from, durationInFrames: dur('p2-14')},
            {at: at('p2-15') - bC.from, durationInFrames: dur('p2-15')},
            {at: at('p2-16') - bC.from, durationInFrames: dur('p2-16')},
          ]}
        >
          <Sequence from={at('p2-12') - bC.from} durationInFrames={dur('p2-12') + DUR.f3}>
            <ContractCard />
          </Sequence>
        </ArchifyYield>
        {/* p2-09 → p2-11 背靠背跨实例 → lead={false}（p2-10 已删，两句直接相接） */}
        <ArchifyRecap
          slug="registry-contract"
          caption="注册暗契约"
          lead={false}
          cues={[{chapterId: 'two-step-signup', at: at('p2-11') - bC.from, durationInFrames: dur('p2-11')}]}
        />
        {/* p2-12 空窗后重现 → 独立实例、默认入场；实例内其余三章背靠背自动抑制 */}
        <ArchifyRecap
          slug="registry-contract"
          caption="注册暗契约"
          cues={[
            {chapterId: 'hidden-third-boom', at: at('p2-13') - bC.from, durationInFrames: dur('p2-13')},
            {chapterId: 'unknown-fallback', at: at('p2-14') - bC.from, durationInFrames: dur('p2-14')},
            {chapterId: 'per-tool-try', at: at('p2-15') - bC.from, durationInFrames: dur('p2-15')},
            {chapterId: 'loop-immune', at: at('p2-16') - bC.from, durationInFrames: dur('p2-16')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="2-D 托盘三账">
        {/* 可见岛 p2-20 / p2-22；窗 = 本镜 6 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p2-17') - bD.from, durationInFrames: dur('p2-17')},
            {at: at('p2-18') - bD.from, durationInFrames: dur('p2-18')},
            {at: at('p2-19') - bD.from, durationInFrames: dur('p2-19')},
            {at: at('p2-21') - bD.from, durationInFrames: dur('p2-21')},
            {at: at('p2-23') - bD.from, durationInFrames: dur('p2-23')},
            {at: at('p2-24') - bD.from, durationInFrames: dur('p2-24')},
          ]}
        >
          <Sequence from={at('p2-20') - bD.from} durationInFrames={dur('p2-20') + DUR.f3}>
            <ZeroPrimitive span={dur('p2-20')} />
          </Sequence>
          <Sequence from={at('p2-22') - bD.from} durationInFrames={dur('p2-22') + DUR.f3}>
            <AuthorCard />
          </Sequence>
        </ArchifyYield>
        {/* p2-16 → p2-17 背靠背跨实例 → lead={false}；实例内三章连续 */}
        <ArchifyRecap
          slug="tool-batch-layers"
          caption="托盘三账"
          lead={false}
          cues={[
            {chapterId: 'one-tray', at: at('p2-17') - bD.from, durationInFrames: dur('p2-17')},
            {chapterId: 'teach-serial', at: at('p2-18') - bD.from, durationInFrames: dur('p2-18')},
            {chapterId: 'index-promises', at: at('p2-19') - bD.from, durationInFrames: dur('p2-19')},
          ]}
        />
        {/* p2-20 空窗后重现 → 独立实例、默认入场；p2-22 空窗后的 author-schedule 实例内自动恢复入场 */}
        <ArchifyRecap
          slug="tool-batch-layers"
          caption="托盘三账"
          cues={[
            {chapterId: 'official-parallel', at: at('p2-21') - bD.from, durationInFrames: dur('p2-21')},
            {chapterId: 'author-schedule', at: at('p2-23') - bD.from, durationInFrames: dur('p2-23')},
            {chapterId: 'args-decide', at: at('p2-24') - bD.from, durationInFrames: dur('p2-24')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="2-E 围墙装置首现">
        <FenceDevice
          span={bE.durationInFrames}
          atBreach={at('p2-26') - bE.from}
          atLeak={at('p2-27') - bE.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2ToolRegistry;
