/** P0 定时的名存实亡（p0-01..p0-05，2 镜）——分镜 0-A / 0-B。
 *
 *  叙事链：0-A 系列片头交棒后冷启动直入（开篇视听合力 I-039）：夜间桌面
 *  全景——暗着的终端屏居中偏左、旁立一枚亮着刻度的闹钟（双主体一暗一亮，
 *  反差即钩子）；环体〔M-001〕悬于终端上方暗转（描边承系列锁定，环面无指针）
 *  → p0-01「九点一到」词落位终端窗内待办签「九点 · 跑测试」的九点数字到点
 *  翻亮、光标孤闪一拍而程序纹丝不动〔M-005〕→ p0-02「会话一关」词落位终端窗
 *  整窗熄灭、「连提醒的人都没了」词落位闹钟刻度光随之黯半档 → p0-03「循环里，
 *  没有表」词落位推近暗转环体一拍——环面空无一枚指针的死寂（以静写闷
 *  〔M-002〕：无辉光无脉冲，静止即陈述）→ 0-B 闹钟特写：p0-04「到点自响」
 *  词落位指针抵整点、铃响波纹扩散三圈（闹钟侧独立发光——你睡着它也照响）
 *  → p0-05「谁来干活」词落位一道视线引导线自振铃的闹钟指向暗着的环体、环体
 *  无回应（正题设问的 eye-trace 铺垫），闹钟亮与环体暗同屏对峙定格。
 *
 *  空间契约：0-A 终端＋闹钟双主体一暗一亮、署源角标右下恒定不抢焦、主体
 *    位于字幕安全区上方；0-B 闹钟为唯一发光主体、环体缩悬同屏不消失（对照
 *    前提）、指针爬行单向。
 *  红线落实：环体在 P0 内不复亮（复亮留 1-A）、不换装、环上无指针（本集
 *    判定性契约）；闹钟长出执行部件（引子只管响）；y≥56 / bottom≥176；
 *    '0 9 * * *' 只进角标；词落位 = wa(id,f)。
 *
 *  承接登记：0-B→1-A 判替换不 morph（storyboard 登记）——闹钟（类比物）与
 *    判时线程（机制物）非同一主体，走 cut＋屏位呼应：0-B 闹钟消隐的屏位 =
 *    1-A 判时卡（链首）亮起的屏位，明暗反转即「引子在此、机制在此」。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LoopRing, NIGHT_TOP, NIGHT_BOTTOM} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（首部署源位，RSI I-080 豁免登记 vibe-video.toml）：右下常驻，一次
 *  淡入后恒定不抢焦；bottom 168 避开字幕条（承 ep1–ep13 SourceCredit 形态） */
const SourceCredit: React.FC<{lit?: number}> = ({lit = 1}) => (
  <div
    style={{
      position: 'absolute',
      right: 72,
      bottom: 168,
      fontFamily: theme.mono,
      fontSize: 22,
      letterSpacing: 1,
      color: theme.dim,
      opacity: 0.85 * clamp01(lit),
    }}
  >
    Learn Claude Code
  </div>
);

// ── 0-A 冷启动夜间桌面：暗终端 + 亮刻度闹钟 + 环体暗转无指针 ──────────────

/** 0-A 全局位：终端居中偏左（暗）/ 闹钟右立（亮刻度）/ 环体悬终端上方（暗转） */
const RING_0A = {x: 600, y: 36, size: 200} as const;
const TERM_0A = {x: 340, y: 280, w: 770, h: 530} as const;
const CLOCK_0A = {x: 1230, y: 420, size: 250} as const;

/** 闹钟（类比物 A#2 落锚——圆表盘 + 亮刻度 + 双指针 + 双铃；指针爬行单向）。
 *  `needleT` 指针角度进度 0..1（自 -60° 爬向 12 点整点）；`litP` 刻度亮度
 *  （p0-02 后黯半档）；`ringP` 振铃波纹（三圈扩散——到点自响） */
const AlarmClock: React.FC<{
  x: number;
  y: number;
  size: number;
  needleT?: number;
  litP?: number;
  dimP?: number;
  ringP?: number;
}> = ({x, y, size, needleT = 0.2, litP = 1, dimP = 0, ringP = 0}) => {
  const lit = clamp01(litP) * (1 - 0.45 * clamp01(dimP));
  const ring = clamp01(ringP);
  const c = size / 2;
  const r = size / 2 - 30;
  const deg = -60 + clamp01(needleT) * 60;
  const rad = (deg * Math.PI) / 180;
  const handX = c + r * 0.62 * Math.cos(rad);
  const handY = c + r * 0.62 * Math.sin(rad);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: size, height: size, opacity: clamp01(litP)}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{overflow: 'visible'}}>
        {/* 振铃波纹（三圈扩散——ringP 0..1 各圈依次） */}
        {[0, 1, 2].map((k) => {
          const p = clamp01(ring * 1.6 - k * 0.32);
          if (p <= 0.01 || p >= 0.99) return null;
          return <circle key={`rw${k}`} cx={c} cy={c} r={r + 14 + p * (44 + k * 8)} fill="none" stroke={withAlpha(theme.text, 0.5 * (1 - p))} strokeWidth={4} />;
        })}
        {/* 双铃（顶部）+ 提梁 */}
        <line x1={c - 34} y1={26} x2={c - 18} y2={44} stroke={withAlpha(theme.dim, 0.8)} strokeWidth={5} strokeLinecap="round" />
        <line x1={c + 34} y1={26} x2={c + 18} y2={44} stroke={withAlpha(theme.dim, 0.8)} strokeWidth={5} strokeLinecap="round" />
        <circle cx={c - 34} cy={22} r={15} fill={withAlpha(theme.panel, 0.98)} stroke={ring > 0.05 ? theme.text : withAlpha(theme.dim, 0.85)} strokeWidth={4.5} />
        <circle cx={c + 34} cy={22} r={15} fill={withAlpha(theme.panel, 0.98)} stroke={ring > 0.05 ? theme.text : withAlpha(theme.dim, 0.85)} strokeWidth={4.5} />
        {/* 表盘（亮刻度——暗态刻度即本体的「亮」） */}
        <circle cx={c} cy={c} r={r} fill={withAlpha(theme.panel, 0.97)} stroke={withAlpha(theme.dim, 0.85)} strokeWidth={5} />
        {Array.from({length: 12}, (_, i) => {
          const a = (i / 12) * 360 - 90;
          const p0 = {x: c + (r - 12) * Math.cos((a * Math.PI) / 180), y: c + (r - 12) * Math.sin((a * Math.PI) / 180)};
          const p1 = {x: c + (r - 3) * Math.cos((a * Math.PI) / 180), y: c + (r - 3) * Math.sin((a * Math.PI) / 180)};
          return <line key={`ct${i}`} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={withAlpha(theme.text, 0.85 * lit)} strokeWidth={i % 3 === 0 ? 4.5 : 2.5} strokeLinecap="round" />;
        })}
        {/* 双指针（时针指向 12 缓爬 needleT、分针恒 12——指针爬行单向） */}
        <line x1={c} y1={c} x2={handX} y2={handY} stroke={theme.text} strokeWidth={5} strokeLinecap="round" opacity={0.9 * lit + 0.1} />
        <line x1={c} y1={c} x2={c} y2={c - r * 0.86} stroke={withAlpha(theme.text, 0.7)} strokeWidth={3.5} strokeLinecap="round" />
        <circle cx={c} cy={c} r={6} fill={theme.text} opacity={lit} />
        {/* 双脚 */}
        <line x1={c - r * 0.62} y1={c + r * 0.78} x2={c - r * 0.72} y2={c + r * 0.98} stroke={withAlpha(theme.dim, 0.8)} strokeWidth={5} strokeLinecap="round" />
        <line x1={c + r * 0.62} y1={c + r * 0.78} x2={c + r * 0.72} y2={c + r * 0.98} stroke={withAlpha(theme.dim, 0.8)} strokeWidth={5} strokeLinecap="round" />
      </svg>
    </div>
  );
};

const ZeroA: React.FC<{atNine: number; atOff: number; atDim: number; atPush: number}> = ({atNine, atOff, atDim, atPush}) => {
  const frame = useCurrentFrame();
  // 待办签九点数字到点翻亮（p0-01「九点一到」——数字到位即翻亮，程序纹丝不动）
  const nine = clamp01(progress(frame, atNine, DUR.f4));
  // 光标孤闪（一拍闪烁后归于静止——程序纹丝不动的读法）
  const cursorOn = Math.sin(Math.PI * clamp01(progress(frame, atNine + 2, 26))) > 0.25;
  // 终端窗整窗熄灭（p0-02「会话一关」——屏光衰减）
  const off = clamp01(progress(frame, atOff, 18));
  // 闹钟刻度光黯半档（p0-02「连提醒的人都没了」）
  const clockDim = clamp01(progress(frame, atDim, 16));
  // 推近暗转环体一拍（p0-03「循环里，没有表」——以静写闷，环面无指针）
  const pushTf = usePushIn(atPush, {scale: 0.1, dur: DUR.f6});
  const ringDead = clamp01(progress(frame, atPush, 20));
  return (
    <AbsoluteFill>
      {/* 夜色底光（P0 夜语义——冷暗一档，与 P1 常态区分） */}
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${withAlpha(NIGHT_TOP, 0.55)}, ${withAlpha(NIGHT_BOTTOM, 0.2)})`, pointerEvents: 'none'}} />
      {/* 环体〔M-001〕悬于终端上方——暗转（描边承锁定、无指针、无辉光无脉冲：静止即陈述）。
          p0-03 推近一拍：容器 transform 承载（描边色/线宽不动） */}
      <div style={{position: 'absolute', left: RING_0A.x, top: RING_0A.y, opacity: 0.3 + 0.25 * ringDead, transform: pushTf, transformOrigin: '50% 50%'}}>
        <LoopRing size={RING_0A.size} nodes={[]} showExit={false} />
      </div>
      {/* 终端窗（居中偏左——暗着；p0-01 待办签、p0-02 整窗熄灭） */}
      <div style={{position: 'absolute', left: TERM_0A.x, top: TERM_0A.y, width: TERM_0A.w, height: TERM_0A.h, opacity: 1 - 0.72 * off}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 14,
            border: `3px solid ${withAlpha(theme.tool, 0.5)}`,
            background: withAlpha(theme.panel, 0.6),
            padding: '18px 26px',
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: `2px solid ${withAlpha(theme.panelBorder, 0.8)}`}}>
            {[0, 1, 2].map((d) => (
              <span key={`td${d}`} style={{width: 11, height: 11, borderRadius: '50%', background: withAlpha(theme.dim, 0.5)}} />
            ))}
            <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginLeft: 8, whiteSpace: 'nowrap'}}>{'terminal · 夜'}</span>
          </div>
          {/* 待办签（九点 · 跑测试——九点数字到点翻亮而程序纹丝不动） */}
          <div
            style={{
              marginTop: 40,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 24px',
              borderRadius: 10,
              border: `3px solid ${nine > 0.4 ? withAlpha(theme.text, 0.85) : withAlpha(theme.dim, 0.5)}`,
              background: withAlpha(theme.panel, 0.95),
              opacity: clamp01(progress(frame, 6, DUR.f5)),
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 30, fontWeight: 700, color: nine > 0.4 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>九点</span>
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, whiteSpace: 'nowrap'}}>{'· 跑测试'}</span>
          </div>
          {/* 命令行提示符（光标孤闪一拍——没人开口） */}
          <div style={{marginTop: 34, fontFamily: theme.mono, fontSize: 26, color: theme.dim, whiteSpace: 'nowrap'}}>
            {'$ '}
            <span style={{opacity: cursorOn ? 0.95 : 0.25, color: theme.text}}>{'▍'}</span>
          </div>
          {/* 静默行（程序纹丝不动——三行暗行待命） */}
          {[0, 1].map((ln) => (
            <div key={`silent${ln}`} style={{marginTop: 18, height: 10, width: 320 - ln * 90, borderRadius: 5, background: withAlpha(theme.dim, 0.16)}} />
          ))}
        </div>
      </div>
      {/* 闹钟（右立——亮刻度；p0-02 后刻度光黯半档） */}
      <AlarmClock x={CLOCK_0A.x} y={CLOCK_0A.y} size={CLOCK_0A.size} needleT={0.35} litP={clamp01(progress(frame, 3, DUR.f5))} dimP={clockDim} />
      <SourceCredit lit={clamp01(progress(frame, 4, DUR.f5))} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'0 9 * * *'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-B 闹钟特写：指针爬向整点、到点自响 + 视线引导线指向暗环 ────────────────

const CLOCK_0B = {x: 700, y: 200, size: 420} as const;
const RING_0B = {x: 1520, y: 600, size: 190} as const;

const ZeroB: React.FC<{atTick: number; atRing: number; atLine: number}> = ({atTick, atRing, atLine}) => {
  const frame = useCurrentFrame();
  // 指针爬向整点（单向爬行——词锚起缓爬、到点抵 12）
  const climb = clamp01(progress(frame, atTick, Math.max(20, atRing - atTick - 2)));
  // 铃响波纹（三圈扩散——到点自响：闹钟侧独立发光）
  const ring = clamp01(progress(frame, atRing, 44));
  // 视线引导线（p0-05「谁来干活」——自振铃的闹钟指向暗着的环体；环体无回应）
  const line = clamp01(progress(frame, atLine, 20));
  // 闹钟亮与环体暗同屏对峙定格（镜尾 push 定格留给字幕带：主体已在中上区）
  const lx0 = CLOCK_0B.x + CLOCK_0B.size + 6;
  const ly0 = CLOCK_0B.y + CLOCK_0B.size / 2;
  const lx1 = RING_0B.x + 20;
  const ly1 = RING_0B.y + RING_0B.size / 2;
  return (
    <AbsoluteFill>
      <AlarmClock x={CLOCK_0B.x} y={CLOCK_0B.y} size={CLOCK_0B.size} needleT={climb} litP={1} ringP={ring} />
      {/* 环体缩悬画面一角（暗转对照位——环面无指针、无回应；同屏不消失） */}
      <div style={{position: 'absolute', left: RING_0B.x, top: RING_0B.y, opacity: 0.32}}>
        <LoopRing size={RING_0B.size} nodes={[]} showExit={false} />
      </div>
      {/* 视线引导线（振铃闹钟 → 暗环——正题设问的 eye-trace；环侧无回应标记） */}
      {line > 0.03 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <line x1={lx0} y1={ly0} x2={lx0 + (lx1 - lx0) * line} y2={ly0 + (ly1 - ly0) * line} stroke={withAlpha(theme.text, 0.65)} strokeWidth={4} strokeDasharray="14 10" strokeLinecap="round" />
          {line > 0.85 ? (
            <>
              <path d={`M ${lx1 - 20} ${ly1 - 11} L ${lx1} ${ly1} L ${lx1 - 22} ${ly1 + 10}`} fill="none" stroke={withAlpha(theme.text, 0.65)} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
              {/* 环侧无回应（问号小签——悬而不答） */}
              <text x={lx1 - 96} y={ly1 - 46} fontFamily={theme.serif} fontSize={34} fontWeight={700} fill={withAlpha(theme.dim, 0.9 * clamp01((line - 0.85) / 0.15))}>
                ？
              </text>
            </>
          ) : null}
        </svg>
      ) : null}
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'0 9 * * *'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0NoClockLoop: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-05');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A">
        <ZeroA
          atNine={wa('p0-01', 0.66) - bA.from}
          atOff={wa('p0-02', 0.12) - bA.from}
          atDim={wa('p0-02', 0.55) - bA.from}
          atPush={wa('p0-03', 0.72) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atTick={wa('p0-04', 0.12) - bB.from}
          atRing={wa('p0-04', 0.54) - bB.from}
          atLine={wa('p0-05', 0.42) - bB.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0NoClockLoop;
