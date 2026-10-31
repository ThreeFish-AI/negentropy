/** P5 收束与下期（p5-01..p5-07，4 镜）——分镜 5-A / 5-B / 5-C / 5-D。
 *
 *  ★ 5-A 环体定格收束 + 金句卡（衬线体）：环体居中同形回归〔M-001〕（描边色/
 *    线宽承全片锚定——LoopRing 恒定），环外圈五个固定挂点槽位（五件工具小卡
 *    各驻一槽、互不连线——「各管各的」的空间陈述）；「核心不变」「正交叠加」
 *    两词各压一拍重读排版；「一行没改」环体整环静止一拍（静止即陈述）。
 *    背景生产舞台元素整体退为暗层。
 *  ★ 5-B 五指手掌（A#2 回扣）：琥珀手掌五指展开，五件工具卡自小指起依次入指
 *    （bash 驻拇指——0-C「滑向拇指位」的终态）；四文件指尖各带 1-D 同款边界
 *    小框（「有边界」绿边点亮），bash 指尖无框、「还全开着」泛无界光晕；
 *    「删盘命令」一道珊瑚红命令影掠过（警示不落地——禁显示为成功执行态）。
 *  ★ 5-C 下期卡（视觉层）：暗场门剪影自下浮起（门缝透一线微光），旁缀「下期」
 *    签——只点问题不预告机制（门内不透出下期机制图形）。
 *  ★ 5-D 片尾署源卡（尾部署源位，RSI I-080 豁免）：主行 Learn Claude Code /
 *    次行仓库地址 / 角注 MIT（卡面 ≤3 行）；p5-07 漂移警示由口播承载、卡面
 *    零复述；全片在此卡收束（黑场前最后画面）。
 *  ★ 尾幕渐黑（红线四）：窗取末 beat 总时长（p5-06..p5-07 之和）——终点即本幕
 *    终点，勿改用末句单句窗。收尾版式不挂 SceneTag（承 ep1 先例）。
 *  ★ 5-A 金句卡与口播 p5-01 部分重合是 storyboard 已豁免的刻意复述
 *    （caption-dup-ok：收束定格仪式，承 ep1 5-A 豁免先例）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LoopRing, Panel, TABLE_ROWS} from '../components/motifs';
import {DUR, clamp01, progress, useBreathe, useEnter, useFadeOut, useImpulse, useProgress} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const polar = (cx: number, cy: number, r: number, deg: number): {x: number; y: number} => {
  const rad = (deg * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
};

/** 金句关键词：重读排版（字重/字号差）+ 词落位各压一拍（一次性脉冲 + 常驻辉光） */
const KeyWord: React.FC<{at: number; children: React.ReactNode}> = ({at, children}) => {
  const pop = useImpulse({at, dur: DUR.f6, peak: 0.07});
  const glow = useProgress(at, DUR.f5);
  return (
    <span
      style={{
        fontSize: 68,
        fontWeight: 700,
        color: theme.core,
        display: 'inline-block',
        transform: `scale(${1 + pop})`,
        textShadow: glow > 0.01 ? `0 0 ${22 * glow}px ${withAlpha(theme.core, 0.5)}` : 'none',
      }}
    >
      {children}
    </span>
  );
};

// ── 5-A 环体定格收束 + 金句卡 + 五挂点槽位 ──────────────────────────────

const QUOTE_A = {cx: 960, cy: 500, size: 620} as const;

const QuoteShot: React.FC<{atQuote: number; atCore: number; atOrtho: number; atSlots: number; atStill: number}> = ({
  atQuote,
  atCore,
  atOrtho,
  atSlots,
  atStill,
}) => {
  const frame = useCurrentFrame();
  const ringO = useProgress(atQuote, DUR.f5);
  const card = useEnter('pop', {at: atQuote + 6, dur: DUR.f6});
  // 五槽位依次点亮（stagger——useProgress 纯函数列；槽位间明确无连线）
  const slots = [0, 1, 2, 3, 4].map((i) => clamp01(progress(frame, atSlots + i * 5, DUR.f3)));
  // 「一行没改」：环体整环静止一拍（定格 + 辉光一次不过冲）
  const stillGlow = useImpulse({at: atStill, dur: DUR.f6});
  const r = QUOTE_A.size / 2 - 46;
  return (
    <AbsoluteFill>
      {/* 背景生产舞台元素退为暗层（门位残影——4 幕舞台的收束水印） */}
      <div style={{position: 'absolute', inset: 0, opacity: 0.16}}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 800,
              top: 200 + i * 140,
              width: 200,
              height: 104,
              borderRadius: 12,
              border: `2px dashed ${theme.panelBorder}`,
            }}
          />
        ))}
      </div>
      {/* 环体居中同形回归（M-001：恒 core 描边 + RING_STROKE；定格不转） */}
      <div style={{position: 'absolute', left: QUOTE_A.cx - QUOTE_A.size / 2, top: QUOTE_A.cy - QUOTE_A.size / 2, opacity: ringO * 0.55}}>
        <LoopRing size={QUOTE_A.size} nodes={[0, 1, 2, 3, 4].map((i) => ({label: `s${i}`, angle: -90 + i * 72}))} showLabels={false} showExit={false} dimNodes />
      </div>
      {stillGlow > 0.01 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          <circle cx={QUOTE_A.cx} cy={QUOTE_A.cy} r={r} fill="none" stroke={theme.core} strokeWidth={10} opacity={0.6 * stillGlow} />
        </svg>
      ) : null}
      {/* 环外圈五个固定挂点槽位（互不连线——正交语义的空间陈述） */}
      {TABLE_ROWS.map((t, i) => {
        const p = polar(QUOTE_A.cx, QUOTE_A.cy, r + 92, -90 + i * 72);
        return (
          <div
            key={t.en}
            style={{
              position: 'absolute',
              left: p.x - 62,
              top: p.y - 28,
              width: 124,
              height: 56,
              boxSizing: 'border-box',
              borderRadius: 10,
              border: `2px solid ${slots[i] > 0.5 ? theme.mech : theme.panelBorder}`,
              background: slots[i] > 0.5 ? `${theme.mech}16` : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.45 + 0.55 * slots[i],
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 600, color: slots[i] > 0.5 ? theme.text : theme.dim}}>
              {t.zh}
            </span>
          </div>
        );
      })}
      {/* 金句卡（唯一主体，衬线体；caption-dup-ok: 收束定格仪式，承 ep1 5-A 豁免先例） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: card.opacity,
          transform: card.transform,
        }}
      >
        <Panel accent={theme.core} style={{padding: '54px 76px'}}>
          <div style={{fontFamily: theme.serif, fontSize: 54, color: theme.text, lineHeight: 1.25, whiteSpace: 'nowrap'}}>
            <KeyWord at={atCore}>{'核心不变'}</KeyWord>
            {' · '}
            <KeyWord at={atOrtho}>{'正交叠加'}</KeyWord>
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B 五指手掌：五卡入指 + 边界框 + 无界光晕 + 删盘警示 ────────────────

/** 琥珀手掌（mech 描边——A#2 回扣；几何与 P0 灰手同构：掌 + 四指 + 拇指） */
const FINGERS5 = [
  {x: -175, len: 185},
  {x: -75, len: 215},
  {x: 25, len: 190},
  {x: 125, len: 140},
] as const;

/** 指尖卡位（小指起依次：找 / 改 / 写 / 读 / 跑命令=bash 拇指） */
const FINGER_TOOLS = [
  {zh: '找文件', fx: 125, fy: -70 - 140 + 18, bash: false},
  {zh: '改文件', fx: 25, fy: -70 - 190 + 18, bash: false},
  {zh: '写文件', fx: -75, fy: -70 - 215 + 18, bash: false},
  {zh: '读文件', fx: -175, fy: -70 - 185 + 18, bash: false},
  {zh: '跑命令', fx: -330, fy: -175, bash: true},
] as const;

const AmberHand: React.FC = () => (
  <svg width={700} height={430} viewBox="-350 -180 700 430" style={{position: 'absolute', left: 960 - 350, top: 780 - 180, overflow: 'visible'}}>
    <rect x={-240} y={-70} width={480} height={190} rx={40} fill={theme.bg} stroke={theme.mech} strokeWidth={5} />
    {FINGERS5.map((f) => (
      <rect key={f.x} x={f.x - 23} y={-70 - f.len} width={46} height={f.len + 44} rx={23} fill={theme.bg} stroke={theme.mech} strokeWidth={5} />
    ))}
    <g transform={`translate(${-258} ${-16}) rotate(36)`}>
      <rect x={-25} y={-155} width={50} height={170} rx={25} fill={theme.bg} stroke={theme.mech} strokeWidth={5} />
    </g>
  </svg>
);

const FingersShot: React.FC<{atFingers: number; atBound: number; atOpen: number; atDanger: number}> = ({
  atFingers,
  atBound,
  atOpen,
  atDanger,
}) => {
  const frame = useCurrentFrame();
  // 五卡自小指起依次入指
  const ins = FINGER_TOOLS.map((_, i) => clamp01(progress(frame, atFingers + i * 6, DUR.f4)));
  // 四文件指边界小框绿边点亮（1-D 同款虚线框形态；「有边界」）
  const boundO = useProgress(atBound, DUR.f4);
  // bash 指尖无界光晕（「还全开着」——径向呼吸）
  const openO = useProgress(atOpen, DUR.f4);
  const halo = useBreathe({period: 90, amp: 0.3, base: 0.6, offset: atOpen});
  // 删盘命令影（「删盘命令」——珊瑚红淡影自 bash 指尖掠过，警示不落地）
  const dangerU = useProgress(atDanger, 14, 'linear');
  const dangerO = Math.sin(Math.PI * Math.min(1, Math.max(0, dangerU))) * (dangerU > 0 && dangerU < 1 ? 1 : 0);
  const DX0 = 560;
  const DX1 = 250;
  return (
    <AbsoluteFill>
      <AmberHand />
      {/* 指尖五卡 + 四指边界框 */}
      {FINGER_TOOLS.map((t, i) => {
        const inP = ins[i];
        const x = 960 + t.fx - 66;
        const y = 780 + t.fy - 62;
        return (
          <div key={t.zh} style={{position: 'absolute', left: x, top: y, opacity: inP, transform: `translateY(${(1 - inP) * 16}px)`}}>
            <div
              style={{
                width: 132,
                height: 60,
                boxSizing: 'border-box',
                borderRadius: 10,
                border: `2.5px solid ${t.bash ? theme.dim : theme.mech}`,
                background: t.bash ? 'transparent' : `${theme.mech}14`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: t.bash ? theme.dim : theme.text}}>{t.zh}</span>
            </div>
            {/* 边界小框（仅四文件指；绿边点亮） */}
            {!t.bash ? (
              <div
                style={{
                  position: 'absolute',
                  inset: -7,
                  borderRadius: 14,
                  border: `2px dashed ${theme.ok}`,
                  opacity: 0.85 * boundO,
                }}
              />
            ) : null}
          </div>
        );
      })}
      {/* bash 指尖无界光晕（空框位泛起一圈——「还全开着」） */}
      {openO > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: 960 - 330 - 96 + 60,
            top: 780 - 175 - 90 + 40,
            width: 240,
            height: 220,
            borderRadius: 999,
            background: `radial-gradient(circle, ${withAlpha(theme.warn, 0.22 * halo * openO)} 0%, transparent 68%)`,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {/* 删盘命令影（自 bash 指尖掠过——警示不落地，非成功执行态） */}
      {dangerO > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: DX0 + (DX1 - DX0) * dangerU,
            top: 560,
            opacity: dangerO,
            padding: '6px 14px',
            borderRadius: 8,
            border: `2px solid ${withAlpha(theme.warn, 0.7)}`,
            background: withAlpha(theme.bg, 0.7),
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.warn, whiteSpace: 'nowrap'}}>{'rm -rf /'}</span>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, top: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 21, color: theme.dim, opacity: boundO}}>
        {'四件有界 · bash 全开'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C 下期卡：暗场门剪影 ──────────────────────────────────────────────

const NextShot: React.FC<{atDoor: number; atSign: number}> = ({atDoor, atSign}) => {
  // 手掌余位退居暗层；门剪影自下浮起（门缝透一线微光）
  const doorRise = useProgress(atDoor, DUR.f6, 'decelerate');
  const glow = useBreathe({period: 120, amp: 0.35, base: 0.55, offset: atDoor});
  const signO = useProgress(atSign, DUR.f3);
  const signPulse = useImpulse({at: atSign + DUR.f3, dur: DUR.f5, peak: 0.06});
  return (
    <AbsoluteFill>
      {/* 暗层余位（5-B 手掌的收束水印） */}
      <div style={{position: 'absolute', inset: 0, opacity: 0.14}}>
        <AmberHand />
      </div>
      {/* 门剪影（自下浮起定格；只点问题不预告机制） */}
      <div style={{position: 'absolute', left: 960 - 200, top: 330 + (1 - doorRise) * 130, opacity: doorRise}}>
        <svg width={400} height={580} viewBox="0 0 400 580">
          <path
            d="M40 570 L40 120 Q40 30 200 30 Q360 30 360 120 L360 570 Z"
            fill={theme.panel}
            stroke={withAlpha(theme.dim, 0.75)}
            strokeWidth={5}
          />
          {/* 门缝透一线微光（呼吸——问题的钩子） */}
          <line x1={200} y1={90} x2={200} y2={540} stroke={theme.mech} strokeWidth={4} opacity={0.5 * glow} />
          <line x1={200} y1={90} x2={200} y2={540} stroke={theme.mech} strokeWidth={14} opacity={0.1 * glow} />
          {/* 门把 */}
          <circle cx={168} cy={330} r={9} fill="none" stroke={withAlpha(theme.dim, 0.8)} strokeWidth={4} />
        </svg>
      </div>
      {/* 「下期」签（签面点亮——唯一文字） */}
      <div
        style={{
          position: 'absolute',
          left: 1230,
          top: 470,
          opacity: signO,
          transform: `scale(${1 + signPulse})`,
        }}
      >
        <Panel accent={theme.core} style={{padding: '14px 30px'}}>
          <span style={{fontFamily: theme.serif, fontSize: 36, fontWeight: 700, color: theme.text, letterSpacing: 10, paddingLeft: 10}}>
            {'下期'}
          </span>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 5-D 片尾署源卡（尾部署源位，RSI I-080 豁免） ────────────────────────

const CreditCard: React.FC<{atCard: number; durCard: number}> = ({atCard, durCard}) => {
  // 卡随 p5-06 口播同拍淡入；两行先后落定（署源专名约 0.6 处被念到，次行隔拍跟落）
  const card = useEnter('rise', {at: atCard + 2, dur: DUR.f6, dist: 24, restBottom: 560});
  const l1At = atCard + Math.round(durCard * 0.6);
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
      <Panel accent={withAlpha(theme.core, 0.4)} style={{position: 'relative', padding: '46px 64px', textAlign: 'center'}}>
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

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P5FingersAndNext: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p5-01', 'p5-02');
  const bB = w('p5-03', 'p5-04');
  const bC = w('p5-05');
  const bD = w('p5-06', 'p5-07');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A">
        <QuoteShot
          atQuote={wa('p5-01', 0.06) - bA.from}
          atCore={wa('p5-01', 0.22) - bA.from}
          atOrtho={wa('p5-01', 0.38) - bA.from}
          atSlots={wa('p5-02', 0.72) - bA.from}
          atStill={wa('p5-02', 0.32) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <FingersShot
          atFingers={wa('p5-03', 0.4) - bB.from}
          atBound={wa('p5-04', 0.25) - bB.from}
          atOpen={wa('p5-04', 0.48) - bB.from}
          atDanger={wa('p5-04', 0.62) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="5-C">
        <NextShot atDoor={wa('p5-05', 0.3) - bC.from} atSign={wa('p5-05', 0.85) - bC.from} />
      </Sequence>
      <Sequence {...bD} name="5-D">
        <CreditCard atCard={at('p5-06') - bD.from} durCard={dur('p5-06')} />
        {/* 幕末渐黑：最后子节点，盖过署源卡（全片最后画面在此收束） */}
        <FadeTail span={bD.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5FingersAndNext;
