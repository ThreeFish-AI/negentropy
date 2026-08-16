import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {ChapterCard, FadeUp, Pill, QuoteCard} from '../components/cards';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';

/* ---------------- 通用小件 ---------------- */

/** 方法英文名角标 */
const MethodTag: React.FC<{name: string; delay?: number}> = ({name, delay = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - delay, fps, config: {damping: 200}});
  return (
    <div
      style={{
        opacity: enter,
        transform: `translateY(${(1 - enter) * 16}px)`,
        padding: '6px 18px',
        borderRadius: 10,
        background: '#05070B',
        border: `1.5px solid ${theme.panelBorder}`,
        fontFamily: theme.mono,
        fontSize: 24,
        color: theme.dim,
        whiteSpace: 'nowrap',
      }}
    >
      {name}
    </div>
  );
};

/** 大脑小图标（🧠 + 蓝描边圆底） */
const BrainGlyph: React.FC<{size?: number}> = ({size = 64}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.32,
      background: `linear-gradient(135deg, ${theme.brainDeep}, ${theme.panel})`,
      border: `2px solid ${theme.brain}`,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontSize: size * 0.55,
      boxShadow: `0 0 36px ${theme.brain}33`,
    }}
  >
    🧠
  </div>
);

/** 细进度条（训练） */
const TrainBar: React.FC<{progress: number; color?: string; label?: string}> = ({
  progress,
  color = theme.brain,
  label = '训练',
}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
    <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>{label}</span>
    <div style={{width: 200, height: 12, borderRadius: 6, background: theme.panelBorder}}>
      <div
        style={{
          width: `${progress * 100}%`,
          height: '100%',
          borderRadius: 6,
          background: color,
          boxShadow: `0 0 14px ${color}66`,
        }}
      />
    </div>
  </div>
);

/** 镜头节拍编号（右上角小字，帮观众对上"功法几"） */
const BeatBadge: React.FC<{text: string; color?: string}> = ({text, color = theme.brain}) => (
  <div
    style={{
      position: 'absolute',
      top: 46,
      right: 70,
      fontFamily: theme.mono,
      fontSize: 26,
      color,
      letterSpacing: 3,
      border: `1.5px solid ${color}55`,
      borderRadius: 10,
      padding: '8px 20px',
      background: '#05070B88',
    }}
  >
    {text}
  </div>
);

/* ---------------- 2-A 章头 ---------------- */

const ChapterHead: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const trainP = interpolate(frame, [30, 110], [0, 0.85], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill>
      <BeatBadge text="第 5 章" />
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
        <ChapterCard kicker="第一条路" title="改大脑" accent={theme.brain} />
      </AbsoluteFill>
      <FadeUp delay={36} style={{position: 'absolute', left: 160, top: 200}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 20}}>
          <BrainGlyph />
          <TrainBar progress={trainP} />
        </div>
      </FadeUp>
      <FadeUp delay={52} style={{position: 'absolute', right: 170, top: 330}}>
        <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.dim}}>θ · 参数微调</div>
      </FadeUp>
      <FadeUp delay={66} style={{position: 'absolute', left: 200, bottom: 320}}>
        <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
          唯一办法：<span style={{color: theme.brain, fontWeight: 700}}>训练</span>——但题从哪来？
        </div>
      </FadeUp>
      <FadeUp delay={82} style={{position: 'absolute', right: 210, bottom: 240}}>
        <div style={{display: 'flex', gap: 14}}>
          <Pill color={theme.brain}>功法一 · 自己出题</Pill>
          <Pill color={theme.brain}>功法二 · 自己当裁判</Pill>
          <Pill color={theme.brain}>功法三 · 真实世界</Pill>
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/* ---------------- 2-B 功法一：自己出题 ---------------- */

/** 出题循环图核心：模型 → 生成题目 → 筛选 → 训练 → 模型 */
const QuestionLoop: React.FC<{step: number; skew?: number; danger?: boolean}> = ({
  step,
  skew = 0,
  danger = false,
}) => {
  const frame = useCurrentFrame();
  const accent = danger ? theme.danger : theme.brain;
  const nodes = [
    {t: '模型', icon: '🧠'},
    {t: '生成题目', icon: '✏️'},
    {t: '筛选', icon: '🔍'},
    {t: '训练', icon: '💪'},
  ];
  const R = 250;
  const pos = nodes.map((_, i) => {
    const a = -Math.PI / 2 + (i / nodes.length) * Math.PI * 2;
    return {x: Math.cos(a) * R, y: Math.sin(a) * R * 0.78};
  });
  return (
    <div
      style={{
        position: 'relative',
        width: 640,
        height: 500,
        transform: `rotate(${skew}deg)`,
      }}
    >
      <svg width="640" height="500" style={{position: 'absolute', inset: 0}}>
        {pos.map((p, i) => {
          const q = pos[(i + 1) % 4];
          const mx = (p.x + q.x) / 2 + 320;
          const my = (p.y + q.y) / 2 + 250;
          const active = step % 4 === i;
          return (
            <g key={i}>
              <path
                d={`M ${p.x + 320} ${p.y + 250} Q ${mx} ${my} ${q.x + 320} ${q.y + 250}`}
                fill="none"
                stroke={accent}
                strokeWidth={active ? 3 : 1.5}
                opacity={active ? 0.95 : 0.35}
              />
              {active ? (
                <circle r={7} fill={accent}>
                  <animateMotion
                    dur="1.2s"
                    repeatCount="indefinite"
                    path={`M ${p.x + 320} ${p.y + 250} Q ${mx} ${my} ${q.x + 320} ${q.y + 250}`}
                  />
                </circle>
              ) : null}
            </g>
          );
        })}
      </svg>
      {nodes.map((n, i) => {
        const active = step % 4 === i;
        return (
          <div
            key={n.t}
            style={{
              position: 'absolute',
              left: 320 + pos[i].x - 80,
              top: 250 + pos[i].y - 52,
              width: 160,
              height: 104,
              borderRadius: 18,
              background: active ? (danger ? '#2A0F12' : theme.brainDeep) : theme.panel,
              border: `2px solid ${active ? accent : theme.panelBorder}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              opacity: active ? 1 : 0.7,
              boxShadow: active ? `0 0 40px ${accent}55` : 'none',
              transform: `scale(${active ? 1 + Math.sin(frame * 0.1) * 0.015 : 1})`,
            }}
          >
            <span style={{fontSize: 38}}>{n.icon}</span>
            <span
              style={{
                fontFamily: theme.sans,
                fontSize: 26,
                fontWeight: 600,
                color: active ? theme.text : theme.dim,
              }}
            >
              {n.t}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const SkillOne: React.FC<{stage: number}> = ({stage}) => {
  // stage: 1 雪球 2 难度 3 STaR 4 考场现学
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', gap: 36}}>
      <BeatBadge text="功法一 · 自己出题，自己练" />
      <QuestionLoop step={Math.floor(frame / 26)} />
      {stage === 1 ? (
        <FadeUp style={{position: 'absolute', left: 140, top: 150}}>
          <Snowball />
        </FadeUp>
      ) : null}
      {stage === 2 ? (
        <FadeUp style={{position: 'absolute', left: 140, top: 150}}>
          <EvolDiff />
        </FadeUp>
      ) : null}
      {stage === 3 ? (
        <FadeUp style={{position: 'absolute', left: 140, top: 150}}>
          <StarFilter />
        </FadeUp>
      ) : null}
      {stage === 4 ? (
        <FadeUp style={{position: 'absolute', left: 140, top: 150}}>
          <TestTime />
        </FadeUp>
      ) : null}
    </AbsoluteFill>
  );
};

/** 雪球滚大（Self-Instruct）：小球带轨迹滚成大球 */
const Snowball: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const grow = spring({frame, fps, config: {damping: 200}});
  const size = 18 + grow * 64;
  const seeds = ['1+1', 'A→B', 'q₃', '…', 'q₈₉', 'q₉₀'];
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 26}}>
        {seeds.map((s, i) => {
          const on = frame > 18 + i * 10;
          return (
            <div
              key={s + String(i)}
              style={{
                fontFamily: theme.mono,
                fontSize: 24,
                color: on ? theme.brain : theme.panelBorder,
                opacity: on ? 1 : 0.4,
                transform: `translateY(${on ? 0 : 10}px)`,
                transition: 'none',
              }}
            >
              {s}
            </div>
          );
        })}
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 35%, #7DB9FF, ${theme.brain})`,
            boxShadow: `0 0 34px ${theme.brain}66`,
            marginLeft: 10,
          }}
        />
      </div>
      <MethodTag name="Self-Instruct" delay={30} />
      <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
        一小把种子题 → 滚成整个题库
      </div>
    </div>
  );
};

/** 难度条上升（Evol-Instruct） */
const EvolDiff: React.FC = () => {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [10, 70], [0.2, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'flex-end', gap: 16, height: 170}}>
        {[0.3, 0.55, 0.75, 1].map((h, i) => {
          const grow = interpolate(rise, [0, 1], [0.15, h]);
          return (
            <div
              key={i}
              style={{
                width: 40,
                height: grow * 150,
                borderRadius: 8,
                background: i === 3 ? theme.brain : theme.brainDeep,
                border: `1.5px solid ${i === 3 ? theme.brain : theme.panelBorder}`,
              }}
            />
          );
        })}
      </div>
      <MethodTag name="Evol-Instruct" delay={14} />
      <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
        一轮轮把题目改难，专造变态难题
      </div>
    </div>
  );
};

/** STaR：一堆解法，只留 ✓ 的 */
const StarFilter: React.FC = () => {
  const frame = useCurrentFrame();
  const drop = interpolate(frame, [14, 44], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 18}}>
        {[
          {ok: true, t: '解法A'},
          {ok: false, t: '解法B'},
          {ok: true, t: '解法C'},
          {ok: false, t: '解法D'},
          {ok: true, t: '解法E'},
        ].map((s, i) => (
          <div
            key={s.t}
            style={{
              width: 118,
              height: 84,
              borderRadius: 14,
              background: s.ok && drop > (i % 3) * 0.28 ? theme.brainDeep : theme.panel,
              border: `2px solid ${
                s.ok && drop > (i % 3) * 0.28 ? theme.brain : theme.panelBorder
              }`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontFamily: theme.sans,
              fontSize: 26,
              color: s.ok && drop > (i % 3) * 0.28 ? theme.text : theme.dim,
              opacity: s.ok || drop < 0.5 ? 1 : 0.28,
              textDecoration: s.ok ? 'none' : 'line-through',
            }}
          >
            {s.ok ? '✓ ' : '✗ '}
            {s.t}
          </div>
        ))}
      </div>
      <MethodTag name="STaR · 验证器过滤" delay={20} />
      <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
        只把<span style={{color: theme.ok, fontWeight: 700}}>对的</span>留下来练
      </div>
    </div>
  );
};

/** 考场现学（TT-SI）：小考卷闪现 + 快速微调旋钮 */
const TestTime: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tune = spring({frame: frame - 16, fps, config: {damping: 12}});
  const knobs = [0, 1, 2, 3, 4, 5];
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 34}}>
        <div
          style={{
            width: 190,
            height: 130,
            borderRadius: 10,
            background: theme.panel,
            border: `2px solid ${theme.brain}`,
            padding: 14,
            transform: `rotate(-4deg)`,
            boxShadow: `0 0 30px ${theme.brain}33`,
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginBottom: 8}}>
            同款练习 ×3
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 10,
                marginBottom: 9,
                borderRadius: 5,
                background: theme.panelBorder,
                width: `${60 + i * 12}%`,
              }}
            />
          ))}
        </div>
        <div style={{fontSize: 44, color: theme.brain}}>→</div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 34px)', gap: 12}}>
          {knobs.map((k) => (
            <div
              key={k}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: `2px solid ${theme.brain}`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: 3,
                  height: 12,
                  background: theme.brain,
                  borderRadius: 2,
                  transformOrigin: '50% 13px',
                  transform: `rotate(${tune * (60 + k * 47)}deg)`,
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <MethodTag name="TT-SI · Test-Time Self-Improvement" delay={24} />
      <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
        拿不准 → 当场出题 → <span style={{color: theme.brain, fontWeight: 700}}>真改大脑</span>，又小又快
      </div>
    </div>
  );
};

/* ---------------- 2-C 风险一：模型坍缩 ---------------- */

const RiskOne: React.FC = () => {
  const frame = useCurrentFrame();
  const skew = interpolate(frame, [10, 80], [0, 9], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });
  const distort = interpolate(frame, [40, 130], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cardApp = interpolate(frame, [96, 122], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1200, height: 720}}>
        <div style={{position: 'absolute', left: 40, top: 20}}>
          <QuestionLoop step={-1} skew={-skew} danger />
        </div>
        <div style={{position: 'absolute', right: 60, top: 60}}>
          <MirrorCollapse distort={distort} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 30,
            transform: `translateX(-50%) scale(${0.8 + cardApp * 0.2})`,
            opacity: cardApp,
            padding: '20px 48px',
            borderRadius: 16,
            background: '#1E0D10',
            border: `2px solid ${theme.danger}`,
            fontFamily: theme.serif,
            fontSize: 54,
            fontWeight: 700,
            color: theme.danger,
            whiteSpace: 'nowrap',
            boxShadow: `0 0 50px ${theme.danger}44`,
          }}
        >
          模型坍缩
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 镜像越来越扭曲：三层逐渐错位的镜像 🧠 */
const MirrorCollapse: React.FC<{distort: number}> = ({distort}) => {
  const layers = [
    {scale: 0.62, dx: 0, rot: 0},
    {scale: 0.78, dx: 150, rot: -7},
    {scale: 0.95, dx: 305, rot: 8},
  ];
  return (
    <div style={{position: 'relative', width: 640, height: 330}}>
      {layers.map((l, i) => {
        const d = distort * i;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: l.dx * distort,
              top: 40 - i * 10,
              transform: `scale(${l.scale}) rotate(${l.rot * d}deg) skewX(${d * 6}deg)`,
              opacity: 0.95 - i * 0.18 * (1 - distort * 0.4),
              filter: `hue-rotate(${-d * 16}deg) saturate(${1 + d * 0.9})`,
            }}
          >
            <div
              style={{
                width: 300,
                height: 300,
                borderRadius: 64,
                background: `linear-gradient(135deg, ${theme.danger}33, ${theme.panel})`,
                border: `3px solid ${i === 0 ? theme.brain : theme.danger}`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: 130,
              }}
            >
              🧠
            </div>
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.danger,
          opacity: distort,
        }}
      >
        一直吃自己产的数据 → 越来越像自己
      </div>
    </div>
  );
};

/* ---------------- 2-D 功法二：自己当裁判 ---------------- */

const SkillTwo: React.FC<{stage: number}> = ({stage}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <BeatBadge text="功法二 · 自己当裁判" />
      <div style={{display: 'flex', alignItems: 'center', gap: 60}}>
        <FadeUp>
          <RoleCard icon="🤖" title="选手" sub="答题" color={theme.brain} />
        </FadeUp>
        <div
          style={{
            fontSize: 52,
            color: theme.dim,
            opacity: interpolate(frame, [10, 30], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          ⇄
        </div>
        <FadeUp delay={8}>
          <RoleCard icon="⚖️" title="裁判" sub="打分" color={theme.gear} />
        </FadeUp>
      </div>
      {stage === 1 ? (
        <FadeUp delay={6} style={{position: 'absolute', left: '50%', bottom: 210, transform: 'translateX(-50%)'}}>
          <ConstitutionScroll />
        </FadeUp>
      ) : null}
      {stage === 2 ? (
        <FadeUp delay={6} style={{position: 'absolute', left: '50%', bottom: 200, transform: 'translateX(-50%)'}}>
          <MetaRewarding />
        </FadeUp>
      ) : null}
    </AbsoluteFill>
  );
};

const RoleCard: React.FC<{icon: string; title: string; sub: string; color: string}> = ({
  icon,
  title,
  sub,
  color,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 14}});
  return (
    <div
      style={{
        width: 360,
        padding: '40px 30px',
        borderRadius: 24,
        background: theme.panel,
        border: `3px solid ${color}`,
        textAlign: 'center',
        transform: `translateY(${(1 - enter) * 30}px)`,
        boxShadow: `0 0 60px ${color}33`,
      }}
    >
      <div style={{fontSize: 96}}>{icon}</div>
      <div style={{fontFamily: theme.sans, fontSize: 44, fontWeight: 800, color, marginTop: 18}}>
        {title}
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim, marginTop: 10}}>{sub}</div>
    </div>
  );
};

/** 宪法卷轴：展开后逐条打钩 */
const ConstitutionScroll: React.FC = () => {
  const frame = useCurrentFrame();
  const unroll = interpolate(frame, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rules = ['诚实', '无害', '有帮助', '可验证'];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16}}>
      <div
        style={{
          width: 520 * unroll,
          minHeight: 190,
          borderRadius: 14,
          background: '#12161F',
          border: `2px solid ${theme.panelBorder}`,
          borderLeft: `10px solid ${theme.brainDeep}`,
          padding: '24px 34px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 32, fontWeight: 700, color: theme.text}}>
          宪法 · 宪法 AI
        </div>
        {rules.map((r, i) => {
          const on = frame > 34 + i * 12;
          return (
            <div
              key={r}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                fontFamily: theme.sans,
                fontSize: 28,
                color: on ? theme.text : theme.dim,
                opacity: on ? 1 : 0.45,
              }}
            >
              <span style={{color: on ? theme.ok : theme.panelBorder, fontSize: 30}}>
                {on ? '✓' : '○'}
              </span>
              原则 {i + 1} · {r}
            </div>
          );
        })}
      </div>
      <MethodTag name="Constitutional AI" delay={20} />
    </div>
  );
};

/** 套娃（Meta-Rewarding）：裁判身后浮现更大裁判 */
const MetaRewarding: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const big = spring({frame: frame - 14, fps, config: {damping: 15}});
  const biggest = spring({frame: frame - 44, fps, config: {damping: 15}});
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14}}>
      <div style={{position: 'relative', width: 760, height: 230}}>
        <div
          style={{
            position: 'absolute',
            left: 30,
            bottom: 0,
            transform: `scale(${0.4 + biggest * 0.6}) translateY(${(1 - biggest) * 60}px)`,
            opacity: biggest * 0.5,
            transformOrigin: 'left bottom',
          }}
        >
          <JudgeFigure label="裁判的裁判" sub="打分打得好不好？" />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 250,
            bottom: 0,
            transform: `scale(${0.6 + big * 0.4}) translateY(${(1 - big) * 50}px)`,
            opacity: big * 0.8,
            transformOrigin: 'left bottom',
          }}
        >
          <JudgeFigure label="裁判" sub="给答案打分" />
        </div>
        <div style={{position: 'absolute', left: 480, bottom: 0}}>
          <JudgeFigure label="选手" sub="先答题" highlight />
        </div>
      </div>
      <MethodTag name="Meta-Rewarding" delay={30} />
    </div>
  );
};

const JudgeFigure: React.FC<{label: string; sub: string; highlight?: boolean}> = ({
  label,
  sub,
  highlight,
}) => (
  <div style={{width: 240, textAlign: 'center'}}>
    <div
      style={{
        width: 150,
        height: 150,
        margin: '0 auto',
        borderRadius: 34,
        background: highlight
          ? `linear-gradient(135deg, ${theme.brainDeep}, ${theme.panel})`
          : theme.panel,
        border: `3px solid ${highlight ? theme.brain : theme.panelBorder}`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: 74,
      }}
    >
      {highlight ? '🤖' : '⚖️'}
    </div>
    <div
      style={{
        fontFamily: theme.sans,
        fontSize: 30,
        fontWeight: 700,
        color: theme.text,
        marginTop: 12,
      }}
    >
      {label}
    </div>
    <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginTop: 4}}>{sub}</div>
  </div>
);

/* ---------------- 2-E 投票（TTRL） ---------------- */

const VoteTTRL: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const answers = ['42', '13', '42', '42', '13', '42'];
  const grow = interpolate(frame, [26, 70], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const crown = spring({frame: frame - 72, fps, config: {damping: 12}});
  // 单一蓝色 lightness ramp：胜出 = 主题蓝，其余 = 深一档（已通过 dataviz 校验 ΔE/对比度）
  const winnerBlue = theme.brain;
  const loserBlue = '#4E6E9C';
  const counts = [
    {t: '42', n: 4, winner: true},
    {t: '13', n: 2, winner: false},
    {t: '7', n: 1, winner: false},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', gap: 44}}>
      <BeatBadge text="没有标准答案？全班投票" />
      <div style={{display: 'flex', gap: 20}}>
        {answers.map((a, i) => {
          const fall = spring({frame: frame - 6 - i * 7, fps, config: {damping: 12}});
          return (
            <div
              key={i}
              style={{
                width: 128,
                height: 92,
                borderRadius: 12,
                background: theme.panel,
                border: `2px solid ${theme.panelBorder}`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontFamily: theme.mono,
                fontSize: 38,
                color: a === '42' ? theme.text : theme.dim,
                transform: `translateY(${(1 - fall) * -140}px)`,
                opacity: fall,
              }}
            >
              {a}
            </div>
          );
        })}
      </div>
      {/* 柱状图：≤24px 柱宽、顶部 4px 圆角、值标签用文本色、2px 间隙由 slot 间距承担 */}
      <div style={{display: 'flex', alignItems: 'flex-end', gap: 90, height: 250}}>
        {counts.map((c) => {
          const h = Math.max(10, grow * c.n * 52);
          return (
            <div key={c.t} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
              <div
                style={{
                  fontFamily: theme.mono,
                  fontSize: 28,
                  color: theme.text,
                  opacity: grow,
                }}
              >
                {c.n} 票
              </div>
              <div
                style={{
                  width: 24,
                  height: h,
                  background: c.winner ? winnerBlue : loserBlue,
                  borderRadius: '4px 4px 0 0',
                  boxShadow: c.winner ? `0 0 26px ${winnerBlue}66` : 'none',
                }}
              />
              <div
                style={{
                  fontFamily: theme.mono,
                  fontSize: 30,
                  color: c.winner ? theme.text : theme.dim,
                  fontWeight: c.winner ? 700 : 400,
                }}
              >
                {c.t}
              </div>
              {c.winner ? (
                <div
                  style={{
                    fontSize: 40,
                    transform: `translateY(${-6 - crown * 8}px) scale(${crown})`,
                    opacity: crown,
                  }}
                >
                  👑
                </div>
              ) : (
                <div style={{height: 40}} />
              )}
            </div>
          );
        })}
      </div>
      <MethodTag name="TTRL" delay={40} />
    </AbsoluteFill>
  );
};

/* ---------------- 2-F 风险二：一致 ≠ 正确 ---------------- */

const RiskTwo: React.FC = () => {
  const frame = useCurrentFrame();
  const appear = (i: number) =>
    interpolate(frame, [6 + i * 1.6, 20 + i * 1.6], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  const cells = 100;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', gap: 56}}>
      <div style={{position: 'relative', textAlign: 'center'}}>
        <QuoteCard zh="一致 ≠ 正确" accent={theme.danger} />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: -34,
            fontFamily: theme.sans,
            fontSize: 30,
            color: theme.dim,
            whiteSpace: 'nowrap',
            opacity: interpolate(frame, [16, 40], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          系统性地错，做一百遍就自信地错一百遍
        </div>
      </div>
      <FadeUp delay={30} style={{position: 'relative'}}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(20, 30px)',
            gap: 10,
          }}
        >
          {Array.from({length: cells}).map((_, i) => (
            <div
              key={i}
              style={{
                width: 30,
                height: 42,
                borderRadius: 4,
                background: '#1E0D10',
                border: `1.5px solid ${theme.danger}`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontFamily: theme.mono,
                fontSize: 20,
                color: theme.danger,
                opacity: appear(i),
                transform: `scale(${0.6 + appear(i) * 0.4})`,
              }}
            >
              13
            </div>
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            right: -30,
            bottom: -58,
            fontFamily: theme.sans,
            fontSize: 28,
            color: theme.dim,
          }}
        >
          100 个相同的错误答案
        </div>
      </FadeUp>
      <FadeUp delay={58}>
        <div
          style={{
            padding: '18px 44px',
            borderRadius: 12,
            background: theme.panel,
            border: `2px solid ${theme.danger}88`,
            fontFamily: theme.serif,
            fontStyle: 'italic',
            fontSize: 34,
            color: theme.text,
          }}
        >
          "Too consistent to detect"
          <span
            style={{
              marginLeft: 18,
              fontFamily: theme.sans,
              fontStyle: 'normal',
              fontSize: 26,
              color: theme.dim,
            }}
          >
            错得太整齐，反而查不出来
          </span>
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/* ---------------- 2-G 药方 ---------------- */

const Prescription: React.FC = () => {
  const frame = useCurrentFrame();
  const items = [
    {icon: '⚖️', t: '裁判和选手，别用同一个模型', sub: '分家'},
    {icon: '🧑‍🔬', t: '留一点人类把关，当外部锚点', sub: '人类锚点'},
    {icon: '🔀', t: '裁判吵起来 ≠ 取平均', sub: '分歧 = 不确定性信号 → 交给人看'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', gap: 50}}>
      <BeatBadge text="药方 · 很朴素" color={theme.ok} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 30}}>
        {items.map((it, i) => {
          const on = interpolate(frame, [8 + i * 22, 26 + i * 22], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={it.t}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 26,
                width: 1050,
                padding: '26px 36px',
                borderRadius: 18,
                background: on > 0.1 ? theme.panel : 'transparent',
                border: `2px solid ${on > 0.1 ? theme.ok : theme.panelBorder}`,
                opacity: on,
                transform: `translateX(${(1 - on) * -46}px)`,
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 18,
                  background: '#0F1A10',
                  border: `2px solid ${theme.ok}`,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: 38,
                }}
              >
                {it.icon}
              </div>
              <div>
                <div style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 700, color: theme.text}}>
                  {it.t}
                </div>
                <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginTop: 8}}>
                  {it.sub}
                </div>
              </div>
              <div
                style={{
                  marginLeft: 'auto',
                  fontSize: 40,
                  color: theme.ok,
                  opacity: interpolate(frame, [26 + i * 22, 34 + i * 22], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
                }}
              >
                ✓
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- 2-H 功法三：去真实世界撞南墙 ---------------- */

const SkillThree: React.FC<{stage: number}> = ({stage}) => {
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', gap: 40}}>
      <BeatBadge text="功法三 · 去真实世界撞南墙" />
      {stage === 1 ? <GoOutside /> : null}
      {stage === 2 ? <UnitTests /> : null}
      {stage === 3 ? <WebJudge /> : null}
    </AbsoluteFill>
  );
};

/** 出圈：AI 走出闭门修炼圆圈，撞向"真实世界"的墙 */
const GoOutside: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const walk = spring({frame: frame - 6, fps, config: {damping: 200}});
  const hit = spring({frame: frame - 40, fps, config: {damping: 7}});
  const robotX = -190 + walk * 330;
  return (
    <div style={{position: 'relative', width: 1080, height: 480}}>
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 120,
          width: 300,
          height: 300,
          borderRadius: '50%',
          border: `3px dashed ${theme.panelBorder}`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: 10,
          opacity: 1 - walk * 0.55,
        }}
      >
        <span style={{fontSize: 56}}>🧘</span>
        <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>闭门修炼</span>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 60,
          top: 60,
          width: 26,
          height: 420,
          borderRadius: 13,
          background: `repeating-linear-gradient(180deg, ${theme.brainDeep} 0 26px, transparent 26px 34px)`,
          border: `2px solid ${theme.brain}66`,
          transform: `translateX(${hit * -7}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 120,
          top: 250,
          writingMode: 'vertical-rl',
          fontFamily: theme.sans,
          fontSize: 30,
          fontWeight: 700,
          color: theme.brain,
          letterSpacing: 8,
        }}
      >
        真实世界
      </div>
      <div
        style={{
          position: 'absolute',
          left: 430,
          top: 190,
          fontSize: 92,
          transform: `translateX(${robotX}px) rotate(${hit * -14}deg)`,
        }}
      >
        🤖
      </div>
      <div
        style={{
          position: 'absolute',
          right: 96,
          top: 150,
          fontSize: 64,
          opacity: hit,
          transform: `scale(${hit})`,
        }}
      >
        💥
      </div>
      <FadeUp
        delay={54}
        style={{position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)'}}
      >
        <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim, whiteSpace: 'nowrap'}}>
          前两种闭门修炼 · 这一种，去<span style={{color: theme.brain, fontWeight: 700}}>干活</span>，从后果里学习
        </div>
      </FadeUp>
    </div>
  );
};

/** 单元测试红绿灯：✓ 绿 ✗ 红 */
const UnitTests: React.FC = () => {
  const frame = useCurrentFrame();
  const cases = [
    {name: 'test_login', pass: true},
    {name: 'test_sort', pass: true},
    {name: 'test_parse', pass: false},
    {name: 'test_fetch', pass: true},
    {name: 'test_write', pass: true},
  ];
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 70}}>
      <div
        style={{
          width: 600,
          borderRadius: 16,
          background: '#05070B',
          border: `2px solid ${theme.panelBorder}`,
          padding: '24px 28px',
          fontFamily: theme.mono,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{fontSize: 24, color: theme.dim}}>$ run tests --watch</div>
        {cases.map((c, i) => {
          const on = frame > 10 + i * 13;
          return (
            <div key={c.name} style={{display: 'flex', alignItems: 'center', gap: 16, fontSize: 27}}>
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: '#05070B',
                  fontWeight: 700,
                  background: !on
                    ? theme.panelBorder
                    : c.pass
                      ? theme.ok
                      : theme.danger,
                }}
              >
                {on ? (c.pass ? '✓' : '✗') : ''}
              </span>
              <span style={{color: on ? theme.text : theme.dim}}>{c.name}</span>
            </div>
          );
        })}
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 34, alignItems: 'center'}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 26px', borderRadius: 18, background: theme.panel, border: `2px solid ${theme.panelBorder}`}}>
          {[
            {c: theme.ok, on: true},
            {c: theme.danger, on: false},
            {c: theme.ok, on: true},
          ].map((l, i) => {
            const lit = l.on;
            return (
              <div
                key={i}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: lit ? l.c : theme.panelBorder,
                  boxShadow: lit ? `0 0 20px ${l.c}88` : 'none',
                }}
              />
            );
          })}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim, textAlign: 'center', width: 420}}>
          跑通 = 对，跑挂 = 错
          <br />
          <span style={{color: theme.brain, fontWeight: 700}}>最干净的老师：单元测试</span>
        </div>
      </div>
    </div>
  );
};

/** 网页操作 + 打分模型当自动裁判 */
const WebJudge: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scorePop = spring({frame: frame - 30, fps, config: {damping: 11}});
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 56}}>
      <div
        style={{
          width: 660,
          height: 430,
          borderRadius: 14,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: 52,
            background: '#0B0E14',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingLeft: 20,
          }}
        >
          {['#FF5C5C', '#FFC24B', '#7ED321'].map((c) => (
            <div key={c} style={{width: 16, height: 16, borderRadius: '50%', background: c}} />
          ))}
          <div
            style={{
              marginLeft: 16,
              fontFamily: theme.mono,
              fontSize: 22,
              color: theme.dim,
              background: '#05070B',
              borderRadius: 8,
              padding: '4px 60px',
            }}
          >
            shop.example.com
          </div>
        </div>
        <div style={{padding: 26, display: 'flex', flexDirection: 'column', gap: 18}}>
          <div style={{height: 26, width: '62%', borderRadius: 6, background: theme.panelBorder}} />
          <div style={{height: 16, width: '88%', borderRadius: 6, background: theme.panelBorder}} />
          <div style={{height: 16, width: '76%', borderRadius: 6, background: theme.panelBorder}} />
          <div
            style={{
              marginTop: 12,
              width: 240,
              height: 64,
              borderRadius: 10,
              background: theme.brainDeep,
              border: `2px solid ${theme.brain}`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontFamily: theme.sans,
              fontSize: 26,
              color: theme.text,
              transform: `translateX(${interpolate(frame, [16, 34], [0, 300], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}px)`,
            }}
          >
            🖱️ 点击"下单"
          </div>
        </div>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20}}>
        <div
          style={{
            width: 170,
            height: 170,
            borderRadius: 40,
            background: theme.panel,
            border: `3px solid ${theme.gear}`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: 84,
            boxShadow: `0 0 50px ${theme.gear}33`,
          }}
        >
          ⚖️
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.text, fontWeight: 700}}>
          打分模型
        </div>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 40,
            color: theme.ok,
            opacity: scorePop,
            transform: `scale(${scorePop})`,
          }}
        >
          +1 ✓
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, textAlign: 'center', width: 300}}>
          没有测试的领域
          <br />
          就训一个自动裁判
        </div>
      </div>
    </div>
  );
};

/* ---------------- 2-I 世界模型：梦里练车 ---------------- */

const WorldModel: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const bob = Math.sin(frame * 0.045) * 14;
  const miles = Math.floor(interpolate(frame, [24, 200], [0, 99999], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }));
  const roadShift = (frame * 6) % 60;
  const spin = frame * 0.06;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <BeatBadge text="功法三 · 增补技：世界模型" />
      <FadeUp delay={4}>
        <div style={{position: 'relative', width: 1100, height: 560}}>
          {/* 梦境泡泡 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `3px solid ${theme.brain}77`,
              background: `radial-gradient(circle at 40% 35%, ${theme.brain}14, transparent 70%)`,
              boxShadow: `0 0 120px ${theme.brain}22, inset 0 0 90px ${theme.brain}18`,
              transform: `translateY(${bob}px)`,
            }}
          >
            {/* 泡泡高光 */}
            <div
              style={{
                position: 'absolute',
                left: 130,
                top: 64,
                width: 130,
                height: 56,
                borderRadius: '50%',
                background: `${theme.brain}26`,
                transform: 'rotate(-24deg)',
              }}
            />
            {/* 环绕小行星（模拟数据） */}
            {[0, 1, 2].map((i) => {
              const a = spin + (i * Math.PI * 2) / 3;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: 550 + Math.cos(a) * 470,
                    top: 280 + Math.sin(a) * 245,
                    fontSize: 26,
                    color: theme.dim,
                    opacity: 0.7,
                  }}
                >
                  {['📄', '🗺️', '🚗'][i]}
                </div>
              );
            })}
            {/* 驾驶舱 */}
            <div
              style={{
                position: 'absolute',
                left: 430,
                top: 190,
                width: 240,
                height: 190,
                borderRadius: 22,
                background: theme.panel,
                border: `2px solid ${theme.brain}`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: 96,
                boxShadow: `0 0 44px ${theme.brain}44`,
              }}
            >
              🚗
            </div>
            {/* 跑动的路面（滚动虚线） */}
            <div
              style={{
                position: 'absolute',
                left: 180,
                right: 180,
                top: 388,
                height: 8,
                borderRadius: 4,
                background: `repeating-linear-gradient(90deg, ${theme.brain} 0 ${roadShift}px, transparent ${roadShift}px 60px)`,
                opacity: 0.55,
              }}
            />
          </div>
          {/* 里程数 */}
          <div
            style={{
              position: 'absolute',
              right: 60,
              bottom: 50,
              fontFamily: theme.mono,
              fontSize: 56,
              color: theme.brain,
              textShadow: `0 0 30px ${theme.brain}55`,
            }}
          >
            {miles.toLocaleString('en-US')} km
          </div>
          <FadeUp delay={40} style={{position: 'absolute', left: 70, bottom: 60}}>
            <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim, width: 400}}>
              从真实数据学出
              <span style={{color: theme.brain, fontWeight: 700}}>「环境模拟器」</span>
              <br />
              在梦里练车，练熟了再上路
            </div>
          </FadeUp>
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/* ---------------- 2-J 风险三：梦与现实有差距 ---------------- */

const RiskThree: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const wobble = interpolate(frame, [10, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ripple = Math.sin(frame * 0.09) * wobble;
  const walkerApp = interpolate(frame, [30, 58], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const gateOpen = spring({frame: frame - 66, fps, config: {damping: 14}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', gap: 46}}>
      <div
        style={{
          fontFamily: theme.serif,
          fontSize: 56,
          fontWeight: 700,
          color: theme.danger,
        }}
      >
        梦和现实，有差距
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 60}}>
        {/* 失真泡泡 */}
        <div
          style={{
            position: 'relative',
            width: 420,
            height: 420,
            borderRadius: '48% 52% 55% 45% / 50% 46% 54% 50%',
            border: `3px solid ${theme.danger}88`,
            background: `radial-gradient(circle at 42% 36%, ${theme.danger}1E, transparent 68%)`,
            boxShadow: `0 0 90px ${theme.danger}22`,
            transform: `scale(${1 + ripple * 0.025}) skewX(${ripple * 1.6}deg)`,
          }}
        >
          <div style={{position: 'absolute', left: 130, top: 170, fontSize: 82}}>🚗</div>
          {/* 三条腿行人剪影（SVG） */}
          <div
            style={{
              position: 'absolute',
              right: 74,
              top: 118,
              opacity: walkerApp,
              transform: `scale(${walkerApp})`,
            }}
          >
            <svg width="70" height="150" viewBox="0 0 70 150">
              <circle cx="33" cy="20" r="15" fill={theme.danger} opacity="0.9" />
              <rect x="18" y="38" width="30" height="58" rx="12" fill={theme.danger} opacity="0.9" />
              <rect x="20" y="96" width="8" height="50" rx="4" fill={theme.danger} opacity="0.9" />
              <rect x="31" y="96" width="8" height="50" rx="4" fill={theme.danger} opacity="0.9" />
              <rect x="42" y="96" width="8" height="50" rx="4" fill={theme.danger} opacity="0.9" />
            </svg>
          </div>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 42,
              transform: 'translateX(-50%)',
              fontFamily: theme.sans,
              fontSize: 24,
              color: theme.danger,
              whiteSpace: 'nowrap',
              opacity: walkerApp,
            }}
          >
            看起来合理 · 实际不存在
          </div>
        </div>
        {/* 出泡泡箭头 → 验证闸门 */}
        <div style={{fontSize: 56, color: theme.danger, opacity: walkerApp}}>→</div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            transform: `scale(${0.85 + gateOpen * 0.15})`,
            opacity: gateOpen,
          }}
        >
          <div
            style={{
              width: 240,
              height: 260,
              borderRadius: 18,
              background: '#0F1A10',
              border: `3px solid ${theme.ok}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 14,
              boxShadow: `0 0 60px ${theme.ok}33`,
            }}
          >
            <div style={{fontSize: 80}}>🛡️</div>
            <div style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 800, color: theme.ok}}>
              验证
            </div>
          </div>
          <div style={{display: 'flex', gap: 10}}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: frame > 84 + i * 8 ? theme.ok : theme.panelBorder,
                  boxShadow: frame > 84 + i * 8 ? `0 0 16px ${theme.ok}88` : 'none',
                }}
              />
            ))}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim, textAlign: 'center'}}>
            梦里练出的车技
            <br />
            上路前，<span style={{color: theme.ok, fontWeight: 700}}>再验一遍</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- 场景组装 ---------------- */

export const P2Brain: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p2-01', 'p2-04')} name="2-A 章头">
        <ChapterHead />
      </Sequence>
      <Sequence {...w('p2-05', 'p2-07')} name="2-B 功法一·雪球">
        <SkillOne stage={1} />
      </Sequence>
      <Sequence {...w('p2-08', 'p2-09')} name="2-B 功法一·难度">
        <SkillOne stage={2} />
      </Sequence>
      <Sequence {...w('p2-10')} name="2-B 功法一·STaR">
        <SkillOne stage={3} />
      </Sequence>
      <Sequence {...w('p2-11', 'p2-13')} name="2-B 功法一·考场现学">
        <SkillOne stage={4} />
      </Sequence>
      <Sequence {...w('p2-14', 'p2-18')} name="2-C 风险一·模型坍缩">
        <RiskOne />
      </Sequence>
      <Sequence {...w('p2-19', 'p2-23')} name="2-D 功法二·宪法">
        <SkillTwo stage={1} />
      </Sequence>
      <Sequence {...w('p2-24', 'p2-26')} name="2-D 功法二·套娃">
        <SkillTwo stage={2} />
      </Sequence>
      <Sequence {...w('p2-27', 'p2-29')} name="2-E 投票·TTRL">
        <VoteTTRL />
      </Sequence>
      <Sequence {...w('p2-30', 'p2-33')} name="2-F 风险二·一致≠正确">
        <RiskTwo />
      </Sequence>
      <Sequence {...w('p2-34', 'p2-37b')} name="2-G 药方">
        <Prescription />
      </Sequence>
      <Sequence {...w('p2-38', 'p2-39b')} name="2-H 功法三·出圈">
        <SkillThree stage={1} />
      </Sequence>
      <Sequence {...w('p2-40', 'p2-41')} name="2-H 功法三·单元测试">
        <SkillThree stage={2} />
      </Sequence>
      <Sequence {...w('p2-42', 'p2-43')} name="2-H 功法三·网页裁判">
        <SkillThree stage={3} />
      </Sequence>
      <Sequence {...w('p2-44', 'p2-48')} name="2-I 世界模型">
        <WorldModel />
      </Sequence>
      <Sequence {...w('p2-49', 'p2-51')} name="2-J 风险三·梦与真实">
        <RiskThree />
      </Sequence>
    </AbsoluteFill>
  );
};
