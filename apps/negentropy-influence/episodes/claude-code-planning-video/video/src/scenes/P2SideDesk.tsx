/** P2 另开一张副桌（分镜 2-A…2-F）—— Subagent
 *  桌面暴涨 → 副桌滑出（缩小克隆环）→ 分屏回执 → 派活上锁 + 迷你闸门
 *  → ★五要素等号锁（本集最反直觉深挖帧）→ 共享抽屉 + 审批冒泡。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Chip, Counter, Desk, Footnote, LoopRing, Panel, SceneHeader, SceneTag, Stamp, useRingDot} from '../components/motifs';

/** 2-A 桌面色块暴涨成灾：一百多条记录填满桌面；计费计数器持续跳字。 */
const DeskFlood: React.FC<{floodAt: number; billAt: number}> = ({floodAt, billAt}) => {
  const frame = useCurrentFrame();
  const rows = 10;
  const cols = 16;
  const shown = Math.max(0, Math.floor((frame - floodAt) * 0.8));
  const kinds: Array<'user' | 'model' | 'tool'> = ['tool', 'tool', 'model', 'tool', 'user'];
  const labels = ['tool: read', 'tool: bash', 'assistant', 'tool: edit', 'user'];
  const overflow = interpolate(frame - floodAt - 100, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <SceneTag chapter="task tool" tagline="全新 messages[] · 只回传结论" accent={theme.view} />
      <div style={{position: 'relative'}}>
        <Desk width={1420} height={540}>
          <div style={{position: 'absolute', inset: 14, overflow: 'hidden', borderRadius: 12}}>
            {Array.from({length: rows}).map((_, r) => (
              <div key={r} style={{display: 'flex', gap: 6, marginBottom: 6, paddingLeft: 6}}>
                {Array.from({length: cols}).map((_, c) => {
                  const idx = r * cols + c;
                  if (idx >= shown) return null;
                  const kk = kinds[r % kinds.length];
                  const w = 74 + ((idx * 29) % 3) * 18;
                  return <Chip key={c} kind={kk} label={labels[r % labels.length]} width={w} height={26} style={{fontSize: 16}} />;
                })}
              </div>
            ))}
          </div>
          {/* 溢出桌沿：色块堆到溢出 */}
          {overflow > 0 ? (
            <div
              style={{
                position: 'absolute',
                right: -80 - overflow * 60,
                top: 60,
                opacity: overflow * 0.8,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {['tool', 'tool', 'tool'].map((l, i) => (
                <Chip key={i} kind="tool" label={l} width={110} height={26} style={{fontSize: 16}} />
              ))}
            </div>
          ) : null}
        </Desk>
        {/* 计费计数器（mech）：持续跳字 */}
        <div
          style={{
            position: 'absolute',
            right: -140,
            top: -60,
            padding: '12px 20px',
            border: `2px solid ${frame >= billAt ? theme.mech : theme.panelBorder}`,
            borderRadius: 10,
            background: theme.panel,
            opacity: interpolate(frame - billAt, [0, 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'本轮计费 token'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 44, fontWeight: 700, color: theme.mech}}>
            <Counter from={0} to={shown * 131} start={billAt} frames={9999} />
          </div>
        </div>
      </div>
      <Footnote delay={billAt}>{'跟目标无关，但一直占着位置、一直计着费'}</Footnote>
    </AbsoluteFill>
  );
};

/** 2-B 副桌滑出（自带缩小克隆环），主桌上「翻找」的脏纸堆整体飞向副桌。 */
const SideDeskSlidesOut: React.FC<{slideAt: number; flyAt: number; cleanAt: number}> = ({
  slideAt,
  flyAt,
  cleanAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const slide = spring({frame: frame - slideAt, fps, config: {damping: 200}});
  // 纸堆打包飞行：主桌右缘 → 副桌
  const fly = interpolate(frame - flyAt, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const clean = interpolate(frame - cleanAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1720, height: 640}}>
        {/* 主桌：翻找的脏纸堆 */}
        <div style={{position: 'absolute', left: 30, top: 100}}>
          <Desk width={880} height={440}>
            <div style={{position: 'absolute', inset: 14, opacity: 1 - fly * 0.92}}>
              {['tool: read ×12', 'tool: bash', 'assistant', 'tool: edit', 'tool: read ×8'].map((l, i) => (
                <div key={i} style={{marginBottom: 8}}>
                  <Chip kind={i % 2 === 0 ? 'tool' : 'model'} label={l} width={300 + (i % 3) * 60} />
                </div>
              ))}
            </div>
            {/* 纸堆飞行后主桌留下清空的桌面 */}
            {clean > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.sans,
                  fontSize: 30,
                  color: theme.dim,
                  opacity: clean,
                }}
              >
                {'主桌继续干主活'}
              </div>
            ) : null}
          </Desk>
          <div
            style={{
              textAlign: 'center',
              marginTop: 12,
              fontFamily: theme.sans,
              fontSize: 24,
              color: theme.dim,
            }}
          >
            {'主桌（你俩的对话）'}
          </div>
        </div>
        {/* 副桌：mech 描边 + 自带缩小克隆环 */}
        <div
          style={{
            position: 'absolute',
            right: 20,
            top: 130,
            transform: `translateX(${(1 - slide) * 520}px)`,
            opacity: slide,
          }}
        >
          <div style={{position: 'relative'}}>
            <MiniDeskWithRing cleanAt={cleanAt} fly={fly} />
            <div
              style={{
                textAlign: 'center',
                marginTop: 12,
                fontFamily: theme.sans,
                fontSize: 24,
                color: theme.mech,
              }}
            >
              {'副桌（分身的干净桌面）'}
            </div>
          </div>
        </div>
        {/* 纸堆飞行：从主桌打包飞向副桌 */}
        {fly > 0 && fly < 1 ? (
          <svg width={1720} height={640} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
            <g>
              {[0, 1, 2].map((k) => {
                const t = Math.max(0, fly - k * 0.08);
                const x = 500 + t * 700;
                const y = 320 + Math.sin(t * Math.PI) * -80 - k * 34;
                return (
                  <rect
                    key={k}
                    x={x}
                    y={y}
                    width={90}
                    height={26}
                    rx={5}
                    fill={theme.panel}
                    stroke={theme.mech}
                    strokeWidth={2}
                    opacity={0.85}
                    transform={`rotate(${t * 12} ${x + 45} ${y + 13})`}
                  />
                );
              })}
            </g>
          </svg>
        ) : null}
      </div>
      <Footnote delay={cleanAt}>{'副桌上是全新对话记录：干干净净，只有一句任务说明'}</Footnote>
    </AbsoluteFill>
  );
};

/** 副桌（mech 描边）+ 缩小克隆环（同色同宽，尺寸小）+ 干净态三行对话。 */
const MiniDeskWithRing: React.FC<{cleanAt: number; fly: number}> = ({cleanAt, fly}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.6);
  const deskW = 600;
  return (
    <div style={{position: 'relative', width: deskW}}>
      <Desk width={deskW} height={380} accent={theme.mech}>
        <div style={{position: 'absolute', inset: 12}}>
          {/* 缩小克隆环：分身自己的循环（尺寸小于 260 时关标签） */}
          <div style={{position: 'absolute', left: 8, top: 8, opacity: 0.95}}>
            <LoopRing size={150} draw={1} dotProgress={dot} showExit={false} showLabels={false} />
          </div>
          {/* 干净态：仅一句任务说明 + 少量工具块 */}
          <div style={{position: 'absolute', left: 180, top: 26, right: 16}}>
            <Chip kind="task" label="任务：追这个缺陷" width={240} height={34} style={{fontSize: 20}} />
            <div style={{marginTop: 12, opacity: interpolate(frame - cleanAt, [0, 14], [0.35, 0.95], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
              <div style={{marginBottom: 8}}>
                <Chip kind="tool" label="tool: read" width={200} />
              </div>
              <div style={{marginBottom: 8}}>
                <Chip kind="tool" label="tool: bash" width={190} />
              </div>
              <Chip kind="model" label="assistant" width={210} />
            </div>
          </div>
        </div>
      </Desk>
      <div
        style={{
          position: 'absolute',
          left: 10,
          bottom: -32,
          fontFamily: theme.mono,
          fontSize: 19,
          color: theme.dim,
          opacity: 0.8,
        }}
      >
        {'messages[] = [任务说明]'}
      </div>
      <div style={{position: 'absolute', right: 0, top: -46, opacity: fly > 0.9 ? 1 : 0}}>
        <div
          style={{
            fontFamily: theme.sans,
            fontSize: 22,
            color: theme.mech,
            border: `2px solid ${theme.mech}`,
            borderRadius: 8,
            padding: '4px 12px',
          }}
        >
          {'分身在此跑自己的循环'}
        </div>
      </div>
    </div>
  );
};

/** 2-C 分屏：副桌小环转动 + 工具调用闪现；主桌只收到一张回执卡（view）。 */
const SplitReceipt: React.FC<{receiptAt: number; fadeAt: number}> = ({receiptAt, fadeAt}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.4);
  // 回执卡飞回主桌落定；副桌纸堆淡出
  const receipt = interpolate(frame - receiptAt, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const subFade = interpolate(frame - fadeAt, [0, 22], [1, 0.25], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 80, alignItems: 'center'}}>
        {/* 主桌：只收到一张回执卡 */}
        <div style={{position: 'relative'}}>
          <Desk width={640} height={400}>
            <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              {receipt > 0 ? (
                <div
                  style={{
                    /* 回执从右侧副桌飞回主桌：起点在主桌右外 480px、上方 160px */
                    transform: `translate(${(1 - receipt) * 480}px, ${(1 - receipt) * -160}px) scale(${0.7 + 0.3 * receipt})`,
                    opacity: receipt,
                  }}
                >
                  <Panel accent={theme.view} style={{width: 420, padding: '20px 24px'}}>
                    <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'回执 · 最后一条结论'}</div>
                    <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text, marginTop: 10, lineHeight: 1.5}}>
                      {'缺陷在 rename_util.py:41，'}
                      <br />
                      {'已修，测试全绿。'}
                    </div>
                  </Panel>
                </div>
              ) : (
                <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>{'等待中……'}</div>
              )}
            </div>
          </Desk>
          <div style={{textAlign: 'center', marginTop: 12, fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
            {'主桌：看不见中间过程'}
          </div>
        </div>
        {/* 副桌：小环转动 + 工具调用闪现 */}
        <div style={{position: 'relative', opacity: subFade}}>
          <Desk width={640} height={400} accent={theme.mech}>
            <div style={{position: 'absolute', inset: 12}}>
              <div style={{position: 'absolute', left: 20, top: 30}}>
                <LoopRing size={210} draw={1} dotProgress={dot} showExit={false} showLabels={false} />
              </div>
              <div style={{position: 'absolute', right: 20, top: 30, width: 330}}>
                {['tool: read a.py', 'tool: read b.py', 'tool: edit c.py', 'tool: bash pytest'].map((l, i) => {
                  const on = frame >= i * 20 + 10;
                  return (
                    <div key={l} style={{marginBottom: 10, opacity: on ? 1 : 0.2}}>
                      <Chip kind="tool" label={l} width={300} height={30} style={{fontSize: 17}} />
                    </div>
                  );
                })}
              </div>
            </div>
          </Desk>
          <div style={{textAlign: 'center', marginTop: 12, fontFamily: theme.sans, fontSize: 24, color: theme.mech}}>
            {'副桌：三十个文件在这里读'}
          </div>
        </div>
      </div>
      <Footnote delay={receiptAt + 30}>{'丢的只是纸，不是活 —— 写过的文件都在硬盘上'}</Footnote>
    </AbsoluteFill>
  );
};

/** 2-D 两条纪律：派活卡 deny 描边+锁定图标；分身动手前迷你闸门逐次落下。 */
const TwoDisciplines: React.FC<{lockAt: number; gateAt: number; dotAt: number}> = ({
  lockAt,
  gateAt,
  dotAt,
}) => {
  const frame = useCurrentFrame();
  const lock = spring({frame: frame - lockAt, fps: 30, config: {damping: 12}});
  const gateDrop = interpolate(frame - gateAt, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 请求过闸打点
  const pass = interpolate(frame - dotAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const tools = ['读文件', '跑命令', '改文件', '写清单'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1460, height: 620}}>
        {/* 左：副桌工具卡阵列——「派活」卡打叉上锁 */}
        <div style={{position: 'absolute', left: 0, top: 60}}>
          <div
            style={{
              fontFamily: theme.sans,
              fontSize: 25,
              color: theme.dim,
              marginBottom: 18,
            }}
          >
            {'分身的工具表'}
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 190px)', gap: 16}}>
            {tools.map((t, i) => (
              <Panel
                key={t}
                accent={i === 3 ? theme.deny : theme.panelBorder}
                style={{
                  width: 190,
                  padding: '16px 16px',
                  position: 'relative',
                  background: i === 3 ? theme.denyDeep : theme.panel,
                }}
              >
                <div style={{fontFamily: theme.sans, fontSize: 24, color: i === 3 ? theme.deny : theme.text}}>
                  {t}
                </div>
                <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 4}}>
                  {i === 3 ? 'task（不存在）' : 'ok'}
                </div>
                {/* 锁定图标：派活卡打叉上锁 */}
                {i === 3 && lock > 0.05 ? (
                  <svg width={100} height={100} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
                    <g opacity={lock}>
                      <line x1={30} y1={20} x2={30 + 52 * lock} y2={20 + 70 * lock} stroke={theme.deny} strokeWidth={7} strokeLinecap="round" />
                      {/* 挂锁：锁体 + 锁梁 */}
                      <g transform="translate(140 64) scale(0.5)">
                        <rect x={-20} y={0} width={40} height={30} rx={6} fill={theme.deny} />
                        <path d="M-12 0 v-12 a12 12 0 0 1 24 0 v12" fill="none" stroke={theme.deny} strokeWidth={7} />
                      </g>
                    </g>
                  </svg>
                ) : null}
              </Panel>
            ))}
          </div>
          <div
            style={{
              marginTop: 18,
              fontFamily: theme.sans,
              fontSize: 22,
              color: theme.deny,
              opacity: interpolate(frame - lockAt - 6, [0, 12], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {'不许再往下派 —— 防孙子孙无穷尽'}
          </div>
        </div>
        {/* 右：迷你闸门（P3 语言复用）逐次落下，请求过闸打点 */}
        <div style={{position: 'absolute', right: 0, top: 90, width: 560}}>
          <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.dim, marginBottom: 16}}>
            {'动手之前：照样过闸'}
          </div>
          <svg width={560} height={300}>
            <line x1={30} y1={170} x2={530} y2={170} stroke={theme.panelBorder} strokeWidth={4} />
            {['禁止表', '规则', '问你'].map((g, i) => {
              const gx = 120 + i * 150;
              const h = 96 * gateDrop;
              const c = i === 0 ? theme.deny : theme.mech;
              return (
                <g key={g}>
                  <rect x={gx - 8} y={170 - h} width={16} height={h} rx={5} fill={c} />
                  <text x={gx} y={170 - h - 14} textAnchor="middle" fontFamily={theme.sans} fontSize={21} fontWeight={600} fill={c}>
                    {g}
                  </text>
                </g>
              );
            })}
            {/* 请求光点过闸 */}
            {pass > 0 ? (
              <g>
                <circle cx={40 + pass * 480} cy={170} r={13} fill={theme.view} />
                {pass >= 1 ? (
                  <text x={520} y={130} textAnchor="end" fontFamily={theme.sans} fontSize={24} fontWeight={700} fill={theme.view}>
                    {'放行'}
                  </text>
                ) : null}
              </g>
            ) : null}
          </svg>
          <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim, marginTop: 8, textAlign: 'center'}}>
            {'隔离的是视野，不是权限'}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 2-E ★五要素等号锁：两桌并置，五要素卡逐张比对，全部对上后锁扣合拢、SAVE 印章砸下。 */
const FiveFactorLock: React.FC<{
  compareAt: number[];
  lockAt: number;
  saveAt: number;
  costAt?: number;
  recalcAt?: number;
  copyAt?: number;
}> = ({compareAt, lockAt, saveAt, costAt, recalcAt, copyAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const factors = ['系统提示', '工具表', '模型', '消息前缀', '思考配置'];
  const matched = compareAt.map((a) => frame >= a + 14);
  // 前段视觉事件（2026-08 品控修）：本 beat 覆盖 9 句 50.7 秒，原首锚落在第 7 句（p2-22），
  // 前 34 秒只有两个静态标签 + 五个孤立「≠」。补三拍：计价 → 原价重算 → 原样搬。
  const cost = costAt === undefined ? 0 : interpolate(frame - costAt, [0, 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const recalc = recalcAt === undefined ? 0 : interpolate(frame - recalcAt, [0, 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const copy = copyAt === undefined ? 0 : interpolate(frame - copyAt, [0, 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const allOn = frame >= lockAt;
  const lock = spring({frame: frame - lockAt, fps, config: {damping: 13}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1560, height: 760}}>
        {/* 两桌并置 */}
        <div style={{position: 'absolute', left: 20, top: 30}}>
          <MiniDeskLabel title="父亲桌" accent={theme.view} />
        </div>
        <div style={{position: 'absolute', right: 20, top: 30}}>
          <MiniDeskLabel title="分身桌" accent={theme.mech} />
        </div>
        {/* 前段三拍（p2-19/20/21）：计价条 → 前缀全变红重算 → 原样搬回绿 */}
        {cost > 0 ? (
          <div style={{position: 'absolute', left: 1560 / 2 - 300, top: 92, width: 600, opacity: cost}}>
            <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, textAlign: 'center'}}>
              {'对话按字数花钱 · 同样的开头，第二遍近乎免费'}
            </div>
            <div style={{display: 'flex', gap: 6, marginTop: 10, justifyContent: 'center'}}>
              {Array.from({length: 12}).map((_, i) => {
                // 前缀 8 格：recalc 时整体转红（原价重算），copy 时转回 mech（命中）
                const isPrefix = i < 8;
                const red = isPrefix && recalc > 0.3 && copy < 0.3;
                const hit = isPrefix && copy > 0.3;
                return (
                  <div
                    key={i}
                    style={{
                      width: 34,
                      height: 16,
                      borderRadius: 3,
                      background: red ? theme.deny : hit ? theme.mech : isPrefix ? theme.panelBorder : theme.panel,
                      border: `1px solid ${red ? theme.deny : hit ? theme.mech : theme.panelBorder}`,
                      opacity: isPrefix ? 1 : 0.45,
                    }}
                  />
                );
              })}
            </div>
            {recalc > 0.3 ? (
              <div style={{fontFamily: theme.sans, fontSize: 20, color: copy > 0.3 ? theme.mech : theme.deny, textAlign: 'center', marginTop: 8}}>
                {copy > 0.3 ? '原样搬过去 · 前缀一致 → 命中' : '前缀全变 → 每一段原价重算'}
              </div>
            ) : null}
          </div>
        ) : null}
        {/* 五要素卡：左右滑入逐字节对齐（每对上一张亮 mech）。行内容 880px 居中（px 数学，红线一） */}
        <div style={{position: 'absolute', left: 1560 / 2 - 440, top: 130}}>
          {factors.map((f, i) => {
            const t = interpolate(frame - compareAt[i], [0, 18], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const m = matched[i];
            return (
              <div key={f} style={{display: 'flex', alignItems: 'center', marginBottom: 14}}>
                {/* 父侧卡（从左滑入） */}
                <div style={{transform: `translateX(${(1 - t) * -80}px)`, opacity: t}}>
                  <Panel
                    accent={m ? theme.mech : theme.panelBorder}
                    style={{width: 340, padding: '12px 18px', background: m ? theme.mechDeep : theme.panel}}
                  >
                    <div style={{fontFamily: theme.sans, fontSize: 23, color: m ? theme.mech : theme.text}}>{f}</div>
                    <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 2}}>
                      {m ? '逐字节一致' : '比对中……'}
                    </div>
                  </Panel>
                </div>
                {/* 中缝：等号或问号 */}
                <div style={{width: 200, textAlign: 'center', fontFamily: theme.mono, fontSize: 40, fontWeight: 700, color: m ? theme.mech : theme.dim, opacity: t}}>
                  {m ? '=' : '≠'}
                </div>
                {/* 子侧卡（从右滑入） */}
                <div style={{transform: `translateX(${(1 - t) * 80}px)`, opacity: t}}>
                  <Panel
                    accent={m ? theme.mech : theme.panelBorder}
                    style={{width: 340, padding: '12px 18px', background: m ? theme.mechDeep : theme.panel}}
                  >
                    <div style={{fontFamily: theme.sans, fontSize: 23, color: m ? theme.mech : theme.text}}>{f}</div>
                    <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 2}}>
                      {m ? '逐字节一致' : '比对中……'}
                    </div>
                  </Panel>
                </div>
              </div>
            );
          })}
        </div>
        {/* 等号锁扣：全部对上后「咔」合拢 */}
        {lock > 0.02 ? (
          <svg width={1560} height={760} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
            <g transform="translate(780 60)" opacity={lock}>
              <rect x={-120} y={-26} width={240} height={52} rx={10} fill={theme.panel} stroke={theme.mech} strokeWidth={4} />
              <text x={0} y={10} textAnchor="middle" fontFamily={theme.sans} fontSize={28} fontWeight={700} fill={theme.mech}>
                {'五要素全等'}
              </text>
              {/* 锁扣咬合动画：两半锁环合拢 */}
              <path
                d={`M-160 -8 a30 30 0 0 1 ${lock * 30} ${-26 * lock}`}
                fill="none"
                stroke={theme.mech}
                strokeWidth={7}
                strokeLinecap="round"
              />
              <path
                d={`M160 -8 a30 30 0 0 0 ${-lock * 30} ${-26 * lock}`}
                fill="none"
                stroke={theme.mech}
                strokeWidth={7}
                strokeLinecap="round"
              />
            </g>
          </svg>
        ) : null}
        {/* SAVE 印章砸下 + 冲击波 */}
        {allOn ? (
          <>
            <Stamp text="SAVE" color={theme.mech} at={saveAt} size={150} rotate={10} style={{position: 'absolute', right: 120, bottom: 60}} />
            <svg width={1560} height={760} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
              {frame - saveAt < 24 ? (
                <circle
                  cx={1380}
                  cy={640}
                  r={40 + ((frame - saveAt) / 24) * 180}
                  fill="none"
                  stroke={theme.mech}
                  strokeWidth={5}
                  opacity={1 - (frame - saveAt) / 24}
                />
              ) : null}
            </svg>
          </>
        ) : null}
      </div>
      <Footnote delay={saveAt + 6}>
        {'fork 继承完整对话 · 共享提示缓存 —— 官方文档 sub-agents'}
      </Footnote>
    </AbsoluteFill>
  );
};

const MiniDeskLabel: React.FC<{title: string; accent: string}> = ({title, accent}) => (
  <div
    style={{
      fontFamily: theme.serif,
      fontSize: 34,
      fontWeight: 700,
      color: accent,
      border: `3px solid ${accent}`,
      borderRadius: 12,
      padding: '10px 26px',
    }}
  >
    {title}
  </div>
);

/** 2-F 半拉隔离：共享抽屉 + 审批卡冒泡上浮 + 收束金句。 */
const SharedDrawer: React.FC<{drawerAt: number; bubbleAt: number; cagesAt: number; quoteAt: number}> = ({
  drawerAt,
  bubbleAt,
  cagesAt,
  quoteAt,
}) => {
  const frame = useCurrentFrame();
  if (frame >= quoteAt) {
    return <QuoteCard zh="脏活不占主桌。" accent={theme.view} />;
  }
  const open = interpolate(frame - drawerAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bubble = interpolate(frame - bubbleAt, [0, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1500, height: 660}}>
        {/* 两桌（缩略） */}
        <div style={{position: 'absolute', left: 40, top: 40}}>
          <Desk width={520} height={280} accent={theme.view}>
            <div style={{position: 'absolute', left: 18, top: 18, fontFamily: theme.sans, fontSize: 24, color: theme.view}}>
              {'父亲桌'}
            </div>
          </Desk>
        </div>
        <div style={{position: 'absolute', right: 40, top: 40}}>
          <Desk width={520} height={280} accent={theme.mech}>
            <div style={{position: 'absolute', left: 18, top: 18, fontFamily: theme.sans, fontSize: 24, color: theme.mech}}>
              {'分身桌'}
            </div>
          </Desk>
        </div>
        {/* 共享抽屉：虚线双桌共连，盖半开、两端各画一只手同时拉开 */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 380}}>
          <div
            style={{
              margin: '0 auto',
              width: 700,
              height: 130,
              border: `3px dashed ${theme.dim}`,
              borderRadius: 12,
              position: 'relative',
              background: theme.panel,
              opacity: interpolate(frame - drawerAt, [0, 14], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {/* 抽屉盖半开：盖板向右滑出 20% */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${100 - open * 22}%`,
                borderRight: `3px solid ${theme.dim}`,
                background: `${theme.panelBorder}55`,
                borderRadius: '12px 0 0 12px',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.mono,
                fontSize: 22,
                color: theme.dim,
              }}
            >
              {'读过的文件（readFileState）'}
            </div>
            {/* 两端各一只手同时拉开 */}
            {open > 0.1 ? (
              <>
                <svg width={40} height={40} style={{position: 'absolute', left: -46, top: 46}}>
                  <path d="M6 34 L20 20 M12 34 L26 20 M18 34 L32 20" stroke={theme.dim} strokeWidth={4} strokeLinecap="round" />
                  <path d="M4 38 q8 -8 18 -8 l14 -14" fill="none" stroke={theme.dim} strokeWidth={4} strokeLinecap="round" />
                </svg>
                <svg width={40} height={40} style={{position: 'absolute', right: -46, top: 46, transform: 'scaleX(-1)'}}>
                  <path d="M6 34 L20 20 M12 34 L26 20 M18 34 L32 20" stroke={theme.dim} strokeWidth={4} strokeLinecap="round" />
                  <path d="M4 38 q8 -8 18 -8 l14 -14" fill="none" stroke={theme.dim} strokeWidth={4} strokeLinecap="round" />
                </svg>
              </>
            ) : null}
          </div>
        </div>
        {/* 审批卡气泡：沿虚线路径从副桌冒泡上浮到主桌屏幕 */}
        {bubble > 0 && bubble < 1 ? (
          <svg width={1500} height={660} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
            <path
              d="M 1120 320 C 1180 240, 760 190, 380 250"
              fill="none"
              stroke={theme.view}
              strokeWidth={3}
              strokeDasharray="7 7"
              opacity={0.5}
            />
          </svg>
        ) : null}
        {bubble > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 940 + (1 - bubble) * 130 - bubble * 500,
              top: 320 - bubble * 200,
              opacity: Math.min(1, bubble * 2),
            }}
          >
            <Panel accent={theme.view} style={{width: 330, padding: '14px 18px'}}>
              <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>{'分身要弹审批窗'}</div>
              <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.view, marginTop: 6}}>
                {'冒泡到父亲屏幕 —— 还是你说了算'}
              </div>
            </Panel>
          </div>
        ) : null}
        {/* p2-28a..c 三只笼子：在场上限 20 / 轮数上限 / 上下文配额（Harness Engineering 改造） */}
        {frame >= cagesAt ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 368,
              display: 'flex',
              justifyContent: 'center',
              gap: 22,
            }}
          >
            {[
              {t: '同时在场', n: '≤ 20'},
              {t: '轮数上限', n: '每只有限'},
              {t: '上下文配额', n: '烧完收工'},
            ].map((c, i) => {
              const e = interpolate(frame - cagesAt - i * 6, [0, 10], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              return (
                <div
                  key={c.t}
                  style={{
                    width: 300,
                    border: `2.5px solid ${theme.mech}`,
                    borderRadius: 10,
                    background: theme.panel,
                    padding: '12px 16px',
                    textAlign: 'center',
                    opacity: e,
                    transform: `translateY(${(1 - e) * 14}px)`,
                  }}
                >
                  <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.text}}>{c.t}</div>
                  <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.mech, marginTop: 4}}>{c.n}</div>
                </div>
              );
            })}
          </div>
        ) : null}
        {/* 虚线连线标签：桌是分开了，有些抽屉还是共用的 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 30,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 25,
            color: theme.dim,
            opacity: interpolate(frame - bubbleAt - 20, [0, 14], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {'隔离是半拉的：免得同一个文件读两遍'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const P2SideDesk: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p2-01', 'p2-04');
  const relA = (id: string) => at(id) - bA.from;
  const bB = w('p2-05', 'p2-07');
  const relB = (id: string) => at(id) - bB.from;
  const bC = w('p2-08', 'p2-11');
  const relC = (id: string) => at(id) - bC.from;
  const bD = w('p2-12', 'p2-15');
  const relD = (id: string) => at(id) - bD.from;
  const bE = w('p2-16', 'p2-24');
  const relE = (id: string) => at(id) - bE.from;
  const bF = w('p2-25', 'p2-30');
  const relF = (id: string) => at(id) - bF.from;
  return (
    <AbsoluteFill>
      <SceneHeader index="P2" title="另开一张副桌" meta="Subagent · fork shares prefix cache" />
      <Sequence {...bA} name="2-A 桌面暴涨与计费">
        {/* p2-03「一百多条」起暴涨；p2-04「一直计着费」起计数器 */}
        <DeskFlood floodAt={relA('p2-03')} billAt={relA('p2-04')} />
      </Sequence>
      <Sequence {...bB} name="2-B 副桌滑出">
        {/* p2-06「另开一张干净的副桌」滑入；纸堆随即飞过去 */}
        <SideDeskSlidesOut slideAt={relB('p2-06')} flyAt={relB('p2-06') + 26} cleanAt={relB('p2-07')} />
      </Sequence>
      <Sequence {...bC} name="2-C 分屏回执">
        <SplitReceipt receiptAt={relC('p2-09')} fadeAt={relC('p2-10')} />
      </Sequence>
      <Sequence {...bD} name="2-D 派活上锁与迷你闸门">
        {/* p2-12 第一条纪律（无派活工具）；p2-14 第二条（照样过闸） */}
        <TwoDisciplines lockAt={relD('p2-12')} gateAt={relD('p2-14')} dotAt={relD('p2-14') + 20} />
      </Sequence>
      <Sequence {...bE} name="2-E 五要素等号锁">
        {/* p2-22 列举五要素 → 逐张比对；p2-23「五样一字不差」锁合拢；SAVE 随后砸下 */}
        <FiveFactorLock
          compareAt={[
            relE('p2-22'),
            relE('p2-22') + 10,
            relE('p2-22') + 20,
            relE('p2-22') + 30,
            relE('p2-22') + 40,
          ]}
          lockAt={relE('p2-23')}
          saveAt={relE('p2-23') + 24}
          costAt={relE('p2-19')}
          recalcAt={relE('p2-20')}
          copyAt={relE('p2-21')}
        />
      </Sequence>
      <Sequence {...bF} name="2-F 共享抽屉·审批冒泡·三只笼子">
        {/* p2-26「有些抽屉还是共用的」抽屉拉开；p2-27 审批卡冒泡；p2-28a 三只笼子；p2-29 收束金句 */}
        <SharedDrawer
          drawerAt={relF('p2-26')}
          bubbleAt={relF('p2-27')}
          cagesAt={relF('p2-28a')}
          quoteAt={relF('p2-29')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
