/** P5 四层叠起来是什么（分镜 5-A…5-D）—— 主题回收
 *  5-B 的柱体用**实测值**：总行 141/191/241/255，其中循环段 23/20/24/28
 *  （非空非注释 @ pinned commit）。刻意不美化成「完全等高」——口播说的是
 *  「一直在二十到二十八行之间」，画面必须与这句话一致。
 *  重制（2026-09 运动层）：动效收敛 motion 模型；常驻角标 HarnessBadge（skills/06）。 */
import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Footnote, LoopRing, Panel, Terminal, useRingDot} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {SHELL_FACES, Slab3D, Stage3D, axoRotation} from '../components/solids-3d';
import {DUR, SPRING, useProgress, win} from '../motion';

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
  // 卡片阵重排（骨架让位 / 挂件滑拢）是幕级动作：22f ≥22 不入 micro token；原线性 → standard
  const split = useProgress(splitAt, 22);
  // 官方四件套标尺：位置对齐下方四卡的水平中心（卡宽 350 + gap 22 → 步距 372）
  const OFFICIAL = [
    {t: '循环', link: 0},
    {t: '工具', link: 1},
    {t: '上下文管理', link: -1},
    {t: '护栏', link: 3},
  ];
  // 标尺落下 18f → f6（Δ3）；原线性 → standard
  const map = useProgress(mapAt, DUR.f6);
  // 连线生长 14f → f5（Δ2）；原线性 → standard
  const linkOn = useProgress(mapAt + 10, DUR.f5);
  // 「骨架 / 挂件 ×3」命名标注：split 窗口中点（11f）浮现，与 P6 同名标注同档
  const nameOp = useProgress(splitAt + 11, DUR.f5);
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
          // 四卡错峰弹入：map 内只跑纯 spring()（hook 禁入 map），settle = 既有 damping 200
          const e = spring({frame: frame - i * 8, fps, config: SPRING.settle});
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
              {/* 骨架小标：布局门保留（in-flow 子节点，常驻会顶起卡 1 底对齐），
                  门内淡入替代瞬现——布局归布局、透明度归透明度 */}
              {l.core && split > 0.5 ? (
                <div
                  style={{
                    textAlign: 'center',
                    marginTop: 12,
                    fontFamily: theme.sans,
                    fontSize: 24,
                    color: theme.core,
                    opacity: nameOp,
                  }}
                >
                  {'骨架'}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {/* 环自 split 中段从卡片阵后浮出（第 6 次出场：同色同线宽），三张挂件卡尾部各引一条挂线贴向它。
          常驻渲染：透明度走 split 域窗口，窗外恒 0（替代原布尔门） */}
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 240,
          opacity: win(split, [0.35, 0.9]),
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
      {/* 挂件计数：split 中点淡入（原 split>0.5 硬门瞬现） */}
      <div
        style={{
          position: 'absolute',
          right: 150,
          bottom: 230,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.mech,
          opacity: nameOp,
        }}
      >
        {'挂件 ×3'}
      </div>
    </AbsoluteFill>
  );
};

/** 5-B 四级台阶：柱高递增，柱内 core 段几乎不变；coreAt 后横贯 20–28 行的「实测带」。
 *
 *  **本幕评估后不做 3D（2026-09）**，两条理由都成立且不可绕过：
 *  ① 试做过「柱右缘加侧向厚度板」，实景抽帧发现侧板必然压住柱下方的章名标签（柱与标签
 *     在同一 flex 列，3D 画布是覆盖式绝对定位），且遮挡了 20–28 实测带——**带是仪器，
 *     柱是被测物**，仪器被遮等于把这幕的判据本身弄丢了；
 *  ② 更根本的是「一根芯贯穿四柱」的想法本身要否决：四根柱是四个不同版本的**独立实测**
 *     （23/20/24/28 的不相等恰是「四次独立测量」的证据），连续芯等于视觉上断言「同一段
 *     代码的四次采样」——那是数据造假。这个信息已有正确载体：20–28 实测带横贯四柱但
 *     **不属于**任何一柱。带与柱的区分不该被合并。 */
const GrowthBars: React.FC<{barAt: number; coreAt: number}> = ({barAt, coreAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const H = 430;
  const maxLines = 260;
  // 测量模式切换（柱体压暗 / core 段点亮 / 行数标注现身）：离散状态，保留硬门
  const showCore = frame >= coreAt;
  // 实测带 16f：距 f5/f6 均 >3（Δ4/Δ5），保留显式时长；原线性 → standard
  const bandT = useProgress(coreAt + 6, 16);
  const yFor = (lines: number) => (lines / maxLines) * H;
  // 四柱弹簧进度先算后用（裸 spring 纯函数，非 hook——铁律①：hook 禁入 map）
  const grows = CHAPTERS.map((_, i) => spring({frame: frame - (barAt + i * 9), fps, config: SPRING.settle}));
  //: 柱底距容器底的实测像素：幕名标签（22px 字，行盒 ~33）+ `marginTop: 12`。
  //: 基准带必须减掉它才能落在柱子自己的行数刻度上——此前写 90，带体整体上浮 45px。
  const BAR_BASE = 45;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', display: 'flex', gap: 56, alignItems: 'flex-end', height: H + 90}}>
        {CHAPTERS.map((c, i) => {
          // 四柱错峰生长：预计算数组，settle = 既有 damping 200
          const e = grows[i];
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
        {/* 20–28 行实测带：横贯四柱的虚线基准带——「恒在 20–28 行」这句口播的测量仪器。
            常驻渲染：整体透明度随 bandT 自 0 起（替代原布尔门） */}
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
  // 标签翻牌是离散事件（每 12f 一翻），保留整数翻转
  const idx = frame < flipAt ? -1 : Math.min(labels.length - 1, Math.floor((frame - flipAt) / 12));
  // 首翻起淡入计数标注（原 idx>=0 硬门瞬现）；在 QuoteCard 早退之前取——hook 数量须恒定
  const flipOp = useProgress(flipAt, DUR.f3);
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
            opacity: flipOp,
          }}
        >
          {`第 ${idx + 1} 次写法`}
        </div>
      </div>
      <Footnote delay={flipAt}>{'同一个位置，换了四次写法'}</Footnote>
    </AbsoluteFill>
  );
};

/** 5-D 回到 P0 的终端，这次它自己跑起来；四层结构合拢成一个**真的壳**。
 *
 *  ★ 本集最大的形式-内容同构（3D 化的第一优先落点）：
 *  p5-17 是全片唯一把整套结构命名为**三维实体名词**的句子——「一个愿意反复跑、
 *  能查表、会拦门、留了插口的**壳**」。此前这里是一个 3px 边框 div，读作「一个框」。
 *  框与壳的差别恰是维度差：**框是一条闭合曲线，壳是一个有内外之分的体**。观众要
 *  读出「终端在壳**里面**」，需要看见壳壁的**内表面**——2D 只能画外轮廓、内外靠约定。
 *
 *  四圈井壁自内向外 = 循环 / 分发表 / 闸门 / 插口：**层序即 z 序**，于是口播反复说的
 *  「挂在外面」在几何上成立（z 更靠前）。这层语义在单层边框里彻底丢失。
 *
 *  它同时兑现 0-B：命名帧给的是**平面轮廓线**（那时观众只知道缺了一层），此处四层
 *  拆完，同一轮廓**长出实体**。轮廓→实体是刻意的戏剧弧，故 0-B 保持平面不动。 */

/** 四层井壁（自内向外）。色即语义，与 P6-A 三张挂件卡逐项相同——是回收不是新造：
 *  循环 = core（唯一用 core 的一层，它是骨架）· 分发表/插口 = mech · 闸门 = deny。 */
const SHELL_RIMS = [
  {name: '循环', edge: 'core', grow: 0},
  {name: '分发表', edge: 'mech', grow: 1},
  {name: '闸门', edge: 'deny', grow: 2},
  {name: '插口', edge: 'mech', grow: 3},
] as const;

/** 四圈的合拢窗口：开在**既有那一条** 26 帧 shell 进度上（win 是 frozen 纯函数，
 *  可安全用于 map）——不新增任何时点，故总帧数与 beat 边界一字未动。 */
const RIM_WIN: readonly (readonly [number, number])[] = [
  [0, 0.4],
  [0.15, 0.55],
  [0.3, 0.7],
  [0.45, 0.9],
];

/** 壳的几何：终端 1120×400，四圈逐层外扩 SHELL_STEP。
 *  ⚠️ 字幕安全带预算（qa_frames SUBTITLE_BAND_PX=160 ⇒ SAFE_TOP_Y=920）：
 *  终端在 1080 高画面里居中 ⇒ 底沿 y=740；壳最外沿 = 740 + 17 + 3×26 + 22 ≈ 857 < 920。 */
const TERM_W = 1120;
const TERM_H = 400;
/** 逐层外扩量：外层比内层每边大 SHELL_STEP，露出的那一圈就是这一层的「壁」 */
const SHELL_STEP = 30;
/** 层厚 = 层间 z 距：相邻层首尾相接，读作连续井壁而非悬浮的四块板 */
const SHELL_DEPTH = 26;
const SHELL_CANVAS_W = TERM_W + 34 + 3 * 2 * SHELL_STEP + 60;
const SHELL_CANVAS_H = TERM_H + 34 + 3 * 2 * SHELL_STEP + 60;

const SelfRunning: React.FC<{shellAt: number; quoteAt: number}> = ({shellAt, quoteAt}) => {
  const frame = useCurrentFrame();
  // 壳合拢是幕级动作：26f ≥22 不入 micro token；原线性 → standard。
  // 在 QuoteCard 早退之前取——hook 数量须恒定
  const shell = useProgress(shellAt, 26);
  if (frame >= quoteAt) {
    return (
      <QuoteCard
        zh="能动性来自模型，而这层壳，给能动性一个落地的地方。"
        en="Agency comes from the model. The harness gives agency a place to land."
        accent={theme.core}
      />
    );
  }
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative'}}>
        {/* 终端浮在壳之上（壳是它的「外围」）——z 层级是调用点契约，不写进原语 */}
        <div style={{position: 'relative', zIndex: 1}}>
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
        </div>
        {/* 四层结构在终端外围合拢成一个**壳**（3D）。
            构造：每层是**一整块实心板**（不是四条边框），自外向内逐层缩小并前移；
            内层遮住外层的中央区，井口由此自然形成——「洞」是遮挡的产物，不是画出来的框。
            ⚠️ 首版用四条 Rim 边框拼井壁：4 层 × 4 条 × 轮廓线 = 16 个矩形边，线条密度
            压倒了面，整组读成「一堆细线框」而非「体」（实景抽帧两轮修复的结论）。
            定位是**调用点契约**（Stage3D 类型上已 Omit 定位属性，ISSUE-177 教训一）。 */}
        <div
          style={{
            position: 'absolute',
            left: (1120 - SHELL_CANVAS_W) / 2,
            top: (400 - SHELL_CANVAS_H) / 2,
            width: SHELL_CANVAS_W,
            height: SHELL_CANVAS_H,
            pointerEvents: 'none',
          }}
        >
          <Stage3D width={SHELL_CANVAS_W} height={SHELL_CANVAS_H}>
            <group rotation={axoRotation()}>
              {SHELL_RIMS.map((r, i) => {
                // 自外向内：i=0(循环) 最内最小最靠前？——不。层序即 z 序，
                // 循环是骨架故在**最里**（z 最深、尺寸最小），插口在最外（z 最浅、最大）。
                const depth = SHELL_RIMS.length - 1 - i; // 3..0，越大越靠外
                const close = win(shell, RIM_WIN[i]);
                const w = TERM_W + 34 + depth * 2 * SHELL_STEP;
                const h = TERM_H + 34 + depth * 2 * SHELL_STEP;
                return (
                  <Slab3D
                    key={r.name}
                    width={w}
                    height={h}
                    depth={SHELL_DEPTH}
                    skin={{
                      // 面色：外层更暗（越靠外越背光）——手绘梯度，非光照计算（宪法三）
                      face: SHELL_FACES[depth],
                      edge:
                        r.edge === 'core' ? theme.core : r.edge === 'deny' ? theme.deny : theme.mech,
                      opacity: 0.35 + 0.65 * close,
                      // 层身份轮廓：越靠外越淡（0.34→0.85），把视觉焦点留给井底的终端；
                      // 四条同亮会让最外圈那道彩边抢过主体（实景抽帧调校）
                      edgeOpacity: close * (0.85 - depth * 0.17),
                      noEdges: true, // 只留正面一圈轮廓（层身份），不要 12 条棱
                    }}
                    // 合拢：自后方推入到位；层序即 z 序（内层更深）
                    position={[0, 0, -depth * SHELL_DEPTH - (1 - close) * 180]}
                    renderOrder={i}
                  />
                );
              })}
            </group>
          </Stage3D>
        </div>
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
      <HarnessBadge />
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
