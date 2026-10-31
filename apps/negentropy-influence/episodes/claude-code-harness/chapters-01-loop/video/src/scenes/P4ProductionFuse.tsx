/** P4 生产版对照（p4-01..p4-08，4 镜）——分镜 storyboard.md「P4 生产版对照」节。
 *
 *  4-A 基线标尺双柱：教学版 ≈30 / 生产版 1700+（真实线性比例，悬殊即冲击），
 *      p4-02「一千七百多行」句尾词落位右柱到位=重音镜；右柱出处角标（Visual Lock）。
 *  4-B 右柱核心剖面：同款 LoopRing 内核 + 「还要不要继续」开关（角标 needsFollowUp）；
 *      流式字符到达→工具调用块一现开关即拨「要」（单一致动因素=块出现）；
 *      收尾字段徽章打叉一闪（与 P3 左卡迟到徽章同族：warn 描边胶囊）。
 *  4-C State 外圈：环体外围十字段槽暗态（计数角标 10）+ 三代表亮起（上下文/错误/轮次），
 *      四条退出路径（超长/报错/中止/轮次到顶）自外圈引出细线、各带处置小签。
 *  4-D 保险丝收束：外圈退为虚线「保险丝层」；真保险丝断口终态 vs 可重试回弹×2
 *      （对举方向一致：断=终态 / 弹=恢复，X-001）；末句左柱骨架—右柱核心以
 *      描边金线相连定格〔M-003〕。
 *
 *  红线：动画时点全部句边界推导——词级时间戳不可得，词位取句窗语义分位
 *  （句窗尾部 ≈0.1 为句隙，分位已按口播词序校估）；柱高/计数恒 useProgress /
 *  useCount 钳制（数据永不过冲，grow 不吃弹簧）；pathLength 归一化描线与像素
 *  dasharray 分属不同元素；y≥56 / bottom≥150。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel} from '../components/motifs';
import {DUR, useCount, useDim, useDraw, useEnter, useImpulse, useProgress, useStagger} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 句窗（已换算到所在镜 Sequence 的局部帧） */
type Win = {from: number; durationInFrames: number};

/** 句内词位锚：句首 + frac × 句窗（词位=语义分位，见文件头注） */
const at = (s: Win, frac: number): number => s.from + frac * s.durationInFrames;

/** 句内 [f0, f1] 分位区间的帧时长 */
const spanF = (s: Win, f0: number, f1: number): number => (f1 - f0) * s.durationInFrames;

const polar = (cx: number, cy: number, r: number, deg: number): {x: number; y: number} => {
  const rad = (deg * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
};

/** 环体巡游节律：2.5s/圈（全片同值；MiniCore 惯用形） */
const LAP_FRAMES = 75;

/** 匀速巡游进度（0..多圈），喂给 LoopRing.dotProgress */
const useLaps = (span: number): number => {
  const p = useProgress(0, Math.max(1, span), 'linear');
  return p * (span / LAP_FRAMES);
};

/** 4-D 描边金线用金（storyboard 指定「金线」；theme 无金档、概念色不扩——
 *  本集内一次性局部描边色，勿作语义色扩散） */
const GOLD = '#E6C06A';

// ── 4-A 基线标尺双柱（p4-01..p4-02） ────────────────────────────────────

/** 轴几何：基线 y=800；右柱高 560 ↔ 1700+ 行；左柱 = 560×30/1700 ≈ 10px
 *  （真实线性比例——悬殊本身即画面冲击；精确值由数字标签承载，柱高不取整失真） */
const A = {baseY: 800, barW: 150, leftX: 485, rightX: 1255, rightH: 560, leftH: 10} as const;

/** 顶圆角柱 path（底边贴基线） */
const topRoundedBar = (x: number, baseY: number, w: number, h: number): string => {
  const q = Math.min(8, h / 2);
  const x1 = x + w;
  return `M ${x} ${baseY} L ${x} ${baseY - h + q} Q ${x} ${baseY - h} ${x + q} ${baseY - h} L ${
    x1 - q
  } ${baseY - h} Q ${x1} ${baseY - h} ${x1} ${baseY - h + q} L ${x1} ${baseY} Z`;
};

const ShotABaseline: React.FC<{s1: Win; s2: Win}> = ({s1, s2}) => {
  // p4-01（设问拍留白）：基线标尺铺开 + 柱位刻度/柱名先行落位
  const ruler = useDraw(at(s1, 0.2), DUR.f6);
  const marksO = useProgress(at(s1, 0.55), DUR.f4);
  // p4-02：两柱先后生长定格（useProgress 非弹簧——柱高数据红线）
  const leftStart = at(s2, 0.1);
  const leftDur = spanF(s2, 0.1, 0.3);
  const leftP = useProgress(leftStart, leftDur, 'decelerate');
  const leftN = useCount({to: 30, at: leftStart, dur: leftDur});
  // 「一千七百多行」为句尾词（句窗 0.86 ≈ 语音 0.9 分位）——右柱到位=重音镜
  const rightStart = at(s2, 0.35);
  const rightDur = spanF(s2, 0.35, 0.86);
  const rightP = useProgress(rightStart, rightDur, 'decelerate');
  const rightN = useCount({to: 1700, at: rightStart, dur: rightDur});
  const land = at(s2, 0.86);
  const glow = useImpulse({at: land, dur: DUR.f6});
  const leftNumO = useProgress(leftStart, DUR.f2);
  const rightNumO = useProgress(rightStart, DUR.f3);

  const leftShown = Math.min(30, Math.round(leftN));
  const rightShown = Math.min(1700, Math.round(rightN));
  const hL = Math.max(2, A.leftH * leftP);
  const hR = A.rightH * rightP;

  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        {/* 基线标尺（pathLength 归一化描线；本元素无像素 dasharray） */}
        <line
          x1={330}
          y1={A.baseY}
          x2={1600}
          y2={A.baseY}
          stroke={theme.panelBorder}
          strokeWidth={3}
          opacity={0.9}
          {...ruler}
        />
        {/* 标尺刻度（测量感） */}
        {Array.from({length: 16}, (_, i) => 330 + i * 85).map((x) => (
          <line
            key={x}
            x1={x}
            y1={A.baseY}
            x2={x}
            y2={A.baseY + 10}
            stroke={theme.panelBorder}
            strokeWidth={2}
            opacity={0.55 * marksO}
          />
        ))}
        {/* 柱位边缘刻度：两根柱将在此生长（预告位，不剧透量级） */}
        {[A.leftX, A.leftX + A.barW, A.rightX, A.rightX + A.barW].map((x) => (
          <line
            key={x}
            x1={x}
            y1={A.baseY - 4}
            x2={x}
            y2={A.baseY + 14}
            stroke={theme.dim}
            strokeWidth={2.5}
            opacity={marksO}
          />
        ))}
        {/* 左短柱：教学版 ≈30（暗色骨架语义） */}
        <path d={topRoundedBar(A.leftX, A.baseY, A.barW, hL)} fill={theme.dim} opacity={0.85} />
        {/* 右高柱：生产版 1700+（core 主角） */}
        <path d={topRoundedBar(A.rightX, A.baseY, A.barW, hR)} fill={theme.core} opacity={0.92} />
        {/* 右柱顶一闪的重音辉光（effects 通道：impulse 包络，不触柱高） */}
        <rect
          x={A.rightX}
          y={A.baseY - hR - 6}
          width={A.barW}
          height={5}
          fill={theme.text}
          opacity={0.9 * glow}
        />
        {/* 柱名（基线下方，bottom≥150 安全区内） */}
        <text
          x={A.leftX + A.barW / 2}
          y={848}
          textAnchor="middle"
          fontFamily={theme.sans}
          fontSize={28}
          fill={theme.dim}
          opacity={marksO}
        >
          {'教学版'}
        </text>
        <text
          x={A.rightX + A.barW / 2}
          y={848}
          textAnchor="middle"
          fontFamily={theme.sans}
          fontSize={28}
          fontWeight={600}
          fill={theme.text}
          opacity={marksO}
        >
          {'生产版'}
        </text>
      </svg>

      {/* 数字标签（HTML 层：落定辉光用 textShadow）。计数钳制、到位才落 ≈ / + 后缀 */}
      <div
        style={{
          position: 'absolute',
          left: A.leftX + A.barW / 2 - 150,
          top: A.baseY - A.leftH - 62,
          width: 300,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 42,
          color: theme.dim,
          fontVariantNumeric: 'tabular-nums',
          opacity: leftNumO,
        }}
      >
        {`${leftP >= 1 ? '≈' : ''}${leftShown} 行`}
      </div>
      <div
        style={{
          position: 'absolute',
          left: A.rightX + A.barW / 2 - 150,
          top: A.baseY - A.rightH - 66,
          width: 300,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 46,
          fontWeight: 700,
          color: theme.core,
          fontVariantNumeric: 'tabular-nums',
          opacity: rightNumO,
          textShadow: `0 0 ${20 * glow}px ${theme.core}`,
        }}
      >
        {`${rightShown}${rightP >= 1 ? '+' : ''} 行`}
      </div>

      {/* 右柱出处角标（Visual Lock：右柱必带出处；Footnote 位 bottom=168 ≥150） */}
      <Footnote delay={land}>{'源码分析 · 计数随时点漂移'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-B 右柱核心剖面（p4-04..p4-04b） ───────────────────────────────────

/** 剖面版面：面板 385..1535 × 235..795 */
const B = {panelL: 385, panelT: 235, panelW: 1150, panelH: 560} as const;
const B_CELLS = 26; // 流式字符格 2 行 × 13

const ShotBSection: React.FC<{s4: Win; s4b: Win}> = ({s4, s4b}) => {
  const span = s4.durationInFrames + s4b.durationInFrames;
  const laps = useLaps(span);
  const panelIn = useEnter('pop', {at: at(s4, 0.02), dur: DUR.f5});
  const headO = useProgress(at(s4, 0.08), DUR.f4);

  // 「同样不信收尾字段」词位（≈0.36）：徽章先现、打叉一闪、随后压暗=不再参与判定
  const atCross = at(s4, 0.36);
  const badgeO = useProgress(at(s4, 0.2), DUR.f4);
  const crossA = useDraw(atCross, DUR.f4);
  const crossB = useDraw(atCross + 2, DUR.f4);
  const flash = useImpulse({at: atCross, dur: DUR.f5});
  const badgeSettle = useProgress(atCross + DUR.f5, DUR.f4);

  // 「还要不要继续」的开关词位（≈0.72）：开关入画，停在「否」
  const switchO = useProgress(at(s4, 0.72), DUR.f4);

  // p4-04b：流式字符到达（线性匀速）→ 调用块一现（0.58）→ 开关即拨「要」
  // 单一致动因素：块与拨同一锚（f1 追随），拨动 f5 行程恰落「要」词位（≈0.75）
  const streamP = useProgress(at(s4b, 0.04), spanF(s4b, 0.04, 0.55), 'linear');
  const filled = Math.round(streamP * B_CELLS);
  const streamTagO = useProgress(at(s4b, 0.02), DUR.f3);
  const blockAt = at(s4b, 0.58);
  const flipAt = blockAt + DUR.f1;
  const knob = useProgress(flipAt, DUR.f5, 'decelerate');
  const blockIn = useEnter('pop', {at: blockAt, dur: DUR.f4});
  const blockGlow = useImpulse({at: blockAt, dur: DUR.f5});
  const on = knob > 0.02;

  return (
    <AbsoluteFill>
      {/* 剖面面板（右柱的放大剖面框） */}
      <div style={{position: 'absolute', left: B.panelL, top: B.panelT, ...panelIn}}>
        <Panel style={{width: B.panelW, height: B.panelH, boxSizing: 'border-box'}} />
      </div>

      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        {/* 面板头注：CU 语境内核归属 */}
        <text
          x={B.panelL + 30}
          y={B.panelT + 38}
          fontFamily={theme.mono}
          fontSize={22}
          fill={theme.dim}
          opacity={headO}
        >
          {'生产版 · 核心剖面'}
        </text>

        {/* 收尾字段徽章：与 P3 左卡迟到徽章同族（warn 描边胶囊 + mono 小注），
            打叉一闪后压暗——核心已不信任它，不参与判定 */}
        <g opacity={badgeO * (1 - 0.55 * badgeSettle)}>
          <rect
            x={1180}
            y={266}
            width={190}
            height={62}
            rx={31}
            fill={theme.panel}
            stroke={theme.warn}
            strokeWidth={2.5}
          />
          <rect
            x={1180}
            y={266}
            width={190}
            height={62}
            rx={31}
            fill="none"
            stroke={theme.warn}
            strokeWidth={5}
            opacity={flash}
          />
          <text
            x={1275}
            y={294}
            textAnchor="middle"
            fontFamily={theme.sans}
            fontSize={23}
            fill={theme.warn}
          >
            {'收尾字段'}
          </text>
          <text
            x={1275}
            y={318}
            textAnchor="middle"
            fontFamily={theme.mono}
            fontSize={15}
            fill={theme.dim}
          >
            {'stop_reason'}
          </text>
          {/* 打叉两笔（pathLength 描线） */}
          <line x1={1192} y1={276} x2={1358} y2={318} stroke={theme.warn} strokeWidth={3.5} {...crossA} />
          <line x1={1358} y1={276} x2={1192} y2={318} stroke={theme.warn} strokeWidth={3.5} {...crossB} />
        </g>

        {/* 流式字符格：逐格到达（打字机节律） */}
        <text
          x={760}
          y={306}
          fontFamily={theme.mono}
          fontSize={18}
          fill={theme.dim}
          opacity={streamTagO}
        >
          {'流式'}
        </text>
        {Array.from({length: B_CELLS}, (_, i) => {
          const col = i % 13;
          const row = Math.floor(i / 13);
          const x = 760 + col * 30;
          const y = 322 + row * 46;
          const shown = i < filled;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={22}
              height={30}
              rx={4}
              fill={shown ? theme.text : 'none'}
              fillOpacity={shown ? 0.72 : 0}
              stroke={theme.panelBorder}
              strokeWidth={1.5}
              opacity={shown ? 1 : 0.5}
            />
          );
        })}
      </svg>

      {/* 工具调用块：块一现（与开关同锚——单一致动因素） */}
      <div style={{position: 'absolute', left: 760, top: 428, width: 360, ...blockIn}}>
        <Panel
          accent={theme.tool}
          style={{
            boxSizing: 'border-box',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            boxShadow: `0 0 ${18 * blockGlow}px ${theme.tool}`,
            background: theme.panel,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.tool}}>
            {'工具调用'}
          </span>
          <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'tool_use'}</span>
        </Panel>
      </div>

      {/* 「还要不要继续」开关：拨到「要」 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <g opacity={switchO}>
          <text
            x={760}
            y={548}
            fontFamily={theme.sans}
            fontSize={26}
            fontWeight={600}
            fill={theme.text}
          >
            {'还要不要继续'}
          </text>
          <rect
            x={760}
            y={566}
            width={180}
            height={58}
            rx={29}
            fill={theme.panel}
            stroke={theme.panelBorder}
            strokeWidth={2}
          />
          <text x={742} y={602} textAnchor="end" fontFamily={theme.sans} fontSize={24} fill={theme.dim}>
            {'否'}
          </text>
          <text
            x={958}
            y={602}
            textAnchor="start"
            fontFamily={theme.sans}
            fontSize={24}
            fontWeight={600}
            fill={on ? theme.ok : theme.dim}
          >
            {'要'}
          </text>
          {/* 拨钮（行程 f5，落位=「要」词位；几何量非弹簧非数据） */}
          <circle cx={783 + 134 * knob} cy={595} r={20} fill={theme.core} />
          <text x={760} y={658} fontFamily={theme.mono} fontSize={19} fill={theme.dim}>
            {'needsFollowUp'}
          </text>
        </g>
      </svg>

      {/* 同款环体内核（M-001 恒定锚：恒 core 恒线宽，只缩 size；小尺寸关标签） */}
      <div style={{position: 'absolute', left: 450, top: 330, ...panelIn}}>
        <LoopRing size={250} showLabels={false} showExit={false} dotProgress={laps} />
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C State 外圈（p4-05..p4-06） ──────────────────────────────────────

/** 外圈几何：环心 (960,555)，外圈 r=280；十字段槽等距 36° */
const C = {cx: 960, cy: 555, r: 280} as const;
const SLOT_ANGLE = (k: number): number => -90 + 36 * k;

/** 点亮的代表槽（只亮代表，不逐个展开——后续集的粮） */
const C_REPS = [
  {k: 0, label: '上下文', lx: 960, ly: 238, anchor: 'middle' as const},
  {k: 7, label: '错误', lx: 664, ly: 649, anchor: 'end' as const},
  {k: 3, label: '轮次', lx: 1256, ly: 649, anchor: 'start' as const},
];

/** 四条退出路径：自外圈槽位引出细线，各带处置小签（重试/续跑=ok，中止=warn——
 *  与 4-D 保险丝「弹=恢复 / 断=终态」同向的色彩语言） */
const C_EXITS = [
  {name: '超长', disp: '续跑', ok: true, k: 2, signX: 1372, signY: 336, w: 150},
  {name: '报错', disp: '重试', ok: true, k: 8, signX: 548, signY: 336, w: 150},
  {name: '中止', disp: '中止', ok: false, k: 6, signX: 600, signY: 806, w: 140},
  {name: '轮次到顶', disp: '中止', ok: false, k: 4, signX: 1330, signY: 806, w: 170},
];

const RepSlot: React.FC<{atIn: number; k: number; label: string; lx: number; ly: number; anchor: 'middle' | 'start' | 'end'}> = ({
  atIn,
  k,
  label,
  lx,
  ly,
  anchor,
}) => {
  const p = useProgress(atIn, DUR.f4);
  const pos = polar(C.cx, C.cy, C.r, SLOT_ANGLE(k));
  return (
    <g opacity={p}>
      <rect
        x={pos.x - 10}
        y={pos.y - 10}
        width={20}
        height={20}
        rx={5}
        fill={theme.panel}
        stroke={theme.text}
        strokeWidth={3}
      />
      <text
        x={lx}
        y={ly}
        textAnchor={anchor}
        fontFamily={theme.sans}
        fontSize={25}
        fontWeight={600}
        fill={theme.text}
      >
        {label}
      </text>
    </g>
  );
};

const ExitPath: React.FC<{
  atIn: number;
  k: number;
  name: string;
  disp: string;
  ok: boolean;
  signX: number;
  signY: number;
  w: number;
}> = ({atIn, k, name, disp, ok, signX, signY, w}) => {
  const draw = useDraw(atIn, DUR.f5);
  const signO = useProgress(atIn + DUR.f3, DUR.f4);
  const from = polar(C.cx, C.cy, C.r, SLOT_ANGLE(k));
  // 引出细线终点：指向处置小签方向（径向外推）
  const dir = {
    x: Math.cos((SLOT_ANGLE(k) * Math.PI) / 180),
    y: Math.sin((SLOT_ANGLE(k) * Math.PI) / 180),
  };
  const to = {x: C.cx + dir.x * (C.r + 105), y: C.cy + dir.y * (C.r + 105)};
  const enter = useEnter('fade', {at: atIn + DUR.f3, dur: DUR.f4});
  return (
    <>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={theme.dim}
          strokeWidth={2}
          opacity={0.8}
          {...draw}
        />
      </svg>
      <div style={{position: 'absolute', left: signX - w / 2, top: signY - 36, width: w, ...enter}}>
        <Panel
          style={{
            boxSizing: 'border-box',
            padding: '8px 12px',
            textAlign: 'center',
            opacity: signO,
            background: theme.panel,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>
            {name}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 18, color: ok ? theme.ok : theme.warn}}>
            {`→ ${disp}`}
          </div>
        </Panel>
      </div>
    </>
  );
};

const ShotCStateRim: React.FC<{s5: Win; s6: Win}> = ({s5, s6}) => {
  const span = s5.durationInFrames + s6.durationInFrames;
  const laps = useLaps(span);
  // p4-05：外圈成形 → 十字段槽成组落位（快速涟漪，非逐个展开）→ 计数角标
  const rim = useDraw(at(s5, 0.06), DUR.f6);
  const slots = useStagger(10, {at: at(s5, 0.2), stride: 2, dur: DUR.f2});
  const countO = useProgress(at(s5, 0.32), DUR.f4);
  // 「十个字段各追一类」词位区（0.58..0.78）：代表槽逐个点亮
  const repAnchors = [at(s5, 0.58), at(s5, 0.68), at(s5, 0.78)];
  // p4-06：四条退出路径随口播枚举各亮一条（0.28..0.66），处置小签跟落
  const exitAnchors = [at(s6, 0.28), at(s6, 0.4), at(s6, 0.52), at(s6, 0.66)];

  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        {/* State 外圈（pathLength 描线；无像素 dasharray） */}
        <circle cx={C.cx} cy={C.cy} r={C.r} fill="none" stroke={theme.panelBorder} strokeWidth={2.5} {...rim} />
        {/* 十字段槽：暗态等距（成组出现，不逐个展开） */}
        {slots.map((o, k) => {
          const pos = polar(C.cx, C.cy, C.r, SLOT_ANGLE(k));
          return (
            <rect
              key={k}
              x={pos.x - 9}
              y={pos.y - 9}
              width={18}
              height={18}
              rx={4}
              fill={theme.panel}
              stroke={theme.panelBorder}
              strokeWidth={2}
              opacity={o}
            />
          );
        })}
        {/* 计数角标「10」 */}
        <text
          x={C.cx}
          y={872}
          textAnchor="middle"
          fontFamily={theme.mono}
          fontSize={26}
          fill={theme.dim}
          opacity={countO}
        >
          {'10 字段'}
        </text>
      </svg>

      {/* 环体（M-001 恒定锚居中；本镜主角是外圈，站牌标签关闭） */}
      <div style={{position: 'absolute', left: C.cx - 155, top: C.cy - 155}}>
        <LoopRing size={310} showLabels={false} showExit={false} dotProgress={laps} />
      </div>

      {C_REPS.map((r, i) => (
        <RepSlot key={r.label} atIn={repAnchors[i]} k={r.k} label={r.label} lx={r.lx} ly={r.ly} anchor={r.anchor} />
      ))}

      {C_EXITS.map((e, i) => (
        <ExitPath key={e.name} atIn={exitAnchors[i]} k={e.k} name={e.name} disp={e.disp} ok={e.ok} signX={e.signX} signY={e.signY} w={e.w} />
      ))}
    </AbsoluteFill>
  );
};

// ── 4-D 保险丝收束（p4-07..p4-08） ──────────────────────────────────────

/** 收束舞台：环心 (960,520)，保险丝层虚线圈 r=200；两小图对举于 (600/1320,520) */
const D = {cx: 960, cy: 520, rFuse: 200} as const;

/** 真保险丝：一烧即断=断口终态（断开后永不合拢、整体压暗；X-001：无恢复暗示） */
const FuseReal: React.FC<{atIn: number; atBreak: number}> = ({atIn, atBreak}) => {
  const enter = useEnter('pop', {at: atIn, dur: DUR.f4});
  const gap = 18 * useProgress(atBreak, DUR.f4, 'decelerate');
  const spark = useImpulse({at: atBreak, dur: DUR.f4});
  const settle = useProgress(atBreak + DUR.f5, DUR.f4);
  const mid = 600;
  // 入场 opacity 与终态压暗相乘（避免对象字面量重复键覆盖入场淡入）
  const glyphStyle: React.CSSProperties = {...enter, opacity: enter.opacity * (1 - 0.35 * settle)};
  return (
    <g style={glyphStyle}>
      <rect x={535} y={497} width={130} height={46} rx={10} fill={theme.panel} stroke={theme.dim} strokeWidth={2.5} />
      {/* 断口：两段灯丝随 gap 永久分离（钳制终态） */}
      <line x1={545} y1={520} x2={mid - gap / 2} y2={520} stroke={theme.text} strokeWidth={3} />
      <line x1={mid + gap / 2} y1={520} x2={655} y2={520} stroke={theme.text} strokeWidth={3} />
      {/* 烧断火花：一次性 impulse 闪光 */}
      <g opacity={spark} stroke={theme.warn} strokeWidth={3}>
        <line x1={592} y1={512} x2={580} y2={500} />
        <line x1={608} y1={512} x2={620} y2={500} />
        <line x1={592} y1={528} x2={580} y2={540} />
        <line x1={608} y1={528} x2={620} y2={540} />
      </g>
      <text x={600} y={596} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.dim}>
        {'真保险丝 · '}
        <tspan fill={theme.warn}>{'永久断路'}</tspan>
      </text>
    </g>
  );
};

/** 可重试保险丝：回弹恢复（灯丝下弯两拍后归直——弹=恢复，方向与真保险丝相反相成） */
const FuseRetry: React.FC<{atIn: number; atBounce: number}> = ({atIn, atBounce}) => {
  const enter = useEnter('pop', {at: atIn, dur: DUR.f4});
  const b1 = useImpulse({at: atBounce, dur: DUR.f5});
  const b2 = useImpulse({at: atBounce + DUR.f5, dur: DUR.f5});
  const bend = 26 * (b1 + b2);
  const x0 = 1255;
  const x1 = 1385;
  const mid = (x0 + x1) / 2;
  return (
    <g style={enter}>
      <rect x={x0} y={497} width={130} height={46} rx={10} fill={theme.panel} stroke={theme.dim} strokeWidth={2.5} />
      {/* 灯丝：Q 曲线控制点随双 impulse 包络下弯再归直（每拍升起回落=回弹两次） */}
      <path
        d={`M ${x0 + 10} 520 Q ${mid} ${520 + 2 * bend} ${x1 - 10} 520`}
        fill="none"
        stroke={theme.text}
        strokeWidth={3}
      />
      <text x={mid} y={596} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.dim}>
        <tspan fill={theme.ok}>{'可重试'}</tspan>
        {' · '}
        <tspan fill={theme.ok}>{'可续跑'}</tspan>
      </text>
    </g>
  );
};

const ShotDFuse: React.FC<{s7: Win; s7b: Win; s8: Win}> = ({s7, s7b, s8}) => {
  const span = s7.durationInFrames + s7b.durationInFrames + s8.durationInFrames;
  const laps = useLaps(span);
  const ringIn = useEnter('fade', {at: 0, dur: DUR.f5});
  // p4-07「…的保险丝」词位区：外圈整体退为保险丝层虚线圈（携十字段槽残点），两小图对举入画
  const fuseO = useProgress(at(s7, 0.55), DUR.f5);
  const atBreak = at(s7b, 0.28); // 「一烧就永久断路」词位
  const atBounce = at(s7b, 0.6); // 「还能重试、还能续跑」词位（弹两次）
  const glyphL = at(s7, 0.66);
  const glyphR = at(s7, 0.76);
  // p4-08：保险丝层让位压暗，双柱骨架/核心入画，金线相连定格
  const fuseDim = useDim({at: s8.from + 2, to: 0.55, dur: DUR.f5});
  const barsIn = useProgress(at(s8, 0.1), DUR.f5);
  // 「就是那一千七百多行的核心」词位（≈0.84）：金线自左柱骨架描向右柱核心
  const goldDraw = useDraw(at(s8, 0.44), spanF(s8, 0.44, 0.84));
  const dotsO = useProgress(at(s8, 0.84), DUR.f3);
  const GOLD_PATH =
    'M 300 710 C 520 420, 760 268, 960 268 C 1160 268, 1400 430, 1580 550';

  return (
    <AbsoluteFill>
      {/* 环体（EWS 缩微；M-001 恒定锚） */}
      <div style={{position: 'absolute', left: D.cx - 130, top: D.cy - 130, ...ringIn}}>
        <LoopRing size={260} showLabels={false} showExit={false} dotProgress={laps} />
      </div>

      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        {/* 保险丝层：虚线圈（像素 dasharray——与 pathLength 描线分属不同元素），
            携 4-C 十字段槽的等距残点（外圈整体退位，不逐个展开） */}
        <g opacity={fuseO * fuseDim}>
          <circle
            cx={D.cx}
            cy={D.cy}
            r={D.rFuse}
            fill="none"
            stroke={theme.dim}
            strokeWidth={2.5}
            strokeDasharray="10 12"
            opacity={0.75}
          />
          {Array.from({length: 10}, (_, k) => {
            const p = polar(D.cx, D.cy, D.rFuse, SLOT_ANGLE(k));
            return <circle key={k} cx={p.x} cy={p.y} r={2.5} fill={theme.dim} opacity={0.9} />;
          })}
          <text x={790} y={712} textAnchor="end" fontFamily={theme.mono} fontSize={21} fill={theme.dim}>
            {'保险丝层'}
          </text>
        </g>
        {/* 两小图对举：断=终态（左）/ 弹=恢复（右）——方向一致，无反转（X-001） */}
        <g opacity={fuseDim}>
          <FuseReal atIn={glyphL} atBreak={atBreak} />
          <FuseRetry atIn={glyphR} atBounce={atBounce} />
        </g>

        {/* 双柱召回（骨架=描边 / 核心=core 描边+淡填充）；mini 比例示意、数字标签承载精确值 */}
        <g style={{opacity: barsIn, transform: `translateY(${(1 - barsIn) * 14}px)`}}>
          <rect x={272} y={710} width={56} height={10} fill="none" stroke={theme.dim} strokeWidth={2} />
          <text x={300} y={692} textAnchor="middle" fontFamily={theme.mono} fontSize={22} fill={theme.dim}>
            {'骨架 ≈30'}
          </text>
          <rect
            x={1552}
            y={550}
            width={56}
            height={170}
            fill={theme.core}
            fillOpacity={0.12}
            stroke={theme.core}
            strokeWidth={2.5}
          />
          <text x={1580} y={528} textAnchor="middle" fontFamily={theme.mono} fontSize={22} fill={theme.core}>
            {'核心 1700+'}
          </text>
        </g>

        {/* 描边金线：左柱骨架 —（越过保险丝层顶）— 右柱核心，词落位描成定格〔M-003〕 */}
        <path d={GOLD_PATH} fill="none" stroke={GOLD} strokeWidth={9} opacity={0.22} {...goldDraw} />
        <path d={GOLD_PATH} fill="none" stroke={GOLD} strokeWidth={4} {...goldDraw} />
        <circle cx={300} cy={710} r={5.5} fill={GOLD} opacity={dotsO} />
        <circle cx={1580} cy={550} r={5.5} fill={GOLD} opacity={dotsO} />
      </svg>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P4ProductionFuse: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // 句窗换算到所在镜 Sequence 的局部帧（frame 0 = 镜首）
  const rel =
    (beat: {from: number}) =>
    (id: string): Win => {
      const g = w(id);
      return {from: g.from - beat.from, durationInFrames: g.durationInFrames};
    };

  // 四镜联缀覆盖 p4-01..p4-08 全部句（含 p4-04b/p4-07b 字母后缀句），无交叠
  const bA = w('p4-01', 'p4-02');
  const bB = w('p4-04', 'p4-04b');
  const bC = w('p4-05', 'p4-06');
  const bD = w('p4-07', 'p4-08');
  const rA = rel(bA);
  const rB = rel(bB);
  const rC = rel(bC);
  const rD = rel(bD);

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <ShotABaseline s1={rA('p4-01')} s2={rA('p4-02')} />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <ShotBSection s4={rB('p4-04')} s4b={rB('p4-04b')} />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <ShotCStateRim s5={rC('p4-05')} s6={rC('p4-06')} />
      </Sequence>
      <Sequence {...bD} name="4-D">
        <ShotDFuse s7={rD('p4-07')} s7b={rD('p4-07b')} s8={rD('p4-08')} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4ProductionFuse;
