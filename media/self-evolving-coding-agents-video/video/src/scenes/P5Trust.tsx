import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {FadeUp, QuoteCard} from '../components/cards';

/** 5-A 墨滴水库：坏信号跨代遗传 */
const InkReservoir: React.FC = () => {
  const frame = useCurrentFrame();
  const drop = interpolate(frame, [30, 55], [-160, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const spread = interpolate(frame, [55, 130], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const targets = ['记忆库', '技能库', '工作流图', '模型大脑'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40}}>
        {/* 水库 */}
        <div style={{position: 'relative', width: 900, height: 260}}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '0 0 130px 130px',
              background: `linear-gradient(to bottom, #123528, #0b2018)`,
              border: `3px solid #1d4a35`,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 420,
                top: 20,
                width: 70,
                height: 220,
                background: `radial-gradient(ellipse, ${theme.danger}${Math.floor(spread * 200 + 30).toString(16).padStart(2, '0')}, transparent 70%)`,
                filter: 'blur(6px)',
              }}
            />
          </div>
          {/* 墨滴 */}
          <div
            style={{
              position: 'absolute',
              left: 430,
              top: drop,
              width: 44,
              height: 60,
              borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
              background: theme.danger,
              opacity: drop > -10 ? 1 : 0.9,
            }}
          />
          <div style={{position: 'absolute', top: -56, left: 0, right: 0, textAlign: 'center', fontFamily: theme.sans, fontSize: 26, color: theme.danger}}>
            一个不可靠的测试结果
          </div>
        </div>
        {/* 四条扩散管线 */}
        <div style={{display: 'flex', gap: 26}}>
          {targets.map((t, i) => (
            <div
              key={t}
              style={{
                width: 200,
                padding: '20px 0',
                borderRadius: 12,
                textAlign: 'center',
                fontFamily: theme.sans,
                fontSize: 26,
                color: spread > 0.15 + i * 0.2 ? theme.danger : theme.dim,
                border: `2px solid ${spread > 0.15 + i * 0.2 ? theme.danger : theme.panelBorder}`,
                background: spread > 0.15 + i * 0.2 ? `${theme.danger}11` : theme.panel,
              }}
            >
              {t}
            </div>
          ))}
        </div>
        <FadeUp delay={140}>
          <div style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.text}}>
            静态 AI 错一单，<span style={{color: theme.danger}}>会进化的 AI 错一辈子</span>
          </div>
        </FadeUp>
      </div>
    </AbsoluteFill>
  );
};

/** 5-B 三假动作小剧场（三卡循环点亮，覆盖口播枚举窗口，不随帧溢出熄灭） */
const FakeMoves: React.FC = () => {
  const frame = useCurrentFrame();
  const stage = Math.floor(frame / 42) % 3;
  const acts = [
    {icon: '🤫', title: '背题', sub: '袖子里藏着小抄', en: 'memorization'},
    {icon: '🔁', title: '反复刷榜', sub: '同一份榜刷到熟', en: 'repeated benchmark tuning'},
    {icon: '📖', title: '死练公开答案', sub: '对着答案册抄写', en: 'overfitting to public signals'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 54}}>
        {acts.map((a, i) => {
          const active = stage === i;
          return (
            <div
              key={a.title}
              style={{
                width: 360,
                padding: '34px 28px',
                borderRadius: 16,
                background: theme.panel,
                border: `3px solid ${active ? theme.danger : theme.panelBorder}`,
                textAlign: 'center',
                opacity: interpolate(frame, [i * 14, i * 14 + 12], [0.35, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
                transform: active ? 'translateY(-10px)' : 'none',
              }}
            >
              <div style={{fontSize: 66}}>{a.icon}</div>
              <div style={{marginTop: 12, fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: theme.text}}>{a.title}</div>
              <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>{a.sub}</div>
              {active && <div style={{marginTop: 12, fontFamily: theme.mono, fontSize: 19, color: theme.danger}}>✗ {a.en}</div>}
            </div>
          );
        })}
      </div>
      <FadeUp delay={130}>
        <div style={{marginTop: 44, fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>复现性难题之外，还要提防三种假动作</div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 5-C 记忆四宗罪 */
const FourSins: React.FC = () => {
  const frame = useCurrentFrame();
  const sins = [
    {icon: '🧀', title: '过期', sub: '书页发霉 · stale'},
    {icon: '🖨️', title: '冗余', sub: '全是复印本 · redundant'},
    {icon: '🔒', title: '认死一个仓库', sub: 'overly repo-specific'},
    {icon: '🩸', title: '被失败污染', sub: 'contaminated'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 24}}>
        {sins.map((s, i) => (
          <div
            key={s.title}
            style={{
              width: 290,
              padding: '36px 24px',
              borderRadius: 14,
              background: theme.panel,
              border: `2px solid ${theme.panelBorder}`,
              textAlign: 'center',
              opacity: interpolate(frame, [i * 12, i * 12 + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
            }}
          >
            <div style={{fontSize: 60}}>{s.icon}</div>
            <div style={{marginTop: 14, fontFamily: theme.serif, fontSize: 30, fontWeight: 700, color: theme.text}}>{s.title}</div>
            <div style={{marginTop: 8, fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{s.sub}</div>
          </div>
        ))}
      </div>
      <FadeUp delay={70}>
        <div style={{marginTop: 44, fontFamily: theme.sans, fontSize: 30, color: theme.text}}>
          记忆和技能库，也会<span style={{color: theme.danger, fontWeight: 700}}>烂</span>
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 5-D 正题宣言 */
const NotChores: React.FC = () => {
  const frame = useCurrentFrame();
  const items = ['🧰 工具靠不靠谱', '🏟️ 练习场像不像真的', '🛂 安检严不严格'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 34}}>
        {items.map((it, i) => (
          <div
            key={it}
            style={{
              padding: '26px 36px',
              borderRadius: 14,
              background: theme.panel,
              border: `2px solid ${theme.panelBorder}`,
              fontFamily: theme.sans,
              fontSize: 29,
              color: theme.text,
              opacity: interpolate(frame, [i * 12, i * 12 + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
            }}
          >
            {it}
          </div>
        ))}
      </div>
      <FadeUp delay={60}>
        <div style={{marginTop: 56, fontFamily: theme.serif, fontSize: 48, fontWeight: 700, color: theme.code, textAlign: 'center'}}>
          不是工程杂活，
          <br />
          是自进化问题的正题
        </div>
        <div style={{marginTop: 24, fontFamily: theme.serif, fontSize: 22, fontStyle: 'italic', color: theme.dim, textAlign: 'center'}}>
          {'"part of the self-evolution problem, not merely implementation details"'}
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 5-F 五机制清单 + 绿门收束 */
const FiveMechanisms: React.FC = () => {
  const frame = useCurrentFrame();
  const mech = ['验反馈', '修记忆', '审技能', '限自改', '评长期'];
  const litCount = Math.min(5, Math.floor(frame / 16));
  const gateIn = interpolate(frame, [100, 135], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const arrowX = interpolate(frame, [135, 175], [10, 195], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 22}}>
        {mech.map((m, i) => (
          <div
            key={m}
            style={{
              width: 200,
              padding: '30px 0',
              borderRadius: 14,
              textAlign: 'center',
              fontFamily: theme.serif,
              fontSize: 32,
              fontWeight: 700,
              color: i < litCount ? theme.ok : '#3a4252',
              border: `2px solid ${i < litCount ? theme.ok : theme.panelBorder}`,
              background: i < litCount ? theme.codeDeep : theme.panel,
              opacity: interpolate(frame, [i * 4, i * 4 + 8], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {m}
          </div>
        ))}
      </div>
      {/* 绿门 + 洋红箭头 */}
      <div style={{marginTop: 70, position: 'relative', width: 560, height: 240, opacity: gateIn}}>
        <div
          style={{
            position: 'absolute',
            left: 180,
            top: 0,
            bottom: 0,
            width: 200,
            border: `8px solid ${theme.code}`,
            borderRadius: '16px 16px 0 0',
            boxShadow: `0 0 60px ${theme.codeDeep}`,
          }}
        />
        <div style={{position: 'absolute', left: arrowX, top: 90, fontSize: 44, color: theme.evo}}>{'➤'}</div>
        <div style={{position: 'absolute', right: 0, top: 96, fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
          进化的冲动
        </div>
      </div>
      <FadeUp delay={150}>
        <div style={{marginTop: 20, fontFamily: theme.sans, fontSize: 28, color: theme.text}}>
          必须过<span style={{color: theme.code, fontWeight: 700}}>验证之门</span>
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

export const P5Trust: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p5-01', 'p5-07')} name="5-A 墨滴水库">
        <InkReservoir />
      </Sequence>
      <Sequence {...w('p5-08', 'p5-11')} name="5-B 三假动作">
        <FakeMoves />
      </Sequence>
      <Sequence {...w('p5-12', 'p5-13')} name="5-C 四宗罪">
        <FourSins />
      </Sequence>
      <Sequence {...w('p5-14', 'p5-15')} name="5-D 正题宣言">
        <NotChores />
      </Sequence>
      <Sequence {...w('p5-16', 'p5-18')} name="5-E KEY QUOTE">
        <QuoteCard
          zh="不只是让编码智能体进化，而是让它们的进化值得信赖"
          en="The central challenge … not merely to make coding agents evolve, but to make their evolution trustworthy."
          cite="§7 Conclusion"
          accent={theme.code}
        />
      </Sequence>
      <Sequence {...w('p5-19', 'p5-21')} name="5-F 五机制清单">
        <FiveMechanisms />
      </Sequence>
    </AbsoluteFill>
  );
};
