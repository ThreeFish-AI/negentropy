import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {FadeUp, Pill} from '../components/cards';

/** 0-A 工位日志：终端窗口逐行打出 AI 程序员的能力清单 */
const WorkstationLog: React.FC = () => {
  const frame = useCurrentFrame();
  const lines = [
    '$ agent --task "修复购物车金额计算错误"',
    '> 解读需求 ......... ok',
    '> 检索仓库 ......... 312 files',
    '> 定位缺陷 ......... cart/total.py:L47',
    '> 编写补丁 ......... done',
    '> 运行测试 ......... 24 passed ✓',
  ];
  const visible = Math.floor(frame / 8);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: 1160,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 16,
          padding: '36px 44px',
          fontFamily: theme.mono,
          fontSize: 30,
          color: theme.code,
          lineHeight: 1.9,
          boxShadow: `0 0 60px ${theme.codeDeep}`,
        }}
      >
        <div style={{display: 'flex', gap: 12, marginBottom: 24}}>
          {['#FF5C5C', '#F5C542', '#4ADE80'].map((c) => (
            <div key={c} style={{width: 20, height: 20, borderRadius: 10, background: c}} />
          ))}
        </div>
        {lines.map((l, i) => (
          <div key={l} style={{opacity: i < visible ? 1 : 0}}>
            {l}
          </div>
        ))}
        <div style={{opacity: Math.floor(frame / 8) >= lines.length ? 1 : 0, color: theme.text}}>
          ▊<span style={{opacity: interpolate(frame % 16, [0, 8], [1, 0])}}>_</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 0-B 浇筑定型：五齿轮被水泥冻结 vs 世界持续变化 */
const PouredGears: React.FC = () => {
  const frame = useCurrentFrame();
  const gears = ['模型', '提示词', '工具', '记忆', '流程'];
  const pour = interpolate(frame, [10, 50], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 90}}>
      <div style={{position: 'relative', width: 560, height: 560}}>
        {gears.map((g, i) => {
          const angle = (i / gears.length) * Math.PI * 2;
          const x = 280 + Math.cos(angle) * 175 - 70;
          const y = 280 + Math.sin(angle) * 175 - 70;
          return (
            <div
              key={g}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: 140,
                height: 140,
                borderRadius: 18,
                background: theme.panel,
                border: `2px solid ${theme.panelBorder}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontFamily: theme.sans,
                fontSize: 26,
                color: theme.text,
              }}
            >
              <div style={{fontSize: 44}}>⚙️</div>
              {g}
            </div>
          );
        })}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(to top, rgba(120,120,130,${0.85 * pour}), rgba(120,120,130,${0.85 * pour}))`,
            borderRadius: 24,
            border: `${2 * pour}px solid #8a8a95`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -70,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 30,
            color: theme.dim,
            opacity: pour,
          }}
        >
          上线即定型：五件套全部浇筑
        </div>
      </div>
      <div style={{width: 560, display: 'flex', flexDirection: 'column', gap: 34}}>
        {[
          {icon: '🌳', label: '仓库在长', detail: '+2,314 commits / 月'},
          {icon: '🔁', label: '零件在换', detail: '依赖升级 ×47'},
          {icon: '⚡', label: '测试在挂', detail: '3 failures · CI red'},
        ].map((r, i) => (
          <div
            key={r.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              padding: '22px 30px',
              borderRadius: 14,
              background: theme.panel,
              border: `2px solid ${theme.panelBorder}`,
              opacity: interpolate(frame, [i * 12 + 20, i * 12 + 40], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
            }}
          >
            <span style={{fontSize: 46}}>{r.icon}</span>
            <span style={{fontFamily: theme.sans, fontSize: 32, color: theme.text}}>{r.label}</span>
            <span style={{marginLeft: 'auto', fontFamily: theme.mono, fontSize: 24, color: r.label === '测试在挂' ? theme.danger : theme.dim}}>
              {r.detail}
            </span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 0-C 反转钩子：编辑器停在 agent.py —— 它自己的源码 */
const SelfSourceReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tabs = ['cart/total.py', 'api/order.ts', 'agent.py', 'README.md'];
  const stopAt = 2;
  const spin = Math.min(frame / 3, stopAt);
  const reveal = spring({frame: frame - 90, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <FadeUp>
        <div
          style={{
            width: 1240,
            background: theme.panel,
            border: `2px solid ${reveal > 0.5 ? theme.evo : theme.panelBorder}`,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: reveal > 0.5 ? `0 0 80px ${theme.evoDeep}` : 'none',
          }}
        >
          <div style={{display: 'flex', borderBottom: `2px solid ${theme.panelBorder}`, fontFamily: theme.mono, fontSize: 24}}>
            {tabs.map((t, i) => (
              <div
                key={t}
                style={{
                  padding: '14px 26px',
                  color: Math.floor(spin) === i ? (i === stopAt ? theme.evo : theme.text) : theme.dim,
                  background: Math.floor(spin) === i ? theme.bg : 'transparent',
                  fontWeight: Math.floor(spin) === i ? 700 : 400,
                }}
              >
                {t}
              </div>
            ))}
          </div>
          <div style={{padding: '34px 44px', fontFamily: theme.mono, fontSize: 30, lineHeight: 2.0}}>
            {[
              {t: 'def improve_self(agent):', c: theme.text},
              {t: '    """让下一代自己更强"""', c: theme.dim},
              {t: '    patch = agent.propose_change(agent.own_source)', c: theme.evo},
              {t: '    if benchmark(agent.apply(patch)) > agent.score:', c: theme.text},
              {t: '        return agent.evolve(patch)   # 保留', c: theme.code},
            ].map((l, i) => (
              <div key={l.t} style={{color: l.c, opacity: interpolate(frame, [50 + i * 10, 62 + i * 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
                {l.t}
              </div>
            ))}
          </div>
        </div>
      </FadeUp>
      <FadeUp delay={95} style={{marginTop: 36}}>
        <div style={{fontFamily: theme.serif, fontSize: 54, fontWeight: 700, color: theme.evo, textAlign: 'center'}}>
          它打开的，是它自己的源码
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 0-D 主线双问 */
const DoubleQuestion: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const left = spring({frame, fps, config: {damping: 200}});
  const right = spring({frame: frame - 18, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 80}}>
      <div
        style={{
          opacity: left,
          transform: `scale(${0.85 + left * 0.15})`,
          padding: '44px 54px',
          borderRadius: 20,
          border: `3px solid ${theme.evo}`,
          fontFamily: theme.serif,
          fontSize: 56,
          fontWeight: 700,
          color: theme.evo,
          background: theme.panel,
        }}
      >
        能不能越改越强？
      </div>
      <div
        style={{
          opacity: right,
          transform: `scale(${0.85 + right * 0.15})`,
          padding: '44px 54px',
          borderRadius: 20,
          border: `3px solid ${theme.code}`,
          fontFamily: theme.serif,
          fontSize: 56,
          fontWeight: 700,
          color: theme.code,
          background: theme.panel,
        }}
      >
        改完凭什么信？
      </div>
    </AbsoluteFill>
  );
};

/** 0-E 论文卡 */
const PaperCard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const flip = spring({frame, fps, config: {damping: 200}});
  const rqs = ['RQ1 · 进化什么？', 'RQ2 · 何时？靠什么证据？', 'RQ3 · 怎么评？'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: 1080,
          padding: '54px 64px',
          borderRadius: 20,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          transform: `perspective(1600px) rotateY(${(1 - flip) * 70}deg)`,
          opacity: flip,
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.text, lineHeight: 1.4}}>
          Self-Evolving Coding Agents: A Survey
        </div>
        <div style={{marginTop: 22, fontFamily: theme.sans, fontSize: 30, color: theme.dim}}>
          南京理工大学 × 南京大学 · 2026 年 8 月
        </div>
        <div style={{marginTop: 16, fontFamily: theme.mono, fontSize: 28, color: theme.code}}>arXiv:2608.03392</div>
        <div style={{marginTop: 36, display: 'flex', gap: 18}}>
          {rqs.map((r, i) => (
            <div
              key={r}
              style={{
                padding: '12px 20px',
                borderRadius: 10,
                border: `2px solid ${theme.panelBorder}`,
                fontFamily: theme.sans,
                fontSize: 26,
                color: theme.text,
                opacity: interpolate(frame, [50 + i * 14, 66 + i * 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
              }}
            >
              {r}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 0-F 标题卡：绿×洋红双色光带 */
const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame, [0, 60], [-1100, 0], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          width: 2400,
          height: 14,
          background: `linear-gradient(90deg, transparent, ${theme.code}, transparent)`,
          top: 300,
          transform: `translateX(${sweep}px) rotate(-8deg)`,
          opacity: 0.8,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 2400,
          height: 14,
          background: `linear-gradient(90deg, transparent, ${theme.evo}, transparent)`,
          top: 760,
          transform: `translateX(${-sweep}px) rotate(-8deg)`,
          opacity: 0.8,
        }}
      />
      <div style={{fontFamily: theme.serif, fontSize: 88, fontWeight: 700, color: theme.text, textAlign: 'center', lineHeight: 1.35, zIndex: 1}}>
        会写代码的 AI，
        <br />
        开始给自己写代码
      </div>
      <FadeUp delay={40} style={{marginTop: 40, zIndex: 1}}>
        <div style={{display: 'flex', gap: 24}}>
          <Pill color={theme.code}>可执行证据</Pill>
          <Pill color={theme.evo}>进化动作</Pill>
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

export const P0Hook: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p0-01', 'p0-04')} name="0-A 工位日志">
        <WorkstationLog />
      </Sequence>
      <Sequence {...w('p0-05', 'p0-08')} name="0-B 浇筑定型">
        <PouredGears />
      </Sequence>
      <Sequence {...w('p0-09', 'p0-13')} name="0-C 反转钩子">
        <SelfSourceReveal />
      </Sequence>
      <Sequence {...w('p0-14', 'p0-15')} name="0-D 主线双问">
        <DoubleQuestion />
      </Sequence>
      <Sequence {...w('p0-16', 'p0-17')} name="0-E 论文卡">
        <PaperCard />
      </Sequence>
      <Sequence {...w('p0-18')} name="0-F 标题卡">
        <TitleCard />
      </Sequence>
    </AbsoluteFill>
  );
};
