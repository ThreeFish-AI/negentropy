/** P1 按下就走开（分镜 1-A…1-D）
 *  ★ 本集题眼主场：环居中持续转、环速全程恒定；慢命令块滑出环上旁轨自己跑
 *  （later=不发生在这一轮的事）；占位条「啪」贴回环口；单线程真相帧。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel, SceneHeader, SceneTag, useRingDot} from '../components/motifs';

/** 环外旁轨的几何常数：与 LoopRing 同心、半径外扩（本幕内推导基线，P2 自带几何） */
const TRACK_R = 340;
const TRACK_CX = 620;
const TRACK_CY = 520;

/** 沿旁轨的弧上取点（deg 从 12 点起顺时针） */
const trackPoint = (deg: number, extra = 0) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return {x: TRACK_CX + (TRACK_R + extra) * Math.cos(rad), y: TRACK_CY + (TRACK_R + extra) * Math.sin(rad)};
};

/** 慢命令块：npm install——later 色块贴在旁轨上 */
const WorkBlock: React.FC<{cx: number; cy: number; o: number}> = ({cx, cy, o}) => (
  <g opacity={o}>
    <rect x={cx - 96} y={cy - 26} width={192} height={52} rx={10} fill={theme.laterDeep} stroke={theme.later} strokeWidth={2.5} />
    <text x={cx} y={cy + 9} textAnchor="middle" fontFamily={theme.mono} fontSize={23} fill={theme.text}>
      {'npm install'}
    </text>
  </g>
);

/** 占位条：环口上的 ticket（带编号 bg_0001） */
const TicketStub: React.FC<{cx: number; cy: number; o: number; scale?: number}> = ({cx, cy, o, scale = 1}) => (
  <g opacity={o} transform={`translate(${cx} ${cy}) scale(${scale})`}>
    <rect x={-84} y={-24} width={168} height={48} rx={9} fill={theme.panel} stroke={theme.later} strokeWidth={2.5} />
    <text x={0} y={9} textAnchor="middle" fontFamily={theme.mono} fontSize={23} fill={theme.later}>
      {'bg_0001'}
    </text>
  </g>
);

/** 1-A 环居中持续转 + bash 工具卡「后台执行」开关咔哒 + 关键词兜底汇入 */
const ToggleAndFallback: React.FC<{toggleAt: number; kwAt: number; mergeAt: number}> = ({
  toggleAt,
  kwAt,
  mergeAt,
}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  // 咔哒：勾选在 6 帧内快速翻上
  const tick = interpolate(frame - toggleAt, [0, 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const kws = ['install', 'build', 'test'];
  const kwOn = kws.map((_, i) => frame >= kwAt + i * 8);
  const mergeT = interpolate(frame - mergeAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const dstX = 1510;
  const dstY = 430;
  return (
    <AbsoluteFill>
      <SceneTag chapter="Background Tasks" tagline="Press Start, Then Walk Away" />
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <g transform={`translate(${TRACK_CX - 260} ${TRACK_CY - 260})`}>
          <LoopRing size={520} draw={1} dotProgress={dot} activeNode={2} />
        </g>
        {/* 两条路汇入同一出口 */}
        {[
          {from: {x: 1240, y: 330}, label: '开关'},
          {from: {x: 1240, y: 640}, label: '关键词'},
        ].map((p, i) => {
          const t = interpolate(frame - mergeAt - i * 6, [0, 20], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <g key={p.label} opacity={t > 0 ? 1 : 0.5}>
              <path
                d={`M${p.from.x} ${p.from.y} C ${dstX - 240} ${p.from.y}, ${dstX - 120} ${dstY}, ${p.from.x + (dstX - p.from.x) * easeLin(t)} ${p.from.y + (dstY - p.from.y) * t}`}
                stroke={theme.later}
                strokeWidth={3}
                fill="none"
                strokeDasharray="8 8"
              />
              {t >= 1 ? <circle cx={dstX} cy={dstY} r={8} fill={theme.later} /> : null}
            </g>
          );
        })}
        {mergeT > 0.8 ? (
          <text x={dstX + 20} y={dstY + 8} fontFamily={theme.sans} fontSize={23} fill={theme.later}>
            {'→ 丢后台'}
          </text>
        ) : null}
      </svg>
      {/* bash 工具卡：勾选开关 */}
      <Panel accent={theme.mech} style={{position: 'absolute', left: 1240, top: 230, width: 380, padding: '20px 24px'}}>
        <div style={{fontFamily: theme.mono, fontSize: 25, color: theme.text}}>{'bash'}</div>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 14}}>
          <svg width={40} height={40}>
            <rect x={2} y={2} width={36} height={36} rx={9} fill={theme.panel} stroke={tick > 0.5 ? theme.mech : theme.panelBorder} strokeWidth={3} />
            {tick > 0 ? (
              <path
                d={`M9 ${20 * (1 - tick) + 9} L17 ${26 * (1 - tick) + 15} L33 ${7 * (1 - tick) + 6}`}
                stroke={theme.mech}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={tick}
              />
            ) : null}
          </svg>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: tick > 0.5 ? theme.mech : theme.dim}}>
            {'后台执行'}
          </div>
        </div>
      </Panel>
      {/* 关键词兜底卡 */}
      <Panel style={{position: 'absolute', left: 1240, top: 560, width: 380, padding: '18px 24px'}}>
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginBottom: 10}}>
          {'没勾？兜底：看关键词'}
        </div>
        <div style={{display: 'flex', gap: 10}}>
          {kws.map((k, i) => (
            <span
              key={k}
              style={{
                fontFamily: theme.mono,
                fontSize: 21,
                padding: '4px 12px',
                borderRadius: 8,
                border: `2px solid ${kwOn[i] ? theme.later : theme.panelBorder}`,
                color: kwOn[i] ? theme.later : theme.dim,
                background: kwOn[i] ? theme.laterDeep : 'transparent',
              }}
            >
              {k}
            </span>
          ))}
        </div>
      </Panel>
      <Footnote delay={mergeAt}>{'它自己最清楚这件活要跑多久'}</Footnote>
    </AbsoluteFill>
  );
};

/** smoothstep：两路汇入曲线的缓动 */
const easeLin = (t: number) => t * t * (3 - 2 * t);

/** 1-B ★环外旁轨：命令块滑出旁轨自己跑 + 占位条贴回环口 + 环速不变 */
const OffLoopSideTrack: React.FC<{slideAt: number; stubAt: number; nextAt: number; guardAt: number}> = ({
  slideAt,
  stubAt,
  nextAt,
  guardAt,
}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  // 命令块从环上（执行工具节点附近，约 150°）沿弧线滑到旁轨（约 60°），再沿旁轨缓行
  const slide = interpolate(frame - slideAt, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const drift = interpolate(frame - slideAt - 30, [0, 200], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const blockDeg = 150 - 90 * slide + 130 * drift; // 出环 → 旁轨缓行
  const onTrack = slide >= 1;
  const p = onTrack ? trackPoint(blockDeg, 6) : trackPoint(blockDeg, -88);
  // 占位条：从旁轨口「啪」地贴回环口（spring）
  const stubE = spring({frame: frame - stubAt, fps: 30, config: {damping: 200}});
  const stubP = trackPoint(150, -84);
  // 「接着转去干下一件」：下一件活的短标签在环口闪现
  const nextO = interpolate(frame - nextAt, [0, 10, 40], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const guardO = interpolate(frame - guardAt, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill>
      <SceneTag chapter="Background Tasks" tagline="The Ring Never Stops" />
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {/* 旁轨：later 虚线弧（120°→310°），环外一层 */}
        <path
          d={`M ${trackPoint(120, 6).x} ${trackPoint(120, 6).y} A ${TRACK_R + 6} ${TRACK_R + 6} 0 0 1 ${trackPoint(310, 6).x} ${trackPoint(310, 6).y}`}
          stroke={theme.later}
          strokeWidth={4}
          strokeDasharray="14 12"
          fill="none"
          opacity={0.6}
        />
        <g transform={`translate(${TRACK_CX - 260} ${TRACK_CY - 260})`}>
          <LoopRing size={520} draw={1} dotProgress={dot} />
        </g>
        {/* 命令块：环上 → 弧线滑出 → 旁轨缓行 */}
        <WorkBlock cx={p.x} cy={p.y} o={0.95} />
        {/* 占位条：贴回环口 */}
        {stubE > 0 ? <TicketStub cx={stubP.x} cy={stubP.y} o={stubE} scale={0.85 + 0.15 * stubE} /> : null}
        {/* 环速不变：旁轨事件全程，环上光点匀速（由 useRingDot 保证） */}
        {nextO > 0 ? (
          <text x={TRACK_CX - 90} y={TRACK_CY + 330} fontFamily={theme.sans} fontSize={24} fill={theme.core} opacity={nextO}>
            {'循环接着转，去干下一件'}
          </text>
        ) : null}
        {/* 守护身份：主人退场它退场 */}
        {guardO > 0 ? (
          <g opacity={guardO}>
            <rect x={1280} y={210} width={420} height={128} rx={14} fill={theme.panel} stroke={theme.later} strokeWidth={2.5} />
            <text x={1490} y={258} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={theme.dim}>
              {'后台线程 · 守护身份'}
            </text>
            <text x={1490} y={296} textAnchor="middle" fontFamily={theme.sans} fontSize={23} fill={theme.text}>
              {'主人退场，它跟着退场'}
            </text>
          </g>
        ) : null}
      </svg>
      <Footnote delay={slideAt}>{'环的转速不变——全程匀速'}</Footnote>
    </AbsoluteFill>
  );
};

/** 1-C ★单线程真相：双轨假象 → 轨道合并 → 单线交错；角标归属句 */
const SingleThreadTruth: React.FC<{mergeAt: number; labelAt: number}> = ({mergeAt, labelAt}) => {
  const frame = useCurrentFrame();
  // 双轨 → 合并：两条平行轨道向中间靠拢成一条
  const merge = interpolate(frame - mergeAt, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const yMid = 480;
  const yTop = 380;
  const yBot = 580;
  const yA = yTop + (yMid - yTop) * merge;
  const yB = yBot - (yBot - yMid) * merge;
  // 单线上交错排布的块（merge 后从假象的两排压成一排交替）
  const blocks = [
    {label: '环上的活', color: theme.core, x0: 300},
    {label: '后台块', color: theme.later, x0: 560},
    {label: '环上的活', color: theme.core, x0: 820},
    {label: '后台块', color: theme.later, x0: 1080},
    {label: '环上的活', color: theme.core, x0: 1340},
  ];
  const march = Math.floor(Math.max(0, frame - mergeAt - 26) / 3) % 12; // 单线上交替推进的步进
  const labelO = interpolate(frame - labelAt, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <svg width={1720} height={560} style={{overflow: 'visible'}}>
        {/* 轨道线：两条 → 一条 */}
        <line x1={140} y1={yA} x2={1660} y2={yA} stroke={theme.core} strokeWidth={5} opacity={0.85} />
        <line x1={140} y1={yB} x2={1660} y2={yB} stroke={theme.later} strokeWidth={5} opacity={0.85} />
        {merge > 0.98 ? (
          <text x={1660} y={yMid - 74} textAnchor="end" fontFamily={theme.sans} fontSize={26} fill={theme.text} opacity={labelO}>
            {'同一条线，交错排队走'}
          </text>
        ) : null}
        {blocks.map((b, i) => {
          // merge 前：各自轨道；merge 后：全部落在单线 yMid 上交错
          const y = i % 2 === 0 ? yA : yB;
          const ySingle = yMid + (i % 2 === 0 ? -34 : 34);
          const yy = y + (ySingle - y) * Math.max(0, merge - i * 0.06) / Math.max(0.001, 1 - i * 0.06);
          const x = b.x0 + march * 2;
          return (
            <g key={i}>
              <rect x={x - 90} y={yy - 24} width={180} height={48} rx={9} fill={b.color === theme.core ? theme.coreDeep : theme.laterDeep} stroke={b.color} strokeWidth={2.5} />
              <text x={x} y={yy + 8} textAnchor="middle" fontFamily={theme.mono} fontSize={21} fill={theme.text}>
                {b.label}
              </text>
            </g>
          );
        })}
        {/* 假象标签：merge 前标注「看着像两条世界」 */}
        {merge < 0.5 ? (
          <text x={1660} y={yTop - 46} textAnchor="end" fontFamily={theme.sans} fontSize={25} fill={theme.dim}>
            {'「并行」的假象'}
          </text>
        ) : null}
      </svg>
      <Footnote delay={labelAt}>{'单线程真相 —— 第三方的源码分析'}</Footnote>
      {labelO > 0 ? (
        <div
          style={{
            position: 'absolute',
            fontFamily: theme.serif,
            fontSize: 38,
            color: theme.text,
            bottom: 236,
            opacity: labelO,
          }}
        >
          {'后台 = 不等它，不是另一个宇宙'}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** 1-D 占位条编号放大特写 + 风筝拴绳（later 线，收放各一次） */
const KiteStub: React.FC<{zoomAt: number; kiteAt: number}> = ({zoomAt, kiteAt}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  const zoom = interpolate(frame - zoomAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 风筝线：收（0→1）再放（1→0.35），绳头始终在环口
  const phase = frame - kiteAt;
  const lineT = phase < 0 ? 0 : phase < 26 ? phase / 26 : phase < 76 ? 1 : phase < 102 ? 1 - (phase - 76) / 26 * 0.65 : 0.35;
  const kiteX = 1240 + 180 * lineT;
  const kiteY = 300 - 130 * lineT;
  const handX = 620;
  const handY = 560;
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {/* 小环：绳头在循环手里（右上角恒转） */}
        <g transform={`translate(${handX - 130} ${handY - 130})`}>
          <LoopRing size={260} draw={1} dotProgress={dot} showLabels={false} />
        </g>
        {/* 风筝线（later）：循环手里放出去，拴着后台块 */}
        {lineT > 0 ? (
          <path
            d={`M ${handX} ${handY} C ${handX + 160} ${handY - 40}, ${kiteX - 120} ${kiteY + 90}, ${kiteX} ${kiteY}`}
            stroke={theme.later}
            strokeWidth={3}
            fill="none"
            strokeDasharray="2 9"
            strokeLinecap="round"
          />
        ) : null}
        {/* 风筝（后台块） */}
        <g opacity={lineT > 0 ? 1 : 0.9}>
          <g transform={`translate(${kiteX} ${kiteY}) rotate(${-18 - 8 * lineT})`}>
            <path d="M-74 0 L0 -44 L74 0 L0 44 Z" fill={theme.laterDeep} stroke={theme.later} strokeWidth={2.5} />
            <text x={0} y={8} textAnchor="middle" fontFamily={theme.mono} fontSize={20} fill={theme.text}>
              {'npm install'}
            </text>
          </g>
        </g>
        {/* 占位条编号特写：右侧放大定格 */}
        <g transform={`translate(${1370 + 30 * zoom} ${620 - 40 * zoom}) scale(${1 + zoom * 1.1})`} opacity={interpolate(frame, [0, 10], [0, 1], {extrapolateRight: 'clamp'})}>
          <rect x={-110} y={-34} width={220} height={68} rx={12} fill={theme.panel} stroke={theme.later} strokeWidth={3} />
          <text x={0} y={12} textAnchor="middle" fontFamily={theme.mono} fontSize={30} fill={theme.later}>
            {'bg_0001'}
          </text>
          <text x={0} y={64} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fill={theme.dim}>
            {'任务编号 · 后面有大用'}
          </text>
        </g>
      </svg>
      <Footnote delay={kiteAt}>{'后台不是泼出去的水，是拴着绳的风筝'}</Footnote>
    </AbsoluteFill>
  );
};

export const P1Dereg: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p1-01', 'p1-05');
  const bB = w('p1-06', 'p1-10');
  const bC = w('p1-11', 'p1-15');
  const bD = w('p1-16', 'p1-24');
  return (
    <AbsoluteFill>
      <SceneHeader index="P1" title="按下就走开" meta="run in background · daemon threads" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="1-A 后台开关与超时转道">
        <ToggleAndFallback
          toggleAt={at('p1-03') - bA.from}
          kwAt={at('p1-04') - bA.from}
          mergeAt={at('p1-05') - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="1-B 环外旁轨">
        <OffLoopSideTrack
          slideAt={at('p1-07') - bB.from}
          stubAt={at('p1-07') - bB.from + 24}
          nextAt={at('p1-08') - bB.from}
          guardAt={at('p1-09') - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="1-C 单线程真相">
        <SingleThreadTruth mergeAt={at('p1-12') - bC.from} labelAt={at('p1-13') - bC.from} />
      </Sequence>
      <Sequence {...bD} name="1-D 占位条与风筝">
        <KiteStub zoomAt={at('p1-17') - bD.from} kiteAt={at('p1-22') - bD.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
