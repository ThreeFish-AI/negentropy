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
import {FadeUp, Pill} from '../components/cards';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';

const V = 1080 - 160; // 安全区下边界：底部 160px 为全局字幕区

/** 小号英文方法名角标 */
const MethodTag: React.FC<{text: string; top?: number; delay?: number}> = ({
  text,
  top = 84,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - delay, fps, config: {damping: 200}});
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: '50%',
        transform: `translateX(-50%) translateY(${(1 - enter) * 14}px)`,
        opacity: enter,
        padding: '7px 18px',
        borderRadius: 8,
        background: '#05070B',
        border: `1.5px solid ${theme.gear}88`,
        fontFamily: theme.mono,
        fontSize: 22,
        color: theme.gear,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
};

/* ───────────────── 3-A 章头：四层阶梯 ───────────────── */

/** 3-A：橙色章节卡"第二条路：改装备" + 四层阶梯自下而上点亮（p3-05），p3-05b 强调第四层 */
const ChapterLadder: React.FC<{at: (id: string) => number}> = ({at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const t04 = at('p3-04');
  const t05 = at('p3-05');
  const t05b = at('p3-05b');
  // p3-05 "排成四层阶梯" → 逐层点亮；p3-05b → 第四层强调
  const lit = interpolate(frame, [t05, t05 + 32, t05 + 64, t05 + 96, t05b], [0, 1, 2, 3, 4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const subIn = interpolate(frame, [t04 + 27, t04 + 59], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const badge = interpolate(frame, [t05b + 45, t05b + 77], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rows = [
    {n: 4, label: '改整套装备', sub: '· 连组装方式一起改', icon: '🤖'},
    {n: 3, label: '造工具', sub: '· 工具箱', icon: '🧰'},
    {n: 2, label: '记笔记', sub: '· 记忆', icon: '📓'},
    {n: 1, label: '换眼镜', sub: '· 提示词', icon: '👓'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{textAlign: 'center', opacity: enter}}>
        <div style={{fontFamily: theme.sans, fontSize: 34, color: theme.gear, letterSpacing: 8}}>
          第二条路 · 第 6 章
        </div>
        <div style={{marginTop: 20, fontFamily: theme.sans, fontWeight: 800, fontSize: 104, color: theme.text}}>
          改装备
        </div>
        <div
          style={{
            margin: '22px auto 0',
            height: 6,
            width: 480,
            borderRadius: 3,
            background: `linear-gradient(90deg, transparent, ${theme.gear}, transparent)`,
          }}
        />
        <div style={{marginTop: 16, fontFamily: theme.sans, fontSize: 28, color: theme.dim, opacity: subIn}}>
          大脑一个旋钮都不动 · 快、便宜、改坏了随时一键撤销
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 1080 - V + 24,
          left: '50%',
          transform: `translateX(-50%) translateY(${(1 - enter) * 50}px)`,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          alignItems: 'flex-start',
        }}
      >
        {rows.map((r) => {
          const p = Math.max(0, Math.min(1, lit - (r.n - 1)));
          const isLit = p > 0.55;
          return (
            <div
              key={r.n}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                padding: '0 30px',
                width: 360 + r.n * 150,
                height: 68,
                borderRadius: 12,
                background: `linear-gradient(90deg, ${theme.gearDeep}, ${theme.panel})`,
                border: `2px solid ${isLit ? theme.gear : theme.panelBorder}`,
                boxShadow: isLit ? `0 0 32px ${theme.gear}55` : 'none',
                opacity: 0.5 + p * 0.5,
              }}
            >
              <span style={{fontSize: 34, filter: isLit ? 'none' : 'grayscale(1) opacity(0.6)'}}>{r.icon}</span>
              <span style={{fontFamily: theme.mono, fontSize: 26, color: isLit ? theme.gear : theme.dim, width: 42}}>
                L{r.n}
              </span>
              <span
                style={{
                  fontFamily: theme.sans,
                  fontSize: 30,
                  fontWeight: 700,
                  color: isLit ? theme.text : theme.dim,
                }}
              >
                {r.label}
              </span>
              <span style={{fontFamily: theme.sans, fontSize: 24, color: isLit ? theme.dim : theme.panelBorder}}>
                {r.sub}
              </span>
            </div>
          );
        })}
        <div
          style={{
            alignSelf: 'flex-end',
            opacity: badge,
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.gear,
          }}
        >
          前三层各改一件 → 第四层：整套装备连组装方式一起改
        </div>
      </div>
      <div style={{position: 'absolute', top: 64, right: 88, fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>
        Σ 通路 · θ 不动
      </div>
    </AbsoluteFill>
  );
};

/* ───────────────── 3-B 换眼镜 ───────────────── */

/** 3-B：眼镜特写，镜片提示词文本流动；p3-08 换镜片 → 世界重着色 */
const Glasses: React.FC<{at: (id: string) => number}> = ({at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  // p3-08 "换一段提示词，就换一副看世界的眼镜"
  const t08 = at('p3-08');
  const swap = interpolate(frame, [t08, t08 + 38], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const a = 1 - swap;
  const b = swap;
  const lensFill = `rgb(${Math.round(28 + a * 64)}, 58, ${Math.round(92 - a * 64)})`;
  const lensStroke = swap < 0.5 ? theme.gear : theme.brain;
  const hint = interpolate(frame, [t08 + 60, t08 + 90], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const scroll = (frame * 1.6) % 250;
  const Lens: React.FC<{cx: number}> = ({cx}) => (
    <g>
      <clipPath id={`p3lens${cx}`}>
        <circle cx={cx} cy={0} r={112} />
      </clipPath>
      <circle cx={cx} cy={0} r={118} fill={lensFill} fillOpacity={0.92} stroke={lensStroke} strokeWidth={6} />
      <g clipPath={`url(#p3lens${cx})`}>
        {[0, 1, 2, 3, 4].map((k) => (
          <rect
            key={k}
            x={cx - 148}
            y={-104 + ((k * 50 + scroll) % 250) - 30}
            width={296}
            height={13}
            rx={6}
            fill={theme.text}
            opacity={0.55 - k * 0.08}
          />
        ))}
      </g>
      <path
        d={`M ${cx - 78} -70 L ${cx - 20} -70 L ${cx - 60} 70 L ${cx - 110} 70 Z`}
        fill="#FFFFFF"
        opacity={0.09}
      />
    </g>
  );
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {/* 世界随镜片重着色 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 36%, rgba(255,159,69,${0.2 * a + 0.02}), transparent 60%), radial-gradient(circle at 50% 36%, rgba(74,158,255,${0.2 * b + 0.02}), transparent 60%)`,
        }}
      />
      <div style={{position: 'absolute', top: 96, display: 'flex', gap: 64}}>
        {['🌲', '🏠', '🚗', '🌈', '✨', '🔭'].map((e, i) => (
          <FadeUp key={e} delay={26 + i * 5} style={{fontSize: 56, opacity: 0.85}}>
            {e}
          </FadeUp>
        ))}
      </div>
      <div style={{transform: `translateY(20px) scale(${0.92 + enter * 0.08})`}}>
        <svg width={960} height={340} viewBox="-480 -170 960 340">
          <g transform="translate(0,14)">
            <Lens cx={-196} />
            <Lens cx={196} />
            <path d="M -78 0 Q -28 -98 78 0" fill="none" stroke={lensStroke} strokeWidth={12} strokeLinecap="round" />
            <path d="M -314 -22 Q -358 -74 -400 -48" fill="none" stroke={lensStroke} strokeWidth={10} strokeLinecap="round" />
            <path d="M 314 -22 Q 358 -74 400 -48" fill="none" stroke={lensStroke} strokeWidth={10} strokeLinecap="round" />
          </g>
        </svg>
      </div>
      <div style={{position: 'absolute', top: 752, display: 'flex', gap: 24, alignItems: 'center'}}>
        <Pill color={swap < 0.5 ? theme.gear : theme.panelBorder}>镜片 A · 严谨模式</Pill>
        <span style={{fontSize: 34, color: theme.dim, opacity: hint}}>⇄</span>
        <Pill color={swap >= 0.5 ? theme.brain : theme.panelBorder}>镜片 B · 诗人模式</Pill>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 826,
          width: 1200,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.dim,
          opacity: hint,
        }}
      >
        提示词 = 行为出厂设置 · 同一个大脑，换一段提示词 → 换一副看世界的眼镜
      </div>
      <div
        style={{
          position: 'absolute',
          top: 118,
          fontFamily: theme.sans,
          fontSize: 30,
          fontWeight: 700,
          color: theme.gear,
          opacity: enter,
        }}
      >
        第一层：换眼镜——让 AI 自己改提示词
      </div>
    </AbsoluteFill>
  );
};

/* ───────────────── 3-C 提示进化史 ───────────────── */

/** 3-C：四阶段横向时间轴：打分(p3-10)→评语(p3-11)→种群进化(p3-12)→TextGrad(p3-13/14)，角标随 p3-15 */
const PromptEvolution: React.FC<{at: (id: string) => number}> = ({at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t10 = at('p3-10');
  const t11 = at('p3-11');
  const t12 = at('p3-12');
  const t13 = at('p3-13');
  const t15 = at('p3-15');
  const t = interpolate(
    frame,
    [t10, t10 + 14, t11, t11 + 14, t12, t12 + 14, t13, t13 + 14],
    [0, 1, 1, 2, 2, 3, 3, 4],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );
  const capOpacity = interpolate(frame, [t15 + 15, t15 + 43], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const X = [90, 510, 930, 1350];
  const M = X.map((x) => x + 84); // 轴点
  const cursorX = M[0] + ((t - 1) / 3) * (M[3] - M[0]);
  const Card: React.FC<{
    i: number;
    title: string;
    sub: React.ReactNode;
    children: React.ReactNode;
  }> = ({i, title, sub, children}) => {
    const s = spring({frame: frame - [t10, t11, t12, t13][i], fps, config: {damping: 200}});
    const active = t > i;
    return (
      <div
        style={{
          position: 'absolute',
          left: X[i],
          top: 262,
          width: 300,
          height: 330,
          borderRadius: 18,
          background: theme.panel,
          border: `2.5px solid ${active ? theme.gear : theme.panelBorder}`,
          boxShadow: active ? `0 0 34px ${theme.gear}33` : 'none',
          opacity: s,
          transform: `translateY(${(1 - s) * 26}px)`,
          padding: 20,
          textAlign: 'center',
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 700, color: active ? theme.gear : theme.dim}}>
          {title}
        </div>
        <div style={{marginTop: 14, height: 110, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
          {children}
        </div>
        <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 23, color: theme.dim, lineHeight: 1.5}}>{sub}</div>
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 92, width: '100%', textAlign: 'center'}}>
        <span style={{fontFamily: theme.sans, fontSize: 54, fontWeight: 800, color: theme.text}}>
          提示词的自动进化史
        </span>
        <span style={{marginLeft: 20, fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
          怎么自动改？
        </span>
      </div>
      {/* 时间轴 */}
      <div style={{position: 'absolute', top: 208, left: 150, width: 1560, height: 4, background: theme.panelBorder, borderRadius: 2 }}>
        <div
          style={{
            width: Math.max(4, cursorX - 150),
            height: 4,
            borderRadius: 2,
            background: theme.gear,
            opacity: 0.6,
          }}
        />
        {M.map((x, i) => (
          <div
            key={x}
            style={{
              position: 'absolute',
              left: x - 150,
              top: -7,
              width: 18,
              height: 18,
              borderRadius: 9,
              background: t > i ? theme.gear : theme.panelBorder,
              boxShadow: t > i ? `0 0 16px ${theme.gear}` : 'none',
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            left: cursorX - 150 - 3,
            top: -11,
            width: 6,
            height: 26,
            borderRadius: 3,
            background: theme.text,
          }}
        />
      </div>
      <div style={{position: 'absolute', top: 0, left: 0, width: 1920, height: 620}}>
        <Card i={0} title="打分" sub={<>只给一个数字<br />让它瞎猜怎么改</>}>
          <div>
            <div style={{fontFamily: theme.mono, fontSize: 44, color: theme.text}}>62</div>
            <div style={{fontSize: 38, color: theme.dim}}>❓❓❓</div>
          </div>
        </Card>
        <Card i={1} title="评语" sub={<>红笔批注<br />"你错在这里，往这改"</>}>
          <div style={{fontFamily: theme.mono, fontSize: 27, lineHeight: 1.8}}>
            <div>
              <span style={{color: theme.danger}}>✗ 理由太空洞</span>
            </div>
            <div>
              <span style={{color: theme.ok}}>↑ 补数据再下结论</span>
            </div>
          </div>
        </Card>
        <Card i={2} title="种群进化" sub={<>提示词当基因<br />杂交变异 · 优胜劣汰</>}>
          <svg width="220" height="110" viewBox="0 0 220 110">
            <path d="M 40 18 C 40 62 66 96 110 96 M 110 18 C 110 62 110 96 110 96 M 180 18 C 180 62 154 96 110 96" stroke={theme.gear} strokeWidth={4} fill="none" opacity={0.85} />
            <circle cx={40} cy={18} r={9} fill={theme.brain} />
            <circle cx={110} cy={18} r={9} fill={theme.gear} />
            <circle cx={180} cy={18} r={9} fill={theme.brain} />
            <circle cx={110} cy={96} r={11} fill={theme.ok} />
          </svg>
        </Card>
        <Card i={3} title="文本梯度" sub={<>自然语言批注<br />沿链路逐段改回开头</>}>
          <svg width="220" height="110" viewBox="0 0 220 110">
            <defs>
              <marker id="p3tArrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                <path d="M 0 0 L 9 4.5 L 0 9 z" fill={theme.gear} />
              </marker>
            </defs>
            {[
              [16, 100, '结果'],
              [16, 55, '中段'],
              [16, 10, '开头'],
            ].map(([x, y, label]) => (
              <React.Fragment key={label as string}>
                <rect x={x as number} y={(y as number) - 13} width={84} height={26} rx={13} fill="#05070B" stroke={theme.panelBorder} />
                <text x={(x as number) + 42} y={(y as number) + 5} textAnchor="middle" fontSize={16} fill={theme.dim}>
                  {label as string}
                </text>
              </React.Fragment>
            ))}
            <path d="M 104 100 C 168 100 168 78 168 55 C 168 32 168 10 106 23" fill="none" stroke={theme.gear} strokeWidth={5} markerEnd="url(#p3tArrow)" />
          </svg>
        </Card>
      </div>
      <MethodTag text="APE / OPRO → Reflexion → PromptBreeder → APO / TextGrad" top={716} delay={t15 + 15} />
      <div
        style={{
          position: 'absolute',
          bottom: 1080 - V + 16,
          width: '100%',
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.dim,
          opacity: capOpacity,
        }}
      >
        反馈信号越来越具体：一个数字 → 一句评语 → 一代种群 → 一条梯度
      </div>
    </AbsoluteFill>
  );
};

/* ───────────────── 3-D 金句 + 天平 ───────────────── */

/** 3-D：金句"反馈越具体，机器越不用靠猜"（p3-16）+ 玄学/工程学天平倾斜（p3-17） */
const BalanceScale: React.FC<{at: (id: string) => number}> = ({at}) => {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [0, 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // p3-17 "玄学手艺 → 工程学"
  const t17 = at('p3-17');
  const tilt = interpolate(frame, [t17 + 4, t17 + 68], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const ang = 10 * tilt; // +10deg：左端（玄学）上翘，右端（工程学）下沉
  const rad = (ang * Math.PI) / 180;
  const beamHalf = 250;
  const endL = {x: -beamHalf * Math.cos(rad), y: -beamHalf * Math.sin(rad)};
  const endR = {x: beamHalf * Math.cos(rad), y: beamHalf * Math.sin(rad)};
  const panY = 96;
  const bottomLine = interpolate(frame, [t17 + 78, t17 + 110], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const pans = [
    {end: endL, label: '玄学', hint: '全靠猜', hot: false, color: theme.dim},
    {end: endR, label: '工程学', hint: '照着改', hot: true, color: theme.gear},
  ];
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          top: 130,
          width: '100%',
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 68,
          fontWeight: 700,
          color: theme.text,
          opacity: appear,
        }}
      >
        反馈越具体，
      </div>
      <div
        style={{
          position: 'absolute',
          top: 242,
          width: '100%',
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 68,
          fontWeight: 700,
          color: theme.gear,
          opacity: appear,
        }}
      >
        机器越不用靠猜
      </div>
      {/* 天平 */}
      <div style={{position: 'absolute', top: 400, left: 0, width: 1920, height: 420, opacity: appear}}>
        <div
          style={{
            position: 'absolute',
            left: 960 - 30,
            top: 70,
            width: 60,
            height: 130,
            background: theme.panelBorder,
            clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
          }}
        />
        <div style={{position: 'absolute', left: 880, top: 198, width: 160, height: 10, borderRadius: 5, background: theme.panelBorder}} />
        <div
          style={{
            position: 'absolute',
            left: 960 - beamHalf,
            top: 66,
            width: beamHalf * 2,
            height: 10,
            borderRadius: 5,
            background: `linear-gradient(90deg, ${theme.dim}, ${theme.gear})`,
            transformOrigin: `${beamHalf}px 5px`,
            transform: `rotate(${ang}deg)`,
          }}
        />
        {pans.map((p) => (
          <div
            key={p.label}
            style={{
              position: 'absolute',
              left: 960 + p.end.x,
              top: 70 + p.end.y,
              width: 0,
              height: 0,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: -1,
                top: 0,
                width: 2,
                height: panY,
                background: theme.panelBorder,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: -120,
                top: panY,
                width: 240,
                borderRadius: 12,
                padding: '14px 10px',
                textAlign: 'center',
                background: p.hot ? theme.gearDeep : theme.panel,
                border: `2px solid ${p.hot ? p.color : theme.panelBorder}`,
                boxShadow: p.hot ? `0 0 30px ${theme.gear}44` : 'none',
              }}
            >
              <div style={{fontFamily: theme.serif, fontSize: 38, fontWeight: 900, color: p.hot ? p.color : theme.dim}}>
                {p.label}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>{p.hint}</div>
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 1080 - V + 52,
          width: '100%',
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 46,
          color: theme.text,
          opacity: bottomLine,
        }}
      >
        写提示词，从玄学变成工程学
      </div>
    </AbsoluteFill>
  );
};

/* ───────────────── 3-E 记笔记 ───────────────── */

/** 3-E：笔记本流水账（p3-19）→ 记/翻/改/忘 四动作随 p3-21..24 依次盖章 → 花生/美式例子（p3-24b/c） */
const NotebookScene: React.FC<{at: (id: string) => number}> = ({at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const t21 = at('p3-21');
  const t22 = at('p3-22');
  const t23 = at('p3-23');
  const t24 = at('p3-24');
  const t24b = at('p3-24b');
  const n = interpolate(
    frame,
    [t21, t22, t23, t24].flatMap((t0) => [t0, t0 + 16]),
    [0, 1, 1, 2, 2, 3, 3, 4],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  const flip = Math.floor(frame / 30) % 2;
  const example = interpolate(frame, [t24b, t24b + 38], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const stamps = [
    {label: '记', icon: '⬇️', note: '经验熬成套路', delay: t21},
    {label: '翻', icon: '🔗', note: '按语义连线索账', delay: t22},
    {label: '改', icon: '⚖️', note: '过时知识降权', delay: t23},
    {label: '忘', icon: '🗑️', note: '无用记忆清除', delay: t24},
  ];
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 88, width: '100%', textAlign: 'center'}}>
        <span style={{fontFamily: theme.sans, fontSize: 54, fontWeight: 800, color: theme.text}}>第二层：记笔记</span>
        <span style={{marginLeft: 22, fontFamily: theme.sans, fontSize: 30, color: theme.dim}}>让记忆自己生长</span>
      </div>
      {/* 笔记本：流水账 */}
      <div
        style={{
          position: 'absolute',
          top: 218,
          left: '50%',
          transform: `translateX(-50%) scale(${0.95 + enter * 0.05})`,
          width: 640,
          height: 330,
          borderRadius: '12px 44px 44px 12px',
          background: theme.panel,
          border: `3px solid ${theme.panelBorder}`,
          opacity: enter,
          padding: '26px 34px',
        }}
      >
        <div style={{display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center'}}>
          <span style={{fontSize: 30}}>{flip === 0 ? '📔' : '📖'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
            流水账越堆越多 → 检索越来越差
          </span>
        </div>
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <div
            key={k}
            style={{
              height: 26,
              marginBottom: 13,
              borderRadius: 13,
              width: `${72 - ((k * 11 + Math.floor(frame / 30)) % 22)}%`,
              background: k % 2 ? theme.panelBorder : theme.gearDeep,
              opacity: 0.85 - k * 0.08,
            }}
          />
        ))}
      </div>
      {/* 四枚印章 */}
      <div style={{position: 'absolute', top: 600, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 30}}>
        {stamps.map((s, i) => {
          const lit = n > i;
          const pop = spring({frame: frame - s.delay - 6, fps, config: {damping: 11}});
          const press = interpolate(pop, [0, 0.6, 1], [1.7, 0.85, 1]);
          return (
            <div
              key={s.label}
              style={{
                width: 248,
                borderRadius: 16,
                padding: '18px 12px',
                textAlign: 'center',
                background: lit ? theme.gearDeep : theme.panel,
                border: `2.5px dashed ${lit ? theme.gear : theme.panelBorder}`,
                opacity: lit ? 1 : 0.4,
                transform: `scale(${lit ? press : 1})`,
              }}
            >
              <div style={{fontFamily: theme.serif, fontSize: 46, fontWeight: 900, color: lit ? theme.gear : theme.panelBorder}}>
                {s.label}
              </div>
              <div style={{fontSize: 26}}>{lit ? s.icon : '·'}</div>
              <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{s.note}</div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 1080 - V + 16,
          width: '100%',
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 25,
          color: theme.dim,
          opacity: example,
        }}
      >
        🥜 该记的记：提过一次花生过敏，点餐永远避开 · ☕ 该忘的忘：上周三那杯美式
      </div>
    </AbsoluteFill>
  );
};

/* ───────────────── 3-F 记忆毛病 ───────────────── */

/** 3-F：近因偏差（p3-26/27 时间轴高亮）+ 相似≠有用（p3-28/29 检索卡片全打 ✗） */
const MemoryBugs: React.FC<{at: (id: string) => number}> = ({at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t26 = at('p3-26');
  const t28 = at('p3-28');
  const leftIn = spring({frame: frame - t26 + 100, fps, config: {damping: 200}});
  // p3-28 "相似，不等于有用"
  const part = interpolate(frame, [t28, t28 + 36], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const notes = [
    '三个月前 · 关键教训',
    '上个月 · 重要约束',
    '上周 · 用户偏好',
    '昨天 · 失败的重试',
    '刚才 · 新指令',
    '刚刚 · 一句闲聊',
  ];
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 80, width: '100%', textAlign: 'center'}}>
        <span style={{fontFamily: theme.sans, fontSize: 50, fontWeight: 800, color: theme.danger}}>
          记忆的两个老毛病
        </span>
      </div>
      {/* 左：近因偏差 */}
      <div
        style={{
          position: 'absolute',
          top: 200,
          left: 130,
          width: 660,
          opacity: leftIn * (1 - part * 0.5),
          transform: `translateX(${-part * 60}px)`,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 700, color: theme.danger, textAlign: 'center'}}>
          近因偏差
        </div>
        <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 23, color: theme.dim, textAlign: 'center'}}>
          只记得刚发生的事，真正关键的往事全灰了
        </div>
        {notes.map((txt, i) => {
          const hot = i >= 4;
          const app = spring({frame: frame - t26 + 112 - i * 5, fps, config: {damping: 200}});
          return (
            <div
              key={txt}
              style={{
                marginTop: 14,
                height: 56,
                borderRadius: 10,
                width: `${78 - i * 8}%`,
                marginLeft: i * 24,
                background: hot ? theme.gearDeep : theme.panel,
                border: `2px solid ${hot ? theme.gear : theme.panelBorder}`,
                opacity: app * (hot ? 1 : 0.35),
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '0 18px',
              }}
            >
              <span style={{fontSize: 23}}>{hot ? '🆕' : '⏳'}</span>
              <span style={{fontFamily: theme.sans, fontSize: 22, color: hot ? theme.text : theme.dim}}>{txt}</span>
            </div>
          );
        })}
      </div>
      {/* 右：相似≠有用 */}
      <div
        style={{
          position: 'absolute',
          top: 200,
          left: 1020,
          width: 720,
          opacity: part,
          transform: `translateX(${(1 - part) * 80}px)`,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 700, color: theme.danger, textAlign: 'center'}}>
          相似 ≠ 有用
        </div>
        <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 23, color: theme.dim, textAlign: 'center'}}>
          检索出一堆长得像的，没一条能用
        </div>
        <div style={{marginTop: 20, display: 'flex', gap: 16, justifyContent: 'center'}}>
          {['📄', '📃', '📑', '📄', '📃'].map((e, i) => {
            const app = interpolate(frame, [t28 + 8 + i * 4, t28 + 30 + i * 4], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <div
                key={i}
                style={{
                  width: 110,
                  height: 150,
                  borderRadius: 12,
                  background: theme.panel,
                  border: `2px solid ${app > 0.5 ? theme.danger : theme.panelBorder}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  opacity: app,
                  transform: `translateY(${(1 - app) * 20}px)`,
                }}
              >
                <span style={{fontSize: 40}}>{e}</span>
                <span style={{fontSize: 36, color: theme.danger, opacity: app}}>✗</span>
              </div>
            );
          })}
        </div>
        <div style={{marginTop: 22, textAlign: 'center', fontFamily: theme.mono, fontSize: 23, color: theme.dim}}>
          🔍 query: "怎么解决 X？" → top-5: 全都差不多
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 1080 - V + 16,
          width: '100%',
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 25,
          color: theme.dim,
          opacity: leftIn,
        }}
      >
        第二层：记笔记——让记忆自己生长
      </div>
    </AbsoluteFill>
  );
};

/* ───────────────── 3-G Voyager ───────────────── */

/** 像素方块（Minecraft 风小剧场用） */
const Pixel: React.FC<{x: number; y: number; s: number; fill: string; opacity?: number}> = ({
  x,
  y,
  s,
  fill,
  opacity = 1,
}) => <rect x={x} y={y} width={s} height={s} fill={fill} opacity={opacity} />;

/** 3-G：方块机器人对树写代码（p3-32）→ 砍树程序 v1 卡 ✓（p3-33）→ 存入技能库书架（p3-33 后半）→ 再遇树秒调用（p3-34） */
const VoyagerScene: React.FC<{at: (id: string) => number}> = ({at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const t32 = at('p3-32');
  const t33 = at('p3-33');
  const t34 = at('p3-34');
  // p3-32 写代码；p3-33 卡片 + 存库；p3-34 再遇树
  const code = interpolate(frame, [t32 + 13, t32 + 143], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const card = spring({frame: frame - t33 - 11, fps, config: {damping: 13}});
  const store = interpolate(frame, [t33 + 73, t33 + 113], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const recall = interpolate(frame, [t34 + 12, t34 + 42], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const codeLines = Math.floor(code * 6);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 84, width: '100%', textAlign: 'center'}}>
        <span style={{fontFamily: theme.sans, fontSize: 54, fontWeight: 800, color: theme.text}}>第三层：造工具</span>
        <span style={{marginLeft: 22, fontFamily: theme.sans, fontSize: 30, color: theme.dim}}>AI 给自己写代码</span>
      </div>
      {/* 像素世界 */}
      <div style={{position: 'absolute', top: 200, left: 240, width: 640, height: 440, opacity: enter}}>
        <svg width={640} height={440} viewBox="0 0 160 110">
          {/* 天空 */}
          {[...Array(110)].map((_, y) => (
            <rect key={y} x={0} y={y} width={160} height={1} fill={y < 40 ? '#1a2a4a' : '#0f1c30'} />
          ))}
          {/* 地面 */}
          {[...Array(14)].map((_, i) => (
            <g key={i}>
              <Pixel x={i * 12} y={86} s={12} fill="#3a5a2a" />
              <Pixel x={i * 12} y={98} s={12} fill="#4a3320" />
            </g>
          ))}
          {/* 代码编辑器面板 */}
          <g>
            <rect x={4} y={4} width={82} height={46} fill="#05070B" stroke="#2A3242" strokeWidth={1} />
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <React.Fragment key={k}>
                {k < codeLines ? (
                  <Pixel x={8} y={8 + k * 7} s={4} fill={k % 2 === 0 ? '#7ED321' : '#4A9EFF'} />
                ) : null}
                {k < codeLines ? (
                  <rect x={15} y={9 + k * 7} width={30 + ((k * 13) % 34)} height={3} fill="#F2F5FA" opacity={0.7} />
                ) : null}
              </React.Fragment>
            ))}
          </g>
          {/* 树 */}
          <Pixel x={124} y={62} s={6} fill="#4a3320" />
          <Pixel x={124} y={68} s={6} fill="#4a3320" />
          <Pixel x={124} y={74} s={6} fill="#4a3320" />
          <Pixel x={118} y={50} s={18} fill="#2a621e" />
          <Pixel x={115} y={56} s={24} fill="#2a621e" />
          <Pixel x={118} y={44} s={18} fill="#357a25" />
          {/* 方块机器人（第二只：p3-34 再遇树，⚡ 直接调用） */}
          <g>
            <Pixel x={60} y={62} s={18} fill="#8a8f98" opacity={1 - recall} />
            <Pixel x={64} y={66} s={4} fill="#39C6FF" opacity={1 - recall} />
            <Pixel x={70} y={66} s={4} fill="#39C6FF" opacity={1 - recall} />
            <Pixel x={65} y={73} s={8} fill="#5a5f68" opacity={1 - recall} />
            <Pixel x={57} y={64} s={3} fill={theme.gear} opacity={1 - recall} />
          </g>
          <g opacity={recall}>
            <Pixel x={102} y={62} s={18} fill="#8a8f98" />
            <Pixel x={106} y={66} s={4} fill="#39C6FF" />
            <Pixel x={112} y={66} s={4} fill="#39C6FF" />
            <Pixel x={107} y={73} s={8} fill="#5a5f68" />
            <text x={88} y={54} fontSize={10} fill={theme.gear} fontFamily="monospace">
              ⚡ call()
            </text>
          </g>
        </svg>
      </div>
      {/* 砍树程序 v1 卡片 */}
      <div
        style={{
          position: 'absolute',
          top: 216,
          left: 940,
          width: 380,
          padding: '20px 26px',
          borderRadius: 14,
          background: theme.panel,
          border: `2.5px solid ${theme.gear}`,
          boxShadow: `0 0 36px ${theme.gear}44`,
          opacity: card,
          transform: `scale(${0.7 + card * 0.3}) rotate(${(1 - card) * -8}deg)`,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <span style={{fontSize: 34}}>🪓</span>
          <span style={{fontFamily: theme.mono, fontSize: 28, color: theme.text}}>chop_tree.py</span>
          <span style={{marginLeft: 'auto', fontSize: 30, color: theme.ok}}>✓</span>
        </div>
        <div style={{marginTop: 12, fontFamily: theme.mono, fontSize: 21, color: theme.dim, lineHeight: 1.7}}>
          {'while tree.hp > 0:'}
          <br />
          {'  agent.swing("axe")'}
          <br />
          {'# 调试通过 ✓'}
        </div>
        <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 22, color: theme.gear}}>
          砍树程序 v1 · 调试通过
        </div>
      </div>
      {/* 技能库书架 */}
      <div
        style={{
          position: 'absolute',
          top: 470,
          left: 940,
          width: 380,
          borderRadius: 14,
          background: '#05070B',
          border: `2px solid ${theme.panelBorder}`,
          padding: '16px 22px',
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginBottom: 12}}>
          📚 技能库 Skill Library
        </div>
        <div style={{display: 'flex', gap: 14, alignItems: 'flex-end', height: 120}}>
          {[
            {t: '挖矿', o: store * 0.5},
            {t: '游泳', o: store * 0.5},
            {t: '砍树', o: store},
            {t: '', o: store * 0.5},
            {t: '', o: store * 0.5},
          ].map((bk, i) => (
            <div
              key={i}
              style={{
                writingMode: 'vertical-rl',
                padding: '10px 6px',
                borderRadius: 4,
                background: bk.t === '砍树' ? theme.gearDeep : theme.panel,
                border: `2px solid ${bk.t === '砍树' ? theme.gear : theme.panelBorder}`,
                color: bk.t === '砍树' ? theme.gear : theme.dim,
                fontFamily: theme.sans,
                fontSize: 20,
                height: 40 + bk.o * 56,
                opacity: bk.o === 0 ? 0.25 : bk.o,
              }}
            >
              {bk.t || '·'}
            </div>
          ))}
        </div>
        <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 22, color: theme.ok, opacity: store}}>
          ✓ 已注册 · 下次遇到树直接调用
        </div>
      </div>
      <MethodTag text="Voyager · 2023 · Minecraft" top={716} delay={t32 - 121} />
      <div
        style={{
          position: 'absolute',
          bottom: 1080 - V + 16,
          width: '100%',
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 25,
          color: theme.dim,
        }}
      >
        自己写代码 → 调试通过 → 存技能库 → 越玩越强
      </div>
    </AbsoluteFill>
  );
};

/* ───────────────── 3-H 工具闭环 ───────────────── */

/** 3-H：选（p3-36）→ 修（p3-38）→ 造（p3-40）三节点循环图 + p3-42 金句浮条 */
const ToolLoop: React.FC<{at: (id: string) => number}> = ({at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t36 = at('p3-36');
  const t38 = at('p3-38');
  const t40 = at('p3-40');
  const t42 = at('p3-42');
  const focus = interpolate(
    frame,
    [t36, t36 + 26, t38, t38 + 26, t40, t40 + 26],
    [0, 1, 1, 2, 2, 3],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );
  // p3-42 金句
  const quote = interpolate(frame, [t42 + 14, t42 + 46], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const nodes = [
    {label: '选', icon: '🧭', sub: '挑对工具本身就是门学问\n选错的成本会连锁放大', x: 960, y: 262},
    {label: '修', icon: '🔧', sub: '边用边修 · 像坏习惯会污染\n修不好不许入库', x: 1460, y: 562},
    {label: '造', icon: '⚒️', sub: '不够用就自己写一个\n验证 + 补文档 → 才准注册', x: 460, y: 562},
  ];
  const edges = [
    {from: 0, to: 1, owner: 0},
    {from: 1, to: 2, owner: 1},
    {from: 2, to: 0, owner: 2},
  ];
  const dash = (frame * 2) % 36;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 78, width: '100%', textAlign: 'center'}}>
        <span style={{fontFamily: theme.sans, fontSize: 52, fontWeight: 800, color: theme.text}}>工具闭环</span>
        <span style={{marginLeft: 20, fontFamily: theme.sans, fontSize: 30, color: theme.dim}}>
          选工具 · 修工具 · 造工具
        </span>
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        <defs>
          <marker id="p3loopArrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={theme.gear} />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const active = focus === e.owner + 1;
          const a = nodes[e.from];
          const b = nodes[e.to];
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y + 80}
              x2={b.x}
              y2={b.y + 80}
              stroke={active ? theme.gear : theme.panelBorder}
              strokeWidth={active ? 6 : 3}
              strokeDasharray={`${dash} 14`}
              markerEnd="url(#p3loopArrow)"
              opacity={active ? 1 : 0.5}
            />
          );
        })}
      </svg>
      {nodes.map((nd, i) => {
        const app = spring({frame: frame - 10 - i * 8, fps, config: {damping: 200}});
        const active = focus === i + 1;
        return (
          <div
            key={nd.label}
            style={{
              position: 'absolute',
              left: nd.x - 170,
              top: nd.y - 10,
              width: 340,
              borderRadius: 20,
              padding: '22px 24px',
              textAlign: 'center',
              background: active ? theme.gearDeep : theme.panel,
              border: `3px solid ${active ? theme.gear : theme.panelBorder}`,
              boxShadow: active ? `0 0 40px ${theme.gear}55` : 'none',
              opacity: app,
              transform: `translateY(${(1 - app) * 24}px)`,
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16}}>
              <span style={{fontSize: 44}}>{nd.icon}</span>
              <span style={{fontFamily: theme.serif, fontSize: 52, fontWeight: 900, color: active ? theme.gear : theme.dim}}>
                {nd.label}
              </span>
            </div>
            <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 23, color: theme.dim, whiteSpace: 'pre-line', lineHeight: 1.6}}>
              {nd.sub}
            </div>
          </div>
        );
      })}
      {/* 金句浮条 */}
      <div
        style={{
          position: 'absolute',
          bottom: 1080 - V + 44,
          left: '50%',
          transform: `translateX(-50%) translateY(${(1 - quote) * 24}px)`,
          opacity: quote,
          padding: '16px 40px',
          borderRadius: 999,
          background: '#05070B',
          border: `2px solid ${theme.gear}`,
          fontFamily: theme.serif,
          fontSize: 36,
          fontWeight: 700,
          color: theme.gear,
          whiteSpace: 'nowrap',
        }}
      >
        推进自己的能力边界，而不只是在边界内干活
      </div>
    </AbsoluteFill>
  );
};

/* ───────────────── 3-I 莫比乌斯 / 黏土 ───────────────── */

/** 3-I：第四层改整套装备——代码环上符号流动改写自己；大脑保持蓝色不动（p3-44b）；黏土（p3-48） */
const MobiusClay: React.FC<{at: (id: string) => number}> = ({at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  // p3-44b 大脑还是那个大脑
  const t44b = at('p3-44b');
  // p3-46 能不能直接改写源代码
  const t46 = at('p3-46');
  // p3-48 黏土
  const t48 = at('p3-48');
  const brainCallout = interpolate(frame, [t44b + 10, t44b + 42], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const question = interpolate(frame, [t46 + 6, t46 + 48], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const clay = interpolate(frame, [t48 + 11, t48 + 53], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const codeGlyphs = ['{ }', 'Σ', '⚙', 'if', 'def', 'Σ', '{ }', '𝒯'];
  const N = 56;
  const squeeze = 0.5 + 0.5 * Math.sin(frame * 0.05);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 82, width: '100%', textAlign: 'center'}}>
        <span style={{fontFamily: theme.sans, fontSize: 54, fontWeight: 800, color: theme.text}}>
          第四层：改造整套装备
        </span>
      </div>
      <div style={{position: 'absolute', top: 168, width: '100%', textAlign: 'center'}}>
        <span style={{fontFamily: theme.sans, fontSize: 27, color: theme.dim}}>
          提示词 · 记忆 · 工具 · 行动守则 + 组装方式 —— 本身就是一段代码
        </span>
      </div>
      {/* 左：稳定蓝大脑（不动） */}
      <div
        style={{
          position: 'absolute',
          left: 200,
          top: 330,
          width: 260,
          height: 260,
          borderRadius: '50%',
          background: `radial-gradient(circle at 40% 35%, ${theme.brain}55, ${theme.brainDeep})`,
          border: `3px solid ${theme.brain}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: enter,
        }}
      >
        <span style={{fontSize: 60}}>🧠</span>
        <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.brain}}>大脑 · 不动</span>
        <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>θ = 常量</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 170,
          top: 616,
          width: 320,
          padding: '10px 16px',
          borderRadius: 10,
          background: '#05070B',
          border: `2px solid ${theme.brain}`,
          fontFamily: theme.sans,
          fontSize: 23,
          color: theme.brain,
          textAlign: 'center',
          opacity: brainCallout,
        }}
      >
        它改的，是大脑外面的一切
      </div>
      {/* 右：代码环——一段代码在改写自己（✍️ 沿环游走，符号持续变化） */}
      <svg width={860} height={620} style={{position: 'absolute', left: 620, top: 250, opacity: enter}}>
        <defs>
          <path
            id="p3loop8"
            d="M 430 60 C 190 60 90 240 160 380 C 230 520 500 540 620 440 C 760 330 720 120 500 90 C 420 82 320 100 300 180 C 280 270 400 330 520 300 C 610 278 640 220 580 170"
            fill="none"
          />
        </defs>
        <use href="#p3loop8" stroke={theme.gearDeep} strokeWidth={40} />
        <use
          href="#p3loop8"
          stroke={theme.gear}
          strokeWidth={4}
          opacity={0.9}
          strokeDasharray={`${(frame * 3) % 120} 8`}
        />
        {[...Array(N)].map((_, i) => {
          const p = i / N;
          // 8 字环：代码符号沿"自己改自己"的闭环流动
          const t2 = p * Math.PI * 2 + frame * 0.006;
          const x = 430 + 270 * Math.sin(t2);
          const y = 300 + 170 * Math.sin(t2) * Math.cos(t2);
          const glyph = codeGlyphs[(i + Math.floor(frame / 24)) % codeGlyphs.length];
          const visible = Math.cos(p * Math.PI * 2 - frame * 0.02) > 0;
          return (
            <text
              key={i}
              x={x}
              y={y}
              fontSize={26}
              fill={i % 3 === 0 ? theme.gear : theme.dim}
              fontFamily="Menlo, monospace"
              opacity={visible ? 0.95 : 0.25}
              textAnchor="middle"
            >
              {glyph}
            </text>
          );
        })}
        <g
          transform={`translate(${430 + 270 * Math.sin(frame * 0.024)}, ${300 + 170 * Math.sin(frame * 0.024) * Math.cos(frame * 0.024)})`}
        >
          <text fontSize={40} textAnchor="middle">
            ✍️
          </text>
        </g>
      </svg>
      {/* 问题浮层（p3-45/46） */}
      <div
        style={{
          position: 'absolute',
          top: 300,
          left: 640,
          width: 820,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 46,
          fontWeight: 700,
          color: theme.text,
          opacity: question,
          textShadow: '0 0 40px rgba(0,0,0,0.9)',
        }}
      >
        能不能让 AI 直接改写自己的源代码？
      </div>
      {/* 黏土卡（p3-47/48） */}
      <div
        style={{
          position: 'absolute',
          left: 1140,
          top: 600,
          width: 420,
          padding: '20px 26px',
          borderRadius: 20,
          background: theme.panel,
          border: `2.5px solid ${theme.gear}`,
          boxShadow: `0 0 36px ${theme.gear}44`,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          opacity: clay,
          transform: `scale(${0.7 + clay * 0.3})`,
        }}
      >
        <div
          style={{
            width: 92,
            height: 92,
            flexShrink: 0,
            background: `linear-gradient(135deg, ${theme.gear}, ${theme.gearDeep})`,
            borderRadius: `${42 + squeeze * 8}% ${58 - squeeze * 8}% ${48 + squeeze * 6}% ${52 - squeeze * 6}% / ${52}% ${48}% ${55 - squeeze * 5}% ${45 + squeeze * 5}%`,
            boxShadow: `inset -8px -10px 0 rgba(0,0,0,0.25)`,
          }}
        />
        <div>
          <div style={{fontFamily: theme.serif, fontSize: 29, fontWeight: 700, color: theme.text, lineHeight: 1.4}}>
            整个运行逻辑 =<br />
            一团随手可捏的黏土
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.gear, marginTop: 6}}>
            mutable substrate · 可变基质
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ───────────────── 3-J 后代树 ───────────────── */

type OffspringNode = {
  x: number;
  y: number;
  parent: number;
  verdict: 'pass' | 'later';
  label: string;
};

/** 3-J：Darwin Gödel Machine 进化树：节点分叉过"测试"小闸，弱枝灰色进档案库，多路并行 */
const OffspringTree: React.FC<{at: (id: string) => number}> = ({at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const nodes: OffspringNode[] = [
    {x: 960, y: 150, parent: -1, verdict: 'pass', label: 'v0'},
    {x: 660, y: 320, parent: 0, verdict: 'pass', label: 'v1'},
    {x: 1260, y: 320, parent: 0, verdict: 'later', label: "v1'"},
    {x: 460, y: 490, parent: 1, verdict: 'pass', label: 'v2'},
    {x: 860, y: 490, parent: 1, verdict: 'later', label: "v2'"},
    {x: 1060, y: 490, parent: 2, verdict: 'later', label: 'v2"'},
    {x: 300, y: 650, parent: 3, verdict: 'pass', label: 'v3'},
    {x: 600, y: 650, parent: 3, verdict: 'later', label: "v3'"},
  ];
  // v0 @p3-50；第一代 @p3-51；二三代随 p3-52 生长
  const t51 = at('p3-51');
  const t52 = at('p3-52');
  const t52b = at('p3-52b');
  const t53 = at('p3-53');
  const delays = [10, t51 + 17, t51 + 61, t52 + 29, t52 + 67, t52 + 105, t52b + 51, t52b + 87];
  const nodeIn = (i: number) => spring({frame: frame - delays[i], fps, config: {damping: 14}});
  // p3-52 档案库；p3-52b 最弱一支是突破口；p3-53 后代树
  const archiveIn = interpolate(frame, [t52 + 11, t52 + 43], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const multiIn = interpolate(frame, [t52b + 27, t52b + 59], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill>
      <MethodTag text="Darwin Gödel Machine · DGM" top={70} delay={at('p3-50') + 6} />
      <div style={{position: 'absolute', top: 116, width: '100%', textAlign: 'center', opacity: enter}}>
        <span style={{fontFamily: theme.sans, fontSize: 50, fontWeight: 800, color: theme.text}}>后代树</span>
        <span style={{marginLeft: 18, fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
          达尔文管优胜劣汰 · 哥德尔管证明改得对
        </span>
      </div>
      <svg width={1920} height={780} style={{position: 'absolute', top: 100, left: 0}}>
        {nodes.map((nd, i) => {
          if (nd.parent < 0) return null;
          const p = nodes[nd.parent];
          const s = Math.min(nodeIn(i), 1);
          const lit = nd.verdict === 'pass';
          return (
            <line
              key={`e${i}`}
              x1={p.x}
              y1={p.y + 30}
              x2={p.x + (nd.x - p.x) * s}
              y2={p.y + 30 + (nd.y - p.y) * s}
              stroke={lit ? theme.gear : theme.panelBorder}
              strokeWidth={lit ? 5 : 3}
              strokeDasharray={lit ? 'none' : '10 8'}
            />
          );
        })}
        {nodes.map((nd, i) => {
          const s = nodeIn(i);
          const lit = nd.verdict === 'pass';
          return (
            <g key={`n${i}`} transform={`translate(${nd.x}, ${nd.y}) scale(${0.4 + s * 0.6})`} opacity={s}>
              <rect
                x={-46}
                y={-64}
                width={92}
                height={22}
                rx={5}
                fill="#05070B"
                stroke={lit ? theme.ok : theme.danger}
                strokeWidth={1.5}
              />
              <text x={0} y={-47} textAnchor="middle" fontSize={13} fill={lit ? theme.ok : theme.dim}>
                测试 {lit ? '✓' : '→ 存档'}
              </text>
              <rect
                x={-36}
                y={-38}
                width={72}
                height={68}
                rx={10}
                fill={lit ? theme.gearDeep : theme.panel}
                stroke={lit ? theme.gear : theme.panelBorder}
                strokeWidth={3}
              />
              <text x={0} y={8} textAnchor="middle" fontSize={24} fill={lit ? theme.text : theme.dim} fontFamily="Menlo, monospace">
                {nd.label}
              </text>
            </g>
          );
        })}
      </svg>
      {/* 档案库栏 */}
      <div
        style={{
          position: 'absolute',
          bottom: 1080 - V + 18,
          left: 180,
          width: 1560,
          borderRadius: 14,
          background: '#05070B',
          border: `2px dashed ${theme.panelBorder}`,
          padding: '14px 24px',
          opacity: archiveIn,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 20}}>
          <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>🗄 档案库 · 弱枝不删除</span>
          <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.panelBorder}}>
            v1' · v2' · v2" · v3' …
          </span>
          <span style={{marginLeft: 'auto', fontFamily: theme.sans, fontSize: 23, color: theme.gear, opacity: multiIn}}>
            当下最弱的一支，几代之后可能是突破口 · 多路并行延伸
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ───────────────── 3-K 开船修船 ───────────────── */

/** 3-K：船在行驶中被机械臂改造（p3-55 improver 住在系统里），扳手本身也在变形（p3-57） */
const ShipRefit: React.FC<{at: (id: string) => number}> = ({at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const sail = frame * 0.9;
  const bob = Math.sin(frame * 0.05) * 8;
  const armAngle = Math.sin(frame * 0.09) * 18;
  const wrenchMorph = Math.floor(frame / 16) % 3; // 扳手变形轮换
  const wrenchIcons = ['🔧', '🔨', '🪛'];
  // p3-55 改进程序住在被改进的系统里；p3-56 一边开船一边修船；p3-57 扳手变形
  const t55 = at('p3-55');
  const t56 = at('p3-56');
  const t57 = at('p3-57');
  const heat = interpolate(frame, [t55 + 23, t55 + 55], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const titleIn = interpolate(frame, [t56 + 3, t56 + 30], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const lineO = interpolate(frame, [t57 + 10, t57 + 42], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill>
      {/* 海面 + 航迹 */}
      <svg width={1920} height={1080} style={{position: 'absolute', top: 0, left: 0}}>
        <defs>
          <linearGradient id="p3sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0d1626" />
            <stop offset="1" stopColor="#0E1116" />
          </linearGradient>
        </defs>
        <rect x={0} y={640} width={1920} height={440} fill="url(#p3sea)" />
        {[0, 1, 2, 3, 4].map((k) => (
          <path
            key={k}
            d={`M 0 ${700 + k * 60} q 120 -18 240 0 t 240 0 t 240 0 t 240 0 t 240 0 t 240 0 t 240 0 t 240 0`}
            fill="none"
            stroke={theme.panelBorder}
            strokeWidth={2}
            opacity={0.4}
            transform={`translate(${-(sail * 0.4 + k * 90) % 480}, 0)`}
          />
        ))}
      </svg>
      <div style={{position: 'absolute', top: 110, right: 150, display: 'flex', alignItems: 'center', gap: 12, opacity: enter}}>
        <span style={{fontSize: 34}}>🧭</span>
        <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>航行中 · 不可停船</span>
      </div>
      {/* 船 + 机械臂 */}
      <div style={{position: 'absolute', left: 660, top: 360 + bob, width: 600, opacity: enter}}>
        <svg width={600} height={300} viewBox="0 0 600 300">
          <path d="M 60 190 L 540 190 L 490 250 L 110 250 Z" fill={theme.panel} stroke={theme.gear} strokeWidth={4} />
          <rect x={120} y={150} width={70} height={40} rx={6} fill={theme.gearDeep} stroke={theme.gear} strokeWidth={2.5} />
          <rect x={210} y={150} width={70} height={40} rx={6} fill={theme.gearDeep} stroke={theme.gear} strokeWidth={2.5} />
          <rect x={300} y={150} width={70} height={40} rx={6} fill={theme.gearDeep} stroke={theme.gear} strokeWidth={2.5} />
          <text x={155} y={177} textAnchor="middle" fontSize={20}>
            👓
          </text>
          <text x={245} y={177} textAnchor="middle" fontSize={20}>
            📓
          </text>
          <text x={335} y={177} textAnchor="middle" fontSize={20}>
            🧰
          </text>
          <rect x={395} y={60} width={10} height={130} fill={theme.panelBorder} />
          <path d="M 405 66 L 500 120 L 405 170 Z" fill="#22304a" stroke={theme.panelBorder} />
          <rect x={130} y={200} width={340} height={34} rx={8} fill="#05070B" stroke={theme.brain} strokeWidth={2} opacity={heat} />
          <text x={300} y={223} textAnchor="middle" fontSize={18} fill={theme.brain} fontFamily="Menlo, monospace" opacity={heat}>
            improver.py — 住在被改进的系统里
          </text>
        </svg>
        {/* 机械臂（顶部）：立柱对齐船上桅杆（船容器内 x≈400），下延至甲板（y=190） */}
        <div style={{position: 'absolute', left: 305, top: -130, width: 200, height: 330}}>
          <svg width={200} height={330} viewBox="0 0 200 330">
            <rect x={86} y={140} width={28} height={58} rx={10} fill={theme.panelBorder} />
            <g transform={`rotate(${armAngle} 100 140)`} style={{transformOrigin: '100px 140px'}}>
              <rect x={94} y={92} width={12} height={58} rx={6} fill={theme.dim} />
              <circle cx={100} cy={94} r={10} fill={theme.gear} />
              <text x={100} y={82} textAnchor="middle" fontSize={30}>
                {wrenchIcons[wrenchMorph]}
              </text>
            </g>
          </svg>
        </div>
      </div>
      {/* 对白标题（p3-56） */}
      <div
        style={{
          position: 'absolute',
          top: 178,
          left: '50%',
          transform: `translateX(-50%) translateY(${(1 - titleIn) * 20}px)`,
          width: 1000,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 54,
          fontWeight: 700,
          color: theme.text,
          opacity: titleIn,
        }}
      >
        一边开船，一边修船
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 1080 - V + 36,
          width: '100%',
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 30,
          color: theme.gear,
          opacity: lineO,
        }}
      >
        而且你手里的扳手，也在跟着变形
      </div>
    </AbsoluteFill>
  );
};

/* ───────────────── 3-L 验证门 ───────────────── */

/** 3-L：改动候选（p3-59）过三重闸机 单元测试/回归/安全（p3-60），不合格弹回 + 回滚（p3-61），收束与警示（p3-62/62b） */
const ValidationGate: React.FC<{at: (id: string) => number}> = ({at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  // p3-59 候选；p3-60 三闸亮起逐关放行；p3-61 弹回+回滚；p3-62 收束；p3-62b 警示
  const t59 = at('p3-59');
  const t60 = at('p3-60');
  const t61 = at('p3-61');
  const t62 = at('p3-62');
  const t62b = at('p3-62b');
  const cand = spring({frame: frame - t59 - 9, fps, config: {damping: 13}});
  const pass1 = interpolate(frame, [t60 + 54, t60 + 84], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const pass2 = interpolate(frame, [t60 + 102, t60 + 132], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const reject = spring({frame: frame - t61 - 7, fps, config: {damping: 9}});
  const rollback = interpolate(frame, [t61 + 19, t61 + 49], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const closing = interpolate(frame, [t62 + 12, t62 + 42], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const caution = interpolate(frame, [t62b + 25, t62b + 59], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const cardX = interpolate(cand, [0, 1], [-380, 0]) - reject * 520;
  const cardRotate = reject * -22;
  const cardOpacity = cand * Math.max(0, 1 - Math.max(0, reject - 0.7) * 3.5);
  const gates = [
    {label: '单元测试', en: 'unit tests', icon: '🧪', pass: pass1, x: 620},
    {label: '回归测试', en: 'regression', icon: '🔁', pass: pass2, x: 960},
    {label: '安全检查', en: 'safety', icon: '🛡️', pass: 0, x: 1300},
  ];
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 82, width: '100%', textAlign: 'center', opacity: enter}}>
        <span style={{fontFamily: theme.sans, fontSize: 50, fontWeight: 800, color: theme.text}}>
          所有系统都绕不开的一道门：
        </span>
        <span style={{fontFamily: theme.serif, fontSize: 58, fontWeight: 800, color: theme.gear, marginLeft: 14}}>
          验证
        </span>
      </div>
      {/* 候选改动卡片 */}
      <div
        style={{
          position: 'absolute',
          top: 208,
          left: 300,
          width: 340,
          padding: '18px 22px',
          borderRadius: 14,
          background: theme.panel,
          border: `2.5px solid ${reject > 0.3 ? theme.danger : theme.gear}`,
          transform: `translateX(${cardX}px) rotate(${cardRotate}deg)`,
          opacity: cardOpacity,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <span style={{fontSize: 30}}>🧬</span>
          <div>
            <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.text}}>改动 #47</div>
            <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>状态：候选 candidate</div>
          </div>
        </div>
        {reject > 0.2 ? (
          <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 24, color: theme.danger}}>
            ✗ 安全检查不合格
          </div>
        ) : null}
      </div>
      {/* 三重闸机 */}
      {gates.map((g, i) => {
        const up = spring({frame: frame - t60 + 4 - i * 6, fps, config: {damping: 200}});
        const lit = g.pass > 0.5;
        const blocked = reject > 0.3 && i === 2;
        const barColor = lit ? theme.ok : blocked ? theme.danger : theme.panelBorder;
        return (
          <div
            key={g.label}
            style={{
              position: 'absolute',
              top: 386,
              left: g.x - 120,
              width: 240,
              borderRadius: 18,
              padding: '20px 16px',
              textAlign: 'center',
              background: '#05070B',
              border: `3px solid ${barColor}`,
              boxShadow: lit ? `0 0 34px ${theme.ok}55` : blocked ? `0 0 34px ${theme.danger}55` : 'none',
              opacity: up,
              transform: `translateY(${(1 - up) * 40}px)`,
            }}
          >
            <div
              style={{
                margin: '0 auto 14px',
                width: 150,
                height: 10,
                borderRadius: 5,
                background: barColor,
                transform: `rotate(${lit ? -60 : 0}deg)`,
                transformOrigin: 'left center',
              }}
            />
            <div style={{fontSize: 40}}>{g.icon}</div>
            <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 27, fontWeight: 700, color: theme.text}}>
              {g.label}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{g.en}</div>
            <div
              style={{
                marginTop: 8,
                fontFamily: theme.mono,
                fontSize: 26,
                color: barColor,
              }}
            >
              {lit ? '✓ 放行' : blocked ? '✗ 拦截' : '…'}
            </div>
          </div>
        );
      })}
      {/* 回滚按钮特写 */}
      <div
        style={{
          position: 'absolute',
          top: 680,
          left: 300,
          width: 340 + reject * -60 + 520,
          textAlign: 'left',
          opacity: rollback,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '14px 44px',
            borderRadius: 14,
            background: theme.danger,
            border: '3px solid #FF8A8A',
            fontFamily: theme.sans,
            fontSize: 34,
            fontWeight: 800,
            color: '#FFFFFF',
            boxShadow: `0 0 44px ${theme.danger}66`,
          }}
        >
          ⟲ 回滚 rollback
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 1080 - V + 52,
          width: '100%',
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 30,
          color: theme.text,
          opacity: closing,
        }}
      >
        今天所有的自我改造，都还关在这道门后面
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 1080 - V + 14,
          width: '100%',
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.danger,
          opacity: caution,
        }}
      >
        但门是人设的，考题是用语言写的——AI 恰恰最擅长玩弄语言
      </div>
    </AbsoluteFill>
  );
};

export const P3Gear: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  /** 某镜 Sequence 内、指定句 id 的本地起始帧 */
  const rel = (beatFirstId: string) => (id: string) => {
    const first = scene.sentences.find((s) => s.id === beatFirstId);
    const s = scene.sentences.find((x) => x.id === id);
    if (!first || !s) {
      throw new Error(`P3Gear: 未找到句 id ${beatFirstId}/${id}`);
    }
    return s.from - first.from;
  };
  return (
    <AbsoluteFill>
      <Sequence {...w('p3-01', 'p3-05b')} name="3-A 章头四层阶梯">
        <ChapterLadder at={rel('p3-01')} />
      </Sequence>
      <Sequence {...w('p3-06', 'p3-08')} name="3-B 换眼镜">
        <Glasses at={rel('p3-06')} />
      </Sequence>
      <Sequence {...w('p3-09', 'p3-15')} name="3-C 提示进化史">
        <PromptEvolution at={rel('p3-09')} />
      </Sequence>
      <Sequence {...w('p3-16', 'p3-17')} name="3-D 金句天平">
        <BalanceScale at={rel('p3-16')} />
      </Sequence>
      <Sequence {...w('p3-18', 'p3-24c')} name="3-E 记笔记">
        <NotebookScene at={rel('p3-18')} />
      </Sequence>
      <Sequence {...w('p3-25', 'p3-29')} name="3-F 记忆毛病">
        <MemoryBugs at={rel('p3-25')} />
      </Sequence>
      <Sequence {...w('p3-30', 'p3-34')} name="3-G Voyager">
        <VoyagerScene at={rel('p3-30')} />
      </Sequence>
      <Sequence {...w('p3-35', 'p3-42')} name="3-H 工具闭环">
        <ToolLoop at={rel('p3-35')} />
      </Sequence>
      <Sequence {...w('p3-43', 'p3-48')} name="3-I 莫比乌斯黏土">
        <MobiusClay at={rel('p3-43')} />
      </Sequence>
      <Sequence {...w('p3-50', 'p3-53')} name="3-J 后代树">
        <OffspringTree at={rel('p3-50')} />
      </Sequence>
      <Sequence {...w('p3-54', 'p3-57')} name="3-K 开船修船">
        <ShipRefit at={rel('p3-54')} />
      </Sequence>
      <Sequence {...w('p3-58', 'p3-62b')} name="3-L 验证门">
        <ValidationGate at={rel('p3-58')} />
      </Sequence>
    </AbsoluteFill>
  );
};
