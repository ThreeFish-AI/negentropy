/** P5 拆台（p5-01..15）——自报成绩单怎么读：三没告诉你 / 反例 / 复算。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {CodeWalk, TerminalLog} from '../components/CodeWalk';
import {EvidenceBadge, LibraryHUD} from '../components/devices';

/** 5-A 证据分级卡 + 「它没告诉你」三连。 */
const GradeRow: React.FC<{at: number; warnAt: number}> = ({at, warnAt}) => {
  const grades = useStagger(3, {at, stride: 8, dur: DUR.f5});
  const warns = useStagger(3, {at: warnAt, stride: 8, dur: DUR.f5});
  const stamp = useImpulse({at: warnAt - 4, dur: DUR.f5});
  const sealed = useProgress(warnAt - 4, DUR.f3);
  const g = [
    {t: '【一】原型实测', c: theme.mint},
    {t: '【二】笔记讲法', c: theme.dim},
    {t: '【三】厂商自报', c: theme.peri},
  ];
  const w = ['判分宽松 · 没打上分不进分母', '答题模型其实是豆包 · 测的是外壳', '零单项拆解 · 归因不到机制'];
  return (
    <div style={{position: 'absolute', inset: 0, paddingTop: 200, textAlign: 'center'}}>
      <div style={{display: 'flex', gap: 36, justifyContent: 'center'}}>
        {g.map((x, i) => (
          <div
            key={x.t}
            style={{
              padding: '12px 26px',
              borderRadius: 999,
              border: `1px solid ${x.c}66`,
              background: `${x.c}12`,
              color: x.c,
              fontFamily: theme.sans,
              fontSize: 21,
              opacity: grades[i],
            }}
          >
            {x.t}
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 46,
          display: 'inline-block',
          position: 'relative',
          padding: '20px 54px',
          borderRadius: 14,
          border: `2px solid ${theme.peri}`,
          background: `${theme.peri}0D`,
          transform: `scale(${1 + 0.06 * stamp})`,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>记忆测试（团队自测报告）</div>
        <div style={{fontFamily: theme.mono, fontSize: 58, color: theme.peri, marginTop: 6}}>
          24.20% <span style={{color: theme.dim}}>→</span> 82.08%
        </div>
        <div
          style={{
            position: 'absolute',
            right: 14,
            top: 10,
            padding: '4px 14px',
            borderRadius: 6,
            border: `2px solid ${theme.rose}`,
            color: theme.rose,
            fontFamily: theme.sans,
            fontSize: 19,
            transform: `rotate(-12deg) scale(${1 + 0.4 * stamp})`,
            opacity: sealed,
          }}
        >
          自 报
        </div>
      </div>
      <div style={{marginTop: 40, display: 'flex', gap: 26, justifyContent: 'center'}}>
        {w.map((t, i) => (
          <div
            key={t}
            style={{
              width: 300,
              padding: '10px 16px',
              borderRadius: 8,
              border: `1px solid ${theme.rose}55`,
              color: theme.rose,
              fontFamily: theme.sans,
              fontSize: 17,
              opacity: warns[i],
            }}
          >
            它没告诉你 ③{i + 1} · {t}
          </div>
        ))}
      </div>
    </div>
  );
};

/** 5-B 反例对撞：66.9 vs 76 双柱 + 两枚小奖牌。 */
const DuelBars: React.FC<{at: number; medalAt: number}> = ({at, medalAt}) => {
  const riseA = useSpring('settle', {at, dur: DUR.f6});
  const riseB = useSpring('settle', {at: at + 8, dur: DUR.f6});
  const medals = useStagger(2, {at: medalAt, stride: 9, dur: DUR.f5});
  const bars = [
    {label: 'OpenViking', v: 66.9, c: theme.rose, p: riseA},
    {label: '图检索方案', v: 76.0, c: theme.mint, p: riseB},
  ];
  return (
    <div style={{position: 'absolute', inset: 0, paddingTop: 220, textAlign: 'center'}}>
      <div style={{display: 'flex', gap: 90, justifyContent: 'center', alignItems: 'flex-end', height: 260}}>
        {bars.map((b) => (
          <div key={b.label} style={{textAlign: 'center'}}>
            <div style={{fontFamily: theme.mono, fontSize: 44, color: b.c, marginBottom: 8}}>{b.v.toFixed(1)}</div>
            <div style={{width: 150, height: b.v * 2.6 * b.p, borderRadius: '8px 8px 0 0', background: `${b.c}CC`}} />
            <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 10}}>{b.label}</div>
          </div>
        ))}
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 18}}>五套单轮问答数据集 · 平均分</div>
      <div style={{marginTop: 30, display: 'flex', gap: 30, justifyContent: 'center'}}>
        {[
          {t: '建库 token 只要 1/7', d: '对方一成四'},
          {t: '检索快四十多倍', d: '0.19s vs 9.19s'},
        ].map((m, i) => (
          <div
            key={m.t}
            style={{
              padding: '12px 24px',
              borderRadius: 10,
              border: `1px solid ${theme.mint}66`,
              background: `${theme.mint}0C`,
              color: theme.mint,
              fontFamily: theme.sans,
              fontSize: 20,
              opacity: medals[i],
            }}
          >
            🏅 {m.t} <span style={{color: theme.dim, fontSize: 16}}>（{m.d}）</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** 5-C 复算终端。 */
export const P5Teardown: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p5-01', 'p5-06');
  const bB = w('p5-07', 'p5-10');
  const bC = w('p5-11', 'p5-15');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A 成绩单与三连">
        <SceneTag chapter="P5" tagline="拆台" accent={theme.peri} />
        <GradeRow at={at('p5-01') - bA.from} warnAt={at('p5-03') - bA.from} />
        <EvidenceBadge grade="vendor" />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bB} name="5-B 反例对撞">
        <SceneTag chapter="P5" tagline="拆台" accent={theme.rose} />
        <DuelBars at={at('p5-08') - bB.from} medalAt={at('p5-09') - bB.from} />
        <EvidenceBadge grade="vendor" />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bC} name="5-C 复算终端">
        <SceneTag chapter="P5" tagline="拆台" accent={theme.peri} />
        <div style={{position: 'absolute', inset: 0, paddingTop: 150, display: 'flex', justifyContent: 'center'}}>
          <CodeWalk
            title="recompute.py · 自报数字自己算一遍"
            lines={[
              'hourly_tokens_before = 1030.3',
              'hourly_tokens_after  =  872.4',
              'drop = 1 - after / before',
              '# 报告写 −22.8%；实测 = −15.3%',
            ]}
            hi={[{line: 3, at: at('p5-11') - bC.from, color: theme.danger}]}
            caption="ClawWork token 降幅复算（014 §9.1 算术错误）"
          />
        </div>
        <div style={{position: 'absolute', left: 430, top: 620, width: 1060}}>
          <TerminalLog
            lines={[
              {text: '三篇论文实验均不在开源版上跑（生产 VikingDB / 内部引擎 / 独立仓）', color: theme.rose, at: at('p5-13') - bC.from},
              {text: '文档 vs 代码：find「递归检索」≠ 代码固定平铺 → 全部以固定提交代码实值为准', color: theme.dim, at: at('p5-13') - bC.from + 24},
            ]}
            caption="证据纪律 · 014 §9.3 矛盾清单"
          />
        </div>
        <EvidenceBadge grade="official" />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>
    </AbsoluteFill>
  );
};
