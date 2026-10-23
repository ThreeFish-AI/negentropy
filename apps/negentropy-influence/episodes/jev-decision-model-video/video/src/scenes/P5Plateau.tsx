/** P5 高原上的七成（p5-01..31 · 6 镜 6 cue）——全片之「转」。
 *
 *  分镜规格 = script/storyboard.md `### P5 高原上的七成`：
 *  5-A 调令与台阶（ct-in 重放）/ 5-B 没有调令的世界（ct-drift）/ 5-C 密封新题与台阶
 *  （ct-cliff）/ 5-D 公平骰子（ct-wild）/ 5-E 原理与门槛（无 cue）/ 5-F 修读数不修排序
 *  （ct-fix + tg-read 幕界转接）。色调自 5-A 起转冷＋警示红梯度。
 *
 *  色彩契约：柱青实心=概率、描边+mono=读数；格黄只作预报单轮廓（slotDeep）；闸品=
 *  调令/门槛/编排；警示红仅失败态；确认绿仅 ✓ 态；主播/中性走 dim。三级角标本地版 EvBadge。
 */
import React from 'react';
import {AbsoluteFill, Sequence, interpolate, interpolateColors, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useCount,
  useDraw,
  useEnter,
  useImpulse,
  useProgress,
  useSpring,
  useStagger,
} from '../motion';
import {Footnote, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

// ── 三级角标（本地版；全片契约：虚线圆徽=官方自报，实线圆徽+署名=第三方实测，
//    实心圆徽+✓=我们复算。层级用线型区分、不占色相）────────────────────────
type BadgeKind = 'official' | 'third' | 'ours';

const EvBadge: React.FC<{
  kind: BadgeKind;
  /** 第三方署名 / 复算口径名（如 Hume、dice、原型） */
  name?: string;
  /** 灰斜体小注（如「数据核对过」） */
  note?: string;
  at?: number;
  style?: React.CSSProperties;
}> = ({kind, name, note, at = 0, style}) => {
  const o = useProgress(at, DUR.f3);
  const tier = kind === 'official' ? '官方自报' : kind === 'third' ? `外测·${name ?? ''}` : `复算·${name ?? ''}`;
  return (
    <div style={{display: 'inline-flex', alignItems: 'center', gap: 8, opacity: o, ...style}}>
      <div
        style={{
          width: 17,
          height: 17,
          borderRadius: 999,
          boxSizing: 'border-box',
          border:
            kind === 'official'
              ? `2px dashed ${theme.text}`
              : kind === 'third'
                ? `2px solid ${theme.text}`
                : 'none',
          background: kind === 'ours' ? theme.text : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.mono,
          fontSize: 11,
          fontWeight: 700,
          color: theme.bg,
          lineHeight: 1,
        }}
      >
        {kind === 'ours' ? '✓' : ''}
      </div>
      <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.text, letterSpacing: 0.5}}>{tier}</span>
      {note ? (
        <span style={{fontFamily: theme.sans, fontStyle: 'italic', fontSize: 15, color: theme.dim}}>{note}</span>
      ) : null}
    </div>
  );
};

// ── 5-A ────────────────────────────────────────────────────────────────────

/** p5-01「转折」字标：压屏一拍即走（衬线大字，缓动落定、无弹簧——印章式拍上）。 */
const TurnMark: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const inP = progress(frame, at, DUR.f3);
  const outP = progress(frame, at + 30, DUR.f3); // 停驻约 1s 即走（beat 级显式帧数）
  const o = inP * (1 - outP);
  if (o <= 0) {
    return null;
  }
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: o}}>
      <div style={{transform: `scale(${0.92 + 0.08 * inP})`, textAlign: 'center'}}>
        <div style={{fontFamily: theme.serif, fontSize: 118, fontWeight: 700, color: theme.text, letterSpacing: 26, textIndent: 26}}>
          {'转 折'}
        </div>
        <div style={{width: 540, height: 3, background: theme.text, margin: '16px auto 0', transform: `scaleX(${inP})`}} />
      </div>
    </div>
  );
};

/** 背景：沿海天际线 → 高原台地（p5-02 调令拉开时切换；低存在感冷色剪影）。 */
const COAST: [number, number, number][] = [
  [70, 120, 88], [240, 92, 150], [410, 150, 70], [640, 108, 196], [820, 84, 118],
  [1055, 140, 158], [1265, 96, 90], [1445, 158, 188], [1668, 110, 108], [1828, 76, 136],
];
const MESAS: {x: number; w: number; steps: number[]}[] = [
  {x: 90, w: 430, steps: [176, 118, 62]},
  {x: 620, w: 520, steps: [238, 152]},
  {x: 1230, w: 470, steps: [204, 132, 70]},
];

const SkylinePlateau: React.FC<{switchAt: number}> = ({switchAt}) => {
  const frame = useCurrentFrame();
  const sw = progress(frame, switchAt, DUR.f6);
  return (
    <AbsoluteFill>
      <svg viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} preserveAspectRatio="none">
        <g opacity={0.9 * (1 - sw)}>
          {COAST.map(([x, w, h], i) => (
            <rect key={i} x={x} y={760 - h} width={w} height={h} fill="#131a26" />
          ))}
          {[806, 852, 898].map((y, i) => (
            <line key={i} x1={80 + i * 130} y1={y} x2={900 + i * 260} y2={y} stroke="#18212f" strokeWidth={3} />
          ))}
        </g>
        <g opacity={0.9 * sw}>
          {MESAS.map((m, i) =>
            m.steps.map((h, j) => (
              <rect key={`${i}-${j}`} x={m.x + j * 46} y={760 - h} width={m.w - 2 * j * 46} height={h} fill="#121824" />
            )),
          )}
        </g>
        <rect x={0} y={758} width={1920} height={4} fill="#1b2534" />
      </svg>
    </AbsoluteFill>
  );
};

/** p5-02 调令公函：闸品描边、右缘拉入（预案/控制流语义）。 */
const TransferOrder: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('slideR', {at, dur: DUR.f5, springPreset: 'settle'});
  return (
    <div style={{position: 'absolute', right: 96, top: 168, width: 400, opacity: e.opacity, transform: e.transform}}>
      <div
        style={{
          border: `3px solid ${theme.gate}`,
          borderRadius: 10,
          background: theme.panel,
          padding: '26px 30px',
          boxShadow: `0 0 34px ${theme.gate}22`,
          position: 'relative',
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.gate, letterSpacing: 8}}>{'调 令'}</div>
        <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.text, marginTop: 14}}>
          {'判读员 → 高原城市'}
        </div>
        <div
          style={{
            position: 'absolute',
            right: 18,
            top: 16,
            transform: 'rotate(-8deg)',
            border: `2px solid ${theme.gate}`,
            borderRadius: 6,
            padding: '2px 8px',
            fontFamily: theme.serif,
            fontSize: 22,
            color: theme.gate,
          }}
        >
          {'令'}
        </div>
      </div>
    </div>
  );
};

/** 5-A 主装置：P4 同款记分牌高原复现——报七成实心柱 vs 塌成警示红阶梯的实况柱，
 *  读数平线纹丝不动并置；p5-05 错位拉开、p5-06 警铃划叉（不报警）。 */
const STEP_FRACS = [0.62, 0.5, 0.4, 0.3];

const PlateauScoreboard: React.FC<{enterAt: number; stepAt: number; gapAt: number; bellAt: number}> = ({
  enterAt,
  stepAt,
  gapAt,
  bellAt,
}) => {
  const enter = useEnter('rise', {at: enterAt, dur: DUR.f5, springPreset: 'settle', restBottom: 792});
  const steps = useStagger(4, {at: stepAt, stride: 7, dur: DUR.f5});
  const gapP = useProgress(gapAt, DUR.f5);
  const bellO = useProgress(bellAt, DUR.f4);
  const glow = useImpulse({at: stepAt + 8, dur: DUR.f6});
  const BASE = 520; // 面板内基线（局部 y）
  const H = 440; // 100% 高度
  const fr = (v: number) => BASE - v * H;
  return (
    <div style={{position: 'absolute', left: 120, top: 168, width: 900, height: 624, opacity: enter.opacity, transform: enter.transform}}>
      <div style={{position: 'absolute', inset: 0, background: theme.panel, border: `2px solid ${theme.panelBorder}`, borderRadius: 14}} />
      {/* 纵轴 */}
      <div style={{position: 'absolute', left: 100, top: fr(1), width: 2, height: H, background: theme.panelBorder}} />
      {[1, 0.5, 0].map((v) => (
        <div key={v} style={{position: 'absolute', left: 86, top: fr(v), width: 16, height: 2, background: theme.panelBorder}} />
      ))}
      <div style={{position: 'absolute', left: 52, top: fr(1) - 10, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'1.0'}</div>
      <div style={{position: 'absolute', left: 52, top: fr(0) - 10, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'0'}</div>
      {/* 报七成柱（柱青实心＝概率） */}
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: fr(0.7),
          width: 110,
          height: 0.7 * H,
          background: theme.bar,
          borderRadius: '4px 4px 0 0',
          transform: `translateX(${-22 * gapP}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: fr(0.7) - 40,
          width: 110,
          textAlign: 'center',
          transform: `translateX(${-22 * gapP}px)`,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.bar}}>{'0.70'}</span>
        <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.text, marginTop: 2}}>{'报'}</div>
      </div>
      {/* 实况柱（描边）→ 逐级塌成警示红阶梯 */}
      {STEP_FRACS.map((f, i) => {
        const p = steps[i];
        const top = fr(0.7 + (f - 0.7) * p);
        const stroke = interpolateColors(p, [0, 1], [theme.dim, theme.danger]);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 330 + i * 104,
              top,
              width: 92,
              height: BASE - top,
              border: `2.5px solid ${stroke}`,
              borderRadius: 3,
              background: p > 0 ? `${theme.danger}1f` : 'transparent',
              transform: `translateX(${26 * gapP}px)`,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 642,
          top: fr(0.3) - 34,
          width: 92,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 21,
          color: theme.danger,
          opacity: gapP,
          transform: `translateX(${26 * gapP}px)`,
        }}
      >
        {'实况'}
      </div>
      {/* p5-05 错位拉开：报 vs 实况 的落差括线 */}
      <div
        style={{
          position: 'absolute',
          left: 298,
          top: fr(0.7),
          height: fr(0.3) - fr(0.7),
          borderLeft: `3px dashed ${theme.danger}`,
          opacity: gapP,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 236,
          top: (fr(0.7) + fr(0.3)) / 2 - 14,
          fontFamily: theme.mono,
          fontSize: 22,
          color: theme.danger,
          opacity: gapP,
        }}
      >
        {'错位'}
      </div>
      {/* 读数平线（柱青描边＝读数；纹丝不动） */}
      <div style={{position: 'absolute', left: 642, top: fr(0.7) - 2, width: 212, height: 5, background: theme.bar, borderRadius: 3}} />
      <div style={{position: 'absolute', left: 642, top: fr(0.7) - 36, fontFamily: theme.mono, fontSize: 24, color: theme.bar}}>{'0.70'}</div>
      <div style={{position: 'absolute', left: 766, top: fr(0.7) - 36, fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'读数'}</div>
      {/* p5-06 警铃划叉（不报警） */}
      <div
        style={{
          position: 'absolute',
          left: 642,
          top: fr(0.7) + 36,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          opacity: bellO,
        }}
      >
        <svg width={42} height={42} viewBox="0 0 24 24">
          <path d="M12 3a5.5 5.5 0 0 0-5.5 5.5V12l-1.8 3h14.6L17.5 12V8.5A5.5 5.5 0 0 0 12 3z" fill="none" stroke={theme.dim} strokeWidth={1.7} />
          <path d="M10 18.5a2 2 0 0 0 4 0" fill="none" stroke={theme.dim} strokeWidth={1.7} />
          <line x1={4} y1={20} x2={20} y2={4} stroke={theme.danger} strokeWidth={2.3} />
        </svg>
        <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'不报警'}</span>
      </div>
      {/* 台阶塌落脉冲（一次性强调，仅阶梯区辉光） */}
      <div
        style={{
          position: 'absolute',
          left: 322,
          top: fr(0.62),
          width: 428,
          height: 8,
          borderRadius: 4,
          background: theme.danger,
          opacity: 0.5 * glow,
          filter: `blur(${3 * glow}px)`,
        }}
      />
    </div>
  );
};

/** M-002 承接：ct-in 出口回切工位——匀速落笔、零强调（机械感主题：线性优先于缓动）。 */
const SteadyHand: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const o = useProgress(at, DUR.f4);
  const t = Math.max(0, frame - at);
  const LINE = 78; // 每行书写周期（beat 级显式帧数：匀速机械拍）
  const row = Math.floor(t / LINE) % 3;
  const x = (t % LINE) / LINE; // 匀速
  const penX = 146 + x * 330;
  const penY = 838 + row * 24;
  return (
    <div style={{position: 'absolute', left: 120, top: 812, width: 900, height: 100, opacity: o}}>
      {/* 预报单（格黄轮廓母题〔M-001〕局部复现） */}
      <div style={{position: 'absolute', left: 26, top: 6, width: 400, height: 88, border: `2px solid ${theme.slotDeep}`, borderRadius: 6}}>
        {[0, 1, 2].map((r) => (
          <div key={r} style={{position: 'absolute', left: 22, top: 22 + r * 24, width: 356, height: 2, background: theme.panelBorder}} />
        ))}
      </div>
      {/* 笔（匀速平移，无缓动无强调） */}
      <div
        style={{
          position: 'absolute',
          left: penX,
          top: penY - 22,
          width: 4,
          height: 26,
          background: theme.text,
          borderRadius: 2,
          transform: 'rotate(38deg)',
        }}
      />
      {/* 读数横线持平 */}
      <div style={{position: 'absolute', left: 470, top: 46, width: 250, height: 4, background: theme.bar, borderRadius: 2}} />
      <div style={{position: 'absolute', left: 730, top: 34, fontFamily: theme.mono, fontSize: 22, color: theme.bar}}>{'0.70'}</div>
      <div style={{position: 'absolute', left: 470, top: 62, fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>
        {'笔速不变 · 读数持平'}
      </div>
    </div>
  );
};

// ── 5-B ────────────────────────────────────────────────────────────────────

/** p5-07 调令纸溶解成散点（题目/资料微粒 灰→警示红；黄金角确定性布点，无随机数）。 */
const SCATTER = Array.from({length: 44}, (_, i) => {
  const a = i * 2.399963; // 黄金角
  const r = 0.55 + 0.45 * (((i * 7) % 13) / 12);
  return {x: Math.cos(a) * r * 430, y: Math.sin(a) * r * 250, rr: 4 + ((i * 5) % 4), delay: (i % 8) * 2};
});

const DriftScatter: React.FC<{at: number; redAt: number}> = ({at, redAt}) => {
  const frame = useCurrentFrame();
  const o = useProgress(at, DUR.f4);
  const dissolve = progress(frame, at, DUR.f5);
  const red = progress(frame, redAt, DUR.f6);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: o}}>
      {/* 调令纸残影（收缩淡出） */}
      <div
        style={{
          position: 'absolute',
          left: 760,
          top: 300,
          width: 400,
          height: 250,
          border: `3px solid ${theme.gate}`,
          borderRadius: 10,
          background: theme.panel,
          opacity: 1 - dissolve,
          transform: `scale(${1 - 0.35 * dissolve})`,
        }}
      >
        <div style={{padding: 22, fontFamily: theme.mono, fontSize: 20, color: theme.gate, letterSpacing: 4}}>{'调 令'}</div>
        <div style={{padding: '0 22px', fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{'判读员 → 高原城市'}</div>
      </div>
      {/* 散点（题目/资料微粒，灰→警示红） */}
      {SCATTER.map((d, i) => {
        const p = progress(frame, at + 6 + d.delay, DUR.f4);
        const cx = 960 + d.x * (0.25 + 0.75 * p);
        const cy = 450 + d.y * (0.25 + 0.75 * p);
        const color = interpolateColors(red, [0, 1], [theme.dim, theme.danger]);
        return <div key={i} style={{position: 'absolute', left: cx, top: cy, width: d.rr, height: d.rr, borderRadius: 999, background: color, opacity: p}} />;
      })}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 742,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 26,
          color: theme.danger,
          opacity: red,
        }}
      >
        {'分布漂移'}
      </div>
    </div>
  );
};

/** p5-09 双监视器：影子运行（新旧并排 · 只记账不动手）＋ 抽样审计（放大镜抽签）。 */
const ShadowAudit: React.FC<{at: number}> = ({at}) => {
  const duo = useStagger(2, {at, stride: 9, dur: DUR.f5});
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - (at + 10));
  const tally = Math.min(16, Math.floor(t / 5)); // 账本刻痕机械累积
  const sweep = progress(frame, at + 14, 56); // 放大镜线性巡行（机械感→线性）
  const pick = useSpring('snap', {at: at + 70, dur: DUR.f4}); // 抽签弹出
  const penA = (t * 2.4) % 190;
  const penB = (t * 2.4 + 95) % 190;
  return (
    <div>
      {/* 监视器 1 · 影子运行 */}
      <div style={{position: 'absolute', left: 210, top: 216, width: 700, opacity: duo[0], transform: `translateY(${(1 - duo[0]) * 18}px)`}}>
        <div style={{background: theme.panel, border: `2px solid ${theme.panelBorder}`, borderRadius: 12, padding: '14px 18px 16px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, letterSpacing: 2}}>{'影子运行'}</div>
          <div style={{display: 'flex', gap: 26, marginTop: 12}}>
            {[
              {lab: '旧', pen: penA},
              {lab: '新', pen: penB},
            ].map((d) => {
              const row = Math.floor(d.pen / 95) % 2; // 两行书写行循环（匀速机械拍）
              const px = 20 + ((d.pen % 95) / 95) * 240;
              const py = 48 + row * 30;
              return (
                <div key={d.lab} style={{position: 'relative', width: 300, height: 118, border: `2px solid ${theme.slotDeep}`, borderRadius: 6}}>
                  <div style={{position: 'absolute', left: 14, top: 10, fontFamily: theme.sans, fontSize: 18, color: theme.dim}}>{d.lab}</div>
                  {[0, 1].map((r) => (
                    <div key={r} style={{position: 'absolute', left: 20, top: 48 + r * 30, width: 240, height: 2, background: theme.panelBorder}} />
                  ))}
                  <div
                    style={{
                      position: 'absolute',
                      left: px,
                      top: py - 20,
                      width: 4,
                      height: 20,
                      background: theme.text,
                      borderRadius: 2,
                      transform: 'rotate(38deg)',
                    }}
                  />
                </div>
              );
            })}
          </div>
          {/* 账本刻痕 */}
          <div style={{display: 'flex', gap: 5, marginTop: 14, height: 16, alignItems: 'flex-end'}}>
            {Array.from({length: tally}, (_, i) => (
              <div key={i} style={{width: 2.5, height: i % 5 === 4 ? 16 : 11, background: theme.dim}} />
            ))}
          </div>
          <div
            style={{
              marginTop: 12,
              display: 'inline-block',
              padding: '5px 16px',
              borderRadius: 999,
              border: `2px solid ${theme.dim}`,
              fontFamily: theme.mono,
              fontSize: 19,
              color: theme.dim,
            }}
          >
            {'只记账 · 不动手'}
          </div>
        </div>
      </div>
      {/* 监视器 2 · 抽样审计 */}
      <div style={{position: 'absolute', left: 1020, top: 216, width: 700, opacity: duo[1], transform: `translateY(${(1 - duo[1]) * 18}px)`}}>
        <div style={{background: theme.panel, border: `2px solid ${theme.panelBorder}`, borderRadius: 12, padding: '14px 18px 16px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, letterSpacing: 2}}>{'抽样审计'}</div>
          <div style={{position: 'relative', height: 150, marginTop: 8}}>
            {/* 样本行 */}
            {Array.from({length: 12}, (_, i) => {
              const picked = i === 8;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: 60 + i * 48,
                    top: 96 - (picked ? 18 * pick : 0),
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    background: picked && pick > 0.5 ? theme.text : theme.panelBorder,
                  }}
                />
              );
            })}
            {/* 放大镜（线性巡行，终点对准第 9 枚样本——抽签） */}
            <svg width={80} height={80} style={{position: 'absolute', left: 34 + sweep * 384, top: 62}}>
              <circle cx={33} cy={33} r={26} fill="none" stroke={theme.text} strokeWidth={3} opacity={0.9} />
              <line x1={52} y1={52} x2={70} y2={70} stroke={theme.text} strokeWidth={5} strokeLinecap="round" opacity={0.9} />
            </svg>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'抽签 · 抽中才看'}</div>
        </div>
      </div>
    </div>
  );
};

// ── 5-C ────────────────────────────────────────────────────────────────────

/** 5-C 数字对照卡组：0.031 → 密封信封 → 36.7% → Δ≈50 点标尺 → >0.9 滤网筛批次。 */
const SealedNumbers: React.FC<{
  eceAt: number;
  checkAt: number;
  envAt: number;
  bigAt: number;
  rulerAt: number;
  filterAt: number;
}> = ({eceAt, checkAt, envAt, bigAt, rulerAt, filterAt}) => {
  const ece = useEnter('rise', {at: eceAt, dur: DUR.f4, springPreset: 'settle'});
  const check = useProgress(checkAt, DUR.f4);
  const env = useEnter('pop', {at: envAt, dur: DUR.f4, springPreset: 'settle'});
  const flap = useProgress(envAt + 10, DUR.f5);
  const big = useSpring('snap', {at: bigAt, dur: DUR.f5});
  const bigO = useProgress(bigAt, DUR.f3);
  const bigGlow = useImpulse({at: bigAt + 4, dur: DUR.f6});
  const rulerO = useProgress(rulerAt, DUR.f4);
  const bracket = useDraw(rulerAt, 24);
  const filtO = useProgress(filterAt, DUR.f4);
  const sieve = useStagger(12, {at: filterAt + 6, stride: 2, dur: DUR.f4});
  const SIEVE_MARKED = [false, true, false, false, true, false, false, true, false, false, true, false];
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {/* ① ECE 0.031 卡 */}
      <div style={{position: 'absolute', left: 150, top: 190, width: 400, opacity: ece.opacity, transform: ece.transform}}>
        <div style={{border: `2.5px solid ${theme.bar}`, borderRadius: 12, background: theme.panel, padding: '20px 24px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'ECE · 校准误差'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 62, color: theme.bar, marginTop: 6}}>{'0.031'}</div>
          <div style={{marginTop: 10}}>
            <EvBadge kind="third" name="Hume" note="数据核对过" at={eceAt + 6} />
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 8}}>{'公开题库 · MMLU 1,200 题'}</div>
        </div>
      </div>
      {/* ② 复算核对行（✓ 唯一绿色出口） */}
      <div style={{position: 'absolute', left: 150, top: 480, width: 400, opacity: check}}>
        <EvBadge kind="ours" name="公开数据" at={checkAt} />
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text, marginTop: 8}}>
          {'重算 '}
          <span style={{color: theme.ok}}>{'✓'}</span>
          {' 对得上'}
        </div>
      </div>
      {/* ③ 密封信封 */}
      <div style={{position: 'absolute', left: 660, top: 200, opacity: env.opacity, transform: env.transform, perspective: 600}}>
        <div style={{position: 'relative', width: 340, height: 240}}>
          {/* 拆封后露出的题卡 */}
          <div
            style={{
              position: 'absolute',
              left: 40,
              top: 30,
              width: 260,
              height: 150,
              border: `2px solid ${theme.slotDeep}`,
              borderRadius: 6,
              background: theme.panel,
              opacity: flap,
            }}
          >
            {[0, 1, 2].map((r) => (
              <div key={r} style={{position: 'absolute', left: 22, top: 30 + r * 34, width: 216 - r * 30, height: 8, background: theme.panelBorder}} />
            ))}
          </div>
          {/* 信封体 */}
          <div style={{position: 'absolute', left: 0, top: 70, width: 340, height: 150, background: theme.panel, border: `2.5px solid ${theme.panelBorder}`, borderRadius: 6}} />
          {/* 封盖（绕顶边翻开） */}
          <div
            style={{
              position: 'absolute',
              left: 2,
              top: 72,
              width: 336,
              height: 0,
              transformOrigin: 'top center',
              transform: `rotateX(${-170 * flap}deg)`,
            }}
          >
            <div
              style={{
                width: 336,
                height: 74,
                background: '#1d2431',
                clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                border: 'none',
              }}
            />
          </div>
          {/* 封蜡 */}
          <div
            style={{
              position: 'absolute',
              left: 156,
              top: 118,
              width: 30,
              height: 30,
              borderRadius: 999,
              border: `2.5px solid ${theme.slotDeep}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.serif,
              fontSize: 15,
              color: theme.slotDeep,
              opacity: 1 - flap,
            }}
          >
            {'密'}
          </div>
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 12}}>{'密封新题 · 308 题'}</div>
        <div style={{marginTop: 8}}>
          <EvBadge kind="third" name="JevBench" at={envAt + 6} />
        </div>
      </div>
      {/* ④ 36.7% 大数（警示红） */}
      <div style={{position: 'absolute', left: 1130, top: 210, opacity: bigO}}>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 104,
            fontWeight: 700,
            color: theme.danger,
            transform: `scale(${0.7 + 0.3 * big})`,
            textShadow: `0 0 ${26 * bigGlow}px ${theme.danger}`,
          }}
        >
          {'36.7%'}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginTop: 6}}>{'准确率 · 密封新题'}</div>
      </div>
      {/* 卡组箭头 */}
      <div style={{position: 'absolute', left: 572, top: 300, fontFamily: theme.mono, fontSize: 40, color: theme.dim, opacity: env.opacity}}>{'→'}</div>
      <div style={{position: 'absolute', left: 1036, top: 300, fontFamily: theme.mono, fontSize: 40, color: theme.dim, opacity: bigO}}>{'→'}</div>
      {/* ⑤ 差值标尺（≈50 点） */}
      <div style={{position: 'absolute', left: 150, top: 570, width: 740, height: 280, opacity: rulerO}}>
        <svg width={740} height={280} viewBox="0 0 740 280">
          <line x1={140} y1={230} x2={720} y2={230} stroke={theme.panelBorder} strokeWidth={3} />
          {/* 公开题库（不写数值——口播只给差值） */}
          <line x1={240} y1={230} x2={240} y2={62} stroke={theme.dim} strokeWidth={8} strokeLinecap="round" />
          {/* 密封新题 36.7% */}
          <line x1={640} y1={230} x2={640} y2={160} stroke={theme.danger} strokeWidth={8} strokeLinecap="round" />
          {/* 落差括线 */}
          <path d="M240 58 V36 H640 V150" fill="none" stroke={theme.danger} strokeWidth={2.5} {...bracket} />
        </svg>
        <div style={{position: 'absolute', left: 196, top: 242, fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'公开题库'}</div>
        <div style={{position: 'absolute', left: 580, top: 242, fontFamily: theme.sans, fontSize: 20, color: theme.danger}}>{'密封 36.7%'}</div>
        <div style={{position: 'absolute', left: 372, top: 8, fontFamily: theme.mono, fontSize: 24, color: theme.danger}}>{'差 ≈ 50 点'}</div>
      </div>
      {/* ⑥ >0.9 滤网筛批次（承接装置） */}
      <div style={{position: 'absolute', left: 980, top: 570, width: 800, opacity: filtO}}>
        <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.bar}}>{'读数 > 0.9'}</div>
        <div style={{position: 'relative', height: 220, marginTop: 6}}>
          {/* 批次微粒（高读数者穿过网眼落入待验托盘） */}
          {SIEVE_MARKED.map((marked, i) => {
            const p = sieve[i];
            const dropY = marked ? p * 84 : 0;
            const color = marked ? interpolateColors(p, [0, 1], [theme.dim, theme.bar]) : theme.panelBorder;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 70 + i * 36,
                  top: 34 + dropY,
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  background: color,
                  opacity: filtO,
                }}
              />
            );
          })}
          {/* 网眼（三层栅） */}
          {[0, 1, 2].map((r) => (
            <div key={r} style={{position: 'absolute', left: 60, top: 96 + r * 7, width: 460, height: 3, background: theme.panelBorder}} />
          ))}
          {/* 待验托盘（格黄虚框） */}
          <div
            style={{
              position: 'absolute',
              left: 60,
              top: 196,
              width: 460,
              height: 54,
              border: `2px dashed ${theme.slotDeep}`,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 16,
              color: theme.dim,
            }}
          >
            {'筛出 · 待验'}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 5-D ────────────────────────────────────────────────────────────────────

/** 5-D 公平骰子实验卡：六面骰 + 六等分柱（世界本身的随机）→ 空读数栏（不该报把握）
 *  → 82.9% vs 19% 断裂对望 + 「400 次」。 */
const DIE_PIPS: [number, number][] = [
  [0.27, 0.27], [0.27, 0.5], [0.27, 0.73], [0.73, 0.27], [0.73, 0.5], [0.73, 0.73],
];

const DiceLab: React.FC<{rollAt: number; barsAt: number; emptyAt: number; clashAt: number; countAt: number}> = ({
  rollAt,
  barsAt,
  emptyAt,
  clashAt,
  countAt,
}) => {
  const roll = useProgress(rollAt, 33, 'decelerate'); // 骰子滚入 ~1.1s（beat 级显式帧数）
  const bars = useStagger(6, {at: barsAt, stride: 4, dur: DUR.f4});
  const emptyO = useProgress(emptyAt, DUR.f4);
  const clashL = useEnter('slideL', {at: clashAt, dur: DUR.f5, springPreset: 'settle'});
  const clashR = useEnter('slideR', {at: clashAt + 3, dur: DUR.f5, springPreset: 'settle'});
  const crackO = useProgress(clashAt + 5, DUR.f4);
  const count = useCount({from: 0, to: 400, at: countAt, dur: DUR.f6});
  const BASE = 660;
  const BARH = 70; // 1/6 ≈ 16.7% × 420px 轴高
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {/* 六面骰（滚入减速 + 翻滚） */}
      <div
        style={{
          position: 'absolute',
          left: 170,
          top: 240,
          width: 170,
          height: 170,
          transform: `translateX(${(roll - 1) * 300}px) rotate(${roll * 540}deg)`,
          opacity: roll,
        }}
      >
        <svg width={170} height={170} viewBox="0 0 170 170">
          <rect x={6} y={6} width={158} height={158} rx={26} fill={theme.panel} stroke={theme.dim} strokeWidth={4} />
          {DIE_PIPS.map(([px, py], i) => (
            <circle key={i} cx={px * 170} cy={py * 170} r={11} fill={theme.text} />
          ))}
        </svg>
      </div>
      <div style={{position: 'absolute', left: 168, top: 430, width: 174, textAlign: 'center', fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>
        {'公平骰子'}
      </div>
      {/* 六等分柱（世界本身的随机） */}
      <div style={{position: 'absolute', left: 470, top: 180, width: 540, height: 480}}>
        <div style={{position: 'absolute', left: 0, top: BASE - 480, width: 2, height: 480, background: theme.panelBorder}} />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const p = bars[i];
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 24 + i * 86,
                top: BASE - BARH * p,
                width: 64,
                height: BARH * p,
                background: theme.bar,
                borderRadius: '3px 3px 0 0',
                opacity: 0.88,
              }}
            />
          );
        })}
        <div style={{position: 'absolute', left: 0, top: BASE, width: 536, height: 3, background: theme.panelBorder}} />
        <div style={{position: 'absolute', left: 24, top: BASE - BARH - 32, fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'1/6'}</div>
        <div style={{position: 'absolute', left: 0, top: BASE + 14, width: 536, textAlign: 'center', fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
          {'世界本身的随机'}
        </div>
      </div>
      {/* 空读数栏（虚框——不该报把握） */}
      <div
        style={{
          position: 'absolute',
          left: 470,
          top: 742,
          width: 500,
          height: 66,
          border: `2px dashed ${theme.panelBorder}`,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: 20,
          opacity: emptyO,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 30, color: theme.dim}}>{'—'}</span>
        <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'不该报把握'}</span>
      </div>
      {/* 82.9% vs 19% 断裂对望（共用基线，裂缝居中） */}
      <div style={{position: 'absolute', left: 1110, top: 220, width: 660, height: 600}}>
        {/* 裂缝 */}
        <svg width={180} height={500} style={{position: 'absolute', left: 250, top: 0, opacity: crackO}}>
          <polyline points="60,0 112,130 40,280 122,420 56,500" fill="none" stroke={theme.danger} strokeWidth={3} strokeDasharray="11 9" />
        </svg>
        {/* 读数柱 82.9%（描边+mono＝读数） */}
        <div
          style={{
            position: 'absolute',
            left: 40,
            top: 0,
            height: 500,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'flex-start',
            opacity: clashL.opacity,
            transform: `${clashL.transform} rotate(-3deg)`,
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 40, color: theme.bar}}>{'82.9%'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, margin: '4px 0 10px'}}>{'读数'}</div>
          <div style={{width: 120, height: 415, border: `4px solid ${theme.bar}`, borderRadius: '4px 4px 0 0'}} />
        </div>
        {/* 命中柱 19%（警示红实心＝失败态） */}
        <div
          style={{
            position: 'absolute',
            left: 500,
            top: 0,
            height: 500,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'flex-start',
            opacity: clashR.opacity,
            transform: `${clashR.transform} rotate(3deg)`,
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 40, color: theme.danger}}>{'19%'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, margin: '4px 0 10px'}}>{'命中'}</div>
          <div style={{width: 120, height: 95, background: theme.danger, borderRadius: '4px 4px 0 0'}} />
        </div>
        {/* 共用基线 */}
        <div style={{position: 'absolute', left: 0, top: 502, width: 660, height: 3, background: theme.panelBorder}} />
        {/* 400 次计数器收尾 */}
        <div style={{position: 'absolute', left: 0, top: 528, width: 660, textAlign: 'center', opacity: clashR.opacity}}>
          <span style={{fontFamily: theme.mono, fontSize: 40, color: theme.text}}>{Math.round(count)}</span>
          <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{' 次重复'}</span>
        </div>
      </div>
      <EvBadge kind="third" name="dice" at={rollAt} style={{position: 'absolute', right: 110, top: 178}} />
    </div>
  );
};

// ── 5-E ────────────────────────────────────────────────────────────────────

/** 5-E 原理与门槛：校准=模型×分布（两圆相交）→ 一套秤服务所有城（连线全断）→
 *  官方认领卡 → 最小复现（同一道放行门槛：分布内错 19%／分布外全错，转深红调）。 */
const PrincipleGates: React.FC<{
  qAt: number;
  vennAt: number;
  cityAt: number;
  claimAt: number;
  reproAt: number;
  inAt: number;
  outAt: number;
}> = ({qAt, vennAt, cityAt, claimAt, reproAt, inAt, outAt}) => {
  const q = useProgress(qAt, DUR.f4);
  const venn = useSpring('settle', {at: vennAt, dur: DUR.f5});
  const vennO = useProgress(vennAt, DUR.f4);
  const noteO = useProgress(vennAt + 20, DUR.f4);
  const breaks = useStagger(5, {at: cityAt, stride: 5, dur: DUR.f4});
  const claim = useEnter('rise', {at: claimAt, dur: DUR.f4, springPreset: 'settle'});
  const reproO = useProgress(reproAt, DUR.f4);
  const inP = useProgress(inAt, DUR.f4);
  const outP = useProgress(outAt, DUR.f4);
  const redO = 0.05 * inP + 0.06 * outP; // 反转段：画面转深红调（effects 纯缓动）
  const cx1 = 250 - (1 - venn) * 80;
  const cx2 = 410 + (1 - venn) * 80;
  const CITY_X = [120, 260, 400, 540, 680];
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {/* 问句标签（承接装置） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 112, textAlign: 'center', opacity: q}}>
        <span style={{fontFamily: theme.sans, fontSize: 38, fontWeight: 600, color: theme.text}}>{'为什么一换就失灵'}</span>
        <div style={{width: 300, height: 3, background: theme.dim, margin: '10px auto 0', transform: `scaleX(${q})`}} />
      </div>
      {/* 原理卡：两圆相交 */}
      <div style={{position: 'absolute', left: 150, top: 196, width: 700, height: 400, opacity: vennO}}>
        <div style={{position: 'absolute', inset: 0, background: theme.panel, border: `2px solid ${theme.panelBorder}`, borderRadius: 14}} />
        <svg width={700} height={400} viewBox="0 0 700 400" style={{position: 'relative'}}>
          <defs>
            <clipPath id="venn-clip-a">
              <circle cx={cx1} cy={205} r={115} />
            </clipPath>
          </defs>
          <circle cx={cx1} cy={205} r={115} fill="none" stroke={theme.dim} strokeWidth={3} />
          <circle cx={cx2} cy={205} r={115} fill="none" stroke={theme.dim} strokeWidth={3} />
          {/* 交集＝校准（柱青） */}
          <circle cx={cx2} cy={205} r={115} fill={theme.bar} opacity={0.32} clipPath="url(#venn-clip-a)" />
          <text x={cx1 - 92} y={60} textAnchor="middle" fill={theme.text} fontSize={27} fontFamily={theme.sans}>
            {'模型'}
          </text>
          <text x={cx2 + 92} y={60} textAnchor="middle" fill={theme.text} fontSize={27} fontFamily={theme.sans}>
            {'分布'}
          </text>
          <text x={(cx1 + cx2) / 2} y={214} textAnchor="middle" fill={theme.bar} fontSize={27} fontFamily={theme.sans}>
            {'校准'}
          </text>
        </svg>
        <EvBadge kind="third" name="Molas" note="原理侧" at={vennAt + 6} style={{position: 'absolute', right: 16, top: 12}} />
      </div>
      {/* 反例小注（灰斜体） */}
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 612,
          width: 700,
          fontFamily: theme.sans,
          fontStyle: 'italic',
          fontSize: 19,
          color: theme.dim,
          opacity: noteO,
        }}
      >
        {'反例 · 新生成数学族 56% 对 35%（欠自信方向）'}
      </div>
      {/* 一套秤服务所有城（连线全断） */}
      <div style={{position: 'absolute', left: 960, top: 196, width: 800, height: 400}}>
        <div style={{position: 'absolute', inset: 0, background: theme.panel, border: `2px solid ${theme.panelBorder}`, borderRadius: 14}} />
        <svg width={800} height={400} viewBox="0 0 800 400" style={{position: 'relative'}}>
          {/* 秤（梁 + 立柱 + 秤盘） */}
          <line x1={250} y1={74} x2={550} y2={74} stroke={theme.dim} strokeWidth={4} />
          <line x1={400} y1={74} x2={400} y2={130} stroke={theme.dim} strokeWidth={4} />
          <path d="M370 130 L430 130 L400 156 Z" fill="none" stroke={theme.dim} strokeWidth={3} />
          {/* 城 → 秤 的连线（逐条拉断：整线淡出，断口两侧半段以警示红虚线显现） */}
          {CITY_X.map((x2, i) => {
            const x1 = 400;
            const y1 = 168;
            const y2 = 296;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.hypot(dx, dy);
            const ux = dx / len;
            const uy = dy / len;
            const off = breaks[i] * 16;
            const col = interpolateColors(breaks[i], [0, 1], [theme.dim, theme.danger]);
            const b = breaks[i];
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={theme.dim} strokeWidth={2.5} opacity={1 - b} />
                <line x1={x1} y1={y1} x2={x1 + ux * (len / 2 - off)} y2={y1 + uy * (len / 2 - off)} stroke={col} strokeWidth={2.5} opacity={b} />
                <line x1={x1 + ux * (len / 2 + off)} y1={y1 + uy * (len / 2 + off)} x2={x2} y2={y2} stroke={col} strokeWidth={2.5} opacity={b} strokeDasharray="7 7" />
              </g>
            );
          })}
          {/* 五座城（楼群剪影） */}
          {CITY_X.map((x, i) => (
            <g key={i}>
              <rect x={x - 30} y={316} width={22} height={48 - (i % 3) * 8} fill="#1a2231" />
              <rect x={x - 4} y={296} width={26} height={68} fill="#1a2231" />
            </g>
          ))}
        </svg>
        <div style={{position: 'absolute', left: 0, width: 800, top: 38, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>
          {'一套秤'}
        </div>
        <div style={{position: 'absolute', left: 0, width: 800, top: 372, textAlign: 'center', fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>
          {'服务所有城'}
        </div>
      </div>
      {/* 官方认领卡（虚线徽） */}
      <div style={{position: 'absolute', left: 570, top: 648, width: 780, opacity: claim.opacity, transform: claim.transform}}>
        <div
          style={{
            border: `2px dashed ${theme.dim}`,
            borderRadius: 12,
            background: theme.panel,
            padding: '18px 26px',
            display: 'flex',
            alignItems: 'center',
            gap: 22,
          }}
        >
          <EvBadge kind="official" at={claimAt + 4} />
          <span style={{fontFamily: theme.sans, fontSize: 29, color: theme.text}}>{'定制只能换单子'}</span>
        </div>
      </div>
      {/* 最小复现：同一道放行门槛（分布内 vs 分布外） */}
      <EvBadge kind="ours" name="原型" at={reproAt} style={{position: 'absolute', left: 246, top: 742}} />
      <div style={{position: 'absolute', left: 240, top: 790, width: 1440, height: 4, background: theme.gate, opacity: reproO}} />
      <div style={{position: 'absolute', left: 240, top: 764, fontFamily: theme.mono, fontSize: 18, color: theme.gate, opacity: reproO}}>
        {'放行门槛'}
      </div>
      <div style={{position: 'absolute', left: 240, top: 806, width: 560, height: 106, background: theme.panel, border: `2px solid ${theme.panelBorder}`, borderRadius: 10, opacity: reproO}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px 0'}}>
          <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.text}}>{'分布内'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 23, color: theme.danger, opacity: inP}}>{'错 19%'}</span>
        </div>
        <svg width={524} height={54} viewBox="0 0 524 54" style={{marginLeft: 18}}>
          <path d="M60 48 C 150 4, 300 4, 390 48" fill="none" stroke={theme.dim} strokeWidth={2.5} />
        </svg>
      </div>
      <div style={{position: 'absolute', left: 1120, top: 806, width: 560, height: 106, background: theme.panel, border: `2px solid ${theme.panelBorder}`, borderRadius: 10, opacity: reproO}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px 0'}}>
          <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.text}}>{'分布外'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 23, color: theme.danger, opacity: outP}}>{'全错'}</span>
        </div>
        <svg width={524} height={54} viewBox="0 0 524 54" style={{marginLeft: 18}}>
          <path d="M30 44 C 130 22, 240 30, 350 18 C 410 12, 450 26, 494 40" fill="none" stroke={theme.dim} strokeWidth={2.5} />
          {outP > 0
            ? Array.from({length: 7}, (_, i) => <circle key={i} cx={80 + i * 60} cy={30} r={6} fill={theme.danger} opacity={outP} />)
            : null}
        </svg>
      </div>
      {/* 反转段深红调（叠加于本镜装置之上；本镜无 archify，无让位冲突） */}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, rgba(255,92,92,0.55), rgba(255,92,92,0.12) 72%)', opacity: redO}} />
    </div>
  );
};

// ── 5-F ────────────────────────────────────────────────────────────────────

/** 5-F 复刻工位：温度旋钮 + 分桶重校（0.466→0.081）＋排序榜单行序不动（该错的照旧放行）。 */
const BUCKET0 = [0.9, 0.72, 0.58, 0.78, 0.62];
const BUCKET1 = [0.34, 0.26, 0.2, 0.3, 0.24];
const ROWV0 = [0.9, 0.8, 0.7, 0.85, 0.6];
const ROWV1 = [0.5, 0.44, 0.4, 0.5, 0.34];

const ReplicaBench: React.FC<{revealAt: number}> = ({revealAt}) => {
  const enter = useEnter('rise', {at: revealAt, dur: DUR.f5, springPreset: 'settle', restBottom: 908});
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - revealAt);
  const knobA = -70 + Math.min(1, t / 90) * 140; // 机械匀速调温行程（beat 级显式帧数）
  const afterO = useProgress(revealAt + 8, DUR.f4);
  const drops = useStagger(5, {at: revealAt + 6, stride: 4, dur: DUR.f5});
  const rowsDrop = useProgress(revealAt + 10, DUR.f5);
  const wrongO = useProgress(revealAt + 16, DUR.f4);
  const knobRad = ((knobA - 90) * Math.PI) / 180;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: enter.opacity, transform: enter.transform}}>
      <EvBadge kind="ours" name="复刻" at={revealAt} style={{position: 'absolute', left: 150, top: 156}} />
      {/* 温度旋钮（机械匀速转动） */}
      <div style={{position: 'absolute', left: 150, top: 240}}>
        <svg width={160} height={180} viewBox="0 0 160 180">
          {[-70, -35, 0, 35, 70].map((a) => {
            const r1 = 64;
            const r2 = 76;
            const rad = ((a - 90) * Math.PI) / 180;
            return (
              <line
                key={a}
                x1={80 + Math.cos(rad) * r1}
                y1={92 + Math.sin(rad) * r1}
                x2={80 + Math.cos(rad) * r2}
                y2={92 + Math.sin(rad) * r2}
                stroke={theme.panelBorder}
                strokeWidth={3}
              />
            );
          })}
          <circle cx={80} cy={92} r={56} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={3} />
          <line x1={80} y1={92} x2={80 + Math.cos(knobRad) * 42} y2={92 + Math.sin(knobRad) * 42} stroke={theme.bar} strokeWidth={6} strokeLinecap="round" />
        </svg>
        <div style={{textAlign: 'center', fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 4}}>{'调温'}</div>
      </div>
      {/* 修前/修后 ECE（描边+mono＝读数） */}
      <div style={{position: 'absolute', left: 380, top: 250, width: 280, height: 140, border: `2.5px solid ${theme.panelBorder}`, borderRadius: 12, background: theme.panel, padding: '16px 20px'}}>
        <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'修前 ECE'}</div>
        <div style={{fontFamily: theme.mono, fontSize: 54, color: theme.dim, marginTop: 8}}>{'0.466'}</div>
      </div>
      <div style={{position: 'absolute', left: 672, top: 300, fontFamily: theme.mono, fontSize: 44, color: theme.dim, opacity: afterO}}>{'→'}</div>
      <div style={{position: 'absolute', left: 744, top: 250, width: 280, height: 140, border: `2.5px solid ${theme.bar}`, borderRadius: 12, background: theme.panel, padding: '16px 20px', opacity: afterO}}>
        <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'修后 ECE'}</div>
        <div style={{fontFamily: theme.mono, fontSize: 54, color: theme.bar, marginTop: 8}}>{'0.081'}</div>
      </div>
      {/* 分桶重校（读数柱齐降） */}
      <div style={{position: 'absolute', left: 380, top: 452, width: 644, height: 240}}>
        <div style={{position: 'absolute', left: 0, top: 196, width: 640, height: 3, background: theme.panelBorder}} />
        {BUCKET0.map((v0, i) => {
          const v = v0 + (BUCKET1[i] - v0) * drops[i];
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 14 + i * 126,
                top: 196 - v * 170,
                width: 92,
                height: v * 170,
                border: `2.5px solid ${theme.bar}`,
                borderRadius: '3px 3px 0 0',
              }}
            />
          );
        })}
        <div style={{position: 'absolute', left: 0, top: 208, width: 640, textAlign: 'center', fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>
          {'分桶重校 · 读数齐降'}
        </div>
      </div>
      {/* 排序榜单（行序一格未动） */}
      <div style={{position: 'absolute', left: 1080, top: 232, width: 720}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
          <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'排序榜单'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, opacity: rowsDrop}}>{'行序 · 一格未动'}</span>
          {/* 图钉（榜单被钉死） */}
          <svg width={20} height={20} viewBox="0 0 20 20" style={{opacity: rowsDrop}}>
            <circle cx={10} cy={7} r={5} fill="none" stroke={theme.dim} strokeWidth={2} />
            <line x1={10} y1={12} x2={10} y2={19} stroke={theme.dim} strokeWidth={2} />
          </svg>
        </div>
        <div style={{position: 'relative', height: 560, marginTop: 10}}>
          {ROWV0.map((v0, i) => {
            const v = v0 + (ROWV1[i] - v0) * rowsDrop;
            const wrong = i === 3;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: i * 110,
                  width: 700,
                  height: 92,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  background: theme.panel,
                  border: `2px solid ${wrong ? theme.danger : theme.panelBorder}`,
                  borderRadius: 10,
                  padding: '0 20px',
                }}
              >
                <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.dim, width: 36}}>{i + 1}</span>
                <div style={{width: 300, height: 34, borderRadius: 5, background: '#1d2431'}} />
                {/* 行内读数条（描边——随重校集体收窄） */}
                <div style={{width: 232, height: 26, border: `2.5px solid ${theme.bar}`, borderRadius: 4}}>
                  <div style={{width: 224 * v, height: 20, marginTop: 1, marginLeft: 1, background: `${theme.bar}33`}} />
                </div>
                {wrong ? (
                  <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.danger, opacity: wrongO}}>{'该错 · 照旧放行'}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** p5-31 幕界转接（chrome 层，不参与让位）：「答案在编排里」箭头指向下一幕。 */
const NextActTag: React.FC<{at: number}> = ({at}) => {
  const o = useProgress(at, DUR.f4);
  const nudge = useImpulse({at: at + 12, dur: DUR.f5});
  return (
    <div style={{position: 'absolute', right: 84, top: 88, display: 'flex', alignItems: 'center', gap: 12, opacity: o}}>
      <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.gate}}>{'答案 · 在编排里'}</span>
      <span style={{fontFamily: theme.mono, fontSize: 32, color: theme.gate, transform: `translateX(${nudge * 10}px)`}}>{'→'}</span>
    </div>
  );
};

// ── 冷色调（5-A 起「全片之转」：低存在感冷色渐变，垫在装置之下）────────────
const ColdTint: React.FC = () => (
  <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(43,66,92,0.16) 0%, rgba(14,17,22,0) 52%)'}} />
);

// ── 幕组装 ─────────────────────────────────────────────────────────────────

export const P5Plateau: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p5-01', 'p5-06');
  const bB = w('p5-07', 'p5-09');
  const bC = w('p5-10', 'p5-16');
  const bD = w('p5-17', 'p5-21');
  const bE = w('p5-22', 'p5-28');
  const bF = w('p5-29', 'p5-31');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A 调令与台阶">
        <ColdTint />
        <ArchifyYield cues={[{at: at('p5-03') - bA.from, durationInFrames: dur('p5-03')}]}>
          <SkylinePlateau switchAt={at('p5-02') - bA.from} />
          <TransferOrder at={at('p5-02') - bA.from} />
          <PlateauScoreboard
            enterAt={at('p5-04') - bA.from}
            stepAt={at('p5-04') - bA.from + 6}
            gapAt={at('p5-05') - bA.from}
            bellAt={at('p5-06') - bA.from}
          />
          <SteadyHand at={at('p5-04') - bA.from + 4} />
        </ArchifyYield>
        <ArchifyRecap
          slug="calibration-territory"
          caption="校准领地"
          cues={[{chapterId: 'ct-in', at: at('p5-03') - bA.from, durationInFrames: dur('p5-03')}]}
        />
        <SceneTag chapter="P5" tagline="高原上的七成" accent={theme.bar} />
        <TurnMark at={at('p5-01') - bA.from} />
      </Sequence>

      <Sequence {...bB} name="5-B 没有调令的世界">
        <ColdTint />
        <ArchifyYield cues={[{at: at('p5-08') - bB.from, durationInFrames: dur('p5-08')}]}>
          {/* redAt 提前 24 帧起坡：让「灰→警示红」在让位淡出前可见（beat 级显式偏移） */}
          <DriftScatter at={at('p5-07') - bB.from} redAt={at('p5-08') - bB.from - 24} />
          <ShadowAudit at={at('p5-09') - bB.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="calibration-territory"
          caption="校准领地"
          cues={[{chapterId: 'ct-drift', at: at('p5-08') - bB.from, durationInFrames: dur('p5-08')}]}
        />
        <SceneTag chapter="P5" tagline="高原上的七成" accent={theme.bar} />
      </Sequence>

      <Sequence {...bC} name="5-C 密封新题与台阶">
        <ColdTint />
        <ArchifyYield cues={[{at: at('p5-16') - bC.from, durationInFrames: dur('p5-16')}]}>
          <SealedNumbers
            eceAt={at('p5-10') - bC.from}
            checkAt={at('p5-11') - bC.from}
            envAt={at('p5-12') - bC.from}
            bigAt={at('p5-13') - bC.from}
            rulerAt={at('p5-14') - bC.from}
            filterAt={at('p5-15') - bC.from}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="calibration-territory"
          caption="校准领地"
          cues={[{chapterId: 'ct-cliff', at: at('p5-16') - bC.from, durationInFrames: dur('p5-16')}]}
        />
        <SceneTag chapter="P5" tagline="高原上的七成" accent={theme.bar} />
      </Sequence>

      <Sequence {...bD} name="5-D 公平骰子">
        <ColdTint />
        <ArchifyYield cues={[{at: at('p5-20') - bD.from, durationInFrames: dur('p5-20')}]}>
          <DiceLab
            rollAt={at('p5-17') - bD.from}
            barsAt={at('p5-18') - bD.from}
            emptyAt={at('p5-19') - bD.from}
            clashAt={at('p5-21') - bD.from}
            countAt={at('p5-21') - bD.from + 8}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="calibration-territory"
          caption="校准领地"
          cues={[{chapterId: 'ct-wild', at: at('p5-20') - bD.from, durationInFrames: dur('p5-20')}]}
        />
        <SceneTag chapter="P5" tagline="高原上的七成" accent={theme.bar} />
      </Sequence>

      <Sequence {...bE} name="5-E 原理与门槛">
        <ColdTint />
        <PrincipleGates
          qAt={at('p5-22') - bE.from}
          vennAt={at('p5-23') - bE.from}
          cityAt={at('p5-24') - bE.from}
          claimAt={at('p5-25') - bE.from}
          reproAt={at('p5-26') - bE.from}
          inAt={at('p5-27') - bE.from}
          outAt={at('p5-28') - bE.from}
        />
        <SceneTag chapter="P5" tagline="高原上的七成" accent={theme.bar} />
      </Sequence>

      <Sequence {...bF} name="5-F 修读数不修排序">
        <ColdTint />
        <ArchifyYield
          cues={[
            {at: at('p5-29') - bF.from, durationInFrames: dur('p5-29')},
            {at: at('p5-31') - bF.from, durationInFrames: dur('p5-31')},
          ]}
        >
          {/* 复刻工位在 p5-30（两段 cue 之间的回切句窗）可见：旋钮转动 / 读数齐降 / 榜单不动 */}
          <ReplicaBench revealAt={at('p5-30') - bF.from} />
          <Footnote delay={at('p5-30') - bF.from}>{'原型 S11 · 分桶调温 · 逐桶重校'}</Footnote>
        </ArchifyYield>
        <ArchifyRecap
          slug="calibration-territory"
          caption="校准领地"
          cues={[{chapterId: 'ct-fix', at: at('p5-29') - bF.from, durationInFrames: dur('p5-29')}]}
        />
        <ArchifyRecap
          slug="three-gates-routing"
          caption="三道闸分流"
          cues={[{chapterId: 'tg-read', at: at('p5-31') - bF.from, durationInFrames: dur('p5-31')}]}
        />
        <SceneTag chapter="P5" tagline="高原上的七成" accent={theme.bar} />
        <NextActTag at={at('p5-31') - bF.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
