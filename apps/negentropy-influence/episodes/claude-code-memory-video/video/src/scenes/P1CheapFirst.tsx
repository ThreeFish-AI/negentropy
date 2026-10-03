/** P1 便宜的先跑（p1-01..29，7 镜 8 cue）——分镜 1-A…1-G。
 *
 *  三场景镜 + 四图镜（全屏独占三分法）：
 *  - 1-A 搬家三格横移（仓储→装箱登记→清单处理）→ 下缘四格管线轮廓对位；
 *    MapAnchorChip 首镜驻场高亮草稿纸层（本幕开镜侧持有，其余镜不重挂）。
 *  - 1-B/1-E/1-G compact-pipeline（cheap-first / bypass+batch-wait / reactive）
 *    与 1-F batch-walkthrough 四章接力为图镜；1-F 前镜 1-E、1-G 前镜 1-F 皆图镜
 *    → 两实例 lead={false}（分镜 lead 清单：跨实例接缝防重入弹簧）。
 *  - 1-C 纸卷裁中段（画面字 50/3/46；@draw 裁切线 + 中段块平移入归档柜）。
 *  - 1-D 旧结果换地址（量尺指针 @count 压向 80% 刻度·账单金；未读批防护罩 @enter:pop）。
 *  图镜非锚句（p1-08/09、p1-18/19、p1-25b、p1-27/29）不设自制回落装置：cue 窗按
 *  dur 求和扩窗、fit:'hold' 盖满末帧（零空屏），由覆盖门对账。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {DUR, progress, useBreathe, useCount, useDraw, useEnter, useImpulse, useProgress, useStagger} from '../motion';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {MapAnchorChip} from '../components/map-anchor';
import {ArchifyRecap} from '../components/ArchifyRecap';

// ── 1-A 搬家三格 + 四格管线轮廓对位 ────────────────────────────────────────

const MOVES = [
  {title: '仓储', sub: '大家具原样搬进 · 随时取回'},
  {title: '装箱登记', sub: '装箱贴标签 · 登记在册'},
  {title: '清单处理', sub: '写一张清单 · 处理原件'},
] as const;

const PIPE = [
  {code: 'L1', name: '落盘收据', tag: '零成本'},
  {code: 'L2', name: '裁中段', tag: '零成本'},
  {code: 'L3', name: '换地址', tag: '零成本'},
  {code: 'L4', name: '模型摘要', tag: '调模型 · 贵'},
] as const;

/** 搬家步 glyph（灰白系线稿——类比层不占概念色） */
const MoveGlyph: React.FC<{kind: number}> = ({kind}) => (
  <svg width={46} height={46} viewBox="0 0 48 48" style={{opacity: 0.85}}>
    {kind === 0 && (
      <>
        <path d="M7 21 L24 7 L41 21" fill="none" stroke={theme.dim} strokeWidth={3} strokeLinejoin="round" />
        <rect x="11" y="21" width="26" height="19" rx="2" fill="none" stroke={theme.dim} strokeWidth={3} />
      </>
    )}
    {kind === 1 && (
      <>
        <rect x="8" y="16" width="26" height="26" rx="3" fill="none" stroke={theme.dim} strokeWidth={3} />
        <path d="M8 16 L21 8 L34 16" fill="none" stroke={theme.dim} strokeWidth={3} strokeLinejoin="round" />
        <rect x="32" y="6" width="11" height="11" rx="2" fill="none" stroke={theme.dim} strokeWidth={2.4} />
      </>
    )}
    {kind === 2 && (
      <>
        <rect x="12" y="6" width="24" height="36" rx="3" fill="none" stroke={theme.dim} strokeWidth={3} />
        <line x1={18} y1={16} x2={30} y2={16} stroke={theme.dim} strokeWidth={2.6} />
        <line x1={18} y1={23} x2={30} y2={23} stroke={theme.dim} strokeWidth={2.6} />
        <line x1={18} y1={30} x2={26} y2={30} stroke={theme.dim} strokeWidth={2.6} />
        <line x1={15} y1={36} x2={33} y2={12} stroke={theme.text} strokeWidth={2} strokeDasharray="4 4" opacity={0.8} />
      </>
    )}
  </svg>
);

/** 1-A 主装置：三格横移地图（@stagger 逐句滑入）+ p1-05 四格管线对位（@enter:rise）。 */
const MovingMap: React.FC<{
  q1At: number;
  cardAts: readonly number[];
  archiveAt: number;
  pipeAt: number;
}> = ({q1At, cardAts, archiveAt, pipeAt}) => {
  const frame = useCurrentFrame();
  const q1In = useProgress(q1At, DUR.f3);
  const q1Out = useProgress(cardAts[0], DUR.f3);
  const slots = useProgress(10, DUR.f4);
  // 三格横移：slideL（自左侧 −120px 起步向右滑入落位，新卡自左邻背后钻出）+ settle 弹簧（铁律②局部帧）
  const e0 = useEnter('slideL', {at: cardAts[0], dist: 120, dur: DUR.f5, springPreset: 'settle'});
  const e1 = useEnter('slideL', {at: cardAts[1], dist: 120, dur: DUR.f5, springPreset: 'settle'});
  const e2 = useEnter('slideL', {at: cardAts[2], dist: 120, dur: DUR.f5, springPreset: 'settle'});
  const enters = [e0, e1, e2];
  const arch = useEnter('pop', {at: archiveAt, dur: DUR.f4, springPreset: 'settle'});
  const arrow1 = useProgress(cardAts[1], DUR.f4);
  const arrow2 = useProgress(cardAts[2], DUR.f4);
  const axis = useProgress(pipeAt + DUR.f3, DUR.f4);
  const st = useStagger(4, {at: pipeAt + DUR.f3, dur: DUR.f4, stride: 6, easing: 'decelerate'});
  // 对位虚线：三格 → 前三格管线（L4 无搬家对位，独立收尾）
  const c0 = useProgress(pipeAt + 26, DUR.f4);
  const c1 = useProgress(pipeAt + 31, DUR.f4);
  const c2 = useProgress(pipeAt + 36, DUR.f4);
  const conns = [c0, c1, c2];

  return (
    <AbsoluteFill>
      {/* 第一问回收字条（p1-01 驻场，首格滑入即让位） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 198,
          display: 'flex',
          justifyContent: 'center',
          opacity: q1In * (1 - q1Out),
        }}
      >
        <div
          style={{
            padding: '8px 24px',
            borderRadius: 999,
            border: `2px solid ${theme.panelBorder}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 24,
          }}
        >
          <span style={{color: theme.text, fontWeight: 600}}>{'第一问'}</span>
          <span style={{color: theme.dim}}>{' · 跑一整天不崩'}</span>
        </div>
      </div>

      {/* 三格：虚线占位 → 逐句滑入点亮 */}
      {MOVES.map((m, i) => {
        const left = 240 + i * 510;
        const gone = progress(frame, cardAts[i], DUR.f2);
        const e = enters[i];
        return (
          <React.Fragment key={m.title}>
            <div
              style={{
                position: 'absolute',
                left,
                top: 350,
                width: 420,
                height: 220,
                borderRadius: 14,
                border: `2px dashed ${theme.panelBorder}`,
                opacity: slots * (1 - gone),
              }}
            />
            <div
              style={{
                position: 'absolute',
                left,
                top: 350,
                width: 420,
                height: 220,
                opacity: e.opacity,
                transform: e.transform,
              }}
            >
              <Panel style={{width: '100%', height: '100%', padding: '24px 28px'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                  <MoveGlyph kind={i} />
                  <div>
                    <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>
                      {`0${i + 1}`}
                    </div>
                    <div
                      style={{
                        fontFamily: theme.sans,
                        fontSize: 32,
                        fontWeight: 700,
                        color: theme.text,
                        marginTop: 2,
                      }}
                    >
                      {m.title}
                    </div>
                  </div>
                </div>
                <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 20}}>
                  {m.sub}
                </div>
              </Panel>
              {i === 2 && (
                <div style={{position: 'absolute', right: -12, top: -16, opacity: arch.opacity, transform: arch.transform}}>
                  <div
                    style={{
                      padding: '6px 14px',
                      borderRadius: 999,
                      border: `2px solid ${theme.ok}`,
                      background: theme.panel,
                      fontFamily: theme.sans,
                      fontSize: 19,
                      color: theme.ok,
                    }}
                  >
                    {'原件已归档'}
                  </div>
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}

      {/* 卡间推进箭头 + 三格→管线对位虚线 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <g opacity={arrow1 * 0.9}>
          <line x1={668} y1={460} x2={728} y2={460} stroke={theme.dim} strokeWidth={3} />
          <polygon points="728,452 742,460 728,468" fill={theme.dim} />
        </g>
        <g opacity={arrow2 * 0.9}>
          <line x1={1178} y1={460} x2={1238} y2={460} stroke={theme.dim} strokeWidth={3} />
          <polygon points="1238,452 1252,460 1238,468" fill={theme.dim} />
        </g>
        {[0, 1, 2].map((i) => (
          <line
            key={i}
            x1={450 + i * 510}
            y1={578}
            x2={411 + i * 366}
            y2={726}
            stroke={theme.dim}
            strokeWidth={2}
            strokeDasharray="7 7"
            opacity={conns[i] * 0.75}
          />
        ))}
      </svg>

      {/* 成本轴 + 四格管线轮廓（p1-05 对位点亮；L4=贵的一步走账单金） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 700,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 19,
          opacity: axis,
        }}
      >
        <span style={{color: theme.dim}}>{'便宜 ──────────── '}</span>
        <span style={{color: theme.accent}}>{'贵'}</span>
      </div>
      {PIPE.map((p, i) => {
        const left = 246 + i * 366;
        const gold = i === 3;
        return (
          <div
            key={p.code}
            style={{
              position: 'absolute',
              left,
              top: 730,
              width: 330,
              opacity: st[i],
              transform: `translateY(${(1 - st[i]) * 24}px)`,
            }}
          >
            <Panel accent={gold ? theme.accent : undefined} style={{height: 118, padding: '16px 20px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span style={{fontFamily: theme.mono, fontSize: 18, color: gold ? theme.accent : theme.dim}}>
                  {p.code}
                </span>
                <span
                  style={{
                    fontFamily: theme.mono,
                    fontSize: 15,
                    color: gold ? theme.accent : theme.dim,
                    border: `1px solid ${gold ? theme.accent : theme.panelBorder}`,
                    borderRadius: 8,
                    padding: '3px 10px',
                  }}
                >
                  {p.tag}
                </span>
              </div>
              <div
                style={{
                  fontFamily: theme.sans,
                  fontSize: 27,
                  fontWeight: 600,
                  color: theme.text,
                  marginTop: 12,
                }}
              >
                {p.name}
              </div>
            </Panel>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── 1-C 纸卷裁中段（画面字 50/3/46） ──────────────────────────────────────

const CELL_N = 60; // 轴向条目总数（示意）：首 3 + 中 11 + 尾 46
const CELL_X0 = 220;
const CELL_PITCH = 25;
const CELL_W = 23;
const MID_FROM = 3; // 中段（归档）条目下标区间 [MID_FROM, MID_TO]
const MID_TO = 13;

/** 单格：kept=true 时叠加高亮带（灰白系 tint——草稿纸层不占概念色）。
 *  ox/oy=所在坐标系原点：顶层格走画布原点（CELL_X0,470）；中段块 wrapper 内
 *  的格走 wrapper 原点（0,0）——wrapper 自身已定位在 (midLeft,470)，子格若再带
 *  画布坐标会双重叠加（含 containing block 陷阱）。 */
const RollCell: React.FC<{i: number; shown: number; kept: boolean; bands: number; ox?: number; oy?: number}> = ({
  i,
  shown,
  kept,
  bands,
  ox = CELL_X0,
  oy = 470,
}) => (
  <div
    style={{
      position: 'absolute',
      left: ox + i * CELL_PITCH,
      top: oy,
      width: CELL_W,
      height: 120,
      borderRadius: 3,
      background: theme.panel,
      border: `1px solid ${theme.panelBorder}`,
      opacity: shown,
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 3,
        background: kept ? theme.text : theme.dim,
        opacity: kept ? 0.15 * bands : 0.07,
      }}
    />
  </div>
);

/** 1-C 主装置：纸卷轴向特写——首 3/尾 46 高亮带 + @draw 裁切线 + 中段块平移入归档柜。 */
const RollCut: React.FC<{
  rollAt: number;
  litAt: number;
  cutAt: number;
  cabAt: number;
  travelAt: number;
  travelDur: number;
  markAt: number;
}> = ({rollAt, litAt, cutAt, cabAt, travelAt, travelDur, markAt}) => {
  const cells = useStagger(CELL_N, {at: rollAt, dur: DUR.f2, stride: 1});
  const rollIn = useProgress(rollAt, DUR.f4);
  const bands = useProgress(litAt, DUR.f5);
  const cutA = useDraw(cutAt, DUR.f5);
  const cutB = useDraw(cutAt + 6, DUR.f5);
  const cab = useEnter('rise', {at: cabAt, dist: 30, dur: DUR.f5, springPreset: 'settle'});
  // 中段块平移（travel 词汇的直线变体：eased 几何位移，非环形巡游）
  const travel = useProgress(travelAt, travelDur, 'decelerate');
  const mark = useProgress(markAt, DUR.f4);

  const midLeft = CELL_X0 + MID_FROM * CELL_PITCH;
  const midW = (MID_TO - MID_FROM + 1) * CELL_PITCH - 2;
  // 归档柜首抽屉内沿（柜体 left 1380 + padding 20 → 内沿 ~1400，抽屉 1 顶 ~248）
  const tx = 1135;
  const ty = -220;

  return (
    <AbsoluteFill>
      {/* 画面字 50 / 3 / 46（数字预算锚数豁免——本镜即数字镜） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 292,
          display: 'flex',
          justifyContent: 'center',
          gap: 72,
          opacity: bands,
          fontFamily: theme.mono,
        }}
      >
        {[
          {n: '50', s: ' 条 · 数上限'},
          {n: '3', s: ' 条 · 首留'},
          {n: '46', s: ' 条 · 尾留'},
        ].map((t) => (
          <div key={t.n} style={{fontSize: 40, color: theme.text, fontVariantNumeric: 'tabular-nums'}}>
            {t.n}
            <span style={{fontSize: 20, color: theme.dim}}>{t.s}</span>
          </div>
        ))}
      </div>

      {/* 纸卷（轴向）+ 保留带条目 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <g opacity={rollIn}>
          <circle cx={150} cy={530} r={40} fill="none" stroke={theme.dim} strokeWidth={2.5} />
          <circle cx={150} cy={530} r={26} fill="none" stroke={theme.dim} strokeWidth={2} opacity={0.7} />
          <circle cx={150} cy={530} r={7} fill={theme.panelBorder} />
        </g>
      </svg>
      {Array.from({length: CELL_N}, (_, i) =>
        i < MID_FROM || i > MID_TO ? (
          <RollCell key={i} i={i} shown={cells[i]} kept bands={bands} />
        ) : null,
      )}

      {/* 裁切线（@draw：首/尾两刀） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <line
          x1={midLeft - 0.5}
          y1={442}
          x2={midLeft - 0.5}
          y2={622}
          stroke={theme.text}
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={0.65}
          {...cutA}
        />
        <line
          x1={CELL_X0 + (MID_TO + 1) * CELL_PITCH - 0.5}
          y1={442}
          x2={CELL_X0 + (MID_TO + 1) * CELL_PITCH - 0.5}
          y2={622}
          stroke={theme.text}
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={0.65}
          {...cutB}
        />
      </svg>

      {/* 原处留一行标记 */}
      <div
        style={{
          position: 'absolute',
          left: midLeft,
          top: 524,
          width: midW,
          height: 14,
          border: `2px dashed ${theme.dim}`,
          borderRadius: 4,
          opacity: mark,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: midLeft,
          top: 552,
          width: midW,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 18,
          color: theme.dim,
          opacity: mark,
        }}
      >
        {'留一行去向'}
      </div>

      {/* 归档柜（右上，抽屉虚位以待） */}
      <div style={{position: 'absolute', left: 1380, top: 190, width: 360, opacity: cab.opacity, transform: cab.transform}}>
        <Panel style={{padding: '16px 20px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{'归档柜'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'archived'}</span>
          </div>
          <div style={{marginTop: 12, height: 76, border: `2px dashed ${theme.panelBorder}`, borderRadius: 8}} />
          <div style={{marginTop: 10, height: 76, border: `2px dashed ${theme.panelBorder}`, borderRadius: 8}} />
        </Panel>
      </div>

      {/* 中段整块（吊离原位 → 归档柜首抽屉）。★ 渲染序刻意在柜体之后：
          块要落进抽屉内部（Panel 不透明底），若在柜体之前渲染会被柜底盖住
          （2026-10-03 评审：坐标修复后块飞抵即消失的另一半根因）。 */}
      <div
        style={{
          position: 'absolute',
          left: midLeft,
          top: 470,
          width: midW,
          height: 120,
          transformOrigin: '0 0',
          transform: `translate(${travel * tx}px, ${travel * ty}px) scale(${1 - 0.45 * travel})`,
        }}
      >
        {Array.from({length: MID_TO - MID_FROM + 1}, (_, j) => (
          <RollCell key={j} i={j} shown={cells[j + MID_FROM]} kept={false} bands={0} ox={0} oy={0} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-D 换地址与八成（量尺 + 防护罩） ─────────────────────────────────────

const BLOCK_W = 740;
const BLOCK_H = 120;

/** 1-D 主装置：旧结果块占位符化 + 量尺指针 @count 压向 80%（账单金）+ 未读批防护罩。 */
const AddressGauge: React.FC<{
  l3At: number;
  collapseAts: readonly number[];
  gaugeAt: number;
  glowAt: number;
  shieldAt: number;
  noteAt: number;
}> = ({l3At, collapseAts, gaugeAt, glowAt, shieldAt, noteAt}) => {
  const frame = useCurrentFrame();
  const chips = useProgress(l3At, DUR.f3);
  const b0 = useEnter('rise', {at: l3At, dist: 26, dur: DUR.f4, springPreset: 'settle'});
  const b1 = useEnter('rise', {at: l3At + 5, dist: 26, dur: DUR.f4, springPreset: 'settle'});
  const b2 = useEnter('rise', {at: l3At + 10, dist: 26, dur: DUR.f4, springPreset: 'settle'});
  const enters = [b0, b1, b2];
  // 占位符化：块高塌缩 + 地址条浮现（p1-14「先落盘，再换成一行取件地址」）
  const cp0 = useProgress(collapseAts[0], DUR.f5);
  const cp1 = useProgress(collapseAts[1], DUR.f5);
  const cp2 = useProgress(collapseAts[2], DUR.f5);
  const cps = [cp0, cp1, cp2];
  // 量尺：104%（超限带内）→ 80% 目标（@count，账单金）
  const level = useCount({from: 104, to: 80, at: gaugeAt + DUR.f3, dur: DUR.f6});
  const glow = useImpulse({at: glowAt, dur: DUR.f5, peak: 1});
  const moving = progress(frame, gaugeAt, DUR.f4);
  const breathe = useBreathe({period: 46, amp: 0.5, base: 0.5});
  const bandO = (1 - moving) * (0.18 + 0.1 * breathe);
  const eighty = useProgress(gaugeAt, DUR.f4);
  const shield = useEnter('pop', {at: shieldAt, dur: DUR.f4, springPreset: 'settle'});
  const fresh = useEnter('rise', {at: shieldAt + 8, dist: 22, dur: DUR.f4, springPreset: 'settle'});
  const note = useProgress(noteAt, DUR.f4);

  const yOf = (lv: number) => 760 - 5.2 * lv;
  const yN = yOf(level);

  return (
    <AbsoluteFill>
      {/* 层位 chips：L1/L2 已过 → L3 点亮（p1-13「才轮到第三层」） */}
      <div style={{position: 'absolute', left: 120, top: 164, display: 'flex', gap: 12, fontFamily: theme.mono, fontSize: 17}}>
        <span style={{padding: '5px 14px', borderRadius: 999, border: `2px solid ${theme.panelBorder}`, color: theme.dim}}>
          {'L1 落盘 ✓'}
        </span>
        <span style={{padding: '5px 14px', borderRadius: 999, border: `2px solid ${theme.panelBorder}`, color: theme.dim}}>
          {'L2 裁段 ✓'}
        </span>
        <span
          style={{
            padding: '5px 14px',
            borderRadius: 999,
            border: `2px solid ${theme.text}`,
            color: theme.text,
            opacity: chips,
          }}
        >
          {'L3 换地址'}
        </span>
      </div>

      {/* 三块已读旧结果 → 地址条 */}
      {[0, 1, 2].map((i) => {
        const top = 236 + i * 144;
        const c = cps[i];
        const h = BLOCK_H - 74 * c;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 120,
              top,
              width: BLOCK_W,
              height: BLOCK_H,
              opacity: enters[i].opacity,
              transform: enters[i].transform,
            }}
          >
            <Panel style={{width: '100%', height: h, overflow: 'hidden', position: 'relative'}}>
              <div style={{padding: '14px 20px', opacity: 1 - c}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.text}}>{'旧工具结果 · 已读'}</span>
                  <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'tool_result'}</span>
                </div>
                <div style={{marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8}}>
                  {[0.62, 0.9, 0.45].map((f, j) => (
                    <div
                      key={j}
                      style={{width: `${f * 100}%`, height: 11, borderRadius: 5, background: theme.dim, opacity: 0.45}}
                    />
                  ))}
                </div>
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  right: 0,
                  height: 46,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 20px',
                  opacity: c,
                }}
              >
                <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.text}}>
                  {'→ .task_outputs/tool-results/… · 取件地址'}
                </span>
              </div>
            </Panel>
          </div>
        );
      })}

      {/* 量尺（右）：上限红线带 → 指针 @count 压向 80%（账单金） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <text x={1600} y={150} textAnchor="middle" fontFamily={theme.mono} fontSize={18} fill={theme.dim}>
          {'纸面总量 / 上限'}
        </text>
        <rect x={1570} y={188} width={60} height={52} fill={theme.danger} opacity={bandO} />
        <line x1={1556} y1={240} x2={1644} y2={240} stroke={theme.danger} strokeWidth={2} strokeDasharray="6 6" opacity={0.8} />
        <line x1={1600} y1={188} x2={1600} y2={760} stroke={theme.panelBorder} strokeWidth={3} />
        {[0, 25, 50, 75].map((lv) => (
          <g key={lv}>
            <line x1={1592} y1={yOf(lv)} x2={1608} y2={yOf(lv)} stroke={theme.panelBorder} strokeWidth={2} />
            {(lv === 0 || lv === 50) && (
              <text x={1578} y={yOf(lv) + 6} textAnchor="end" fontFamily={theme.mono} fontSize={17} fill={theme.dim}>
                {String(lv)}
              </text>
            )}
          </g>
        ))}
        <text x={1578} y={246} textAnchor="end" fontFamily={theme.mono} fontSize={17} fill={theme.danger}>
          {'100 · 上限'}
        </text>
        <g opacity={0.4 + 0.6 * eighty}>
          <line x1={1584} y1={344} x2={1616} y2={344} stroke={theme.accent} strokeWidth={3} />
          <text
            x={1624}
            y={350}
            fontFamily={theme.mono}
            fontSize={18}
            fill={theme.accent}
            opacity={0.8 + 0.2 * glow}
          >
            {'80 · 八成'}
          </text>
        </g>
        <line x1={1544} y1={yN} x2={1656} y2={yN} stroke={theme.accent} strokeWidth={4} strokeLinecap="round" />
        <circle cx={1544} cy={yN} r={5 + 3 * glow} fill={theme.accent} />
        {/* 读数挂指针线上方：落定 level=80 时与 '80 · 八成' 刻度标签（基线 350）
            垂直分层，不再同基线叠印 */}
        <text x={1666} y={yN - 18} fontFamily={theme.mono} fontSize={24} fill={theme.accent}>
          {`${Math.round(level)}%`}
        </text>
      </svg>

      {/* 未读批防护罩（p1-16，dim 虚线框 + @enter:pop） */}
      <div
        style={{
          position: 'absolute',
          left: 108,
          top: 660,
          width: 764,
          height: 188,
          borderRadius: 16,
          border: `3px dashed ${theme.dim}`,
          opacity: shield.opacity,
          transform: shield.transform,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -15,
            right: 20,
            padding: '4px 14px',
            borderRadius: 999,
            background: theme.panel,
            border: `2px solid ${theme.dim}`,
            fontFamily: theme.sans,
            fontSize: 18,
            color: theme.dim,
          }}
        >
          {'防护罩 · 不碰'}
        </div>
        <div style={{position: 'absolute', inset: 0, opacity: fresh.opacity, transform: fresh.transform, padding: '22px 24px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.text}}>{'刚返回 · 模型还没读过'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'tool_result · unseen'}</span>
          </div>
          <div style={{marginTop: 16, display: 'flex', flexDirection: 'column', gap: 9}}>
            {[0.55, 0.82].map((f, j) => (
              <div
                key={j}
                style={{width: `${f * 100}%`, height: 13, borderRadius: 6, background: theme.text, opacity: 0.6}}
              />
            ))}
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            right: 18,
            bottom: 10,
            fontFamily: theme.sans,
            fontSize: 17,
            color: theme.dim,
            opacity: note,
          }}
        >
          {'为什么 · 下一幕'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P1CheapFirst: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p1-01', 'p1-05');
  const bB = w('p1-07', 'p1-09');
  const bC = w('p1-11', 'p1-12');
  const bD = w('p1-13', 'p1-16');
  const bE = w('p1-17', 'p1-20');
  const bF = w('p1-21', 'p1-25b');
  const bG = w('p1-27', 'p1-29');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A 搬家三格横移">
        <SceneTag chapter="Cheap First" tagline="便宜的先跑" accent={theme.mech} />
        <MapAnchorChip active="scratchpad" enterAt={6} />
        <MovingMap
          q1At={at('p1-01') - bA.from + Math.round(dur('p1-01') * 0.2)}
          cardAts={[
            at('p1-02') - bA.from,
            at('p1-03') - bA.from,
            at('p1-04') - bA.from,
          ]}
          archiveAt={at('p1-04') - bA.from + Math.round(dur('p1-04') * 0.55)}
          pipeAt={at('p1-05') - bA.from}
        />
        <Footnote delay={8}>{'tool_result_budget'}</Footnote>
      </Sequence>

      {/* 前镜 1-A 为场景镜 → 首章默认入场；cheap-first 盖满 p1-07..09（hold 末帧，零空屏） */}
      <Sequence {...bB} name="1-B 落盘收据 图镜">
        <ArchifyRecap
          slug="compact-pipeline"
          caption="四层压缩管线"
          cues={[
            {chapterId: 'cheap-first', at: at('p1-07') - bB.from, durationInFrames: dur('p1-07') + dur('p1-08') + dur('p1-09'), fit: 'hold'},
          ]}
        />
      </Sequence>

      {/* 1-C/1-D 两场景镜共用幕标签（1-C 锚定、跨镜持续——逐镜重挂会在切镜处
          瞬灭再淡入，2026-10-03 评审抽帧实锤；P3「幕首镜持有」惯例的场景镜组变体） */}
      <Sequence
        from={bC.from}
        durationInFrames={bD.from + bD.durationInFrames - bC.from}
        name="1-C/1-D 幕标签"
      >
        <SceneTag chapter="Cheap First" tagline="便宜的先跑" accent={theme.mech} />
      </Sequence>

      <Sequence {...bC} name="1-C 裁中段">
        <RollCut
          rollAt={6}
          litAt={at('p1-11') - bC.from + Math.round(dur('p1-11') * 0.42)}
          cutAt={at('p1-11') - bC.from + Math.round(dur('p1-11') * 0.68)}
          cabAt={at('p1-12') - bC.from + 4}
          travelAt={at('p1-12') - bC.from + Math.round(dur('p1-12') * 0.16)}
          travelDur={Math.round(dur('p1-12') * 0.34)}
          markAt={at('p1-12') - bC.from + Math.round(dur('p1-12') * 0.6)}
        />
        <Footnote delay={6}>{'snip_compact · 50'}</Footnote>
      </Sequence>

      <Sequence {...bD} name="1-D 换地址与八成">
        <AddressGauge
          l3At={at('p1-13') - bD.from + Math.round(dur('p1-13') * 0.35)}
          collapseAts={[
            at('p1-14') - bD.from + Math.round(dur('p1-14') * 0.3),
            at('p1-14') - bD.from + Math.round(dur('p1-14') * 0.46),
            at('p1-14') - bD.from + Math.round(dur('p1-14') * 0.62),
          ]}
          gaugeAt={at('p1-15') - bD.from}
          glowAt={at('p1-15') - bD.from + DUR.f3 + DUR.f6}
          shieldAt={at('p1-16') - bD.from + 2}
          noteAt={at('p1-16') - bD.from + Math.round(dur('p1-16') * 0.72)}
        />
        <Footnote delay={6}>{'micro_compact · 80%'}</Footnote>
      </Sequence>

      {/* 前镜 1-D 为场景镜 → 首章默认入场；bypass 盖满 p1-17..19 再接 batch-wait（零空屏） */}
      <Sequence {...bE} name="1-E 摘要殿后 图镜">
        <ArchifyRecap
          slug="compact-pipeline"
          caption="四层压缩管线"
          cues={[
            {chapterId: 'bypass', at: at('p1-17') - bE.from, durationInFrames: dur('p1-17') + dur('p1-18') + dur('p1-19'), fit: 'hold'},
            {chapterId: 'batch-wait', at: at('p1-20') - bE.from, durationInFrames: dur('p1-20')},
          ]}
        />
      </Sequence>

      {/* 跨镜界帧相邻接 1-E 末章（p1-20 末 = p1-21 首）→ lead={false}（分镜 lead 清单）；
          p1-25b 为本实例尾后留白句 */}
      <Sequence {...bF} name="1-F T11 实测走查 图镜">
        <ArchifyRecap
          lead={false}
          slug="batch-walkthrough"
          caption="T11 批次走查"
          cues={[
            {chapterId: 'three-big', at: at('p1-21') - bF.from, durationInFrames: dur('p1-21')},
            {chapterId: 'budget-pass', at: at('p1-22') - bF.from, durationInFrames: dur('p1-22')},
            {chapterId: 'fit-fallback', at: at('p1-23') - bF.from, durationInFrames: dur('p1-23')},
            {chapterId: 'final-zero', at: at('p1-24') - bF.from, durationInFrames: dur('p1-24') + dur('p1-25b'), fit: 'hold'},
          ]}
        />
      </Sequence>

      {/* 前镜 1-F 为图镜 → lead={false}；reactive 章自 p1-27 起盖满本镜三句（hold 末帧，零空屏） */}
      <Sequence {...bG} name="1-G 应急裁剪 图镜">
        <ArchifyRecap
          lead={false}
          slug="compact-pipeline"
          caption="四层压缩管线"
          cues={[
            {chapterId: 'reactive', at: at('p1-27') - bG.from, durationInFrames: dur('p1-27') + dur('p1-28') + dur('p1-29'), fit: 'hold'},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1CheapFirst;
