import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {FadeUp, Pill} from '../components/cards';

/** 三圈韦恩图（1-B/1-C/1-D 共用底图，随 beat 分步点亮） */
const VennStage: React.FC<{step: 0 | 1 | 2 | 3}> = ({step}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const leftIn = spring({frame, fps, config: {damping: 200}});
  const rightIn = spring({frame: frame - 20, fps, config: {damping: 200}});
  // step≥2：左右圈先各让出 120px 并排亮相；step 3：再向中间靠拢（圆心距 740→340），
  // 交集透镜宽 ~280px，足以容纳徽章——「交集」在几何上真正成立。
  const sep = step === 2 ? spring({frame, fps, config: {damping: 200}}) : step >= 3 ? 1 : 0;
  const join = step >= 3 ? spring({frame: frame - 10, fps, config: {damping: 200}}) : 0;
  const leftShift = -sep * 120 + join * 200;
  const rightShift = sep * 120 - join * 200;
  const litLeft = step >= 1;
  const litRight = step >= 2;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1280, height: 720}}>
        {/* 左圈：编码智能体 */}
        <div
          style={{
            position: 'absolute',
            left: 80,
            top: 60,
            width: 620,
            height: 620,
            borderRadius: 310,
            border: `4px solid ${litLeft ? theme.code : theme.panelBorder}`,
            opacity: litLeft ? leftIn : 0,
            background: `radial-gradient(circle, ${theme.codeDeep}44, transparent 70%)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 90,
            transform: `translateX(${leftShift}px)`,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 38, fontWeight: 700, color: theme.code}}>编码智能体</div>
          {litLeft && (
            <div
              style={{
                marginTop: 26,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                fontFamily: theme.sans,
                fontSize: 26,
                color: theme.text,
                opacity: 1 - join,
              }}
            >
              <FadeUp delay={20}>📦 读仓库 · 改文件 · 跑测试</FadeUp>
              <FadeUp delay={34}>🧾 干完一单，不留底</FadeUp>
            </div>
          )}
        </div>
        {/* 右圈：自进化智能体 */}
        <div
          style={{
            position: 'absolute',
            right: 80,
            top: 60,
            width: 620,
            height: 620,
            borderRadius: 310,
            border: `4px solid ${litRight ? theme.evo : theme.panelBorder}`,
            opacity: litRight ? rightIn : 0,
            background: `radial-gradient(circle, ${theme.evoDeep}44, transparent 70%)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 90,
            transform: `translateX(${rightShift}px)`,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 38, fontWeight: 700, color: theme.evo}}>自进化智能体</div>
          {litRight && (
            <div
              style={{
                marginTop: 26,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                fontFamily: theme.sans,
                fontSize: 26,
                color: theme.text,
                opacity: 1 - join,
              }}
            >
              <FadeUp delay={20}>📝 干砸会写复盘笔记</FadeUp>
              <FadeUp delay={34}>🎮 游戏 · 决策 · 工具使用</FadeUp>
            </div>
          )}
        </div>
        {/* 交集高亮：两圈 join 后落在真实重叠区（圆心 640，圆心距 340 → 透镜宽 620-340=280） */}
        {step >= 3 && (
          <div
            style={{
              position: 'absolute',
              left: 640 - 140,
              top: 370 - 140,
              width: 280,
              height: 280,
              borderRadius: 140,
              background: `${theme.code}22`,
              border: `4px solid ${theme.text}`,
              boxShadow: `0 0 70px ${theme.code}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 8,
              textAlign: 'center',
              opacity: join,
              transform: `scale(${0.8 + join * 0.2})`,
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.text}}>自进化</div>
            <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.text}}>编码智能体</div>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>Table 1</div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** 1-E 天然试验田 */
const NaturalLab: React.FC = () => {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [0, 40], [220, 0], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1100, height: 640}}>
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            width: 1100,
            height: 320,
            borderRadius: '50% 50% 24px 24px / 40% 40% 24px 24px',
            background: `linear-gradient(to bottom, #2b2416, #171208)`,
            border: `3px solid #4a3a10`,
            transform: `translateY(${rise * 0.3}px)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 58, fontWeight: 700, color: theme.code}}>天然试验田</div>
        </div>
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 26,
            color: theme.dim,
            opacity: interpolate(frame, [30, 55], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
          }}
        >
          “a natural domain for agent self-evolution”
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 1-F 三大养料：可执行反馈（六仪表盘）/ 仓库上下文 / 编码轨迹
 *  phase 按句 id 边界驱动（p1-17 起=上下文、p1-19 起=轨迹），与口播同步；
 *  对比句对齐 p1-21 起始帧淡入。 */
const ThreeNutrients: React.FC<{
  ctxFrom: number; // p1-17 相对本 beat 的起始帧
  trajFrom: number; // p1-19 相对本 beat 的起始帧
  compFrom: number; // p1-21 相对本 beat 的起始帧
}> = ({ctxFrom, trajFrom, compFrom}) => {
  const frame = useCurrentFrame();
  const gauges = [
    {label: '单元测试', icon: '✓'},
    {label: '编译器', icon: '⚙'},
    {label: '运行日志', icon: '📜'},
    {label: '静态检查', icon: '🔍'},
    {label: '持续集成', icon: '🔁'},
    {label: '代码评审', icon: '👤'},
  ];
  const phase = frame >= trajFrom ? 2 : frame >= ctxFrom ? 1 : 0;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 44}}>
        {/* 管道顶：三养料标签 */}
        <div style={{display: 'flex', gap: 60}}>
          {['可执行反馈', '仓库级上下文', '编码轨迹'].map((n, i) => (
            <div
              key={n}
              style={{
                fontFamily: theme.sans,
                fontSize: 30,
                fontWeight: 700,
                color: phase === i ? theme.code : theme.dim,
                borderBottom: `3px solid ${phase === i ? theme.code : 'transparent'}`,
                paddingBottom: 8,
                transition: 'none',
              }}
            >
              {n}
            </div>
          ))}
        </div>
        {/* 养料输出区 */}
        <div style={{width: 1500, height: 420, position: 'relative'}}>
          {/* 六仪表盘（phase 起点 = 0） */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 300px)',
              gap: 24,
              justifyContent: 'center',
              opacity: interpolate(frame, [0, 8], [1, 1], {extrapolateRight: 'clamp'}) * (phase === 0 ? 1 : 0.12),
            }}
          >
            {gauges.map((g, i) => (
              <div
                key={g.label}
                style={{
                  background: theme.panel,
                  border: `2px solid ${theme.panelBorder}`,
                  borderRadius: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  padding: '0 26px',
                  fontFamily: theme.sans,
                  fontSize: 28,
                  color: theme.text,
                  opacity: interpolate(frame, [i * 7, i * 7 + 6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
                }}
              >
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 26,
                    color: interpolate(frame, [i * 7, i * 7 + 6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) > 0.5 ? theme.ok : theme.danger,
                    border: `2px solid currentColor`,
                  }}
                >
                  {g.icon}
                </span>
                {g.label}
              </div>
            ))}
          </div>
          {/* 仓库档案柜（phase 起点 = ctxFrom，入场随句重放） */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              gap: 28,
              justifyContent: 'center',
              opacity: phase === 1 ? interpolate(frame, [ctxFrom, ctxFrom + 10], [0.12, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0.12,
            }}
          >
            {['提交历史', '模块结构', '项目惯例'].map((d, i) => {
              const f = frame - ctxFrom;
              return (
                <div
                  key={d}
                  style={{
                    width: 340,
                    background: theme.panel,
                    border: `2px solid ${theme.panelBorder}`,
                    borderRadius: 14,
                    padding: 28,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>{d}</div>
                  {[0, 1, 2, 3].map((r) => (
                    <div
                      key={r}
                      style={{
                        height: 12,
                        borderRadius: 6,
                        background: theme.panelBorder,
                        width: `${100 - r * 18 - i * 4}%`,
                        opacity: interpolate(f, [i * 6 + r * 5, i * 6 + r * 5 + 8], [0, 0.9], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
                      }}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          {/* 编码轨迹胶片（phase 起点 = trajFrom） */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: phase === 2 ? interpolate(frame, [trajFrom, trajFrom + 10], [0.12, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0.12,
            }}
          >
            <div style={{display: 'flex', gap: 14, alignItems: 'center'}}>
              {['✓ 成功', '✗ 失败', '✓ 成功', '✗ 失败', '✓ 成功'].map((s, i) => {
                const f = frame - trajFrom;
                return (
                  <div
                    key={i}
                    style={{
                      width: 190,
                      height: 120,
                      borderRadius: 10,
                      border: `2px solid ${s.startsWith('✓') ? theme.ok : theme.danger}`,
                      background: theme.panel,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: theme.sans,
                      fontSize: 26,
                      color: s.startsWith('✓') ? theme.ok : theme.danger,
                      opacity: interpolate(f, [i * 6, i * 6 + 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
                    }}
                  >
                    {s}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {/* 对比句（对齐 p1-21「别的领域…」起始帧） */}
        <FadeUp delay={compFrom}>
          <div style={{display: 'flex', gap: 40, fontFamily: theme.sans, fontSize: 30}}>
            <span style={{color: theme.dim}}>别的领域：反馈看不见摸不着</span>
            <span style={{color: theme.code, fontWeight: 700}}>写代码：测试跑一遍，骗不了人</span>
          </div>
        </FadeUp>
      </div>
    </AbsoluteFill>
  );
};

/** 1-G 转场问号 */
const TransitionQuestion: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame, fps, config: {damping: 120}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{transform: `scale(${0.6 + pop * 0.4})`, opacity: pop, textAlign: 'center'}}>
        <div style={{fontFamily: theme.serif, fontSize: 72, fontWeight: 700, color: theme.text}}>进化自己的什么？</div>
        <div style={{marginTop: 30, display: 'flex', gap: 16, justifyContent: 'center'}}>
          {['① 框架', '② 记忆', '③ 技能', '④ 模型', '⑤ 工作流'].map((t, i) => (
            <div
              key={t}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                background: theme.panel,
                border: `2px solid ${theme.panelBorder}`,
                fontFamily: theme.sans,
                fontSize: 26,
                color: theme.dim,
                opacity: interpolate(frame, [20 + i * 8, 34 + i * 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const P1Boundary: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // 1-F beat 内的句边界（相对帧）：养料三段与对比句随口播切换
  const beat = w('p1-14', 'p1-22');
  const rel = (id: string) => beatWindow(scene.sentences, scene.from, id).from - beat.from;
  return (
    <AbsoluteFill>
      <Sequence {...w('p1-01')} name="1-A 章头">
        <ChapterHead />
      </Sequence>
      <Sequence {...w('p1-02', 'p1-04')} name="1-B 第一圈">
        <VennStage step={1} />
      </Sequence>
      <Sequence {...w('p1-05', 'p1-08')} name="1-C 第二圈">
        <VennStage step={2} />
      </Sequence>
      <Sequence {...w('p1-09', 'p1-11')} name="1-D 交集">
        <VennStage step={3} />
      </Sequence>
      <Sequence {...w('p1-12', 'p1-13')} name="1-E 天然试验田">
        <NaturalLab />
      </Sequence>
      <Sequence {...beat} name="1-F 三大养料">
        <ThreeNutrients ctxFrom={rel('p1-17')} trajFrom={rel('p1-19')} compFrom={rel('p1-21')} />
      </Sequence>
      <Sequence {...w('p1-23')} name="1-G 转场问号">
        <TransitionQuestion />
      </Sequence>
    </AbsoluteFill>
  );
};

const ChapterHead: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: enter, transform: `translateX(${(1 - enter) * -80}px)`}}>
        <Pill color={theme.code}>第一问 · 概念边界</Pill>
        <div style={{marginTop: 30, fontFamily: theme.serif, fontSize: 80, fontWeight: 700, color: theme.text}}>三个圈</div>
      </div>
    </AbsoluteFill>
  );
};
