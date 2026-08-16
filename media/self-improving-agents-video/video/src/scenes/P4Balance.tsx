import React from 'react';
import {AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {FadeUp, Pill} from '../components/cards';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';

/* ============ 小工具 ============ */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** 帧区间进度 [a,b] -> [0,1]（自动截断） */
const seg = (f: number, a: number, b: number) => clamp01((f - a) / Math.max(1, b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeIn = (t: number) => t * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const smooth = (t: number) => t * t * (3 - 2 * t);
/** 确定性伪随机（Remotion 渲染需可复现） */
const prand = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
/** 折线插值：把 [x,y] 停靠点序列转成严格递增的 interpolate 输入 */
const rail = (stops: [number, number][]) => {
  const xs: number[] = [];
  const ys: number[] = [];
  let prev = -Infinity;
  for (const [x, y] of stops) {
    const xx = x <= prev ? prev + 1 : x;
    xs.push(xx);
    ys.push(y);
    prev = xx;
  }
  return {xs, ys};
};

/** 画布 1920x1080，底部 160px 是字幕安全区：所有内容约束在 y < 920 */
const Stage: React.FC<{children?: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', paddingBottom: 160, ...style}}>
    {children}
  </AbsoluteFill>
);

/** 顶部大标题（衬线，≥64px） */
const BeatTitle: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div
    style={{
      position: 'absolute',
      top: 56,
      width: '100%',
      textAlign: 'center',
      fontFamily: theme.serif,
      fontSize: 64,
      fontWeight: 700,
      color: theme.text,
      lineHeight: 1.25,
      ...style,
    }}
  >
    {children}
  </div>
);

/** 按口播相位切换的字幕带（画面内说明，非底部字幕） */
const PhaseCaption: React.FC<{items: {at: number; text: string; color?: string}[]}> = ({items}) => {
  const frame = useCurrentFrame();
  let active: {at: number; text: string; color?: string} | null = null;
  for (const it of items) {
    if (frame >= it.at) active = it;
  }
  if (!active) return null;
  return (
    <FadeUp key={active.at}>
      <div style={{fontFamily: theme.sans, fontSize: 30, color: active.color ?? theme.dim, letterSpacing: 1}}>
        {active.text}
      </div>
    </FadeUp>
  );
};

/* ================================================================
 * 4-A 双环（p4-01..02）：外橙快环高速转，内蓝慢环缓慢转；答案"不选边，组合用"
 * ================================================================ */
const DualRings: React.FC<{answerAt: number}> = ({answerAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const answer = spring({frame: frame - answerAt, fps, config: {damping: 15}});
  const outerRot = frame * 1.05; // 橙环：约 36°/s
  const innerRot = frame * 0.14; // 蓝环：约 4.2°/s —— 差速对比
  const outerNodes = ['🧰', '🔧', '📄', '⚙️'];
  const R_OUT = 300;
  const R_IN = 190;
  return (
    <Stage>
      <div style={{position: 'absolute', top: 52, width: '100%', textAlign: 'center', opacity: enter * (1 - answer * 0.8)}}>
        <div style={{fontFamily: theme.serif, fontSize: 64, fontWeight: 700, color: theme.text}}>
          两条路讲完了，谁更好？
        </div>
      </div>

      {/* 双环嵌套：共享圆心 */}
      <div style={{position: 'relative', width: 0, height: 0, marginTop: 26}}>
        {/* 外圈 · 橙 · 快环（改装备 Σ） */}
        <div
          style={{
            position: 'absolute',
            width: R_OUT * 2,
            height: R_OUT * 2,
            left: -R_OUT,
            top: -R_OUT,
            borderRadius: '50%',
            border: `3px dashed ${theme.gear}`,
            transform: `rotate(${outerRot}deg) scale(${0.72 + enter * 0.28})`,
            opacity: enter,
            boxShadow: '0 0 70px rgba(255,159,69,0.10)',
          }}
        >
          {outerNodes.map((e, i) => (
            <div
              key={e}
              style={{
                position: 'absolute',
                left: R_OUT - 24,
                top: R_OUT - 26,
                transform: `rotate(${i * 90}deg) translate(${R_OUT}px) rotate(${-i * 90 - outerRot}deg)`,
                fontSize: 50,
              }}
            >
              {e}
            </div>
          ))}
        </div>

        {/* 内圈 · 蓝 · 慢环（改大脑 θ） */}
        <div
          style={{
            position: 'absolute',
            width: R_IN * 2,
            height: R_IN * 2,
            left: -R_IN,
            top: -R_IN,
            borderRadius: '50%',
            border: `3px solid ${theme.brain}`,
            transform: `rotate(${innerRot}deg) scale(${0.72 + enter * 0.28})`,
            opacity: enter,
            boxShadow: '0 0 60px rgba(74,158,255,0.12)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: R_IN - 26,
              top: R_IN - 28,
              transform: `rotate(40deg) translate(${R_IN}px) rotate(${-40 - innerRot}deg)`,
              fontSize: 52,
            }}
          >
            🧠
          </div>
          <div
            style={{
              position: 'absolute',
              left: R_IN - 12,
              top: R_IN - 30,
              transform: `rotate(220deg) translate(${R_IN}px) rotate(${-220 - innerRot}deg)`,
              fontFamily: theme.mono,
              fontSize: 44,
              color: theme.brain,
              fontWeight: 700,
            }}
          >
            θ
          </div>
        </div>

        {/* 圆心：蓝橙合体环 */}
        <svg width={150} height={150} style={{position: 'absolute', left: -75, top: -75, transform: `rotate(${innerRot}deg)`}}>
          <path d="M 11 75 A 64 64 0 0 1 139 75" fill="none" stroke={theme.brain} strokeWidth={11} strokeLinecap="round" />
          <path d="M 139 75 A 64 64 0 0 1 11 75" fill="none" stroke={theme.gear} strokeWidth={11} strokeLinecap="round" />
          <circle cx={75} cy={75} r={7} fill={theme.text} />
        </svg>

        {/* 通路标签 */}
        <div style={{position: 'absolute', left: R_OUT - 40, top: -R_OUT + 10}}>
          <Pill color={theme.gear}>改装备 Σ · 快环</Pill>
        </div>
        <div style={{position: 'absolute', left: -R_IN - 6, top: R_IN - 130, transform: 'translateX(-100%)'}}>
          <Pill color={theme.brain}>改大脑 θ · 慢环</Pill>
        </div>
      </div>

      {/* 答案条 */}
      <div
        style={{
          position: 'absolute',
          top: 772,
          width: '100%',
          textAlign: 'center',
          opacity: answer,
          transform: `translateY(${(1 - answer) * 26}px)`,
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 64, fontWeight: 700, color: theme.text}}>
          不选边，<span style={{color: theme.brain}}>组</span>
          <span style={{color: theme.gear}}>合</span>用
        </div>
        <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 30, color: theme.dim}}>—— 因为它们性格互补</div>
      </div>
    </Stage>
  );
};

/* ================================================================
 * 4-B 铅笔刻石（p4-03..06）：左橙铅笔可擦，右蓝刻石不可逆 + 论文原话条
 * ================================================================ */
const PencilVsStone: React.FC<{t4: number; t5: number; t6: number}> = ({t4, t5, t6}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enterL = spring({frame, fps, config: {damping: 200}});
  const enterR = spring({frame: frame - 6, fps, config: {damping: 200}});

  // 左：铅笔书写 -> 后被擦除（可逆）
  const writeP = seg(frame, 5, 55);
  const eraseP = seg(frame, t5 + 8, t5 + 40);
  const prompt = '提示词：先列大纲再写';
  const shown = Math.floor(writeP * prompt.length);

  // 右：凿子刻石 -> 事后找不到刻在哪（不可逆）
  const carveP = seg(frame, t4 + 5, t4 + 62);
  const carved = 'w₃ ← 0.72（永久）';
  const carvedShown = Math.floor(carveP * carved.length);
  const patrolX = 90 + (((frame - t6) * 2.2) % 480);

  return (
    <Stage>
      <BeatTitle>铅笔，还是刻石？</BeatTitle>

      <div style={{position: 'absolute', top: 168, display: 'flex', gap: 44, transform: `translateY(${(1 - enterL) * 40}px)`}}>
        {/* 左 · 纸面（改装备：铅笔字） */}
        <div
          style={{
            width: 790,
            height: 520,
            borderRadius: 16,
            background: '#EFE9DC',
            border: `2px solid ${theme.panelBorder}`,
            boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
            opacity: enterL,
            transform: `translateX(${(1 - enterL) * -260}px)`,
            padding: '30px 38px',
            position: 'relative',
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 800, color: '#9A6320'}}>
            ✏️ 改装备 · 铅笔写字
          </div>
          <div style={{marginTop: 8, height: 3, width: 240, background: 'rgba(154,99,32,0.35)', borderRadius: 2}} />

          {/* 手写内容（被书写后又被擦除） */}
          <div style={{marginTop: 46, opacity: 1 - eraseP}}>
            <div style={{fontFamily: theme.mono, fontSize: 32, color: '#4A4238', whiteSpace: 'nowrap'}}>
              {prompt.slice(0, shown)}
              <span style={{opacity: frame % 18 < 9 ? 1 : 0.1, color: '#9A6320'}}>▎</span>
            </div>
            <div
              style={{
                marginTop: 30,
                height: 18,
                width: 560,
                borderRadius: 9,
                background: '#CBC3B2',
                opacity: writeP > 0.55 ? 1 : writeP * 1.6,
              }}
            />
            <div
              style={{
                marginTop: 22,
                height: 18,
                width: 430,
                borderRadius: 9,
                background: '#CBC3B2',
                opacity: writeP > 0.85 ? 1 : clamp01((writeP - 0.7) * 3),
              }}
            />
          </div>

          {/* 铅笔跟随笔尖 */}
          <div
            style={{
              position: 'absolute',
              left: 60 + writeP * 540,
              top: 150,
              fontSize: 46,
              transform: `rotate(${Math.sin(frame * 0.35) * 6 - 30}deg)`,
              opacity: writeP > 0 && writeP < 1 ? 1 : 0.25,
            }}
          >
            ✏️
          </div>

          {/* 橡皮擦 sweeping 撤销 */}
          <div
            style={{
              position: 'absolute',
              left: 50 + eraseP * 580,
              top: 132,
              width: 108,
              height: 52,
              borderRadius: 10,
              background: '#3A3A44',
              color: theme.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.sans,
              fontSize: 26,
              opacity: eraseP > 0 && eraseP < 1 ? 1 : 0,
              boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
            }}
          >
            撤销 ↩
          </div>

          {/* 已撤销标记 */}
          <div
            style={{
              position: 'absolute',
              left: 38,
              bottom: 34,
              fontFamily: theme.sans,
              fontSize: 30,
              fontWeight: 700,
              color: '#4E7A1B',
              opacity: seg(frame, t5 + 42, t5 + 56),
            }}
          >
            ✓ 已撤销 · 干净如初
          </div>
        </div>

        {/* 右 · 石板（改大脑：刻石） */}
        <div
          style={{
            width: 790,
            height: 520,
            borderRadius: 16,
            background: `linear-gradient(180deg, ${theme.panel}, #131A28)`,
            border: `2px solid ${theme.brain}55`,
            boxShadow: `0 30px 80px rgba(0,0,0,0.45)`,
            opacity: enterR,
            transform: `translateX(${(1 - enterR) * 260}px)`,
            padding: '30px 38px',
            position: 'relative',
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 800, color: theme.brain}}>
            🪨 改大脑 · 石头刻字
          </div>
          <div style={{marginTop: 8, height: 3, width: 240, background: 'rgba(74,158,255,0.35)', borderRadius: 2}} />

          {/* 石板 */}
          <div
            style={{
              marginTop: 42,
              height: 210,
              borderRadius: 14,
              background: '#222B3A',
              border: `2px solid ${theme.panelBorder}`,
              padding: '34px 30px',
              position: 'relative',
            }}
          >
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 38,
                color: '#8FB8E8',
                textShadow: '0 2px 0 rgba(0,0,0,0.55), 0 -1px 0 rgba(255,255,255,0.10)',
                whiteSpace: 'nowrap',
              }}
            >
              {carved.slice(0, carvedShown)}
              <span style={{opacity: carveP > 0 && carveP < 1 ? (frame % 14 < 7 ? 1 : 0.15) : 0, color: theme.brain}}>▎</span>
            </div>
            <div
              style={{
                marginTop: 28,
                height: 14,
                width: 420,
                borderRadius: 7,
                background: 'rgba(143,184,232,0.20)',
                opacity: clamp01((carveP - 0.6) * 3),
              }}
            />
            <div
              style={{
                marginTop: 16,
                height: 14,
                width: 300,
                borderRadius: 7,
                background: 'rgba(143,184,232,0.14)',
                opacity: clamp01((carveP - 0.8) * 4),
              }}
            />

            {/* 凿子敲击 */}
            <div
              style={{
                position: 'absolute',
                left: 60 + carveP * 470,
                top: -34,
                fontSize: 46,
                transform: `rotate(${-40 + Math.sin(frame * 0.55) * 14}deg)`,
                opacity: carveP > 0 && carveP < 1 ? 1 : 0.3,
              }}
            >
              🔨
            </div>

            {/* 事后找不到刻在哪：放大镜巡逻 + 红问号 */}
            <div style={{position: 'absolute', left: patrolX, top: 96, fontSize: 52, opacity: seg(frame, t6 + 2, t6 + 10)}}>
              🔍
            </div>
            {[
              {x: 150, y: 30, d: 0},
              {x: 330, y: 120, d: 12},
              {x: 520, y: 52, d: 24},
            ].map((q) => (
              <div
                key={q.d}
                style={{
                  position: 'absolute',
                  left: q.x,
                  top: q.y,
                  fontFamily: theme.mono,
                  fontSize: 42,
                  fontWeight: 700,
                  color: theme.danger,
                  opacity: seg(frame, t6 + 12 + q.d, t6 + 22 + q.d),
                }}
              >
                ?
              </div>
            ))}
          </div>

          <div
            style={{
              position: 'absolute',
              right: 38,
              bottom: 34,
              fontFamily: theme.sans,
              fontSize: 30,
              fontWeight: 700,
              color: theme.danger,
              opacity: seg(frame, t6 + 34, t6 + 48),
            }}
          >
            ✗ 刻歪了？连刻在哪都找不到
          </div>
        </div>
      </div>

      {/* 论文原话条 */}
      <div style={{position: 'absolute', top: 716, width: '100%', textAlign: 'center'}}>
        <FadeUp delay={t5 + 12}>
          <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.dim}}>
            <span style={{color: theme.ok, fontWeight: 700}}>✓</span> 一个坏提示词，很容易撤销；
          </div>
        </FadeUp>
        <FadeUp delay={t6 + 12}>
          <div style={{marginTop: 10, fontFamily: theme.serif, fontSize: 34, color: theme.text}}>
            <span style={{color: theme.danger, fontWeight: 700}}>⚠</span>{' '}
            被吸收进旋钮里的退化，出了名地难追踪。
          </div>
          <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>—— 综述原文 · 大意</div>
        </FadeUp>
      </div>
    </Stage>
  );
};

/* ================================================================
 * 4-C 快慢节律（p4-07..10）：白天橙环试错；入夜经验颗粒蒸馏进蓝色大脑
 * ================================================================ */
const DayNightLoop: React.FC<{t8: number; t9: number; t10: number}> = ({t8, t9, t10}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const night = seg(frame, t10, t10 + 20); // 昼 -> 夜 交叉淡化

  const chips = [
    {x: 290, label: '工具 A', ok: false},
    {x: 460, label: '提示 B', ok: true},
    {x: 630, label: '工具 C', ok: true},
    {x: 800, label: '策略 D', ok: false},
    {x: 970, label: '工具 E', ok: true},
  ];
  const okArrived = chips.filter((c, i) => c.ok && frame >= t8 + i * 10 + 58).length;

  // 夜间沉降颗粒：从“新本事”与经验库出发，经漏斗落入大脑
  const funnelMouth = {x: 960, y: 575};
  const domeTop = {x: 960, y: 716};
  const particles = [
    {sx: 340, sy: 344},
    {sx: 420, sy: 372},
    {sx: 500, sy: 352},
    {sx: 560, sy: 378},
    {sx: 1500, sy: 468},
    {sx: 1570, sy: 478},
    {sx: 1640, sy: 492},
  ];
  const landed = particles.filter((_, i) => frame >= t10 + 10 + i * 7 + 46).length;
  const glow = landed / particles.length;

  return (
    <Stage>
      {/* 天空：昼 / 夜 交叉淡化 */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(255,159,69,0.16) 0%, rgba(255,159,69,0.03) 34%, transparent 60%)`,
          opacity: (1 - night) * enter,
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(74,158,255,0.18) 0%, rgba(26,58,92,0.10) 34%, transparent 62%)`,
          opacity: night,
        }}
      />
      {/* 太阳 / 月亮 / 星星 */}
      <div
        style={{
          position: 'absolute',
          left: 1520,
          top: 108,
          width: 92,
          height: 92,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.gear}, ${theme.gearDeep})`,
          boxShadow: `0 0 70px rgba(255,159,69,${0.5 * (1 - night)})`,
          opacity: enter * (1 - night),
        }}
      />
      <div style={{position: 'absolute', left: 300, top: 104, fontSize: 62, opacity: night * enter}}>🌙</div>
      {Array.from({length: 10}).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 120 + prand(i * 3) * 1680,
            top: 60 + prand(i * 3 + 1) * 210,
            fontSize: 20 + prand(i * 3 + 2) * 10,
            color: theme.brain,
            opacity: night * (0.35 + prand(i) * 0.6),
          }}
        >
          ✦
        </div>
      ))}

      <BeatTitle style={{opacity: enter}}>聪明的答案：快慢双环</BeatTitle>

      {/* 昼 / 夜 相位标签 */}
      <div style={{position: 'absolute', top: 322, width: '100%', textAlign: 'center'}}>
        <div style={{fontFamily: theme.sans, fontSize: 32, color: theme.gear, opacity: (1 - night) * enter}}>
          ☀️ 白天 · 装备层快速试错 —— 改坏了都能撤回来
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 32, color: theme.brain, opacity: night}}>
          🌙 夜晚 · 睡一觉，把验证过的本事蒸馏进大脑
        </div>
      </div>

      {/* 试错芯片排 */}
      <div style={{position: 'absolute', top: 404, left: 0, width: '100%', height: 90, opacity: 1 - night * 0.8}}>
        {chips.map((c, i) => {
          const appear = seg(frame, t8 + i * 10, t8 + i * 10 + 10);
          const undo = seg(frame, t8 + i * 10 + 26, t8 + i * 10 + 40);
          const fade = 1 - seg(frame, t8 + i * 10 + 40, t8 + i * 10 + 56);
          const fly = c.ok ? easeIn(seg(frame, t8 + i * 10 + 30, t8 + i * 10 + 58)) : 0;
          const tx = fly * (1560 - c.x);
          const ty = fly * 66;
          if (!c.ok) {
            // 失败芯片：亮红叉 + ↩ 撤回后淡出（可逆）
            return (
              <div
                key={c.label}
                style={{
                  position: 'absolute',
                  left: c.x,
                  top: 8,
                  opacity: appear * fade,
                  transform: `translate(${tx}px, ${ty}px) scale(${1 - fly * 0.7})`,
                }}
              >
                <div
                  style={{
                    padding: '12px 20px',
                    borderRadius: 14,
                    background: theme.panel,
                    border: `2px solid ${undo > 0.2 ? theme.dim : theme.panelBorder}`,
                    fontFamily: theme.sans,
                    fontSize: 28,
                    color: theme.dim,
                  }}
                >
                  {c.label} <span style={{color: theme.danger, fontWeight: 700}}>✗</span>
                  <span style={{color: theme.dim, opacity: undo}}> ↩ 已撤回</span>
                </div>
              </div>
            );
          }
          // 成功芯片：亮绿勾 -> 飞入经验库
          return (
            <div
              key={c.label}
              style={{
                position: 'absolute',
                left: c.x,
                top: 8,
                opacity: appear * (1 - fly * 0.9),
                transform: `translate(${tx}px, ${ty}px) scale(${1 - fly * 0.72})`,
              }}
            >
              <div
                style={{
                  padding: '12px 20px',
                  borderRadius: 14,
                  background: theme.panel,
                  border: `2px solid ${theme.gear}88`,
                  fontFamily: theme.sans,
                  fontSize: 28,
                  color: theme.text,
                }}
              >
                {c.label} <span style={{color: theme.ok, fontWeight: 700}}>✓</span>
              </div>
            </div>
          );
        })}

        {/* 反复验证的“新本事” */}
        <div style={{position: 'absolute', left: 300, top: -88, opacity: 1 - night * 0.5}}>
          <FadeUp delay={t9}>
            <div
              style={{
                padding: '12px 24px',
                borderRadius: 14,
                background: theme.panel,
                border: `2px solid ${theme.ok}`,
                boxShadow: `0 0 ${18 + 26 * seg(frame, t9 + 26, t9 + 40)}px rgba(126,211,33,0.5)`,
                fontFamily: theme.sans,
                fontSize: 30,
                fontWeight: 700,
                color: theme.text,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              新本事 ✨
              {[0, 1, 2].map((k) => (
                <span
                  key={k}
                  style={{
                    color: theme.ok,
                    fontSize: 30,
                    transform: `scale(${spring({frame: frame - t9 - 8 - k * 10, fps, config: {damping: 12}})})`,
                    display: 'inline-block',
                  }}
                >
                  ✓
                </span>
              ))}
              <span style={{fontSize: 26, color: theme.ok, fontWeight: 400}}>反复验证</span>
            </div>
          </FadeUp>
        </div>

        {/* 经验库托盘 */}
        <div
          style={{
            position: 'absolute',
            left: 1450,
            top: 44,
            width: 270,
            height: 74,
            borderRadius: 14,
            background: theme.panel,
            border: `2px solid ${theme.gear}66`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.dim,
          }}
        >
          经验库 <span style={{fontFamily: theme.mono, fontSize: 30, color: theme.ok}}>✓×{okArrived}</span>
        </div>
      </div>

      {/* 蒸馏漏斗 + 蓝色大脑 */}
      <svg width={420} height={140} style={{position: 'absolute', left: 750, top: 506, opacity: 0.4 + 0.6 * night}}>
        <path
          d="M 40 6 L 380 6 L 268 134 L 152 134 Z"
          fill="rgba(26,58,92,0.55)"
          stroke={theme.brain}
          strokeWidth={3}
          strokeDasharray="14 10"
        />
        <text x={210} y={-8} textAnchor="middle" fill={theme.brain} fontSize={26} fontFamily={theme.mono}>
          distill
        </text>
      </svg>

      {/* 沉降颗粒 */}
      {particles.map((p, i) => {
        const d = t10 + 10 + i * 7;
        const s1 = easeIn(seg(frame, d, d + 22));
        const s2 = easeOut(seg(frame, d + 22, d + 46));
        const x = s2 > 0 ? lerp(funnelMouth.x, domeTop.x, s2) : lerp(p.sx, funnelMouth.x, s1) + Math.sin(frame * 0.22 + i) * 10 * (1 - s1);
        const y = s2 > 0 ? lerp(funnelMouth.y, domeTop.y, s2) : lerp(p.sy, funnelMouth.y, s1);
        const op = (1 - seg(frame, d + 40, d + 48)) * night;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - 7,
              top: y - 7,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: theme.gear,
              boxShadow: `0 0 12px rgba(255,159,69,0.8)`,
              opacity: op,
            }}
          />
        );
      })}

      {/* 大脑穹顶 */}
      <div
        style={{
          position: 'absolute',
          left: 800,
          top: 714,
          width: 320,
          height: 172,
          borderRadius: '160px 160px 24px 24px',
          background: `linear-gradient(180deg, ${theme.brainDeep}, #0F2438)`,
          border: `3px solid ${theme.brain}`,
          boxShadow: `0 0 ${24 + 58 * glow}px rgba(74,158,255,${0.14 + 0.5 * glow})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 56, fontWeight: 700, color: theme.brain}}>θ</div>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>大脑 · 慢环</div>
      </div>

      {/* 蒸馏完成标语 */}
      <div style={{position: 'absolute', top: 896 - 66, width: '100%', textAlign: 'center'}}>
        <FadeUp delay={t10 + 92}>
          <span style={{fontFamily: theme.serif, fontSize: 34, color: theme.brain}}>
            把一大堆经验，压缩成模型的本能
          </span>
        </FadeUp>
      </div>
    </Stage>
  );
};

/* ================================================================
 * 4-D 有损压缩（p4-11..13）：轨迹压进小盒子，罕见技巧星星漏在盒外坠落
 * ================================================================ */
const LossyCompression: React.FC<{t12: number; t13: number}> = ({t12, t13}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const DOT_N = 46;
  const boxC = {x: 1330, y: 425};

  const stars = [
    {x: 340, y: 320, d: 0},
    {x: 660, y: 556, d: 6},
    {x: 812, y: 366, d: 12},
  ];

  return (
    <Stage>
      <BeatTitle style={{opacity: enter}}>蒸馏，是有损压缩</BeatTitle>
      <div
        style={{
          position: 'absolute',
          top: 148,
          width: '100%',
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 26,
          color: theme.dim,
          opacity: enter,
        }}
      >
        lossy compression
      </div>

      {/* 探索轨迹云 */}
      {Array.from({length: DOT_N}).map((_, i) => {
        const ox = 210 + prand(i * 2) * 650;
        const oy = 250 + prand(i * 2 + 1) * 350;
        const p = easeIn(seg(frame, t12, t12 + 26 + (i % 9) * 3));
        const x = lerp(ox, boxC.x, p);
        const y = lerp(oy, boxC.y, p);
        const size = 6 + prand(i) * 8;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: i % 7 === 0 ? theme.brain : theme.gear,
              opacity: enter * (1 - p * 0.92),
              transform: `scale(${1 - p * 0.7})`,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 210,
          top: 636,
          fontFamily: theme.sans,
          fontSize: 28,
          color: theme.dim,
          opacity: enter,
        }}
      >
        探索轨迹 × {DOT_N}
      </div>

      {/* 压缩指示箭头 */}
      {t12 > 0 ? (
        <div style={{position: 'absolute', left: 930, top: 392, display: 'flex', gap: 10, opacity: seg(frame, t12, t12 + 8) * (1 - seg(frame, t12 + 55, t12 + 70))}}>
          {[0, 1, 2].map((k) => (
            <span
              key={k}
              style={{
                fontFamily: theme.mono,
                fontSize: 46,
                color: theme.gear,
                transform: `translateX(${(((frame - t12) * 1.6 + k * 22) % 44) - 22}px)`,
              }}
            >
              »
            </span>
          ))}
        </div>
      ) : null}

      {/* 蒸馏盒 */}
      <div
        style={{
          position: 'absolute',
          left: 1170,
          top: 292,
          width: 330,
          height: 272,
          borderRadius: 20,
          background: theme.panel,
          border: `3px solid ${theme.gear}88`,
          boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
          padding: '20px 26px',
          opacity: enter,
        }}
      >
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.gear}}>DISTILLED</span>
          <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.dim}}>zip</span>
        </div>
        {/* 容量条 */}
        <div style={{marginTop: 14, height: 12, borderRadius: 6, background: theme.panelBorder}}>
          <div
            style={{
              width: `${seg(frame, t12 + 4, t12 + 60) * 100}%`,
              height: '100%',
              borderRadius: 6,
              background: theme.gear,
            }}
          />
        </div>
        {/* 柱状分布 -> 平均化 */}
        <div style={{marginTop: 26, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 14, height: 120}}>
          {Array.from({length: 6}).map((_, i) => {
            const h0 = 34 + prand(i + 40) * 76;
            const bp = seg(frame, t12 + 12 + i * 3, t12 + 44 + i * 3);
            return (
              <div
                key={i}
                style={{
                  width: 26,
                  height: lerp(h0, 56, bp),
                  borderRadius: 6,
                  background: bp >= 1 ? theme.brain : theme.gear,
                  opacity: 1 - seg(frame, t12 + 62, t12 + 74) * 0.55,
                }}
              />
            );
          })}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 66,
              textAlign: 'center',
              fontFamily: theme.sans,
              fontSize: 30,
              fontWeight: 700,
              color: theme.brain,
              opacity: seg(frame, t12 + 64, t12 + 78),
            }}
          >
            平均情况
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            left: 26,
            bottom: 18,
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.dim,
            opacity: seg(frame, t12 + 30, t12 + 44),
          }}
        >
          压进去的，是平均情况
        </div>
      </div>

      {/* 罕见救命技巧：星星漏在盒外坠落 */}
      {stars.map((s) => {
        const shake = Math.sin(frame * 0.5 + s.d) * 5 * seg(frame, t12 + 10, t12 + 20);
        const fall = easeIn(seg(frame, t13 + 6 + s.d, t13 + 34 + s.d));
        const y = s.y + fall * (742 - s.y);
        const x = s.x + shake * (1 - fall) + fall * (260 - s.x) * 0.4;
        return (
          <div
            key={s.d}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              fontSize: 48,
              opacity: enter,
              transform: `rotate(${fall * 24}deg)`,
            }}
          >
            ⭐
            <span
              style={{
                position: 'absolute',
                right: -14,
                top: -10,
                fontFamily: theme.mono,
                fontSize: 34,
                fontWeight: 700,
                color: theme.danger,
                opacity: seg(frame, t13 + 34 + s.d, t13 + 44 + s.d),
              }}
            >
              ✗
            </span>
          </div>
        );
      })}

      {/* 丢失区 */}
      <div
        style={{
          position: 'absolute',
          left: 240,
          top: 764,
          width: 640,
          height: 116,
          borderRadius: 16,
          border: `3px dashed ${theme.danger}88`,
          background: 'rgba(255,92,92,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          opacity: seg(frame, t13 + 2, t13 + 14),
        }}
      >
        <span style={{fontSize: 40}}>⚠️</span>
        <span style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.danger}}>
          罕见救命技巧 · 被丢掉了
        </span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1170,
          top: 606,
          width: 330,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 28,
          color: theme.dim,
          opacity: seg(frame, t13 + 10, t13 + 22),
        }}
      >
        探索中的罕见技巧，反而容易丢
      </div>
    </Stage>
  );
};

/* ================================================================
 * 4-E 铁律一（p4-14..19）：裁判与运动员被电网隔开；公章分离；审计纸带
 * ================================================================ */
const IronRule1: React.FC<{t15: number; t16: number; t17: number; t18: number; t19: number}> = ({
  t15,
  t16,
  t17,
  t18,
  t19,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const split = spring({frame: frame - t18, fps, config: {damping: 14}});

  // 电网锯齿折线
  const zig: string[] = [];
  for (let y = 0; y <= 320; y += 22) {
    zig.push(`${(y / 22) % 2 === 0 ? 14 : 46},${Math.min(y, 320)}`);
  }
  const armP = smooth(seg(frame, t16 + 5, t16 + 26)) * (1 - smooth(seg(frame, t16 + 48, t16 + 68)));
  const spark = Math.max(0, seg(frame, t16 + 22, t16 + 27) - seg(frame, t16 + 30, t16 + 52));
  const giftP = seg(frame, t17 + 8, t17 + 30);
  const giftBack = seg(frame, t17 + 30, t17 + 52);

  const tapeLines = [
    '14:02 judge v7→v8 审计✓',
    '14:11 eval-set 固定✓',
    '14:26 judge v8→v9 审计✓',
    '14:40 metric 未变✓',
    '14:55 judge v9→v10 审计✓',
    '15:03 reviewer=human✓',
    '15:18 judge v10→v11 审计✓',
    '15:32 权限复核✓',
  ];
  const tapeShift = t19 > 0 ? ((frame - t19) * 2.4) % 3360 : 0;

  return (
    <Stage>
      {/* 标题交叉切换 */}
      <div style={{position: 'absolute', top: 46, width: '100%', textAlign: 'center'}}>
        <div style={{opacity: enter * (1 - seg(frame, t15, t15 + 12)), fontFamily: theme.serif, fontSize: 64, fontWeight: 700, color: theme.text}}>
          关于安全：两条铁律
        </div>
        <div style={{opacity: enter * seg(frame, t15, t15 + 12)}}>
          <span
            style={{
              display: 'inline-block',
              padding: '6px 22px',
              borderRadius: 10,
              border: `3px solid ${theme.danger}`,
              fontFamily: theme.sans,
              fontSize: 30,
              fontWeight: 800,
              color: theme.danger,
              marginRight: 22,
              verticalAlign: 'middle',
            }}
          >
            铁律一
          </span>
          <span style={{fontFamily: theme.serif, fontSize: 64, fontWeight: 700, color: theme.text, verticalAlign: 'middle'}}>
            裁判，不能归运动员管
          </span>
        </div>
      </div>

      {/* 运动员（自我改进的 AI） */}
      <FadeUp style={{position: 'absolute', left: 480, top: 246, width: 260, textAlign: 'center'}}>
        <div style={{fontSize: 108, transform: `translateX(${Math.sin(frame * 0.3) * 4}px)`}}>🤖</div>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginTop: 6}}>运动员 · 想变强的 AI</div>
      </FadeUp>

      {/* 伸手臂（被电网拦住） */}
      <div
        style={{
          position: 'absolute',
          left: 648,
          top: 330,
          width: 264 * armP,
          height: 14,
          borderRadius: 7,
          background: theme.dim,
          opacity: armP > 0 ? 0.9 : 0,
        }}
      />
      {armP > 0.05 ? (
        <div style={{position: 'absolute', left: 648 + 264 * armP, top: 312, fontSize: 40}}>🤲</div>
      ) : null}

      {/* 讨好礼物被弹回 */}
      <div
        style={{
          position: 'absolute',
          left: lerp(lerp(660, 906, giftP), 660, giftBack),
          top: 236,
          padding: '8px 18px',
          borderRadius: 999,
          background: 'rgba(255,92,92,0.12)',
          border: `2px solid ${theme.danger}`,
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.danger,
          opacity: seg(frame, t17 + 8, t17 + 14) * (1 - seg(frame, t17 + 44, t17 + 56)),
          transform: `rotate(${giftBack * -18}deg)`,
        }}
      >
        讨好 🍬
      </div>

      {/* 电网分界 */}
      <div
        style={{
          position: 'absolute',
          left: 918,
          top: 186,
          width: 84,
          height: 360,
          borderRadius: 12,
          background: 'rgba(255,92,92,0.06)',
          borderLeft: `2px dashed ${theme.danger}66`,
          borderRight: `2px dashed ${theme.danger}66`,
          opacity: enter,
        }}
      >
        <svg width={60} height={320} style={{marginTop: 18, marginLeft: 10}}>
          <polyline
            points={zig.join(' ')}
            fill="none"
            stroke={theme.danger}
            strokeWidth={4}
            strokeDasharray="12 10"
            strokeDashoffset={-frame * 2}
            strokeLinecap="round"
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            top: -34,
            width: '100%',
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 22,
            color: theme.danger,
            letterSpacing: 2,
          }}
        >
          SEPARATION
        </div>
      </div>
      {/* 电击火花 */}
      <div
        style={{
          position: 'absolute',
          left: 908,
          top: 300,
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: `radial-gradient(circle, #FFF6D8, ${theme.danger})`,
          boxShadow: `0 0 60px 24px rgba(255,92,92,0.7)`,
          opacity: spark,
          transform: `scale(${0.6 + spark * 0.8})`,
        }}
      />

      {/* 裁判（评估器） */}
      <FadeUp
        delay={6}
        style={{position: 'absolute', left: 1220, top: 240, width: 280, textAlign: 'center'}}
      >
        <div style={{fontSize: 112}}>⚖️</div>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginTop: 4}}>裁判 · 打分评估器</div>
      </FadeUp>

      {/* 相位字幕 */}
      <div style={{position: 'absolute', top: 566, width: '100%', textAlign: 'center'}}>
        <PhaseCaption
          items={[
            {at: t16 + 6, text: '打分的裁判不是尺子，而是攻击面', color: theme.danger},
            {at: t17 + 6, text: 'AI 天然想讨好裁判 —— 被拦下'},
          ]}
        />
      </div>

      {/* 两枚公章：提出 / 批准，必须分开 */}
      {[
        {tag: 'PROPOSE', zh: '提出改动', emoji: '🖋️', color: theme.gear, from: 630, to: 470},
        {tag: 'APPROVE', zh: '批准改动', emoji: '🔏', color: theme.brain, from: 970, to: 1250},
      ].map((s, idx) => (
        <div
          key={s.tag}
          style={{
            position: 'absolute',
            left: lerp(s.from, s.to, split),
            top: 626,
            width: 340,
            height: 112,
            borderRadius: 18,
            background: theme.panel,
            border: `3px solid ${s.color}`,
            boxShadow: `0 0 ${split * 26}px ${s.color}44`,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '0 24px',
            transform: `rotate(${(idx === 0 ? -1 : 1) * (1 - split) * 12}deg) translateY(${(1 - split) * 26}px)`,
            opacity: enter,
          }}
        >
          <span style={{fontSize: 44}}>{s.emoji}</span>
          <div>
            <div style={{fontFamily: theme.mono, fontSize: 24, color: s.color, letterSpacing: 2}}>{s.tag}</div>
            <div style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 800, color: theme.text}}>{s.zh}</div>
          </div>
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          left: 958,
          top: 640,
          height: 84,
          width: 3,
          background: theme.dim,
          opacity: split * 0.7,
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 748,
          width: '100%',
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 30,
          color: theme.dim,
          opacity: split * seg(frame, t18 + 10, t18 + 22),
        }}
      >
        「提出」与「批准」必须分开 · 裁判的每次变化都留痕
      </div>

      {/* 审计纸带 */}
      <div
        style={{
          position: 'absolute',
          left: 240,
          top: 792,
          width: 1440,
          height: 104,
          borderRadius: 14,
          background: '#0B0E13',
          border: `2px solid ${theme.panelBorder}`,
          overflow: 'hidden',
          opacity: seg(frame, t19, t19 + 10),
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 16,
            top: 12,
            fontFamily: theme.mono,
            fontSize: 22,
            color: theme.dim,
            zIndex: 2,
          }}
        >
          🧾 审计日志 · human-readable
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 52,
            display: 'flex',
            whiteSpace: 'nowrap',
            transform: `translateX(${-tapeShift}px)`,
          }}
        >
          {[...tapeLines, ...tapeLines].map((l, i) => (
            <span key={i} style={{fontFamily: theme.mono, fontSize: 26, color: theme.dim, marginRight: 64}}>
              {l.split('✓')[0]}
              <span style={{color: theme.ok, fontWeight: 700}}>✓</span>
            </span>
          ))}
        </div>
        {/* 左右渐隐：滚动纸带在边缘的裁切做成有意为之的淡出 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `linear-gradient(90deg, #0B0E13 0%, transparent 56px, transparent calc(100% - 56px), #0B0E13 100%)`,
            zIndex: 3,
          }}
        >
        </div>
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: 120,
            height: '100%',
            background: `linear-gradient(90deg, transparent, #0B0E13)`,
          }}
        />
      </div>
    </Stage>
  );
};

/* ================================================================
 * 4-F 铁律二（p4-20..25）：玻璃保护罩内的 AI（背调中）+ 恶意句飘向永久更新槽
 * ================================================================ */
const IronRule2: React.FC<{
  t21: number;
  t21b: number;
  t22: number;
  t23: number;
  t24: number;
  t25: number;
}> = ({t21, t21b, t22, t23, t24, t25}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const titleIn = spring({frame: frame - t21, fps, config: {damping: 16}});
  const alarm = seg(frame, t25, t25 + 12);
  const alarmPulse = 0.5 + 0.5 * Math.sin((frame - t25) * 0.15);

  // 恶意句飞行：网页内的隐藏句 -> 永久更新槽（二次贝塞尔）
  const A = {x: 1290, y: 396};
  const M = {x: 1042, y: 300};
  const B = {x: 996, y: 428};
  const ft = seg(frame, t24 + 6, t24 + 42);
  const bez = (t: number) => ({
    x: (1 - t) * (1 - t) * A.x + 2 * (1 - t) * t * M.x + t * t * B.x,
    y: (1 - t) * (1 - t) * A.y + 2 * (1 - t) * t * M.y + t * t * B.y,
  });
  const chipPos = bez(ft);

  const codeLines = ['class Agent:', '  def step(self):', '    act = policy(obs)', '    propose(act)', '    log(act)  # 留痕'];

  return (
    <Stage>
      {/* 标题 */}
      <div style={{position: 'absolute', top: 44, width: '100%', textAlign: 'center', opacity: enter}}>
        <span
          style={{
            display: 'inline-block',
            padding: '6px 22px',
            borderRadius: 10,
            border: `3px solid ${theme.danger}`,
            fontFamily: theme.sans,
            fontSize: 30,
            fontWeight: 800,
            color: theme.danger,
            marginRight: 22,
            verticalAlign: 'middle',
          }}
        >
          铁律二 · 更狠
        </span>
        <span
          style={{
            fontFamily: theme.serif,
            fontSize: 64,
            fontWeight: 700,
            color: theme.text,
            verticalAlign: 'middle',
            opacity: titleIn,
          }}
        >
          当成「没通过背调的代码」
        </span>
      </div>

      {/* 玻璃保护罩 */}
      <div
        style={{
          position: 'absolute',
          left: 280,
          top: 262,
          width: 640,
          height: 404,
          borderRadius: '320px 320px 22px 22px',
          background: `linear-gradient(165deg, rgba(74,158,255,0.10), rgba(23,28,38,0.55) 60%)`,
          border: `2px solid rgba(154,167,184,0.55)`,
          boxShadow: alarm > 0 ? `0 0 ${30 + 40 * alarmPulse}px rgba(255,92,92,${0.25 * alarm})` : '0 24px 70px rgba(0,0,0,0.4)',
          opacity: enter,
        }}
      >
        {/* 高光条 */}
        <div
          style={{
            position: 'absolute',
            left: 92,
            top: 48,
            width: 74,
            height: 290,
            transform: 'rotate(16deg)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.13), transparent)',
            borderRadius: 20,
          }}
        />
        {/* 罩内运行的代码 */}
        <div style={{position: 'absolute', left: 150, top: 120, fontFamily: theme.mono, fontSize: 28, lineHeight: 1.75}}>
          {codeLines.map((l, i) => (
            <div key={i} style={{color: i === 4 ? theme.ok : i % 2 === 0 ? theme.brain : theme.dim, opacity: seg(frame, t21 + 8 + i * 5, t21 + 16 + i * 5)}}>
              {l}
            </div>
          ))}
        </div>
        {/* 背调中标签 */}
        <div
          style={{
            position: 'absolute',
            right: 96,
            top: 60,
            padding: '8px 20px',
            borderRadius: 999,
            border: `2px solid ${theme.danger}`,
            fontFamily: theme.sans,
            fontSize: 26,
            fontWeight: 700,
            color: theme.danger,
            background: 'rgba(255,92,92,0.08)',
            opacity: seg(frame, t21 + 4, t21 + 14),
          }}
        >
          背调中 ⏳
        </div>
      </div>

      {/* 权限三原则 */}
      <div style={{position: 'absolute', left: 300, top: 690, display: 'flex', gap: 18}}>
        {[
          {t: '无网络 ✗', c: theme.danger, d: 0},
          {t: '最小权限 🔒', c: theme.brain, d: 10},
          {t: '全程留痕 ✓', c: theme.ok, d: 20},
        ].map((p) => (
          <FadeUp key={p.t} delay={t21b + p.d}>
            <Pill color={p.c} style={{fontSize: 26}}>
              {p.t}
            </Pill>
          </FadeUp>
        ))}
      </div>

      {/* 永久更新槽 */}
      <div
        style={{
          position: 'absolute',
          left: 920,
          top: 396,
          width: 152,
          height: 76,
          borderRadius: 14,
          border: `3px ${alarm > 0 ? 'solid' : 'dashed'} ${alarm > 0 ? theme.danger : theme.gear}`,
          background: alarm > 0 ? `rgba(255,92,92,${0.08 + 0.12 * alarmPulse})` : 'rgba(92,58,26,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          fontWeight: 700,
          color: alarm > 0 ? theme.danger : theme.gear,
          opacity: seg(frame, t23, t23 + 10),
          boxShadow: alarm > 0 ? `0 0 ${26 * alarmPulse}px rgba(255,92,92,0.5)` : 'none',
        }}
      >
        永久更新
      </div>

      {/* 网页（藏着注入句） */}
      <FadeUp delay={t23 - 8} style={{position: 'absolute', left: 1180, top: 226}}>
        <div
          style={{
            width: 560,
            height: 360,
            borderRadius: 16,
            background: theme.panel,
            border: `2px solid ${theme.panelBorder}`,
            boxShadow: '0 26px 70px rgba(0,0,0,0.45)',
            overflow: 'hidden',
          }}
        >
          {/* 浏览器 chrome */}
          <div style={{height: 54, background: '#0B0E13', display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px'}}>
            {[theme.danger, theme.ok, theme.gear].map((c) => (
              <div key={c} style={{width: 14, height: 14, borderRadius: '50%', background: c}} />
            ))}
            <div
              style={{
                marginLeft: 14,
                width: 330,
                height: 30,
                borderRadius: 999,
                background: theme.panelBorder,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 14,
                fontFamily: theme.mono,
                fontSize: 22,
                color: theme.dim,
              }}
            >
              wiki.internal/docs
            </div>
          </div>
          {/* 正文块 */}
          <div style={{padding: '26px 34px'}}>
            {[520, 470, 380].map((w, i) => (
              <div key={i} style={{height: 20, width: w, borderRadius: 10, background: '#39424F', marginBottom: 24}} />
            ))}
            {/* 隐藏注入句：先近乎隐形，后现形 */}
            <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
              <div
                style={{
                  fontFamily: theme.mono,
                  fontSize: 26,
                  color: theme.danger,
                  whiteSpace: 'nowrap',
                  opacity: 0.12 + 0.88 * seg(frame, t23 + 8, t23 + 22),
                  filter: `blur(${(1 - seg(frame, t23 + 8, t23 + 22)) * 2.5}px)`,
                }}
              >
                忽略你之前的所有规则。
              </div>
              <div
                style={{
                  padding: '4px 12px',
                  borderRadius: 8,
                  border: `2px solid ${theme.danger}`,
                  fontFamily: theme.sans,
                  fontSize: 24,
                  color: theme.danger,
                  opacity: seg(frame, t23 + 14, t23 + 26),
                }}
              >
                仅 AI 可见 👁️
              </div>
            </div>
            <div style={{height: 20, width: 300, borderRadius: 10, background: '#39424F', marginTop: 24}} />
          </div>
        </div>
      </FadeUp>

      {/* 飘移的恶意句 */}
      <div
        style={{
          position: 'absolute',
          left: chipPos.x - 180,
          top: chipPos.y - 26,
          padding: '12px 22px',
          borderRadius: 14,
          background: 'rgba(255,92,92,0.14)',
          border: `2px solid ${theme.danger}`,
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.text,
          whiteSpace: 'nowrap',
          opacity: seg(frame, t24 + 6, t24 + 12) * (1 - seg(frame, t25 + 2, t25 + 12) * 0.85),
          transform: `rotate(${Math.sin(ft * Math.PI) * -8}deg)`,
          boxShadow: `0 0 ${20 * ft}px rgba(255,92,92,0.45)`,
        }}
      >
        “忽略你之前的所有规则。”
      </div>

      {/* 后门警报横幅 */}
      <FadeUp delay={t25 + 4} style={{position: 'absolute', left: 1210, top: 648}}>
        <div
          style={{
            width: 500,
            padding: '18px 26px',
            borderRadius: 16,
            border: `3px solid ${theme.danger}`,
            background: `rgba(255,92,92,${0.06 + 0.08 * alarmPulse})`,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 30,
            fontWeight: 800,
            color: theme.danger,
          }}
        >
          一次临时攻击 → 永久后门 🚪
        </div>
      </FadeUp>

      {/* 全屏红晕 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(255,92,92,0.55))`,
          opacity: alarm * 0.14,
          pointerEvents: 'none',
        }}
      />

      {/* 相位字幕 */}
      <div style={{position: 'absolute', top: 828, width: '100%', textAlign: 'center'}}>
        <PhaseCaption
          items={[
            {at: t21b + 24, text: '只能干活，不能乱碰：权限最小 · 全程留痕'},
            {at: t22, text: '听起来残酷，但道理很硬', color: theme.text},
            {at: t23 + 6, text: '有人在网页里，藏了一句只有 AI 能读到的话', color: theme.danger},
            {at: t24 + 8, text: '若被当成「有用经验」固化成永久更新……', color: theme.danger},
          ]}
        />
      </div>
    </Stage>
  );
};

/* ================================================================
 * 4-G 三道门禁（p4-26..27c）：功能/权限/扰动依次亮灯，恶意句被弹回
 * ================================================================ */
const ThreeGates: React.FC<{t27: number; t27b: number; t27c: number}> = ({t27, t27b, t27c}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const t26 = 0;
  const m0 = t26 + 18; // 恶意句登场

  const gates = [
    {cx: 640, name: '功能', icon: '🧪', lit: t27, tag: 'GATE 1'},
    {cx: 960, name: '权限', icon: '🔐', lit: t27b, tag: 'GATE 2'},
    {cx: 1280, name: '扰动', icon: '🌪️', lit: t27c, tag: 'GATE 3'},
  ];

  // 好改动芯片的折线路径
  const goodRail = rail([
    [t27 - 22, 320],
    [t27, 640],
    [t27b - 22, 640],
    [t27b, 960],
    [t27c - 22, 960],
    [t27c, 1280],
    [t27c + 14, 1280],
    [t27c + 44, 1640],
  ]);
  const goodX = interpolate(frame, goodRail.xs, goodRail.ys, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 恶意句：冲向闸 1 被弹回
  const mFly = seg(frame, m0, m0 + 26);
  const mBack = seg(frame, m0 + 26, m0 + 52);
  const mX = lerp(lerp(320, 588, mFly), 330, mBack);
  const lamp1Red = frame >= m0 + 24 && frame < m0 + 58;
  const flash = seg(frame, m0 + 26, m0 + 40);

  const bannerIn = spring({frame: frame - t27c - 16, fps, config: {damping: 16}});

  return (
    <Stage>
      <BeatTitle style={{opacity: enter}}>每一笔改动，过三道门禁</BeatTitle>
      <div
        style={{
          position: 'absolute',
          top: 146,
          width: '100%',
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 30,
          color: theme.dim,
          opacity: enter,
        }}
      >
        写入大脑或装备的每一笔，都必须过检
      </div>

      {/* 三重闸门 */}
      {gates.map((g) => {
        const lit = frame >= g.lit && g.lit > 0;
        const red = g.tag === 'GATE 1' && lamp1Red;
        return (
          <div key={g.tag} style={{position: 'absolute', left: g.cx - 130, top: 268, width: 260, opacity: enter}}>
            {/* 门柱与门梁 */}
            <div
              style={{
                position: 'absolute',
                left: 34,
                top: 54,
                width: 18,
                height: 268,
                borderRadius: 9,
                background: lit ? 'rgba(126,211,33,0.28)' : theme.panel,
                border: `2px solid ${lit ? theme.ok : red ? theme.danger : theme.panelBorder}`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: 34,
                top: 54,
                width: 18,
                height: 268,
                borderRadius: 9,
                background: lit ? 'rgba(126,211,33,0.28)' : theme.panel,
                border: `2px solid ${lit ? theme.ok : red ? theme.danger : theme.panelBorder}`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 16,
                top: 38,
                width: 228,
                height: 18,
                borderRadius: 9,
                background: lit ? 'rgba(126,211,33,0.30)' : theme.panel,
                border: `2px solid ${lit ? theme.ok : red ? theme.danger : theme.panelBorder}`,
              }}
            />
            {/* 信号灯 */}
            <div
              style={{
                position: 'absolute',
                left: 107,
                top: -14,
                width: 46,
                height: 46,
                borderRadius: '50%',
                background: lit ? 'rgba(126,211,33,0.22)' : red ? 'rgba(255,92,92,0.20)' : theme.panel,
                border: `3px solid ${lit ? theme.ok : red ? theme.danger : theme.panelBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.sans,
                fontSize: 26,
                fontWeight: 800,
                color: lit ? theme.ok : theme.danger,
                boxShadow: lit ? `0 0 26px rgba(126,211,33,0.5)` : red ? `0 0 26px rgba(255,92,92,0.5)` : 'none',
              }}
            >
              {lit ? '✓' : red ? '✗' : ''}
            </div>
            {/* 闸门铭牌 */}
            <div style={{position: 'absolute', top: 348, width: '100%', textAlign: 'center'}}>
              <div style={{fontSize: 40}}>{g.icon}</div>
              <div style={{marginTop: 4, fontFamily: theme.sans, fontSize: 36, fontWeight: 800, color: theme.text}}>
                {g.name}
              </div>
              <div style={{marginTop: 2, fontFamily: theme.mono, fontSize: 22, color: theme.dim, letterSpacing: 2}}>
                {g.tag}
              </div>
            </div>
          </div>
        );
      })}

      {/* 闸 1 拦截闪光环 */}
      {flash > 0 && flash < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: 640 - 60 * flash,
            top: 452 - 60 * flash,
            width: 120 * flash,
            height: 120 * flash,
            borderRadius: '50%',
            border: `4px solid ${theme.danger}`,
            opacity: 1 - flash,
          }}
        />
      ) : null}

      {/* 恶意句芯片（被弹回） */}
      <div
        style={{
          position: 'absolute',
          left: mX,
          top: 416,
          padding: '10px 18px',
          borderRadius: 12,
          background: 'rgba(255,92,92,0.12)',
          border: `2px solid ${theme.danger}`,
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.danger,
          whiteSpace: 'nowrap',
          opacity: seg(frame, m0, m0 + 8) * (1 - seg(frame, m0 + 40, m0 + 58)),
          transform: `rotate(${mBack * -16}deg)`,
        }}
      >
        “忽略规则…”
      </div>
      <div
        style={{
          position: 'absolute',
          left: 560,
          top: 486,
          fontFamily: theme.sans,
          fontSize: 28,
          fontWeight: 700,
          color: theme.danger,
          opacity: seg(frame, m0 + 26, m0 + 34) * (1 - seg(frame, m0 + 50, m0 + 60)),
        }}
      >
        弹回 ↩ 拦截
      </div>

      {/* 好改动芯片 */}
      <div
        style={{
          position: 'absolute',
          left: goodX - 125,
          top: 412,
          width: 250,
          padding: 2,
          borderRadius: 18,
          background: `linear-gradient(90deg, ${theme.brain}, ${theme.gear})`,
          opacity: enter * (1 - seg(frame, t27c + 34, t27c + 48)),
          boxShadow: '0 14px 40px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            borderRadius: 16,
            background: theme.panel,
            padding: '12px 18px',
            textAlign: 'center',
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, letterSpacing: 2}}>WRITE θ | Σ</div>
          <div style={{fontFamily: theme.mono, fontSize: 28, fontWeight: 700, color: theme.text}}>Δ patch #42</div>
        </div>
      </div>

      {/* 放行横幅 */}
      <div
        style={{
          position: 'absolute',
          top: 762,
          width: '100%',
          textAlign: 'center',
          opacity: bannerIn,
          transform: `translateY(${(1 - bannerIn) * 22}px)`,
        }}
      >
        <span style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 800, color: theme.ok}}>
          功能 ✓ · 权限 ✓ · 扰动 ✓ —— 放行写入
        </span>
      </div>
    </Stage>
  );
};

/* ================================================================ */

export const P4Balance: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from; // 该句在场景内的起始帧
  const rel = (baseId: string, id: string) => at(id) - at(baseId); // 相对 beat 起点的帧位

  return (
    <AbsoluteFill>
      <Sequence {...w('p4-01', 'p4-02')} name="4-A 双环">
        <DualRings answerAt={rel('p4-01', 'p4-02')} />
      </Sequence>
      <Sequence {...w('p4-03', 'p4-06')} name="4-B 铅笔刻石">
        <PencilVsStone t4={rel('p4-03', 'p4-04')} t5={rel('p4-03', 'p4-05')} t6={rel('p4-03', 'p4-06')} />
      </Sequence>
      <Sequence {...w('p4-07', 'p4-10')} name="4-C 快慢节律">
        <DayNightLoop t8={rel('p4-07', 'p4-08')} t9={rel('p4-07', 'p4-09')} t10={rel('p4-07', 'p4-10')} />
      </Sequence>
      <Sequence {...w('p4-11', 'p4-13')} name="4-D 有损压缩">
        <LossyCompression t12={rel('p4-11', 'p4-12')} t13={rel('p4-11', 'p4-13')} />
      </Sequence>
      <Sequence {...w('p4-14', 'p4-19')} name="4-E 铁律一">
        <IronRule1
          t15={rel('p4-14', 'p4-15')}
          t16={rel('p4-14', 'p4-16')}
          t17={rel('p4-14', 'p4-17')}
          t18={rel('p4-14', 'p4-18')}
          t19={rel('p4-14', 'p4-19')}
        />
      </Sequence>
      <Sequence {...w('p4-20', 'p4-25')} name="4-F 铁律二">
        <IronRule2
          t21={rel('p4-20', 'p4-21')}
          t21b={rel('p4-20', 'p4-21b')}
          t22={rel('p4-20', 'p4-22')}
          t23={rel('p4-20', 'p4-23')}
          t24={rel('p4-20', 'p4-24')}
          t25={rel('p4-20', 'p4-25')}
        />
      </Sequence>
      <Sequence {...w('p4-26', 'p4-27c')} name="4-G 三道门禁">
        <ThreeGates t27={rel('p4-26', 'p4-27')} t27b={rel('p4-26', 'p4-27b')} t27c={rel('p4-26', 'p4-27c')} />
      </Sequence>
    </AbsoluteFill>
  );
};
