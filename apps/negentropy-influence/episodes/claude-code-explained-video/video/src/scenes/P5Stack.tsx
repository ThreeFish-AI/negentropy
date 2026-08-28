/** P5 四层叠起来是什么（分镜 5-A…5-D）—— 主题回收
 *  5-B 的柱体用**实测值**：总行 141/191/241/255，其中循环段 23/20/24/28
 *  （非空非注释 @ pinned commit）。刻意不美化成「完全等高」——口播说的是
 *  「一直在二十到二十八行之间」，画面必须与这句话一致。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Footnote, LoopRing, Panel, SceneHeader, Terminal, useRingDot} from '../components/motifs';

const CHAPTERS = [
  {name: '一个循环', total: 141, loop: 23},
  {name: '一张分发表', total: 191, loop: 20},
  {name: '三道闸门', total: 241, loop: 24},
  {name: '一排插口', total: 255, loop: 28},
];

/** 5-A 四层卡片 → 官方四件套映射（p5-05/06，Harness Engineering 改造版）：
 *  口播「官方定义正好四件：循环、工具、上下文管理、护栏」——四张章节卡上方
 *  落下官方四格标尺，本集三层各连一格（循环↔循环 / 分发表↔工具 / 插口↔护栏 之一），
 *  「上下文管理」格保持虚线空置 + 「后面拆」小标（视觉与 p5-06 口播逐字对齐）。
 *  随后原有「骨架 vs 挂件」分层（环 + 挂线）不变。 */
const FourLayers: React.FC<{splitAt: number; mapAt: number}> = ({splitAt, mapAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dot = useRingDot(2.8);
  const layers = [
    {t: '一个循环', s: '反复问模型，替它执行，把结果搬回来', core: true},
    {t: '一张分发表', s: '让工具可以随便加', core: false},
    {t: '三道闸门', s: '让危险的事在执行之前被拦住', core: false},
    {t: '一排插口', s: '让扩展挂在外面，不侵入内核', core: false},
  ];
  const split = interpolate(frame - splitAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 官方四件套标尺：位置对齐下方四卡的水平中心（卡宽 350 + gap 22 → 步距 372）
  const OFFICIAL = [
    {t: '循环', link: 0},
    {t: '工具', link: 1},
    {t: '上下文管理', link: -1},
    {t: '护栏', link: 3},
  ];
  const map = interpolate(frame - mapAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const linkOn = interpolate(frame - mapAt - 10, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const CARD_W = 350;
  const GAP = 22;
  const stripLeft = 960 - (CARD_W * 4 + GAP * 3) / 2;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {/* 官方四件套标尺（p5-05 落下；p5-06 连线 + 空格标注） */}
      <div
        style={{
          position: 'absolute',
          top: 96,
          left: stripLeft,
          display: 'flex',
          gap: GAP,
          opacity: map,
          transform: `translateY(${(1 - map) * -18}px)`,
        }}
      >
        {OFFICIAL.map((o) => {
          const filled = o.link >= 0;
          return (
            <div key={o.t} style={{width: CARD_W, textAlign: 'center'}}>
              <div
                style={{
                  padding: '12px 0',
                  borderRadius: 10,
                  border: filled ? `2.5px solid ${theme.mech}` : `2px dashed ${theme.panelBorder}`,
                  background: filled ? theme.mechDeep : 'transparent',
                  fontFamily: theme.sans,
                  fontSize: 27,
                  color: filled ? theme.text : theme.dim,
                  whiteSpace: 'nowrap',
                }}
              >
                {o.t}
              </div>
              {filled ? (
                <svg width={CARD_W} height={64} style={{display: 'block'}}>
                  <line
                    x1={CARD_W / 2}
                    y1={4}
                    x2={CARD_W / 2}
                    y2={4 + 52 * linkOn}
                    stroke={theme.mech}
                    strokeWidth={4}
                  />
                  <polygon
                    points={`${CARD_W / 2},${60} ${CARD_W / 2 - 9},${52} ${CARD_W / 2 + 9},${52}`}
                    fill={theme.mech}
                    opacity={linkOn}
                  />
                </svg>
              ) : (
                <div
                  style={{
                    fontFamily: theme.sans,
                    fontSize: 21,
                    color: theme.dim,
                    marginTop: 18,
                    opacity: linkOn,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {'空着 · 后面拆'}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{display: 'flex', gap: 22, alignItems: 'flex-end'}}>
        {layers.map((l, i) => {
          const e = spring({frame: frame - i * 8, fps, config: {damping: 200}});
          // 骨架卡：split 后向左漂出并让位给环；挂件卡：split 后向左滑拢（对环的预演）
          const drift = l.core ? split * -60 : split * -14;
          const lift = l.core ? 0 : -split * 10;
          return (
            <div
              key={l.t}
              style={{
                width: 350,
                opacity: e * (l.core ? 1 - split * 0.25 : 1 - split * 0.4),
                transform: `translate(${(1 - e) * 0 + drift}px, ${(1 - e) * 34 + lift}px)`,
              }}
            >
              <Panel
                accent={l.core ? theme.core : theme.mech}
                style={{
                  padding: '26px 24px',
                  minHeight: 210,
                  background: l.core && split > 0.4 ? theme.coreDeep : theme.panel,
                }}
              >
                <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div
                  style={{
                    fontFamily: theme.serif,
                    fontSize: 40,
                    fontWeight: 700,
                    color: l.core ? theme.core : theme.mech,
                    marginTop: 8,
                  }}
                >
                  {l.t}
                </div>
                <div
                  style={{
                    fontFamily: theme.sans,
                    fontSize: 23,
                    color: theme.dim,
                    marginTop: 12,
                    lineHeight: 1.5,
                  }}
                >
                  {l.s}
                </div>
              </Panel>
              {l.core && split > 0.5 ? (
                <div
                  style={{
                    textAlign: 'center',
                    marginTop: 12,
                    fontFamily: theme.sans,
                    fontSize: 24,
                    color: theme.core,
                  }}
                >
                  {'骨架'}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {/* 环自 split 中段从卡片阵后浮出（第 6 次出场：同色同线宽），三张挂件卡尾部各引一条挂线贴向它 */}
      {split > 0.35 ? (
        <div
          style={{
            position: 'absolute',
            left: 60,
            top: 240,
            opacity: interpolate(split, [0.35, 0.9], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          <LoopRing size={300} draw={1} dotProgress={dot} showExit={false} showLabels={false} />
          <div
            style={{
              textAlign: 'center',
              marginTop: 10,
              fontFamily: theme.mono,
              fontSize: 22,
              color: theme.core,
            }}
          >
            {'骨架'}
          </div>
        </div>
      ) : null}
      {split > 0.5 ? (
        <div
          style={{
            position: 'absolute',
            right: 150,
            bottom: 230,
            fontFamily: theme.sans,
            fontSize: 24,
            color: theme.mech,
          }}
        >
          {'挂件 ×3'}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** 5-B 四级台阶：柱高递增，柱内 core 段几乎不变；coreAt 后横贯 20–28 行的「实测带」 */
const GrowthBars: React.FC<{barAt: number; coreAt: number}> = ({barAt, coreAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const H = 430;
  const maxLines = 260;
  const showCore = frame >= coreAt;
  const bandT = interpolate(frame - coreAt - 6, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const yFor = (lines: number) => (lines / maxLines) * H;
  //: 柱底距容器底的实测像素：幕名标签（22px 字，行盒 ~33）+ `marginTop: 12`。
  //: 基准带必须减掉它才能落在柱子自己的行数刻度上——此前写 90，带体整体上浮 45px。
  const BAR_BASE = 45;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', display: 'flex', gap: 56, alignItems: 'flex-end', height: H + 90}}>
        {CHAPTERS.map((c, i) => {
          const at = barAt + i * 9;
          const e = spring({frame: frame - at, fps, config: {damping: 200}});
          const h = (c.total / maxLines) * H * e;
          const ch = (c.loop / maxLines) * H * e;
          return (
            <div key={c.name} style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
              <div
                style={{
                  fontFamily: theme.mono,
                  fontSize: 30,
                  color: theme.text,
                  marginBottom: 10,
                  opacity: e,
                }}
              >
                {Math.round(c.total * e)}
              </div>
              <div
                style={{
                  position: 'relative',
                  width: 132,
                  height: h,
                  background: theme.panel,
                  border: `2px solid ${theme.panelBorder}`,
                  borderRadius: '8px 8px 0 0',
                  opacity: showCore ? 0.35 : 1,
                  transition: 'none',
                }}
              >
                {/* 柱内的循环段：同色同高度语义 */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: ch,
                    background: theme.core,
                    opacity: showCore ? 1 : 0.55,
                    borderRadius: '0 0 0 0',
                  }}
                />
                {showCore ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: ch + 6,
                      textAlign: 'center',
                      fontFamily: theme.mono,
                      fontSize: 22,
                      color: theme.core,
                    }}
                  >
                    {c.loop}
                  </div>
                ) : null}
              </div>
              <div
                style={{
                  fontFamily: theme.sans,
                  fontSize: 22,
                  color: theme.dim,
                  marginTop: 12,
                  opacity: e,
                }}
              >
                {c.name}
              </div>
            </div>
          );
        })}
        {/* 20–28 行实测带：横贯四柱的虚线基准带——「恒在 20–28 行」这句口播的测量仪器 */}
        {bandT > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: -60,
              right: -60,
              // 锚在区间**下界**（20 行），向上长到 28 行——锚上界会让带体
              // 落在 28→36 行，与标签写的 20–28 不符
              bottom: yFor(20) + BAR_BASE,
              height: yFor(28) - yFor(20),
              background: theme.core,
              opacity: 0.12 * bandT,
              borderRadius: 6,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                borderTop: `2px dashed ${theme.core}`,
                opacity: bandT,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                borderBottom: `2px dashed ${theme.core}`,
                opacity: bandT,
              }}
            />
            {/* 带宽只有 13px，标注压在带子上方会撞四根柱子各自的 loop 行数（`bottom: ch + 6`
                恰好落在同一高度）——放到带子右侧的空白区，垂直居中对齐带体 */}
            <div
              style={{
                position: 'absolute',
                left: '100%',
                marginLeft: 14,
                top: -8,
                whiteSpace: 'nowrap',
                fontFamily: theme.mono,
                fontSize: 22,
                color: theme.core,
                opacity: bandT,
              }}
            >
              {'循环函数行数带 20–28（实测）'}
            </div>
          </div>
        ) : null}
      </div>
      <Footnote delay={coreAt}>
        {'总行 141 → 255（+81%）·  循环函数恒在 20–28 行（非空非注释）'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 5-C 环第五次出现：执行节点标签翻牌四次，环本身一帧未变 */
const SameRingFourLabels: React.FC<{flipAt: number; quoteAt: number}> = ({flipAt, quoteAt}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  const labels = ['写死一个命令', '查一张表', '先过一道闸门', '交给一排插口'];
  const idx = frame < flipAt ? -1 : Math.min(labels.length - 1, Math.floor((frame - flipAt) / 12));
  if (frame >= quoteAt) {
    return (
      <QuoteCard zh="骨架一字未改，变的只有「执行」那一步怎么写。" accent={theme.core} />
    );
  }
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative'}}>
        <LoopRing
          size={480}
          draw={1}
          dotProgress={dot}
          activeNode={2}
          nodeLabels={['问模型', '看回答', idx < 0 ? '执行工具' : labels[idx], '填回结果']}
        />
        {idx >= 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -78,
              textAlign: 'center',
              fontFamily: theme.mono,
              fontSize: 24,
              color: theme.mech,
            }}
          >
            {`第 ${idx + 1} 次写法`}
          </div>
        ) : null}
      </div>
      <Footnote delay={flipAt}>{'同一个位置，换了四次写法'}</Footnote>
    </AbsoluteFill>
  );
};

/** 5-D 回到 P0 的终端，这次它自己跑起来 */
const SelfRunning: React.FC<{shellAt: number; quoteAt: number}> = ({shellAt, quoteAt}) => {
  const frame = useCurrentFrame();
  if (frame >= quoteAt) {
    return (
      <QuoteCard
        zh="Agency comes from the model — the harness gives it a place to land"
        en="Agency comes from the model. The harness gives agency a place to land."
        accent={theme.core}
      />
    );
  }
  const shell = interpolate(frame - shellAt, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative'}}>
        <Terminal
          width={1120}
          height={400}
          cps={30}
          lines={[
            {prompt: '›', text: '看看项目里有哪些文件，再跑一下其中一个脚本', delay: 4},
            {text: 'find . -name "*.py" -maxdepth 2', color: theme.core, delay: 40},
            {text: '  ./main.py   ./tools/fmt.py', color: theme.dim, delay: 62},
            {text: 'python ./tools/fmt.py  →  完成', color: theme.mech, delay: 80},
          ]}
        />
        {/* 四层结构在终端外围合拢成一个壳 */}
        {shell > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: -34 + shell * 12,
              top: -34 + shell * 12,
              right: -34 + shell * 12,
              bottom: -34 + shell * 12,
              border: `3px solid ${theme.core}`,
              borderRadius: 22,
              opacity: shell * 0.9,
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>
      <Footnote delay={shellAt}>{'一个愿意反复跑、能查表、会拦门、留了插口的壳'}</Footnote>
    </AbsoluteFill>
  );
};

export const P5Stack: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const rel = (b: {from: number}, id: string) => w(id).from - b.from;
  const bA = w('p5-01', 'p5-06');
  const bB = w('p5-07', 'p5-10');
  const bC = w('p5-11', 'p5-14');
  const bD = w('p5-15', 'p5-19');
  return (
    <AbsoluteFill>
      <SceneHeader index="P5" title="四层叠起来是什么" meta="Harness = loop + tools + context + guardrails" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="5-A 四层卡片与官方四件套">
        <FourLayers splitAt={rel(bA, 'p5-06')} mapAt={rel(bA, 'p5-05')} />
      </Sequence>
      <Sequence {...bB} name="5-B 四级台阶">
        <GrowthBars barAt={rel(bB, 'p5-08')} coreAt={rel(bB, 'p5-10')} />
      </Sequence>
      <Sequence {...bC} name="5-C 同一个环四次写法">
        <SameRingFourLabels flipAt={rel(bC, 'p5-13')} quoteAt={rel(bC, 'p5-14')} />
      </Sequence>
      <Sequence {...bD} name="5-D 它自己跑起来了">
        <SelfRunning shellAt={rel(bD, 'p5-18')} quoteAt={rel(bD, 'p5-19')} />
      </Sequence>
    </AbsoluteFill>
  );
};
