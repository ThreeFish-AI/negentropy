/** P1 循环与验活（p1-01..29，7 镜 10 cue）——分镜 1-A…1-G。
 *
 *  ★ 本幕建立全片恒定视觉锚〔M-001〕：LoopRing（core 恒色、RING_STROKE 恒线宽）居左中锚位，
 *    调用点只改 size / 位置 / 周边标签，绝不覆写描边。
 *  ★ 1-A 的 3D 传送带是本集唯二 3D 点缀之一（planning §3）：只用直角体 Slab3D（方辊代替圆轮，
 *    画面里的「圆」归 LoopRing 独占）；读感来自转物体、相机零动画；面色取 solids-3d 已算过
 *    对比度的 SHELL_FACES，概念色只走棱线。3D 组件零 motion hook，运动量由本幕以 prop 注入。
 *  archify 两图（loop-anatomy / loop-verdict）全屏独占：自制装置经 ArchifyYield 让位，一章锚一句。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Footnote, LoopRing, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {SHELL_FACES, Slab3D, Stage3D, axoRotation} from '../components/solids-3d';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {
  DUR,
  clamp01,
  useCount,
  useDim,
  useDraw,
  useEnter,
  useFlowDash,
  useImpulse,
  useProgress,
  useReveal,
  useStagger,
} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位：顶边 y<56 已归 frozen ChapterProgress，Badge 按 08「HarnessBadge 共存」
 *  定案下移到 SceneTag 同一行的左侧（P1–P6 须同值，由 Integrate 统一核对）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** hex + 动态透明度（帧驱动的底色渐显；无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** LoopRing 巡游节律：2.5s/圈（全片同值，恒定锚的「节拍」也不变） */
const LAP_FRAMES = 75;

// ── 1-A 工坊剧场首秀 → 3D 传送带一现 → 收敛为 LoopRing ──────────────────

/** 锯齿屋顶工坊轮廓（四齿），整座描一笔 */
const WORKSHOP_D = (() => {
  let d = 'M120 840 V196';
  for (let i = 0; i < 4; i++) {
    d += ` L${120 + (i + 1) * 420} 136 V196`;
  }
  return `${d} V840 Z`;
})();

/** 3D 传送带尺寸（世界单位 = CSS px；正交 zoom 1） */
const BELT = {len: 500, thick: 22, width: 110, roller: 40, slats: 9, canvasW: 600, canvasH: 220} as const;

/** 3D 传送带：床板 + 行进板条 + 两端方辊。零 motion hook——travel（已走像素）由调用方注入；
 *  整体淡入淡出走外层 DOM opacity（材质恒不透明，避免半透明叠影），只有两端出入的板条按位置
 *  确定性淡化。 */
const Belt3D: React.FC<{travel: number}> = ({travel}) => {
  const {len, thick, width, roller, slats} = BELT;
  const half = len / 2;
  const spacing = len / slats;
  // 无滑移滚动：转角 = 行程 / 半径；负号 = 屏幕顺时针（上表面向右走）
  const spin = -travel / (roller / 2);
  return (
    <Stage3D width={BELT.canvasW} height={BELT.canvasH}>
      {/* 俯角 28°：看得见带面（静置角度，全程不动——宪法二） */}
      <group rotation={axoRotation({pitch: 28})}>
        <Slab3D
          width={len}
          height={thick}
          depth={width}
          skin={{face: SHELL_FACES[2], edge: theme.core, edgeOpacity: 0.85}}
          renderOrder={1}
        />
        {Array.from({length: slats}, (_, i) => {
          const x = ((((i * spacing + travel) % len) + len) % len) - half;
          const fade = clamp01(Math.min(x + half, half - x) / 36);
          return (
            <Slab3D
              key={i}
              width={34}
              height={8}
              depth={width - 8}
              position={[x, thick / 2 + 4, 0]}
              skin={{face: SHELL_FACES[0], edge: theme.core, opacity: fade, noEdges: true}}
              renderOrder={2}
            />
          );
        })}
        {[-1, 1].map((s) => (
          <Slab3D
            key={s}
            width={roller}
            height={roller}
            depth={width + 20}
            position={[s * (half + roller / 2), 0, 0]}
            rotation={[0, 0, spin]}
            skin={{face: SHELL_FACES[1], edge: theme.core}}
            renderOrder={3}
          />
        ))}
      </group>
    </Stage3D>
  );
};

/** 环心 (620, 540)：左中锚位（空间契约——内核恒居左中，装置从右缘/上缘挂入） */
const RING_A = {size: 420, left: 410, top: 330} as const;

const WorkshopOpening: React.FC<{
  span: number;
  atMaster: number;
  atHarness: number;
  atBelt: number;
  beltDur: number;
  atMotto: number;
  atCount: number;
  atSplit: number;
}> = ({span, atMaster, atHarness, atBelt, beltDur, atMotto, atCount, atSplit}) => {
  // 整座工坊轮廓：beat 级描线（~1.2s，落在 DUR 标尺外，保留显式帧数）
  const outline = useDraw(4, 36);
  const master = useEnter('fade', {at: atMaster, dur: DUR.f5});
  const harness = useProgress(atHarness, DUR.f4);
  // 3D 一现：p1-04 句首入场，句中段收敛为 2D 环
  const morphAt = atBelt + Math.round(beltDur * 0.55);
  const beltIn = useProgress(atBelt, DUR.f4);
  const beltOut = useProgress(morphAt, DUR.f5);
  // 传送带匀速：机械感即主题（08 逃生舱口径——等速线性优先于缓动）
  const beltSpan = Math.max(1, morphAt + DUR.f5 - atBelt);
  const beltRun = useProgress(atBelt, beltSpan, 'linear');
  const ringIn = useProgress(morphAt, DUR.f3);
  const ringDraw = useProgress(morphAt, DUR.f6, 'decelerate');
  // 光点先领着描线头走，描完后匀速续转——两段首尾相接，位置连续无跳变
  const runSpan = Math.max(1, span - morphAt - DUR.f6);
  const laps = useProgress(morphAt + DUR.f6, runSpan, 'linear') * (runSpan / LAP_FRAMES);
  const motto = useProgress(atMotto, DUR.f4);
  const count = useCount({from: 0, to: 30, at: atCount, dur: DUR.f6});
  const countCard = useEnter('rise', {at: atCount, dur: DUR.f5, restBottom: 740});
  const tags = useStagger(3, {at: atSplit, stride: 8, dur: DUR.f4});

  const drawn = 1 - outline.strokeDashoffset;
  const beltOpacity = beltIn * (1 - beltOut);

  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <path
          d={WORKSHOP_D}
          fill="none"
          stroke={theme.dim}
          strokeWidth={3}
          strokeLinejoin="round"
          opacity={0.55}
          {...outline}
        />
      </svg>
      {/* 通宵灯牌 */}
      <div style={{position: 'absolute', left: 1640, top: 744, opacity: drawn}}>
        <Panel style={{padding: '6px 16px'}}>
          <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>{'24h'}</span>
        </Panel>
      </div>

      {/* 师傅剪影（text 白，无彩）+ 身份标签 */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...master}}>
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
          <circle cx={210} cy={612} r={28} fill={theme.text} opacity={0.9} />
          <path d="M150 800 Q150 668 210 660 Q270 668 270 800 Z" fill={theme.text} opacity={0.9} />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 530,
            width: 120,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 24,
            color: theme.dim,
          }}
        >
          {'模型'}
        </div>
      </div>

      {/* 工坊 = Harness（p1-03） */}
      <div style={{position: 'absolute', left: 150, top: 350, opacity: harness}}>
        <Panel style={{padding: '8px 18px', display: 'flex', alignItems: 'baseline', gap: 12}}>
          <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.text}}>{'Harness'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'= 工坊'}</span>
        </Panel>
      </div>

      {/* 3D 传送带一现（p1-04）：画布紧贴 3D 区域，只在出场窗口内挂载 */}
      <div
        style={{
          position: 'absolute',
          left: 620 - BELT.canvasW / 2,
          top: 540 - BELT.canvasH / 2,
          width: BELT.canvasW,
          height: BELT.canvasH,
          opacity: beltOpacity,
        }}
      >
        <Sequence from={atBelt} durationInFrames={beltSpan + 1} layout="none">
          <Belt3D travel={beltRun * beltSpan * 3} />
        </Sequence>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 470,
          top: 660,
          width: 300,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.dim,
          opacity: beltOpacity,
        }}
      >
        {'传送带'}
      </div>

      {/* 收敛定格：LoopRing 首锚〔M-001〕 */}
      <div style={{position: 'absolute', left: RING_A.left, top: RING_A.top, opacity: ringIn}}>
        <LoopRing size={RING_A.size} draw={ringDraw} dotProgress={ringDraw + laps} showLabels={false} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: RING_A.size / 2 - 20,
            width: RING_A.size,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 32,
            fontWeight: 600,
            color: theme.text,
            opacity: ringDraw,
          }}
        >
          {'主循环'}
        </div>
      </div>

      {/* 金句卡（p1-05）：最小配置 */}
      <div style={{position: 'absolute', left: 560, top: 200, width: 1360, height: 150}}>
        <Sequence from={atMotto} layout="none">
          <QuoteCard zh="一个工具 · 一个循环 · 一个 Agent" />
        </Sequence>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 560,
          top: 340,
          width: 1360,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.dim,
          letterSpacing: 4,
          opacity: motto,
        }}
      >
        {'最小配置'}
      </div>

      {/* 数字卡（p1-06）：循环内核口径 */}
      <div style={{position: 'absolute', left: 1030, top: 560, ...countCard}}>
        <Panel accent={theme.core} style={{width: 420, padding: '14px 26px'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 6}}>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 84,
                fontWeight: 700,
                color: theme.core,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {Math.round(count)}
            </span>
            <span style={{fontFamily: theme.mono, fontSize: 56, color: theme.core}}>{'+'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim, marginLeft: 10}}>{'行'}</span>
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'循环内核'}</div>
        </Panel>
      </div>

      {/* 分工伏笔（p1-07）：想 / 干 / 收尾收账 */}
      <div style={{position: 'absolute', left: 262, top: 560, opacity: tags[0]}}>
        <Panel style={{padding: '4px 14px'}}>
          <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>{'想'}</span>
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 440, top: 352, opacity: tags[1]}}>
        <Panel accent={theme.core} style={{padding: '4px 14px'}}>
          <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.core}}>{'干'}</span>
        </Panel>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1030,
          top: 750,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
          opacity: tags[2],
        }}
      >
        {'↺ 收尾收账'}
      </div>

      <Footnote delay={atHarness}>{'Harness · Agent'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-C 验活分屏：看手里 · 不看嘴上 ──────────────────────────────────────

const HAND_ROWS = [
  {k: 'text', v: '说明文字', hot: false},
  {k: 'tool_use', v: 'read_file', hot: true},
  {k: 'tool_use', v: 'bash', hot: true},
] as const;

const VerdictSplit: React.FC<{atSplit: number; atHold: number}> = ({atSplit, atHold}) => {
  const ask = useProgress(2, DUR.f5);
  const askOut = useProgress(atSplit, DUR.f4);
  const split = useEnter('fade', {at: atSplit, dur: DUR.f5});
  const rows = useStagger(HAND_ROWS.length, {at: atSplit + DUR.f5, stride: 8, dur: DUR.f4});
  // 嘴上栏压暗：判据只认手里（终态停驻，不加持续动效——M-003）
  const mouth = useDim({at: atSplit + DUR.f6, to: 0.4, dur: DUR.f5});
  const verdict = useProgress(atHold, DUR.f5);

  return (
    <AbsoluteFill>
      {/* p1-13 设问 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 470,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 56,
          color: theme.dim,
          opacity: ask * (1 - askOut),
        }}
      >
        {'继续 ？ 停下'}
      </div>

      {/* 题词（p1-14 记忆点） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 176,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 50,
          fontWeight: 700,
          opacity: split.opacity,
        }}
      >
        <span style={{color: theme.core}}>{'看手里'}</span>
        <span style={{color: theme.dim}}>{' · '}</span>
        <span style={{color: theme.dim}}>{'不看嘴上'}</span>
      </div>

      {/* 左：手里（内容块清单） */}
      <div style={{position: 'absolute', left: 260, top: 290, ...split}}>
        <Panel accent={theme.coreDeep} style={{width: 640, padding: '22px 28px'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 14}}>
            <span style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 700, color: theme.text}}>{'手里'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'content blocks'}</span>
          </div>
          {HAND_ROWS.map((r, i) => (
            <div
              key={`${r.k}-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                height: 66,
                marginTop: 8,
                paddingLeft: 16,
                borderRadius: 8,
                borderLeft: `4px solid ${r.hot ? theme.core : theme.panelBorder}`,
                background: r.hot ? withAlpha(theme.coreDeep, 0.5 * rows[i]) : 'transparent',
                opacity: rows[i],
                transform: `translateY(${(1 - rows[i]) * 12}px)`,
                fontFamily: theme.mono,
                fontSize: 28,
              }}
            >
              <span style={{width: 190, color: r.hot ? theme.text : theme.dim}}>{r.k}</span>
              <span style={{color: theme.dim}}>{r.v}</span>
            </div>
          ))}
        </Panel>
      </div>

      {/* 右：嘴上（停止标记，灰置） */}
      <div style={{position: 'absolute', left: 1020, top: 290, opacity: split.opacity * mouth, transform: split.transform}}>
        <Panel style={{width: 640, padding: '22px 28px'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 14}}>
            <span style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 700, color: theme.text}}>{'嘴上'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'stop marker'}</span>
          </div>
          <div
            style={{
              marginTop: 18,
              padding: '26px 24px',
              border: `2px dashed ${theme.panelBorder}`,
              borderRadius: 12,
              fontFamily: theme.mono,
              fontSize: 30,
              color: theme.dim,
            }}
          >
            {'stop_reason: "end_turn"'}
          </div>
        </Panel>
      </div>

      {/* 判据终态（p1-16 句中点仍可读——M-003） */}
      <div
        style={{
          position: 'absolute',
          left: 290,
          top: 700,
          fontFamily: theme.mono,
          fontSize: 26,
          lineHeight: 1.7,
          opacity: verdict,
        }}
      >
        <div style={{color: theme.core}}>{'tool_use ≥ 1  →  接着转'}</div>
        <div style={{color: theme.dim}}>{'tool_use = 0  →  退出'}</div>
      </div>

      <Footnote delay={atSplit}>{'tool_use · stop marker'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-D 两修订对撞卡（p1-18 空窗句） ───────────────────────────────────

const RevisionClash: React.FC = () => {
  const left = useEnter('pop', {at: 2, dur: DUR.f4});
  const right = useEnter('pop', {at: 2 + DUR.f3, dur: DUR.f4});
  const card = (tag: string) => (
    <Panel accent={theme.dim} style={{width: 440, padding: '30px 34px', textAlign: 'center'}}>
      <div style={{fontFamily: theme.mono, fontSize: 40, color: theme.text}}>{tag}</div>
      <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginTop: 12}}>{'判据 ?'}</div>
    </Panel>
  );
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 400, top: 400, ...left}}>{card('修订 A')}</div>
      <div style={{position: 'absolute', left: 1080, top: 400, ...right}}>{card('修订 B')}</div>
      <div
        style={{
          position: 'absolute',
          left: 860,
          top: 440,
          width: 200,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 80,
          fontWeight: 700,
          color: theme.dim,
          opacity: right.opacity,
        }}
      >
        {'≠'}
      </div>
      <Footnote delay={2}>{'stop_reason'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-E 【三】引语卡（mono 引语态） ─────────────────────────────────────

const AuthorQuote: React.FC<{atSecond: number; secondDur: number}> = ({atSecond, secondDur}) => {
  const card = useEnter('fade', {at: 2, dur: DUR.f5});
  // p1-23 只立归属头；正文随 p1-24 逐字流出（先否定、后补位）
  const line1 = useReveal('stop marker ≠ 唯一依据', {at: atSecond + 4, cps: 14});
  const line2 = useReveal('+ 独立标志位', {at: atSecond + Math.round(secondDur * 0.55), cps: 10});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 360, top: 300, ...card}}>
        <Panel style={{width: 1200, padding: '30px 40px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
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
              {'【三】'}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'开源项目作者 · 源码分析'}</span>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 44, lineHeight: 1.7, marginTop: 22, minHeight: 150}}>
            <span style={{fontFamily: theme.serif, fontSize: 60, color: theme.panelBorder}}>{'“'}</span>
            <div style={{color: theme.text, whiteSpace: 'pre'}}>{line1}</div>
            <div style={{color: theme.core, whiteSpace: 'pre'}}>{line2}</div>
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 1-F 官方三段式 + 打断演示 ───────────────────────────────────────────

const PHASES = [
  {zh: '收集上下文', en: 'gather context'},
  {zh: '行动', en: 'take action'},
  {zh: '验证结果', en: 'verify results'},
] as const;

const OfficialPhases: React.FC<{atInterrupt: number; interruptDur: number}> = ({atInterrupt, interruptDur}) => {
  const lit = useStagger(PHASES.length, {at: 8, stride: 14, dur: DUR.f5});
  const blend = useProgress(8 + 2 * 14 + DUR.f5, DUR.f5);
  const flow = useFlowDash({dash: 10, gap: 12, period: 36});
  const runIn = useProgress(atInterrupt, DUR.f4);
  const pressAt = atInterrupt + Math.round(interruptDur * 0.55);
  // 进度条匀速推进，按键瞬间冻结在 70%（被取消的调用停在半路）
  const running = useProgress(atInterrupt, Math.max(1, pressAt - atInterrupt), 'linear');
  const press = useImpulse({at: pressAt, dur: DUR.f5});
  const cancel = useProgress(pressAt + 2, DUR.f4);

  return (
    <AbsoluteFill>
      {PHASES.map((p, i) => (
        <div key={p.en} style={{position: 'absolute', left: 300 + i * 480, top: 290, opacity: 0.25 + 0.75 * lit[i]}}>
          <Panel
            accent={lit[i] > 0.5 ? theme.mech : theme.panelBorder}
            style={{width: 360, padding: '22px 24px', textAlign: 'center'}}
          >
            <div style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 700, color: theme.text}}>{p.zh}</div>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 6}}>{p.en}</div>
          </Panel>
        </div>
      ))}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        {[0, 1].map((i) => (
          <g key={i} opacity={lit[i + 1]}>
            <line x1={670 + i * 480} y1={360} x2={770 + i * 480} y2={360} stroke={theme.mech} strokeWidth={4} />
            <path
              d={`M${758 + i * 480} 350 L${772 + i * 480} 360 L${758 + i * 480} 370`}
              fill="none"
              stroke={theme.mech}
              strokeWidth={4}
            />
          </g>
        ))}
        {/* 三段互相掺着：验证回流到收集 */}
        <path
          d="M1440 440 C 1440 540, 480 540, 480 440"
          fill="none"
          stroke={theme.mechDeep}
          strokeWidth={3}
          opacity={blend}
          {...flow}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 530,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.dim,
          opacity: blend,
        }}
      >
        {'互相掺着'}
      </div>

      {/* 打断（p1-28）：正在跑的调用 + 退出键 */}
      <div style={{position: 'absolute', left: 560, top: 610, opacity: runIn}}>
        <Panel accent={cancel > 0.5 ? theme.panelBorder : theme.mech} style={{width: 500, padding: '16px 22px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
            <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.text, opacity: 1 - 0.5 * cancel}}>
              {'tool_use · bash'}
            </span>
            <span style={{position: 'relative', width: 110, height: 30, fontFamily: theme.sans, fontSize: 22}}>
              <span style={{position: 'absolute', right: 0, color: theme.mech, opacity: 1 - cancel}}>{'运行中'}</span>
              <span style={{position: 'absolute', right: 0, color: theme.dim, opacity: cancel}}>{'已取消'}</span>
            </span>
          </div>
          <div style={{marginTop: 12, height: 8, borderRadius: 4, background: theme.panelBorder, position: 'relative'}}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: 8,
                borderRadius: 4,
                width: `${70 * running}%`,
                background: cancel > 0.5 ? theme.dim : theme.mech,
              }}
            />
          </div>
        </Panel>
        {/* 取消划线 */}
        <div
          style={{
            position: 'absolute',
            left: 18,
            top: 34,
            height: 3,
            width: 250 * cancel,
            background: theme.dim,
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1180,
          top: 616,
          opacity: runIn,
          transform: `translateY(${4 * press}px)`,
        }}
      >
        <div
          style={{
            width: 120,
            height: 84,
            borderRadius: 14,
            border: `3px solid ${theme.dim}`,
            background: theme.panel,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.mono,
            fontSize: 32,
            color: theme.text,
            boxShadow: `0 0 ${28 * press}px ${withAlpha(theme.dim, 0.8 * press)}`,
          }}
        >
          {'Esc'}
        </div>
        {/* 用户手势（人色 dim，无彩） */}
        <svg width={40} height={44} style={{position: 'absolute', left: 96, top: 58}}>
          <path d="M2 2 L2 34 L10 26 L16 40 L22 37 L16 24 L28 24 Z" fill={theme.dim} />
        </svg>
      </div>

      <Footnote delay={8}>{'gather context · take action · verify results · Esc'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-G 散装护栏快闪 → 流向下一件装置 ───────────────────────────────────

const GUARDS = [
  {zh: '提示词', en: "Act, don't explain."},
  {zh: '危险清单', en: 'command blocked'},
  {zh: '超时截断', en: 'timeout · truncate'},
] as const;

const Guardrails: React.FC<{span: number}> = ({span}) => {
  const cards = useStagger(GUARDS.length, {at: 4, stride: 6, dur: DUR.f4});
  const shrinkAt = Math.round(span * 0.6);
  const shrink = useProgress(shrinkAt, DUR.f5);
  const flowIn = useProgress(shrinkAt, DUR.f5);
  const slotIn = useProgress(shrinkAt + DUR.f3, DUR.f5);
  const flow = useFlowDash({dash: 14, gap: 12, period: 30});
  const laps = useProgress(0, Math.max(1, span), 'linear') * (span / LAP_FRAMES);

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 180, top: 390}}>
        <LoopRing size={300} dotProgress={laps} showLabels={false} showExit={false} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 700,
          top: 300,
          width: 1000,
          display: 'flex',
          gap: 30,
          transformOrigin: '50% 0',
          transform: `translateY(${-60 * shrink}px) scale(${1 - 0.35 * shrink})`,
          opacity: 1 - 0.6 * shrink,
        }}
      >
        {GUARDS.map((g, i) => (
          <div key={g.zh} style={{opacity: cards[i], transform: `translateY(${(1 - cards[i]) * 16}px)`}}>
            <Panel accent={theme.mechDeep} style={{width: 310, padding: '20px 22px'}}>
              <div style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 600, color: theme.text}}>{g.zh}</div>
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 8}}>{g.en}</div>
            </Panel>
          </div>
        ))}
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <path
          d="M440 540 C 820 540, 1080 760, 1430 760"
          fill="none"
          stroke={theme.core}
          strokeWidth={4}
          opacity={flowIn}
          {...flow}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 1440,
          top: 712,
          width: 300,
          height: 96,
          borderRadius: 14,
          border: `2px dashed ${theme.mech}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.sans,
          fontSize: 28,
          color: theme.mech,
          opacity: slotIn,
        }}
      >
        {'下一件装置'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P1LoopVerify: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（某句起始帧）；dur() = 与 at 对称的单句取长（cue 窗必须落在同一句 id 上）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p1-01', 'p1-07');
  const bB = w('p1-08', 'p1-12');
  const bC = w('p1-13', 'p1-16');
  const bD = w('p1-18', 'p1-22');
  const bE = w('p1-23', 'p1-26');
  const bF = w('p1-27', 'p1-28');
  const bG = w('p1-29');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="1-A 工坊剧场首秀（3D 一现）">
        <SceneTag chapter="Agent Loop" tagline="传送带与判据" />
        <WorkshopOpening
          span={bA.durationInFrames}
          atMaster={at('p1-02') - bA.from}
          atHarness={at('p1-03') - bA.from}
          atBelt={at('p1-04') - bA.from}
          beltDur={dur('p1-04')}
          atMotto={at('p1-05') - bA.from}
          atCount={at('p1-06') - bA.from}
          atSplit={at('p1-07') - bA.from}
        />
      </Sequence>

      <Sequence {...bB} name="1-B 循环三步">
        {/* 五句五接力、实例内背靠背自动抑制换章弹入；前镜无图 → 首章默认入场 */}
        <ArchifyRecap
          slug="loop-anatomy"
          caption="循环解剖"
          cues={[
            {chapterId: 'belt-turn', at: at('p1-08') - bB.from, durationInFrames: dur('p1-08')},
            {chapterId: 'append-first', at: at('p1-09') - bB.from, durationInFrames: dur('p1-09')},
            {chapterId: 'hand-check', at: at('p1-10') - bB.from, durationInFrames: dur('p1-10')},
            {chapterId: 'no-tool-exit', at: at('p1-11') - bB.from, durationInFrames: dur('p1-11')},
            {chapterId: 'pair-backfill', at: at('p1-12') - bB.from, durationInFrames: dur('p1-12')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="1-C 验活分屏">
        <VerdictSplit atSplit={at('p1-14') - bC.from} atHold={at('p1-16') - bC.from} />
      </Sequence>

      <Sequence {...bD} name="1-D 判据对撞">
        {/* 可见岛 p1-18；窗 = 本镜 4 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p1-19') - bD.from, durationInFrames: dur('p1-19')},
            {at: at('p1-20') - bD.from, durationInFrames: dur('p1-20')},
            {at: at('p1-21') - bD.from, durationInFrames: dur('p1-21')},
            {at: at('p1-22') - bD.from, durationInFrames: dur('p1-22')},
          ]}
        >
          {/* 多挂 f3 帧：让位淡出盖满后再卸载，避免装置一帧消失 */}
          <Sequence durationInFrames={dur('p1-18') + DUR.f3}>
            <RevisionClash />
          </Sequence>
        </ArchifyYield>
        {/* p1-12 之后隔 p1-13..18 空档 → 默认入场 */}
        <ArchifyRecap
          slug="loop-verdict"
          caption="判据之争"
          cues={[
            {chapterId: 'two-revisions', at: at('p1-19') - bD.from, durationInFrames: dur('p1-19')},
            {chapterId: 'trust-mouth', at: at('p1-20') - bD.from, durationInFrames: dur('p1-20')},
            {chapterId: 'trust-hand', at: at('p1-21') - bD.from, durationInFrames: dur('p1-21')},
            {chapterId: 'official-silent', at: at('p1-22') - bD.from, durationInFrames: dur('p1-22')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="1-E 作者引语与独立标志位">
        {/* 可见岛 p1-23..24 / p1-26；窗 = 本镜 1 条 cue 窗 */}
        <ArchifyYield cues={[{at: at('p1-25') - bE.from, durationInFrames: dur('p1-25')}]}>
          <Sequence durationInFrames={at('p1-25') - bE.from + DUR.f3}>
            <AuthorQuote atSecond={at('p1-24') - bE.from} secondDur={dur('p1-24')} />
          </Sequence>
        </ArchifyYield>
        {/* p1-22 之后隔 p1-23..24 空档 → 默认入场 */}
        <ArchifyRecap
          slug="loop-verdict"
          caption="判据之争"
          cues={[{chapterId: 'flag-flips', at: at('p1-25') - bE.from, durationInFrames: dur('p1-25')}]}
        />
        <Sequence from={at('p1-26') - bE.from} name="1-E 回落衬线小卡">
          <QuoteCard zh="声明 滞于事实" />
        </Sequence>
      </Sequence>

      <Sequence {...bF} name="1-F 官方三段式与打断">
        <OfficialPhases atInterrupt={at('p1-28') - bF.from} interruptDur={dur('p1-28')} />
      </Sequence>

      <Sequence {...bG} name="1-G 散装护栏">
        <Guardrails span={bG.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1LoopVerify;
