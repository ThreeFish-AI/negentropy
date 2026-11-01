/** P0 写满的草稿纸（p0-01..p0-08，3 镜）——分镜 0-A / 0-B / 0-C。
 *
 *  叙事链：系列片头交棒后冷启动直入（开篇视听合力 I-039）：一张草稿纸占满
 *  画面（蓝面世界坐标首亮——主装置全局位），三类内容块（文件/命令输出/回答）
 *  一行压一行越写越密；p0-01「写满那一刻」字迹加速写密至纸边〔M-005〕、
 *  「直接被拒收」整张泛红、拒收红章砸下（1–2s 重音镜）→ p0-02 三词各落位
 *  三类块 stagger 显形回放、环体〔M-001〕缩悬纸面上角牵纸一角——每转一段
 *  纸厚一分 → p0-03「额度是死的」纸外缘额度框定格〔M-003〕→ 0-B 纸面推近：
 *  直觉方案气泡弹出（「让模型自己总结一遍？」）、「最贵」计费小卡逐字跳价
 *  又收起、「必然丢细节」摘要卡亮出——上句原文「缩进用制表符」被压成「用户
 *  有代码风格偏好」（细节退化对照）、随即气泡整枚碎裂消散（直觉方案服务完
 *  槽位即退役〔M-006〕）→ 0-C 草稿纸退居暗层，四步管线阶梯首亮：四枚步骤卡
 *  沿阶梯排开（暗态轮廓+序号①..④）、成本纵轴自低向高点亮、红线横贯底部亮起
 *  定格（P1 主角预显钩子）；镜尾阶梯缩至右上缩影位（自此恒驻——本集索引件）。
 *
 *  空间契约：单主体草稿纸、三类内容块可辨、署源角标右下恒定不抢焦（首部
 *  署源位）；摘要卡两句上下对照同帧可读、碎裂晚于退化演示完成；四卡阶梯
 *  次序=成本升序（低左高右）全片恒定、红线为唯一横向线元素、步骤卡不提前
 *  显各步内容（info dump 禁）。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；context window ·
 *  prompt_too_long 只进角标；摘要卡文字不复述口播第三句。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {ContextPaper, LoopRing, RedStamp, Redline, StepLadder} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, useProgress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（首部署源位，RSI I-080 豁免登记）：右下常驻，一次淡入后恒定不抢焦；
 *  bottom 168 避开字幕条（承 ep1–ep7 SourceCredit 形态） */
const SourceCredit: React.FC = () => {
  const o = useProgress(0, DUR.f5);
  return (
    <div
      style={{
        position: 'absolute',
        right: 72,
        bottom: 168,
        fontFamily: theme.mono,
        fontSize: 22,
        letterSpacing: 1,
        color: theme.dim,
        opacity: 0.85 * o,
      }}
    >
      Learn Claude Code
    </div>
  );
};

/** 阶梯缩影恒驻位（0-C 镜尾缩至此、P1–P5 各镜同位渲染——字幕安全带上方、
 *  章节条下方，本集索引件全片坐标锚） */
export const LADDER_MINI = {x: 1630, y: 68} as const;

/** 主装置全局位：草稿纸（0-A 满幅 / 0-B 推近底景 / 5-B 回扣同款同形） */
const PAPER = {x: 470, y: 200, w: 980, h: 660} as const;
/** 环体缩悬纸面上角位（0-A/0-B——环侧牵纸一角） */
const RING_P0 = {size: 150, cx: 560, cy: 250} as const;

// ── 0-A 冷启动：写密→泛红→红章 + 三类块回放 + 纸厚一分 + 额度框 ──────────

const ZeroA: React.FC<{atFill: number; atStamp: number; atReA: number; atReB: number; atReC: number; atQuota: number}> = ({
  atFill,
  atStamp,
  atReA,
  atReB,
  atReC,
  atQuota,
}) => {
  const frame = useCurrentFrame();
  // 「写满那一刻」字迹加速写密至纸边（加速曲线——时长标尺外显式帧数 34f，词窗
  // 内 0.28→0.72 的写密主段；先慢后快）
  const fillFast = clamp01(progress(frame, atFill, 34));
  const accel = fillFast * fillFast * (3 - 2 * fillFast) * 0.5 + fillFast * 0.5;
  const rowsLit = 12 * accel;
  // 「直接被拒收」整张泛红 + 红章砸下（1–2s 重音镜：章落 DUR.f4 + 停持全句尾）
  const redness = useProgress(atStamp, DUR.f5);
  const stamp = useProgress(atStamp + 5, DUR.f4, 'accelerate');
  const stampFlash = useImpulse({at: atStamp + 5 + DUR.f3, dur: DUR.f6, peak: 1});
  // p0-02 三词各落位：三类块 stagger 显形回放（闪亮脉冲按词窗）+ 环转一段纸厚一分
  const replay = [
    clamp01(progress(frame, atReA, DUR.f4)),
    clamp01(progress(frame, atReB, DUR.f4)),
    clamp01(progress(frame, atReC, DUR.f4)),
  ];
  const replayFlash = replay.map((p, i) => Math.sin(Math.PI * clamp01(progress(frame, [atReA, atReB, atReC][i], DUR.f5))));
  // 环转：p0-02 期间匀速巡游 + 三词各触发纸厚一分（thickness 随 replay 计数）
  const dot = ((frame / 80) % 1 + 1) % 1;
  const thickness = (replay[0] + replay[1] + replay[2]) / 3;
  // p0-03「额度是死的」纸外缘额度框定格
  const quota = useProgress(atQuota, DUR.f4);
  const quotaFlash = useImpulse({at: atQuota, dur: DUR.f5, peak: 1});
  return (
    <AbsoluteFill>
      {/* 环体（M-001 缩悬纸面上角——环侧牵纸一角：短线锚到纸角） */}
      <div style={{position: 'absolute', left: RING_P0.cx - RING_P0.size / 2, top: RING_P0.cy - RING_P0.size / 2, opacity: 0.92}}>
        <LoopRing size={RING_P0.size} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      <svg width={140} height={90} viewBox="0 0 140 90" style={{position: 'absolute', left: RING_P0.cx + 40, top: RING_P0.cy + 26, overflow: 'visible', opacity: 0.7}}>
        <line x1={4} y1={12} x2={126} y2={76} stroke={withAlpha(theme.core, 0.6)} strokeWidth={2.5} strokeDasharray="5 6" />
      </svg>
      {/* 草稿纸（主装置·蓝面首亮） */}
      <ContextPaper x={PAPER.x} y={PAPER.y} w={PAPER.w} h={PAPER.h} rowsLit={rowsLit} redness={redness} thickness={thickness} quotaLit={quota} stampZone={stampFlash} />
      {/* 三类块回放闪注（p0-02 三词——词窗内各自一拍，加亮对应类别签） */}
      {['文件', '命令输出', '回答'].map((t, i) => {
        const f = replayFlash[i];
        if (f <= 0.04) {
          return null;
        }
        return (
          <div
            key={t}
            style={{
              position: 'absolute',
              left: PAPER.x + 60 + i * 300,
              top: PAPER.y - 44,
              padding: '4px 14px',
              borderRadius: 8,
              border: `2.5px solid ${withAlpha(theme.mech, 0.9)}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 17,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: f,
              transform: `translateY(${(1 - f) * -10}px)`,
            }}
          >
            {t}
          </div>
        );
      })}
      {/* 拒收红章（砸下——0-A 建、1-B 回扣缩小版） */}
      <RedStamp x={PAPER.x + PAPER.w / 2} y={PAPER.y + PAPER.h / 2} p={stamp} flash={stampFlash} scale={1.1} />
      {/* 额度框定格闪注（框满即死的边界陈述） */}
      {quotaFlash > 0.04 ? (
        <div style={{position: 'absolute', left: PAPER.x + PAPER.w / 2 + 180, top: PAPER.y - 52, fontFamily: theme.mono, fontSize: 15, color: theme.danger, whiteSpace: 'nowrap', opacity: quotaFlash}}>
          {'额度 · 满=拒收'}
        </div>
      ) : null}
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'上下文 · 一次能读的全部'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-B 直觉方案气泡：弹出 → 跳价 → 退化对照 → 碎裂 ─────────────────────

/** 摘要卡（气泡内闪过——上句原文与压成句上下对照同帧可读；文字不复述口播第三句
 *  ——只取两短语本体） */
const DegradationCard: React.FC<{x: number; y: number; lit: number; pressP: number}> = ({x, y, lit, pressP}) => {
  const press = clamp01(pressP);
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: clamp01(lit), width: 720}}>
      <div
        style={{
          width: 700,
          boxSizing: 'border-box',
          borderRadius: 12,
          border: `3px solid ${withAlpha(theme.dim, 0.85)}`,
          background: withAlpha(theme.panel, 0.97),
          padding: '14px 20px',
          position: 'relative',
        }}
      >
        {/* 上句原文（具体叮嘱——被压扁） */}
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 26,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            transform: `scaleY(${1 - 0.5 * press}) scaleX(${1 - 0.24 * press})`,
            transformOrigin: 'left center',
            opacity: 1 - 0.45 * press,
          }}
        >
          {'「缩进用制表符」'}
        </div>
        {/* 压缩箭头（把上句挤扁——垂直短箭头） */}
        <svg width={700} height={34} viewBox="0 0 700 34" style={{overflow: 'visible', opacity: press}}>
          <line x1={330} y1={4 + 16 * (1 - press)} x2={330} y2={30 - 16 * (1 - press)} stroke={theme.danger} strokeWidth={3.5} strokeLinecap="round" />
          <path d={`M 322 ${12 + 8 * press} L 330 ${4 + 4 * press} L 338 ${12 + 8 * press}`} fill="none" stroke={theme.danger} strokeWidth={3.5} strokeLinecap="round" />
        </svg>
        {/* 压成句（模糊话——细节退化的终点） */}
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 24,
            color: theme.dim,
            whiteSpace: 'nowrap',
            opacity: press,
            transform: `translateY(${(1 - press) * 8}px)`,
          }}
        >
          {'「用户有代码风格偏好」'}
        </div>
      </div>
    </div>
  );
};

const ZeroB: React.FC<{atBubble: number; atPrice: number; atCard: number; atPress: number; atShatter: number}> = ({
  atBubble,
  atPrice,
  atCard,
  atPress,
  atShatter,
}) => {
  const frame = useCurrentFrame();
  // 「让模型自己总结一遍」直觉方案气泡弹出
  const bubble = useProgress(atBubble, DUR.f5, 'decelerate');
  // 「最贵」计费小卡逐字跳价又收起（再请模型干一次活——调用价跳升）
  const price = useProgress(atPrice, DUR.f4);
  const priceOut = useProgress(atPrice + 26, DUR.f4, 'accelerate');
  const priceVal = Math.round(progress(frame, atPrice, 22) * 100);
  // 「必然丢细节」摘要卡亮出 →「压成」压缩箭头挤扁
  const card = useProgress(atCard, DUR.f5);
  const press = clamp01(progress(frame, atPress, DUR.f5));
  // 气泡碎裂（确定性六碎片飞散——服务完槽位即退役）
  const shatter = clamp01(progress(frame, atShatter, DUR.f5));
  const frag = [
    {dx: -180, dy: -120, r: -30},
    {dx: 150, dy: -150, r: 40},
    {dx: -220, dy: 90, r: 20},
    {dx: 210, dy: 110, r: -25},
    {dx: -60, dy: -220, r: 15},
    {dx: 80, dy: 200, r: -35},
  ];
  return (
    <AbsoluteFill>
      {/* 草稿纸底景（推近态——压暗退居背景） */}
      <ContextPaper x={140} y={170} w={700} h={480} scale={0.96} rowsLit={12} redness={0.3} dim={0.42} thickness={0.6} />
      <div style={{position: 'absolute', left: 150, top: 700, fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: 0.6}}>{'这张纸 · 背景在场'}</div>
      {/* 直觉方案气泡（签面关键词化——碎裂前整枚在场） */}
      {shatter <= 0.02 ? (
        <div style={{position: 'absolute', left: 460, top: 150, opacity: bubble, transform: `translateY(${(1 - bubble) * -26}px) scale(${0.92 + 0.08 * bubble})`}}>
          <div
            style={{
              padding: '18px 34px',
              borderRadius: 22,
              border: `3.5px solid ${withAlpha(theme.text, 0.85)}`,
              background: withAlpha(theme.panel, 0.97),
              boxShadow: `0 0 ${24 * bubble}px ${withAlpha(theme.text, 0.16)}`,
              position: 'relative',
            }}
          >
            <div style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{'让模型自己总结一遍？'}</div>
            <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 8}}>{'直觉方案'}</div>
            {/* 气泡尾巴 */}
            <svg width={60} height={40} viewBox="0 0 60 40" style={{position: 'absolute', left: 80, bottom: -34, overflow: 'visible'}}>
              <path d="M 6 0 L 44 0 L 10 38 Z" fill={theme.panel} stroke={withAlpha(theme.text, 0.85)} strokeWidth={3.5} />
              <path d="M 8 2 L 40 2 L 12 32 Z" fill={theme.panel} stroke="none" />
            </svg>
          </div>
        </div>
      ) : null}
      {/* 气泡碎裂（六碎片飞散消散——帧驱动确定性位移） */}
      {shatter > 0.02
        ? frag.map((fg, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 700 + fg.dx * shatter,
                top: 230 + fg.dy * shatter - 30 * shatter,
                width: 84,
                height: 60,
                borderRadius: 10,
                border: `2.5px solid ${withAlpha(theme.text, 0.6 * (1 - shatter))}`,
                background: withAlpha(theme.panel, 0.9 * (1 - shatter)),
                transform: `rotate(${fg.r * shatter}deg)`,
                opacity: 1 - shatter,
                pointerEvents: 'none',
              }}
            />
          ))
        : null}
      {/* 摘要卡（气泡内闪过——两句上下对照；碎裂后随气泡消散） */}
      {shatter <= 0.02 ? <DegradationCard x={560} y={330} lit={card} pressP={press} /> : null}
      {/* 计费小卡（逐字跳价又收起——百分比读数跳升，收起早于摘要卡） */}
      {price > 0.02 && priceOut < 0.98 ? (
        <div
          style={{
            position: 'absolute',
            left: 1370,
            top: 210,
            padding: '10px 18px',
            borderRadius: 10,
            border: `3px solid ${theme.danger}`,
            background: theme.panel,
            opacity: price * (1 - priceOut),
            transform: `translateY(${(1 - price) * 16}px)`,
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'再干一次活 · 计费'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 34, fontWeight: 700, color: theme.danger, fontVariantNumeric: 'tabular-nums'}}>{`${priceVal}%`}</div>
        </div>
      ) : null}
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'最贵 · 且必然丢细节'}
      </div>
    </AbsoluteFill>
  );
};

/** 四卡 stagger 落位（纯函数——组件内直算，不占 hook 名额；四卡 fit 进词窗） */
const stepLitAt = (frame: number, at: number, n: number): number => {
  const stride = 6;
  let lit = 0;
  for (let i = 0; i < n; i += 1) {
    lit += clamp01(progress(frame, at + i * stride, Math.max(3, 26 - i * stride)));
  }
  return lit;
};

// ── 0-C 四步阶梯首亮：四卡落位 + 成本轴 + 红线 + 缩影收位 ────────────────

/** 阶梯主景位（0-C 居中主景 → 镜尾缩至 LADDER_MINI 缩影位） */
const LADDER_MAIN = {x: 460, y: 250} as const;

const ZeroC: React.FC<{atSteps: number; atAxis: number; atRed: number; atDock: number}> = ({atSteps, atAxis, atRed, atDock}) => {
  const frame = useCurrentFrame();
  // @pushIn（动机：p0-07 解法预告压向本集路线图主角）
  const push = usePushIn(0, {scale: 0.05, dur: DUR.f6});
  // 「四步管线」四卡沿阶梯 stagger 落位（暗态轮廓+序号——内容留各幕点亮）
  const stepsLit = stepLitAt(frame, atSteps, 4);
  // 「便宜的先跑，贵的后跑」成本轴箭头自低向高点亮（低档在前高档在后）
  const axis = useProgress(atAxis, DUR.f6, 'decelerate');
  // 「先立一条红线」红线横贯底部亮起定格（P1 主角预显——钩子）
  const red = useProgress(atRed, DUR.f5, 'decelerate');
  const redFlash = useImpulse({at: atRed, dur: DUR.f6, peak: 1});
  // 镜尾：main 阶梯淡出、mini 阶梯同位淡入（缩影自此恒驻右上——本集索引件；
  // 交叉淡入而非缩放变换：mini 是独立形态（46px 格 vs 250px 卡），0-C→1-A 走
  // SceneFade + 同位重锚，morph 不适用（形态档位切换））
  const dock = clamp01(progress(frame, atDock, DUR.f6));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '42% 50%'}}>
        {/* 草稿纸退居暗层（0-B 后压暗驻左——蓝面世界在场的持续锚） */}
        <ContextPaper x={130} y={300} w={420} h={330} scale={0.9} rowsLit={12} dim={0.35 + 0.25 * dock} redness={0.2} />
        {/* 四步阶梯（主景居中——镜尾淡出） */}
        <StepLadder x={LADDER_MAIN.x} y={LADDER_MAIN.y} litMask={stepsLit} axisP={axis} mode="main" lit={1 - dock} />
        {/* 阶梯缩影（右上——镜尾淡入，自此恒驻） */}
        <StepLadder x={LADDER_MINI.x} y={LADDER_MINI.y} mode="mini" litMask={stepsLit} lit={dock} axisP={dock} />
        {/* 红线（横贯画面底部——亮起定格；1-A 迁入列下缘驻位） */}
        <Redline x={120} y={946} w={1680} lit={red} />
        {redFlash > 0.04 ? (
          <div style={{position: 'absolute', left: 0, right: 0, top: 896, textAlign: 'center', fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.danger, opacity: redFlash}}>
            {'红线 · 动手之前先立'}
          </div>
        ) : null}
        <SourceCredit />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'四步管线 · 成本阶梯（低 → 高）'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0FillingPaper: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-06');
  const bC = w('p0-07', 'p0-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A">
        <ZeroA
          atFill={wa('p0-01', 0.24) - bA.from}
          atStamp={wa('p0-01', 0.74) - bA.from}
          atReA={wa('p0-02', 0.14) - bA.from}
          atReB={wa('p0-02', 0.36) - bA.from}
          atReC={wa('p0-02', 0.58) - bA.from}
          atQuota={wa('p0-03', 0.68) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atBubble={wa('p0-04', 0.5) - bB.from}
          atPrice={wa('p0-05', 0.14) - bB.from}
          atCard={wa('p0-05', 0.58) - bB.from}
          atPress={wa('p0-06', 0.44) - bB.from}
          atShatter={wa('p0-06', 0.84) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="0-C">
        <ZeroC
          atSteps={wa('p0-07', 0.18) - bC.from}
          atAxis={wa('p0-07', 0.48) - bC.from}
          atRed={wa('p0-08', 0.36) - bC.from}
          atDock={at('p0-08') + span('p0-08') - 16 - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0FillingPaper;
