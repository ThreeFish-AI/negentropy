/** P3 池是活的（p3-01..p3-10，3 镜）——分镜 3-A / 3-B / 3-C。
 *
 *  Morph Continuity（2-C→3-A，头注明示）：同一主体 = 深空蓝工具池。起止态：
 *  2-C 末帧池驻走查舞台主程序位、涟漪褪层初现 → 3-A 首帧池放大升为主体位、
 *  环体自顶角落位池后（调模型段高亮）、褪层完成转入重灌循环。中间态：入场
 *  settle 位移（+80y → 0——升位平移延续），池体描边色、池内卡片构成、涟漪
 *  纹理逐帧延续。何时不该 morph：升位跳帧或池体重绘抖动，回退 cut + 同形
 *  入场。
 *
 *  叙事链：3-A 环体主场一拍（全景坐标锚）：p3-01「每轮组装」词落位池子一轮
 *  重灌循环演示（清空→注入——清/注两拍明确可辨）〔M-005〕、「不是一份固定
 *  清单」词落位快照卡与池内清单错位一闪 → p3-02「连上新服务」词落位泛指服务
 *  剪影卡接入、池面增亮一拍、「得跟着变」词落位快照卡滞后半拍跟动（跟不上）
 *  → p3-03「缓存」词落位快照卡翻面显内容（提示词存档小图+省钱提速小签——
 *  白话先释的视觉对位）、「还是旧的」词落位快照内清单与池内清单同帧对照
 *  （旧 vs 新差一眼可辨，重音镜）→ 3-B 左红右绿消融同屏（全片张力峰值——E5
 *  实测）：p3-04「实测说话」词落位双轨立起、docs 服务连接+两件新工具清单
 *  回传（两轨共享同一次连接——控制变量可视）→ p3-05「冷冰冰」词落位左轨
 *  演示：全名卡飞向旧池→池面弹回+「Unknown tool: mcp__docs__search」回执条
 *  弹现、左计数「成功 0」定格 → p3-06「连上了」词落位左轨服务卡连接灯亮
 *  （连接是好的）、「旧缓存」词落位快照卡自池沿放大一拍（病灶定位：连接
 *  绿灯 vs 旧缓存同帧对照，张力峰值 punch；judge 三词锚之一）→ p3-07「重建
 *  工具池」词落位右轨演示：池重灌→新四卡入池→同一全名卡落进 docs 服务卡→
 *  结果条回流（确认绿，角标原串 results for loop）、右计数「成功 1」跳格 →
 *  p3-08「双双坐实」词落位双断言签并列定格（左「不重建 · 调不到」右「重建 ·
 *  立刻恢复」）+ 双计数条对照（基线锚定，重音镜）〔M-003〕→ 3-C 金句卡预亮：
 *  p3-09「干脆不缓存的」词落位选项牌亮出（牌内小池每轮现拼微图）、「每轮
 *  现拼」词落位微循环一拍 → p3-10「教训一句话」词落位金句卡淡入定格（衬线
 *  体，重音镜）、「必须随它失效」词落位旧缓存卡燃尽动画（作废即焚）。
 *
 *  空间契约（安全带实算）：3-A 环体底 140+460=600 / 池底 340+240=580 / 快照
 *  卡底 640+190=830 / 剪影卡底 330+230=560；3-B 双轨底 150+690=840（轨内
 *  元素全部 ≤ 轨底）、清单回传带在轨内 y 765..835；3-C 金句卡底 240+150=390 /
 *  选项牌底 470+260=730 / 燃尽位底 470+220=690——全部 ≤ 860。红线落实：
 *  红左绿右恒定、两轨服务卡/调用卡同款同位（控制变量唯一差异=重建与否）、
 *  回执串与实测日志逐字一致（Unknown tool: mcp__docs__search / results for
 *  loop）、计数离散发值与实测一致（调用 1·成功 0 ↔ 重建 1·成功 1）、快照卡
 *  内容停在旧清单（不自动更新）、泛指服务卡不显名、左轨无结果回流（不重建
 *  调不到是实测红线）、右轨无弹回、无轮次带（E5 为单次调用断言——B.2 显式
 *  口径）、金句卡为唯一衬线体主体且卡文为关键词压缩复述、燃尽有过程且无
 *  残影常驻。词落位 = wa(id,f)。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {AblationSplit, LoopRing, MODEL_CALL_ARC, SegArc, SvcCard, ToolPool} from '../components/motifs';
import {clamp01, progress} from '../motion';
import {ease} from '../components/motifs';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 3-A 环体主场一拍：重灌循环 + 缓存快照卡 + 新服务剪影 ────────────────────────

/** 3-A 布局（安全带实算见头注；环体中心 (690,370)、调模型段弧 -54..18 右上） */
const CA = {
  ring: {x: 460, y: 140, size: 460},
  pool: {x: 940, y: 340, w: 480, h: 240},
  snap: {x: 990, y: 640, w: 380, h: 190},
  ghost: {x: 1520, y: 330, w: 300, h: 230},
} as const;

/** 缓存快照卡（贴池沿——正面「缓存」标签+旧清单两枚小图；翻面显提示词存档
 *  小图+「省钱提速」小签；燃尽位由 3-C 复用同款形） */
const SnapCard: React.FC<{x: number; y: number; w: number; h: number; litP: number; flipP: number; lagP?: number; zoomP?: number; burnP?: number; hotP?: number}> = ({
  x,
  y,
  w,
  h,
  litP,
  flipP,
  lagP = 0,
  zoomP = 0,
  burnP = 0,
  hotP = 0,
}) => {
  const lit = clamp01(litP);
  const flip = clamp01(flipP);
  const lag = clamp01(lagP);
  const zoom = clamp01(zoomP);
  const burn = clamp01(burnP);
  const hot = clamp01(hotP);
  return (
    <div
      style={{
        position: 'absolute',
        left: x - zoom * 26 + lag * 34,
        top: y - zoom * 14 + lag * 18,
        width: w + zoom * 52,
        height: h + zoom * 28,
        opacity: lit * (1 - burn * 0.92),
        transform: `scale(${1 + zoom * 0.08})`,
        filter: burn > 0.05 ? `brightness(${1 - burn * 0.5}) blur(${burn * 1.6}px)` : undefined,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          border: `3.5px solid ${withAlpha(hot > 0.3 ? theme.danger : theme.dim, 0.5 + 0.5 * Math.max(lit, hot))}`,
          background: withAlpha(theme.panel, 0.97),
          boxShadow: hot > 0.1 ? `0 0 ${30 * hot}px ${withAlpha(theme.danger, 0.5 * hot)}` : 'none',
          overflow: 'hidden',
        }}
      >
        {/* 「缓存」标签（快照命名——固定 vs 动态的对照物） */}
        <div style={{position: 'absolute', left: 18, top: 12, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>
          缓存 · 上一轮快照
        </div>
        {/* 正面：旧清单两枚小图（停在旧清单——不自动更新是机制陈述） */}
        <div style={{position: 'absolute', inset: 0, opacity: 1 - flip, backfaceVisibility: 'hidden'}}>
          {['查状态', '触发部署'].map((n, i) => (
            <div
              key={`sn${i}`}
              style={{
                position: 'absolute',
                left: 18,
                top: 52 + i * 52,
                width: w - 36,
                height: 44,
                borderRadius: 8,
                border: `2.5px solid ${withAlpha(theme.dim, 0.5)}`,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 12,
                fontFamily: theme.sans,
                fontSize: 16,
                fontWeight: 700,
                color: theme.dim,
                whiteSpace: 'nowrap',
              }}
            >
              {n}
            </div>
          ))}
          <div style={{position: 'absolute', right: 14, top: 52, fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.8}}>
            prompt cache
          </div>
        </div>
        {/* 背面：提示词存档小图 + 「省钱提速」小签（白话先释的视觉对位） */}
        <div style={{position: 'absolute', inset: 0, opacity: flip, transform: `rotateY(${(1 - flip) * 180}deg)`, backfaceVisibility: 'hidden'}}>
          {[0, 1, 2].map((r) => (
            <div key={`pl${r}`} style={{position: 'absolute', left: 18, top: 50 + r * 30, width: (w - 60) * (1 - r * 0.18), height: 12, borderRadius: 4, background: withAlpha(theme.dim, 0.3)}} />
          ))}
          <div
            style={{
              position: 'absolute',
              right: 16,
              bottom: 14,
              padding: '3px 12px',
              borderRadius: 7,
              border: `2.5px solid ${withAlpha(theme.dim, 0.7)}`,
              fontFamily: theme.sans,
              fontSize: 14,
              fontWeight: 700,
              color: theme.dim,
              whiteSpace: 'nowrap',
            }}
          >
            省钱提速
          </div>
          <div style={{position: 'absolute', left: 18, bottom: 14, fontFamily: theme.sans, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85}}>
            存的是上一轮提示词
          </div>
        </div>
      </div>
      {/* 燃尽碳化飘散（边缘碳化 + 灰烬片——作废即焚；无残影常驻） */}
      {burn > 0.05
        ? [0, 1, 2, 3, 4].map((k) => (
            <span
              key={`ash${k}`}
              style={{
                position: 'absolute',
                left: 30 + k * 74,
                top: -burn * (60 + k * 26),
                width: 10 + (k % 3) * 6,
                height: 10 + (k % 2) * 8,
                borderRadius: '50%',
                background: withAlpha(theme.dim, 0.5),
                opacity: burn * (1 - burn) * 2,
                transform: `translateX(${Math.sin(k * 2.1 + burn * 6) * 26 * burn}px) rotate(${burn * 120 * (k % 2 === 0 ? 1 : -1)}deg)`,
              }}
            />
          ))
        : null}
    </div>
  );
};

const ThreeA: React.FC<{atClear: number; atInject: number; atMismatch: number; atConnect: number; atBright: number; atLag: number; atFlip: number; atContrast: number}> = ({
  atClear,
  atInject,
  atMismatch,
  atConnect,
  atBright,
  atLag,
  atFlip,
  atContrast,
}) => {
  const frame = useCurrentFrame();
  // morph settle（池升位——首 12 帧自 +80y 落定）
  const settle = ease(clamp01(progress(frame, 0, 12)));
  // 一轮重灌循环：清空（卡片淡出+水位降）→ 注入（新卡落+水位升）——两拍明确可辨
  const clear = clamp01(progress(frame, atClear, 12));
  const inject = clamp01(progress(frame, atInject, 16));
  const cardsLit = clear < 0.5 ? 1 : inject;
  // 快照卡与池内清单错位一闪（固定 vs 动态）
  const mismatch = Math.sin(Math.PI * clamp01(progress(frame, atMismatch, 16)));
  // 泛指服务剪影卡接入 + 池面增亮
  const connect = clamp01(progress(frame, atConnect, 14));
  const bright = Math.sin(Math.PI * clamp01(progress(frame, atBright, 14)));
  // 快照卡滞后半拍跟动（跟不上）
  const lag = clamp01(progress(frame, atLag, 18));
  // 快照翻面 + 新旧同帧对照（重音镜）
  const flip = clamp01(progress(frame, atFlip, 16));
  const contrast = Math.sin(Math.PI * clamp01(progress(frame, atContrast, 18)));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: `translateY(${(1 - settle) * 80}px)`}}>
        {/* 陶土橙环体（居中主体位——调模型段高亮与 1-E/2-A 同位同色） */}
        <div style={{position: 'absolute', left: CA.ring.x, top: CA.ring.y}}>
          <LoopRing size={CA.ring.size} nodes={[]} showExit={false} />
          <SegArc size={CA.ring.size} from={MODEL_CALL_ARC.a0} to={MODEL_CALL_ARC.a1} litP={1} />
          <div
            style={{
              position: 'absolute',
              left: CA.ring.size / 2 + 152,
              top: CA.ring.size / 2 - 104,
              padding: '3px 12px',
              borderRadius: 8,
              border: `2.5px solid ${withAlpha(theme.core, 0.7)}`,
              fontFamily: theme.sans,
              fontSize: 16,
              fontWeight: 700,
              color: theme.core,
              whiteSpace: 'nowrap',
            }}
          >
            调模型
          </div>
        </div>
        {/* 深空蓝池（挂环上调模型段前置位——承 2-C 池同内容；重灌循环） */}
        <ToolPool
          x={CA.pool.x}
          y={CA.pool.y}
          w={CA.pool.w}
          h={CA.pool.h}
          litP={1}
          fillP={1}
          clearP={clear * (1 - inject)}
          labelP={1}
          capTag="每轮重组"
          capP={1}
          cards={[
            {name: '内置 ×5', litP: cardsLit},
            {name: '查状态', litP: cardsLit},
            {name: '触发部署', litP: cardsLit},
            {name: connect > 0.6 ? '搜文档' : '新工具', litP: connect > 0.6 ? inject : 0},
          ]}
        />
        {/* 池面增亮一拍（连上新服务） */}
        {bright > 0.05 ? (
          <div
            style={{
              position: 'absolute',
              left: CA.pool.x - 6,
              top: CA.pool.y - 6,
              width: CA.pool.w + 12,
              height: CA.pool.h + 12,
              borderRadius: 28,
              border: `3px solid ${withAlpha(theme.pool, 0.65 * bright)}`,
              boxShadow: `0 0 ${28 * bright}px ${withAlpha(theme.pool, 0.45 * bright)}`,
              pointerEvents: 'none',
            }}
          />
        ) : null}
        {/* 错位一闪高亮（固定 vs 动态——快照与池内清单互闪） */}
        {mismatch > 0.05 ? (
          <div
            style={{
              position: 'absolute',
              left: CA.snap.x - 8,
              top: CA.snap.y - 8,
              width: CA.snap.w + 16,
              height: CA.snap.h + 16,
              borderRadius: 16,
              border: `3px dashed ${withAlpha(theme.danger, 0.7 * mismatch)}`,
              pointerEvents: 'none',
            }}
          />
        ) : null}
        {/* 缓存快照卡（贴池沿——旧清单 / 翻面 / 滞后 / 对照四态） */}
        <SnapCard x={CA.snap.x} y={CA.snap.y} w={CA.snap.w} h={CA.snap.h} litP={1} flipP={flip} lagP={lag * 0.5} hotP={contrast * 0.7} />
        {/* 新旧同帧对照连线（还是旧的——重音镜：池内新 vs 快照旧一眼可辨） */}
        {contrast > 0.05 ? (
          <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
            <line x1={CA.pool.x + 80} y1={CA.pool.y + CA.pool.h} x2={CA.snap.x + CA.snap.w} y2={CA.snap.y + 30} stroke={theme.danger} strokeWidth={4} strokeDasharray="10 8" opacity={0.7 * contrast} />
          </svg>
        ) : null}
        {/* 泛指新服务剪影卡（不显名——虚线轮廓；接入通道） */}
        <div style={{position: 'absolute', left: CA.ghost.x, top: CA.ghost.y, opacity: 0.5 + 0.5 * connect}}>
          <SvcCard x={0} y={0} w={CA.ghost.w} h={CA.ghost.h} title="新服务" tag="…" ghost litP={1} />
        </div>
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <line
            x1={CA.ghost.x}
            y1={450}
            x2={CA.pool.x + CA.pool.w}
            y2={450}
            stroke={theme.svc}
            strokeWidth={4}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - connect}
            opacity={0.8}
          />
        </svg>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'池每轮清空重灌 · 快照停在旧清单'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-B 左红右绿消融同屏（E5 实测——全片张力峰值） ─────────────────────────────

/** 3-B 布局（安全带实算：轨底 150+690=840；轨内纵栈 205..835 全部在轨内）。
 *  两轨共享同一次连接（控制变量可视）：docs 服务卡 + 清单回传带同款同位；
 *  唯一差异 = 重建与否。名单/清单条目全名只进角标（mono 小字）。 */
const CB = {
  lane: {
    L: {x: 110, w: 800},
    R: {x: 1010, w: 800},
  },
  svcY: 215,
  poolY: 420,
  callX: {L: 520, R: 1420},
  stripY: 455,
  countsY: 620,
  assertY: 688,
  bandY: 762,
} as const;
/** 调用全名卡（两轨同款同位——控制变量） */
const CALL_TEXT = 'mcp__docs__search';

const ThreeB: React.FC<{atLanes: number; atConnect: number; atBand: number; atFly: number; atBounce: number; atErr: number; atLamp: number; atZoom: number; atRebuild: number; atLand: number; atResult: number; atAssert: number}> = ({
  atLanes,
  atConnect,
  atBand,
  atFly,
  atBounce,
  atErr,
  atLamp,
  atZoom,
  atRebuild,
  atLand,
  atResult,
  atAssert,
}) => {
  const frame = useCurrentFrame();
  // 双轨立起 + docs 服务连接（两轨共享同一次连接）+ 清单回传带
  const rise = clamp01(progress(frame, atLanes, 14));
  const connect = clamp01(progress(frame, atConnect, 14));
  const band = clamp01(progress(frame, atBand, 16));
  // 左轨演示：全名卡飞向旧池 → 弹回 + Unknown tool 回执条 + 成功 0 定格
  const fly = clamp01(progress(frame, atFly, 12));
  const bounce = clamp01(progress(frame, atBounce, 12));
  const bounceFlash = Math.sin(Math.PI * clamp01(progress(frame, atBounce + 4, 14)));
  const err = clamp01(progress(frame, atErr, 10));
  // 左轨连接灯亮（连接是好的）+ 快照放大（病灶定位——张力峰值 punch）
  const lamp = clamp01(progress(frame, atLamp, 10));
  const zoom = clamp01(progress(frame, atZoom, 14));
  const zoomHot = Math.sin(Math.PI * clamp01(progress(frame, atZoom + 6, 20)));
  // 右轨演示：池重灌 → 新四卡 → 同一全名卡落进服务卡 → 结果条回流 + 成功 1
  const rebuild = clamp01(progress(frame, atRebuild, 16));
  const land = clamp01(progress(frame, atLand, 16));
  const result = clamp01(progress(frame, atResult, 16));
  // 双断言签并列定格 + 双计数对照（基线锚定）
  const assert = clamp01(progress(frame, atAssert, 14));
  // 计数离散发值（与实测一致——禁连续插值）
  const lOk = 0;
  const rRebuild = frame >= atRebuild ? 1 : 0;
  const rCall = frame >= atLand ? 1 : 0;
  const rOk = frame >= atResult + 8 ? 1 : 0;
  // 左轨调用卡飞向旧池的轨迹（飞抵 → 弹回）
  const flyX = CB.callX.L + fly * 40;
  const flyY = 240 + fly * 100;
  const bX = flyX - bounce * 120;
  const bY = flyY - bounce * 80;
  return (
    <AbsoluteFill>
      {/* 双轨背板（左红右绿恒定） */}
      <AblationSplit litP={rise} leftP={rise} rightP={rise} leftTitle="沿用旧池" leftSub="不重建 · 直接调" rightTitle="重建后" rightSub="重灌 · 再调一次" />
      {/* ── 左轨（红）── */}
      <div style={{position: 'absolute', left: CB.lane.L.x, top: 0, width: CB.lane.L.w, opacity: rise}}>
        {/* docs 服务卡（连接灯后亮——连接是好的） */}
        <SvcCard x={30} y={CB.svcY} w={280} h={170} title="文档服务" tag="docs" litP={1} lampP={lamp} />
        {/* 旧池（两枚旧卡——旧清单里没有新工具） */}
        <ToolPool
          x={30}
          y={CB.poolY}
          w={280}
          h={170}
          litP={1}
          fillP={1}
          labelP={0}
          cards={[
            {name: '查状态', litP: 1},
            {name: '触发部署', litP: 1},
          ]}
        />
        {/* 调用全名卡（飞向旧池 → 弹回——有轨迹） */}
        <div
          style={{
            position: 'absolute',
            left: bX,
            top: bY,
            padding: '8px 18px',
            borderRadius: 9,
            border: `3px solid ${bounceFlash > 0.1 ? theme.danger : theme.dim}`,
            background: withAlpha(theme.panel, 0.98),
            fontFamily: theme.mono,
            fontSize: 15,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: fly > 0.02 ? 1 - Math.max(0, bounce - 0.9) * 8 : 0,
            transform: `rotate(${bounce * -8}deg)`,
            boxShadow: bounceFlash > 0.1 ? `0 0 ${22 * bounceFlash}px ${withAlpha(theme.danger, 0.6 * bounceFlash)}` : 'none',
          }}
        >
          {CALL_TEXT}
        </div>
        {/* Unknown tool 回执条（实测原串——警示红） */}
        {err > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: CB.callX.L - CB.lane.L.x - 10,
              top: CB.stripY,
              padding: '8px 16px',
              borderRadius: 9,
              border: `3px solid ${theme.danger}`,
              background: withAlpha(theme.danger, 0.12),
              fontFamily: theme.mono,
              fontSize: 14,
              fontWeight: 700,
              color: theme.danger,
              whiteSpace: 'nowrap',
              opacity: err,
              transform: `translateY(${(1 - err) * 14}px)`,
            }}
          >
            Unknown tool: {CALL_TEXT}
          </div>
        ) : null}
        {/* 病灶定位：快照卡自池沿放大一拍（连接绿灯 vs 旧缓存同帧对照——峰值 punch） */}
        {zoom > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: 360 - zoom * 40,
              top: CB.poolY + 180 - zoom * 30,
              width: 240 + zoom * 90,
              opacity: zoom,
              transform: `scale(${1 + 0.16 * zoomHot})`,
            }}
          >
            <div
              style={{
                padding: '12px 18px',
                borderRadius: 12,
                border: `3.5px solid ${withAlpha(theme.danger, 0.55 + 0.45 * zoom)}`,
                background: withAlpha(theme.panel, 0.98),
                boxShadow: `0 0 ${26 * zoomHot}px ${withAlpha(theme.danger, 0.5 * zoomHot)}`,
              }}
            >
              <div style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap'}}>卡住的是旧缓存</div>
              <div style={{marginTop: 8, display: 'flex', gap: 8}}>
                {['查状态', '触发部署'].map((n) => (
                  <span key={`zs${n}`} style={{padding: '3px 10px', borderRadius: 6, border: `2px solid ${withAlpha(theme.dim, 0.5)}`, fontFamily: theme.sans, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>
                    {n}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {/* 左轨计数（调用 1 · 成功 0——离散） */}
        <div style={{position: 'absolute', left: 40, top: CB.countsY, display: 'flex', gap: 34, opacity: rise}}>
          {[
            {label: '调用', v: frame >= atFly ? 1 : 0},
            {label: '成功', v: lOk},
          ].map((c) => (
            <div key={`lc${c.label}`} style={{minWidth: 88}}>
              <div style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>{c.label}</div>
              <div style={{fontFamily: theme.mono, fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: c.v > 0 ? theme.danger : theme.dim, whiteSpace: 'nowrap'}}>{c.v}</div>
            </div>
          ))}
        </div>
        {/* 断言签（不重建 · 调不到） */}
        {assert > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: 60,
              top: CB.assertY,
              padding: '9px 24px',
              borderRadius: 10,
              border: `3px solid ${theme.danger}`,
              background: withAlpha(theme.danger, 0.12),
              fontFamily: theme.sans,
              fontSize: 21,
              fontWeight: 700,
              color: theme.danger,
              whiteSpace: 'nowrap',
              opacity: assert,
              transform: `translateY(${(1 - assert) * 16}px)`,
            }}
          >
            不重建 · 调不到
          </div>
        ) : null}
        {/* 清单回传带（两轨同款——共享同一次连接） */}
        <div style={{position: 'absolute', left: 40, top: CB.bandY, display: 'flex', gap: 16, opacity: band}}>
          {[
            {name: '搜文档', tag: 'mcp__docs__search'},
            {name: '查版本', tag: 'get_version'},
          ].map((t) => (
            <div
              key={`lb${t.name}`}
              style={{
                width: 300,
                padding: '10px 16px',
                borderRadius: 10,
                border: `2.5px solid ${withAlpha(theme.svc, 0.4 + 0.5 * band)}`,
                background: withAlpha(theme.panel, 0.97),
              }}
            >
              <div style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{t.name}</div>
              <div style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap', marginTop: 4}}>{t.tag}</div>
            </div>
          ))}
        </div>
      </div>
      {/* ── 右轨（绿）── */}
      <div style={{position: 'absolute', left: CB.lane.R.x, top: 0, width: CB.lane.R.w, opacity: rise}}>
        {/* docs 服务卡（同款同位——控制变量） */}
        <SvcCard x={30} y={CB.svcY} w={280} h={170} title="文档服务" tag="docs" litP={1} lampP={connect} flashP={result > 0.5 ? Math.sin(Math.PI * clamp01(progress(frame, atResult + 10, 14))) * 0.6 : 0} />
        {/* 重灌池（新四卡——旧两件 + 新两件） */}
        <ToolPool
          x={30}
          y={CB.poolY}
          w={280}
          h={170}
          litP={1}
          fillP={rebuild}
          labelP={0}
          cards={[
            {name: '查状态', litP: 1},
            {name: '触发部署', litP: 1},
            {name: '搜文档', litP: rebuild},
            {name: '查版本', litP: rebuild},
          ]}
        />
        {/* 同一全名卡（落进 docs 服务卡——轨迹：调用位 → 服务卡） */}
        <div
          style={{
            position: 'absolute',
            left: CB.callX.R - CB.lane.R.x + land * 40,
            top: 240 + land * 60,
            padding: '8px 18px',
            borderRadius: 9,
            border: `3px solid ${theme.ok}`,
            background: withAlpha(theme.panel, 0.98),
            fontFamily: theme.mono,
            fontSize: 15,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: rebuild > 0.5 ? land : 0,
          }}
        >
          {CALL_TEXT}
        </div>
        {/* 结果回流条（确认绿——实测原串 results for loop） */}
        {result > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: CB.callX.R - CB.lane.R.x - 10,
              top: CB.stripY,
              padding: '8px 16px',
              borderRadius: 9,
              border: `3px solid ${theme.ok}`,
              background: withAlpha(theme.ok, 0.12),
              fontFamily: theme.mono,
              fontSize: 14,
              fontWeight: 700,
              color: theme.ok,
              whiteSpace: 'nowrap',
              opacity: result,
              transform: `translateY(${(1 - result) * 14}px)`,
            }}
          >
            results for loop
          </div>
        ) : null}
        {/* 右轨计数（重建 1 · 调用 1 · 成功 1——离散跳格） */}
        <div style={{position: 'absolute', left: 40, top: CB.countsY, display: 'flex', gap: 30, opacity: rise}}>
          {[
            {label: '重建', v: rRebuild},
            {label: '调用', v: rCall},
            {label: '成功', v: rOk},
          ].map((c) => (
            <div key={`rc${c.label}`} style={{minWidth: 84}}>
              <div style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>{c.label}</div>
              <div style={{fontFamily: theme.mono, fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: c.v > 0 ? theme.ok : theme.dim, whiteSpace: 'nowrap'}}>{c.v}</div>
            </div>
          ))}
        </div>
        {/* 断言签（重建 · 立刻恢复） */}
        {assert > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: 60,
              top: CB.assertY,
              padding: '9px 24px',
              borderRadius: 10,
              border: `3px solid ${theme.ok}`,
              background: withAlpha(theme.ok, 0.12),
              fontFamily: theme.sans,
              fontSize: 21,
              fontWeight: 700,
              color: theme.ok,
              whiteSpace: 'nowrap',
              opacity: assert,
              transform: `translateY(${(1 - assert) * 16}px)`,
            }}
          >
            重建 · 立刻恢复
          </div>
        ) : null}
        {/* 清单回传带（同款——共享同一次连接） */}
        <div style={{position: 'absolute', left: 40, top: CB.bandY, display: 'flex', gap: 16, opacity: band}}>
          {[
            {name: '搜文档', tag: 'mcp__docs__search'},
            {name: '查版本', tag: 'get_version'},
          ].map((t) => (
            <div
              key={`rb${t.name}`}
              style={{
                width: 300,
                padding: '10px 16px',
                borderRadius: 10,
                border: `2.5px solid ${withAlpha(theme.svc, 0.4 + 0.5 * band)}`,
                background: withAlpha(theme.panel, 0.97),
              }}
            >
              <div style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{t.name}</div>
              <div style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap', marginTop: 4}}>{t.tag}</div>
            </div>
          ))}
        </div>
      </div>
      {/* 连接线（服务卡 ↔ 池——两轨共享同一次连接的可视） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        {[CB.lane.L, CB.lane.R].map((ln, i) => (
          <line
            key={`cn${i}`}
            x1={ln.x + 170}
            y1={CB.svcY + 170}
            x2={ln.x + 170}
            y2={CB.poolY}
            stroke={theme.svc}
            strokeWidth={4}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - connect}
            opacity={0.75}
          />
        ))}
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'同一次连接 · 左沿用旧池调不到 · 右重建后立刻恢复'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C 金句卡预亮 + 「干脆不缓存」选项牌 + 旧缓存燃尽 ───────────────────────────

/** 3-C 布局（安全带实算：金句卡 240+150=390 / 选项牌 470+260=730 / 燃尽位
 *  470+220=690，恒 ≤ 860） */
const CC = {
  quote: {x: 610, y: 240, w: 700, h: 150},
  option: {x: 1290, y: 470, w: 440, h: 260},
  burn: {x: 330, y: 470, w: 380, h: 220},
} as const;

const ThreeC: React.FC<{atOption: number; atCycle: number; atGold: number; atBurn: number}> = ({atOption, atCycle, atGold, atBurn}) => {
  const frame = useCurrentFrame();
  // 选项牌亮出（干脆不缓存——牌内小池每轮现拼微图）
  const option = clamp01(progress(frame, atOption, 14));
  // 牌内小池每轮重拼微循环一拍（无缓存路线）
  const cycle = clamp01(progress(frame, atCycle, 24));
  const miniClear = cycle < 0.5 ? cycle * 2 : 0;
  const miniInject = cycle >= 0.4 ? (cycle - 0.4) / 0.6 : 0;
  // 金句卡淡入定格（衬线体——重音镜）
  const gold = clamp01(progress(frame, atGold, 16));
  // 旧缓存卡燃尽（失效的具象——作废即焚）
  const burn = clamp01(progress(frame, atBurn, 24));
  const burnGlow = Math.sin(Math.PI * clamp01(progress(frame, atBurn + 4, 20)));
  return (
    <AbsoluteFill>
      {/* 金句卡（衬线体唯一主体——卡文与口播非逐字，关键词压缩复述） */}
      {gold > 0.02 ? (
        <div style={{position: 'absolute', left: CC.quote.x, top: CC.quote.y, width: CC.quote.w, opacity: gold, transform: `translateY(${(1 - gold) * 18}px)`, zIndex: 3}}>
          <div
            style={{
              padding: '30px 52px',
              borderRadius: 16,
              border: `3px solid ${withAlpha(theme.core, 0.55)}`,
              background: withAlpha(theme.panel, 0.97),
              textAlign: 'center',
            }}
          >
            <span style={{fontFamily: theme.serif, fontSize: 42, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>池一变，缓存作废</span>
          </div>
        </div>
      ) : null}
      {/* 选项牌（干脆不缓存——牌内小池每轮现拼微图；角标 prompt cache） */}
      {option > 0.02 ? (
        <div style={{position: 'absolute', left: CC.option.x, top: CC.option.y, width: CC.option.w, opacity: option, transform: `translateY(${(1 - option) * 20}px)`}}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 14,
              border: `3.5px dashed ${withAlpha(theme.dim, 0.55 + 0.3 * option)}`,
              background: withAlpha(theme.panel, 0.96),
              padding: '18px 24px',
            }}
          >
            <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between'}}>
              <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>干脆不缓存</span>
              <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>prompt cache · 无</span>
            </div>
            {/* 牌内小池（每轮现拼微图——清/注微循环） */}
            <div style={{position: 'absolute', left: 24, top: 74, width: 392, height: 120, borderRadius: 12, border: `3px solid ${withAlpha(theme.pool, 0.7)}`, background: withAlpha(theme.pool, 0.08), overflow: 'hidden'}}>
              <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: `${Math.round((miniInject * (1 - miniClear * 0.9) + 0.15) * 100)}%`, background: withAlpha(theme.pool, 0.28), borderTop: `2.5px solid ${withAlpha(theme.pool, 0.6)}`}} />
              <div style={{position: 'absolute', left: 0, right: 0, top: 8, textAlign: 'center', fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap', opacity: cycle > 0.05 ? 1 : 0.5}}>
                每轮现拼
              </div>
            </div>
            <div style={{position: 'absolute', left: 24, bottom: 12, fontFamily: theme.sans, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85}}>
              一了百了
            </div>
          </div>
        </div>
      ) : null}
      {/* 旧缓存卡燃尽位（3-A 快照同款形——作废即焚，无残影常驻） */}
      <SnapCard x={CC.burn.x} y={CC.burn.y} w={CC.burn.w} h={CC.burn.h} litP={1} flipP={1} burnP={burn} />
      {/* 燃尽橙光缘（边缘碳化的火线——有过程） */}
      {burnGlow > 0.05 ? (
        <div
          style={{
            position: 'absolute',
            left: CC.burn.x - 10,
            top: CC.burn.y - 10,
            width: CC.burn.w + 20,
            height: CC.burn.h + 20,
            borderRadius: 18,
            border: `3px solid ${withAlpha(theme.core, 0.6 * burnGlow)}`,
            boxShadow: `0 0 ${30 * burnGlow}px ${withAlpha(theme.core, 0.5 * burnGlow)}`,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'缓存随池失效 · 或者干脆不缓存'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P3LivingPool: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p3-01', 'p3-03');
  const bB = w('p3-04', 'p3-08');
  const bC = w('p3-09', 'p3-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <ThreeA
          atClear={wa('p3-01', 0.16) - bA.from}
          atInject={wa('p3-01', 0.36) - bA.from}
          atMismatch={wa('p3-01', 0.74) - bA.from}
          atConnect={wa('p3-02', 0.1) - bA.from}
          atBright={wa('p3-02', 0.3) - bA.from}
          atLag={wa('p3-02', 0.82) - bA.from}
          atFlip={wa('p3-03', 0.18) - bA.from}
          atContrast={wa('p3-03', 0.88) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="3-B">
        <ThreeB
          atLanes={wa('p3-04', 0.08) - bB.from}
          atConnect={wa('p3-04', 0.24) - bB.from}
          atBand={wa('p3-04', 0.5) - bB.from}
          atFly={wa('p3-05', 0.2) - bB.from}
          atBounce={wa('p3-05', 0.55) - bB.from}
          atErr={wa('p3-05', 0.68) - bB.from}
          atLamp={wa('p3-06', 0.38) - bB.from}
          atZoom={wa('p3-06', 0.8) - bB.from}
          atRebuild={wa('p3-07', 0.1) - bB.from}
          atLand={wa('p3-07', 0.42) - bB.from}
          atResult={wa('p3-07', 0.66) - bB.from}
          atAssert={wa('p3-08', 0.28) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="3-C">
        <ThreeC
          atOption={wa('p3-09', 0.25) - bC.from}
          atCycle={wa('p3-09', 0.55) - bC.from}
          atGold={wa('p3-10', 0.1) - bC.from}
          atBurn={wa('p3-10', 0.78) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3LivingPool;
