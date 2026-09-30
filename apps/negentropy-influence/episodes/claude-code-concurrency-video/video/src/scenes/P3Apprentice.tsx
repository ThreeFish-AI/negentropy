/** P3 学徒的字条（p3-01..16，3 镜 7 cue）——分镜 3-A…3-C。
 *
 *  ★ 空间契约：清洗槽群是右缘 mech 装置族的群像（本幕以槽位阵列一现），学徒是
 *    机制化身——mech 蓝描边剪影，与无彩师傅（text 白）区分；传送带左中锚位不入场
 *    （本幕无台面戏，全景让位 archify 全屏独占）。
 *  ★ 3-A 停滞巡视：apprentice-watch 五章接力（p3-01/p3-03/p3-08 空窗句回落自制
 *    装置——卡死槽位 deny 警示 / 【三】归属引语卡 / 长编译不打扰小条）。
 *  ★ 3-B 小字条：单章 side-model-slip（p3-09..10 贴条动效、p3-12..13 旁路对比图
 *    ＋记忆点小卡回落）；3-C 官方监视：单章 official-monitor（p3-15 流式视图细化、
 *    p3-16 收束对句回落）。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {
  DUR,
  clamp01,
  useBreathe,
  useEnter,
  useFlowDash,
  useImpulse,
  useProgress,
  useReveal,
  useStagger,
} from '../motion';

/** 常驻系列条定位：与 SceneTag 同行（P1–P6 同值，由 Integrate 统一核对） */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** hex + 确定性透明度（帧驱动；无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 学徒剪影——mech 蓝描边（机制化身，区别于无彩师傅） */
const Apprentice: React.FC<{x: number; y: number; scale?: number; opacity?: number}> = ({
  x,
  y,
  scale = 1,
  opacity = 0.92,
}) => (
  <svg
    width={120 * scale}
    height={180 * scale}
    viewBox="0 0 120 180"
    style={{position: 'absolute', left: x, top: y, opacity}}
  >
    <circle cx={60} cy={34} r={26} fill={theme.panel} stroke={theme.mech} strokeWidth={4} />
    <path
      d="M4 180 Q4 78 60 72 Q116 78 116 180 Z"
      fill={theme.panel}
      stroke={theme.mech}
      strokeWidth={4}
    />
    {/* 脖颈挂一枚小怀表——「只看表不动手」的具象 */}
    <circle cx={60} cy={104} r={11} fill="none" stroke={theme.mech} strokeWidth={3} />
    <line x1={60} y1={104} x2={60} y2={97} stroke={theme.mech} strokeWidth={2.5} />
  </svg>
);

/** 清洗槽槽位（右缘装置族单元）：滚窗 + 内筒；stuck 时 deny 描边接管 */
const SinkSlot: React.FC<{
  x: number;
  y: number;
  size?: number;
  stuck?: boolean;
  stuckPulse?: number;
  prompt?: string;
  opacity?: number;
}> = ({x, y, size = 220, stuck = false, stuckPulse = 0, prompt, opacity = 1}) => {
  const border = stuck ? theme.deny : theme.mech;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: size, height: size, opacity}}>
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 18,
          background: theme.panel,
          border: `${stuck ? 4 + 2 * stuckPulse : 3}px solid ${border}`,
          boxShadow: stuck ? `0 0 ${18 * stuckPulse}px ${withAlpha(theme.deny, 0.55)}` : 'none',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 136 136">
          <circle
            cx={68}
            cy={68}
            r={62}
            fill="none"
            stroke={stuck ? theme.deny : theme.mechDeep}
            strokeWidth={7}
          />
          <circle
            cx={68}
            cy={68}
            r={40}
            fill="none"
            stroke={stuck ? withAlpha(theme.deny, 0.8) : theme.mechDeep}
            strokeWidth={4}
          />
          <line x1={68} y1={6} x2={68} y2={130} stroke={stuck ? theme.deny : theme.mechDeep} strokeWidth={3} opacity={0.5} />
          <line x1={6} y1={68} x2={130} y2={68} stroke={stuck ? theme.deny : theme.mechDeep} strokeWidth={3} opacity={0.5} />
        </svg>
        {prompt ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 14,
              textAlign: 'center',
              fontFamily: theme.mono,
              fontSize: 26,
              color: stuck ? theme.deny : theme.dim,
            }}
          >
            {prompt}
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ── 3-A p3-01 空窗回落：清洗槽群 + 卡死槽位 ─────────────────────────────

const SinkRowWatch: React.FC = () => {
  // 卡死警示脉冲（deny，一次性包络）＋余韵常驻 deny 描边
  const pulse = useImpulse({at: 4, dur: DUR.f6, peak: 1});
  const label = useProgress(DUR.f5, DUR.f4);
  const row = [0, 1, 2, 3].map((i) => ({stuck: i === 1}));
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 236,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 30,
          fontWeight: 600,
          color: theme.text,
          opacity: label,
        }}
      >
        {'甩出去的活 · 卡在半路？'}
      </div>
      {/* 槽位水平排开：SinkSlot 根节点 absolute，flex/gap 不生效——间距走 x（260 = 200 槽宽 + 60 间隔），右缘 1420 */}
      <div style={{position: 'absolute', left: 440, top: 340}}>
        {row.map((s, i) => (
          <SinkSlot
            key={i}
            x={i * 260}
            y={0}
            size={200}
            stuck={s.stuck}
            stuckPulse={s.stuck ? pulse : 0}
            prompt={s.stuck ? '(y/n)?' : undefined}
          />
        ))}
      </div>
      {/* 卡死槽位警示条（deny——本集「卡死」唯一语义色） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 640,
          width: 1920,
          textAlign: 'center',
          opacity: Math.max(label, pulse * 0.4),
        }}
      >
        <span
          style={{
            fontFamily: theme.sans,
            fontSize: 28,
            fontWeight: 600,
            color: theme.deny,
            border: `3px solid ${withAlpha(theme.deny, 0.7)}`,
            borderRadius: 10,
            padding: '8px 26px',
          }}
        >
          {'停在问话上'}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ── 3-A p3-03 空窗回落：【三】归属引语卡 + 学徒剪影首现 ─────────────────

const ApprenticeQuote: React.FC = () => {
  const inCard = useEnter('fade', {at: 2, dur: DUR.f5});
  const watch = useBreathe({period: 64, amp: 0.18, base: 0.82});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 480, top: 300, ...inCard}}>
        <Panel style={{width: 960, height: 420, boxSizing: 'border-box', padding: '30px 40px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
            <span
              style={{
                fontFamily: theme.sans,
                fontSize: 21,
                color: theme.dim,
                border: `2px solid ${theme.dim}`,
                borderRadius: 6,
                padding: '2px 10px',
              }}
            >
              {'【三】'}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>
              {'开源项目作者 · 源码分析'}
            </span>
          </div>
          <div style={{marginTop: 36, display: 'flex', alignItems: 'center', gap: 48}}>
            <div style={{position: 'relative', width: 150, height: 220}}>
              <div style={{opacity: watch}}>
                <Apprentice x={15} y={20} scale={1} />
              </div>
            </div>
            <div>
              <div style={{fontFamily: theme.serif, fontSize: 52, fontWeight: 700, color: theme.text}}>
                {'产品里 · 安排了一个学徒'}
              </div>
              <div style={{marginTop: 22, fontFamily: theme.sans, fontSize: 27, color: theme.mech}}>
                {'只看 · 不动手'}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 3-A p3-08 空窗回落：长编译不打扰小条 ────────────────────────────────

/** 帧驱动的流水吐字（纯函数 per-char 窗口——铁律①的 map 形态） */
const STREAM_TEXT = 'gcc -c big.c .. .. .. ok  gcc -c util.c .. ok  ld -o app .. .. done';

const NormalCompile: React.FC = () => {
  const inStrip = useEnter('rise', {at: 2, dur: DUR.f5, restBottom: 780});
  const chars = useReveal(STREAM_TEXT, {at: DUR.f4, cps: 20});
  const tagIn = useProgress(DUR.f6, DUR.f4);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 320, top: 420, width: 1280, ...inStrip}}>
        <Panel accent={theme.panelBorder} style={{padding: '20px 28px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
            {'长编译 · 一直在吐字'}
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: theme.mono,
              fontSize: 26,
              color: theme.text,
              whiteSpace: 'pre',
              overflow: 'hidden',
              height: 34,
            }}
          >
            {chars}
            <span style={{color: theme.mech}}>{'▍'}</span>
          </div>
        </Panel>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 620,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.dim,
          opacity: tagIn,
        }}
      >
        {'正常的活 · 不打扰'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-B p3-09..10 空窗回落：副业引子 + 小字条逐张贴上 ───────────────────

const SLIPS = ['装好了', '测完了', '编过了'];

const SideSlip: React.FC<{atFirst: number}> = ({atFirst}) => {
  const head = useProgress(2, DUR.f5);
  // 小字条逐张贴上（每张一拍——useEnter 在子组件内，map 合法）
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 250,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 30,
          fontWeight: 600,
          color: theme.text,
          opacity: head,
        }}
      >
        {'副业 · 每批一张小字条'}
      </div>
      <div style={{position: 'absolute', left: 480, top: 380}}>
        {SLIPS.map((txt, i) => (
          <SlipPaper key={txt} txt={txt} at={atFirst + i * 16} x={i * 330} y={i % 2 === 0 ? 0 : 26} />
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 660,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 25,
          color: theme.dim,
          opacity: head,
        }}
      >
        {'几个字 · 像给改动写标题'}
      </div>
    </AbsoluteFill>
  );
};

/** 单张小字条（mech 描边纸片——机制产物，非人手写） */
const SlipPaper: React.FC<{txt: string; at: number; x: number; y: number}> = ({txt, at, x, y}) => {
  const e = useEnter('pop', {at, dur: DUR.f4, springPreset: 'settle'});
  return (
    <div style={{position: 'absolute', left: x, top: y, ...e}}>
      <div
        style={{
          width: 250,
          padding: '18px 20px',
          background: theme.panel,
          border: `3px solid ${theme.mech}`,
          borderRadius: 10,
          transform: 'rotate(-2deg)',
          boxShadow: `0 0 22px ${withAlpha(theme.mech, 0.28)}`,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 30, fontWeight: 700, color: theme.mech}}>
          {txt}
        </div>
        <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>
          {'标题 · 不是句子'}
        </div>
      </div>
    </div>
  );
};

// ── 3-B p3-12..13 空窗回落：旁路先于主线 + 记忆点小卡 ───────────────────

const BypassCompare: React.FC<{atArrow: number; atMemo: number}> = ({atArrow, atMemo}) => {
  const dash = useFlowDash({dash: 9, gap: 12, period: 22});
  const mainIn = useProgress(2, DUR.f5);
  const sideIn = useProgress(atArrow, DUR.f5);
  const memo = useProgress(atMemo, DUR.f5);
  const chars = useReveal('一句话还没说完 ……', {at: 2, cps: 8});
  return (
    <AbsoluteFill>
      {/* 旁路（上）：mech 细线箭头先完成——小字条已贴 */}
      <div style={{position: 'absolute', left: 300, top: 330, opacity: sideIn}}>
        <svg width={1320} height={150}>
          <path
            d="M60 100 H1080"
            stroke={theme.mech}
            strokeWidth={4}
            fill="none"
            strokeDasharray={dash.strokeDasharray}
            strokeDashoffset={dash.strokeDashoffset}
          />
          <path d="M1070 86 L1094 100 L1070 114" stroke={theme.mech} strokeWidth={4} fill="none" />
          <text x={70} y={46} fontFamily={theme.sans} fontSize={24} fill={theme.mech}>
            {'旁路 · 更小的模型'}
          </text>
        </svg>
        <div style={{position: 'absolute', left: 1120, top: 44}}>
          <SlipPaper txt="贴好了" at={atArrow + 6} x={0} y={0} />
        </div>
      </div>
      {/* 主线（下）：流水条仍在吐字（dim——人的话还没说完） */}
      <div style={{position: 'absolute', left: 300, top: 560, opacity: mainIn}}>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'主线 · 还在说'}</div>
        <div
          style={{
            marginTop: 12,
            width: 1000,
            fontFamily: theme.mono,
            fontSize: 26,
            color: theme.text,
            whiteSpace: 'pre',
            overflow: 'hidden',
            height: 34,
          }}
        >
          {chars}
          <span style={{color: theme.dim}}>{'▍'}</span>
        </div>
      </div>
      {/* 记忆点小卡（压短对句——定格停驻） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 720,
          width: 1920,
          textAlign: 'center',
          opacity: memo,
        }}
      >
        <span style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.text}}>
          {'并行'}
        </span>
        <span style={{fontFamily: theme.serif, fontSize: 44, color: theme.dim}}>{' · '}</span>
        <span style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.mech}}>
          {'而且更快'}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C p3-15 空窗回落：监视工具流式视图（2D 细化） ────────────────────

const MONITOR_ROWS: [string, string][] = [
  ['$ build app', 'ok  3.1s'],
  ['$ test unit', 'ok  8.7s'],
  ['$ test e2e', 'ok  21s'],
  ['$ bench', 'running …'],
];

const MonitorStream: React.FC = () => {
  const rows = useStagger(MONITOR_ROWS.length, {at: 4, stride: 14, dur: DUR.f4});
  const cursor = useBreathe({period: 30, amp: 0.5, base: 0.5});
  const tag = useProgress(DUR.f6, DUR.f4);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 460, top: 280}}>
        <Panel accent={theme.mech} style={{width: 1000, padding: 0, overflow: 'hidden'}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 24px',
              borderBottom: `2px solid ${theme.panelBorder}`,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div key={i} style={{width: 11, height: 11, borderRadius: 999, background: theme.panelBorder}} />
            ))}
            <span style={{marginLeft: 8, fontFamily: theme.mono, fontSize: 22, color: theme.mech}}>
              {'Monitor'}
            </span>
            <span style={{marginLeft: 'auto', fontFamily: theme.sans, fontSize: 20, color: theme.dim, opacity: tag}}>
              {'超时就收队'}
            </span>
          </div>
          <div style={{padding: '18px 26px', fontFamily: theme.mono, fontSize: 27, lineHeight: 2.0}}>
            {MONITOR_ROWS.map((r, i) => (
              <div key={r[0]} style={{display: 'flex', gap: 26, opacity: rows[i]}}>
                <span style={{color: theme.text, width: 320}}>{r[0]}</span>
                <span style={{color: i === MONITOR_ROWS.length - 1 ? theme.mech : theme.dim}}>
                  {r[1]}
                  {i === MONITOR_ROWS.length - 1 ? (
                    <span style={{opacity: cursor, color: theme.mech}}>{' ▍'}</span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 700,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 25,
          color: theme.dim,
          opacity: tag,
        }}
      >
        {'盯着后台输出 · 一行行回流'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C p3-16 空窗回落：收束对句 ────────────────────────────────────────

const PairClose: React.FC = () => {
  const cards = useStagger(2, {at: 4, stride: 16, dur: DUR.f5});
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', gap: 90}}>
        <div style={{opacity: cards[0], transform: `translateY(${(1 - cards[0]) * 22}px)`}}>
          <Panel accent={theme.panelBorder} style={{width: 480, padding: '34px 30px', textAlign: 'center'}}>
            <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.dim}}>
              {'教学版 · 没教'}
            </div>
          </Panel>
        </div>
        <div style={{opacity: cards[1], transform: `translateY(${(1 - cards[1]) * 22}px)`}}>
          <Panel accent={theme.mech} style={{width: 480, padding: '34px 30px', textAlign: 'center'}}>
            <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.mech}}>
              {'产品 · 配齐'}
            </div>
          </Panel>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P3Apprentice: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（某句起始帧）；dur() = 与 at 对称的单句取长（cue 窗落在同一句 id 上）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p3-01', 'p3-08');
  const bB = w('p3-09', 'p3-13');
  const bC = w('p3-14', 'p3-16');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="3-A 停滞巡视">
        <SceneTag chapter="watchdog" tagline="学徒巡视" />
        {/* p3-02 起五章接力；p3-01/p3-03/p3-08 空窗句回落自制装置 */}
        <ArchifyRecap
          slug="apprentice-watch"
          caption="学徒巡视"
          cues={[
            {chapterId: 'teach-zero', at: at('p3-02') - bA.from, durationInFrames: dur('p3-02')},
            {chapterId: 'watch-only', at: at('p3-04') - bA.from, durationInFrames: dur('p3-04')},
            {chapterId: 'growth-not-age', at: at('p3-05') - bA.from, durationInFrames: dur('p3-05')},
            {chapterId: 'forty-five-sec', at: at('p3-06') - bA.from, durationInFrames: dur('p3-06')},
            {chapterId: 'yn-sniff', at: at('p3-07') - bA.from, durationInFrames: dur('p3-07')},
          ]}
        />
        <Sequence from={at('p3-01') - bA.from} durationInFrames={dur('p3-01')} name="3-A 清洗槽群一现">
          <SinkRowWatch />
        </Sequence>
        <Sequence from={at('p3-03') - bA.from} durationInFrames={dur('p3-03')} name="3-A 归属引语卡">
          <ApprenticeQuote />
        </Sequence>
        <Sequence from={at('p3-08') - bA.from} durationInFrames={dur('p3-08')} name="3-A 长编译不打扰">
          <NormalCompile />
        </Sequence>
        <Footnote delay={at('p3-02') - bA.from}>{'stagnation watchdog · (y/n)?'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="3-B 小字条动效">
        {/* 前镜末章（yn-sniff@p3-07）隔 p3-08 空档 → 默认 lead */}
        <ArchifyRecap
          slug="apprentice-watch"
          caption="学徒巡视"
          cues={[
            {chapterId: 'side-model-slip', at: at('p3-11') - bB.from, durationInFrames: dur('p3-11')},
          ]}
        />
        {/* p3-09..10 空窗回落：副业引子 + 贴条动效（窗含两句，dur 逐句取和） */}
        <Sequence
          from={at('p3-09') - bB.from}
          durationInFrames={dur('p3-09') + dur('p3-10')}
          name="3-B 贴条一现"
        >
          <SideSlip atFirst={Math.round(dur('p3-09') * 0.5)} />
        </Sequence>
        {/* p3-12..13 空窗回落：旁路对比 + 记忆点小卡 */}
        <Sequence
          from={at('p3-12') - bB.from}
          durationInFrames={dur('p3-12') + dur('p3-13')}
          name="3-B 旁路对比"
        >
          <BypassCompare
            atArrow={Math.round(dur('p3-12') * 0.3)}
            atMemo={Math.round(dur('p3-12') * 0.7)}
          />
        </Sequence>
        <Footnote delay={at('p3-09') - bB.from}>{'Haiku side-query · git-commit-subject, not sentence'}</Footnote>
      </Sequence>

      <Sequence {...bC} name="3-C 官方产品面">
        {/* p3-11 末章隔 p3-12..13 空档 → 默认 lead */}
        <ArchifyRecap
          slug="apprentice-watch"
          caption="学徒巡视"
          cues={[
            {chapterId: 'official-monitor', at: at('p3-14') - bC.from, durationInFrames: dur('p3-14')},
          ]}
        />
        <Sequence from={at('p3-15') - bC.from} durationInFrames={dur('p3-15')} name="3-C 流式视图细化">
          <MonitorStream />
        </Sequence>
        <Sequence from={at('p3-16') - bC.from} durationInFrames={dur('p3-16')} name="3-C 收束对句">
          <PairClose />
        </Sequence>
        <Footnote delay={at('p3-15') - bC.from}>{'Monitor'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3Apprentice;
