import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {FadeUp, Pill} from '../components/cards';

/** 五器官地图数据（统一 panel 底+编号，不配五色——反枚举原则） */
const ORGANS = [
  {id: '①', name: '框架', icon: '🧩', desc: '自己的源码'},
  {id: '②', name: '记忆', icon: '🏦', desc: '经验银行'},
  {id: '③', name: '技能工具', icon: '🛠️', desc: '怎么做'},
  {id: '④', name: '模型', icon: '🧠', desc: '大脑本身'},
  {id: '⑤', name: '工作流', icon: '🗺️', desc: '组织方式'},
] as const;

/** 2-A 章头 + 器官总览地图 */
const OrganMap: React.FC<{lit: number}> = ({lit}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const head = spring({frame, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <FadeUp style={{position: 'absolute', top: 70}}>
        <Pill color={theme.evo}>第二问 · 进化什么</Pill>
      </FadeUp>
      <div style={{opacity: head, position: 'relative', width: 1300, height: 760}}>
        {/* 中央 AI 人形 */}
        <div
          style={{
            position: 'absolute',
            left: 650 - 90,
            top: 380 - 90,
            width: 180,
            height: 180,
            borderRadius: 90,
            background: theme.panel,
            border: `3px solid ${theme.panelBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 80,
          }}
        >
          🤖
        </div>
        {ORGANS.map((o, i) => {
          const angle = (-90 + (i / ORGANS.length) * 360) * (Math.PI / 180);
          const x = 650 + Math.cos(angle) * 430;
          const y = 380 + Math.sin(angle) * 270;
          const isLit = lit > i;
          return (
            <div key={o.id}>
              <div
                style={{
                  position: 'absolute',
                  left: x - 110,
                  top: y - 90,
                  width: 220,
                  padding: '18px 14px',
                  borderRadius: 16,
                  background: theme.panel,
                  border: `2px solid ${isLit ? theme.evo : theme.panelBorder}`,
                  boxShadow: isLit ? `0 0 46px ${theme.evoDeep}` : 'none',
                  textAlign: 'center',
                  fontFamily: theme.sans,
                  transition: 'none',
                }}
              >
                <div style={{fontSize: 44}}>{o.icon}</div>
                <div style={{fontSize: 28, fontWeight: 700, color: isLit ? theme.text : theme.dim, marginTop: 6}}>
                  {o.id} {o.name}
                </div>
                <div style={{fontSize: 22, color: theme.dim, marginTop: 4 }}>{o.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** 角标条（底部固定，bottom≥150 避开字幕） */
const CornerBadge: React.FC<{text: string; color?: string}> = ({text, color = theme.dim}) => (
  <div
    style={{
      position: 'absolute',
      bottom: 160,
      left: 0,
      right: 0,
      textAlign: 'center',
      fontFamily: theme.mono,
      fontSize: 26,
      color,
    }}
  >
    {text}
  </div>
);

/** 2-B 器官① SICA：agent.py diff + 分数翻牌（SWE-bench Verified 0.17→0.53，arXiv:2504.15228 真实数字）
 *  翻牌/保留徽章/双仪表按句 id 边界驱动：p2-06 讲 SICA（diff 渲染 + 翻牌起）、p2-07「分数涨了就留下」（徽章）、
 *  p2-07b「还要看花的钱、跑的时间」（成本/时长双仪表点亮，§4.2 选择信号 = benchmark + cost + runtime） */
const SicaDiff: React.FC<{
  sicaFrom: number; // p2-06 相对本 beat 的起始帧
  keepFrom: number; // p2-07 相对本 beat 的起始帧
  metersFrom: number; // p2-07b 相对本 beat 的起始帧
}> = ({sicaFrom, keepFrom, metersFrom}) => {
  const frame = useCurrentFrame();
  const oldScore = 0.17;
  const newScore = interpolate(frame, [sicaFrom, sicaFrom + 60], [0.17, 0.53], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const keep = interpolate(frame, [keepFrom, keepFrom + 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const meters = interpolate(frame, [metersFrom, metersFrom + 18], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // p2-07b 后数字轻微脉冲强调（幅度小、不喧宾）
  const pulse = meters >= 1 ? 1 + Math.sin((frame - metersFrom) * 0.12) * 0.02 : 1;
  const diffF = frame - sicaFrom;
  return (
    <AbsoluteFill style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 70}}>
      <div
        style={{
          width: 760,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 14,
          fontFamily: theme.mono,
          fontSize: 27,
          lineHeight: 1.9,
          overflow: 'hidden',
        }}
      >
        <div style={{padding: '12px 22px', borderBottom: `2px solid ${theme.panelBorder}`, color: theme.evo}}>agent.py</div>
        <div style={{padding: '20px 26px'}}>
          {[
            {t: '+ def better_search(repo):', c: theme.evo},
            {t: '+     """改用调用图定位"""', c: theme.evo},
            {t: '+     return graph_walk(repo)', c: theme.evo},
            {t: '  # 其余保持不变 ...', c: theme.dim},
          ].map((l, i) => (
            <div key={l.t} style={{color: l.c, opacity: interpolate(diffF, [i * 12, i * 12 + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
              {l.t}
            </div>
          ))}
        </div>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 30, alignItems: 'center'}}>
        <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>SWE-bench Verified 通过率</div>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 96,
            fontWeight: 700,
            color: newScore > oldScore ? theme.ok : theme.text,
            transform: `scale(${pulse})`,
          }}
        >
          {newScore.toFixed(2)}
        </div>
        <div
          style={{
            padding: '12px 28px',
            borderRadius: 10,
            border: `3px solid ${theme.ok}`,
            color: theme.ok,
            fontFamily: theme.sans,
            fontSize: 34,
            fontWeight: 700,
            opacity: keep,
            transform: `scale(${0.8 + keep * 0.2})`,
          }}
        >
          ✓ 保留这一版
        </div>
        {/* p2-07b 双仪表：成本 / 运行时长（选择信号的另两维） */}
        <div style={{display: 'flex', gap: 26, opacity: meters}}>
          {[
            {label: '成本 ¥', val: '达标'},
            {label: '时长 ⏱', val: '达标'},
          ].map((m, i) => (
            <div
              key={m.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 20px',
                borderRadius: 10,
                border: `2px solid ${theme.ok}`,
                fontFamily: theme.sans,
                fontSize: 26,
                color: theme.ok,
                opacity: interpolate(meters, [i * 0.5, i * 0.5 + 0.5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
              }}
            >
              <span style={{fontSize: 30}}>✓</span>
              {m.label}
            </div>
          ))}
        </div>
      </div>
      <CornerBadge text="SICA · Robeyns et al., 2025" />
    </AbsoluteFill>
  );
};

/** 2-C 器官① 递归套娃 + 档案馆 */
const RecursionAndArchive: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 100}}>
      {/* 递归套娃 */}
      <FadeUp>
        <div style={{position: 'relative', width: 460, height: 460}}>
          {[0, 1, 2].map((depth) => {
            const inset = depth * 74;
            return (
              <div
                key={depth}
                style={{
                  position: 'absolute',
                  inset,
                  borderRadius: 18,
                  border: `2px solid ${depth === 2 ? theme.evo : theme.panelBorder}`,
                  background: depth === 0 ? theme.panel : theme.bg,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  paddingTop: 16,
                  fontFamily: theme.mono,
                  fontSize: 22 - depth * 2,
                  color: depth === 2 ? theme.evo : theme.dim,
                  opacity: interpolate(frame, [depth * 16, depth * 16 + 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
                }}
              >
                improve(improve(improve(...)))
              </div>
            );
          })}
        </div>
        <div style={{marginTop: 24, textAlign: 'center', fontFamily: theme.sans, fontSize: 26, color: theme.dim, opacity: enter}}>
          STOP：递归自我改进
        </div>
      </FadeUp>
      {/* 档案馆 */}
      <FadeUp delay={40}>
        <div style={{width: 560}}>
          <div style={{display: 'flex', gap: 14}}>
            {['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7'].map((v, i) => (
              <div
                key={v}
                style={{
                  flex: 1,
                  height: 150,
                  borderRadius: 10,
                  background: theme.panel,
                  border: `2px solid ${i >= 5 ? theme.ok : theme.panelBorder}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontFamily: theme.mono,
                  fontSize: 24,
                  color: i >= 5 ? theme.ok : theme.dim,
                  opacity: interpolate(frame, [30 + i * 7, 40 + i * 7], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
                }}
              >
                <span style={{fontSize: 32}}>{i >= 5 ? '🏆' : '📦'}</span>
                {v}
              </div>
            ))}
          </div>
          <div style={{marginTop: 20, fontFamily: theme.sans, fontSize: 26, color: theme.dim, textAlign: 'center'}}>
            Darwin Gödel Machine：变体档案，好用的当父本
          </div>
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 2-D 器官① 风险：红调警示 */
const FrameworkRisk: React.FC = () => {
  const frame = useCurrentFrame();
  const crack = interpolate(frame, [30, 60], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', background: `radial-gradient(circle, ${theme.danger}18, ${theme.bg} 70%)`}}>
      <div style={{display: 'flex', gap: 80, alignItems: 'center'}}>
        <div style={{fontSize: 160, filter: `hue-rotate(${crack * 30}deg)`}}>🤖</div>
        <div style={{fontSize: 70, color: theme.dim}}>🪞</div>
        <div
          style={{
            fontSize: 160,
            transform: `scaleX(${1 - crack * 0.12}) skewY(${crack * 8}deg)`,
            opacity: 1 - crack * 0.5,
            filter: 'grayscale(0.8)',
          }}
        >
          🤖
        </div>
      </div>
      <FadeUp delay={50}>
        <div style={{marginTop: 50, fontFamily: theme.serif, fontSize: 52, fontWeight: 700, color: theme.danger}}>
          改别的坏功能，改自己坏大脑
        </div>
        <div style={{marginTop: 18, textAlign: 'center', fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
          论文标注：这一类风险最高
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 2-E 器官② 经验银行 */
const MemoryBank: React.FC = () => {
  const frame = useCurrentFrame();
  const cards = [
    {label: '成功轨迹', ok: true},
    {label: '失败轨迹', ok: false},
    {label: '成功轨迹', ok: true},
    {label: '失败轨迹', ok: false},
    {label: '成功轨迹', ok: true},
    {label: '失败轨迹', ok: false},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 300px)', gap: 26}}>
        {cards.map((c, i) => (
          <div
            key={i}
            style={{
              height: 170,
              borderRadius: 12,
              background: theme.panel,
              border: `2px solid ${c.ok ? theme.ok : theme.danger}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              opacity: interpolate(frame, [i * 9, i * 9 + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
              transform: `translateY(${interpolate(frame, [i * 9, i * 9 + 10], [40, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}px)`,
            }}
          >
            <span style={{fontSize: 40}}>{c.ok ? '✅' : '❌'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 24, color: c.ok ? theme.ok : theme.danger}}>{c.label}</span>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>已入库</span>
          </div>
        ))}
      </div>
      <FadeUp delay={70}>
        <div style={{marginTop: 44, fontFamily: theme.sans, fontSize: 32, color: theme.text}}>
          失败也存 —— 它能告诉你<span style={{color: theme.danger, fontWeight: 700}}>哪条路走不通</span>
        </div>
      </FadeUp>
      <CornerBadge text="SWE-Exp · 经验银行" />
    </AbsoluteFill>
  );
};

/** 2-F 器官② 仓库记忆 */
const RepoMemory: React.FC = () => {
  const frame = useCurrentFrame();
  const commits = ['fix: 购物车金额', 'refactor: 支付模块', 'fix: 优惠券叠加', 'feat: 退款流程'];
  const extracted = interpolate(frame, [60, 90], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 80}}>
      <FadeUp>
        <div style={{width: 600, display: 'flex', flexDirection: 'column', gap: 18}}>
          {commits.map((c, i) => (
            <div
              key={c}
              style={{
                padding: '18px 24px',
                borderRadius: 10,
                background: theme.panel,
                border: `2px solid ${theme.panelBorder}`,
                fontFamily: theme.mono,
                fontSize: 24,
                color: theme.text,
                opacity: interpolate(frame, [i * 10, i * 10 + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
              }}
            >
              ▪ {c}
            </div>
          ))}
        </div>
      </FadeUp>
      <div style={{fontSize: 60, color: theme.code, opacity: extracted}}>→</div>
      <FadeUp delay={65}>
        <div
          style={{
            width: 440,
            padding: '34px 30px',
            borderRadius: 14,
            background: theme.panel,
            border: `2px solid ${theme.code}`,
            boxShadow: `0 0 50px ${theme.codeDeep}`,
            opacity: extracted,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.code}}>仓库记忆卡</div>
          <div style={{marginTop: 16, fontFamily: theme.sans, fontSize: 24, color: theme.text, lineHeight: 1.8}}>
            「金额类 bug
            <br />
            多半出在 cart/ 与 promo/
            <br />
            的交界处」
          </div>
          <div style={{marginTop: 16, fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>下次定位直接翻这张卡</div>
        </div>
      </FadeUp>
      <CornerBadge text="Repository Memory · 仓库记忆" />
    </AbsoluteFill>
  );
};

/** 2-G 器官② 选择性金句 */
const SelectiveQuote: React.FC = () => (
  <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
    <div style={{textAlign: 'center'}}>
      <div style={{fontFamily: theme.serif, fontSize: 58, fontWeight: 700, color: theme.text, lineHeight: 1.6}}>
        不是存得更多，
        <br />
        而是<span style={{color: theme.code}}>有选择地</span>进化记忆
      </div>
      <div
        style={{
          marginTop: 40,
          fontFamily: theme.serif,
          fontSize: 26,
          fontStyle: 'italic',
          color: theme.dim,
        }}
      >
        “The key challenge is not merely how to store more experience,
        <br />
        but how to evolve memory selectively.”
      </div>
    </div>
  </AbsoluteFill>
);

/** 2-H 器官③ WHAT/HOW 双卡 */
const WhatHow: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const l = spring({frame, fps, config: {damping: 200}});
  const r = spring({frame: frame - 14, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 90}}>
      <div style={{opacity: l, transform: `translateX(${(1 - l) * -60}px)`}}>
        <div style={{width: 480, padding: '40px 36px', borderRadius: 18, background: theme.panel, border: `2px solid ${theme.panelBorder}`, textAlign: 'center'}}>
          <div style={{fontFamily: theme.mono, fontSize: 40, color: theme.dim}}>WHAT</div>
          <div style={{marginTop: 14, fontSize: 60}}>📷</div>
          <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.text}}>记忆：发生了什么</div>
          <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>昨天那次改款、那次报错</div>
        </div>
      </div>
      <div style={{opacity: r, transform: `translateX(${(1 - r) * 60}px)`}}>
        <div style={{width: 480, padding: '40px 36px', borderRadius: 18, background: theme.panel, border: `2px solid ${theme.evo}`, textAlign: 'center', boxShadow: `0 0 40px ${theme.evoDeep}`}}>
          <div style={{fontFamily: theme.mono, fontSize: 40, color: theme.evo}}>HOW</div>
          <div style={{marginTop: 14, fontSize: 60}}>📋</div>
          <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.text}}>技能：下次怎么做</div>
          <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>遇到同类情况的操作步骤</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 2-I 器官③ 技能库抽屉 + 入职文档 */
const SkillDrawer: React.FC = () => {
  const frame = useCurrentFrame();
  const openDrawer = interpolate(frame, [0, 25], [0, 1], {extrapolateRight: 'clamp'});
  const showDoc = interpolate(frame, [80, 100], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 80}}>
      {/* 技能抽屉 */}
      <div style={{position: 'relative', width: 620, height: 520}}>
        {['任务级技能：怎么验证一个修复', '事件级技能：见到 X 报错怎么办', '事件级技能：依赖冲突处理步骤'].map((s, i) => (
          <div
            key={s}
            style={{
              position: 'absolute',
              top: i * 150,
              left: openDrawer * 40,
              width: 560,
              padding: '26px 28px',
              borderRadius: 12,
              background: theme.panel,
              border: `2px solid ${theme.evo}`,
              fontFamily: theme.sans,
              fontSize: 26,
              color: theme.text,
              opacity: interpolate(frame, [10 + i * 14, 20 + i * 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
              transform: `translateX(${(1 - openDrawer) * -60}px)`,
            }}
          >
            <span style={{marginRight: 14}}>{s.startsWith('任务级') ? '🎯' : '⚡'}</span>
            {s}
          </div>
        ))}
      </div>
      {/* gskill 入职文档 */}
      <div
        style={{
          width: 520,
          padding: '40px 40px',
          borderRadius: 14,
          background: '#F5F1E8',
          border: `2px solid #C8BFA8`,
          opacity: showDoc,
          transform: `rotate(${(1 - showDoc) * -4}deg)`,
          color: '#2b2416',
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 22, color: '#8a7a50'}}>ONBOARDING.md</div>
        <div style={{marginTop: 12, fontFamily: theme.serif, fontSize: 38, fontWeight: 700}}>这个仓库怎么干活</div>
        <div style={{marginTop: 18, fontFamily: theme.sans, fontSize: 24, lineHeight: 2.0}}>
          一、架构总览与模块分工
          <br />
          二、测试怎么跑（先装 X）
          <br />
          三、常见坑位速查
          <br />
          四、惯用的修改模式
        </div>
        <div style={{marginTop: 20, fontFamily: theme.sans, fontSize: 22, color: '#8a7a50'}}>—— 给 AI 新员工的入职第一天</div>
      </div>
      <CornerBadge text="CODESKILL · 轨迹蒸馏技能库" />
    </AbsoluteFill>
  );
};

/** 2-J 器官③ 现场造工具 */
const Toolsmith: React.FC = () => {
  const frame = useCurrentFrame();
  const tools = [
    {icon: '⌨️', name: '裸终端', built: false},
    {icon: '📝', name: '自造编辑器', built: true},
    {icon: '🔎', name: '自造搜索器', built: true},
    {icon: '🧪', name: '自造分析器', built: true},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 40}}>
        <div style={{fontSize: 130}}>🤖</div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 18}}>
          {tools.map((t, i) => {
            const appeared = i === 0 || interpolate(frame, [i * 30, i * 30 + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) > 0.5;
            return (
              <div
                key={t.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '14px 26px',
                  borderRadius: 10,
                  background: theme.panel,
                  border: `2px solid ${appeared ? theme.evo : theme.panelBorder}`,
                  fontFamily: theme.sans,
                  fontSize: 27,
                  color: appeared ? theme.text : theme.dim,
                  opacity: appeared ? 1 : 0.4,
                }}
              >
                <span style={{fontSize: 34}}>{t.icon}</span>
                {t.name}
                {t.built && <span style={{marginLeft: 10, fontSize: 20, color: theme.evo}}>new</span>}
              </div>
            );
          })}
        </div>
      </div>
      <FadeUp delay={110}>
        <div style={{marginTop: 44, fontFamily: theme.sans, fontSize: 30, color: theme.text}}>
          边修问题工单，<span style={{color: theme.evo}}>边给自己造工具</span>
        </div>
      </FadeUp>
      <CornerBadge text="Live-SWE-Agent" />
    </AbsoluteFill>
  );
};

/** 2-K 器官④ 动大脑：旋钮阵列 + 训练信号 */
const BrainKnobs: React.FC = () => {
  const frame = useCurrentFrame();
  const rows = 6;
  const cols = 14;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 980, height: 560}}>
        {/* 旋钮阵列 */}
        <div style={{position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14, opacity: 0.95}}>
          {Array.from({length: rows * cols}).map((_, i) => {
            const turned = Math.floor(frame / 6) % (rows * cols) === i;
            return (
              <div
                key={i}
                style={{
                  borderRadius: '50%',
                  background: theme.panel,
                  border: `3px solid ${turned ? theme.evo : theme.panelBorder}`,
                  transform: `rotate(${turned ? frame * 8 : 0}deg)`,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: 4,
                    width: 4,
                    height: '40%',
                    background: turned ? theme.evo : theme.dim,
                    transform: 'translateX(-50%)',
                  }}
                />
              </div>
            );
          })}
        </div>
        {/* 训练信号流入 */}
        <div
          style={{
            position: 'absolute',
            left: interpolate(frame, [0, 40], [-260, -80], {extrapolateRight: 'clamp'}),
            top: 200,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 22px',
            borderRadius: 10,
            border: `2px solid ${theme.ok}`,
            color: theme.ok,
            fontFamily: theme.mono,
            fontSize: 24,
            background: theme.bg,
          }}
        >
          ✓ 测试结果 → 训练信号
        </div>
      </div>
      <div style={{marginTop: 30, fontFamily: theme.sans, fontSize: 30, color: theme.text}}>
        前三类改外围，这一类<span style={{color: theme.evo, fontWeight: 700}}>动大脑本身</span>
      </div>
    </AbsoluteFill>
  );
};

/** 2-L 器官④ 自博弈剧场 */
const SelfPlay: React.FC = () => {
  const frame = useCurrentFrame();
  const caseCount = Math.min(6, Math.floor(frame / 22));
  const genIn = interpolate(frame, [140, 165], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 60, alignItems: 'center'}}>
        {/* 埋 bug */}
        <div style={{textAlign: 'center'}}>
          <div style={{fontSize: 90}}>🤖</div>
          <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 28, color: theme.evo}}>埋 bug 的一方</div>
          <div style={{marginTop: 12, fontFamily: theme.mono, fontSize: 24, color: theme.evo}}>− 正确代码</div>
        </div>
        <div style={{fontSize: 56, color: theme.dim}}>⚔️</div>
        {/* 修 bug */}
        <div style={{textAlign: 'center'}}>
          <div style={{fontSize: 90}}>🛠️</div>
          <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 28, color: theme.ok}}>修复的一方</div>
          <div style={{marginTop: 12, fontFamily: theme.mono, fontSize: 24, color: theme.ok}}>✓ 验证通过</div>
        </div>
      </div>
      {/* 验证案例库 */}
      <div style={{marginTop: 50, display: 'flex', gap: 12}}>
        {Array.from({length: 6}).map((_, i) => (
          <div
            key={i}
            style={{
              width: 90,
              height: 66,
              borderRadius: 8,
              border: `2px solid ${i < caseCount ? theme.ok : theme.panelBorder}`,
              background: theme.panel,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              color: theme.ok,
              opacity: i < caseCount ? 1 : 0.3,
            }}
          >
            {i < caseCount ? '✓' : ''}
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 26,
          padding: '12px 34px',
          borderRadius: 10,
          border: `3px solid ${theme.evo}`,
          color: theme.evo,
          fontFamily: theme.sans,
          fontSize: 30,
          fontWeight: 700,
          opacity: genIn,
          transform: `scale(${0.85 + genIn * 0.15})`,
        }}
      >
        → 训练下一代
      </div>
      <CornerBadge text="Self-play SWE-RL" />
    </AbsoluteFill>
  );
};

/** 2-M 器官④ 共进化对练 */
const Coevolution: React.FC = () => {
  const frame = useCurrentFrame();
  const round = Math.floor(frame / 40);
  const clash = (frame % 40) / 40;
  const bob = Math.sin(clash * Math.PI) * 26;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 120, alignItems: 'center'}}>
        <div style={{textAlign: 'center', transform: `translateY(${bob}px)`}}>
          <div style={{fontSize: 96}}>🧑‍🏫</div>
          <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 28, color: theme.evo}}>出题方</div>
          <div style={{marginTop: 8, fontFamily: theme.mono, fontSize: 22, color: theme.evo}}>测试卡组 ×{3 + round}</div>
        </div>
        <div style={{fontSize: 60}}>🥊</div>
        <div style={{textAlign: 'center', transform: `translateY(${-bob}px)`}}>
          <div style={{fontSize: 96}}>🥷</div>
          <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 28, color: theme.ok}}>解题方</div>
          <div style={{marginTop: 8, fontFamily: theme.mono, fontSize: 22, color: theme.ok}}>防御力 +{round} 级</div>
        </div>
      </div>
      <FadeUp delay={100}>
        <div style={{marginTop: 50, fontFamily: theme.sans, fontSize: 32, color: theme.text}}>
          题越出越刁，码越写越硬 —— <span style={{color: theme.code, fontWeight: 700}}>两边一起变强</span>
        </div>
      </FadeUp>
      <CornerBadge text="CURE · ReVeal · ACE" />
    </AbsoluteFill>
  );
};

/** 2-N 器官④ 仓鼠轮（反直觉） */
const HamsterWheel: React.FC = () => {
  const frame = useCurrentFrame();
  const spin = frame * 6;
  const progress = 22 + Math.sin(frame / 30) * 2;
  const bias = 40 + Math.min(30, frame / 8);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 110, alignItems: 'center'}}>
        <div style={{position: 'relative', width: 380, height: 380}}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 190,
              border: `14px solid ${theme.panelBorder}`,
              transform: `rotate(${spin}deg)`,
            }}
          >
            {Array.from({length: 12}).map((_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 8,
                  width: 5,
                  height: 160,
                  background: theme.panelBorder,
                  transformOrigin: '50% 172px',
                  transform: `translateX(-50%) rotate(${i * 30}deg)`,
                }}
              />
            ))}
          </div>
          <div style={{position: 'absolute', left: 160, top: 170, fontSize: 60}}>🐹</div>
          <div
            style={{
              position: 'absolute',
              right: -30,
              top: 20,
              fontSize: 34,
              opacity: 0.8,
              transform: `rotate(${spin / 2}deg)`,
            }}
          >
            📄
          </div>
          <div
            style={{
              position: 'absolute',
              right: 30,
              bottom: 40,
              fontSize: 30,
              opacity: 0.7,
              transform: `rotate(${-spin / 3}deg)`,
            }}
          >
            📄
          </div>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 34, width: 560}}>
          <div>
            <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>能力</div>
            <div style={{marginTop: 8, height: 20, borderRadius: 10, background: theme.panelBorder}}>
              <div style={{height: '100%', borderRadius: 10, width: `${progress}%`, background: theme.ok}} />
            </div>
          </div>
          <div>
            <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>偏见</div>
            <div style={{marginTop: 8, height: 20, borderRadius: 10, background: theme.panelBorder}}>
              <div style={{height: '100%', borderRadius: 10, width: `${Math.min(bias, 88)}%`, background: theme.danger}} />
            </div>
          </div>
          <FadeUp delay={60}>
            <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.text, lineHeight: 1.7}}>
              数据多 ≠ 变强。
              <br />
              <span style={{color: theme.danger, fontWeight: 700}}>没有新东西可学，就是仓鼠轮。</span>
            </div>
          </FadeUp>
        </div>
      </div>
      <CornerBadge text="learnable information gain · Liu et al., 2026" />
    </AbsoluteFill>
  );
};

/** 2-O 器官④ 边界：健身房门牌 */
const GymBoundary: React.FC = () => {
  const frame = useCurrentFrame();
  const lineDrop = interpolate(frame, [40, 70], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1200, height: 560}}>
        {/* 分界线 */}
        <div
          style={{
            position: 'absolute',
            left: 600,
            top: 0,
            width: 4,
            height: 560,
            background: theme.dim,
            opacity: lineDrop,
            transform: `scaleY(${lineDrop})`,
          }}
        />
        {/* 门外：基建 */}
        <div style={{position: 'absolute', left: 40, top: 90, width: 480, textAlign: 'center', opacity: lineDrop}}>
          <div style={{fontSize: 90}}>🏋️</div>
          <div style={{marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center'}}>
            {['SWE-Gym', 'R2E-Gym'].map((g) => (
              <div key={g} style={{padding: '10px 24px', borderRadius: 8, border: `2px solid ${theme.panelBorder}`, fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>
                {g}
              </div>
            ))}
          </div>
          <div style={{marginTop: 16, fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>器材：环境 + 考题</div>
        </div>
        {/* 门内：运动员 */}
        <div style={{position: 'absolute', right: 40, top: 90, width: 480, textAlign: 'center'}}>
          <div style={{fontSize: 90}}>🤖🏃</div>
          <div style={{marginTop: 16, fontFamily: theme.sans, fontSize: 26, color: theme.text}}>运动员：自己练自己</div>
        </div>
        {/* 门楣 */}
        <div
          style={{
            position: 'absolute',
            left: 600 - 200,
            top: -30,
            width: 400,
            textAlign: 'center',
            fontFamily: theme.serif,
            fontSize: 34,
            fontWeight: 700,
            color: theme.code,
            opacity: lineDrop,
          }}
        >
          「自进化」之门
        </div>
      </div>
      <div style={{marginTop: 30, fontFamily: theme.sans, fontSize: 30, color: theme.text}}>
        健身房是器材，<span style={{color: theme.danger, fontWeight: 700}}>不是运动员</span>
      </div>
    </AbsoluteFill>
  );
};

/** 2-P 器官⑤ 工作流 DAG
 *  切换点按句 id 驱动：失败流水线保留到 p2-57 起始（口播 p2-57 讲「挨个试流程」），
 *  DAG 双图随后展开——观众听到失败三连（p2-55/56）时看得到红色 ✗。 */
const WorkflowDag: React.FC<{switchFrom: number}> = ({switchFrom}) => {
  const frame = useCurrentFrame();
  const showFail = frame < switchFrom;
  const f = frame - switchFrom; // DAG 半场局部帧
  const easyMode = interpolate(f, [0, 30], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const failNodes = showFail
    ? [
        {label: '定位', fail: '❌ 定位错文件'},
        {label: '编码', fail: ''},
        {label: '测试', fail: '❌ 跑得太晚'},
        {label: '路由', fail: '❌ 日志发错人'},
      ]
    : [];
  const dagEdges = easyMode > 0.5;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {showFail ? (
        <div style={{display: 'flex', gap: 34, alignItems: 'center'}}>
          {failNodes.map((n, i) => (
            <div key={n.label} style={{textAlign: 'center'}}>
              <div
                style={{
                  width: 200,
                  padding: '26px 0',
                  borderRadius: 14,
                  background: theme.panel,
                  border: `2px solid ${n.fail ? theme.danger : theme.panelBorder}`,
                  fontFamily: theme.sans,
                  fontSize: 30,
                  color: n.fail ? theme.danger : theme.text,
                  opacity: interpolate(frame, [i * 12, i * 12 + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
                }}
              >
                {n.label}
              </div>
              {n.fail && (
                <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 22, color: theme.danger, opacity: interpolate(frame, [200 + i * 30, 215 + i * 30], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
                  {n.fail}
                </div>
              )}
              {i < failNodes.length - 1 && <div style={{marginTop: 14, fontSize: 34, color: theme.dim}}>→</div>}
            </div>
          ))}
        </div>
      ) : (
        <div style={{position: 'relative', width: 1300, height: 560}}>
          {/* 简单题：稀疏 */}
          <div style={{position: 'absolute', left: 0, top: 0, width: 560}}>
            <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>简单任务 · 少开会</div>
            <div style={{marginTop: 24, display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center'}}>
              {['编码', '测试'].map((n, i) => (
                <div key={n} style={{padding: '18px 44px', borderRadius: 10, border: `2px solid ${theme.code}`, background: theme.panel, color: theme.text, fontFamily: theme.sans, fontSize: 26, opacity: interpolate(f, [40 + i * 12, 52 + i * 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
                  {n}
                </div>
              ))}
            </div>
          </div>
          {/* 难题：蛛网 */}
          <div style={{position: 'absolute', right: 0, top: 0, width: 640}}>
            <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>困难任务 · 多协作</div>
            <div style={{marginTop: 24, display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center'}}>
              {['规划', '编码 A', '编码 B', '测试', '评审', '调试'].map((n, i) => (
                <div key={n} style={{padding: '14px 24px', borderRadius: 10, border: `2px solid ${theme.evo}`, background: theme.panel, color: theme.text, fontFamily: theme.sans, fontSize: 24, opacity: interpolate(f, [60 + i * 10, 72 + i * 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
                  {n}
                </div>
              ))}
            </div>
          </div>
          {dagEdges && (
            <div style={{position: 'absolute', bottom: 60, left: 0, right: 0, textAlign: 'center', fontFamily: theme.sans, fontSize: 28, color: theme.text}}>
              按任务难度，<span style={{color: theme.evo, fontWeight: 700}}>动态调整沟通密度</span>
            </div>
          )}
        </div>
      )}
      <CornerBadge text={showFail ? '固定流程的失败模式' : 'AFlow · AgentConductor · EvoMAC'} />
    </AbsoluteFill>
  );
};

/** 2-Q 收束全景 */
const P2Wrap: React.FC = () => (
  <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
    <OrganMap lit={5} />
    <FadeUp delay={50} style={{position: 'absolute', bottom: 170}}>
      <div style={{display: 'flex', gap: 30, fontFamily: theme.serif, fontSize: 44, fontWeight: 700}}>
        <span style={{color: theme.evo}}>何时进化？</span>
        <span style={{color: theme.code}}>凭什么进化？</span>
      </div>
    </FadeUp>
  </AbsoluteFill>
);

export const P2FiveObjects: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // 2-B beat 内的句边界（相对帧）：diff 渲染/翻牌/保留徽章/双仪表随口播切换
  const sicaBeat = w('p2-03', 'p2-07b');
  const rel = (id: string, beat: {from: number}) => beatWindow(scene.sentences, scene.from, id).from - beat.from;
  return (
    <AbsoluteFill>
      <Sequence {...w('p2-01', 'p2-02')} name="2-A 器官总览">
        <OrganMap lit={1} />
      </Sequence>
      <Sequence {...sicaBeat} name="2-B 框架·SICA">
        <SicaDiff sicaFrom={rel('p2-06', sicaBeat)} keepFrom={rel('p2-07', sicaBeat)} metersFrom={rel('p2-07b', sicaBeat)} />
      </Sequence>
      <Sequence {...w('p2-08', 'p2-11')} name="2-C 框架·递归与档案">
        <RecursionAndArchive />
      </Sequence>
      <Sequence {...w('p2-12', 'p2-13')} name="2-D 框架·风险">
        <FrameworkRisk />
      </Sequence>
      <Sequence {...w('p2-14', 'p2-18')} name="2-E 经验银行">
        <MemoryBank />
      </Sequence>
      <Sequence {...w('p2-19', 'p2-21')} name="2-F 仓库记忆">
        <RepoMemory />
      </Sequence>
      <Sequence {...w('p2-22', 'p2-24')} name="2-G 选择性金句">
        <SelectiveQuote />
      </Sequence>
      <Sequence {...w('p2-25', 'p2-27')} name="2-H WHAT/HOW">
        <WhatHow />
      </Sequence>
      <Sequence {...w('p2-28', 'p2-32')} name="2-I 技能库">
        <SkillDrawer />
      </Sequence>
      <Sequence {...w('p2-33', 'p2-35')} name="2-J 现场造工具">
        <Toolsmith />
      </Sequence>
      <Sequence {...w('p2-36', 'p2-38')} name="2-K 动大脑">
        <BrainKnobs />
      </Sequence>
      <Sequence {...w('p2-39', 'p2-41')} name="2-L 自博弈">
        <SelfPlay />
      </Sequence>
      <Sequence {...w('p2-42', 'p2-44')} name="2-M 共进化">
        <Coevolution />
      </Sequence>
      <Sequence {...w('p2-45', 'p2-48')} name="2-N 仓鼠轮">
        <HamsterWheel />
      </Sequence>
      <Sequence {...w('p2-49', 'p2-51')} name="2-O 健身房边界">
        <GymBoundary />
      </Sequence>
      <Sequence {...w('p2-52', 'p2-59')} name="2-P 工作流DAG">
        <WorkflowDag switchFrom={beatWindow(scene.sentences, scene.from, 'p2-57').from - w('p2-52', 'p2-59').from} />
      </Sequence>
      <Sequence {...w('p2-60', 'p2-61')} name="2-Q 收束全景">
        <P2Wrap />
      </Sequence>
    </AbsoluteFill>
  );
};
