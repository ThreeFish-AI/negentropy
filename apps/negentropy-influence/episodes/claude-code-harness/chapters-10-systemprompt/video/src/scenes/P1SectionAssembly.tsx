/** P1 分段、拼装、缓存（p1-01..p1-10，4 镜）——分镜 1-A / 1-B / 1-C / 1-D。
 *
 *  叙事链：1-A 开帧环体缩悬左上（全景坐标锚〔M-001〕，环上「调用模型前」时点
 *  位暗点提示）→ 急推长卡特写：长卡自 0-B 末态同形入场〔M-005 morph 主路径〕，
 *  p1-02「分段」「四块」词落位长卡拆解 morph——文本流断成四段各自收拢成卡
 *  （文本逐字连续、卡组承接原长卡屏位；描边灰→紫、断口间距连续变化）→
 *  p1-03 改写演示：工具块落一枚改动脉冲、身份块逐字静止（独立性判据）；
 *  步骤签①服务完本拍退役〔M-006〕→ 1-B 装置全景：状态清单卡（装配蓝）自左
 *  入场两行落定、清单行与分段卡逐行对上（连线各一闪）、拼装流箭头接通 +
 *  拼/不拼两态分支显形、消息气泡飘过清单旁被轻轻弹开一拍（判据不在消息里）、
 *  带值微例：记忆段半透虚化、分支压向「不拼」→ 1-C 缓存徽标特写：徽标挂上、
 *  「没变」回放一拍（清单未动→徽标亮→拼好的提示条原样弹回）、比对键文本条
 *  逐字展开、指纹小签先现即压暗 + 两枚坑签两拍即收（重启翻新 / 嵌套压不成）、
 *  环体「调用模型前」暗点随 p1-07 词窗点亮一拍 → 1-D 幕点收束对照定格（单句
 *  镜）：左写死手稿卡（ghost 缩微灰调）↔ 右按状态现拼的配置卡（四段卡缩微 +
 *  拼装流微光流转）、中缝对照连线、定格静持 ≥10 帧（A-16）。
 *
 *  空间契约：四卡紫描边同形等距、拆解前后文本逐字连续、身份块在 p1-03 全程
 *    静止、清单蓝卡与消息气泡异色异位、分支两态可辨、微例记忆段保持半透、
 *    比对键文本与清单行内容逐字对应、坑签与口播白话一一对位、喻体零具象装饰
 *    （无手稿纸/墨迹）、指纹方案不显为可行。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥176；PROMPT_SECTIONS ·
 *    identity / tools / workspace / memory · assemble_system_prompt ·
 *    get_system_prompt · context · json.dumps(context, sort_keys=True) · hash
 *    只进角标；四卡一次全亮禁；比对键不提前于 p1-08 展开。
 *
 *  morph 登记口径（QA 教训 28）：0-B→1-A 长卡拆解 morph 取**主路径**（同一
 *  SectionCardStack DOM：splitP 0→1 断口张开 + tintP 0→1 描边灰→紫，行文本
 *  节点零重绘）；回退形态（cut + 位置呼应）不启用——文本逐字连续由同 DOM
 *  构造性保证，无重绘闪烁面。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {AssemblyFlow, CacheBadge, LoopRing, MessageBubble, PromptBar, SectionCardStack, StateManifestCard, ringPt} from '../components/motifs';
import {DUR, clamp01, progress, useBreathe, useFlowDash, useImpulse, useProgress, usePushIn, useReveal} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 环体缩悬左上（1-A/1-C 全景坐标锚；「调用模型前」挂点角 -30°——暗点位与
 *  环右下缘标签位净空 ≥24px，QA 教训 27） */
const RING1 = {x: 80, y: 76, size: 150, hookAngle: -30} as const;

/** 步骤签（① 分段 / ② 拼装 / ③ 缓存——三步机制的节拍锚；① 服务完本拍退役
 *  〔M-006〕，②③ 空位驻场待 P1 后续镜点亮语义） */
const StepChip: React.FC<{x: number; no: string; zh: string; lit: number; out?: number}> = ({x, no, zh, lit, out = 0}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: 84,
      padding: '6px 20px',
      borderRadius: 10,
      border: `2.5px ${lit > 0.3 ? 'solid' : 'dashed'} ${lit > 0.3 ? theme.mech : theme.panelBorder}`,
      background: theme.panel,
      fontFamily: theme.sans,
      fontSize: 21,
      fontWeight: 700,
      color: lit > 0.3 ? theme.text : theme.dim,
      whiteSpace: 'nowrap',
      opacity: clamp01(lit) * (1 - clamp01(out)),
      transform: `translateY(${(1 - clamp01(lit)) * 14}px)`,
    }}
  >
    {`${no} ${zh}`}
  </div>
);

// ── 1-A 长卡特写 → 拆解 morph → 独立性演示 ────────────────────────────────

/** 长卡/四卡组全局位（1-A 居中放大——卡组承接原长卡屏位的落位） */
const STACK_1A = {x: 560, y: 180, w: 800, h: 560} as const;

const OneA: React.FC<{atPush: number; atSteps: number; atSplit: number; atPulse: number; atStepOut: number}> = ({atPush, atSteps, atSplit, atPulse, atStepOut}) => {
  const frame = useCurrentFrame();
  // @pushIn（动机：p1-01 解法起聚焦本集主角分段卡——急推长卡特写）
  const push = usePushIn(atPush, {scale: 0.06, dur: DUR.f6});
  // 步骤签三枚浮出（①②③——① 本拍服务位）
  const steps = useProgress(atSteps, DUR.f5);
  const step1Out = clamp01(progress(frame, atStepOut, DUR.f4));
  // 拆解 morph 主路径：splitP（断口/内框/卡名）与 tintP（描边灰→紫）同拍推进；
  // 行文本同一 DOM 零重绘（逐字连续的构造性保证）
  const split = clamp01(progress(frame, atSplit, 40));
  const tint = split;
  // 工具块改动脉冲（mech 辉光一拍——身份块零变化的对照由「无动作」承载）
  const pulse = Math.sin(Math.PI * clamp01(progress(frame, atPulse, DUR.f5 + 6)));
  const r = RING1.size / 2 - 46;
  const hook = ringPt(RING1.x + RING1.size / 2, RING1.y + RING1.size / 2, r, RING1.hookAngle);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '50% 43%'}}>
        {/* 长卡 → 四块分段卡（morph 主路径：同 DOM splitP 0→1） */}
        <SectionCardStack
          x={STACK_1A.x}
          y={STACK_1A.y}
          w={STACK_1A.w}
          h={STACK_1A.h}
          splitP={split}
          tintP={tint}
          pulseP={[0, pulse, 0, 0]}
        />
        {/* 改写演示注记（工具块侧——签位与卡缘净空 ≥22px） */}
        {pulse > 0.04 ? (
          <div
            style={{
              position: 'absolute',
              left: STACK_1A.x + STACK_1A.w + 20,
              top: STACK_1A.y + 210,
              padding: '4px 14px',
              borderRadius: 8,
              border: `2.5px solid ${withAlpha(theme.mech, 0.9)}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 16,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: pulse,
            }}
          >
            {'改这块'}
          </div>
        ) : null}
        {pulse > 0.04 ? (
          <div
            style={{
              position: 'absolute',
              left: STACK_1A.x - 152,
              top: STACK_1A.y + 86,
              padding: '4px 12px',
              borderRadius: 8,
              border: `2px dashed ${withAlpha(theme.dim, 0.8)}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 15,
              color: theme.dim,
              whiteSpace: 'nowrap',
              opacity: pulse * 0.9,
            }}
          >
            {'一个字不动'}
          </div>
        ) : null}
        {/* 步骤签（①②③ 顶部空位——① 点亮、②③ 虚位空槽） */}
        <StepChip x={700} no={'①'} zh={'分段'} lit={steps} out={step1Out} />
        <StepChip x={886} no={'②'} zh={'拼装'} lit={steps * 0.22} />
        <StepChip x={1072} no={'③'} zh={'缓存'} lit={steps * 0.22} />
        {/* 环体缩悬左上（全景坐标锚；「调用模型前」时点位暗点提示） */}
        <div style={{position: 'absolute', left: RING1.x, top: RING1.y, opacity: 0.55}}>
          <LoopRing size={RING1.size} nodes={[]} showExit={false} dotProgress={(frame / 90) % 1} />
          <svg width={RING1.size} height={RING1.size} viewBox={`0 0 ${RING1.size} ${RING1.size}`} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
            <circle cx={hook.x - RING1.x} cy={hook.y - RING1.y} r={6} fill={theme.dim} opacity={0.7} />
          </svg>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'PROMPT_SECTIONS · identity / tools / workspace / memory'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-B 装置全景：清单入场 + 逐行对上 + 拼装流两态分支 + 气泡被弹开 ─────────

/** 装置全景位：分段卡组（右）+ 状态清单卡（左，自左入场） */
const STACK_1B = {x: 780, y: 170, w: 680, h: 560} as const;
const MANI_1B = {x: 150, y: 250, w: 420, h: 250} as const;

const OneB: React.FC<{atMani: number; atRows: number; atLink: number; atFlow: number; atBounce: number; atSkip: number; atBubble: number}> = ({
  atMani,
  atRows,
  atLink,
  atFlow,
  atBounce,
  atSkip,
  atBubble,
}) => {
  const frame = useCurrentFrame();
  // 清单卡自左入场（slideR）+ 两行 stagger 落定
  const mani = useProgress(atMani, DUR.f5, 'decelerate');
  const slideX = (1 - mani) * -120;
  const rowsLit = 2 * clamp01(progress(frame, atRows, 26));
  // 清单行 ↔ 分段卡逐行对上（工具行↔工具段 / 记忆行↔记忆段——连线各一闪）
  const linkP = Math.sin(Math.PI * clamp01(progress(frame, atLink, DUR.f5)));
  // 拼装流箭头接通 + 两态分支显形
  const flow = clamp01(progress(frame, atFlow, 26));
  const branch = clamp01(progress(frame, atFlow + 10, DUR.f4));
  // 消息气泡自顶部飘入待验 → 被轻轻弹开一拍（不在判定路径——逆旁白禁入）
  const bubbleY = -70 + 154 * clamp01(progress(frame, atBubble, 30));
  const bounce = Math.sin(Math.PI * clamp01(progress(frame, atBounce, 24)));
  // 带值微例：记忆文件空 → 记忆段半透虚化、分支压向「不拼」
  const skip = clamp01(progress(frame, atSkip, DUR.f5));
  const memHas = 0;
  return (
    <AbsoluteFill>
      {/* 状态清单卡（装配蓝——判据源，自左滑入；memState 无） */}
      <div style={{position: 'absolute', left: MANI_1B.x + slideX, top: MANI_1B.y, opacity: clamp01(mani * 1.4)}}>
        <StateManifestCard x={0} y={0} w={MANI_1B.w} h={MANI_1B.h} rowsLit={rowsLit} memHas={memHas} />
      </div>
      {/* 清单行 ↔ 分段卡连线（各一闪——工具↔工具、记忆↔记忆） */}
      {linkP > 0.03 ? (
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <line x1={MANI_1B.x + MANI_1B.w} y1={300} x2={STACK_1B.x} y2={378} stroke={theme.sky} strokeWidth={3} strokeDasharray="8 6" opacity={linkP * 0.85} />
          <line x1={MANI_1B.x + MANI_1B.w} y1={374} x2={STACK_1B.x} y2={666} stroke={theme.sky} strokeWidth={3} strokeDasharray="8 6" opacity={linkP * 0.85} />
        </svg>
      ) : null}
      {/* 四块分段卡驻屏中（记忆卡半透虚化——微例：空则不拼） */}
      <SectionCardStack x={STACK_1B.x} y={STACK_1B.y} w={STACK_1B.w} h={STACK_1B.h} splitP={1} tintP={1} skipP={[0, 0, 0, skip]} />
      {/* 拼装流（清单→分段 + 拼/不拼两态分支——skip 压向「不拼」端） */}
      <AssemblyFlow x1={MANI_1B.x + MANI_1B.w + 6} y1={340} x2={STACK_1B.x - 14} y2={452} flowP={flow} branchP={branch} skipP={skip} />
      {/* 分支两端标签（拼 / 不拼——与卡组左缘净空 ≥22px） */}
      {branch > 0.3 ? (
        <>
          <div style={{position: 'absolute', left: STACK_1B.x - 96, top: 366, fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.sky, whiteSpace: 'nowrap', opacity: branch * (1 - 0.5 * skip)}}>
            {'拼'}
          </div>
          <div style={{position: 'absolute', left: STACK_1B.x - 110, top: 500, fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: skip > 0.3 ? theme.sky : theme.dim, whiteSpace: 'nowrap', opacity: branch * (0.55 + 0.45 * skip)}}>
            {'不拼'}
          </div>
        </>
      ) : null}
      {/* 消息气泡（顶部飘入待验 → 轻轻弹开一拍——不进判定路径；落位与分段卡组
          顶缘净空 ≥26px） */}
      {bubbleY > -60 ? (
        <div style={{position: 'absolute', left: 600 + bounce * 96, top: bubbleY + 84 + bounce * -8, transform: `rotate(${bounce * 6}deg)`}}>
          <MessageBubble x={0} y={0} w={440} lit={clamp01(progress(frame, atBubble, 12))} scale={0.75} />
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'assemble_system_prompt · get_system_prompt · context'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-C 缓存徽标特写：回放一拍 + 比对键逐字 + 指纹两坑 ─────────────────────

/** CU 位：清单缩微（左上）→ 拼装流出口徽标（中大）→ 拼好的提示条（下）→
 *  比对键（中下）→ 指纹签/坑签（右列——与徽标右缘净空 ≥24px） */
const MANI_1C = {x: 190, y: 200, w: 340, h: 210, scale: 0.8} as const;
const BADGE_1C = {x: 800, y: 300, size: 110} as const;
const BAR_1C = {x: 560, y: 620, w: 620, h: 80} as const;
const KEY_1C = {x: 560, y: 508} as const;

const OneC: React.FC<{atBadge: number; atHit: number; atBar: number; atKey: number; atHash: number; atPit1: number; atPit2: number; atDot: number}> = ({
  atBadge,
  atHit,
  atBar,
  atKey,
  atHash,
  atPit1,
  atPit2,
  atDot,
}) => {
  const frame = useCurrentFrame();
  // 徽标挂上（拼装流出口）
  const badge = useProgress(atBadge, DUR.f4);
  // 「没变」回放一拍：清单未动（恒静）→ 徽标亮 → 拼好的提示条原样弹回
  const hit = useProgress(atHit, DUR.f5);
  const barIn = clamp01(progress(frame, atBar, DUR.f4));
  const bounce = Math.sin(Math.PI * clamp01(progress(frame, atBar + 12, 18)));
  // 比对键文本条逐字展开（清单排成固定格式的文字——与清单行内容逐字对应）
  const keyText = useRevealKey(atKey);
  const keyIn = clamp01(progress(frame, atKey - 4, DUR.f3));
  // 指纹小签先现即被压暗（被否的备选——不显为可行）
  const hashShow = Math.sin(Math.PI * clamp01(progress(frame, atHash, 22)));
  const hashDim = clamp01(progress(frame, atHash + 12, 12));
  // 两枚坑签（重启翻新 / 嵌套压不成——两拍即收〔M-006〕）
  const pit1 = Math.sin(Math.PI * clamp01(progress(frame, atPit1, 30)));
  const pit2 = Math.sin(Math.PI * clamp01(progress(frame, atPit2, 30)));
  // 坑签一内部：指纹值翻新（重启 → 值翻转一拍）
  const flip1 = clamp01(progress(frame, atPit1 + 8, 12));
  // 环体「调用模型前」暗点随 p1-07 词窗点亮一拍（三步机制的发生时点）
  const dotOn = Math.sin(Math.PI * clamp01(progress(frame, atDot, 30)));
  const r = RING1.size / 2 - 46;
  const hook = ringPt(RING1.x + RING1.size / 2, RING1.y + RING1.size / 2, r, RING1.hookAngle);
  return (
    <AbsoluteFill>
      {/* 状态清单卡缩微（清单未动——回放判据的静帧） */}
      <StateManifestCard x={MANI_1C.x} y={MANI_1C.y} w={MANI_1C.w} h={MANI_1C.h} scale={MANI_1C.scale} rowsLit={2} memHas={0} />
      {/* 拼装流出口 → 缓存徽标（中大特写） */}
      <svg width={1920} height={40} viewBox="0 0 1920 40" style={{position: 'absolute', left: 0, top: 340, opacity: badge}}>
        <line x1={480} y1={20} x2={780} y2={20} stroke={theme.sky} strokeWidth={3.5} strokeDasharray="9 7" />
      </svg>
      <CacheBadge x={BADGE_1C.x} y={BADGE_1C.y} size={BADGE_1C.size} litP={badge} hitP={hit} />
      {/* 原样返回箭头（徽标 → 提示条——回放一拍的「弹回」注记） */}
      {bounce > 0.03 ? (
        <svg width={120} height={200} viewBox="0 0 120 200" style={{position: 'absolute', left: 700, top: 420, opacity: bounce, overflow: 'visible'}}>
          <path d="M 96 10 C 116 80, 116 120, 96 186" fill="none" stroke={theme.ok} strokeWidth={3} strokeDasharray="7 6" />
          <path d="M 104 172 L 96 190 L 86 172" fill="none" stroke={theme.ok} strokeWidth={3} strokeLinecap="round" />
        </svg>
      ) : null}
      {/* 拼好的提示条（原样弹回一拍——barBounce 微位；内容零变化） */}
      <div style={{position: 'absolute', left: BAR_1C.x, top: BAR_1C.y - bounce * 10, opacity: barIn}}>
        <PromptBar
          x={0}
          y={0}
          w={BAR_1C.w}
          h={BAR_1C.h}
          mode={'assembled'}
          chips={[
            {zh: '身份', en: 'identity'},
            {zh: '工具', en: 'tools'},
            {zh: '工作目录', en: 'workspace'},
          ]}
          chipsLit={[barIn, barIn, barIn]}
        />
      </div>
      {/* 比对键文本条（自清单卡引出、逐字展开——排成固定格式） */}
      <div style={{position: 'absolute', left: KEY_1C.x, top: KEY_1C.y, opacity: keyIn}}>
        <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.sky, whiteSpace: 'pre'}}>{keyText || ' '}</span>
      </div>
      {/* 指纹小签（先现即被压暗——被否备选） */}
      {hashShow > 0.03 ? (
        <div
          style={{
            position: 'absolute',
            left: 1330,
            top: 210,
            padding: '5px 16px',
            borderRadius: 9,
            border: `2.5px dashed ${withAlpha(theme.dim, 0.9)}`,
            background: theme.panel,
            fontFamily: theme.mono,
            fontSize: 17,
            color: theme.dim,
            whiteSpace: 'nowrap',
            opacity: hashShow * (1 - 0.55 * hashDim),
            filter: `saturate(${1 - 0.6 * hashDim})`,
          }}
        >
          {'hash 指纹？'}
        </div>
      ) : null}
      {/* 坑签一：程序重启 → 指纹值翻新 */}
      {pit1 > 0.03 ? (
        <div
          style={{
            position: 'absolute',
            left: 1330,
            top: 320,
            width: 300,
            boxSizing: 'border-box',
            borderRadius: 10,
            border: `2.5px solid ${withAlpha(theme.danger, 0.4 + 0.4 * pit1)}`,
            background: withAlpha(theme.panel, 0.96),
            padding: '10px 14px',
            opacity: pit1,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{'坑一 · 程序重启'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 6, whiteSpace: 'nowrap'}}>
            <span style={{opacity: 1 - flip1}}>{'0x8f3a…'}</span>
            <span style={{opacity: flip1, color: theme.danger}}>{'0x42c9…'}</span>
            <span style={{marginLeft: 10, opacity: flip1}}>{'值变了'}</span>
          </div>
        </div>
      ) : null}
      {/* 坑签二：嵌套数据压不成指纹 */}
      {pit2 > 0.03 ? (
        <div
          style={{
            position: 'absolute',
            left: 1330,
            top: 470,
            width: 300,
            boxSizing: 'border-box',
            borderRadius: 10,
            border: `2.5px solid ${withAlpha(theme.danger, 0.4 + 0.4 * pit2)}`,
            background: withAlpha(theme.panel, 0.96),
            padding: '10px 14px',
            opacity: pit2,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{'坑二 · 一层套一层'}</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 10, marginTop: 6}}>
            <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{'{ { … } }'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.danger, whiteSpace: 'nowrap'}}>{'压不成 ✗'}</span>
          </div>
        </div>
      ) : null}
      {/* 环体缩悬左上（暗点位随 p1-07 词窗点亮一拍——「调用模型前」时点） */}
      <div style={{position: 'absolute', left: RING1.x, top: RING1.y, opacity: 0.55}}>
        <LoopRing size={RING1.size} nodes={[]} showExit={false} dotProgress={(frame / 90) % 1} />
        <svg width={RING1.size} height={RING1.size} viewBox={`0 0 ${RING1.size} ${RING1.size}`} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          <circle cx={hook.x - RING1.x} cy={hook.y - RING1.y} r={6 + 5 * dotOn} fill={dotOn > 0.05 ? theme.core : theme.dim} opacity={0.7 + 0.3 * dotOn} />
          {dotOn > 0.05 ? <circle cx={hook.x - RING1.x} cy={hook.y - RING1.y} r={16 + 8 * dotOn} fill="none" stroke={theme.core} strokeWidth={2.5} opacity={0.5 * dotOn} /> : null}
        </svg>
      </div>
      {dotOn > 0.3 ? (
        <div style={{position: 'absolute', left: hook.x + 16, top: hook.y - 10, padding: '2px 10px', borderRadius: 6, border: `2px solid ${theme.core}`, background: theme.panel, fontFamily: theme.sans, fontSize: 14, fontWeight: 700, color: theme.core, whiteSpace: 'nowrap', opacity: dotOn}}>
          {'调用模型前'}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'json.dumps(context, sort_keys=True) · hash'}
      </div>
    </AbsoluteFill>
  );
};

/** 比对键逐字（useReveal 的场景侧具名封装——hooks 顶层调用铁律不变；文本与
 *  清单行内容逐字对应：memory=none ↔ 记忆文件·无、tools=registered ↔ 工具表·已注册） */
const useRevealKey = (at: number): string => useReveal('{"memory":"none","tools":"registered"}', {at, cps: 16});

// ── 1-D 幕点收束对照定格（单句镜——手稿 ↔ 现拼配置） ───────────────────────

const GHOST_1D = {x: 230, y: 250, w: 460, h: 420} as const;
const CONF_1D = {x: 1130, y: 210, w: 560, h: 500} as const;

const OneD: React.FC<{atLeft: number; atRight: number; atLink: number}> = ({atLeft, atRight, atLink}) => {
  const frame = useCurrentFrame();
  // 左：写死手稿卡（P0 长卡 ghost 缩微、灰调定格式落定——喻体零具象装饰）
  const left = useProgress(atLeft, DUR.f5);
  const lockFlash = useImpulse({at: atLeft + DUR.f4, dur: DUR.f5, peak: 1});
  // 右：按状态现拼的配置卡（四段卡缩微 + 拼装流微光流转一拍定格）
  const right = useProgress(atRight, DUR.f5);
  const glow = useBreathe({period: 44, amp: 0.4, base: 0.55});
  const flowDash = useFlowDash({dash: 9, gap: 12, period: 34});
  // 中缝对照连线（左右一灰一亮——问题态/答案态）
  const link = clamp01(progress(frame, atLink, 20));
  const pulses = [0, 1, 2, 3].map((i) => Math.sin(Math.PI * clamp01(progress(frame, atRight + 8 + i * 5, DUR.f4))));
  return (
    <AbsoluteFill>
      {/* 左：写死手稿卡（灰调定格式——锁定纹一拍） */}
      <div style={{position: 'absolute', left: GHOST_1D.x, top: GHOST_1D.y, opacity: left}}>
        <SectionCardStack x={0} y={0} w={GHOST_1D.w} h={GHOST_1D.h} splitP={0} tintP={0} ghostP={1} />
        {lockFlash > 0.04 ? (
          <div style={{position: 'absolute', inset: -6, borderRadius: 14, border: `3px solid ${withAlpha(theme.dim, 0.5 * lockFlash)}`, pointerEvents: 'none'}} />
        ) : null}
        <div style={{position: 'absolute', left: 0, right: 0, top: -40, textAlign: 'center', fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap', opacity: left}}>
          {'写死的手稿'}
        </div>
      </div>
      {/* 右：按状态现拼的配置卡（四段缩微 + 微光各闪一次） */}
      <div style={{position: 'absolute', left: CONF_1D.x, top: CONF_1D.y, opacity: right}}>
        <SectionCardStack x={0} y={0} w={CONF_1D.w} h={CONF_1D.h} splitP={1} tintP={1} pulseP={pulses} />
        <div style={{position: 'absolute', left: 0, right: 0, top: -40, textAlign: 'center', fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.mech, whiteSpace: 'nowrap', opacity: right}}>
          {'按状态现拼的配置'}
        </div>
      </div>
      {/* 拼装流微光流转（右卡左缘——行进虚线 + 呼吸辉光） */}
      {right > 0.3 ? (
        <svg width={140} height={40} viewBox="0 0 140 40" style={{position: 'absolute', left: CONF_1D.x - 148, top: 440, overflow: 'visible', opacity: glow}}>
          <line x1={0} y1={20} x2={130} y2={20} stroke={theme.sky} strokeWidth={3.5} {...flowDash} />
          <path d="M 124 10 L 138 20 L 124 30" fill="none" stroke={theme.sky} strokeWidth={3.5} strokeLinecap="round" />
        </svg>
      ) : null}
      {/* 中缝对照连线（竖贯——左右裁决位；pathLength 归一化描线） */}
      <svg width={10} height={520} viewBox="0 0 10 520" style={{position: 'absolute', left: 955, top: 240, overflow: 'visible', opacity: link}}>
        <line x1={5} y1={0} x2={5} y2={520} stroke={theme.dim} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - link} />
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'手稿 → 配置 · A#5 对照'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P1SectionAssembly: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p1-01', 'p1-03');
  const bB = w('p1-04', 'p1-06b');
  const bC = w('p1-07', 'p1-09b');
  const bD = w('p1-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <OneA
          atPush={0}
          atSteps={wa('p1-01', 0.16) - bA.from}
          atSplit={wa('p1-02', 0.18) - bA.from}
          atPulse={wa('p1-03', 0.36) - bA.from}
          atStepOut={wa('p1-03', 0.86) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="1-B">
        <OneB
          atMani={wa('p1-04', 0.5) - bB.from}
          atRows={wa('p1-04', 0.72) - bB.from}
          atLink={wa('p1-05', 0.3) - bB.from}
          atFlow={wa('p1-06', 0.24) - bB.from}
          atBounce={wa('p1-06', 0.62) - bB.from}
          atSkip={wa('p1-06b', 0.36) - bB.from}
          atBubble={wa('p1-06', 0.02) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="1-C">
        <OneC
          atBadge={wa('p1-07', 0.14) - bC.from}
          atHit={wa('p1-07', 0.52) - bC.from}
          atBar={wa('p1-07', 0.4) - bC.from}
          atKey={wa('p1-08', 0.4) - bC.from}
          atHash={wa('p1-09', 0.2) - bC.from}
          atPit1={wa('p1-09b', 0.14) - bC.from}
          atPit2={wa('p1-09b', 0.5) - bC.from}
          atDot={wa('p1-07', 0.08) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="1-D">
        <OneD atLeft={wa('p1-10', 0.24) - bD.from} atRight={wa('p1-10', 0.62) - bD.from} atLink={wa('p1-10', 0.46) - bD.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1SectionAssembly;
