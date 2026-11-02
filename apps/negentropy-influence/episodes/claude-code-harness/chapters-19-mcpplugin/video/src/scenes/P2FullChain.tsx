/** P2 连一个服务，走全程（p2-01..p2-08，3 镜）——分镜 2-A / 2-B / 2-C。
 *
 *  Morph Continuity（1-E→2-A，头注明示）：同一主体 = 深空蓝工具池 + 池边
 *  对照表组合体。起止态：1-E 末帧池居中主体、表驻池边、环体池后上方 →
 *  2-A 首帧池移驻走查舞台主程序位（同内容）、表缩至联动位同形缩微、环体
 *  缩悬顶角。中间态：入场 settle 位移（+60x → 0——1-E 布局向走查舞台位的
 *  平移延续），池体描边色、池内卡片构成、表双列轮廓逐帧不变。何时不该
 *  morph：缩微后表行内容低于可读阈值即回退表形图标 + 行数角标（RegistryTable
 *  micro 档——承 ep2 1-D→2-A 同款条款）。
 *
 *  叙事链：2-A 走查舞台三件套：p2-01「连接部署服务」词落位兰紫通道点亮贯通
 *  〔M-005〕、「清单回来」词落位清单卷轴回传展开、「查状态、触发部署两件」
 *  词落位两件工具卡落位舞台 → p2-02「挂牌」词落位前缀牌逐段拍上合成全名卡、
 *  「进池」词落位两卡汇入池池重灌一拍（外部族 +1→+2 动态可见）、「随池交给
 *  模型」词落位池沿注入环体调模型段（池→环通路首通）、「一口气走完」词落位
 *  三动作快节奏连击 → 2-B 调用链特写（Animated Worked Example——单输入
 *  mcp__deploy__check 全程可追）：p2-03「点名」词落位全名卡自模型气泡升起
 *  （模型开口点名）→ p2-04「翻回原始名」词落位对照表左列命中行亮起、全名卡
 *  沿行滑移至右列原始名 check（翻译轨迹全程可追）、「递给服务执行」词落位
 *  执行流（青碧）自表右列落进服务卡 → p2-05「原路回喂」词落位回执条
 *  「web: running」（实测日志原串，角标层）沿同一通路回流至模型气泡侧（回程
 *  与去程路径严格重合）→ p2-06「没写过一行」词落位「接入代码」空白区亮框
 *  定格（judge 三词锚之一）、「一行」词落位空白区内一枚「0 行」小签落定
 *  （重音镜：零代码接入实证定格，基线=0）→ 2-C 命名边界帧＋幕尾钩：
 *  p2-07「斜杠圆点」词落位网格拦字符复演（与 1-C 同款同速——装置复现）、
 *  「实测在案」词落位「在案」戳盖归一后全名卡 → p2-08「每一轮都在变」词落位
 *  池面涟漪自池心扩散、旧池外层色块片片褪起（@breathe→涌动——活池预告，
 *  幕尾钩一拍收半档黑）。
 *
 *  空间契约（安全带实算）：2-A 服务卡底 600 / 主程序底 540 / 池底 580+220=800 /
 *  卷轴底 650+150=800；2-B 环体底 90+230=320 / 表底 380+240=620 / 服务卡底
 *  360+280=640 / 主程序底 620+220=840（空白区在卡内）；2-C 归一网格底
 *  600+240=840 / 池底 560+190=750——全部 ≤ 860。红线落实：通道单向
 *  （服务→主程序）、挂牌先于进池（次序=口播次序）、环体不提前注入、单输入
 *  四段（点名→翻译→执行→回喂）全程同卡可追、去程与回程路径重合、空白区
 *  显式空（0 行）且回执串与实测日志逐字一致（web: running）、归一网格与
 *  1-C 同款同位同色（镜间身份恒常）、「在案」戳盖归一后全名卡且为唯一确认绿
 *  元素。词落位 = wa(id,f)。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  LoopRing,
  MODEL_CALL_ARC,
  PrefixPlate,
  SanitizeGrid,
  ScrollList,
  SegArc,
  SvcCard,
  ToolChip,
  ToolPool,
  RegistryTable,
} from '../components/motifs';
import {clamp01, progress} from '../motion';
import {ease} from '../components/motifs';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 主程序块（1-A 同形复现——P1 导出过；此处本地轻量重绘同形：深空蓝描边+内窗暗行） */
const HostBlock: React.FC<{x: number; y: number; w: number; h: number; litP?: number; dimP?: number}> = ({x, y, w, h, litP = 1, dimP = 0}) => {
  const lit = clamp01(litP);
  const dim = clamp01(dimP);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit * (1 - 0.55 * dim)}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 16,
          border: `4px solid ${theme.pool}`,
          background: withAlpha(theme.panel, 0.96),
        }}
      >
        <div style={{position: 'absolute', left: 24, top: 18, fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
          主程序
        </div>
        {[0, 1].map((r) => (
          <div
            key={`hw${r}`}
            style={{
              position: 'absolute',
              left: 24,
              top: 74 + r * 46,
              width: w - 48 - r * 40,
              height: 12,
              borderRadius: 4,
              background: withAlpha(theme.pool, 0.14),
            }}
          />
        ))}
        <div style={{position: 'absolute', right: 14, bottom: 10, fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85}}>
          host
        </div>
      </div>
    </div>
  );
};

// ── 2-A 走查舞台三件套：通道点亮 + 挂牌 + 进池 + 池→环通路首通 ─────────────────

/** 2-A 布局（安全带实算见头注；morph settle = 1-E 布局向舞台位平移延续） */
const BA = {
  svc: {x: 150, y: 320, w: 380, h: 280},
  host: {x: 660, y: 300, w: 380, h: 240},
  pool: {x: 690, y: 580, w: 400, h: 220},
  table: {x: 1330, y: 430},
  ring: {x: 880, y: 80, size: 180},
  chY: 440,
  scroll: {x: 540, y: 650, w: 480, h: 150},
  chips: [
    {x: 600, y: 684, name: '查状态', tag: 'check'},
    {x: 850, y: 684, name: '触发部署', tag: 'trigger'},
  ],
} as const;

const TwoA: React.FC<{atChannel: number; atScroll: number; atChip1: number; atChip2: number; atTag: number; atPool: number; atInject: number; atCombo: number}> = ({
  atChannel,
  atScroll,
  atChip1,
  atChip2,
  atTag,
  atPool,
  atInject,
  atCombo,
}) => {
  const frame = useCurrentFrame();
  // morph settle（1-E 组合体平移落位——首 12 帧）
  const settle = ease(clamp01(progress(frame, 0, 12)));
  // 兰紫通道点亮贯通（服务 → 主程序，单向）
  const ch = clamp01(progress(frame, atChannel, 16));
  const chGlow = Math.sin(Math.PI * clamp01(progress(frame, atChannel + 12, 16)));
  // 清单卷轴回传展开 + 两件工具卡落位
  const un = clamp01(progress(frame, atScroll, 16));
  const c1 = clamp01(progress(frame, atChip1, 10));
  const c2 = clamp01(progress(frame, atChip2, 10));
  // 挂牌（前缀牌逐段拍上——快）→ 进池（两卡汇入、外部族 +1→+2、池重灌一拍）
  const tag = clamp01(progress(frame, atTag, 10));
  const intoPool = clamp01(progress(frame, atPool, 16));
  const refill = Math.sin(Math.PI * clamp01(progress(frame, atPool + 10, 18)));
  // 池沿注入环体调模型段（池→环通路首通）
  const inject = clamp01(progress(frame, atInject, 16));
  // 三动作快节奏连击（一口气语义——通道/挂牌/进池三处快闪）
  const combo = [0, 1, 2].map((k) => Math.sin(Math.PI * clamp01(progress(frame, atCombo + k * 5, 10))));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: `translateX(${(1 - settle) * 60}px)`}}>
        {/* 左：部署服务卡（承 1-B 同名卡） */}
        <SvcCard x={BA.svc.x} y={BA.svc.y} w={BA.svc.w} h={BA.svc.h} title="部署服务" tag="deploy" lampP={ch} flashP={combo[0] * 0.5} />
        {/* 中：主程序 + 深空蓝池（承 1-E 末态内容） */}
        <HostBlock x={BA.host.x} y={BA.host.y} w={BA.host.w} h={BA.host.h} litP={1} />
        <ToolPool
          x={BA.pool.x}
          y={BA.pool.y}
          w={BA.pool.w}
          h={BA.pool.h}
          litP={1}
          fillP={1}
          labelP={1}
          capTag="教学版 5+1"
          capP={1}
          cards={[
            {name: '内置工具 ×5', litP: 1},
            {name: 'connect_mcp', litP: 1},
            {name: '查状态', litP: intoPool},
            {name: '触发部署', litP: intoPool * clamp01(progress(frame, atPool + 8, 8))},
          ]}
        />
        {refill > 0.05 ? (
          <div
            style={{
              position: 'absolute',
              left: BA.pool.x - 6,
              top: BA.pool.y - 6,
              width: BA.pool.w + 12,
              height: BA.pool.h + 12,
              borderRadius: 28,
              border: `3px solid ${withAlpha(theme.pool, 0.6 * refill)}`,
              boxShadow: `0 0 ${26 * refill}px ${withAlpha(theme.pool, 0.4 * refill)}`,
              pointerEvents: 'none',
            }}
          />
        ) : null}
        {/* 右：对照表缩微联动位（表形图标 + 行数角标） */}
        <RegistryTable x={BA.table.x} y={BA.table.y} litP={1} micro rowsTag="2 行" rows={[{full: '', orig: '', litP: 1}, {full: '', orig: '', litP: 1}]} />
        {/* 兰紫通道（服务 → 主程序——单向；点亮贯通） */}
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <line
            x1={BA.svc.x + BA.svc.w}
            y1={BA.chY}
            x2={BA.host.x}
            y2={BA.chY}
            stroke={theme.svc}
            strokeWidth={5}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - ch}
            opacity={0.85}
          />
          {ch > 0.9 ? (
            <line x1={BA.svc.x + BA.svc.w} y1={BA.chY} x2={BA.host.x} y2={BA.chY} stroke={theme.svc} strokeWidth={9} strokeDasharray="14 18" strokeDashoffset={-frame * 1.1} opacity={0.3 + 0.4 * chGlow} strokeLinecap="round" />
          ) : null}
          {/* 池→环通路首通（池沿注入调模型段） */}
          <line
            x1={BA.pool.x + BA.pool.w / 2}
            y1={BA.pool.y - 4}
            x2={BA.ring.x + BA.ring.size / 2 + 66}
            y2={BA.ring.y + BA.ring.size / 2 - 22}
            stroke={theme.core}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray="10 13"
            strokeDashoffset={-frame * 1.3}
            opacity={0.8 * inject}
          />
        </svg>
        {/* 环体缩悬顶角（调模型段微光在位） */}
        <div style={{position: 'absolute', left: BA.ring.x, top: BA.ring.y}}>
          <LoopRing size={BA.ring.size} nodes={[]} showExit={false} />
          <SegArc size={BA.ring.size} from={MODEL_CALL_ARC.a0} to={MODEL_CALL_ARC.a1} litP={0.35 + 0.65 * inject} />
        </div>
        {/* 清单卷轴 + 两件工具卡（落位舞台——中文名主字；挂牌后合成全名卡） */}
        <ScrollList x={BA.scroll.x} y={BA.scroll.y} w={BA.scroll.w} h={BA.scroll.h} litP={1} unrollP={un}>
          {BA.chips.map((c, i) => {
            const lit = (i === 0 ? c1 : c2) * un;
            // 挂牌后前缀牌盖在卡上；进池时卡飞向池（消失入池）
            const fly = i === 0 ? intoPool : intoPool * 0.9;
            return (
              <div key={`bc${i}`} style={{position: 'absolute', left: c.x - BA.scroll.x, top: c.y - BA.scroll.y, opacity: 1 - fly * 0.95, transform: `translate(${fly * (BA.pool.x - c.x + 60)}px, ${fly * (BA.pool.y - c.y - 40)}px) scale(${1 - fly * 0.3})`}}>
                <ToolChip x={0} y={0} w={220} h={100} name={c.name} tag={c.tag} litP={lit} tone={theme.svc} />
                {tag > 0.5 ? (
                  <div style={{position: 'absolute', left: 26, top: -34, opacity: tag}}>
                    <PrefixPlate x={0} y={0} segs={[1, 1, 1]} tool={i === 0 ? 'check' : 'trigger'} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </ScrollList>
        {/* 挂牌角标（合成全名卡——角标层） */}
        {tag > 0.6 ? (
          <div style={{position: 'absolute', left: BA.scroll.x + 60, top: BA.scroll.y + BA.scroll.h + 6, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap', opacity: (tag - 0.5) * 2 * 0.9}}>
            mcp__deploy__check · mcp__deploy__trigger
          </div>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'连接 · 清单 · 挂牌 · 进池 · 交给模型'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-B 调用链特写：点名 → 翻译 → 执行 → 回喂（单输入四段全程可追）+ 0 行定格 ──

/** 2-B 布局（安全带实算见头注；去程=回程同一折线 A→B→C→D，回执沿原路回流） */
const BB = {
  ring: {x: 170, y: 90, size: 230},
  bubble: {x: 400, y: 120, w: 220, h: 92},
  table: {x: 620, y: 380, w: 480, h: 240},
  svc: {x: 1360, y: 360, w: 380, h: 280},
  host: {x: 190, y: 620, w: 400, h: 220},
  blank: {x: 220, y: 700, w: 340, h: 110},
} as const;
/** 调用折线（去程）：A 气泡下口 → B 表顶中 → C 表右中 → D 服务卡左中；回程严格同线反走 */
const TRACE = {
  A: {x: 510, y: 212},
  B: {x: 860, y: 380},
  C: {x: 1100, y: 470},
  D: {x: 1360, y: 470},
} as const;

/** 折线取点（A→B→C→D 按弧长比例插值——回执回流用同式反走，路径严格重合） */
const tracePoint = (t: number): {x: number; y: number} => {
  const segs = [
    {a: TRACE.A, b: TRACE.B},
    {a: TRACE.B, b: TRACE.C},
    {a: TRACE.C, b: TRACE.D},
  ];
  const lens = segs.map((s) => Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y));
  const total = lens[0] + lens[1] + lens[2];
  let d = clamp01(t) * total;
  for (let i = 0; i < 3; i++) {
    if (d <= lens[i] || i === 2) {
      const k = Math.min(1, d / lens[i]);
      return {x: segs[i].a.x + (segs[i].b.x - segs[i].a.x) * k, y: segs[i].a.y + (segs[i].b.y - segs[i].a.y) * k};
    }
    d -= lens[i];
  }
  return TRACE.D;
};

const TwoB: React.FC<{atRise: number; atHit: number; atSlide: number; atExec: number; atReturn: number; atBlank: number; atZero: number}> = ({
  atRise,
  atHit,
  atSlide,
  atExec,
  atReturn,
  atBlank,
  atZero,
}) => {
  const frame = useCurrentFrame();
  // ① 点名：全名卡自模型气泡升起（沿 A→B 段）
  const rise = clamp01(progress(frame, atRise, 18));
  // ② 翻译：对照表左列命中行亮起 + 全名卡沿行滑移至右列
  const hit = clamp01(progress(frame, atHit, 10));
  const slide = clamp01(progress(frame, atSlide, 16));
  // ③ 执行：执行流（青碧）自表右列落进服务卡（C→D 段描线 + 脉冲）
  const exec = clamp01(progress(frame, atExec, 16));
  const execPulse = Math.sin(Math.PI * clamp01(progress(frame, atExec + 12, 16)));
  // ④ 回喂：回执条「web: running」沿同一通路回流（D→C→B→A 反走——路径严格重合）
  const ret = clamp01(progress(frame, atReturn, 24));
  const retPos = tracePoint(1 - ret);
  // 「接入代码」空白区亮框定格 + 「0 行」小签落定（judge 三词锚之一）
  const blank = clamp01(progress(frame, atBlank, 12));
  const zero = clamp01(progress(frame, atZero, 12));
  const zeroPulse = Math.sin(Math.PI * clamp01(progress(frame, atZero + 8, 18)));
  return (
    <AbsoluteFill>
      {/* 环体（左上——调模型段高亮；模型气泡挂段侧） */}
      <div style={{position: 'absolute', left: BB.ring.x, top: BB.ring.y}}>
        <LoopRing size={BB.ring.size} nodes={[]} showExit={false} />
        <SegArc size={BB.ring.size} from={MODEL_CALL_ARC.a0} to={MODEL_CALL_ARC.a1} litP={1} />
      </div>
      {/* 模型气泡（环体调模型段旁——点名发起位） */}
      <div style={{position: 'absolute', left: BB.bubble.x, top: BB.bubble.y, width: BB.bubble.w, height: BB.bubble.h}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 18,
            border: `3.5px solid ${withAlpha(theme.core, 0.8)}`,
            background: withAlpha(theme.panel, 0.97),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontSize: 22,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
          }}
        >
          模型
        </div>
        {/* 气泡尾（指向环体调模型段） */}
        <svg width={40} height={30} viewBox="0 0 40 30" style={{position: 'absolute', left: -30, top: 24}}>
          <path d="M38 4 L6 24 L26 26 Z" fill={withAlpha(theme.panel, 0.97)} stroke={withAlpha(theme.core, 0.7)} strokeWidth={2.5} />
        </svg>
      </div>
      {/* 调用折线（去程描线：A→B 段随点名亮起；C→D 段随执行流描线） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <line x1={TRACE.A.x} y1={TRACE.A.y} x2={TRACE.B.x} y2={TRACE.B.y} stroke={theme.core} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - rise} opacity={0.7} />
        <line x1={TRACE.C.x} y1={TRACE.C.y} x2={TRACE.D.x} y2={TRACE.D.y} stroke={theme.exec} strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - exec} opacity={0.9} />
        {exec > 0.95 ? <line x1={TRACE.C.x} y1={TRACE.C.y} x2={TRACE.D.x} y2={TRACE.D.y} stroke={theme.exec} strokeWidth={9} strokeDasharray="12 16" strokeDashoffset={-frame * 1.2} opacity={0.25 + 0.45 * execPulse} strokeLinecap="round" /> : null}
        {/* B→C 表内衔接（表右列引出——短衔接线） */}
        <line x1={TRACE.B.x} y1={TRACE.B.y} x2={TRACE.C.x} y2={TRACE.C.y} stroke={withAlpha(theme.exec, 0.55)} strokeWidth={3.5} strokeDasharray="8 8" opacity={exec} />
      </svg>
      {/* 全名卡（单输入——自气泡沿 A→B 升至表，随滑移翻译） */}
      {rise > 0.02 && rise < 1.06 ? (
        <div
          style={{
            position: 'absolute',
            left: tracePoint(rise * 0.32).x - 130,
            top: tracePoint(rise * 0.32).y - 44,
            opacity: clamp01(rise * 3) * (1 - Math.max(0, slide - 0.8) * 5),
          }}
        >
          <div style={{padding: '7px 16px', borderRadius: 9, border: `2.5px solid ${theme.svc}`, background: withAlpha(theme.panel, 0.98), fontFamily: theme.mono, fontSize: 16, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
            mcp__deploy__check
          </div>
        </div>
      ) : null}
      {/* 对照表（放大入画——左列命中行高亮、滑移翻译） */}
      <RegistryTable
        x={BB.table.x}
        y={BB.table.y}
        w={BB.table.w}
        h={BB.table.h}
        litP={1}
        hitP={hit}
        slideP={slide}
        rows={[
          {full: 'mcp__deploy__check', orig: 'check', litP: 1},
          {full: 'mcp__deploy__trigger', orig: 'trigger', litP: 1},
        ]}
      />
      {/* 服务卡（右——执行落点） */}
      <SvcCard x={BB.svc.x} y={BB.svc.y} w={BB.svc.w} h={BB.svc.h} title="部署服务" tag="deploy" lampP={1} flashP={execPulse * 0.6} />
      {/* 回执条（沿原路回流——实测日志原串 web: running，角标层） */}
      {ret > 0.02 && ret < 0.99 ? (
        <div
          style={{
            position: 'absolute',
            left: retPos.x + 14,
            top: retPos.y - 16,
            padding: '5px 14px',
            borderRadius: 8,
            border: `2.5px solid ${theme.exec}`,
            background: withAlpha(theme.panel, 0.98),
            fontFamily: theme.mono,
            fontSize: 15,
            fontWeight: 700,
            color: theme.exec,
            whiteSpace: 'nowrap',
            opacity: clamp01(ret * 6) * (1 - Math.max(0, ret - 0.92) * 12),
          }}
        >
          web: running
        </div>
      ) : null}
      {/* 主程序（左下）+「接入代码」空白区（显式空——斜线空框；0 行定格） */}
      <HostBlock x={BB.host.x} y={BB.host.y} w={BB.host.w} h={BB.host.h} litP={1} />
      <div
        style={{
          position: 'absolute',
          left: BB.blank.x,
          top: BB.blank.y,
          width: BB.blank.w,
          height: BB.blank.h,
          borderRadius: 10,
          border: `3px ${blank > 0.5 ? 'solid' : 'dashed'} ${withAlpha(theme.exec, 0.35 + 0.55 * blank)}`,
          background: 'transparent',
          opacity: 0.4 + 0.6 * blank,
          boxShadow: zeroPulse > 0.05 ? `0 0 ${24 * zeroPulse}px ${withAlpha(theme.exec, 0.4 * zeroPulse)}` : 'none',
        }}
      >
        {/* 斜线空框（显式空——空白区不出现任何代码字符） */}
        <svg width={BB.blank.w} height={BB.blank.h} viewBox={`0 0 ${BB.blank.w} ${BB.blank.h}`}>
          <line x1={8} y1={BB.blank.h - 8} x2={BB.blank.w - 8} y2={8} stroke={withAlpha(theme.dim, 0.4)} strokeWidth={2.5} strokeDasharray="7 7" />
        </svg>
        <div style={{position: 'absolute', left: 12, top: -30, fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>
          接入代码
        </div>
        {/* 「0 行」小签（落定——零代码接入实证定格，基线=0） */}
        {zero > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) scale(${0.7 + 0.3 * zero})`,
              padding: '6px 22px',
              borderRadius: 10,
              border: `3px solid ${theme.exec}`,
              background: withAlpha(theme.panel, 0.98),
              fontFamily: theme.mono,
              fontSize: 26,
              fontWeight: 700,
              color: theme.exec,
              whiteSpace: 'nowrap',
              opacity: zero,
            }}
          >
            0 行
          </div>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'点名 → 翻译 → 执行 → 回喂 · 结果原路回 · 主程序 0 行接入代码'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-C 命名边界帧＋幕尾钩：网格复演 + 在案戳 + 池涟漪褪层 ──────────────────────

/** 2-C 布局（安全带实算：服务卡底 320+240=560 / 网格底 600+240=840 / 池底
 *  560+190=750，恒 ≤ 860） */
const BC = {
  svc: {x: 1120, y: 320, w: 340, h: 240},
  grid: {x: 470, y: 600, w: 780},
  pool: {x: 130, y: 560, w: 330, h: 190},
} as const;

const TwoC: React.FC<{atFlyIn: number; atFlip1: number; atFlip2: number; atDone: number; atStamp: number; atRipple: number; durC: number}> = ({
  atFlyIn,
  atFlip1,
  atFlip2,
  atDone,
  atStamp,
  atRipple,
  durC,
}) => {
  const frame = useCurrentFrame();
  // inv-checker 服务卡自侧翼飞入（另一服务新面孔）
  const flyIn = ease(clamp01(progress(frame, atFlyIn, 18)));
  // 网格拦字符复演（与 1-C 同款同速——装置复现：同 device 同时长）
  const grid = clamp01(progress(frame, atFlyIn + 4, 12));
  const enter = clamp01(progress(frame, atFlyIn + 12, 14));
  const fp1 = clamp01(progress(frame, atFlip1, 12));
  const fp2 = clamp01(progress(frame, atFlip2, 12));
  const done = clamp01(progress(frame, atDone, 12));
  const stamp = clamp01(progress(frame, atStamp, 10));
  // 池面涟漪自池心扩散 + 旧池外层色块片片褪起（活池预告）
  const ripple = clamp01(progress(frame, atRipple, 26));
  const shed = clamp01(progress(frame, atRipple + 10, 22));
  // 幕尾钩一拍收半档黑
  const halfDim = clamp01(progress(frame, durC - 10, 10)) * 0.45;
  return (
    <AbsoluteFill>
      {/* inv-checker 服务卡（自右翼飞入——工单核对，另一服务新面孔） */}
      <div style={{position: 'absolute', left: BC.svc.x + (1 - flyIn) * 620, top: BC.svc.y, opacity: flyIn}}>
        <SvcCard x={0} y={0} w={BC.svc.w} h={BC.svc.h} title="工单核对" tag="inv-checker" litP={1} />
      </div>
      {/* 白名单归一网格（1-C 同款同位同色复现 + 「在案」戳盖归一后全名卡） */}
      <SanitizeGrid x={BC.grid.x} y={BC.grid.y} w={BC.grid.w} litP={grid} enterP={enter} flipPs={[fp1, fp2]} doneP={done} stampP={stamp} />
      {/* 走查舞台残位（压暗——三件套退后） */}
      <div style={{position: 'absolute', inset: 0, opacity: 0.45}}>
        <HostBlock x={660} y={200} w={300} h={190} dimP={0.5} />
        <SvcCard x={120} y={190} w={280} h={200} title="部署服务" tag="deploy" litP={0.5} />
      </div>
      {/* 镜尾池面（涟漪自池心扩散 + 旧池外层色块褪起——活池预告） */}
      <ToolPool
        x={BC.pool.x}
        y={BC.pool.y}
        w={BC.pool.w}
        h={BC.pool.h}
        litP={1}
        fillP={1}
        rippleP={ripple}
        shedP={shed}
        labelP={1}
        capTag="教学版 5+1"
        capP={1}
        cards={[
          {name: '内置 ×5', litP: 1},
          {name: '查状态', litP: 1},
          {name: '触发部署', litP: 1},
        ]}
      />
      {/* 幕尾钩：半档黑（涟漪褪层后的余韵收拍） */}
      <AbsoluteFill style={{background: '#000', opacity: halfDim, pointerEvents: 'none'}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7 * (1 - halfDim)}}>
        {'斜杠圆点翻下划线 · 实测在案 · 池每轮都在变'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P2FullChain: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p2-01', 'p2-02');
  const bB = w('p2-03', 'p2-06');
  const bC = w('p2-07', 'p2-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A">
        <TwoA
          atChannel={wa('p2-01', 0.2) - bA.from}
          atScroll={wa('p2-01', 0.46) - bA.from}
          atChip1={wa('p2-01', 0.62) - bA.from}
          atChip2={wa('p2-01', 0.74) - bA.from}
          atTag={wa('p2-02', 0.08) - bA.from}
          atPool={wa('p2-02', 0.2) - bA.from}
          atInject={wa('p2-02', 0.4) - bA.from}
          atCombo={wa('p2-02', 0.72) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <TwoB
          atRise={wa('p2-03', 0.3) - bB.from}
          atHit={wa('p2-04', 0.36) - bB.from}
          atSlide={wa('p2-04', 0.48) - bB.from}
          atExec={wa('p2-04', 0.72) - bB.from}
          atReturn={wa('p2-05', 0.22) - bB.from}
          atBlank={wa('p2-06', 0.55) - bB.from}
          atZero={wa('p2-06', 0.78) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <TwoC
          atFlyIn={wa('p2-07', 0.1) - bC.from}
          atFlip1={wa('p2-07', 0.3) - bC.from}
          atFlip2={wa('p2-07', 0.42) - bC.from}
          atDone={wa('p2-07', 0.6) - bC.from}
          atStamp={wa('p2-07', 0.8) - bC.from}
          atRipple={wa('p2-08', 0.64) - bC.from}
          durC={bC.durationInFrames}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2FullChain;
