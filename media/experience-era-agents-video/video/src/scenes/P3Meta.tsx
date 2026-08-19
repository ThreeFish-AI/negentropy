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

/** 3-A：三级阶梯 + 谁控制进化 */
const Ladder: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const levels = [
    {name: '自己攒资产', icon: '🎒', desc: '边干活边攒技能与记忆'},
    {name: '学会怎么改进', icon: '🧭', desc: '失败 → 原则 → 下次引用'},
    {name: '专职进化部门', icon: '🏛️', desc: '独立的 meta 层管进化'},
  ];
  // Figure 8 二维格阵 underlay：先以淡格阵出现（p3-01..02），轴标签随 p3-03 点亮，
  // 再让位给三级阶梯（A4 校准：1↔2 级分界是「改什么」，2↔3 才是控制权）
  const grid = interpolate(frame, [6, 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const axes = interpolate(frame, [28, 44], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const toLadder = interpolate(frame, [48, 66], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const cols = ['内容资产', '机制/结构', '改进策略', '元层自身'];
  const rows = ['meta 层控制', '任务体自控'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <FadeUp style={{position: 'absolute', top: 110}}>
        <div style={{fontFamily: theme.sans, fontSize: 38, color: theme.exp}}>谁来决定，经验往哪送？</div>
      </FadeUp>
      {/* 二维格阵（Figure 8）：2 行 × 4 列，对角两格为空（–） */}
      <div
        style={{
          position: 'absolute',
          opacity: grid * (1 - toLadder),
          transform: `translateY(${toLadder * 90}px) scale(${1 - 0.12 * toLadder})`,
        }}
      >
        <div style={{display: 'grid', gridTemplateColumns: `repeat(4, 190px)`, gap: 10, marginLeft: 150}}>
          {cols.map((c) => (
            <div key={c} style={{textAlign: 'center', fontFamily: theme.mono, fontSize: 17, color: theme.harness, opacity: axes}}>
              {c}
            </div>
          ))}
        </div>
        {rows.map((r, ri) => (
          <div key={r} style={{display: 'grid', gridTemplateColumns: '140px repeat(4, 190px)', gap: 10, marginTop: 10, alignItems: 'center'}}>
            <div style={{textAlign: 'right', fontFamily: theme.mono, fontSize: 17, color: theme.harness, opacity: axes}}>{r}</div>
            {cols.map((c, ci) => {
              const empty = (ri === 0 && ci === 0) || (ri === 1 && ci === 3);
              const cellIn = interpolate(frame, [10 + (ri * 4 + ci) * 2, 20 + (ri * 4 + ci) * 2], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              return (
                <div
                  key={c}
                  style={{
                    height: 108,
                    borderRadius: 10,
                    background: empty ? 'transparent' : theme.panel,
                    border: `1.5px dashed ${empty ? theme.panelBorder : theme.harness}`,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontFamily: empty ? theme.mono : theme.sans,
                    fontSize: empty ? 26 : 19,
                    color: theme.dim,
                    opacity: cellIn * (empty ? 0.6 : 1),
                  }}
                >
                  {empty ? '–' : ['MetaMem 系', 'MetaEvo', 'Hyperagents', '', 'SkillClaw 系', 'SkillOS', 'SkillRL', ''][ri * 4 + ci] || '…'}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{display: 'flex', alignItems: 'flex-end', gap: 60, marginTop: 80, opacity: toLadder}}>
        {levels.map((l, i) => {
          const h = 200 + i * 110;
          const enter = spring({frame: frame - i * 12, fps, config: {damping: 200}});
          return (
            <div key={l.name} style={{textAlign: 'center', opacity: enter}}>
              <div
                style={{
                  width: 340,
                  height: h,
                  borderRadius: '18px 18px 0 0',
                  background: theme.panel,
                  border: `3px solid ${i === 2 ? theme.exp : theme.harness}`,
                  borderTopWidth: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  paddingTop: 28,
                  gap: 12,
                }}
              >
                <div style={{fontSize: 58}}>{l.icon}</div>
                <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 700, color: i === 2 ? theme.exp : theme.harness}}>
                  第 {i + 1} 级 · {l.name}
                </div>
                <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, padding: '0 18px'}}>{l.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** 3-B：第一级——卡片入背包 */
const LevelOne: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cards = ['技能卡', '记忆卡', '经验卡'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 90, alignItems: 'center'}}>
        <div style={{fontSize: 140, opacity: spring({frame, fps, config: {damping: 200}})}}>🤖</div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
          {cards.map((c, i) => {
            const enter = interpolate(frame, [10 + i * 14, 20 + i * 14], [0, 1], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            });
            return (
              <div
                key={c}
                style={{
                  padding: '14px 28px',
                  borderRadius: 12,
                  background: theme.panel,
                  border: `2px solid ${theme.harness}`,
                  fontFamily: theme.sans,
                  fontSize: 26,
                  color: theme.text,
                  opacity: enter,
                  transform: `translateX(${(1 - enter) * -80}px)`,
                }}
              >
                🎫 {c}
              </div>
            );
          })}
        </div>
        <div style={{fontSize: 110, opacity: interpolate(frame, [30, 44], [0, 1], {extrapolateRight: 'clamp'})}}>
          🎒
        </div>
      </div>
      <FadeUp delay={50} style={{marginTop: 50}}>
        <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>进化是干活的副产品</div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 3-C：第二级——失败提炼成原则 */
const LevelTwo: React.FC = () => {
  const frame = useCurrentFrame();
  const distill = interpolate(frame, [20, 50], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 60, alignItems: 'center'}}>
        <div
          style={{
            width: 380,
            padding: 30,
            borderRadius: 18,
            background: theme.panel,
            border: `3px solid ${theme.danger}`,
            opacity: 1 - distill * 0.6,
          }}
        >
          <div style={{fontSize: 50}}>💥</div>
          <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 28, color: theme.danger, fontWeight: 700}}>
            我上次为什么搞砸
          </div>
          <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 23, color: theme.dim, lineHeight: 1.6}}>
            失败轨迹复盘
          </div>
        </div>
        <div style={{fontSize: 60, color: theme.harness, opacity: distill}}>→</div>
        <div
          style={{
            width: 420,
            padding: 30,
            borderRadius: 18,
            background: theme.panel,
            border: `3px solid ${theme.harness}`,
            transform: `scale(${0.85 + distill * 0.15})`,
            opacity: distill,
          }}
        >
          <div style={{fontSize: 50}}>📜</div>
          <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 28, color: theme.harness, fontWeight: 700}}>
            原则 #1
          </div>
          <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 23, color: theme.dim, lineHeight: 1.6}}>
            存入库 · 下次直接引用
          </div>
        </div>
      </div>
      <FadeUp delay={56} style={{marginTop: 46, position: 'absolute', bottom: 150}}>
        <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>MetaEvo：原则化自我修正</div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 3-D：第三级——员工冻结 + 图书管理员 */
const LevelThree: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const score = spring({frame: frame - 30, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 100, alignItems: 'center'}}>
        <div
          style={{
            width: 400,
            padding: 34,
            borderRadius: 20,
            background: theme.panel,
            border: `3px solid ${theme.params}`,
            textAlign: 'center',
          }}
        >
          <div style={{fontSize: 76}}>🤖</div>
          <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 28, fontWeight: 700, color: theme.params}}>
            干活的员工
          </div>
          <div
            style={{
              marginTop: 14,
              display: 'inline-block',
              padding: '6px 18px',
              borderRadius: 10,
              border: `2px solid ${theme.params}`,
              fontFamily: theme.sans,
              fontSize: 22,
              color: theme.params,
            }}
          >
            🔒 冻结 · 一个字不许改
          </div>
        </div>
        <div style={{fontSize: 54, color: theme.dim}}>⇄</div>
        <div
          style={{
            width: 400,
            padding: 34,
            borderRadius: 20,
            background: theme.panel,
            border: `3px solid ${theme.exp}`,
            textAlign: 'center',
          }}
        >
          <div style={{fontSize: 76}}>🧑‍📚</div>
          <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 28, fontWeight: 700, color: theme.exp}}>
            图书管理员
          </div>
          <div style={{marginTop: 14, display: 'flex', gap: 12, justifyContent: 'center'}}>
            {['➕ 增', '✏️ 改', '➖ 删'].map((op) => (
              <span key={op} style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
                {op}
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* 成绩单 */}
      <div
        style={{
          position: 'absolute',
          bottom: 230,
          padding: '18px 36px',
          borderRadius: 16,
          background: theme.panel,
          border: `2px solid ${theme.ok}`,
          display: 'flex',
          gap: 18,
          alignItems: 'center',
          opacity: score,
          transform: `translateY(${(1 - score) * 30}px)`,
        }}
      >
        <span style={{fontSize: 40}}>📊</span>
        <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.ok}}>
          每次改库，拿后面任务的成绩算绩效
        </span>
      </div>
      <FadeUp delay={40} style={{position: 'absolute', bottom: 150}}>
        <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>
          SkillOS：冻结 Executor + 独立 Curator
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 3-E：自指套娃——改进流程改进自己 */
const SelfReference: React.FC = () => {
  const frame = useCurrentFrame();
  const depth = Math.min(4, 1 + Math.floor(frame / 16));
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 900, height: 560}}>
        {Array.from({length: depth}).map((_, i) => {
          const scale = 1 - i * 0.18;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: (900 - scale * 900) / 2,
                top: (560 - scale * 460) / 2,
                width: scale * 900,
                height: scale * 460,
                borderRadius: 24,
                border: `3px solid ${i === 0 ? theme.exp : theme.harness}`,
                background: i === 0 ? theme.panel : 'transparent',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <span style={{fontSize: 40 - i * 5}}>🛠️</span>
              <span
                style={{
                  fontFamily: theme.mono,
                  fontSize: Math.max(18, 30 - i * 3),
                  color: i === 0 ? theme.text : theme.harness,
                }}
              >
                改进流程{depth > 1 && i < depth - 1 ? ' →' : ''}
              </span>
            </div>
          );
        })}
      </div>
      <FadeUp delay={60} style={{position: 'absolute', bottom: 150}}>
        <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>
          Hyperagents：连「怎么改进自己」的代码，也可以被改进
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 3-F：裁判与运动员一起变形 */
const Paradox: React.FC = () => {
  const frame = useCurrentFrame();
  const warp = Math.sin(frame * 0.05) * 14;
  const darken = interpolate(frame, [40, 80], [0, 0.35], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', background: `rgba(14,17,22,${darken})`}}>
      <div style={{display: 'flex', gap: 120, alignItems: 'center'}}>
        <div style={{textAlign: 'center'}}>
          <div style={{fontSize: 120, transform: `skewX(${warp}deg)`}}>🧑‍⚖️</div>
          <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>裁判</div>
        </div>
        <div style={{fontSize: 60, color: theme.danger}}>≠</div>
        <div style={{textAlign: 'center'}}>
          <div style={{fontSize: 120, transform: `skewX(${-warp}deg)`}}>🏃</div>
          <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>运动员</div>
        </div>
      </div>
      <FadeUp delay={30} style={{marginTop: 70}}>
        <Pill color={theme.danger}>两者一起变形 · 失去稳定参照系</Pill>
      </FadeUp>
      <FadeUp delay={55} style={{marginTop: 26}}>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>
          论文的措辞很诚实：当前最大的开放问题之一
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

export const P3Meta: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p3-01', 'p3-03')} name="3-A 三级阶梯">
        <Ladder />
      </Sequence>
      <Sequence {...w('p3-04', 'p3-05')} name="3-B 第一级">
        <LevelOne />
      </Sequence>
      <Sequence {...w('p3-06', 'p3-08')} name="3-C 第二级">
        <LevelTwo />
      </Sequence>
      <Sequence {...w('p3-09', 'p3-12')} name="3-D 第三级">
        <LevelThree />
      </Sequence>
      <Sequence {...w('p3-13', 'p3-15')} name="3-E 自指">
        <SelfReference />
      </Sequence>
      <Sequence {...w('p3-16', 'p3-19')} name="3-F 悖论">
        <Paradox />
      </Sequence>
    </AbsoluteFill>
  );
};
