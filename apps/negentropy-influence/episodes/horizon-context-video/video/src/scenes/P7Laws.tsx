/** P7 规律与边界（p7-01..p7-19，19 句，无 p7-09；storyboard「P7 规律与边界」节）。
 *
 *  8 镜 / 13 条 archify cue（7-F 原生五卡实现——five-laws 图转 docs 资产，无 cue 可接链；
 *  其余实例首 cue 均与上一实例链尾跨实例背靠背 → lead={false}，唯 7-G 隔 p7-12b + 7-F
 *  四句长空窗 ~26s 恢复入场）：
 *   7-A 徽墙+冷水 dual-baseline-evidence two-benchmarks@01 → evidence-grading vendor-claim@02
 *   7-B 读表三问 evidence-grading vendor-claim@03（同章重放，镜界背靠背）
 *   7-C 治理≠验证 grain-collapse day-pack-collapse@04→legal-but-wrong@05 + govern-vs-verify upstream-collapse@06
 *   7-D 玩具复现 grain-collapse measured-477-48@07（同 slug 跨实例）+ govern-vs-verify third-party-critique@08
 *   7-E 边界 perimeter-loss inside-effective@10→outside-void@11；p7-12/12b 空窗让护栏卡+dbt 角标全显
 *   7-F 五规律原生五卡逐句点亮 + 定义卡母题满屏叠影
 *   7-G 自测三问 three-claims-stack guess-only@17（隔 7-F 长空窗恢复入场）→ governed-trust@18
 *   7-H 收拢入母题、翻转亮三色描边定格；尾幕渐黑 useFadeOut 从末 beat 总时长推导（红线四）
 *
 *  P7 角标带约定（v4 全屏独占的落点）：7-A..7-D 每句都挂 cue、镜内无空窗句，徽墙/
 *  三问/断崖/算式一律收进 y66..150 顶部角标带（画框上沿 150 之上、SceneTag 右侧居中，
 *  零重叠）；7-G 三问卡按 storyboard「竖排」落右侧边带（left 1634 > 框右缘 1609，
 *  ArchifyClip 几何注③「两侧无常驻件」按本镜 storyboard 要求显式重引，坐标已对账）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useBreathe,
  useCount,
  useEnter,
  useFadeOut,
  usePushIn,
  useReveal,
  useSpring,
  useStagger,
} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge, type BadgeLevel} from '../components/EvidenceBadge';
import {DefinitionCard, GuardrailCard} from '../components/devices';

/** #RRGGBB → rgba（本集 theme 未导出 withAlpha；与 devices.tsx 同形的本地替身）。 */
const withA = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** 顶部角标带（y66..150，框上沿之上）：cue 全覆盖镜的自制件统一收此处。
 *  注意 AbsoluteFill 自带 flexDirection:column——横向行必须显式翻回 row。 */
const TopBand: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill
    style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: 66,
      pointerEvents: 'none',
    }}
  >
    {children}
  </AbsoluteFill>
);

// ─────────────────────────────────────────────── 7-A 徽墙 + 冷水

/** 三级证据徽墙：全片数字来源按三级分色图例回照（角标带错峰亮）。 */
const WALL: readonly {level: BadgeLevel; note: string}[] = [
  {level: 'dashed', note: '增益 59×–91×'},
  {level: 'solid', note: '477 vs 48'},
  {level: 'filled', note: '300 vs 600'},
];

const EvidenceWall: React.FC<{at: number}> = ({at}) => {
  const opens = useStagger(WALL.length, {at, stride: 12, dur: DUR.f5});
  return (
    <TopBand>
      <div style={{display: 'flex', gap: 34, alignItems: 'center'}}>
        {WALL.map((w, i) => (
          <div
            key={w.level}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 20px',
              borderRadius: 12,
              background: theme.panel,
              border: `1.5px solid ${theme.panelBorder}`,
              opacity: opens[i],
              transform: `translateY(${(1 - opens[i]) * 14}px)`,
            }}
          >
            <EvidenceBadge level={w.level} at={at} />
            <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{w.note}</span>
          </div>
        ))}
      </div>
    </TopBand>
  );
};

/** 冷水色温转冷：全幅冷色罩（effects 通道：时长+缓动；36 帧≈1.2s 为 beat 级铺陈）。 */
const ColdWash: React.FC<{at: number}> = ({at}) => {
  const o = useEnter('fade', {at, dur: 36}).opacity;
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(180deg, rgba(124,158,205,0.13), rgba(108,146,196,0.08))',
        opacity: o,
        pointerEvents: 'none',
      }}
    />
  );
};

// ─────────────────────────────────────────────── 7-B 读表纪律

const READ_Q = ['谁测的', '什么条件', '截至何时'] as const;

/** 读表三连章：谁测的/什么条件/截至何时（角标带错峰，青=验证纪律）。 */
const ReadDiscipline: React.FC<{at: number}> = ({at}) => {
  const opens = useStagger(READ_Q.length, {at, stride: 10, dur: DUR.f5});
  return (
    <TopBand>
      <div style={{display: 'flex', gap: 26}}>
        {READ_Q.map((q, i) => (
          <div
            key={q}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 22px',
              borderRadius: 999,
              border: `2px solid ${withA(theme.verify, 0.55)}`,
              background: theme.panel,
              opacity: opens[i],
              transform: `translateY(${(1 - opens[i]) * 14}px)`,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.verify}}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{q}</span>
          </div>
        ))}
      </div>
    </TopBand>
  );
};

// ─────────────────────────────────────────────── 7-C 477 vs 48 断崖

/** 治理≠验证 + 477/48 断崖对比：数字翻牌（@count）+ ≈9× 差距角标 + 实线徽（typedef 转述）。 */
const CliffContrast: React.FC<{atClaim: number; atNums: number; atGap: number}> = ({
  atClaim,
  atNums,
  atGap,
}) => {
  const frame = useCurrentFrame();
  const e = useEnter('rise', {at: atClaim, dur: DUR.f5, dist: 18});
  const gov = useCount({to: 477, at: atNums, dur: 28});
  const rec = useCount({to: 48, at: atNums + 8, dur: 28});
  const gap = progress(frame, atGap, DUR.f4);
  return (
    <TopBand>
      <div style={{...e, display: 'flex', alignItems: 'center', gap: 28}}>
        <span style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.text}}>
          {'治理 ≠ 验证'}
        </span>
        <div style={{width: 2, height: 54, background: theme.panelBorder}} />
        <div style={{textAlign: 'center'}}>
          <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim}}>{'治理口径'}</div>
          <div
            style={{
              fontFamily: theme.mono,
              fontVariantNumeric: 'tabular-nums',
              fontSize: 44,
              lineHeight: 1.05,
              color: theme.text,
            }}
          >
            {Math.round(gov)}
          </div>
        </div>
        <svg width={30} height={44} viewBox="0 0 30 44">
          <line x1={15} y1={4} x2={15} y2={30} stroke={theme.verify} strokeWidth={3} />
          <polygon points="7,28 23,28 15,42" fill={theme.verify} />
        </svg>
        <div style={{textAlign: 'center'}}>
          <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim}}>{'重算'}</div>
          <div
            style={{
              fontFamily: theme.mono,
              fontVariantNumeric: 'tabular-nums',
              fontSize: 44,
              lineHeight: 1.05,
              color: theme.verify,
            }}
          >
            {Math.round(rec)}
          </div>
        </div>
        <div
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            border: `1.5px solid ${withA(theme.concept, 0.5)}`,
            opacity: gap,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.concept}}>{'≈9× 差距'}</span>
        </div>
        <EvidenceBadge level="solid" at={atGap} note="typedef 转述" />
      </div>
    </TopBand>
  );
};

// ─────────────────────────────────────────────── 7-D 玩具算式

/** 玩具复现：两天各两笔 → 相加 4 vs 去重 3（逐笔落位翻牌）+ 实心徽。 */
const ToyLedger: React.FC<{at: number}> = ({at}) => {
  const opens = useStagger(4, {at, stride: 9, dur: DUR.f4});
  const d1 = useCount({to: 2, at: at + 4, dur: 10});
  const d2 = useCount({to: 2, at: at + 10, dur: 10});
  const sum = useCount({to: 4, at: at + 20, dur: 14});
  const dedup = useCount({to: 3, at: at + 32, dur: 14});
  const cells = [
    {label: '第 1 天', v: d1, tone: theme.text},
    {label: '第 2 天', v: d2, tone: theme.text},
    {label: '相加', v: sum, tone: theme.text},
    {label: '去重', v: dedup, tone: theme.verify},
  ];
  return (
    <TopBand>
      <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
        {cells.map((c, i) => (
          <div
            key={c.label}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              padding: '10px 18px',
              borderRadius: 12,
              background: theme.panel,
              border: `1.5px solid ${i === 3 ? withA(theme.verify, 0.5) : theme.panelBorder}`,
              opacity: opens[i],
              transform: `translateY(${(1 - opens[i]) * 14}px)`,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim}}>{c.label}</span>
            <span
              style={{
                fontFamily: theme.mono,
                fontVariantNumeric: 'tabular-nums',
                fontSize: 40,
                color: c.tone,
              }}
            >
              {Math.round(c.v)}
            </span>
          </div>
        ))}
        <EvidenceBadge level="filled" at={at + 44} note="玩具原型复算" />
      </div>
    </TopBand>
  );
};

// ─────────────────────────────────────────────── 7-E dbt 真争议角标

/** dbt 自家基准：裸模型占比 33→65（三年）+ 虚线徽（厂商自报）。 */
const DbtWindow: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('rise', {at, dur: DUR.f5, dist: 20});
  const v = useCount({from: 33, to: 65, at: at + 6, dur: 34});
  return (
    <div
      style={{
        ...e,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '14px 24px',
        borderRadius: 12,
        background: theme.panel,
        border: `1.5px solid ${theme.panelBorder}`,
      }}
    >
      <EvidenceBadge level="dashed" at={at} note="dbt 自家基准" />
      <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.text}}>{'裸模型占比 · 三年'}</span>
      <span
        style={{
          fontFamily: theme.mono,
          fontVariantNumeric: 'tabular-nums',
          fontSize: 40,
          color: theme.text,
        }}
      >
        {`${Math.round(v)}%`}
      </span>
      <div
        style={{
          width: 220,
          height: 8,
          borderRadius: 4,
          background: withA(theme.panelBorder, 0.6),
          overflow: 'hidden',
        }}
      >
        <div style={{width: `${((v - 33) / 32) * 100}%`, height: '100%', background: theme.conceptDeep}} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────── 7-F 原生五规律卡

/** 五规律逐句点亮：p7-13 亮题+①② / p7-14 高亮①② / p7-15 高亮③④ / p7-16 高亮⑤。
 *  反枚举色彩：panel 底+编号，激活才金描边+微光；画面文字只放关键词（口播承载完整句）。 */
const LAW_ROWS = [
  {no: '①', kw: '执行半边', note: '定义层已商品化'},
  {no: '②', kw: '执行点', note: '强制力来自求值处'},
  {no: '③', kw: '双保险', note: '注册校验 × 查询重算'},
  {no: '④', kw: '冲突浮出 · 人工裁决', note: '不投多数票'},
  {no: '⑤', kw: '三件套', note: '声明 × 背书 × 审计'},
] as const;

const FiveLawsStack: React.FC<{a13: number; a14: number; a15: number; a16: number}> = ({a13, a14, a15, a16}) => {
  const f = useCurrentFrame();
  const st = useStagger(LAW_ROWS.length, {at: a13, dur: DUR.f4, stride: DUR.f2}); // number[]：各卡 0→1
  const hl = (from: number) => progress(f, from, DUR.f5);
  const active: Record<number, number> = {
    0: Math.max(hl(a14), hl(a16)),
    1: Math.max(hl(a14), hl(a16)),
    2: hl(a15),
    3: hl(a15),
    4: hl(a16),
  };
  const glow = useBreathe({period: 90});
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 150}}>
      <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim, letterSpacing: 6, marginBottom: 28}}>
        {'五条底层规律'}
      </div>
      {LAW_ROWS.map((r, i) => {
        const on = active[i] ?? 0;
        return (
          <div
            key={r.no}
            style={{
              boxSizing: 'border-box',
              width: 1160,
              height: 96,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              padding: '0 30px',
              borderRadius: 14,
              background: theme.panel,
              border: `2px solid ${on > 0 ? theme.concept : theme.panelBorder}`,
              boxShadow: on > 0 ? `0 0 ${18 * on * (0.7 + 0.3 * glow)}px ${withA(theme.concept, 0.35 * on)}` : 'none',
              opacity: st[i],
              transform: `translateY(${(1 - st[i]) * 26}px)`,
            }}
          >
            <span style={{fontFamily: theme.serif, fontSize: 34, color: on > 0 ? theme.concept : theme.dim}}>{r.no}</span>
            <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>{r.kw}</span>
            <span style={{marginLeft: 'auto', fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{r.note}</span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 7-F 母题满屏叠影

/** 定义卡母题满屏回照：历次形态（P0 空座 / P2 注册 / P3 挂扣 / P4 盖章）逐句叠影淡入。 */
const ECHO_OFFSET = [
  {dx: -30, dy: 16, scale: 1.32},
  {dx: -10, dy: -6, scale: 1.46},
  {dx: 10, dy: 6, scale: 1.6},
  {dx: 30, dy: -16, scale: 1.74},
] as const;

const EchoGhost: React.FC<{at: number; form: number; halo: number}> = ({at, form, halo}) => {
  const e = useEnter('fade', {at, dur: DUR.f6});
  const o = ECHO_OFFSET[form];
  return (
    <AbsoluteFill
      style={{display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.16 * e.opacity}}
    >
      <div style={{transform: `translate(${o.dx}px, ${o.dy}px)`}}>
        <DefinitionCard
          at={at + 4}
          enter="fade"
          scale={o.scale}
          halo={halo}
          empty={form === 0}
          title={form === 0 ? undefined : '同一份定义'}
          claspAt={form >= 2 ? at + 14 : undefined}
          stampAt={form >= 3 ? at + 22 : undefined}
        />
      </div>
    </AbsoluteFill>
  );
};

const LawsEcho: React.FC<{anchors: readonly {at: number; form: number}[]}> = ({anchors}) => {
  const breath = useBreathe({period: 240, base: 0.4, amp: 0.6});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {anchors.map((a) => (
        <EchoGhost key={a.form} at={a.at} form={a.form} halo={0.18 + 0.14 * breath} />
      ))}
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 7-G/7-H 三问卡

/** 自测三问（三色映射本集契约轴：金=定义 / 紫=策略 / 青=验证）。 */
const SELFCHECK = [
  {kicker: 'Q1', q: '定义复制了吗？', accent: theme.concept},
  {kicker: 'Q2', q: '策略在哪层求值？', accent: theme.conceptDeep},
  {kicker: 'Q3', q: '验证交付了什么？', accent: theme.verify},
] as const;

/** 三问卡右侧边带落位（left 1634 + 宽 272 = 1906 < 1920；框右缘 1609 之外零重叠）。 */
const QSPOT = [
  {left: 1634, top: 206},
  {left: 1634, top: 424},
  {left: 1634, top: 642},
] as const;

/** 三问卡：翻面（弹簧空间通道）+ 问题打字机揭示（@reveal）。 */
const QuestionCard: React.FC<{
  at: number;
  kicker: string;
  q: string;
  accent?: string;
  reveal?: boolean;
  width?: number;
}> = ({at, kicker, q, accent = theme.verify, reveal = true, width = 272}) => {
  const frame = useCurrentFrame();
  const flip = useSpring('settle', {at, dur: DUR.f5});
  const o = progress(frame, at, DUR.f3);
  const shown = useReveal(q, {at: at + 7, cps: 11});
  return (
    <div
      style={{
        width,
        padding: '22px 24px',
        borderRadius: 14,
        background: theme.panel,
        border: `2px solid ${withA(accent, 0.7)}`,
        opacity: o,
        transform: `rotateY(${(1 - flip) * -82}deg)`,
      }}
    >
      <div style={{fontFamily: theme.mono, fontSize: 17, letterSpacing: 3, color: accent}}>{kicker}</div>
      <div
        style={{
          marginTop: 10,
          fontFamily: theme.sans,
          fontSize: 30,
          fontWeight: 600,
          color: theme.text,
          lineHeight: 1.4,
        }}
      >
        {reveal ? shown : q}
      </div>
    </div>
  );
};

/** 7-G 三问卡竖排（右侧边带，逐张翻面打字）。 */
const QuestionStack: React.FC<{baseAt: number}> = ({baseAt}) => (
  <AbsoluteFill style={{perspective: 1100, pointerEvents: 'none'}}>
    {SELFCHECK.map((c, i) => (
      <div key={c.kicker} style={{position: 'absolute', left: QSPOT[i].left, top: QSPOT[i].top}}>
        <QuestionCard at={baseAt + i * 13} kicker={c.kicker} q={c.q} accent={c.accent} />
      </div>
    ))}
  </AbsoluteFill>
);

// ─────────────────────────────────────────────── 7-H 收尾

/** 背面：三色描边（金/紫/青 同心）+ 三问定格（与母题同形 680×430·r20）。 */
const TriColorBack: React.FC = () => (
  <div style={{position: 'absolute', inset: 0}}>
    <div style={{position: 'absolute', inset: 0, borderRadius: 20, background: theme.panel}} />
    <svg width={680} height={430} viewBox="0 0 680 430" style={{position: 'absolute', inset: 0}}>
      <rect x={1} y={1} width={678} height={428} rx={19} fill="none" stroke={theme.concept} strokeWidth={2} />
      <rect x={13} y={13} width={654} height={404} rx={12} fill="none" stroke={withA(theme.conceptDeep, 0.85)} strokeWidth={1.5} />
      <rect x={25} y={25} width={630} height={380} rx={8} fill="none" stroke={withA(theme.verify, 0.85)} strokeWidth={1.5} />
    </svg>
    <div
      style={{
        position: 'absolute',
        top: 78,
        left: 76,
        right: 76,
        display: 'flex',
        flexDirection: 'column',
        gap: 34,
      }}
    >
      <div style={{fontFamily: theme.mono, fontSize: 16, letterSpacing: 4, color: theme.dim}}>
        {'SELF-CHECK · 三问'}
      </div>
      {SELFCHECK.map((r) => (
        <div key={r.kicker} style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <div style={{width: 14, height: 14, background: r.accent}} />
          <span style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 600, color: theme.text}}>{r.q}</span>
        </div>
      ))}
    </div>
    <div
      style={{
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: theme.mono,
        fontSize: 16,
        color: theme.dim,
      }}
    >
      {'定义 · 策略 · 验证'}
    </div>
  </div>
);

/** 7-H 收尾：三问卡自右侧边带收拢入定义卡母题 → 翻转亮三色描边定格 → 片尾字幕 + 渐黑。
 *  翻转/字幕时点从末 beat 总时长（totalFrames）推导钳制：保证渐黑起点（T-36）之前
 *  翻转完成、字幕足额点亮并保有 ≥8 帧全亮定格——短 beat 下不与渐黑窗口交叉。 */
const FinalCollapse: React.FC<{totalFrames: number}> = ({totalFrames}) => {
  const frame = useCurrentFrame();
  const s0 = useSpring('settle', {at: 8, dur: 16});
  const s1 = useSpring('settle', {at: 11, dur: 16});
  const s2 = useSpring('settle', {at: 14, dur: 16});
  const conv = [s0, s1, s2];
  const absorb = progress(frame, 22, 8);
  const flipAt = Math.max(24, Math.min(40, totalFrames - 60));
  const cardAt = Math.max(14, flipAt - 12); // 母题落位先于翻转一拍完成（pop dur=f5）
  const flip = useSpring('settle', {at: flipAt, dur: 18});
  const push = usePushIn(flipAt + 14);
  const creditsAt = Math.max(30, Math.min(flipAt + 20, totalFrames - 56));
  const credits = progress(frame, creditsAt, DUR.f5);
  const dim = useFadeOut(totalFrames);
  return (
    <AbsoluteFill style={{background: theme.bg, opacity: dim}}>
      <AbsoluteFill style={{transform: push, perspective: 1600}}>
        {SELFCHECK.map((c, i) => {
          const spot = QSPOT[i];
          const tx = 960 - (spot.left + 136);
          const ty = 448 + i * 88 - (spot.top + 74);
          return (
            <div
              key={c.kicker}
              style={{
                position: 'absolute',
                left: spot.left,
                top: spot.top,
                opacity: 1 - absorb,
                transform: `translate(${tx * conv[i]}px, ${ty * conv[i]}px) scale(${1 - 0.5 * conv[i]})`,
              }}
            >
              <QuestionCard at={0} kicker={c.kicker} q={c.q} accent={c.accent} reveal={false} />
            </div>
          );
        })}
        {/* 收拢合体：正面=金描边母题（M-001 同形），背面=三色描边三问定格 */}
        <div
          style={{
            position: 'absolute',
            left: 960 - 340,
            top: 540 - 215,
            width: 680,
            height: 430,
            transformStyle: 'preserve-3d',
            transform: `rotateY(${180 * flip}deg)`,
          }}
        >
          <div style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden'}}>
            <DefinitionCard at={cardAt} enter="pop" title="同一份定义" halo={0.3} />
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <TriColorBack />
          </div>
        </div>
        {/* 片尾字幕（bottom 边 880 < 字幕安全带 920） */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 806, textAlign: 'center', opacity: credits}}>
          <div style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.text}}>
            {'拆解 Horizon Context'}
          </div>
          <div style={{marginTop: 12, fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>
            {'证据分级 · 虚线=厂商自报 / 实线=第三方 / 实心=本仓复算'}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 幕编排

export const P7Laws: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p7-01', 'p7-02');
  const bB = w('p7-03');
  const bC = w('p7-04', 'p7-06');
  const bD = w('p7-07', 'p7-08');
  const bE = w('p7-10', 'p7-12b');
  const bF = w('p7-13', 'p7-16');
  const bG = w('p7-17', 'p7-18');
  const bH = w('p7-19');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P7" tagline="规律与边界" accent={theme.verify} />

      {/* 7-A 冷水：徽墙错峰 + 两章接力（A1→A2 跨实例背靠背 → false）+ 冷色罩置顶 */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="7-A 冷水">
        <EvidenceWall at={at('p7-01') - bA.from} />
        <ArchifyRecap
          slug="dual-baseline-evidence"
          caption="双基准对撞"
          cues={[{chapterId: 'two-benchmarks', at: at('p7-01') - bA.from, durationInFrames: dur('p7-01')}]}
        />
        <ArchifyRecap
          slug="evidence-grading"
          caption="厂商自报无复测"
          cues={[{chapterId: 'vendor-claim', at: at('p7-02') - bA.from, durationInFrames: dur('p7-02')}]}
          lead={false}
        />
        <ColdWash at={6} />
      </Sequence>

      {/* 7-B 读表纪律：三问角标错峰 + 同章重放（镜界接 7-A 链尾背靠背 → false） */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="7-B 读表纪律">
        <ReadDiscipline at={at('p7-03') - bB.from} />
        <ArchifyRecap
          slug="evidence-grading"
          caption="谁测的 · 什么条件 · 截至何时"
          cues={[{chapterId: 'vendor-claim', at: at('p7-03') - bB.from, durationInFrames: dur('p7-03')}]}
          lead={false}
        />
      </Sequence>

      {/* 7-C 治理≠验证：断崖翻牌 + 三章接力（首章接 7-B 链尾背靠背 → false） */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="7-C 治理≠验证">
        <CliffContrast
          atClaim={at('p7-04') - bC.from}
          atNums={at('p7-05') - bC.from}
          atGap={at('p7-06') - bC.from}
        />
        <ArchifyRecap
          slug="grain-collapse"
          caption="粒度塌缩 · 图纸合法仍错"
          cues={[
            {chapterId: 'day-pack-collapse', at: at('p7-04') - bC.from, durationInFrames: dur('p7-04')},
            {chapterId: 'legal-but-wrong', at: at('p7-05') - bC.from, durationInFrames: dur('p7-05')},
          ]}
          lead={false}
        />
        <ArchifyRecap
          slug="govern-vs-verify"
          caption="上游塌缩 · 治理≠验证"
          cues={[{chapterId: 'upstream-collapse', at: at('p7-06') - bC.from, durationInFrames: dur('p7-06')}]}
          lead={false}
        />
      </Sequence>

      {/* 7-D 玩具复现：算式逐笔落位 + 两章接力（measured-477-48 同 slug 跨实例背靠背 → false） */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="7-D 玩具复现">
        <ToyLedger at={at('p7-08') - bD.from} />
        <ArchifyRecap
          slug="grain-collapse"
          caption="477 vs 48 实测对撞"
          cues={[{chapterId: 'measured-477-48', at: at('p7-07') - bD.from, durationInFrames: dur('p7-07')}]}
          lead={false}
        />
        <ArchifyRecap
          slug="govern-vs-verify"
          caption="第三方批判"
          cues={[{chapterId: 'third-party-critique', at: at('p7-08') - bD.from, durationInFrames: dur('p7-08')}]}
          lead={false}
        />
      </Sequence>

      {/* 7-E 边界：两章接力（接 7-D 链尾背靠背 → false）+ not-industry-norm 占 p7-12（storyboard 声明位）；
          护栏卡+dbt 角标改锚 p7-12b 空窗全显（1-C 嵌套范式，嵌套窗内局部帧 0 = p7-12b 句边界——
          原锚 p7-12 会被该 cue 整句遮盖，DbtWindow 33→65 翻牌将在自己旁白句背后演完） */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="7-E 边界">
        <Sequence
          from={at('p7-12b') - bE.from}
          durationInFrames={dur('p7-12b')}
          name="7-E-guardrail"
        >
          <AbsoluteFill
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 44,
            }}
          >
            <GuardrailCard at={4} />
            <DbtWindow at={18} />
          </AbsoluteFill>
        </Sequence>
        <ArchifyRecap
          slug="perimeter-loss"
          caption="周界内外"
          cues={[
            {chapterId: 'inside-effective', at: at('p7-10') - bE.from, durationInFrames: dur('p7-10')},
            {chapterId: 'outside-void', at: at('p7-11') - bE.from, durationInFrames: dur('p7-11')},
          ]}
          lead={false}
        />
        <ArchifyRecap
          slug="evidence-grading"
          caption="非行业常态"
          cues={[{chapterId: 'not-industry-norm', at: at('p7-12') - bE.from, durationInFrames: dur('p7-12')}]}
          lead={false}
        />
      </Sequence>

      {/* 7-F 五规律：原生五卡逐句点亮（five-laws 图为 docs 研究资产，视频侧原生实现）+ 母题叠影 */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="7-F 五规律">
        <FiveLawsStack
          a13={at('p7-13') - bF.from}
          a14={at('p7-14') - bF.from}
          a15={at('p7-15') - bF.from}
          a16={at('p7-16') - bF.from}
        />
        <LawsEcho
          anchors={[
            {at: at('p7-13') - bF.from, form: 0},
            {at: at('p7-14') - bF.from, form: 1},
            {at: at('p7-15') - bF.from, form: 2},
            {at: at('p7-16') - bF.from, form: 3},
          ]}
        />
      </Sequence>

      {/* 7-G 自测三问：右侧边带竖排翻面（p7-18 起）+ 两章接力。
          首 cue 恢复入场：上一 cue（not-industry-norm）止于 p7-12，隔 p7-12b + 7-F 四句
          长空窗（~26s）——非背靠背，画框瞬现违 ArchifyRecap 契约（评审修复） */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="7-G 自测三问">
        <QuestionStack baseAt={at('p7-18') - bG.from} />
        <ArchifyRecap
          slug="three-claims-stack"
          caption="三问拆宣称"
          cues={[
            {chapterId: 'guess-only', at: at('p7-17') - bG.from, durationInFrames: dur('p7-17')},
            {chapterId: 'governed-trust', at: at('p7-18') - bG.from, durationInFrames: dur('p7-18')},
          ]}
        />
      </Sequence>

      {/* 7-H 收尾：收拢定格 + 尾幕渐黑（useFadeOut 从末 beat 总时长推导，红线四） */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="7-H 收尾">
        <FinalCollapse totalFrames={bH.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};
