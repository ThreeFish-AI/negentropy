/** P5 投毒现场（p5-01..11，镜 5-A..5-C）——规范还在吵、投毒已开工：战报漏斗（厂商/学术
 *  双扫描 → 装机量 → 老三样）→ 隐形墨水（无字形字符 · 三分钟不修 · 复刻 · 一字母之差）
 *  → 四道客户端闸门，收在「同一指令双通道分叉」与「2018/2026 双轨叠影」。
 *  主色关税橙（攻击面）；danger 仅直执链命中瞬间，ok 仅明文通道被闸门拦停瞬间。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useDraw,
  useFlowDash,
  useImpulse,
  useProgress,
  useSpring,
  useStagger,
  useTravel,
} from '../motion';
import {Panel, SceneTag} from '../components/motifs';
import {EvidenceBadge} from '../components/devices';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

// ── 5-A 警报灯 ──────────────────────────────────────────────────────────

/** 5-A 警报灯（p5-01 装置句）：左＝规范文书，争论气泡 useStagger 叠起（警示金=悬案）；
 *  右＝关税橙警报灯弹入，光束 useTravel 旋转 + 三记 useImpulse 光晕；中间流向向右
 *  （堆场→泊位：争论在发布侧，投毒已到用户端）。 */
const AlarmLamp: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const show = progress(frame, at, DUR.f4);
  const bubbles = useStagger(3, {at: at + 4, dur: DUR.f4, stride: 7}); // 争论气泡叠起
  const lampIn = useSpring('snap', {at: at + 2, dur: DUR.f5}); // 警报灯弹入（空间通道）
  const beam = useTravel({cx: 0, cy: 0, r: 1, secPerLap: 1.5}); // 光束旋转（只取 angle）
  const p1 = useImpulse({at: at + 10, dur: DUR.f6});
  const p2 = useImpulse({at: at + 28, dur: DUR.f6});
  const p3 = useImpulse({at: at + 46, dur: DUR.f6});
  const flow = useFlowDash({dash: 12, gap: 14, period: 22}); // 分发流向
  const tagO = progress(frame, at + 16, DUR.f4);
  const pulse = Math.max(p1, p2, p3);
  const CX = 200;
  const CY = 190;
  const bubbleTexts = ['反对', '再议', '…'];
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 36, opacity: show}}>
      {/* 左：规范文书 + 争论气泡 */}
      <div style={{position: 'relative', width: 430, height: 360}}>
        <Panel style={{position: 'absolute', left: 0, top: 30, width: 320, padding: '22px 26px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>SKILL.md spec</div>
          <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.text, marginTop: 8}}>规范</div>
          {[0.92, 0.7, 0.84, 0.62].map((wd, i) => (
            <div
              key={i}
              style={{height: 8, marginTop: 14, borderRadius: 4, width: `${wd * 100}%`, background: theme.panelBorder}}
            />
          ))}
        </Panel>
        {bubbleTexts.map((t, i) => (
          <div
            key={t}
            style={{
              position: 'absolute',
              left: 286 + (i % 2) * 34,
              top: 6 + i * 70,
              padding: '8px 18px',
              borderRadius: '16px 16px 16px 4px',
              border: `2px solid ${theme.deny}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 22,
              color: theme.deny,
              opacity: bubbles[i],
              transform: `translateY(${(1 - bubbles[i]) * 16}px)`,
            }}
          >
            {t}
          </div>
        ))}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 320,
            width: 320,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 24,
            color: theme.deny,
            opacity: bubbles[2],
          }}
        >
          {'争论中'}
        </div>
      </div>

      {/* 中：分发流向（向右） */}
      <svg width={200} height={40} viewBox="0 0 200 40">
        <line x1={6} y1={20} x2={172} y2={20} stroke={theme.concept} strokeWidth={3} opacity={0.7} {...flow} />
        <polygon points="172,10 194,20 172,30" fill={theme.concept} opacity={0.7} />
      </svg>

      {/* 右：警报灯 */}
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
        <div style={{transform: `scale(${0.7 + 0.3 * lampIn})`}}>
          <svg width={400} height={320} viewBox="0 0 400 320">
            <defs>
              <clipPath id="p5-alarm-beam-clip">
                <circle cx={CX} cy={CY} r={186} />
              </clipPath>
            </defs>
            {/* 旋转光束 */}
            <g clipPath="url(#p5-alarm-beam-clip)" opacity={0.16 + 0.26 * pulse}>
              <g transform={`rotate(${beam.angle} ${CX} ${CY})`}>
                <path d={`M${CX} ${CY} L${CX + 240} ${CY - 56} L${CX + 240} ${CY + 56} Z`} fill={theme.concept} />
                <path d={`M${CX} ${CY} L${CX - 240} ${CY - 56} L${CX - 240} ${CY + 56} Z`} fill={theme.concept} />
              </g>
            </g>
            {/* 三记光晕 */}
            {[p1, p2, p3].map((p, k) => (
              <circle
                key={k}
                cx={CX}
                cy={CY}
                r={84 + 52 * p + k * 8}
                fill="none"
                stroke={theme.concept}
                strokeWidth={3}
                opacity={0.6 * p}
              />
            ))}
            {/* 灯罩 + 灯芯 + 底座 */}
            <path
              d={`M${CX - 70} 244 L${CX - 70} 180 A70 70 0 0 1 ${CX + 70} 180 L${CX + 70} 244 Z`}
              fill={`${theme.concept}22`}
              stroke={theme.concept}
              strokeWidth={3}
            />
            <line x1={CX - 34} y1={128} x2={CX - 34} y2={244} stroke={theme.concept} strokeWidth={1.5} opacity={0.6} />
            <line x1={CX + 34} y1={128} x2={CX + 34} y2={244} stroke={theme.concept} strokeWidth={1.5} opacity={0.6} />
            <circle cx={CX} cy={CY} r={26} fill={theme.concept} opacity={0.45 + 0.55 * pulse} />
            <rect x={CX - 92} y={244} width={184} height={40} rx={10} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={2.5} />
          </svg>
        </div>
        <div style={{fontFamily: theme.serif, fontSize: 38, color: theme.concept, letterSpacing: 2, opacity: tagO}}>
          {'投毒 · 已开工'}
        </div>
      </div>
    </div>
  );
};

// ── 5-C 双通道分叉 ──────────────────────────────────────────────────────

/** 5-C① 双通道分叉（p5-09 装置句）：同一指令 useProgress 分叉成两条通道——
 *  上＝技能文件预授权（关税橙，一路畅通，命中执行＝danger 一瞬）；
 *  下＝聊天明文（抵检疫绿闸门即停，拦停＝ok 一瞬）；定格后落「格式→客户端实现」锚。 */
const DualChannel: React.FC<{at: number; runAt: number; runDur: number; noteAt: number}> = ({
  at,
  runAt,
  runDur,
  noteAt,
}) => {
  const frame = useCurrentFrame();
  const show = progress(frame, at, DUR.f4);
  const lowDur = Math.max(DUR.f5, Math.round(runDur * 0.6));
  const fork = useProgress(at + 6, DUR.f6); // 同一指令分叉张开
  const up = useProgress(runAt, runDur); // 预授权通道：一路到底
  const low = useProgress(runAt, lowDur); // 明文通道：抵闸即停
  const hit = useImpulse({at: runAt + runDur, dur: DUR.f5}); // 直执命中（danger 仅此瞬）
  const stop = useImpulse({at: runAt + lowDur, dur: DUR.f5}); // 闸门拦停（ok 仅此瞬）
  const flow = useFlowDash({dash: 10, gap: 12, period: 24}); // 畅通通道的行进虚线
  const tokO = progress(frame, runAt, DUR.f3);
  const upDone = progress(frame, runAt + runDur, DUR.f4);
  const noteO = progress(frame, noteAt, DUR.f4);
  const FX = 300; // 分叉点
  const FY = 250;
  const BX = 390; // 分叉肘点
  const EX = 1150; // 执行端
  const GX = 840; // 闸门
  const uy = FY - 150 * fork;
  const ly = FY + 150 * fork;
  const upX = BX + up * (EX - 30 - BX);
  const lowX = BX + low * (GX - 26 - BX);
  return (
    <div style={{position: 'relative', width: 1400, height: 540, opacity: show}}>
      <svg width={1400} height={540} viewBox="0 0 1400 540" style={{position: 'absolute', inset: 0}}>
        {/* 主干 */}
        <line x1={230} y1={FY} x2={FX} y2={FY} stroke={theme.text} strokeWidth={3} />
        {/* 上：预授权通道 */}
        <polyline
          points={`${FX},${FY} ${BX},${uy} ${EX},${uy}`}
          fill="none"
          stroke={theme.concept}
          strokeWidth={3}
          opacity={0.35 + 0.65 * fork}
        />
        <line x1={BX} y1={uy - 12} x2={EX} y2={uy - 12} stroke={theme.concept} strokeWidth={2} opacity={0.6 * upDone} {...flow} />
        {/* 下：明文通道（闸前实线，闸后虚弱） */}
        <polyline
          points={`${FX},${FY} ${BX},${ly} ${GX},${ly}`}
          fill="none"
          stroke={theme.dim}
          strokeWidth={3}
          opacity={0.35 + 0.65 * fork}
        />
        <line x1={GX} y1={ly} x2={EX} y2={ly} stroke={theme.panelBorder} strokeWidth={3} strokeDasharray="6 10" opacity={fork} />
        {/* 闸门（检疫绿常驻；ok 只在拦停一瞬） */}
        <rect x={GX - 6} y={ly - 64} width={12} height={128} rx={6} fill={theme.conceptDeep} opacity={fork} />
        <rect
          x={GX - 18}
          y={ly - 76}
          width={36}
          height={152}
          rx={14}
          fill="none"
          stroke={theme.ok}
          strokeWidth={4}
          opacity={stop}
        />
        {/* 同一指令的两枚令牌 */}
        <circle cx={upX} cy={uy} r={14} fill={theme.concept} opacity={tokO} />
        <circle cx={lowX} cy={ly} r={14} fill={theme.dim} opacity={tokO} />
      </svg>

      {/* 源：同一指令 */}
      <Panel accent={theme.text} style={{position: 'absolute', left: 10, top: FY - 38, width: 220, padding: '14px 0', textAlign: 'center'}}>
        <div style={{fontFamily: theme.serif, fontSize: 30, color: theme.text}}>{'同一指令'}</div>
      </Panel>
      {/* 通道标签 */}
      <div style={{position: 'absolute', left: BX + 24, top: uy - 50, fontFamily: theme.sans, fontSize: 24, color: theme.concept, opacity: fork}}>
        {'技能文件 · 预授权'}
      </div>
      <div style={{position: 'absolute', left: BX + 24, top: ly + 18, fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: fork}}>
        {'聊天 · 明文'}
      </div>
      <div style={{position: 'absolute', left: 720, top: uy + 18, fontFamily: theme.sans, fontSize: 26, color: theme.concept, opacity: upDone}}>
        {'畅通'}
      </div>
      <div style={{position: 'absolute', left: GX - 28, top: ly - 112, fontFamily: theme.sans, fontSize: 26, color: theme.conceptDeep, opacity: fork}}>
        {'设卡'}
      </div>
      {/* 执行端：命中一瞬 danger，随后回落关税橙 */}
      <div style={{position: 'absolute', left: EX, top: uy - 42, width: 210, height: 84}}>
        <Panel
          accent={theme.concept}
          style={{width: 210, height: 84, display: 'flex', alignItems: 'center', justifyContent: 'center'}}
        >
          <div style={{fontFamily: theme.serif, fontSize: 32, color: upDone > 0 ? theme.concept : theme.text}}>{'执行'}</div>
        </Panel>
        <div
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: 16,
            border: `3px solid ${theme.danger}`,
            background: `${theme.danger}26`,
            opacity: hit,
          }}
        />
      </div>
      {/* 定格锚：防线不在格式，在客户端实现 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 480,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'baseline',
          gap: 22,
          opacity: noteO,
        }}
      >
        <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>{'防线'}</span>
        <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim, textDecoration: 'line-through'}}>{'格式'}</span>
        <span style={{fontFamily: theme.mono, fontSize: 28, color: theme.dim}}>{'→'}</span>
        <span style={{fontFamily: theme.serif, fontSize: 36, color: theme.conceptDeep}}>{'客户端实现'}</span>
      </div>
    </div>
  );
};

// ── 5-C 2018/2026 双轨叠影 ──────────────────────────────────────────────

/** 5-C② 双轨叠影（p5-10..11 装置句）：p5-10 画 2018 长轨（useDraw 一笔八年，三节点
 *  useStagger 依次亮）；p5-11 画 2026 短轨（一笔即到），旧剧本节点经叠影连线（useDraw）
 *  投到新轨，两页剧本 useSpring 叠合停驻〔M-003〕。 */
const HistoryOverlay: React.FC<{at: number; dur: number; at2: number}> = ({at, dur, at2}) => {
  const frame = useCurrentFrame();
  const show = progress(frame, at, DUR.f4);
  const trackA = useDraw(at + 4, Math.round(dur * 0.5)); // 2018 长轨：八年一笔
  const nodesA = useStagger(3, {at: at + Math.round(dur * 0.15), fit: {total: Math.round(dur * 0.55)}, dur: DUR.f4});
  const yearsO = progress(frame, at + Math.round(dur * 0.62), DUR.f4);
  const pageA = useProgress(at + Math.round(dur * 0.7), DUR.f5);
  const trackB = useDraw(at2, DUR.f5); // 2026 短轨：六个月一笔即到
  const nodesB = useStagger(3, {at: at2 + 6, dur: DUR.f3, stride: 3});
  const ghost = useDraw(at2 + 10, DUR.f6); // 叠影：旧剧本逐节点投到新轨
  const slide = useSpring('settle', {at: at2 + 18, dur: DUR.f6}); // 两页剧本叠合
  const monthsO = progress(frame, at2 + 8, DUR.f4);
  const sheetBO = progress(frame, at2 + 14, DUR.f4);
  const quoteO = progress(frame, at2 + 34, DUR.f4);
  const AY = 130;
  const BY = 400;
  const AX0 = 190;
  const BX0 = 730;
  const TX = 1030; // 两轨同一终点
  const A_X = [400, 620, 840];
  const B_X = [800, 870, 940];
  const nodeLabels = ['移交权限', '夹带私货', '瞄准钱包'];
  const PX = 1080;
  const PY = 90;
  const PW = 250;
  const PH = 350;
  const sheetLines = [0.86, 0.7, 0.9, 0.64, 0.78];
  return (
    <div style={{position: 'relative', width: 1400, height: 560, opacity: show}}>
      <svg width={1400} height={560} viewBox="0 0 1400 560" style={{position: 'absolute', inset: 0}}>
        {/* 2018 长轨 */}
        <path d={`M${AX0} ${AY} L${TX} ${AY}`} stroke={theme.text} strokeWidth={3} fill="none" {...trackA} />
        {/* 8 年跨度括线 */}
        <path
          d={`M${AX0} ${AY + 34} L${AX0} ${AY + 46} L${TX} ${AY + 46} L${TX} ${AY + 34}`}
          fill="none"
          stroke={theme.dim}
          strokeWidth={2}
          opacity={yearsO}
        />
        {/* 2026 短轨 */}
        <path d={`M${BX0} ${BY} L${TX} ${BY}`} stroke={theme.concept} strokeWidth={3.5} fill="none" {...trackB} />
        {/* 叠影连线：旧剧本节点 → 新轨节点 */}
        {A_X.map((x, i) => (
          <path
            key={`g${i}`}
            d={`M${x} ${AY} L${B_X[i]} ${BY}`}
            stroke={theme.concept}
            strokeWidth={2}
            fill="none"
            opacity={0.5}
            {...ghost}
          />
        ))}
        {/* 节点 */}
        {A_X.map((x, i) => (
          <circle key={`a${i}`} cx={x} cy={AY} r={12} fill={theme.bg} stroke={theme.concept} strokeWidth={3} opacity={nodesA[i]} />
        ))}
        {B_X.map((x, i) => (
          <circle key={`b${i}`} cx={x} cy={BY} r={10} fill={theme.concept} opacity={nodesB[i]} />
        ))}
        {/* 两轨入页箭头 */}
        <polygon points={`${TX + 6},${AY - 9} ${TX + 26},${AY} ${TX + 6},${AY + 9}`} fill={theme.text} opacity={pageA} />
        <polygon points={`${TX + 6},${BY - 9} ${TX + 26},${BY} ${TX + 6},${BY + 9}`} fill={theme.concept} opacity={monthsO} />
      </svg>

      {/* 轨道标签 */}
      <div style={{position: 'absolute', left: 0, top: AY - 18, width: 170, textAlign: 'right', fontFamily: theme.mono, fontSize: 24, color: theme.text, opacity: show}}>
        {'2018 · npm'}
      </div>
      {nodeLabels.map((t, i) => (
        <div
          key={t}
          style={{
            position: 'absolute',
            left: A_X[i] - 80,
            top: AY - 58,
            width: 160,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 22,
            color: theme.concept,
            opacity: nodesA[i],
          }}
        >
          {t}
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          left: (AX0 + TX) / 2 - 80,
          top: AY + 58,
          width: 160,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 36,
          color: theme.text,
          opacity: yearsO,
        }}
      >
        {'8 年'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: BX0 - 210,
          top: BY - 18,
          width: 190,
          textAlign: 'right',
          fontFamily: theme.mono,
          fontSize: 24,
          color: theme.concept,
          opacity: monthsO,
        }}
      >
        {'2026 · 技能'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: (BX0 + TX) / 2 - 90,
          top: BY + 22,
          width: 180,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 36,
          color: theme.concept,
          opacity: monthsO,
        }}
      >
        {'6 个月'}
      </div>

      {/* 剧本页：2018 底页常驻，2026 页滑入叠合 */}
      <Panel style={{position: 'absolute', left: PX, top: PY, width: PW, height: PH, padding: '20px 24px', opacity: pageA}}>
        <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'2018'}</div>
        {sheetLines.map((wd, i) => (
          <div key={i} style={{height: 8, marginTop: 22, borderRadius: 4, width: `${wd * 100}%`, background: theme.panelBorder}} />
        ))}
      </Panel>
      <div
        style={{
          position: 'absolute',
          left: PX + 14,
          top: PY + 14,
          width: PW,
          height: PH,
          borderRadius: 14,
          border: `2.5px solid ${theme.concept}`,
          background: `${theme.concept}10`,
          padding: '20px 24px',
          boxSizing: 'border-box',
          opacity: sheetBO,
          transform: `translate(${(1 - slide) * 80}px, ${(1 - slide) * 160}px)`,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.concept, textAlign: 'right'}}>{'2026'}</div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: PX - 40,
          top: PY + PH + 34,
          width: PW + 94,
          textAlign: 'center',
          opacity: quoteO,
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 32, color: theme.text}}>{'同一页剧本'}</div>
        <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 6}}>{'— 维护者原话'}</div>
      </div>
    </div>
  );
};

/** 5-C 装置合成：p5-09 双通道定格 → p5-10 起交叉淡化到双轨叠影（纯 effects 通道）。 */
const GateFinale: React.FC<{forkAt: number; forkDur: number; histAt: number; histDur: number; replayAt: number}> = ({
  forkAt,
  forkDur,
  histAt,
  histDur,
  replayAt,
}) => {
  const frame = useCurrentFrame();
  const swap = progress(frame, histAt, DUR.f5);
  return (
    <div style={{position: 'relative', width: 1400, height: 560}}>
      <div style={{position: 'absolute', inset: 0, opacity: 1 - swap}}>
        <DualChannel
          at={forkAt}
          runAt={forkAt + 30}
          runDur={Math.round(forkDur * 0.38)}
          noteAt={forkAt + Math.round(forkDur * 0.5)}
        />
      </div>
      <div style={{position: 'absolute', inset: 0, opacity: swap}}>
        <HistoryOverlay at={histAt} dur={histDur} at2={replayAt} />
      </div>
    </div>
  );
};

// ── 主组件 ──────────────────────────────────────────────────────────────

export const P5: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p5-01', 'p5-04');
  const bB = w('p5-04a', 'p5-04d');
  const bC = w('p5-05', 'p5-11');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A 战报漏斗">
        <SceneTag chapter="P5" tagline="投毒现场" accent={theme.concept} />
        <EvidenceBadge text="厂商 + 学术 · 双扫描" at={at('p5-02') - bA.from} />
        <ArchifyYield
          cues={[
            {at: at('p5-02') - bA.from, durationInFrames: dur('p5-02')},
            {at: at('p5-03') - bA.from, durationInFrames: dur('p5-03')},
            {at: at('p5-03a') - bA.from, durationInFrames: dur('p5-03a')},
            {at: at('p5-04') - bA.from, durationInFrames: dur('p5-04')},
          ]}
        >
          <AlarmLamp at={at('p5-01') - bA.from} />
        </ArchifyYield>
        {/* 首章前有 p5-01 装置空窗 → 保留入场；02→03→03a→04 同实例由 enters 抑制 */}
        <ArchifyRecap
          slug="toxic-funnel"
          caption="投毒战报漏斗"
          cues={[
            {chapterId: 'tf-snyk', at: at('p5-02') - bA.from, durationInFrames: dur('p5-02')},
            {chapterId: 'tf-usenix', at: at('p5-03') - bA.from, durationInFrames: dur('p5-03')},
            {chapterId: 'tf-installs', at: at('p5-03a') - bA.from, durationInFrames: dur('p5-03a')},
            {chapterId: 'tf-tricks', at: at('p5-04') - bA.from, durationInFrames: dur('p5-04')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="5-B 隐形墨水">
        <SceneTag chapter="P5" tagline="投毒现场" accent={theme.concept} />
        <EvidenceBadge text="自建实测 · E-03 / E-06" at={at('p5-04c') - bB.from} />
        {/* 上镜末句 p5-04 为 cue、本镜首句 p5-04a 为 cue → 跨镜背靠背 lead={false} */}
        <ArchifyRecap
          slug="invisible-ink"
          caption="隐形墨水"
          lead={false}
          cues={[
            {chapterId: 'ii-tag', at: at('p5-04a') - bB.from, durationInFrames: dur('p5-04a')},
            {chapterId: 'ii-calc', at: at('p5-04b') - bB.from, durationInFrames: dur('p5-04b')},
            {chapterId: 'ii-replay', at: at('p5-04c') - bB.from, durationInFrames: dur('p5-04c')},
            {chapterId: 'ii-typo', at: at('p5-04d') - bB.from, durationInFrames: dur('p5-04d')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="5-C 四道闸门">
        <SceneTag chapter="P5" tagline="投毒现场" accent={theme.concept} />
        {/* 源码核验角标只挂在 p5-05 句窗内（装置段不残留） */}
        <Sequence from={at('p5-05') - bC.from} durationInFrames={dur('p5-05')} name="5-C 源码核验角标">
          <EvidenceBadge text="自建核验 · 源码级" at={0} />
        </Sequence>
        <ArchifyYield
          cues={[
            {at: at('p5-05') - bC.from, durationInFrames: dur('p5-05')},
            {at: at('p5-06') - bC.from, durationInFrames: dur('p5-06')},
            {at: at('p5-07') - bC.from, durationInFrames: dur('p5-07')},
            {at: at('p5-08') - bC.from, durationInFrames: dur('p5-08')},
          ]}
        >
          <GateFinale
            forkAt={at('p5-09') - bC.from}
            forkDur={dur('p5-09')}
            histAt={at('p5-10') - bC.from}
            histDur={dur('p5-10')}
            replayAt={at('p5-11') - bC.from}
          />
        </ArchifyYield>
        {/* 上镜末句 p5-04d 为 cue、本镜首句 p5-05 为 cue → 跨镜背靠背 lead={false} */}
        <ArchifyRecap
          slug="four-gates"
          caption="四道客户端闸门"
          lead={false}
          cues={[
            {chapterId: 'fg-gemini', at: at('p5-05') - bC.from, durationInFrames: dur('p5-05')},
            {chapterId: 'fg-trust', at: at('p5-06') - bC.from, durationInFrames: dur('p5-06')},
            {chapterId: 'fg-chain', at: at('p5-07') - bC.from, durationInFrames: dur('p5-07')},
            {chapterId: 'fg-explicit', at: at('p5-08') - bC.from, durationInFrames: dur('p5-08')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
