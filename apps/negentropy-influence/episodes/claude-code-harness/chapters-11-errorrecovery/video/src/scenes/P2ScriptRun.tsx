/** P2 实测走查（p2-01..p2-07，3 镜）——分镜 2-A / 2-B / 2-C。
 *
 *  叙事链：2-A 走查舞台全景（Animated Worked Example）：双轨并置——左消息流
 *  轨三红帧按剧本逐词入列（过载·过载·限流）＋第四请求帧，右等待曲线轨承 1-E
 *  同形缩微、实测节点 0.58s→1.01s→2.14s 逐级点亮 → p2-03 虚拟时钟计到 3.7s、
 *  第四帧放行（唯一确认绿）、环体缩悬位解冻复转一小段（循环没断的证据位），
 *  模型签保持原样一拍 → 2-B 变奏一特写（单句镜）：剧本签翻换「过载·过载·
 *  过载」（状态揭示随事件拍交叉切换）、计数 1/3→2/3→3/3 点满瞬间切换帧自
 *  「瞬态」行滑出、备用模型卡滑入接棒（1-E 待命位伏笔回收同形）、原模型签退
 *  半格备用签就位、环体继续转动——1–2s punch 定格 → 2-C 两组变奏快切并列
 *  （环体缩悬顶角缓转、分类表缩微驻右上承 2-B——画廊定格镜锚件不抢焦，G1①）：
 *  左位九条收六条＋计数器 9→6＋0.0s 恢复钟闪绿，右位额度卡翻牌复演＋三枚
 *  续写块接力 3/3，底部四格剧本画廊依次点亮全绿定格（重音镜）→「真缺不得吗」
 *  画廊整体降饱和悬置一拍。
 *
 *  空间契约：三红帧与曲线三级一一对应可追、节点数字 0.58s/1.01s/2.14s 与角标
 *    一致（禁四舍五入失真）、第四次放行为唯一确认绿、等待期间环体不转动、
 *    计数 3/3 与切换触发同帧、备用卡与 1-E 待命位同形、左右演示位复用 1-B/1-C
 *    同款组件（同形不新建）、画廊四格与四剧本一一对应全绿（禁非绿格）、
 *    计数双口径 9→6 与 keep_tail=5 并存（gl-notes B.2 实测构成：头部三条淡出、
 *    尾部五条保留——禁暗示 9−5 的错误算术）。
 *
 *  红线落实：词落位 = wa(id,f)（manifest 已就位；⑧ 轮已按句内字位复核一轮微调，词级实测复核留 ⑨ 轮 QA）；
 *    y≥56 / bottom≥176；script=('529','529','429') / script=('529','529','529') ·
 *    clock_s=3.7 · model-backup · clock_s=4.1 · messages 9→6 · 8000→64000 ·
 *    continuation 3/3 只进角标。
 *
 *  morph 登记（QA 教训 28 口径）：1-E→2-A 等待曲线主路径——BackoffCurve 同
 *  组件 w/h 缩放位移（840×560→640×420），阶梯/封顶/细齿形状逐帧不变；分类表
 *  缩微位（1600,70）与 1-E 逐像素一致；2-B→2-C 承（锚件同位）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  BackoffCurve,
  BackupCard,
  BudgetRuler,
  LoopRing,
  MessageStack,
  MiniTable,
  RingShell,
  RoutingTable,
  TokenBudgetCard,
  mixHex,
} from '../components/motifs';
import {DUR, clamp01, progress, useCount} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 环体缩悬顶角位（2-A/2-B/2-C + 3-A 跨镜锚件——「调用」段壳微光在位） */
export const RING_TL = {x: 84, y: 76, size: 140} as const;

/** 缩悬环体（等待=停转、成功复转——循环存亡的证据位；`spinP` 0..1 复转进度、
 *  `dot0` 冻结相位；灰态态见 P3 自绘） */
const CornerRing: React.FC<{frozen: boolean; spinAt?: number; dim?: number}> = ({frozen, spinAt, dim = 0.92}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const lap = fps * 2.5;
  const dot = frozen ? 0.35 : 0.35 + Math.max(0, frame - (spinAt ?? 0)) / lap;
  const cx = RING_TL.size / 2;
  const r = RING_TL.size / 2 - 46;
  return (
    <div style={{position: 'absolute', left: RING_TL.x, top: RING_TL.y, opacity: dim}}>
      <LoopRing size={RING_TL.size} nodes={[]} showExit={false} dotProgress={dot % 1} />
      <svg width={RING_TL.size} height={RING_TL.size} viewBox={`0 0 ${RING_TL.size} ${RING_TL.size}`} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        {/* 「调用」段壳微光在位（缩悬态——细线小壳） */}
        <RingShell cx={cx} cy={cx} r={r} growP={1} glowP={0.4} mini />
      </svg>
    </div>
  );
};

/** 剧本签（挂舞台顶——枚举词与角标同源；`swapped` 随 2-B 翻换交叉淡切） */
const ScriptTag: React.FC<{lit: number; swapped: number; y?: number}> = ({lit, swapped, y = 88}) => {
  const s1 = clamp01(lit) * (1 - clamp01(swapped));
  const s2 = clamp01(swapped);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center'}}>
      <div style={{position: 'relative'}}>
        <div
          style={{
            padding: '8px 30px',
            borderRadius: 11,
            border: `2.5px solid ${withAlpha(theme.tool, 0.8)}`,
            background: theme.panel,
            fontFamily: theme.mono,
            fontSize: 21,
            fontWeight: 700,
            color: theme.text,
            letterSpacing: 2,
            whiteSpace: 'nowrap',
            opacity: s1,
          }}
        >
          {'剧本 · 过载 · 过载 · 限流'}
        </div>
        {/* 翻换签（QA 31：状态揭示随事件拍交叉切换，不常驻剧透） */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            padding: '8px 30px',
            borderRadius: 11,
            border: `2.5px solid ${withAlpha(theme.danger, 0.8)}`,
            background: theme.panel,
            fontFamily: theme.mono,
            fontSize: 21,
            fontWeight: 700,
            color: theme.text,
            letterSpacing: 2,
            whiteSpace: 'nowrap',
            opacity: s2,
            transform: `translateY(${(1 - s2) * -10}px)`,
          }}
        >
          {'剧本 · 过载 · 过载 · 过载'}
        </div>
      </div>
    </div>
  );
};

// ── 2-A 走查舞台：双轨并置 + 实测节点逐级点亮 + 第四次放行 ─────────────────

/** 消息流轨（左）——请求帧竖列 */
const FRAMES_2A = {x: 300, y: 220, w: 320, h: 88, gap: 26} as const;
const CURVE_2A = {x: 880, y: 200, w: 640, h: 430} as const;

const TwoA: React.FC<{
  atScript: number;
  atF: number[];
  atN: number[];
  atClock: number;
  atFourth: number;
  atSpin: number;
}> = ({atScript, atF, atN, atClock, atFourth, atSpin}) => {
  const frame = useCurrentFrame();
  const script = clamp01(progress(frame, atScript, DUR.f5));
  // 三红帧逐枚按词序入列（枚举词逐帧点火）
  const fIn = atF.map((a) => clamp01(progress(frame, a, DUR.f4)));
  // 曲线三级节点点亮（实测值 0.58/1.01/2.14——markP 连续累进）
  const markP = atN.reduce((acc, a) => acc + clamp01(progress(frame, a, 18)), 0);
  // 虚拟时钟计到 3.7s（数据本体——useCount 线性值，显示层 toFixed(1)）
  const clock = useCount({from: 0, to: 3.7, at: atClock, dur: 40, ease: 'standard'});
  // 第四请求帧放行（唯一确认绿）+ 环体复转
  const fourth = clamp01(progress(frame, atFourth, DUR.f4));
  const greenFlash = Math.sin(Math.PI * clamp01(progress(frame, atFourth + 4, 20)));
  return (
    <AbsoluteFill>
      <ScriptTag lit={script} swapped={0} />
      {/* 左：消息流轨（三红帧 + 第四帧——模型签驻轨侧） */}
      <div style={{position: 'absolute', left: FRAMES_2A.x - 60, top: FRAMES_2A.y - 46, fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap'}}>{'消息流'}</div>
      {[0, 1, 2, 3].map((i) => {
        const isIn = i < 3 ? fIn[i] : fourth;
        const err = i < 3;
        const labels = ['过载', '过载', '限流'];
        const edge = i === 3 ? mixHex(theme.panelBorder, theme.ok, fourth) : err ? theme.danger : theme.panelBorder;
        return isIn > 0.02 ? (
          <div
            key={`fr${i}`}
            style={{
              position: 'absolute',
              left: FRAMES_2A.x,
              top: FRAMES_2A.y + i * (FRAMES_2A.h + FRAMES_2A.gap),
              width: FRAMES_2A.w,
              height: FRAMES_2A.h,
              borderRadius: 10,
              border: `3px solid ${edge}`,
              background: withAlpha(theme.panel, 0.95),
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '0 18px',
              opacity: isIn,
              transform: `translateY(${(1 - isIn) * -18}px)`,
              boxShadow: i === 3 && greenFlash > 0.05 ? `0 0 ${20 * greenFlash}px ${withAlpha(theme.ok, 0.6)}` : 'none',
            }}
          >
            {i < 3 ? (
              <>
                <span style={{width: 14, height: 14, borderRadius: 4, background: theme.danger, flexShrink: 0}} />
                <span style={{fontFamily: theme.mono, fontSize: 19, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap'}}>{labels[i]}</span>
              </>
            ) : (
              <>
                <svg width={22} height={22} viewBox="0 0 20 20">
                  <path d="M 4 10.5 L 8.5 15 L 16 5" fill="none" stroke={theme.ok} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{fontFamily: theme.mono, fontSize: 19, fontWeight: 700, color: theme.ok, whiteSpace: 'nowrap'}}>{'放行'}</span>
              </>
            )}
          </div>
        ) : null;
      })}
      {/* 模型签（消息流轨侧——p2-03「模型没换」拍保持原样一拍） */}
      <div
        style={{
          position: 'absolute',
          left: FRAMES_2A.x + FRAMES_2A.w + 24,
          top: FRAMES_2A.y + 3 * (FRAMES_2A.h + FRAMES_2A.gap) + 24,
          padding: '4px 14px',
          borderRadius: 8,
          border: `2.5px solid ${withAlpha(theme.dim, 0.8)}`,
          background: theme.panel,
          fontFamily: theme.mono,
          fontSize: 15,
          color: theme.dim,
          whiteSpace: 'nowrap',
        }}
      >
        {'模型'}
      </div>
      {/* 右：等待曲线轨（承 1-E 同形缩微——实测节点逐级点亮） */}
      <div style={{position: 'absolute', left: CURVE_2A.x - 60, top: CURVE_2A.y - 46, fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap'}}>{'等待'}</div>
      <BackoffCurve x={CURVE_2A.x} y={CURVE_2A.y} w={CURVE_2A.w} h={CURVE_2A.h} stairsP={4} capP={1} jitterP={1} markP={markP} labels={['0.58s', '1.01s', '2.14s', '']} />
      {/* 虚拟时钟（曲线下——计到 3.7s 定格） */}
      <div style={{position: 'absolute', left: CURVE_2A.x, top: CURVE_2A.y + CURVE_2A.h + 8, fontFamily: theme.mono, fontSize: 34, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', opacity: clamp01(progress(frame, atClock, 8))}}>
        {`${clock.toFixed(1)}s`}
      </div>
      {/* 环体缩悬顶角（等待=停转 → 成功复转）+ 分类表缩微驻右上 */}
      <CornerRing frozen={frame < atSpin} spinAt={atSpin} />
      <MiniTable />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {"script=('529','529','429') · clock_s=3.7"}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-B 变奏一特写（单句镜）：三连过载 → 切换帧 → 备用卡接棒 ────────────────

const TABLE_2B = {x: 480, y: 200, w: 560, h: 300} as const;

const TwoB: React.FC<{atSwap: number; atC1: number; atC2: number; atC3: number; atBackup: number}> = ({atSwap, atC1, atC2, atC3, atBackup}) => {
  const frame = useCurrentFrame();
  const swap = clamp01(progress(frame, atSwap, DUR.f4));
  const c1 = clamp01(progress(frame, atC1, 9));
  const c2 = clamp01(progress(frame, atC2, 9));
  const c3 = clamp01(progress(frame, atC3, 9));
  // 切换帧（恢复蓝）自分类表「瞬态」行滑出——与计数 3/3 同帧触发
  const sw = c3;
  const swX = TABLE_2B.x + TABLE_2B.w - 40 + (1150 - (TABLE_2B.x + TABLE_2B.w - 40)) * sw;
  const swY = TABLE_2B.y + TABLE_2B.h * 0.84;
  // 备用卡滑入接棒 + 原模型签退半格
  const backup = clamp01(progress(frame, atBackup, 26));
  const punch = Math.sin(Math.PI * clamp01(progress(frame, atBackup + 16, 40)));
  return (
    <AbsoluteFill>
      <ScriptTag lit={1} swapped={swap} y={96} />
      {/* 过载计数位（3/3 点满——与切换触发同帧） */}
      <div style={{position: 'absolute', left: 560, top: 148, display: 'flex', gap: 10, alignItems: 'center'}}>
        {[c1, c2, c3].map((c, i) => (
          <span
            key={`cc${i}`}
            style={{
              width: 34,
              height: 42,
              borderRadius: 6,
              border: `2.5px solid ${c > 0.4 ? theme.danger : theme.panelBorder}`,
              background: c > 0.4 ? withAlpha(theme.danger, 0.3) : 'transparent',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 16,
              fontWeight: 700,
              color: c > 0.4 ? theme.danger : theme.dim,
            }}
          >
            {c > 0.4 ? '过' : ''}
          </span>
        ))}
        <span style={{fontFamily: theme.mono, fontSize: 19, color: c3 > 0.9 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{`${Math.min(3, Math.floor(c1 + c2 + c3))}/3`}</span>
      </div>
      {/* 分类表（「瞬态」行 = 第三行点亮强调——切换帧自该行滑出） */}
      <RoutingTableWithHotRow x={TABLE_2B.x} y={TABLE_2B.y} w={TABLE_2B.w} h={TABLE_2B.h} hotRow={2} hotP={c3} />
      {/* 切换帧（恢复蓝——自「瞬态」行滑向备用卡位） */}
      {sw > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: swX,
            top: swY,
            padding: '6px 18px',
            borderRadius: 9,
            border: `3px solid ${theme.mech}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 18,
            fontWeight: 700,
            color: theme.mech,
            whiteSpace: 'nowrap',
            opacity: Math.sin(Math.PI * Math.min(0.999, sw)) * 0.9 + 0.1,
          }}
        >
          {'切换'}
        </div>
      ) : null}
      {/* 备用模型卡（滑入接棒——1-E 待命位同形；clock 4.1s 可读） */}
      <div style={{position: 'absolute', left: 1350 + (1 - backup) * 240, top: 320, opacity: 0.4 + 0.6 * backup}}>
        <BackupCard x={0} y={0} litP={1} solid={backup} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1350,
          top: 578,
          fontFamily: theme.mono,
          fontSize: 26,
          fontWeight: 700,
          color: theme.text,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          opacity: backup,
        }}
      >
        {'4.1s'}
      </div>
      {/* 模型签对（原模型签退半格、备用签就位） */}
      <div
        style={{
          position: 'absolute',
          left: 480,
          top: 560,
          display: 'flex',
          gap: 18,
          alignItems: 'center',
        }}
      >
        <span
          style={{
            padding: '4px 14px',
            borderRadius: 8,
            border: `2.5px solid ${withAlpha(theme.dim, 0.8 - 0.25 * backup)}`,
            background: theme.panel,
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.dim,
            whiteSpace: 'nowrap',
            opacity: 1 - 0.4 * backup,
            transform: `translateX(${-12 * backup}px)`,
          }}
        >
          {'模型'}
        </span>
        <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: backup}}>{'→'}</span>
        <span
          style={{
            padding: '4px 14px',
            borderRadius: 8,
            border: `2.5px solid ${withAlpha(theme.mech, backup)}`,
            background: theme.panel,
            fontFamily: theme.mono,
            fontSize: 15,
            fontWeight: 700,
            color: theme.mech,
            whiteSpace: 'nowrap',
            opacity: backup,
          }}
        >
          {'备用'}
        </span>
      </div>
      {/* 环体缩悬顶角（继续转动——模型换了循环没断的对照）+ 表缩微右上退让（2-B 用大表） */}
      <CornerRing frozen={false} spinAt={0} />
      {punch > 0.02 ? (
        <div style={{position: 'absolute', inset: 0, boxShadow: `inset 0 0 ${120 * punch}px ${withAlpha(theme.mech, 0.18 * punch)}`, pointerEvents: 'none'}} />
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {"script=('529','529','529') · model-backup · clock_s=4.1"}
      </div>
    </AbsoluteFill>
  );
};

/** 2-B 分类表（三行全亮 +「瞬态」行高亮脉冲——切换帧出处行） */
const RoutingTableWithHotRow: React.FC<{x: number; y: number; w: number; h: number; hotRow: number; hotP: number}> = ({x, y, w, h, hotRow, hotP}) => {
  const glow = Math.sin(Math.PI * clamp01(hotP)) * 0.5 + 0.5;
  return (
    <div style={{position: 'absolute', left: x, top: y}}>
      <RoutingTable x={0} y={0} w={w} h={h} litP={1} rowsLit={3} />
      {/* 「瞬态」行侧强调括线（切换出处——行位第三行下沿） */}
      <div
        style={{
          position: 'absolute',
          left: -14,
          top: h * (0.16 + (hotRow * 0.84) / 3) + 4,
          width: 6,
          height: (h * 0.84) / 3 - 8,
          borderRadius: 3,
          background: theme.mech,
          opacity: 0.35 + 0.6 * glow,
          boxShadow: `0 0 ${10 * glow}px ${withAlpha(theme.mech, 0.6)}`,
        }}
      />
    </div>
  );
};

// ── 2-C 两组变奏并列 + 四格剧本画廊全绿定格 ────────────────────────────────

const GALLERY = ['等待', '切换', '压缩', '续写'] as const;

const TwoC: React.FC<{
  atCollapse: number;
  atCount: number;
  atZero: number;
  atFlip: number;
  atCont: number[];
  atGallery: number;
  atDesat: number;
}> = ({atCollapse, atCount, atZero, atFlip, atCont, atGallery, atDesat}) => {
  const frame = useCurrentFrame();
  // 左位：九条收六条（复用 1-C 同款块列——同形不新建）
  const collapse = clamp01(progress(frame, atCollapse, 32));
  const count = useCount({from: 9, to: 6, at: atCount, dur: 26, ease: 'standard'});
  const zero = clamp01(progress(frame, atZero, DUR.f4));
  const zeroFlash = Math.sin(Math.PI * clamp01(progress(frame, atZero + 2, 22)));
  // 右位：额度卡翻牌复演 + 三枚续写块接力
  const flip = clamp01(progress(frame, atFlip, 30));
  const conts = atCont.map((a) => clamp01(progress(frame, a, DUR.f4)));
  // 画廊四格依次点亮全绿定格（重音镜）→ 整体降饱和悬置
  const gals = GALLERY.map((_, i) => clamp01(progress(frame, atGallery + i * 6, DUR.f4)));
  const desat = clamp01(progress(frame, atDesat, 24));
  const okColor = mixHex(theme.ok, theme.dim, 0.62 * desat);
  return (
    <AbsoluteFill>
      {/* 环体缩悬顶角缓转 + 分类表缩微驻右上（锚件不抢焦——G1①） */}
      <CornerRing frozen={false} spinAt={0} dim={0.55} />
      <MiniTable dim={0.55} />
      {/* 左演示位：压缩变奏（九条收六条 + 计数器 + 0.0s 恢复钟） */}
      <div style={{position: 'absolute', left: 250, top: 158, fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap'}}>{'压缩'}</div>
      <MessageStack x={250} y={190} w={280} h={430} collapseP={collapse} tailLit={collapse} litP={1} />
      <div style={{position: 'absolute', left: 250, top: 646, fontFamily: theme.mono, fontSize: 30, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>
        {`${Math.round(count)} 条`}
      </div>
      {/* 0.0s 恢复钟（瞬时=无等待弧线——闪绿定格） */}
      <div
        style={{
          position: 'absolute',
          left: 470,
          top: 640,
          padding: '6px 18px',
          borderRadius: 10,
          border: `3px solid ${zero > 0.4 ? okColor : theme.panelBorder}`,
          background: theme.panel,
          fontFamily: theme.mono,
          fontSize: 24,
          fontWeight: 700,
          color: zero > 0.4 ? okColor : theme.dim,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          opacity: zero,
          boxShadow: zeroFlash > 0.05 && desat < 0.5 ? `0 0 ${18 * zeroFlash}px ${withAlpha(theme.ok, 0.6)}` : 'none',
        }}
      >
        {'0.0s'}
      </div>
      {/* 右演示位：截断变奏（额度翻牌复演 + 三枚续写块接力 3/3） */}
      <div style={{position: 'absolute', left: 1080, top: 158, fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap'}}>{'截断'}</div>
      <TokenBudgetCard x={1080} y={190} w={300} h={150} flipP={flip} litP={1} />
      <BudgetRuler x={1080} y={392} w={520} litP={clamp01(progress(frame, atFlip, 8))} barP={flip} />
      <div style={{position: 'absolute', left: 1080, top: 500, display: 'flex', gap: 16, alignItems: 'flex-end'}}>
        {conts.map((c, i) => (
          <div
            key={`ct${i}`}
            style={{
              width: 118,
              height: 84,
              borderRadius: 10,
              border: `3px solid ${c > 0.4 ? theme.mech : theme.panelBorder}`,
              background: c > 0.4 ? withAlpha(theme.mech, 0.2) : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 18,
              fontWeight: 700,
              color: c > 0.4 ? theme.mech : theme.dim,
              whiteSpace: 'nowrap',
              opacity: 0.35 + 0.65 * c,
              transform: `translateY(${(1 - c) * 14}px)`,
            }}
          >
            {`续 ${i + 1}`}
          </div>
        ))}
        <span style={{fontFamily: theme.mono, fontSize: 20, color: conts[2] > 0.9 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{`3/3`}</span>
      </div>
      {/* 底部四格剧本画廊（等待/切换/压缩/续写——四格全绿的存活裁决） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 726, display: 'flex', justifyContent: 'center', gap: 36}}>
        {GALLERY.map((g, i) => {
          const p = gals[i];
          return (
            <div
              key={`gl${i}`}
              style={{
                width: 220,
                height: 118,
                borderRadius: 12,
                border: `3px solid ${p > 0.35 ? okColor : theme.panelBorder}`,
                background: p > 0.35 ? withAlpha(theme.ok, 0.14 * (1 - 0.5 * desat)) : withAlpha(theme.panel, 0.85),
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: 0.5 + 0.5 * p,
                transform: `scale(${1 + 0.03 * Math.sin(Math.PI * p)})`,
              }}
            >
              <svg width={26} height={26} viewBox="0 0 20 20" opacity={p > 0.35 ? 1 : 0.25}>
                <path d="M 4 10.5 L 8.5 15 L 16 5" fill="none" stroke={okColor} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: p > 0.35 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{g}</span>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'messages 9→6 · keep_tail=5 · 8000→64000 · continuation 3/3'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P2ScriptRun: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p2-01', 'p2-03');
  const bB = w('p2-04');
  const bC = w('p2-05', 'p2-07');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A">
        <TwoA
          atScript={wa('p2-01', 0.18) - bA.from}
          atF={[wa('p2-01', 0.54), wa('p2-01', 0.65), wa('p2-01', 0.74)].map((v) => v - bA.from)}
          atN={[wa('p2-02', 0.28), wa('p2-02', 0.68), wa('p2-02', 0.82)].map((v) => v - bA.from)}
          atClock={wa('p2-03', 0.16) - bA.from}
          atFourth={wa('p2-03', 0.4) - bA.from}
          atSpin={wa('p2-03', 0.46) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <TwoB
          atSwap={wa('p2-04', 0.08) - bB.from}
          atC1={wa('p2-04', 0.35) - bB.from}
          atC2={wa('p2-04', 0.5) - bB.from}
          atC3={wa('p2-04', 0.64) - bB.from}
          atBackup={wa('p2-04', 0.74) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <TwoC
          atCollapse={wa('p2-05', 0.2) - bC.from}
          atCount={wa('p2-05', 0.56) - bC.from}
          atZero={wa('p2-05', 0.86) - bC.from}
          atFlip={wa('p2-06', 0.22) - bC.from}
          atCont={[wa('p2-06', 0.66), wa('p2-06', 0.76), wa('p2-06', 0.86)].map((v) => v - bC.from)}
          atGallery={wa('p2-07', 0.28) - bC.from}
          atDesat={wa('p2-07', 0.72) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2ScriptRun;
