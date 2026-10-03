/** P1 病根与两条规格（p1-01..16，4 镜 4 cue）——分镜 1-A…1-D。
 *
 * cue 清单（覆盖门对账）：
 *  - 1-B spec-two-promises#spec-one    @p1-07（dur('p1-07')）
 *  - 1-B spec-two-promises#spec-two    @p1-08（dur('p1-08')）——同实例相邻换章，组件自动抑制入场
 *  - 1-C spec-two-promises#two-devices @p1-09（dur('p1-09')+dur('p1-10')+dur('p1-11')，跨句求和）
 *  - 1-C spec-two-promises#map-back    @p1-12（dur('p1-12')+dur('p1-13')，跨句求和）——
 *    与 1-B 末章跨镜界背靠背（p1-08 句窗含句隙，末帧恰接 p1-09 首帧）⇒ 实例 lead={false}。
 *
 * ★ 设计要点：
 *  - 自制件与 archify 全屏窗（311..1609 × 150..880）的共存方式＝「窗前亮景」：
 *    全部布置在窗外几何带（左右列 / 上带 y 56..150 / 下带 880..920），画框核心区
 *    永远留给 archify——forbid_inset 全屏独占契约不破。1-B 石碑 cue 前居中升起
 *    （碑入场段＝cue at 前 2 句），cue at 时退避两翼并立窗侧；1-C 全片地图的
 *    长驻坐标（左列 mini 传送带＋全宽轨迹线、右缘清洗槽、上缘定时钟）同理。
 *  - 空间分轨契约（storyboard 视觉契约）：后台线走右缘纵深（轨迹线肘形下入槽口）、
 *    定时线走上缘横陈（虚线墙轨）——两线分带不叠压。
 *  - 1-A 双泳道俯视图纯 native svg：快命令两循环（帧驱动三角波，无随机）→ 慢命令
 *    在「答」半格冻结（danger 卡死＋useShake）→ BeltStrip dim 停摆；行进虚线随
 *    卡死同帧冻结（「等变堵」的机械读法）。
 *  - 1-D 推镜 usePushIn（transformOrigin 钉在槽口）；小票步进＝线性进度 6 级量化。
 *  - 身份条口径：本集顶带 y<56 归 Main 挂的 frozen ChapterProgress；seeded SceneTag
 *    居左上 top:64，故不叠 HarnessBadge（其左上锚位会与 SceneTag 相撞——memory/
 *    multiagent 两集是各自右移了 motifs 的 SceneTag 让位，本集未走该分支）。
 *  - 色只走 theme.*（BeltStrip 内部 core 橙＝M-001 恒定锚）；画面文字只放关键词；零 Lottie。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {BeltStrip, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, clamp01, useBreathe, useEnter, useImpulse, useProgress, usePushIn, useShake, useStagger} from '../motion';

/** hex + 动态透明度（帧驱动；无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 1-A 病根解剖：一问一答俯视双泳道 ────────────────────────────────────

/** 问/答两泳道几何：活动卡以中心点行走（问 L→R，答 R→L） */
const TRACK_L = 368;
const TRACK_R = 1552;
const LANE_ASK_Y = 316; // 「问」泳道活动卡顶边
const LANE_ANS_Y = 574; // 「答」泳道活动卡顶边（与槽格同带）
/** 一轮问答的节奏（帧）：节奏常数非事件锚——事件锚一律句边界派生 */
const LAP_FRAMES = 54;

/** 三段回合定位：t 上半程走「问」、下半程走「答」；f 冻结在 jamFrame ⇒ 慢命令
 *  停在「答」半格（t=0.75 ⇔ x=泳道中点）。t≥1（递回完毕）返回 null——
 *  泳道清空待下一轮，消除跨轮一帧瞬移。纯函数、无 hook。 */
const lapPos = (f: number, stops: readonly number[], jamFrame: number) => {
  const fj = Math.min(f, jamFrame);
  let lap = -1;
  let t = 0;
  for (let i = 0; i < stops.length; i++) {
    if (fj >= stops[i]) {
      lap = i;
      t = Math.min(1, (fj - stops[i]) / LAP_FRAMES);
    }
  }
  if (lap < 0 || t >= 1) {
    return null;
  }
  const half = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  return t < 0.5
    ? {x: TRACK_L + half * (TRACK_R - TRACK_L), y: LANE_ASK_Y, slow: lap === 2}
    : {x: TRACK_R - half * (TRACK_R - TRACK_L), y: LANE_ANS_Y, slow: lap === 2};
};

const RootAnatomy: React.FC<{
  laps: readonly number[];
  jamFrame: number;
  beltStopAt: number;
  atRoot: number;
}> = ({laps, jamFrame, beltStopAt, atRoot}) => {
  const frame = useCurrentFrame();
  const lanesIn = useEnter('fade', {at: 2, dur: DUR.f5});
  const capIn = useProgress(6, DUR.f4);
  const capOut = useProgress(atRoot, DUR.f4);
  const root = useEnter('rise', {at: atRoot, dur: DUR.f5, dist: 24});
  const jam = useProgress(jamFrame, DUR.f3);
  const stopIn = useProgress(beltStopAt, DUR.f4);
  const stuck = useShake({at: jamFrame, amp: 2.6, freq: 1.7, decay: true, dur: DUR.f6});

  const pos = lapPos(frame, laps, jamFrame);
  const jammed = frame > jamFrame;
  // 行进虚线随卡死同帧冻结（fj 与 lapPos 同源）
  const flowF = Math.min(frame, jamFrame);
  const flow = {strokeDasharray: '10 12', strokeDashoffset: -(flowF * 22) / 30};

  const tile = pos ? (
    <g style={{transform: `translate(${pos.x - 48}px, ${pos.y}px) translateX(${stuck}px)`}}>
      <rect
        x={0}
        y={0}
        width={96}
        height={56}
        rx={8}
        fill={jammed ? withAlpha(theme.danger, 0.16) : theme.panel}
        stroke={jammed ? theme.deny : pos.slow ? theme.text : theme.panelBorder}
        strokeWidth={2.5}
      />
      {pos.slow ? (
        <text
          x={48}
          y={35}
          textAnchor="middle"
          fontSize={22}
          fontFamily={theme.sans}
          fill={jammed ? theme.deny : theme.text}
        >
          {'慢命令'}
        </text>
      ) : null}
    </g>
  ) : null;

  return (
    <AbsoluteFill>
      <SceneTag chapter="病根解剖" tagline="等变堵" />

      {/* 泳道 + 槽格 + 活动卡（俯视图主体） */}
      <AbsoluteFill style={{opacity: lanesIn.opacity}}>
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
          {/* 回环连接件：两条纵虚线行进（卡死后冻结） */}
          <path d="M320 372 L320 602" fill="none" stroke={theme.dim} strokeWidth={2.5} opacity={0.7} {...flow} />
          <path d="M1600 372 L1600 602" fill="none" stroke={theme.dim} strokeWidth={2.5} opacity={0.7} {...flow} />
          {/* 泳道轨 */}
          <line x1={320} y1={372} x2={1600} y2={372} stroke={theme.panelBorder} strokeWidth={3} />
          <line x1={320} y1={602} x2={1600} y2={602} stroke={theme.panelBorder} strokeWidth={3} />
          {/* 「答」侧三处理格；中格＝慢命令卡死的半格 */}
          {[480, 800, 1120].map((x) => (
            <rect key={x} x={x} y={570} width={320} height={64} rx={8} fill="none" stroke={theme.panelBorder} strokeWidth={2} />
          ))}
          <rect
            x={800}
            y={570}
            width={320}
            height={64}
            rx={8}
            fill={withAlpha(theme.danger, 0.16 * jam)}
            stroke={withAlpha(theme.deny, jam)}
            strokeWidth={3}
            style={{opacity: jam > 0 ? 1 : 0}}
          />
          {tile}
        </svg>
        {/* 泳道名 */}
        <div style={{position: 'absolute', left: 210, top: 322, width: 90, textAlign: 'right', fontFamily: theme.mono, fontSize: 30, color: theme.dim}}>
          {'问'}
        </div>
        <div style={{position: 'absolute', left: 210, top: 580, width: 90, textAlign: 'right', fontFamily: theme.mono, fontSize: 30, color: theme.dim}}>
          {'答'}
        </div>
        {/* 传送带（M-001 恒定锚）：卡死十帧后整条停摆变暗——骤停是事件不是渐变 */}
        <BeltStrip x={360} y={730} width={1200} dim={frame >= beltStopAt} />
      </AbsoluteFill>

      {/* 停摆签（随带停落下） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 840,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 22,
          color: theme.deny,
          opacity: stopIn,
        }}
      >
        {'停摆'}
      </div>

      {/* 协议小注（p1-01..03）→ 病根标签（p1-04）同位交叉淡换 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 244,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 22,
          color: theme.dim,
          opacity: capIn * (1 - capOut),
        }}
      >
        {'对话协议 · 一问一答'}
      </div>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, opacity: root.opacity, transform: root.transform}}>
        <div style={{textAlign: 'center', fontFamily: theme.sans, fontSize: 46, fontWeight: 700, color: theme.text}}>
          {'没有时间感'}
        </div>
        <div style={{textAlign: 'center', marginTop: 14}}>
          <span style={{border: `2px solid ${theme.deny}`, borderRadius: 999, padding: '4px 20px', fontFamily: theme.sans, fontSize: 27, color: theme.deny}}>
            {'等 → 堵'}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 1-B 两条规格立碑 ────────────────────────────────────────────────────

/** 地面线（窗底 y 880 同高——石碑与画框立在同一地面上） */
const GROUND_Y = 880;

/** 两碑数据：碑文四字 + 碑侧机制关键词；baseX＝居中升起位，flankX＝cue 窗两翼位 */
const STELES = [
  {inscription: '异步回来', keywords: ['先回话', '另行通知'], baseX: 700, flankX: 180, kwSide: -1},
  {inscription: '定时解耦', keywords: ['到点记账', '有空再干'], baseX: 1220, flankX: 1740, kwSide: 1},
] as const;

/** 单碑：地面升起（弹簧）→ cue 窗开时滑向两翼缩小成「窗前亮景」；落定后呼吸一次 */
const Stele: React.FC<{
  inscription: string;
  keywords: readonly string[];
  baseX: number;
  flankX: number;
  kwSide: 1 | -1;
  enterAt: number;
  repositionAt: number;
  breatheAt: number;
}> = ({inscription, keywords, baseX, flankX, kwSide, enterAt, repositionAt, breatheAt}) => {
  const rise = useEnter('rise', {at: enterAt, dur: DUR.f6, dist: 380, springPreset: 'settleSoft'});
  const re = useProgress(repositionAt, DUR.f6, 'decelerate');
  const kwIn = useProgress(enterAt + 26, DUR.f4);
  const glow = useImpulse({at: breatheAt, dur: DUR.f6, peak: 22});
  const x = baseX + (flankX - baseX) * re;
  const s = 1 - 0.38 * re; // 0.62 档：碑身收进 311px 侧列
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 115,
        top: GROUND_Y - 430,
        width: 230,
        height: 430,
        opacity: rise.opacity,
        transform: `${rise.transform} scale(${s})`,
        transformOrigin: '50% 100%',
        filter: `drop-shadow(0 0 ${glow}px ${withAlpha(theme.mech, 0.5)})`,
      }}
    >
      <svg width={230} height={430} style={{position: 'absolute', left: 0, top: 0}}>
        {/* 碑身：拱顶碑 + 内碑框 + 碑座（mech 蓝碑） */}
        <path d="M12 96 Q12 12 115 12 Q218 12 218 96 L218 404 L12 404 Z" fill={theme.panel} stroke={theme.mech} strokeWidth={4} />
        <path d="M26 106 Q26 28 115 28 Q204 28 204 106 L204 390 L26 390 Z" fill="none" stroke={theme.panelBorder} strokeWidth={2} />
        <rect x={4} y={404} width={222} height={18} fill={theme.panel} stroke={theme.mech} strokeWidth={3} />
      </svg>
      {/* 碑文：竖排四字（衬线·mech 刻字） */}
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 26}}>
        <span style={{writingMode: 'vertical-rl', fontFamily: theme.serif, fontWeight: 700, fontSize: 54, letterSpacing: 16, color: theme.mech}}>
          {inscription}
        </span>
      </div>
      {/* 碑侧小字：机制关键词两列（竖排） */}
      {keywords.map((k, i) => (
        <div key={k} style={{position: 'absolute', top: 64, left: kwSide < 0 ? -64 + i * 30 : 266 + i * 30, opacity: kwIn}}>
          <span style={{writingMode: 'vertical-rl', fontFamily: theme.sans, fontSize: 20, letterSpacing: 8, color: theme.dim}}>{k}</span>
        </div>
      ))}
    </div>
  );
};

const StelesScene: React.FC<{
  atTag: number;
  tagFlashAt: number;
  atTwo: number;
  atS1: number;
  atS2: number;
  breatheAt: number;
  repositionAt: number;
}> = ({atTag, tagFlashAt, atTwo, atS1, atS2, breatheAt, repositionAt}) => {
  const tag = useEnter('pop', {at: atTag, dur: DUR.f5});
  const flash = useImpulse({at: tagFlashAt, dur: DUR.f5});
  const two = useEnter('rise', {at: atTwo, dur: DUR.f5, dist: 26});
  // cue 窗开：中心文字让位画框（碑已退两翼，中心归 archify）
  const out = useProgress(repositionAt, DUR.f4);
  return (
    <AbsoluteFill>
      {STELES.map((s) => (
        <Stele
          key={s.inscription}
          inscription={s.inscription}
          keywords={s.keywords}
          baseX={s.baseX}
          flankX={s.flankX}
          kwSide={s.kwSide}
          enterAt={s.inscription === '异步回来' ? atS1 : atS2}
          repositionAt={repositionAt}
          breatheAt={breatheAt}
        />
      ))}
      {/* 地面掩板：后于石碑绘制——升起时从地里长出来；地面线全宽（画框也立其上） */}
      <div style={{position: 'absolute', left: 0, top: GROUND_Y, width: 1920, height: 200, background: theme.bg}} />
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <line x1={60} y1={GROUND_Y} x2={1860} y2={GROUND_Y} stroke={theme.panelBorder} strokeWidth={3} />
      </svg>
      {/* 九点没人喊（p1-05，第二种白等回声）：无人推时红闪一瞬 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 264,
          width: 1920,
          textAlign: 'center',
          opacity: tag.opacity * (1 - out),
          transform: tag.transform,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 999,
            padding: '6px 22px',
            fontFamily: theme.mono,
            fontSize: 24,
            color: theme.dim,
            boxShadow: `0 0 ${16 * flash}px ${withAlpha(theme.danger, 0.45 * flash)}`,
          }}
        >
          {'九点 · 没人喊'}
        </span>
      </div>
      {/* 两条规格（p1-06）：cue 窗开时由画框角标接管同名口径 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 352,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 42,
          fontWeight: 700,
          color: theme.text,
          opacity: two.opacity * (1 - out),
          transform: two.transform,
        }}
      >
        {'两条规格'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-C 两台装置登场：全片地图首亮（窗外几何带的长驻坐标） ──────────────

/** 地图几何：全部落在画框（311..1609 × 150..880）之外的分带 */
const MAP = {
  railY: 512, // 传送带轨迹线（横贯，中段入窗被画框遮盖＝4-D② 范式）
  beltX: 8,
  beltY: 464,
  beltW: 300,
  clock: {cx: 1214, cy: 98, r: 40},
  glints: [
    [72, 512], // mini 传送带 · 开口
    [224, 512], // mini 传送带 · 结果
    [1680, 570], // 后台线肘弯（慢活下槽）
    [1713, 662], // 清洗槽口
    [1214, 98], // 定时钟
  ] as const,
} as const;

const MapFrameScene: React.FC<{atTank: number; atClock: number; atGlints: number}> = ({atTank, atClock, atGlints}) => {
  const frame = useCurrentFrame();
  const base = useProgress(3, DUR.f5);
  const tankIn = useEnter('slideR', {at: atTank, dur: DUR.f6, dist: 300, springPreset: 'settleSoft'});
  const clockIn = useEnter('fall', {at: atClock, dur: DUR.f6, dist: 220, springPreset: 'settleSoft'});
  // 挂定后各自轻微呼吸（effects 通道：辉光呼吸，门控在落定后起振）
  const tankBreath = useBreathe({period: 46, amp: 0.4, base: 0.6});
  const clockBreath = useBreathe({period: 52, amp: 0.4, base: 0.6, offset: 13});
  const tankGate = useProgress(atTank + 30, DUR.f4);
  const clockGate = useProgress(atClock + 26, DUR.f4);
  // 五零件高亮小点闪：一扫光（错峰正弦包络，帧驱动无随机）
  const glints = useStagger(5, {at: atGlints, stride: 6, dur: DUR.f5});

  // 定时钟指针：九点起锚、匀速走针（到点自响的常态读法）。屏幕坐标 y 向下，
  // 9 点位＝180°（指左）：分针竖直指 12、时针水平指 9（与 P0 墙上钟同读数）
  const minuteA = ((-90 + frame * 0.55) * Math.PI) / 180;
  const hourA = ((180 + frame * 0.045) * Math.PI) / 180;

  return (
    <AbsoluteFill>
      {/* 轨迹线 + 两线分轨（后台线右缘肘形下槽 / 定时线上缘横陈），中段被画框遮盖 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: base}}>
        <line x1={24} y1={MAP.railY} x2={1636} y2={MAP.railY} stroke={withAlpha(theme.core, 0.38)} strokeWidth={3} />
        <circle cx={34} cy={MAP.railY} r={6} fill={withAlpha(theme.core, 0.55)} />
        <path d="M1636 512 C 1636 556, 1700 566, 1710 632" fill="none" stroke={theme.mechDeep} strokeWidth={2.5} strokeDasharray="9 11" opacity={0.8} />
        <line x1={340} y1={96} x2={1900} y2={96} stroke={withAlpha(theme.mechDeep, 0.5)} strokeWidth={2.5} strokeDasharray="10 14" />
      </svg>

      {/* 左列 mini 传送带（开口→工具→结果）：与轨迹线同带，横贯读法的西段（静态
          地图底座；恒速滚动感归 P0 工坊带的 useFlowDash 层，此处不传 frame） */}
      <div style={{opacity: base}}>
        <BeltStrip x={MAP.beltX} y={MAP.beltY} width={MAP.beltW} />
      </div>

      {/* 右缘纵深·自动清洗槽（梯形透视剪影，自右缘滑入挂定） */}
      <svg
        width={1920}
        height={1080}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: tankIn.transform,
          opacity: tankIn.opacity,
          filter: `drop-shadow(0 0 ${(tankGate * tankBreath * 14).toFixed(2)}px ${withAlpha(theme.mech, 0.4)})`,
        }}
      >
        <path d="M1642 428 L1894 458 L1894 758 L1642 792 Z" fill={theme.panel} stroke={theme.mech} strokeWidth={4} />
        <path d="M1656 444 L1880 470 L1880 744 L1656 774 Z" fill="none" stroke={theme.panelBorder} strokeWidth={2} />
        {/* 槽内水纹三泡（清洗中的静态暗示） */}
        <circle cx={1810} cy={520} r={11} fill="none" stroke={theme.mechDeep} strokeWidth={2} opacity={0.4} />
        <circle cx={1846} cy={576} r={8} fill="none" stroke={theme.mechDeep} strokeWidth={2} opacity={0.34} />
        <circle cx={1798} cy={610} r={7} fill="none" stroke={theme.mechDeep} strokeWidth={2} opacity={0.28} />
        {/* 槽口（1-D 推镜目的地）：后台线的落点 */}
        <rect x={1656} y={636} width={114} height={52} rx={10} fill={theme.bg} stroke={theme.mech} strokeWidth={3} />
        <text x={1768} y={826} textAnchor="middle" fontSize={26} fill={theme.mech} fontFamily={theme.sans}>
          {'清洗槽'}
        </text>
        <text x={1768} y={856} textAnchor="middle" fontSize={20} fill={theme.dim} fontFamily={theme.mono}>
          {'异步回来'}
        </text>
      </svg>

      {/* 上缘横陈·墙上的定时钟（圆 + 指针，自上缘落下挂定） */}
      <svg
        width={1920}
        height={1080}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: clockIn.transform,
          opacity: clockIn.opacity,
          filter: `drop-shadow(0 0 ${(clockGate * clockBreath * 14).toFixed(2)}px ${withAlpha(theme.mech, 0.4)})`,
        }}
      >
        <circle cx={MAP.clock.cx} cy={MAP.clock.cy} r={MAP.clock.r} fill={theme.panel} stroke={theme.mech} strokeWidth={4} />
        {Array.from({length: 12}, (_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          const cardinal = i % 3 === 0;
          const r0 = cardinal ? MAP.clock.r - 12 : MAP.clock.r - 8;
          const r1 = MAP.clock.r - 3;
          return (
            <line
              key={i}
              x1={MAP.clock.cx + Math.cos(a) * r0}
              y1={MAP.clock.cy + Math.sin(a) * r0}
              x2={MAP.clock.cx + Math.cos(a) * r1}
              y2={MAP.clock.cy + Math.sin(a) * r1}
              stroke={theme.panelBorder}
              strokeWidth={cardinal ? 2.5 : 1.5}
            />
          );
        })}
        <line
          x1={MAP.clock.cx}
          y1={MAP.clock.cy}
          x2={MAP.clock.cx + Math.cos(minuteA) * 26}
          y2={MAP.clock.cy + Math.sin(minuteA) * 26}
          stroke={theme.text}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <line
          x1={MAP.clock.cx}
          y1={MAP.clock.cy}
          x2={MAP.clock.cx + Math.cos(hourA) * 17}
          y2={MAP.clock.cy + Math.sin(hourA) * 17}
          stroke={theme.text}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={MAP.clock.cx} cy={MAP.clock.cy} r={3.5} fill={theme.mech} />
        <text x={1272} y={88} fontSize={24} fill={theme.mech} fontFamily={theme.sans}>
          {'定时钟'}
        </text>
        <text x={1272} y={116} fontSize={19} fill={theme.dim} fontFamily={theme.mono}>
          {'定时解耦'}
        </text>
      </svg>

      {/* 五零件高亮小点闪（accent 金扫光） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        {MAP.glints.map(([gx, gy], i) => {
          const fl = Math.sin(Math.PI * clamp01(glints[i]));
          return (
            <g key={i} style={{opacity: fl > 0.01 ? 1 : 0}}>
              <circle cx={gx} cy={gy} r={4 + 2 * fl} fill={theme.accent} opacity={fl} />
              <circle cx={gx} cy={gy} r={6 + 10 * fl} fill="none" stroke={theme.accent} strokeWidth={2} opacity={fl * 0.8} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ── 1-D 转场小票：推镜向右下槽口，步进出票定格 ──────────────────────────

/** 锯齿边收据路径：上下沿三角齿（纯函数） */
const receiptPath = (w: number, h: number, tooth = 15, depth = 7): string => {
  const top: string[] = [];
  for (let x = 0; x < w; x += tooth) top.push(`L${x + tooth / 2} 0 L${x + tooth} ${depth}`);
  const bottom: string[] = [];
  for (let x = w; x > 0; x -= tooth) bottom.push(`L${x - tooth / 2} ${h} L${x - tooth} ${h - depth}`);
  return `M0 ${depth} ${top.join(' ')} L${w} ${h - depth} ${bottom.join(' ')} Z`;
};

const PRINT_FRAMES = 54;
const PRINT_STEPS = 6;

const TankReceiptScene: React.FC<{atPrint: number; atText: number; atGlow: number}> = ({atPrint, atText, atGlow}) => {
  const zoom = usePushIn(2, {scale: 0.24, dur: 46}); // 收敛：24% 推近把槽体结构带进字幕安全带（qa WARN+目检定谳）
  const print = useProgress(atPrint, PRINT_FRAMES, 'linear');
  const textIn = useProgress(atText, DUR.f4);
  const glow = useImpulse({at: atGlow, dur: DUR.f5, peak: 16});
  const frame = useCurrentFrame();
  // 步进出票：线性进度 6 级量化（打印机的走纸节奏）
  const pq = Math.floor(clamp01(print) * PRINT_STEPS + 1e-4) / PRINT_STEPS;
  const shown = 330 * pq;

  return (
    <AbsoluteFill>
      {/* 角标是 chrome：钉在画外，不随推镜位移 */}
      <SceneTag chapter="清洗槽" tagline="一条铁规矩" accent={theme.mech} />
      <AbsoluteFill style={{transform: zoom, transformOrigin: '72.4% 63.1%'}}>
        {/* 左缘地图余韵（1-C 同构淡出）：推镜中退出画面 */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: 0.42}}>
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
          <line x1={0} y1={MAP.railY} x2={1240} y2={MAP.railY} stroke={withAlpha(theme.core, 0.3)} strokeWidth={3} />
        </svg>
        <BeltStrip x={26} y={464} width={380} />
      </div>

      {/* 清洗槽近景（梯形透视，mech 剪影） + 槽口特写位 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <path d="M1240 340 L1880 386 L1880 856 L1240 890 Z" fill={theme.panel} stroke={theme.mech} strokeWidth={5} />
        <path d="M1262 362 L1858 404 L1858 838 L1262 866 Z" fill="none" stroke={theme.panelBorder} strokeWidth={2.5} />
        {/* 槽内水纹：帧驱动起伏（无随机） */}
        <circle cx={1600} cy={470} r={11} fill="none" stroke={theme.mechDeep} strokeWidth={2} opacity={0.35} style={{transform: `translateY(${(5 * Math.sin(frame / 26)).toFixed(2)}px)`}} />
        <circle cx={1690} cy={545} r={8} fill="none" stroke={theme.mechDeep} strokeWidth={2} opacity={0.3} style={{transform: `translateY(${(5 * Math.sin(frame / 26 + 2.1)).toFixed(2)}px)`}} />
        <circle cx={1540} cy={595} r={7} fill="none" stroke={theme.mechDeep} strokeWidth={2} opacity={0.26} style={{transform: `translateY(${(5 * Math.sin(frame / 26 + 4.2)).toFixed(2)}px)`}} />
        {/* 槽口（推镜落点）：出票缝 */}
        <rect x={1300} y={640} width={180} height={84} rx={14} fill={theme.bg} stroke={theme.mech} strokeWidth={5} />
        <line x1={1312} y1={682} x2={1468} y2={682} stroke={theme.mechDeep} strokeWidth={3} />
      </svg>

      {/* 小票（accent 金·锯齿边）：自槽口步进升起，顶边先出（热敏走纸） */}
      {shown > 2 ? (
        <div
          style={{
            position: 'absolute',
            left: 1315,
            top: 700 - shown,
            width: 150,
            height: shown,
            overflow: 'hidden',
            filter: `drop-shadow(0 0 ${glow}px ${withAlpha(theme.accent, 0.5)})`,
          }}
        >
          <div style={{position: 'absolute', left: 0, top: 0, width: 150, height: 330}}>
            <svg width={150} height={330} style={{position: 'absolute', left: 0, top: 0}}>
              <path d={receiptPath(150, 330)} fill={theme.accent} />
              <line x1={22} y1={252} x2={128} y2={252} stroke={theme.bg} strokeWidth={2} strokeDasharray="6 5" opacity={0.5} />
              <line x1={22} y1={274} x2={128} y2={274} stroke={theme.bg} strokeWidth={2} strokeDasharray="6 5" opacity={0.5} />
              <line x1={22} y1={296} x2={128} y2={296} stroke={theme.bg} strokeWidth={2} strokeDasharray="6 5" opacity={0.4} />
            </svg>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 44,
                width: 150,
                textAlign: 'center',
                opacity: textIn,
              }}
            >
              <span style={{writingMode: 'vertical-rl', fontFamily: theme.sans, fontWeight: 700, fontSize: 34, letterSpacing: 10, color: theme.bg}}>
                {'一张回执'}
              </span>
            </div>
          </div>
        </div>
      ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P1RootAndSpecs: React.FC<{scene: SceneRange}> = ({scene}) => {
  const {sentences, from: sceneFrom} = scene;
  const w = (id: string, toId?: string) => beatWindow(sentences, sceneFrom, id, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p1-01', 'p1-04');
  const bB = w('p1-05', 'p1-08');
  const bC = w('p1-09', 'p1-13');
  const bD = w('p1-14', 'p1-16');

  // 1-A 事件锚（句边界派生）：两轮快问答 → 慢命令卡入 → 带停 → 病根标签
  const laps = [16, at('p1-02') - bA.from + 8, at('p1-03') - bA.from + Math.round(dur('p1-03') * 0.18)];
  const jamFrame = laps[2] + Math.round(LAP_FRAMES * 0.75);
  const beltStopAt = jamFrame + 10;
  const atRoot = at('p1-04') - bA.from + Math.round(dur('p1-04') * 0.3);

  // 1-B 碑入场段（cue at 前 2 句）：九点空等 → 两碑先后升起 → 落定呼吸 → cue 窗开退两翼
  const atTag = at('p1-05') - bB.from + Math.round(dur('p1-05') * 0.15);
  const tagFlashAt = at('p1-05') - bB.from + Math.round(dur('p1-05') * 0.62);
  const atS1 = at('p1-06') - bB.from + Math.round(dur('p1-06') * 0.18);
  const atTwo = at('p1-06') - bB.from + Math.round(dur('p1-06') * 0.4);
  const atS2 = at('p1-06') - bB.from + Math.round(dur('p1-06') * 0.55);
  const breatheAt = atS2 + 34;
  const repositionAt = at('p1-07') - bB.from;

  // 1-C 装置挂定锚：p1-10 清洗槽自右缘滑入 / p1-11 定时钟自上缘落下 / 句尾五点扫光
  const atTank = at('p1-10') - bC.from + Math.round(dur('p1-10') * 0.12);
  const atClock = at('p1-11') - bC.from + Math.round(dur('p1-11') * 0.1);
  const atGlints = at('p1-11') - bC.from + Math.round(dur('p1-11') * 0.55);

  // 1-D：推镜（p1-14）→ 出票（p1-15 后段）→ 「一张回执」亮起定格（p1-16）
  const atPrint = at('p1-15') - bD.from + Math.round(dur('p1-15') * 0.35);
  const atText = atPrint + 44;
  const atGlow = at('p1-16') - bD.from + Math.round(dur('p1-16') * 0.3);

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <Sequence {...bA} name="1-A 病根解剖（双泳道卡死）">
        <RootAnatomy laps={laps} jamFrame={jamFrame} beltStopAt={beltStopAt} atRoot={atRoot} />
      </Sequence>

      <Sequence {...bB} name="1-B 两条规格立碑">
        <SceneTag chapter="两条规格" tagline="对症的两条" accent={theme.mech} />
        {/* 碑入场段持有画面；cue 窗开时碑退两翼作窗前亮景（窗外几何带，画框不遮） */}
        <StelesScene
          atTag={atTag}
          tagFlashAt={tagFlashAt}
          atTwo={atTwo}
          atS1={atS1}
          atS2={atS2}
          breatheAt={breatheAt}
          repositionAt={repositionAt}
        />
        <ArchifyRecap
          slug="spec-two-promises"
          caption="两条规格"
          cues={[
            {chapterId: 'spec-one', at: at('p1-07') - bB.from, durationInFrames: dur('p1-07')},
            {chapterId: 'spec-two', at: at('p1-08') - bB.from, durationInFrames: dur('p1-08')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="1-C 两台装置登场（全片地图首亮）">
        <SceneTag chapter="两台装置" tagline="空间分轨" accent={theme.mech} />
        {/* 地图长驻坐标全在窗外分带；画框中段遮盖轨迹线（4-D② 范式） */}
        <MapFrameScene atTank={atTank} atClock={atClock} atGlints={atGlints} />
        {/* 与 1-B 末章跨镜界背靠背（spec-two 末帧恰接 p1-09 首帧）⇒ 关入场 */}
        <ArchifyRecap
          slug="spec-two-promises"
          caption="全片地图"
          lead={false}
          cues={[
            {chapterId: 'two-devices', at: at('p1-09') - bC.from, durationInFrames: dur('p1-09') + dur('p1-10') + dur('p1-11')},
            {chapterId: 'map-back', at: at('p1-12') - bC.from, durationInFrames: dur('p1-12') + dur('p1-13')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="1-D 转场小票">
        <TankReceiptScene atPrint={atPrint} atText={atText} atGlow={atGlow} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1RootAndSpecs;
