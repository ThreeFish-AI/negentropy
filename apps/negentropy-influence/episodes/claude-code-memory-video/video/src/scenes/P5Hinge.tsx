/** P5 先抢救，再碎纸（分镜 5-A…5-E）—— 全片题眼：两套机制咬合的瞬间
 *  5-A ★系列锚帧·时间铰链：左「轮末提取」（抄 tab 字条进登记簿，keep）与右「随后压缩」
 *      （碎纸机褪色）并置；中缝陶土橙环匀速转（core 色、6px 绝对线宽、四节点同系列）；
 *  5-B 顺序章盖下 + 登记簿 tab 条目定格；
 *  5-C 做梦铭牌深夜亮起；
 *  5-D 四道闸逐道砸落；
 *  5-E 锁即时钟（表盘/崩溃快进 1h 锁化开）+ 金句卡。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Footnote, Ledger, LoopRing, Panel, SceneHeader, useRingDot} from '../components/motifs';

/** 5-A ★时间铰链：双时间线并行 + 中缝环照转。
 *  左线：从完整对话快照抄走 tab 字条 → keep 登记簿（先完成）；
 *  右线：随后碎纸机开动 → 桌面纸堆褪色（后启动）。
 *  中缝：陶土橙环（系列锚）匀速旋转——两件事之间，循环照转。 */
const TimeHinge: React.FC<{leftAt: number; rightAt: number}> = ({leftAt, rightAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 环描线成形后匀速巡游（不变式：core 色、6px 绝对线宽、四节点同系列）
  const draw = interpolate(frame, [6, 36], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const dot = useRingDot(2.6, 36);
  // 左线：抄写进度（快照 → 登记簿）
  const copyT = interpolate(frame - leftAt, [0, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 右线：碎纸进度（纸堆褪色——不用颜色画丢失）
  const shredT = interpolate(frame - rightAt, [0, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const copyDone = copyT >= 1;
  return (
    <AbsoluteFill>
      {/* 中缝：环（压缩瞬间的系列锚——同色同宽同节点） */}
      <div
        style={{
          position: 'absolute',
          left: 1920 / 2 - 155,
          top: 1080 / 2 - 175,
        }}
      >
        <LoopRing size={310} draw={draw} dotProgress={draw > 0.98 ? dot : undefined} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: -56,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 22,
            color: theme.core,
          }}
        >
          {'循环照转'}
        </div>
      </div>

      {/* 左时间线：轮末提取（先完成） */}
      <div style={{position: 'absolute', left: 96, top: 200, width: 620}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.keep}}>{'T1'}</span>
          <span style={{fontFamily: theme.serif, fontSize: 38, fontWeight: 700, color: theme.keep}}>
            {'轮末 · 提取'}
          </span>
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginTop: 6}}>
          {'停机钩子触发 · 读压缩前的完整快照'}
        </div>
        {/* 快照纸堆 → 抄写线 → 登记簿 */}
        <div style={{display: 'flex', alignItems: 'center', gap: 18, marginTop: 30}}>
          <div style={{position: 'relative'}}>
            <div
              style={{
                width: 190,
                height: 150,
                borderRadius: 10,
                border: `2px solid ${theme.panelBorder}`,
                background: theme.panel,
                padding: 12,
                opacity: 1 - shredT * 0.35,
              }}
            >
              {['任务书', 'tab 字条', '中间过程'].map((t, i) => (
                <div
                  key={t}
                  style={{
                    height: 30,
                    borderRadius: 6,
                    background: theme.text,
                    opacity: t === 'tab 字条' ? 0.6 : 0.22,
                    marginTop: 8,
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 10,
                    fontFamily: theme.mono,
                    fontSize: 16,
                    color: theme.bg,
                    fontWeight: 700,
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 8, textAlign: 'center'}}>
              {'完整快照'}
            </div>
          </div>
          {/* 抄写进度线 */}
          <svg width={140} height={60}>
            <line
              x1={0}
              y1={30}
              x2={130 * copyT}
              y2={30}
              stroke={theme.keep}
              strokeWidth={5}
              strokeLinecap="round"
            />
            {copyT > 0.9 ? <polygon points="130,30 112,20 112,40" fill={theme.keep} /> : null}
          </svg>
          {/* 登记簿（keep）：tab 字条被抄进去 */}
          <div style={{position: 'relative'}}>
            <Ledger w={190} h={150} pages={4}>
              <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.keep}}>{'登记簿'}</div>
              <div
                style={{
                  fontFamily: theme.mono,
                  fontSize: 15,
                  color: theme.text,
                  marginTop: 8,
                  whiteSpace: 'nowrap',
                  opacity: copyT,
                }}
              >
                {'tab 字条'}
              </div>
              <div
                style={{
                  fontFamily: theme.mono,
                  fontSize: 13,
                  color: theme.dim,
                  marginTop: 6,
                  whiteSpace: 'nowrap',
                  opacity: copyT,
                }}
              >
                {'一个字不差'}
              </div>
            </Ledger>
          </div>
        </div>
        {copyDone ? (
          <div
            style={{
              marginTop: 22,
              fontFamily: theme.mono,
              fontSize: 24,
              color: theme.keep,
              opacity: interpolate(frame - leftAt - 40, [0, 10], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {'✓ 先抢救完成'}
          </div>
        ) : null}
        <div
          style={{
            marginTop: 10,
            fontFamily: theme.mono,
            fontSize: 18,
            color: theme.dim,
            opacity: interpolate(frame - leftAt - 52, [0, 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {'提取器权限受限 · 最多五回合 · 干完不进对话'}
        </div>
      </div>

      {/* 右时间线：随后压缩（后启动、碎纸褪色） */}
      <div style={{position: 'absolute', right: 96, top: 200, width: 620, textAlign: 'right'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'flex-end'}}>
          <span style={{fontFamily: theme.serif, fontSize: 38, fontWeight: 700, color: theme.dim}}>
            {'随后 · 压缩'}
          </span>
          <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.dim}}>{'T2'}</span>
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginTop: 6}}>
          {'碎纸机开动 · 桌面细节开始褪色'}
        </div>
        {/* 碎纸机：桌面纸堆送入，输出褪色碎条 */}
        <div style={{display: 'flex', alignItems: 'center', gap: 20, marginTop: 30, justifyContent: 'flex-end'}}>
          <div style={{position: 'relative'}}>
            <div style={{display: 'flex', gap: 6}}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 34,
                    height: 96,
                    borderRadius: 6,
                    background: theme.panel,
                    border: `2px solid ${theme.panelBorder}`,
                    opacity: (1 - shredT) * 0.9 + 0.1,
                    filter: `brightness(${1 - shredT * 0.5})`,
                  }}
                />
              ))}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 8, textAlign: 'center'}}>
              {'桌面纸堆'}
            </div>
          </div>
          {/* 碎纸机本体 */}
          <div
            style={{
              width: 120,
              height: 150,
              borderRadius: 12,
              border: `3px solid ${theme.panelBorder}`,
              background: theme.panel,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div key={i} style={{width: 64, height: 6, borderRadius: 3, background: theme.panelBorder}} />
            ))}
          </div>
          {/* 碎纸输出：褪色纸条落下 */}
          {shredT > 0
            ? Array.from({length: 5}).map((_, i) => {
                const fall = interpolate(frame - rightAt - i * 4, [0, 34], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                });
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      right: 30 + i * 20,
                      top: 60 + fall * 200,
                      width: 10,
                      height: 34,
                      borderRadius: 3,
                      background: theme.text,
                      opacity: (1 - fall) * 0.4,
                    }}
                  />
                );
              })
            : null}
        </div>
        <div
          style={{
            marginTop: 22,
            fontFamily: theme.mono,
            fontSize: 24,
            color: theme.dim,
            opacity: interpolate(frame - rightAt - 30, [0, 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {'碎纸才启动'}
        </div>
      </div>

      {/* 中缝铰链箭头：T1 → T2 的先后（先抢救，再碎纸） */}
      <div style={{position: 'absolute', left: 1920 / 2 - 170, top: 1080 / 2 + 190, width: 340}}>
        <svg width={340} height={40}>
          <line
            x1={10}
            y1={20}
            x2={330 * interpolate(frame - rightAt, [0, 20], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}
            y2={20}
            stroke={theme.dim}
            strokeWidth={3}
            strokeDasharray="8 8"
          />
        </svg>
        <div
          style={{
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 22,
            color: theme.dim,
            marginTop: 4,
          }}
        >
          {'先 T1 后 T2'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 5-B 两线汇合：keep 顺序章盖下；登记簿翻到 tab 条目定格（从此不进碎纸机） */
const OrderStamp: React.FC<{stampAt: number; settleAt: number}> = ({stampAt, settleAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stamp = spring({frame: frame - stampAt, fps, config: {damping: 12}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', display: 'flex', gap: 90, alignItems: 'center'}}>
        {/* 顺序章：先抢救 ✓ 再碎纸 ✓ */}
        <div style={{position: 'relative'}}>
          <Panel style={{width: 560, padding: '30px 36px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'顺序图章'}</div>
            {[
              {t: '先抢救', mark: '✓'},
              {t: '再碎纸', mark: '✓'},
            ].map((r, i) => (
              <div
                key={r.t}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  marginTop: 18,
                  opacity: interpolate(frame - stampAt - i * 10, [0, 10], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
                }}
              >
                <span style={{fontSize: 34, fontWeight: 700, color: theme.keep}}>{r.mark}</span>
                <span style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.text}}>
                  {r.t}
                </span>
              </div>
            ))}
          </Panel>
          {/* 盖章：keep 描边章落下 */}
          {stamp > 0 ? (
            <div
              style={{
                position: 'absolute',
                left: 330,
                top: 60,
                padding: '8px 20px',
                border: `4px solid ${theme.keep}`,
                borderRadius: 10,
                fontFamily: theme.mono,
                fontSize: 28,
                fontWeight: 700,
                color: theme.keep,
                opacity: stamp,
                transform: `rotate(${-10 + 4 * stamp}deg) scale(${1.6 - 0.6 * stamp})`,
                whiteSpace: 'nowrap',
              }}
            >
              {'顺序锁死'}
            </div>
          ) : null}
        </div>
        {/* 登记簿 tab 条目定格 */}
        <div>
          <Ledger w={420} h={330} pages={7} glow={interpolate(frame - settleAt, [0, 14], [0, 0.7], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.keep}}>{'user-preference-tabs.md'}</div>
            <div style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.text, marginTop: 18}}>
              {'缩进用 tab，'}
            </div>
            <div style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.text, marginTop: 6}}>
              {'别用空格'}
            </div>
            <div
              style={{
                fontFamily: theme.sans,
                fontSize: 24,
                color: theme.keep,
                marginTop: 26,
                opacity: interpolate(frame - settleAt, [0, 14], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              {'从此不进碎纸机'}
            </div>
          </Ledger>
        </div>
      </div>
      <Footnote delay={stampAt}>{'停机钩子触发提取 · 压缩前快照 —— 第三方的源码分析'}</Footnote>
    </AbsoluteFill>
  );
};

/** 5-C 做梦铭牌：本子越积越厚 + 深夜压暗 + 「梦」字铭牌 keep 辉光亮起 */
const DreamPlate: React.FC<{thickenAt: number; nightAt: number; plateAt: number}> = ({
  thickenAt,
  nightAt,
  plateAt,
}) => {
  const frame = useCurrentFrame();
  // 页缘膨胀：pages 由少变多
  const pages = Math.round(
    interpolate(frame - thickenAt, [0, 30], [6, 14], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  // 深夜压暗
  const night = interpolate(frame - nightAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const plate = interpolate(frame - plateAt, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {/* 夜幕压暗层 */}
      <AbsoluteFill style={{background: '#05070B', opacity: night * 0.62, pointerEvents: 'none'}} />
      <div style={{position: 'relative', display: 'flex', gap: 110, alignItems: 'center', zIndex: 1}}>
        {/* 越来越厚的本子 */}
        <Ledger w={340} h={320} pages={pages}>
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.keep}}>{'登记簿'}</div>
          {['plan-review.md', 'data-no-mock.md', 'compliance-note.md', '…重复 · 过时'].map((f, i) => (
            <div
              key={f}
              style={{
                fontFamily: theme.mono,
                fontSize: 17,
                color: i === 3 ? theme.dim : theme.text,
                marginTop: 10,
                whiteSpace: 'nowrap',
              }}
            >
              {f}
            </div>
          ))}
        </Ledger>
        {/* 铭牌：梦 */}
        <div style={{position: 'relative'}}>
          <div
            style={{
              width: 360,
              padding: '40px 0',
              borderRadius: 16,
              border: `4px solid ${plate > 0.3 ? theme.keep : theme.panelBorder}`,
              background: theme.panel,
              textAlign: 'center',
              boxShadow: plate > 0.3 ? `0 0 ${Math.round(52 * plate)}px ${theme.keep}` : 'none',
              opacity: plate,
            }}
          >
            <div style={{fontFamily: theme.serif, fontSize: 120, fontWeight: 700, color: theme.keep}}>{'梦'}</div>
            <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, marginTop: 8}}>{'Dream'}</div>
          </div>
          <div
            style={{
              marginTop: 22,
              fontFamily: theme.sans,
              fontSize: 25,
              color: theme.text,
              textAlign: 'center',
              opacity: interpolate(frame - plateAt - 10, [0, 12], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {'整理本子的活，正式名字叫「做梦」'}
          </div>
        </div>
      </div>
      <Footnote delay={plateAt}>{'同一件事记了三遍、过时的没淘汰，就得整理 —— 第三方的源码分析'}</Footnote>
    </AbsoluteFill>
  );
};

/** 5-D 四道闸逐道砸落（panel 底 + 编号，理由行；全过后通路亮起） */
const FourGatesFall: React.FC<{gateAt: number[]}> = ({gateAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const gates = [
    {t: '24 小时', why: '距上次整理不满一天，不做——好记性不差这一天'},
    {t: '扫描节流', why: '翻文件夹本身也有成本'},
    {t: '会话够数', why: '攒的会话记录不够数，素材太少不值得动笔'},
    {t: '文件锁', why: '有别的进程正在整理，两个梦会打架'},
  ];
  const allDown = frame >= gateAt[3] + 16;
  const lit = interpolate(frame - (gateAt[3] + 16), [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1420, height: 620}}>
        {/* 通路：一条水平轨道，全过后亮起 */}
        <svg width={1420} height={620} style={{position: 'absolute', inset: 0}}>
          <line x1={80} y1={310} x2={1340} y2={310} stroke={theme.panelBorder} strokeWidth={6} />
          {lit > 0 ? (
            <line
              x1={80}
              y1={310}
              x2={80 + 1260 * lit}
              y2={310}
              stroke={theme.keep}
              strokeWidth={6}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - lit}
            />
          ) : null}
        </svg>
        {gates.map((g, i) => {
          const drop = spring({frame: frame - gateAt[i], fps, config: {damping: 12}});
          const gx = 190 + i * 340;
          const h = 190 * drop;
          return (
            <div key={g.t} style={{position: 'absolute', left: gx - 90, top: 0, width: 180, textAlign: 'center'}}>
              {/* 闸门：竖落 */}
              <svg width={180} height={340}>
                <rect
                  x={80}
                  y={310 - h}
                  width={20}
                  height={h}
                  rx={6}
                  fill={theme.panel}
                  stroke={theme.panelBorder}
                  strokeWidth={3}
                />
                <text x={90} y={310 - h - 18} textAnchor="middle" fontFamily={theme.mono} fontSize={22} fill={theme.dim}>
                  {String(i + 1).padStart(2, '0')}
                </text>
              </svg>
              <div
                style={{
                  marginTop: 8,
                  fontFamily: theme.sans,
                  fontSize: 27,
                  fontWeight: 700,
                  color: drop > 0.8 ? theme.text : theme.dim,
                  opacity: drop,
                }}
              >
                {g.t}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontFamily: theme.sans,
                  fontSize: 19,
                  color: theme.dim,
                  lineHeight: 1.45,
                  opacity: drop,
                }}
              >
                {g.why}
              </div>
            </div>
          );
        })}
        {allDown ? (
          <div
            style={{
              position: 'absolute',
              right: 40,
              top: 250,
              fontFamily: theme.mono,
              fontSize: 26,
              color: theme.keep,
            }}
          >
            {'全过 → 梦开工'}
          </div>
        ) : null}
      </div>
      <Footnote delay={gateAt[0]}>
        {'四道闸（24h / 节流 / 会话数 / 文件锁）—— 第三方的源码分析'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 5-E 锁即时钟：锁文件特写 + 表盘浮现；「崩」一帧后表针快进 1h、锁化开；金句卡 */
const LockIsClock: React.FC<{faceAt: number; crashAt: number; spinAt: number; quoteAt: number}> = ({
  faceAt,
  crashAt,
  spinAt,
  quoteAt,
}) => {
  const frame = useCurrentFrame();
  if (frame >= quoteAt) {
    return (
      <QuoteCard
        zh="有些事，就该趁夜深人静做——比如整理自己是谁。"
        accent={theme.keep}
      />
    );
  }
  const face = interpolate(frame - faceAt, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 崩：一帧闪暗
  const crash = interpolate(frame - crashAt, [0, 1, 12], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 表针快进 1h（360°），随后锁化开（描边淡出 + 锁体张开）
  const spin = interpolate(frame - spinAt, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const unlock = interpolate(frame - spinAt - 24, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hourAngle = -90 + spin * 360;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <AbsoluteFill style={{background: '#05070B', opacity: 0.4 + crash * 0.5, pointerEvents: 'none'}} />
      <div style={{position: 'relative', zIndex: 1}}>
        {/* 锁体 + 表盘（drawn，无 emoji） */}
        <svg width={420} height={470}>
          {/* 锁梁：unlock 后上提张开 */}
          <path
            d={`M 130 210 v -46 a 80 80 0 0 1 160 0 v ${46 - unlock * 26}`}
            fill="none"
            stroke={unlock > 0.5 ? theme.dim : theme.text}
            strokeWidth={16}
            strokeLinecap="round"
          />
          {/* 锁体 */}
          <rect
            x={90}
            y={210}
            width={240}
            height={200}
            rx={20}
            fill={theme.panel}
            stroke={unlock > 0.4 ? theme.panelBorder : theme.text}
            strokeWidth={5}
            opacity={1 - unlock * 0.25}
          />
          {/* 表盘浮现于锁面 */}
          <g opacity={face}>
            <circle cx={210} cy={310} r={74} fill={theme.bg} stroke={theme.dim} strokeWidth={4} />
            {[0, 90, 180, 270].map((a) => {
              const rad = ((a - 90) * Math.PI) / 180;
              return (
                <circle
                  key={a}
                  cx={210 + 62 * Math.cos(rad)}
                  cy={310 + 62 * Math.sin(rad)}
                  r={3.5}
                  fill={theme.dim}
                />
              );
            })}
            {/* 时针：快进 1h = 一整圈 */}
            <line
              x1={210}
              y1={310}
              x2={210 + 44 * Math.cos((hourAngle * Math.PI) / 180)}
              y2={310 + 44 * Math.sin((hourAngle * Math.PI) / 180)}
              stroke={unlock > 0.3 ? theme.dim : theme.keep}
              strokeWidth={7}
              strokeLinecap="round"
            />
            <line x1={210} y1={310} x2={210} y2={258} stroke={theme.dim} strokeWidth={5} strokeLinecap="round" />
          </g>
        </svg>
        {crash > 0.3 ? (
          <div
            style={{
              position: 'absolute',
              left: 120,
              top: 180,
              fontFamily: theme.serif,
              fontSize: 64,
              fontWeight: 700,
              color: theme.deny,
              opacity: crash,
            }}
          >
            {'崩'}
          </div>
        ) : null}
      </div>
      <div style={{marginTop: 8, textAlign: 'center', zIndex: 1}}>
        <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>
          {'锁文件 · 上次被碰的时间 = 上次做梦的时间'}
        </div>
        <div
          style={{
            marginTop: 14,
            fontFamily: theme.sans,
            fontSize: 27,
            color: unlock > 0.5 ? theme.keep : theme.text,
            opacity: interpolate(frame - spinAt - 30, [0, 12], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {'整理到一半崩了？一小时后锁自动过期，不会死锁'}
        </div>
      </div>
      <Footnote delay={faceAt}>{'锁即时钟 · 1 小时过期 —— 第三方的源码分析'}</Footnote>
    </AbsoluteFill>
  );
};

export const P5Hinge: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p5-01', 'p5-06');
  const relA = (id: string) => at(id) - bA.from;
  const bB = w('p5-07', 'p5-10');
  const relB = (id: string) => at(id) - bB.from;
  const bC = w('p5-11', 'p5-13');
  const relC = (id: string) => at(id) - bC.from;
  const bD = w('p5-14', 'p5-17');
  const relD = (id: string) => at(id) - bD.from;
  const bE = w('p5-18', 'p5-22');
  const relE = (id: string) => at(id) - bE.from;
  return (
    <AbsoluteFill>
      <SceneHeader index="P5" title="先抢救，再碎纸" meta="salvage before shred · dream gates" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="5-A 时间铰链">
        <TimeHinge leftAt={relA('p5-02')} rightAt={relA('p5-03')} />
      </Sequence>
      <Sequence {...bB} name="5-B 顺序章盖下">
        <OrderStamp stampAt={relB('p5-08')} settleAt={relB('p5-10')} />
      </Sequence>
      <Sequence {...bC} name="5-C 做梦铭牌">
        <DreamPlate thickenAt={relC('p5-11')} nightAt={relC('p5-12')} plateAt={relC('p5-12') + 16} />
      </Sequence>
      <Sequence {...bD} name="5-D 四道闸砸落">
        <FourGatesFall
          gateAt={[
            relD('p5-14'),
            relD('p5-15'),
            relD('p5-16'),
            relD('p5-17'),
          ]}
        />
      </Sequence>
      <Sequence {...bE} name="5-E 锁即时钟">
        <LockIsClock
          faceAt={relE('p5-18')}
          crashAt={relE('p5-20')}
          spinAt={relE('p5-20') + 12}
          quoteAt={relE('p5-22')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
