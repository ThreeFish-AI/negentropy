/** P2 两条红线（p2-01..20，4 镜 7 cue）——分镜 2-A…2-D。
 *
 *  ★ 三镜图镜（2-A/2-C/2-D）全屏独占；空窗句回落自制装置（嵌套范式：装置窗
 *    与 cue 窗按句区间互不重叠，无需 ArchifyYield）——2-A p2-01 纸面互锁首现 /
 *    p2-03 出菜口小票；2-C p2-14..15 门口快递；2-D p2-19..20 两道保险收束卡
 *    （画面数字 9,009→137 由图章承载，场景层不重复）。
 *  ★ 2-B 正反同屏消融台（本幕唯一场景镜，左坏右好〔X-001〕）：右好=切点回退
 *    两拍→整对越过绿章；左坏=剪刀两拍拆回退→断裂 Counter 0→1→校验红章；
 *    下缘「等批次完成」锁定按钮（工具进度条走完前灰锁）。
 *  lead 清单：2-A 幕界后首镜默认 lead；2-C 前镜为场景镜默认 lead；
 *    2-D 前镜 2-C 亦为 unseen-guard 实例 ⇒ lead={false}（跨实例接缝防重入弹簧）。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Counter, Footnote, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {MapAnchorChip} from '../components/map-anchor';
import {DUR, useBreathe, useDraw, useEnter, useProgress, useSpring, useStagger} from '../motion';
import type {DrawProps} from '../motion';

// ── 共用小件 ─────────────────────────────────────────────────────────────

/** 编号环（纯展示件：描线进度与透明度由调用方 hooks 传入，各互锁装置共用） */
const RingBadge: React.FC<{
  num: string;
  size?: number;
  o?: number;
  d?: DrawProps;
  color?: string;
}> = ({num, size = 44, o = 1, d, color}) => {
  const c = color ?? theme.text;
  return (
    <div style={{width: size, height: size, position: 'relative', opacity: o, flexShrink: 0}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{position: 'absolute', left: 0, top: 0}}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 4}
          fill="none"
          stroke={c}
          strokeWidth={3}
          {...(d ?? {pathLength: 1, strokeDasharray: 1, strokeDashoffset: 0})}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.mono,
          fontSize: Math.round(size * 0.42),
          color: c,
        }}
      >
        {num}
      </div>
    </div>
  );
};

/** 剪刀（示意件：两环柄 + 交叉刃；颜色经参数传入） */
const Scissors: React.FC<{color: string; size?: number}> = ({color, size = 46}) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <circle cx={12} cy={12} r={7} fill="none" stroke={color} strokeWidth={4} />
    <circle cx={12} cy={36} r={7} fill="none" stroke={color} strokeWidth={4} />
    <line x1={17} y1={17} x2={42} y2={42} stroke={color} strokeWidth={4} strokeLinecap="round" />
    <line x1={17} y1={31} x2={42} y2={16} stroke={color} strokeWidth={4} strokeLinecap="round" />
  </svg>
);

/** 锁扣（锁定/解锁两形态；解锁=锁环掀起旋转） */
const LockGlyph: React.FC<{open: boolean; color: string}> = ({open, color}) => (
  <svg width={24} height={28} viewBox="0 0 24 28">
    <rect x={3.5} y={13} width={17} height={11} rx={2.5} fill="none" stroke={color} strokeWidth={2.6} />
    {open ? (
      <path
        d="M7 13 V9.5 a5 5 0 0 1 10 0 V11.5"
        transform="rotate(-30 17 13)"
        fill="none"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    ) : (
      <path d="M7 13 V9.5 a5 5 0 0 1 10 0 V13" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
    )}
  </svg>
);

/** 裁定章：双线框 + 旋转，snap 弹入（空间弹簧，opacity 走 effects 通道） */
const VerdictStamp: React.FC<{text: string; color: string; at: number; x: number; y: number}> = ({
  text,
  color,
  at,
  x,
  y,
}) => {
  const e = useEnter('pop', {at, springPreset: 'snap', dur: DUR.f4});
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: e.opacity, transform: `${e.transform} rotate(-7deg)`}}>
      <div style={{border: `3px solid ${color}`, borderRadius: 10, padding: 3}}>
        <div
          style={{
            border: `1.5px solid ${color}`,
            borderRadius: 6,
            padding: '8px 20px',
            fontFamily: theme.sans,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 6,
            color,
            whiteSpace: 'nowrap',
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
};

// ── 2-A p2-01 空窗回落：纸面配对互锁首现 ────────────────────────────────

/** 一对消息卡 + 右缘编号环互锁连线（进度全由调用方传入，本件零 hooks） */
const PairRow: React.FC<{
  num: string;
  oUse: number;
  oRes: number;
  ringO: number;
  ringD: DrawProps;
  connS: number;
  marginTop: number;
}> = ({num, oUse, oRes, ringO, ringD, connS, marginTop}) => (
  <div style={{position: 'relative', marginTop}}>
    <div style={{opacity: oUse, transform: `translateY(${(1 - oUse) * 14}px)`}}>
      <div
        style={{
          height: 64,
          borderRadius: 10,
          border: `2px solid ${theme.panelBorder}`,
          background: theme.panel,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px 0 20px',
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.text}}>{'tool_use'}</span>
        <RingBadge num={num} size={44} o={ringO} d={ringD} />
      </div>
    </div>
    <div style={{marginTop: 10, opacity: oRes, transform: `translateY(${(1 - oRes) * 14}px)`}}>
      <div
        style={{
          height: 64,
          borderRadius: 10,
          border: `2px solid ${theme.panelBorder}`,
          background: theme.panel,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px 0 20px',
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>{'tool_result'}</span>
        <RingBadge num={num} size={44} o={ringO} d={ringD} />
      </div>
    </div>
    {/* 互锁连线：右缘两枚同号环之间纵向扣合（right 对齐环心：环 44/2 + 右衬 12 − 线宽/2） */}
    <div
      style={{
        position: 'absolute',
        right: 32.5,
        top: 32,
        width: 3,
        height: 84,
        background: theme.text,
        transformOrigin: 'top',
        transform: `scaleY(${connS})`,
        opacity: 0.95,
      }}
    />
  </div>
);

const PairStrip: React.FC = () => {
  const paper = useEnter('rise', {at: 0, dur: DUR.f5, dist: 28});
  const rows = useStagger(5, {at: 4, dur: DUR.f4, stride: 6});
  // 行落定后的「互锁齐扣」时刻：四环描线 + 两连线同帧扣合
  const ringO = useProgress(38, DUR.f3);
  const ringD = useDraw(38, DUR.f5);
  const connS = useProgress(38, DUR.f5, 'decelerate');
  const note = useProgress(54, DUR.f3);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 470, top: 206, width: 980, opacity: paper.opacity, transform: paper.transform}}>
        <Panel style={{padding: '24px 36px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'messages'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, opacity: 0.85}}>
              {'tool_use ↔ tool_result'}
            </span>
          </div>
          {/* 用户话条 */}
          <div style={{marginTop: 22, opacity: rows[0], transform: `translateY(${(1 - rows[0]) * 12}px)`}}>
            <div style={{width: 470, height: 18, borderRadius: 9, border: `2px solid ${theme.panelBorder}`}} />
          </div>
          <PairRow num={'01'} oUse={rows[1]} oRes={rows[2]} ringO={ringO} ringD={ringD} connS={connS} marginTop={18} />
          <PairRow num={'02'} oUse={rows[3]} oRes={rows[4]} ringO={ringO} ringD={ringD} connS={connS} marginTop={20} />
        </Panel>
        <div
          style={{
            marginTop: 20,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 23,
            color: theme.dim,
            opacity: note,
          }}
        >
          {'调用与结果 · 同一编号互锁'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 2-A p2-03 空窗回落：出菜口小票（菜挂小票 · 对账比喻） ────────────────

const TicketRail: React.FC = () => {
  const shelf = useDraw(0, DUR.f5);
  const plates = useStagger(2, {at: 8, dur: DUR.f4, stride: 8});
  const tickets = useStagger(2, {at: 18, dur: DUR.f4, stride: 8});
  const lit1 = useProgress(30, DUR.f4);
  const lit2 = useProgress(38, DUR.f4);
  const cap = useProgress(46, DUR.f3);
  const plate = (i: number, cx: number): React.ReactNode => (
    <div
      key={cx}
      style={{
        position: 'absolute',
        left: cx - 48,
        top: 308,
        width: 96,
        height: 96,
        borderRadius: '50%',
        border: `2.5px solid ${theme.text}`,
        background: theme.panel,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.mono,
        fontSize: 24,
        color: theme.text,
        opacity: plates[i],
        transform: `translateY(${(1 - plates[i]) * 18}px)`,
      }}
    >
      {String(i + 1).padStart(2, '0')}
    </div>
  );
  const ticket = (i: number, cx: number): React.ReactNode => (
    <div
      key={`t${cx}`}
      style={{
        position: 'absolute',
        left: cx - 46,
        top: 448,
        width: 92,
        height: 58,
        borderRadius: 6,
        border: `2px dashed ${theme.dim}`,
        background: theme.panel,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.mono,
        fontSize: 22,
        color: theme.dim,
        opacity: tickets[i],
        transform: `translateY(${(1 - tickets[i]) * -16}px)`,
      }}
    >
      {String(i + 1).padStart(2, '0')}
    </div>
  );
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 500, top: 352, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
        {'出菜口'}
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        {/* 台面 */}
        <line x1={500} y1={404} x2={1420} y2={404} stroke={theme.panelBorder} strokeWidth={5} {...shelf} />
        {/* 挂小票连线：压暗态 + 点亮态（色交叠经 opacity，effects 不吃弹簧） */}
        {[720, 1200].map((cx) => (
          <line key={`d${cx}`} x1={cx} y1={406} x2={cx} y2={448} stroke={theme.panelBorder} strokeWidth={3} />
        ))}
        <line x1={720} y1={406} x2={720} y2={448} stroke={theme.text} strokeWidth={3} opacity={lit1} />
        <line x1={1200} y1={406} x2={1200} y2={448} stroke={theme.text} strokeWidth={3} opacity={lit2} />
      </svg>
      {plate(0, 720)}
      {plate(1, 1200)}
      {ticket(0, 720)}
      {ticket(1, 1200)}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 560,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 23,
          color: theme.dim,
          opacity: cap,
        }}
      >
        {'菜必须指得回小票'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-B 正反同屏消融台（p2-07..11 全窗场景镜） ───────────────────────────

/** 消融台几何（panel 局部坐标）：双联 780×410，消息栈四行，切线三档位 */
const BENCH = {
  leftX: 120,
  rightX: 1020,
  panelTop: 210,
  panelW: 780,
  panelH: 410,
  stackX: 36,
  stackY: 74,
  cardW: 470,
  cardH: 62,
  barH: 16,
  gap: 12,
  /** 切线 y：use|result 之间 → 退一拍（旧条|use 之间）→ 退两拍（旧条之上） */
  cutUse: 170,
  cutOld: 96,
  cutTop: 66,
} as const;

/** 消融台两侧共用消息栈：旧条 / tool_use / tool_result / 新条（编号环右缘 + 互锁连线） */
const BenchStack: React.FC<{
  at: number;
  conn: number;
  useDy: number;
  resDy: number;
  num: string;
}> = ({at, conn, useDy, resDy, num}) => {
  const rows = useStagger(4, {at, dur: DUR.f4, stride: 5});
  const ringO = useProgress(at + 24, DUR.f3);
  const ringD = useDraw(at + 24, DUR.f5);
  const connS = useProgress(at + 24, DUR.f5, 'decelerate');
  const bar = (i: number): React.ReactNode => (
    <div style={{opacity: rows[i], transform: `translateY(${(1 - rows[i]) * 14}px)`}}>
      <div style={{width: 280, height: BENCH.barH, borderRadius: 8, border: `2px solid ${theme.panelBorder}`}} />
    </div>
  );
  const card = (i: number, dy: number, label: string, labelColor: string): React.ReactNode => (
    <div style={{marginTop: BENCH.gap, opacity: rows[i], transform: `translateY(${(1 - rows[i]) * 16}px)`}}>
      <div
        style={{
          height: BENCH.cardH,
          transform: `translateY(${dy}px)`,
          borderRadius: 10,
          border: `2px solid ${theme.panelBorder}`,
          background: theme.panel,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px 0 20px',
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 24, color: labelColor}}>{label}</span>
        <RingBadge num={num} size={40} o={ringO} d={ringD} />
      </div>
    </div>
  );
  return (
    <div style={{position: 'absolute', left: BENCH.stackX, top: BENCH.stackY, width: BENCH.cardW}}>
      {bar(0)}
      {card(1, useDy, 'tool_use', theme.text)}
      {card(2, resDy, 'tool_result', theme.dim)}
      <div style={{marginTop: BENCH.gap}}>{bar(3)}</div>
      {/* 互锁连线（断裂时由父层把 conn 压到 0；left 对齐环心：cardW − 右衬 12 − 环 40/2 − 线宽/2） */}
      <div
        style={{
          position: 'absolute',
          left: BENCH.cardW - 33.5,
          top: BENCH.barH + BENCH.gap + BENCH.cardH / 2,
          width: 3,
          height: BENCH.cardH + BENCH.gap,
          background: theme.text,
          transformOrigin: 'top',
          transform: `scaleY(${connS})`,
          opacity: conn,
        }}
      />
    </div>
  );
};

/** 左联（坏）：剪刀两拍滑入斩断 → 卡对分离 + 连线撕断 + 断裂计数 0→1 + 校验红章 */
const LeftBreak: React.FC<{atWarn: number; atBreak: number; durBreak: number}> = ({
  atWarn,
  atBreak,
  durBreak,
}) => {
  const conn = useProgress(26, DUR.f4);
  // p2-10 预警：两枚后果小条 + 剪刀悬停（压暗）
  const chips = useStagger(2, {at: atWarn + 6, dur: DUR.f4, stride: 8});
  const hover = useProgress(atWarn + 24, DUR.f4);
  // p2-11 执行：两拍滑入（加速档）→ 斩下
  const tLunge1 = atBreak + Math.round(durBreak * 0.26);
  const tLunge2 = atBreak + Math.round(durBreak * 0.46);
  const tCut = tLunge2 + DUR.f4;
  const s1 = useProgress(tLunge1, DUR.f4, 'accelerate');
  const s2 = useProgress(tLunge2, DUR.f4, 'accelerate');
  const strike = useProgress(tCut, DUR.f3);
  const sep = useSpring('settle', {at: tCut, dur: DUR.f5});
  const tear = useDraw(tCut, DUR.f4);
  const counterO = useProgress(tCut + 2, DUR.f3);
  const cutX = 2 + 200 * s1 + 210 * s2;
  return (
    <>
      <BenchStack at={14} conn={conn * (1 - strike)} useDy={-14 * sep} resDy={20 * sep} num={'01'} />
      {/* 切线：不回退，斩下时压暗态上叠红线（色交叠经 opacity） */}
      <div style={{position: 'absolute', left: 28, top: BENCH.cutUse - 2, width: 486}}>
        <div style={{borderTop: `3px dashed ${theme.dim}`, opacity: 0.9}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: -1.5, height: 3, background: theme.danger, opacity: strike}} />
      </div>
      {/* 剪刀：悬停压暗 → 两拍滑入 → 斩下变红（两态叠放交叉淡化） */}
      <div style={{position: 'absolute', left: 2, top: BENCH.cutUse - 24, transform: `translateX(${cutX}px)`}}>
        <div style={{opacity: hover * (1 - strike)}}>
          <Scissors color={theme.dim} />
        </div>
        <div style={{position: 'absolute', left: 0, top: 0, opacity: hover * strike}}>
          <Scissors color={theme.danger} />
        </div>
      </div>
      {/* 撕断 ✕：叠在互锁连线中点 */}
      <svg width={60} height={44} viewBox="0 0 60 44" style={{position: 'absolute', left: 444, top: 148, opacity: strike}}>
        <line x1={8} y1={6} x2={52} y2={38} stroke={theme.danger} strokeWidth={5} strokeLinecap="round" {...tear} />
        <line x1={52} y1={6} x2={8} y2={38} stroke={theme.danger} strokeWidth={5} strokeLinecap="round" {...tear} />
      </svg>
      {/* 后果小条（p2-10） */}
      <div style={{position: 'absolute', left: 36, top: 296, display: 'flex', gap: 12}}>
        {[{t: '结果对不上账', i: 0}, {t: '执行记录被丢', i: 1}].map(({t, i}) => (
          <div key={t} style={{opacity: chips[i], transform: `translateY(${(1 - chips[i]) * 14}px)`}}>
            <div
              style={{
                border: `2px solid ${theme.danger}`,
                borderRadius: 8,
                padding: '7px 14px',
                fontFamily: theme.sans,
                fontSize: 22,
                color: theme.dim,
                background: theme.panel,
                opacity: 0.85,
              }}
            >
              {t}
            </div>
          </div>
        ))}
      </div>
      {/* 断裂计数 0→1（跳红） */}
      <div
        style={{
          position: 'absolute',
          left: 36,
          top: 348,
          display: 'flex',
          alignItems: 'baseline',
          gap: 16,
          opacity: counterO,
        }}
      >
        <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>{'断裂'}</span>
        <Counter from={0} to={1} start={tCut + 4} frames={10} style={{fontSize: 52, fontWeight: 700, color: theme.danger}} />
      </div>
      <VerdictStamp text={'校验报错'} color={theme.danger} at={tCut + 16} x={556} y={296} />
    </>
  );
};

/** 右联（好）：切线两拍回退（留脚印）→ 保留区点亮 + 整对绿框 → 整对越过绿章 */
const RightRetreat: React.FC<{atRight: number; durRight: number}> = ({atRight, durRight}) => {
  const conn = useProgress(29, DUR.f4);
  const hop1 = useProgress(atRight + Math.round(durRight * 0.22), DUR.f5, 'decelerate');
  const hop2 = useProgress(atRight + Math.round(durRight * 0.5), DUR.f5, 'decelerate');
  const zone = useProgress(atRight + Math.round(durRight * 0.68), DUR.f4);
  const bracket = useEnter('pop', {at: atRight + Math.round(durRight * 0.72), springPreset: 'snap', dur: DUR.f4});
  const lineY = BENCH.cutUse - (BENCH.cutUse - BENCH.cutOld) * hop1 - (BENCH.cutOld - BENCH.cutTop) * hop2;
  return (
    <>
      {/* 保留区：回退终点线以下淡染确认绿 */}
      <div
        style={{
          position: 'absolute',
          left: 24,
          top: BENCH.cutTop,
          width: BENCH.panelW - 48,
          height: BENCH.panelH - 12 - BENCH.cutTop,
          borderRadius: 10,
          background: theme.ok,
          opacity: 0.07 * zone,
        }}
      />
      <BenchStack at={17} conn={conn} useDy={0} resDy={0} num={'01'} />
      {/* 回退脚印：切线离开的档位留确认绿短线 */}
      <div style={{position: 'absolute', left: 240, top: BENCH.cutUse - 2, width: 28, height: 3, background: theme.ok, opacity: 0.8 * hop1}} />
      <div style={{position: 'absolute', left: 240, top: BENCH.cutOld - 2, width: 28, height: 3, background: theme.ok, opacity: 0.8 * hop2}} />
      {/* 整对绿框（越过=同侧完整） */}
      <div
        style={{
          position: 'absolute',
          left: 28,
          top: 94,
          width: 486,
          height: 152,
          borderRadius: 10,
          border: `2px solid ${theme.ok}`,
          opacity: bracket.opacity,
          transform: bracket.transform,
        }}
      />
      {/* 切线（随拍上移）+ 骑线剪刀 */}
      <div style={{position: 'absolute', left: 28, top: lineY - 2, width: 486}}>
        <div style={{borderTop: `3px dashed ${theme.dim}`, opacity: 0.9}} />
        <div style={{position: 'absolute', left: -4, top: -22}}>
          <Scissors color={theme.dim} />
        </div>
      </div>
      <VerdictStamp text={'整对越过'} color={theme.ok} at={atRight + Math.round(durRight * 0.84)} x={556} y={296} />
    </>
  );
};

/** 下缘锁定按钮：工具批次进度条走完前灰锁，走完开锁亮绿 */
const BatchLock: React.FC<{at: number; dur: number}> = ({at, dur}) => {
  const e = useEnter('rise', {at, dur: DUR.f5, dist: 24});
  const atBar = at + 8;
  const barDur = Math.round(dur * 0.66);
  const atUnlock = atBar + barDur;
  const fill = useProgress(atBar, barDur);
  const open = useProgress(atUnlock, DUR.f4);
  const goTag = useEnter('pop', {at: atUnlock + 2, springPreset: 'snap', dur: DUR.f4});
  return (
    <div style={{position: 'absolute', left: 460, top: 682, width: 1000, opacity: e.opacity, transform: e.transform}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24}}>
        <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'工具批次'}</span>
        <div
          style={{
            position: 'relative',
            width: 520,
            height: 14,
            borderRadius: 7,
            border: `2px solid ${theme.panelBorder}`,
            overflow: 'hidden',
          }}
        >
          <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${100 * fill}%`, background: theme.text}} />
        </div>
        <div style={{position: 'relative', width: 200, height: 60}}>
          {/* 锁定态 / 解锁态叠放交叉淡化 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              borderRadius: 10,
              border: `2px solid ${theme.panelBorder}`,
              background: theme.panel,
              opacity: 1 - open,
            }}
          >
            <LockGlyph open={false} color={theme.dim} />
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'压缩'}</span>
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              borderRadius: 10,
              border: `2px solid ${theme.ok}`,
              background: theme.panel,
              opacity: open,
            }}
          >
            <LockGlyph open color={theme.ok} />
            <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{'压缩'}</span>
          </div>
        </div>
        <div style={{opacity: goTag.opacity, transform: goTag.transform}}>
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 20,
              color: theme.ok,
              border: `1.5px solid ${theme.ok}`,
              borderRadius: 8,
              padding: '4px 10px',
            }}
          >
            {'可动手'}
          </span>
        </div>
      </div>
      <div style={{marginTop: 14, textAlign: 'center', fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
        {'等批次完成'}
      </div>
    </div>
  );
};

const AblationBench: React.FC<{
  atIntro: number;
  atRight: number;
  durRight: number;
  atLock: number;
  durLock: number;
  atWarn: number;
  atBreak: number;
  durBreak: number;
}> = ({atIntro, atRight, durRight, atLock, durLock, atWarn, atBreak, durBreak}) => {
  const eL = useEnter('rise', {at: atIntro, dur: DUR.f5, dist: 30});
  const eR = useEnter('rise', {at: atIntro + 3, dur: DUR.f5, dist: 30});
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: BENCH.leftX,
          top: BENCH.panelTop,
          width: BENCH.panelW,
          height: BENCH.panelH,
          opacity: eL.opacity,
          transform: eL.transform,
        }}
      >
        <Panel accent={theme.danger} style={{width: '100%', height: '100%', position: 'relative'}}>
          <div
            style={{
              position: 'absolute',
              left: 24,
              top: 16,
              fontFamily: theme.sans,
              fontSize: 25,
              fontWeight: 700,
              color: theme.danger,
            }}
          >
            {'拆掉切点回退'}
          </div>
          <LeftBreak atWarn={atWarn} atBreak={atBreak} durBreak={durBreak} />
        </Panel>
      </div>
      <div
        style={{
          position: 'absolute',
          left: BENCH.rightX,
          top: BENCH.panelTop,
          width: BENCH.panelW,
          height: BENCH.panelH,
          opacity: eR.opacity,
          transform: eR.transform,
        }}
      >
        <Panel accent={theme.ok} style={{width: '100%', height: '100%', position: 'relative'}}>
          <div
            style={{
              position: 'absolute',
              left: 24,
              top: 16,
              fontFamily: theme.sans,
              fontSize: 25,
              fontWeight: 700,
              color: theme.ok,
            }}
          >
            {'切点回退在位'}
          </div>
          <RightRetreat atRight={atRight} durRight={durRight} />
        </Panel>
      </div>
      <BatchLock at={atLock} dur={durLock} />
    </AbsoluteFill>
  );
};

// ── 2-C p2-14..15 空窗回落：门口快递（没拆的箱不许动） ───────────────────

const DoorParcels: React.FC<{atStrike: number}> = ({atStrike}) => {
  const door = useEnter('rise', {at: 2, dur: DUR.f5, dist: 24});
  const boxes = useStagger(3, {at: 10, dur: DUR.f5, stride: 8});
  const arrowO = useProgress(30, DUR.f3);
  // 「未读」小签的慢脉冲：长空窗里保持画面呼吸
  const chipPulse = useBreathe({period: 130, amp: 0.18, base: 0.82});
  const strikeO = useProgress(atStrike, DUR.f3);
  const strike = useDraw(atStrike, DUR.f5);
  const badChip = useEnter('pop', {at: atStrike + 8, springPreset: 'snap', dur: DUR.f4});
  const box = (
    i: number,
    geom: {left: number; top: number; w: number; h: number; rot: number},
  ): React.ReactNode => (
    <div
      key={i}
      style={{
        position: 'absolute',
        left: geom.left,
        top: geom.top,
        width: geom.w,
        height: geom.h,
        opacity: boxes[i],
        transform: `translateY(${(1 - boxes[i]) * 26}px) rotate(${geom.rot}deg)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 6,
          border: `2px solid ${theme.panelBorder}`,
          background: theme.panel,
        }}
      >
        <svg width="100%" height="100%" viewBox={`0 0 ${geom.w} ${geom.h}`} preserveAspectRatio="none">
          <line x1={geom.w / 2} y1={0} x2={geom.w / 2} y2={geom.h} stroke={theme.panelBorder} strokeWidth={4} />
          <line x1={0} y1={geom.h / 2} x2={geom.w} y2={geom.h / 2} stroke={theme.panelBorder} strokeWidth={4} />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 12,
            bottom: 10,
            border: `2px dashed ${theme.dim}`,
            borderRadius: 999,
            padding: '3px 10px',
            fontFamily: theme.mono,
            fontSize: 18,
            color: theme.dim,
            opacity: chipPulse,
            background: theme.bg,
          }}
        >
          {'未读'}
        </div>
      </div>
    </div>
  );
  return (
    <AbsoluteFill>
      {/* 门框 + 门板 + 门牌 */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: door.opacity, transform: door.transform}}>
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
          <line x1={1462} y1={304} x2={1848} y2={304} stroke={theme.panelBorder} strokeWidth={5} />
          <line x1={1462} y1={304} x2={1462} y2={832} stroke={theme.panelBorder} strokeWidth={5} />
          <line x1={1848} y1={304} x2={1848} y2={832} stroke={theme.panelBorder} strokeWidth={5} />
          <circle cx={1772} cy={582} r={5} fill={theme.dim} />
        </svg>
        <div style={{position: 'absolute', left: 1482, top: 320, width: 326, height: 500, borderRadius: 6, border: `2px solid ${theme.panelBorder}`, background: theme.panel}} />
      </div>
      <div style={{position: 'absolute', left: 1462, top: 252, width: 386, textAlign: 'center', fontFamily: theme.mono, fontSize: 20, color: theme.dim, opacity: door.opacity}}>
        {'下一轮调用 · 才读到'}
      </div>
      <div style={{position: 'absolute', left: 620, top: 336, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
        {'已执行 · 结果已入列'}
      </div>
      {/* 快递箱堆：底大箱 / 中箱 / 顶箱（轻转角，确定性常量） */}
      {box(0, {left: 690, top: 646, w: 330, h: 148, rot: 0})}
      {box(1, {left: 726, top: 506, w: 276, h: 140, rot: 1.2})}
      {box(2, {left: 706, top: 374, w: 300, h: 132, rot: -1.6})}
      {/* 开箱等待箭头（像素虚线＝待触发；整组淡入，不与描线归一化混用） */}
      <div style={{position: 'absolute', left: 1055, top: 516, width: 380, textAlign: 'center', fontFamily: theme.sans, fontSize: 21, color: theme.dim, opacity: arrowO}}>
        {'等被叫起来 · 才开箱'}
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: arrowO}}>
        <line x1={1060} y1={560} x2={1420} y2={560} stroke={theme.dim} strokeWidth={3} strokeDasharray="10 8" />
        <line x1={1400} y1={548} x2={1420} y2={560} stroke={theme.dim} strokeWidth={3} strokeLinecap="round" />
        <line x1={1400} y1={572} x2={1420} y2={560} stroke={theme.dim} strokeWidth={3} strokeLinecap="round" />
      </svg>
      {/* 破坏预演（p2-15 后半）：顶箱被当废纸 —— 红缘 + 斜杠 + 警示小签 */}
      <div
        style={{
          position: 'absolute',
          left: 706,
          top: 374,
          width: 300,
          height: 132,
          borderRadius: 6,
          border: `2px solid ${theme.danger}`,
          transform: 'rotate(-1.6deg)',
          opacity: 0.9 * strikeO,
        }}
      />
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: strikeO}}>
        <line x1={688} y1={366} x2={1024} y2={514} stroke={theme.danger} strokeWidth={5} strokeLinecap="round" {...strike} />
      </svg>
      <div style={{position: 'absolute', left: 1042, top: 396, opacity: badChip.opacity, transform: badChip.transform}}>
        <Panel accent={theme.danger} style={{padding: '8px 16px'}}>
          <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.danger}}>{'当废纸卖掉'}</span>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 2-D p2-19..20 空窗回落：两道保险收束卡（9,009→137 由图章承载，此处不重复） ──

const TwoGuardsClose: React.FC<{atTag: number}> = ({atTag}) => {
  const head = useProgress(2, DUR.f3);
  const c1 = useEnter('rise', {at: 6, dur: DUR.f5, dist: 30});
  const c2 = useEnter('rise', {at: 14, dur: DUR.f5, dist: 30});
  const tag = useEnter('rise', {at: atTag, dur: DUR.f6, dist: 20, springPreset: 'settle'});
  // 「机制在位」呼吸点：慢脉冲错峰
  const dot1 = useBreathe({period: 96, amp: 0.25, base: 0.75});
  const dot2 = useBreathe({period: 96, amp: 0.25, base: 0.75, offset: 48});
  const card = (
    e: {opacity: number; transform: string},
    chip: string,
    tagText: string,
    main: string,
    dot: number,
    left: number,
  ): React.ReactNode => (
    <div style={{position: 'absolute', left, top: 330, width: 560, height: 250, opacity: e.opacity, transform: e.transform}}>
      <Panel accent={theme.ok} style={{width: '100%', height: '100%', position: 'relative', padding: '24px 30px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 19,
              color: theme.text,
              border: `1.5px solid ${theme.text}`,
              borderRadius: 8,
              padding: '4px 12px',
            }}
          >
            {chip}
          </span>
          <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.ok}}>{tagText}</span>
        </div>
        <div style={{marginTop: 30, fontFamily: theme.sans, fontSize: 31, fontWeight: 600, color: theme.text}}>{main}</div>
        <div style={{position: 'absolute', right: 26, bottom: 22, width: 10, height: 10, borderRadius: '50%', background: theme.ok, opacity: dot}} />
      </Panel>
    </div>
  );
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 282,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
          opacity: head,
        }}
      >
        {'两道保险 · 各挡各的风险'}
      </div>
      {card(c1, '第一道', 'unseen 跳过', '没读过的，不许压', dot1, 360)}
      {card(c2, '第二道', '位置兜底', '队尾三条 · 原样保留', dot2, 1000)}
      {/* 收束句：两侧红线段点题「两条红线」 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 706,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          opacity: tag.opacity,
          transform: tag.transform,
        }}
      >
        <div style={{width: 96, height: 3, background: theme.danger}} />
        <span style={{fontFamily: theme.serif, fontSize: 36, color: theme.text}}>{'红线之内，腾挪才叫安全'}</span>
        <div style={{width: 96, height: 3, background: theme.danger}} />
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P2RedLines: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p2-01', 'p2-05');
  const bB = w('p2-07', 'p2-11');
  const bC = w('p2-13', 'p2-17');
  const bD = w('p2-18', 'p2-20');
  // 空窗回落装置的句窗（与 cue 窗按句区间互斥）
  const gA2 = w('p2-03');
  const gC = w('p2-14', 'p2-15');
  const gD = w('p2-19', 'p2-20');

  return (
    <AbsoluteFill>
      <MapAnchorChip active="scratchpad" />

      <Sequence {...bA} name="2-A 小票互锁">
        <SceneTag chapter="Red Lines" tagline="小票互锁 · 没读过的不压" accent={theme.danger} />
        {/* 幕界后首镜：前实例（P1 2-G）隔幕间呼吸 ⇒ 默认 lead；p2-03 空窗后 torn-reject 恢复入场 */}
        <ArchifyRecap
          slug="pairing-interlock"
          caption="小票互锁"
          cues={[
            {chapterId: 'paired-ok', at: at('p2-02') - bA.from, durationInFrames: dur('p2-02')},
            {chapterId: 'torn-reject', at: at('p2-04') - bA.from, durationInFrames: dur('p2-04')},
            {chapterId: 'retreat-fix', at: at('p2-05') - bA.from, durationInFrames: dur('p2-05')},
          ]}
        />
        {/* p2-01 空窗回落：纸面互锁首现 */}
        <Sequence durationInFrames={dur('p2-01')} name="2-A 纸面互锁首现">
          <PairStrip />
        </Sequence>
        {/* p2-03 空窗回落：出菜口小票 */}
        <Sequence from={gA2.from - bA.from} durationInFrames={gA2.durationInFrames} name="2-A 出菜口小票">
          <TicketRail />
        </Sequence>
        <Footnote delay={2}>{'tool_use_id · 编号互锁'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="2-B 拆回退消融">
        <AblationBench
          atIntro={0}
          atRight={at('p2-08') - bB.from}
          durRight={dur('p2-08')}
          atLock={at('p2-09') - bB.from}
          durLock={dur('p2-09')}
          atWarn={at('p2-10') - bB.from}
          atBreak={at('p2-11') - bB.from}
          durBreak={dur('p2-11')}
        />
        <Footnote delay={2}>{'snip_compact · 切点回退'}</Footnote>
      </Sequence>

      <Sequence {...bC} name="2-C 快递与双保险">
        {/* 前镜 2-B 为场景镜 ⇒ 默认 lead；p2-14..15 空窗后 old-swap 恢复入场，two-guards 背靠背自动抑制 */}
        <ArchifyRecap
          slug="unseen-guard"
          caption="未读保护"
          cues={[
            {chapterId: 'unseen-safe', at: at('p2-13') - bC.from, durationInFrames: dur('p2-13')},
            {chapterId: 'old-swap', at: at('p2-16') - bC.from, durationInFrames: dur('p2-16')},
            {chapterId: 'two-guards', at: at('p2-17') - bC.from, durationInFrames: dur('p2-17')},
          ]}
        />
        {/* p2-14..15 空窗回落：门口快递（含 p2-15 后半的废纸警示拍） */}
        <Sequence from={gC.from - bC.from} durationInFrames={gC.durationInFrames} name="2-C 门口快递">
          <DoorParcels atStrike={at('p2-15') - gC.from + Math.round(dur('p2-15') * 0.5)} />
        </Sequence>
        <Footnote delay={2}>{'unseen · 没读过的不压'}</Footnote>
      </Sequence>

      <Sequence {...bD} name="2-D 拆保护消融">
        {/* 前镜 2-C 亦为 unseen-guard 实例、p2-17→p2-18 帧相邻 ⇒ lead={false} */}
        <ArchifyRecap
          lead={false}
          slug="unseen-guard"
          caption="未读保护"
          cues={[{chapterId: 'guard-off', at: at('p2-18') - bD.from, durationInFrames: dur('p2-18')}]}
        />
        {/* p2-19..20 空窗回落：两道保险收束卡（数字 9,009→137 由图章承载，此处不重复） */}
        <Sequence from={gD.from - bD.from} durationInFrames={gD.durationInFrames} name="2-D 两道保险收束">
          <TwoGuardsClose atTag={at('p2-20') - gD.from + Math.round(dur('p2-20') * 0.12)} />
        </Sequence>
        <Footnote delay={2}>{'unseen · 两道保险'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2RedLines;
