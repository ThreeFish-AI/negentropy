import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {FadeUp, QuoteCard} from '../components/cards';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';

/** 双端 clamp 的 0→1 进度 */
const ci = (f: number, a: number, b: number) =>
  interpolate(f, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

/** 6-A：星空开放问题 */
const OpenQuestions: React.FC = () => {
  const frame = useCurrentFrame();
  const qs = [
    {q: '新本事，还是本来就有的潜能？', icon: '🌱'},
    {q: '一直吃自己产的经验，会越吃越窄吗？', icon: '🌀'},
    {q: '图片视频经验，怎么压缩归档？', icon: '🖼️'},
  ];
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        background: `radial-gradient(ellipse at 50% 30%, #131a2a 0%, ${theme.bg} 70%)`,
      }}
    >
      {/* 星星 */}
      {Array.from({length: 26}).map((_, i) => {
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(frame * 0.04 + i * 2.1));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${(i * 37 + 13) % 96}%`,
              top: `${(i * 53 + 7) % 88}%`,
              width: 3 + (i % 3),
              height: 3 + (i % 3),
              borderRadius: '50%',
              background: theme.text,
              opacity: tw * 0.7,
            }}
          />
        );
      })}
      <div style={{display: 'flex', flexDirection: 'column', gap: 40}}>
        {qs.map((q, i) => {
          const enter = spring({frame: frame - i * 14, fps: 30, config: {damping: 200}});
          return (
            <FadeUp key={q.q} delay={i * 14}>
              <div
                style={{
                  display: 'flex',
                  gap: 20,
                  alignItems: 'center',
                  padding: '22px 36px',
                  borderRadius: 16,
                  background: 'rgba(23,28,38,0.7)',
                  border: `2px solid ${theme.panelBorder}`,
                  opacity: enter,
                }}
              >
                <span style={{fontSize: 40}}>{q.icon}</span>
                <span style={{fontFamily: theme.sans, fontSize: 29, color: theme.text}}>{q.q}</span>
                <span style={{fontFamily: theme.serif, fontSize: 30, color: theme.exp, marginLeft: 8}}>?</span>
              </div>
            </FadeUp>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** 6-B2：经验编译器闭环复盘（v2 新增，p6-06a..06d）
 *  五节点环形流水：部署轨迹（金）→ 经验编译器（三步徽标）→ 双路（青快/紫慢，双速差流光）→ 评测+安全闸门（红脉冲）→ 回到部署。
 *  青路流光速度快、紫路缓慢下沉——「快/可逆 vs 慢/持久」的时间尺度不对称是概念核心。 */
const LoopRecap: React.FC<{compilerAt: number; pathsAt: number; gateAt: number}> = ({compilerAt, pathsAt, gateAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  // 环几何：viewBox 900x640，中心 450,320
  const R = 210;
  const N = 5;
  const nodeAngle = (i: number) => (-90 + (360 / N) * i) * (Math.PI / 180); // 从顶部顺时针
  const nodePos = (i: number) => ({x: 450 + R * Math.cos(nodeAngle(i)), y: 320 + R * Math.sin(nodeAngle(i))});
  const nodes = [
    {label: '部署轨迹', sub: 'goals · actions · tests', color: theme.exp},
    {label: '经验编译器', sub: '选证据 / 提抽象 / 记出处', color: theme.exp},
    {label: '工位 · 快路', sub: '技能 / 记忆 / 工具', color: theme.harness},
    {label: '大脑 · 慢路', sub: 'RL · 持续学习', color: theme.params},
    {label: '评测 + 安全闸', sub: '才承认是「进步」', color: theme.danger},
  ];
  const ringDraw = ci(frame, 2, 40);
  // 流光：青路（节点2→3 外弧）快转；紫路（节点3→4）慢沉——用两段弧上的游标点
  const flowT = Math.max(0, frame - pathsAt);
  const tealPhase = (flowT * 0.03) % 1; // 快：约 33 帧一圈
  const purplePhase = (flowT * 0.011) % 1; // 慢：约 90 帧一圈
  const gatePulse = gateAt > 0 && frame > gateAt ? 0.6 + 0.4 * Math.sin((frame - gateAt) * 0.14) : 0.7;
  const compilerIn = ci(frame, compilerAt, compilerAt + 14);
  const pathsIn = ci(frame, pathsAt, pathsAt + 14);
  const gateIn = ci(frame, gateAt, gateAt + 14);

  const arcPoint = (fromI: number, toI: number, t: number) => {
    const a1 = nodeAngle(fromI);
    const a2 = nodeAngle(toI);
    const a = a1 + (a2 - a1) * t;
    return {x: 450 + R * Math.cos(a), y: 320 + R * Math.sin(a)};
  };
  const tealDot = arcPoint(1, 2, tealPhase);
  const purpleDot = arcPoint(2, 3, purplePhase);

  return (
    <AbsoluteFill style={{opacity: enter}}>
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 92,
          transform: 'translateX(-50%)',
          fontFamily: theme.sans,
          fontSize: 30,
          fontWeight: 700,
          color: theme.text,
          opacity: ci(frame, 0, 14),
        }}
      >
        全片拼成一张图 · 经验的闭环
      </div>

      <svg width={900} height={640} viewBox="0 0 900 640" style={{position: 'absolute', left: 510, top: 180}}>
        {/* 环主干 */}
        <circle
          cx={450}
          cy={320}
          r={R}
          fill="none"
          stroke={theme.panelBorder}
          strokeWidth={10}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - ringDraw}
          transform="rotate(-90 450 320)"
        />
        {/* 青路段加亮（1→2 弧，快路） */}
        <path
          d={`M ${nodePos(1).x} ${nodePos(1).y} A ${R} ${R} 0 0 1 ${nodePos(2).x} ${nodePos(2).y}`}
          fill="none"
          stroke={theme.harness}
          strokeWidth={12}
          strokeLinecap="round"
          opacity={0.8 * pathsIn}
        />
        {/* 紫路段加亮（2→3 弧，慢路） */}
        <path
          d={`M ${nodePos(2).x} ${nodePos(2).y} A ${R} ${R} 0 0 1 ${nodePos(3).x} ${nodePos(3).y}`}
          fill="none"
          stroke={theme.params}
          strokeWidth={12}
          strokeLinecap="round"
          opacity={0.8 * pathsIn}
        />
        {/* 流光游标：青快 */}
        {pathsIn > 0 && (
          <circle cx={tealDot.x} cy={tealDot.y} r={9} fill={theme.harness} opacity={0.95} style={{filter: `drop-shadow(0 0 8px ${theme.harness})`}} />
        )}
        {/* 流光游标：紫慢 */}
        {pathsIn > 0 && (
          <circle cx={purpleDot.x} cy={purpleDot.y} r={9} fill={theme.params} opacity={0.95} style={{filter: `drop-shadow(0 0 8px ${theme.params})`}} />
        )}
      </svg>

      {/* 节点卡 */}
      {nodes.map((n, i) => {
        const p = nodePos(i);
        const isIn = i === 1 ? compilerIn : i === 2 || i === 3 ? pathsIn : i === 4 ? gateIn : ci(frame, 2 + i * 8, 14 + i * 8);
        const pulse = i === 4 ? gatePulse : 1;
        return (
          <div
            key={n.label}
            style={{
              position: 'absolute',
              left: 510 + p.x,
              top: 180 + p.y,
              transform: `translate(-50%,-50%) scale(${0.8 + 0.2 * isIn})`,
              width: 250,
              padding: '18px 20px',
              borderRadius: 16,
              background: theme.panel,
              border: `3px solid ${n.color}`,
              textAlign: 'center',
              opacity: isIn,
              boxShadow: i === 4 ? `0 0 ${34 * pulse}px ${n.color}55` : `0 10px 30px rgba(0,0,0,0.4)`,
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 800, color: n.color}}>{n.label}</div>
            <div style={{marginTop: 8, fontFamily: theme.mono, fontSize: 17, color: theme.dim, lineHeight: 1.5}}>{n.sub}</div>
          </div>
        );
      })}

      {/* 双速标注 */}
      <FadeUp delay={pathsAt + 8}>
        <div
          style={{
            position: 'absolute',
            left: 240,
            top: 500,
            fontFamily: theme.sans,
            fontSize: 24,
            color: theme.harness,
            opacity: pathsIn,
          }}
        >
          ⚡ 快 / 可逆 · 今天就能用
        </div>
        <div
          style={{
            position: 'absolute',
            left: 1420,
            top: 500,
            fontFamily: theme.sans,
            fontSize: 24,
            color: theme.params,
            opacity: pathsIn,
          }}
        >
          🐢 慢 / 持久 · 变成本能
        </div>
      </FadeUp>

      {/* 末端标签（bottom≥150 避字幕条） */}
      <FadeUp delay={gateAt + 14}>
        <div
          style={{
            position: 'absolute',
            left: 960,
            top: 872,
            transform: 'translateX(-50%)',
            fontFamily: theme.mono,
            fontSize: 21,
            color: theme.dim,
            opacity: gateIn,
          }}
        >
          durable capability under control · 受控的持久能力（官方工程站点闭环图）
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 6-C：金句四步收束（p6-07：接住、归档、验证、变实力 逐一下划线） */
const QuoteRecap: React.FC = () => {
  const frame = useCurrentFrame();
  const steps = ['接住', '归档', '验证', '再变成实力'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{fontFamily: theme.serif, fontSize: 46, fontWeight: 700, color: theme.text, lineHeight: 1.7, textAlign: 'center'}}>
        把经验
        {steps.map((s, i) => (
          <span key={s} style={{position: 'relative', margin: '0 10px', color: i === 3 ? theme.exp : theme.text}}>
            {s}
            <span
              style={{
                position: 'absolute',
                left: 0,
                bottom: -10,
                height: 5,
                borderRadius: 3,
                background: i === 3 ? theme.exp : theme.harness,
                width: `${ci(frame, 10 + i * 14, 22 + i * 14) * 100}%`,
              }}
            />
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 6-D：三块拼图 */
const ThreePuzzles: React.FC = () => {
  const frame = useCurrentFrame();
  const pieces = [
    {zh: '可靠的反馈', icon: '📡'},
    {zh: '安全的自我修改架构', icon: '🛡️'},
    {zh: '评测 = 持续体检', icon: '🩺'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <FadeUp style={{marginBottom: 46}}>
        <div style={{fontFamily: theme.sans, fontSize: 34, color: theme.text, fontWeight: 700}}>
          这条路还缺的三块拼图
        </div>
      </FadeUp>
      <div style={{display: 'flex', gap: 40}}>
        {pieces.map((p, i) => {
          const drop = spring({frame: frame - i * 12, fps: 30, config: {damping: 14}});
          return (
            <div
              key={p.zh}
              style={{
                width: 340,
                height: 240,
                borderRadius: 20,
                background: theme.panel,
                border: `3px dashed ${drop > 0.95 ? theme.ok : theme.panelBorder}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 16,
                transform: `translateY(${(1 - drop) * -160}px) rotate(${(1 - drop) * 12}deg)`,
                opacity: drop,
              }}
            >
              <span style={{fontSize: 64}}>{p.icon}</span>
              <span style={{fontFamily: theme.sans, fontSize: 27, color: theme.ok, fontWeight: 700, textAlign: 'center'}}>
                {p.zh}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** 6-E：系列呼应——上一集与本集并排 */
const SeriesEcho: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const prev = spring({frame: frame - 6, fps, config: {damping: 200}});
  const curr = spring({frame: frame - 20, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 60, alignItems: 'center'}}>
        <div
          style={{
            width: 480,
            padding: 40,
            borderRadius: 20,
            background: theme.panel,
            border: `3px solid #4A9EFF`,
            opacity: prev * 0.92,
            transform: `translateY(${(1 - prev) * 40}px)`,
          }}
        >
          <div style={{display: 'flex', gap: 8, marginBottom: 18}}>
            <span style={{width: 40, height: 8, borderRadius: 4, background: '#4A9EFF'}} />
            <span style={{width: 40, height: 8, borderRadius: 4, background: '#FF9F45'}} />
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>
            上期：AI 如何自己变强？
          </div>
          <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 24, color: theme.dim, lineHeight: 1.6}}>
            改大脑，还是改装备？
            <br />
            ——「改什么」
          </div>
        </div>
        <div style={{fontSize: 50, color: theme.exp, opacity: curr}}>＋</div>
        <div
          style={{
            width: 480,
            padding: 40,
            borderRadius: 20,
            background: theme.panel,
            border: `3px solid ${theme.exp}`,
            opacity: curr,
            transform: `translateY(${(1 - curr) * 40}px)`,
            boxShadow: `0 0 70px ${theme.exp}22`,
          }}
        >
          <div style={{display: 'flex', gap: 8, marginBottom: 18}}>
            <span style={{width: 40, height: 8, borderRadius: 4, background: theme.exp}} />
            <span style={{width: 40, height: 8, borderRadius: 4, background: theme.harness}} />
            <span style={{width: 40, height: 8, borderRadius: 4, background: theme.params}} />
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>
            本期：上线之后，AI 才开始上学
          </div>
          <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 24, color: theme.dim, lineHeight: 1.6}}>
            上了班之后，经验怎么攒？
            <br />
            ——「怎么攒」
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 6-F：配套清单卡（v2 新增，p6-13a/b）——111 篇 × 9 章计数器 + 九章名胶囊环绕 */
const RepoCard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const count = Math.round(111 * ci(frame, 6, 40));
  const chapters = ['技能', '记忆', '环境', '工具', '参数', '元进化', '评测', '安全', '定义'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: 760,
          padding: '40px 56px',
          borderRadius: 20,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          textAlign: 'center',
          opacity: enter,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.exp}}>
          github.com/FrontisAI/Awesome-Self-Improving-Agents
        </div>
        <div style={{marginTop: 20, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 18}}>
          <span style={{fontFamily: theme.mono, fontSize: 92, fontWeight: 700, color: theme.text}}>{count}</span>
          <span style={{fontFamily: theme.sans, fontSize: 34, color: theme.dim}}>篇论文 · </span>
          <span style={{fontFamily: theme.mono, fontSize: 58, fontWeight: 700, color: theme.exp}}>
            {ci(frame, 20, 34) > 0.5 ? 9 : 0}
          </span>
          <span style={{fontFamily: theme.sans, fontSize: 34, color: theme.dim}}>章</span>
        </div>
        <div style={{marginTop: 26, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12}}>
          {chapters.map((c, i) => {
            const e = ci(frame, 30 + i * 5, 40 + i * 5);
            return (
              <span
                key={c}
                style={{
                  padding: '8px 18px',
                  borderRadius: 999,
                  border: `2px solid ${theme.harness}`,
                  color: theme.harness,
                  fontFamily: theme.sans,
                  fontSize: 22,
                  opacity: e,
                  transform: `scale(${0.85 + 0.15 * e})`,
                }}
              >
                {c}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 6-G：论文引用卡（fade-out 窗口收在本 beat 末帧内，避免渐黑被 Sequence 截断硬切） */
const FinalCard: React.FC<{endFrame: number}> = ({endFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const fadeStart = Math.max(0, endFrame - 50);
  const fade = interpolate(frame, [fadeStart, endFrame], [1, 0], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: fade}}>
      <div
        style={{
          width: 1080,
          padding: '60px 72px',
          borderRadius: 24,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          opacity: enter,
          transform: `scale(${0.9 + enter * 0.1})`,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.exp}}>88 页综述 · 2026-06</div>
        <div
          style={{
            marginTop: 26,
            fontFamily: theme.serif,
            fontSize: 44,
            fontWeight: 700,
            color: theme.text,
            lineHeight: 1.4,
          }}
        >
          Self-Improving Agents in the Era of Experience:
          <br />
          A Survey of Self- to Meta-Evolution
        </div>
        <div style={{marginTop: 30, fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
          C. Jiang, J. Zhong, Y. Fu, et al. · 清华大学 × Horizon Research (Frontis.AI)
        </div>
        <div style={{marginTop: 34, fontFamily: theme.sans, fontSize: 30, color: theme.exp}}>
          📖 推荐读原文
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const P6Ending: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  /** 某句在本 Sequence 内的结束帧（局部坐标），供结尾渐黑对齐 beat 实际时长 */
  const endFrame = (id: string) => {
    const s = scene.sentences.find((x) => x.id === id);
    if (!s) {
      throw new Error(`endFrame: 未找到句 id ${id}`);
    }
    return s.from + s.durationInFrames - scene.from;
  };
  /** 某句在本场景内的起始帧（局部坐标） */
  const at = (id: string) => {
    const s = scene.sentences.find((x) => x.id === id);
    if (!s) {
      throw new Error(`at: 未找到句 id ${id}`);
    }
    return s.from - scene.from;
  };
  const winB2 = w('p6-06a', 'p6-06d');
  return (
    <AbsoluteFill>
      <Sequence {...w('p6-01', 'p6-04')} name="6-A 星空问题">
        <OpenQuestions />
      </Sequence>
      <Sequence {...w('p6-05', 'p6-06')} name="6-B 总金句">
        <QuoteCard
          zh="部署后变聪明 = 从流水到能力"
          en="Making agents smarter after deployment is a trace-to-capability problem."
          cite="本片综述 · Abstract"
          accent={theme.exp}
        />
      </Sequence>
      <Sequence {...winB2} name="6-B2 闭环复盘">
        <LoopRecap
          compilerAt={at('p6-06b') - winB2.from}
          pathsAt={at('p6-06c') - winB2.from}
          gateAt={at('p6-06d') - winB2.from}
        />
      </Sequence>
      <Sequence {...w('p6-07')} name="6-C 总收束">
        <QuoteRecap />
      </Sequence>
      <Sequence {...w('p6-08', 'p6-10')} name="6-D 三块拼图">
        <ThreePuzzles />
      </Sequence>
      <Sequence {...w('p6-11', 'p6-13')} name="6-E 系列呼应">
        <SeriesEcho />
      </Sequence>
      <Sequence {...w('p6-13a', 'p6-13b')} name="6-F 配套清单卡">
        <RepoCard />
      </Sequence>
      <Sequence {...w('p6-14', 'p6-15')} name="6-G 原文卡">
        <FinalCard endFrame={endFrame('p6-15')} />
      </Sequence>
    </AbsoluteFill>
  );
};
