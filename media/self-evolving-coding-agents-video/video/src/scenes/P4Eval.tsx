import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {FadeUp, Pill} from '../components/cards';

/** 4-A 考场门 */
const ExamGate: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const open = spring({frame, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <FadeUp>
        <Pill color={theme.code}>第四问 · 怎么知道真的变强了</Pill>
      </FadeUp>
      <FadeUp delay={20}>
        <div style={{marginTop: 40, position: 'relative', width: 640, height: 380}}>
          {/* 门框 */}
          <div style={{position: 'absolute', inset: 0, border: `10px solid ${theme.panelBorder}`, borderRadius: '18px 18px 0 0'}} />
          {/* 双开门 */}
          <div
            style={{
              position: 'absolute',
              left: 10,
              top: 10,
              bottom: 0,
              width: 305,
              background: theme.panel,
              borderRadius: '10px 0 0 0',
              transformOrigin: 'left',
              transform: `perspective(900px) rotateY(${open * 70}deg)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 10,
              top: 10,
              bottom: 0,
              width: 305,
              background: theme.panel,
              borderRadius: '0 10px 0 0',
              transformOrigin: 'right',
              transform: `perspective(900px) rotateY(${-open * 70}deg)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: -74,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: theme.mono,
              fontSize: 46,
              fontWeight: 700,
              color: theme.code,
            }}
          >
            SWE-bench
          </div>
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 4-B 真实考题：issue 卡 + 跑测试按钮 */
const RealIssue: React.FC = () => {
  const frame = useCurrentFrame();
  const pressed = interpolate(frame, [80, 92], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const greens = interpolate(frame, [95, 125], [0, 12], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 60, alignItems: 'center'}}>
        {/* issue 卡 */}
        <div style={{width: 680, background: theme.panel, border: `2px solid ${theme.panelBorder}`, borderRadius: 14, overflow: 'hidden'}}>
          <div style={{display: 'flex', gap: 14, padding: '16px 24px', borderBottom: `2px solid ${theme.panelBorder}`, alignItems: 'center'}}>
            <span style={{fontSize: 28}}>🐞</span>
            <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.evo}}>issue #1234</span>
            <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>真实开源项目</span>
          </div>
          <div style={{padding: '26px 28px', fontFamily: theme.sans, fontSize: 26, color: theme.text, lineHeight: 1.8}}>
            「购物车总额在叠加优惠券后
            <br />
            多算了一次税费」
          </div>
        </div>
        {/* 判卷：不是选择题 */}
        <div style={{display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center'}}>
          <div style={{display: 'flex', gap: 14}}>
            {['A', 'B', 'C', 'D'].map((o) => (
              <div key={o} style={{width: 64, height: 64, borderRadius: 10, border: `2px dashed ${theme.panelBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.mono, fontSize: 26, color: '#3a4252' }}>
                {o}
              </div>
            ))}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>选择题？不存在的。</div>
          <div
            style={{
              marginTop: 6,
              padding: '18px 44px',
              borderRadius: 12,
              background: pressed > 0.5 ? theme.codeDeep : theme.code,
              color: pressed > 0.5 ? theme.code : '#0b1a10',
              fontFamily: theme.sans,
              fontSize: 30,
              fontWeight: 700,
              transform: `scale(${1 - pressed * 0.06})`,
              boxShadow: `0 0 40px ${theme.codeDeep}`,
            }}
          >
            ▶ 跑测试
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(6, 34px)', gap: 8, marginTop: 10}}>
            {Array.from({length: 12}).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 7,
                  border: `2px solid ${i < greens ? theme.ok : theme.panelBorder}`,
                  background: i < greens ? theme.codeDeep : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  color: theme.ok,
                }}
              >
                {i < greens ? '✓' : ''}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', bottom: 160, left: 0, right: 0, textAlign: 'center', fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>
        SWE-bench 家族 · Verified / Pro 更长更严
      </div>
    </AbsoluteFill>
  );
};

/** 4-C 互补定位：门诊快检 vs 临床手术 */
const Complementary: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 80}}>
        <FadeUp>
          <div style={{width: 460, padding: '40px 34px', borderRadius: 16, background: theme.panel, border: `2px solid ${theme.panelBorder}`, textAlign: 'center'}}>
            <div style={{fontSize: 70}}>🩺</div>
            <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.text}}>门诊快检</div>
            <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>单函数小题库</div>
            <div style={{marginTop: 8, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>HumanEval · MBPP</div>
          </div>
        </FadeUp>
        <FadeUp delay={22}>
          <div style={{width: 460, padding: '40px 34px', borderRadius: 16, background: theme.panel, border: `3px solid ${theme.code}`, textAlign: 'center', boxShadow: `0 0 44px ${theme.codeDeep}`}}>
            <div style={{fontSize: 70}}>🏥</div>
            <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.code}}>临床手术</div>
            <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>仓库级大考</div>
            <div style={{marginTop: 8, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>SWE-bench</div>
          </div>
        </FadeUp>
      </div>
      <FadeUp delay={50}>
        <div style={{marginTop: 50, padding: '12px 30px', borderRadius: 999, border: `2px solid ${theme.dim}`, color: theme.dim, fontFamily: theme.sans, fontSize: 26}}>
          互补，不是替代
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 4-D 五个嫌疑人 */
const FiveSuspects: React.FC = () => {
  const frame = useCurrentFrame();
  const suspects = ['记忆', '技能', '工作流', '验证器', '模型'];
  const spin = Math.sin(frame / 18) * 8;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 44, alignItems: 'flex-end'}}>
        {suspects.map((s, i) => (
          <div key={s} style={{textAlign: 'center'}}>
            <div
              style={{
                width: 130,
                height: 170,
                borderRadius: '65px 65px 12px 12px',
                background: `linear-gradient(to bottom, ${theme.panel}, ${theme.bg})`,
                border: `2px solid ${theme.panelBorder}`,
                opacity: interpolate(frame, [i * 10, i * 10 + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
              }}
            />
            <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 25, color: theme.dim}}>{s}</div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 54,
          fontFamily: theme.mono,
          fontSize: 64,
          fontWeight: 700,
          color: theme.code,
          transform: `rotate(${spin}deg)`,
        }}
      >
        ↑ 分数
      </div>
      <FadeUp delay={70}>
        <div style={{marginTop: 20, fontFamily: theme.sans, fontSize: 30, color: theme.text}}>
          分数涨了，但分数<span style={{color: theme.evo, fontWeight: 700}}>不会招供</span>
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 4-E 六维雷达 */
const Radar: React.FC = () => {
  const frame = useCurrentFrame();
  const axes = ['正确性', '成本', 'token', '步数', '迁移', '稳定'];
  const R = 210;
  const cx = 420;
  const cy = 300;
  const values = axes.map((_, i) => interpolate(frame, [i * 12, i * 12 + 20], [0, [0.9, 0.62, 0.7, 0.55, 0.48, 0.6][i]], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const pt = (i: number, r: number) => {
    const a = (-90 + (i / axes.length) * 360) * (Math.PI / 180);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const poly = axes.map((_, i) => pt(i, values[i] * R).join(',')).join(' ');
  return (
    <AbsoluteFill style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 90}}>
      <svg width={840} height={620} viewBox="0 0 840 620">
        {[0.33, 0.66, 1].map((g) => (
          <polygon
            key={g}
            points={axes.map((_, i) => pt(i, R * g).join(',')).join(' ')}
            fill="none"
            stroke={theme.panelBorder}
            strokeWidth={2}
          />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, R);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={theme.panelBorder} strokeWidth={2} />;
        })}
        <polygon points={poly} fill={`${theme.code}33`} stroke={theme.code} strokeWidth={3} />
        {axes.map((a, i) => {
          const [x, y] = pt(i, R + 44);
          return (
            <text key={a} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill={theme.dim} fontSize={26} fontFamily={theme.sans}>
              {a}
            </text>
          );
        })}
      </svg>
      <FadeUp delay={60}>
        <div style={{width: 460, fontFamily: theme.sans, fontSize: 28, color: theme.text, lineHeight: 1.9}}>
          好的评测还要看：
          <br />
          花了多少钱、烧了多少 token
          <br />
          <span style={{fontSize: 24, color: theme.dim}}>—— AI 读写按字数付的账</span>
          <br />
          换个新仓库，还灵不灵？
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 4-F 短板与教室 */
const GapAndClassroom: React.FC = () => {
  const frame = useCurrentFrame();
  const walkOut = interpolate(frame, [90, 130], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 90}}>
      <div>
        <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>几乎没人测的三块：</div>
        <div style={{marginTop: 26, display: 'flex', flexDirection: 'column', gap: 18}}>
          {['可维护性', '安全性', '长期可靠性'].map((g, i) => (
            <div
              key={g}
              style={{
                width: 420,
                padding: '20px 28px',
                borderRadius: 10,
                border: `2px dashed ${theme.danger}88`,
                fontFamily: theme.sans,
                fontSize: 27,
                color: theme.dim,
                textAlign: 'center',
                opacity: interpolate(frame, [i * 14 + 10, i * 14 + 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
              }}
            >
              {g} · 测得很弱
            </div>
          ))}
        </div>
      </div>
      {/* 教室门 */}
      <div style={{position: 'relative', width: 460, height: 420}}>
        <div style={{position: 'absolute', inset: 0, border: `8px solid ${theme.panelBorder}`, borderRadius: '14px 14px 0 0'}} />
        <div style={{position: 'absolute', top: 26, left: 0, right: 0, textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
          进化发生的那间教室
        </div>
        <div
          style={{
            position: 'absolute',
            left: `${20 + walkOut * 55}%`,
            bottom: 40,
            fontSize: 64,
            transform: `translateX(${walkOut * 40}px)`,
          }}
        >
          🤖
        </div>
        <div
          style={{
            position: 'absolute',
            right: 30,
            bottom: 120,
            fontSize: 60,
            color: theme.evo,
            opacity: walkOut,
          }}
        >
          ?
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const P4Eval: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p4-01', 'p4-02')} name="4-A 考场门">
        <ExamGate />
      </Sequence>
      <Sequence {...w('p4-03', 'p4-06')} name="4-B 真实考题">
        <RealIssue />
      </Sequence>
      <Sequence {...w('p4-07', 'p4-08')} name="4-C 互补定位">
        <Complementary />
      </Sequence>
      <Sequence {...w('p4-09', 'p4-12')} name="4-D 五个嫌疑人">
        <FiveSuspects />
      </Sequence>
      <Sequence {...w('p4-13', 'p4-14')} name="4-E 六维雷达">
        <Radar />
      </Sequence>
      <Sequence {...w('p4-15', 'p4-18')} name="4-F 短板与教室">
        <GapAndClassroom />
      </Sequence>
    </AbsoluteFill>
  );
};
