/** P1 桌面的收拾法（分镜 1-A…1-C）—— 比喻体系主舞台登场
 *  1-A 桌面全景 + 「便宜的先来贵的最后」原则条压顶；
 *  1-B 第一级裁中段（头 3 尾 47 亮 / 中段脱落留计数字条 / 请求-回执配对保护）；
 *  1-C 第二级折旧纸（更早的折成一行 / 最近三张 mech 高光 / 120 字阈值角标）。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Counter, Desk, Footnote, PaperCard, SceneHeader} from '../components/motifs';

/** 桌面全景 + 原则条自顶落下钉住 */
const DeskIntro: React.FC<{ruleAt: number}> = ({ruleAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const drop = spring({frame: frame - ruleAt, fps, config: {damping: 13}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
            <div style={{position: 'relative', marginTop: 40}}>
        <Desk w={1460} h={430} label="桌面 = 随身携带的全部对话">
          <div style={{position: 'absolute', left: 34, top: 44, display: 'flex', flexWrap: 'wrap', gap: 14, width: 1392}}>
            {Array.from({length: 26}).map((_, i) => (
              <PaperCard key={i} w={124} h={70} tone={i < 4 ? 'full' : i < 18 ? 'half' : 'faded'} />
            ))}
          </div>
        </Desk>
        {/* 原则条：自顶落下钉住（起点在画面上方 220px，落到位） */}
        <div
          style={{
            position: 'absolute',
            left: 730 - 330,
            top: -96,
            transform: `translateY(${(1 - drop) * -220}px)`,
            opacity: drop,
          }}
        >
          <div
            style={{
              padding: '16px 42px',
              borderRadius: 12,
              background: theme.panel,
              border: `3px solid ${theme.mech}`,
              fontFamily: theme.serif,
              fontSize: 40,
              fontWeight: 700,
              color: theme.mech,
              whiteSpace: 'nowrap',
            }}
          >
            {'便宜的先来，贵的最后'}
          </div>
        </div>
        {/* 四级预告：panel 底 + 编号（反枚举：不给四色） */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: -84,
            display: 'flex',
            gap: 16,
            justifyContent: 'center',
            opacity: interpolate(frame - ruleAt - 16, [0, 12], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {['一级 裁中段', '二级 折旧纸', '三级 大件入库', '四级 全桌重写'].map((t, i) => (
            <div
              key={t}
              style={{
                padding: '10px 22px',
                borderRadius: 999,
                border: `2px solid ${theme.panelBorder}`,
                background: theme.panel,
                fontFamily: theme.mono,
                fontSize: 23,
                color: i === 0 ? theme.mech : theme.dim,
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

/** 1-B 裁中段：头 3（core 描边「任务书」）+ 中段脱落 + 尾 47 亮起 + 计数字条 + 配对保护 */
const SnipMiddle: React.FC<{
  headAt: number;
  tailAt: number;
  cutAt: number;
  pairAt: number;
}> = ({headAt, tailAt, cutAt, pairAt}) => {
  const frame = useCurrentFrame();
  // 中段整块被裁走：下落 + 褪色（褪色即遗忘——不用颜色画丢失）
  const cut = interpolate(frame - cutAt, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const headOn = frame >= headAt;
  const tailOn = frame >= tailAt;
  const pairOn = frame >= pairAt;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1560}}>
        <Desk w={1560} h={430}>
          {/* 头部三张：core 描边任务书 */}
          <div style={{position: 'absolute', left: 26, top: 36, display: 'flex', gap: 10}}>
            {[0, 1, 2].map((i) => (
              <PaperCard
                key={i}
                w={112}
                h={128}
                bars={5}
                accent={headOn ? theme.core : undefined}
                label="任务书"
              />
            ))}
          </div>
          {/* 中段：一摞过气纸被整块裁走（下落+褪色） */}
          <div
            style={{
              position: 'absolute',
              left: 400,
              top: 30,
              width: 700,
              height: 150,
              transform: `translateY(${cut * 190}px)`,
              opacity: 1 - cut * 0.85,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              alignContent: 'flex-start',
            }}
          >
            {Array.from({length: 20}).map((_, i) => (
              <PaperCard key={i} w={100} h={58} tone="half" />
            ))}
          </div>
          {/* 计数字条：原地留下的一行占位 */}
          {cut > 0.4 ? (
            <div
              style={{
                position: 'absolute',
                left: 400 + 340,
                top: 96,
                opacity: interpolate(cut, [0.4, 0.8], [0, 1], {extrapolateRight: 'clamp'}),
              }}
            >
              <div
                style={{
                  padding: '10px 24px',
                  border: `2px dashed ${theme.panelBorder}`,
                  borderRadius: 8,
                  fontFamily: theme.mono,
                  fontSize: 24,
                  color: theme.dim,
                  whiteSpace: 'nowrap',
                }}
              >
                {'中间裁掉了 '}
                <Counter from={0} to={50} start={cutAt + 6} style={{color: theme.dim}} />
                {' 张中的 50 张'}
              </div>
            </div>
          ) : null}
          {/* 裁刀线扫过中段 */}
          <svg width={1560} height={430} style={{position: 'absolute', inset: 0}}>
            <line
              x1={400}
              y1={230}
              x2={400 + 700 * cut}
              y2={230}
              stroke={theme.mech}
              strokeWidth={5}
              strokeDasharray="14 10"
            />
          </svg>
          {/* 尾部四十七张：亮起（正在用的不能动） */}
          <div
            style={{
              position: 'absolute',
              right: 26,
              top: 30,
              width: 420,
              height: 220,
              opacity: tailOn ? 1 : 0.25,
            }}
          >
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
              {Array.from({length: 15}).map((_, i) => (
                <PaperCard key={i} w={78} h={52} tone="full" />
              ))}
            </div>
            <div
              style={{
                position: 'absolute',
                left: 0,
                bottom: -34,
                fontFamily: theme.mono,
                fontSize: 23,
                color: theme.text,
              }}
            >
              {'最近 47 张 · 正在用的'}
            </div>
          </div>
          {/* 配对保护：一张「请求」卡伸手拽回被裁的「回执」——配对不拆 */}
          {pairOn ? (
            <div
              style={{
                position: 'absolute',
                left: 620,
                bottom: 34,
                display: 'flex',
                alignItems: 'center',
                gap: 0,
                opacity: interpolate(frame - pairAt, [0, 12], [0, 1], {
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              <PaperCard w={150} h={74} label="请求" tone="full" />
              <svg width={140} height={74}>
                <line
                  x1={4}
                  y1={37}
                  x2={4 + 132 * interpolate(frame - pairAt, [0, 18], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  })}
                  y2={37}
                  stroke={theme.mech}
                  strokeWidth={5}
                  strokeLinecap="round"
                />
              </svg>
              <PaperCard w={150} h={74} label="回执" tone="full" />
              <div
                style={{
                  marginLeft: 18,
                  fontFamily: theme.sans,
                  fontSize: 24,
                  color: theme.mech,
                  whiteSpace: 'nowrap',
                }}
              >
                {'请求-回执配对，不许拆'}
              </div>
            </div>
          ) : null}
        </Desk>
        {/* 分段标注 */}
        <div
          style={{
            position: 'absolute',
            left: 26,
            top: -66,
            display: 'flex',
            gap: 40,
            fontFamily: theme.mono,
            fontSize: 24,
            opacity: interpolate(frame - headAt, [0, 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <span style={{color: theme.core}}>{'头 3 · 任务书'}</span>
          <span style={{color: theme.dim}}>{'中段 · 过气的中间过程'}</span>
          <span style={{color: theme.text}}>{'尾 47'}</span>
        </div>
      </div>
      <Footnote delay={headAt}>{'超过 50 条才触发 · 头 3 尾 47 —— 仓库实测（snip_compact）'}</Footnote>
    </AbsoluteFill>
  );
};

/** 1-C 折旧纸：旧结果卡折叠成一行；最近三张 mech 高光 + 120 字阈值角标 */
const FoldOld: React.FC<{foldAt: number[]; recentAt: number}> = ({foldAt, recentAt}) => {
  const frame = useCurrentFrame();
  const recentOn = frame >= recentAt;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{width: 1400}}>
        <div style={{display: 'flex', gap: 22, justifyContent: 'center', alignItems: 'flex-start'}}>
          {[0, 1, 2, 3].map((i) => {
            // 折叠动画：大卡高度缩到一行（scaleY 压扁 + 褪色）
            const t = interpolate(frame - foldAt[i], [0, 14], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const folding = i >= 1; // 第一张是最近三张的代表，不折
            return (
              <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                <div
                  style={{
                    transform: `scaleY(${folding ? 1 - 0.82 * t : 1})`,
                    transformOrigin: 'top',
                    opacity: folding ? 1 - 0.5 * t : 1,
                  }}
                >
                  <PaperCard
                    w={190}
                    h={210}
                    bars={7}
                    tone={folding && t > 0.5 ? 'faded' : 'full'}
                    accent={recentOn && !folding ? theme.mech : undefined}
                  />
                </div>
                {/* 折叠后的一行动字 */}
                {folding && t > 0.7 ? (
                  <div
                    style={{
                      marginTop: 12,
                      fontFamily: theme.mono,
                      fontSize: 20,
                      color: theme.dim,
                      opacity: interpolate(t, [0.7, 1], [0, 1], {extrapolateRight: 'clamp'}),
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {'早前结果已收起，需要再跑一遍'}
                  </div>
                ) : null}
                <div
                  style={{
                    marginTop: 14,
                    fontFamily: theme.mono,
                    fontSize: 22,
                    color: i === 0 ? theme.mech : theme.dim,
                  }}
                >
                  {i === 0 ? '最近 3 条 · 完整保留' : '更早 · 已折成一行'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Footnote delay={recentAt}>
        {'只折超过 120 字的旧结果 · 折叠不重跑 —— 仓库实测（micro_compact）'}
      </Footnote>
    </AbsoluteFill>
  );
};

export const P1Desk: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p1-01', 'p1-04');
  const relA = (id: string) => at(id) - bA.from;
  const bB = w('p1-05', 'p1-12');
  const relB = (id: string) => at(id) - bB.from;
  const bC = w('p1-13', 'p1-20');
  const relC = (id: string) => at(id) - bC.from;
  return (
    <AbsoluteFill>
      <SceneHeader index="P1" title="桌面的收拾法" meta="cheap first, expensive last" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="1-A 桌面全景与原则条">
        <DeskIntro ruleAt={relA('p1-03')} />
      </Sequence>
      <Sequence {...bB} name="1-B 裁中段与配对保护">
        <SnipMiddle
          headAt={relB('p1-05')}
          tailAt={relB('p1-09')}
          cutAt={relB('p1-06')}
          pairAt={relB('p1-11')}
        />
      </Sequence>
      <Sequence {...bC} name="1-C 折旧纸">
        <FoldOld
          foldAt={[relC('p1-13'), relC('p1-14'), relC('p1-14') + 14, relC('p1-14') + 28]}
          recentAt={relC('p1-16')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
