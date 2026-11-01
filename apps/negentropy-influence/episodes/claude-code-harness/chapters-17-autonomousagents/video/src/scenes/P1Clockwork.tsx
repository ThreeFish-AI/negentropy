/** P1 先看信，再看板（p1-01..p1-10，5 镜）——分镜 1-A / 1-B / 1-C / 1-D / 1-E。
 *
 *  Morph Continuity（0-C→1-A，头注明示）：同一主体 = 队友机体（天蓝值班钟 +
 *  品红环体签名）。起止态：0-C 末帧队友在卡前写名（名字签刚落、机体灯翻暖白
 *  =回干活）→ 1-A 首帧同一机体放大居中、胸口三格状态灯立起。中间态：放大
 *  过程值班钟屏位、天蓝描边、环体转速逐帧不变（phasedRing 连续相位），仅机体
 *  尺度与新增灯条变化。身份线索：值班钟屏位 + 品红环描边（保两项）。何时不该
 *  morph：放大后钟面细节低于可读阈值即回退 cut + 同构入场。
 *
 *  叙事链：1-A 开帧队伍全局一拍（全景坐标锚：任务墙+队友编队+队长收件箱）→
 *  morph 放大一名队友：p1-01「三个状态」词落位三格灯 stagger 依次点亮（干活
 *  →空闲→关机全谱）→ p1-02「干活」词落位暖白灯高频闪、环体随 WORK 加速
 *  （收信/想/调工具三小签贴机体侧）、「空闲」词落位灯转天蓝呼吸、环体减速、
 *  「钟开始敲」词落位胸口值班钟重新起摆（环体变速=背景节拍器语义首立）→
 *  1-B ECU 两落点细拆：p1-03 一次完整拍演示（钟摆落下→第一落点格口探查→
 *  回摆→第二落点扫墙）→ p1-04「冲你来的」点名信封弹出置顶+标签贴上、
 *  「晚一步耽误全局」信封边缘警示红轻闪一拍 → p1-05「公共的」第二落点亮出、
 *  「晚一轮没关系」墙卡列整列呼吸一次、两标签对照定格 → 1-C 三条件卡面：
 *  p1-06 三灯逐一齐亮、「缺一条跳过」邻卡滑走不停留 → p1-07 名字签写入回
 *  干活、「睡到下一拍」另一队友半收拢微降（非关机）→ 1-D 身份重注入：
 *  p1-08 长清单压缩成摘要（灰）、身份说明卡（天蓝）注入清单头、「回到干活」
 *  箭头亮起 → 1-E 超时收工：p1-09 十二拍逐拍落计数环走满、六十秒表盘到点
 *  （12×5 同框可读，重音镜）、总结卡飞进队长收件箱、钟停机体收拢暗灰 →
 *  p1-10 小结压缩签定格（幕尾钩——灵不灵留给 P2）。
 *
 *  空间契约：三格灯三态色全片恒定、环体只随状态变速不消失（变速经 phasedRing
 *  prop 包装、母题本体不动）、两落点次序恒定先信后墙、点名信封为唯一红闪
 *  元素、三灯齐亮是写名的前置帧序、跳过卡有滑走轨迹、睡眠半收拢≠暗灰收束、
 *  计数环 12 格与表盘 60s 双口径同帧可对、总结卡落点=队长收件箱。
 *  红线落实：第四状态禁出现、环体与钟禁抢焦（钟为前景主角）、公共卡列禁
 *  紧急红闪、缺灯卡禁被写名、计数环禁越 12 格、表盘数字禁与口播不符、小结签
 *  禁复述整句；词落位 = wa(id,f)；y≥56 / bottom≥176（长角标 bottom 210）。
 *
 *  承接登记：1-E→2-A 幕间 SceneFade + 全景重锚（机制解构→走查舞台属场景
 *    切换，非 morph）；位置呼应：1-E 末帧收拢暗灰的队友机体 = 2-A 首帧队友
 *    一展开位（同一机体再上线）；值班钟随机体跨场恒常。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  AgentBody,
  BeatCounterRing,
  ConditionLamps,
  DutyClock,
  IdentityCard,
  MailboxFile,
  NameTag,
  pendSwing,
  phasedRing,
  STATUS_LABELS,
  STATUS_TONE,
  STATUS_ZH,
  StatusLightBar,
  TeammateRing,
} from '../components/motifs';
import {DUR, clamp01, progress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 1-A morph 放大：三格状态灯全谱 + 环体随状态变速 + 钟重新起摆 ────────────

/** 1-A 布局（安全带红线：环 460 底边 210+460=670、机体底 320+240+签 ~600，
 *  恒 ≤ 860；三态角标列右置 1060..1260。 */
const MATE_1A = {bodyX: 840, bodyY: 320, bodyW: 180, bodyH: 240, ringSize: 460} as const;
const LIGHTS_1A = {x: 22, y: 30, w: 136} as const;
const CLOCK_1A = {size: 128, dy: 96} as const;

const OneA: React.FC<{
  atMorph: number;
  atSpectrum: number[];
  atWork: number;
  atTags: number;
  atIdle: number;
  atClock: number;
}> = ({atMorph, atSpectrum, atWork, atTags, atIdle, atClock}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // morph 放大（开帧队伍全局一拍 → 同一机体放大居中）
  const morph = clamp01(progress(frame, atMorph, 22));
  // 三格灯全谱 stagger（干活→空闲→关机）
  const lit: [number, number, number] = [
    clamp01(progress(frame, atSpectrum[0], DUR.f4)),
    clamp01(progress(frame, atSpectrum[1], DUR.f4)),
    clamp01(progress(frame, atSpectrum[2], DUR.f4)),
  ];
  // 当前态：WORK（暖白高频闪）→ IDLE（天蓝呼吸）。开帧即 WORK（0-C 末帧
  //  机体灯翻暖白=回干活的 morph 连续）；关机格仅全谱 stagger 展示、本镜不驻留
  const inWork = frame < atIdle;
  const inIdle = frame >= atIdle;
  const hot: 0 | 1 | 2 = inIdle ? 1 : 0;
  const pulse = inWork ? 0.4 + 0.6 * Math.abs(Math.sin(frame / 1.6)) : 0.5 + 0.5 * Math.sin(frame / 9);
  // 环体随状态变速（背景节拍器——phasedRing 连续相位：基线 2.5s → WORK 1.3s
  //  加速 → IDLE 回 2.5s 减速；SHUTDOWN 停转由 1-E 承载）
  const ringDot = phasedRing(frame, fps, [
    {at: 0, sec: 2.5},
    {at: atWork, sec: 1.3},
    {at: atIdle, sec: 2.5},
  ]);
  // 三小签（收信 / 想 / 调工具——WORK 语义的工况签，贴机体侧）
  const tags = ['收信', '想', '调工具'].map((s, i) => ({s, p: clamp01(progress(frame, atTags + i * 5, 10))}));
  // 胸口值班钟重新起摆（「钟开始敲」——IDLE 起与钟联动）
  const clockOn = clamp01(progress(frame, atClock, 10));
  const sw = pendSwing(frame, atClock) * clockOn;
  return (
    <AbsoluteFill>
      {/* 开帧队伍全局一拍（全景坐标锚：任务墙条 + 编队 + 队长收件箱——morph 起退场） */}
      <div style={{position: 'absolute', left: 0, top: 0, right: 0, opacity: 1 - morph, transform: `scale(${1 - 0.18 * morph})`, transformOrigin: '50% 40%'}}>
        {Array.from({length: 8}, (_, i) => (
          <div
            key={`ow${i}`}
            style={{
              position: 'absolute',
              left: 200 + i * 190,
              top: 120,
              width: 150,
              height: 62,
              borderRadius: 8,
              border: `2px solid ${withAlpha(theme.panelBorder, 0.8)}`,
              background: withAlpha(theme.panel, 0.7),
              opacity: 0.65,
            }}
          />
        ))}
        <div style={{position: 'absolute', left: 300, top: 420, opacity: 0.85}}>
          <TeammateRing size={190} dotProgress={ringDot} />
        </div>
        <div style={{position: 'absolute', left: 1400, top: 420, opacity: 0.85}}>
          <TeammateRing size={190} dotProgress={(ringDot + 0.33) % 1} />
        </div>
        <div style={{position: 'absolute', left: 810, top: 430, opacity: 0.8}}>
          <MailboxFile x={0} y={0} w={280} h={200} name="lead.jsonl" litP={1} rows={1} />
        </div>
      </div>
      {/* 放大的队友机体（morph 主体——钟屏位/天蓝描边/环转速逐帧不变） */}
      <div style={{position: 'absolute', left: MATE_1A.bodyX + MATE_1A.bodyW / 2 - MATE_1A.ringSize / 2, top: MATE_1A.bodyY - 110, transform: `scale(${0.62 + 0.38 * morph})`, transformOrigin: '50% 50%', opacity: morph}}>
        <TeammateRing size={MATE_1A.ringSize} dotProgress={ringDot} />
      </div>
      <div style={{position: 'absolute', left: MATE_1A.bodyX, top: MATE_1A.bodyY, transform: `scale(${0.62 + 0.38 * morph})`, transformOrigin: '50% 20%', opacity: morph}}>
        <AgentBody x={0} y={0} w={MATE_1A.bodyW} h={MATE_1A.bodyH} tone={theme.mate}>
          {/* 胸口三格状态灯（干活=暖白高频 / 空闲=天蓝呼吸 / 关机=暗灰收束） */}
          <StatusLightBar x={LIGHTS_1A.x} y={LIGHTS_1A.y} w={LIGHTS_1A.w} cellH={20} lit={lit} hot={hot} pulse={pulse} />
          {/* 胸口值班钟（0-B 首亮件——IDLE 起重新起摆） */}
          <div style={{position: 'absolute', left: (MATE_1A.bodyW - CLOCK_1A.size) / 2, top: CLOCK_1A.dy}}>
            <DutyClock x={0} y={0} size={CLOCK_1A.size} litP={1} swing={sw} />
          </div>
        </AgentBody>
      </div>
      {/* 三态角标（WORK · IDLE · SHUTDOWN——随三格灯对位点亮） */}
      <div style={{position: 'absolute', left: 1100, top: MATE_1A.bodyY + 18, display: 'flex', flexDirection: 'column', gap: 26, opacity: morph}}>
        {[0, 1, 2].map((i) => (
          <div key={`sl${i}`} style={{display: 'flex', alignItems: 'center', gap: 12, opacity: 0.35 + 0.65 * lit[i]}}>
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: hot === i ? STATUS_TONE[i] : withAlpha(STATUS_TONE[i], 0.3),
                boxShadow: hot === i ? `0 0 14px ${withAlpha(STATUS_TONE[i], 0.7)}` : 'none',
              }}
            />
            <span style={{fontFamily: theme.mono, fontSize: 20, color: hot === i ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{STATUS_LABELS[i]}</span>
            <span style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, whiteSpace: 'nowrap'}}>{STATUS_ZH[i]}</span>
          </div>
        ))}
      </div>
      {/* WORK 三小签（收信 / 想 / 调工具——贴机体侧；IDLE 起退场） */}
      <div style={{position: 'absolute', left: 1090, top: MATE_1A.bodyY + 210, display: 'flex', flexDirection: 'column', gap: 12, opacity: morph * (inWork ? 1 : 1 - clamp01(progress(frame, atIdle, 10)))}}>
        {tags.map((t) => (
          <div
            key={`tg${t.s}`}
            style={{
              padding: '6px 16px',
              borderRadius: 9,
              border: `2.5px solid ${withAlpha(theme.dim, 0.5 + 0.4 * t.p)}`,
              background: withAlpha(theme.panel, 0.96),
              fontFamily: theme.sans,
              fontSize: 18,
              fontWeight: 700,
              color: t.p > 0.5 ? theme.text : theme.dim,
              whiteSpace: 'nowrap',
              opacity: t.p,
              transform: `translateX(${(1 - t.p) * 14}px)`,
              width: 120,
            }}
          >
            {t.s}
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'WORK · IDLE · SHUTDOWN · 环体只随状态变速不消失'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-B 两落点细拆 ECU：完整拍演示 + 点名信封置顶红闪 + 两标签对照 ───────────

/** 1-B 布局（安全带红线：钟 480 落点签底边 = 100+705+36=841 恒 ≤ 860；
 *  信箱底 300+240=540、墙卡列底 260+3×150=710。 */
const CLOCK_1B = {x: 300, y: 100, size: 480} as const;
const BOX_1B = {x: 100, y: 300, w: 300, h: 240} as const;
const WALLCOL_1B = {x: 1250, y: 260, cardW: 340, cardH: 120, gap: 30} as const;

const OneB: React.FC<{
  atDrop1: number;
  atBack: number;
  atDrop2: number;
  atZoom: number;
  atEnv: number;
  atTagA: number;
  atRedFlash: number;
  atLit2: number;
  atBreathe: number;
  atTagB: number;
}> = ({atDrop1, atBack, atDrop2, atZoom, atEnv, atTagA, atRedFlash, atLit2, atBreathe, atTagB}) => {
  const frame = useCurrentFrame();
  // 一次完整拍演示（钟摆落下→第一落点格口探查→回摆→第二落点扫墙）
  const swing =
    frame < atBack
      ? -clamp01(progress(frame, atDrop1, 16))
      : frame < atDrop2
        ? -1 + clamp01(progress(frame, atBack, 12))
        : clamp01(progress(frame, atDrop2, 16));
  const probe1 = Math.sin(Math.PI * clamp01(progress(frame, atDrop1 + 10, 24)));
  const probe2 = Math.sin(Math.PI * clamp01(progress(frame, atDrop2 + 12, 24)));
  // 第一落点放大（「冲你来的」——信箱侧推近一档）
  const zoom = clamp01(progress(frame, atZoom, 14));
  // 点名信封弹出置顶（格口内一封——红轻闪在「晚一步耽误全局」）
  const env = clamp01(progress(frame, atEnv, 14));
  const redFlash = Math.sin(Math.PI * clamp01(progress(frame, atRedFlash, 18)));
  // 「冲你来的」标签贴上
  const tagA = clamp01(progress(frame, atTagA, DUR.f4));
  // 第二落点亮出（「公共的」）+ 墙卡列整列呼吸一次（M-002 温和）
  const lit2 = clamp01(progress(frame, atLit2, DUR.f4));
  const breathe = Math.sin(Math.PI * clamp01(progress(frame, atBreathe, 30)));
  const tagB = clamp01(progress(frame, atTagB, DUR.f4));
  const scaleK = 1 + 0.06 * zoom;
  return (
    <AbsoluteFill>
      {/* 左：收件箱格口（第一落点目标——承 ep15 信箱同款签名） */}
      <div style={{position: 'absolute', left: BOX_1B.x, top: BOX_1B.y, transform: `scale(${scaleK})`, transformOrigin: '50% 50%'}}>
        <MailboxFile x={0} y={0} w={BOX_1B.w} h={BOX_1B.h} name="teammate-1.jsonl" litP={1} rows={0} glowP={probe1 * 0.8} scanP={probe1} />
        {/* 点名信封（弹出置顶——冲你来的；边缘警示红轻闪一拍=唯一红闪元素） */}
        {env > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: 30,
              top: -66 - env * 26,
              width: 168,
              height: 96,
              borderRadius: 10,
              border: `3px solid ${withAlpha(theme.danger, 0.25 + 0.7 * redFlash)}`,
              background: withAlpha(theme.panel, 0.98),
              opacity: env,
              boxShadow: redFlash > 0.03 ? `0 0 ${26 * redFlash}px ${withAlpha(theme.danger, 0.55 * redFlash)}` : 'none',
            }}
          >
            <svg width={168} height={64} viewBox="0 0 168 64">
              <path d="M14 14 L84 44 L154 14" fill="none" stroke={withAlpha(theme.danger, 0.8)} strokeWidth={2.5} />
            </svg>
            <div style={{position: 'absolute', left: 0, right: 0, bottom: 6, textAlign: 'center', fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap'}}>
              点名 · 置顶
            </div>
          </div>
        ) : null}
        {/* 「冲你来的」标签（贴上——两标签对照之一） */}
        {tagA > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: BOX_1B.w - 60,
              top: BOX_1B.h + 26,
              padding: '7px 20px',
              borderRadius: 9,
              border: `2.5px solid ${withAlpha(theme.danger, 0.85)}`,
              background: withAlpha(theme.panel, 0.97),
              fontFamily: theme.sans,
              fontSize: 21,
              fontWeight: 700,
              color: theme.danger,
              whiteSpace: 'nowrap',
              opacity: tagA,
              transform: `translateY(${(1 - tagA) * 10}px)`,
            }}
          >
            冲你来的
          </div>
        ) : null}
      </div>
      {/* 中：钟面（两落点签——第一落点常亮、第二落点随「公共的」亮出） */}
      <DutyClock
        x={CLOCK_1B.x}
        y={CLOCK_1B.y}
        size={CLOCK_1B.size}
        litP={1}
        swing={swing}
        landing1P={1}
        landing2P={lit2}
        probe1P={probe1}
        probe2P={probe2}
      />
      {/* 右：任务墙卡列（第二落点目标——公共的；整列呼吸一次不急的具象） */}
      <div style={{position: 'absolute', left: WALLCOL_1B.x, top: WALLCOL_1B.y, width: WALLCOL_1B.cardW, opacity: lit2}}>
        {[0, 1, 2].map((i) => (
          <div
            key={`wc${i}`}
            style={{
              position: 'relative',
              width: WALLCOL_1B.cardW,
              height: WALLCOL_1B.cardH,
              marginTop: i === 0 ? 0 : WALLCOL_1B.gap,
              borderRadius: 10,
              border: `2.5px solid ${withAlpha(theme.panelBorder, 0.9)}`,
              background: withAlpha(theme.panel, 0.94),
              opacity: 0.8 + 0.2 * breathe,
              boxShadow: breathe > 0.05 ? `0 0 ${16 * breathe}px ${withAlpha(theme.watch, 0.3 * breathe)}` : 'none',
            }}
          >
            <div style={{padding: '14px 16px 0', fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{`task_${String(10 + i).padStart(3, '0')}`}</div>
            <div style={{margin: '12px 16px 0', height: 9, width: '62%', borderRadius: 3, background: withAlpha(theme.dim, 0.3)}} />
          </div>
        ))}
        {/* 「公共的」标签（贴上——两标签对照定格） */}
        {tagB > 0.02 ? (
          <div
            style={{
              marginTop: 26,
              padding: '7px 20px',
              borderRadius: 9,
              border: `2.5px solid ${withAlpha(theme.watch, 0.85)}`,
              background: withAlpha(theme.panel, 0.97),
              fontFamily: theme.sans,
              fontSize: 21,
              fontWeight: 700,
              color: theme.watch,
              whiteSpace: 'nowrap',
              opacity: tagB,
              transform: `translateY(${(1 - tagB) * 10}px)`,
              display: 'inline-block',
            }}
          >
            公共的
          </div>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'IDLE_POLL_INTERVAL · 每一拍：先看收件箱，再看任务墙'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-C 三条件卡面：三灯齐亮放行 + 缺灯卡滑过 + 写名 / 睡到下一拍 ────────────

/** 1-C 布局（安全带红线：主卡底 190+460=650、邻卡底 240+260=500、滑走带
 *  y 690+120=810，恒 ≤ 860。 */
const MAINCARD_1C = {x: 560, y: 190, w: 640, h: 460} as const;
/** 邻卡缺灯位（0/1/2 = 缺哪盏；as const 会把 miss 收窄到字面联合、与
 *  通用缺灯构造式不兼容——语义就是 0..2 任一，注解放开） */
const NEIGHBOR_1C: readonly {x: number; y: number; miss: number}[] = [
  {x: 110, y: 240, miss: 2},
  {x: 1410, y: 240, miss: 0},
];

const OneC: React.FC<{atLamps: number[]; atSkip: number; atWrite: number; atWork: number; atSleep: number}> = ({
  atLamps,
  atSkip,
  atWrite,
  atWork,
  atSleep,
}) => {
  const frame = useCurrentFrame();
  // 三灯逐一齐亮（次序 = 口播点名次序）
  const lamps: [number, number, number] = [
    clamp01(progress(frame, atLamps[0], 10)),
    clamp01(progress(frame, atLamps[1], 10)),
    clamp01(progress(frame, atLamps[2], 10)),
  ];
  // 缺一条跳过（邻卡沿墙滑过一轮——滑走不停留）
  const skip = clamp01(progress(frame, atSkip, 34));
  // 找到就写名认领（名字签写入 + 机体灯翻暖白回干活）
  const write = clamp01(progress(frame, atWrite, 16));
  const work = clamp01(progress(frame, atWork, 12));
  // 找不到睡到下一拍（另一队友空手缩回、半收拢微降——睡眠态微动非关机）
  const sleep = clamp01(progress(frame, atSleep, 16));
  const sleepBreath = sleep * (0.5 + 0.5 * Math.sin(frame / 14)) * 0.35;
  return (
    <AbsoluteFill>
      {/* 主卡（三条件灯纵列 + 名字签空位） */}
      <div style={{position: 'absolute', left: MAINCARD_1C.x, top: MAINCARD_1C.y, width: MAINCARD_1C.w, height: MAINCARD_1C.h}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 14,
            border: `3.5px solid ${withAlpha(theme.panelBorder, 0.95)}`,
            background: withAlpha(theme.panel, 0.96),
            boxShadow: write > 0.5 ? `0 0 ${18 * write}px ${withAlpha(theme.watch, 0.3 * write)}` : 'none',
          }}
        >
          <div style={{position: 'absolute', left: 24, top: 18, fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'task_005'}</div>
          <ConditionLamps x={44} y={96} w={330} lamps={lamps} />
          {/* 名字签空位 → 写入（找到就写名认领） */}
          <div style={{position: 'absolute', left: 44, bottom: 40, display: 'flex', alignItems: 'baseline', gap: 16}}>
            <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, whiteSpace: 'nowrap'}}>名字签</span>
            <NameTag x={90} y={-6} label="队友一" writeP={write} size={30} />
          </div>
        </div>
      </div>
      {/* 邻卡两张对照（各缺一灯——缺哪盏暗哪盏） */}
      {NEIGHBOR_1C.map((n, i) => {
        const nLamps: [number, number, number] = [n.miss === 0 ? 0 : 1, n.miss === 1 ? 0 : 1, n.miss === 2 ? 0 : 1];
        return (
          <div key={`nb${i}`} style={{position: 'absolute', left: n.x, top: n.y, width: 380, height: 260, opacity: 0.85}}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 12,
                border: `2.5px dashed ${withAlpha(theme.panelBorder, 0.9)}`,
                background: withAlpha(theme.panel, 0.88),
                padding: '16px 18px',
              }}
            >
              <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{`task_${String(20 + i).padStart(3, '0')}`}</div>
              <ConditionLamps x={8} y={44} w={240} lamps={nLamps} compact />
              <div style={{position: 'absolute', left: 18, bottom: 14, fontFamily: theme.sans, fontSize: 17, color: theme.dim, whiteSpace: 'nowrap'}}>
                缺一条
              </div>
            </div>
          </div>
        );
      })}
      {/* 缺一条跳过（缺灯卡沿墙滑走一轮——滑走不停留） */}
      {skip > 0.02 && skip < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: 120 + skip * 1480,
            top: 690,
            width: 300,
            height: 110,
            borderRadius: 10,
            border: `2.5px dashed ${withAlpha(theme.dim, 0.7)}`,
            background: withAlpha(theme.panel, 0.9),
            opacity: 1 - Math.max(0, skip - 0.82) * 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontSize: 20,
            fontWeight: 700,
            color: theme.dim,
            whiteSpace: 'nowrap',
          }}
        >
          缺灯 · 滑过
        </div>
      ) : null}
      {/* 写名队友（右下角小机体——灯翻暖白回干活） */}
      <div style={{position: 'absolute', left: 1290, top: 560}}>
        <AgentBody x={0} y={0} w={92} h={118} tone={theme.mate}>
          <div
            style={{
              position: 'absolute',
              left: 24,
              top: 16,
              width: 44,
              height: 14,
              borderRadius: 7,
              border: `2.5px solid ${withAlpha(theme.text, 0.4 + 0.6 * work)}`,
              background: work > 0.4 ? withAlpha(theme.text, 0.3 * (0.4 + 0.6 * Math.abs(Math.sin(frame / 1.6)))) : 'transparent',
            }}
          />
        </AgentBody>
        <div style={{position: 'absolute', left: 6, top: 126, fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: work > 0.5 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>
          {work > 0.5 ? '回干活' : '待写名'}
        </div>
      </div>
      {/* 睡到下一拍（另一队友空手缩回——半收拢微降，睡眠微动非关机） */}
      <div style={{position: 'absolute', left: 180, top: 560}}>
        <AgentBody x={0} y={0} w={92} h={118} tone={theme.mate} droopP={sleep + sleepBreath}>
          <div style={{position: 'absolute', left: 24, top: 16, width: 44, height: 14, borderRadius: 7, border: `2.5px solid ${withAlpha(theme.watch, 0.75)}`}} />
        </AgentBody>
        <div style={{position: 'absolute', left: 2, top: 126, fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.watch, whiteSpace: 'nowrap', opacity: sleep}}>
          睡到下一拍
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'blockedBy · 三灯齐亮，才放行写名'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-D 身份重注入：长清单压成摘要 + 身份说明卡注入 + 回到干活箭头 ────────────

/** 1-D 布局（安全带红线：清单底 150+640=790、箭头位 640..760，恒 ≤ 860。 */
const LIST_1D = {x: 560, y: 150, w: 800, h: 640} as const;

const OneD: React.FC<{atCompress: number; atInject: number; atRefresh: number; atArrow: number}> = ({
  atCompress,
  atInject,
  atRefresh,
  atArrow,
}) => {
  const frame = useCurrentFrame();
  // 长清单压缩（条目叠叠压缩成一小段摘要——灰；压缩前后条目数可辨）
  const compress = clamp01(progress(frame, atCompress, 26));
  const rowsAll = 10;
  const rowsShown = Math.max(3, Math.round(rowsAll - 7 * compress));
  const rowH = 44 - 26 * compress;
  // 摘要块（灰——历史）
  const digest = clamp01(progress(frame, atCompress + 10, 16));
  // 身份说明卡注入（清单头——天蓝=身份，灰=历史不混色）
  const inject = clamp01(progress(frame, atInject, 16));
  // 清单头刷新闪一拍（「重写一遍」）
  const refresh = Math.sin(Math.PI * clamp01(progress(frame, atRefresh, 16)));
  // 回到干活箭头亮起
  const arrow = clamp01(progress(frame, atArrow, DUR.f4));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: LIST_1D.x, top: LIST_1D.y, width: LIST_1D.w, height: LIST_1D.h}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 14,
            border: `3px solid ${withAlpha(theme.panelBorder, 0.95)}`,
            background: withAlpha(theme.panel, 0.96),
            boxShadow: refresh > 0.03 ? `0 0 ${26 * refresh}px ${withAlpha(theme.watch, 0.4 * refresh)}` : 'none',
          }}
        >
          {/* 清单头（标题 + 条目数读出——压缩前后可辨） */}
          <div style={{display: 'flex', alignItems: 'baseline', gap: 16, padding: '16px 24px 0'}}>
            <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>消息记录</span>
            <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, whiteSpace: 'nowrap'}}>{`条目 ${rowsAll} → ${rowsShown}`}</span>
          </div>
          {/* 摘要块（灰——长对话被压成摘要） */}
          {digest > 0.02 ? (
            <div
              style={{
                margin: '14px 24px 0',
                padding: '12px 16px',
                borderRadius: 9,
                border: `2.5px solid ${withAlpha(theme.dim, 0.6 * digest)}`,
                background: withAlpha(theme.dim, 0.1 * digest),
                opacity: digest,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>摘要</span>
              <span style={{flexGrow: 1, height: 10, borderRadius: 3, background: withAlpha(theme.dim, 0.3)}} />
              <span style={{width: 120, height: 10, borderRadius: 3, background: withAlpha(theme.dim, 0.22)}} />
            </div>
          ) : null}
          {/* 条目行（叠叠压缩——行高收窄、条数收敛） */}
          <div style={{position: 'absolute', left: 24, right: 24, top: 150 - 26 * compress}}>
            {Array.from({length: rowsShown}, (_, i) => (
              <div
                key={`row${i}`}
                style={{
                  height: rowH,
                  marginTop: 10,
                  borderRadius: 7,
                  background: withAlpha(theme.dim, 0.2 - 0.08 * compress),
                  border: `1.5px solid ${withAlpha(theme.panelBorder, 0.8)}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '0 14px',
                }}
              >
                <span style={{width: 26, height: 8, borderRadius: 3, background: withAlpha(theme.dim, 0.4)}} />
                <span style={{flexGrow: 1, height: 8, borderRadius: 3, background: withAlpha(theme.dim, 0.24)}} />
              </div>
            ))}
          </div>
        </div>
        {/* 身份说明卡（自清单头注入——天蓝=身份，唯一天蓝新增件） */}
        <IdentityCard x={LIST_1D.w - 350} y={-64} w={340} injP={inject} flashP={refresh} />
      </div>
      {/* 回到干活箭头（右位——亮起） */}
      <div style={{position: 'absolute', left: 1460, top: 380, opacity: arrow, display: 'flex', alignItems: 'center', gap: 14}}>
        <svg width={110} height={54} viewBox="0 0 110 54">
          <path
            d="M6 27 L88 27 M88 27 l-16 -12 M88 27 l-16 12"
            stroke={theme.watch}
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - arrow}
          />
        </svg>
        <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: theme.watch, whiteSpace: 'nowrap'}}>回到干活</span>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'身份重注入 · 灰=历史 · 天蓝=身份'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-E 超时收工：十二拍计数环走满 + 六十秒表到点 + 总结卡飞进队长收件箱 ────────

/** 1-E 布局（安全带红线：环 250 底边 330+250=580、机体底 ~600、计数环底
 *  260+300+读数 ~640、信箱底 300+260=560，恒 ≤ 860。 */
const MATE_1E = {bodyX: 230, bodyY: 380, bodyW: 130, bodyH: 180, ringSize: 250} as const;
const COUNTER_1E = {x: 520, y: 260, size: 300} as const;
const LEADBOX_1E = {x: 1440, y: 300, w: 320, h: 260} as const;

const OneE: React.FC<{atBeats: number; atDial: number; atSummary: number; atFly: number; atFold: number; atRecap: number; beatEnd: number}> = ({
  atBeats,
  atDial,
  atSummary,
  atFly,
  atFold,
  atRecap,
  beatEnd,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 十二拍逐拍落（钟摆逐拍落、计数环逐格点亮——离散给值禁连续滚动）
  const stride = Math.max(3, (atDial - atBeats) / 12);
  const beats = Math.min(12, Math.max(0, Math.floor((frame - atBeats) / stride) + (frame >= atBeats ? 1 : 0)));
  // 钟摆（逐拍落——beat 内以五秒节律的快放演示）
  const beatPhase = ((frame - atBeats) % Math.max(4, stride * 2)) / Math.max(4, stride * 2);
  const folding = clamp01(progress(frame, atFold, 16));
  const sw = folding > 0 ? (1 - folding) * Math.sin(beatPhase * 2 * Math.PI) : Math.sin(beatPhase * 2 * Math.PI);
  // 六十秒表盘走满到点（12×5 推导同框可读——重音镜）
  const dialP = clamp01(progress(frame, atBeats, atDial - atBeats + 12));
  const doneP = Math.sin(Math.PI * clamp01(progress(frame, atDial, 26)));
  // 总结卡自机体弹出飞进队长收件箱（三段避让飞行弧）
  const fly = clamp01(progress(frame, atFly, 26));
  const flyX = MATE_1E.bodyX + 80 + (LEADBOX_1E.x + 120 - (MATE_1E.bodyX + 80)) * fly;
  const flyY = MATE_1E.bodyY + 40 - Math.sin(Math.PI * fly) * 190;
  // 钟停、机体收拢成暗灰（SHUTDOWN——收拢静止，环体停转）
  const ringDot = phasedRing(Math.min(frame, atFold), fps, [{at: 0, sec: 2.5}]);
  const ringFade = 1 - 0.65 * folding;
  // 小结压缩签（≤8 字——幕尾钩定格）
  const recap = clamp01(progress(frame, atRecap, 16));
  return (
    <AbsoluteFill>
      {/* 队友机体（收拢成暗灰位——角标 IDLE_TIMEOUT） */}
      <div style={{position: 'absolute', left: MATE_1E.bodyX + MATE_1E.bodyW / 2 - MATE_1E.ringSize / 2, top: MATE_1E.bodyY - 60, opacity: ringFade}}>
        <TeammateRing size={MATE_1E.ringSize} dotProgress={ringDot} draw={1} />
      </div>
      <AgentBody x={MATE_1E.bodyX} y={MATE_1E.bodyY} w={MATE_1E.bodyW} h={MATE_1E.bodyH} tone={theme.mate} foldP={folding}>
        <div style={{position: 'absolute', left: (MATE_1E.bodyW - 96) / 2, top: 26}}>
          <DutyClock x={0} y={0} size={96} litP={1 - folding * 0.6} swing={sw * (1 - folding)} micro />
        </div>
      </AgentBody>
      <div style={{position: 'absolute', left: MATE_1E.bodyX - 24, top: MATE_1E.bodyY + MATE_1E.bodyH + 10, fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap'}}>
        {'IDLE_TIMEOUT'}
      </div>
      {/* 十二拍计数环 + 六十秒表盘（双口径同帧可对） */}
      <BeatCounterRing x={COUNTER_1E.x} y={COUNTER_1E.y} size={COUNTER_1E.size} beats={beats} dialP={dialP} doneP={doneP} />
      {/* 队长收件箱格口（承 ep15 信箱同款签名） */}
      <MailboxFile x={LEADBOX_1E.x} y={LEADBOX_1E.y} w={LEADBOX_1E.w} h={LEADBOX_1E.h} name="lead.jsonl" litP={1} rows={fly > 0.9 ? 1 : 0} glowP={fly > 0.6 && fly < 0.95 ? 0.8 : 0} />
      <div style={{position: 'absolute', left: LEADBOX_1E.x - 10, top: LEADBOX_1E.y - 40, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.core, whiteSpace: 'nowrap'}}>
        队长 · 收件箱
      </div>
      {/* 总结卡（发一条总结——自机体弹出飞进队长收件箱） */}
      {fly > 0.02 && fly < 0.98 ? (
        <div
          style={{
            position: 'absolute',
            left: flyX,
            top: flyY,
            width: 190,
            height: 96,
            borderRadius: 10,
            border: `3px solid ${withAlpha(theme.watch, 0.85)}`,
            background: withAlpha(theme.panel, 0.98),
            padding: '12px 14px',
            opacity: 1,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>总结</div>
          <div style={{margin: '10px 0 0', height: 8, borderRadius: 3, background: withAlpha(theme.dim, 0.35)}} />
          <div style={{margin: '8px 0 0', height: 8, width: '62%', borderRadius: 3, background: withAlpha(theme.dim, 0.25)}} />
        </div>
      ) : null}
      {/* 小结压缩签（≤8 字——灵不灵留给下一幕） */}
      {recap > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 760,
            display: 'flex',
            justifyContent: 'center',
            opacity: recap,
            transform: `translateY(${(1 - recap) * 16}px)`,
          }}
        >
          <div
            style={{
              padding: '12px 34px',
              borderRadius: 12,
              border: `3px solid ${withAlpha(theme.text, 0.85)}`,
              background: withAlpha(theme.panel, 0.98),
              fontFamily: theme.serif,
              fontSize: 30,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
            }}
          >
            先信后墙 · 认领收工
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7 * clamp01(1 - progress(frame, beatEnd - 6, 6))}}>
        {'敲满十二拍没活 → 发总结，收摊走人'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P1Clockwork: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p1-01', 'p1-02');
  const bB = w('p1-03', 'p1-05');
  const bC = w('p1-06', 'p1-07');
  const bD = w('p1-08', 'p1-08');
  const bE = w('p1-09', 'p1-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <OneA
          atMorph={wa('p1-01', 0.3) - bA.from}
          atSpectrum={[0.5, 0.62, 0.74].map((f) => wa('p1-01', f) - bA.from)}
          atWork={wa('p1-02', 0.08) - bA.from}
          atTags={wa('p1-02', 0.2) - bA.from}
          atIdle={wa('p1-02', 0.52) - bA.from}
          atClock={wa('p1-02', 0.8) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="1-B">
        <OneB
          atDrop1={wa('p1-03', 0.24) - bB.from}
          atBack={wa('p1-03', 0.44) - bB.from}
          atDrop2={wa('p1-03', 0.62) - bB.from}
          atZoom={wa('p1-04', 0.2) - bB.from}
          atEnv={wa('p1-04', 0.36) - bB.from}
          atTagA={wa('p1-04', 0.62) - bB.from}
          atRedFlash={wa('p1-04', 0.8) - bB.from}
          atLit2={wa('p1-05', 0.2) - bB.from}
          atBreathe={wa('p1-05', 0.5) - bB.from}
          atTagB={wa('p1-05', 0.72) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="1-C">
        <OneC
          atLamps={[0.18, 0.32, 0.46].map((f) => wa('p1-06', f) - bC.from)}
          atSkip={wa('p1-06', 0.72) - bC.from}
          atWrite={wa('p1-07', 0.22) - bC.from}
          atWork={wa('p1-07', 0.48) - bC.from}
          atSleep={wa('p1-07', 0.74) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="1-D">
        <OneD atCompress={wa('p1-08', 0.24) - bD.from} atInject={wa('p1-08', 0.5) - bD.from} atRefresh={wa('p1-08', 0.72) - bD.from} atArrow={wa('p1-08', 0.88) - bD.from} />
      </Sequence>
      <Sequence {...bE} name="1-E">
        <OneE
          atBeats={wa('p1-09', 0.1) - bE.from}
          atDial={wa('p1-09', 0.38) - bE.from}
          atSummary={wa('p1-09', 0.58) - bE.from}
          atFly={wa('p1-09', 0.64) - bE.from}
          atFold={wa('p1-09', 0.82) - bE.from}
          atRecap={wa('p1-10', 0.34) - bE.from}
          beatEnd={bE.durationInFrames}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1Clockwork;
