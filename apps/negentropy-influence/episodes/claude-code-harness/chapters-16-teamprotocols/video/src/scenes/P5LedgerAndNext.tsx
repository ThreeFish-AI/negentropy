/** P5 收束与下期（p5-01..p5-07，4 镜）——分镜 5-A / 5-B / 5-C / 5-D。
 *
 *  幕间转场（4-D→5-A，头注明示）：生产对照 → 收束定格属语义断裂，走
 *  SceneFade；环体以〔M-001〕同形签名回归（镜间身份恒常，非 morph，承
 *  ep2/ep15 4-D→5-A 形态）。
 *
 *  叙事链：5-A 环体定格收束 + 金句卡（衬线体）：p5-01 金句卡淡入定格、「不靠
 *  自觉」「协议状态机」两词各压一拍重读排版、环体整环静止一拍（静止即陈述
 *  ——p2-06b 命名铺设在此兑现）、「轮末查信」高亮段仍亮（承 4-B 锁定）→
 *  5-B 收束走账：p5-02「这三样，登记表全兜住」词落位三裂缝逐枚飞回被对应
 *  检查栏徽章（①②③）压灭（重音镜：P0 预埋回收兑现）→ p5-03「都只是协议的
 *  参与者」词落位两环分立贴签、「由结构兜底」词落位登记表外框整体亮一拍 →
 *  p5-03b「翻开那本回执簿」词落位簿翻回入场、「对上号，才算数」词落位三态
 *  胶囊收进封面、靛蓝编号徽章戳压定、簿页合上定格（首尾呼应 P0「一句『行』
 *  不算数」——附录 A 唯一正主收口，重音镜）→ 5-C 下期卡（视觉层）：p5-04
 *  「挨个派」词落位派活队列逐卡叠长 → p5-05「派活先成瓶颈」词落位队尾压弯
 *  一拍、「下期，没人派活」词落位「下期」签点亮 + 队首问号闪烁定格（只点
 *  问题不预告机制）→ 5-D 片尾署源卡：p5-06 卡随口播同拍淡入两行先后落定、
 *  p5-07 静持（漂移警示由口播承载，卡面零复述），全片在此卡收束。
 *
 *  空间契约：金句卡为唯一主体、衬线体、环体同形定格、卡外禁新增装饰、高亮段
 *  禁熄灭；裂缝图标与 0-C 同款同位、回执簿与 1-B 同款、编号徽章戳与 0-C/1-A
 *  徽章同形；任务卡为剪影级、问号在队首（问题悬置）；署源卡为最后画面、卡面
 *  ≤3 行信息。
 *  红线落实：裂缝压灭禁无轨迹、回执簿禁提前于 p5-03b 合上、簿面文字禁复述
 *  口播句、队列禁显出认领/自治机制图形（下期正源）、「下期」外禁出现预告词、
 *  卡面禁复述口播整句、字号禁低于可读阈值；词落位 = wa(id,f)；y≥56 /
 *  bottom≥176；尾幕渐黑窗 = 末镜总时长。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CrackIcon, HookArc, LoopRing, Panel, RegistryTable, ReceiptBook, TeammateRing, useRingDot} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useFadeOut, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 5-A 环体定格收束 + 金句卡（衬线体） ────────────────────────────────────

const RING_5A = {x: 490, y: 240, size: 420} as const;
const QUOTE_5A = {x: 1010, y: 330} as const;
/** 环侧缩微表顶 y 720——安全带红线：micro 档两行底边 = 720 + 40 + 2×44 + 10
 *  = 858 恒 ≤ 860（字幕带上方 160px 带之上）；加行须同步核此常量。 */

const FiveA: React.FC<{atQuote: number; atK1: number; atK2: number}> = ({atQuote, atK1, atK2}) => {
  const frame = useCurrentFrame();
  // 金句卡淡入定格（收束仪式——衬线体覆层）
  const quote = useProgress(atQuote, DUR.f5);
  // 两关键词各压一拍重读（「不靠自觉」/「协议状态机」）
  const k1 = Math.sin(Math.PI * clamp01(progress(frame, atK1, DUR.f6)));
  const k2 = Math.sin(Math.PI * clamp01(progress(frame, atK2, DUR.f6)));
  const k1G = clamp01(progress(frame, atK1, DUR.f5));
  const k2G = clamp01(progress(frame, atK2, DUR.f5));
  // 环体整环静止一拍（金句起停转——静止即陈述；高亮段仍亮承 4-B 锁定）
  const dot = useRingDot(2.5);
  const freeze = clamp01(progress(frame, atQuote, 10));
  return (
    <AbsoluteFill>
      {/* 背景 P4 元素整体退为暗层（生产对照缩影——收束不抢焦） */}
      {[{x: 90, y: 640}, {x: 1720, y: 620}, {x: 1560, y: 780}].map((p, i) => (
        <svg key={`bg${i}`} width={110} height={110} viewBox="0 0 110 110" style={{position: 'absolute', left: p.x, top: p.y, opacity: 0.15}}>
          <rect x={14} y={20} width={82} height={70} rx={9} fill="none" stroke={theme.req} strokeWidth={4} />
        </svg>
      ))}
      {/* 环体〔M-001〕居中同形回归（描边/线宽承全片锚定；「轮末查信」段仍亮） */}
      <div style={{position: 'absolute', left: RING_5A.x, top: RING_5A.y, width: RING_5A.size, height: RING_5A.size}}>
        <LoopRing size={RING_5A.size} nodes={[]} showExit={false} dotProgress={freeze >= 1 ? undefined : dot} />
        <HookArc size={RING_5A.size} litP={1} />
      </div>
      {/* 环侧登记表缩微驻位（三态胶囊带可见） */}
      <div style={{position: 'absolute', left: 96, top: 720, opacity: 0.9}}>
        <RegistryTable
          x={0}
          y={0}
          w={520}
          micro
          rows={[
            {key: 'a', badge: '142', type: '关机', to: '队友甲', state: 'approved', stateP: 1},
            {key: 'b', badge: undefined, type: '计划审批', to: '主代理', state: 'approved', stateP: 1},
          ]}
        />
      </div>
      {/* 金句卡（衬线体覆层——唯一主体；两关键词各压一拍重读排版） */}
      {quote > 0.02 ? (
        <div style={{position: 'absolute', left: QUOTE_5A.x, top: QUOTE_5A.y, zIndex: 3, opacity: quote, transform: `translateY(${(1 - quote) * 20}px)`}}>
          <Panel accent={withAlpha(theme.core, 0.55)} style={{padding: '30px 52px'}}>
            <div style={{fontFamily: theme.serif, fontSize: 42, color: theme.text, whiteSpace: 'nowrap'}}>
              {/* caption-dup-ok: 金句卡刻意复述（收束定格仪式，承 ep1/ep2/ep15
                  5-A 豁免先例——storyboard 5-A 行登记） */}
              <span>{'关键协商，'}</span>
              <span style={{fontWeight: 700, color: theme.danger, display: 'inline-block', transform: `scale(${1 + 0.06 * k1})`, textShadow: k1G > 0.01 ? `0 0 ${22 * k1G}px ${withAlpha(theme.danger, 0.5)}` : 'none'}}>{'不靠自觉，'}</span>
              <span>{'靠'}</span>
              <span style={{fontWeight: 700, color: theme.core, display: 'inline-block', transform: `scale(${1 + 0.06 * k2})`, textShadow: k2G > 0.01 ? `0 0 ${22 * k2G}px ${withAlpha(theme.core, 0.5)}` : 'none'}}>{'协议状态机'}</span>
            </div>
          </Panel>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'ProtocolState · 对上号，才改状态'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B 收束走账：三裂缝飞回压灭 + 参与者分立 + 回执簿合上收口 ──────────────

const TABLE_5B = {x: 510, y: 180, w: 900} as const;
const RINGS_5B = [
  {x: 120, y: 320, size: 250},
  {x: 1600, y: 320, size: 250},
] as const;
const BOOK_5B = {x: 660, y: 540, w: 600, h: 300} as const;
/** 三裂缝飞回位（表框左缘——①②③ 检查栏徽章压灭位；0-C 同款三签） */
const CRUSH_5B = [
  {from: {x: 240, y: 700}, at: {x: 530, y: 300}, no: '①'},
  {from: {x: 960, y: 830}, at: {x: 530, y: 380}, no: '②'},
  {from: {x: 1660, y: 700}, at: {x: 530, y: 460}, no: '③'},
] as const;
const CRACK_LABELS = ['漏', '认错单', '重复生效'] as const;

const FiveB: React.FC<{atCrush: number[]; atRoles: number; atFrameGlow: number; atBook: number; atSeal: number}> = ({atCrush, atRoles, atFrameGlow, atBook, atSeal}) => {
  const frame = useCurrentFrame();
  // 三裂缝逐枚飞回 + 压灭（重音镜：P0 预埋回收兑现——飞回有轨迹、徽章压灭）
  const crush = atCrush.map((a) => clamp01(progress(frame, a, 26)));
  // 两环分立贴「参与者」小签（主代理/队友——都只是协议的参与者）
  const roles = clamp01(progress(frame, atRoles, DUR.f5));
  // 登记表外框整体亮一拍（表 = 结构的具象）
  const glow = Math.sin(Math.PI * clamp01(progress(frame, atFrameGlow, 26)));
  // 回执簿翻回入场（p5-03b「翻开那本回执簿」）
  const book = clamp01(progress(frame, atBook, DUR.f5));
  // 三态胶囊收进封面 + 徽章戳压定 + 簿页合上定格（「对上号，才算数」）
  const pills = clamp01(progress(frame, atSeal, DUR.f4));
  const seal = clamp01(progress(frame, atSeal + 10, 12));
  const close = clamp01(progress(frame, atSeal + 20, 16));
  const dot = useRingDot(2.5);
  return (
    <AbsoluteFill>
      {/* 登记表放大回驻（142 闭环行 + 计划审批行；外框亮一拍 = 结构兜底） */}
      <div style={{position: 'absolute', left: TABLE_5B.x, top: TABLE_5B.y, opacity: 1 - close * 0.5}}>
        <RegistryTable
          x={0}
          y={0}
          w={TABLE_5B.w}
          nameP={1}
          frameGlow={glow}
          rows={[
            {key: 'a', badge: '142', type: '关机', to: '队友甲', state: 'approved', stateP: 1, closedP: 1},
            {key: 'b', badge: undefined, type: '计划审批', to: '主代理', state: 'approved', stateP: 1},
          ]}
        />
      </div>
      {/* 三裂缝飞回压灭（0-C 同款三签——各被对应检查栏徽章压灭） */}
      {CRUSH_5B.map((c, i) => {
        const p = crush[i];
        if (p <= 0.02) return null;
        const x = c.from.x + (c.at.x - c.from.x) * p;
        const y = c.from.y + (c.at.y - c.from.y) * p;
        return (
          <div key={`cr${i}`} style={{position: 'absolute', left: x, top: y}}>
            <CrackIcon x={0} y={0} crackP={1} snuffP={p} label={CRACK_LABELS[i]} />
            {/* 检查栏徽章（①②③——压灭拍盖上） */}
            <div
              style={{
                position: 'absolute',
                left: 14,
                top: 10,
                width: 46,
                height: 46,
                borderRadius: '50%',
                border: `3.5px solid ${withAlpha(theme.ok, 0.9)}`,
                background: withAlpha(theme.panel, 0.95),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.mono,
                fontSize: 22,
                fontWeight: 700,
                color: theme.ok,
                transform: `scale(${1 + (1 - Math.max(0, p - 0.6) / 0.4) * 0.6})`,
                opacity: clamp01((p - 0.55) * 3),
              }}
            >
              {c.no}
            </div>
          </div>
        );
      })}
      {/* 两环分立表两侧（主代理橙环 / 队友品红环——各携「参与者」小签） */}
      {RINGS_5B.map((r, i) => (
        <div key={`rr${i}`} style={{position: 'absolute', left: r.x, top: r.y, opacity: roles * (1 - close * 0.4)}}>
          {i === 0 ? <LoopRing size={r.size} nodes={[]} showExit={false} dotProgress={dot} /> : <TeammateRing size={r.size} dotProgress={(dot + 0.4) % 1} />}
          <div
            style={{
              position: 'absolute',
              left: r.size / 2 - 62,
              top: r.size + 10,
              padding: '6px 20px',
              borderRadius: 9,
              border: `2.5px solid ${withAlpha(theme.dim, 0.8)}`,
              background: withAlpha(theme.panel, 0.96),
              fontFamily: theme.sans,
              fontSize: 18,
              fontWeight: 700,
              color: theme.dim,
              whiteSpace: 'nowrap',
            }}
          >
            {i === 0 ? '主代理 · 参与者' : '队友 · 参与者'}
          </div>
        </div>
      ))}
      {/* 回执簿翻回入场（1-B 同款——三态胶囊收进封面、徽章戳压定、合上定格） */}
      {book > 0.02 ? (
        <div style={{position: 'absolute', left: BOOK_5B.x, top: BOOK_5B.y, opacity: book, transform: `translateY(${(1 - book) * 30}px)`}}>
          <ReceiptBook x={0} y={0} w={BOOK_5B.w} h={BOOK_5B.h} openP={1} closeP={close} sealP={seal} pillsP={pills} />
          {/* 合上定格读出（首尾呼应 P0——对上号，才算数） */}
          {close > 0.6 ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: BOOK_5B.h / 2 - 60,
                textAlign: 'center',
                fontFamily: theme.serif,
                fontSize: 30,
                fontWeight: 700,
                color: theme.text,
                whiteSpace: 'nowrap',
                opacity: clamp01((close - 0.6) * 2.5),
              }}
            >
              对上号，才算数
            </div>
          ) : null}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'口信三坏法全兜住 · 对错由结构兜底'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C 下期卡：派活队列越排越长、队首问号闪烁（只点问题） ───────────────────

const RING_5C = {x: 200, y: 300, size: 380} as const;
/** 派活队列（7 卡——右缘 = 640 + 6×(150+26) + 150 = 1846 恒 ≤ 1920 画布内） */
const QUEUE_5C = {x: 640, y: 460, cardW: 150, cardH: 96, gap: 26, n: 7} as const;

const FiveC: React.FC<{atGrow: number[]; atBend: number; atNext: number}> = ({atGrow, atBend, atNext}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  // 队列逐卡叠长（stagger——任务卡剪影）
  const grows = atGrow.map((a) => clamp01(progress(frame, a, 12)));
  // 队尾压弯一拍（「派活先成瓶颈」——末端下沉弹性）
  const bend = Math.sin(Math.PI * clamp01(progress(frame, atBend, 26)));
  // 「下期」签点亮 + 队首问号闪烁定格（只点问题不预告机制）
  const next = clamp01(progress(frame, atNext, DUR.f5));
  const blink = 0.5 + 0.5 * Math.sin(frame / 5);
  return (
    <AbsoluteFill>
      {/* 主代理橙环（面前派活——队列起点） */}
      <div style={{position: 'absolute', left: RING_5C.x, top: RING_5C.y}}>
        <LoopRing size={RING_5C.size} nodes={[]} showExit={false} dotProgress={dot} />
        <div style={{position: 'absolute', left: 52, top: RING_5C.size + 8, fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.core, whiteSpace: 'nowrap'}}>
          主代理 · 挨个派
        </div>
      </div>
      {/* 派活队列（任务卡剪影叠成长龙——自环前向右排开；队尾压弯） */}
      {Array.from({length: QUEUE_5C.n}, (_, i) => {
        const g = grows[i] ?? 0;
        if (g <= 0.02) return null;
        const isTail = i >= QUEUE_5C.n - 2;
        const sag = isTail ? bend * 22 : 0;
        return (
          <div
            key={`q${i}`}
            style={{
              position: 'absolute',
              left: QUEUE_5C.x + i * (QUEUE_5C.cardW + QUEUE_5C.gap),
              top: QUEUE_5C.y + sag - i * 4,
              width: QUEUE_5C.cardW,
              height: QUEUE_5C.cardH,
              borderRadius: 10,
              border: `3px solid ${withAlpha(theme.dim, 0.55)}`,
              background: withAlpha(theme.panel, 0.92),
              opacity: g * 0.95,
              transform: `translateY(${(1 - g) * 14}px)`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-evenly',
              padding: '12px 16px',
            }}
          >
            <span style={{height: 9, borderRadius: 3, background: withAlpha(theme.dim, 0.4)}} />
            <span style={{height: 9, width: '68%', borderRadius: 3, background: withAlpha(theme.dim, 0.3)}} />
          </div>
        );
      })}
      {/* 队首问号签（闪烁定格——问题悬置；不预告认领/自治机制图形） */}
      <div
        style={{
          position: 'absolute',
          left: QUEUE_5C.x - 40,
          top: QUEUE_5C.y + 8,
          fontFamily: theme.serif,
          fontSize: 56,
          fontWeight: 700,
          color: theme.text,
          opacity: next * (0.35 + 0.65 * blink),
        }}
      >
        ？
      </div>
      {/* 「下期」签（卡面唯一预告词） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 200,
          textAlign: 'center',
          opacity: next,
          transform: `translateY(${(1 - next) * -14}px)`,
        }}
      >
        <span style={{fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: theme.text, letterSpacing: 10, whiteSpace: 'nowrap'}}>下期</span>
        <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginLeft: 26, whiteSpace: 'nowrap'}}>没人派活</span>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'活至今是主代理挨个派 · 队伍一大先成瓶颈'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-D 片尾署源卡（尾部署源位——豁免登记于工作区配置） ─────────────────────

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
      <Panel accent={withAlpha(theme.req, 0.4)} style={{position: 'relative', padding: '46px 64px', textAlign: 'center'}}>
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

/** 幕末渐黑（红线四）：窗 = 末镜总时长（p5-06..p5-07 之和），终点即本幕终点 */
const FadeTail: React.FC<{span: number}> = ({span}) => {
  const keep = useFadeOut(span, {frames: 36});
  return <AbsoluteFill style={{background: '#000', opacity: 1 - keep, pointerEvents: 'none'}} />;
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P5LedgerAndNext: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p5-01', 'p5-01');
  const bB = w('p5-02', 'p5-03b');
  const bC = w('p5-04', 'p5-05');
  const bD = w('p5-06', 'p5-07');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A">
        <FiveA atQuote={wa('p5-01', 0.08) - bA.from} atK1={wa('p5-01', 0.44) - bA.from} atK2={wa('p5-01', 0.72) - bA.from} />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <FiveB
          atCrush={[wa('p5-02', 0.5), wa('p5-02', 0.62), wa('p5-02', 0.74)].map((v) => v - bB.from)}
          atRoles={wa('p5-03', 0.32) - bB.from}
          atFrameGlow={wa('p5-03', 0.72) - bB.from}
          atBook={wa('p5-03b', 0.18) - bB.from}
          atSeal={wa('p5-03b', 0.55) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="5-C">
        <FiveC atGrow={Array.from({length: 7}, (_, i) => wa('p5-04', 0.3) + i * 3 - bC.from)} atBend={wa('p5-05', 0.26) - bC.from} atNext={wa('p5-05', 0.56) - bC.from} />
      </Sequence>
      <Sequence {...bD} name="5-D">
        <CreditCard atCard={at('p5-06') - bD.from} durCard={span('p5-06')} />
        {/* 幕末渐黑：最后子节点，盖过署源卡（全片最后画面在此收束） */}
        <FadeTail span={bD.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5LedgerAndNext;
