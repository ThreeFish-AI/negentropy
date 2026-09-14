/** P6 收尾：它没证明什么（分镜 6-A…6-C）
 *  五条边界压暗 → 价值金句 → 下期钩子 + 信源卡 + 渐黑。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel} from '../components/motifs';
import {DUR, useFadeOut, useImpulse, useProgress, useSpring, useStagger} from '../motion';

/** 6-A 五条边界清单 */
const BoundaryList: React.FC = () => {
  const rows = useStagger(5, {at: 6, stride: 12});
  const highlight = useImpulse({at: 70, dur: DUR.f5});
  const items = [
    '增益数字 = 厂商自家基准（口径自家定）',
    '发布时仍在预览阶段（证言 ≠ 效果数据）',
    '门禁只在自家引擎周界内成立（导出即绕过）',
    '治理 ≠ 验证（477 vs 48——错在原料）',
    '热度排序可能放大错误（流行的错压过冷门的对）',
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 26}}>
        {items.map((t, i) => (
          <div key={i} style={{opacity: rows[i], display: 'flex', alignItems: 'center', gap: 24}}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                border: `2px solid ${i === 3 ? theme.danger : theme.dim}`,
                color: i === 3 ? theme.danger : theme.dim,
                fontFamily: theme.mono,
                fontSize: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: i === 3 ? `0 0 ${highlight * 20}px ${theme.danger}` : 'none',
              }}
            >
              {i + 1}
            </div>
            <div
              style={{
                fontFamily: theme.sans,
                fontSize: 30,
                color: i === 3 ? theme.danger : theme.text,
                borderBottom: i === 3 ? `2px solid ${theme.danger}` : 'none',
                paddingBottom: i === 3 ? 4 : 0,
              }}
            >
              {t}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 6-B 价值金句 + 四徽章 */
const ValueQuote: React.FC = () => {
  const quote = useProgress(4, DUR.f6);
  const badges = useStagger(4, {at: 26, stride: 10});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{textAlign: 'center', opacity: quote}}>
        <div style={{fontFamily: theme.serif, fontSize: 54, color: theme.text, lineHeight: 1.6}}>
          {'含义第一次被当成'}
          <span style={{color: theme.manual}}>{'资产'}</span>
          {'管理'}
        </div>
        <div style={{display: 'flex', gap: 30, justifyContent: 'center', marginTop: 70}}>
          {['有定义', '有版本', '有权限', '有裁决'].map((b, i) => (
            <div key={i} style={{opacity: badges[i], transform: `translateY(${(1 - badges[i]) * 18}px)`}}>
              <Panel accent={theme.manual} style={{padding: '16px 34px'}}>
                <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.manual}}>{b}</div>
              </Panel>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 6-C 下期钩子 + 信源卡 + 渐黑（beat 全程渐黑，窗口=beat 时长） */
const NextAndCredits: React.FC<{durationInFrames: number}> = ({durationInFrames}) => {
  const hook = useSpring('settle', {at: 4});
  const src = useProgress(30, DUR.f5);
  const fade = useFadeOut(durationInFrames, {frames: 90});
  return (
    <AbsoluteFill style={{opacity: fade}}>
      <div style={{position: 'absolute', top: 260, width: '100%', textAlign: 'center', opacity: hook}}>
        <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim}}>{'那如果你不在那栋楼里呢？'}</div>
        <div style={{fontFamily: theme.serif, fontSize: 48, color: theme.engine, marginTop: 26}}>
          {'下期：把设计图抽象出来——五块积木，自己搭一层'}
        </div>
      </div>
      <div style={{position: 'absolute', bottom: 300, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: src}}>
        <Panel style={{width: 1000, padding: '26px 40px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, lineHeight: 2.0}}>
            <div>{'信源：Snowflake Horizon Context 产品页 / 官方博客 / docs（经本仓精读笔记 IEEE 引用链）'}</div>
            <div>{'精读笔记：docs/reference/paper-notes/horizon-context.md @ cf6724d6 · 2026-09-12'}</div>
            <div>{'复现代码：horizon_context_lab.py（916 行）+ horizon_context_mcp.py（328 行）· selftest 全绿'}</div>
            <div>{'工程图回放：docs/assets/architecture/paper-notes/（archify · 交互版可下载回放）'}</div>
          </div>
        </Panel>
      </div>
      <div style={{position: 'absolute', bottom: 220, width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: src}}>
        {'我是做引擎的程序员，我们下期见。'}
      </div>
    </AbsoluteFill>
  );
};

export const P6Ending: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p6-01', 'p6-08');
  const bB = w('p6-09', 'p6-12');
  const bC = w('p6-13', 'p6-16');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="6-A 五条边界">
        <BoundaryList />
      </Sequence>
      <Sequence {...bB} name="6-B 价值金句">
        <ValueQuote />
      </Sequence>
      <Sequence {...bC} name="6-C 钩子与信源">
        <NextAndCredits durationInFrames={bC.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};
