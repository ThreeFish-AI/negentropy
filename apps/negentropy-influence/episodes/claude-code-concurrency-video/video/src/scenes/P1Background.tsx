/** P1 自动清洗槽 · 后台线半场（p1-01..22，4 镜 12 cue）——分镜 1-A…1-D。
 *
 *  ★ 本文件为 P1 幕的装置/图镜半场（1-E/1-F 边界与产品对照由同幕另一文件承担），
 *    组装层将两者并列渲染；HarnessBadge / SceneTag 由本文件（幕首开镜侧）持有，
 *    拼装层与另一半场勿重复挂载（chip 半透明，重挂会加深）。
 *  ★ 恒定空间契约：传送带（LoopRing，core 橙恒转底盘〔M-001〕，ep1 同形）恒居
 *    左中锚位；清洗槽/登记板等后台线装置（mech 蓝）挂右缘——「装置在动而传送带
 *    不停」＝本集视觉动词（甩活瞬间仅托盘离带、带速不变——〔X-001〕防线）。
 *  ★ 1-A 的 3D 滚筒是本集唯二 3D 点缀之一（solids-3d Drum3D）：只做直角体、
 *    相机零动画、面色恒深底族、mech 只走棱线与玻璃淡染；运动量由本幕注入。
 *  archify 三图（bg-two-verdicts / bg-placeholder-receipt / bg-board-and-lock）
 *  全屏独占：一章锚一句（at+dur 同句单参）；1-C 跨镜界帧相邻接 1-B 末章，
 *  lead={false}（分镜 lead 清单）；空窗句（p1-07/11/17/18）由窗外回落装置持有画面。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel, SceneTag} from '../components/motifs';
import {QuoteCard} from '../components/cards';
import {HarnessBadge} from '../components/harness-stack';
import {Drum3D} from '../components/solids-3d';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {P1Boundary} from './P1Boundary';
import {DUR, clamp01, useCount, useEnter, useImpulse, useProgress, useSpring, useStagger} from '../motion';

/** 常驻系列条定位：顶边 y<56 归章节条，Badge 与 SceneTag 同行（P1–P6 同值） */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** LoopRing 巡游节律：2.5s/圈（与 ep1 同值——恒定锚的「节拍」也不变） */
const LAP_FRAMES = 75;

/** hex + 帧驱动透明度（无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 师傅剪影（text 白，无彩）：立于带侧、臂朝传送带——全幕同形复用 */
const MasterSilhouette: React.FC<{style?: React.CSSProperties}> = ({style}) => (
  <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...style}}>
    <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
      <circle cx={214} cy={606} r={26} fill={theme.text} opacity={0.92} />
      <path d="M160 786 Q160 662 214 654 Q268 662 268 786 Z" fill={theme.text} opacity={0.92} />
      <path d="M222 682 L156 648" stroke={theme.text} strokeWidth={9} strokeLinecap="round" opacity={0.92} />
    </svg>
    <div
      style={{
        position: 'absolute',
        left: 148,
        top: 800,
        width: 132,
        textAlign: 'center',
        fontFamily: theme.sans,
        fontSize: 22,
        color: theme.dim,
      }}
    >
      {'师傅'}
    </div>
  </div>
);

// ── 1-A 洗衣机引子 → 3D 滚筒一现 → 叠化落位右缘 ──────────────────────────

/** 滚筒翻搅节律：一圈 66 帧（等速——「装置在动」的机械读感） */
const DRUM_LAP = 66;

const WashingMachineIntro: React.FC<{
  span: number;
  atAsk: number;
  atDrum: number;
  atMin: number;
  minDur: number;
  atNoWait: number;
  atSink: number;
  atSwitch: number;
  switchDur: number;
}> = ({span, atAsk, atDrum, atMin, minDur, atNoWait, atSink, atSwitch, switchDur}) => {
  const ask = useEnter('fade', {at: atAsk, dur: DUR.f5});
  const askOut = useProgress(atDrum, DUR.f4);
  const drumIn = useProgress(atDrum, DUR.f5);
  // 翻搅：等速直行（机械感即主题——08 逃生舱口径）
  const spinSpan = Math.max(1, span - atDrum);
  const drumRun = useProgress(atDrum, spinSpan, 'linear');
  // 「三十分钟」教学叙事数字卡
  const count = useCount({from: 0, to: 30, at: atMin, dur: DUR.f6});
  const countCard = useEnter('rise', {at: atMin, dur: DUR.f5, restBottom: 720});
  // 「滴滴」完成提示：ok 瞬态一闪两拍（p1-03 句中段两次）
  const beep1 = useImpulse({at: atMin + Math.round(minDur * 0.5), dur: DUR.f5, peak: 1});
  const beep2 = useImpulse({at: atMin + Math.round(minDur * 0.75), dur: DUR.f5, peak: 1});
  const beep = Math.max(beep1, beep2);
  const noWait = useProgress(atNoWait, DUR.f4);
  // p1-05 叠化：工坊语境淡入，滚筒缩移落位右缘（画布不动、wrapper 平移缩放）
  const morph = useProgress(atSink, DUR.f6);
  const sinkLabel = useProgress(atSink + DUR.f5, DUR.f4);
  // p1-06 甩活：慢活包裹自带上弧线落进槽口 → 按下开关 → 转身回台面
  const drop = useProgress(atSwitch, DUR.f6, 'standard');
  const switchOn = useProgress(atSwitch + DUR.f3, DUR.f3);
  const turnBack = useProgress(atSwitch + Math.round(switchDur * 0.55), DUR.f5);
  // 底盘恒转（p1-05 起）：带速与甩活互不干扰
  const lapSpan = Math.max(1, span - atSink - DUR.f6);
  const laps = useProgress(atSink + DUR.f6, lapSpan, 'linear') * (lapSpan / LAP_FRAMES);

  // 包裹弧线：带上 → 槽口（确定性贝塞尔——无随机）
  const px = 500 + (1440 - 500) * drop;
  const py = 430 + (540 - 430) * drop - 150 * Math.sin(Math.PI * drop);
  const dropO = clamp01(drop * 8) * (1 - clamp01((drop - 0.9) * 10));

  return (
    <AbsoluteFill>
      {/* p1-01 设问引子小字（压短关键词） */}
      <div style={{position: 'absolute', left: 740, top: 296, opacity: ask.opacity * (1 - askOut)}}>
        <Panel style={{padding: '16px 30px', textAlign: 'center'}}>
          <span style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.text}}>{'等的问题'}</span>
          <div style={{display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginTop: 10}}>
            <span
              style={{
                width: 38,
                height: 30,
                borderRadius: 4,
                border: `2px dashed ${theme.mech}`,
                display: 'inline-block',
              }}
            />
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'慢活'}</span>
          </div>
        </Panel>
      </div>

      {/* 3D 滚筒一现：画布紧贴 3D 区域；叠化只动 wrapper（平移＋缩放），画布与相机不动 */}
      <div
        style={{
          position: 'absolute',
          left: 1000,
          top: 330,
          width: 400,
          height: 430,
          opacity: drumIn,
          transform: `translate(${240 * morph}px, ${65 * morph}px) scale(${1 - 0.22 * morph})`,
        }}
      >
        <Drum3D spin={drumRun * (spinSpan / DRUM_LAP) * 2 * Math.PI} />
      </div>
      {/* 「滴滴」完成提示（ok 瞬态，挂在滚窗旁） */}
      <div
        style={{
          position: 'absolute',
          left: 1150,
          top: 396,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          opacity: beep,
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 999,
            background: theme.ok,
            boxShadow: `0 0 ${22 * beep}px ${withAlpha(theme.ok, 0.8)}`,
            display: 'inline-block',
          }}
        />
        <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.ok}}>{'完成'}</span>
      </div>

      {/* 三十分钟数字卡（p1-03，dim 人色时间） */}
      <div
        style={{
          position: 'absolute',
          left: 480,
          top: 470,
          opacity: countCard.opacity * (1 - morph),
          transform: countCard.transform,
        }}
      >
        <Panel style={{width: 360, padding: '18px 28px'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 8}}>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 84,
                fontWeight: 700,
                color: theme.dim,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {Math.round(count)}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim}}>{'分钟'}</span>
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'人色时间'}</div>
        </Panel>
      </div>
      {/* p1-04 没人干等 */}
      <div
        style={{
          position: 'absolute',
          left: 480,
          top: 748,
          fontFamily: theme.sans,
          fontSize: 30,
          color: theme.dim,
          letterSpacing: 4,
          opacity: noWait * (1 - morph),
        }}
      >
        {'没人干等'}
      </div>

      {/* p1-05 工坊语境：左中恒转底盘 + 师傅 + 右缘墙线（后台线装置挂右缘） */}
      <div style={{position: 'absolute', left: 300, top: 420, opacity: morph}}>
        <LoopRing size={300} dotProgress={laps} showLabels={false} showExit={false} />
      </div>
      <MasterSilhouette style={{opacity: morph}} />
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: 0.5 * morph}}>
        <line x1={1872} y1={320} x2={1872} y2={880} stroke={theme.panelBorder} strokeWidth={4} />
        <line x1={1650} y1={320} x2={1872} y2={320} stroke={theme.panelBorder} strokeWidth={4} />
      </svg>
      {/* 清洗槽落位标签（mech 装置名） */}
      <div style={{position: 'absolute', left: 1300, top: 384, opacity: sinkLabel}}>
        <Panel accent={theme.mech} style={{padding: '8px 22px'}}>
          <span style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.mech}}>{'自动清洗槽'}</span>
        </Panel>
      </div>

      {/* p1-06 甩活三拍：包裹弧线入槽 → 启动开关 → 转身回台面 */}
      <div
        style={{
          position: 'absolute',
          left: px - 22,
          top: py - 18,
          width: 44,
          height: 36,
          borderRadius: 5,
          border: `2px dashed ${theme.mech}`,
          background: withAlpha(theme.mechDeep, 0.18),
          opacity: dropO,
        }}
      />
      <div style={{position: 'absolute', left: 1300, top: 806, opacity: morph}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <div
            style={{
              width: 104,
              height: 34,
              borderRadius: 999,
              border: `2px solid ${theme.mechDeep}`,
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 4 + 64 * switchOn,
                top: 3,
                width: 26,
                height: 26,
                borderRadius: 999,
                background: switchOn > 0.5 ? theme.mech : theme.dim,
              }}
            />
          </div>
          <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'启动'}</span>
        </div>
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: turnBack}}>
        <path d="M1330 700 C 1000 790, 700 790, 600 650" fill="none" stroke={theme.dim} strokeWidth={4} />
        <path d="M588 668 L600 644 L614 664" fill="none" stroke={theme.dim} strokeWidth={4} />
      </svg>

      <Footnote delay={6}>{'background task'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-B 空窗回落：判定之问（p1-07）＋ 关键词扫描灯（p1-11） ───────────────

const VerdictAsk: React.FC = () => {
  const enter = useEnter('fade', {at: 2, dur: DUR.f5});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 400, width: 1920, textAlign: 'center', ...enter}}>
        <span style={{fontFamily: theme.serif, fontSize: 56, fontWeight: 700, color: theme.text}}>{'谁说了算？'}</span>
      </div>
      {/* 判定分叉小图形：一进两出（dim 无彩） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: enter.opacity}}>
        <circle cx={960} cy={540} r={10} fill={theme.dim} />
        <path d="M960 550 C960 620, 780 620, 780 690" fill="none" stroke={theme.dim} strokeWidth={4} />
        <path d="M960 550 C960 620, 1140 620, 1140 690" fill="none" stroke={theme.dim} strokeWidth={4} />
        <path d="M768 676 L780 698 L792 676" fill="none" stroke={theme.dim} strokeWidth={4} />
        <path d="M1128 676 L1140 698 L1152 676" fill="none" stroke={theme.dim} strokeWidth={4} />
        <text x={780} y={736} textAnchor="middle" fontFamily={theme.sans} fontSize={26} fill={theme.mech}>
          {'进槽'}
        </text>
        <text x={1140} y={736} textAnchor="middle" fontFamily={theme.sans} fontSize={26} fill={theme.dim}>
          {'照跑'}
        </text>
      </svg>
      <Footnote delay={2}>{'run_in_background · slow_keywords'}</Footnote>
    </AbsoluteFill>
  );
};

/** p1-11 空窗回落：关键词扫描灯逐个亮起的小装置一现（兜底路的具象） */
const KEYWORDS = ['安装', '构建', '测试'] as const;

const KeywordLamps: React.FC = () => {
  const lamps = useStagger(KEYWORDS.length, {at: 2, stride: 10, dur: DUR.f4});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 660, top: 356}}>
        <Panel accent={theme.mechDeep} style={{width: 600, padding: '24px 32px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginBottom: 14}}>{'慢活关键词'}</div>
          {KEYWORDS.map((k, i) => (
            <div
              key={k}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                height: 64,
                opacity: 0.35 + 0.65 * lamps[i],
                transform: `translateX(${(1 - lamps[i]) * 14}px)`,
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: lamps[i] > 0.6 ? theme.mech : theme.panelBorder,
                  boxShadow: lamps[i] > 0.6 ? `0 0 ${18 * lamps[i]}px ${withAlpha(theme.mech, 0.8)}` : 'none',
                  display: 'inline-block',
                }}
              />
              <span style={{fontFamily: theme.sans, fontSize: 30, color: lamps[i] > 0.6 ? theme.text : theme.dim}}>
                {k}
              </span>
            </div>
          ))}
        </Panel>
      </div>
      <Footnote delay={2}>{'run_in_background · slow_keywords'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-C 空窗回落：号牌弹出落到师傅手里＋金句定格（p1-17） ─────────────────

const TicketHandoff: React.FC<{span: number}> = ({span}) => {
  const pop = useEnter('pop', {at: 2, dur: DUR.f4});
  // 号牌飞到师傅手里：局部帧弹簧（settle 无过冲——终态停在手边即语义）
  const fly = useSpring('settle', {at: 2 + Math.round(span * 0.3), dur: DUR.f5});
  const arrive = useImpulse({at: 2 + Math.round(span * 0.48), dur: DUR.f5});
  const quoteAt = 2 + Math.round(span * 0.6);
  // 底盘恒转 + 托盘离带（带速不变——只托盘走）
  const laps = useProgress(0, Math.max(1, span), 'linear') * (span / LAP_FRAMES);
  const tray = useProgress(8, DUR.f6, 'accelerate');

  const tx = 1440 + (270 - 1440) * fly;
  const ty = 560 + (630 - 560) * fly;

  return (
    <AbsoluteFill>
      {/* 恒转底盘（dim 化让位金句）＋离带托盘 */}
      <div style={{position: 'absolute', left: 300, top: 420, opacity: 0.55}}>
        <LoopRing size={300} dotProgress={laps} showLabels={false} showExit={false} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 428 + 940 * tray,
          top: 404 + 90 * tray,
          width: 44,
          height: 34,
          borderRadius: 5,
          border: `2px solid ${theme.coreDeep}`,
          background: withAlpha(theme.coreDeep, 0.16),
          opacity: 1 - tray,
        }}
      />
      <MasterSilhouette style={{opacity: 0.9}} />
      {/* 到手确认（ok 瞬态＝送达） */}
      <span
        style={{
          position: 'absolute',
          left: 236,
          top: 606,
          width: 22,
          height: 22,
          borderRadius: 999,
          background: theme.ok,
          opacity: arrive,
          boxShadow: `0 0 ${22 * arrive}px ${withAlpha(theme.ok, 0.8)}`,
        }}
      />
      {/* 号牌实物卡：槽口弹出 → 落到师傅手里 */}
      <div
        style={{
          position: 'absolute',
          left: tx - 90,
          top: ty - 34,
          opacity: pop.opacity,
          transform: pop.transform,
        }}
      >
        <Panel accent={theme.mech} style={{width: 180, padding: '12px 16px', textAlign: 'center'}}>
          <div style={{fontFamily: theme.mono, fontSize: 38, fontWeight: 700, color: theme.text}}>{'0001'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 2}}>{'在洗'}</div>
        </Panel>
      </div>
      {/* 金句卡（p1-17 记忆点定格〔M-003〕，压短形态） */}
      <Sequence from={quoteAt} layout="none">
        {/* caption-dup-ok: 金句卡定格记忆点——storyboard 1-C 明写压短形态豁免，与口播同拍点属刻意 */}
        <QuoteCard zh="先给号牌 · 活慢慢干" />
      </Sequence>
      <Footnote delay={2}>{'bg_0001 · [Background task started]'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-D 空窗回落：幕后簿记引子＋登记板三栏剪影（p1-18） ───────────────────

const BOARD_COLS = ['编号', '命令', '干到哪了'] as const;

const RegistryBoard: React.FC = () => {
  const intro = useEnter('fade', {at: 2, dur: DUR.f5});
  const cols = useStagger(BOARD_COLS.length, {at: 2 + DUR.f4, stride: 9, dur: DUR.f4});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 272, width: 1920, textAlign: 'center', ...intro}}>
        <span style={{fontFamily: theme.serif, fontSize: 48, fontWeight: 700, color: theme.dim}}>{'幕后簿记'}</span>
      </div>
      {/* mech 蓝登记板三栏剪影：栏头点亮＋占位行（一现，细节交给图镜） */}
      <div style={{position: 'absolute', left: 550, top: 380}}>
        <Panel accent={theme.mech} style={{width: 820, padding: '22px 28px'}}>
          <div style={{display: 'flex', gap: 24}}>
            {BOARD_COLS.map((c, i) => (
              <div key={c} style={{flex: 1, opacity: cols[i]}}>
                <div
                  style={{
                    fontFamily: theme.sans,
                    fontSize: 28,
                    fontWeight: 600,
                    color: theme.mech,
                    borderBottom: `2px solid ${withAlpha(theme.mech, 0.6)}`,
                    paddingBottom: 10,
                  }}
                >
                  {c}
                </div>
                {[0, 1].map((r) => (
                  <div
                    key={r}
                    style={{
                      height: 12,
                      marginTop: 22,
                      borderRadius: 6,
                      background: withAlpha(theme.dim, 0.22),
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Footnote delay={2}>{'background_tasks · background_lock · threading.Thread(daemon=True)'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P1Background: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p1-01', 'p1-06');
  const bB = w('p1-07', 'p1-12');
  const bC = w('p1-13', 'p1-17');
  const bD = w('p1-18', 'p1-22');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="1-A 洗衣机引子（3D 一现）">
        <SceneTag chapter="Background Task" tagline="自动清洗槽" />
        <WashingMachineIntro
          span={bA.durationInFrames}
          atAsk={at('p1-01') + Math.round(dur('p1-01') * 0.4) - bA.from}
          atDrum={at('p1-02') + Math.round(dur('p1-02') * 0.35) - bA.from}
          atMin={at('p1-03') - bA.from}
          minDur={dur('p1-03')}
          atNoWait={at('p1-04') - bA.from}
          atSink={at('p1-05') - bA.from}
          atSwitch={at('p1-06') - bA.from}
          switchDur={dur('p1-06')}
        />
      </Sequence>

      <Sequence {...bB} name="1-B 两级判定">
        {/* 窗列表与 cues 同步维护（独立字面量——覆盖门计数不串账） */}
        <ArchifyYield
          cues={[
            {at: at('p1-08') - bB.from, durationInFrames: dur('p1-08')},
            {at: at('p1-09') - bB.from, durationInFrames: dur('p1-09')},
            {at: at('p1-10') - bB.from, durationInFrames: dur('p1-10')},
            {at: at('p1-12') - bB.from, durationInFrames: dur('p1-12')},
          ]}
        >
          <Sequence durationInFrames={dur('p1-07') + DUR.f3} name="1-B 判定之问回落">
            <VerdictAsk />
          </Sequence>
          <Sequence from={at('p1-11') - bB.from} durationInFrames={dur('p1-11') + DUR.f3} name="1-B 关键词灯回落">
            <KeywordLamps />
          </Sequence>
        </ArchifyYield>
        {/* 前镜无图 → 首章默认入场；p1-11 空窗后 p1-12 重现恢复入场（实例内自动） */}
        <ArchifyRecap
          slug="bg-two-verdicts"
          caption="两级判定"
          cues={[
            {chapterId: 'two-roads', at: at('p1-08') - bB.from, durationInFrames: dur('p1-08')},
            {chapterId: 'explicit-switch', at: at('p1-09') - bB.from, durationInFrames: dur('p1-09')},
            {chapterId: 'keyword-fallback', at: at('p1-10') - bB.from, durationInFrames: dur('p1-10')},
            {chapterId: 'primary-vs-fallback', at: at('p1-12') - bB.from, durationInFrames: dur('p1-12')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="1-C 占位回执">
        <ArchifyYield
          cues={[
            {at: at('p1-13') - bC.from, durationInFrames: dur('p1-13')},
            {at: at('p1-14') - bC.from, durationInFrames: dur('p1-14')},
            {at: at('p1-15') - bC.from, durationInFrames: dur('p1-15')},
            {at: at('p1-16') - bC.from, durationInFrames: dur('p1-16')},
          ]}
        >
          <Sequence from={at('p1-17') - bC.from} durationInFrames={dur('p1-17') + DUR.f3} name="1-C 号牌金句回落">
            <TicketHandoff span={dur('p1-17')} />
          </Sequence>
        </ArchifyYield>
        {/* 跨镜界帧相邻接 1-B 末章：lead={false} 抑制画框重放入场（分镜 lead 清单） */}
        <ArchifyRecap
          lead={false}
          slug="bg-placeholder-receipt"
          caption="占位回执"
          cues={[
            {chapterId: 'sink-in-trade', at: at('p1-13') - bC.from, durationInFrames: dur('p1-13')},
            {chapterId: 'ticket-first', at: at('p1-14') - bC.from, durationInFrames: dur('p1-14')},
            {chapterId: 'belt-unpaused', at: at('p1-15') - bC.from, durationInFrames: dur('p1-15')},
            {chapterId: 'four-digit-id', at: at('p1-16') - bC.from, durationInFrames: dur('p1-16')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="1-D 登记板与锁">
        <ArchifyYield
          cues={[
            {at: at('p1-19') - bD.from, durationInFrames: dur('p1-19')},
            {at: at('p1-20') - bD.from, durationInFrames: dur('p1-20')},
            {at: at('p1-21') - bD.from, durationInFrames: dur('p1-21')},
            {at: at('p1-22') - bD.from, durationInFrames: dur('p1-22')},
          ]}
        >
          <Sequence durationInFrames={dur('p1-18') + DUR.f3} name="1-D 簿记引子回落">
            <RegistryBoard />
          </Sequence>
        </ArchifyYield>
        {/* 1-C 末 cue 后隔 p1-17 空窗 → 首章默认入场 */}
        <ArchifyRecap
          slug="bg-board-and-lock"
          caption="登记板与锁"
          cues={[
            {chapterId: 'registry-board', at: at('p1-19') - bD.from, durationInFrames: dur('p1-19')},
            {chapterId: 'daemon-thread', at: at('p1-20') - bD.from, durationInFrames: dur('p1-20')},
            {chapterId: 'lock-critical', at: at('p1-21') - bD.from, durationInFrames: dur('p1-21')},
            {chapterId: 'lock-before-write', at: at('p1-22') - bD.from, durationInFrames: dur('p1-22')},
          ]}
        />
      </Sequence>

      {/* 1-E/1-F 边界与产品对照半场（同幕另一文件，同一 scene 句窗） */}
      <P1Boundary scene={scene} />
    </AbsoluteFill>
  );
};

export default P1Background;
