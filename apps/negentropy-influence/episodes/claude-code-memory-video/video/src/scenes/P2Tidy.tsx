/** P2 大件入库与顺序论证（分镜 2-A…2-D）
 *  2-A 第三级大件入库：五块落下 → 按个头排队飞进文件柜 → 桌上留预览卡；
 *  2-B 第四级全桌重写：复印保底 → 帮工卷纸成卡 → 整桌褪色只留摘要卡 → 熔断章；
 *  2-C 应急通道：最近五张 keep 框住，其余摘要化，重试一次；
 *  2-D ★换序自毁演示双轨：上轨正常序（✓）下轨对调序（✗）——抓空瞬间画面碎一帧再复位。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Cabinet, Desk, Footnote, HelperFigure, PaperCard} from '../components/motifs';

/** 2-A 大件入库：五个大块拍上桌 → 排队弧线飞入文件柜 → 预览卡弹回落位 */
const VaultBig: React.FC<{dropAt: number; flyAt: number; previewAt: number}> = ({
  dropAt,
  flyAt,
  previewAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const BLOCK_W = 250;
  const fly = (i: number) =>
    interpolate(frame - flyAt - i * 10, [0, 26], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  const previewOn = frame >= previewAt;
  const deskX = 210;
  const deskY = 200;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1720, height: 620}}>
        <Desk w={960} h={430} style={{position: 'absolute', left: 0, top: 100}} label="桌面">
          {/* 五个大块头按个头从大到小落下 */}
          {[0, 1, 2, 3, 4].map((i) => {
            const drop = spring({frame: frame - dropAt - i * 5, fps, config: {damping: 12}});
            const t = fly(i);
            // 弧线：桌面 → 文件柜（贝塞尔近似：先上后右）。起点在 Desk 内错层排开
            const x0 = deskX + 60 + i * 128;
            const y0 = deskY + 120 - i * 36;
            const cx = (x0 + 1240) / 2;
            const cy = Math.min(y0, 170) - 130;
            const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * 1240;
            const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * 300;
            const gone = t > 0.92;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: gone ? -9999 : x - BLOCK_W / 2,
                  top: gone ? -9999 : y - 40,
                  width: BLOCK_W,
                  height: 92,
                  borderRadius: 10,
                  background: theme.panel,
                  border: `3px solid ${theme.panelBorder}`,
                  opacity: gone ? 0 : drop * (1 - t * 0.1),
                  transform: `translateY(${(1 - drop) * -260}px)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                <div style={{width: 120 + (4 - i) * 18, height: 44, borderRadius: 6, background: theme.text, opacity: 0.3}} />
                <div
                  style={{
                    fontFamily: theme.mono,
                    fontSize: 21,
                    color: theme.dim,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {`大文件 ${i + 1}`}
                </div>
              </div>
            );
          })}
          {/* 预览卡弹回落位：前 2000 字 + 库标记 */}
          {previewOn ? (
            <div
              style={{
                position: 'absolute',
                left: 210,
                top: 330,
                opacity: interpolate(frame - previewAt, [0, 12], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              <div
                style={{
                  width: 330,
                  borderRadius: 10,
                  background: theme.panel,
                  border: `3px solid ${theme.mech}`,
                  padding: '14px 18px',
                }}
              >
                <div style={{display: 'flex', gap: 6, marginBottom: 10}}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} style={{width: 42, height: 6, borderRadius: 3, background: theme.text, opacity: 0.5}} />
                  ))}
                </div>
                <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.mech}}>
                  {'预览卡 · 前 2000 字'}
                </div>
                <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 4}}>
                  {'全文在库里 → 可再取'}
                </div>
              </div>
            </div>
          ) : null}
        </Desk>
        {/* 文件柜（硬盘）：大块按个头飞入 */}
        <Cabinet
          w={430}
          h={560}
          drawers={5}
          openIndex={-1}
          label="文件柜 · 硬盘"
          style={{position: 'absolute', right: 60, top: 30}}
        />
      </div>
      <Footnote delay={dropAt}>{'超过 200KB 才入库 · 预览 2000 字 —— 仓库实测（s08 macro_compact）'}</Footnote>
    </AbsoluteFill>
  );
};

/** 2-B 全桌重写：复印保底 → 帮工卷纸成一张卡 → 整桌褪色只留摘要卡 → 熔断章 */
const FullRewrite: React.FC<{copyAt: number; helperAt: number; foldAt: number; tripAt: number}> = ({
  copyAt,
  helperAt,
  foldAt,
  tripAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const helper = spring({frame: frame - helperAt, fps, config: {damping: 200}});
  // 整桌纸淡出（褪色即遗忘）只留摘要卡
  const tableFade = interpolate(frame - foldAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const trip = spring({frame: frame - tripAt, fps, config: {damping: 12}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1520}}>
        <Desk w={1520} h={430} label="桌面">
          {/* 整桌纸：复印时翻白入档案抽屉 */}
          <div
            style={{
              position: 'absolute',
              left: 60,
              top: 46,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 14,
              width: 880,
              opacity: 1 - tableFade * 0.88,
              filter: `brightness(${1 - tableFade * 0.45})`,
            }}
          >
            {Array.from({length: 18}).map((_, i) => (
              <PaperCard key={i} w={132} h={74} tone={i < 6 ? 'full' : 'half'} />
            ))}
          </div>
          {/* 档案抽屉（保底转录）：复印进去的白色拷贝 */}
          <div
            style={{
              position: 'absolute',
              right: 40,
              top: 60,
              width: 380,
              height: 300,
              borderRadius: 12,
              border: `3px solid ${theme.panelBorder}`,
              background: theme.panel,
              padding: 18,
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'档案 · 转录保底'}</div>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14}}>
              {Array.from({length: 10}).map((_, i) => {
                const t = interpolate(frame - copyAt - i * 4, [0, 10], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                });
                return (
                  <div
                    key={i}
                    style={{
                      width: 96,
                      height: 52,
                      borderRadius: 6,
                      border: `2px solid ${theme.panelBorder}`,
                      background: theme.bg,
                      opacity: t,
                    }}
                  />
                );
              })}
            </div>
            <div
              style={{
                marginTop: 14,
                fontFamily: theme.mono,
                fontSize: 20,
                color: theme.dim,
                opacity: interpolate(frame - copyAt - 46, [0, 10], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              {'一份不少 · 摘要写砸也有底'}
            </div>
          </div>
          {/* 帮工：小个子 mech 把纸堆卷成一张卡（作业臂绕肩扫过） */}
          <div
            style={{
              position: 'absolute',
              left: 430,
              bottom: 30,
              opacity: helper,
              transform: `translateX(${(1 - helper) * -80}px)`,
            }}
          >
            <HelperFigure
              size={210}
              armAngle={interpolate(frame - helperAt - 10, [0, 40], [0, -160], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}
            />
          </div>
          {/* 摘要卡：全桌重写后的唯一一张（五类信息行） */}
          {tableFade > 0.5 ? (
            <div
              style={{
                position: 'absolute',
                left: 560,
                top: 110,
                opacity: interpolate(tableFade, [0.5, 0.9], [0, 1], {extrapolateRight: 'clamp'}),
              }}
            >
              <div
                style={{
                  width: 420,
                  borderRadius: 12,
                  background: theme.panel,
                  border: `3px solid ${theme.mech}`,
                  padding: '18px 22px',
                }}
              >
                <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.mech, marginBottom: 10}}>
                  {'摘要卡 · 全桌重写'}
                </div>
                {['当前目标', '重要发现', '改过哪些文件', '还剩什么活', '你交代的约束'].map((t, i) => (
                  <div
                    key={t}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      marginTop: 8,
                      opacity: interpolate(frame - foldAt - 8 - i * 5, [0, 10], [0, 1], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                      }),
                    }}
                  >
                    <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.text}}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Desk>
        {/* 熔断章：连败三次 → deny 印章落下 */}
        {trip > 0 ? (
          <div
            style={{
              position: 'absolute',
              right: 120,
              bottom: -50,
              opacity: trip,
              transform: `rotate(${-12 + 4 * trip}deg) scale(${1.4 - 0.4 * trip})`,
            }}
          >
            <div
              style={{
                padding: '10px 26px',
                border: `4px solid ${theme.deny}`,
                borderRadius: 8,
                fontFamily: theme.mono,
                fontSize: 30,
                fontWeight: 700,
                color: theme.deny,
                whiteSpace: 'nowrap',
              }}
            >
              {'连败 3 次 · 熔断'}
            </div>
          </div>
        ) : null}
      </div>
      <Footnote delay={helperAt}>{'四级里唯一要花一次模型调用的一级 —— 最贵，放最后'}</Footnote>
    </AbsoluteFill>
  );
};

/** 2-C 应急通道：拒收后保最近五张原纸（keep 框住不动），其余换摘要，重试一次 */
const RescueLane: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1400}}>
        <Desk w={1400} h={380} label="拒收已经发生 · 应急通道">
          {/* 最近五张：keep 描边框住不动 */}
          <div
            style={{
              position: 'absolute',
              left: 40,
              top: 50,
              padding: 18,
              border: `3px solid ${theme.keep}`,
              borderRadius: 14,
            }}
          >
            <div style={{display: 'flex', gap: 10}}>
              {[0, 1, 2, 3, 4].map((i) => (
                <PaperCard
                  key={i}
                  w={104}
                  h={120}
                  bars={4}
                  tone="full"
                  style={{
                    opacity: interpolate(frame - i * 4, [0, 10], [0, 1], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    }),
                  }}
                />
              ))}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.keep, marginTop: 12}}>
              {'最近 5 张原纸 · 保住不动'}
            </div>
          </div>
          {/* 更早部分：迅速摘要化（褪色 + 一行字） */}
          <div style={{position: 'absolute', right: 60, top: 60, width: 560}}>
            <div
              style={{
                display: 'flex',
                gap: 10,
                opacity: interpolate(frame, [10, 30], [1, 0.25], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <PaperCard key={i} w={110} h={74} tone="half" />
              ))}
            </div>
            <div
              style={{
                marginTop: 16,
                padding: '10px 18px',
                border: `2px dashed ${theme.panelBorder}`,
                borderRadius: 8,
                fontFamily: theme.mono,
                fontSize: 22,
                color: theme.dim,
                opacity: interpolate(frame - 20, [0, 12], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              {'更早的部分 → 换成摘要'}
            </div>
          </div>
        </Desk>
        <div
          style={{
            position: 'absolute',
            right: 30,
            bottom: -74,
            fontFamily: theme.mono,
            fontSize: 26,
            color: theme.text,
            opacity: interpolate(frame - 34, [0, 12], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {'重试 ×1 · 再不行把错误往上交'}
        </div>
      </div>
      <Footnote delay={0}>{'保 5 条 · 重试 1 次 —— 仓库实测（s08 reactive_compact）'}</Footnote>
    </AbsoluteFill>
  );
};

/** 2-D ★换序自毁演示双轨：上轨正常序 ✓，下轨对调序 ✗（抓空瞬间画面碎一帧再复位） */
const OrderMatters: React.FC<{normalAt: number; swapAt: number; grabAt: number; shatterAt: number}> = ({
  normalAt,
  swapAt,
  grabAt,
  shatterAt,
}) => {
  const frame = useCurrentFrame();
  // 上轨（正常序：入库→折叠）推进
  const nT = interpolate(frame - normalAt, [0, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 下轨（对调序：折叠→入库）
  const sT = interpolate(frame - swapAt, [0, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const grabbed = frame >= grabAt;
  // 抓空瞬间：画面碎一帧再复位（整体位移 + 切片错位，帧驱动确定性）
  const shatterT = interpolate(frame - shatterAt, [0, 2, 10], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shake = shatterT > 0 ? Math.sin(frame * 2.1) * 14 * shatterT : 0;
  const sliceShift = shatterT > 0 ? Math.sin(frame * 3.3) * 26 * shatterT : 0;

  const track = (opts: {
    top: number;
    ok: boolean;
    t: number;
    label: string;
    handDone: boolean;
  }) => {
    const vaultDone = opts.t > 0.45;
    const foldDone = opts.ok ? opts.t > 0.8 : opts.t > 0.45;
    // 正常序：入库时大块还在（能存进）；对调序：折叠先把大块缩成一行
    const bigGoneEarly = !opts.ok && opts.t > 0.45;
    return (
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: opts.top,
          width: 1620,
          height: 210,
          borderRadius: 14,
          border: `2px solid ${opts.ok ? theme.panelBorder : theme.deny}`,
          background: 'rgba(255,255,255,0.02)',
          padding: '14px 24px',
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 28,
              fontWeight: 700,
              color: opts.ok ? theme.mech : theme.deny,
            }}
          >
            {opts.ok ? '✓' : '✗'}
          </span>
          <span style={{fontFamily: theme.sans, fontSize: 25, color: theme.text}}>{opts.label}</span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 26, marginTop: 16}}>
          {/* 第一步卡片 */}
          <div style={{textAlign: 'center'}}>
            <div
              style={{
                width: 200,
                padding: '10px 12px',
                borderRadius: 10,
                border: `2px solid ${vaultDone ? theme.mech : theme.panelBorder}`,
                background: vaultDone ? theme.mechDeep : theme.panel,
                fontFamily: theme.mono,
                fontSize: 22,
                color: vaultDone ? theme.mech : theme.dim,
              }}
            >
              {opts.ok ? '① 入库' : '① 折叠'}
            </div>
          </div>
          {/* 大块头：正常序存活到入库；对调序在第一步就被折成一行 */}
          <div style={{position: 'relative', width: 560, height: 96}}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 6,
                width: 300,
                height: 84,
                borderRadius: 10,
                background: theme.panel,
                border: `3px solid ${theme.panelBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.mono,
                fontSize: 21,
                color: theme.dim,
                opacity: bigGoneEarly ? 0 : 1,
                transform: `scaleY(${bigGoneEarly ? 0.12 : 1})`,
                transformOrigin: 'center',
              }}
            >
              {'大块头原文'}
            </div>
            {bigGoneEarly ? (
              <div
                style={{
                  position: 'absolute',
                  left: 40,
                  top: 40,
                  fontFamily: theme.mono,
                  fontSize: 20,
                  color: theme.dim,
                  opacity: 0.7,
                }}
              >
                {'早前结果已收起，需要再跑一遍'}
              </div>
            ) : null}
          </div>
          {/* 第二步卡片 */}
          <div style={{textAlign: 'center'}}>
            <div
              style={{
                width: 200,
                padding: '10px 12px',
                borderRadius: 10,
                border: `2px solid ${foldDone ? theme.mech : theme.panelBorder}`,
                background: foldDone ? theme.mechDeep : theme.panel,
                fontFamily: theme.mono,
                fontSize: 22,
                color: foldDone ? theme.mech : theme.dim,
              }}
            >
              {opts.ok ? '② 折叠' : '② 入库'}
            </div>
          </div>
          {/* 入库的手：正常序抓到实物；对调序抓空（一条 dashed 空轨迹） */}
          <svg width={380} height={96}>
            <path
              d={`M 20 48 L ${opts.handDone ? 200 : 20} 48`}
              stroke={opts.ok ? theme.mech : theme.deny}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={opts.ok ? undefined : '10 8'}
            />
            {opts.handDone ? (
              <g>
                <circle
                  cx={200}
                  cy={48}
                  r={opts.ok ? 14 : 11}
                  fill={opts.ok ? theme.mech : 'none'}
                  stroke={theme.deny}
                  strokeWidth={opts.ok ? 0 : 4}
                />
                {!opts.ok ? (
                  <text x={224} y={30} fontFamily={theme.sans} fontSize={22} fill={theme.deny}>
                    {'抓空'}
                  </text>
                ) : null}
              </g>
            ) : null}
          </svg>
        </div>
        {opts.ok ? null : (
          <div
            style={{
              position: 'absolute',
              right: 20,
              bottom: 8,
              fontFamily: theme.serif,
              fontSize: 26,
              color: theme.deny,
              opacity: grabbed ? 1 : 0,
            }}
          >
            {'把空气存进了档案室'}
          </div>
        )}
      </div>
    );
  };

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {/* 碎一帧：整个双轨容器横向切片错位（三层切片各移一点，2 帧后复位） */}
      <div style={{position: 'relative', width: 1720, height: 480, transform: `translate(${shake}px, 0)`}}>
        {track({top: 10, ok: true, t: nT, label: '正常序：先入库，再折叠', handDone: nT > 0.75})}
        {track({
          top: 250,
          ok: false,
          t: sT,
          label: '对调序：折叠先行',
          handDone: sT > 0.75,
        })}
        {/* 碎裂覆层：三条横向切片错位条 */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              top: 160 + i * 120,
              width: '100%',
              height: 3,
              background: theme.deny,
              opacity: shatterT * 0.8,
              transform: `translateX(${sliceShift * (i % 2 === 0 ? 1 : -1)}px)`,
            }}
          />
        ))}
      </div>
      <Footnote delay={grabAt}>{'课程作者核对源码：产品真实顺序入库在前 —— 「先保存、再丢弃」'}</Footnote>
    </AbsoluteFill>
  );
};

export const P2Tidy: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p2-01', 'p2-06');
  const relA = (id: string) => at(id) - bA.from;
  const bB = w('p2-07', 'p2-13');
  const relB = (id: string) => at(id) - bB.from;
  const bC = w('p2-14', 'p2-15');
  const relC = (id: string) => at(id) - bC.from;
  const bD = w('p2-16', 'p2-24');
  const relD = (id: string) => at(id) - bD.from;
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A 大件入库">
        <VaultBig dropAt={relA('p2-02')} flyAt={relA('p2-03')} previewAt={relA('p2-04')} />
      </Sequence>
      <Sequence {...bB} name="2-B 全桌重写">
        <FullRewrite
          copyAt={relB('p2-08')}
          helperAt={relB('p2-10')}
          foldAt={relB('p2-11')}
          tripAt={relB('p2-13')}
        />
      </Sequence>
      <Sequence {...bC} name="2-C 应急通道">
        <RescueLane />
      </Sequence>
      <Sequence {...bD} name="2-D 换序自毁演示">
        <OrderMatters
          normalAt={relD('p2-16')}
          swapAt={relD('p2-20')}
          grabAt={relD('p2-21')}
          shatterAt={relD('p2-21') + 6}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
