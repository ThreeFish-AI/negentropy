/** P0 两种白等（p0-01..12，4 镜 4 cue）——分镜 0-A…0-D。
 *
 *  cue 清单（4）：
 *   0-B two-waiting-deaths/belt-anatomy@p0-03（dur p0-03+04+05，整镜全屏）
 *   0-C two-waiting-deaths/slow-death@p0-06（dur p0-06+07+08，整镜全屏）
 *   0-D two-waiting-deaths/manual-death@p0-09（dur p0-09+10）
 *   0-D two-waiting-deaths/one-root@p0-11（dur p0-11+12；与上章同实例背靠背换章，
 *    lead 由组件内自动抑制——不传 lead prop）
 *
 *  ★ 画框遮盖范式：本幕 4 cue 恰铺满 p0-03..12 全部句窗，无窗外可见岛，故不用
 *    ArchifyYield——工坊舞台（传送带＋师傅）全宽铺在 archify 画框（1298×730，
 *    x311..1609 / y150..880）之后的底层，靠左右缘列（各 311px）露出：左缘＝师傅
 *    站台前＋「开口」节点，右缘＝「结果」节点，「工具」节点归画框内的带视图
 *    （belt-anatomy/slow-death 章）——舞台与图例同轴同向。
 *  ★ 〔M-001〕恒定锚：BeltStrip 全宽恒位 y470（0-B..0-D 不挪不移，core 橙恒线
 *    宽）；motifs 的 BeltStrip 不吃 frame，恒速滚动由本文件叠加 useFlowDash 行进
 *    虚线补足；0-D 带停＝dim 态＋虚线撤去。师傅剪影（text 白无彩）同位恒在。
 *  ★ 0-C〔M-002 以静写闷〕：全镜零脉冲/辉光/缩放——计费数字 useProgress 线性
 *    匀速滚涨、命令卡纯淡入后静止悬挂；唯一运动是恒速带与线性计费。
 *  ★ 0-D「同框缩小并列」由 one-root 章在画框内承担（beatNodes：stall/no-push/
 *    belt-core），舞台侧以左「带停」右「历空」两缘并置呼应，p0-11 底带浮出
 *    「一个病根」四字标签（mech 蓝）收束；便签边角微卷＝本镜唯一持续动效。
 *  ★ 0-A 开篇首镜视听合力：黑场起五零件装置剪影（accent 金线稿：齿轮/管道/钟/
 *    槽/闸，零 Lottie）整体慢转＋各自匀速自旋；p0-01 句尾「换一种死法」齿轮亮红
 *    一瞬（拆机预告，P5 兑现）——全镜唯一 impulse；除角标 Harness 外零画面文字。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {BeltStrip, Footnote, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, clamp01, useFlowDash, useImpulse, useProgress, useStagger} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** archify 画框左右缘（ArchifyClip 1298×730 居中）——工坊舞台铺在其后，
 *  靠缘列露出的元素一律收在 x<311 或 x>1609（上下带：y<150 / y880..918）。 */
const FRAME = {left: 311, right: 1609} as const;

/** 工坊恒定几何：传送带全宽横贯 y470（〔M-001〕恒位，0-B..0-D 不挪不移）。 */
const BELT = {x: 0, y: 470, width: 1920} as const;

/** hex + 动态透明度（帧驱动，无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 师傅人形剪影（text 白，一律无彩——系列角色台账口径） */
const Person: React.FC<{x: number; y: number; scale?: number; opacity?: number}> = ({
  x,
  y,
  scale = 1,
  opacity = 0.9,
}) => (
  <svg
    width={120 * scale}
    height={180 * scale}
    viewBox="0 0 120 180"
    style={{position: 'absolute', left: x, top: y, opacity}}
  >
    <circle cx={60} cy={34} r={28} fill={theme.text} />
    <path d="M0 180 Q0 76 60 70 Q120 76 120 180 Z" fill={theme.text} />
  </svg>
);

/** 传送带（〔M-001〕）＋场景侧补的行进虚线：motifs 的 BeltStrip 不吃 frame，
 *  恒速滚动感由这层在带体中心（viewBox y48）叠两条 core 橙行进虚线（只画缘列
 *  内可见段、避开节点盒）；带停（0-D）＝dim 态＋虚线撤去。 */
const BeltLine: React.FC<{dim?: boolean}> = ({dim}) => {
  const dash = useFlowDash({dash: 14, gap: 26, period: 26});
  return (
    <>
      <BeltStrip x={BELT.x} y={BELT.y} width={BELT.width} dim={dim} />
      {!dim ? (
        <svg
          width={BELT.width}
          height={96}
          viewBox={`0 0 ${BELT.width} 96`}
          style={{position: 'absolute', left: BELT.x, top: BELT.y}}
        >
          <line
            x1={112}
            y1={48}
            x2={FRAME.left - 7}
            y2={48}
            stroke={theme.core}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.7}
            {...dash}
          />
          <line
            x1={FRAME.right + 7}
            y1={48}
            x2={1804}
            y2={48}
            stroke={theme.core}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.7}
            {...dash}
          />
        </svg>
      ) : null}
    </>
  );
};

/** 工坊底台（0-B..0-D 恒位恒构）：全宽传送带＋师傅剪影站台前（左缘列）。
 *  dim＝带停（0-D）；fadeInAt＝0-B 黑场渐显锚（其余镜传 -999 直通）。 */
const WorkshopBase: React.FC<{dim?: boolean; fadeInAt?: number}> = ({dim, fadeInAt = -999}) => {
  const o = useProgress(fadeInAt, DUR.f6);
  return (
    <AbsoluteFill style={{opacity: o}}>
      <BeltLine dim={dim} />
      <Person x={118} y={357} scale={0.85} opacity={dim ? 0.62 : 0.9} />
    </AbsoluteFill>
  );
};

// ── 0-A 五零件装置剪影（accent 金线稿，零 Lottie） ─────────────────────

/** 零件线稿统一口径（accent 金简笔；亮红拷贝只换 stroke 色） */
const PART_LINE = {strokeWidth: 4, fill: 'none', strokeLinecap: 'round' as const};

/** 齿轮：外圈＋八齿＋轴孔；匀速自旋 24°/s。 */
const Gear: React.FC<{frame: number; stroke: string}> = ({frame, stroke}) => (
  <g transform={`rotate(${frame * 0.8})`}>
    <circle r={32} stroke={stroke} {...PART_LINE} />
    {Array.from({length: 8}, (_, i) => {
      const a = (i * Math.PI) / 4;
      return (
        <line
          key={i}
          x1={Math.cos(a) * 32}
          y1={Math.sin(a) * 32}
          x2={Math.cos(a) * 43}
          y2={Math.sin(a) * 43}
          stroke={stroke}
          {...PART_LINE}
        />
      );
    })}
    <circle r={13} stroke={stroke} strokeWidth={3} fill="none" />
  </g>
);

/** 管道：矩管＋双法兰＋行进虚线流（匀速；流相由 useFlowDash 自取当前帧）。 */
const Duct: React.FC<{frame: number; stroke: string}> = ({stroke}) => {
  const dash = useFlowDash({dash: 9, gap: 15, period: 18});
  return (
    <g>
      <rect x={-46} y={-15} width={92} height={30} rx={5} stroke={stroke} {...PART_LINE} />
      <line x1={-30} y1={-19} x2={-30} y2={19} stroke={stroke} strokeWidth={3} />
      <line x1={30} y1={-19} x2={30} y2={19} stroke={stroke} strokeWidth={3} />
      <line
        x1={-38}
        y1={0}
        x2={38}
        y2={0}
        stroke={stroke}
        strokeWidth={3}
        opacity={0.8}
        {...dash}
      />
    </g>
  );
};

/** 钟：圆面＋十二刻度＋分针；针匀速 36°/s（运转平稳的时机隐喻）。 */
const Clockface: React.FC<{frame: number; stroke: string}> = ({frame, stroke}) => (
  <g>
    <circle r={34} stroke={stroke} {...PART_LINE} />
    {Array.from({length: 12}, (_, i) => {
      const a = (i * Math.PI) / 6;
      return (
        <line
          key={i}
          x1={Math.cos(a) * 27}
          y1={Math.sin(a) * 27}
          x2={Math.cos(a) * 32}
          y2={Math.sin(a) * 32}
          stroke={stroke}
          strokeWidth={2.5}
        />
      );
    })}
    <line
      y1={0}
      y2={-24}
      stroke={stroke}
      strokeWidth={3.5}
      strokeLinecap="round"
      transform={`rotate(${frame * 1.2})`}
    />
    <circle r={3.5} fill={stroke} stroke="none" />
  </g>
);

/** 槽：U 形溜槽＋槽内小球缓慢往返（非强调）。 */
const Trough: React.FC<{frame: number; stroke: string}> = ({frame, stroke}) => (
  <g>
    <path
      d="M-40 -26 L-40 14 Q-40 32 -22 32 L22 32 Q40 32 40 14 L40 -26"
      stroke={stroke}
      {...PART_LINE}
    />
    <circle cx={Math.sin(frame / 42) * 20} cy={16} r={7} stroke={stroke} strokeWidth={3} fill="none" />
  </g>
);

/** 闸：闸框＋斜闸板＋顶杆；顶杆绕轴微摆 ±8°（匀速正弦，非强调）。 */
const Gate: React.FC<{frame: number; stroke: string}> = ({frame, stroke}) => (
  <g>
    <rect x={-36} y={-24} width={72} height={48} rx={5} stroke={stroke} {...PART_LINE} />
    <line x1={-36} y1={24} x2={36} y2={-24} stroke={stroke} strokeWidth={3.5} />
    <line x1={-36} y1={-24} x2={36} y2={24} stroke={stroke} strokeWidth={3.5} opacity={0.4} />
    <g transform={`rotate(${Math.sin(frame / 34) * 8})`}>
      <line x1={0} y1={-24} x2={0} y2={-46} stroke={stroke} strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={0} cy={-46} r={4.5} fill={stroke} stroke="none" />
    </g>
  </g>
);

type PartKind = 'gear' | 'duct' | 'clock' | 'trough' | 'gate';
const PART_KINDS: readonly PartKind[] = ['gear', 'duct', 'clock', 'trough', 'gate'];

const PartGlyph: React.FC<{frame: number; kind: PartKind; stroke: string}> = ({
  frame,
  kind,
  stroke,
}) =>
  kind === 'gear' ? (
    <Gear frame={frame} stroke={stroke} />
  ) : kind === 'duct' ? (
    <Duct frame={frame} stroke={stroke} />
  ) : kind === 'clock' ? (
    <Clockface frame={frame} stroke={stroke} />
  ) : kind === 'trough' ? (
    <Trough frame={frame} stroke={stroke} />
  ) : (
    <Gate frame={frame} stroke={stroke} />
  );

/** 五零件环布＋轮毂辐条（R=250，整体慢转 3°/s）；五零件错峰显形（黑场起）。
 *  p0-01 句尾「换一种死法」齿轮叠 danger 红拷贝一瞬（拆机预告，不真拆）。 */
const RING_R = 250;

const Machine: React.FC<{flashAt: number}> = ({flashAt}) => {
  const frame = useCurrentFrame();
  const spin = frame * 0.1; // 整体慢转 3°/s
  const hubIn = useProgress(2, DUR.f5);
  const ins = useStagger(PART_KINDS.length, {at: 8, stride: 7, dur: DUR.f5});
  const flash = useImpulse({at: flashAt, dur: DUR.f5, peak: 1});

  return (
    <svg
      width={740}
      height={740}
      viewBox="-370 -370 740 740"
      style={{position: 'absolute', left: 960 - 370, top: 540 - 370}}
    >
      {/* 轮毂＋辐条（accent 金） */}
      <g opacity={hubIn}>
        <circle r={42} stroke={theme.accent} {...PART_LINE} />
        <circle r={16} stroke={theme.accent} strokeWidth={3} fill="none" />
        {PART_KINDS.map((_, i) => {
          const a = ((-90 + i * 72) * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={Math.cos(a) * 46}
              y1={Math.sin(a) * 46}
              x2={Math.cos(a) * (RING_R - 62)}
              y2={Math.sin(a) * (RING_R - 62)}
              stroke={withAlpha(theme.accent, 0.5)}
              strokeWidth={2.5}
            />
          );
        })}
      </g>
      {/* 五零件：随环慢转＋各自匀速自运动；齿轮叠 danger 红拷贝一瞬（唯一 impulse） */}
      <g transform={`rotate(${spin})`}>
        {PART_KINDS.map((kind, i) => {
          const a = ((-90 + i * 72) * Math.PI) / 180;
          const on = ins[i];
          return (
            <g
              key={kind}
              transform={`translate(${Math.cos(a) * RING_R} ${Math.sin(a) * RING_R}) scale(${
                0.92 + 0.08 * on
              })`}
              opacity={on}
            >
              <PartGlyph frame={frame} kind={kind} stroke={withAlpha(theme.accent, 0.92)} />
              {kind === 'gear' && flash > 0 ? (
                <g style={{filter: `drop-shadow(0 0 ${14 * flash}px ${withAlpha(theme.danger, 0.85)})`}}>
                  <PartGlyph frame={frame} kind="gear" stroke={withAlpha(theme.danger, flash)} />
                </g>
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
};

// ── 0-B 工坊回归（系列锚：通宵工坊） ───────────────────────────────────

/** 「通宵工坊」场名牌（左缘列小标签＋月牙 glyph——场景回归的锚句，只此一处） */
const NightTag: React.FC = () => {
  const o = useProgress(DUR.f6, DUR.f5);
  return (
    <div style={{position: 'absolute', left: 64, top: 238, display: 'flex', alignItems: 'center', gap: 10, opacity: o}}>
      <svg width={26} height={26} viewBox="0 0 26 26">
        <path
          d="M19 4 A10.5 10.5 0 1 0 22 16 A8.5 8.5 0 0 1 19 4 Z"
          fill="none"
          stroke={theme.dim}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      </svg>
      <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, letterSpacing: 2}}>
        {'通宵工坊'}
      </span>
    </div>
  );
};

// ── 0-C 慢活堵路（〔M-002 以静写闷〕） ─────────────────────────────────

/** 计费终值：抽象烧钱额（匀速滚涨，语义来自 p0-08「按字数计费」） */
const COST_FINAL = 8.8;

/** 慢活堵路：命令卡（装深度学习框架 · 十分钟）吊线静止悬挂带下（左缘列）＋
 *  计费条（accent 金）匀速滚涨（右缘列）。全镜零脉冲/辉光/缩放——唯一运动是
 *  恒速传送带与线性计费（〔M-002〕）。 */
const SlowWaitStage: React.FC<{span: number; cardAt: number}> = ({span, cardAt}) => {
  const cardIn = useProgress(cardAt, DUR.f5);
  // 计费：全镜线性匀速（useProgress linear——本镜唯一推进量）
  const burn = useProgress(2, Math.max(3, span - 2), 'linear');
  return (
    <>
      {/* 吊线：带体底（y+56）到命令卡顶 */}
      <svg
        width={FRAME.left}
        height={40}
        viewBox={`0 0 ${FRAME.left} 40`}
        style={{position: 'absolute', left: 0, top: BELT.y + 56}}
      >
        <line x1={150} y1={0} x2={150} y2={36} stroke={withAlpha(theme.core, 0.7)} strokeWidth={2.5} opacity={cardIn} />
      </svg>
      {/* 命令卡：静止悬挂（纯淡入，无位移——M-002） */}
      <div style={{position: 'absolute', left: 44, top: BELT.y + 92, opacity: cardIn}}>
        <Panel accent={theme.coreDeep} style={{width: 212, boxSizing: 'border-box', padding: '12px 16px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>
            {'装深度学习框架'}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.accent, marginTop: 4}}>{'十分钟'}</div>
        </Panel>
      </div>
      {/* 计费条：数字匀速滚涨＋细条线性生长（accent 金＝计费语义） */}
      <div style={{position: 'absolute', left: FRAME.right + 39, top: BELT.y + 92}}>
        <Panel accent={theme.accent} style={{width: 228, boxSizing: 'border-box', padding: '12px 16px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'计费 · 按字数'}</div>
          <div
            style={{
              fontFamily: theme.mono,
              fontSize: 34,
              color: theme.accent,
              marginTop: 2,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {'¥ ' + (burn * COST_FINAL).toFixed(2)}
          </div>
          <div
            style={{
              width: 196,
              height: 6,
              borderRadius: 3,
              background: withAlpha(theme.accent, 0.18),
              marginTop: 8,
              overflow: 'hidden',
            }}
          >
            <div style={{width: `${burn * 100}%`, height: '100%', background: theme.accent}} />
          </div>
        </Panel>
      </div>
    </>
  );
};

// ── 0-D 到点没人推 ──────────────────────────────────────────────────────

/** 挂历墙＋便签＋钟（右缘列，mech 蓝＝时机层机制族）：历格空亮无翻动；「每天
 *  九点跑测试」便签边角微卷（本镜唯一持续动效）；墙上钟九点针位静止——师傅在
 *  左缘背对它（到点也没人看）。p0-11 起底带浮出「一个病根」标签（mech 蓝）。 */
const NoPushStage: React.FC<{wallAt: number; noteAt: number; rootAt: number}> = ({
  wallAt,
  noteAt,
  rootAt,
}) => {
  const frame = useCurrentFrame();
  const wallIn = useProgress(wallAt, DUR.f5);
  const noteIn = useProgress(noteAt, DUR.f5);
  const rootIn = useProgress(rootAt, DUR.f4);
  // 便签边角微卷：±8% 慢正弦（非强调、不停驻）
  const curl = 1 + Math.sin(frame / 52) * 0.08;

  return (
    <>
      {/* 墙上的钟（九点针位·静止）＋挂历（轨＋环＋空亮历格，无翻动） */}
      <svg
        width={300}
        height={430}
        viewBox="0 0 300 430"
        style={{position: 'absolute', left: 1620, top: 88, opacity: wallIn}}
      >
        <circle cx={150} cy={34} r={30} fill="none" stroke={theme.mech} strokeWidth={3.5} />
        <line x1={150} y1={34} x2={150} y2={12} stroke={theme.mech} strokeWidth={3} strokeLinecap="round" />
        <line x1={150} y1={34} x2={130} y2={34} stroke={theme.mech} strokeWidth={3} strokeLinecap="round" />
        <circle cx={150} cy={34} r={3} fill={theme.mech} stroke="none" />
        <rect x={30} y={84} width={240} height={236} rx={8} fill={theme.panel} stroke={theme.mechDeep} strokeWidth={2.5} />
        <rect x={30} y={84} width={240} height={14} rx={7} fill={withAlpha(theme.mech, 0.22)} />
        <circle cx={90} cy={84} r={5} fill="none" stroke={theme.mech} strokeWidth={2.5} />
        <circle cx={210} cy={84} r={5} fill="none" stroke={theme.mech} strokeWidth={2.5} />
        {Array.from({length: 20}, (_, k) => (
          <rect
            key={k}
            x={42 + (k % 4) * 56}
            y={106 + Math.floor(k / 4) * 42}
            width={48}
            height={38}
            rx={4}
            fill={withAlpha(theme.mech, 0.07)}
            stroke={withAlpha(theme.mechDeep, 0.5)}
            strokeWidth={1.5}
          />
        ))}
      </svg>
      {/* 「每天九点跑测试」便签：贴历墙下沿，边角微卷（唯一动效） */}
      <div style={{position: 'absolute', left: 1646, top: 424, opacity: noteIn, transform: 'rotate(-2deg)'}}>
        <div
          style={{
            position: 'relative',
            width: 212,
            boxSizing: 'border-box',
            padding: '12px 16px',
            borderRadius: 6,
            background: withAlpha(theme.accent, 0.16),
            border: `2px solid ${withAlpha(theme.accent, 0.55)}`,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap'}}>
            {'每天九点跑测试'}
          </div>
          <svg width={30} height={30} viewBox="0 0 30 30" style={{position: 'absolute', right: -2, bottom: -2}}>
            <g transform={`translate(30 30) scale(${curl}) translate(-30 -30)`}>
              <path d="M30 4 Q16 10 4 30 L30 30 Z" fill={withAlpha(theme.accent, 0.42)} />
            </g>
          </svg>
        </div>
      </div>
      {/* 「一个病根」（p0-11 浮出，mech 蓝）——左带停/右历空的并列收束命名 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 876,
          width: 1920,
          textAlign: 'center',
          opacity: rootIn,
          transform: `translateY(${(1 - rootIn) * 10}px)`,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            padding: '2px 16px',
            borderRadius: 10,
            border: `2px solid ${withAlpha(theme.mech, 0.55)}`,
            background: withAlpha(theme.mech, 0.12),
            fontFamily: theme.sans,
            fontSize: 28,
            fontWeight: 700,
            color: theme.mech,
            letterSpacing: 6,
          }}
        >
          {'一个病根'}
        </span>
      </div>
    </>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P0TwoWaits: React.FC<{scene: SceneRange}> = ({scene}) => {
  const {sentences, from: sceneFrom} = scene;
  const w = (id: string, toId?: string) => beatWindow(sentences, sceneFrom, id, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p0-01', 'p0-02');
  const bB = w('p0-03', 'p0-05');
  const bC = w('p0-06', 'p0-08');
  const bD = w('p0-09', 'p0-12');

  // p0-01 句尾词「换一种死法」：句窗含尾距 ~10 帧（sentenceGapSec 0.32s@30fps），
  // 亮红脉冲锚在词尾（impulse 12 帧，居中覆盖句尾词）
  const deathWordAt = at('p0-01') + dur('p0-01') - 11;
  // p0-02 句尾词「行话叫 Harness」：角标同拍浮现
  const harnessAt = at('p0-02') + Math.round(dur('p0-02') * 0.72);

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <Sequence {...bA} name="0-A 视听合力开场">
        {/* 开篇首镜：黑场起装置剪影，除角标外零画面文字（禁静态文字卡） */}
        <Machine flashAt={deathWordAt - bA.from} />
        <Footnote delay={harnessAt - bA.from}>{'Harness'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="0-B 工坊回归">
        <SceneTag chapter="P0" tagline="两种白等" accent={theme.core} />
        {/* 黑场渐显（场景请回来）；舞台铺画框之后，缘列露出（见文件头★） */}
        <WorkshopBase fadeInAt={0} />
        <NightTag />
        {/* cue 1/4：belt-anatomy（整镜全屏；带解剖归画框，舞台带同轴同向） */}
        <ArchifyRecap
          slug="two-waiting-deaths"
          caption="两种白等"
          cues={[{chapterId: 'belt-anatomy', at: at('p0-03') - bB.from, durationInFrames: dur('p0-03') + dur('p0-04') + dur('p0-05')}]}
        />
      </Sequence>

      <Sequence {...bC} name="0-C 慢活堵路">
        <SceneTag chapter="P0" tagline="两种白等" accent={theme.core} />
        <WorkshopBase />
        <SlowWaitStage span={bC.durationInFrames} cardAt={at('p0-06') - bC.from + 4} />
        <Footnote delay={at('p0-07') - bC.from}>{'pip install torch · npm run build'}</Footnote>
        {/* cue 2/4：slow-death（整镜全屏；慢活堵路归画框，计费在缘列陪跑） */}
        <ArchifyRecap
          slug="two-waiting-deaths"
          caption="两种白等"
          cues={[{chapterId: 'slow-death', at: at('p0-06') - bC.from, durationInFrames: dur('p0-06') + dur('p0-07') + dur('p0-08')}]}
        />
      </Sequence>

      <Sequence {...bD} name="0-D 到点没人推">
        <SceneTag chapter="P0" tagline="两种白等" accent={theme.core} />
        {/* 带停＝dim＋虚线撤去；「同框缩小并列」由 one-root 章承担（见文件头★） */}
        <WorkshopBase dim />
        <NoPushStage
          wallAt={at('p0-09') - bD.from + 2}
          noteAt={at('p0-10') - bD.from}
          rootAt={at('p0-11') - bD.from}
        />
        {/* cue 3+4/4：manual-death → one-root（同实例相邻换章，lead 组件内自动抑制） */}
        <ArchifyRecap
          slug="two-waiting-deaths"
          caption="两种白等"
          cues={[
            {chapterId: 'manual-death', at: at('p0-09') - bD.from, durationInFrames: dur('p0-09') + dur('p0-10')},
            {chapterId: 'one-root', at: at('p0-11') - bD.from, durationInFrames: dur('p0-11') + dur('p0-12')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0TwoWaits;
