/** P6 对账与五条规律（p6-01..19，6 镜 6 cue）——分镜 6-A…6-F。
 *
 *  cue 清单（6；slug/章 id 按 storyboard，manifest 由录制链整文件重建后可编译：
 *  当前占位 manifest 仅有 two-waiting-deaths，recon-verdicts / spec-two-promises
 *  回填后本文件 tsc 即绿——勿为迁就占位改 slug）：
 *   6-A recon-verdicts/green-list@p6-01（dur p6-01+p6-02；本片该图首现实例 → 默认 lead）
 *   6-B recon-verdicts/red-jitter@p6-03（dur 四句和；与 6-A 同 slug、p6-02 末→p6-03 首
 *       紧邻跨镜 → lead={false}）
 *   6-C recon-verdicts/gray-extra@p6-07（dur 四句和；与 6-B 紧邻 → lead={false}）
 *   6-D recon-verdicts/gray-extra@p6-11（dur p6-11+p6-12；同章重现、与 6-C 紧邻 →
 *       lead={false}；p6-13..14 空窗岛 = 学徒争议卡满幅登场段）
 *   6-E spec-two-promises/map-back@p6-15（dur p6-15+p6-16；换图 → 默认 lead）
 *   6-F spec-two-promises/map-back@p6-18（dur p6-18+p6-19；默认入场）。
 *       ★ 集成裁决（2026-10-03）：p6-17 是 ~6s 空窗岛（两 cue 帧不紧邻），按
 *       ArchifyRecap 契约「空窗后重现的实例保持默认 lead」执行——已从编排稿的
 *       lead={false} 修正为默认，防整框全不透明一帧瞬现
 *
 *  ★ 全屏独占与车道：本幕每镜 cue 窗≈整镜，ArchifyClip 画框实测占位
 *    x∈[311,1609]、y∈[150,880]——对账桌/数字块/学徒等自制装置一律收进画框左右
 *    车道（x<311 / x>1609）与上带（y 56..150）同屏不抢位（系列 StackFinale 先例）；
 *    金句卡/角标类纯文字层可叠画框（家规金句卡先例）。
 *  ★ 尾幕渐黑：FadeTail 挂 6-F Sequence 最后子节点（盖过下期卡与画框），窗取
 *    6-F 整镜时长——其终点即末 beat（p6-15..19）终点，勿改用末句单句窗
 *    （长黑屏教训：useFadeOut 只吃窗尾 36 帧，窗缩短≠起点不变）。
 *  ★ 下期卡：HarnessStackP6 + NEXT_LAYER（series-layers.json，activeIndex=4 →
 *    next=多 Agent 平台层）；措辞只「下期」，层名走 NEXT_LAYER 数据，零集标题文字。
 *  ★ 色彩契约：ok=印证绿（账页打勾/标尺数字）、deny=分歧警示点、accent=金句卡、
 *    mech=学徒与装置轮廓、core=传送带〔M-001〕；零 Lottie（天平/放大镜全原生
 *    SVG glyph）；顶部 y<56 留空归 ChapterProgress，SceneTag top:64。
 *  ★ 数字动态标尺用 motifs.Counter（useCount 家族的渲染件），起点全部句锚推导。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {BeltStrip, Counter, Footnote, Panel, SceneTag} from '../components/motifs';
import {HarnessStackP6, NEXT_LAYER} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, clamp01, useBreathe, useEnter, useFadeOut, useImpulse, useProgress} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** ArchifyClip 全屏画框实测缘：h=730 居中 ⇒ x∈[311,1609]、y∈[150,880]——
 *  车道元素（x<311 / x>1609）与上带（y 56..150）是画框回放期间的合法落位区。 */

/** hex + 动态透明度（帧驱动，无随机；effects 通道恒不过冲）。 */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 人形剪影（对坐双方/学徒；一律单色无渐变——师傅=text 白、学徒=mech 蓝）。 */
const Person: React.FC<{
  x: number;
  y: number;
  color: string;
  scale?: number;
  mirror?: boolean;
  opacity?: number;
}> = ({x, y, color, scale = 1, mirror = false, opacity = 0.92}) => (
  <svg
    width={120 * scale}
    height={180 * scale}
    viewBox="0 0 120 180"
    style={{position: 'absolute', left: x, top: y, opacity, transform: mirror ? 'scaleX(-1)' : undefined}}
  >
    <circle cx={60} cy={34} r={28} fill={color} />
    <path d="M0 180 Q0 76 60 70 Q120 76 120 180 Z" fill={color} />
  </svg>
);

// ── 6-A 对账桌开张：左教学版右官方产品对坐 + ok 绿数字标尺 ───────────────

/** 对坐双方 + 桌沿（车道层；账本绿页本体由 green-list 章回放承担）。 */
const ReconTable: React.FC<{at01: number; at02: number}> = ({at01, at02}) => {
  const seatL = useEnter('fall', {at: at01 + 6, dur: DUR.f5, dist: 18});
  const seatR = useEnter('fall', {at: at01 + 12, dur: DUR.f5, dist: 18});
  const edgeO = useProgress(at01 + 16, DUR.f5);
  const pillO = useProgress(at01 + 170, DUR.f5);

  const seat = (e: {opacity: number; transform: string}, x: number, mirror: boolean, label: string, lx: number) => (
    <>
      <div style={{...e}}>
        <Person x={x} y={416} color={theme.text} scale={0.62} mirror={mirror} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: lx,
          top: 544,
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.dim,
          letterSpacing: 4,
          opacity: e.opacity,
        }}
      >
        {label}
      </div>
    </>
  );

  return (
    <>
      {seat(seatL, 86, false, '教学版', 88)}
      {seat(seatR, 1760, true, '官方产品', 1724)}
      {/* 桌沿（车道段）：画框后的对账桌前缘露头 */}
      <svg width={1920} height={12} viewBox="0 0 1920 12" style={{position: 'absolute', left: 0, top: 520, opacity: edgeO}}>
        <line x1={60} y1={6} x2={296} y2={6} stroke={theme.panelBorder} strokeWidth={4} strokeLinecap="round" />
        <line x1={1624} y1={6} x2={1860} y2={6} stroke={theme.panelBorder} strokeWidth={4} strokeLinecap="round" />
      </svg>
      {/* 印证判词（ok 绿＝机制在位/在册语义） */}
      <div style={{position: 'absolute', left: 64, top: 606, opacity: pillO, transform: `translateY(${(1 - pillO) * 10}px)`}}>
        <Panel accent={withAlpha(theme.ok, 0.6)} style={{padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10}}>
          <svg width={16} height={16} viewBox="0 0 16 16">
            <path d="M2 8 L6 12 L14 3" fill="none" stroke={theme.ok} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 600, color: theme.ok, letterSpacing: 2}}>{'印证 · 在册'}</span>
        </Panel>
      </div>
      <NumberRuler at01={at01} at02={at02} />
    </>
  );
};

/** 数字动态标尺（右车道）：基数线 + 三枚对账数字落线（50 滚动计数），p6-02 三行补测。 */
const NumberRuler: React.FC<{at01: number; at02: number}> = ({at01, at02}) => {
  const baseO = useProgress(at01 + 12, DUR.f5);
  const chips = [useProgress(at01 + 30, DUR.f4), useProgress(at01 + 90, DUR.f4), useProgress(at01 + 150, DUR.f4)];
  const rows = [useProgress(at02 + 30, DUR.f4), useProgress(at02 + 56, DUR.f4), useProgress(at02 + 82, DUR.f4)];

  const chip = (i: number, x: number, node: React.ReactNode, sub: string) => (
    <div style={{position: 'absolute', left: x, top: 2, width: 80, opacity: chips[i], transform: `translateY(${(1 - chips[i]) * 10}px)`}}>
      <div style={{fontFamily: theme.mono, fontSize: 30, fontWeight: 700, color: theme.ok, fontVariantNumeric: 'tabular-nums'}}>{node}</div>
      <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginTop: 2}}>{sub}</div>
    </div>
  );

  return (
    <div style={{position: 'absolute', left: 1636, top: 620, width: 264, height: 200}}>
      {/* 基数线（对标基线）与刻度 */}
      <svg width={264} height={60} viewBox="0 0 264 60" style={{position: 'absolute', left: 0, top: 50, opacity: baseO}}>
        <line x1={4} y1={6} x2={260} y2={6} stroke={theme.dim} strokeWidth={2} />
        {Array.from({length: 13}, (_, i) => (
          <line key={i} x1={8 + i * 21} y1={6} x2={8 + i * 21} y2={i % 4 === 0 ? 16 : 11} stroke={theme.dim} strokeWidth={1.4} />
        ))}
      </svg>
      {chip(0, 8, '3', '建·查·删')}
      {chip(1, 96, <Counter from={0} to={50} start={at01 + 90} frames={26} />, '/ 会话')}
      {chip(2, 188, '7d', '过期')}
      {/* p6-02 调度细节三行（灰阶＝同页补测，不再染绿） */}
      {['每秒 · 检查', '低优先级 · 入队', '两轮之间 · 触发'].map((t, i) => (
        <div
          key={t}
          style={{
            position: 'absolute',
            left: 4,
            top: 128 + i * 30,
            fontFamily: theme.mono,
            fontSize: 16,
            color: theme.dim,
            letterSpacing: 1,
            opacity: rows[i] * 0.92,
            transform: `translateX(${(1 - rows[i]) * 14}px)`,
          }}
        >
          {t}
        </div>
      ))}
    </div>
  );
};

// ── 6-B 硬分歧：两数字块对峙 + 天平两拍悬停 + 裁决角标 ───────────────────

/** 硬分歧数字块（车道对坐位：教学版左 / 官方右，同权重不站队）。 */
const ClaimBlock: React.FC<{side: 'L' | 'R'; at: number; who: string; big: string; lines: React.ReactNode[]}> = ({
  side,
  at,
  who,
  big,
  lines,
}) => {
  const e = useEnter(side === 'L' ? 'slideL' : 'slideR', {at, dur: DUR.f5, dist: 40});
  return (
    <div style={{position: 'absolute', left: side === 'L' ? 64 : 1624, top: 396, ...e}}>
      <Panel style={{width: 232, boxSizing: 'border-box', padding: '18px 20px'}}>
        <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, letterSpacing: 3}}>{who}</div>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 44,
            fontWeight: 700,
            color: theme.text,
            marginTop: 8,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {big}
        </div>
        {lines.map((ln, i) => (
          <div key={i} style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 6}}>
            {ln}
          </div>
        ))}
      </Panel>
    </div>
  );
};

/** 天平（上带原生 glyph）：摆两拍后停在 +4.6° 微倾——悬而未定，非回正。 */
const ScaleGlyph: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const T = 26; // 一拍 26 帧
  const CUT = 55; // 两拍余相位截停（sin(2π·55/26)≈0.66 → 悬停 4.6°，与末值连续）
  const t = frame - at;
  const amp = 7;
  const angle = t < 0 ? 0 : t < CUT ? amp * Math.sin((2 * Math.PI * t) / T) : amp * Math.sin((2 * Math.PI * CUT) / T);
  const inO = useProgress(at - DUR.f4, DUR.f5);
  return (
    <svg width={200} height={88} viewBox="0 0 200 88" style={{position: 'absolute', left: 860, top: 60, opacity: inO}}>
      {/* 立柱与底座 */}
      <line x1={100} y1={26} x2={100} y2={64} stroke={theme.dim} strokeWidth={4} />
      <path d="M76 78 L100 58 L124 78 Z" fill="none" stroke={theme.dim} strokeWidth={4} strokeLinejoin="round" />
      {/* 横梁（绕支点摆动；吊盘反旋保持水平） */}
      <g transform={`rotate(${angle} 100 26)`}>
        <line x1={20} y1={26} x2={180} y2={26} stroke={theme.text} strokeWidth={4} strokeLinecap="round" />
        {[20, 180].map((x) => (
          <g key={x} transform={`rotate(${-angle} ${x} 26)`}>
            <line x1={x} y1={26} x2={x - 16} y2={50} stroke={theme.dim} strokeWidth={2.4} />
            <line x1={x} y1={26} x2={x + 16} y2={50} stroke={theme.dim} strokeWidth={2.4} />
            <path d={`M${x - 22} 50 Q${x} 66 ${x + 22} 50`} fill="none" stroke={theme.text} strokeWidth={3} strokeLinecap="round" />
          </g>
        ))}
      </g>
    </svg>
  );
};

/** 裁决角标（底部字幕带上沿）：deny 只做警示点，不染整卡（红页语义归画框章）。 */
const VerdictPill: React.FC<{at: number}> = ({at}) => {
  const o = useProgress(at, DUR.f5);
  return (
    <div style={{position: 'absolute', left: 0, top: 864, width: 1920, display: 'flex', justifyContent: 'center', opacity: o}}>
      <Panel style={{padding: '10px 26px', display: 'flex', alignItems: 'center', gap: 12, transform: `translateY(${(1 - o) * 10}px)`}}>
        <span style={{width: 10, height: 10, borderRadius: 5, background: theme.deny, display: 'inline-block'}} />
        <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.text, letterSpacing: 2}}>{'闭源无法裁决 · 以官方为准'}</span>
      </Panel>
    </div>
  );
};

// ── 6-C 官方没讲：灰新增页车道清单 + 「还是那个两分钟」回扣 5-G ──────────

/** 灰新增行（右车道＝官方侧，slideR 进场；highlight 档走 accent 描边）。 */
const GrayRow: React.FC<{y: number; at: number; plus: string; zh: string; mono?: string; highlight?: boolean}> = ({
  y,
  at,
  plus,
  zh,
  mono,
  highlight = false,
}) => {
  const e = useEnter('slideR', {at, dur: DUR.f4, dist: 26});
  const hot = highlight ? theme.accent : theme.dim;
  return (
    <div style={{position: 'absolute', left: 1636, top: y, ...e}}>
      <Panel
        accent={highlight ? withAlpha(theme.accent, 0.7) : theme.panelBorder}
        style={{padding: '10px 16px', display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 250, boxSizing: 'border-box'}}
      >
        <span style={{fontFamily: theme.mono, fontSize: 20, color: hot}}>{plus}</span>
        <span style={{fontFamily: theme.sans, fontSize: 21, color: highlight ? theme.accent : theme.text, whiteSpace: 'nowrap'}}>{zh}</span>
        {mono ? <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{mono}</span> : null}
      </Panel>
    </div>
  );
};

/** 6-C 车道编排：左「教学版未讲」虚影 + 右灰新增行随句落下 + 5-G 回扣连线。 */
const GrayAdditions: React.FC<{at07: number; at08: number; at09: number; at10: number}> = ({at07, at08, at09, at10}) => {
  const ghost = useEnter('slideL', {at: at07 + 10, dur: DUR.f5, dist: 24});
  const backO = useProgress(at09 + 44, DUR.f5);
  return (
    <>
      {/* 左车道虚影：灰页是「官方写了、教学版没讲」——教学版席位空置 */}
      <div style={{position: 'absolute', left: 64, top: 330, ...ghost}}>
        <div
          style={{
            border: `2px dashed ${theme.panelBorder}`,
            borderRadius: 12,
            padding: '10px 16px',
            background: 'rgba(23,28,38,0.55)', // theme.panel @0.55（虚影态）
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, letterSpacing: 2}}>{'教学版'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 2}}>{'未讲'}</div>
        </div>
      </div>
      {/* 首行右缘收敛（评审修复）：zh 去「 · 」装饰后总宽约 -31px，右缘 ≈1911-1919
          收进画布；「开口之外 ×2」术语与 p6-08 口播逐字保持 */}
      <GrayRow y={210} at={at07 + 120} plus="＋" zh="后台化三条路" mono="开口之外 ×2" />
      <GrayRow y={286} at={at08 + 80} plus="＋" zh="按键转后台" mono="Ctrl+B" />
      <GrayRow y={352} at={at08 + 150} plus="＋" zh="跑满两分钟 · 自动转" mono="120s" />
      <GrayRow y={436} at={at09 + 12} plus="！" zh="还是那个两分钟" highlight />
      {/* 5-G 回扣连线（dim 行进虚线向左下指回实验室） */}
      <svg width={264} height={72} viewBox="0 0 264 72" style={{position: 'absolute', left: 1636, top: 508, opacity: backO}}>
        <path d="M150 4 C150 40 90 30 34 52" fill="none" stroke={theme.dim} strokeWidth={2.4} strokeDasharray="8 10" />
        <path d="M34 52 l16 -2 l-6 14 Z" fill={theme.dim} />
      </svg>
      <div style={{position: 'absolute', left: 1636, top: 584, fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: backO}}>
        {'5-G · Timeout 120s'}
      </div>
      <GrayRow y={648} at={at10 + 60} plus="＋" zh="输出 5GB · 熔断" mono="5GB" />
      <GrayRow y={714} at={at10 + 90} plus="＋" zh="内存吃紧 · 收割" mono="reap" />
    </>
  );
};

// ── 6-D 学徒登场：桌角只看不动手 + 归属条 + 争议双卡与分档（岛内满幅） ────

/** 学徒 + 放大镜 + 归属条 + 光斑（车道层，p6-11..12 画框在场期间即入席）。 */
const ApprenticeCorner: React.FC<{at11: number; at12: number}> = ({at11, at12}) => {
  const inO = useEnter('rise', {at: at11 + 6, dur: DUR.f5, dist: 24});
  const attribO = useProgress(at11 + 34, DUR.f5);
  const watchO = useProgress(at12 + 20, DUR.f4);
  const cornerO = useProgress(at11 + 14, DUR.f5);
  // 光斑沿桌前缘（画框下沿 y≈892 之下）扫过——不与画框叠压
  const sweep = useProgress(at12 + 30, 56);
  return (
    <>
      <div style={inO}>
        <Person x={110} y={700} color={theme.mech} scale={0.5} opacity={0.95} />
      </div>
      {/* 桌角前缘 */}
      <svg width={220} height={10} viewBox="0 0 220 10" style={{position: 'absolute', left: 60, top: 788, opacity: cornerO}}>
        <line x1={4} y1={5} x2={216} y2={5} stroke={theme.panelBorder} strokeWidth={4} strokeLinecap="round" />
      </svg>
      {/* 放大镜（只看不动手：镜头常亮微光） */}
      <svg width={96} height={96} viewBox="0 0 96 96" style={{position: 'absolute', left: 186, top: 702, opacity: inO.opacity, overflow: 'visible'}}>
        {/* 柄端绕 (40,40) 转 −20° 落 ≈(101.5, 68.7)，出视口 5.5px——overflow visible（P3 NurseGlyph 同款）防柄尖平切 */}
        <g transform="rotate(-20 40 40)">
          <circle cx={40} cy={40} r={26} fill={withAlpha(theme.accent, 0.1)} stroke={theme.mech} strokeWidth={4} />
          <line x1={59} y1={59} x2={88} y2={88} stroke={theme.mech} strokeWidth={7} strokeLinecap="round" />
        </g>
      </svg>
      {/* watchdog 标签 */}
      <div style={{position: 'absolute', left: 84, top: 622, opacity: watchO, transform: `translateY(${(1 - watchO) * 8}px)`}}>
        <Panel accent={withAlpha(theme.mech, 0.6)} style={{padding: '6px 14px'}}>
          <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.mechDeep}}>{'45s · watchdog'}</span>
        </Panel>
      </div>
      {/* 归属条（【三】级证据：口播带归属句，画面压归属角标） */}
      <div style={{position: 'absolute', left: 64, top: 872, opacity: attribO}}>
        <div
          style={{
            border: `2px solid ${withAlpha(theme.dim, 0.5)}`,
            borderRadius: 8,
            padding: '6px 12px',
            background: 'rgba(23,28,38,0.72)', // theme.panel @0.72（叠底部空带）
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim}}>{'据他人对闭源实现的拆解'}</span>
        </div>
      </div>
      {/* 光斑扫过账本下缘 */}
      <div
        style={{
          position: 'absolute',
          left: 340 + 1160 * sweep,
          top: 882,
          width: 96,
          height: 28,
          borderRadius: 14,
          opacity: Math.sin(Math.PI * sweep) * 0.9,
          background: 'radial-gradient(closest-side, rgba(239,177,60,0.20), rgba(239,177,60,0))', // theme.accent
          pointerEvents: 'none',
        }}
      />
    </>
  );
};

/** 争议问题卡（悬而未决＝虚线框＋慢浮动；p6-13..14 岛内满幅）。 */
const QuestionCard: React.FC<{y: number; at: number; q: string; tag: string}> = ({y, at, q, tag}) => {
  const e = useEnter('rise', {at, dur: DUR.f5, dist: 34, restBottom: y + 150});
  const bob = useBreathe({period: 96, amp: 4, base: 0, offset: at});
  return (
    <div style={{position: 'absolute', left: 1150, top: y, ...e, transform: `${e.transform} translateY(${bob}px)`}}>
      <div
        style={{
          border: `2px dashed ${theme.panelBorder}`,
          borderRadius: 14,
          background: theme.panel,
          padding: '22px 28px',
          width: 660,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 18,
        }}
      >
        <span style={{fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: theme.text}}>{q}</span>
        <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap'}}>{tag}</span>
      </div>
    </div>
  );
};

/** p6-13..14 岛内舞台：账本之外两争议 + 传统/官方分档。 */
const OpenQuestions: React.FC<{at13: number; at14: number}> = ({at13, at14}) => {
  const kick = useProgress(at13 + 2, DUR.f5);
  const in1 = useProgress(at14 + 10, DUR.f5);
  const in2 = useProgress(at14 + 22, DUR.f5);
  const labO = useProgress(at14 + 34, DUR.f5);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 1150,
          top: 244,
          fontFamily: theme.mono,
          fontSize: 18,
          color: theme.dim,
          letterSpacing: 3,
          opacity: kick,
        }}
      >
        {'账本之外 · 两争议'}
      </div>
      <QuestionCard y={300} at={at13 + 8} q="谁决定后台？" tag="Q1 · 未决" />
      <QuestionCard y={492} at={at13 + 70} q="任务活多久？" tag="Q2 · 未决" />
      {/* p6-14 分档：防的东西不同——两匣并置，中间虚线分界 */}
      {[
        {o: in1, x: 420, zh: '传统', sub: '防漏跑', ac: theme.dim},
        {o: in2, x: 700, zh: '官方', sub: '防烧钱', ac: theme.text},
      ].map((b) => (
        <div key={b.zh} style={{position: 'absolute', left: b.x, top: 636, opacity: b.o, transform: `translateY(${(1 - b.o) * 14}px)`}}>
          <Panel accent={withAlpha(b.ac, 0.6)} style={{width: 240, boxSizing: 'border-box', padding: '16px 20px', textAlign: 'center'}}>
            <div style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 700, color: b.ac}}>{b.zh}</div>
            <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 6}}>{b.sub}</div>
          </Panel>
        </div>
      ))}
      <svg width={40} height={170} viewBox="0 0 40 170" style={{position: 'absolute', left: 660, top: 620, opacity: labO}}>
        <line x1={20} y1={8} x2={20} y2={162} stroke={theme.dim} strokeWidth={2.4} strokeDasharray="7 9" />
      </svg>
      <div style={{position: 'absolute', left: 420, top: 780, fontFamily: theme.mono, fontSize: 16, color: theme.dim, letterSpacing: 2, opacity: labO}}>
        {'防的不同 · 只能分档'}
      </div>
    </>
  );
};

// ── 6-E 五规律金句：车道 2 卡先翻 → 岛内并拢成排 5 卡 → 齐呼吸一拍 ───────

const RULES = [
  {zh: '新消息进场不赊账', en: 'async return'},
  {zh: '周期归装置持有', en: 'framework-owned'},
  {zh: '队列吸收时间差', en: 'queue buffer'},
  {zh: '固定偏移摊峰值', en: 'jitter'},
  {zh: '坏输入只损失自己', en: 'fail-alone'},
] as const;

/** 并立横排（五卡 248 宽，组内 18 / 组间 44 ⇒ 2+3 分组可读）：x0 284。 */
const ROW_X = [284, 550, 842, 1108, 1374] as const;
const ROW_Y = 436;
/** p6-16 车道位（画框左右车道内）。 */
const LANE_POS = [
  {left: 58, top: 430},
  {left: 1652, top: 430},
] as const;

/** 规律金句卡：enterAt 翻起（底缘为轴 rotateX）；from+rowAt 给出车道→横排滑移并拢。 */
const RuleCard: React.FC<{
  n: number;
  zh: string;
  en: string;
  enterAt: number;
  to: {left: number; top: number};
  from?: {left: number; top: number};
  rowAt?: number;
  glowAt: number;
}> = ({n, zh, en, enterAt, to, from, rowAt, glowAt}) => {
  const enter = useProgress(enterAt, DUR.f5, 'decelerate');
  // 无滑移需求的卡给不可达锚（progress 恒 0），hooks 保持无条件顶层
  const glide = useProgress(rowAt ?? 1e9, 12, 'decelerate');
  const glow = useImpulse({at: glowAt, dur: DUR.f6, peak: 1});
  const left = from ? lerp(from.left, to.left, glide) : to.left;
  const top = from ? lerp(from.top, to.top, glide) : to.top;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        opacity: enter,
        transform: `perspective(760px) rotateX(${(1 - enter) * -68}deg)`,
        transformOrigin: '50% 100%',
      }}
    >
      <Panel
        accent={withAlpha(theme.accent, 0.55 + 0.4 * glow)}
        style={{
          width: 248,
          boxSizing: 'border-box',
          padding: '18px 16px',
          boxShadow: glow > 0.02 ? `0 0 ${26 * glow}px ${withAlpha(theme.accent, 0.4 * glow)}` : undefined,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.accent, letterSpacing: 2}}>{`0${n}`}</div>
        <div style={{fontFamily: theme.serif, fontSize: 23, fontWeight: 700, color: theme.accent, marginTop: 6, letterSpacing: 1}}>{zh}</div>
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 10}}>{en}</div>
      </Panel>
    </div>
  );
};

/** 6-E 编排：p6-16 前两条规律在左右车道翻起（画框回放 map-back 期间零叠压），
 *  p6-17 画框卸载瞬间两卡滑入横排、后三条随句翻起，翻齐五卡齐呼吸一拍。 */
const RuleFive: React.FC<{at15: number; at16: number; at17: number}> = ({at15, at16, at17}) => {
  const kick = useProgress(at15 + 8, DUR.f5);
  const glowAt = at17 + 144; // 第五卡落定（at17+128+DUR.f5）后一拍
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 88,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 20,
          color: theme.dim,
          letterSpacing: 6,
          opacity: kick,
        }}
      >
        {'五条规律'}
      </div>
      <RuleCard n={1} zh={RULES[0].zh} en={RULES[0].en} enterAt={at16 + 14} from={LANE_POS[0]} to={{left: ROW_X[0], top: ROW_Y}} rowAt={at17} glowAt={glowAt} />
      <RuleCard n={2} zh={RULES[1].zh} en={RULES[1].en} enterAt={at16 + 90} from={LANE_POS[1]} to={{left: ROW_X[1], top: ROW_Y}} rowAt={at17} glowAt={glowAt} />
      <RuleCard n={3} zh={RULES[2].zh} en={RULES[2].en} enterAt={at17 + 14} to={{left: ROW_X[2], top: ROW_Y}} glowAt={glowAt} />
      <RuleCard n={4} zh={RULES[3].zh} en={RULES[3].en} enterAt={at17 + 72} to={{left: ROW_X[3], top: ROW_Y}} glowAt={glowAt} />
      <RuleCard n={5} zh={RULES[4].zh} en={RULES[4].en} enterAt={at17 + 128} to={{left: ROW_X[4], top: ROW_Y}} glowAt={glowAt} />
    </>
  );
};

// ── 6-F 边界与收束：地图回看标注 + 传送带快转定格 + 下期卡 + 幕末渐黑 ────

/** 「永不触发」锚（让可选动效缺省时不产生条件 hook） */
const FAR = 1e9;

/** 全片地图回看的车道标注（P1-C 同构小图：两装置剪影＋域标签；地图本体在画框）。
 *  handoffAt：身份卡入场前一拍，边界卡让位淡出（评审修复：原与身份卡几何叠压）。 */
const MapRecap: React.FC<{at18: number; grayAt: number; spinAt: number; handoffAt?: number}> = ({
  at18,
  grayAt,
  spinAt,
  handoffAt = FAR,
}) => {
  const frame = useCurrentFrame();
  const kick = useProgress(at18 + 2, DUR.f5);
  const devO = useProgress(at18 + 10, DUR.f5);
  const tagO = useProgress(at18 + 4, DUR.f5) * (1 - useProgress(handoffAt, DUR.f5));
  const grayO = useProgress(grayAt, DUR.f5);
  const beltO = useProgress(at18 + 16, DUR.f5);
  // 收句「等，被赶出了传送带」：快转 14 帧后冻结（定格），冲量辉光标记定格点
  const t = Math.max(0, frame - spinAt);
  const flowOff = -Math.min(t, 14) * 9;
  const freezeGlow = useImpulse({at: spinAt + 14, dur: DUR.f6, peak: 1});

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 88,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 20,
          color: theme.dim,
          letterSpacing: 6,
          opacity: kick,
        }}
      >
        {'全片地图 · 回看'}
      </div>
      {/* 两装置剪影小图（P1-C 同构：右缘清洗槽 / 上缘定时钟，mech 轮廓） */}
      <svg width={210} height={64} viewBox="0 0 210 64" style={{position: 'absolute', left: 68, top: 292, opacity: devO}}>
        <rect x={2} y={12} width={86} height={44} rx={9} fill="none" stroke={theme.mech} strokeWidth={3} />
        <path d="M12 36 Q24 24 36 36 T60 36 T84 36" fill="none" stroke={theme.mech} strokeWidth={2.6} strokeLinecap="round" />
        <circle cx={166} cy={32} r={24} fill="none" stroke={theme.mech} strokeWidth={3} />
        <line x1={166} y1={32} x2={166} y2={14} stroke={theme.mech} strokeWidth={3} strokeLinecap="round" />
        <line x1={166} y1={32} x2={179} y2={36} stroke={theme.mech} strokeWidth={3} strokeLinecap="round" />
      </svg>
      {/* 单师傅域（本集边界，高亮）＋ 指入画框的短连线 */}
      <div style={{position: 'absolute', left: 64, top: 384, opacity: tagO, transform: `translateY(${(1 - tagO) * 10}px)`}}>
        <Panel accent={withAlpha(theme.mech, 0.7)} style={{width: 236, boxSizing: 'border-box', padding: '12px 16px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, letterSpacing: 2}}>{'本集边界'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 600, color: theme.text, marginTop: 4, whiteSpace: 'nowrap'}}>{'一个师傅 · 一个程序'}</div>
        </Panel>
      </div>
      <svg width={20} height={12} viewBox="0 0 20 12" style={{position: 'absolute', left: 302, top: 418, opacity: tagO}}>
        <line x1={0} y1={6} x2={10} y2={6} stroke={theme.mech} strokeWidth={2.6} />
        <path d="M10 6 L2 2 L2 10 Z" fill={theme.mech} />
      </svg>
      {/* 多师傅区（置灰＝另一场戏）＋ 指入画框的短连线 */}
      <div style={{position: 'absolute', left: 1636, top: 210, opacity: grayO}}>
        <div
          style={{
            border: `2px dashed ${theme.panelBorder}`,
            borderRadius: 12,
            padding: '10px 16px',
            background: 'rgba(23,28,38,0.55)',
            width: 236,
            boxSizing: 'border-box',
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, letterSpacing: 2}}>{'多师傅'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 2}}>{'另一场戏'}</div>
        </div>
      </div>
      <svg width={30} height={12} viewBox="0 0 30 12" style={{position: 'absolute', left: 1596, top: 242, opacity: grayO}}>
        <line x1={30} y1={6} x2={14} y2={6} stroke={theme.dim} strokeWidth={2.6} />
        <path d="M14 6 L24 2 L24 10 Z" fill={theme.dim} />
      </svg>
      {/* 传送带（core 橙〔M-001〕，P1-C 同构小图）：快转一拍定格 */}
      <div style={{position: 'absolute', left: 8, top: 742, opacity: beltO}}>
        <BeltStrip x={0} y={0} width={296} labels={['开口', '工具', '结果']} />
        <svg width={296} height={96} viewBox="0 0 296 96" style={{position: 'absolute', left: 0, top: 0}}>
          <line
            x1={22}
            y1={48}
            x2={274}
            y2={48}
            stroke={theme.core}
            strokeWidth={3 + 3 * freezeGlow}
            strokeDasharray="9 13"
            strokeDashoffset={flowOff}
            strokeLinecap="round"
          />
        </svg>
        {freezeGlow > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: 8,
              top: 34,
              width: 280,
              height: 28,
              borderRadius: 14,
              opacity: 0.5 * freezeGlow,
              background: 'radial-gradient(closest-side, rgba(217,119,87,0.5), rgba(217,119,87,0))', // theme.core
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>
    </>
  );
};

/** 下期卡（右车道）：只「下期」措辞；层栈走 HarnessStackP6，下期层呼吸预告
 *  （NEXT_LAYER ← series-layers.json；层名随数据，零集标题硬编码进口播面）。 */
const NextCard: React.FC<{at: number}> = ({at}) => {
  const inO = useProgress(at, DUR.f6);
  return (
    <div style={{position: 'absolute', left: 1634, top: 396, opacity: inO, transform: `translateY(${(1 - inO) * 16}px)`}}>
      <div style={{fontFamily: theme.serif, fontSize: 30, fontWeight: 700, color: theme.text, letterSpacing: 10, paddingLeft: 4}}>{'下期'}</div>
      <div style={{transform: 'scale(0.68)', transformOrigin: 'top left', marginTop: 10}}>
        <HarnessStackP6 at={at + 4} nextBreathAt={at + 18} />
      </div>
            {/* 规则 8：下期卡标题字面量与 series.json 逐字同步（去前缀段，判例同 ep3） */}
      <div style={{fontFamily: theme.serif, fontSize: 24, fontWeight: 600, color: theme.mech, marginTop: 8, paddingLeft: 4}}>{'从一个到一群'}</div>
{NEXT_LAYER ? (
        <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 6, paddingLeft: 4}}>{NEXT_LAYER.layer}</div>
      ) : null}
    </div>
  );
};

/** 身份卡（左车道）：与下期卡同族淡入（评审修复：原在组件顶层算 opacity，帧基准
 *  是场景帧而锚是 6-F 局部帧——身份卡在 p6-18 首帧即满透明瞬现；组件化进 bF
 *  Sequence 后局部帧口径与 NextCard 一致）；落位接管 MapRecap 边界卡让出的位置。 */
const IdCard: React.FC<{at: number}> = ({at}) => {
  const inO = useProgress(at, DUR.f6);
  return (
    <div style={{position: 'absolute', left: 96, top: 396, opacity: inO, transform: `translateY(${(1 - inO) * 12}px)`}}>
      <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, letterSpacing: 2}}>{'本集'}</div>
      {/* 规则 8：身份卡标题字面量与 series.json 逐字同步（去前缀段） */}
      <div style={{fontFamily: theme.serif, fontSize: 24, fontWeight: 600, color: theme.mech, marginTop: 6}}>{'一张回执和四层钟'}</div>
    </div>
  );
};

/** 幕末渐黑（红线四）：挂在 6-F Sequence 最后子节点，盖过画框与下期卡；
 *  useFadeOut 在本 Sequence 语境取 bF 局部帧，窗=bF 整镜时长（终点即末 beat 终点）。 */
const FadeTail: React.FC<{span: number}> = ({span}) => {
  const keep = useFadeOut(span, {frames: 36});
  return <AbsoluteFill style={{background: '#000', opacity: 1 - keep, pointerEvents: 'none'}} />;
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P6ReconRules: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  // 镜界（narration 幕内 4 beat，6-A/6-B 与 6-E/6-F 各为 beat 内拆镜——取窗各归各镜）
  const bA = w('p6-01', 'p6-02');
  const bB = w('p6-03', 'p6-06');
  const bC = w('p6-07', 'p6-10');
  const bD = w('p6-11', 'p6-14');
  const bE = w('p6-15', 'p6-17');
  const bF = w('p6-18', 'p6-19');

  // 6-F 句内锚（收句/下期见落点按句时长比例推导，不写死秒数）
  const at18 = at('p6-18') - bF.from;
  const dur18 = dur('p6-18');
  const at19 = at('p6-19') - bF.from;
  const dur19 = dur('p6-19');
  const grayAt = at18 + Math.round(dur18 * 0.62); // 「另一场戏」落点
  const spinAt = at19 + Math.round(dur19 * 0.58); // 「等，被赶出了传送带」落点
  const nextAt = at19 + Math.round(dur19 * 0.42); // 收句回顾落定后、下期卡/身份卡淡入

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="6-A 对账桌开张">
        <SceneTag chapter="对账桌" tagline="一半印证 · 一半翻案" />
        <ReconTable at01={at('p6-01') - bA.from} at02={at('p6-02') - bA.from} />
        {/* cue 1/6：recon-verdicts/green-list（本片该图首现 → 默认 lead；窗=两句和） */}
        <ArchifyRecap
          slug="recon-verdicts"
          caption="对账三类"
          cues={[{chapterId: 'green-list', at: at('p6-01') - bA.from, durationInFrames: dur('p6-01') + dur('p6-02')}]}
        />
        <Footnote delay={at('p6-01') - bA.from + 40}>{'CronCreate / CronList / CronDelete'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="6-B 硬分歧">
        <ScaleGlyph at={at('p6-05') - bB.from + 70} />
        <ClaimBlock side="L" at={at('p6-05') - bB.from + 50} who="教学版" big="≤ 10%" lines={['按间隔比例', '封顶 15 分钟']} />
        <ClaimBlock side="R" at={at('p6-06') - bB.from + 6} who="官方产品" big="30 分钟" lines={['或间隔之半', 'interval / 2']} />
        <VerdictPill at={at('p6-06') - bB.from + 110} />
        {/* cue 2/6：recon-verdicts/red-jitter（与 6-A 同 slug 跨镜紧邻 → lead={false}；窗=四句和） */}
        <ArchifyRecap
          slug="recon-verdicts"
          caption="对账三类"
          lead={false}
          cues={[
            {
              chapterId: 'red-jitter',
              at: at('p6-03') - bB.from,
              durationInFrames: dur('p6-03') + dur('p6-04') + dur('p6-05') + dur('p6-06'),
            },
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="6-C 官方没讲">
        <GrayAdditions
          at07={at('p6-07') - bC.from}
          at08={at('p6-08') - bC.from}
          at09={at('p6-09') - bC.from}
          at10={at('p6-10') - bC.from}
        />
        {/* cue 3/6：recon-verdicts/gray-extra（与 6-B 紧邻 → lead={false}；窗=四句和） */}
        <ArchifyRecap
          slug="recon-verdicts"
          caption="对账三类"
          lead={false}
          cues={[
            {
              chapterId: 'gray-extra',
              at: at('p6-07') - bC.from,
              durationInFrames: dur('p6-07') + dur('p6-08') + dur('p6-09') + dur('p6-10'),
            },
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="6-D 学徒登场">
        {/* 车道层（学徒/归属条）在 cue 窗内即入席；争议卡锚在 p6-13 岛内、无需让位层 */}
        <ApprenticeCorner at11={at('p6-11') - bD.from} at12={at('p6-12') - bD.from} />
        <OpenQuestions at13={at('p6-13') - bD.from} at14={at('p6-14') - bD.from} />
        {/* cue 4/6：recon-verdicts/gray-extra（同章重现、与 6-C 紧邻 → lead={false}；窗=两句和） */}
        <ArchifyRecap
          slug="recon-verdicts"
          caption="对账三类"
          lead={false}
          cues={[{chapterId: 'gray-extra', at: at('p6-11') - bD.from, durationInFrames: dur('p6-11') + dur('p6-12')}]}
        />
      </Sequence>

      <Sequence {...bE} name="6-E 五规律金句">
        <RuleFive at15={at('p6-15') - bE.from} at16={at('p6-16') - bE.from} at17={at('p6-17') - bE.from} />
        {/* cue 5/6：spec-two-promises/map-back（换图 → 默认 lead；窗=两句和） */}
        <ArchifyRecap
          slug="spec-two-promises"
          caption="两条规格"
          cues={[{chapterId: 'map-back', at: at('p6-15') - bE.from, durationInFrames: dur('p6-15') + dur('p6-16')}]}
        />
      </Sequence>

      <Sequence {...bF} name="6-F 边界与收束">
        <MapRecap at18={at18} grayAt={grayAt} spinAt={spinAt} handoffAt={nextAt - 6} />
        {/* cue 6/6：spec-two-promises/map-back（同图跨镜重现；lead 判定见文件头 ★ 留痕） */}
        <ArchifyRecap
          slug="spec-two-promises"
          caption="两条规格"
          cues={[{chapterId: 'map-back', at: at('p6-18') - bF.from, durationInFrames: dur('p6-18') + dur('p6-19')}]}
        />
        {/* 规则 8：身份卡（左车道，p6-19 句 42% 与下期卡同族淡入；边界卡已让位） */}
        <IdCard at={nextAt} />
        <NextCard at={nextAt} />
        {/* 幕末渐黑：最后子节点，盖过画框/车道一切内容（含下期卡） */}
        <FadeTail span={bF.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P6ReconRules;
