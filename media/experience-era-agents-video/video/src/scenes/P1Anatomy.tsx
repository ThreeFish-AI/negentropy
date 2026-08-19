import React from 'react';
import {
  AbsoluteFill,
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

/** 1-A：四件套解剖图 A_t = ⟨M, H, U, E⟩ */
const FourParts: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const parts = [
    {icon: '🧠', label: '模型 M', sub: '出厂自带的大脑', color: theme.params, pos: {left: 180, top: 380}},
    {icon: '🗂️', label: '工位 H', sub: 'Harness · 工作系统', color: theme.harness, pos: {right: 180, top: 380}},
    {icon: '👤', label: '老板 U', sub: '提需求 · 给反馈', color: theme.dim, pos: {left: 480, top: 120}},
    {icon: '🏭', label: '车间 E', sub: '浏览器 · 仓库 · 工具', color: theme.dim, pos: {left: 480, top: 660}},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {parts.map((p, i) => {
        const enter = spring({frame: frame - i * 6, fps, config: {damping: 200}});
        return (
          <div
            key={p.label}
            style={{
              position: 'absolute',
              ...p.pos,
              width: 320,
              padding: 28,
              borderRadius: 20,
              background: theme.panel,
              border: `3px solid ${p.color}`,
              opacity: enter,
              transform: `translateY(${(1 - enter) * 40}px)`,
            }}
          >
            <div style={{fontSize: 64}}>{p.icon}</div>
            <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: p.color}}>
              {p.label}
            </div>
            <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{p.sub}</div>
          </div>
        );
      })}
      <FadeUp delay={28} style={{position: 'absolute', bottom: 150}}>
        <div style={{fontFamily: theme.mono, fontSize: 30, color: theme.exp}}>A_t = ⟨ M, H, U, E ⟩</div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 1-B/1-C：Harness 特写——包在大脑外面的工作系统 */
const HarnessZoom: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tools = [
    {icon: '📘', label: '工作手册'},
    {icon: '📓', label: '笔记本'},
    {icon: '🔑', label: '工具权限'},
    {icon: '🧭', label: '办事流程'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: 640,
          height: 460,
          borderRadius: 36,
          border: `4px dashed ${theme.harness}`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: `0 0 90px ${theme.harness}33`,
        }}
      >
        <div
          style={{
            width: 220,
            height: 220,
            borderRadius: 56,
            background: `linear-gradient(135deg, ${theme.paramsDeep}, ${theme.panel})`,
            border: `3px solid ${theme.params}`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: 100,
          }}
        >
          🧠
        </div>
      </div>
      <div style={{position: 'absolute', top: 140, right: 220, display: 'flex', flexDirection: 'column', gap: 20}}>
        {tools.map((t, i) => {
          const enter = spring({frame: frame - 10 - i * 5, fps, config: {damping: 200}});
          const angle = frame * 0.006 + i * 1.57;
          return (
            <div
              key={t.label}
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'center',
                opacity: enter,
                transform: `translate(${Math.cos(angle) * 8}px, ${Math.sin(angle) * 8}px)`,
              }}
            >
              <span style={{fontSize: 44}}>{t.icon}</span>
              <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>{t.label}</span>
            </div>
          );
        })}
      </div>
      <FadeUp delay={34} style={{position: 'absolute', bottom: 150}}>
        <Pill color={theme.harness}>Harness = 经验基础设施</Pill>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 1-D：改工位便宜 vs 改大脑贵 */
const CheapVsExpensive: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 90, opacity: enter}}>
        <div
          style={{
            width: 560,
            padding: 40,
            borderRadius: 24,
            background: theme.panel,
            border: `2px solid ${theme.paramsDeep}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <div style={{fontSize: 90}}>🏗️</div>
          <div style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 700, color: theme.params}}>改大脑</div>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, textAlign: 'center', lineHeight: 1.6}}>
            重型机械 · 重新训练
            <br />
            贵 · 慢 · 基本出厂定型
          </div>
        </div>
        <div
          style={{
            width: 560,
            padding: 40,
            borderRadius: 24,
            background: theme.panel,
            border: `3px solid ${theme.harness}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            boxShadow: `0 0 70px ${theme.harness}22`,
          }}
        >
          <div style={{fontSize: 90}}>🧩</div>
          <div style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 700, color: theme.harness}}>改工位</div>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, textAlign: 'center', lineHeight: 1.6}}>
            乐高快拆 · 随时改随时撤
            <br />
            但同样决定 AI 看到什么 · 能做什么
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 1-E：原油→汽油提纯漏斗（trace → 经验 z） */
const Refinery: React.FC = () => {
  const frame = useCurrentFrame();
  const stages = ['过滤', '压缩', '归因', '验证'];
  const flow = interpolate(frame, [10, 70], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 50}}>
        <FadeUp>
          <div style={{textAlign: 'center'}}>
            <div
              style={{
                width: 260,
                height: 180,
                borderRadius: 20,
                background: '#1a1510',
                border: `2px solid #4a3a20`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontFamily: theme.sans,
                fontSize: 30,
                color: '#8a7a5a',
              }}
            >
              原始流水
            </div>
            <div style={{marginTop: 12, fontFamily: theme.mono, fontSize: 26, color: theme.dim}}>trace τ</div>
          </div>
        </FadeUp>
        <div style={{position: 'relative', width: 560, height: 300}}>
          {/* 漏斗 */}
          <div
            style={{
              position: 'absolute',
              top: 20,
              left: 140,
              width: 280,
              height: 160,
              background: `linear-gradient(180deg, ${theme.panel}, ${theme.expDeep})`,
              clipPath: 'polygon(0 0, 100% 0, 62% 100%, 38% 100%)',
              opacity: 0.9,
            }}
          />
          {/* 四道工序环 */}
          <div style={{position: 'absolute', top: -30, left: 0, display: 'flex', gap: 26}}>
            {stages.map((s, i) => {
              const on = flow > (i + 0.5) / 5;
              return (
                <div
                  key={s}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 999,
                    border: `2px solid ${on ? theme.harness : theme.panelBorder}`,
                    color: on ? theme.harness : theme.dim,
                    fontFamily: theme.sans,
                    fontSize: 24,
                    background: theme.panel,
                  }}
                >
                  {s}
                </div>
              );
            })}
          </div>
          {/* 滴出的金色经验 */}
          <div
            style={{
              position: 'absolute',
              top: 200,
              left: 252,
              width: 56,
              height: 56,
              borderRadius: 28,
              background: theme.exp,
              boxShadow: `0 0 46px ${theme.exp}`,
              opacity: flow > 0.8 ? 1 : 0.1,
              transform: `translateY(${(1 - flow) * -60}px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 262,
              left: 180,
              width: 200,
              textAlign: 'center',
              fontFamily: theme.sans,
              fontSize: 28,
              fontWeight: 700,
              color: theme.exp,
              opacity: flow > 0.8 ? 1 : 0,
            }}
          >
            可用经验 z
          </div>
        </div>
      </div>
      <FadeUp delay={40} style={{position: 'absolute', bottom: 150}}>
        <div style={{fontFamily: theme.mono, fontSize: 30, color: theme.exp}}>z_i = H(τ_i)</div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 1-F：快慢双去路 */
const TwoPaths: React.FC = () => {
  const frame = useCurrentFrame();
  const fast = interpolate(frame, [10, 45], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  const slow = interpolate(frame, [30, 100], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1400, height: 560}}>
        <div
          style={{
            position: 'absolute',
            left: 60,
            top: 240,
            width: 64,
            height: 64,
            borderRadius: 32,
            background: theme.exp,
            boxShadow: `0 0 40px ${theme.exp}`,
          }}
        />
        {/* 快路：上弧线到工位；慢路：下弧线到大脑。
            渐进绘制用 mask（pathLength=1 归一化坐标），虚线样式保留在原 path 上——
            两者须分离，否则 dash 量纲互相抵消（评审 #3） */}
        <svg width="1400" height="560" style={{position: 'absolute', inset: 0}}>
          <defs>
            <mask id="twopaths-fast">
              <path
                d="M 130 270 Q 500 80 1180 200"
                fill="none"
                stroke="#fff"
                strokeWidth={10}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - fast}
              />
            </mask>
            <mask id="twopaths-slow">
              <path
                d="M 130 275 Q 500 470 1180 350"
                fill="none"
                stroke="#fff"
                strokeWidth={10}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - slow}
              />
            </mask>
          </defs>
          <path
            d="M 130 270 Q 500 80 1180 200"
            fill="none"
            stroke={theme.harness}
            strokeWidth={7}
            strokeDasharray="16 10"
            opacity={0.85}
            mask="url(#twopaths-fast)"
          />
          <path
            d="M 130 275 Q 500 470 1180 350"
            fill="none"
            stroke={theme.params}
            strokeWidth={7}
            strokeDasharray="16 10"
            opacity={0.85}
            mask="url(#twopaths-slow)"
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            right: 40,
            top: 130,
            padding: '18px 28px',
            borderRadius: 18,
            background: theme.panel,
            border: `3px solid ${theme.harness}`,
            opacity: fast > 0.9 ? 1 : 0,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.harness, fontWeight: 700}}>改工位 · 快</div>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>今天就能用上</div>
        </div>
        <div
          style={{
            position: 'absolute',
            right: 40,
            top: 310,
            padding: '18px 28px',
            borderRadius: 18,
            background: theme.panel,
            border: `3px solid ${theme.params}`,
            opacity: slow > 0.9 ? 1 : 0,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.params, fontWeight: 700}}>写大脑 · 慢</div>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>变成一辈子的本能</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 1-G：三代演进时间轴（v2：p1-25a 时 Gen3 卡片定格放大，卡片上「可改接口」小面板逐个亮起） */
const ThreeGens: React.FC<{gen3At: number}> = ({gen3At}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const gens = [
    {name: 'Gen 1 · 任务循环', icon: '🔁', desc: '会用工具 · 干完就忘', year: '2021', color: theme.dim},
    {name: 'Gen 2 · 跨任务复用', icon: '📚', desc: '有记忆技能库 · 靠人配置', year: '2023', color: theme.harness},
    {name: 'Gen 3 · 运行时系统', icon: '🏢', desc: '工位本身自动升级', year: '2025', color: theme.exp},
  ];
  // Gen3 定格放大 + 其余两卡让位
  const zoom = interpolate(frame, [gen3At, gen3At + 18], [1, 1.14], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const othersDim = interpolate(frame, [gen3At, gen3At + 18], [1, 0.55], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // Gen3 楼体上的「可改接口」面板
  const panels = ['技能', '记忆', '工具', '流程'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1500}}>
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 0,
            height: 6,
            width: `${Math.min(100, (frame / 90) * 100)}%`,
            background: `linear-gradient(90deg, ${theme.dim}, ${theme.exp})`,
            borderRadius: 3,
          }}
        />
        {/* Figure 3 的 11 个带日期里程碑（约四年半）：刻度随时间轴展开依次点亮 */}
        {[
          ['21-12', 'WebGPT'], ['22-10', 'ReAct'], ['23-03', 'Reflexion'], ['23-08', 'AutoGen'],
          ['24-01', 'LangGraph'], ['24-05', 'SWE-agent'], ['24-07', 'OpenHands'], ['25-02', 'Claude Code'],
          ['25-05', 'Codex'], ['26-02', 'OpenClaw'], ['26-04', 'Cursor 3'],
        ].map(([date, name], i) => {
          const t = (i + 0.5) / 11;
          const on = frame > 12 + i * 7;
          return (
            <div
              key={name}
              style={{
                position: 'absolute',
                top: 14,
                left: `${t * 100}%`,
                transform: 'translateX(-50%)',
                textAlign: 'center',
                opacity: on ? 0.85 : 0,
                transition: 'opacity 0.3s',
              }}
            >
              <div style={{width: 2, height: 12, background: theme.dim, margin: '0 auto'}} />
              <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginTop: 2}}>{date}</div>
              <div style={{fontFamily: theme.sans, fontSize: 15, color: theme.text}}>{name}</div>
            </div>
          );
        })}
        <div
          style={{
            position: 'absolute',
            top: -26,
            right: 0,
            fontFamily: theme.sans,
            fontSize: 19,
            color: theme.exp,
            opacity: interpolate(frame, [96, 112], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
          }}
        >
          任务循环 → 部署运行时自适应 · 约四年半
        </div>
        <div style={{display: 'flex', gap: 60, marginTop: 90, alignItems: 'flex-start'}}>
          {gens.map((g, i) => {
            const enter = spring({frame: frame - i * 16, fps, config: {damping: 200}});
            const isGen3 = i === 2;
            return (
              <div
                key={g.name}
                style={{
                  flex: 1,
                  opacity: enter * (isGen3 ? 1 : othersDim),
                  transform: isGen3 ? `scale(${zoom}) translateY(${interpolate(frame, [gen3At, gen3At + 18], [0, -8], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}px)` : undefined,
                  transformOrigin: 'center top',
                }}
              >
                <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      background: g.color,
                      boxShadow: `0 0 20px ${g.color}`,
                    }}
                  />
                  <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>{g.year}</span>
                </div>
                <div style={{marginTop: 24, fontSize: 84, position: 'relative'}}>
                  {g.icon}
                  {/* Gen3 可改接口面板：p1-25a 逐个亮起（适应面自进化） */}
                  {isGen3 &&
                    panels.map((p, j) => {
                      const on = interpolate(frame, [gen3At + 8 + j * 10, gen3At + 16 + j * 10], [0, 1], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                      });
                      return (
                        <div
                          key={p}
                          style={{
                            position: 'absolute',
                            left: 66 + (j % 2) * 108,
                            top: 20 + Math.floor(j / 2) * 40,
                            padding: '4px 12px',
                            borderRadius: 8,
                            border: `2px solid ${theme.harness}`,
                            background: '#0E1116',
                            color: theme.harness,
                            fontFamily: theme.sans,
                            fontSize: 19,
                            opacity: on,
                            transform: `scale(${0.8 + 0.2 * on})`,
                            boxShadow: `0 0 14px ${theme.harness}44`,
                          }}
                        >
                          {p} ↻
                        </div>
                      );
                    })}
                </div>
                <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: g.color}}>
                  {g.name}
                </div>
                <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 25, color: theme.dim}}>{g.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
      <FadeUp delay={70} style={{marginTop: 60}}>
        <div style={{fontFamily: theme.sans, fontSize: 27, color: theme.dim}}>
          ReAct → Voyager → Claude Code / Codex / Cursor · 四年半走完三代
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

export const P1Anatomy: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const winG = w('p1-22', 'p1-26');
  const at = (id: string) => {
    const s = scene.sentences.find((x) => x.id === id);
    if (!s) {
      throw new Error(`P1Anatomy: 未找到句 id ${id}`);
    }
    return s.from - scene.from;
  };
  return (
    <AbsoluteFill>
      <Sequence {...w('p1-01', 'p1-02')} name="1-A 四件套">
        <FourParts />
      </Sequence>
      <Sequence {...w('p1-03', 'p1-06')} name="1-B 大脑老板车间">
        <FourParts />
      </Sequence>
      <Sequence {...w('p1-07', 'p1-09')} name="1-C Harness">
        <HarnessZoom />
      </Sequence>
      <Sequence {...w('p1-10', 'p1-12')} name="1-D 便宜洞察">
        <CheapVsExpensive />
      </Sequence>
      <Sequence {...w('p1-13', 'p1-18')} name="1-E 原油汽油">
        <Refinery />
      </Sequence>
      <Sequence {...w('p1-19', 'p1-21')} name="1-F 快慢去路">
        <TwoPaths />
      </Sequence>
      <Sequence {...winG} name="1-G 三代史">
        <ThreeGens gen3At={at('p1-25a') - winG.from} />
      </Sequence>
      <Sequence {...w('p1-27', 'p1-28')} name="1-H 转场钩子">
        <FourDestinationsPreview />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 1-H / 2-A 共用：四管道总图 */
export const FourDestinationsPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dests = [
    {icon: '🗂️', label: '技能库', color: theme.harness},
    {icon: '📓', label: '记忆', color: theme.harness},
    {icon: '🏭', label: '环境', color: theme.harness},
    {icon: '🧠', label: '大脑', color: theme.params},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: 90,
          height: 90,
          borderRadius: 45,
          background: theme.exp,
          boxShadow: `0 0 60px ${theme.exp}`,
          marginBottom: 30,
        }}
      />
      <div style={{display: 'flex', gap: 44}}>
        {dests.map((d, i) => {
          const enter = spring({frame: frame - 6 - i * 5, fps, config: {damping: 200}});
          return (
            <div
              key={d.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 14,
                opacity: enter,
                transform: `translateY(${(1 - enter) * 30}px)`,
              }}
            >
              <div style={{fontSize: 60}}>{d.icon}</div>
              <div
                style={{
                  fontFamily: theme.sans,
                  fontSize: 28,
                  fontWeight: 700,
                  color: d.color,
                  padding: '6px 22px',
                  borderRadius: 12,
                  border: `2px solid ${d.color}`,
                }}
              >
                {d.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
