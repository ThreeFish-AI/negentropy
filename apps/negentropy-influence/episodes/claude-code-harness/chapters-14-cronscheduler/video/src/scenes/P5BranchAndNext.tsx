/** P5 收束与下期（p5-01..p5-07，3 镜）——分镜 5-A / 5-B / 5-C。
 *
 *  叙事链：5-A 环体定格收束＋金句卡（EWS）：金句卡（衬线体）随 p5-01 淡入定格、
 *  「只管看表」「只管干活」两词各压一拍重读排版〔M-005〕（caption-dup-ok 豁免
 *  登记——收束定格仪式，承 ep1/ep2/ep11 5-A 先例）→「一条队列隔开」词落位
 *  四层链收束为支链——队列带居中隔开表盘与环体的连线（隔开的实体化）〔M-003〕
 *  → p5-02「时间感加在循环外」词落位支链在环外挂定（环体一字未动的终图陈述）、
 *  「夜里也能自己醒来」词落位夜色底光沉一档、支链表盘微光长明（夜语义）→
 *  p5-03「不会自己跑」词落位磁盘文件小签静止一拍、「活着的进程」词落位活进程
 *  徽章呼吸亮（替它看表——前提再钉）→ 5-B 下期卡前奏＋下期卡（视觉层）：
 *  p5-04「表排得再准」词落位一枚精准小表盘划过堆顶（准而无用——堆不减小）
 *  〔M-005〕、「始终只有一个它」词落位执行位「它」签孤立一拍（唯一性定格）→
 *  p5-05「活儿一大，一个干不完」词落位任务堆再高一层、压向环体阴影、「下期」
 *  词落位下期卡浮起定格——只点问题不预告机制 → 5-C 片尾署源卡（尾部署源位，
 *  RSI I-080 豁免）：主行 Learn Claude Code / 次行仓库地址 / 角注 MIT——p5-06
 *  同拍淡入两行先后落定、p5-07 静持（漂移警示由口播承载，卡面零复述），全片
 *  在此卡收束。
 *
 *  空间契约：金句卡为唯一主体、衬线体、支链在环外（不入环内）、环体描边承
 *    全片锚定；执行位恒为单签（唯一性）、下期卡只含问题剪影（堆 vs 单环）、
 *    「下期」签为唯一文字；署源卡为最后画面、卡面 ≤3 行信息。
 *  红线落实：支链与环体融合禁（逆「循环外」）、卡外新增装饰元素禁；画面出现
 *    第二枚环体／队友图形禁（预告机制）、任务堆自减禁（逆「干不完」）；卡面
 *    复述口播整句禁、字号低于可读阈值禁；词落位 = wa(id,f)；y≥56 /
 *    bottom≥176；尾幕渐黑窗 = 末 beat（p5-06..p5-07）总时长。
 *
 *  承接登记：4-D→5-A SceneFade＋环体定格收束主体回归（镜间身份恒常，非
 *    morph——承 ep2 4-D→5-A 判例）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LoopRing, Panel, WatchFaceCard} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useFadeOut, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 5-A 环体定格收束：金句卡 + 环外支链（表盘 · 队列带 · 消息流） ────────────

const RING_5A = {x: 330, y: 140, size: 430} as const;
const WATCH_5A = {x: 900, y: 170, size: 170} as const;
const QUOTE_Y = 664;

const FiveA: React.FC<{atQuote: number; atK1: number; atK2: number; atBranch: number; atHang: number; atNight: number; atDisk: number; atLive: number}> = ({atQuote, atK1, atK2, atBranch, atHang, atNight, atDisk, atLive}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 金句卡淡入定格（收束仪式）
  const quote = useProgress(atQuote, DUR.f5);
  // 两关键词各压一拍重读（scale + 辉光——sched 判时 / queue 干活 双主题色对位）
  const k1 = Math.sin(Math.PI * clamp01(progress(frame, atK1, DUR.f6)));
  const k2 = Math.sin(Math.PI * clamp01(progress(frame, atK2, DUR.f6)));
  const k1G = clamp01(progress(frame, atK1, DUR.f5));
  const k2G = clamp01(progress(frame, atK2, DUR.f5));
  // 四层链收束为支链（p5-01「一条队列隔开」——队列带居中隔开表盘与环体连线）
  const branch = clamp01(progress(frame, atBranch, 22));
  // 支链在环外挂定（p5-02「时间感加在循环外」——环体一字未动的终图陈述）
  const hangP = clamp01(progress(frame, atHang, 16));
  // 夜色底光沉一档 + 表盘微光长明（夜语义）
  const night = clamp01(progress(frame, atNight, 20));
  // 磁盘文件小签静止一拍 + 活进程徽章呼吸亮（前提再钉——替它看表）
  const disk = clamp01(progress(frame, atDisk, DUR.f4));
  const live = clamp01(progress(frame, atLive, DUR.f4));
  const breathe = 0.5 + 0.5 * Math.sin(frame / 9);
  // 环体定格缓转（收束主体——镜间身份恒常；描边承全片锚定）
  const dotPos = (frame / (fps * 2.5)) % 1;
  // 支链几何：表盘（右）—队列带（中）—环体（左）；消息流沿支链行进
  const wfC = {x: WATCH_5A.x + WATCH_5A.size / 2, y: WATCH_5A.y + WATCH_5A.size / 2};
  const beltY = WATCH_5A.y + WATCH_5A.size + 60;
  const ringEdge = {x: RING_5A.x + RING_5A.size - 30, y: RING_5A.y + RING_5A.size / 2};
  const msgT = (frame / 46) % 1;
  return (
    <AbsoluteFill>
      {/* 夜色底光（p5-02 夜语义——沉一档） */}
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${withAlpha('#05070B', 0.12 + 0.3 * night)}, transparent 70%)`, pointerEvents: 'none'}} />
      {/* 环体〔M-001〕定格收束（居中偏左——支链在环外挂定，不入环内） */}
      <div style={{position: 'absolute', left: RING_5A.x, top: RING_5A.y}}>
        <LoopRing size={RING_5A.size} nodes={[]} showExit={false} dotProgress={dotPos} />
      </div>
      {/* 支链（环外一条：长春花蓝表盘 → 队列带（居中隔开）→ 消息流 → 环缘） */}
      <div style={{position: 'absolute', inset: 0, opacity: branch}}>
        {/* 判时表盘 mini（sched——微光长明：夜语义低 glow 常亮 + 每秒一闪减弱） */}
        <div style={{position: 'absolute', left: WATCH_5A.x, top: WATCH_5A.y, opacity: hangP * (0.75 + 0.25 * night * 0)}} >
          <WatchFaceCard size={WATCH_5A.size} litP={1} flashT={(frame % 30) / 30} glow={0.4 + 0.3 * night} flashP={0.55 + 0.25 * night} />
        </div>
        {/* 队列带（居中隔开表盘与环体的连线——隔开的实体化；消息流沿带行进） */}
        <svg width={700} height={220} viewBox={`0 0 700 220`} style={{position: 'absolute', left: WATCH_5A.x - 560, top: beltY - 60, overflow: 'visible'}}>
          {/* 表盘→队列带 垂线 */}
          <line x1={560 + WATCH_5A.size / 2 - 20} y1={8} x2={560 + WATCH_5A.size / 2 - 20} y2={62} stroke={withAlpha(theme.sched, 0.6)} strokeWidth={3.5} />
          {/* 队列带本体（水平实体带——queue；中缀队列点） */}
          <rect x={60} y={62} width={560} height={30} rx={15} fill={withAlpha(theme.panel, 0.97)} stroke={withAlpha(theme.queue, 0.8)} strokeWidth={3} />
          {Array.from({length: 7}, (_, i) => (
            <circle key={`qb${i}`} cx={100 + i * 78} cy={77} r={8} fill={withAlpha(theme.queue, 0.25 + 0.55 * branch)} />
          ))}
          {/* 队列带→环缘 连线（带尾接环——消息流终点） */}
          <line x1={60} y1={77} x2={60 - 40} y2={ringEdge.y - beltY + 60 - 17} stroke={withAlpha(theme.queue, 0.7)} strokeWidth={3.5} strokeLinecap="round" />
          {/* 消息流（沿支链行进——queue 流光点） */}
          <circle cx={60 + (1 - msgT) * 520} cy={77} r={7} fill={theme.queue} opacity={0.85} />
        </svg>
        {/* 支链根部：磁盘文件小签 + 活进程徽章（前提再钉——表盘下方） */}
        <div style={{position: 'absolute', left: WATCH_5A.x + 6, top: WATCH_5A.y + WATCH_5A.size + 106, display: 'flex', gap: 18, opacity: Math.max(disk, live)}}>
          {/* 磁盘文件小签（静止一拍——不会自己跑） */}
          <div style={{display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 9, border: `2.5px solid ${withAlpha(theme.ok, 0.75)}`, background: withAlpha(theme.panel, 0.96), opacity: disk}}>
            <svg width={22} height={22} viewBox="0 0 22 22">
              <rect x={2} y={5} width={18} height={13} rx={3} fill="none" stroke={theme.ok} strokeWidth={2.5} />
              <circle cx={11} cy={11.5} r={3.5} fill="none" stroke={theme.ok} strokeWidth={2} />
            </svg>
            <span style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{'磁盘定义'}</span>
          </div>
          {/* 活进程徽章（呼吸亮——替它看表） */}
          <div style={{display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 12, border: `2.5px solid ${live > 0.3 ? theme.ok : withAlpha(theme.dim, 0.5)}`, background: theme.panel, opacity: live}}>
            <span style={{width: 10, height: 10, borderRadius: '50%', background: live > 0.3 ? theme.ok : withAlpha(theme.dim, 0.6), boxShadow: live > 0.3 ? `0 0 ${6 + 8 * breathe}px ${withAlpha(theme.ok, 0.8)}` : 'none'}} />
            <span style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: live > 0.3 ? theme.ok : theme.dim, whiteSpace: 'nowrap'}}>{'活进程'}</span>
          </div>
        </div>
      </div>
      {/* 金句卡（衬线体覆层——唯一主体；两关键词各压一拍重读） */}
      {quote > 0.02 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: QUOTE_Y, display: 'flex', justifyContent: 'center', zIndex: 3}}>
          <div style={{opacity: quote, transform: `translateY(${(1 - quote) * 20}px)`}}>
            <Panel accent={withAlpha(theme.core, 0.55)} style={{padding: '26px 56px'}}>
              <div style={{fontFamily: theme.serif, fontSize: 42, color: theme.text, whiteSpace: 'nowrap'}}>
                {/* caption-dup-ok: 金句卡刻意复述（收束定格仪式，承 ep1/ep2/ep11
                    5-A 豁免先例——storyboard 5-A 行登记） */}
                <span>{'判时的'}</span>
                <span style={{fontWeight: 700, color: theme.sched, display: 'inline-block', transform: `scale(${1 + 0.05 * k1})`, textShadow: k1G > 0.01 ? `0 0 ${22 * k1G}px ${withAlpha(theme.sched, 0.5)}` : 'none'}}>{'只管看表'}</span>
                <span>{'，干活的'}</span>
                <span style={{fontWeight: 700, color: theme.queue, display: 'inline-block', transform: `scale(${1 + 0.05 * k2})`, textShadow: k2G > 0.01 ? `0 0 ${22 * k2G}px ${withAlpha(theme.queue, 0.5)}` : 'none'}}>{'只管干活'}</span>
              </div>
            </Panel>
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'Scheduler · Queue · 时间感在循环外'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B 下期卡前奏：任务堆渐高 vs 执行位单签「它」 + 下期卡 ───────────────────

const RING_5B = {x: 1120, y: 200, size: 420} as const;
const PILE_5B = {x: 260, y: 360} as const;

const FiveB: React.FC<{atAcc: number; atSolo: number; atPile: number; atNext: number}> = ({atAcc, atSolo, atPile, atNext}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 精准小表盘划过堆顶（p5-04「表排得再准」——准而无用：小表盘沿堆顶滑过、堆不减小）
  const acc = clamp01(progress(frame, atAcc, 34));
  // 执行位「它」签孤立一拍（p5-04「始终只有一个它」——唯一性定格）
  const solo = Math.sin(Math.PI * clamp01(progress(frame, atSolo, 18)));
  // 任务堆再高一层（p5-05「活儿一大，一个干不完」——堆渐高压向环体阴影）
  const pile = clamp01(progress(frame, atPile, 20));
  const layers = 3 + Math.round(pile);
  // 下期卡浮起定格（p5-05「下期」——只点问题不预告机制：堆 vs 单环剪影）
  const next = clamp01(progress(frame, atNext, 18));
  // 环体居中缓转（执行位唯一——环上无指针）
  const dotPos = (frame / (fps * 3)) % 1;
  // 小表盘划过位置（堆顶水平滑过）
  const accX = PILE_5B.x + 40 + acc * 420;
  const accY = PILE_5B.y - 110 - layers * 64;
  return (
    <AbsoluteFill>
      {/* 任务堆（环外左侧——签堆积渐高；只增不减） */}
      <div style={{position: 'absolute', left: PILE_5B.x, top: PILE_5B.y - layers * 64}}>
        {Array.from({length: layers}, (_, i) => {
          const rowP = clamp01(progress(frame, atPile - Math.max(0, 2 - i) * 8, 14));
          return (
            <div
              key={`pl${i}`}
              style={{
                marginLeft: (i % 3) * 26,
                marginTop: 8,
                padding: '8px 22px',
                borderRadius: 9,
                border: `2.5px solid ${withAlpha(theme.dim, 0.7)}`,
                background: withAlpha(theme.panel, 0.95),
                fontFamily: theme.sans,
                fontSize: 19,
                fontWeight: 600,
                color: theme.dim,
                whiteSpace: 'nowrap',
                opacity: rowP * (0.55 + 0.45 * (i === layers - 1 ? 1 : 0.6)),
                transform: `translateY(${(1 - rowP) * 22}px)`,
              }}
            >
              {['待办 · 取数据', '待办 · 改文件', '待办 · 跑测试', '待办 · 发通知'][i % 4]}
            </div>
          );
        })}
      </div>
      {/* 精准小表盘（划过堆顶——准而无用；sched mini 表盘滑过不停留） */}
      {acc > 0.03 && acc < 0.97 ? (
        <div style={{position: 'absolute', left: accX, top: accY, opacity: Math.sin(Math.PI * acc)}}>
          <WatchFaceCard size={92} litP={1} flashT={(frame % 30) / 30} glow={0.8} />
        </div>
      ) : null}
      {/* 环体（居中缓转——执行位唯一） */}
      <div style={{position: 'absolute', left: RING_5B.x, top: RING_5B.y}}>
        <LoopRing size={RING_5B.size} nodes={[]} showExit={false} dotProgress={dotPos} />
        {/* 执行位「它」签（环内底——孤立一拍：唯一性定格；恒单签） */}
        <div
          style={{
            position: 'absolute',
            left: RING_5B.size / 2 - 38,
            top: RING_5B.size / 2 + 20,
            padding: '6px 18px',
            borderRadius: 9,
            border: `3px solid ${withAlpha(theme.core, 0.85)}`,
            background: withAlpha(theme.panel, 0.97),
            fontFamily: theme.sans,
            fontSize: 24,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            transform: `scale(${1 + 0.08 * solo})`,
            boxShadow: solo > 0.1 ? `0 0 ${16 * solo}px ${withAlpha(theme.core, 0.45)}` : 'none',
          }}
        >
          它
        </div>
      </div>
      {/* 下期卡（浮起定格——只点问题：任务堆剪影 vs 单环；「下期」签为唯一预告词） */}
      {next > 0.02 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 700, display: 'flex', justifyContent: 'center', opacity: next, transform: `translateY(${(1 - next) * 18}px)`}}>
          <Panel accent={theme.core} style={{padding: '18px 40px', display: 'flex', alignItems: 'center', gap: 30}}>
            {/* 堆剪影（左——越堆越高） */}
            <svg width={120} height={110} viewBox="0 0 120 110">
              {[0, 1, 2, 3].map((i) => (
                <rect key={`np${i}`} x={14 + i * 8} y={86 - i * 24} width={86 - i * 12} height={18} rx={4} fill="none" stroke={withAlpha(theme.dim, 0.85)} strokeWidth={3} />
              ))}
            </svg>
            <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, whiteSpace: 'nowrap'}}>{'vs'}</span>
            {/* 单环剪影（右——只有一个它） */}
            <svg width={100} height={110} viewBox="0 0 100 110">
              <circle cx={50} cy={55} r={38} fill="none" stroke={theme.core} strokeWidth={5} />
            </svg>
            <span style={{fontFamily: theme.serif, fontSize: 32, fontWeight: 700, color: theme.text, letterSpacing: 8, paddingLeft: 8, whiteSpace: 'nowrap'}}>下期</span>
          </Panel>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'干活的 · 始终只有一个'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C 片尾署源卡（尾部署源位，RSI I-080 豁免） ─────────────────────────────

const CreditCard: React.FC<{atCard: number; durCard: number}> = ({atCard, durCard}) => {
  // 卡随 p5-06 口播同拍淡入；两行先后落定（署源专名口播例外随行）
  const card = useEnter('rise', {at: atCard + 2, dur: DUR.f6, dist: 24, restBottom: 560});
  const l1At = atCard + Math.round(durCard * 0.3);
  const l1 = useProgress(l1At, DUR.f5);
  const l2At = l1At + DUR.f6;
  const l2 = useProgress(l2At, DUR.f5);
  const mit = useProgress(l2At + 8, DUR.f4);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: 316,
        opacity: card.opacity,
        transform: card.transform,
      }}
    >
      <Panel accent={withAlpha(theme.sched, 0.4)} style={{position: 'relative', padding: '46px 64px', textAlign: 'center'}}>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 56,
            fontWeight: 700,
            color: theme.text,
            letterSpacing: 2,
            whiteSpace: 'nowrap',
            opacity: l1,
            transform: `translateY(${(1 - l1) * 12}px)`,
          }}
        >
          {'Learn Claude Code'}
        </div>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 28,
            color: theme.dim,
            marginTop: 20,
            whiteSpace: 'nowrap',
            opacity: l2,
            transform: `translateY(${(1 - l2) * 10}px)`,
          }}
        >
          {'github.com/shareAI-lab/learn-claude-code'}
        </div>
        {/* 角注（卡面第 3 行信息，≤3 行封顶） */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 20,
            fontFamily: theme.mono,
            fontSize: 16,
            color: theme.dim,
            letterSpacing: 1,
            opacity: mit * 0.9,
          }}
        >
          {'MIT'}
        </div>
      </Panel>
    </div>
  );
};

/** 幕末渐黑（红线四）：窗 = 末 beat 总时长（p5-06..p5-07 之和），终点即本幕终点 */
const FadeTail: React.FC<{span: number}> = ({span}) => {
  const keep = useFadeOut(span, {frames: 36});
  return <AbsoluteFill style={{background: '#000', opacity: 1 - keep, pointerEvents: 'none'}} />;
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P5BranchAndNext: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p5-01', 'p5-03');
  const bB = w('p5-04', 'p5-05');
  const bC = w('p5-06', 'p5-07');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A">
        <FiveA
          atQuote={wa('p5-01', 0.1) - bA.from}
          atK1={wa('p5-01', 0.42) - bA.from}
          atK2={wa('p5-01', 0.6) - bA.from}
          atBranch={wa('p5-01', 0.8) - bA.from}
          atHang={wa('p5-02', 0.24) - bA.from}
          atNight={wa('p5-02', 0.7) - bA.from}
          atDisk={wa('p5-03', 0.45) - bA.from}
          atLive={wa('p5-03', 0.75) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <FiveB
          atAcc={wa('p5-04', 0.3) - bB.from}
          atSolo={wa('p5-04', 0.68) - bB.from}
          atPile={wa('p5-05', 0.15) - bB.from}
          atNext={wa('p5-05', 0.65) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="5-C">
        <CreditCard atCard={at('p5-06') - bC.from} durCard={span('p5-06')} />
        {/* 幕末渐黑：最后子节点，盖过署源卡（全片最后画面在此收束） */}
        <FadeTail span={bC.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5BranchAndNext;
