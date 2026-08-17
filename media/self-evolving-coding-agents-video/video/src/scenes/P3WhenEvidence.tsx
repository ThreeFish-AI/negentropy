import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {FadeUp, Pill} from '../components/cards';

/** 3-A 章头：两把尺子 */
const TwoRulers: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const e = spring({frame, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: e}}>
        <Pill color={theme.evo}>第三问 · 何时 × 凭什么</Pill>
        <div style={{marginTop: 34, display: 'flex', gap: 70, justifyContent: 'center'}}>
          {[
            {label: '时间尺', marks: ['干活时', '下班后', '攒批换代'], color: theme.evo},
            {label: '证据尺', marks: ['结果', '环境反馈', '轨迹'], color: theme.code},
          ].map((r) => (
            <div key={r.label} style={{textAlign: 'center'}}>
              <div style={{width: 460, height: 26, borderRadius: 13, background: r.color, opacity: 0.85}} />
              <div style={{marginTop: 20, display: 'flex', justifyContent: 'space-between', fontFamily: theme.sans, fontSize: 26, color: theme.dim, padding: '0 20px'}}>
                {r.marks.map((m) => (
                  <span key={m} style={{borderTop: `3px solid ${r.color}`, paddingTop: 10}}>
                    {m}
                  </span>
                ))}
              </div>
              <div style={{marginTop: 26, fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.text}}>
                {r.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 3-B 时间三态：秒表 / 日记本 / 进化树
 *  stage 按句 id 边界驱动（p3-03/06/09 各段起始帧），与口播同步且不随帧溢出 */
const ThreeClocks: React.FC<{stages: number[]}> = ({stages}) => {
  const frame = useCurrentFrame();
  const stage = frame >= stages[2] ? 2 : frame >= stages[1] ? 1 : 0;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 70}}>
        {[
          {
            icon: '⏱️',
            title: '干活时',
            sub: '测试一挂当场改',
            detail: '改补丁 · 换工具 · 重组流程',
            live: '现场造工具的就是这类',
            color: theme.evo,
          },
          {
            icon: '📔',
            title: '下班后',
            sub: '复盘成经验技能',
            detail: '工单进教科书，不进废纸篓',
            live: '为什么成 · 为什么砸',
            color: theme.text,
          },
          {
            icon: '🌳',
            title: '攒批换代',
            sub: '一批轨迹统一训练',
            detail: '升级出新版本',
            live: '当场快 · 复盘久 · 换代深',
            color: theme.code,
          },
        ].map((c, i) => {
          const active = stage === i;
          return (
            <div
              key={c.title}
              style={{
                width: 380,
                padding: '36px 30px',
                borderRadius: 18,
                background: theme.panel,
                border: `3px solid ${active ? c.color : theme.panelBorder}`,
                textAlign: 'center',
                opacity: interpolate(frame, [i * 18, i * 18 + 12], [0.3, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
                transform: active ? 'translateY(-14px)' : 'none',
              }}
            >
              <div style={{fontSize: 76}}>{c.icon}</div>
              <div style={{marginTop: 16, fontFamily: theme.serif, fontSize: 38, fontWeight: 700, color: c.color}}>{c.title}</div>
              <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{c.sub}</div>
              <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 22, color: theme.dim, lineHeight: 1.7 }}>{c.detail}</div>
              {active && (
                <div style={{marginTop: 16, fontFamily: theme.sans, fontSize: 22, color: c.color}}>▶ {c.live}</div>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** 3-C 证据·结果：成绩单（名次有，评语空） */
const ScoreCard: React.FC = () => {
  const frame = useCurrentFrame();
  const rankIn = interpolate(frame, [10, 30], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const fadeOuts = [1, 2].map((i) => interpolate(frame, [70 + i * 14, 84 + i * 14], [1, 0.15], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  return (
    <AbsoluteFill style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 90}}>
      <div
        style={{
          width: 560,
          padding: '40px 46px',
          borderRadius: 16,
          background: '#F5F1E8',
          border: '2px solid #C8BFA8',
          color: '#2b2416',
          opacity: rankIn,
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 30, fontWeight: 700}}>成绩单 · 编码基准</div>
        <div style={{marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span style={{fontFamily: theme.sans, fontSize: 26}}>分数</span>
          <span style={{fontFamily: theme.mono, fontSize: 40, fontWeight: 700, color: '#1d6b3a'}}>↑ 0.53</span>
        </div>
        <div style={{marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span style={{fontFamily: theme.sans, fontSize: 26}}>评语</span>
          <span style={{fontFamily: theme.sans, fontSize: 26, color: '#b0a482'}}>（空白）</span>
        </div>
        <div style={{marginTop: 26, fontFamily: theme.sans, fontSize: 24, color: '#8a7a50'}}>
          只说谁更好，不说为什么
        </div>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
        {['变体 A · 0.17', '变体 B · 0.53', '变体 C · 0.31'].map((v, i) => (
          <div
            key={v}
            style={{
              padding: '18px 30px',
              borderRadius: 10,
              background: theme.panel,
              border: `2px solid ${i === 1 ? theme.ok : theme.panelBorder}`,
              fontFamily: theme.mono,
              fontSize: 26,
              color: i === 1 ? theme.ok : theme.text,
              opacity: i === 1 ? 1 : fadeOuts[i === 0 ? 0 : 1],
            }}
          >
            {v} {i === 1 ? '← 活下来' : ''}
          </div>
        ))}
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, textAlign: 'center'}}>
          选择压：决定谁活下来
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 3-D 证据·环境反馈：仪表盘直播 */
const Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const gauges = [
    {label: '编译器', value: Math.sin(frame / 9) * 40 + 50, unit: ''},
    {label: '测试日志', value: Math.cos(frame / 7) * 40 + 50, unit: ''},
    {label: '命令输出', value: Math.sin(frame / 11 + 2) * 40 + 50, unit: ''},
  ];
  const state = Math.floor(frame / 26) % 3;
  const states = [
    {label: '顺', color: theme.ok, icon: '🟢'},
    {label: '堵', color: '#F5C542', icon: '🟡'},
    {label: '崩', color: theme.danger, icon: '🔴'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 50}}>
        {gauges.map((g) => (
          <div key={g.label} style={{width: 300, textAlign: 'center'}}>
            <div style={{height: 26, borderRadius: 13, background: theme.panelBorder, overflow: 'hidden'}}>
              <div
                style={{
                  height: '100%',
                  width: `${g.value}%`,
                  background: `linear-gradient(90deg, ${theme.ok}, ${theme.code})`,
                }}
              />
            </div>
            <div style={{marginTop: 14, fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>{g.label}</div>
          </div>
        ))}
      </div>
      <FadeUp delay={30}>
        <div style={{marginTop: 70, display: 'flex', alignItems: 'center', gap: 20}}>
          <span style={{fontSize: 50}}>{states[state].icon}</span>
          <span style={{fontFamily: theme.sans, fontSize: 34, color: states[state].color, fontWeight: 700}}>
            此刻策略：{states[state].label}
          </span>
        </div>
        <div style={{marginTop: 20, fontFamily: theme.sans, fontSize: 26, color: theme.dim, textAlign: 'center'}}>
          不判整场胜负，直播中间状态
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 3-E 证据·轨迹：录像带→招式卡 */
const TapeToCards: React.FC = () => {
  const frame = useCurrentFrame();
  const cutAt = 40 + Math.floor((frame - 40) / 14) * 14;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 60}}>
        {/* 录像带 */}
        <div style={{width: 560, height: 300, borderRadius: 16, background: theme.panel, border: `2px solid ${theme.panelBorder}`, position: 'relative', overflow: 'hidden'}}>
          <div style={{position: 'absolute', top: 24, left: 28, fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>
            完整轨迹 · 录像带
          </div>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: 80 + i * 34,
                left: 28,
                width: `${80 - i * 7}%`,
                height: 18,
                borderRadius: 9,
                background: i % 2 ? `${theme.danger}66` : `${theme.ok}55`,
              }}
            />
          ))}
        </div>
        <div style={{fontSize: 54, color: theme.code}}>✂️→</div>
        {/* 招式卡 */}
        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          {[
            {t: '绕开依赖冲突的 3 步', ok: true},
            {t: '遇到超时先查 N+1 查询', ok: true},
            {t: '别改 generated 文件', ok: false},
          ].map((c, i) => (
            <div
              key={c.t}
              style={{
                padding: '16px 26px',
                borderRadius: 10,
                background: theme.panel,
                border: `2px solid ${c.ok ? theme.ok : theme.danger}`,
                fontFamily: theme.sans,
                fontSize: 25,
                color: theme.text,
                opacity: frame > cutAt + i * 10 ? 1 : 0,
                transform: `translateX(${frame > cutAt + i * 10 ? 0 : -40}px)`,
              }}
            >
              {c.ok ? '✓' : '✗'} {c.t}
            </div>
          ))}
        </div>
      </div>
      <FadeUp delay={120}>
        <div style={{marginTop: 50, fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
          价值最高，但必须剪辑提炼成「招式」
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 3-F 3×3 矩阵 */
const Matrix3x3: React.FC = () => {
  const frame = useCurrentFrame();
  const lit = Math.floor(frame / 7);
  const times = ['干活时', '下班后', '攒批换代'];
  const evidences = ['结果', '环境反馈', '轨迹'];
  const glowIn = interpolate(frame, [190, 220], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative'}}>
        <div style={{display: 'grid', gridTemplateColumns: '180px repeat(3, 250px)', gridTemplateRows: '70px repeat(3, 170px)', gap: 10}}>
          <div />
          {evidences.map((ev, j) => (
            <div key={ev} style={{display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.sans, fontSize: 28, color: theme.code, fontWeight: 700}}>
              {ev}
            </div>
          ))}
          {times.map((t, i) => (
            <React.Fragment key={t}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 18, fontFamily: theme.sans, fontSize: 28, color: theme.evo, fontWeight: 700}}>
                {t}
              </div>
              {evidences.map((_, j) => {
                const idx = i * 3 + j;
                const on = lit > idx;
                return (
                  <div
                    key={j}
                    style={{
                      borderRadius: 12,
                      background: on ? `${theme.codeDeep}` : theme.panel,
                      border: `2px solid ${on ? theme.code : theme.panelBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: theme.mono,
                      fontSize: 22,
                      color: on ? theme.dim : '#3a4252',
                    }}
                  >
                    {on ? '●' : ''}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            inset: -14,
            borderRadius: 22,
            border: `3px solid ${theme.code}`,
            boxShadow: `0 0 60px ${theme.codeDeep}`,
            opacity: glowIn,
            pointerEvents: 'none',
          }}
        />
      </div>
      <FadeUp delay={210}>
        <div style={{marginTop: 46, fontFamily: theme.sans, fontSize: 30, color: theme.text, textAlign: 'center'}}>
          改流程的当场改 · 改模型的攒批 · 攒记忆的靠复盘
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 3-G 幕尾钩：谁说了算 */
const WhoDecides: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame, fps, config: {damping: 130}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{transform: `scale(${0.7 + pop * 0.3})`, opacity: pop, textAlign: 'center'}}>
        <div style={{fontFamily: theme.serif, fontSize: 84, fontWeight: 700, color: theme.text}}>谁说了算？</div>
        <div style={{marginTop: 24, fontFamily: theme.sans, fontSize: 30, color: theme.dim}}>下一幕：考场</div>
      </div>
    </AbsoluteFill>
  );
};

export const P3WhenEvidence: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p3-01', 'p3-02')} name="3-A 两把尺子">
        <TwoRulers />
      </Sequence>
      <Sequence {...w('p3-03', 'p3-11')} name="3-B 时间三态">
        <ThreeClocks
          stages={['p3-03', 'p3-06', 'p3-09'].map((id) => beatWindow(scene.sentences, scene.from, id).from - w('p3-03', 'p3-11').from)}
        />
      </Sequence>
      <Sequence {...w('p3-12', 'p3-16')} name="3-C 结果证据">
        <ScoreCard />
      </Sequence>
      <Sequence {...w('p3-17', 'p3-19')} name="3-D 环境反馈">
        <Dashboard />
      </Sequence>
      <Sequence {...w('p3-20', 'p3-22')} name="3-E 轨迹证据">
        <TapeToCards />
      </Sequence>
      <Sequence {...w('p3-23', 'p3-27')} name="3-F 3×3矩阵">
        <Matrix3x3 />
      </Sequence>
      <Sequence {...w('p3-28')} name="3-G 幕尾钩">
        <WhoDecides />
      </Sequence>
    </AbsoluteFill>
  );
};
