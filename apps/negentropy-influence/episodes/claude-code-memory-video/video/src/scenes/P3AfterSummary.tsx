/** P3 压扁之后（p3-01..16，4 镜）——摘要机纸带毛化 / summary-surgery 两图镜 / 换层镜。
 *
 *  ★ 3-A 摘要机（场景镜）：精确便签「缩进用 tab 不用空格」随纸带（useFlowDash
 *    流动虚线）传入摘要机，出纸「用户有代码风格偏好」归类卡——字迹毛化=透明度
 *    分层（清晰层→模糊层交叉淡化，全帧驱动零随机）；两侧小字对照标签。
 *  ★ 3-B/3-C 图镜（archify full 全屏独占）：summary-surgery 三章两实例接力。
 *    four-steps 跨 p3-05..09 空窗回填（dur 求和拼写，首段句 id 与 at 锚一致——
 *    覆盖门可识别对账）；anti-inject 锚 p3-10 与前 cue 背靠背（实例内自动抑制
 *    换章弹入）。3-C 与 3-B 帧相邻接 → lead={false}；fuse-3 跨 p3-11..12，
 *    p3-12 出处双标签「讲义口径 · 开源代码无此实现」由场景层右下叠加。
 *  ★ 3-D 换层镜：MapAnchor 全屏三分卡〔M-001〕从草稿纸层（灰白系）交叉淡化
 *    切至卡片册层（mech 苔绿）+ pushIn 整幅展开；「连摘要都不剩」浮字与
 *    第二问字卡回收（mech 点睛）。
 *  SceneTag/Footnote 由本文件幕首镜持有（P2Notify 惯例），后镜不重复挂载。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {MapAnchor, MapAnchorChip} from '../components/map-anchor';
import {DUR, useDim, useEnter, useFlowDash, useImpulse, useProgress, usePushIn} from '../motion';

// ── 3-A 摘要机 ──────────────────────────────────────────────────────────────

/** 纸带传送几何（px 推导，居中不混 %）：纸带 y=560 贯穿左右；机器体 320×260 居中。
 *  便签/归类卡均 z 序压在机器体之下——滑入滑出被机器自然遮蔽（进出纸口意象）。 */
const BELT_Y = 560;
const MACHINE = {left: 800, top: 430, w: 320, h: 260} as const;
const CARD_W = 300;
const CARD_H = 88;
const CARD_TOP = BELT_Y - CARD_H / 2;
/** 便签行程 210 → 820（末态完全隐入机器体下方）；归类卡 820 → 1420（自机器体滑出） */
const NOTE_X0 = 210;
const NOTE_X1 = 820;
const OUT_X1 = 1420;

const SummaryMachine: React.FC<{
  atMachine: number;
  atNote: number;
  travelStart: number;
  travelEnd: number;
  outStart: number;
  outEnd: number;
  fuzzAt: number;
  chipAt: number;
}> = ({atMachine, atNote, travelStart, travelEnd, outStart, outEnd, fuzzAt, chipAt}) => {
  const frame = useCurrentFrame();
  const machine = useEnter('fade', {at: atMachine, dur: DUR.f5});
  const flow = useFlowDash({dash: 14, gap: 10, period: 36});
  const flowOn = useProgress(atNote, DUR.f4);
  const noteO = useProgress(atNote, DUR.f4);
  const travel = useProgress(travelStart, Math.max(2, travelEnd - travelStart), 'linear');
  const noteGone = useProgress(travelEnd, DUR.f4);
  const workGlow = useImpulse({at: travelEnd, dur: DUR.f6, peak: 1});
  const outO = useProgress(outStart, DUR.f4);
  const outTravel = useProgress(outStart, Math.max(2, outEnd - outStart), 'linear');
  const fuzz = useProgress(fuzzAt, DUR.f6);
  const cardDim = useDim({at: fuzzAt, to: 0.82, dur: DUR.f6});
  const chipO = useProgress(chipAt, DUR.f4);
  const labelLO = useProgress(atNote, DUR.f4);
  const labelRO = useProgress(outStart, DUR.f4);
  const labelBright = useProgress(fuzzAt, DUR.f5);

  const noteText: React.CSSProperties = {
    fontFamily: theme.mono,
    fontSize: 24,
    color: theme.text,
    whiteSpace: 'nowrap',
  };
  const outText: React.CSSProperties = {
    fontFamily: theme.sans,
    fontSize: 25,
    fontWeight: 600,
  };

  return (
    <AbsoluteFill>
      {/* 纸带：基线（随机器淡入）+ 流动虚线（便签上场起传送感），右端箭头示流向 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: machine.opacity}}>
        <line x1={170} y1={BELT_Y} x2={MACHINE.left} y2={BELT_Y} stroke={theme.panelBorder} strokeWidth={3} />
        <line x1={MACHINE.left + MACHINE.w} y1={BELT_Y} x2={1760} y2={BELT_Y} stroke={theme.panelBorder} strokeWidth={3} />
        <line
          x1={170}
          y1={BELT_Y}
          x2={MACHINE.left}
          y2={BELT_Y}
          stroke={theme.dim}
          strokeWidth={3}
          opacity={0.85 * flowOn}
          strokeDasharray={flow.strokeDasharray}
          strokeDashoffset={flow.strokeDashoffset}
        />
        <line
          x1={MACHINE.left + MACHINE.w}
          y1={BELT_Y}
          x2={1760}
          y2={BELT_Y}
          stroke={theme.dim}
          strokeWidth={3}
          opacity={0.85 * flowOn}
          strokeDasharray={flow.strokeDasharray}
          strokeDashoffset={flow.strokeDashoffset}
        />
        <polygon points={`1760,${BELT_Y - 7} 1776,${BELT_Y} 1760,${BELT_Y + 7}`} fill={theme.dim} opacity={flowOn} />
      </svg>

      {/* 精确便签（清晰 mono）：随纸带行进，末态隐入机器体后方 */}
      <Panel
        style={{
          position: 'absolute',
          left: NOTE_X0 + travel * (NOTE_X1 - NOTE_X0),
          top: CARD_TOP,
          width: CARD_W,
          height: CARD_H,
          opacity: noteO * (1 - noteGone),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={noteText}>{'缩进用 tab 不用空格'}</div>
      </Panel>

      {/* 归类卡（毛化）：自机器体滑出；清晰层→模糊层透明度分层交叉淡化 + 整卡压暗 */}
      <Panel
        style={{
          position: 'absolute',
          left: NOTE_X1 + outTravel * (OUT_X1 - NOTE_X1),
          top: CARD_TOP,
          width: CARD_W,
          height: CARD_H,
          opacity: outO * cardDim,
        }}
      >
        <div style={{position: 'relative', width: 268, height: 34, margin: '27px auto 0'}}>
          <div
            style={{
              ...outText,
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.text,
              opacity: 1 - fuzz,
            }}
          >
            {'用户有代码风格偏好'}
          </div>
          <div
            style={{
              ...outText,
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.dim,
              filter: 'blur(2.6px)',
              opacity: fuzz,
            }}
          >
            {'用户有代码风格偏好'}
          </div>
        </div>
      </Panel>

      {/* 机器体：标签 + 进出纸口灯（加工脉冲） + 两侧滚轮（帧驱动旋转） */}
      <div
        style={{
          position: 'absolute',
          left: MACHINE.left,
          top: MACHINE.top,
          width: MACHINE.w,
          height: MACHINE.h,
          opacity: machine.opacity,
        }}
      >
        <Panel style={{width: MACHINE.w, height: MACHINE.h, position: 'relative'}}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 14,
              textAlign: 'center',
              fontFamily: theme.mono,
              fontSize: 20,
              color: theme.dim,
            }}
          >
            {'摘要机'}
          </div>
          <div
            style={{
              position: 'absolute',
              left: 3,
              top: 98,
              width: 5,
              height: 64,
              borderRadius: 3,
              background: theme.text,
              opacity: 0.5 * workGlow,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 3,
              top: 98,
              width: 5,
              height: 64,
              borderRadius: 3,
              background: theme.text,
              opacity: 0.5 * workGlow,
            }}
          />
        </Panel>
        <svg width={MACHINE.w} height={MACHINE.h} style={{position: 'absolute', left: 0, top: 0}}>
          {[52, 268].map((cx) => (
            <g key={cx} transform={`rotate(${frame * 5} ${cx} 130)`}>
              <circle cx={cx} cy={130} r={22} fill={theme.panel} stroke={theme.dim} strokeWidth={3} />
              <line x1={cx - 13} y1={130} x2={cx + 13} y2={130} stroke={theme.dim} strokeWidth={3} />
              <line x1={cx} y1={117} x2={cx} y2={143} stroke={theme.dim} strokeWidth={3} />
            </g>
          ))}
        </svg>
      </div>

      {/* 两侧小字对照标签（右标签在「塌成模糊归类」时提亮——双层透明度交叉） */}
      <div
        style={{
          position: 'absolute',
          left: 250,
          top: 402,
          width: 300,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 20,
          color: theme.dim,
          opacity: labelLO,
        }}
      >
        {'进 · 精确叮嘱'}
      </div>
      <div style={{position: 'absolute', left: 1400, top: 402, width: 340, textAlign: 'center', opacity: labelRO}}>
        <div style={{position: 'relative', fontFamily: theme.mono, fontSize: 20}}>
          <div style={{color: theme.dim}}>{'出 · 模糊归类'}</div>
          <div style={{position: 'absolute', left: 0, right: 0, top: 0, color: theme.text, opacity: labelBright}}>
            {'出 · 模糊归类'}
          </div>
        </div>
      </div>

      {/* p3-04「字还在，但已经没法照着执行了」——虚线判定小签 */}
      <div style={{position: 'absolute', left: OUT_X1, top: 634, width: CARD_W, textAlign: 'center', opacity: chipO}}>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 19,
            color: theme.dim,
            border: `1.5px dashed ${theme.dim}`,
            borderRadius: 8,
            padding: '4px 12px',
          }}
        >
          {'没法照着执行'}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C 出处双标签（场景层右下叠加，bottom≥150 避字幕带、让位图框底缘 880） ──

const ProvenanceTags: React.FC<{at: number}> = ({at}) => {
  const o = useProgress(at, DUR.f5);
  const chip: React.CSSProperties = {
    padding: '4px 12px',
    borderRadius: 8,
    border: `1.5px solid ${theme.panelBorder}`,
    color: theme.dim,
  };
  return (
    <div
      style={{
        position: 'absolute',
        right: 64,
        bottom: 152,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        opacity: o,
        fontFamily: theme.mono,
        fontSize: 19,
      }}
    >
      <span style={chip}>{'讲义口径'}</span>
      <span style={{color: theme.dim}}>{'·'}</span>
      <span style={chip}>{'开源代码无此实现'}</span>
    </div>
  );
};

// ── 3-D 换层编排 ────────────────────────────────────────────────────────────

/** 全貌坐标装置整幅切换：草稿纸层（subActive=四层管线——摘要即其第四层）淡出，
 *  卡片册层交叉淡化淡入 + pushIn 整幅展开；两实例同刻挂载、入场弹簧在隐藏期
 *  已收敛，切层帧只走交叉淡化（effects 时长+缓动，不吃弹簧）。 */
const LayerSwitch: React.FC<{switchAt: number; quoteAt: number; q2At: number; settleAt: number}> = ({
  switchAt,
  quoteAt,
  q2At,
  settleAt,
}) => {
  const inB = useProgress(switchAt, DUR.f6);
  const push = usePushIn(switchAt, {scale: 0.06, dur: DUR.f6});
  const quote = useEnter('fade', {at: quoteAt, dur: DUR.f6});
  const quoteOut = useProgress(q2At, DUR.f4);
  const q2 = useEnter('rise', {at: q2At, dur: DUR.f5, dist: 22});
  const q2Dim = useDim({at: settleAt, to: 0.55, dur: DUR.f5});
  return (
    <AbsoluteFill>
      <MapAnchor active="scratchpad" subActive={0} fadeAt={switchAt} />
      <AbsoluteFill style={{opacity: inB}}>
        <AbsoluteFill style={{transform: push}}>
          <MapAnchor active="cardfile" />
        </AbsoluteFill>
      </AbsoluteFill>

      {/* 新对话开场白浮字（p3-14 后半） */}
      <div
        style={{
          position: 'absolute',
          left: 560,
          top: 596,
          width: 800,
          textAlign: 'center',
          opacity: quote.opacity * (1 - quoteOut),
        }}
      >
        <div
          style={{
            display: 'inline-block',
            fontFamily: theme.mono,
            fontSize: 17,
            color: theme.dim,
            border: `1.5px solid ${theme.panelBorder}`,
            borderRadius: 999,
            padding: '3px 14px',
          }}
        >
          {'新对话'}
        </div>
        <div style={{fontFamily: theme.serif, fontSize: 42, color: theme.text, marginTop: 14, letterSpacing: 4}}>
          {'连摘要都不剩'}
        </div>
      </div>

      {/* 第二问字卡回收（p3-15，mech 点睛=「第二天」；p3-16 压暗让位卡片册层答案） */}
      <div
        style={{
          position: 'absolute',
          left: 560,
          top: 604,
          width: 800,
          textAlign: 'center',
          opacity: q2.opacity * q2Dim,
          transform: q2.transform,
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.text, letterSpacing: 2}}>
          {'第二问 · '}
          <span style={{color: theme.mech}}>{'跨会话'}</span>
          {' 记得你'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────────

export const P3AfterSummary: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;

  const bA = w('p3-01', 'p3-04');
  const bB = w('p3-05', 'p3-10');
  const bC = w('p3-11', 'p3-12');
  const bD = w('p3-13', 'p3-16');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A 偏好塌缩">
        <SceneTag chapter="After Summary" tagline="压扁之后" accent={theme.mech} />
        {/* 幕首镜坐标缩略条（map-anchor 契约：其余各幕首镜短暂驻场后渐隐） */}
        <MapAnchorChip active="scratchpad" enterAt={at('p3-01') - bA.from + 6} />
        <SummaryMachine
          atMachine={at('p3-01') - bA.from + 4}
          atNote={at('p3-02') - bA.from + 8}
          travelStart={at('p3-02') - bA.from + Math.round(dur('p3-02') * 0.2)}
          travelEnd={at('p3-02') - bA.from + Math.round(dur('p3-02') * 0.62)}
          outStart={at('p3-02') - bA.from + Math.round(dur('p3-02') * 0.74)}
          outEnd={at('p3-03') - bA.from + Math.round(dur('p3-03') * 0.34)}
          fuzzAt={at('p3-03') - bA.from + Math.round(dur('p3-03') * 0.2)}
          chipAt={at('p3-04') - bA.from + Math.round(dur('p3-04') * 0.3)}
        />
        <Footnote delay={at('p3-01') - bA.from + 6}>{'compact_history'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="3-B 四件事流水线">
        {/* 前镜 3-A 为场景镜 → 本实例首章默认入场。four-steps 跨 p3-05..09 空窗回填
            （dur 求和形态，首段句 id 与 at 锚一致——四步口播全落在四步主链章内）；
            anti-inject 与前 cue 背靠背，实例内自动抑制换章弹入 */}
        <ArchifyRecap
          slug="summary-surgery"
          caption="摘要手术 · 四件事与防注入"
          cues={[
            {chapterId: 'four-steps', at: at('p3-05') - bB.from, durationInFrames: dur('p3-05') + dur('p3-06') + dur('p3-07') + dur('p3-08') + dur('p3-09')},
            {chapterId: 'anti-inject', at: at('p3-10') - bB.from, durationInFrames: dur('p3-10')},
          ]}
        />
        <Footnote delay={2}>{'[Compacted]'}</Footnote>
      </Sequence>

      <Sequence {...bC} name="3-C 熔断">
        {/* 前镜 3-B 亦图镜且帧相邻接（anti-inject 末帧 == p3-11 首帧）→ lead={false}；
            fuse-3 跨 p3-11..12 求和扩窗——p3-12 出处句由场景层双标签叠加承载 */}
        <ArchifyRecap
          lead={false}
          slug="summary-surgery"
          caption="摘要手术 · 熔断"
          cues={[{chapterId: 'fuse-3', at: at('p3-11') - bC.from, durationInFrames: dur('p3-11') + dur('p3-12')}]}
        />
        <ProvenanceTags at={at('p3-12') - bC.from + Math.round(dur('p3-12') * 0.12)} />
      </Sequence>

      <Sequence {...bD} name="3-D 换层">
        <LayerSwitch
          switchAt={at('p3-14') - bD.from + Math.round(dur('p3-14') * 0.5)}
          quoteAt={at('p3-14') - bD.from + Math.round(dur('p3-14') * 0.68)}
          q2At={at('p3-15') - bD.from + Math.round(dur('p3-15') * 0.3)}
          settleAt={at('p3-16') - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3AfterSummary;
