/** P0 大模型的行动瓶颈（p0-01..p0-07，3 镜）——分镜 0-A / 0-B / 0-C（storyboard v5 增强版）。
 *
 *  ★ 0-A 真实对话开局：拟真 AI Chat 界面中，用户提问源页原话：“帮我读取下我的目录下有哪些文件，
 *    并且执行XXX.py”。模型输出了 bash 命令代码块 `ls -la`，但输出完就停在原地，光标孤单闪烁，
 *    等待人类敲击回车——生动揭示「大模型是无状态文本预测器、不会自己行动」的核心瓶颈。
 *  ★ 0-B 双窗联动与中间层：左侧 Chat 窗口，右侧真实的 Shell 终端！
 *    命令复制 → 粘贴到终端 → 执行吐出文件列表 → 复制结果 → 贴回 Chat 窗口 → 模型吐出下一条命令……
 *    往返计数器 1x, 2x, 3x 飙升，中间浮现醒目的「中间层 (Manual Middleman)」警示印章。
 *  ★ 0-C Harness 自动化接棒：人肉搬运通道被一道蓝绿色的「Harness 运行时自动化总线」替换，
 *    陶土橙环体（LoopRing）闭合锁死，给模型真正接上一双自动化运行的双手。
 *  ★ 署源角标（首部署源位）：右下常驻「Learn Claude Code」，低饱和、不抢焦。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LoopRing, Panel} from '../components/motifs';
import {DUR, clamp01, useBreathe, useEnter, useImpulse, useProgress, usePushIn, useSpring, useStagger} from '../motion';
import {AgentLoopMaster} from '../components/AgentLoopMaster';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const TAIL_GAP_FRAMES = 10;

const W = {
  midlayer: 0.72,
  handoff: 0.55,
  harness: 0.88,
  loop: 0.27,
  feedBack: 0.53,
  hands: 0.8,
} as const;

/** 0-A 源页面提问原话 */
const USER_QUERY = '帮我读取下我的目录下有哪些文件，并且执行XXX.py';
const COMMAND = 'ls -la';

const CARRY_TRIPS = 9;
const CARRY_ACCEL = 1.3;

const NODE = {y: 360, w: 380, h: 170, leftX: 330, rightX: 1590} as const;
const LOOP = {cx: 960, cy: NODE.y, rx: 430, ry: 112} as const;

const RING = {size: 340, cx: 960, cy: 570} as const;
const RING_R = RING.size / 2 - 46;
const RING_ARC0 = 0.22;
const HAND_DEGREES = [205, 335] as const;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const ellPoint = (deg: number): {x: number; y: number} => {
  const rad = (deg * Math.PI) / 180;
  return {x: LOOP.cx + LOOP.rx * Math.cos(rad), y: LOOP.cy + LOOP.ry * Math.sin(rad)};
};

const ellTangent = (deg: number): {x: number; y: number} => {
  const rad = (deg * Math.PI) / 180;
  return {x: -LOOP.rx * Math.sin(rad), y: LOOP.ry * Math.cos(rad)};
};

const arrowHead = (p: {x: number; y: number}, dir: {x: number; y: number}, color: string) => {
  const len = Math.hypot(dir.x, dir.y) || 1;
  const dx = dir.x / len;
  const dy = dir.y / len;
  const nx = -dy;
  const ny = dx;
  return (
    <polygon
      points={`${p.x + dx * 20},${p.y + dy * 20} ${p.x + nx * 11},${p.y + ny * 11} ${p.x - nx * 11},${p.y - ny * 11}`}
      fill={color}
    />
  );
};

// ── 图标（简笔 SVG） ──────────────────────────────────────────────────

const PersonGlyph: React.FC<{color: string}> = ({color}) => (
  <g>
    <circle cx={0} cy={-22} r={16} fill={color} />
    <path d="M-30 34 Q-30 -4 0 -8 Q30 -4 30 34 Z" fill={color} />
  </g>
);

const BrainGlyph: React.FC<{color: string}> = ({color}) => (
  <svg width={64} height={52} viewBox="-32 -26 64 52">
    <g stroke={color} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-20 6 Q-27 -4 -18 -11 Q-17 -21 -5 -22 Q6 -23 10 -16 Q21 -14 21 -4 Q21 6 12 9 Q-4 15 -20 6 Z" />
      <path d="M0 -22 Q-3 -8 0 10" />
      <path d="M-12 -6 Q-7 -3 -10 4" />
      <path d="M11 -5 Q7 -1 9 5" />
    </g>
  </svg>
);

const TermGlyph: React.FC<{color: string}> = ({color}) => (
  <svg width={64} height={48} viewBox="-32 -24 64 48">
    <g stroke={color} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x={-26} y={-18} width={52} height={36} rx={7} />
      <path d="M-13 -6 L-4 0 L-13 6" />
      <line x1={4} y1={6} x2={14} y2={6} />
    </g>
  </svg>
);

const HAND_PATHS = [
  'M-22 4 Q-2 12 22 2',
  'M-14 -16 L-12 12',
  'M-4 -20 L-3 16',
  'M6 -20 L7 15',
  'M15 -16 L15 11',
  'M-26 -2 Q-31 -14 -19 -19',
];

/** 手在环上的落位：环上点 + 旋转角（本地 +y 从屏幕 90° 转向环心方向 deg+180） */
const handAt = (deg: number): {x: number; y: number; rot: number} => {
  const rad = (deg * Math.PI) / 180;
  return {
    x: RING.cx + RING_R * Math.cos(rad),
    y: RING.cy + RING_R * Math.sin(rad),
    rot: deg + 90,
  };
};

// ── 节点件（0-B 升起入场 / 0-C 弹簧收拢定位共用面板） ──────────────────

const NodeFace: React.FC<{accent: string; label: string; glyph: React.ReactNode}> = ({
  accent,
  label,
  glyph,
}) => (
  <Panel
    accent={accent}
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    }}
  >
    {glyph}
    <div style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: accent}}>{label}</div>
  </Panel>
);

const NodeRiser: React.FC<{
  cx: number;
  cy: number;
  accent: string;
  label: string;
  glyph: React.ReactNode;
  at: number;
  /** 可选整体压暗系数（0-B 重音 dim 谷：痛点主体聚光时节点退一层） */
  dim?: number;
}> = ({cx, cy, accent, label, glyph, at, dim = 1}) => {
  const e = useEnter('rise', {at, dur: DUR.f5, dist: 26});
  return (
    <div
      style={{
        position: 'absolute',
        left: cx - NODE.w / 2,
        top: cy - NODE.h / 2,
        width: NODE.w,
        height: NODE.h,
        opacity: e.opacity * dim,
        transform: e.transform,
      }}
    >
      <NodeFace accent={accent} label={label} glyph={glyph} />
    </div>
  );
};

const NodeCard: React.FC<{
  cx: number;
  cy: number;
  accent: string;
  label: string;
  glyph: React.ReactNode;
}> = ({cx, cy, accent, label, glyph}) => (
  <div
    style={{
      position: 'absolute',
      left: cx - NODE.w / 2,
      top: cy - NODE.h / 2,
      width: NODE.w,
      height: NODE.h,
    }}
  >
    <NodeFace accent={accent} label={label} glyph={glyph} />
  </div>
);

// ── 署源角标（首部署源位） ──────────────────────────────────────────────

/** 右下常驻「Learn Claude Code」：theme.dim 小字、一次淡入后恒定不闪烁不抢焦；
 *  bottom 168 ≥ 150 避开字幕条；挂 Sequence 外——全 P0 三镜恒定（storyboard 署源位） */
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

// ── 0-A 算力巨兽与数字囚徒（神经光纤巨人大脑与微型终端死寂） ─────────────────────────

/** 深空悬浮的神经光纤巨人大脑 */
const CyberneticBrain: React.FC<{dim: number; atSink: number}> = ({dim, atSink}) => {
  const frame = useCurrentFrame();
  const pulse = Math.sin(frame * 0.08) * 0.15 + 0.85;
  const isDead = frame >= atSink;
  const activeColor = isDead ? theme.dim : theme.tool;
  const glowColor = isDead ? 'rgba(100,100,100,0.1)' : 'rgba(100, 196, 192, 0.35)';

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        pointerEvents: 'none',
        opacity: 0.45 * dim,
      }}
    >
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <defs>
          <radialGradient id="brainGlow" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor={glowColor} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <circle cx={960} cy={420} r={460} fill="url(#brainGlow)" />
        {/* 神经网络光纤拓扑 */}
        {[
          {x1: 720, y1: 280, x2: 960, y2: 200},
          {x1: 960, y1: 200, x2: 1200, y2: 280},
          {x1: 640, y1: 420, x2: 780, y2: 380},
          {x1: 1280, y1: 420, x2: 1140, y2: 380},
          {x1: 780, y1: 380, x2: 960, y2: 440},
          {x1: 1140, y1: 380, x2: 960, y2: 440},
          {x1: 720, y1: 560, x2: 960, y2: 620},
          {x1: 1200, y1: 560, x2: 960, y2: 620},
          {x1: 960, y1: 200, x2: 960, y2: 440},
          {x1: 960, y1: 440, x2: 960, y2: 620},
        ].map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={activeColor}
            strokeWidth={1.5}
            strokeDasharray="6 6"
            opacity={0.35 * pulse}
          />
        ))}
        {/* 活跃突触节点 */}
        {[
          {cx: 720, cy: 280},
          {cx: 960, cy: 200},
          {cx: 1200, cy: 280},
          {cx: 640, cy: 420},
          {cx: 1280, cy: 420},
          {cx: 780, cy: 380},
          {cx: 1140, cy: 380},
          {cx: 960, cy: 440},
          {cx: 720, cy: 560},
          {cx: 1200, cy: 560},
          {cx: 960, cy: 620},
        ].map((node, i) => (
          <circle
            key={i}
            cx={node.cx}
            cy={node.cy}
            r={5}
            fill={activeColor}
            opacity={isDead ? 0.2 : (Math.sin(frame * 0.1 + i) * 0.3 + 0.7)}
          />
        ))}
      </svg>
    </div>
  );
};

const ZeroA: React.FC<{atSink: number; atEnterKey: number}> = ({atSink, atEnterKey}) => {
  const frame = useCurrentFrame();
  const enter = useEnter('fade', {at: 0, dur: DUR.f4});
  const sink = useProgress(atSink, DUR.f5, 'decelerate');
  const dim = 1 - 0.22 * useProgress(atSink, DUR.f6);
  const keyO =
    useProgress(atEnterKey, DUR.f5) *
    (0.4 + 0.1 * useBreathe({period: 90, amp: 1, base: 0})) *
    (1 - 0.7 * useProgress(atSink, DUR.f4));
  const cursorBlink = frame < atSink ? Math.floor(frame / 16) % 2 === 0 : false;

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <CyberneticBrain dim={dim} atSink={atSink} />
      <div
        style={{
          width: 1260,
          borderRadius: 16,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          boxShadow: '0 24px 60px rgba(0,0,0,0.65)',
          opacity: enter.opacity * dim,
          transform: `translateY(${12 * sink}px)`,
          marginTop: -60,
          overflow: 'hidden',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* 窗口顶栏 */}
        <div
          style={{
            height: 48,
            background: '#161B22',
            borderBottom: `1px solid ${theme.panelBorder}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            gap: 12,
          }}
        >
          <div style={{display: 'flex', gap: 8}}>
            <div style={{width: 14, height: 14, borderRadius: '50%', background: '#FF5F56'}} />
            <div style={{width: 14, height: 14, borderRadius: '50%', background: '#FFBD2E'}} />
            <div style={{width: 14, height: 14, borderRadius: '50%', background: '#27C93F'}} />
          </div>
          <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginLeft: 'auto'}}>
            AI Chat · Claude Assistant (百亿算力巨脑受困于终端)
          </span>
        </div>

        {/* 对话内容区 */}
        <div style={{padding: '30px 36px', display: 'flex', flexDirection: 'column', gap: 24}}>
          {/* 用户提问气泡（源页面原话） */}
          <div style={{display: 'flex', justifyContent: 'flex-end', gap: 14, alignItems: 'flex-start'}}>
            <div
              style={{
                maxWidth: 820,
                background: '#1F2937',
                border: '1.5px solid #374151',
                borderRadius: '16px 16px 4px 16px',
                padding: '16px 22px',
                fontFamily: theme.sans,
                fontSize: 24,
                color: theme.text,
                lineHeight: 1.45,
              }}
            >
              {USER_QUERY}
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: theme.core,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: 18,
              }}
            >
              你
            </div>
          </div>

          {/* 模型回答与命令块 */}
          <div style={{display: 'flex', justifyContent: 'flex-start', gap: 14, alignItems: 'flex-start'}}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: 18,
              }}
            >
              AI
            </div>
            <div
              style={{
                width: 960,
                background: '#0D1117',
                border: `1.5px solid ${theme.panelBorder}`,
                borderRadius: '4px 16px 16px 16px',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.text}}>
                你可以使用以下 Bash 命令读取目录下的文件：
              </div>

              {/* 终端代码块 */}
              <div
                style={{
                  background: '#040711',
                  border: `1.5px solid ${theme.tool}40`,
                  borderRadius: 10,
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  position: 'relative',
                }}
              >
                <div style={{display: 'flex', alignItems: 'center', gap: 12, fontFamily: theme.mono, fontSize: 26}}>
                  <span style={{color: theme.tool}}>$</span>
                  <span style={{color: theme.text}}>{COMMAND}</span>
                  <span
                    style={{
                      width: 12,
                      height: 26,
                      background: cursorBlink ? theme.tool : 'transparent',
                      display: 'inline-block',
                    }}
                  />
                </div>

                {/* 复制按钮与等待回车提示 */}
                <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                  <div
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      border: `1.5px solid ${theme.dim}50`,
                      background: '#161B22',
                      fontFamily: theme.sans,
                      fontSize: 16,
                      color: theme.dim,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>⎘</span> 复制命令
                  </div>
                  <div
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      border: `1.5px solid ${theme.dim}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      opacity: Math.max(0, keyO),
                      background: '#1F242C',
                    }}
                  >
                    <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>↵</span>
                    <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>等待回车</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 0-B 双窗联动与中间层（Chat UI + Terminal 往返搬运 + 地动山摇印章） ─────────────────

const ZeroB: React.FC<{atCarry: number; atPark: number; atWord: number; atEnd: number}> = ({
  atCarry,
  atPark,
  atWord,
  atEnd,
}) => {
  const frame = useCurrentFrame();

  // 4 个关键行为区间：
  // 1. 命令复制与飞跃：frame 8 ~ 110 (从 Chat 复制 $ ls -la 飞往 Terminal)
  // 2. 终端敲回车与执行：frame 110 ~ 160 (终端执行产生 3 行文件列表)
  // 3. 结果复制与回填：frame 160 ~ 260 (从 Terminal 复制结果飞回 Chat)
  // 4. 对话框贴入与第二轮爆发：frame 260 ~ atWord (Chat 收到结果，AI 抛出第二条命令，往返加剧)
  // 5. 压垮与印章：frame >= atWord (地动山摇，MANUAL MIDDLEMAN 盖章)

  const isCopyCmd = frame >= 8 && frame < 38;
  const isFlyCmd = frame >= 38 && frame < 110;
  const isTermEnter = frame >= 110 && frame < 135;
  const isTermExecuted = frame >= 135;
  const isCopyOutput = frame >= 155 && frame < 185;
  const isFlyOutput = frame >= 185 && frame < 260;
  const isChatPasted = frame >= 260;

  // 抛物线插值
  const smooth = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(x));
  const cmdP = clamp01((frame - 38) / 72);
  const flyCmdX = 520 + (1320 - 520) * smooth(cmdP);
  const flyCmdY = 330 - Math.sin(cmdP * Math.PI) * 90;

  const outP = clamp01((frame - 185) / 75);
  const flyOutX = 1320 - (1320 - 520) * smooth(outP);
  const flyOutY = 470 + Math.sin(outP * Math.PI) * 60;

  // 搬运小人位置
  const carrierX = isFlyCmd
    ? flyCmdX
    : isFlyOutput
      ? flyOutX
      : frame >= 260 && frame < atWord
        ? 960 + Math.sin((frame - 260) * 0.12) * 280
        : 960;
  const carrierY = isFlyCmd
    ? flyCmdY + 50
    : isFlyOutput
      ? flyOutY + 50
      : 400;

  const personO = useProgress(0, DUR.f4);
  const trackO = useProgress(DUR.f2, DUR.f5);
  const countO = useProgress(atCarry, DUR.f4);
  const pulse = useImpulse({at: atWord, dur: DUR.f6});
  const valley = 1 - 0.45 * useImpulse({at: atWord, dur: DUR.f6 + DUR.f4});
  const counterFade = 1 - useProgress(atEnd - DUR.f4, DUR.f4);
  const middlemanStamp = useEnter('pop', {at: atWord, dur: DUR.f5});

  // 地动山摇屏幕震颤（Earthquake Screen Shake）
  const shakeDecay = Math.max(0, 1 - (frame - atWord) / 24);
  const shakeX = frame >= atWord ? Math.sin((frame - atWord) * 1.3) * shakeDecay * 18 : 0;
  const shakeY = frame >= atWord ? Math.cos((frame - atWord) * 1.5) * shakeDecay * 14 : 0;

  // 红色冲击波光环（Shockwave Ripple）
  const rippleProgress = frame >= atWord ? Math.min(1, (frame - atWord) / 22) : 0;
  const rippleScale = 1 + rippleProgress * 2.8;
  const rippleOpacity = frame >= atWord ? (1 - rippleProgress) * 0.75 : 0;

  return (
    <AbsoluteFill style={{transform: `translate(${shakeX}px, ${shakeY}px)`}}>
      {/* 冲击波扩散环 */}
      {frame >= atWord && (
        <div
          style={{
            position: 'absolute',
            left: 960 - 240,
            top: 480 - 100,
            width: 480,
            height: 240,
            borderRadius: 24,
            border: `4px solid ${theme.warn}`,
            boxShadow: `0 0 60px ${theme.warn}`,
            transform: `scale(${rippleScale})`,
            opacity: rippleOpacity,
            pointerEvents: 'none',
            zIndex: 30,
          }}
        />
      )}

      {/* 左侧：Chat 对话窗建模 */}
      <div
        style={{
          position: 'absolute',
          left: 80,
          top: 140,
          width: 600,
          height: 500,
          borderRadius: 14,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          opacity: valley,
        }}
      >
        <div
          style={{
            height: 38,
            background: '#161B22',
            borderBottom: `1px solid ${theme.panelBorder}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: 8,
          }}
        >
          <div style={{width: 10, height: 10, borderRadius: '50%', background: '#FF5F56'}} />
          <div style={{width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E'}} />
          <div style={{width: 10, height: 10, borderRadius: '50%', background: '#27C93F'}} />
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginLeft: 'auto'}}>Chat 对话框</span>
        </div>
        <div style={{padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14}}>
          {/* 用户提问 */}
          <div style={{background: '#1F2937', padding: '10px 14px', borderRadius: '12px 12px 2px 12px', fontSize: 15, color: theme.text, alignSelf: 'flex-end', maxWidth: '85%'}}>
            {'“帮我读取当前目录下的文件并执行...”'}
          </div>

          {/* AI 第一次回复与代码块 */}
          <div style={{background: '#0D1117', padding: '12px 16px', borderRadius: '12px 12px 12px 2px', border: `1.5px solid ${theme.panelBorder}`}}>
            <div style={{fontSize: 13, color: theme.dim, marginBottom: 8}}>{'你可以使用以下 Bash 命令读取目录：'}</div>
            <div
              style={{
                background: isCopyCmd ? 'rgba(37, 99, 235, 0.35)' : '#040711',
                border: `1.5px solid ${isCopyCmd || isFlyCmd ? theme.tool : theme.panelBorder}`,
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 18, color: isCopyCmd ? '#60A5FA' : theme.tool}}>
                {'$ ls -la'}
              </span>
              {isCopyCmd && (
                <span style={{fontFamily: theme.mono, fontSize: 12, color: '#fff', background: '#2563EB', padding: '2px 8px', borderRadius: 4, fontWeight: 700}}>
                  {'⌘C 复制命令'}
                </span>
              )}
            </div>
          </div>

          {/* 阶段 3：从终端将输出结果贴回 Chat */}
          {isChatPasted && (
            <div style={{background: '#1F2937', border: `1.5px solid ${theme.ok}50`, padding: '10px 14px', borderRadius: '12px 12px 2px 12px', alignSelf: 'flex-end', maxWidth: '88%'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4}}>
                <span style={{fontSize: 11, color: theme.ok, background: `${theme.ok}20`, padding: '1px 6px', borderRadius: 4, fontWeight: 700}}>
                  {'⌘V 粘贴输出'}
                </span>
                <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'stdout 回喂'}</span>
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.text, lineHeight: 1.4}}>
                {'file1.txt  XXX.py  config.json'}
              </div>
            </div>
          )}

          {/* 阶段 3 贴回后，AI 吐出第二道命令 */}
          {isChatPasted && (
            <div style={{background: '#0D1117', padding: '10px 14px', borderRadius: '12px 12px 12px 2px', border: `1.5px solid ${theme.core}40`}}>
              <div style={{fontSize: 13, color: theme.dim, marginBottom: 6}}>{'已收到文件列表，正在执行入口脚本：'}</div>
              <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.core}}>{'$ python XXX.py'}</div>
            </div>
          )}
        </div>
      </div>

      {/* 右侧：真实 Shell 终端建模 */}
      <div
        style={{
          position: 'absolute',
          left: 1240,
          top: 140,
          width: 600,
          height: 500,
          borderRadius: 14,
          background: '#090D14',
          border: `2px solid ${theme.tool}40`,
          boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          opacity: valley,
        }}
      >
        <div
          style={{
            height: 38,
            background: '#101726',
            borderBottom: `1px solid ${theme.panelBorder}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: 8,
          }}
        >
          <div style={{width: 10, height: 10, borderRadius: '50%', background: '#FF5F56'}} />
          <div style={{width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E'}} />
          <div style={{width: 10, height: 10, borderRadius: '50%', background: '#27C93F'}} />
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.tool, marginLeft: 'auto'}}>~/workspace (bash)</span>
        </div>
        <div style={{padding: '16px 20px', fontFamily: theme.mono, fontSize: 15, display: 'flex', flexDirection: 'column', gap: 8}}>
          {/* 命令输入行 */}
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <span style={{color: theme.tool}}>~/workspace $</span>
            {isTermExecuted ? (
              <span style={{color: theme.text, fontWeight: 700}}>ls -la</span>
            ) : isTermEnter ? (
              <span style={{color: theme.tool}}>
                ls -la <span style={{fontSize: 12, color: '#fff', background: '#374151', padding: '1px 6px', borderRadius: 3}}>⏎ Enter</span>
              </span>
            ) : (
              <span style={{color: theme.dim, opacity: 0.5}}>_</span>
            )}
          </div>

          {/* 执行结果输出 */}
          {isTermExecuted && (
            <div
              style={{
                background: isCopyOutput ? 'rgba(46, 160, 67, 0.25)' : 'transparent',
                border: isCopyOutput ? `1.5px dashed ${theme.ok}` : '1.5px solid transparent',
                borderRadius: 8,
                padding: '6px 10px',
                position: 'relative',
              }}
            >
              {isCopyOutput && (
                <div style={{position: 'absolute', right: 8, top: 6, fontSize: 11, color: '#fff', background: theme.ok, padding: '2px 8px', borderRadius: 4, fontWeight: 700}}>
                  {'⌘C 复制输出结果'}
                </div>
              )}
              <div style={{color: theme.dim, fontSize: 13.5, lineHeight: 1.6}}>
                <div>-rw-r--r--  1 dev staff  240B Nov 15 10:00 file1.txt</div>
                <div style={{color: theme.text}}>-rw-r--r--  1 dev staff  580B Nov 15 10:02 XXX.py</div>
                <div>-rw-r--r--  1 dev staff  120B Nov 15 10:05 config.json</div>
              </div>
            </div>
          )}

          {/* 第二轮命令敲入 */}
          {isChatPasted && (
            <div style={{marginTop: 10, display: 'flex', alignItems: 'center', gap: 8}}>
              <span style={{color: theme.tool}}>~/workspace $</span>
              <span style={{color: theme.core, fontWeight: 700}}>python XXX.py</span>
              <span style={{width: 8, height: 16, background: theme.core, display: 'inline-block'}} />
            </div>
          )}
        </div>
      </div>

      {/* 飞行卡片 1：从 Chat 飞往 Terminal 搬运命令 $ ls -la */}
      {isFlyCmd && (
        <div
          style={{
            position: 'absolute',
            left: flyCmdX - 110,
            top: flyCmdY - 25,
            zIndex: 35,
            background: '#0D1117',
            border: `2px solid ${theme.tool}`,
            boxShadow: `0 0 24px ${theme.tool}60`,
            borderRadius: 10,
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.tool, fontWeight: 700}}>$</span>
          <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.text, fontWeight: 600}}>ls -la</span>
          <span style={{fontFamily: theme.mono, fontSize: 11, color: theme.tool, background: `${theme.tool}25`, padding: '2px 6px', borderRadius: 4, fontWeight: 700}}>
            ⌘C 复制
          </span>
        </div>
      )}

      {/* 飞行卡片 2：从 Terminal 飞回 Chat 搬运执行输出 */}
      {isFlyOutput && (
        <div
          style={{
            position: 'absolute',
            left: flyOutX - 130,
            top: flyOutY - 30,
            zIndex: 35,
            background: '#0D1117',
            border: `2px solid ${theme.ok}`,
            boxShadow: `0 0 24px ${theme.ok}60`,
            borderRadius: 10,
            padding: '8px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <span style={{fontFamily: theme.mono, fontSize: 11, color: theme.ok, background: `${theme.ok}25`, padding: '2px 6px', borderRadius: 4, fontWeight: 700}}>
              ⌘C 复制输出
            </span>
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.ok}}>stdout</span>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 12, color: theme.text}}>
            file1.txt · XXX.py · config.json
          </div>
        </div>
      )}

      {/* 中间搬运回路与小人 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <ellipse
          cx={LOOP.cx}
          cy={LOOP.cy}
          rx={LOOP.rx}
          ry={LOOP.ry}
          fill="none"
          stroke={withAlpha(theme.dim, 0.4)}
          strokeWidth={3}
          strokeDasharray="10 10"
          opacity={trackO * valley}
        />
        <g opacity={trackO * valley}>
          {arrowHead(ellPoint(300), ellTangent(300), withAlpha(theme.dim, 0.85))}
          {arrowHead(ellPoint(120), ellTangent(120), withAlpha(theme.dim, 0.85))}
        </g>
        <g transform={`translate(${carrierX} ${carrierY})`} opacity={personO}>
          <PersonGlyph color={theme.text} />
          {/* 背负的层层红色重负代码卷轴 */}
          <g transform="translate(18, -12) rotate(14)">
            <rect x={-14} y={-24} width={28} height={8} rx={2} fill={theme.warn} />
            <rect x={-16} y={-14} width={32} height={8} rx={2} fill={theme.warn} opacity={0.85} />
            <rect x={-12} y={-4} width={24} height={8} rx={2} fill={theme.warn} opacity={0.7} />
            {isChatPasted && (
              <rect x={-18} y={-34} width={36} height={8} rx={2} fill={theme.warn} opacity={0.95} />
            )}
          </g>
        </g>
      </svg>

      {/* 底部当前具体操作说明横条 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 670,
          textAlign: 'center',
          opacity: valley * counterFade,
          zIndex: 20,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(10, 16, 26, 0.9)',
            border: `1.5px solid ${theme.panelBorder}`,
            padding: '8px 22px',
            borderRadius: 20,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>
            {isCopyCmd
              ? '① 选中 Chat 中的命令并按 ⌘C'
              : isFlyCmd
                ? '② 切换窗口，将命令 $ ls -la 运往本地终端'
                : isTermEnter
                  ? '③ 终端粘贴 ⌘V 并按下 ⏎ Enter 执行'
                  : isCopyOutput
                    ? '④ 全选终端执行产生的文件列表并按 ⌘C'
                    : isFlyOutput
                      ? '⑤ 切换回浏览器，将结果运回 Chat 对话框'
                      : isChatPasted
                        ? '⑥ 粘贴结果 ⌘V 喂给模型，触发下一轮折磨...'
                        : '人类充当脆弱的数据管道，反复在两极折返跑'}
          </span>
        </div>
      </div>

      {/* 重型血红机械印章：中间层 (MANUAL MIDDLEMAN) 狠狠砸下 */}
      <div
        style={{
          position: 'absolute',
          left: 960 - 240,
          top: 450,
          width: 480,
          padding: '16px 28px',
          borderRadius: 16,
          border: `4px solid ${theme.warn}`,
          background: 'linear-gradient(180deg, rgba(239, 100, 97, 0.28) 0%, rgba(180, 40, 40, 0.42) 100%)',
          boxShadow: `0 0 50px rgba(239, 100, 97, 0.5), inset 0 0 24px rgba(239, 100, 97, 0.3)`,
          textAlign: 'center',
          zIndex: 40,
          backdropFilter: 'blur(8px)',
          ...middlemanStamp,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14}}>
          <span style={{fontSize: 32}}>⚠️</span>
          <div style={{fontFamily: theme.sans, fontSize: 38, fontWeight: 900, color: theme.warn, letterSpacing: 2}}>
            人肉中间层
          </div>
          <span style={{fontSize: 32}}>⚠️</span>
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 20, fontWeight: 700, color: '#FFA09E', marginTop: 4, letterSpacing: 3}}>
          [ MANUAL MIDDLEMAN ]
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 0-C 接棒建锚（统一 Agent Loop 模型首次宏大建锚） ──────────────────────────

/**
 * 0-C Harness 宏大母体正式接棒：
 * 完全采用全篇一以贯之的 Agent Loop 核心模型（图 2）：
 * 1. 随着 p0-06 启动，内部左侧「LLM 认知大脑」与右侧「TOOL 物理终端」就位；
 * 2. 「这套底座就是 Harness」：顶部宏观母体铭牌 [ HARNESS : AGENT LOOP & CONTEXT BUS ] 亮起弹出；
 * 3. p0-07「它的秘密极简：一个死循环」：大圆环以电弧动效迅速绘制闭合，双轨虚线加速环同步点亮；
 * 4. 五大主语外环节点（User, Harness, LLM, Tool, Context）依次顺时针点亮；
 * 5. 「给瘫痪大脑接上一双手」：反馈巡游光点回填闭合，底部 — while True — 铭文呼吸点亮，完美无缝交棒 1-A。
 */
const ZeroC: React.FC<{
  atBlock: number;
  atHarness: number;
  atFeed: number;
  atFeedDot: number;
  atHands: number;
  atPush: number;
  pushDur: number;
  atEnd: number;
}> = ({atHarness, atFeed, atFeedDot, atPush, pushDur, atEnd}) => {
  const push = usePushIn(atPush, {scale: 0.055, dur: pushDur});

  // 1. 核心卡片就位升起（LLM 与 TOOL）
  const coreO = useProgress(0, DUR.f4);
  // 2. Harness 母体大铭牌：「这套底座就是 Harness」
  const headerO = useProgress(atHarness, DUR.f4);
  // 3. 大圆环电弧闭合：「一个死循环」
  const draw = useProgress(atFeed, DUR.f5, 'decelerate');
  // 4. 五大主语节点牌顺时针点亮
  const stationTicks = useStagger(5, {at: atFeed + 4, stride: 3, dur: DUR.f3});
  // 5. 底部 while True 铭文浮现
  const footnoteO = useProgress(atFeed + DUR.f4, DUR.f4);
  // 6. 结果巡游光点：沿环巡游闭合
  const dotP = useProgress(atFeedDot, DUR.f5 + DUR.f3);
  const dotO =
    useProgress(atFeedDot, DUR.f4) * (1 - useProgress(atEnd - DUR.f4, DUR.f4));

  return (
    <AbsoluteFill style={{transform: push}}>
      <AgentLoopMaster
        headerOpacity={headerO}
        coreOpacity={coreO}
        drawProgress={draw}
        stationOpacities={stationTicks}
        footnoteOpacity={footnoteO}
        dotProgress={dotP}
        dotOpacity={dotO}
      />
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0ColdOpen: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;

  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-05');
  const bC = w('p0-06', 'p0-07');

  return (
    <AbsoluteFill>
      <SourceCredit />
      <Sequence {...bA} name="0-A">
        <ZeroA
          atSink={at('p0-03') + span('p0-03') - (DUR.f5 + TAIL_GAP_FRAMES) - bA.from}
          atEnterKey={at('p0-01') - bA.from + Math.round(span('p0-01') * 0.78)}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        {/* 局部帧 0 = p0-04 起点；词落位按句窗比例锚定（TTS 变更自动重定时） */}
        <ZeroB
          atCarry={DUR.f5}
          atPark={bB.durationInFrames - DUR.f5}
          atWord={at('p0-05') - bB.from + Math.round(span('p0-05') * W.midlayer)}
          atEnd={bB.durationInFrames}
        />
      </Sequence>
      <Sequence {...bC} name="0-C">
        <ZeroC
          atBlock={at('p0-06') - bC.from + Math.round(span('p0-06') * W.handoff)}
          atHarness={at('p0-06') - bC.from + Math.round(span('p0-06') * W.harness)}
          atFeed={at('p0-07') - bC.from + Math.round(span('p0-07') * W.loop)}
          atFeedDot={at('p0-07') - bC.from + Math.round(span('p0-07') * W.feedBack)}
          atHands={at('p0-07') - bC.from + Math.round(span('p0-07') * W.hands)}
          atPush={at('p0-07') - bC.from}
          pushDur={Math.max(DUR.f6, Math.round(span('p0-07') * 0.3))}
          atEnd={bC.durationInFrames}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
