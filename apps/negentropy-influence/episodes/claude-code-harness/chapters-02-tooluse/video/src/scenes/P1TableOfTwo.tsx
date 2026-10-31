/** P1 两件事与一张表（p1-01..p1-10，4 镜）——分镜 1-A / 1-B / 1-C / 1-D。
 *
 *  叙事链：对照表首亮（首行跑命令）+ 两枚步骤签（①定义 ②注册）→ 定义滑进
 *  清单（名字/描述/参数说明书三件小卡）→ 注册表加行（接点闪合）→ 环体合位
 *  全景：执行段换装（跑命令方块拆下 → 查表四节点链）→ 表 2→5 行 + 基线标尺
 *  （1→5 增长条 + 改动计数 +1/+1/+0，环体静止一拍=重音镜）→ 能力等高（透视镜
 *  扫出五卡结构、bash 串仍无差别）→ 边界框（四卡共界 + 越界撞回 + 锁扣）。
 *
 *  空间契约：1-A 环体缩悬左上（〔M-001〕开帧坐标锚，执行段暗行提示）→ 1-B
 *  同形放大落位屏左（无 cut 连续，morph：size/位插值）；对照表 1-A 居中 →
 *  1-B 移驻屏右（行数接 1-A 末态 2 行）→ 跨镜累积元素：表行数只增不减。
 *  Morph Continuity（0-C→1-A 判替换不 morph）：灰串消散屏位 = 表亮起屏位，
 *  SceneFade 承接、明暗反转 eye-trace。
 *
 *  红线落实：词落位 = 句首 + 句长比例 wa(id,f)；动画时点句边界锚；增长条/
 *  计数恒 useProgress/useCount 钳制（数据永不过冲）；环体静止一拍 = dot 冻结
 *  + 辉光 impulse（静止即陈述〔M-003〕）；y≥56 / bottom≥150。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  DispatchChain,
  Footnote,
  LoopRing,
  Panel,
  SceneTag,
  TABLE_ROWS,
  TableRegistry,
  ToolCard,
  execArcPath,
} from '../components/motifs';
import {DUR, clamp01, progress, useCount, useEnter, useImpulse, useProgress, usePushIn, useSpring} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 可选锚的哨兵：progress 钳制后恒为 1（在场）/ impulse 恒为 0（不点火） */
const OFFSCREEN = -999;

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

type Pt = {x: number; y: number};

/** 二次贝塞尔行程（chip 沿弧飞行） */
const qBez = (p0: Pt, c: Pt, p2: Pt, u: number): Pt => {
  const iu = 1 - u;
  return {
    x: iu * iu * p0.x + 2 * iu * u * c.x + u * u * p2.x,
    y: iu * iu * p0.y + 2 * iu * u * c.y + u * u * p2.y,
  };
};

/** 飞行 chip（hooks 顶层；u>=1 落位后隐去） */
const TravelChip: React.FC<{
  p0: Pt;
  c: Pt;
  p2: Pt;
  at: number;
  dur: number;
  children: React.ReactNode;
}> = ({p0, c, p2, at, dur, children}) => {
  const u = useProgress(at, dur, 'decelerate');
  const appear = useProgress(at, DUR.f2);
  if (u >= 1) {
    return null;
  }
  const pos = qBez(p0, c, p2, u);
  return (
    <div style={{position: 'absolute', left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)', opacity: appear}}>
      {children}
    </div>
  );
};

/** 执行段弧叠层（琥珀；draw 进度随调用方；r 与 LoopRing 内圈同式） */
const ExecArc: React.FC<{cx: number; cy: number; r: number; p: number; opacity?: number}> = ({cx, cy, r, p, opacity = 0.95}) => (
  <svg
    width={r * 2 + 40}
    height={r * 2 + 40}
    viewBox={`${-r - 20} ${-r - 20} ${r * 2 + 40} ${r * 2 + 40}`}
    style={{position: 'absolute', left: cx - r - 20, top: cy - r - 20, overflow: 'visible', pointerEvents: 'none', opacity}}
  >
    <path
      d={execArcPath(0, 0, r)}
      fill="none"
      stroke={theme.mech}
      strokeWidth={9}
      strokeLinecap="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - clamp01(p)}
    />
  </svg>
);

// ── 1-A 对照表首亮 + 两枚步骤签 + 定义滑进清单 ──────────────────────────

/** 步骤签：①定义 ②注册（幕首虚线空位在场，p1-01「两件事」词落位内容浮出） */
const StepSign: React.FC<{x: number; at: number; n: string; label: string}> = ({x, at, n, label}) => {
  const e = useEnter('pop', {at, dur: DUR.f4, springPreset: 'settle'});
  const frame = useCurrentFrame();
  const slotO = Math.min(1, Math.max(0, (frame - 2) / DUR.f3));
  return (
    <div style={{position: 'absolute', left: x, top: 236}}>
      {/* 空位虚线框（幕首在场） */}
      <div
        style={{
          width: 168,
          height: 60,
          borderRadius: 12,
          border: `2px dashed ${theme.panelBorder}`,
          opacity: 0.55 * slotO,
          position: 'absolute',
          left: 0,
          top: 0,
        }}
      />
      <div style={{position: 'absolute', left: 0, top: 0, ...e}}>
        <Panel accent={theme.mech} style={{padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, minWidth: 128}}>
          <span style={{fontFamily: theme.mono, fontSize: 24, fontWeight: 700, color: theme.mech}}>{n}</span>
          <span style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 600, color: theme.text}}>{label}</span>
        </Panel>
      </div>
    </div>
  );
};

/** 定义三件小卡：名字 / 描述 / 参数说明书（p1-02 词落位依序落位） */
const DEF_CARDS = [
  {k: '名字', sub: 'name'},
  {k: '描述', sub: 'description'},
  {k: '参数说明书', sub: 'schema'},
] as const;

const DefSlide: React.FC<{atDef: number; atCards: number; atRetire: number}> = ({atDef, atCards, atRetire}) => {
  const frame = useCurrentFrame();
  const def = useEnter('slideR', {at: atDef, dur: DUR.f5, dist: 46, springPreset: 'settle'});
  // 三件小卡依序落位（map 内纯函数 progress——hooks 铁律①）
  const cards = DEF_CARDS.map((_, i) => clamp01(progress(frame, atCards + i * 5, DUR.f4)));
  const retire = useProgress(atRetire, DUR.f4);
  return (
    <div style={{position: 'absolute', left: 190, top: 500, opacity: 1 - retire}}>
      <div style={{...def, marginBottom: 16}}>
        <ToolCard zh={'读文件'} en={'read_file'} w={330} h={84} />
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 34}}>
        {DEF_CARDS.map((c, i) => (
          <div
            key={c.sub}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              padding: '8px 16px',
              borderRadius: 8,
              border: `2px solid ${theme.panelBorder}`,
              background: theme.panel,
              width: 296,
              opacity: cards[i],
              transform: `translateY(${(1 - cards[i]) * 10}px)`,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 600, color: theme.text}}>{c.k}</span>
            <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginLeft: 'auto'}}>{c.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ShotA: React.FC<{
  atSigns: number;
  atDef: number;
  atCards: number;
  atReg: number;
  atFuse: number;
  atRetire: number;
}> = ({atSigns, atDef, atCards, atReg, atFuse, atRetire}) => {
  // @pushIn：p1-01「先摆答案」起压向本集主角对照表
  const push = usePushIn(0, {scale: 0.05, dur: DUR.f6});
  const signsO = useProgress(atSigns, DUR.f4);
  const retireO = useProgress(atRetire, DUR.f4);
  return (
    <AbsoluteFill style={{transform: push}}>
      <SceneTag chapter="Tool Use" tagline="两件事与一张表" accent={theme.mech} />
      {/* 环体缩悬左上：开帧坐标锚〔M-001〕；执行段暗行提示（琥珀低亮弧） */}
      <div style={{position: 'absolute', left: 84, top: 96}}>
        <LoopRing size={190} nodes={[0, 1, 2, 3, 4].map((i) => ({label: `s${i}`, angle: -90 + i * 72}))} showLabels={false} showExit={false} />
      </div>
      <ExecArc cx={84 + 95} cy={96 + 95} r={190 / 2 - 46} p={0.9} opacity={0.3} />
      {/* 左侧工具清单（竖列一条 bash 卡——幕首已在场） */}
      <div style={{position: 'absolute', left: 190, top: 356}}>
        <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginBottom: 12}}>{'TOOLS'}</div>
        <ToolCard zh={'跑命令'} en={'bash'} w={330} h={84} grey />
      </div>
      {/* p1-02「定义」：新定义滑进清单 + 三件小卡依序落位 */}
      <DefSlide atDef={atDef} atCards={atCards} atRetire={atRetire} />
      {/* 对照表首亮：首行「跑命令」已亮（1 行起）；p1-03「注册」新行滑入 */}
      <TableRegistry
        x={660}
        y={356}
        rows={2}
        rowAts={[null, atReg]}
        fuseAt={atFuse}
        glowAt={atFuse}
      />
      {/* 表上方两枚步骤签（空位 → p1-01 词落位浮出 → p1-03 末退役） */}
      <div style={{opacity: signsO * (1 - retireO)}}>
        <StepSign x={720} at={atSigns} n={'①'} label={'定义'} />
        <StepSign x={1020} at={atSigns + DUR.f2} n={'②'} label={'注册'} />
      </div>
      <Footnote delay={atCards}>{'TOOLS · schema'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-B 环体合位全景：执行段换装 + 表长到 5 行 + 基线标尺 ──────────────

/** 环体锚（morph 两档）：1-A 缩悬位 → 1-B 主体位（无 cut 连续，spring 插值） */
const RING_A = {cx: 179, cy: 191, size: 190} as const;
const RING_B = {cx: 470, cy: 520, size: 460} as const;

/** 环上执行站位点（126°；r 与 LoopRing 内式一致 = size/2 - 46） */
const ringPt = (a: {cx: number; cy: number; size: number}, deg: number): Pt => {
  const r = a.size / 2 - 46;
  const rad = (deg * Math.PI) / 180;
  return {x: a.cx + r * Math.cos(rad), y: a.cy + r * Math.sin(rad)};
};

const ShotB: React.FC<{
  atLookup: number;
  atChain: number;
  atGrow: number;
  atRuler: number;
  atStill: number;
}> = ({atLookup, atChain, atGrow, atRuler, atStill}) => {
  const frame = useCurrentFrame();
  // 环体自 1-A 缩悬位同形放大落位（spring settle——空间通道）
  const morph = useSpring('settle', {at: 2, dur: DUR.f5});
  const cx = RING_A.cx + (RING_B.cx - RING_A.cx) * morph;
  const cy = RING_A.cy + (RING_B.cy - RING_A.cy) * morph;
  const size = RING_A.size + (RING_B.size - RING_A.size) * morph;
  const r = size / 2 - 46;
  const execPt = {x: cx + r * Math.cos((126 * Math.PI) / 180), y: cy + r * Math.sin((126 * Math.PI) / 180)};
  // p1-04「查表」：段内写死的「跑命令」方块拆下（坠落淡出）
  const detach = useProgress(atLookup, DUR.f5, 'accelerate');
  const detachO = 1 - useProgress(atLookup + DUR.f3, DUR.f4);
  // 执行段高亮弧 + 四节点链铺成（step 0..4）
  const arcP = useProgress(atLookup + DUR.f3, DUR.f5);
  const chainStep = clamp01((frame - atChain) / Math.max(1, DUR.f5 + 4 * 5)) * 4;
  // 四步联演：①名字签飞入表左列 ②行点亮 ③部件端闪 ④参数小袋递入
  const flyAt = atChain + 4;
  const lit1 = useProgress(flyAt + 14, DUR.f3);
  const pouch = useProgress(flyAt + 22, DUR.f5, 'decelerate');
  // 环体巡游：p1-05 转一小段、p1-06「一行没改」定格静止（dot 冻结在整刻）
  const lapClock = useProgress(0, Math.max(1, atStill - 6), 'linear');
  const dot = lapClock * ((atStill - 6) / 75);
  const still = frame >= atStill;
  const stillGlow = useImpulse({at: atStill, dur: DUR.f6});
  // p1-05 表 2→5 行长出（行生长即五件工具卡入场；预留空位式——ep1 MsgList 虚线
  // 空槽同语言，开帧读作 2 行 + 空位，行高不突跳）
  const growAt = atGrow;
  const rowAts: (number | null)[] = [null, null, growAt, growAt + 4, growAt + 8];
  // p1-06 基线标尺：工具数 1→5 增长条 + 改动计数清点（+1/+1/+0）
  const rulerO = useProgress(atRuler, DUR.f4);
  const toolN = useCount({from: 1, to: 5, at: atRuler + 2, dur: DUR.f6});
  return (
    <AbsoluteFill>
      {/* 环体主体（M-001 同形放大落位；描边色/线宽 LoopRing 恒定） */}
      <div style={{position: 'absolute', left: cx - size / 2, top: cy - size / 2}}>
        <LoopRing
          size={size}
          nodes={[0, 1, 2, 3, 4].map((i) => ({label: `s${i}`, angle: -90 + i * 72}))}
          showLabels={false}
          showExit={false}
          dotProgress={still ? Math.round(dot * 75) / 75 : dot % 1}
        />
      </div>
      {/* 执行段高亮弧（琥珀，换装后的段标识） */}
      <ExecArc cx={cx} cy={cy} r={r} p={arcP} />
      {/* 执行站位牌 + 段内方块拆下（p1-04「查表」词落位） */}
      <div
        style={{
          position: 'absolute',
          left: execPt.x,
          top: execPt.y + 34,
          transform: 'translate(-50%, 0)',
          fontFamily: theme.sans,
          fontSize: 25,
          fontWeight: 600,
          color: theme.mech,
        }}
      >
        {'执行'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: execPt.x - 62,
          top: execPt.y - 46 + detach * 90,
          opacity: detachO,
        }}
      >
        <Panel accent={theme.dim} style={{padding: '6px 14px'}}>
          <span style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim, whiteSpace: 'nowrap'}}>{'跑命令 · 写死'}</span>
        </Panel>
      </div>
      {/* 查表四节点链（名字→表→部件→参数递入；环下方铺成） */}
      <DispatchChain x={210} y={795} w={520} step={chainStep} />
      {/* ①名字签飞入表左列（TravelChip：链节点① → 表首列） */}
      <TravelChip p0={{x: 250, y: 812}} c={{x: 900, y: 620}} p2={{x: 1215, y: 470}} at={flyAt} dur={DUR.f6}>
        <div style={{padding: '6px 14px', borderRadius: 8, border: `2px solid ${theme.mech}`, background: theme.panel}}>
          <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 600, color: theme.mech}}>{'读文件'}</span>
        </div>
      </TravelChip>
      {/* ④参数小袋：自表沿链递入执行位（单输入「读文件」全程可追） */}
      {pouch > 0.01 && pouch < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: 1215 - (1215 - execPt.x) * pouch,
            top: 500 + (execPt.y - 40 - 500) * pouch,
            padding: '4px 12px',
            borderRadius: 8,
            border: `2px solid ${theme.tool}`,
            background: theme.panel,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.tool}}>{'input'}</span>
        </div>
      ) : null}
      {/* 对照表移驻屏右（行数接 1-A 末态 2 行 → p1-05 长到 5 行） */}
      <TableRegistry x={1220} y={318} scale={0.94} rows={5} rowAts={rowAts} lit={[false, lit1 > 0.5, false, false, false]} />
      {/* p1-06 基线标尺：工具数增长条 + 改动计数（+1 / +1 / +0——两处改动） */}
      <div style={{position: 'absolute', left: 700, top: 856, opacity: rulerO, display: 'flex', alignItems: 'center', gap: 40}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
          <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'工具'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 44, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums'}}>
            {Math.min(5, Math.round(toolN))}
          </span>
          <div style={{width: 180, height: 12, borderRadius: 6, border: `2px solid ${theme.panelBorder}`, position: 'relative'}}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: 8,
                width: (Math.min(5, Math.round(toolN)) / 5) * 176,
                borderRadius: 5,
                background: theme.mech,
                opacity: 0.85,
              }}
            />
          </div>
        </div>
        {[
          {k: '清单', v: '+1'},
          {k: '表', v: '+1'},
          {k: '环体', v: '+0'},
        ].map((c) => (
          <div key={c.k} style={{display: 'flex', alignItems: 'baseline', gap: 8}}>
            <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{c.k}</span>
            <span style={{fontFamily: theme.mono, fontSize: 30, fontWeight: 700, color: c.v === '+0' ? theme.dim : theme.mech}}>{c.v}</span>
          </div>
        ))}
      </div>
      {/* 「一行没改」：环体整环定格静止一拍（静止即陈述；辉光一次不过冲） */}
      {stillGlow > 0.01 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={theme.core} strokeWidth={10} opacity={0.65 * stillGlow} />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};

// ── 1-C 能力对照定格：等高弧 + 透视镜 ──────────────────────────────────

const ShotC: React.FC<{atArc: number; atLens: number}> = ({atArc, atLens}) => {
  const frame = useCurrentFrame();
  // p1-07：两侧能力弧同时点亮且等高定格（等高裁决——左低右高即违 X-001）
  const arc = useProgress(atArc, DUR.f6, 'decelerate');
  // p1-08「看得清」：透视镜扫过右侧五卡（x 方向 spring），扫到即显结构
  const scan = useSpring('settle', {at: atLens, dur: DUR.f6});
  const lensX = 1060 + 700 * scan;
  const structured = (i: number) => clamp01(scan * 5.6 - i * 0.9);
  return (
    <AbsoluteFill>
      {/* 左：bash 卡（灰、一串无差别字符——X 光下仍无结构） */}
      <div style={{position: 'absolute', left: 250, top: 430}}>
        <ToolCard zh={'跑命令'} en={'bash'} w={390} h={150} grey />
      </div>
      {/* 右：五件工具卡（琥珀、结构化字段） */}
      {TABLE_ROWS.slice(1).map((t, i) => (
        <div key={t.en} style={{position: 'absolute', left: 1090, top: 330 + i * 110}}>
          <ToolCard zh={t.zh} en={t.en} w={520} h={92} structured={structured(i)} />
        </div>
      ))}
      {/* 透视镜（悬于右侧上方，扫过五卡） */}
      <svg width={64} height={64} viewBox="0 0 64 64" style={{position: 'absolute', left: lensX, top: 260, overflow: 'visible'}}>
        <circle cx={26} cy={26} r={19} fill="none" stroke={theme.text} strokeWidth={4} />
        <line x1={40} y1={40} x2={58} y2={58} stroke={theme.text} strokeWidth={5} strokeLinecap="round" />
      </svg>
      {/* 能力弧线：左右各一条、顶齐 y=270（等高裁决）。
          ⑨ QA N3：改中性灰虚线（原实线太具宣言感；词落位改为淡入） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <path
          d="M 445 430 Q 445 270 280 270"
          fill="none"
          stroke={theme.dim}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray="16 12"
          opacity={0.9 * arc}
        />
        <path
          d="M 1075 330 Q 1075 270 1240 270 L 1610 270"
          fill="none"
          stroke={theme.dim}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray="16 12"
          opacity={0.9 * arc}
        />
      </svg>
      {/* 弧顶等高基线（⑨ QA N3：同步改灰虚线）：等高裁决的读法锚 */}
      <div
        style={{
          position: 'absolute',
          left: 250,
          right: 250,
          top: 268,
          borderTop: `2px dashed ${withAlpha(theme.dim, 0.45)}`,
          opacity: arc,
        }}
      />
      <div style={{position: 'absolute', left: 250, top: 224, fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: arc}}>
        {'同样的活 · 都能干'}
      </div>
      <Footnote delay={atLens}>{'intent vs 字符'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-D 边界镜：对照表驻屏右（承 1-B 末态），范围框框住表 2–5 行 + 越界撞回 + 锁扣 ──

/** 1-D 表驻位 = 1-B 末态原位原形（对照表装置 continuity：x/y/scale/5 行逐字同参）；
 *  表内第 2..5 行即四件文件工具（读/写/改/找）——范围框收拢框住该四行。 */
const SHOTD_TABLE = {x: 1220, y: 318, scale: 0.94} as const;
/** 范围框几何（表坐标系：表头 56 + 行 60 + gap 10，第 2 行顶 126 / 第 5 行底 396，× scale 后外扩） */
const SHOTD_BOX = (() => {
  const s = SHOTD_TABLE.scale;
  const top = SHOTD_TABLE.y + (56 + 60 + 10) * s - 10;
  const bottom = SHOTD_TABLE.y + (56 + 5 * 60 + 4 * 10) * s + 10;
  return {x: SHOTD_TABLE.x - 10, y: top, w: 560 * s + 20, h: bottom - top};
})();

const ShotD: React.FC<{atFrame: number; atBounce: number; atLock: number}> = ({atFrame, atBounce, atLock}) => {
  // 范围框点亮收拢（draw + 1.06→1 收拢）
  const boxDraw = useProgress(atFrame, DUR.f5);
  const shrink = 1 - 0.06 * (1 - useProgress(atFrame + DUR.f3, DUR.f4));
  // 越界卡：自框外（右下）飞向框内 → 卡右缘恰触框右缘即弹回（触界即弹，终态停框外）
  const inbound = useProgress(atBounce, DUR.f4, 'accelerate');
  const rebound = useSpring('settleSoft', {at: atBounce + DUR.f4, dur: DUR.f5});
  const errFlash = useImpulse({at: atBounce + DUR.f4, dur: DUR.f5, peak: 1});
  // 锁扣（p1-10「抓手」）
  const lock = useEnter('pop', {at: atLock, dur: DUR.f4, springPreset: 'snap'});
  const BOX = SHOTD_BOX;
  const CARD_W = 246;
  // 段1（触界行程）：卡右缘自 2126 收敛到框右缘（x = BOX.x + BOX.w - CARD_W）；
  // 段2（弹回）：沿撞击方向退回框外 90px、微沉 20px
  const hitX = BOX.x + BOX.w - CARD_W;
  const cardX = 1880 + (hitX - 1880) * inbound + 90 * rebound;
  const cardY = 760 + (556 - 760) * inbound + 20 * rebound;
  return (
    <AbsoluteFill>
      {/* 对照表驻屏右（承 1-B 末态：5 行全在场、琥珀描边；四件文件工具即表 2–5 行） */}
      <TableRegistry x={SHOTD_TABLE.x} y={SHOTD_TABLE.y} scale={SHOTD_TABLE.scale} rows={5} />
      {/* 工作目录范围框（琥珀虚线单一带状，收拢框住表 2–5 行；点亮收拢）。
          ⑨ QA W6：框几何钉表内第 2–5 行（y 426..700 含 ~10px 缓冲、绕开 bash
          首行带 371..427）；越界卡行程 (1880,760)→(1510,556) 终点驻表右缘
          行带内，全程不穿 bash 首行 */}
      <div
        style={{
          position: 'absolute',
          left: BOX.x,
          top: BOX.y,
          width: BOX.w,
          height: BOX.h,
          transform: `scale(${shrink})`,
          transformOrigin: 'center',
        }}
      >
        <svg width={BOX.w} height={BOX.h} style={{overflow: 'visible'}}>
          <rect
            x={2}
            y={2}
            width={BOX.w - 4}
            height={BOX.h - 4}
            rx={22}
            fill="none"
            stroke={theme.mech}
            strokeWidth={3}
            strokeDasharray="16 14"
            opacity={0.85}
            pathLength={1}
            strokeDashoffset={1 - boxDraw}
          />
        </svg>
        <div style={{position: 'absolute', left: 24, top: -18, fontFamily: theme.mono, fontSize: 19, color: theme.mech, opacity: boxDraw}}>
          {'工作目录 · cwd'}
        </div>
      </div>
      {/* 越界卡：带「越出」路径小签，自框外飞向框内 → 卡右缘触框右缘弹回（禁入框内） */}
      <div style={{position: 'absolute', left: cardX, top: cardY}}>
        <Panel accent={theme.warn} style={{padding: '10px 16px', boxShadow: `0 0 ${22 * errFlash}px ${theme.warn}`, width: CARD_W, boxSizing: 'border-box'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'path'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 23, color: theme.text, whiteSpace: 'nowrap'}}>{'../../越出/secret'}</div>
        </Panel>
        {/* 报错签闪珊瑚红（撞界即报错） */}
        <div
          style={{
            position: 'absolute',
            right: -26,
            top: -34,
            padding: '6px 14px',
            borderRadius: 8,
            border: `2px solid ${theme.warn}`,
            background: theme.bg,
            fontFamily: theme.sans,
            fontSize: 22,
            fontWeight: 700,
            color: theme.warn,
            opacity: errFlash,
            transform: `rotate(-8deg)`,
            whiteSpace: 'nowrap',
          }}
        >
          {'报错 ✗'}
        </div>
      </div>
      {/* p1-10「抓手」：范围框角上锁扣小形（安全第一次有形） */}
      <div style={{position: 'absolute', left: BOX.x + BOX.w - 44, top: BOX.y - 46, ...lock}}>
        <svg width={52} height={52} viewBox="0 0 52 52">
          <rect x={10} y={22} width={32} height={24} rx={6} fill={theme.panel} stroke={theme.mech} strokeWidth={3.5} />
          <path d="M17 22 V15 Q17 7 26 7 Q35 7 35 15 V22" fill="none" stroke={theme.mech} strokeWidth={3.5} />
          <circle cx={26} cy={33} r={3.5} fill={theme.mech} />
        </svg>
      </div>
      <Footnote delay={atFrame}>{'工作目录内 · 越界即报错'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P1TableOfTwo: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p1-01', 'p1-03');
  const bB = w('p1-04', 'p1-06');
  const bC = w('p1-07', 'p1-08');
  const bD = w('p1-09', 'p1-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <ShotA
          atSigns={wa('p1-01', 0.72) - bA.from}
          atDef={wa('p1-02', 0.22) - bA.from}
          atCards={wa('p1-02', 0.5) - bA.from}
          atReg={wa('p1-03', 0.15) - bA.from}
          atFuse={wa('p1-03', 0.3) - bA.from}
          atRetire={at('p1-03') + dur('p1-03') - Math.min(14, dur('p1-03') / 3) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="1-B">
        <ShotB
          atLookup={wa('p1-04', 0.33) - bB.from}
          atChain={wa('p1-04', 0.5) - bB.from}
          atGrow={wa('p1-05', 0.12) - bB.from}
          atRuler={wa('p1-06', 0.3) - bB.from}
          atStill={wa('p1-06', 0.8) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="1-C">
        <ShotC atArc={wa('p1-07', 0.28) - bC.from} atLens={wa('p1-08', 0.6) - bC.from} />
      </Sequence>
      <Sequence {...bD} name="1-D">
        <ShotD atFrame={wa('p1-09', 0.22) - bD.from} atBounce={wa('p1-09', 0.82) - bD.from} atLock={wa('p1-10', 0.7) - bD.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1TableOfTwo;
