/** P6 收束（p6-01..23，4 镜 8 cue）——分镜 6-A…6-D。
 *
 *  cue 清单（8）：
 *   6-A five-layer-dependency/five-lit-finale@p6-02（五层全亮；本镜首图，默认入场）
 *   6-A collab-panorama/mech-homecoming@p6-03 + tool-belt-27@p6-04（与前图背靠背
 *       → 后挂实例 lead={false}）
 *   6-A collab-panorama/identity-message@p6-06 + identity-tool@p6-07 + no-branch@p6-08
 *       （空窗一句 p6-05 后重现 → 默认入场）
 *   6-B collab-panorama/gate-three-beats@p6-10（no-branch 后空窗一句 → 默认入场；
 *       自制终章卡让位，真门停机由章内承担）
 *   6-D collab-panorama/all-lit-map@p6-21（空窗长后重现 → 默认入场）
 *
 *  ★ 终集特款（storyboard 自检对账）：五层身份卡全亮（6-A 五层全亮呼吸 + 6-D
 *    chip 档 ×5）、系列收束金句「机制很多 · 循环一个」、费曼遗产「两种身份」
 *    金句卡（caption-dup-ok 在案）、**无下期卡**（series-layers.json next=null）、
 *    收尾完结语气「后会有期」、末帧渐黑窗取整镜时长。
 *  ★ 6-A 3D 栈由 components/harness-stack.tsx 的 HarnessStackP6 承担（终集形态：
 *    五层全亮错峰呼吸 + p6-05 缩至侧位常驻——缩后的栈停在画框左外侧，与全屏
 *    回放窗同屏不抢位）；本镜 scene 侧零动效 hook（金句卡由 QuoteCard 承担）。
 *  ★ 6-D 身份卡标题主段是 check_series 规则 8 的受检硬编码（改标题先改
 *    series.json 再同步此串）；层短名走 series-layers.json 数据（LAYERS）。
 *  ★ 空间契约：6-B/6-D 传送带母题（LoopRing，core 橙恒定描边〔M-001〕）恒居
 *    左中锚位 RING；6-A/6-D 为系列装置镜（3D 栈/灯牌居中），6-C 卡片对称分置。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Footnote, LoopRing, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge, HarnessStackP6, LAYERS, Plate, PlateSlab3D} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {
  DUR,
  clamp01,
  progress,
  useEnter,
  useFadeOut,
  useFlowDash,
  useProgress,
  useReveal,
  useStagger,
} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位：顶边 y<56 归 frozen ChapterProgress，本集各幕 Badge 统一 top:64。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** 内核左中锚位与巡游节律——与 P0 同位同尺同速（全系列恒定）。 */
const RING = {size: 300, left: 180, top: 390} as const;
const LAP_FRAMES = 75;

/** hex + 动态透明度（帧驱动，无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 人形剪影（师傅 = text 白，一律无彩——P0 台面微缩回放同形） */
const Person: React.FC<{x: number; y: number; color: string; scale?: number; opacity?: number}> = ({
  x,
  y,
  color,
  scale = 1,
  opacity = 0.9,
}) => (
  <svg
    width={120 * scale}
    height={180 * scale}
    viewBox="0 0 120 180"
    style={{position: 'absolute', left: x, top: y, opacity}}
  >
    <circle cx={60} cy={34} r={28} fill={color} />
    <path d="M0 180 Q0 76 60 70 Q120 76 120 180 Z" fill={color} />
  </svg>
);

/** 金句卡定格层：可选衬底 scrim（叠在仍在场的装置上，先入场后压暗）。
 *  caption-dup-ok 注记由调用处随 storyboard 豁免逐卡声明。 */
const QuoteWithScrim: React.FC<{zh: string; scrim?: boolean}> = ({zh, scrim = false}) => {
  const rawO = useProgress(2, DUR.f4);
  const o = scrim ? rawO : 1;
  return (
    <AbsoluteFill style={{background: withAlpha(theme.bg, 0.86 * o), pointerEvents: 'none'}}>
      <QuoteCard zh={zh} />
    </AbsoluteFill>
  );
};

// ── 6-A 终集栈：放大居中 → 缩至侧位常驻 ─────────────────────────────────

/** 3D 栈放大与五层点亮全在 HarnessStackP6（components/ 承担，不产生 token）；
 *  p6-05 空窗回落时缩至画框左外侧常驻（全屏回放窗期间保持可见）。 */
const StackFinale: React.FC<{at05: number}> = ({at05}) => (
  <div style={{position: 'absolute', left: 750, top: 318, pointerEvents: 'none'}}>
    <HarnessStackP6
      at={2}
      shrink={{at: at05 + DUR.f3, dx: -670, dy: 42, scale: 0.5}}
    />
  </div>
);

// ── 6-B 计划门三拍终章：协议单 → 真门急停 → 产品自动批 ───────────────────

/** 官方引语（轨C #39，mono 引语态逐字） */
const OFFICIAL_PLAN_QUOTE =
  "Claude Code approves the plan in the lead's session as soon as the request arrives, without the lead reviewing it";

const PlanGateFinale: React.FC<{
  at09: number;
  at10: number;
  at11: number;
  at12: number;
  at13: number;
}> = ({at09, at10, at11, at12, at13}) => {
  const frame = useCurrentFrame();
  // 传送带恒转（〔M-001〕恒色恒线宽）
  const ringDraw = useProgress(2, 30, 'decelerate');
  // 真门急停：恒速 → 冻结（decelerate 包络吃掉最后半窗行程，静置不转）
  const STOP_AT = at10 + DUR.f5;
  const freeze = useProgress(STOP_AT, DUR.f4, 'decelerate');
  const spinT = (Math.min(frame, STOP_AT) + DUR.f4 * 0.5 * freeze) / LAP_FRAMES;
  // 光点先骑描线前沿（EP1 同款），再匀速巡游，STOP_AT 处随包络冻结
  const dot = (ringDraw + spinT) % 1;
  // 协议单缩小回放：p6-09 大凭证落定 → p6-10 停到真门旁等批
  const slipIn = useProgress(at09 + 2, DUR.f5, 'decelerate');
  const slipPark = useProgress(at10 + DUR.f3, DUR.f5);
  const waitOn = useProgress(at11 + DUR.f3, DUR.f4);
  // 产品自动批：官方引语卡（p6-12，mono 逐字）
  const quoteIn = useProgress(at12 + 2, DUR.f4);
  const line = useReveal(OFFICIAL_PLAN_QUOTE, {at: at12 + 6, cps: 16});
  // 「拦截挪到权限层」流向箭头（p6-13，dim 行进虚线）
  const arrowIn = useProgress(at13 + 2, DUR.f4);
  const flow = useFlowDash({dash: 12, gap: 14, period: 42});

  const slipScale = 1 + 0.28 * (1 - slipIn);
  const parkX = -160 * slipPark;
  const parkY = 300 * slipPark;
  const parkS = 1 - 0.38 * slipPark;

  return (
    <AbsoluteFill>
      {/* 传送带母题：恒居左中锚位；p6-10 中段骤停冻结（core 静置不转） */}
      <div style={{position: 'absolute', left: RING.left, top: RING.top}}>
        <LoopRing size={RING.size} draw={ringDraw} dotProgress={dot} showLabels={false} />
      </div>

      {/* 协议单（前幕单据缩小回放，虚线凭证） */}
      <div
        style={{
          position: 'absolute',
          left: 660,
          top: 300,
          transform: `translate(${parkX}px, ${parkY}px) scale(${slipScale * parkS})`,
          transformOrigin: '50% 50%',
        }}
      >
        <div
          style={{
            width: 300,
            boxSizing: 'border-box',
            padding: '14px 20px',
            border: `2px dashed ${theme.dim}`,
            borderRadius: 12,
            background: theme.panel,
            textAlign: 'center',
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'submit_plan'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text, marginTop: 4}}>
            {'计划单'}
          </div>
        </div>
      </div>
      {/* 停在真门旁等批（p6-11：批文不回来，一步都不走） */}
      <div
        style={{
          position: 'absolute',
          left: 512,
          top: 626,
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.dim,
          letterSpacing: 2,
          opacity: waitOn,
        }}
      >
        {'等批复'}
      </div>

      {/* 官方引语卡（p6-12，mono 引语态逐字；【官】徽标） */}
      <div
        style={{
          position: 'absolute',
          left: 620,
          top: 258,
          opacity: quoteIn,
          transform: `translateY(${(1 - quoteIn) * 16}px)`,
        }}
      >
        <Panel style={{width: 1140, boxSizing: 'border-box', padding: '24px 32px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14}}>
            <span
              style={{
                fontFamily: theme.sans,
                fontSize: 22,
                color: theme.dim,
                border: `2px solid ${theme.dim}`,
                borderRadius: 6,
                padding: '2px 10px',
              }}
            >
              {'官'}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
              {'官方文档 · 计划审批'}
            </span>
          </div>
          <div
            style={{
              fontFamily: theme.mono,
              fontSize: 28,
              lineHeight: 1.6,
              color: theme.text,
              whiteSpace: 'pre-wrap',
              minHeight: 96,
            }}
          >
            {line}
          </div>
        </Panel>
      </div>

      {/* 「拦截挪到权限层」：真门位 → 权限层位（dim 行进虚线，p6-13） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: arrowIn}}>
        <line x1={470} y1={722} x2={1268} y2={580} stroke={theme.dim} strokeWidth={4} {...flow} />
        <path d="M1268 580 l-22 -6 l4 20 Z" fill={theme.dim} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 252,
          top: 702,
          opacity: arrowIn,
        }}
      >
        <Panel accent={theme.core} style={{padding: '8px 20px'}}>
          <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.core}}>{'真门'}</span>
        </Panel>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1288,
          top: 552,
          opacity: arrowIn,
          transform: `translateY(${(1 - arrowIn) * 12}px)`,
        }}
      >
        <Panel style={{padding: '8px 20px'}}>
          <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.dim}}>{'权限层'}</span>
        </Panel>
      </div>

      <Footnote delay={at12}>{'plan_approval_response'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 6-C 校准总句：教室 → 厂房 ────────────────────────────────────────────

/** 课桌（松排）→ 门禁厂房（紧排）各 8 席：排布滑移的两个端点（线稿 dim，不站队）。 */
const DESK_CLASS: [number, number][] = [
  [40, 44],
  [135, 44],
  [230, 44],
  [325, 44],
  [85, 170],
  [180, 170],
  [275, 170],
  [370, 170],
];
const DESK_FACTORY: [number, number][] = [
  [780, 60],
  [960, 60],
  [1140, 60],
  [1320, 60],
  [780, 190],
  [960, 190],
  [1140, 190],
  [1320, 190],
];

const ClassroomToFactory: React.FC<{at15: number}> = ({at15}) => {
  // 排布滑移：beat 级动作（36 帧显式，标尺外——见 08 运动层铁律④）
  const slideP = useProgress(at15 + DUR.f3, 36);
  // 两句并陈小卡对开（同 accent 同权重——不站队）
  const left = useEnter('slideL', {at: at15 + 8, dur: DUR.f5, dist: 60});
  const right = useEnter('slideR', {at: at15 + 12, dur: DUR.f5, dist: 60});

  const sideCard = (
    enter: {opacity: number; transform: string},
    x: number,
    tag: string,
    title: string,
    sub: string,
  ) => (
    <div style={{position: 'absolute', left: x, top: 745, ...enter}}>
      <Panel style={{width: 480, boxSizing: 'border-box', padding: '18px 26px'}}>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 12px',
            borderRadius: 999,
            border: `2px solid ${theme.dim}`,
            color: theme.dim,
            fontFamily: theme.mono,
            fontSize: 18,
          }}
        >
          {tag}
        </span>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 8}}>
          <span style={{fontFamily: theme.sans, fontSize: 38, fontWeight: 700, color: theme.text}}>{title}</span>
          <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{sub}</span>
        </div>
      </Panel>
    </div>
  );

  return (
    <AbsoluteFill>
      {/* 校准总句金句卡（衬线定格，上移让出线稿带） */}
      <div style={{position: 'absolute', inset: 0, transform: 'translateY(-210px)', pointerEvents: 'none'}}>
        <QuoteCard zh="教室 → 厂房" />
      </div>

      {/* 转场意象：工坊线稿从课桌排布滑向门禁厂房排布（p6-15） */}
      <svg width={1400} height={300} viewBox="0 0 1400 300" style={{position: 'absolute', left: 260, top: 420}}>
        {/* 厂房围界：左侧留门禁口（滑移到位后读作「带门禁的厂房」） */}
        <path
          d="M700 10 H1380 V290 H700 V186 M700 114 V10"
          fill="none"
          stroke={theme.dim}
          strokeWidth={3}
          opacity={0.35 + 0.65 * slideP}
        />
        {/* 门禁口（亮起随滑移） */}
        <rect x={664} y={114} width={18} height={72} fill="none" stroke={theme.text} strokeWidth={3} opacity={slideP} />
        {DESK_CLASS.map((c, i) => {
          const f = DESK_FACTORY[i];
          const x = c[0] + (f[0] - c[0]) * slideP;
          const y = c[1] + (f[1] - c[1]) * slideP;
          return (
            <g key={i} transform={`translate(${x} ${y})`}>
              <rect x={0} y={0} width={44} height={28} rx={4} fill="none" stroke={theme.dim} strokeWidth={3} />
              <line x1={6} y1={34} x2={38} y2={34} stroke={theme.dim} strokeWidth={3} strokeLinecap="round" />
            </g>
          );
        })}
      </svg>

      {/* 两句并陈小卡（不站队：同 accent 同形态） */}
      {sideCard(left, 280, '教学版', '教室', '讲清机制')}
      {sideCard(right, 1160, '官方', '厂房', '带门禁')}
    </AbsoluteFill>
  );
};

// ── 6-D 系列终态 ─────────────────────────────────────────────────────────

/** 系列身份卡（chip 档 ×5 全亮，终集特款）：层短名走 series-layers.json；
 *  标题主段受检硬编码（check_series 规则 8——改标题先改 series.json 再同步此串）；
 *  无下期卡（series-layers.json next=null，完结语气由 6-D 末「后会有期」承担）。 */
const IdentityCard: React.FC<{at: number}> = ({at}) => {
  const chips = useStagger(LAYERS.length, {at, dur: DUR.f4, stride: 6});
  return (
    <div style={{position: 'absolute', left: 1648, top: 282, width: 236}}>
      <Panel accent={theme.core} style={{padding: '16px 18px'}}>
        <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, letterSpacing: 1.5, lineHeight: 1.6}}>
          {'Claude Code'}
          <br />
          {'Harness Engineering'}
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12}}>
          {LAYERS.map((l) => (
            <div
              key={l.index}
              style={{opacity: chips[l.index - 1], transform: `translateY(${(1 - chips[l.index - 1]) * 12}px)`}}
            >
              <Plate layer={l} active dim={1} scale="chip" />
            </div>
          ))}
        </div>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 26,
            fontWeight: 700,
            color: theme.core,
            marginTop: 14,
            letterSpacing: 2,
          }}
        >
          {'从一个到一群'}
        </div>
      </Panel>
    </div>
  );
};

/** P0 台面溢出微缩回放（p6-16「回到开头」）：小台面 + 四件活，一件滑落。 */
const MiniReplay: React.FC<{at16: number}> = ({at16}) => {
  const inO = useProgress(2, DUR.f4);
  const off = useProgress(at16 + 10, DUR.f5);
  return (
    <div style={{opacity: inO}}>
      <Person x={250} y={222} color={theme.text} scale={0.62} />
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 340,
          width: 330,
          height: 96,
          borderRadius: 12,
          background: theme.coreDeep,
          boxShadow: `0 0 0 2px ${withAlpha(theme.coreDeep, 0.6)}`,
        }}
      />
      {[
        {x: 176, y: 356},
        {x: 248, y: 368},
        {x: 320, y: 356},
        {x: 384, y: 368},
      ].map((it, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: it.x - (i === 0 ? off * 400 : 0),
            top: it.y + (i === 0 ? off * 80 : 0),
            width: 56,
            height: 24,
            borderRadius: 5,
            border: `2px solid ${theme.dim}`,
            background: theme.panel,
            opacity: i === 0 ? 1 - 0.8 * off : 0.9,
          }}
        />
      ))}
    </div>
  );
};

/** 五物件答卡全亮（p6-17：板、格子、单据、隔间、插口——mech 金）。 */
const ANSWERS = ['板', '格子', '单据', '隔间', '插口'] as const;

const AnswerCards: React.FC<{at17: number}> = ({at17}) => {
  const cards = useStagger(ANSWERS.length, {at: at17 + 2, stride: 6, dur: DUR.f4});
  return (
    <>
      {ANSWERS.map((zh, i) => (
        <div
          key={zh}
          style={{
            position: 'absolute',
            left: 480 + i * 196,
            top: 445,
            opacity: cards[i],
            transform: `translateY(${(1 - cards[i]) * 20}px)`,
          }}
        >
          <Panel
            accent={theme.mech}
            style={{
              width: 176,
              boxSizing: 'border-box',
              padding: '16px 18px',
              textAlign: 'center',
              boxShadow: `0 0 18px ${withAlpha(theme.mech, 0.4)}`,
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.mechDeep}}>
              {`0${i + 1}`}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 700, color: theme.mech, marginTop: 2}}>
              {zh}
            </div>
          </Panel>
        </div>
      ))}
    </>
  );
};

/** 同一件事三步微环（p6-18：要工具／等结果／再想一步，LoopRing core 橙〔M-001〕）。 */
const THREE_STEPS = ['要工具', '等结果', '再想一步'] as const;

const ThreeStepRing: React.FC<{at18: number; span: number}> = ({at18, span}) => {
  const ringDraw = useProgress(at18 + 2, 30, 'decelerate');
  const run = useProgress(at18, Math.max(1, span - at18), 'linear');
  const dot = (run * ((span - at18) / LAP_FRAMES)) % 1;
  const steps = useStagger(THREE_STEPS.length, {at: at18 + 10, stride: 8, dur: DUR.f4});
  // 三标签沿环三等分位（-90°/30°/150°，label 半径 150——环 r=104）
  const labelPos = [
    {left: 270, top: 322},
    {left: 500, top: 600},
    {left: 64, top: 600},
  ];
  return (
    <>
      <div style={{position: 'absolute', left: RING.left, top: RING.top}}>
        <LoopRing size={RING.size} draw={ringDraw} dotProgress={dot} showLabels={false} />
      </div>
      {THREE_STEPS.map((s, i) => (
        <div
          key={s}
          style={{
            position: 'absolute',
            left: labelPos[i].left,
            top: labelPos[i].top,
            opacity: steps[i],
            transform: `translateX(${(1 - steps[i]) * 14}px)`,
          }}
        >
          <Panel accent={theme.panelBorder} style={{padding: '8px 18px'}}>
            <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{s}</span>
          </Panel>
        </div>
      ))}
    </>
  );
};

/** 工坊灯牌逐区点亮（p6-20：五区 mech 金逐区亮起；区名=系列层短名数据）。 */
const ZoneLamps: React.FC<{at20: number}> = ({at20}) => {
  const rowIn = useProgress(at20, DUR.f3);
  const lits = useStagger(LAYERS.length, {at: at20 + 4, stride: 10, dur: DUR.f4});
  return (
    <div style={{opacity: rowIn}}>
      {LAYERS.map((l, i) => {
        const lit = lits[i];
        return (
          <div key={l.index} style={{position: 'absolute', left: 230 + i * 280, top: 400}}>
            <PlateSlab3D
              layer={l}
              active={lit > 0.5}
              dim={0.55 + 0.45 * lit}
              glow={lit}
              width={250}
              height={150}
              p6
              accent={theme.mech}
            />
          </div>
        );
      })}
    </div>
  );
};

/** 6-D 收尾编排：回到开头（微缩回放＋答卡）→ 三步微环 → 收束金句 → 灯牌逐区 →
 *  全屏地图 → 家规卡＋身份卡常驻 → 灯牌收暗渐黑＋「后会有期」。 */
const FinaleChain: React.FC<{
  span: number;
  at16: number;
  at17: number;
  at18: number;
  at20: number;
  at21: number;
  at23: number;
}> = ({span, at16, at17, at18, at20, at21, at23}) => {
  const seg1Out = useProgress(at18, DUR.f4);
  const seg2Out = useProgress(at20, DUR.f4);
  const lampsOut = useProgress(at21, DUR.f4);
  const endDim = useProgress(at23, DUR.f5);
  // 渐黑窗取整镜时长（红线四——勿用末句时长）
  const keep = useFadeOut(span, {frames: 36});
  const farewell = useProgress(at23 + 6, DUR.f5);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* p6-16..17：回到开头（台面微缩回放＋五物件答卡全亮） */}
      <div style={{opacity: 1 - seg1Out}}>
        <MiniReplay at16={at16} />
        <AnswerCards at17={at17} />
      </div>

      {/* p6-18：同一件事三步微环 */}
      <div style={{opacity: 1 - seg2Out}}>
        <ThreeStepRing at18={at18} span={span} />
      </div>

      {/* p6-20：工坊灯牌逐区点亮（p6-21 让位全屏地图后收暗退场） */}
      <div style={{opacity: 1 - lampsOut}}>
        <ZoneLamps at20={at20} />
      </div>

      {/* 身份卡常驻（右侧车道，与画框同屏；p6-23 灯牌收暗随压） */}
      <div style={{opacity: 1 - 0.45 * endDim}}>
        <IdentityCard at={at17 + 10} />
      </div>

      {/* 渐黑遮罩：末 36 帧，窗取整镜时长 */}
      <AbsoluteFill style={{background: '#000', opacity: 1 - keep}} />

      {/* 完结小字（遮罩之上随收暗浮现；无下期卡——完结语气） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 492,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 38,
          color: theme.text,
          letterSpacing: 12,
          opacity: farewell,
        }}
      >
        {'后会有期'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P6Finale: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p6-01', 'p6-08');
  const bB = w('p6-09', 'p6-13');
  const bC = w('p6-14', 'p6-15');
  const bD = w('p6-16', 'p6-23');

  // 常驻条调度：6-A 栈在场（放大＋侧位常驻承担系列身份）→ 6-B/C Badge 接管 →
  // 6-D 身份卡接管。progress 纯函数且恒 clamp 在 1，让位须写成窗（进场×退场）。
  const frame = useCurrentFrame();
  const badgeO =
    progress(frame, at('p6-09') - DUR.f4, DUR.f4) * (1 - progress(frame, bD.from, DUR.f4));

  // 6-D 家规金句卡：p6-22 起常驻到镜尾（随渐黑收暗，勿在 p6-23 硬切）
  const ruleFrom = at('p6-22') - bD.from;
  const ruleSpan = Math.max(1, bD.durationInFrames - ruleFrom);

  return (
    <AbsoluteFill>
      <HarnessBadge style={{...BADGE_STYLE, opacity: badgeO}} />

      <Sequence {...bA} name="6-A 五层全亮（3D）">
        <SceneTag chapter="One Loop" tagline="循环没改" />
        {/* 3D 栈放大与五层点亮在 HarnessStackP6（终集形态，p6-05 缩至侧位常驻） */}
        <StackFinale at05={at('p6-05') - bA.from} />
        {/* cue 1/7：five-layer-dependency/five-lit-finale（本镜首图 → 默认入场） */}
        <ArchifyRecap
          slug="five-layer-dependency"
          caption="五层依赖"
          cues={[{chapterId: 'five-lit-finale', at: at('p6-02') - bA.from, durationInFrames: dur('p6-02')}]}
        />
        {/* cue 2..3/7：collab-panorama 实例一（与前图背靠背 → 后挂实例关入场） */}
        <ArchifyRecap
          slug="collab-panorama"
          caption="协作全景"
          lead={false}
          cues={[
            {chapterId: 'mech-homecoming', at: at('p6-03') - bA.from, durationInFrames: dur('p6-03')},
            {chapterId: 'tool-belt-27', at: at('p6-04') - bA.from, durationInFrames: dur('p6-04')},
          ]}
        />
        {/* 费曼遗产金句卡（p6-05 空窗岛） */}
        <Sequence from={at('p6-05') - bA.from} durationInFrames={dur('p6-05')} name="6-A 费曼金句">
          {/* caption-dup-ok: 费曼遗产句金句卡，主字已压短非逐字（storyboard 6-A 注记） */}
          <QuoteCard zh="两种身份 · 一条消息 一个工具" />
        </Sequence>
        {/* cue 4..6/7：collab-panorama 实例二（空窗一句后重现 → 默认入场） */}
        <ArchifyRecap
          slug="collab-panorama"
          caption="协作全景"
          cues={[
            {chapterId: 'identity-message', at: at('p6-06') - bA.from, durationInFrames: dur('p6-06')},
            {chapterId: 'identity-tool', at: at('p6-07') - bA.from, durationInFrames: dur('p6-07')},
            {chapterId: 'no-branch', at: at('p6-08') - bA.from, durationInFrames: dur('p6-08')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="6-B 计划门三拍终章">
        {/* 可见岛 p6-09 / p6-11..13；窗 = 本镜 1 条 cue 窗（p6-10）
            （真门骤停由章内真门停机等拍承担，回落时 ring 已静置） */}
        <ArchifyYield cues={[{at: at('p6-10') - bB.from, durationInFrames: dur('p6-10')}]}>
          <PlanGateFinale
            at09={at('p6-09') - bB.from}
            at10={at('p6-10') - bB.from}
            at11={at('p6-11') - bB.from}
            at12={at('p6-12') - bB.from}
            at13={at('p6-13') - bB.from}
          />
        </ArchifyYield>
        {/* cue 7/8：collab-panorama/gate-three-beats（no-branch 后空窗一句 → 默认入场） */}
        <ArchifyRecap
          slug="collab-panorama"
          caption="协作全景"
          cues={[{chapterId: 'gate-three-beats', at: at('p6-10') - bB.from, durationInFrames: dur('p6-10')}]}
        />
      </Sequence>

      <Sequence {...bC} name="6-C 教室与厂房">
        <ClassroomToFactory at15={at('p6-15') - bC.from} />
      </Sequence>

      <Sequence {...bD} name="6-D 系列终态（3D）">
        <FinaleChain
          span={bD.durationInFrames}
          at16={at('p6-16') - bD.from}
          at17={at('p6-17') - bD.from}
          at18={at('p6-18') - bD.from}
          at20={at('p6-20') - bD.from}
          at21={at('p6-21') - bD.from}
          at23={at('p6-23') - bD.from}
        />
        {/* p6-19 系列收束金句（终集特款） */}
        <Sequence from={at('p6-19') - bD.from} durationInFrames={dur('p6-19')} name="6-D 收束金句">
          {/* caption-dup-ok: 系列总收束句金句卡，主字已压短非逐字（storyboard 6-D 注记） */}
          <QuoteWithScrim zh="机制很多 · 循环一个" scrim />
        </Sequence>
        {/* cue 8/8：collab-panorama/all-lit-map（空窗长后重现 → 默认入场） */}
        <ArchifyRecap
          slug="collab-panorama"
          caption="协作全景"
          cues={[{chapterId: 'all-lit-map', at: at('p6-21') - bD.from, durationInFrames: dur('p6-21')}]}
        />
        {/* p6-22 家规金句卡＋身份卡常驻 */}
        <Sequence from={ruleFrom} durationInFrames={ruleSpan} name="6-D 家规金句">
          {/* caption-dup-ok: 家规句金句卡，主字已压短非逐字（storyboard 6-D 注记） */}
          <QuoteWithScrim zh="装置尽管加 · 循环不乱动" />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P6Finale;
