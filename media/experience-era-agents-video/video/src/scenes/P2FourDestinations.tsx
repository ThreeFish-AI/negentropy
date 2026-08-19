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
import {FourDestinationsPreview} from './P1Anatomy';

/** 2-B：技能抽屉——SKILL.md 文件夹 σ=⟨M,I,R,A⟩ */
const SkillDrawer: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const open = interpolate(frame, [6, 26], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  const sections = [
    {k: 'M', label: '封面 · 元数据', desc: '这技能干嘛的', color: theme.harness},
    {k: 'I', label: '正文 · 指令', desc: '怎么干', color: theme.exp},
    {k: 'R', label: '参考 · 资料', desc: '文档与样例', color: theme.harness},
    {k: 'A', label: '附件 · 脚本', desc: '支撑落地', color: theme.params},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 80}}>
        <div
          style={{
            width: 340,
            height: 240,
            borderRadius: 20,
            background: theme.panel,
            border: `3px solid ${theme.harness}`,
            transform: `translateX(${(1 - open) * 40}px)`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{fontSize: 70}}>🗄️</div>
          <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.harness, fontWeight: 700}}>技能抽屉</div>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 18, opacity: open}}>
          {sections.map((s, i) => {
            const enter = spring({frame: frame - 24 - i * 5, fps, config: {damping: 200}});
            return (
              <div
                key={s.k}
                style={{
                  display: 'flex',
                  gap: 20,
                  alignItems: 'center',
                  padding: '14px 26px',
                  borderRadius: 14,
                  background: theme.panel,
                  border: `2px solid ${s.color}`,
                  opacity: enter,
                  transform: `translateX(${(1 - enter) * 60}px)`,
                  minWidth: 520,
                }}
              >
                <span style={{fontFamily: theme.mono, fontSize: 34, fontWeight: 700, color: s.color}}>{s.k}</span>
                <span style={{fontFamily: theme.sans, fontSize: 27, color: theme.text}}>{s.label}</span>
                <span style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim, marginLeft: 'auto'}}>{s.desc}</span>
              </div>
            );
          })}
        </div>
      </div>
      <FadeUp delay={50} style={{position: 'absolute', bottom: 150}}>
        <div style={{fontFamily: theme.mono, fontSize: 28, color: theme.exp}}>σ = ⟨ M, I, R, A ⟩ · SKILL.md 规范</div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 2-C：生命周期环（创建→使用→进化） */
const LifecycleRing: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stages = [
    {name: '创建', icon: '🛠️', desc: '专家手写 · 挖仓库 · 蒸馏文档'},
    {name: '使用', icon: '🔍', desc: '找得到 · 搭得起来 · 跑得动'},
    {name: '进化', icon: '🧬', desc: '部署证据 → 增删改库'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 70, alignItems: 'center'}}>
        {stages.map((s, i) => {
          const enter = spring({frame: frame - i * 10, fps, config: {damping: 200}});
          return (
            <React.Fragment key={s.name}>
              {i > 0 ? (
                <div style={{fontSize: 50, color: theme.harness, opacity: enter}}>→</div>
              ) : null}
              <div
                style={{
                  width: 330,
                  padding: 34,
                  borderRadius: 22,
                  background: theme.panel,
                  border: `3px solid ${theme.harness}`,
                  textAlign: 'center',
                  opacity: enter,
                  transform: `scale(${0.85 + enter * 0.15})`,
                }}
              >
                <div style={{fontSize: 66}}>{s.icon}</div>
                <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.harness}}>
                  {s.name}
                </div>
                <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 23, color: theme.dim, lineHeight: 1.5}}>
                  {s.desc}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <FadeUp delay={44} style={{marginTop: 56}}>
        <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
          库一大，找不到就是大问题 —— 好技能藏在角落，等于没有
        </div>
        <div style={{marginTop: 10, fontFamily: theme.mono, fontSize: 24, color: theme.dim, textAlign: 'center'}}>
          SkillsWild / SkillRouter：大规模检索缺口
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 2-D+2-E：验证门 + 负迁移数字面板 */
const ValidationGate: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enterPanel = spring({frame: frame - 20, fps, config: {damping: 200}});
  const passGate = interpolate(frame, [8, 20], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 80, alignItems: 'center'}}>
        {/* 闸机 */}
        <div style={{position: 'relative', width: 420, height: 420}}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: 60 + i * 110,
                left: 40,
                width: 90,
                height: 64,
                borderRadius: 10,
                background: i === 2 ? theme.danger : theme.ok,
                opacity: 0.85,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: 30,
                transform: `translateX(${passGate * (i === 2 ? -40 : 300)}px)`,
                transition: 'none',
              }}
            >
              {i === 2 ? '✗' : '✓'}
            </div>
          ))}
          {/* 闸门本体 */}
          <div
            style={{
              position: 'absolute',
              top: 20,
              right: 90,
              width: 120,
              height: 380,
              borderRadius: 14,
              background: theme.panel,
              border: `3px solid ${frame % 30 < 15 ? theme.ok : theme.dim}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div style={{fontSize: 46}}>🛡️</div>
            <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.ok, fontWeight: 700, writingMode: 'vertical-rl'}}>
              验证
            </div>
          </div>
          <FadeUp delay={26} style={{position: 'absolute', bottom: -10, right: 60}}>
            <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.dim}}>及格才准入库</div>
          </FadeUp>
        </div>
        {/* 数字面板 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            opacity: enterPanel,
            transform: `translateX(${(1 - enterPanel) * 60}px)`,
          }}
        >
          <div style={{padding: '26px 40px', borderRadius: 18, background: theme.panel, border: `3px solid ${theme.ok}`}}>
            <div style={{fontFamily: theme.sans, fontSize: 56, fontWeight: 900, color: theme.ok}}>+16.2 分</div>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>86 任务 · 11 领域平均提升</div>
          </div>
          <div style={{padding: '26px 40px', borderRadius: 18, background: theme.panel, border: `3px solid ${theme.danger}`}}>
            <div style={{fontFamily: theme.sans, fontSize: 56, fontWeight: 900, color: theme.danger}}>16 / 84</div>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>任务反而变差 —— 负迁移</div>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>SkillsBench</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 2-F：记忆五动作 */
const MemoryOps: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ops = [
    {name: '记', icon: '✍️', en: 'Write'},
    {name: '压', icon: '🗜️', en: 'Compress'},
    {name: '并', icon: '🔗', en: 'Consolidate'},
    {name: '取', icon: '🔎', en: 'Retrieve'},
    {name: '改', icon: '🧽', en: 'Update'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: 700,
          height: 440,
          borderRadius: 24,
          background: theme.panel,
          border: `3px solid ${theme.harness}`,
          padding: 40,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 26,
          alignContent: 'center',
        }}
      >
        {ops.map((o, i) => {
          const enter = spring({frame: frame - i * 9, fps, config: {damping: 200}});
          const stampDown = interpolate(frame - i * 9, [0, 6], [1.6, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={o.name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                opacity: enter,
                transform: `scale(${enter > 0.5 ? stampDown : 0.5})`,
              }}
            >
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 18,
                  border: `3px solid ${theme.harness}`,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: 52,
                  background: '#10141c',
                }}
              >
                {o.icon}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 900, color: theme.harness}}>{o.name}</div>
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{o.en}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** 2-G：记忆三层自进化 + 两大坑 */
const MemoryLayers: React.FC = () => {
  const frame = useCurrentFrame();
  const layers = ['内容', '机制', '策略'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 90, alignItems: 'center'}}>
        <div style={{position: 'relative', width: 480, height: 420}}>
          {layers.map((l, i) => {
            const size = 420 - i * 120;
            const enter = interpolate(frame, [i * 14, i * 14 + 16], [0, 1], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            });
            return (
              <div
                key={l}
                style={{
                  position: 'absolute',
                  left: (480 - size) / 2,
                  top: (420 - size) / 2,
                  width: size,
                  height: size,
                  borderRadius: 24,
                  border: `${3 - i * 0.5}px solid ${i === 2 ? theme.exp : theme.harness}`,
                  opacity: enter,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: i === 0 ? 'center' : 'flex-start',
                  paddingTop: i === 0 ? 0 : 18,
                }}
              >
                <span
                  style={{
                    fontFamily: theme.sans,
                    fontSize: 24,
                    color: i === 2 ? theme.exp : theme.harness,
                    background: theme.bg,
                    padding: '2px 12px',
                  }}
                >
                  {l}变好
                </span>
              </div>
            );
          })}
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 26}}>
          <FadeUp delay={30}>
            <Pill color={theme.danger}>记太多 → 翻不动</Pill>
          </FadeUp>
          <FadeUp delay={38}>
            <Pill color={theme.danger}>记太少 → 没料用</Pill>
          </FadeUp>
          <FadeUp delay={46}>
            <Pill color={theme.danger}>陈旧记忆 → 悄悄带偏判断</Pill>
          </FadeUp>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 2-H：环境三层楼 + 天花板 */
const EnvFloors: React.FC = () => {
  const frame = useCurrentFrame();
  const floors = [
    {name: '可执行', icon: '⌨️', desc: '软件让 AI 真能操作'},
    {name: '协议化', icon: '🔌', desc: '接口统一 · 经验能搬家'},
    {name: '可学习', icon: '📡', desc: '反馈能当训练信号'},
  ];
  const ceil = interpolate(frame, [50, 70], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 60, alignItems: 'flex-end'}}>
        <div style={{position: 'relative', display: 'flex', flexDirection: 'column', gap: 18}}>
          {floors.map((f, i) => {
            const enter = interpolate(frame, [i * 16, i * 16 + 16], [0, 1], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            });
            return (
              <div
                key={f.name}
                style={{
                  width: 620 - i * 40,
                  padding: '24px 34px',
                  borderRadius: 16,
                  background: theme.panel,
                  border: `3px solid ${i === 2 ? theme.exp : theme.harness}`,
                  display: 'flex',
                  gap: 22,
                  alignItems: 'center',
                  opacity: enter,
                  transform: `translateY(${(1 - enter) * 30}px)`,
                }}
              >
                <span style={{fontSize: 50}}>{f.icon}</span>
                <div>
                  <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: i === 2 ? theme.exp : theme.harness}}>
                    {i + 1} 楼 · {f.name}
                  </div>
                  <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>{f.desc}</div>
                </div>
              </div>
            );
          })}
          {/* 天花板虚线 */}
          <div
            style={{
              position: 'absolute',
              top: -34,
              left: 0,
              width: 620,
              borderTop: `4px dashed ${theme.exp}`,
              opacity: ceil,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: -72,
              left: 380,
              fontFamily: theme.mono,
              fontSize: 26,
              color: theme.exp,
              opacity: ceil,
            }}
          >
            J*(E) 适应上限
          </div>
        </div>
      </div>
      <FadeUp delay={60} style={{marginTop: 44}}>
        <div style={{fontFamily: theme.sans, fontSize: 27, color: theme.dim}}>
          就算能跑、接口也通了，反馈却稀得没法学（§5.4）
        </div>
      </FadeUp>
      {/* 三条天花板轴（Fig 6）：p2-32 时标尺扫入，p2-32a 三条依次生长且都停在天花板前 */}
      <div style={{marginTop: 34, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center'}}>
        {[
          {label: '能动的花样', fill: 0.86},
          {label: '反馈的密度', fill: 0.42},
          {label: '任务的长度', fill: 0.64},
        ].map((axis, i) => {
          const e = interpolate(frame, [86 + i * 10, 106 + i * 10], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          return (
            <div key={axis.label} style={{display: 'flex', alignItems: 'center', gap: 16}}>
              <span style={{width: 130, textAlign: 'right', fontFamily: theme.sans, fontSize: 21, color: theme.text}}>
                {axis.label}
              </span>
              <div
                style={{
                  width: 460,
                  height: 20,
                  borderRadius: 10,
                  background: theme.panel,
                  border: `1.5px solid ${theme.panelBorder}`,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${axis.fill * e * 100}%`,
                    height: '100%',
                    background: theme.exp,
                    opacity: 0.82,
                  }}
                />
              </div>
            </div>
          );
        })}
        <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, opacity: interpolate(frame, [118, 132], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
          action diversity · feedback density · task horizon（Fig 6）
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 2-I：参数巩固——验证过的套路蒸馏进大脑 */
const Consolidate: React.FC = () => {
  const frame = useCurrentFrame();
  const settle = interpolate(frame, [30, 90], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 70, alignItems: 'center'}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          {[0, 1, 2, 3].map((i) => {
            const enter = interpolate(frame, [i * 6, i * 6 + 10], [0, 1], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            });
            return (
              <div
                key={i}
                style={{
                  width: 300,
                  padding: '16px 24px',
                  borderRadius: 14,
                  background: theme.panel,
                  border: `2px solid ${theme.ok}`,
                  display: 'flex',
                  gap: 14,
                  alignItems: 'center',
                  opacity: enter * (1 - settle * 0.9),
                  transform: `translateY(${-settle * 160}px)`,
                }}
              >
                <span style={{fontSize: 32, color: theme.ok}}>✓</span>
                <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.text}}>验证过的套路 #{i + 1}</span>
              </div>
            );
          })}
        </div>
        {/* 蒸馏漏斗 */}
        <div
          style={{
            width: 200,
            height: 190,
            background: `linear-gradient(180deg, ${theme.panel}, ${theme.paramsDeep})`,
            clipPath: 'polygon(0 0, 100% 0, 58% 100%, 42% 100%)',
            opacity: 0.9,
          }}
        />
        {/* 大脑 */}
        <div style={{textAlign: 'center', opacity: settle > 0.3 ? 1 : 0.3}}>
          <div
            style={{
              width: 260,
              height: 260,
              borderRadius: 60,
              background: `linear-gradient(135deg, ${theme.paramsDeep}, ${theme.panel})`,
              border: `4px solid ${theme.params}`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: 110,
              boxShadow: settle > 0.6 ? `0 0 90px ${theme.params}66` : 'none',
            }}
          >
            🧠
          </div>
          <div style={{marginTop: 16, fontFamily: theme.sans, fontSize: 26, color: theme.params}}>
            变成肌肉记忆 · 跨任务跨用户
          </div>
          <div style={{marginTop: 10, fontFamily: theme.mono, fontSize: 24, color: theme.params}}>θ⁺ = Φ_M(θ, Z)</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 2-J：工业现实——一边是真实循环，一边泼冷水 */
const IndustryReality: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 80, opacity: enter}}>
        <div
          style={{
            width: 620,
            padding: 40,
            borderRadius: 22,
            background: theme.panel,
            border: `3px solid ${theme.params}`,
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
            <span style={{fontSize: 54}}>💻</span>
            <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>编程工具厂商</span>
          </div>
          <div style={{marginTop: 26, display: 'flex', alignItems: 'center', gap: 14}}>
            {[0, 1, 2, 4, 6, 8].map((d) => (
              <div
                key={d}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  background: theme.ok,
                  opacity: (frame + d * 9) % 30 < 15 ? 1 : 0.25,
                }}
              />
            ))}
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.ok, marginLeft: 10}}>用户反馈流</span>
          </div>
          <div style={{marginTop: 22, fontFamily: theme.sans, fontSize: 26, color: theme.dim, lineHeight: 1.6}}>
            生产环境反馈 → 聚合成奖励信号
            <br />→ 频繁更新模型权重
          </div>
          <div style={{marginTop: 14, fontFamily: theme.mono, fontSize: 21, color: theme.dim}}>
            Cursor 实时 RL（Jackson et al., 2026）
          </div>
        </div>
        <div
          style={{
            width: 480,
            padding: 40,
            borderRadius: 22,
            background: '#101419',
            border: `2px solid ${theme.panelBorder}`,
          }}
        >
          <div style={{fontSize: 60}}>🧊</div>
          <div style={{marginTop: 18, fontFamily: theme.sans, fontSize: 28, color: theme.dim, lineHeight: 1.7}}>
            但论文泼了盆冷水：
            <br />
            部署后从 trace 训练模型，
            <br />
            公开证据还非常稀少。
          </div>
          <div style={{marginTop: 16, fontFamily: theme.sans, fontSize: 24, color: theme.danger}}>
            大部分自进化停在前三个去处
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 2-J：晋升闸门（v3 新增）——§10.2 "With no promotion criterion, the decision of
 *  what to write to the weights rests on manual judgment." 的画面化：
 *  左半青色 = 工位侧快路（钥匙只对上五把锁中的一把）；右半紫色 = 大脑侧慢路
 *  （能力随身带走）；中间闸门的判准铭牌是**空白**（红问号脉冲），按下按钮后
 *  紫侧点亮、闸下画出单向红箭头「很难逆转」。 */
const PromotionGate: React.FC = () => {
  const frame = useCurrentFrame();
  const plateIn = interpolate(frame, [4, 18], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.14);
  const press = interpolate(frame, [66, 74], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const oneWay = interpolate(frame, [78, 96], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'stretch', gap: 0}}>
        {/* 左：工位侧（青）——改 harness 像换触发条件 */}
        <div style={{width: 430, padding: '30px 28px', background: theme.panel, borderRadius: '16px 0 0 16px', border: `2px solid ${theme.harness}55`}}>
          <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.harness}}>工位 · 快 / 可逆</div>
          <div style={{marginTop: 22, display: 'flex', gap: 10, justifyContent: 'center'}}>
            {[1, 0, 0, 0, 0].map((on, i) => (
              <div key={i} style={{width: 38, height: 50, borderRadius: 7, background: on ? theme.harness : theme.panel, border: `1.5px solid ${on ? theme.harness : theme.panelBorder}`, opacity: on ? 1 : 0.55}} />
            ))}
          </div>
          <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 20, color: theme.dim, textAlign: 'center'}}>
            换个条件就能生效
          </div>
        </div>
        {/* 中：闸门——判准铭牌空白 */}
        <div style={{width: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#10141d', borderTop: `2px solid ${theme.panelBorder}`, borderBottom: `2px solid ${theme.panelBorder}`}}>
          <div
            style={{
              width: 190,
              height: 84,
              borderRadius: 10,
              background: '#0c0f16',
              border: `2px dashed ${theme.danger}88`,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: plateIn,
            }}
          >
            <span style={{fontSize: 40, color: theme.danger, opacity: 0.35 + 0.65 * pulse}}>?</span>
          </div>
          <div style={{marginTop: 10, fontFamily: theme.mono, fontSize: 15, color: theme.danger, opacity: plateIn}}>
            promotion criterion: absent（§10.2）
          </div>
          {/* 按钮 */}
          <div
            style={{
              marginTop: 16,
              width: 54,
              height: 54,
              borderRadius: 27,
              background: press > 0 ? theme.danger : '#2a1418',
              border: `2px solid ${theme.danger}`,
              transform: `scale(${1 - 0.18 * press})`,
              boxShadow: press > 0 ? `0 0 26px ${theme.danger}66` : 'none',
            }}
          />
        </div>
        {/* 右：大脑侧（紫）——能力随身带走 */}
        <div style={{width: 430, padding: '30px 28px', background: theme.panel, borderRadius: '0 16px 16px 0', border: `2px solid ${press > 0 ? theme.params : theme.panelBorder}`}}>
          <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.params, opacity: 0.55 + 0.45 * press}}>大脑 · 慢 / 持久</div>
          <div style={{marginTop: 20, display: 'flex', justifyContent: 'center'}}>
            <div
              style={{
                width: 92,
                height: 92,
                borderRadius: 46,
                background: `radial-gradient(circle, ${theme.params}44 0%, transparent 70%)`,
                border: `2.5px solid ${theme.params}`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: 44,
                opacity: 0.45 + 0.55 * press,
              }}
            >
              🧠
            </div>
          </div>
          <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 20, color: theme.dim, textAlign: 'center', opacity: 0.6 + 0.4 * press}}>
            写进去，跨任务都带得走
          </div>
        </div>
      </div>
      {/* 单向箭头：很难逆转 */}
      <svg width={620} height={54} style={{marginTop: 24}}>
        <line x1={30} y1={20} x2={30 + 540 * oneWay} y2={20} stroke={theme.danger} strokeWidth={4} strokeLinecap="round" />
        {oneWay > 0.96 ? (
          <polygon points={`${30 + 540},${20} ${30 + 516},${8} ${30 + 516},${32}`} fill={theme.danger} />
        ) : null}
        <text x={30} y={46} fill={theme.danger} fontSize={19} fontFamily={theme.sans} opacity={oneWay}>
          很难逆转
        </text>
      </svg>
    </AbsoluteFill>
  );
};

export const P2FourDestinations: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p2-01', 'p2-02')} name="2-A 四管道总图">
        <FourDestinationsPreview />
      </Sequence>
      <Sequence {...w('p2-03', 'p2-06')} name="2-B 技能抽屉">
        <SkillDrawer />
      </Sequence>
      <Sequence {...w('p2-07', 'p2-12')} name="2-C 生命周期">
        <LifecycleRing />
      </Sequence>
      <Sequence {...w('p2-13', 'p2-18')} name="2-D 验证门">
        <ValidationGate />
      </Sequence>
      <Sequence {...w('p2-19', 'p2-26')} name="2-E 记忆五动作">
        <MemoryOps />
      </Sequence>
      <Sequence {...w('p2-27', 'p2-30')} name="2-F 记忆三层">
        <MemoryLayers />
      </Sequence>
      <Sequence {...w('p2-31', 'p2-37')} name="2-G 环境三层楼">
        <EnvFloors />
      </Sequence>
      <Sequence {...w('p2-38', 'p2-41')} name="2-H 参数巩固">
        <Consolidate />
      </Sequence>
      <Sequence {...w('p2-42', 'p2-47')} name="2-I 工业现实">
        <IndustryReality />
      </Sequence>
    </AbsoluteFill>
  );
};
