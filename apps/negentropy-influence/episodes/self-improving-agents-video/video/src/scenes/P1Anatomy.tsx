import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  interpolateColors,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {FadeUp, Pill} from '../components/cards';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';

/** P1 智能体解剖图（storyboard.md 镜 1-A..1-G） */
const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const chip: React.CSSProperties = {
  fontFamily: theme.sans,
  fontSize: 28,
  color: theme.text,
  background: theme.panel,
  border: `2px solid ${theme.panelBorder}`,
  borderRadius: 999,
  padding: '10px 24px',
  whiteSpace: 'nowrap',
};

/** 解剖图纸感的淡蓝网格背景 */
const BlueprintBackdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundImage: `linear-gradient(${theme.brain}0D 1px, transparent 1px), linear-gradient(90deg, ${theme.brain}0D 1px, transparent 1px)`,
      backgroundSize: '96px 96px',
      maskImage: 'radial-gradient(ellipse at 50% 42%, black 26%, transparent 76%)',
      WebkitMaskImage: 'radial-gradient(ellipse at 50% 42%, black 26%, transparent 76%)',
    }}
  />
);

/** 机器人轮廓线稿（支持描边生长动画） */
const RobotSketch: React.FC<{
  frame: number;
  width?: number;
  color?: string;
  opacity?: number;
  /** 从哪一帧开始描边；null = 已画好 */
  animateFrom?: number | null;
}> = ({frame, width = 400, color = theme.dim, opacity = 1, animateFrom = null}) => {
  const seg = (delay: number) => {
    if (animateFrom === null) {
      return {pathLength: 1, strokeDasharray: 1, strokeDashoffset: 0};
    }
    const p = interpolate(frame, [animateFrom + delay, animateFrom + delay + 16], [0, 1], CLAMP);
    return {pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - p};
  };
  const s = {stroke: color, strokeWidth: 5, fill: 'none', strokeLinecap: 'round' as const};
  return (
    <svg width={width} viewBox="0 0 400 520" style={{opacity, display: 'block'}}>
      <path {...s} {...seg(0)} d="M200 22 V44" />
      <circle {...s} {...seg(1.5)} cx={200} cy={14} r={8} />
      <rect {...s} {...seg(3)} x={108} y={44} width={184} height={146} rx={30} />
      <circle {...s} {...seg(6)} cx={158} cy={112} r={17} />
      <circle {...s} {...seg(7.5)} cx={242} cy={112} r={17} />
      <rect {...s} {...seg(9)} x={174} y={146} width={52} height={10} rx={5} />
      <rect {...s} {...seg(10.5)} x={86} y={102} width={20} height={40} rx={9} />
      <rect {...s} {...seg(12)} x={294} y={102} width={20} height={40} rx={9} />
      <path {...s} {...seg(13.5)} d="M200 190 V218" />
      <rect {...s} {...seg(15)} x={118} y={218} width={164} height={178} rx={26} />
      <rect {...s} {...seg(18)} x={152} y={250} width={96} height={60} rx={10} />
      <circle {...s} {...seg(21)} cx={200} cy={280} r={7} />
      <path {...s} {...seg(22.5)} d="M118 248 H74 V330" />
      <circle {...s} {...seg(24)} cx={74} cy={344} r={14} />
      <path {...s} {...seg(25.5)} d="M282 248 H326 V330" />
      <circle {...s} {...seg(27)} cx={326} cy={344} r={14} />
      <path {...s} {...seg(28.5)} d="M166 396 V452" />
      <path {...s} {...seg(30)} d="M234 396 V452" />
      <rect {...s} {...seg(31.5)} x={140} y={452} width={52} height={16} rx={8} />
      <rect {...s} {...seg(33)} x={208} y={452} width={52} height={16} rx={8} />
    </svg>
  );
};

/** 参数旋钮（全片复用视觉锚点：参数 = 旋钮） */
const Knob: React.FC<{angle: number; lit: number; size?: number}> = ({angle, lit, size = 34}) => {
  const ring = interpolateColors(lit, [0, 1], [theme.panelBorder, theme.brain]);
  const bar = interpolateColors(lit, [0, 1], [theme.dim, theme.brain]);
  return (
    <div style={{width: size, height: size, borderRadius: '50%', border: `3px solid ${ring}`, position: 'relative'}}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: (size - 6) * 0.55,
          height: 4,
          borderRadius: 2,
          background: bar,
          transform: `translate(-50%, -50%) rotate(${angle}deg)`,
        }}
      />
    </div>
  );
};

const KnobGrid: React.FC<{train: number}> = ({train}) => {
  const cols = 9;
  const rows = 5;
  const knobs: React.ReactNode[] = [];
  for (let i = 0; i < cols * rows; i++) {
    const stagger = (i % 7) * 0.09;
    const on = interpolate(train, [stagger, Math.min(1, stagger + 0.55)], [0, 1], CLAMP);
    const idle = ((i * 37) % 23) - 11;
    knobs.push(<Knob key={i} angle={idle + (72 + (i % 5) * 9) * on} lit={on * 0.9} />);
  }
  return <div style={{display: 'grid', gridTemplateColumns: `repeat(${cols}, 34px)`, gap: 16}}>{knobs}</div>;
};

/** 1-A：智能体是什么——机器人线稿描边生长 + 「大脑/装备」双色词 + 论文公式条 */
const FormulaSlot: React.FC<{word: string; color: string; pop: number}> = ({word, color, pop}) => (
  <span style={{position: 'relative', display: 'inline-block', width: 176, height: 66}}>
    <span
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `3px dashed ${theme.panelBorder}`,
        borderRadius: 14,
        color: theme.dim,
        fontSize: 34,
        opacity: 1 - pop,
      }}
    >
      ？
    </span>
    <span
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `3px solid ${color}`,
        borderRadius: 14,
        color,
        fontSize: 44,
        fontWeight: 800,
        background: theme.panel,
        opacity: pop,
        transform: `scale(${0.7 + pop * 0.3})`,
      }}
    >
      {word}
    </span>
  </span>
);

const BeatAsk: React.FC<{at: (id: string) => number}> = ({at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t01b = at('p1-01b');
  const t02 = at('p1-02');
  const t03 = at('p1-03');
  const chipIn = spring({frame: frame - t01b, fps, config: {damping: 200}});
  const chipOp = chipIn * (1 - interpolate(frame, [t02, t02 + 12], [0, 1], CLAMP));
  const panelIn = spring({frame: frame - t02, fps, config: {damping: 200}});
  const wordIn = spring({frame: frame - t03, fps, config: {damping: 200}});
  return (
    <AbsoluteFill>
      <FadeUp delay={2} style={{position: 'absolute', top: 52, width: '100%', textAlign: 'center'}}>
        <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.dim, letterSpacing: 6}}>AGENT</div>
        <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 64, fontWeight: 800, color: theme.text}}>
          智能体<span style={{fontSize: 36, color: theme.dim, marginLeft: 14}}>（Agent）</span>
        </div>
      </FadeUp>

      <div style={{position: 'absolute', left: 760, top: 168}}>
        <RobotSketch frame={frame} animateFrom={10} width={400} color={theme.dim} />
      </div>

      {/* p1-01b：对话框只是嘴 / 能自己动手干活 */}
      <div style={{position: 'absolute', right: 1216, top: 236, ...chip, opacity: chipOp}}>💬 对话框，只是它的嘴</div>
      <div style={{position: 'absolute', left: 1216, top: 236, ...chip, opacity: chipOp}}>🔧 能自己动手干活</div>

      {/* p1-03：大脑/装备 分列蓝橙 */}
      <div
        style={{
          position: 'absolute',
          right: 1216,
          top: 296,
          fontFamily: theme.sans,
          fontSize: 54,
          fontWeight: 800,
          color: theme.brain,
          border: `3px solid ${theme.brain}`,
          borderRadius: 16,
          padding: '8px 28px',
          boxShadow: `0 0 50px ${theme.brain}33`,
          opacity: wordIn,
          transform: `translateX(${(1 - wordIn) * -36}px)`,
        }}
      >
        大脑
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1216,
          top: 452,
          fontFamily: theme.sans,
          fontSize: 54,
          fontWeight: 800,
          color: theme.gear,
          border: `3px solid ${theme.gear}`,
          borderRadius: 16,
          padding: '8px 28px',
          boxShadow: `0 0 50px ${theme.gear}33`,
          opacity: wordIn,
          transform: `translateX(${(1 - wordIn) * 36}px)`,
        }}
      >
        装备
      </div>

      {/* p1-02..03：论文公式条 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 722,
          transform: `translateX(-50%) translateY(${(1 - panelIn) * 34}px)`,
          opacity: panelIn,
          width: 1020,
          padding: '20px 40px 26px',
          borderRadius: 20,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          textAlign: 'center',
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.dim, letterSpacing: 3}}>
          PAPER FORMULA · 论文公式
        </div>
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 20,
            fontFamily: theme.sans,
            fontSize: 46,
            fontWeight: 700,
            color: theme.text,
            height: 78,
          }}
        >
          <span>智能体</span>
          <span style={{color: theme.dim}}>＝</span>
          <FormulaSlot word="大脑" color={theme.brain} pop={wordIn} />
          <span style={{color: theme.dim}}>＋</span>
          <FormulaSlot word="装备" color={theme.gear} pop={wordIn} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 1-B：大脑 = 大模型——旋钮阵列 + 蓝色脉冲波，训练 = 拧旋钮 */
const BeatBrain: React.FC<{at: (id: string) => number}> = ({at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t04b = at('p1-04b');
  const enter = spring({frame, fps, config: {damping: 200}});
  const train = interpolate(frame, [t04b, t04b + 50], [0, 1], CLAMP);
  const trainIn = spring({frame: frame - t04b, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <FadeUp delay={4}>
        <div
          style={{
            fontFamily: theme.sans,
            fontSize: 64,
            fontWeight: 800,
            color: theme.brain,
            textShadow: `0 0 70px ${theme.brain}55`,
          }}
        >
          🧠 大脑 ＝ 大模型本身
        </div>
      </FadeUp>
      <div
        style={{
          marginTop: 40,
          position: 'relative',
          width: 840,
          height: 470,
          borderRadius: 26,
          background: `linear-gradient(160deg, ${theme.brainDeep}88, ${theme.panel})`,
          border: `2px solid ${theme.brain}99`,
          boxShadow: `0 0 80px ${theme.brain}22`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          opacity: enter,
          transform: `translateY(${(1 - enter) * 30}px)`,
        }}
      >
        {/* 脉冲波传导 */}
        {[0, 1].map((k) => {
          const ph = ((((frame - k * 45) % 90) + 90) % 90) / 90;
          return (
            <div
              key={k}
              style={{
                position: 'absolute',
                width: 500,
                height: 500,
                borderRadius: '50%',
                border: `2px solid ${theme.brain}`,
                opacity: (1 - ph) * 0.28,
                transform: `scale(${0.25 + ph * 0.95})`,
              }}
            />
          );
        })}
        <KnobGrid train={train} />
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            width: '100%',
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 26,
            color: theme.dim,
          }}
        >
          参数旋钮 × 几千亿 · 合起来决定它开口说什么
        </div>
      </div>
      <div style={{marginTop: 38, opacity: trainIn, transform: `translateY(${(1 - trainIn) * 26}px)`}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 26,
            padding: '14px 40px',
            borderRadius: 999,
            border: `3px solid ${theme.brain}`,
            background: theme.panel,
            boxShadow: `0 0 50px ${theme.brain}2E`,
          }}
        >
          <Knob angle={-28 + train * 92} lit={1} size={42} />
          <span style={{fontFamily: theme.sans, fontSize: 40, fontWeight: 700, color: theme.text}}>
            所谓「训练」，就是<span style={{color: theme.brain}}>拧这些旋钮</span>
          </span>
          <Knob angle={-28 + train * 92} lit={1} size={42} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 1-C：装备四件套逐件装配 + Agent Harness 术语标签 */
const BeatGear: React.FC<{at: (id: string) => number}> = ({at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t05 = at('p1-05');
  const t06 = at('p1-06');
  const t07 = at('p1-07');
  const t08 = at('p1-08');
  const t09 = at('p1-09');
  const t09b = at('p1-09b');
  const t10 = at('p1-10');

  const capIn = spring({frame: frame - t05, fps, config: {damping: 200}});
  const slotIn = spring({frame: frame - t05 - 6, fps, config: {damping: 200}});
  const gl = spring({frame: frame - t06, fps, config: {damping: 12}});
  const nb = spring({frame: frame - t07, fps, config: {damping: 12}});
  const tb = spring({frame: frame - t08, fps, config: {damping: 12}});
  const rl = spring({frame: frame - t09, fps, config: {damping: 12}});
  const howIn = interpolate(frame, [t09b, t09b + 16], [0, 1], CLAMP);
  const howOut = interpolate(frame, [t10, t10 + 14], [0, 1], CLAMP);
  const howOp = howIn * (1 - howOut);
  const dimP = interpolate(frame, [t09b, t09b + 18], [0, 1], CLAMP);
  const othersOp = 1 - 0.6 * Math.max(0, dimP - howOut);
  const harness = spring({frame: frame - t10, fps, config: {damping: 13}});

  const slot = (x: number, y: number) => (
    <div
      style={{
        position: 'absolute',
        left: x - 52,
        top: y - 52,
        width: 104,
        height: 104,
        borderRadius: 22,
        border: `3px dashed ${theme.gear}66`,
        opacity: slotIn * 0.6,
      }}
    />
  );

  const item = (icon: string, x: number, y: number, enter: number, dx: number, dy: number, size: number, op = 1) => (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        fontSize: size,
        opacity: enter * op,
        transform: `translate(-50%, -50%) translate(${dx * (1 - enter)}px, ${dy * (1 - enter)}px)`,
      }}
    >
      {icon}
    </div>
  );

  const label = (text: string, x: number, y: number, t0: number, op = 1) => {
    const p = spring({frame: frame - t0 - 10, fps, config: {damping: 200}});
    return (
      <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${0.7 + p * 0.3})`, opacity: p * op}}>
        <Pill color={theme.gear}>{text}</Pill>
      </div>
    );
  };

  return (
    <AbsoluteFill>
      {/* p1-05：围绕大脑的四件套 */}
      <div
        style={{
          position: 'absolute',
          top: 84,
          width: '100%',
          textAlign: 'center',
          opacity: capIn,
          transform: `translateY(${(1 - capIn) * -18}px)`,
        }}
      >
        <span
          style={{
            fontFamily: theme.sans,
            fontSize: 64,
            fontWeight: 800,
            color: theme.gear,
            padding: '8px 34px',
            border: `3px solid ${theme.gear}`,
            borderRadius: 999,
            background: theme.panel,
            boxShadow: `0 0 60px ${theme.gear}26`,
          }}
        >
          装备 ＝ 围绕大脑的四件套
        </span>
      </div>

      <div style={{position: 'absolute', left: 770, top: 140}}>
        <RobotSketch frame={frame} animateFrom={2} width={380} color={theme.dim} />
      </div>

      {/* 头部蓝色微光（大脑仍在） */}
      <div
        style={{
          position: 'absolute',
          left: 810,
          top: 116,
          width: 300,
          height: 260,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.brain}2E, transparent 70%)`,
          opacity: capIn,
        }}
      />

      {slot(960, 246)}
      {slot(585, 430)}
      {slot(1335, 430)}
      {slot(960, 428)}

      {item('👓', 960, 246, gl, 0, -420, 84)}
      {item('📓', 585, 430, nb, -620, 0, 96, othersOp)}
      {item('🧰', 1335, 430, tb, 620, 0, 96, othersOp)}
      {item('📜', 960, 428, rl, 0, 380, 64)}

      {label('眼镜 · 提示词', 1245, 226, t06)}
      {label('笔记本 · 记忆', 585, 528, t07, othersOp)}
      {label('工具箱 · 工具', 1335, 528, t08, othersOp)}
      {label('守则 · 控制逻辑', 960, 692, t09)}

      {/* p1-09b：眼镜管怎么想，守则管怎么走 */}
      <div style={{position: 'absolute', left: 1245, top: 296, transform: 'translate(-50%, -50%)', opacity: howOp}}>
        <span style={{...chip}}>💭 管「怎么想」</span>
      </div>
      <div style={{position: 'absolute', left: 960, top: 752, transform: 'translate(-50%, -50%)', opacity: howOp}}>
        <span style={{...chip}}>🚶 管「怎么走」</span>
      </div>

      {/* p1-10：Agent Harness 术语标签 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 806,
          transform: `translate(-50%, -50%) scale(${0.7 + harness * 0.3})`,
          opacity: harness,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '14px 36px',
            borderRadius: 999,
            border: `3px solid ${theme.gear}`,
            background: theme.panel,
            boxShadow: `0 0 60px ${theme.gear}33`,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 38, fontWeight: 700, color: theme.gear}}>Agent Harness</span>
          <span style={{fontFamily: theme.sans, fontSize: 32, color: theme.text}}>＝ 装备「脚手架」</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 1-D：统一叫法：装备 + 右下角公式彩蛋 A=(θ,Σ) */
const BeatFormula: React.FC<{dur: number}> = ({dur}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stamp = spring({frame: frame - 8, fps, config: {damping: 12}});
  const fIn = interpolate(frame, [dur * 0.45, dur * 0.45 + 26], [0, 1], CLAMP);
  return (
    <AbsoluteFill>
      <FadeUp delay={4} style={{position: 'absolute', top: 236, width: '100%', textAlign: 'center'}}>
        <div style={{fontFamily: theme.sans, fontSize: 36, color: theme.dim}}>记不住也没关系——后面统一叫它：</div>
      </FadeUp>

      <div
        style={{
          position: 'absolute',
          top: 400,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 36,
        }}
      >
        {['👓', '📓', '🧰', '📜'].map((e, i) => {
          const p = interpolate(frame, [8 + i * 4, 22 + i * 4], [0, 1], CLAMP);
          return (
            <div key={e} style={{fontSize: 64, opacity: p, transform: `translateY(${(1 - p) * 24}px)`}}>
              {e}
            </div>
          );
        })}
        <div style={{fontSize: 56, color: theme.dim, marginLeft: 8}}>⟶</div>
        <div
          style={{
            fontFamily: theme.sans,
            fontSize: 148,
            fontWeight: 900,
            lineHeight: 1,
            color: theme.gear,
            textShadow: `0 0 90px ${theme.gear}66`,
            opacity: stamp,
            transform: `scale(${2.1 - stamp * 1.1}) rotate(${(1 - stamp) * -8}deg)`,
          }}
        >
          装备
        </div>
      </div>

      {/* 角落彩蛋：论文记号 */}
      <div
        style={{
          position: 'absolute',
          right: 108,
          top: 676,
          width: 600,
          padding: '22px 30px',
          borderRadius: 18,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          boxShadow: `0 0 80px ${theme.brain}2A, 0 0 80px ${theme.gear}2A`,
          opacity: fIn,
          transform: `translateY(${(1 - fIn) * 22}px)`,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.dim, letterSpacing: 3}}>NOTATION · 论文记号</div>
        <div style={{marginTop: 12, fontFamily: theme.mono, fontSize: 48, color: theme.text}}>
          A ＝ (<span style={{color: theme.brain}}>θ</span>, <span style={{color: theme.gear}}>Σ</span>)
        </div>
        <div style={{marginTop: 10, fontFamily: theme.mono, fontSize: 30, color: theme.dim}}>Σ ＝ (p, m, 𝒯, g)</div>
        <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>
          p 眼镜 · m 笔记本 · 𝒯 工具箱 · g 守则
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 1-E：草稿纸——写满 → 揉团 → 抛物线入纸篓 */
const BeatDraft: React.FC<{at: (id: string) => number}> = ({at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t12 = at('p1-12');
  const t13 = at('p1-13');
  const t14 = at('p1-14');
  const LINE_W = [500, 428, 545, 390, 515, 462, 530, 318];

  const enter = spring({frame: frame - t12, fps, config: {damping: 200}});
  const crumple = interpolate(frame, [t14 + 8, t14 + 26], [0, 1], CLAMP);
  const toss = interpolate(frame, [t14 + 24, t14 + 52], [0, 1], CLAMP);
  const landed = interpolate(frame, [t14 + 50, t14 + 60], [0, 1], CLAMP);
  const bounce = interpolate(frame, [t14 + 50, t14 + 56, t14 + 70], [0, 1, 0], CLAMP);
  const c13 =
    interpolate(frame, [t13, t13 + 14], [0, 1], CLAMP) * (1 - interpolate(frame, [t14, t14 + 8], [0, 1], CLAMP));
  const c14 = interpolate(frame, [t14 + 18, t14 + 38], [0, 1], CLAMP);

  const ballX = 610 + (1176 - 610) * toss;
  const ballY = 420 + (788 - 420) * toss - 300 * Math.sin(Math.PI * toss);

  const idx = Math.min(LINE_W.length - 1, Math.max(0, Math.floor((frame - t13) / 6)));
  const curW = LINE_W[idx] * interpolate(frame, [t13 + idx * 5, t13 + idx * 5 + 16], [0, 1], CLAMP);

  return (
    <AbsoluteFill>
      {/* 手边的机器人 */}
      <div style={{position: 'absolute', left: 1352, top: 236, opacity: 0.5}}>
        <RobotSketch frame={frame} width={280} color={theme.dim} />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 610,
          top: 138,
          transform: 'translate(-50%, -50%)',
          opacity: enter,
        }}
      >
        <span style={{...chip, fontSize: 30, color: theme.dim}}>📄 草稿纸 · 临时思考 / 中间计划</span>
      </div>

      {/* 草稿纸 */}
      <div
        style={{
          position: 'absolute',
          left: 300,
          top: 196,
          width: 620,
          padding: '34px 40px',
          borderRadius: 10 + 210 * crumple,
          background: '#E8EDF4',
          boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
          opacity: enter * (1 - Math.max(0, (crumple - 0.55) / 0.45)),
          transform: `rotate(${70 * crumple}deg) scale(${1 - 0.72 * crumple})`,
        }}
      >
        {LINE_W.map((w, i) => {
          const p = interpolate(frame, [t13 + i * 5, t13 + i * 5 + 16], [0, 1], CLAMP);
          return (
            <div
              key={i}
              style={{height: 5, width: w * p, borderRadius: 3, background: '#93A5BC', marginBottom: 45, opacity: 0.8}}
            />
          );
        })}
      </div>

      {/* 写字的铅笔 */}
      {frame >= t13 && frame < t14 ? (
        <div style={{position: 'absolute', left: 340 + curW + 10, top: 206 + idx * 50, fontSize: 56}}>✏️</div>
      ) : null}

      {/* 纸团 + 纸篓 */}
      <div
        style={{
          position: 'absolute',
          left: ballX,
          top: ballY,
          width: 106,
          height: 106,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 34% 30%, #D4DCE8, #8B9BB1 55%, #5E6E85 100%)',
          boxShadow: '0 14px 30px rgba(0,0,0,0.4)',
          transform: `translate(-50%, -50%) rotate(${frame * 9}deg)`,
          opacity: crumple * (1 - landed),
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 1176,
          top: 812,
          fontSize: 150,
          transform: `translate(-50%, -50%) scaleY(${1 - 0.12 * bounce})`,
          transformOrigin: 'center bottom',
        }}
      >
        🗑️
      </div>

      <div style={{position: 'absolute', left: 610, top: 706, transform: 'translate(-50%, -50%)', opacity: c13}}>
        <span style={{...chip, fontSize: 30, color: theme.dim}}>任务一结束 → 全扔</span>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 610,
          top: 776,
          transform: `translate(-50%, -50%) translateY(${(1 - c14) * 18}px)`,
          opacity: c14,
          fontFamily: theme.sans,
          fontSize: 40,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{color: theme.dim}}>写得再多，</span>
        <span style={{color: theme.danger, fontWeight: 800}}>也不叫变强 ✗</span>
      </div>
    </AbsoluteFill>
  );
};

/** 1-F：定义卡——把经验变成【持久】的升级，「持久」描红下划线扫描 */
const BeatDefinition: React.FC<{at: (id: string) => number}> = ({at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t16 = at('p1-16');
  const t17 = at('p1-17');
  const mainIn = spring({frame: frame - t16, fps, config: {damping: 200}});
  const ul = interpolate(frame, [t16 + 26, t16 + 50], [0, 1], CLAMP);
  const rowIn = spring({frame: frame - t17, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <FadeUp delay={4} style={{textAlign: 'center'}}>
        <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.dim, letterSpacing: 4}}>DEFINITION</div>
        <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 34, color: theme.dim}}>
          论文对「自我进化」的定义，特别严格——
        </div>
      </FadeUp>

      <div style={{marginTop: 44, textAlign: 'center', opacity: mainIn, transform: `translateY(${(1 - mainIn) * 30}px)`}}>
        <div style={{fontFamily: theme.serif, fontSize: 42, color: theme.dim}}>自我进化 ＝</div>
        <div style={{marginTop: 24, fontFamily: theme.serif, fontSize: 86, fontWeight: 700, color: theme.text, lineHeight: 1.4}}>
          把经验变成{' '}
          <span
            style={{
              position: 'relative',
              display: 'inline-block',
              color: theme.danger,
              padding: '0 6px',
              textShadow: `0 0 40px ${theme.danger}55`,
            }}
          >
            持久
            <span
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: -10,
                height: 9,
                borderRadius: 5,
                background: theme.danger,
                boxShadow: `0 0 24px ${theme.danger}88`,
                transform: `scaleX(${ul})`,
                transformOrigin: 'left center',
              }}
            />
          </span>{' '}
          的升级
        </div>
      </div>

      <div
        style={{
          marginTop: 72,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 30,
          opacity: rowIn,
          transform: `translateY(${(1 - rowIn) * 24}px)`,
        }}
      >
        <span style={{...chip, fontSize: 32, padding: '12px 28px'}}>📈 今天变强</span>
        <span style={{fontFamily: theme.sans, fontSize: 46, color: theme.dim}}>⟶</span>
        <span
          style={{
            ...chip,
            fontSize: 32,
            padding: '12px 28px',
            border: `2px solid ${theme.ok}`,
            color: theme.ok,
            fontWeight: 700,
          }}
        >
          ✓ 明天还在
        </span>
      </div>
    </AbsoluteFill>
  );
};

const ScalpelIcon: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <path d="M34 6 L42 14 L20 34 L14 28 Z" fill={color} opacity={0.9} />
    <path d="M14 28 L6 42" stroke={color} strokeWidth={5} strokeLinecap="round" />
  </svg>
);

const HangerIcon: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <path d="M24 16 L42 38 H6 Z" stroke={color} strokeWidth={4} strokeLinejoin="round" />
    <path d="M24 16 V11 C24 5 32 5 32 10" stroke={color} strokeWidth={4} strokeLinecap="round" />
  </svg>
);

/** 1-G：全片分叉地图——左蓝改大脑（第 5 章），右橙改装备（第 6 章） */
const BeatFork: React.FC<{at: (id: string) => number}> = ({at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t18 = at('p1-18');
  const t19 = at('p1-19');
  const t20 = at('p1-20');
  const t21 = at('p1-21');
  const t22 = at('p1-22');

  const qIn = spring({frame: frame - t18, fps, config: {damping: 200}});
  const stemP = interpolate(frame, [t18 + 4, t18 + 22], [0, 1], CLAMP);
  const brP = interpolate(frame, [t19, t19 + 26], [0, 1], CLAMP);
  const cardL = spring({frame: frame - t20, fps, config: {damping: 14}});
  const cardR = spring({frame: frame - t21, fps, config: {damping: 14}});
  const badgeIn = spring({frame: frame - t22, fps, config: {damping: 13}});

  const forkLines = (items: {t: string; dim: boolean}[], t0: number) => (
    <div style={{marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12}}>
      {items.map((it, i) => {
        const p = interpolate(frame, [t0 + 8 + i * 9, t0 + 22 + i * 9], [0, 1], CLAMP);
        return (
          <div
            key={it.t}
            style={{
              fontFamily: theme.sans,
              fontSize: it.dim ? 29 : 33,
              fontWeight: it.dim ? 500 : 600,
              color: it.dim ? theme.dim : theme.text,
              opacity: p,
              transform: `translateX(${(1 - p) * -22}px)`,
            }}
          >
            {it.t}
          </div>
        );
      })}
    </div>
  );

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          top: 92,
          width: '100%',
          textAlign: 'center',
          opacity: qIn,
          transform: `translateY(${(1 - qIn) * -20}px)`,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.dim, letterSpacing: 5}}>FORK · 分岔题</div>
        <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 64, fontWeight: 800, color: theme.text}}>
          该从<span style={{color: theme.brain}}>大脑</span>下手，还是从<span style={{color: theme.gear}}>装备</span>下手？
        </div>
      </div>

      {/* 道路延伸生长 */}
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', left: 0, top: 0}}>
        <path
          d="M960 806 L960 664"
          stroke={theme.dim}
          strokeWidth={12}
          strokeLinecap="round"
          fill="none"
          opacity={0.85}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - stemP}
        />
        <path d="M960 664 C880 560 640 634 462 530" stroke={theme.brain} strokeWidth={30} strokeLinecap="round" fill="none" opacity={0.13 * brP} />
        <path
          d="M960 664 C880 560 640 634 462 530"
          stroke={theme.brain}
          strokeWidth={12}
          strokeLinecap="round"
          fill="none"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - brP}
        />
        <path d="M960 664 C1040 560 1280 634 1458 530" stroke={theme.gear} strokeWidth={30} strokeLinecap="round" fill="none" opacity={0.13 * brP} />
        <path
          d="M960 664 C1040 560 1280 634 1458 530"
          stroke={theme.gear}
          strokeWidth={12}
          strokeLinecap="round"
          fill="none"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - brP}
        />
      </svg>

      {/* 起点 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 812,
          transform: `translateX(-50%) translateY(${(1 - qIn) * 26}px)`,
          opacity: qIn,
          padding: '12px 34px',
          borderRadius: 999,
          background: theme.panel,
          border: `3px solid ${theme.dim}`,
          fontFamily: theme.sans,
          fontSize: 34,
          fontWeight: 700,
          color: theme.text,
          whiteSpace: 'nowrap',
        }}
      >
        🤖 想让 AI 变强
      </div>

      {/* 左：改大脑 */}
      <div
        style={{
          position: 'absolute',
          left: 180,
          top: 250,
          width: 560,
          padding: '26px 30px',
          borderRadius: 22,
          background: theme.panel,
          border: `3px solid ${theme.brain}`,
          boxShadow: `0 0 70px ${theme.brain}26`,
          opacity: cardL,
          transform: `translateY(${(1 - cardL) * 36}px) scale(${0.9 + cardL * 0.1})`,
          transformOrigin: 'center bottom',
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
          <ScalpelIcon size={54} color={theme.brain} />
          <span style={{fontFamily: theme.sans, fontSize: 64, fontWeight: 800, color: theme.brain}}>改大脑</span>
          <span style={{marginLeft: 'auto', opacity: badgeIn, transform: `scale(${0.5 + badgeIn * 0.5})`}}>
            <Pill color={theme.brain} style={{fontFamily: theme.mono, fontSize: 26}}>
              第 5 章
            </Pill>
          </span>
        </div>
        {forkLines(
          [
            {t: '🪨 像往石头上刻字', dim: false},
            {t: '慢 · 贵', dim: true},
            {t: '但刻进去，就成本能', dim: false},
          ],
          t20,
        )}
      </div>

      {/* 右：改装备 */}
      <div
        style={{
          position: 'absolute',
          left: 1180,
          top: 250,
          width: 560,
          padding: '26px 30px',
          borderRadius: 22,
          background: theme.panel,
          border: `3px solid ${theme.gear}`,
          boxShadow: `0 0 70px ${theme.gear}26`,
          opacity: cardR,
          transform: `translateY(${(1 - cardR) * 36}px) scale(${0.9 + cardR * 0.1})`,
          transformOrigin: 'center bottom',
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
          <HangerIcon size={54} color={theme.gear} />
          <span style={{fontFamily: theme.sans, fontSize: 64, fontWeight: 800, color: theme.gear}}>改装备</span>
          <span style={{marginLeft: 'auto', opacity: badgeIn, transform: `scale(${0.5 + badgeIn * 0.5})`}}>
            <Pill color={theme.gear} style={{fontFamily: theme.mono, fontSize: 26}}>
              第 6 章
            </Pill>
          </span>
        </div>
        {forkLines(
          [
            {t: '✏️ 像用铅笔写字', dim: false},
            {t: '快 · 便宜', dim: true},
            {t: '擦掉重写就行', dim: false},
          ],
          t21,
        )}
      </div>
    </AbsoluteFill>
  );
};

export const P1Anatomy: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  /** 某镜 Sequence 内、指定句 id 的本地起始帧 */
  const rel = (beatFirstId: string) => (id: string) => {
    const first = scene.sentences.find((s) => s.id === beatFirstId);
    const s = scene.sentences.find((x) => x.id === id);
    if (!first || !s) {
      throw new Error(`P1Anatomy: 未找到句 id ${beatFirstId}/${id}`);
    }
    return s.from - first.from;
  };
  const d11 = w('p1-11');
  return (
    <AbsoluteFill>
      <BlueprintBackdrop />
      <Sequence {...w('p1-01', 'p1-03')} name="1-A 提问">
        <BeatAsk at={rel('p1-01')} />
      </Sequence>
      <Sequence {...w('p1-04', 'p1-04b')} name="1-B 大脑">
        <BeatBrain at={rel('p1-04')} />
      </Sequence>
      <Sequence {...w('p1-05', 'p1-10')} name="1-C 四件套">
        <BeatGear at={rel('p1-05')} />
      </Sequence>
      <Sequence {...d11} name="1-D 公式彩蛋">
        <BeatFormula dur={d11.durationInFrames} />
      </Sequence>
      <Sequence {...w('p1-12', 'p1-14')} name="1-E 草稿纸">
        <BeatDraft at={rel('p1-12')} />
      </Sequence>
      <Sequence {...w('p1-15', 'p1-17')} name="1-F 定义卡">
        <BeatDefinition at={rel('p1-15')} />
      </Sequence>
      <Sequence {...w('p1-18', 'p1-22')} name="1-G 分叉地图">
        <BeatFork at={rel('p1-18')} />
      </Sequence>
    </AbsoluteFill>
  );
};
