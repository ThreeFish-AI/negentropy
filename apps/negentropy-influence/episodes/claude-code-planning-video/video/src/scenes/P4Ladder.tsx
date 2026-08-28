/** P4 桌边的补救梯（分镜 4-A…4-E）—— Error Recovery
 *  三级梯垂下 → 话没说完（断截 + 8K→64K 标尺 + 续写×3）→ 桌上太满（压缩被拦）
 *  → 门外施工（等待条翻倍 0.5→32s 封顶 + 名牌翻面）→ 收益递减「停」章。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Chip, Desk, Footnote, Panel, SceneHeader, SceneTag, Stamp} from '../components/motifs';

/** 梯子骨架（mech）：三级木梯挂在桌右缘，自上垂下挂稳（rope 微弹）。 */
const Ladder: React.FC<{drop: number; labels?: [string, string, string]}> = ({drop, labels}) => {
  const frame = useCurrentFrame();
  const H = 560;
  const rungY = [110, 270, 430];
  const labelsOn = labels ?? ['', '', ''];
  return (
    <svg width={300} height={H} style={{overflow: 'visible'}}>
      <g transform={`translate(0 ${-(1 - drop) * H})`}>
        {/* 挂绳：微弹 */}
        <line x1={120} y1={-40} x2={120} y2={0} stroke={theme.mech} strokeWidth={4} />
        <line x1={210} y1={-40} x2={210} y2={0} stroke={theme.mech} strokeWidth={4} />
        {/* 两根梯柱 */}
        <line x1={120} y1={0} x2={120} y2={H - 30} stroke={theme.mech} strokeWidth={7} strokeLinecap="round" />
        <line x1={210} y1={0} x2={210} y2={H - 30} stroke={theme.mech} strokeWidth={7} strokeLinecap="round" />
        {/* 三级梯级 */}
        {rungY.map((y, i) => {
          const p = interpolate(drop - 0.2 - i * 0.18, [0, 0.3], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <g key={y} opacity={p}>
              <line x1={120} y1={y} x2={120 + 90 * p} y2={y} stroke={theme.mech} strokeWidth={7} strokeLinecap="round" />
              {labelsOn[i] ? (
                <text x={235} y={y + 8} fontFamily={theme.sans} fontSize={21} fontWeight={600} fill={theme.mech}>
                  {labelsOn[i]}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
};

/** 4-A 桌子右缘挂下一张三级木梯（梯级暂空）。 */
const LadderDrops: React.FC<{dropAt: number}> = ({dropAt}) => {
  const frame = useCurrentFrame();
  const drop = spring({frame: frame - dropAt, fps: 30, config: {damping: 11}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="Error Recovery" tagline="错误不是终点，是重试的起点" accent={theme.deny} />
      <div style={{position: 'relative', width: 1300, height: 620}}>
        {/* 桌子 */}
        <div style={{position: 'absolute', left: 60, top: 200}}>
          <Desk width={760} height={380}>
            <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
              {'活干到一半出岔子，是生产的常态'}
            </div>
          </Desk>
        </div>
        {/* 梯子挂右缘 */}
        <div style={{position: 'absolute', right: 110, top: 40}}>
          <Ladder drop={drop} />
        </div>
      </div>
      <Footnote delay={dropAt + 20}>{'三级梯：话没说完 / 桌上太满 / 门外施工'}</Footnote>
    </AbsoluteFill>
  );
};

/** 4-B 一级梯「话没说完」：文本条中途断截；8K→64K 标尺弹簧拉长；续写卡 + 三次计数点。 */
const TierOne: React.FC<{snapAt: number; rulerAt: number; contAt: number[]; sealAt: number}> = ({
  snapAt,
  rulerAt,
  contAt,
  sealAt,
}) => {
  const frame = useCurrentFrame();
  // 断口闪 deny
  const snap = frame >= snapAt;
  const snapFlash = snap ? interpolate((frame - snapAt) % 30, [0, 8], [1, 0], {extrapolateRight: 'clamp'}) : 0;
  // 标尺：8K→64K 弹簧拉长一次
  const ruler = spring({frame: frame - rulerAt, fps: 30, config: {damping: 10}});
  // 三次续写计数点
  const lit = contAt.filter((a) => frame >= a).length;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1460, height: 700}}>
        {/* 梯子（左侧缩略，一级亮） */}
        <div style={{position: 'absolute', left: 0, top: 60, opacity: 0.9}}>
          <Ladder drop={1} labels={['一级 · 话没说完', '', '']} />
        </div>
        {/* 文本条：中途断截 */}
        <div style={{position: 'absolute', left: 380, top: 90, width: 1000}}>
          <Panel style={{width: 940, padding: '20px 24px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginBottom: 10}}>
              {'模型的回答（输出中）'}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.text, whiteSpace: 'pre'}}>
              {'第一步先把文件名统一，第二步跑测试，第三步修好失败的用'}
              <span
                style={{
                  color: theme.deny,
                  fontWeight: 700,
                  opacity: snap ? 1 : 0,
                  textShadow: `0 0 ${12 * snapFlash}px ${theme.deny}`,
                }}
              >
                {'▌'}
              </span>
            </div>
            {/* 断口标注 */}
            {snap ? (
              <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.deny, marginTop: 8}}>
                {'额度用完，句子断在半空（max_tokens）'}
              </div>
            ) : null}
          </Panel>
          {/* 8K→64K 标尺：弹簧拉长一次 */}
          <div style={{marginTop: 26, width: 940}}>
            <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
              <span>{'8K'}</span>
              <span style={{color: theme.mech, opacity: ruler}}>{'64K（上限放大八倍）'}</span>
            </div>
            <svg width={940} height={60}>
              <line x1={30} y1={30} x2={130} y2={30} stroke={theme.dim} strokeWidth={6} strokeLinecap="round" />
              {/* 弹簧段 */}
              <path
                d={`M130 30 ${Array.from({length: 12}).map((_, i) => {
                  const seg = (700 * ruler) / 12;
                  const x = 130 + seg * (i + 1);
                  return `L${x} ${i % 2 === 0 ? 14 : 46}`;
                }).join(' ')} L${130 + 700 * ruler} 30`}
                fill="none"
                stroke={theme.mech}
                strokeWidth={4}
                opacity={ruler}
              />
              <circle cx={130 + 700 * ruler} cy={30} r={9} fill={theme.mech} opacity={ruler} />
            </svg>
            <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginTop: 4}}>
              {'原封不动重试同一个请求 —— 只放大这一次'}
            </div>
          </div>
          {/* 续写卡：贴上断口，卡上写提示原文意译 */}
          {frame >= contAt[0] ? (
            <div style={{marginTop: 24}}>
              <Panel accent={theme.mech} style={{width: 940, padding: '16px 22px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div>
                    <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>{'续写提示（源码原文意译）'}</div>
                    <div style={{fontFamily: theme.serif, fontSize: 29, fontWeight: 700, color: theme.mech, marginTop: 4}}>
                      {'别道歉，别复述，接着说，把剩下的活切小点'}
                    </div>
                  </div>
                  {/* 三次计数点：亮满即封条 */}
                  <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 999,
                          border: `3px solid ${i < lit ? theme.mech : theme.panelBorder}`,
                          background: i < lit ? theme.mechDeep : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: theme.mono,
                          fontSize: 19,
                          fontWeight: 700,
                          color: i < lit ? theme.mech : theme.dim,
                        }}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>
                </div>
                {lit >= 3 ? (
                  <div
                    style={{
                      marginTop: 10,
                      fontFamily: theme.sans,
                      fontSize: 21,
                      color: theme.deny,
                      opacity: interpolate(frame - sealAt, [0, 12], [0, 1], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                      }),
                    }}
                  >
                    {'三次还断就收手（封条）'}
                  </div>
                ) : null}
              </Panel>
            </div>
          ) : null}
        </div>
      </div>
      <Footnote delay={rulerAt}>{'续写提示原文：query.ts:1225 —— 第三方的源码分析'}</Footnote>
    </AbsoluteFill>
  );
};

/** 4-C 二级梯「桌上太满」：整桌色块压缩成摘要卡；第二次压缩被 deny 拦停，桌上浮「退出」。 */
const TierTwo: React.FC<{squashAt: number; blockAt: number; exitAt: number}> = ({
  squashAt,
  blockAt,
  exitAt,
}) => {
  const frame = useCurrentFrame();
  // 色块群被吸成一张卡（收缩动画）
  const squash = interpolate(frame - squashAt, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const blocked = frame >= blockAt;
  const blockedSpring = spring({frame: frame - blockAt, fps: 30, config: {damping: 12}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1460, height: 640}}>
        <div style={{position: 'absolute', left: 0, top: 50, opacity: 0.9}}>
          <Ladder drop={1} labels={['', '二级 · 桌上太满', '']} />
        </div>
        <div style={{position: 'absolute', left: 380, top: 80, width: 1020}}>
          {/* 桌面：色块群 → 吸成一张摘要卡 */}
          <div style={{position: 'relative'}}>
            <Desk width={980} height={420}>
              {/* 原色块群（squash 后淡出向中心收缩） */}
              <div
                style={{
                  position: 'absolute',
                  inset: 20,
                  opacity: 1 - squash,
                  transform: `scale(${1 - squash * 0.6})`,
                }}
              >
                {['tool: read', 'tool: bash', 'assistant', 'tool: edit', 'tool: read', 'user', 'assistant', 'tool: bash'].map((l, i) => (
                  <div key={i} style={{position: 'absolute', left: (i % 4) * 230, top: Math.floor(i / 4) * 90 + 30}}>
                    <Chip kind={l.startsWith('tool') ? 'tool' : l === 'user' ? 'user' : 'model'} label={l} width={190} />
                  </div>
                ))}
              </div>
              {/* 摘要卡：吸拢生成 */}
              {squash > 0.5 ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: (squash - 0.5) * 2,
                  }}
                >
                  <Panel accent={theme.view} style={{width: 460, padding: '18px 22px'}}>
                    <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'摘要卡（旧纸压成的）'}</div>
                    <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.text, marginTop: 6, lineHeight: 1.5}}>
                      {'此前：读了 12 个文件，改了 3 处，测试还剩 2 个失败……'}
                    </div>
                  </Panel>
                </div>
              ) : null}
            </Desk>
            {/* 第二次压缩：箭头刚起就被拦杆挡下 */}
            {blocked ? (
              <svg width={980} height={140} style={{marginTop: 8}}>
                <g opacity={blockedSpring}>
                  {/* 压缩箭头（第二次） */}
                  <path d="M180 70 L280 70 M270 58 L284 70 L270 82" fill="none" stroke={theme.view} strokeWidth={5} strokeLinecap="round" />
                  {/* 拦杆 */}
                  <line x1={330} y1={20} x2={330} y2={120} stroke={theme.deny} strokeWidth={7} strokeLinecap="round" />
                  <text x={360} y={54} fontFamily={theme.sans} fontSize={23} fontWeight={700} fill={theme.deny}>
                    {'纸不会越压越小'}
                  </text>
                  <text x={360} y={88} fontFamily={theme.sans} fontSize={21} color={theme.dim} fill={theme.dim}>
                    {'压第二次没有意义'}
                  </text>
                </g>
              </svg>
            ) : null}
            {/* 桌上浮「退出」 */}
            {frame >= exitAt ? (
              <div
                style={{
                  position: 'absolute',
                  right: 30,
                  top: -30,
                  fontFamily: theme.serif,
                  fontSize: 44,
                  fontWeight: 700,
                  color: theme.deny,
                  opacity: interpolate(frame - exitAt, [0, 14], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
                  transform: `translateY(${interpolate(frame - exitAt, [0, 20], [20, 0], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  })}px)`,
                }}
              >
                {'退出'}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <Footnote delay={blockAt}>{'先压一轮腾地方；压完还装不下，就承认装不下'}</Footnote>
    </AbsoluteFill>
  );
};

/** 4-D 三级梯「门外施工」：警示牌砸落；等待条按节拍翻倍伸长（0.5→32s 封顶横杠）；
 *  三连 529 后模型名牌翻面换人。 */
const TierThree: React.FC<{warnAt: number; waitAt: number; flipAt: number; jitterAt: number}> = ({
  warnAt,
  waitAt,
  flipAt,
  jitterAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 警示牌砸落抖动
  const warn = spring({frame: frame - warnAt, fps: 30, config: {damping: 12}});
  const warnShake = frame > warnAt + 6 && frame < warnAt + 24 ? Math.sin((frame - warnAt) / 1.3) * 4 : 0;
  // 等待条按节拍翻倍：0.5 → 1 → 2 → 4 → 8 → 16 → 32（封顶）
  const steps = [0.5, 1, 2, 4, 8, 16, 32];
  const stepDur = 16;
  const t = Math.max(0, frame - waitAt);
  const stepIdx = Math.min(steps.length - 1, Math.floor(t / stepDur));
  const stepT = (t % stepDur) / stepDur;
  const eased = 1 - Math.pow(1 - stepT, 3);
  // 当前等待值：从上一步值翻倍爬升到本步值（首步从 0.25 起爬到 0.5），封顶后恒 32
  const prevVal = stepIdx === 0 ? steps[0] / 2 : steps[stepIdx - 1];
  const curVal = prevVal + (steps[stepIdx] - prevVal) * eased;
  const atCap = stepIdx >= steps.length - 1 && stepT > 0.5;
  const capClang = atCap && t % stepDur < 8;
  // 抖动毛边：条身抖动
  const jitter = frame >= jitterAt ? Math.sin(frame / 1.8) * 2.4 : 0;
  // 名牌翻面换人
  const flip = interpolate(frame - flipAt, [0, 16], [0, 180], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const showNew = flip >= 90;
  const fiveTwosNine = frame >= flipAt - 40 ? Math.min(3, Math.floor((frame - (flipAt - 40)) / 14) + 1) : 0;
  const maxW = 1000;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1460, height: 720}}>
        <div style={{position: 'absolute', left: 0, top: 50, opacity: 0.9}}>
          <Ladder drop={1} labels={['', '', '三级 · 门外施工']} />
        </div>
        <div style={{position: 'absolute', left: 380, top: 60, width: 1040}}>
          {/* 警示牌：过载/限流 */}
          <div
            style={{
              display: 'inline-block',
              transform: `translateY(${(1 - warn) * -220}px) translateX(${warnShake}px) rotate(${(1 - warn) * -14}deg)`,
              opacity: warn,
            }}
          >
            <svg width={190} height={170}>
              <path d="M95 8 L180 152 L10 152 Z" fill={theme.denyDeep} stroke={theme.deny} strokeWidth={5} />
              <text x={95} y={92} textAnchor="middle" fontFamily={theme.mono} fontSize={40} fontWeight={700} fill={theme.deny}>
                {'529'}
              </text>
              <text x={95} y={126} textAnchor="middle" fontFamily={theme.sans} fontSize={19} fill={theme.deny}>
                {'过载/限流'}
              </text>
            </svg>
          </div>
          {/* 等待条：翻倍生长 + 封顶横杠 + 抖动毛边 */}
          <div style={{marginTop: 20, width: 1000}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
              <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>
                {'退避等待：半秒、一秒、两秒、四秒……每次翻倍'}
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 36, fontWeight: 700, color: atCap ? theme.deny : theme.mech}}>
                {`${curVal >= 1 ? Math.round(curVal) : curVal.toFixed(1)}s`}
              </div>
            </div>
            <div style={{position: 'relative', height: 64, marginTop: 8}}>
              {/* 条身 */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 18 + jitter,
                  height: 28,
                  width: (curVal / 32) * maxW,
                  background: atCap ? theme.denyDeep : theme.mechDeep,
                  border: `2px solid ${atCap ? theme.deny : theme.mech}`,
                  borderRadius: 6,
                }}
              />
              {/* 抖动毛边：条身边缘的锯齿线 */}
              <svg width={maxW} height={64} style={{position: 'absolute', inset: 0}}>
                {frame >= jitterAt ? (
                  <path
                    d={`M0 ${32 + jitter} ${Array.from({length: 40}).map((_, i) => {
                      const x = ((i + 1) / 40) * maxW;
                      return `L${x} ${32 + jitter + (i % 2 === 0 ? 4 : -4)}`;
                    }).join(' ')}`}
                    fill="none"
                    stroke={`${atCap ? theme.deny : theme.mech}66`}
                    strokeWidth={2}
                    clipPath="none"
                    opacity={Math.min(1, (curVal / 32) * 2.4)}
                  />
                ) : null}
              </svg>
              {/* 封顶横杠：32s 处「当」一声定格 */}
              <div
                style={{
                  position: 'absolute',
                  left: maxW,
                  top: 0,
                  height: 64,
                  width: 8,
                  background: theme.deny,
                  borderRadius: 3,
                  opacity: atCap ? 1 : 0.35,
                  transform: atCap && capClang ? `scaleX(${1 + 0.6 * Math.max(0, Math.sin((t % stepDur) / 1.2))})` : 'none',
                  transformOrigin: 'right',
                }}
              />
              {atCap ? (
                <div
                  style={{
                    position: 'absolute',
                    left: maxW - 120,
                    top: -18,
                    fontFamily: theme.mono,
                    fontSize: 20,
                    color: theme.deny,
                  }}
                >
                  {'封顶 32s'}
                </div>
              ) : null}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 6}}>
              {'再撒一点随机抖动，免得全世界的重试同一秒一起冲回来'}
            </div>
          </div>
          {/* 模型名牌：三连 529 后翻面换人 */}
          <div style={{marginTop: 30, display: 'flex', alignItems: 'center', gap: 26}}>
            <div
              style={{
                perspective: 600,
              }}
            >
              <div
                style={{
                  width: 380,
                  height: 96,
                  position: 'relative',
                  transformStyle: 'preserve-3d',
                  transform: `rotateY(${flip}deg)`,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backfaceVisibility: 'hidden',
                    border: `3px solid ${theme.panelBorder}`,
                    borderRadius: 12,
                    background: theme.panel,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: theme.mono,
                    fontSize: 25,
                    color: theme.text,
                  }}
                >
                  {'主模型'}
                </div>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    border: `3px solid ${theme.mech}`,
                    borderRadius: 12,
                    background: theme.mechDeep,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: theme.mono,
                    fontSize: 25,
                    color: theme.mech,
                  }}
                >
                  {'备用模型（先干点小的）'}
                </div>
              </div>
            </div>
            {/* 三连 529 计数 */}
            <div style={{display: 'flex', gap: 10}}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 8,
                    border: `3px solid ${i < fiveTwosNine ? theme.deny : theme.panelBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: theme.mono,
                    fontSize: 17,
                    fontWeight: 700,
                    color: i < fiveTwosNine ? theme.deny : theme.dim,
                    background: i < fiveTwosNine ? theme.denyDeep : 'transparent',
                  }}
                >
                  {'529'}
                </div>
              ))}
            </div>
            {showNew ? (
              <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.mech}}>
                {'Switched due to high demand'}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <Footnote delay={flipAt}>
        {'恢复路径十几种（实测 17）· 教学版挑最常见的三种 —— 第三方的源码分析'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 4-E 收益递减：产出曲线三次爬升依次趋平；第三次的增量 < 阈值标线；「停」章落下；
 *  p4-21a/b 官方检查点回退（只看文件改动）→ 金句「每一级补救都带着上限」（Harness Engineering 改造）。 */
const Diminishing: React.FC<{
  curveAt: number;
  lineAt: number;
  stopAt: number;
  ckptAt: number;
  quoteAt: number;
}> = ({curveAt, lineAt, stopAt, ckptAt, quoteAt}) => {
  const frame = useCurrentFrame();
  if (frame >= quoteAt) {
    return <QuoteCard zh="每一级补救，都带着上限。" accent={theme.mech} />;
  }
  const W = 1100;
  const H = 460;
  // 三段递减曲线：产出随续写次数的爬升，斜率递减
  const totalT = interpolate(frame - curveAt, [0, 72], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const seg = (i: number) => Math.max(0, Math.min(1, totalT * 3 - i));
  // 三段曲线的高度函数（斜率递减）
  const yAt = (u: number) => {
    // u ∈ [0,1]：三段拼接，每段增益 0.45 / 0.3 / 0.1
    const gains = [0.45, 0.3, 0.1];
    let acc = 0;
    for (let i = 0; i < 3; i++) {
      if (u <= (i + 1) / 3) return acc + gains[i] * ((u - i / 3) * 3);
      acc += gains[i];
    }
    return acc;
  };
  const pts = Array.from({length: 60}).map((_, i) => {
    const u = (i / 59) * Math.min(1, totalT * 1);
    const y = yAt(u);
    return `${80 + u * (W - 160)},${H - 60 - y * (H - 140)}`;
  });
  const lineT = interpolate(frame - lineAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative'}}>
        <svg width={W} height={H + 40}>
          {/* 坐标轴 */}
          <line x1={80} y1={H - 60} x2={W - 60} y2={H - 60} stroke={theme.panelBorder} strokeWidth={3} />
          <line x1={80} y1={30} x2={80} y2={H - 60} stroke={theme.panelBorder} strokeWidth={3} />
          <text x={W - 60} y={H - 30} textAnchor="end" fontFamily={theme.sans} fontSize={20} fill={theme.dim}>
            {'续写次数 →'}
          </text>
          <text x={40} y={40} fontFamily={theme.sans} fontSize={20} fill={theme.dim}>
            {'产出'}
          </text>
          {/* 三段曲线逐段绘制（斜率递减） */}
          {seg(0) > 0 ? (
            <>
              <polyline points={pts.slice(0, Math.ceil(seg(0) * 20)).join(' ')} fill="none" stroke={theme.mech} strokeWidth={5} strokeLinecap="round" />
              {seg(1) > 0 ? (
                <polyline points={pts.slice(20, 20 + Math.ceil(seg(1) * 20)).join(' ')} fill="none" stroke={theme.mech} strokeWidth={5} strokeLinecap="round" opacity={0.85} />
              ) : null}
              {seg(2) > 0 ? (
                <polyline points={pts.slice(40, 40 + Math.ceil(seg(2) * 20)).join(' ')} fill="none" stroke={theme.mech} strokeWidth={5} strokeLinecap="round" opacity={0.7} />
              ) : null}
            </>
          ) : null}
          {/* 阈值标线：第三次的增量 < 阈值 → 停 */}
          {lineT > 0 ? (
            <g opacity={lineT}>
              <line x1={80} y1={H - 60 - 0.5 * (H - 140)} x2={W - 60} y2={H - 60 - 0.5 * (H - 140)} stroke={theme.deny} strokeWidth={3} strokeDasharray="10 8" />
              <text x={W - 70} y={H - 60 - 0.5 * (H - 140) - 12} textAnchor="end" fontFamily={theme.mono} fontSize={19} fill={theme.deny}>
                {'增量 < 500 token'}
              </text>
            </g>
          ) : null}
        </svg>
        {/* 「停」章落下 */}
        <Stamp text="停" color={theme.deny} at={stopAt} size={150} rotate={-14} style={{position: 'absolute', right: 130, top: 130}} />
      </div>
      {/* p4-21a/b 官方检查点回退：改动可回退，但只含文件改动——命令与外部状态不在其中 */}
      {frame >= ckptAt ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 150,
            transform: `translateX(-50%) translateY(${interpolate(frame - ckptAt, [0, 14], [16, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}px)`,
            opacity: interpolate(frame - ckptAt, [0, 14], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <Panel accent={theme.view} style={{padding: '14px 24px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.text}}>
              {'兜底后悔药：改动回退到检查点'}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 6}}>
              {'只含文件改动 ✓　跑过的命令 · 改过的外部状态 ✗'}
            </div>
          </Panel>
        </div>
      ) : null}
      <Footnote delay={lineAt}>{'连续 3 次续写无实质产出 → 直接判定停 —— 不恋战'}</Footnote>
    </AbsoluteFill>
  );
};

export const P4Ladder: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p4-01', 'p4-02');
  const relA = (id: string) => at(id) - bA.from;
  const bB = w('p4-03', 'p4-07');
  const relB = (id: string) => at(id) - bB.from;
  const bC = w('p4-08', 'p4-10');
  const relC = (id: string) => at(id) - bC.from;
  const bD = w('p4-11', 'p4-17');
  const relD = (id: string) => at(id) - bD.from;
  const bE = w('p4-18', 'p4-22');
  const relE = (id: string) => at(id) - bE.from;
  return (
    <AbsoluteFill>
      <SceneHeader index="P4" title="桌边的补救梯" meta="Error Recovery · 10 retries · exp backoff" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="4-A 补救梯垂下">
        {/* p4-01「管的是意外」桌子亮出；p4-02 岔子预告，梯子自上垂下挂稳 */}
        <LadderDrops dropAt={relA('p4-02')} />
      </Sequence>
      <Sequence {...bB} name="4-B 一级话没说完">
        {/* p4-03 放大八倍重试：标尺弹簧；p4-05 续写提示卡；p4-06 三次计数 */}
        <TierOne
          snapAt={relB('p4-02') + 8}
          rulerAt={relB('p4-03')}
          contAt={[relB('p4-05'), relB('p4-05') + 26, relB('p4-05') + 52]}
          sealAt={relB('p4-06')}
        />
      </Sequence>
      <Sequence {...bC} name="4-C 二级桌上太满">
        {/* p4-09 先压一轮（吸成摘要卡）；压第二次被拦 + 退出 */}
        <TierTwo squashAt={relC('p4-09')} blockAt={relC('p4-09') + 40} exitAt={relC('p4-10')} />
      </Sequence>
      <Sequence {...bD} name="4-D 三级门外施工">
        {/* p4-11 警示牌；p4-13 等待翻倍；p4-15 抖动；p4-17 换人翻面 */}
        <TierThree
          warnAt={relD('p4-11')}
          waitAt={relD('p4-13')}
          jitterAt={relD('p4-15')}
          flipAt={relD('p4-17')}
        />
      </Sequence>
      <Sequence {...bE} name="4-E 收益递减·检查点·金句">
        {/* p4-19 递减检测；p4-20 停；p4-21a 检查点回退；p4-22 金句（每级都带上限） */}
        <Diminishing
          curveAt={relE('p4-19')}
          lineAt={relE('p4-19') + 34}
          stopAt={relE('p4-20')}
          ckptAt={relE('p4-21a')}
          quoteAt={relE('p4-22')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
