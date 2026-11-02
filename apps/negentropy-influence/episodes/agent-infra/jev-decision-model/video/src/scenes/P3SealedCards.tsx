/** P3 大屏与封卡 —— 幕场景（storyboard §P3：6 镜 / 29 句 / 10 个 archify cue）。
 *
 *  视觉契约（theme 概念色）：
 *  - 格黄 slot＝预印格/封卡/单选行（形状域）；柱青 bar＝state 大屏/信息流/概率与计费读数；
 *    闸品 gate＝代码对账；警示红仅三处反直觉/失败态（p3-22 预警细线、1.19、爆表断针）。
 *  - 画面红线：恒一人一桌一排封卡（不画多人/投票，p3-05 小注钉死）。
 *  - 全屏独占：凡挂图独占切换，装置经 ArchifyYield 按 cue 窗让位（窗列表与 cues 一一对应、
 *    独立字面量）；跨实例背靠背（ls-mech→sr-once、pp-state→sr-between）后挂实例 lead={false}。
 *
 *  本幕局部装置（公共 BadgeTriad/StateScreen 落成前的本地实现，色用 theme 概念色）：
 *  Badge（三级角标前两级：虚线=官方自报 / 实线+署名=第三方实测）/ Chip（关键词标签）/
 *  Station3A（判读员工位＋state 大屏三栏＋桌沿封卡排＋计费标尺）/ Merge13（13 题合一）/
 *  ProbeRig（暗号实验台）/ RowShift（行内挪卡特写）/ Sum119（两卡加出 1.19）/
 *  Handoff（自洽交给代码＋「集中度」空栏虚框首露）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {Counter, Panel, SceneTag, ease} from '../components/motifs';
import {theme} from '../design/theme';
import {useL} from '../i18n';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  DUR,
  progress,
  schedule,
  useBreathe,
  useCount,
  useDim,
  useDraw,
  useEnter,
  useFlowDash,
  useImpulse,
  useProgress,
  usePushIn,
  useShake,
  useSpring,
} from '../motion';

// ── 小工具 ────────────────────────────────────────────────────────────────

/** #RRGGBB + alpha → rgba()（帧驱动派生色，避免散落手拼字符串） */
const withA = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;

/** 角距（度，0..180）——雷达扫描与斑点的确定性照面计算 */
const angDist = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** 句锚辅助：镜组件统一拿 beat 局部帧（ArchifyRecap 契约：at('句id')、dur('句id')） */
type BeatProps = {
  at: (id: string) => number;
  dur: (id: string) => number;
};

/** 三级角标本地件（storyboard 视觉契约：虚线徽=官方自报；实线徽+署名=第三方实测；
 *  实心+✓ 的复算徽本幕用不到，随公共 BadgeTriad 落成再收编）。at 给出「盖戳」时点。 */
const Badge: React.FC<{
  variant: 'official' | 'field';
  label: string;
  at?: number;
  style?: React.CSSProperties;
}> = ({variant, label, at = 0, style}) => {
  const o = useProgress(at, DUR.f3);
  const s = useSpring('settle', {at, dur: DUR.f4});
  const dashed = variant === 'official';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        opacity: o,
        transform: `scale(${1 + 0.45 * (1 - s)})`,
        transformOrigin: 'left center',
        ...style,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          border: `2px ${dashed ? 'dashed' : 'solid'} ${dashed ? theme.dim : theme.text}`,
          background: theme.bg,
          flexShrink: 0,
        }}
      />
      <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>{label}</span>
    </div>
  );
};

/** 关键词标签（画面文字只放关键词/数字/标签/结构） */
const Chip: React.FC<{
  color: string;
  at?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({color, at = 0, style, children}) => {
  const o = useProgress(at, DUR.f3);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 16px',
        borderRadius: 8,
        border: `2px solid ${color}`,
        background: theme.panel,
        color,
        fontFamily: theme.sans,
        fontSize: 24,
        fontWeight: 600,
        letterSpacing: 1,
        opacity: o,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** 封卡背面（封缄）：与正面同尺寸双面渲染用（backface 隐藏，翻转动画用） */
const CardBack: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      backfaceVisibility: 'hidden',
      borderRadius: 14,
      border: `2px solid ${theme.panelBorder}`,
      background: '#10141C',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <div style={{width: 44, height: 44, borderRadius: 999, border: `3px solid ${theme.slotDeep}`}} />
  </div>
);

// ── 3-A 装置：判读员工位 + state 大屏 + 封卡排 + 计费标尺 ─────────────────

const SCREEN = {x: 460, y: 118, w: 1000, h: 472} as const;
/** 以下均为**屏内局部坐标**（大屏 div 内 left/top，非全片绝对 x/y） */
const COL_CX = [172, 500, 828] as const;
const ENCODE = {x: 500, y: 410} as const;

const Station3A: React.FC<BeatProps> = ({at, dur}) => {
  const t = useL();
  const frame = useCurrentFrame();
  const settle = useSpring('settle', {at: 2, dur: DUR.f5});
  // p3-03 首放高亮：边框辉光脉冲 + 扫描线单程扫过（「只放一遍」的视觉宣言）
  const glow = useImpulse({at: at('p3-03'), dur: DUR.f6, peak: 1});
  const scan = useProgress(at('p3-03'), DUR.f6, 'linear');
  const scanX = -110 + scan * (SCREEN.w + 220);
  // 三栏 → 编码点：描线三连（错峰 4 帧）+ 静态叠加行进虚线（红线三：两特性不同元素）
  const f0 = at('p3-03');
  const d0 = useDraw(f0, DUR.f4);
  const d1 = useDraw(f0 + 4, DUR.f4);
  const d2 = useDraw(f0 + 8, DUR.f4);
  const draws = [d0, d1, d2];
  const dash = useFlowDash({dash: 12, gap: 16, period: 36});
  const flowO = useProgress(f0 + 10, DUR.f3);
  const encodeBreathe = useBreathe({period: 90, amp: 0.25, base: 0.75});
  // p3-05 封卡排同时翻面落笔 + 红线小注
  const flip = useSpring('settle', {at: at('p3-05'), dur: DUR.f5});
  const pen = useImpulse({at: at('p3-05') + 10, dur: DUR.f3, peak: 0.8});
  // p3-06 大屏压暗、计费标尺升起
  const screenDim = useDim({at: at('p3-06'), to: 0.5, dur: DUR.f4});
  const ruler = useEnter('rise', {at: at('p3-06'), springPreset: 'settle', restBottom: 905});
  // 机械环境运动（线性、帧驱动、无随机）：雷达扫掠 / 云图漂移 / 站点读数跳变
  const sweepA = (frame * 1.7) % 360;
  const tick = Math.floor(frame / 22);
  const sweepRad = (sweepA * Math.PI) / 180;
  const blips = [
    {x: 96, y: 104},
    {x: 196, y: 168},
    {x: 128, y: 196},
  ].map((b) => {
    const a = (Math.atan2(b.y - 165, b.x - 148) * 180) / Math.PI;
    return {...b, o: Math.max(0, 1 - angDist(sweepA, a) / 55) * 0.9};
  });
  const blobs = [
    {cx: 80, cy: 90, r: 46},
    {cx: 150, cy: 70, r: 56},
    {cx: 215, cy: 105, r: 42},
    {cx: 120, cy: 160, r: 50},
    {cx: 200, cy: 175, r: 44},
  ];
  const stations = [
    {id: '58201', unit: 'hPa', base: 1013},
    {id: '58214', unit: 'm/s', base: 24},
    {id: '58230', unit: 'mm', base: 6},
    {id: '58246', unit: 'hPa', base: 1009},
    {id: '58252', unit: 'm/s', base: 17},
    {id: '58277', unit: '°C', base: 21},
  ];
  const colHeaders = [
    t({zh: '云图', en: 'cloud'}),
    t({zh: '雷达', en: 'radar'}),
    t({zh: '站点读数', en: 'stations'}),
  ];
  const readouts = stations.map((s, i) => s.base + (((tick + i * 2) % 5) - 2));

  return (
    <AbsoluteFill style={{transform: `translateY(${(1 - settle) * 12}px)`}}>
      {/* state 大屏（柱青辉光；p3-06 起压暗给计费标尺让焦点） */}
      <div
        style={{
          position: 'absolute',
          left: SCREEN.x,
          top: SCREEN.y,
          width: SCREEN.w,
          height: SCREEN.h,
          borderRadius: 18,
          background: '#0B1017',
          border: `2px solid ${withA(theme.bar, 0.4)}`,
          boxShadow: `0 0 ${16 + 34 * glow}px ${withA(theme.bar, 0.16 + 0.3 * glow)}, inset 0 0 40px ${withA(theme.bar, 0.05)}`,
          opacity: screenDim,
          overflow: 'hidden',
        }}
      >
        {/* 角标：state → 当班资料（narration §P3 术语映射） */}
        <div
          style={{
            position: 'absolute',
            right: 20,
            top: 10,
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.bar,
            opacity: 0.9,
          }}
        >
          {t({zh: 'state ＝ 当班资料', en: 'state = shift data'})}
        </div>
        {/* 三栏：云图 / 雷达 / 站点读数 */}
        {COL_CX.map((cx, i) => (
          <React.Fragment key={cx}>
            <div
              style={{
                position: 'absolute',
                left: cx - 148,
                top: 32,
                fontFamily: theme.mono,
                fontSize: 20,
                color: theme.dim,
                letterSpacing: 2,
              }}
            >
              {colHeaders[i]}
            </div>
            {i === 0 ? (
              <svg width={296} height={300} style={{position: 'absolute', left: cx - 148, top: 52}}>
                {blobs.map((b, j) => (
                  <circle
                    key={j}
                    cx={b.cx + 7 * Math.sin((frame + j * 47) / 95)}
                    cy={b.cy}
                    r={b.r}
                    fill={withA(theme.bar, 0.1)}
                    stroke={withA(theme.bar, 0.45)}
                    strokeWidth={1.5}
                  />
                ))}
              </svg>
            ) : null}
            {i === 1 ? (
              <svg width={296} height={300} style={{position: 'absolute', left: cx - 148, top: 52}}>
                {[108, 72, 36].map((r) => (
                  <circle key={r} cx={148} cy={150} r={r} fill="none" stroke={withA(theme.bar, 0.28)} strokeWidth={1.5} />
                ))}
                <line x1={148} y1={42} x2={148} y2={258} stroke={withA(theme.bar, 0.18)} strokeWidth={1} />
                <line x1={40} y1={150} x2={256} y2={150} stroke={withA(theme.bar, 0.18)} strokeWidth={1} />
                {[0, 10, 20].map((trail, k) => (
                  <line
                    key={k}
                    x1={148}
                    y1={150}
                    x2={148 + 108 * Math.cos(sweepRad - (trail * Math.PI) / 180)}
                    y2={150 + 108 * Math.sin(sweepRad - (trail * Math.PI) / 180)}
                    stroke={withA(theme.bar, 0.7 - k * 0.22)}
                    strokeWidth={k === 0 ? 2.5 : 1.5}
                  />
                ))}
                {blips.map((b, k) => (
                  <circle key={k} cx={b.x} cy={b.y} r={5} fill={withA(theme.bar, b.o)} />
                ))}
              </svg>
            ) : null}
            {i === 2 ? (
              <div style={{position: 'absolute', left: cx - 148, top: 60, width: 296}}>
                {stations.map((s, j) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontFamily: theme.mono,
                      fontSize: 20,
                      color: j === (tick % 6) ? theme.text : theme.dim,
                      padding: '7px 8px',
                      borderBottom: `1px solid ${withA(theme.bar, 0.12)}`,
                    }}
                  >
                    <span>{s.id}</span>
                    <span>{`${readouts[j]} ${s.unit}`}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </React.Fragment>
        ))}
        {/* 三栏 → 编码点：描线（p3-03 错峰描出）+ 行进虚线叠加 + 下行数据点 */}
        <svg width={SCREEN.w} height={SCREEN.h} style={{position: 'absolute', inset: 0}}>
          {COL_CX.map((cx, i) => {
            const dAttr = `M ${cx} 352 Q ${(cx + ENCODE.x) / 2} 388 ${ENCODE.x} 404`;
            return (
              <React.Fragment key={cx}>
                <path d={dAttr} fill="none" stroke={withA(theme.bar, 0.75)} strokeWidth={2.5} {...draws[i]} />
                <path
                  d={dAttr}
                  fill="none"
                  stroke={withA(theme.bar, 0.6)}
                  strokeWidth={2}
                  opacity={flowO}
                  strokeDasharray={dash.strokeDasharray}
                  strokeDashoffset={dash.strokeDashoffset}
                />
              </React.Fragment>
            );
          })}
          {[0, 1].map((k) =>
            COL_CX.map((cx, i) => {
              const py = 200 + ((frame * 2 + i * 57 + k * 91) % 150);
              return <circle key={`${i}-${k}`} cx={cx} cy={py} r={3.5} fill={withA(theme.bar, 0.8 * flowO)} />;
            }),
          )}
        </svg>
        {/* 编码点（只放一遍的落点） */}
        <div
          style={{
            position: 'absolute',
            left: ENCODE.x - 18,
            top: ENCODE.y - 18,
            width: 36,
            height: 36,
          }}
        >
          <svg width={36} height={36}>
            <circle cx={18} cy={18} r={18} fill="none" stroke={withA(theme.bar, 0.5 * encodeBreathe)} strokeWidth={2} />
            <circle cx={18} cy={18} r={10} fill={theme.bar} />
          </svg>
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: ENCODE.y + 26,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 19,
            color: theme.bar,
            opacity: flowO,
          }}
        >
          {t({zh: '编码 · 只放一遍', en: 'encode · read once'})}
        </div>
        {/* 首放扫描线：单程扫过一遍（放一遍的视觉宣言） */}
        <div
          style={{
            position: 'absolute',
            left: scanX,
            top: 6,
            width: 110,
            height: SCREEN.h - 12,
            background: `linear-gradient(90deg, transparent, ${withA(theme.bar, 0.26)}, transparent)`,
            opacity: Math.sin(Math.PI * scan),
          }}
        />
      </div>

      {/* 判读员剪影（画面红线：恒一人一桌） */}
      <svg width={330} height={120} style={{position: 'absolute', left: 595, top: 608}}>
        <circle cx={165} cy={34} r={28} fill="#070B12" stroke={withA(theme.bar, 0.35)} strokeWidth={1.5} />
        <path
          d="M 105 120 L 105 88 Q 105 56 165 52 Q 225 56 225 88 L 225 120 Z"
          fill="#070B12"
          stroke={withA(theme.bar, 0.25)}
          strokeWidth={1.5}
        />
      </svg>
      {/* 桌面 */}
      <div
        style={{
          position: 'absolute',
          left: 320,
          top: 726,
          width: 1280,
          height: 20,
          borderRadius: 6,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
        }}
      />
      {/* 桌沿封卡排：p3-05 同时翻面落笔（每行一张、格黄描边） */}
      <div style={{position: 'absolute', left: 430, top: 636, width: 928, height: 88, perspective: 800, display: 'flex', gap: 22}}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{width: 168, height: 88, position: 'relative'}}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                transformStyle: 'preserve-3d',
                transform: `rotateY(${(1 - flip) * 180}deg)`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backfaceVisibility: 'hidden',
                  borderRadius: 10,
                  border: `3px solid ${theme.slot}`,
                  background: theme.panel,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {[0, 1, 2].map((c) => (
                  <div
                    key={c}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 6,
                      border: `2px solid ${theme.slotDeep}`,
                      background: c === 1 ? withA(theme.slot, 0.3 + 0.5 * pen) : 'transparent',
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  borderRadius: 10,
                  border: `2px solid ${theme.panelBorder}`,
                  background: '#10141C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{width: 30, height: 30, borderRadius: 999, border: `2px solid ${theme.slotDeep}`}} />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* 红线小注：仍是一人、非多人非投票 */}
      <Chip color={theme.slot} at={at('p3-05') + 6} style={{position: 'absolute', left: 1392, top: 664}}>
        {t({zh: '一人一桌 · 非投票', en: 'one clerk · no vote'})}
      </Chip>

      {/* 计费标尺：读大屏（长、柱青深）vs 每卡一眼（短、柱青浅） */}
      <Panel
        style={{
          position: 'absolute',
          left: 480,
          top: 745,
          width: 960,
          height: 150,
          opacity: ruler.opacity,
          transform: ruler.transform,
          padding: '20px 30px',
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20}}>
          <div style={{width: 150, fontFamily: theme.sans, fontSize: 24, color: theme.text}}>
            {t({zh: '读大屏', en: 'read screen'})}
          </div>
          <div style={{width: 620, height: 26, borderRadius: 5, background: theme.bar}} />
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{t({zh: '长', en: 'long'})}</div>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 20}}>
          <div style={{width: 150, fontFamily: theme.sans, fontSize: 24, color: theme.text}}>
            {t({zh: '每卡一眼', en: 'glance / card'})}
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{width: 58, height: 26, borderRadius: 5, background: withA(theme.bar, 0.35)}} />
          ))}
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{t({zh: '短', en: 'short'})}</div>
        </div>
      </Panel>
    </AbsoluteFill>
  );
};

const Beat3A: React.FC<BeatProps> = ({at, dur}) => (
  <AbsoluteFill>
    {/* 装置让位窗（与下方 cues 一一对应、独立字面量） */}
    <ArchifyYield
      cues={[
        {at: at('p3-01'), durationInFrames: dur('p3-01')},
        {at: at('p3-02'), durationInFrames: dur('p3-02')},
        {at: at('p3-04'), durationInFrames: dur('p3-04')},
      ]}
    >
      <Station3A at={at} dur={dur} />
    </ArchifyYield>
    {/* 机制地图重放（m2 高亮）——幕首例，默认 lead */}
    <ArchifyRecap
      slug="lesions-to-specs"
      caption="机制地图"
      cues={[{chapterId: 'ls-mech', at: at('p3-01'), durationInFrames: dur('p3-01')}]}
    />
    {/* 只编码一次：与 ls-mech 跨实例背靠背 → lead={false} */}
    <ArchifyRecap
      slug="shared-read-isolated-branches"
      caption="共享读·隔离分支"
      lead={false}
      cues={[{chapterId: 'sr-once', at: at('p3-02'), durationInFrames: dur('p3-02')}]}
    />
    {/* 封卡分支：p3-03 为 Remotion 大屏段（空窗）→ 恢复入场，默认 lead */}
    <ArchifyRecap
      slug="shared-read-isolated-branches"
      caption="共享读·隔离分支"
      cues={[{chapterId: 'sr-fanout', at: at('p3-04'), durationInFrames: dur('p3-04')}]}
    />
  </AbsoluteFill>
);

// ── 3-B 十三题合一 ────────────────────────────────────────────────────────

const Beat3B: React.FC<BeatProps> = ({at, dur}) => {
  const t = useL();
  const frame = useCurrentFrame();
  const mergeAt = at('p3-07');
  const starts = schedule(13, {
    dur: DUR.f3,
    fit: {total: Math.max(30, Math.round(dur('p3-07') * 0.6))},
  }).starts;
  const bigAt = mergeAt + Math.round(dur('p3-07') * 0.45);
  const big = useSpring('settle', {at: bigAt, dur: DUR.f5});
  const bigO = useProgress(bigAt, DUR.f4);
  // p3-08 右柱塌缩至约十二分之一 + ≈1/12 计数
  const collapse = useSpring('settle', {at: at('p3-08'), dur: DUR.f5});
  const twelfth = useCount({from: 1, to: 12, at: at('p3-08'), dur: DUR.f5, ease: 'decelerate'});
  const fracO = useProgress(at('p3-08') + 6, DUR.f3);
  // p3-09 ×10 对比条浮起 + 两枚虚线徽并排盖戳
  const ten = useEnter('rise', {at: at('p3-09'), springPreset: 'settle', restBottom: 880});
  const grid = Array.from({length: 13}, (_, i) => ({
    x: 120 + (i % 4) * 150,
    y: 200 + Math.floor(i / 4) * 102,
  }));
  const BIG = {x: 330, y: 250, w: 430, h: 340};
  return (
    <AbsoluteFill>
      <Chip color={theme.slot} style={{position: 'absolute', left: 120, top: 132}}>
        {t({zh: '13 题合一', en: '13 into one'})}
      </Chip>
      {/* 13 张题卡吸进一张大单 */}
      {grid.map((g, i) => {
        const p = ease(progress(frame, mergeAt + starts[i], DUR.f5));
        const tx = (BIG.x + BIG.w / 2 - (g.x + 66)) * p;
        const ty = (BIG.y + BIG.h / 2 - (g.y + 42)) * p;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: g.x,
              top: g.y,
              width: 132,
              height: 84,
              borderRadius: 8,
              border: `2px solid ${theme.slotDeep}`,
              background: theme.panel,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 22,
              color: theme.dim,
              transform: `translate(${tx}px, ${ty}px) scale(${1 - 0.82 * p})`,
              opacity: 1 - 0.85 * p,
            }}
          >
            {`Q${i + 1}`}
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: BIG.x,
          top: BIG.y,
          width: BIG.w,
          height: BIG.h,
          borderRadius: 14,
          border: `3px solid ${theme.slot}`,
          background: theme.panel,
          opacity: bigO,
          transform: `scale(${0.92 + 0.08 * big})`,
          padding: '18px 22px',
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
          {t({zh: '合并单 · 13 题', en: 'merged form · 13'})}
        </div>
        <div style={{marginTop: 12, display: 'flex', flexDirection: 'column', gap: 7}}>
          {Array.from({length: 13}, (_, i) => {
            const lit = progress(frame, mergeAt + starts[i] + DUR.f5, DUR.f3);
            return (
              <div
                key={i}
                style={{height: 12, borderRadius: 3, background: theme.slotDeep, opacity: 0.15 + 0.75 * lit}}
              />
            );
          })}
        </div>
      </div>
      {/* 计费对比条：单发 13 次 vs 合一 1 次 */}
      <Panel style={{position: 'absolute', left: 1020, top: 190, width: 780, height: 500, padding: '20px 30px'}}>
        <div style={{textAlign: 'center', fontFamily: theme.sans, fontSize: 26, color: theme.text, marginBottom: 14}}>
          {t({zh: '计费对比', en: 'cost compare'})}
        </div>
        {/* 左柱（单发 13 次，恒高） */}
        <div
          style={{
            position: 'absolute',
            left: 140,
            top: 90,
            width: 130,
            height: 340,
            borderRadius: 6,
            background: withA(theme.bar, 0.9),
          }}
        />
        {/* 右柱（合一 1 次：p3-08 塌缩至约 1/12） */}
        <div
          style={{
            position: 'absolute',
            left: 500,
            top: 90 + 312 * collapse,
            width: 130,
            height: 340 - 312 * collapse,
            borderRadius: 6,
            background: withA(theme.bar, 0.9),
          }}
        />
        <div style={{position: 'absolute', left: 60, top: 442, width: 290, textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.text}}>
          {t({zh: '单发 13 次', en: '13 calls'})}
        </div>
        <div style={{position: 'absolute', left: 420, top: 442, width: 290, textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.text}}>
          {t({zh: '合一 1 次', en: '1 call'})}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 420,
            top: 40,
            width: 290,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 40,
            color: theme.bar,
            opacity: fracO,
          }}
        >
          ≈ 1/{<Counter from={1} to={12} start={at('p3-08')} frames={DUR.f5} />}
        </div>
      </Panel>
      {/* p3-09：×10 对比条浮起 + 两枚虚线徽并排盖戳（官方教程自测） */}
      <div style={{position: 'absolute', left: 1020, top: 716, ...ten}}>
        <Chip color={theme.bar} at={at('p3-09')} style={{position: 'static', fontSize: 30, padding: '10px 24px'}}>
          {t({zh: '快 ×10', en: '×10 faster'})}
        </Chip>
      </div>
      <Badge
        variant="official"
        label={t({zh: '官方教程自测', en: 'official tutorial'})}
        at={at('p3-09') + 4}
        style={{position: 'absolute', left: 1260, top: 730}}
      />
      <Badge
        variant="official"
        label={t({zh: '官方教程自测', en: 'official tutorial'})}
        at={at('p3-09') + 8}
        style={{position: 'absolute', left: 1520, top: 730}}
      />
    </AbsoluteFill>
  );
};

// ── 3-C 暗号实验 ──────────────────────────────────────────────────────────

const ProbeRig3C: React.FC<BeatProps> = ({at}) => {
  const t = useL();
  const frame = useCurrentFrame();
  const settle = useSpring('settle', {at: at('p3-11'), dur: DUR.f5});
  const rigGlow = useProgress(at('p3-11'), DUR.f4);
  // p3-16 剧场规则幕布压上 + 灰斜体小注
  const curtain = useSpring('settle', {at: at('p3-16'), dur: DUR.f5});
  const curtainO = useProgress(at('p3-16'), DUR.f4);
  const noteO = useProgress(at('p3-16') + 8, DUR.f3);
  const rigDim = useDim({at: at('p3-16'), to: 0.55, dur: DUR.f4});
  const sweepA = (frame * 1.7) % 360;
  const sweepRad = (sweepA * Math.PI) / 180;
  const screenFrame = (): React.CSSProperties => ({
    borderRadius: 14,
    background: '#0B1017',
    border: `2px solid ${withA(theme.bar, 0.25 + 0.35 * rigGlow)}`,
    boxShadow: `0 0 ${10 + 26 * rigGlow}px ${withA(theme.bar, 0.1 + 0.26 * rigGlow)}`,
  });
  return (
    <AbsoluteFill>
      {/* 问句标签（承接装置） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 136, display: 'flex', justifyContent: 'center'}}>
        <Chip color={theme.bar} at={at('p3-11') + 4}>
          {t({zh: '卡与卡，看得见吗', en: 'can cards see each other?'})}
        </Chip>
      </div>
      <div style={{position: 'absolute', inset: 0, opacity: rigDim, transform: `translateY(${(1 - settle) * 10}px)`}}>
        {/* 研究者席（实线徽：第三方实测） */}
        <svg width={220} height={110} style={{position: 'absolute', left: 140, top: 340}}>
          <circle cx={110} cy={30} r={24} fill="#070B12" stroke={withA(theme.text, 0.4)} strokeWidth={1.5} />
          <path d="M 62 110 L 62 82 Q 62 56 110 52 Q 158 56 158 82 L 158 110 Z" fill="#070B12" stroke={withA(theme.text, 0.3)} strokeWidth={1.5} />
        </svg>
        <div style={{position: 'absolute', left: 146, top: 470}}>
          <Badge variant="field" label={t({zh: '外测 · Hume', en: 'field · Hume'})} at={at('p3-11') + 6} />
        </div>
        {/* 探针虚线（研究者 → 两块屏） */}
        <svg width={680} height={140} style={{position: 'absolute', left: 330, top: 330}}>
          <line x1={10} y1={70} x2={100} y2={70} stroke={withA(theme.dim, 0.4)} strokeWidth={2} strokeDasharray="6 8" />
          <line x1={10} y1={70} x2={660} y2={30} stroke={withA(theme.dim, 0.4)} strokeWidth={2} strokeDasharray="6 8" />
        </svg>
        {/* 兄弟行屏 */}
        <div style={{position: 'absolute', left: 430, top: 300, width: 460, height: 320, ...screenFrame()}}>
          <div style={{padding: '14px 20px', fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 2}}>
            {t({zh: '兄弟行 · 卡', en: 'sibling row'})}
          </div>
          <div
            style={{
              margin: '26px auto 0',
              width: 330,
              height: 150,
              borderRadius: 10,
              border: `2px solid ${theme.slot}`,
              background: theme.panel,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            {[0, 1, 2, 3].map((c) => (
              <div
                key={c}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 6,
                  border: `2px solid ${c === 2 ? theme.slot : theme.slotDeep}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.mono,
                  fontSize: 15,
                  color: theme.dim,
                }}
              >
                {c === 2 ? t({zh: '暗号', en: 'pass'}) : ''}
              </div>
            ))}
          </div>
        </div>
        {/* 大屏屏 */}
        <div style={{position: 'absolute', left: 990, top: 250, width: 660, height: 400, ...screenFrame()}}>
          <div style={{padding: '14px 20px', fontFamily: theme.mono, fontSize: 20, color: theme.bar, letterSpacing: 2}}>
            {t({zh: '大屏 · state', en: 'screen · state'})}
          </div>
          <svg width={280} height={260} style={{position: 'absolute', left: 40, top: 70}}>
            <circle cx={120} cy={110} r={86} fill={withA(theme.bar, 0.1)} stroke={withA(theme.bar, 0.45)} strokeWidth={1.5} />
            <circle cx={186} cy={86} r={62} fill={withA(theme.bar, 0.08)} stroke={withA(theme.bar, 0.35)} strokeWidth={1.5} />
            {[86, 56].map((r) => (
              <circle key={r} cx={140} cy={150} r={r} fill="none" stroke={withA(theme.bar, 0.22)} strokeWidth={1} />
            ))}
            <line
              x1={140}
              y1={150}
              x2={140 + 86 * Math.cos(sweepRad)}
              y2={150 + 86 * Math.sin(sweepRad)}
              stroke={withA(theme.bar, 0.7)}
              strokeWidth={2}
            />
          </svg>
          <div style={{position: 'absolute', right: 36, top: 90, width: 260}}>
            {['1013 hPa', '24.6 m/s', '6 mm'].map((v, j) => (
              <div
                key={v}
                style={{
                  fontFamily: theme.mono,
                  fontSize: 22,
                  color: j === 0 ? theme.text : theme.dim,
                  padding: '10px 0',
                  borderBottom: `1px solid ${withA(theme.bar, 0.15)}`,
                }}
              >
                {v}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* 剧场规则幕布 + 灰斜体小注（压在装置上、不随装置压暗） */}
      <div
        style={{
          position: 'absolute',
          left: 400,
          top: 262,
          width: 1280,
          height: 68,
          borderRadius: 10,
          border: `3px solid ${theme.slot}`,
          background: theme.panel,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.sans,
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: 8,
          color: theme.slot,
          opacity: curtainO,
          transform: `translateY(${-(1 - curtain) * 70}px)`,
        }}
      >
        {t({zh: '剧场规则', en: 'theater rule'})}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 352,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontStyle: 'italic',
          fontSize: 22,
          color: theme.dim,
          opacity: noteO,
        }}
      >
        {t({zh: '真实机制官方没披露', en: 'real mechanism undisclosed'})}
      </div>
    </AbsoluteFill>
  );
};

const Beat3C: React.FC<BeatProps> = ({at, dur}) => (
  <AbsoluteFill>
    <ArchifyYield
      cues={[
        {at: at('p3-12'), durationInFrames: dur('p3-12')},
        {at: at('p3-13'), durationInFrames: dur('p3-13')},
        {at: at('p3-14'), durationInFrames: dur('p3-14')},
        {at: at('p3-15'), durationInFrames: dur('p3-15')},
        {at: at('p3-17'), durationInFrames: dur('p3-17')},
      ]}
    >
      <ProbeRig3C at={at} dur={dur} />
    </ArchifyYield>
    {/* 暗号实验：p3-12 入图默认 lead；12–14 句句相接（实例内自动抑制换章弹入）；
        p3-16 为 Remotion 装置段（空窗）→ p3-17 复现恢复入场 */}
    <ArchifyRecap
      slug="passphrase-probe"
      caption="暗号实验"
      cues={[
        {chapterId: 'pp-design', at: at('p3-12'), durationInFrames: dur('p3-12')},
        {chapterId: 'pp-sibling', at: at('p3-13'), durationInFrames: dur('p3-13')},
        {chapterId: 'pp-state', at: at('p3-14'), durationInFrames: dur('p3-14')},
        {chapterId: 'pp-replica', at: at('p3-17'), durationInFrames: dur('p3-17')},
      ]}
    />
    {/* 行间互不可见：与 pp-state 跨实例背靠背 → lead={false} */}
    <ArchifyRecap
      slug="shared-read-isolated-branches"
      caption="共享读·隔离分支"
      lead={false}
      cues={[{chapterId: 'sr-between', at: at('p3-15'), durationInFrames: dur('p3-15')}]}
    />
  </AbsoluteFill>
);

// ── 3-D 行内挪动 ──────────────────────────────────────────────────────────

const RowShift3D: React.FC<BeatProps> = ({at}) => {
  const t = useL();
  const push = usePushIn(at('p3-18'), {scale: 0.05});
  // 「?」无关格插入（p3-18 尾）：四格让位、五格布局
  const insertP = useSpring('settle', {at: at('p3-18') + 6, dur: DUR.f5});
  // p3-20 挪位 + 量尺 0.28
  const shiftP = useSpring('settle', {at: at('p3-20'), dur: DUR.f5});
  const measureO = useProgress(at('p3-20') + 6, DUR.f3);
  const shiftGlow = useImpulse({at: at('p3-20'), dur: DUR.f4, peak: 0.6});
  // p3-21 格序重排（0 ↔ 2 互换）+ 角标
  const swapP = useSpring('settle', {at: at('p3-21'), dur: DUR.f5});
  const tagO = useProgress(at('p3-21') + 4, DUR.f3);

  const cells = [
    {label: t({zh: '晴', en: 'clear'}), before: 0.36, after: 0.3},
    {label: t({zh: '多云', en: 'cloudy'}), before: 0.28, after: 0.24},
    {label: t({zh: '小到中雨', en: 'showers'}), before: 0.22, after: 0.2},
    {label: t({zh: '大雨', en: 'rain'}), before: 0.14, after: 0.12},
  ];
  // 布局：4 格（w 277）→ 插入后 5 格（w 216，? 占 idx1）
  const x4 = [360, 661, 962, 1263];
  const x5 = [360, 600, 840, 1080, 1320];
  const cellX = (i: number): number => lerp(x4[i], x5[i + 1], insertP);
  const swappedX = (i: number): number => {
    const home = cellX(i);
    const partner = i === 0 ? cellX(2) : i === 2 ? cellX(0) : home;
    return lerp(home, partner, swapP);
  };
  const cellW = (p = insertP): number => lerp(277, 216, p);
  return (
    <AbsoluteFill style={{transform: push}}>
      {/* 两标签并置：行间已断 / 行内 */}
      <div style={{position: 'absolute', left: 620, top: 172, display: 'flex', gap: 28}}>
        <Chip color={theme.bar} at={at('p3-18') + 2} style={{position: 'static'}}>
          {t({zh: '行间 · 已断', en: 'between · cut'})}
        </Chip>
        <Chip color={theme.slot} at={at('p3-18') + 2} style={{position: 'static'}}>
          {t({zh: '行内 · ?', en: 'within · ?'})}
        </Chip>
      </div>
      {/* 单张封卡特写（格黄格排开；宽度条=柱青） */}
      <div
        style={{
          position: 'absolute',
          left: 330,
          top: 240,
          width: 1260,
          height: 380,
          borderRadius: 16,
          border: `3px solid ${theme.slot}`,
          background: theme.panel,
        }}
      >
        {/* 四个原格（swap 时 0↔2 平移） */}
        {cells.map((c, i) => {
          const w = cellW();
          const val = lerp(c.before, c.after, shiftP);
          return (
            <div key={c.label} style={{position: 'absolute', left: swappedX(i) - 330, top: 46, width: w}}>
              <div
                style={{
                  height: 88,
                  borderRadius: 8,
                  border: `2px solid ${withA(theme.slot, 0.6)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.sans,
                  fontSize: 26,
                  color: theme.text,
                }}
              >
                {c.label}
              </div>
              <div style={{marginTop: 14, height: 28, borderRadius: 5, background: withA(theme.bar, 0.12)}}>
                <div
                  style={{
                    height: '100%',
                    width: `${val * 100}%`,
                    borderRadius: 5,
                    background: withA(theme.bar, 0.55 + 0.35 * shiftGlow),
                  }}
                />
              </div>
            </div>
          );
        })}
        {/* 「?」无关格（插入后占位，宽度条虚描） */}
        <div
          style={{
            position: 'absolute',
            left: x5[1] - 330,
            top: 46 - 50 * (1 - insertP),
            width: 216,
            opacity: insertP,
          }}
        >
          <div
            style={{
              height: 88,
              borderRadius: 8,
              border: `2px dashed ${theme.slot}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 34,
              color: theme.slot,
            }}
          >
            ?
          </div>
          <div
            style={{
              marginTop: 14,
              height: 28,
              borderRadius: 5,
              border: `2px dashed ${withA(theme.bar, 0.5)}`,
              width: `${14 * shiftP}%`,
            }}
          />
        </div>
        {/* 挪动幅度量尺：0.28（log-odds） */}
        <div style={{position: 'absolute', left: 70, top: 262, width: 600, opacity: measureO}}>
          <div style={{position: 'relative', height: 14, borderRadius: 4, background: withA(theme.bar, 0.12)}}>
            <div style={{position: 'absolute', left: 0, top: 0, height: '100%', width: '56%', borderRadius: 4, background: theme.bar}} />
            {[0, 0.25, 0.5].map((v) => (
              <div
                key={v}
                style={{
                  position: 'absolute',
                  left: `${v * 200}%`,
                  top: -5,
                  width: 2,
                  height: 24,
                  background: withA(theme.dim, 0.6),
                }}
              />
            ))}
          </div>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 14}}>
            <span style={{fontFamily: theme.mono, fontSize: 44, color: theme.bar}}>0.28</span>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'log-odds'}</span>
          </div>
        </div>
        {/* 顺序敏感角标 */}
        <div
          style={{
            position: 'absolute',
            right: 36,
            bottom: 26,
            fontFamily: theme.mono,
            fontSize: 23,
            color: theme.dim,
            opacity: tagO,
          }}
        >
          {t({zh: '顺序敏感 16/16 vs 12/16', en: 'order-sensitive 16/16 vs 12/16'})}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Beat3D: React.FC<BeatProps> = ({at, dur}) => (
  <AbsoluteFill>
    <ArchifyYield cues={[{at: at('p3-19'), durationInFrames: dur('p3-19')}]}>
      <RowShift3D at={at} dur={dur} />
    </ArchifyYield>
    {/* 行内互相影响：p3-18 为 Remotion 特写段（空窗）→ 默认 lead */}
    <ArchifyRecap
      slug="shared-read-isolated-branches"
      caption="共享读·隔离分支"
      cues={[{chapterId: 'sr-within', at: at('p3-19'), durationInFrames: dur('p3-19')}]}
    />
  </AbsoluteFill>
);

// ── 3-E 两卡加出 1.19 ─────────────────────────────────────────────────────

/** 大封卡正面：行问句 + 柱青 mono 大数（落位时数字滚入） */
const SumCardFace: React.FC<{q: string; value: number; at: number}> = ({q, value, at}) => {
  const n = useCount({from: 0, to: value, at: at + 4, dur: DUR.f5, ease: 'decelerate'});
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backfaceVisibility: 'hidden',
        borderRadius: 14,
        border: `3px solid ${theme.slot}`,
        background: theme.panel,
        padding: '26px 34px',
      }}
    >
      <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>{q}</div>
      <div style={{fontFamily: theme.mono, fontSize: 92, color: theme.bar, marginTop: 18}}>{n.toFixed(2)}</div>
    </div>
  );
};

const Beat3E: React.FC<BeatProps> = ({at, dur}) => {
  const t = useL();
  const frame = useCurrentFrame();
  // p3-22 反直觉预警细线（警示红）扫过
  const sweepP = useProgress(at('p3-22'), DUR.f5, 'linear');
  const sweepX = 180 + sweepP * 1560;
  // p3-23/24 两卡先后落定
  const enterL = useEnter('fall', {at: at('p3-23'), springPreset: 'settle'});
  const enterR = useEnter('fall', {at: at('p3-24'), springPreset: 'settle'});
  // p3-25 横式逐项滑入 + 1.19 落定脉冲两拍
  const eqAt = at('p3-25');
  const starts = schedule(5, {dur: DUR.f3, stride: 4}).starts;
  const pulse =
    useImpulse({at: eqAt + Math.round(dur('p3-25') * 0.55), dur: DUR.f3, peak: 0.1}) +
    useImpulse({at: eqAt + Math.round(dur('p3-25') * 0.85), dur: DUR.f3, peak: 0.1});
  const badgeO = useProgress(eqAt + 12, DUR.f3);
  // p3-26 概率刻度尺在 1.0 处爆表断针
  const gaugeO = useProgress(at('p3-26'), DUR.f3);
  const swing = useProgress(at('p3-26'), DUR.f5, 'decelerate');
  const v = swing * 1.19;
  const broken = v > 1;
  const needleX = 460 + Math.min(v, 1.22) * 1000;
  const shake = useShake({at: at('p3-26') + 8, active: broken, decay: true, dur: DUR.f5, amp: 5});
  // p3-27 两卡背靠背 + 闸品箭头指向代码对账位
  const bp = useSpring('settle', {at: at('p3-27'), dur: DUR.f5});
  const arrow = useDraw(at('p3-27') + 4, DUR.f4);
  const chipO = useProgress(at('p3-27') + 4, DUR.f3);
  const eqDim = useDim({at: at('p3-27'), to: 0.45, dur: DUR.f4});

  const eqItems: {text: string; hot?: boolean}[] = [
    {text: '0.72'},
    {text: '+'},
    {text: '0.47'},
    {text: '='},
    {text: '1.19', hot: true},
  ];
  return (
    <AbsoluteFill>
      {/* p3-22 预警：反直觉标签 + 警示红细线扫过 */}
      <Chip color={theme.danger} at={at('p3-22')} style={{position: 'absolute', left: 170, top: 156}}>
        {t({zh: '反直觉', en: 'counter-intuitive'})}
      </Chip>
      <div
        style={{
          position: 'absolute',
          left: sweepX,
          top: 168,
          width: 3,
          height: 84,
          background: withA(theme.danger, 0.85),
          opacity: Math.sin(Math.PI * sweepP),
        }}
      />
      {/* 两张封卡并排大数（p3-27 转背靠背） */}
      <div style={{position: 'absolute', left: 420, top: 268, width: 430, height: 260, perspective: 900, ...enterL}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transformStyle: 'preserve-3d',
            transform: `translateX(${64 * bp}px) rotateY(${-72 * bp}deg)`,
          }}
        >
          <SumCardFace q={t({zh: '会下雨吗', en: 'will it rain?'})} value={0.72} at={at('p3-23')} />
          <div style={{position: 'absolute', inset: 0, transform: 'rotateY(180deg)', transformStyle: 'preserve-3d'}}>
            <CardBack />
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 1070, top: 268, width: 430, height: 260, perspective: 900, ...enterR}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transformStyle: 'preserve-3d',
            transform: `translateX(${-64 * bp}px) rotateY(${72 * bp}deg)`,
          }}
        >
          <SumCardFace q={t({zh: '不会下雨吗', en: 'no rain?'})} value={0.47} at={at('p3-24')} />
          <div style={{position: 'absolute', inset: 0, transform: 'rotateY(180deg)', transformStyle: 'preserve-3d'}}>
            <CardBack />
          </div>
        </div>
      </div>
      {/* 各填各的（背靠背之间的缝） */}
      <Chip color={theme.slot} at={at('p3-27') + 4} style={{position: 'absolute', left: 880, top: 372, opacity: chipO}}>
        {t({zh: '各填各的', en: 'each its own'})}
      </Chip>
      {/* 横式 + 角标 + 刻度尺（p3-27 让焦点给卡片，整体压暗） */}
      <div style={{position: 'absolute', inset: 0, opacity: eqDim}}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 560,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'baseline',
            gap: 30,
          }}
        >
          {eqItems.map((item, i) => {
            const p = ease(progress(frame, eqAt + starts[i], DUR.f3));
            const slide = i % 2 === 0 ? -1 : 1;
            return (
              <div
                key={item.text}
                style={{
                  fontFamily: theme.mono,
                  fontSize: item.hot ? 84 : 64,
                  fontWeight: item.hot ? 700 : 400,
                  color: item.hot ? theme.danger : theme.text,
                  opacity: p,
                  transform: `translateX(${slide * (1 - p) * 34}px) scale(${item.hot ? 1 + pulse : 1})`,
                }}
              >
                {item.text}
              </div>
            );
          })}
        </div>
        {/* 虚线徽（官方自列）+ 原例小字 */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24}}>
          <Badge variant="official" label={t({zh: '官方自列', en: 'officially listed'})} at={eqAt + 12} style={{position: 'static'}} />
          <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, opacity: badgeO}}>{'原例 refund / not_refund'}</span>
        </div>
        {/* 概率刻度尺：0..1.0，指针冲过 1.0 爆表断针 */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 760, opacity: gaugeO}}>
          <div style={{position: 'absolute', left: 460, top: 96, width: 1000, height: 2, background: withA(theme.dim, 0.5)}} />
          {[
            {v: 0, x: 460},
            {v: 0.5, x: 960},
            {v: 1.0, x: 1460},
          ].map((tk) => (
            <div key={tk.v}>
              <div style={{position: 'absolute', left: tk.x - 1, top: 84, width: 2, height: 26, background: withA(theme.dim, 0.7)}} />
              <div
                style={{
                  position: 'absolute',
                  left: tk.x - 20,
                  top: 118,
                  width: 40,
                  textAlign: 'center',
                  fontFamily: theme.mono,
                  fontSize: 20,
                  color: theme.dim,
                }}
              >
                {tk.v.toFixed(1)}
              </div>
            </div>
          ))}
          {/* 末端止挡（1.0） */}
          <div style={{position: 'absolute', left: 1464, top: 70, width: 5, height: 52, borderRadius: 2, background: theme.bar}} />
          {/* 指针：断针前随 v 滑行；过 1.0 后针尖折角 + 抖动衰减（警示红） */}
          <div
            style={{
              position: 'absolute',
              left: needleX - 2 + (broken ? shake : 0),
              top: 40,
              width: 4,
              height: 58,
              borderRadius: 2,
              background: broken ? theme.danger : theme.bar,
              transformOrigin: '50% 100%',
              transform: `rotate(${broken ? 14 : 0}deg)`,
            }}
          />
          {broken ? (
            <div
              style={{
                position: 'absolute',
                left: needleX + 16,
                top: 30,
                fontFamily: theme.mono,
                fontSize: 40,
                color: theme.danger,
              }}
            >
              1.19
            </div>
          ) : null}
        </div>
      </div>
      {/* 闸品小箭头 → 代码对账位 */}
      <svg width={220} height={60} style={{position: 'absolute', left: 1120, top: 690, opacity: chipO}}>
        <line x1={8} y1={30} x2={186} y2={30} stroke={theme.gate} strokeWidth={4} {...arrow} />
        <path d="M 186 18 L 212 30 L 186 42 Z" fill={theme.gate} />
      </svg>
      <Chip color={theme.gate} at={at('p3-27') + 6} style={{position: 'absolute', left: 1360, top: 668}}>
        {t({zh: '代码对账', en: 'code reconciles'})}
      </Chip>
    </AbsoluteFill>
  );
};

// ── 3-F 自洽交给代码 ──────────────────────────────────────────────────────

const Handoff3F: React.FC<BeatProps> = ({at}) => {
  const t = useL();
  // 左卡：两行并成一道单选行
  const mergeL = useSpring('settle', {at: at('p3-28') + 6, dur: DUR.f5});
  const mergeO = useProgress(at('p3-28') + 6, DUR.f4);
  // 右卡：读数 → 代码对账（闸品行进虚线）
  const flow = useFlowDash({dash: 10, gap: 14, period: 34});
  const flowO = useProgress(at('p3-28') + 10, DUR.f3);
  // p3-30 镜头推行尾空栏（P4 引子），其余压暗；空栏虚框呼吸
  const push = usePushIn(at('p3-30'), {scale: 0.07});
  const others = useDim({at: at('p3-30'), to: 0.35, dur: DUR.f4});
  const slotBreathe = useBreathe({period: 110, amp: 0.2, base: 0.8});
  const stripO = useProgress(at('p3-28') + 2, DUR.f3);

  return (
    <AbsoluteFill style={{transform: push, transformOrigin: '75% 63%'}}>
      <div style={{position: 'absolute', inset: 0, opacity: others}}>
        {/* 1.19 残影 + 官方自列小注 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 140,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 26,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 62, color: theme.dim, opacity: 0.38}}>1.19</span>
          <Badge variant="official" label={t({zh: '官方自列', en: 'officially listed'})} at={at('p3-28') + 4} style={{position: 'static'}} />
        </div>
        {/* 左：并成一道单选行（格黄合并格） */}
        <Panel accent={theme.slot} style={{position: 'absolute', left: 350, top: 280, width: 560, height: 280, padding: '20px 26px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>
            {t({zh: '并成一道单选行', en: 'merge into one choice row'})}
          </div>
          {/* 两枚小行卡 → 并合 */}
          {[
            {x: 40, y: 84, tx: 130, ty: 88, label: t({zh: '会下雨', en: 'rain'}), num: '0.72'},
            {x: 300, y: 84, tx: 310, ty: 88, label: t({zh: '不会下雨', en: 'no rain'}), num: '0.47'},
          ].map((m) => (
            <div
              key={m.num}
              style={{
                position: 'absolute',
                left: m.x,
                top: m.y,
                width: 210,
                height: 56,
                borderRadius: 8,
                border: `2px solid ${theme.slotDeep}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 14px',
                fontFamily: theme.mono,
                fontSize: 22,
                color: theme.text,
                transform: `translate(${m.tx * mergeL}px, ${m.ty * mergeL}px)`,
                opacity: 1 - 0.75 * mergeL,
              }}
            >
              <span style={{fontFamily: theme.sans}}>{m.label}</span>
              <span style={{color: theme.bar}}>{m.num}</span>
            </div>
          ))}
          {/* 合并后的单选行（radio 单选格） */}
          <div
            style={{
              position: 'absolute',
              left: 40,
              top: 178,
              width: 470,
              height: 64,
              borderRadius: 8,
              border: `3px solid ${theme.slot}`,
              display: 'flex',
              alignItems: 'center',
              opacity: mergeO,
            }}
          >
            {[
              {label: t({zh: '会下雨', en: 'rain'}), on: true},
              {label: t({zh: '不会下雨', en: 'no rain'}), on: false},
            ].map((o, j) => (
              <div
                key={o.label}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  borderRight: j === 0 ? `2px solid ${withA(theme.slot, 0.4)}` : 'none',
                  fontFamily: theme.sans,
                  fontSize: 24,
                  color: theme.text,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    border: `3px solid ${theme.slot}`,
                    display: 'inline-block',
                    background: o.on ? theme.slot : 'transparent',
                  }}
                />
                {o.label}
              </div>
            ))}
          </div>
        </Panel>
        {/* 右：代码对账（闸品流程小块） */}
        <Panel accent={theme.gate} style={{position: 'absolute', left: 1010, top: 280, width: 560, height: 280, padding: '20px 26px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>
            {t({zh: '代码对账', en: 'code reconciliation'})}
          </div>
          <div
            style={{
              position: 'absolute',
              left: 40,
              top: 96,
              width: 180,
              height: 64,
              borderRadius: 8,
              border: `2px solid ${theme.bar}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 24,
              color: theme.bar,
            }}
          >
            0.72 / 0.47
          </div>
          <svg width={130} height={64} style={{position: 'absolute', left: 232, top: 96}}>
            <line
              x1={4}
              y1={32}
              x2={100}
              y2={32}
              stroke={theme.gate}
              strokeWidth={3.5}
              opacity={flowO}
              strokeDasharray={flow.strokeDasharray}
              strokeDashoffset={flow.strokeDashoffset}
            />
            <path d="M 100 20 L 126 32 L 100 44 Z" fill={theme.gate} opacity={flowO} />
          </svg>
          <div
            style={{
              position: 'absolute',
              left: 376,
              top: 86,
              width: 150,
              height: 84,
              borderRadius: 8,
              border: `3px solid ${theme.gate}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.sans,
              fontSize: 26,
              color: theme.gate,
            }}
          >
            {t({zh: '对账', en: 'reconcile'})}
          </div>
        </Panel>
      </div>
      {/* 预报单行尾：「集中度」空栏虚框（描边栏首次露面，P4 引子） */}
      <div style={{position: 'absolute', left: 340, top: 582, fontFamily: theme.mono, fontSize: 20, color: theme.dim, opacity: stripO}}>
        {t({zh: '预报单 · 行尾', en: 'form row end'})}
      </div>
      <Panel style={{position: 'absolute', left: 330, top: 610, width: 1260, height: 130, opacity: stripO, padding: 0}}>
        <div style={{position: 'absolute', left: 40, top: 30, display: 'flex', gap: 20}}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 130,
                height: 70,
                borderRadius: 8,
                border: `2px solid ${theme.slotDeep}`,
                background: i === 1 ? withA(theme.slot, 0.25) : 'transparent',
              }}
            />
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 500,
            top: 63,
            width: 440,
            height: 2,
            background: `repeating-linear-gradient(90deg, ${withA(theme.dim, 0.5)} 0 10px, transparent 10px 20px)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 990,
            top: 18,
            width: 240,
            height: 94,
            borderRadius: 10,
            border: `3px dashed ${withA(theme.bar, 0.75)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.mono,
            fontSize: 24,
            color: theme.dim,
            boxShadow: `0 0 ${8 + 16 * slotBreathe}px ${withA(theme.bar, 0.22 * slotBreathe)}`,
          }}
        >
          {t({zh: '集中度', en: 'confidence'})}
        </div>
      </Panel>
    </AbsoluteFill>
  );
};

const Beat3F: React.FC<BeatProps> = ({at, dur}) => (
  <AbsoluteFill>
    <ArchifyYield cues={[{at: at('p3-29'), durationInFrames: dur('p3-29')}]}>
      <Handoff3F at={at} dur={dur} />
    </ArchifyYield>
    {/* 代价与对账段：p3-28 为 Remotion 装置段（空窗）→ 默认 lead */}
    <ArchifyRecap
      slug="shared-read-isolated-branches"
      caption="共享读·隔离分支"
      cues={[{chapterId: 'sr-cost', at: at('p3-29'), durationInFrames: dur('p3-29')}]}
    />
  </AbsoluteFill>
);

// ── 幕组装 ────────────────────────────────────────────────────────────────

export const P3SealedCards: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const anchor = (id: string): number => {
    const s = scene.sentences.find((x) => x.id === id);
    if (!s) throw new Error(`P3SealedCards: 未找到句 id ${id}`);
    return s.from - scene.from;
  };
  const span = (id: string): number => {
    const s = scene.sentences.find((x) => x.id === id);
    if (!s) throw new Error(`P3SealedCards: 未找到句 id ${id}`);
    return s.durationInFrames;
  };
  const b3a = w('p3-01', 'p3-06');
  const b3b = w('p3-07', 'p3-09');
  const b3c = w('p3-11', 'p3-17');
  const b3d = w('p3-18', 'p3-21');
  const b3e = w('p3-22', 'p3-27');
  const b3f = w('p3-28', 'p3-30');
  const atIn = (beat: {from: number}) => (id: string) => anchor(id) - beat.from;
  return (
    <AbsoluteFill>
      <SceneTag chapter="P3" tagline="大屏与封卡" accent={theme.bar} />
      <Sequence {...b3a} name="3-A 大屏与封卡排开">
        <Beat3A at={atIn(b3a)} dur={span} />
      </Sequence>
      <Sequence {...b3b} name="3-B 十三题合一">
        <Beat3B at={atIn(b3b)} dur={span} />
      </Sequence>
      <Sequence {...b3c} name="3-C 暗号实验">
        <Beat3C at={atIn(b3c)} dur={span} />
      </Sequence>
      <Sequence {...b3d} name="3-D 行内挪动">
        <Beat3D at={atIn(b3d)} dur={span} />
      </Sequence>
      <Sequence {...b3e} name="3-E 两卡加出 1.19">
        <Beat3E at={atIn(b3e)} dur={span} />
      </Sequence>
      <Sequence {...b3f} name="3-F 自洽交给代码">
        <Beat3F at={atIn(b3f)} dur={span} />
      </Sequence>
    </AbsoluteFill>
  );
};
