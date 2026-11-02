/** P3 拆房三出口（p3-01..p3-10，4 镜）——分镜 3-A / 3-B / 3-C / 3-D。
 *
 *  Morph Continuity（2-C→3-A，头注明示）：同一主体 = 双房+分支线组。起止态：
 *  2-C 末帧双房分挂左右、完成灯亮、问号悬账本上方 → 3-A 首帧双房收缩至中央
 *  工具卡两侧（完成灯转「待清点」暗态）、拆房工具卡居中亮出。中间态：收缩
 *  过程房轮廓、房号签、两线拓扑逐帧不变，仅尺度与位置变化（identity 保两项：
 *  房轮廓+房号签——房下角标随行）。
 *
 *  叙事链：3-A 拆房清点全景：p3-01「一数…文件」词落位左计数器立起、数字条
 *  0→1 跳一格（离散——改了还没记到线上的文件=1）〔M-005〕、「二数…提交」词
 *  落位右计数器立起、数字条停在 0 → p3-02「上游」词落位远账虚影亮出（远处
 *  对着的那本账）、右计数器加挂「须线连上游」限定签（角标 upstream）、
 *  「第一条，不看这条前提」词落位左计数器限定签明确空缺（两维前提差异对照
 *  定格）→ 3-B 三出口门卡依次亮：p3-03「不是零」词落位镜缘计数小窗闪一拍
 *  〔M-005〕、「默认拒绝」词落位门卡①亮出+描边一沉、「第一个」词落位序号签
 *  「1」点亮 → p3-04「强拆」词落位门卡②亮出（警示红描边）、「显式说一句
 *  丢弃」词落位卡上确认开关弹出（默认未拨，角标 discard_changes）、「第三
 *  个」词落位门卡③亮出（确认绿描边）、「整条留下等人审」词落位卡③内房+
 *  线小图整条保留（与门②删除态对照）→ 3-C 左红右绿消融同屏（全片张力
 *  峰值）：p3-05「实测一遍」词落位右轨演示——1 枚未提交文件点入房→拆房
 *  指令签落下→报错条弹现（默认拒绝）→文件点、房、线三者各亮一拍（俱在，
 *  确认绿锁定）〔M-005〕→ p3-06「绕开守卫」词落位左轨演示——拆房指令签越过
 *  守卫位直落→目录房虚化消失、文件点无声蒸发（无报错条——无声的具象）、
 *  分支线被连带抹掉（连坐删除）、「连坐」词落位左轨整轨泛红一沉+双计数
 *  1→0 跌落（重音镜 1–2s punch）→ p3-07「收尾的保护，比创建更值得学」词
 *  落位双轨定格对照+教训短签「护住收尾 ＞ 建得快」上浮定格〔M-003〕→
 *  3-D 事件日志条带：p3-08「一本流水账」词落位条带横贯亮出〔M-005〕、「建、
 *  拆、留」词落位三色小事件签各闪一拍、「每一步都追加一条事件」词落位一条
 *  新事件实时滚入带尾（追加语义：只增不改）→ p3-09「翻这本账就有得查」词
 *  落位放大镜扫过条带、扫中一条事件高亮 → p3-10「真实的」词落位镜头拉远
 *  （@pushIn 负增量）+ 深处生产版双入口舞台虚影显形一拍。
 *
 *  空间契约（安全带实算）：3-A 工具卡底 510 / 双计数器底 ≈ 450 / 缩驻房底
 *  670 / 远账虚影底 370；3-B 三门底 ≈ 600 / 镜缘小窗底 ≈ 210；3-C 轨底
 *  150+690=840（承 CHECK_LANES）；3-D 条带底 510 / 虚影拱底 840——全部
 *  ≤ 860。红左绿右恒定；左轨蒸发无报错条 ↔ 右轨拒绝有报错条；计数跌落有
 *  轨迹（离散发值+坠落位移）；数字与 narration/B.2 实测一致（未提交 1 /
 *  拒绝 1 / 蒸发 1 / 连坐 1）；右计数必带上游限定签；条带只追加不覆写。
 *  机制英文词只进角标（remove_worktree / discard_changes / keep_worktree /
 *  upstream / events.jsonl / branch -D）。词落位 = wa(id,f)。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  AblationSplit,
  BranchLine,
  CHECK_LANES,
  CounterBar,
  EventLogBand,
  ExitGateCard,
  GuardBadge,
  LedgerBlock,
  RoomCard,
  ease,
} from '../components/motifs';
import {DUR, clamp01, progress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 3-A 拆房清点全景：工具卡登场 + 双计数器 + 上游远账虚影 ─────────────────────

/** 3-A 布局（安全带实算见头注；morph 起点承 2-C 双房位） */
const TOOL_3A = {x: 810, y: 290, w: 300, h: 220} as const;
const CNT_3A = [
  {x: 430, y: 300, label: '未提交文件', cond: '改了还没记到线上'},
  {x: 1190, y: 300, label: '未推送提交', cond: '记了还没送出去'},
] as const;
const UPSTREAM_3A = {x: 1600, y: 170, w: 130, h: 200} as const;
/** 双房 morph：2-C 位 → 3-A 缩驻位（identity：房轮廓+房号签） */
const ROOM_MORPH = [
  {from: {x: 330, y: 330, w: 230, h: 190}, to: {x: 280, y: 540, w: 150, h: 130}, tag: '.worktrees/auth-refactor/'},
  {from: {x: 1360, y: 330, w: 230, h: 190}, to: {x: 1500, y: 540, w: 150, h: 130}, tag: '.worktrees/ui-login/'},
] as const;

const ThreeA: React.FC<{atCntL: number; atJump: number; atCntR: number; atUp: number; atCap: number; atCapVoid: number}> = ({
  atCntL,
  atJump,
  atCntR,
  atUp,
  atCap,
  atCapVoid,
}) => {
  const frame = useCurrentFrame();
  // 双房收缩（morph：房轮廓/房号签/线拓扑不变，仅尺度位置；完成灯转待清点）
  const shrink = ease(clamp01(progress(frame, 3, 18)));
  // 工具卡登场（拆房——钢青）
  const tool = clamp01(progress(frame, 6, 12));
  // 左计数器立起（一数文件）+ 数字条 0→1 跳一格（离散给值）
  const cntL = clamp01(progress(frame, atCntL, 12));
  const jumped = frame >= atJump ? 1 : 0;
  const jumpFlash = Math.sin(Math.PI * clamp01(progress(frame, atJump, 12)));
  // 右计数器立起（二数提交——停在 0）
  const cntR = clamp01(progress(frame, atCntR, 12));
  // 上游远账虚影（远处对着的那本账）
  const up = clamp01(progress(frame, atUp, 14));
  // 右计数器限定签（须线连上游）/ 左计数器空缺对照
  const cap = clamp01(progress(frame, atCap, 12));
  const capVoid = clamp01(progress(frame, atCapVoid, 12));
  return (
    <AbsoluteFill>
      {/* 双房缩驻两侧（待清点——完成灯暗态保持；角标随行 identity） */}
      {ROOM_MORPH.map((m, i) => {
        const x = m.from.x + (m.to.x - m.from.x) * shrink;
        const y = m.from.y + (m.to.y - m.from.y) * shrink;
        const w = m.from.w + (m.to.w - m.from.w) * shrink;
        const h = m.from.h + (m.to.h - m.from.h) * shrink;
        return (
          <div key={`mrf${i}`}>
            <RoomCard x={x} y={y} w={w} h={h} name={i === 0 ? '认证房' : '界面房'} nameLitP={1} doneP={1} pendingP={shrink} fileCardP={1} doorP={1} />
            <div style={{position: 'absolute', left: x - 4, top: y + h + 26, fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.8}}>
              {m.tag}
            </div>
          </div>
        );
      })}
      {/* 中央拆房工具卡（钢青登场） */}
      <div style={{position: 'absolute', left: TOOL_3A.x, top: TOOL_3A.y, width: TOOL_3A.w, height: TOOL_3A.h, opacity: tool, transform: `translateY(${(1 - tool) * 22}px)`}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 14,
            border: `3.5px solid ${withAlpha(theme.guard, 0.85)}`,
            background: withAlpha(theme.panel, 0.96),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <svg width={64} height={58} viewBox="0 0 64 58">
            <path d="M6 16 L32 4 L58 16" fill="none" stroke={theme.guard} strokeWidth={4} strokeLinejoin="round" />
            <rect x={12} y={16} width={40} height={36} rx={5} fill="none" stroke={theme.guard} strokeWidth={4} />
            <line x1={32} y1={26} x2={32} y2={44} stroke={theme.guard} strokeWidth={4} strokeLinecap="round" />
          </svg>
          <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>拆房</div>
          <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>{'remove_worktree'}</div>
        </div>
      </div>
      {/* 双计数器（左：0→1 跳格离散；右：立起停 0 + 上游限定签） */}
      <CounterBar x={CNT_3A[0].x} y={CNT_3A[0].y} label={CNT_3A[0].label} value={jumped} litP={cntL} cond={CNT_3A[0].cond} flashP={jumpFlash * 0.8} capVoidP={capVoid} />
      <CounterBar x={CNT_3A[1].x} y={CNT_3A[1].y} label={CNT_3A[1].label} value={0} litP={cntR} cond={CNT_3A[1].cond} capP={cap} />
      {/* 上游远账虚影（远处对着的那本账——限定维度用） */}
      <div style={{position: 'absolute', left: UPSTREAM_3A.x, top: UPSTREAM_3A.y, opacity: up * 0.55}}>
        <LedgerBlock x={0} y={0} w={UPSTREAM_3A.w} h={UPSTREAM_3A.h} ghost slots={0} />
        <div style={{position: 'absolute', left: 4, top: UPSTREAM_3A.h + 8, fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>
          上游 · 远处那本账
        </div>
        {/* 右计数器 → 远账的「须线连」虚线（限定维度可视） */}
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <line x1={CNT_3A[1].x} y1={CNT_3A[1].y + 60} x2={UPSTREAM_3A.x + 30} y2={UPSTREAM_3A.y + 90} stroke={theme.dim} strokeWidth={2.5} strokeDasharray="7 7" opacity={cap * 0.7} />
        </svg>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'拆前清点：一数文件，二数提交 · remove_worktree'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-B 三出口门卡依次亮（①默认拒绝 / ②强拆 / ③保留等审）+ 镜缘计数小窗 ────────

/** 3-B 布局（安全带实算：三门底 ≈ 600；镜缘小窗底 ≈ 210） */
const GATES_3B = [{x: 330}, {x: 810}, {x: 1290}] as const;
const MINI_3B = {x: 90, y: 120} as const;

const ThreeB: React.FC<{atMini: number; atGate1: number; atNum1: number; atGate2: number; atConfirm: number; atGate3: number; atKeep: number}> = ({
  atMini,
  atGate1,
  atNum1,
  atGate2,
  atConfirm,
  atGate3,
  atKeep,
}) => {
  const frame = useCurrentFrame();
  // 镜缘计数小窗（1≠0 可见——常驻 + 闪一拍）
  const mini = clamp01(progress(frame, 3, 10));
  const miniFlash = Math.sin(Math.PI * clamp01(progress(frame, atMini, 16)));
  // 三门依次亮（次序=口播次序；门①描边一沉）
  const g1 = clamp01(progress(frame, atGate1, 10));
  const n1 = clamp01(progress(frame, atNum1, 8));
  const sink1 = clamp01(progress(frame, atGate1 + 12, 10));
  const g2 = clamp01(progress(frame, atGate2, 10));
  const confirm = clamp01(progress(frame, atConfirm, 10));
  const g3 = clamp01(progress(frame, atGate3, 10));
  const keep = clamp01(progress(frame, atKeep, 12));
  return (
    <AbsoluteFill>
      {/* 镜缘计数小窗（3-A 双计数器缩入——1≠0 可见） */}
      <div style={{position: 'absolute', left: MINI_3B.x, top: MINI_3B.y, display: 'flex', gap: 12, opacity: mini}}>
        <CounterBar x={0} y={0} w={250} label="未提交" value={1} micro flashP={miniFlash} />
        <CounterBar x={262} y={0} w={250} label="未推送" value={0} micro />
      </div>
      {/* 三出口门卡（等距并排——①钢青 ②红 ③绿） */}
      <ExitGateCard x={GATES_3B[0].x} y={290} w={300} h={300} which={1} litP={g1} numP={n1} sinkP={sink1} />
      <ExitGateCard x={GATES_3B[1].x} y={290} w={300} h={300} which={2} litP={g2} numP={g2} confirmP={confirm} />
      <ExitGateCard x={GATES_3B[2].x} y={290} w={300} h={300} which={3} litP={g3} numP={g3} keepP={keep} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'有一样不是零，默认拒绝 · 强拆须显式丢弃 · 第三个整条留'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C 左红右绿消融同屏（全片张力峰值——旁路强删 ↔ 守卫在位） ──────────────────

/** 轨内布局（按 CHECK_LANES 平移；轨底 840 ≤ 860） */
const laneOf = (side: 'L' | 'R') => {
  const lane = side === 'L' ? CHECK_LANES.left : CHECK_LANES.right;
  return {
    room: {x: lane.x + 190, y: lane.y + 200, w: 210, h: 180},
    line: {x1: lane.x + 40, y1: lane.y + 290, x2: lane.x + 190, y2: lane.y + 290},
    fileDot: {x: lane.x + 280, y: lane.y + 300},
    sign: {x: lane.x + 520, y: lane.y + 120},
    guard: {x: lane.x + 470, y: lane.y + 260},
    err: {x: lane.x + 480, y: lane.y + 420},
    counts: {x: lane.x + 60, y: lane.y + 560},
  };
};

/** 轨内计数列（右轨：拒绝/文件/房/线 俱在恒 1；左轨：文件/分支 1→0 跌落——
 *  离散发值 + 坠落位移轨迹） */
const LaneCounts: React.FC<{x: number; y: number; tone: string; rows: readonly {label: string; value: number; fallP?: number}[]}> = ({x, y, tone, rows}) => (
  <div style={{position: 'absolute', left: x, top: y, display: 'flex', gap: 26}}>
    {rows.map((r) => {
      const fall = clamp01(r.fallP ?? 0);
      return (
        <div key={r.label} style={{position: 'relative', minWidth: 88}}>
          <div style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>{r.label}</div>
          <div style={{position: 'relative', height: 40}}>
            {/* 坠落的旧值（1→0 跌落有轨迹） */}
            {fall > 0.02 && fall < 0.98 ? (
              <span style={{position: 'absolute', left: 0, top: fall * 34, fontFamily: theme.mono, fontSize: 30, fontWeight: 700, color: tone, opacity: 1 - fall}}>
                1
              </span>
            ) : null}
            <span style={{fontFamily: theme.mono, fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: r.value > 0 ? tone : theme.dim, whiteSpace: 'nowrap'}}>
              {r.value}
            </span>
          </div>
        </div>
      );
    })}
  </div>
);

/** 拆房指令签（轨内共用——落下/越过守卫直落两态由落点区分） */
const RemoveSign: React.FC<{x: number; y: number; dropP: number; tone: string}> = ({x, y, dropP, tone}) => {
  const d = clamp01(dropP);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + (1 - d) * -120,
        padding: '7px 18px',
        borderRadius: 10,
        border: `2.5px solid ${withAlpha(tone, 0.9)}`,
        background: withAlpha(theme.panel, 0.97),
        fontFamily: theme.sans,
        fontSize: 19,
        fontWeight: 700,
        color: tone,
        whiteSpace: 'nowrap',
        opacity: d,
      }}
    >
      拆房指令
    </div>
  );
};

const ThreeC: React.FC<{
  atFileIn: number;
  atDrop: number;
  atErr: number;
  atGreen: number;
  atBypass: number;
  atVanish: number;
  atEvap: number;
  atErase: number;
  atSink: number;
  atLesson: number;
}> = ({atFileIn, atDrop, atErr, atGreen, atBypass, atVanish, atEvap, atErase, atSink, atLesson}) => {
  const frame = useCurrentFrame();
  const L = laneOf('L');
  const R = laneOf('R');
  // 双轨立起
  const rise = clamp01(progress(frame, 3, 14));
  // 右轨演示（守卫在位——基线）：文件点入房 → 指令签落下 → 报错条弹现 → 三者俱在绿锁定
  const fileIn = clamp01(progress(frame, atFileIn, 14));
  const drop = clamp01(progress(frame, atDrop, 12));
  const err = clamp01(progress(frame, atErr, 8));
  const green = clamp01(progress(frame, atGreen, 16));
  const greenPulse = Math.sin(Math.PI * clamp01(progress(frame, atGreen + 16, 20)));
  // 左轨演示（旁路强删）：指令签越过守卫位直落 → 房虚化 → 文件无声蒸发 → 线连坐抹掉 → 整轨泛红一沉
  const bypass = clamp01(progress(frame, atBypass, 12));
  const lDrop = clamp01(progress(frame, atBypass + 6, 12));
  const vanish = clamp01(progress(frame, atVanish, 16));
  const evap = clamp01(progress(frame, atEvap, 14));
  const erase = clamp01(progress(frame, atErase, 14));
  const sink = clamp01(progress(frame, atSink, 12));
  // 教训短签（定格对照后上浮）
  const lesson = clamp01(progress(frame, atLesson, 16));
  // 计数离散发值：左轨文件/分支 1→0（跌落窗口内切换）
  const lFile = frame >= atEvap + 8 ? 0 : 1;
  const lBranch = frame >= atErase + 6 ? 0 : 1;
  const lFallFile = clamp01(progress(frame, atEvap + 8, 16));
  const lFallBranch = clamp01(progress(frame, atErase + 6, 16));
  return (
    <AbsoluteFill>
      {/* 双轨背板（左红右绿恒定） */}
      <AblationSplit
        litP={rise}
        leftP={rise}
        rightP={rise}
        leftTitle="旁路强删"
        leftSub="discard_changes=true · branch -D"
        rightTitle="守卫在位"
        rightSub="默认拒绝"
      />
      {/* ── 右轨（绿——实测基线）── */}
      {/* 房 + 分支线（俱在——绿锁定描边） */}
      <RoomCard x={R.room.x} y={R.room.y} w={R.room.w} h={R.room.h} fenceP={green} flashP={greenPulse * 0.5} tone={theme.ok} />
      <BranchLine x1={R.line.x1} y1={R.line.y1} x2={R.line.x2} y2={R.line.y2} drawP={1} litP={green} />
      {/* 未提交文件点（入房——俱在） */}
      <div style={{position: 'absolute', left: R.fileDot.x, top: R.fileDot.y, opacity: fileIn * (1 - 0)}}>
        <span style={{display: 'inline-block', width: 16, height: 16, borderRadius: '50%', background: theme.ok, opacity: 0.9}} />
        <span style={{fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.ok, marginLeft: 8, whiteSpace: 'nowrap'}}>未提交文件</span>
      </div>
      {/* 守卫在位（右轨——钢青盾形） */}
      <GuardBadge x={R.guard.x} y={R.guard.y} size={130} litP={rise} label="守卫" />
      {/* 拆房指令签（落下——被拒） */}
      <RemoveSign x={R.sign.x} y={R.sign.y + 90} dropP={drop} tone={theme.ok} />
      {/* 报错条（默认拒绝——弹现，右轨有、左轨无的对照物） */}
      {err > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: R.err.x,
            top: R.err.y - (1 - err) * 16,
            padding: '10px 22px',
            borderRadius: 10,
            border: `3px solid ${withAlpha(theme.ok, 0.9)}`,
            background: withAlpha(theme.panel, 0.97),
            fontFamily: theme.sans,
            fontSize: 20,
            fontWeight: 700,
            color: theme.ok,
            whiteSpace: 'nowrap',
            opacity: err,
          }}
        >
          拒绝 · 房和线都在
        </div>
      ) : null}
      {/* 右轨计数（拒绝 1 / 文件 1 / 房 1 / 线 1——俱在恒 1） */}
      <LaneCounts
        x={R.counts.x}
        y={R.counts.y}
        tone={theme.ok}
        rows={[
          {label: '拒绝', value: frame >= atErr ? 1 : 0},
          {label: '文件', value: 1},
          {label: '房', value: 1},
          {label: '线', value: 1},
        ]}
      />
      {/* ── 左轨（红——旁路强删）── */}
      {/* 整轨泛红一沉（连坐时刻——重音镜 punch） */}
      <div style={{position: 'absolute', left: CHECK_LANES.left.x, top: CHECK_LANES.left.y, width: CHECK_LANES.left.w, height: CHECK_LANES.left.h, borderRadius: 16, background: withAlpha(theme.danger, 0.09 * sink), transform: `translateY(${sink * 10}px)`, pointerEvents: 'none'}} />
      {/* 守卫位（被绕开——dashed 虚槽，非删除） */}
      <GuardBadge x={L.guard.x} y={L.guard.y} size={130} litP={rise * (1 - bypass * 0.6)} voidP={bypass} label="守卫被绕开" />
      {/* 房（虚化消失） */}
      <RoomCard x={L.room.x} y={L.room.y} w={L.room.w} h={L.room.h} vanishP={vanish} />
      {/* 分支线（连坐抹掉——自房端向账本端回吞+红闪） */}
      <BranchLine x1={L.line.x1} y1={L.line.y1} x2={L.line.x2} y2={L.line.y2} drawP={1} eraseP={erase} />
      {/* 未提交文件点（无声蒸发——无报错条） */}
      <div style={{position: 'absolute', left: L.fileDot.x, top: L.fileDot.y - evap * 40, opacity: (1 - evap) * (frame >= atBypass ? 1 : 0)}}>
        <span style={{display: 'inline-block', width: 16, height: 16, borderRadius: '50%', background: theme.danger, opacity: 0.9}} />
        <span style={{fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.danger, marginLeft: 8, whiteSpace: 'nowrap'}}>未提交文件</span>
      </div>
      {/* 拆房指令签（越过守卫位直落——轨迹上抬绕过守卫槽） */}
      <RemoveSign x={L.sign.x} y={L.sign.y + 90} dropP={lDrop} tone={theme.danger} />
      {/* 左轨计数（文件 1→0 蒸发 / 分支 1→0 连坐——跌落有轨迹） */}
      <LaneCounts
        x={L.counts.x}
        y={L.counts.y}
        tone={theme.danger}
        rows={[
          {label: '文件', value: lFile, fallP: lFallFile},
          {label: '分支', value: lBranch, fallP: lFallBranch},
        ]}
      />
      {/* 教训短签（定格对照后上浮——护住收尾 ＞ 建得快） */}
      {lesson > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 660,
            top: 96,
            padding: '12px 30px',
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.text, 0.75)}`,
            background: withAlpha(theme.panel, 0.98),
            fontFamily: theme.serif,
            fontSize: 27,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: lesson,
            transform: `translateY(${(1 - lesson) * -18}px)`,
            zIndex: 3,
          }}
        >
          护住收尾 ＞ 建得快
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7 * (1 - lesson * 0.6)}}>
        {'左：无声蒸发+连坐 ↔ 右：默认拒绝+俱在'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-D 事件日志条带（建/拆/留追加）+ 拉远起势（生产版虚影） ────────────────────

/** 3-D 布局（安全带实算：条带底 510 / 虚影拱底 840 / 暗层主装置底 ≈ 560） */
const BAND_3D = {x: 160, y: 380, w: 1600, h: 130} as const;
const ARCH_3D = [
  {x: 700, y: 700, w: 190, h: 140},
  {x: 1100, y: 700, w: 190, h: 140},
] as const;

const ThreeD: React.FC<{atBand: number; atThree: number; atAppend: number; atScan: number; atZoom: number}> = ({
  atBand,
  atThree,
  atAppend,
  atScan,
  atZoom,
}) => {
  const frame = useCurrentFrame();
  // 条带横贯亮出
  const band = clamp01(progress(frame, atBand, 14));
  // 三色小事件签各闪一拍（建/拆/留——初始三条）
  const evP = (i: number) => clamp01(progress(frame, atThree + i * 6, 8));
  // 新事件实时滚入带尾（追加语义：只增不改）
  const append = clamp01(progress(frame, atAppend, 12));
  // 放大镜扫过 + 扫中事件高亮
  const scan = clamp01(progress(frame, atScan, 22));
  // 拉远（@pushIn 负增量）+ 深处生产版双入口虚影
  const zoom = ease(clamp01(progress(frame, atZoom, 18)));
  const ghost = clamp01(progress(frame, atZoom + 8, 14));
  const events = [
    {kind: 'build' as const, p: evP(0)},
    {kind: 'remove' as const, p: evP(1)},
    {kind: 'keep' as const, p: evP(2)},
    {kind: 'build' as const, p: append},
  ];
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${1 - 0.12 * zoom})`, transformOrigin: '50% 44%'}}>
        {/* 镜深处主装置暗层（账本+房剪影——静驻） */}
        <div style={{position: 'absolute', opacity: 0.3}}>
          <LedgerBlock x={865} y={150} w={190} h={330} dimP={0.8} ghost slots={0} />
          <RoomCard x={560} y={260} w={150} h={130} litP={0.5} />
          <RoomCard x={1210} y={260} w={150} h={130} litP={0.5} />
        </div>
        {/* 事件日志条带（建/拆/留三色——只追加） */}
        <EventLogBand x={BAND_3D.x} y={BAND_3D.y} w={BAND_3D.w} h={BAND_3D.h} litP={band} events={events} scanP={scan} scanIdx={1} />
        {/* 生产版双入口舞台虚影（更深处显形——禁显机制细节） */}
        {ARCH_3D.map((a, i) => (
          <div key={`ar${i}`} style={{position: 'absolute', left: a.x, top: a.y, width: a.w, height: a.h, opacity: ghost * 0.35}}>
            <svg width={a.w} height={a.h} viewBox={`0 0 ${a.w} ${a.h}`}>
              <path d={`M8 ${a.h} V ${a.h * 0.42} A ${a.w / 2 - 8} ${a.h * 0.42} 0 0 1 ${a.w - 8} ${a.h * 0.42} V ${a.h}`} fill="none" stroke={theme.dim} strokeWidth={4} strokeDasharray="10 9" />
            </svg>
          </div>
        ))}
        {ghost > 0.3 ? (
          <div style={{position: 'absolute', left: 0, right: 0, top: ARCH_3D[0].y - 44, textAlign: 'center', fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap', opacity: ghost * 0.7}}>
            真实版 · 两个入口（下幕）
          </div>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'events.jsonl · 建拆留，每步追加一条'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P3ThreeExits: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p3-01', 'p3-02');
  const bB = w('p3-03', 'p3-04');
  const bC = w('p3-05', 'p3-07');
  const bD = w('p3-08', 'p3-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <ThreeA
          atCntL={wa('p3-01', 0.04) - bA.from}
          atJump={wa('p3-01', 0.40) - bA.from}
          atCntR={wa('p3-01', 0.57) - bA.from}
          atUp={wa('p3-02', 0.16) - bA.from}
          atCap={wa('p3-02', 0.40) - bA.from}
          atCapVoid={wa('p3-02', 0.80) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="3-B">
        <ThreeB
          atMini={wa('p3-03', 0.14) - bB.from}
          atGate1={wa('p3-03', 0.35) - bB.from}
          atNum1={wa('p3-03', 0.85) - bB.from}
          atGate2={wa('p3-04', 0.05) - bB.from}
          atConfirm={wa('p3-04', 0.52) - bB.from}
          atGate3={wa('p3-04', 0.70) - bB.from}
          atKeep={wa('p3-04', 0.90) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="3-C">
        <ThreeC
          atFileIn={wa('p3-05', 0.14) - bC.from}
          atDrop={wa('p3-05', 0.36) - bC.from}
          atErr={wa('p3-05', 0.58) - bC.from}
          atGreen={wa('p3-05', 0.76) - bC.from}
          atBypass={wa('p3-06', 0.10) - bC.from}
          atVanish={wa('p3-06', 0.34) - bC.from}
          atEvap={wa('p3-06', 0.56) - bC.from}
          atErase={wa('p3-06', 0.76) - bC.from}
          atSink={wa('p3-06', 0.88) - bC.from}
          atLesson={wa('p3-07', 0.45) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="3-D">
        <ThreeD
          atBand={wa('p3-08', 0.16) - bD.from}
          atThree={wa('p3-08', 0.40) - bD.from}
          atAppend={wa('p3-08', 0.80) - bD.from}
          atScan={wa('p3-09', 0.50) - bD.from}
          atZoom={wa('p3-10', 0.20) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3ThreeExits;
