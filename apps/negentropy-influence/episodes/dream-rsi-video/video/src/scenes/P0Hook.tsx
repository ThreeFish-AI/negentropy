/** P0 烧钱账单与做梦赌注（p0-01..11）——sun 暖白昼冷开场：
 *  0-A 计费计数器 · 0-B 再跑一遍+论文卡 · 0-C 台账翻面成沙盘 + 标题卡。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useEnter, useImpulse, useStagger} from '../motion';
import {Backdrop, Counter, Footnote, Panel, SceneTag} from '../components/motifs';

/** 0-A：提案→评审双格循环 + 计费计数器。
 *  循环双格随句推进轮转（轮转点由句边界推导），计数器整窗匀速爬升，
 *  每轮「提案-评估」计一次费——账单的具象化。 */
const BillingLoop: React.FC<{wFrom: number; wDur: number; roundsAt: number[]}> = ({
  wFrom,
  wDur,
  roundsAt,
}) => {
  const frame = useCurrentFrame();
  const phase = Math.max(0, Math.floor((frame - wFrom) / DUR.f5));
  const active = roundsAt.findIndex((r) => frame >= r && frame < r + DUR.f6);
  const tagEnter = useEnter('rise', {at: active >= 0 ? roundsAt[active] : frame}); // 顶层调用，铁律①
  const signEnter = useEnter('pop', {at: wFrom + DUR.f3});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 56, alignItems: 'center'}}>
        <Panel accent={theme.sun} style={{padding: '30px 44px', minWidth: 300}}>
          <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>第 {phase + 1} 轮</div>
          <div style={{fontFamily: theme.sans, fontSize: 44, fontWeight: 700, color: theme.text, marginTop: 6}}>
            提出方案
          </div>
        </Panel>
        <div style={{fontFamily: theme.serif, fontSize: 52, color: theme.sun}}>{'→'}</div>
        <Panel accent={theme.sun} style={{padding: '30px 44px', minWidth: 300}}>
          <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>交给评审</div>
          <div style={{fontFamily: theme.sans, fontSize: 44, fontWeight: 700, color: theme.text, marginTop: 6}}>
            打分收账
          </div>
        </Panel>
      </div>
      {/* 红价签 + 调用计数器：整窗爬升（几千次量级具象为 4 位数跳动） */}
      <div style={{position: 'absolute', right: 120, top: 150, ...signEnter}}>
        <Panel accent={theme.danger} style={{padding: '20px 30px', transform: 'rotate(3deg)'}}>
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.danger}}>计费 · 调用数</div>
          <div style={{fontFamily: theme.mono, fontSize: 58, fontWeight: 700, color: theme.danger}}>
            <Counter from={0} to={4817} start={wFrom} frames={wDur} />
          </div>
        </Panel>
      </div>
      {active >= 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 130,
            top: 170,
            fontFamily: theme.mono,
            fontSize: 24,
            color: theme.dim,
            ...tagEnter,
          }}
        >
          ¥¥¥ 又一单入账
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** 0-B：再跑一遍按钮 + 账单涌出 + 论文卡。 */
const RerunStack: React.FC<{pressAt: number}> = ({pressAt}) => {
  const frame = useCurrentFrame();
  const press = useImpulse({at: pressAt, dur: DUR.f3});
  const bills = useStagger(6, {at: pressAt + DUR.f2, dur: DUR.f4, stride: 5});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          transform: `scale(${1 - press * 0.12})`,
          border: `3px solid ${theme.sun}`,
          borderRadius: 16,
          padding: '22px 52px',
          background: theme.panel,
          boxShadow: `0 0 ${18 + press * 26}px ${theme.sun}55`,
        }}
      >
        <span style={{fontFamily: theme.sans, fontSize: 40, fontWeight: 700, color: theme.sun}}>
          再跑一遍
        </span>
      </div>
      {/* 又一列账单涌出：反枚举（panel 底编号卡，不染色） */}
      <div style={{position: 'absolute', right: 150, top: 190, display: 'flex', flexDirection: 'column', gap: 12}}>
        {bills.map((b, i) => (
          <div key={i} style={{opacity: b, transform: `translateX(${(1 - b) * 60}px)`}}>
            <Panel style={{padding: '10px 22px'}}>
              <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.danger}}>
                ¥ {(2.1 + i * 0.7).toFixed(1)}k
              </span>
            </Panel>
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 250,
          ...useEnter('rise', {at: pressAt + DUR.f5, restBottom: 250}),
        }}
      >
        <Panel accent={theme.sun} style={{padding: '24px 46px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>2026 年 9 月 · arXiv:2609.14858</div>
          <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.text, marginTop: 6}}>
            Google × 马里兰大学 × Google DeepMind × 弗吉尼亚大学
          </div>
        </Panel>
      </div>
      <Footnote delay={pressAt + DUR.f6}>Dream-RSI: Recursive Self-Improvement through Evolving Worlds</Footnote>
    </AbsoluteFill>
  );
};

/** 0-C：台账 3D 翻面成沙盘（bespoke 签名镜头：等速线性翻面，「机械感是主题」）+ 标题卡。 */
const LedgerFlip: React.FC<{flipAt: number; titleAt: number}> = ({flipAt, titleAt}) => {
  const frame = useCurrentFrame();
  const flip = progress(frame, flipAt, DUR.f6); // 线性等速：账本翻面的机械感
  const angle = flip * 180;
  const night = progress(frame, flipAt + DUR.f5, DUR.f4); // 翻过半程后冰蓝一闪
  const title = useEnter('pop', {at: titleAt});
  const bookOut = 1 - progress(frame, titleAt, DUR.f4); // 标题入场即让位，防叠印
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{perspective: 1200, opacity: bookOut}}>
        <div
          style={{
            width: 460,
            height: 300,
            position: 'relative',
            transformStyle: 'preserve-3d',
            transform: `rotateY(${angle}deg)`,
          }}
        >
          {/* 正面：台账（sun 昼） */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              background: theme.panel,
              border: `3px solid ${theme.sun}`,
              borderRadius: 12,
              padding: 30,
            }}
          >
            <div style={{fontFamily: theme.serif, fontSize: 44, color: theme.text}}>台 账</div>
            <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, marginTop: 14, lineHeight: 2}}>
              路线 · 收获 · 分数
              <br />
              一页指认前一页
            </div>
          </div>
          {/* 背面：沙盘（dream 夜） */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: '#0A1822',
              border: `3px solid ${theme.dream}`,
              borderRadius: 12,
              padding: 30,
              boxShadow: `0 0 ${26 + night * 30}px ${theme.dream}66`,
            }}
          >
            <div style={{fontFamily: theme.serif, fontSize: 44, color: theme.dream}}>沙 盘</div>
            <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, marginTop: 14, lineHeight: 2}}>
              翻旧账 · 不花钱
              <br />
              推演新打法
            </div>
          </div>
        </div>
      </div>
      {/* 标题卡 */}
      <div style={{position: 'absolute', ...title}}>
        <div style={{fontFamily: theme.serif, fontSize: 72, fontWeight: 700, color: theme.text, textAlign: 'center'}}>
          翻旧账不花钱
        </div>
        <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.dream, textAlign: 'center', marginTop: 10}}>
          AI 在梦里改章程
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, textAlign: 'center', marginTop: 18}}>
          自进化系列 · 元探索 · 做梦
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const P0Hook: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <Backdrop tint={theme.sun} />
      <SceneTag chapter="P0" tagline="烧钱账单与做梦赌注" accent={theme.sun} />
      <Sequence {...w('p0-01', 'p0-04')} name="0-A 计费计数器">
        <BillingLoop
          wFrom={w('p0-01', 'p0-04').from}
          wDur={w('p0-01', 'p0-04').durationInFrames}
          roundsAt={[at('p0-02'), at('p0-03'), at('p0-04')].map((f) => f - w('p0-01', 'p0-04').from)}
        />
      </Sequence>
      <Sequence {...w('p0-05', 'p0-07')} name="0-B 再跑一遍">
        <RerunStack pressAt={at('p0-05') - w('p0-05', 'p0-07').from} />
      </Sequence>
      <Sequence {...w('p0-08', 'p0-11')} name="0-C 台账翻转">
        <LedgerFlip
          flipAt={at('p0-08') - w('p0-08', 'p0-11').from}
          titleAt={at('p0-11') - w('p0-08', 'p0-11').from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
