/** P6 环形走廊（p6-01..31，11 镜 5 cue）——分镜 6-A…6-K（终集收尾）。
 *
 *  cue 清单（5）：
 *   6-B collab-panorama four-prep@p6-05（跨句扩窗 dur 求和盖 p6-05..06——
 *      空格自填后逐格点亮，接 6-C 首章构成跨镜界背靠背）
 *   6-C collab-panorama llm-judge@p6-07 / dispatch@p6-08 / externals@p6-09
 *      （前两章与 6-B 末章镜界紧邻 → lead={false}；externals 隔 p6-08a..c 空窗
 *      须独立实例恢复入场——实例级 false 会压掉空窗章的 enters；空窗=慢活走查装置）
 *   6-K five-layer-dependency five-lit-finale@p6-30（五层全亮终态，系列身份卡底图）
 *
 *  ★ 6-A 第七件揭晓：坐标装置放大回全屏——六设施灯全亮、CorridorRing 描画点亮
 *    贯通全楼〔M-001：core 橙 6px 定妆〕＋标题回收帧「第七件设施」@impulse。
 *  ★ 6-E 五增量·合口：缺口①② 标记点亮（@impulse＋@count 2/2）、走廊冻结帧、
 *    4-D 的虚线在此换实线。
 *  ★ 6-G 数字卡：useCount 27 滚动点名＋2130 行标尺 @draw＋双档口径色角标
 *    （教学码实测=mech / 讲义口径=dim；27 件工具名无信源清单——以编号点名，不杜撰）。
 *  ★ 6-K 终章：HarnessStackP6（series-layers next=null——终集无下期层，勿加下期卡）
 *    ＋系列金句压底＋FinaleTail（渐黑窗从末 beat 总时长推导——红线四；完结语
 *    @reveal）。挂 6-K Sequence 最后子节点。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CorridorRing, Footnote, Panel, SceneTag} from '../components/motifs';
import {ACTIVE_INDEX, HarnessBadge, HarnessStackP6, LAYERS} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {
  DUR,
  clamp01,
  progress,
  useBreathe,
  useCount,
  useDim,
  useDraw,
  useEnter,
  useFadeOut,
  useFlowDash,
  useImpulse,
  useProgress,
  useReveal,
  useStagger,
  useTravel,
} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const BADGE_STYLE: React.CSSProperties = {top: 64};

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 6-A 第七件揭晓 ──────────────────────────────────────────────────────

/** 坐标装置放大回全屏：六设施灯全亮（stagger）＋走廊环描画点亮（〔M-001〕）
 *  ＋标题回收帧＋「全组最重要一张表」引子。 */
const SeventhReveal: React.FC<{at02: number; at03: number}> = ({at02, at03}) => {
  const frame = useCurrentFrame();
  const lodgeIn = useProgress(2, DUR.f5);
  // 六设施灯全亮（下层五格＋楼上房带）
  const lamps = useStagger(6, {at: 8, dur: DUR.f4, stride: 8});
  // 走廊环：p6-02 描画点亮贯通全楼（decelerate 描线约 1.3s——beat 级保留显式帧数，铁律④）
  const ringDraw = progress(frame, at02 + 6, 40);
  const breathe = useBreathe({period: 56, amp: 0.5, base: 0.5});
  // 标题回收帧（第七件设施）
  const title = useImpulse({at: at02 + 40, dur: DUR.f6, peak: 1});
  const titleO = useProgress(at02 + 38, DUR.f4);
  // p6-03「全组最重要一张表」
  const tableO = useProgress(at03 + 6, DUR.f4);
  const cells = ['墙', '口', '簿', '钟', '座'];
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 410, top: 170, opacity: lodgeIn}}>
        <svg width={1100} height={560}>
          {/* 楼体外框＋楼层分隔 */}
          <rect x={0} y={0} width={1100} height={560} rx={14} fill="#10151d" stroke={theme.panelBorder} strokeWidth={3} />
          <line x1={0} y1={200} x2={1100} y2={200} stroke={theme.panelBorder} strokeWidth={2} opacity={0.8} />
          {/* 楼上房带（第六件·门牌房——已亮） */}
          {[0, 1, 2, 3].map((i) => (
            <g key={i} opacity={0.4 + 0.6 * lamps[5]}>
              <rect x={90 + i * 240} y={54} width={190} height={104} rx={8} fill={withAlpha(theme.mechDeep, 0.16 + 0.2 * lamps[5])} stroke={theme.mechDeep} strokeWidth={2.5} />
            </g>
          ))}
          <text x={46} y={114} fontFamily={theme.sans} fontSize={24} fill={lamps[5] > 0.5 ? theme.text : theme.dim} opacity={0.85}>
            {'房'}
          </text>
          {/* 楼下五设施（全亮） */}
          {cells.map((c, i) => (
            <g key={c}>
              <rect x={70 + i * 196} y={262} width={160} height={180} rx={10} fill={withAlpha(theme.accent, 0.06 + 0.14 * lamps[i])} stroke={lamps[i] > 0.5 ? theme.accent : theme.panelBorder} strokeWidth={lamps[i] > 0.5 ? 3 : 2} />
              {/* 灯（设施位顶灯） */}
              <circle cx={150 + i * 196} cy={316} r={13} fill={lamps[i] > 0.5 ? theme.accent : theme.panelBorder} opacity={0.45 + 0.55 * lamps[i]} />
              <text x={150 + i * 196} y={408} textAnchor="middle" fontFamily={theme.sans} fontSize={34} fontWeight={600} fill={lamps[i] > 0.5 ? theme.text : theme.dim}>
                {c}
              </text>
            </g>
          ))}
          {/* 第七位（揭晓中——环贯通全楼） */}
          <text x={1010} y={408} textAnchor="middle" fontFamily={theme.serif} fontSize={44} fontWeight={700} fill={theme.concept} opacity={titleO}>
            {'七'}
          </text>
        </svg>
        {/* 走廊环（core 橙 6px 定妆〔M-001〕——描画点亮＋呼吸辉光，绕楼一圈） */}
        <div style={{position: 'absolute', left: 440, top: 168}}>
          <CorridorRing size={220} draw={ringDraw} glow={breathe * ringDraw} />
        </div>
      </div>

      {/* 标题回收帧 */}
      <div
        style={{
          position: 'absolute',
          left: 700,
          top: 746,
          opacity: titleO,
          transform: `scale(${0.9 + 0.1 * title})`,
          fontFamily: theme.serif,
          fontSize: 44,
          fontWeight: 700,
          color: theme.concept,
          textShadow: `0 0 ${20 * title}px ${withAlpha(theme.concept, 0.45 * title)}`,
        }}
      >
        {'第七件 · 环形走廊'}
      </div>
      {/* p6-03 引子（全组最重要一张表） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 828, textAlign: 'center', opacity: tableO}}>
        <span style={{fontFamily: theme.sans, fontSize: 27, color: theme.dim}}>{'集成版 · 每个机制住哪一格'}</span>
      </div>
      <Footnote delay={12}>{'comprehensive · 单循环集成'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 6-B 终考·空格自填 ────────────────────────────────────────────────────

/** 沿途图空格态（p6-04 前置帧）：格子虚线＋「?」，观众自填（标签由 four-prep 章揭晓，
 *  空格态不得提前写出——storyboard 6-B「先不揭晓」契约）。 */
const BlankPanorama: React.FC = () => {
  const fade = useEnter('fade', {at: 2, dur: DUR.f4});
  const cells = ['?', '?', '?', '?'];
  const frame = useCurrentFrame();
  const blink = 0.55 + 0.45 * Math.sin(frame / 7);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 330, top: 330, display: 'flex', gap: 30, ...fade}}>
        {cells.map((c) => (
          <div
            key={c}
            style={{
              width: 280,
              height: 200,
              boxSizing: 'border-box',
              borderRadius: 12,
              border: `3px dashed ${theme.panelBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.sans,
              fontSize: 30,
              color: theme.dim,
              opacity: blink,
            }}
          >
            {c}
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 620, textAlign: 'center', ...fade}}>
        <span style={{fontFamily: theme.serif, fontSize: 30, color: theme.dim}}>{'一轮走完 · 路过哪些格子？'}</span>
      </div>
    </AbsoluteFill>
  );
};

// ── 6-C 空窗：慢活走查 ──────────────────────────────────────────────────

/** 慢活走一条（p6-08a..c）：装包命令→判定慢→占位回执（后台在跑）→后台线程→
 *  通知回流准备区（下一轮接着收尾）。 */
const SlowJobTrace: React.FC<{atA: number; span: number}> = ({atA, span}) => {
  const steps = useStagger(5, {at: atA + 4, dur: DUR.f4, fit: {total: Math.max(30, span - atA - 8)}});
  // 后台车道行进（后台线程跑完）
  const flow = useFlowDash({dash: 12, gap: 16, period: 20});
  // 通知回流点（沿环巡游——回到准备区）
  const loop = useTravel({cx: 1500, cy: 420, r: 44, secPerLap: 2.6});
  const backO = steps[4];
  return (
    <AbsoluteFill>
      {/* 步骤条（五步） */}
      <div style={{position: 'absolute', left: 250, top: 300, display: 'flex', alignItems: 'center', gap: 14}}>
        {[
          {t: '装包', s: 'install'},
          {t: '判定慢', s: 'slow'},
          {t: '占位回执', s: 'background'},
          {t: '后台跑', s: 'thread'},
          {t: '通知回流', s: 'notify'},
        ].map((st, i) => (
          <React.Fragment key={st.t}>
            <div style={{opacity: steps[i], transform: `translateY(${(1 - steps[i]) * 12}px)`}}>
              <div
                style={{
                  width: 200,
                  boxSizing: 'border-box',
                  padding: '16px 14px',
                  borderRadius: 10,
                  background: theme.panel,
                  border: `2px solid ${i === 2 ? theme.accent : theme.panelBorder}`,
                  textAlign: 'center',
                }}
              >
                <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: i === 2 ? theme.accent : theme.text}}>{st.t}</div>
                <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 4}}>{st.s}</div>
              </div>
            </div>
            {i < 4 ? (
              <svg width={46} height={20} opacity={steps[i + 1]}>
                <line x1={2} y1={10} x2={40} y2={10} stroke={theme.dim} strokeWidth={3} />
                <path d="M34 4 L42 10 L34 16" fill="none" stroke={theme.dim} strokeWidth={3} />
              </svg>
            ) : null}
          </React.Fragment>
        ))}
      </div>
      {/* 后台车道（行进虚线——后台线程） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: steps[3]}}>
        <path d="M620 560 C 900 640, 1200 640, 1456 500" fill="none" stroke={theme.panelBorder} strokeWidth={3} />
        <path d="M620 560 C 900 640, 1200 640, 1456 500" fill="none" stroke={theme.accent} strokeWidth={4} {...flow} />
      </svg>
      {/* 准备区回流环（通知流回准备区——下一轮收尾） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: backO}}>
        <circle cx={1500} cy={420} r={44} fill="none" stroke={theme.concept} strokeWidth={4} opacity={0.75} />
        <circle cx={loop.x} cy={loop.y} r={9} fill={theme.concept} />
        <text x={1500} y={508} textAnchor="middle" fontFamily={theme.mono} fontSize={19} fill={theme.dim}>
          {'准备区 · 下一轮'}
        </text>
      </svg>
      {/* 占位回执卡（不用等） */}
      <div style={{position: 'absolute', left: 560, top: 620, opacity: steps[2]}}>
        <Panel accent={theme.accent} style={{width: 420, boxSizing: 'border-box', padding: '14px 24px'}}>
          <span style={{fontFamily: theme.sans, fontSize: 25, color: theme.text}}>{'后台在跑 · 不用等'}</span>
        </Panel>
      </div>
      <Footnote delay={10}>{'background · task_notification'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 6-D 判据卡 ──────────────────────────────────────────────────────────

/** 判据卡：工具调用块在场 ✓ vs 嘴上说的停 ✕（角标 tool_use / stop_reason）；
 *  金句位「看单子，不看嘴」。 */
const JudgeCard: React.FC<{at10: number; dur10: number; at11: number}> = ({at10, dur10, at11}) => {
  const rise = useEnter('rise', {at: 6, dur: DUR.f5, springPreset: 'settle', dist: 28});
  const o = useProgress(6, DUR.f4);
  // ✕ 挂 p6-10 尾段（口播「看的不是模型嘴上说的停」）；✓ 与金句同锚 p6-11（工具调用块）
  const cross = useImpulse({at: at10 + Math.round(dur10 * 0.75), dur: DUR.f6, peak: 1});
  const check = useImpulse({at: at11, dur: DUR.f6, peak: 1});
  const quote = useProgress(at11, DUR.f4);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 430, top: 280, ...rise, opacity: o}}>
        <Panel style={{width: 1060, boxSizing: 'border-box', padding: '30px 40px'}}>
          <div style={{display: 'flex', gap: 40}}>
            {/* 左：在场 ✓ */}
            <div style={{flex: 1, borderRadius: 12, border: `2.5px solid ${theme.ok}`, padding: '22px 26px', background: withAlpha(theme.ok, 0.05)}}>
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'tool_use'}</div>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12}}>
                <span style={{fontFamily: theme.sans, fontSize: 33, fontWeight: 600, color: theme.text}}>{'工具调用块 · 在场'}</span>
                <span style={{fontFamily: theme.sans, fontSize: 52, fontWeight: 700, color: theme.ok, transform: `scale(${0.8 + 0.2 * check})`, textShadow: `0 0 ${14 * check}px ${withAlpha(theme.ok, 0.5)}`}}>
                  {'✓'}
                </span>
              </div>
            </div>
            {/* 右：嘴上说的停 ✕ */}
            <div style={{flex: 1, borderRadius: 12, border: `2.5px solid ${theme.danger}`, padding: '22px 26px', background: withAlpha(theme.danger, 0.05)}}>
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'stop_reason'}</div>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12}}>
                <span style={{fontFamily: theme.sans, fontSize: 33, fontWeight: 600, color: theme.dim}}>{'嘴上说的停'}</span>
                <span style={{fontFamily: theme.sans, fontSize: 52, fontWeight: 700, color: theme.danger, transform: `scale(${0.8 + 0.2 * cross})`, textShadow: `0 0 ${14 * cross}px ${withAlpha(theme.danger, 0.5)}`}}>
                  {'✕'}
                </span>
              </div>
            </div>
          </div>
        </Panel>
      </div>
      {/* 金句位 */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 660, textAlign: 'center', opacity: quote}}>
        <span style={{fontFamily: theme.serif, fontSize: 50, fontWeight: 700, color: theme.text}}>{'看单子 · 不看嘴'}</span>
      </div>
    </AbsoluteFill>
  );
};

// ── 6-E 五增量·合口 ─────────────────────────────────────────────────────

/** 五增量卡：权限钩子 / 真门急停（缺口①合口·走廊冻结）/ 四层压缩 / 恢复梯子 /
 *  切目录（缺口②合口·虚线换实线）；合口计数 2/2。 */
const FiveGains: React.FC<{at15: number; at18: number; span: number}> = ({at15, at18, span}) => {
  const cards = useStagger(5, {at: 8, dur: DUR.f4, fit: {total: Math.max(40, Math.round(span * 0.5))}});
  // 合口标记：①@p6-15 ②@p6-18
  const m1 = useImpulse({at: at15 + 4, dur: DUR.f6, peak: 1});
  const m1O = useProgress(at15 + 4, DUR.f3);
  const m2 = useImpulse({at: at18 + 2, dur: DUR.f6, peak: 1});
  const m2O = useProgress(at18 + 2, DUR.f3);
  const closed = useCount({to: 2, at: at18, dur: DUR.f5});
  // 走廊冻结（真门急停的卡内帧——@dim 压暗）
  const frozenDim = useDim({at: at15 - 6, to: 0.4, dur: DUR.f5});
  const titles = ['权限钩子', '真门急停', '四层压缩', '恢复梯子', '切目录'];
  const subs = ['PreToolUse · 门前检查', '提交即冻结', '预算·裁中·占位·摘要', '重试·备用·续写', '认领即真切'];
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 130, top: 260, display: 'flex', flexWrap: 'wrap', gap: 26, width: 1660}}>
        {titles.map((t, i) => (
          <div key={t} style={{opacity: cards[i], transform: `translateY(${(1 - cards[i]) * 18}px)`, width: 520}}>
            <Panel accent={i === 1 || i === 4 ? theme.accent : theme.panelBorder} style={{boxSizing: 'border-box', padding: '18px 24px', position: 'relative'}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <div>
                  <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{`0${i + 1}`}</div>
                  <div style={{fontFamily: theme.sans, fontSize: 29, fontWeight: 600, color: theme.text, marginTop: 4}}>{t}</div>
                  <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 6}}>{subs[i]}</div>
                </div>
                {/* 卡内小图示 */}
                {i === 0 ? (
                  <svg width={86} height={64}>
                    <rect x={16} y={6} width={54} height={52} rx={6} fill="none" stroke={theme.accent} strokeWidth={3} />
                    <line x1={2} y1={32} x2={30} y2={32} stroke={theme.accent} strokeWidth={4} />
                    <text x={43} y={40} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fontWeight={700} fill={theme.accent}>
                      {'✓'}
                    </text>
                  </svg>
                ) : null}
                {i === 1 ? (
                  <div style={{opacity: frozenDim}}>
                    <CorridorRing size={64} draw={1} opacity={0.5} />
                    <div style={{textAlign: 'center', fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginTop: -6}}>{'冻结'}</div>
                  </div>
                ) : null}
                {i === 2 ? (
                  <svg width={86} height={64}>
                    {[0, 1, 2, 3].map((k) => (
                      <rect key={k} x={8} y={50 - k * 14} width={14 + k * 16} height={10} rx={3} fill={withAlpha(theme.accent, 0.35 + 0.16 * k)} />
                    ))}
                  </svg>
                ) : null}
                {i === 3 ? (
                  <svg width={86} height={64}>
                    {[0, 1, 2].map((k) => (
                      <rect key={k} x={10 + k * 24} y={44 - k * 16} width={44} height={14 + k * 4} rx={3} fill="none" stroke={theme.accent} strokeWidth={2.5} />
                    ))}
                  </svg>
                ) : null}
                {i === 4 ? (
                  <svg width={96} height={64}>
                    {/* 实线箭头（替换 4-D 虚线——缺口②合口） */}
                    <line x1={6} y1={32} x2={74} y2={32} stroke={theme.accent} strokeWidth={4} />
                    <path d="M68 24 L82 32 L68 40" fill="none" stroke={theme.accent} strokeWidth={4} />
                    <rect x={82} y={14} width={12} height={36} rx={3} fill="none" stroke={theme.mechDeep} strokeWidth={2.5} />
                  </svg>
                ) : null}
              </div>
              {/* 合口标记（缺口①/② 点亮） */}
              {i === 1 ? (
                <div
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: -18,
                    opacity: m1O,
                    transform: `scale(${0.8 + 0.2 * m1}) rotate(-6deg)`,
                    fontFamily: theme.serif,
                    fontSize: 23,
                    fontWeight: 700,
                    color: theme.accent,
                    border: `2.5px solid ${theme.accent}`,
                    borderRadius: 8,
                    padding: '2px 12px',
                    background: theme.bg,
                    textShadow: `0 0 ${10 * m1}px ${withAlpha(theme.accent, 0.5)}`,
                  }}
                >
                  {'缺口 ① 合口'}
                </div>
              ) : null}
              {i === 4 ? (
                <div
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: -18,
                    opacity: m2O,
                    transform: `scale(${0.8 + 0.2 * m2}) rotate(-6deg)`,
                    fontFamily: theme.serif,
                    fontSize: 23,
                    fontWeight: 700,
                    color: theme.accent,
                    border: `2.5px solid ${theme.accent}`,
                    borderRadius: 8,
                    padding: '2px 12px',
                    background: theme.bg,
                    textShadow: `0 0 ${10 * m2}px ${withAlpha(theme.accent, 0.5)}`,
                  }}
                >
                  {'缺口 ② 合口'}
                </div>
              ) : null}
            </Panel>
          </div>
        ))}
      </div>
      {/* 合口计数（2/2）——top 840→800：底缘原 ~940 侵入字幕带上沿安全带（y≥920，qa WARN 实证） */}
      <div style={{position: 'absolute', left: 1650, top: 800, opacity: m2O}}>
        <Panel accent={theme.accent} style={{width: 200, boxSizing: 'border-box', padding: '10px 18px', textAlign: 'center'}}>
          <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'伏笔合口'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 40, color: theme.accent, fontVariantNumeric: 'tabular-nums'}}>{`${Math.round(closed)}/2`}</div>
        </Panel>
      </div>
      <Footnote delay={12}>{'PreToolUse · plan gate · recovery'}</Footnote>
      <div style={{position: 'absolute', left: 0, right: 0, top: 180, textAlign: 'center', opacity: cards[0]}}>
        <span style={{fontFamily: theme.serif, fontSize: 34, color: theme.text}}>{'五样 · 只在集成版长全'}</span>
      </div>
    </AbsoluteFill>
  );
};

// ── 6-F 两种身份 ────────────────────────────────────────────────────────

/** 一条消息流与一个工具流汇入走廊（循环体高亮「零分支」——岔口仍是那一个）。 */
const TwoIdentities: React.FC<{at20: number}> = ({at20}) => {
  const flowM = useFlowDash({dash: 12, gap: 16, period: 18});
  const flowT = useFlowDash({dash: 12, gap: 16, period: 18});
  // 环上巡游点（谁干活都得走）
  const loop = useTravel({cx: 960, cy: 470, r: 170, secPerLap: 2.8});
  const breathe = useBreathe({period: 50, amp: 0.5, base: 0.5});
  const zero = useImpulse({at: at20, dur: DUR.f6, peak: 1});
  const zeroO = useProgress(at20, DUR.f4);
  const inO = useProgress(2, DUR.f5);
  return (
    <AbsoluteFill>
      {/* 走廊环（本体高亮〔M-001〕） */}
      <div style={{position: 'absolute', left: 790, top: 300, opacity: inO}}>
        <CorridorRing size={340} draw={1} glow={breathe} />
      </div>
      {/* 双流汇入 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: inO}}>
        <path d="M240 300 C 500 300, 660 380, 806 452" fill="none" stroke={theme.panelBorder} strokeWidth={3} opacity={0.55} />
        <path d="M240 300 C 500 300, 660 380, 806 452" fill="none" stroke={theme.concept} strokeWidth={4} {...flowM} />
        <path d="M240 640 C 500 640, 660 560, 806 488" fill="none" stroke={theme.panelBorder} strokeWidth={3} opacity={0.55} />
        <path d="M240 640 C 500 640, 660 560, 806 488" fill="none" stroke={theme.dim} strokeWidth={4} {...flowT} />
        <circle cx={loop.x} cy={loop.y} r={10} fill={theme.concept} />
      </svg>
      {/* 源头标签 */}
      <div style={{position: 'absolute', left: 150, top: 252, fontFamily: theme.mono, fontSize: 22, color: theme.concept, opacity: inO}}>{'inject · 一条消息'}</div>
      <div style={{position: 'absolute', left: 150, top: 656, fontFamily: theme.mono, fontSize: 22, color: theme.dim, opacity: inO}}>{'tool · 一个工具'}</div>
      {/* 零分支标注 */}
      <div
        style={{
          position: 'absolute',
          left: 1330,
          top: 430,
          opacity: zeroO,
          transform: `scale(${0.85 + 0.15 * zero})`,
          fontFamily: theme.serif,
          fontSize: 40,
          fontWeight: 700,
          color: theme.concept,
          border: `3px solid ${theme.concept}`,
          borderRadius: 12,
          padding: '10px 30px',
          background: theme.bg,
          textShadow: `0 0 ${16 * zero}px ${withAlpha(theme.concept, 0.4)}`,
        }}
      >
        {'循环体 · 零分支'}
      </div>
    </AbsoluteFill>
  );
};

// ── 6-G 数字卡 ──────────────────────────────────────────────────────────

/** 27 件内置工具滚动点名＋2130 行标尺；双档口径色角标（教学码实测=mech / 讲义=dim）。
 *  工具实名清单＝gl-notes 附录 B 穿透表（收官章 code.py BUILTIN_TOOLS 块实测 27 件，源码块序）。 */
const BUILTIN_TOOL_NAMES = [
  'bash', 'read_file', 'write_file', 'edit_file', 'glob', 'todo_write', 'task', 'load_skill',
  'compact', 'create_task', 'list_tasks', 'get_task', 'claim_task', 'complete_task',
  'schedule_cron', 'list_crons', 'cancel_cron', 'spawn_teammate', 'send_message',
  'check_inbox', 'request_shutdown', 'request_plan', 'review_plan', 'create_worktree',
  'remove_worktree', 'keep_worktree', 'connect_mcp',
] as const;
const NumberCard: React.FC<{span: number}> = ({span}) => {
  const frame = useCurrentFrame();
  const inO = useProgress(2, DUR.f4);
  const n = useCount({to: 27, at: 6, dur: Math.max(20, Math.round(span * 0.55)), ease: 'standard'});
  // 滚动点名（编号流过——确定性取模）
  const base = Math.floor(frame / 2) % 27;
  const ruler = useDraw(10, 40);
  const rulerO = useProgress(10, DUR.f3);
  return (
    <AbsoluteFill>
      {/* 27 计数 */}
      <div style={{position: 'absolute', left: 250, top: 240, opacity: inO}}>
        <Panel accent={theme.mech} style={{width: 640, boxSizing: 'border-box', padding: '26px 34px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim}}>{'BUILTIN_TOOLS'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 110, color: theme.mech, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1}}>
            {String(Math.round(n)).padStart(2, '0')}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'件内置工具 · 滚动点名'}</div>
        </Panel>
      </div>
      {/* 编号点名流（小字流过） */}
      <div style={{position: 'absolute', left: 250, top: 560, width: 640, overflow: 'hidden', opacity: inO, whiteSpace: 'nowrap'}}>
        {Array.from({length: 9}, (_, i) => {
          const idx = ((base + i - 1) % 27 + 27) % 27;
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                margin: '0 9px',
                padding: '4px 12px',
                borderRadius: 8,
                border: `2px solid ${i === 1 ? theme.mech : theme.panelBorder}`,
                fontFamily: theme.mono,
                fontSize: 19,
                color: i === 1 ? theme.mech : theme.dim,
                opacity: i === 1 ? 1 : 0.55,
              }}
            >
              {BUILTIN_TOOL_NAMES[idx]}
            </span>
          );
        })}
      </div>
      {/* 2130 行标尺 */}
      <div style={{position: 'absolute', left: 1030, top: 300, width: 640, opacity: rulerO}}>
        <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim}}>{'teaching repo'}</div>
        <svg width={640} height={150} style={{marginTop: 14}}>
          <line x1={10} y1={96} x2={630} y2={96} stroke={theme.panelBorder} strokeWidth={3} />
          <line x1={10} y1={96} x2={10 + 600 * 0.92} y2={96} stroke={theme.mech} strokeWidth={5} {...ruler} />
          {/* 刻度（2130） */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={10 + f * 600 * 0.92} y1={86} x2={10 + f * 600 * 0.92} y2={106} stroke={theme.dim} strokeWidth={2.5} />
          ))}
        </svg>
        <div style={{fontFamily: theme.mono, fontSize: 54, color: theme.mech, fontVariantNumeric: 'tabular-nums'}}>{'2130 行'}</div>
      </div>
      {/* 双档口径色角标 */}
      <div style={{position: 'absolute', left: 1030, top: 620, display: 'flex', gap: 22, opacity: rulerO}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
          <div style={{width: 14, height: 14, borderRadius: 999, background: theme.mech}} />
          <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.text}}>{'教学码实测口径'}</span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
          <div style={{width: 14, height: 14, borderRadius: 999, background: theme.dim}} />
          <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>{'讲义口径 · 另源'}</span>
        </div>
      </div>
      <Footnote delay={12}>{'钉点 67a9126c · 收官章'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 6-H 收官断言 ────────────────────────────────────────────────────────

/** 收官断言金句卡（衬线两句照读）＋五层身份卡半亮预备（第五层呼吸）。 */
const FinalClaim: React.FC<{at24: number}> = ({at24}) => {
  const rise = useEnter('rise', {at: 4, dur: DUR.f5, springPreset: 'settle', dist: 30});
  const o = useProgress(4, DUR.f4);
  const last = useProgress(at24, DUR.f4);
  // 第五层呼吸（半亮预备）
  const breath = useBreathe({period: 44, amp: 0.5, base: 0.5});
  const stackIn = useProgress(30, DUR.f5);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, top: 300, ...rise, opacity: o}}>
        <div style={{textAlign: 'center'}}>
          <div style={{fontFamily: theme.serif, fontSize: 50, fontWeight: 700, color: theme.text}}>{'不是 更聪明的脑子'}</div>
          <div style={{fontFamily: theme.serif, fontSize: 50, fontWeight: 700, color: theme.accent, marginTop: 14}}>{'是 装置层的复杂性'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, marginTop: 26}}>{'模型管判断 · 装置管组织'}</div>
        </div>
      </div>
      {/* p6-24 收束句 */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 700, textAlign: 'center', opacity: last}}>
        <span style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.text}}>{'机制很多 · 循环一个'}</span>
      </div>
      {/* 五层身份卡半亮预备（右下——第五层呼吸） */}
      <div style={{position: 'absolute', left: 1480, top: 430, opacity: stackIn, display: 'flex', flexDirection: 'column', gap: 6}}>
        {LAYERS.map((l) => {
          const isLast = l.index === ACTIVE_INDEX;
          return (
            <div
              key={l.index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '4px 14px',
                borderRadius: 8,
                background: theme.panel,
                border: `2px solid ${isLast ? withAlpha(theme.core, 0.4 + 0.6 * breath) : theme.panelBorder}`,
                opacity: isLast ? 0.6 + 0.4 * breath : 0.5,
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 13, color: isLast ? theme.core : theme.dim}}>{String(l.index).padStart(2, '0')}</span>
              <span style={{fontFamily: theme.sans, fontSize: 17, color: isLast ? theme.text : theme.dim}}>{l.layer}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── 6-I 边界护栏卡 ──────────────────────────────────────────────────────

/** 证明了什么（自洽 ✓）/ 没证明什么（并发正确 ✗＋闭源转述 ✗）。 */
const BoundaryCard: React.FC<{at25: number; at26: number}> = ({at25, at26}) => {
  const left = useEnter('slideL', {at: 4, dur: DUR.f5, springPreset: 'settle', dist: 90});
  const right = useEnter('slideR', {at: 10, dur: DUR.f5, springPreset: 'settle', dist: 90});
  const ok = useImpulse({at: 30, dur: DUR.f6, peak: 1});
  const bad1 = useImpulse({at: at25 + 20, dur: DUR.f6, peak: 1});
  const bad2 = useImpulse({at: at26 + 8, dur: DUR.f6, peak: 1});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 170, top: 260, ...left}}>
        <Panel accent={theme.ok} style={{width: 720, boxSizing: 'border-box', padding: '26px 34px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'PROVED'}</div>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14}}>
            <span style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 600, color: theme.text}}>{'机制自洽'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 56, fontWeight: 700, color: theme.ok, transform: `scale(${0.8 + 0.2 * ok})`, textShadow: `0 0 ${14 * ok}px ${withAlpha(theme.ok, 0.5)}`}}>{'✓'}</span>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 12}}>{'确定性原型 · 34 断言'}</div>
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 1030, top: 260, ...right}}>
        <Panel accent={theme.danger} style={{width: 720, boxSizing: 'border-box', padding: '26px 34px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'NOT PROVED'}</div>
          {/* 并发正确 ✗（同瞬间双认领小图回指） */}
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14}}>
            <div>
              <span style={{fontFamily: theme.sans, fontSize: 33, fontWeight: 600, color: theme.text}}>{'并发正确'}</span>
              {/* 回指小图：同一瞬间两人认领同一张卡 */}
              <svg width={150} height={40} style={{display: 'block', marginTop: 6}}>
                <rect x={52} y={6} width={46} height={28} rx={4} fill="none" stroke={theme.danger} strokeWidth={2.5} />
                <circle cx={30} cy={20} r={8} fill={theme.dim} />
                <circle cx={120} cy={20} r={8} fill={theme.dim} />
                <line x1={38} y1={20} x2={52} y2={20} stroke={theme.danger} strokeWidth={2.5} opacity={0.4 + 0.6 * bad1} />
                <line x1={98} y1={20} x2={112} y2={20} stroke={theme.danger} strokeWidth={2.5} opacity={0.4 + 0.6 * bad1} />
              </svg>
            </div>
            <span style={{fontFamily: theme.sans, fontSize: 50, fontWeight: 700, color: theme.danger, transform: `scale(${0.8 + 0.2 * bad1})`}}>{'✕'}</span>
          </div>
          {/* 闭源内部只有一层转述 ✗ */}
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, paddingTop: 18, borderTop: `2px dashed ${theme.panelBorder}`}}>
            <span style={{fontFamily: theme.sans, fontSize: 33, fontWeight: 600, color: theme.text}}>{'闭源内部 · 一层转述'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 50, fontWeight: 700, color: theme.danger, transform: `scale(${0.8 + 0.2 * bad2})`}}>{'✕'}</span>
          </div>
        </Panel>
      </div>
      <Footnote delay={16}>{'concurrency ✗ · 据逆向分析（非独立信源）'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 6-J 天亮·回收 ───────────────────────────────────────────────────────

/** 天亮转场（窗外泛白）＋主问题回收卡（三设施图标＋走廊环末次定妆〔M-001〕）。 */
const DawnRecall: React.FC<{at27: number; at28: number; at29: number}> = ({at27, at28, at29}) => {
  // 夜幕层压暗→提起（泛白=夜幕 @dim）
  const nightDim = useDim({at: at27, to: 0.25, dur: DUR.f6});
  // 回收卡（p6-27 问句回归 → p6-28 答案行 → p6-29 一整夜收束）
  const q = useProgress(4, DUR.f4);
  const ans = useProgress(at28 + 4, DUR.f4);
  const night = useProgress(at29, DUR.f4);
  // 走廊环末次定妆（恒定锚——呼吸辉光收束）
  const breathe = useBreathe({period: 60, amp: 0.4, base: 0.6});
  return (
    <AbsoluteFill>
      {/* 夜幕层（提亮=压暗夜色） */}
      <AbsoluteFill style={{background: '#05070a', opacity: 0.5 * nightDim, pointerEvents: 'none'}} />
      {/* 暖光（天亮——自顶部泛白） */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, rgba(217,179,107,0.28) 0%, rgba(217,179,107,0.0) 55%)',
          opacity: night,
          pointerEvents: 'none',
        }}
      />
      {/* 问句回收（P0 金句卡回归） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 240, textAlign: 'center', opacity: q}}>
        <span style={{fontFamily: theme.serif, fontSize: 46, fontWeight: 700, color: theme.text}}>{'计划放在谁手里？'}</span>
      </div>
      {/* 答案行（三设施图标＋走廊环末次定妆） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 430, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 34, opacity: ans}}>
        {['墙', '簿', '账本'].map((f) => (
          <div key={f} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
            <div style={{width: 92, height: 92, borderRadius: 14, border: `2.5px solid ${theme.accent}`, background: withAlpha(theme.accent, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.sans, fontSize: 34, fontWeight: 600, color: theme.text}}>
              {f}
            </div>
            <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'holds'}</span>
          </div>
        ))}
        <div style={{marginLeft: 20}}>
          <CorridorRing size={150} draw={1} glow={breathe} />
        </div>
        <div style={{marginLeft: 6, fontFamily: theme.sans, fontSize: 30, color: theme.dim}}>{'走廊 · 只是转'}</div>
      </div>
      {/* p6-29 收束行 */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 760, textAlign: 'center', opacity: night}}>
        <span style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>{'七件设施 · 一整夜 · 同一条走廊'}</span>
      </div>
      <Footnote delay={12}>{'失忆的师傅们 · 干完了一夜'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 6-K 终章·五层全亮 ───────────────────────────────────────────────────

/** FinaleTail：渐黑（窗从末 beat 总时长推导——红线四）＋完结语 @reveal。
 *  挂 6-K Sequence 最后子节点。 */
const FinaleTail: React.FC<{span: number; wordsAt: number}> = ({span, wordsAt}) => {
  const keep = useFadeOut(span, {frames: 36});
  const words = useReveal('机制很多 · 循环一个', {at: wordsAt, cps: 9});
  const wordsO = useProgress(wordsAt, DUR.f4);
  // 完结语随渐黑末段一并隐去（最后一同入夜）
  const tail = useProgress(span - 14, 14);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 渐黑遮罩：末 36 帧，窗取整镜时长（红线四——勿用末句时长） */}
      <AbsoluteFill style={{background: '#000', opacity: 1 - keep}} />
      {/* 完结语（黑幕之上） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 470,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 52,
          fontWeight: 700,
          color: theme.text,
          opacity: wordsO * (1 - tail),
          letterSpacing: 4,
        }}
      >
        {words}
      </div>
    </AbsoluteFill>
  );
};

/** nextBreathAt 的安全缺省：终集无下期层——传一个远于镜尾的帧（NEXT_LAYER=null
 *  时该参数无视觉作用，仅为满足签名）。 */
const spanFallback = 10_000;

/** 五层身份卡（HarnessStackP6·数据驱动——series-layers next=null 终集无下期层）
 *  ＋系列金句压底。 */
const STACK = {left: 750, top: 310} as const; // 题字避让几何：310 + 5×56 + 4×8 + 82 = 704

const SeriesFinale: React.FC<{at31: number}> = ({at31}) => {
  const stackIn = useProgress(at31, DUR.f5);
  const slogan = useProgress(at31 + DUR.f4, DUR.f4);
  const frame = useCurrentFrame();
  const lamp = 0.75 + 0.25 * Math.sin(frame / 11);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: STACK.left, top: STACK.top, opacity: stackIn}}>
        {/* 锚 p6-31（at31+2）：bK 镜首是 p6-30 的 archify 全屏窗，at=2 会让逐层
            stagger 全程被 ArchifyYield 压制、只剩整体淡入（storyboard「身份卡 @stagger」） */}
        <HarnessStackP6 at={at31 + 2} nextBreathAt={spanFallback} />
      </div>
      {/* 系列金句压栈底（08「P6 收尾用法」；top 由栈几何推导＋82 安全距） */}
      <div
        style={{
          position: 'absolute',
          left: STACK.left,
          top: STACK.top + 5 * 56 + 4 * 8 + 82,
          width: 420,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 22,
          color: theme.dim,
          letterSpacing: 3,
          opacity: slogan,
        }}
      >
        {'Claude Code Harness Engineering'}
      </div>
      {/* 本集题字（规则8：身份卡须含本集标题主段；终集收官题） */}
      <div
        style={{
          position: 'absolute',
          left: 270,
          top: 462,
          width: 460,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 36,
          fontWeight: 700,
          color: theme.accent,
          letterSpacing: 2,
          opacity: stackIn,
        }}
      >
        {'七件设施，一条走廊'}
      </div>
      {/* 灯牌（整栋楼的灯全部亮起） */}
      <div style={{position: 'absolute', left: 330, top: 380, opacity: stackIn * lamp}}>
        <Panel style={{padding: '8px 20px', display: 'flex', gap: 12, alignItems: 'baseline'}}>
          <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.accent}}>{'ALL LIT'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'整栋楼 · 灯全亮'}</span>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P6CorridorFinale: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p6-01', 'p6-03');
  const bB = w('p6-04', 'p6-06');
  const bC = w('p6-07', 'p6-09');
  const bD = w('p6-10', 'p6-11');
  const bE = w('p6-12', 'p6-18');
  const bF = w('p6-19', 'p6-20');
  const bG = w('p6-21');
  const bH = w('p6-22', 'p6-24');
  const bI = w('p6-25', 'p6-26');
  const bJ = w('p6-27', 'p6-29');
  const bK = w('p6-30', 'p6-31');

  // 常驻条调度：6-A 大揭晓与 6-K 身份卡接管时隐藏，6-B..6-J 常驻
  const frame = useCurrentFrame();
  const badgeIn = progress(frame, bB.from, DUR.f4);
  const hideForFinale = progress(frame, bK.from, DUR.f4);
  const badgeO = badgeIn * (1 - hideForFinale);

  return (
    <AbsoluteFill>
      <HarnessBadge style={{...BADGE_STYLE, opacity: badgeO}} />
      <SceneTag chapter="P6" tagline="环形走廊" accent={theme.concept} />

      <Sequence {...bA} name="6-A 第七件揭晓">
        <SeventhReveal at02={at('p6-02') - bA.from} at03={at('p6-03') - bA.from} />
      </Sequence>

      <Sequence {...bB} name="6-B 终考·空格自填">
        {/* 前置空格帧（p6-04 观众自填）；窗 = p6-05..06 跨句扩窗 cue */}
        <ArchifyYield
          cues={[{at: at('p6-05') - bB.from, durationInFrames: dur('p6-05') + dur('p6-06')}]}
        >
          <BlankPanorama />
        </ArchifyYield>
        {/* cue 1/5：collab-panorama four-prep（四道准备逐格点亮；盖 p6-05..06） */}
        <ArchifyRecap
          slug="collab-panorama"
          caption="终考·四道准备"
          cues={[
            {chapterId: 'four-prep', at: at('p6-05') - bB.from, durationInFrames: dur('p6-05') + dur('p6-06')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="6-C 终考·岔口与回流">
        {/* 空窗 p6-08a..c：慢活走查装置 */}
        <ArchifyYield
          cues={[
            {at: at('p6-07') - bC.from, durationInFrames: dur('p6-07')},
            {at: at('p6-08') - bC.from, durationInFrames: dur('p6-08')},
            {at: at('p6-09') - bC.from, durationInFrames: dur('p6-09')},
          ]}
        >
          <SlowJobTrace atA={at('p6-08a') - bC.from} span={bC.durationInFrames} />
        </ArchifyYield>
        {/* cue 2-3/5：collab-panorama（判据→分发）；与 6-B 末章镜界紧邻 → lead={false} */}
        <ArchifyRecap
          slug="collab-panorama"
          caption="终考·岔口与回流"
          cues={[
            {chapterId: 'llm-judge', at: at('p6-07') - bC.from, durationInFrames: dur('p6-07')},
            {chapterId: 'dispatch', at: at('p6-08') - bC.from, durationInFrames: dur('p6-08')},
          ]}
          lead={false}
        />
        {/* cue 4/5：externals 隔 p6-08a..c 空窗（~13s）→ 独立实例走默认入场：
            实例级 lead={false} 会连空窗章的 enters 一并压掉（画框瞬现，ArchifyRecap 契约） */}
        <ArchifyRecap
          slug="collab-panorama"
          caption="终考·岔口与回流"
          cues={[{chapterId: 'externals', at: at('p6-09') - bC.from, durationInFrames: dur('p6-09')}]}
        />
      </Sequence>

      <Sequence {...bD} name="6-D 判据卡">
        <JudgeCard at10={at('p6-10') - bD.from} dur10={dur('p6-10')} at11={at('p6-11') - bD.from} />
      </Sequence>

      <Sequence {...bE} name="6-E 五增量·合口">
        <FiveGains at15={at('p6-15') - bE.from} at18={at('p6-18') - bE.from} span={bE.durationInFrames} />
      </Sequence>

      <Sequence {...bF} name="6-F 两种身份">
        <TwoIdentities at20={at('p6-20') - bF.from} />
      </Sequence>

      <Sequence {...bG} name="6-G 数字卡">
        <NumberCard span={bG.durationInFrames} />
      </Sequence>

      <Sequence {...bH} name="6-H 收官断言">
        <FinalClaim at24={at('p6-24') - bH.from} />
      </Sequence>

      <Sequence {...bI} name="6-I 边界护栏卡">
        <BoundaryCard at25={at('p6-25') - bI.from} at26={at('p6-26') - bI.from} />
      </Sequence>

      <Sequence {...bJ} name="6-J 天亮·回收">
        <DawnRecall at27={at('p6-27') - bJ.from} at28={at('p6-28') - bJ.from} at29={at('p6-29') - bJ.from} />
      </Sequence>

      <Sequence {...bK} name="6-K 终章·五层全亮">
        {/* 身份卡可见岛 p6-31；窗 = p6-30 cue 窗 */}
        <ArchifyYield cues={[{at: at('p6-30') - bK.from, durationInFrames: dur('p6-30')}]}>
          <SeriesFinale at31={at('p6-31') - bK.from} />
        </ArchifyYield>
        {/* cue 5/5：five-layer-dependency five-lit-finale（五层全亮终态，系列身份卡底图） */}
        <ArchifyRecap
          slug="five-layer-dependency"
          caption="五层全亮"
          cues={[
            {chapterId: 'five-lit-finale', at: at('p6-30') - bK.from, durationInFrames: dur('p6-30')},
          ]}
        />
        {/* FinaleTail：末子节点——渐黑（窗从末 beat 总时长推导）＋完结语 */}
        <FinaleTail span={bK.durationInFrames} wordsAt={at('p6-31') - bK.from + 8} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P6CorridorFinale;
