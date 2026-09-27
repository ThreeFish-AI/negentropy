/** P6 三道闸与账本（p6-01..46，实存 39 句；storyboard「P6 三道闸与账本」节）。
 *
 *  8 镜 / 21 条 archify cue（与 storyboard 覆盖预算表一致），一镜一 Sequence、
 *  Sequence name = storyboard 镜号。cue 落法：at('句id') - beat.from / dur('句id')，
 *  各 cue 独立重算；「接缝 lead=false」逐条照 storyboard 动效列。
 *
 *  cue 清单（21）：
 *   6-A ls-mech@01 · tc-demand@02 · td-consume@03 · tg-read@04（全 lead=false，跨幕/跨实例背靠背）
 *   6-B tg-auto@05 · tg-confirm@06（同实例 lead=false）· tg-chief@08（独立实例默认 lead）
 *   6-C tc-agent@11 · tc-plan@14（同实例默认 lead）
 *   6-D —（纯 Remotion 装置 CitySandbox）
 *   6-E er-desk@24（默认）· sl-official@25（false）· sl-setup@27（默认）· sl-recompute@29 +
 *       sl-verdict@30（同实例 false）· er-verdicts@31（false）
 *   6-F er-parties@32（false）· er-open@36（默认）
 *   6-G ct-fix@37（false）· tr-rlcd@40（默认）· er-open@41（false）
 *   6-H td-old@42（false）
 *
 *  红线四：本幕是末幕，全片尾幕渐黑挂在本幕末 beat（6-H）Sequence 内部的
 *  TailFade 上，窗口从 6-H 总时长（bH.durationInFrames）反推——不可挂整幕。
 *
 *  对 storyboard 的已登记偏离（详见交付报告）：
 *   ① 6-A 画面列「读数单滑入预案墙」并入 6-B GateWall 的读数单行进（6-A 四句
 *      全为背靠背 archify 独占，无装置窗口）；
 *   ② 6-A p6-01「m4 放大」以画框缓推（PushZoom）＋「机制四」角标近似——录制件
 *      内部的节点级缩放无法叠加在 ArchifyClip 之上；
 *   ③ 6-F 三卡时序按口播句序解读：左@p6-33、中（打断手势）@p6-34、右（拼图）@p6-35；
 *   ④ 6-H「暴雨夜城市重现」落在 p6-44 起的装置底层（p6-42 为 archify 独占＋整体
 *      降光，动效列未给城市层窗口）；
 *   ⑤ 封卡系列名/层 chips 读 series-layers.json（next=null → 下期空槽）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  win,
  useBreathe,
  useCount,
  useDraw,
  useEnter,
  useFadeOut,
  useProgress,
  usePushIn,
  useSpring,
  useStagger,
} from '../motion';
import {Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {QuoteCard} from '../components/cards';
import seriesLayers from '../series-layers.json';

/** 与 archify 画框同构的内容列（画框 1298 宽、屏心居中）。 */
const COL = {x: 311, w: 1298} as const;

/** 确定性伪随机（禁 Math.random——渲染必须确定）。 */
const hash = (i: number, salt = 1): number => {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
/** smoothstep：装置行进的软加减速（纯函数）。 */
const smooth = (t: number): number => t * t * (3 - 2 * t);

// ─────────────────────────────── 三级角标（本集 6-E/6-G/6-H 收口共用） ───────────────────────────────

type BadgeKind = 'official' | 'field' | 'ours';

/** 三级角标圆徽：虚线描边=官方自报；实线描边=第三方实测；实心+✓=我们复算。
 *  线型/亮度承担区分（theme 规则五：非色彩维度不用色相），不占概念色。 */
const BadgeMark: React.FC<{
  kind: BadgeKind;
  label?: string;
  at?: number;
  size?: 'sm' | 'md';
}> = ({kind, label, at = 0, size = 'sm'}) => {
  const o = useProgress(at, DUR.f3);
  const fs = size === 'md' ? 24 : 19;
  const d = size === 'md' ? 22 : 18;
  const text = label ?? (kind === 'official' ? '官方自报' : kind === 'field' ? '外测' : '复算');
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        opacity: o,
        fontFamily: theme.sans,
        fontSize: fs,
        color: theme.dim,
        whiteSpace: 'nowrap',
      }}
    >
      {kind === 'ours' ? (
        <span
          style={{
            width: d,
            height: d,
            borderRadius: d / 2,
            background: theme.text,
            color: theme.bg,
            fontFamily: theme.mono,
            fontSize: size === 'md' ? 15 : 12,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {'✓'}
        </span>
      ) : (
        <span
          style={{
            width: d,
            height: d,
            borderRadius: d / 2,
            boxSizing: 'border-box',
            border:
              kind === 'official'
                ? `2px dashed ${theme.dim}`
                : `2.5px solid ${theme.text}`,
          }}
        />
      )}
      {text}
    </span>
  );
};

// ─────────────────────────────── 关键词角标（钉图角，archify 窗上方条带 y≈88） ───────────────────────────────

/** 关键词钉：pill + 可选小注行。effects 走时长+缓动（铁律③）。 */
const Pin: React.FC<{
  at?: number;
  accent?: string;
  keyword: React.ReactNode;
  sub?: React.ReactNode;
  y?: number;
}> = ({at = 0, accent, keyword, sub, y = 88}) => {
  const e = useEnter('rise', {at, dur: DUR.f4, dist: 16});
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: y,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        pointerEvents: 'none',
        ...e,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 26px',
          borderRadius: 999,
          border: `2px solid ${accent ?? theme.text}`,
          color: accent ?? theme.text,
          fontFamily: theme.sans,
          fontSize: 27,
          fontWeight: 600,
          background: `${theme.bg}E6`,
        }}
      >
        {keyword}
      </div>
      {sub ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontFamily: theme.sans,
            fontSize: 20,
            color: theme.dim,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};

/** 单值数字钉（对账三口径 / 三问收口的落定数字）。 */
const NumKeyword: React.FC<{text: string; color?: string}> = ({text, color}) => (
  <span style={{fontFamily: theme.mono, fontSize: 34, color: color ?? theme.text}}>{text}</span>
);

// ─────────────────────────────── 小图标（glyph，均 SVG 确定性绘制） ───────────────────────────────

const StampGlyph: React.FC = () => (
  <svg width={28} height={28} viewBox="0 0 30 30">
    <g stroke={theme.gate} strokeWidth={2.4} fill="none">
      <rect x={4} y={9} width={22} height={13} rx={3} />
      <path d="M10 9 V4 H20 V9" />
    </g>
  </svg>
);

const ClockGlyph: React.FC = () => (
  <svg width={28} height={28} viewBox="0 0 28 28">
    <circle cx={14} cy={14} r={10} stroke={theme.text} strokeWidth={2.2} fill="none" />
    <line x1={14} y1={14} x2={14} y2={8} stroke={theme.text} strokeWidth={2.2} />
    <line x1={14} y1={14} x2={19} y2={16} stroke={theme.text} strokeWidth={2.2} />
  </svg>
);

const LoopGlyph: React.FC = () => (
  <svg width={28} height={28} viewBox="0 0 30 30">
    <path d="M22 8 A9 9 0 1 0 24.5 16" stroke={theme.danger} strokeWidth={2.6} fill="none" />
    <path d="M17.5 2.5 L24.5 7 L18.5 12 Z" fill={theme.danger} />
  </svg>
);

const CoalGlyph: React.FC = () => (
  <svg width={30} height={24} viewBox="0 0 30 24">
    <g fill="#2A3242" stroke={theme.dim} strokeWidth={1.4}>
      <polygon points="3,18 9,8 16,13 13,21" />
      <polygon points="15,21 20,10 27,14 25,21" />
    </g>
  </svg>
);

const ScaleGlyph: React.FC = () => (
  <svg width={34} height={28} viewBox="0 0 34 28">
    <g stroke={theme.dim} strokeWidth={2} fill="none">
      <line x1={17} y1={4} x2={17} y2={22} />
      <line x1={5} y1={8} x2={29} y2={8} />
      <path d="M5 8 L1.5 15 A4.6 4.6 0 0 0 8.5 15 Z" />
      <path d="M29 8 L25.5 15 A4.6 4.6 0 0 0 32.5 15 Z" />
      <line x1={11} y1={25} x2={23} y2={25} />
    </g>
  </svg>
);

// ─────────────────────────────── 6-A 机制四开闸 ───────────────────────────────

/** p6-01「m4 放大」：机制地图重放画框整体缓推（偏离②的近似实现；
 *  dur 由句长推导——beat 级动作不落标尺，注释显式帧数规则）。 */
const PushZoom: React.FC<{zoomFrames: number; children: React.ReactNode}> = ({zoomFrames, children}) => {
  const t = usePushIn(0, {scale: 0.06, dur: zoomFrames});
  return (
    <div style={{position: 'absolute', inset: 0, transformOrigin: '50% 46%', transform: t}}>
      {children}
    </div>
  );
};

/** p6-04「三闸门轮廓展开」：三枚闸品门架轮廓错峰展开（高低错落预告 6-B）。 */
const GateOutline: React.FC<{p: number; h: number}> = ({p, h}) => (
  <svg width={64} height={h + 20} viewBox={`0 0 64 ${h + 20}`}>
    <g stroke={theme.gate} strokeWidth={3} fill="none">
      <line x1={7} y1={16} x2={7} y2={h + 18} />
      <line x1={57} y1={16} x2={57} y2={h + 18} />
      <line x1={3} y1={16 + h * p} x2={61} y2={16 + h * p} />
    </g>
  </svg>
);

const GatesPreview: React.FC = () => {
  const ps = useStagger(3, {at: 4, stride: 5, dur: DUR.f4});
  const hs = [32, 46, 60];
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 76,
        display: 'flex',
        justifyContent: 'center',
        gap: 56,
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {ps.map((p, i) => (
        <div key={i} style={{opacity: p}}>
          <GateOutline p={p} h={hs[i]} />
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────── 6-B 预案墙三道闸（局部装置 GateWall） ───────────────────────────────

/** 预案墙：自动闸/复核闸/人工梯 三门架高低错落（闸品）。
 *  p6-07 低读数走人工梯＋「升首席」电梯；p6-09 门架随风险伸缩（带伞↓/停课停航↑）；
 *  p6-10 门槛刻度带「0.5–0.6」＋官方示例小注＋「你的代码定」关键词。 */
const GateWall: React.FC<{a7: number; d7: number; a9: number; d9: number; a10: number}> = ({
  a7,
  d7,
  a9,
  d9,
  a10,
}) => {
  const frame = useCurrentFrame();
  const lamp = useBreathe({period: 110, amp: 0.22, base: 0.78});
  // p6-09 门架随风险伸缩：前半「带伞」横杠↓、后半「停课停航」横杠↑（空间隐喻与旁白同向）
  const r9 = progress(frame, a9, d9);
  const down = smooth(win(r9, [0.06, 0.42]));
  const up = smooth(win(r9, [0.52, 0.88]));
  const barY = 290 + 130 * down - 235 * up;
  // p6-07 读数单行进：地行 → 爬梯 → 电梯亮
  const t7 = progress(frame, a7, d7);
  const roll = smooth(win(t7, [0, 0.42]));
  const climb = smooth(win(t7, [0.42, 0.82]));
  const lift = win(t7, [0.78, 0.96]);
  const tokX = 130 + 815 * roll;
  const tokY = 430 - 268 * climb;
  const tokO = frame >= a7 && frame < a7 + d7 ? 1 : 0;
  const chip1 = win(r9, [0.02, 0.2]);
  const chip2 = win(r9, [0.5, 0.7]);
  const band = progress(frame, a10, 14);
  const rungs = Array.from({length: 8}, (_, i) => 175 + i * 36);
  return (
    <div
      style={{
        position: 'absolute',
        left: COL.x,
        top: 150,
        width: COL.w,
        background: theme.panel,
        border: `2px solid ${theme.panelBorder}`,
        borderRadius: 16,
        padding: 12,
      }}
    >
      <svg width={COL.w - 28} height={610} viewBox={`0 0 ${COL.w - 28} 610`}>
        {/* 地面 */}
        <line x1={40} y1={460} x2={1230} y2={460} stroke={theme.panelBorder} strokeWidth={2} />

        {/* 自动闸（高门架，横杠随风险伸缩） */}
        <rect x={150} y={160} width={14} height={300} fill={theme.gate} />
        <rect x={316} y={160} width={14} height={300} fill={theme.gate} />
        <rect x={138} y={barY} width={204} height={12} fill={theme.gate} />
        <circle cx={240} cy={barY - 26} r={15} fill={theme.ok} opacity={0.22 * lamp} />
        <circle cx={240} cy={barY - 26} r={9} fill={theme.ok} opacity={lamp} />

        {/* 复核闸（中门架＋章戳） */}
        <rect x={520} y={220} width={14} height={240} fill={theme.gate} />
        <rect x={686} y={220} width={14} height={240} fill={theme.gate} />
        <rect x={508} y={316} width={204} height={12} fill={theme.gate} opacity={0.55} />
        <g transform="rotate(-10 630 262)">
          <rect x={588} y={238} width={84} height={48} rx={8} fill="none" stroke={theme.text} strokeWidth={2.5} />
          <rect x={594} y={244} width={72} height={36} rx={5} fill="none" stroke={theme.text} strokeWidth={1} opacity={0.5} />
          <text x={630} y={269} textAnchor="middle" fontFamily={theme.mono} fontSize={17} fill={theme.text}>
            {'复核'}
          </text>
        </g>

        {/* 人工梯（最高——通首席）＋「升首席」电梯 */}
        <rect x={944} y={150} width={10} height={310} fill={theme.panelBorder} />
        <rect x={1058} y={150} width={10} height={310} fill={theme.panelBorder} />
        {rungs.map((y, i) => (
          <line
            key={y}
            x1={949}
            y1={y}
            x2={1053}
            y2={y}
            stroke={climb > (i + 1) / 8 ? theme.gate : theme.panelBorder}
            strokeWidth={5}
            opacity={climb > (i + 1) / 8 ? 1 : 0.5}
          />
        ))}
        <rect x={880} y={140} width={250} height={10} fill={theme.gate} opacity={0.8} />
        <path
          d={`M1140 ${252 - 50 * lift} L1155 ${238 - 50 * lift} L1170 ${252 - 50 * lift}`}
          stroke={theme.gate}
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
          opacity={lift}
        />
        <path
          d={`M1140 ${274 - 50 * lift} L1155 ${260 - 50 * lift} L1170 ${274 - 50 * lift}`}
          stroke={theme.gate}
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
          opacity={lift}
        />
        <text x={1155} y={208} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fill={theme.gate} opacity={lift}>
          {'升首席'}
        </text>

        {/* 门名 */}
        <text x={240} y={498} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={theme.text}>
          {'自动闸'}
        </text>
        <text x={603} y={498} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={theme.text}>
          {'复核闸'}
        </text>
        <text x={1001} y={498} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={theme.text}>
          {'人工梯'}
        </text>

        {/* p6-07 读数单（低读数走人工梯） */}
        <g opacity={tokO}>
          <rect x={tokX - 30} y={tokY - 17} width={60} height={34} rx={7} fill={theme.panel} stroke={theme.bar} strokeWidth={2.5} />
          <text x={tokX} y={tokY + 6} textAnchor="middle" fontFamily={theme.mono} fontSize={16} fill={theme.bar}>
            {'低读数'}
          </text>
        </g>

        {/* p6-09 风险 chips：带伞↓ / 停课停航↑ */}
        <g opacity={chip1}>
          <rect x={110} y={62} width={158} height={46} rx={23} fill="none" stroke={theme.dim} strokeWidth={2} />
          <text x={158} y={93} textAnchor="middle" fontFamily={theme.sans} fontSize={21} fill={theme.dim}>
            {'带伞'}
          </text>
          <text x={232} y={94} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fill={theme.gate}>
            {'↓'}
          </text>
        </g>
        <g opacity={chip2}>
          <rect x={640} y={62} width={238} height={46} rx={23} fill="none" stroke={theme.dim} strokeWidth={2} />
          <text x={712} y={93} textAnchor="middle" fontFamily={theme.sans} fontSize={21} fill={theme.dim}>
            {'停课停航'}
          </text>
          <text x={838} y={94} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fill={theme.gate}>
            {'↑'}
          </text>
        </g>

        {/* p6-10 门槛刻度带 0.5–0.6 */}
        <g opacity={band}>
          <text x={120} y={524} fontFamily={theme.sans} fontSize={18} fill={theme.dim}>
            {'官方示例'}
          </text>
          <line x1={120} y1={556} x2={1150} y2={556} stroke={theme.panelBorder} strokeWidth={2} />
          <rect x={635} y={534} width={103} height={44} rx={6} fill={`${theme.gate}2B`} stroke={theme.gate} strokeWidth={2} />
          <text x={120} y={598} textAnchor="middle" fontFamily={theme.mono} fontSize={16} fill={theme.dim}>
            {'0'}
          </text>
          <text x={635} y={598} textAnchor="middle" fontFamily={theme.mono} fontSize={18} fill={theme.gate}>
            {'0.5'}
          </text>
          <text x={738} y={598} textAnchor="middle" fontFamily={theme.mono} fontSize={18} fill={theme.gate}>
            {'0.6'}
          </text>
          <text x={1150} y={598} textAnchor="middle" fontFamily={theme.mono} fontSize={16} fill={theme.dim}>
            {'1.0'}
          </text>
          <rect x={930} y={540} width={186} height={40} rx={20} fill="none" stroke={theme.gate} strokeWidth={2} />
          <text x={1023} y={567} textAnchor="middle" fontFamily={theme.sans} fontSize={20} fill={theme.gate}>
            {'你的代码定'}
          </text>
        </g>
      </svg>
    </div>
  );
};

// ─────────────────────────────── 6-C 考场三架构 ───────────────────────────────

/** 官方警告横幅（p6-11 起常驻镜顶）：虚线徽＋警示红回路箭头脉冲。 */
const WarnBanner: React.FC<{at: number}> = ({at}) => {
  const o = useProgress(at, DUR.f3);
  const pulse = useBreathe({period: 64, amp: 0.3, base: 0.7});
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 84, display: 'flex', justifyContent: 'center', opacity: o, pointerEvents: 'none'}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '10px 26px',
          borderRadius: 12,
          border: `2px dashed ${theme.panelBorder}`,
          background: `${theme.bg}D8`,
        }}
      >
        <BadgeMark kind="official" label={'官方警告'} />
        <span style={{opacity: pulse}}>
          <LoopGlyph />
        </span>
        <span style={{fontFamily: theme.sans, fontSize: 23, color: theme.danger}}>{'自作主张循环'}</span>
        <span style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>{'→'}</span>
        <span style={{fontFamily: theme.sans, fontSize: 23, color: theme.danger}}>{'脱轨机会'}</span>
      </div>
    </div>
  );
};

/** 考场卡（p6-13 考卷堆叠＋印章）→ 对拍数字卡（p6-15 67.8% / p6-16 74.1%）＋外测·distil 小卡。 */
const ExamCompare: React.FC<{a13: number; a15: number; a16: number}> = ({a13, a15, a16}) => {
  const frame = useCurrentFrame();
  const papers = useStagger(3, {at: a13, stride: 4, dur: DUR.f3});
  const stampS = useSpring('settle', {at: a13 + 8, dur: DUR.f5});
  const stampO = useProgress(a13 + 8, DUR.f4);
  const stackOut = progress(frame, a15, 10);
  const n15 = useCount({from: 0, to: 67.8, at: a15, dur: DUR.f6});
  const n16 = useCount({from: 0, to: 74.1, at: a16, dur: DUR.f6});
  const c15 = useSpring('settle', {at: a15, dur: DUR.f5});
  const o15 = useProgress(a15, DUR.f4);
  const c16 = useSpring('settle', {at: a16, dur: DUR.f5});
  const o16 = useProgress(a16, DUR.f4);
  const distilO = useProgress(a15 + 8, DUR.f4);
  const cross = useProgress(a16 + 10, DUR.f3);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      {/* p6-13 考卷堆叠＋印章（承接装置，p6-15 数字卡落定时退场） */}
      <div style={{position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', paddingTop: 296, opacity: 1 - stackOut}}>
        <div style={{position: 'relative', width: 340, height: 250}}>
          {[
            {x: 26, y: 16, r: 3},
            {x: 10, y: 8, r: -2},
            {x: 0, y: 0, r: 0},
          ].map((pp, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: pp.x,
                top: pp.y,
                width: 300,
                height: 200,
                borderRadius: 8,
                background: '#1E2530',
                border: `2px solid ${theme.panelBorder}`,
                transform: `rotate(${pp.r}deg)`,
                opacity: papers[i],
              }}
            />
          ))}
          <div style={{position: 'absolute', left: 50, top: 38, width: 252, opacity: papers[2]}}>
            <div style={{height: 3, background: theme.panelBorder, marginBottom: 10, width: '70%'}} />
            <div style={{height: 3, background: theme.panelBorder, marginBottom: 10, width: '86%'}} />
            <div style={{height: 3, background: theme.panelBorder, width: '54%'}} />
          </div>
          <div
            style={{
              position: 'absolute',
              right: -16,
              top: -24 - (1 - stampS) * 56,
              transform: 'rotate(-12deg)',
              opacity: stampO,
            }}
          >
            <div
              style={{
                border: `3px solid ${theme.text}`,
                borderRadius: 8,
                padding: '10px 16px',
                fontFamily: theme.mono,
                fontSize: 20,
                color: theme.text,
                background: `${theme.bg}B8`,
              }}
            >
              {'官方自办'}
            </div>
          </div>
          <div style={{position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: -60, opacity: papers[2]}}>
            <span
              style={{
                padding: '8px 22px',
                borderRadius: 999,
                border: `2px solid ${theme.dim}`,
                color: theme.dim,
                fontFamily: theme.sans,
                fontSize: 22,
              }}
            >
              {'考场'}
            </span>
          </div>
        </div>
      </div>

      {/* 对拍数字卡：67.8%（Jev 名签＋虚线徽）vs 74.1%（王冠划叉＋头排席位） */}
      <div style={{position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', gap: 56, paddingTop: 268}}>
        <div style={{width: 430, opacity: o15, transform: `translateY(${(1 - c15) * 28}px)`}}>
          <Panel accent={theme.bar} style={{padding: '22px 26px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'Jev · 四项平均'}</span>
              <BadgeMark kind="official" label={'官方自报'} />
            </div>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 84,
                color: theme.bar,
                marginTop: 10,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {n15.toFixed(1)}
              {'%'}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 4}}>{'更准 · 更便宜 · 更快'}</div>
          </Panel>
        </div>
        <div style={{width: 430, opacity: o16, transform: `translateY(${(1 - c16) * 28}px)`}}>
          <Panel accent={theme.panelBorder} style={{padding: '22px 26px', position: 'relative'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'最强对照'}</span>
              <span style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim}}>{'对照不点名'}</span>
            </div>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 84,
                color: theme.text,
                marginTop: 10,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {n16.toFixed(1)}
              {'%'}
            </div>
            {/* 王冠划叉：不是王座 */}
            <svg width={52} height={40} viewBox="0 0 40 30" style={{position: 'absolute', right: 18, top: 52}}>
              <path d="M4 24 L7 9 L14 16 L20 4 L26 16 L33 9 L36 24 Z" fill={theme.slot} opacity={0.9} />
              <line
                x1={5}
                y1={5}
                x2={35}
                y2={26}
                stroke={theme.danger}
                strokeWidth={4}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - cross}
              />
              <line
                x1={35}
                y1={5}
                x2={5}
                y2={26}
                stroke={theme.danger}
                strokeWidth={4}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - cross}
              />
            </svg>
            <div
              style={{
                alignSelf: 'flex-start',
                marginTop: 14,
                display: 'inline-block',
                padding: '8px 20px',
                borderRadius: 999,
                border: `2px solid ${theme.text}`,
                fontFamily: theme.sans,
                fontSize: 22,
                color: theme.text,
              }}
            >
              {'又快又便宜 · 头排'}
            </div>
          </Panel>
        </div>
      </div>

      {/* 外测·distil 小卡（付款拆问） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 648, display: 'flex', justifyContent: 'center', opacity: distilO}}>
        <Panel style={{padding: '16px 24px', width: 620}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
            <BadgeMark kind="field" label={'外测·distil'} />
            <span style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim}}>{'付款逐行拆问'}</span>
          </div>
          <div style={{display: 'flex', gap: 40, marginTop: 10, fontFamily: theme.mono, fontSize: 21}}>
            <span style={{color: theme.ok}}>{'批准 32/32 全对'}</span>
            <span style={{color: theme.danger}}>{'金额错 0/16'}</span>
          </div>
        </Panel>
      </div>
    </div>
  );
};

// ─────────────────────────────── 6-D Jevons 气泡（CitySandbox，等轴城郭） ───────────────────────────────

/** 等轴城郭模块数据（确定性 hash 生成，渲染确定）。 */
const BLOCKS = Array.from({length: 36}, (_, i) => {
  const gx = i % 6;
  const gy = Math.floor(i / 6);
  const h = 46 + Math.floor(hash(i) * 130);
  const x = 649 + (gx - gy) * 66;
  const y = 380 + (gx + gy) * 26;
  return {
    i,
    top: `${x},${y - h - 26} ${x + 62},${y - h} ${x},${y - h + 26} ${x - 62},${y - h}`,
    left: `${x - 62},${y - h} ${x},${y - h + 26} ${x},${y + 26} ${x - 62},${y}`,
    right: `${x},${y - h + 26} ${x + 62},${y - h} ${x + 62},${y} ${x},${y + 26}`,
    winPts: [
      {x: x + 34, y: y - 0.65 * h + 13.5},
      {x: x + 34, y: y - 0.35 * h + 13.5},
    ],
  };
});

const CITY_SPAWNS = BLOCKS.flatMap((b) => b.winPts);

/** 城市沙盘：单价曲线下坠（闸品细线）＋询问气泡从万家窗口冒出（柱青）。
 *  剧场红线：右下「示意」常驻，不念钱数。 */
const CitySandbox: React.FC<{
  a19: number;
  d19: number;
  a21: number;
  d21: number;
  a23: number;
  d23: number;
}> = ({a19, d19, a21, d21, a23, d23}) => {
  const frame = useCurrentFrame();
  const spin = useSpring('settle', {at: 0, dur: DUR.f5}); // 沙盘旋入
  const curve = useDraw(a19 + 8, Math.round(d19 + d21)); // 单价曲线随前两句描画
  const tagO = useProgress(2, DUR.f4);
  const sweep = smooth(win(progress(frame, a21, d21), [0.05, 0.9])); // 煤→判断类比小条扫过
  return (
    <div
      style={{
        position: 'absolute',
        left: COL.x,
        top: 140,
        width: COL.w,
        transform: `rotate(${(1 - spin) * -4}deg) scale(${0.94 + 0.06 * spin})`,
      }}
    >
      <svg width={COL.w} height={660} viewBox={`0 0 ${COL.w} 660`}>
        {/* 单价曲线下坠（闸品细线；描完亮箭头与标签） */}
        <path d="M 100 26 C 500 30 850 64 1170 140" stroke={theme.gate} strokeWidth={3} fill="none" {...curve} />
        <g opacity={1 - curve.strokeDashoffset}>
          <path d="M1148 118 L1170 140 L1142 144" stroke={theme.gate} strokeWidth={3} fill="none" strokeLinecap="round" />
          <text x={1136} y={110} textAnchor="end" fontFamily={theme.mono} fontSize={19} fill={theme.gate}>
            {'单价 ↓'}
          </text>
        </g>

        {/* 等轴城郭（面色全部深底族；概念色只走窗口点与气泡） */}
        {BLOCKS.map((b) => (
          <g key={b.i}>
            <polygon points={b.left} fill="#121826" />
            <polygon points={b.right} fill="#1A2232" />
            <polygon points={b.top} fill="#232B3A" stroke={theme.panelBorder} strokeWidth={1} />
            {b.i % 2 === 0
              ? b.winPts.map((wp, w) => (
                  <rect key={w} x={wp.x - 2} y={wp.y - 3} width={4} height={6} fill={theme.bar} opacity={0.45} />
                ))
              : null}
          </g>
        ))}

        {/* 常驻零星气泡 */}
        {Array.from({length: 8}, (_, i) => {
          const p = ((frame + i * 53) % 150) / 150;
          const o = Math.sin(Math.PI * p);
          const s = CITY_SPAWNS[(i * 4 + 1) % CITY_SPAWNS.length];
          return (
            <circle
              key={`amb${i}`}
              cx={s.x}
              cy={s.y - 70 * p}
              r={4 + hash(i, 13) * 3}
              fill={`${theme.bar}2E`}
              stroke={theme.bar}
              strokeWidth={1.4}
              opacity={0.7 * o}
            />
          );
        })}

        {/* p6-23 气泡成千上万涌出：四波爆发，密度随曲线下坠陡增 */}
        {Array.from({length: 44}, (_, i) => {
          const wave = i % 4;
          const start = a23 + wave * (d23 / 4.5) + hash(i, 7) * 9;
          const life = 24 + hash(i, 9) * 16;
          const p = win(progress(frame, start, life), [0, 1]);
          if (p <= 0 || p >= 1) return null;
          const o = Math.sin(Math.PI * p);
          const s = CITY_SPAWNS[i % CITY_SPAWNS.length];
          return (
            <circle
              key={`er${i}`}
              cx={s.x + Math.sin(i * 12.9 + p * 2.6) * 9}
              cy={s.y - 95 * p}
              r={6 + hash(i, 17) * 7}
              fill={`${theme.bar}33`}
              stroke={theme.bar}
              strokeWidth={1.8}
              opacity={o}
            />
          );
        })}
      </svg>

      {/* 煤→判断类比小条（p6-21 扫过） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 706, display: 'flex', justifyContent: 'center', opacity: tagO}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '10px 24px',
            borderRadius: 12,
            background: `${theme.bg}C0`,
            transform: `translateX(${(sweep - 0.5) * 640}px)`,
          }}
        >
          <CoalGlyph />
          <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'→'}</span>
          <ScaleGlyph />
          <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'煤 · 判断'}</span>
        </div>
      </div>

      {/* 剧场红线：右下「示意」常驻 */}
      <div
        style={{
          position: 'absolute',
          right: -220,
          top: 700,
          padding: '6px 18px',
          borderRadius: 999,
          border: `2px solid ${theme.dim}`,
          color: theme.dim,
          fontFamily: theme.sans,
          fontSize: 20,
          opacity: 0.85,
        }}
      >
        {'示意'}
      </div>
    </div>
  );
};

// ─────────────────────────────── 6-E 对账三口径（LedgerDesk） ───────────────────────────────

/** 对账台：三枚角标凹槽＋三数字槽位（193.6× 落定，另两槽待 p6-29/30 的图角钉补位）；
 *  p6-26 注脚两行逐行落。 */
const LedgerDesk: React.FC<{a26: number}> = ({a26}) => {
  const enterS = useSpring('settle', {at: 0, dur: DUR.f5});
  const enterO = useProgress(0, DUR.f4);
  const f1 = useSpring('settle', {at: a26 + 4, dur: DUR.f4});
  const fo1 = useProgress(a26 + 4, DUR.f3);
  const f2 = useSpring('settle', {at: a26 + 16, dur: DUR.f4});
  const fo2 = useProgress(a26 + 16, DUR.f3);
  const slots: {kind: BadgeKind; label: string; num: string | null}[] = [
    {kind: 'official', label: '官方自报', num: '193.6×'},
    {kind: 'ours', label: '复算·公开数据', num: null},
    {kind: 'field', label: '外测', num: null},
  ];
  return (
    <div style={{position: 'absolute', inset: 0, opacity: enterO, transform: `translateY(${(1 - enterS) * 18}px)`}}>
      <div style={{position: 'absolute', left: COL.x, top: 250, width: COL.w, display: 'flex', gap: 24, justifyContent: 'center'}}>
        {slots.map((sl) => (
          <div
            key={sl.kind}
            style={{
              width: 310,
              height: 240,
              borderRadius: 14,
              background: '#10141C',
              border: `2px solid ${theme.panelBorder}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 26,
              gap: 20,
            }}
          >
            <BadgeMark kind={sl.kind} label={sl.label} />
            {sl.num ? (
              <span style={{fontFamily: theme.mono, fontSize: 54, color: theme.text}}>{sl.num}</span>
            ) : (
              <span
                style={{
                  width: 150,
                  height: 70,
                  borderRadius: 10,
                  border: `2px dashed ${theme.panelBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.mono,
                  fontSize: 30,
                  color: theme.panelBorder,
                }}
              >
                {'—'}
              </span>
            )}
          </div>
        ))}
      </div>
      {/* 注脚两行（p6-26 逐行落） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 702, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16}}>
        <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.text, opacity: fo1, transform: `translateY(${(1 - f1) * 18}px)`}}>
          {'— 卷子自家出'}
        </span>
        <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.text, opacity: fo2, transform: `translateY(${(1 - f2) * 18}px)`}}>
          {'— 两位最强专家的平均'}
        </span>
      </div>
    </div>
  );
};

/** p6-31 三句裁决＝三徽章对位（方法论收口）。 */
const VerdictBadges: React.FC = () => {
  const items: {kind: BadgeKind; label: string; at: number}[] = [
    {kind: 'official', label: '官方自报', at: 4},
    {kind: 'ours', label: '复算·公开数据', at: 10},
    {kind: 'field', label: '外测', at: 16},
  ];
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 96, display: 'flex', justifyContent: 'center', gap: 44, pointerEvents: 'none'}}>
      {items.map((it) => (
        <BadgeMark key={it.kind} kind={it.kind} label={it.label} at={it.at} size="md" />
      ))}
    </div>
  );
};

// ─────────────────────────────── 6-F 命名之争（三口径证词卡＋毛病清单墙缩影） ───────────────────────────────

const TestimonyCards: React.FC<{a33: number; a34: number; a35: number}> = ({a33, a34, a35}) => {
  const frame = useCurrentFrame();
  const leftS = useSpring('settle', {at: a33, dur: DUR.f5}); // 左卡翻出
  const leftO = useProgress(a33, DUR.f4);
  const centerS = useSpring('snap', {at: a34, dur: DUR.f5}); // 中卡打断（轻过冲）
  const centerO = useProgress(a34, DUR.f4);
  const slash = useProgress(a34 + 4, DUR.f4); // 打断斜杠
  const chips = useStagger(3, {at: a35, stride: 5, dur: DUR.f4}); // 右卡拼图合拢
  const rightO = useProgress(a35, DUR.f4);
  const wall = smooth(progress(frame, a34 + 8, 18)); // 毛病清单墙横条滚入
  const cardHead: React.CSSProperties = {fontFamily: theme.mono, fontSize: 19, color: theme.dim};
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: COL.x, top: 252, width: COL.w, display: 'flex', gap: 34, justifyContent: 'center'}}>
        {/* 左：官方 FAQ（虚线徽） */}
        <div style={{width: 396, opacity: leftO, transform: `perspective(700px) rotateY(${(1 - leftS) * -65}deg)`}}>
          <Panel style={{padding: '24px 26px', minHeight: 252}}>
            <div style={cardHead}>{'官方 FAQ'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 34, color: theme.text, marginTop: 18}}>{'不是 LLM'}</div>
            <div style={{marginTop: 26}}>
              <BadgeMark kind="official" />
            </div>
          </Panel>
        </div>
        {/* 中：官方文档（打断手势：斜杠＋急停入位） */}
        <div style={{width: 396, opacity: centerO, transform: `perspective(700px) rotateY(${(1 - centerS) * 65}deg) rotate(${(1 - centerS) * 5 - 2}deg)`, position: 'relative'}}>
          <Panel style={{padding: '24px 26px', minHeight: 252}}>
            <div style={cardHead}>{'官方文档'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 29, color: theme.text, marginTop: 18, lineHeight: 1.5}}>
              {'预训练语言模型＋加训'}
            </div>
            <div style={{marginTop: 20}}>
              <BadgeMark kind="official" />
            </div>
          </Panel>
          <svg width={130} height={130} viewBox="0 0 130 130" style={{position: 'absolute', right: -10, top: -10}}>
            <line
              x1={112}
              y1={10}
              x2={28}
              y2={104}
              stroke={theme.gate}
              strokeWidth={6}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - slash}
              strokeLinecap="round"
            />
          </svg>
        </div>
        {/* 右：独立逆向（拼图合拢＋「推断」灰斜体） */}
        <div style={{width: 396, opacity: rightO}}>
          <Panel style={{padding: '24px 26px', minHeight: 252}}>
            <div style={cardHead}>{'独立逆向'}</div>
            <div style={{display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap'}}>
              {['已知', '组件', '组合'].map((t, i) => (
                <span
                  key={t}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 10,
                    border: `2px solid ${theme.slotDeep}`,
                    color: theme.text,
                    fontFamily: theme.sans,
                    fontSize: 25,
                    opacity: chips[i],
                    transform: `translateX(${(1 - chips[i]) * (i - 1) * 84}px)`,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
            <div style={{marginTop: 18, fontStyle: 'italic', fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'推断'}</div>
          </Panel>
        </div>
      </div>

      {/* 毛病清单墙缩影（九张贴纸＋「官方自列」虚线徽，随 p6-34 滚入） */}
      <div style={{position: 'absolute', left: COL.x, top: 742, width: COL.w, transform: `translateX(${(1 - wall) * -460}px)`, opacity: wall}}>
        <Panel style={{padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12}}>
          {Array.from({length: 9}, (_, i) => (
            <div
              key={i}
              style={{
                width: 58,
                height: 54,
                borderRadius: 8,
                border: `2px solid ${theme.danger}`,
                opacity: 0.55,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.mono,
                fontSize: 18,
                color: theme.dim,
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </div>
          ))}
          <div style={{marginLeft: 12}}>
            <BadgeMark kind="official" label={'官方自列'} at={14} />
          </div>
        </Panel>
      </div>
    </div>
  );
};

// ─────────────────────────────── 6-G 三问收口 ───────────────────────────────

/** 自培工位小图（Q3 承接装置）。 */
const BenchGlyph: React.FC = () => (
  <svg width={124} height={56} viewBox="0 0 124 56">
    <g stroke={theme.bar} strokeWidth={2.4} fill="none">
      <line x1={8} y1={46} x2={116} y2={46} />
      <line x1={24} y1={46} x2={24} y2={32} />
      <path d="M24 32 Q42 10 60 30" />
      <rect x={72} y={32} width={36} height={14} rx={2} stroke={theme.slot} />
    </g>
    <circle cx={62} cy={32} r={3.4} fill={theme.slot} />
  </svg>
);

const OpenQuestions: React.FC<{a38: number; a39: number}> = ({a38, a39}) => {
  const q12 = useStagger(2, {at: a38, stride: 5, dur: DUR.f4});
  const q3S = useSpring('snap', {at: a38 + 9, dur: DUR.f5}); // Q3 翻出
  const q3O = useProgress(a38 + 9, DUR.f4);
  const rule = useProgress(a39, DUR.f4);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: COL.x, top: 264, width: COL.w, display: 'flex', gap: 36, justifyContent: 'center'}}>
        {/* Q1 命名（已问，压暗） */}
        <div style={{width: 372, opacity: q12[0] * 0.72, transform: `translateY(${(1 - q12[0]) * 22}px)`}}>
          <Panel style={{padding: '22px 24px', minHeight: 224}}>
            <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'Q1'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 32, color: theme.dim, marginTop: 12}}>{'命名'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 10, opacity: 0.7}}>{'开放问题一'}</div>
          </Panel>
        </div>
        {/* Q2 领地（配「先重标门槛」行动标签，闸品） */}
        <div style={{width: 372, opacity: q12[1], transform: `translateY(${(1 - q12[1]) * 22}px)`}}>
          <Panel style={{padding: '22px 24px', minHeight: 224}}>
            <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'Q2'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 32, color: theme.text, marginTop: 12}}>{'领地'}</div>
            <div
              style={{
                display: 'inline-block',
                marginTop: 16,
                padding: '8px 20px',
                borderRadius: 999,
                border: `2px solid ${theme.gate}`,
                color: theme.gate,
                fontFamily: theme.sans,
                fontSize: 22,
              }}
            >
              {'先重标门槛'}
            </div>
          </Panel>
        </div>
        {/* Q3 自培（承接：自培工位小图） */}
        <div style={{width: 372, opacity: q3O, transform: `translateY(${(1 - q3S) * 26}px)`}}>
          <Panel accent={theme.bar} style={{padding: '22px 24px', minHeight: 224}}>
            <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.bar}}>{'Q3'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 32, color: theme.text, marginTop: 12}}>{'自培'}</div>
            <div style={{marginTop: 14}}>
              <BenchGlyph />
            </div>
          </Panel>
        </div>
      </div>
      {/* p6-39 对拍规则小卡 */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 566, display: 'flex', justifyContent: 'center', opacity: rule}}>
        <div
          style={{
            border: `2px dashed ${theme.panelBorder}`,
            borderRadius: 12,
            padding: '16px 30px',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'对拍规则'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 27, color: theme.text}}>{'同一道错误预算'}</span>
        </div>
      </div>
    </div>
  );
};

/** p6-41「0.45–0.57」区间带展开＋「差在排序」小注（警示红）。 */
const RangePin: React.FC = () => {
  const e = useEnter('rise', {dur: DUR.f4, dist: 16});
  const band = useProgress(6, DUR.f4);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 88, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, pointerEvents: 'none', ...e}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
        <svg width={260} height={30} viewBox="0 0 260 30">
          <line x1={0} y1={15} x2={260} y2={15} stroke={theme.panelBorder} strokeWidth={2} />
          <rect x={117} y={2} width={62} height={26} rx={4} fill={`${theme.bar}33`} stroke={theme.bar} strokeWidth={2} opacity={band} />
          <line x1={117} y1={6} x2={117} y2={24} stroke={theme.bar} strokeWidth={2} opacity={band} />
          <line x1={179} y1={6} x2={179} y2={24} stroke={theme.bar} strokeWidth={2} opacity={band} />
        </svg>
        <NumKeyword text={'0.45–0.57'} color={theme.bar} />
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 14, fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>
        <span style={{color: theme.danger}}>{'差在排序'}</span>
        <BadgeMark kind="field" label={'外测·kev'} at={8} />
      </div>
    </div>
  );
};

// ─────────────────────────────── 6-H 回到开头（收尾） ───────────────────────────────

/** 首幕暴雨夜城市重现（与 0-A 同构）＋判读员工位与主播台最终并置（底层，p6-44 起）。 */
const SKYLINE = (() => {
  const rects: {x: number; y: number; w: number; h: number; lit: boolean}[] = [];
  let x = -20;
  let i = 0;
  while (x < 1920) {
    const w = 90 + Math.floor(hash(i, 5) * 130);
    const h = 90 + Math.floor(hash(i, 6) * 240);
    rects.push({x, y: 1080 - h - 60, w, h, lit: hash(i, 8) > 0.55});
    x += w + 18 + Math.floor(hash(i, 7) * 40);
    i += 1;
  }
  return rects;
})();

const RAIN = Array.from({length: 44}, (_, i) => i);

const RainCity: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'absolute', inset: 0, opacity: 0.62}}>
      <svg width={1920} height={1080}>
        {SKYLINE.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h + 60} fill="#131A26" />
            {b.lit
              ? Array.from({length: 4}, (_, w) => (
                  <rect key={w} x={b.x + 14 + (w * (b.w - 28)) / 4} y={b.y + 26} width={10} height={14} fill={theme.dim} opacity={0.35} />
                ))
              : null}
          </g>
        ))}
        <rect x={0} y={1020} width={1920} height={60} fill="#0B0E13" />
        {RAIN.map((i) => {
          const x = hash(i, 11) * 1920;
          const sp = 7 + hash(i, 2) * 7;
          const y = ((frame * sp + hash(i, 3) * 1140) % 1200) - 60;
          return <line key={i} x1={x} y1={y} x2={x - 7} y2={y + 26} stroke={theme.dim} strokeWidth={1.6} opacity={0.2} />;
        })}
      </svg>
      {/* 双工位最终并置：主播台（base dim 中性光）vs 判读员工位（格黄预报单＋灯） */}
      <div style={{position: 'absolute', left: 470, top: 618, width: 330, opacity: 0.8}}>
        <div style={{border: `2px solid ${theme.panelBorder}`, borderRadius: 12, background: `${theme.panel}C0`, padding: '16px 20px'}}>
          <svg width={120} height={44} viewBox="0 0 120 44">
            <rect x={8} y={6} width={104} height={26} rx={3} fill="none" stroke={theme.dim} strokeWidth={2} />
            {[0, 1, 2, 3, 4].map((k) => (
              <rect key={k} x={18 + k * 20} y={30 - (8 + hash(k, 21) * 14)} width={8} height={8 + hash(k, 21) * 14} fill={theme.dim} opacity={0.5} />
            ))}
          </svg>
          <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 8}}>{'主播台'}</div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 1120, top: 618, width: 330, opacity: 0.8}}>
        <div style={{border: `2px solid ${theme.slotDeep}`, borderRadius: 12, background: `${theme.panel}C0`, padding: '16px 20px'}}>
          <svg width={120} height={44} viewBox="0 0 124 56">
            <g stroke={theme.slot} strokeWidth={2.2} fill="none">
              <line x1={8} y1={46} x2={116} y2={46} />
              <line x1={24} y1={46} x2={24} y2={32} />
              <path d="M24 32 Q42 10 60 30" />
              <rect x={72} y={32} width={36} height={14} rx={2} />
            </g>
            <circle cx={62} cy={32} r={3.4} fill={theme.slot} />
          </svg>
          <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.slot, marginTop: 8}}>{'判读员工位'}</div>
        </div>
      </div>
    </div>
  );
};

/** p6-42 旧路整链点亮后整体降光（环形收束），p6-44 金句卡进场时释放。 */
const RingDim: React.FC<{at42: number; d42: number; a44: number}> = ({at42, d42, a44}) => {
  const frame = useCurrentFrame();
  const ramp = smooth(win(progress(frame, at42, d42), [0.55, 1]));
  const rel = progress(frame, a44, 12);
  return <AbsoluteFill style={{background: '#000', opacity: 0.85 * ramp * (1 - rel), pointerEvents: 'none'}} />;
};

/** p6-45 方法卡：先问一句「谁量的？」＋三枚角标徽章最终定格（与 0-C 图例首尾闭环）。 */
const MethodCard: React.FC = () => {
  const eS = useSpring('settle', {at: 2, dur: DUR.f5});
  const eO = useProgress(2, DUR.f4);
  const badges: {kind: BadgeKind; label: string; at: number}[] = [
    {kind: 'official', label: '官方自报', at: 10},
    {kind: 'field', label: '外测 · 第三方实测', at: 17},
    {kind: 'ours', label: '复算', at: 24},
  ];
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44, opacity: eO, transform: `translateY(${(1 - eS) * 20}px)`}}>
      <div style={{fontFamily: theme.sans, fontSize: 48, fontWeight: 600, color: theme.text}}>{'先问一句：谁量的？'}</div>
      <div style={{display: 'flex', gap: 48}}>
        {badges.map((b) => (
          <BadgeMark key={b.kind} kind={b.kind} label={b.label} at={b.at} size="md" />
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** p6-46 封卡：系列名＋下期位（读 series-layers.json，next=null → 下期空槽）。 */
const EndCard: React.FC = () => {
  const e = useProgress(0, DUR.f5);
  const active = seriesLayers.activeIndex;
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, opacity: e}}>
      <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 6}}>{'AGENT INFRA'}</div>
      <div style={{fontFamily: theme.serif, fontSize: 52, color: theme.text}}>{'Agent 基础设施'}</div>
      <div style={{display: 'flex', gap: 18, alignItems: 'center'}}>
        {seriesLayers.layers.map((l) => (
          <div
            key={l.index}
            style={{
              padding: '10px 24px',
              borderRadius: 10,
              border: `2px solid ${l.index === active ? theme.slot : theme.panelBorder}`,
              color: l.index === active ? theme.slot : theme.dim,
              fontFamily: theme.sans,
              fontSize: 24,
            }}
          >
            {l.index === active ? `${l.layer} · 本集` : l.layer}
          </div>
        ))}
        <div
          style={{
            padding: '10px 24px',
            borderRadius: 10,
            border: `2px dashed ${theme.panelBorder}`,
            color: theme.dim,
            fontFamily: theme.sans,
            fontSize: 24,
          }}
        >
          {'下期'}
        </div>
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginTop: 16}}>{'下期见'}</div>
    </AbsoluteFill>
  );
};

/** 红线四：全片尾幕渐黑。挂在本幕末 beat（6-H）Sequence 内部——局部帧 0 = 末 beat 起点，
 *  淡出窗口由 6-H 总时长反推（1.2s＝useFadeOut 缺省 token；勿用末句时长）。 */
const TailFade: React.FC<{durationInFrames: number}> = ({durationInFrames}) => {
  const keep = useFadeOut(durationInFrames);
  return <AbsoluteFill style={{background: '#000', opacity: 1 - keep, pointerEvents: 'none'}} />;
};

// ─────────────────────────────── 幄主组件：8 镜 ───────────────────────────────

export const P6Ledger: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const s = (id: string) => {
    const hit = scene.sentences.find((x) => x.id === id);
    if (!hit) throw new Error(`P6Ledger: 句 ${id} 不在本幕（对照 storyboard 句区间）`);
    return hit;
  };
  const at = (id: string) => s(id).from - scene.from;
  const dur = (id: string) => s(id).durationInFrames;

  const bA = w('p6-01', 'p6-04');
  const bB = w('p6-05', 'p6-10');
  const bC = w('p6-11', 'p6-16');
  const bD = w('p6-19', 'p6-23');
  const bE = w('p6-24', 'p6-31');
  const bF = w('p6-32', 'p6-36');
  const bG = w('p6-37', 'p6-41');
  const bH = w('p6-42', 'p6-46');

  return (
    <AbsoluteFill>
      {/* 6-A 机制四开闸：四实例背靠背 archify 独占接力（首条跨幕接缝 lead=false） */}
      <Sequence {...bA} name="6-A 机制四开闸">
        <SceneTag chapter="P6" tagline="三道闸与账本" accent={theme.gate} />
        {/* cue 1/21：ls-mech（机制地图重放、m4 高亮；「m4 放大」以画框缓推近似） */}
        <PushZoom zoomFrames={Math.round(dur('p6-01') * 0.8)}>
          <ArchifyRecap
            slug="lesions-to-specs"
            caption="四个机制"
            lead={false}
            cues={[{chapterId: 'ls-mech', at: at('p6-01') - bA.from, durationInFrames: dur('p6-01')}]}
          />
        </PushZoom>
        <Sequence {...w('p6-01')} name="6-A 机制四角标">
          <Pin
            accent={theme.slot}
            keyword={'机制四'}
            sub={
              <>
                <span style={{fontFamily: theme.mono, fontSize: 20}}>{'m4'}</span>
                <span>{'预案 · 三道闸'}</span>
              </>
            }
          />
        </Sequence>
        {/* cue 2/21：tc-demand（demand/rules/anchor/plan 四需求节点亮，录制件内） */}
        <ArchifyRecap
          slug="three-city-architectures"
          caption="同一批需求"
          lead={false}
          cues={[{chapterId: 'tc-demand', at: at('p6-02') - bA.from, durationInFrames: dur('p6-02')}]}
        />
        {/* cue 3/21：td-consume（answers→gate-branch 亮＋「流程归代码」关键词钉图角） */}
        <ArchifyRecap
          slug="two-deliveries"
          caption="代码消费"
          lead={false}
          cues={[{chapterId: 'td-consume', at: at('p6-03') - bA.from, durationInFrames: dur('p6-03')}]}
        />
        <Sequence {...w('p6-03')} name="6-A 流程归代码角标">
          <Pin at={6} accent={theme.gate} keyword={'流程归代码'} sub={<BadgeMark kind="official" label={'官方文档原话'} at={8} />} />
        </Sequence>
        {/* cue 4/21：tg-read（重放；judge→gate 亮＋三闸门轮廓展开） */}
        <ArchifyRecap
          slug="three-gates-routing"
          caption="判读交读数"
          lead={false}
          cues={[{chapterId: 'tg-read', at: at('p6-04') - bA.from, durationInFrames: dur('p6-04')}]}
        />
        <Sequence {...w('p6-04')} name="6-A 三闸轮廓展开">
          <GatesPreview />
        </Sequence>
      </Sequence>

      {/* 6-B 三闸高低错落：archify(05,06) → 预案墙(07) → archify(08) → 预案墙(09,10) */}
      <Sequence {...bB} name="6-B 三闸高低错落">
        <SceneTag chapter="P6" tagline="三道闸与账本" accent={theme.gate} />
        <ArchifyYield
          cues={[
            {at: at('p6-05') - bB.from, durationInFrames: dur('p6-05')},
            {at: at('p6-06') - bB.from, durationInFrames: dur('p6-06')},
            {at: at('p6-08') - bB.from, durationInFrames: dur('p6-08')},
          ]}
        >
          <GateWall a7={at('p6-07') - bB.from} d7={dur('p6-07')} a9={at('p6-09') - bB.from} d9={dur('p6-09')} a10={at('p6-10') - bB.from} />
        </ArchifyYield>
        {/* cue 5-6/21：tg-auto（绿灯放行）＋ tg-confirm（值班员复核章戳），同实例接缝 lead=false */}
        <ArchifyRecap
          slug="three-gates-routing"
          caption="三道闸分流"
          lead={false}
          cues={[
            {chapterId: 'tg-auto', at: at('p6-05') - bB.from, durationInFrames: dur('p6-05')},
            {chapterId: 'tg-confirm', at: at('p6-06') - bB.from, durationInFrames: dur('p6-06')},
          ]}
        />
        <Sequence {...w('p6-05')} name="6-B 绿灯放行">
          <Pin
            accent={theme.ok}
            keyword={
              <>
                <span style={{display: 'inline-block', width: 14, height: 14, borderRadius: 7, background: theme.ok}} />
                {'高读数 · 放行'}
              </>
            }
          />
        </Sequence>
        <Sequence {...w('p6-06')} name="6-B 复核章戳">
          <Pin accent={theme.gate} keyword={<>{<StampGlyph />}
            {'中读数 · 复核'}</>} />
        </Sequence>
        {/* cue 7/21：tg-chief（前句为 Remotion 梯 → 独立实例默认 lead） */}
        <ArchifyRecap
          slug="three-gates-routing"
          caption="首席兜底"
          cues={[{chapterId: 'tg-chief', at: at('p6-08') - bB.from, durationInFrames: dur('p6-08')}]}
        />
        <Sequence {...w('p6-08')} name="6-B 首席角标">
          <Pin
            accent={theme.gate}
            keyword={
              <>
                {<ClockGlyph />}
                <span style={{fontFamily: theme.mono}}>{'System 2'}</span>
              </>
            }
            sub={'首席 · 慢而贵'}
          />
        </Sequence>
      </Sequence>

      {/* 6-C 考场三架构：官方警告横幅常驻；archify(11) → 考场卡(13) → archify(14) → 数字卡(15,16) */}
      <Sequence {...bC} name="6-C 考场三架构">
        <SceneTag chapter="P6" tagline="三道闸与账本" accent={theme.gate} />
        <ArchifyYield
          cues={[
            {at: at('p6-11') - bC.from, durationInFrames: dur('p6-11')},
            {at: at('p6-14') - bC.from, durationInFrames: dur('p6-14')},
          ]}
        >
          <ExamCompare a13={at('p6-13') - bC.from} a15={at('p6-15') - bC.from} a16={at('p6-16') - bC.from} />
        </ArchifyYield>
        {/* cue 8-9/21：tc-agent（anchor→monitor 回路亮＋警示红脉冲）＋ tc-plan（plan→judge→chief 亮） */}
        <ArchifyRecap
          slug="three-city-architectures"
          caption="三种城市架构"
          cues={[
            {chapterId: 'tc-agent', at: at('p6-11') - bC.from, durationInFrames: dur('p6-11')},
            {chapterId: 'tc-plan', at: at('p6-14') - bC.from, durationInFrames: dur('p6-14')},
          ]}
        />
        <WarnBanner at={at('p6-11') - bC.from} />
      </Sequence>

      {/* 6-D Jevons 气泡：纯 Remotion 装置（CitySandbox） */}
      <Sequence {...bD} name="6-D Jevons 气泡">
        <SceneTag chapter="P6" tagline="三道闸与账本" accent={theme.bar} />
        <CitySandbox
          a19={at('p6-19') - bD.from}
          d19={dur('p6-19')}
          a21={at('p6-21') - bD.from}
          d21={dur('p6-21')}
          a23={at('p6-23') - bD.from}
          d23={dur('p6-23')}
        />
        {/* 问句标签（p6-19，屏幕坐标——勿埋进 top:140 的沙盘容器，会双重偏移） */}
        <Pin keyword={'判断变便宜之后？'} accent={theme.bar} />
        {/* Jevons 角标（虚线徽＋官方 FAQ 小注） */}
        <div style={{position: 'absolute', right: 64, top: 86}}>
          <BadgeMark kind="official" label={'Jevons · 官方 FAQ'} at={6} />
        </div>
      </Sequence>

      {/* 6-E 对账三口径：archify 六连＋对账台装置（p6-26）＋三数字图角钉 */}
      <Sequence {...bE} name="6-E 对账三口径">
        <SceneTag chapter="P6" tagline="三道闸与账本" accent={theme.bar} />
        <ArchifyYield
          cues={[
            {at: at('p6-24') - bE.from, durationInFrames: dur('p6-24')},
            {at: at('p6-25') - bE.from, durationInFrames: dur('p6-25')},
            {at: at('p6-27') - bE.from, durationInFrames: dur('p6-27')},
            {at: at('p6-29') - bE.from, durationInFrames: dur('p6-29')},
            {at: at('p6-30') - bE.from, durationInFrames: dur('p6-30')},
            {at: at('p6-31') - bE.from, durationInFrames: dur('p6-31')},
          ]}
        >
          <LedgerDesk a26={at('p6-26') - bE.from} />
        </ArchifyYield>
        {/* cue 10/21：er-desk（desk 节点亮、三凹槽翻起） */}
        <ArchifyRecap
          slug="evidence-reconciliation"
          caption="对账台"
          cues={[{chapterId: 'er-desk', at: at('p6-24') - bE.from, durationInFrames: dur('p6-24')}]}
        />
        {/* cue 11/21：sl-official（headline 193.6×＋偏乐观上限小注） */}
        <ArchifyRecap
          slug="speedup-ledger"
          caption="速度账本 · 官方出口"
          lead={false}
          cues={[{chapterId: 'sl-official', at: at('p6-25') - bE.from, durationInFrames: dur('p6-25')}]}
        />
        <Sequence {...w('p6-25')} name="6-E 193.6×">
          <Pin accent={theme.bar} keyword={<NumKeyword text={'193.6×'} color={theme.bar} />} sub={'偏乐观上限 · 官方首页'} />
        </Sequence>
        {/* cue 12/21：sl-setup（evals 口径设定；前句为 Remotion 对账台 → 默认 lead） */}
        <ArchifyRecap
          slug="speedup-ledger"
          caption="速度账本 · 口径设定"
          cues={[{chapterId: 'sl-setup', at: at('p6-27') - bE.from, durationInFrames: dur('p6-27')}]}
        />
        {/* cue 13-14/21：sl-recompute＋sl-verdict（p6-28 不存在、与 p6-27 相邻 → 接缝 lead=false） */}
        <ArchifyRecap
          slug="speedup-ledger"
          caption="速度账本 · 复算归并"
          lead={false}
          cues={[
            {chapterId: 'sl-recompute', at: at('p6-29') - bE.from, durationInFrames: dur('p6-29')},
            {chapterId: 'sl-verdict', at: at('p6-30') - bE.from, durationInFrames: dur('p6-30')},
          ]}
        />
        <Sequence {...w('p6-29')} name="6-E 97.8×">
          <Pin accent={theme.bar} keyword={<NumKeyword text={'97.8×'} color={theme.bar} />} sub={<BadgeMark kind="ours" label={'复算·公开数据'} at={6} />} />
        </Sequence>
        <Sequence {...w('p6-30')} name="6-E 2–6×">
          <Pin accent={theme.bar} keyword={<NumKeyword text={'2–6×'} color={theme.bar} />} sub={<BadgeMark kind="field" label={'外测'} at={6} />} />
        </Sequence>
        {/* cue 15/21：er-verdicts（三 claim 节点各挂一枚徽章亮起） */}
        <ArchifyRecap
          slug="evidence-reconciliation"
          caption="三句裁决"
          lead={false}
          cues={[{chapterId: 'er-verdicts', at: at('p6-31') - bE.from, durationInFrames: dur('p6-31')}]}
        />
        <Sequence {...w('p6-31')} name="6-E 三徽章对位">
          <VerdictBadges />
        </Sequence>
      </Sequence>

      {/* 6-F 命名之争：archify(32) → 三证词卡(33-35) → archify(36) */}
      <Sequence {...bF} name="6-F 命名之争">
        <SceneTag chapter="P6" tagline="三道闸与账本" />
        <ArchifyYield
          cues={[
            {at: at('p6-32') - bF.from, durationInFrames: dur('p6-32')},
            {at: at('p6-36') - bF.from, durationInFrames: dur('p6-36')},
          ]}
        >
          <TestimonyCards a33={at('p6-33') - bF.from} a34={at('p6-34') - bF.from} a35={at('p6-35') - bF.from} />
        </ArchifyYield>
        {/* cue 16/21：er-parties（四证人节点亮） */}
        <ArchifyRecap
          slug="evidence-reconciliation"
          caption="四方证据"
          lead={false}
          cues={[{chapterId: 'er-parties', at: at('p6-32') - bF.from, durationInFrames: dur('p6-32')}]}
        />
        {/* cue 17/21：er-open（前句为 Remotion 证词卡 → 默认 lead） */}
        <ArchifyRecap
          slug="evidence-reconciliation"
          caption="开放三问"
          cues={[{chapterId: 'er-open', at: at('p6-36') - bF.from, durationInFrames: dur('p6-36')}]}
        />
      </Sequence>

      {/* 6-G 三问收口：archify(37) → 三问卡(38,39) → archify(40,41) */}
      <Sequence {...bG} name="6-G 三问收口">
        <SceneTag chapter="P6" tagline="三道闸与账本" accent={theme.gate} />
        <ArchifyYield
          cues={[
            {at: at('p6-37') - bG.from, durationInFrames: dur('p6-37')},
            {at: at('p6-40') - bG.from, durationInFrames: dur('p6-40')},
            {at: at('p6-41') - bG.from, durationInFrames: dur('p6-41')},
          ]}
        >
          <OpenQuestions a38={at('p6-38') - bG.from} a39={at('p6-39') - bG.from} />
        </ArchifyYield>
        {/* cue 18/21：ct-fix（audit 重标节点亮＋「换分布先重标」关键词） */}
        <ArchifyRecap
          slug="calibration-territory"
          caption="对冲与重标"
          lead={false}
          cues={[{chapterId: 'ct-fix', at: at('p6-37') - bG.from, durationInFrames: dur('p6-37')}]}
        />
        <Sequence {...w('p6-37')} name="6-G 重标关键词">
          <Pin accent={theme.gate} keyword={'换分布 · 先重标'} />
        </Sequence>
        {/* cue 19/21：tr-rlcd（rlcd→judge 亮＋「0.70」落定；前句为 Remotion → 默认 lead） */}
        <ArchifyRecap
          slug="rlhf-rlvr-rlcd"
          caption="RLCD 训练路"
          cues={[{chapterId: 'tr-rlcd', at: at('p6-40') - bG.from, durationInFrames: dur('p6-40')}]}
        />
        <Sequence {...w('p6-40')} name="6-G 0.70 落定">
          <Pin
            accent={theme.bar}
            keyword={<NumKeyword text={'0.70'} color={theme.bar} />}
            sub={
              <span style={{fontFamily: theme.mono, fontSize: 18}}>{'Jev · 自动化率'}</span>
            }
          />
        </Sequence>
        {/* cue 20/21：er-open 重放（homegrown 节点亮＋区间带展开） */}
        <ArchifyRecap
          slug="evidence-reconciliation"
          caption="开放三问"
          lead={false}
          cues={[{chapterId: 'er-open', at: at('p6-41') - bG.from, durationInFrames: dur('p6-41')}]}
        />
        <Sequence {...w('p6-41')} name="6-G 0.45–0.57 区间">
          <RangePin />
        </Sequence>
      </Sequence>

      {/* 6-H 回到开头：旧路重放＋降光 → 金句卡 → 方法卡＋三徽 → 封卡 → 全片渐黑 */}
      <Sequence {...bH} name="6-H 回到开头">
        <SceneTag chapter="P6" tagline="三道闸与账本" accent={theme.slot} />
        <ArchifyYield cues={[{at: at('p6-42') - bH.from, durationInFrames: dur('p6-42')}]}>
          <RainCity />
        </ArchifyYield>
        {/* cue 21/21：td-old（旧路整链点亮后整体降光——环形收束） */}
        <ArchifyRecap
          slug="two-deliveries"
          caption="旧交付路径"
          lead={false}
          cues={[{chapterId: 'td-old', at: at('p6-42') - bH.from, durationInFrames: dur('p6-42')}]}
        />
        <RingDim at42={at('p6-42') - bH.from} d42={dur('p6-42')} a44={at('p6-44') - bH.from} />
        <Sequence {...w('p6-44')} name="6-H 金句卡">
          <QuoteCard zh={'不是更聪明的主播 · 让判断变便宜的新岗位'} />
        </Sequence>
        <Sequence {...w('p6-45')} name="6-H 方法卡">
          <MethodCard />
        </Sequence>
        <Sequence {...w('p6-46')} name="6-H 封卡">
          <EndCard />
        </Sequence>
        {/* 红线四：尾幕渐黑挂末 beat 内部组件，窗口从 bH 总时长反推（勿用末句时长） */}
        <TailFade durationInFrames={bH.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};
