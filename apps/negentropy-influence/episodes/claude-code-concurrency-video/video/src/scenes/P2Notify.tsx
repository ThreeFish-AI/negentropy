/** P2 叫号器 · 通知半场（p2-01..12，2 镜 10 cue）——分镜 2-A…2-B。
 *
 *  ★ 本文件为 P2 幕的装置/图镜半场（2-C/2-D 官方同构与诚实注由同幕另一文件承担），
 *    组装层将两者并列渲染；HarnessBadge / SceneTag 由本文件（幕首开镜侧）持有，
 *    拼装层与另一半场勿重复挂载（chip 半透明，重挂会加深）。
 *  ★ 恒定空间契约：传送带（LoopRing，core 橙恒转底盘〔M-001〕，ep1 同形）恒居
 *    左中锚位、师傅剪影（text 白）背对未察觉；叫号器（mech 蓝，后台线装置族）
 *    挂右缘门口——「不拍肩、不喊人」的空间读法。
 *  archify 两图（notify-protocol / notify-merge）全屏独占：一章锚一句
 *  （at+dur 同句单参）；2-B 跨镜界帧相邻接 2-A 末章，lead={false}
 *  （分镜 lead 清单）；p2-01..02 空窗由挂牌板首现回落装置持有画面。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {P2Official} from './P2Official';
import {DUR, useEnter, useProgress, useSpring} from '../motion';

/** 常驻系列条定位：顶边 y<56 归章节条，Badge 与 SceneTag 同行（P1–P6 同值） */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** LoopRing 巡游节律：2.5s/圈（与 ep1 同值——恒定锚的「节拍」也不变） */
const LAP_FRAMES = 75;

/** 师傅剪影（text 白，无彩）：背对叫号器、臂朝传送带——「未察觉」的空间读法 */
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

// ── 2-A 门口挂牌板首现（p2-01..02 空窗回落） ─────────────────────────────

/** 叫号器（分镜新建母题 CallBoard）：门口挂牌板＋号码牌翻牌（flip-display）。
 *  协议细节交给图镜；本装置只立「只挂牌不拍肩」的具象。 */
const CallBoard: React.FC<{span: number; atBoard: number; atFlip: number}> = ({span, atBoard, atFlip}) => {
  const board = useEnter('rise', {at: atBoard, dur: DUR.f5, dist: 34});
  // 号码牌翻上：局部帧弹簧（settle 无过冲——终态立正即「挂上了」的标签语义）
  const flip = useSpring('settle', {at: atFlip, dur: DUR.f5});
  const note = useProgress(atFlip + DUR.f5, DUR.f4);
  const laps = useProgress(0, Math.max(1, span), 'linear') * (span / LAP_FRAMES);

  return (
    <AbsoluteFill>
      {/* 左中恒转底盘（core 橙〔M-001〕）＋师傅背对 */}
      <div style={{position: 'absolute', left: 300, top: 420}}>
        <LoopRing size={300} dotProgress={laps} showLabels={false} showExit={false} />
      </div>
      <MasterSilhouette />

      {/* 门口门框（dim 无彩）＋挂牌板（mech）挂右缘 */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: board.opacity}}>
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
          <line x1={1516} y1={330} x2={1516} y2={860} stroke={theme.panelBorder} strokeWidth={5} />
          <line x1={1900} y1={330} x2={1900} y2={860} stroke={theme.panelBorder} strokeWidth={5} />
          <line x1={1516} y1={330} x2={1900} y2={330} stroke={theme.panelBorder} strokeWidth={5} />
        </svg>
      </div>
      <div style={{position: 'absolute', left: 1560, top: 396, width: 300, opacity: board.opacity, transform: board.transform}}>
        <Panel accent={theme.mech} style={{width: 300, padding: '16px 22px'}}>
          <div>
            <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.mech}}>{'叫号器'}</span>
          </div>
          {/* 翻牌槽：rotateX 翻上（perspective 包一层） */}
          <div style={{marginTop: 14, height: 92, perspective: 700}}>
            <div
              style={{
                height: 84,
                borderRadius: 10,
                background: theme.panel,
                border: `2px solid ${theme.mech}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.mono,
                fontSize: 40,
                fontWeight: 700,
                color: theme.text,
                transformOrigin: '50% 100%',
                transform: `rotateX(${(1 - flip) * -90}deg)`,
              }}
            >
              {'0001'}
            </div>
          </div>
          {/* 空槽 ×2：等下一批号牌 */}
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                marginTop: 10,
                height: 52,
                borderRadius: 8,
                border: `2px dashed ${theme.panelBorder}`,
                opacity: 0.7,
              }}
            />
          ))}
        </Panel>
        <div
          style={{
            marginTop: 14,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 24,
            color: theme.dim,
            opacity: note,
          }}
        >
          {'不拍肩 · 不喊人'}
        </div>
      </div>

      <Footnote delay={2}>{'task_notification · tool_use ↔ tool_result'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P2Notify: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p2-01', 'p2-07');
  const bB = w('p2-08', 'p2-12');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="2-A 叫号器首现">
        <SceneTag chapter="Notification" tagline="叫号器" />
        {/* 窗列表与 cues 同步维护（独立字面量——覆盖门计数不串账） */}
        <ArchifyYield
          cues={[
            {at: at('p2-03') - bA.from, durationInFrames: dur('p2-03')},
            {at: at('p2-04') - bA.from, durationInFrames: dur('p2-04')},
            {at: at('p2-05') - bA.from, durationInFrames: dur('p2-05')},
            {at: at('p2-06') - bA.from, durationInFrames: dur('p2-06')},
            {at: at('p2-07') - bA.from, durationInFrames: dur('p2-07')},
          ]}
        >
          <Sequence durationInFrames={at('p2-03') - bA.from + DUR.f3} name="2-A 挂牌板首现回落">
            <CallBoard
              span={at('p2-03') - bA.from}
              atBoard={at('p2-01') + Math.round(dur('p2-01') * 0.55) - bA.from}
              atFlip={at('p2-02') + Math.round(dur('p2-02') * 0.5) - bA.from}
            />
          </Sequence>
        </ArchifyYield>
        {/* 前镜 1-F 无图 → 首章默认入场；五章句句相接，实例内自动抑制换章弹入 */}
        <ArchifyRecap
          slug="notify-protocol"
          caption="通知协议"
          cues={[
            {chapterId: 'hang-the-tag', at: at('p2-03') - bA.from, durationInFrames: dur('p2-03')},
            {chapterId: 'one-to-one', at: at('p2-04') - bA.from, durationInFrames: dur('p2-04')},
            {chapterId: 'receipt-spent', at: at('p2-05') - bA.from, durationInFrames: dur('p2-05')},
            {chapterId: 'no-second-receipt', at: at('p2-06') - bA.from, durationInFrames: dur('p2-06')},
            {chapterId: 'own-doorway', at: at('p2-07') - bA.from, durationInFrames: dur('p2-07')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="2-B 同框合流">
        {/* 跨镜界帧相邻接 2-A 末章：lead={false}（分镜 lead 清单）；五句五接力
            无空窗——全屏回放主控，章内拍脉冲与换章弹入由 ArchifyRecap 承担 */}
        <ArchifyRecap
          lead={false}
          slug="notify-merge"
          caption="同框合流"
          cues={[
            {chapterId: 'delivery-when', at: at('p2-08') - bB.from, durationInFrames: dur('p2-08')},
            {chapterId: 'ride-along', at: at('p2-09') - bB.from, durationInFrames: dur('p2-09')},
            {chapterId: 'passive-board', at: at('p2-10') - bB.from, durationInFrames: dur('p2-10')},
            {chapterId: 'next-lap-glance', at: at('p2-11') - bB.from, durationInFrames: dur('p2-11')},
            {chapterId: 'closing-loss', at: at('p2-12') - bB.from, durationInFrames: dur('p2-12')},
          ]}
        />
      </Sequence>

      {/* 2-C/2-D 官方同构与诚实注半场（同幕另一文件，同一 scene 句窗） */}
      <P2Official scene={scene} />
    </AbsoluteFill>
  );
};

export default P2Notify;
