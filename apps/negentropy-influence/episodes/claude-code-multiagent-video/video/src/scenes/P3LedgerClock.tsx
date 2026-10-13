/** P3 回执簿与值班钟（p3-01..23，7 镜 9 cue）——分镜 3-A…3-G。
 *
 *  cue 清单（9）：
 *   3-B receipt-ledger roundtrip@p3-04 / three-checks@p3-05 / settle@p3-06 ＋
 *      receipt-fsm approve-reject@p3-07（背靠背 → lead={false}；p3-08/09 空窗回落）
 *   3-C receipt-ledger b4@p3-10（跨句扩窗 dur 求和盖 p3-10..12——翻烧饼三连）
 *   3-E duty-clock-loop three-states@p3-15 / tick-order@p3-16 / timeout@p3-19
 *      （p3-17/18 空窗回落关键词小卡）
 *   3-F duty-clock-loop b5@p3-20（跨句扩窗盖 p3-20..21；与 3-E 末章镜界紧邻
 *      → lead={false}）
 *
 *  ★ 3-A 双母题亮相：回执簿 slideL / 值班钟 slideR；两场景卡（关机/报备）@impulse。
 *  ★ 3-D 诚实缺口①：信封 flyIn ＋线程小灯 @breathe ＋「缺口①」伏笔角标
 *    （P6 6-E 合口点亮的另一半）。
 *  ★ 3-G 工牌重注入：对话压缩 @dim → 工牌淡出 → 梁上一只手重挂工牌（@spring）。
 *  ★ LodgeMap：3-A..3-D 高亮「簿」、3-E 起高亮「钟」（帧驱动切换）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LodgeMap, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {DUR, clamp01, progress, useBreathe, useDim, useEnter, useImpulse, useProgress, useSpring} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const BADGE_STYLE: React.CSSProperties = {top: 64};

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 空窗回落关键词小卡。
 *  同位轮换退场（同 P5 形态）：out 指向后卡 at、前卡交叉淡出——否则空窗回落起点
 *  新旧卡叠印（opacity 恒 1 的旧卡从半透明新卡下透出）。 */
const KeyCard: React.FC<{at: number; main: string; sub?: string; accent?: string; left?: number; top?: number; width?: number; out?: number}> = ({
  at,
  main,
  sub,
  accent,
  left = 660,
  top = 400,
  width = 600,
  out,
}) => {
  const o = useProgress(at, DUR.f4);
  const gone = useProgress(out ?? 10_000, DUR.f3);
  const vis = o * (1 - gone);
  return (
    <div style={{position: 'absolute', left, top, width, opacity: vis, transform: `translateY(${(1 - o) * 14}px)`, textAlign: 'center'}}>
      <Panel accent={accent} style={{boxSizing: 'border-box', padding: '22px 30px'}}>
        <div style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 600, color: theme.text}}>{main}</div>
        {sub ? <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim, marginTop: 10}}>{sub}</div> : null}
      </Panel>
    </div>
  );
};

// ── 3-A 双设施开张 ──────────────────────────────────────────────────────

/** 回执簿（左）：翻开的双单＋编号章；值班钟（右）：表盘＋钟摆。 */
const DualFacilities: React.FC<{at02: number}> = ({at02}) => {
  const bookIn = useEnter('slideL', {at: 4, dur: DUR.f5, springPreset: 'settle', dist: 120});
  const clockIn = useEnter('slideR', {at: 4, dur: DUR.f5, springPreset: 'settle', dist: 120});
  // 钟摆（匀速摆动——等速线性：机械感是主题）
  const sway = useBreathe({period: 64, amp: 0.5, base: 0.5});
  const pend = (sway - 0.5) * 42;
  // 两场景卡（关机/报备）一闪
  const flash = useImpulse({at: at02 + 8, dur: DUR.f6, peak: 1});
  const cardsIn = useProgress(at02 + 6, DUR.f4);
  return (
    <AbsoluteFill>
      {/* 回执簿（前台·左） */}
      <div style={{position: 'absolute', left: 250, top: 300, ...bookIn}}>
        <Panel accent={theme.accent} style={{width: 620, boxSizing: 'border-box', padding: '26px 32px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 2}}>{'receipts/'}</div>
          {/* 一式两份（请求单＋回执，同编号） */}
          <div style={{display: 'flex', gap: 18, marginTop: 20}}>
            {['请求单', '回执'].map((k, i) => (
              <div
                key={k}
                style={{
                  flex: 1,
                  boxSizing: 'border-box',
                  padding: '16px 18px',
                  borderRadius: 8,
                  background: theme.bg,
                  border: `2px solid ${i === 1 ? theme.accent : theme.panelBorder}`,
                  position: 'relative',
                }}
              >
                <div style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{k}</div>
                <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 8}}>{'req_000001'}</div>
                {/* 编号章 */}
                <div
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: 10,
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    border: `3px solid ${withAlpha(theme.accent, 0.75)}`,
                    color: withAlpha(theme.accent, 0.85),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: theme.mono,
                    fontSize: 13,
                    transform: 'rotate(12deg)',
                  }}
                >
                  {'№1'}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* 值班钟（墙角·右） */}
      <div style={{position: 'absolute', left: 1080, top: 260, ...clockIn}}>
        <svg width={340} height={420}>
          {/* 表盘 */}
          <circle cx={170} cy={150} r={120} fill={theme.panel} stroke={theme.accent} strokeWidth={5} />
          {Array.from({length: 12}, (_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            return <line key={i} x1={170 + 100 * Math.sin(a)} y1={150 - 100 * Math.cos(a)} x2={170 + 112 * Math.sin(a)} y2={150 - 112 * Math.cos(a)} stroke={theme.dim} strokeWidth={3} />;
          })}
          <line x1={170} y1={150} x2={170} y2={86} stroke={theme.text} strokeWidth={5} strokeLinecap="round" />
          <line x1={170} y1={150} x2={212} y2={150} stroke={theme.text} strokeWidth={4} strokeLinecap="round" />
          <circle cx={170} cy={150} r={8} fill={theme.accent} />
          {/* 钟摆 */}
          <line x1={170} y1={270} x2={170 + 90 * Math.sin((pend * Math.PI) / 180)} y2={270 + 120 * Math.cos((pend * Math.PI) / 180)} stroke={theme.dim} strokeWidth={4} />
          <circle cx={170 + 90 * Math.sin((pend * Math.PI) / 180)} cy={270 + 120 * Math.cos((pend * Math.PI) / 180)} r={16} fill={theme.panelBorder} stroke={theme.dim} strokeWidth={3} />
        </svg>
      </div>

      {/* 两场景卡（一闪：关机 / 报备） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 800, display: 'flex', justifyContent: 'center', gap: 40, opacity: cardsIn}}>
        {['关机 · request_shutdown', '报备 · request_plan'].map((t) => (
          <div
            key={t}
            style={{
              padding: '10px 26px',
              borderRadius: 999,
              border: `2px solid ${withAlpha(theme.accent, 0.4 + 0.6 * flash)}`,
              fontFamily: theme.mono,
              fontSize: 22,
              color: theme.dim,
              boxShadow: `0 0 ${14 * flash}px ${withAlpha(theme.accent, 0.35 * flash)}`,
            }}
          >
            {t}
          </div>
        ))}
      </div>
      <Footnote delay={14}>{'match_response · 同编号对上号'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 3-D 诚实缺口① ──────────────────────────────────────────────────────

/** 计划门=只发了一封信：信封飞出、线程仍在跑（小灯常亮）；「缺口①」伏笔角标。 */
const HonestGap1: React.FC<{at13: number; at14: number}> = ({at13, at14}) => {
  const cardIn = useProgress(2, DUR.f5);
  const env = useEnter('flyIn', {at: at13 + 10, dur: DUR.f5, springPreset: 'settle'});
  const envO = useProgress(at13 + 10, DUR.f4);
  // 线程小灯（常亮呼吸——没真停）
  const lamp = useBreathe({period: 40, amp: 0.5, base: 0.55});
  const mark = useImpulse({at: at14 + 6, dur: DUR.f6, peak: 1});
  const markO = useProgress(at14 + 4, DUR.f4);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 500, top: 280, opacity: cardIn}}>
        <Panel accent={theme.mechDeep} style={{width: 920, boxSizing: 'border-box', padding: '28px 36px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
            {/* 线程小灯（仍在跑） */}
            <div style={{width: 22, height: 22, borderRadius: 999, background: theme.accent, boxShadow: `0 0 ${8 + 16 * lamp}px ${withAlpha(theme.accent, 0.7 * lamp)}`}} />
            <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.text}}>{'线程 · 仍在跑'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginLeft: 12}}>{'not stopped'}</span>
          </div>
          <div style={{marginTop: 22, display: 'flex', alignItems: 'center', gap: 16}}>
            {/* 信封（只发了一封信） */}
            <div style={{...env, opacity: envO}}>
              <svg width={92} height={58}>
                <rect x={2} y={2} width={88} height={54} rx={6} fill={theme.bg} stroke={theme.accent} strokeWidth={3} />
                <path d="M2 6 L46 34 L90 6" fill="none" stroke={theme.accent} strokeWidth={3} />
              </svg>
            </div>
            <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>{'计划门 = 一封信 · 靠自觉'}</span>
          </div>
        </Panel>
      </div>
      {/* 伏笔角标「缺口①」 */}
      <div
        style={{
          position: 'absolute',
          left: 1530,
          top: 252,
          opacity: markO,
          transform: `scale(${0.8 + 0.2 * mark}) rotate(-6deg)`,
          fontFamily: theme.serif,
          fontSize: 34,
          fontWeight: 700,
          color: theme.mechDeep,
          border: `3px solid ${theme.mechDeep}`,
          borderRadius: 10,
          padding: '6px 18px',
          textShadow: `0 0 ${12 * mark}px ${withAlpha(theme.mechDeep, 0.5)}`,
        }}
      >
        {'缺口 ①'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 780, textAlign: 'center', opacity: markO}}>
        <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>{'天亮前 · 回来合上'}</span>
      </div>
    </AbsoluteFill>
  );
};

// ── 3-G 工牌重注入 ──────────────────────────────────────────────────────

/** 对话被压短 → 工牌淡出 → 楼重挂工牌点亮。 */
const BadgeReinject: React.FC<{at22: number; at23: number}> = ({at22, at23}) => {
  // 镜首入场（p3-22「值班钟还管一件小事：身份」期间淡入，勿瞬现）
  const enter = useEnter('fade', {at: at22, dur: DUR.f4});
  // 对话卡压缩（@dim＋纵向压扁）
  const squish = useProgress(at23, DUR.f5);
  const dim = useDim({at: at23, to: 0.45, dur: DUR.f5});
  // 旧工牌淡出
  const oldOut = useProgress(at23 + 14, DUR.f4);
  // 梁上一只手重挂：工牌 drop（settle 弹簧）＋点亮脉冲
  const drop = useSpring('settle', {at: at23 + 40, dur: DUR.f5});
  const dropO = useProgress(at23 + 40, DUR.f3);
  const pulse = useImpulse({at: at23 + 46, dur: DUR.f6, peak: 1});
  return (
    <AbsoluteFill style={enter}>
      {/* 梁上一只手（右上垂下） */}
      <div style={{position: 'absolute', left: 900, top: 96, opacity: dropO}}>
        <svg width={80} height={110}>
          <rect x={30} y={0} width={20} height={74} rx={8} fill={theme.panelBorder} />
          <circle cx={40} cy={84} r={16} fill={theme.dim} opacity={0.85} />
        </svg>
      </div>
      {/* 师傅（头顶工牌位） */}
      <div style={{position: 'absolute', left: 830, top: 480}}>
        <svg width={140} height={210} viewBox="0 0 120 180">
          <circle cx={60} cy={34} r={28} fill={theme.text} />
          <path d="M0 180 Q0 76 60 70 Q120 76 120 180 Z" fill={theme.text} />
        </svg>
      </div>
      {/* 旧工牌（淡出） */}
      <div
        style={{
          position: 'absolute',
          left: 872,
          top: 428,
          opacity: 1 - oldOut,
          fontFamily: theme.mono,
          fontSize: 18,
          color: theme.dim,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 6,
          padding: '3px 10px',
          background: theme.bg,
        }}
      >
        {'id: 甲'}
      </div>
      {/* 新挂工牌（重挂点亮） */}
      <div
        style={{
          position: 'absolute',
          left: 858,
          top: 420 + (1 - drop) * -60,
          opacity: dropO,
          transform: `scale(${0.85 + 0.15 * drop})`,
          fontFamily: theme.mono,
          fontSize: 20,
          color: theme.accent,
          border: `3px solid ${theme.accent}`,
          borderRadius: 8,
          padding: '6px 16px',
          background: theme.bg,
          boxShadow: `0 0 ${10 + 18 * pulse}px ${withAlpha(theme.accent, 0.5 * Math.max(pulse, 0.4))}`,
        }}
      >
        {'工牌 · identity'}
      </div>
      {/* 对话窗口（被压短） */}
      <div style={{position: 'absolute', left: 330, top: 330, opacity: dim}}>
        <Panel style={{width: 420, boxSizing: 'border-box', padding: '20px 26px', height: 300 - 150 * squish, overflow: 'hidden'}}>
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'history (short)'}</div>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{height: 8, marginTop: 12, borderRadius: 4, background: theme.panelBorder, opacity: 0.55, width: `${76 - i * 20}%`}} />
          ))}
        </Panel>
      </div>
      <Footnote delay={16}>{'identity re-inject · 压短即重挂'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P3LedgerClock: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p3-01', 'p3-03');
  const bB = w('p3-04', 'p3-09');
  const bC = w('p3-10', 'p3-12');
  const bD = w('p3-13', 'p3-14');
  const bE = w('p3-15', 'p3-19');
  const bF = w('p3-20', 'p3-21');
  const bG = w('p3-22', 'p3-23');

  // 常驻坐标装置：3-E（值班钟段）前高亮「簿」、其后高亮「钟」
  const frame = useCurrentFrame();
  const mapIn = progress(frame, 6, DUR.f4);
  const clockFrom = at('p3-15');
  const mapActive = frame >= clockFrom ? 'clock' : 'ledger';

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />
      <SceneTag chapter="P3" tagline="回执簿与值班钟" accent={theme.accent} />
      <div style={{position: 'absolute', left: 1668, top: 56, opacity: mapIn}}>
        <LodgeMap active={mapActive} />
      </div>

      <Sequence {...bA} name="3-A 双设施开张">
        <DualFacilities at02={at('p3-02') - bA.from} />
      </Sequence>

      <Sequence {...bB} name="3-B 三道核验">
        {/* 空窗回落：p3-08 / p3-09 关键词小卡 */}
        <ArchifyYield
          cues={[
            {at: at('p3-04') - bB.from, durationInFrames: dur('p3-04')},
            {at: at('p3-05') - bB.from, durationInFrames: dur('p3-05')},
            {at: at('p3-06') - bB.from, durationInFrames: dur('p3-06')},
            {at: at('p3-07') - bB.from, durationInFrames: dur('p3-07')},
          ]}
        >
          <KeyCard at={at('p3-08') - bB.from} out={at('p3-09') - bB.from} main={'只认编号 → 销错单'} sub={'type check 不能省'} accent={theme.danger} />
          <KeyCard at={at('p3-09') - bB.from} main={'看编号 · 更看类型'} sub={'match_response 三闸'} accent={theme.accent} />
        </ArchifyYield>
        {/* cue 1-3/9：receipt-ledger 逐章（单号往返→三道核验→销账） */}
        <ArchifyRecap
          slug="receipt-ledger"
          caption="回执簿·三道核验"
          cues={[
            {chapterId: 'roundtrip', at: at('p3-04') - bB.from, durationInFrames: dur('p3-04')},
            {chapterId: 'three-checks', at: at('p3-05') - bB.from, durationInFrames: dur('p3-05')},
            {chapterId: 'settle', at: at('p3-06') - bB.from, durationInFrames: dur('p3-06')},
          ]}
        />
        {/* cue 4/9：receipt-fsm（与 receipt-ledger 背靠背 → lead={false}） */}
        <ArchifyRecap
          slug="receipt-fsm"
          caption="一套状态机·两协议"
          cues={[
            {chapterId: 'approve-reject', at: at('p3-07') - bB.from, durationInFrames: dur('p3-07')},
          ]}
          lead={false}
        />
      </Sequence>

      <Sequence {...bC} name="3-C 消融⑤·翻烧饼">
        {/* cue 5/9：b4 跨句扩窗盖整镜（翻烧饼三连红） */}
        <ArchifyRecap
          slug="receipt-ledger"
          caption="拆核验·翻烧饼"
          cues={[
            {chapterId: 'b4', at: at('p3-10') - bC.from, durationInFrames: dur('p3-10') + dur('p3-11') + dur('p3-12')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="3-D 诚实缺口①">
        <HonestGap1 at13={at('p3-13') - bD.from} at14={at('p3-14') - bD.from} />
      </Sequence>

      <Sequence {...bE} name="3-E 值班钟节拍">
        {/* 空窗回落：p3-17 / p3-18 关键词小卡 */}
        <ArchifyYield
          cues={[
            {at: at('p3-15') - bE.from, durationInFrames: dur('p3-15')},
            {at: at('p3-16') - bE.from, durationInFrames: dur('p3-16')},
            {at: at('p3-19') - bE.from, durationInFrames: dur('p3-19')},
          ]}
        >
          <KeyCard at={at('p3-17') - bE.from} out={at('p3-18') - bE.from} main={'口 > 墙 · 指令优先'} sub={'关机请求 → 立即回执退出'} accent={theme.accent} />
          <KeyCard at={at('p3-18') - bE.from} main={'口空 → 扫墙'} sub={'三条件 · 有活领活'} accent={theme.accent} />
        </ArchifyYield>
        {/* cue 6-8/9：duty-clock-loop 逐章（三态→先口后墙→超时收工） */}
        <ArchifyRecap
          slug="duty-clock-loop"
          caption="值班钟·三态节拍"
          cues={[
            {chapterId: 'three-states', at: at('p3-15') - bE.from, durationInFrames: dur('p3-15')},
            {chapterId: 'tick-order', at: at('p3-16') - bE.from, durationInFrames: dur('p3-16')},
            {chapterId: 'timeout', at: at('p3-19') - bE.from, durationInFrames: dur('p3-19')},
          ]}
        />
      </Sequence>

      <Sequence {...bF} name="3-F 消融⑥·钟不停">
        {/* cue 9/9：b5 跨句扩窗盖整镜；与 3-E 末章（timeout@p3-19）镜界紧邻 → lead={false} */}
        <ArchifyRecap
          slug="duty-clock-loop"
          caption="拆超时·钟不停"
          cues={[
            {chapterId: 'b5', at: at('p3-20') - bF.from, durationInFrames: dur('p3-20') + dur('p3-21')},
          ]}
          lead={false}
        />
      </Sequence>

      <Sequence {...bG} name="3-G 工牌重注入">
        <BadgeReinject at22={at('p3-22') - bG.from} at23={at('p3-23') - bG.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3LedgerClock;
