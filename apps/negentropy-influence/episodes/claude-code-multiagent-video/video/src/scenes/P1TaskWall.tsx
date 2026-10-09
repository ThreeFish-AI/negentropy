/** P1 任务墙（p1-01..25，6 镜 15 cue）——分镜 1-A…1-F。
 *
 *  cue 清单（15）：
 *   1-A task-card-anatomy card-fields@p1-03 / three-states@p1-04 / two-actions@p1-05
 *   1-C dependency-failclosed four-cards@p1-09 / walkthrough@p1-10 /
 *      blocked@p1-12 / failclosed@p1-13（p1-11/p1-14 空窗回落关键词小卡）
 *   1-E claim-guards-break three-gates@p1-17 / b1@p1-18 / b2-b2v@p1-19 / ok@p1-20
 *   1-F claim-race-window two-lifelines@p1-21 / interleaved@p1-22 /
 *      overwrite@p1-23 / window@p1-24（p1-25 金句卡压尾）
 *
 *  ★ 磁挂牌墙母题（1-A/1-B 装置镜）：卡挂墙上不挂脑子里〔M-003〕——进程倒地灰、
 *    墙卡常驻金；读墙扫光 @flow。
 *  ★ 1-D 三条件闸门卡：三盏灯 stagger 点亮＋写名盖章 @impulse。
 *  ★ LodgeMap active=wall（本幕坐标高亮）。
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
import {DUR, clamp01, progress, useBreathe, useEnter, useFlowDash, useImpulse, useProgress, useSpring, useStagger} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const BADGE_STYLE: React.CSSProperties = {top: 64};

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 师傅剪影（text 白无彩 / 进程灰侧用 dim） */
const Person: React.FC<{x: number; y: number; color: string; scale?: number; opacity?: number; rotate?: number}> = ({
  x,
  y,
  color,
  scale = 1,
  opacity = 0.9,
  rotate = 0,
}) => (
  <svg
    width={120 * scale}
    height={180 * scale}
    viewBox="0 0 120 180"
    style={{position: 'absolute', left: x, top: y, opacity, transform: rotate ? `rotate(${rotate}deg)` : undefined, transformOrigin: '60px 170px'}}
  >
    <circle cx={60} cy={34} r={28} fill={color} />
    <path d="M0 180 Q0 76 60 70 Q120 76 120 180 Z" fill={color} />
  </svg>
);

/** 空窗回落关键词小卡（画面文字只放关键词/数字/标签——复述门）。
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
        {sub ? (
          <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim, marginTop: 10}}>{sub}</div>
        ) : null}
      </Panel>
    </div>
  );
};

/** 磁挂牌：小卡＋顶部两枚磁扣（挂上态可点亮）。 */
const MagnetCard: React.FC<{label: string; hot?: boolean; delay: number}> = ({label, hot = false, delay}) => {
  const enter = useSpring('settle', {at: delay, dur: DUR.f5});
  const o = useProgress(delay, DUR.f4);
  return (
    <div style={{opacity: o, transform: `translateY(${(1 - enter) * 26}px)`}}>
      <div style={{display: 'flex', justifyContent: 'center', gap: 26, marginBottom: -4}}>
        {[0, 1].map((i) => (
          <div key={i} style={{width: 13, height: 13, borderRadius: 999, background: hot ? theme.accent : theme.panelBorder}} />
        ))}
      </div>
      <div
        style={{
          width: 250,
          boxSizing: 'border-box',
          padding: '18px 20px',
          borderRadius: 10,
          background: theme.panel,
          border: `2px solid ${hot ? theme.accent : theme.panelBorder}`,
          boxShadow: hot ? `0 0 18px ${withAlpha(theme.accent, 0.35)}` : undefined,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{'task'}</div>
        <div style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 600, color: hot ? theme.text : theme.dim, marginTop: 4}}>{label}</div>
      </div>
    </div>
  );
};

// ── 1-A 设施开张·卡解剖 ─────────────────────────────────────────────────

/** 大厅任务墙首亮相：纵向墙面＋四张磁挂牌 stagger 挂上（p1-01..02 的可见岛；
 *  p1-03 起让位 archify 逐章回放）。 */
const TaskWallStage: React.FC = () => {
  const wallIn = useProgress(2, DUR.f5);
  const cards = useStagger(4, {at: 10, dur: DUR.f4, stride: 8});
  const labels = ['建库表', '写接口', '写测试', '写文档'];
  return (
    <AbsoluteFill>
      {/* 墙体（纵向大板） */}
      <div style={{position: 'absolute', left: 460, top: 190, opacity: wallIn}}>
        <div
          style={{
            width: 1000,
            height: 560,
            boxSizing: 'border-box',
            borderRadius: 16,
            background: theme.panel,
            border: `3px solid ${theme.panelBorder}`,
            padding: '34px 40px',
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 2}}>{'.tasks/'}</div>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 30, marginTop: 26}}>
            {labels.map((l, i) => (
              <MagnetCard key={l} label={l} hot={cards[i] > 0.6} delay={10 + i * 8} />
            ))}
          </div>
        </div>
      </div>
      {/* 顶灯照墙（细光带） */}
      <div
        style={{
          position: 'absolute',
          left: 460,
          top: 158,
          width: 1000,
          height: 5,
          borderRadius: 3,
          background: withAlpha(theme.accent, 0.5 * wallIn),
        }}
      />
      <Footnote delay={30}>{'.tasks/{id}.json · blockedBy'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-B 墙不挂脑子 ──────────────────────────────────────────────────────

/** 进程倒地（灰）、墙卡仍在（金）；新师傅读墙（扫光 @flow 横掠墙面）。 */
const WallSurvives: React.FC<{at06: number; at07: number}> = ({at06, at07}) => {
  const fall = useEnter('fall', {at: 4, dur: DUR.f5, springPreset: 'settleSoft', dist: 120});
  // 读墙扫光：一条行进虚线光带横掠墙面（p1-07「读一遍墙」）
  const flow = useFlowDash({dash: 26, gap: 60, period: 26});
  const sweep = useProgress(at07 + 6, 30);
  const sweepX = 460 + sweep * 1000;
  // 对照关键词（进程 ✕ / 墙 ✓）
  const mark = useProgress(at06 + DUR.f4, DUR.f4);
  return (
    <AbsoluteFill>
      {/* 墙卡常驻（金） */}
      <div style={{position: 'absolute', left: 760, top: 300, display: 'flex', flexWrap: 'wrap', gap: 26, width: 560}}>
        {['建库表', '写接口'].map((l, i) => (
          <MagnetCard key={l} label={l} hot delay={2 + i * 4} />
        ))}
      </div>
      {/* 扫光：横掠墙面的行进虚线（红线三：像素 dasharray 独立元素） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <line x1={460} y1={560} x2={1460} y2={560} stroke={theme.panelBorder} strokeWidth={2} opacity={0.5} />
        <line
          x1={460}
          y1={560}
          x2={sweepX}
          y2={560}
          stroke={theme.accent}
          strokeWidth={4}
          opacity={0.85}
          {...flow}
        />
      </svg>
      {/* 进程小人倒地（灰——进程死了） */}
      <div style={{position: 'absolute', left: 300, top: 560, ...fall}}>
        <Person x={0} y={0} color={theme.dim} rotate={84} opacity={0.75} />
        <div style={{position: 'absolute', left: 150, top: 60, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
          {'process †'}
        </div>
      </div>
      {/* 新师傅走进读墙 */}
      <Person x={1580} y={470} color={theme.text} opacity={0.9 * sweep} />
      {/* 关键词对照（画面只放关键词） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 760, textAlign: 'center', opacity: mark}}>
        <span style={{fontFamily: theme.sans, fontSize: 44, fontWeight: 700, color: theme.dim}}>{'进程 ✕'}</span>
        <span style={{fontFamily: theme.sans, fontSize: 44, fontWeight: 700, color: theme.accent, margin: '0 34px'}}>{'·'}</span>
        <span style={{fontFamily: theme.sans, fontSize: 44, fontWeight: 700, color: theme.accent}}>{'墙 ✓'}</span>
      </div>
    </AbsoluteFill>
  );
};

// ── 1-D 自取三条件 ──────────────────────────────────────────────────────

/** 三条件闸门卡：三盏灯依次亮（待办∧无主∧前置全清），写名占住盖章。 */
const ClaimGate: React.FC<{at15: number; at16: number}> = ({at15, at16}) => {
  const lamps = useStagger(3, {at: at15 + 10, dur: DUR.f4, stride: 12});
  const names = ['待办', '无主', '前置清'];
  // 写名盖章：p1-16「三条全中才能写名」
  const stamp = useSpring('snap', {at: at16 + 8, dur: DUR.f4});
  const stampO = useProgress(at16 + 8, DUR.f3);
  const pulse = useImpulse({at: at16 + 10, dur: DUR.f6, peak: 1});
  const seat = Math.min(stamp, 1); // snap 过冲钳行程（3D 宪法同款纪律）
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 510, top: 300}}>
        <Panel accent={theme.accent} style={{width: 900, boxSizing: 'border-box', padding: '30px 40px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 2}}>{'claim_task'}</div>
          <div style={{display: 'flex', gap: 26, marginTop: 24}}>
            {names.map((n, i) => {
              const on = lamps[i] > 0.5;
              return (
                <div
                  key={n}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    border: `2px solid ${on ? theme.accent : theme.panelBorder}`,
                    background: on ? withAlpha(theme.accent, 0.1) : 'transparent',
                    padding: '18px 12px',
                    textAlign: 'center',
                    opacity: 0.45 + 0.55 * lamps[i],
                  }}
                >
                  {/* 闸灯 */}
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      margin: '0 auto 12px',
                      background: on ? theme.accent : theme.panelBorder,
                      boxShadow: on ? `0 0 ${14 + 10 * pulse}px ${withAlpha(theme.accent, 0.55)}` : undefined,
                    }}
                  />
                  <div style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 600, color: on ? theme.text : theme.dim}}>{n}</div>
                </div>
              );
            })}
          </div>
          {/* 写名占住（盖章） */}
          <div style={{marginTop: 26, height: 86, borderRadius: 10, border: `2px dashed ${theme.panelBorder}`, position: 'relative'}}>
            <div style={{position: 'absolute', left: 18, top: 12, fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'owner ='}</div>
            <div
              style={{
                position: 'absolute',
                left: 330,
                top: 8,
                transform: `scale(${0.6 + 0.4 * seat}) rotate(-8deg)`,
                opacity: stampO,
                fontFamily: theme.serif,
                fontSize: 46,
                fontWeight: 700,
                color: theme.accent,
                border: `3px solid ${theme.accent}`,
                borderRadius: 8,
                padding: '2px 18px',
                textShadow: `0 0 ${12 * pulse}px ${withAlpha(theme.accent, 0.4)}`,
              }}
            >
              {'甲'}
            </div>
          </div>
        </Panel>
      </div>
      <Footnote delay={20}>{'先到先得 · 写名占住'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-F 消融③·t5race 金句压尾 ───────────────────────────────────────────

/** p1-25 金句卡（关键词锚点形态）：口播「守卫挡得住明抢，挡不住同一瞬间」。 */
const RaceQuote: React.FC = () => {
  const rise = useEnter('rise', {at: 2, dur: DUR.f5, springPreset: 'settle', dist: 30});
  const o = useProgress(2, DUR.f4);
  // 呼吸辉光：period=2π·9 与原 sin(frame/9) 严格等值（P6 收敛同款约定）
  const glow = useBreathe({period: 2 * Math.PI * 9, amp: 0.5, base: 0.5});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 330, ...rise, opacity: o}}>
        <Panel accent={theme.danger} style={{width: 980, margin: '0 auto', boxSizing: 'border-box', padding: '34px 44px', textAlign: 'center', boxShadow: `0 0 ${26 * glow}px ${withAlpha(theme.danger, 0.28)}`}}>
          <div style={{fontFamily: theme.serif, fontSize: 52, fontWeight: 700, color: theme.text}}>
            {'明抢 可挡'}
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 52, fontWeight: 700, color: theme.danger, marginTop: 10}}>
            {'同一瞬间 不可挡'}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim, marginTop: 18}}>{'check → write · 无锁窗口'}</div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P1TaskWall: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p1-01', 'p1-05');
  const bB = w('p1-06', 'p1-07');
  const bC = w('p1-08', 'p1-14');
  const bD = w('p1-15', 'p1-16');
  const bE = w('p1-17', 'p1-20');
  const bF = w('p1-21', 'p1-25');

  const frame = useCurrentFrame();
  // 常驻坐标装置：本幕高亮「墙」（archify 画框右侧净空带，x≥1660）
  const mapIn = progress(frame, 6, DUR.f4);

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />
      <SceneTag chapter="P1" tagline="任务墙" accent={theme.accent} />
      <div style={{position: 'absolute', left: 1668, top: 56, opacity: mapIn}}>
        <LodgeMap active="wall" />
      </div>

      <Sequence {...bA} name="1-A 设施开张·卡解剖">
        {/* 可见岛 p1-01..02（墙面磁挂牌）；窗 = p1-03..05 三条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p1-03') - bA.from, durationInFrames: dur('p1-03')},
            {at: at('p1-04') - bA.from, durationInFrames: dur('p1-04')},
            {at: at('p1-05') - bA.from, durationInFrames: dur('p1-05')},
          ]}
        >
          <TaskWallStage />
        </ArchifyYield>
        {/* cue 1-3/15：task-card-anatomy 逐章（六字段→三态→两动作） */}
        <ArchifyRecap
          slug="task-card-anatomy"
          caption="任务卡解剖"
          cues={[
            {chapterId: 'card-fields', at: at('p1-03') - bA.from, durationInFrames: dur('p1-03')},
            {chapterId: 'three-states', at: at('p1-04') - bA.from, durationInFrames: dur('p1-04')},
            {chapterId: 'two-actions', at: at('p1-05') - bA.from, durationInFrames: dur('p1-05')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="1-B 墙不挂脑子">
        <WallSurvives at06={at('p1-06') - bB.from} at07={at('p1-07') - bB.from} />
      </Sequence>

      <Sequence {...bC} name="1-C 走查·守卫">
        {/* 空窗回落：p1-08 / p1-11 / p1-14 关键词小卡 */}
        <ArchifyYield
          cues={[
            {at: at('p1-09') - bC.from, durationInFrames: dur('p1-09')},
            {at: at('p1-10') - bC.from, durationInFrames: dur('p1-10')},
            {at: at('p1-12') - bC.from, durationInFrames: dur('p1-12')},
            {at: at('p1-13') - bC.from, durationInFrames: dur('p1-13')},
          ]}
        >
          <KeyCard at={2} out={at('p1-11') - bC.from} main={'前置清单 · 顺序闸'} sub={'blockedBy 全清才可领'} accent={theme.accent} />
          <KeyCard at={at('p1-11') - bC.from} out={at('p1-14') - bC.from} main={'完成 → 播报解锁'} sub={'complete_task · 广播新可用'} accent={theme.accent} />
          <KeyCard at={at('p1-14') - bC.from} main={'不放行 · 不崩溃'} sub={'失败关闭 · fail-closed'} accent={theme.danger} />
        </ArchifyYield>
        {/* cue 4-7/15：dependency-failclosed 逐章（四卡→走查→被阻塞→失败关闭） */}
        <ArchifyRecap
          slug="dependency-failclosed"
          caption="依赖·失败关闭"
          cues={[
            {chapterId: 'four-cards', at: at('p1-09') - bC.from, durationInFrames: dur('p1-09')},
            {chapterId: 'walkthrough', at: at('p1-10') - bC.from, durationInFrames: dur('p1-10')},
            {chapterId: 'blocked', at: at('p1-12') - bC.from, durationInFrames: dur('p1-12')},
            {chapterId: 'failclosed', at: at('p1-13') - bC.from, durationInFrames: dur('p1-13')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="1-D 自取三条件">
        <ClaimGate at15={at('p1-15') - bD.from} at16={at('p1-16') - bD.from} />
      </Sequence>

      <Sequence {...bE} name="1-E 消融①②">
        {/* cue 8-11/15：claim-guards-break 逐章（三闸→拆依赖→拆无主/状态→对照在位） */}
        <ArchifyRecap
          slug="claim-guards-break"
          caption="拆守卫对照"
          cues={[
            // fit='trim' 留痕：rate 1.351 恰越 1.35 界（窗 4.1s vs story 5.54s，裁尾 26%）
            {chapterId: 'three-gates', at: at('p1-17') - bE.from, durationInFrames: dur('p1-17'), fit: 'trim'},
            {chapterId: 'b1', at: at('p1-18') - bE.from, durationInFrames: dur('p1-18')},
            {chapterId: 'b2-b2v', at: at('p1-19') - bE.from, durationInFrames: dur('p1-19')},
            {chapterId: 'ok', at: at('p1-20') - bE.from, durationInFrames: dur('p1-20')},
          ]}
        />
      </Sequence>

      <Sequence {...bF} name="1-F 消融③·t5race">
        {/* cue 12-15/15：claim-race-window 逐章（双生命线→交错→落笔重叠→竞争窗口）；
            与 1-E 末章（ok@p1-20）镜界紧邻 → lead={false} */}
        <ArchifyRecap
          slug="claim-race-window"
          caption="竞争窗口"
          cues={[
            {chapterId: 'two-lifelines', at: at('p1-21') - bF.from, durationInFrames: dur('p1-21')},
            {chapterId: 'interleaved', at: at('p1-22') - bF.from, durationInFrames: dur('p1-22')},
            {chapterId: 'overwrite', at: at('p1-23') - bF.from, durationInFrames: dur('p1-23')},
            {chapterId: 'window', at: at('p1-24') - bF.from, durationInFrames: dur('p1-24')},
          ]}
          lead={false}
        />
        {/* p1-25 金句卡压尾 */}
        <Sequence from={at('p1-25') - bF.from} durationInFrames={dur('p1-25')} name="1-F 金句压尾">
          <RaceQuote />
        </Sequence>
        <Footnote delay={10}>{'t5race · 产品：双重文件锁'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1TaskWall;
