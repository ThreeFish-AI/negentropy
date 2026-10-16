/** P1 三面蓝图（p1-01..p1-39，39 句；storyboard v4「P1 三面蓝图」节）。
 *
 *  11 镜 / 18 条 archify cue（镜内锚点一律 at(句id) − 所在镜.from，ArchifyRecap 契约）：
 *   1-A 窗口定义（装置：模型窗口框 + 三动词标签 tie together/add/package@p1-02..03
 *       + token 阵列点亮@p1-04 + 角标「上下文＝采样时纳入的 token 集合」）
 *   1-B 五类来源（装置：RequestCard〔M-001〕居中 + 五类标签@p1-05..06 + 对应物连线
 *       逐条描画@p1-07..08〔M-005〕）
 *   1-C 来源之外（装置：五类标签收拢压缩为投影行 + 血缘/核准问答对两卡 fall@p1-10
 *       + 「视角之一」章@p1-11）
 *   1-D arc-facets@p1-12 + hold@13/14/15（三面各答一问）
 *   1-E RequestCard 回屏 + 三指线指三面缩略（装置；arc-facets@p1-16 + hold@17 recap
 *       后置遮盖，承 1-D 尾镜界背靠背 → lead=false）
 *   1-F arc-axes@p1-18 + hold@19..23（五轴点名；承 1-E 链尾背靠背 → lead=false）
 *   1-G FiveAxisMap 首建（built=false 建立面生长，Map-First 主锚）+「换 X 不动 Y」
 *       四行对照@p1-25..27 + 拔轴消融演示@p1-28（警示红 · 破坏实验）
 *   1-H lc2-open@p1-29 + hold@30/31（六段总览；1-G 装置镜空窗后重现 → 默认 lead）
 *   1-I lc2-loops@p1-32 + hold@33/34（两环；承 1-H 链尾背靠背 → lead=false；
 *       p1-34 断环双角标走画框外左余量）
 *   1-J G1–G7 法则小标快闪钉六段接缝缩略条（1 句重音镜）
 *   1-K token 方块持续落入 + InvertedU 下垂（持续陈述配持续态〔M-003〕）+ 金句卡@p1-38
 *       + 「从资产轴开始」预告条@p1-39
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme, withAlpha} from '../design/theme';
import {clamp01, progress, useDim, useEnter, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {QuoteCard} from '../components/cards';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {InvertedU} from '../components/InvertedU';
import {FiveAxisMap, FIVE_AXIS_GEOM} from '../components/FiveAxisMap';
import {RequestCard} from '../components/RequestCard';

export const P1Blueprint: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p1-01', 'p1-04');
  const bB = w('p1-05', 'p1-08');
  const bC = w('p1-09', 'p1-11');
  const bD = w('p1-12', 'p1-15');
  const bE = w('p1-16', 'p1-17');
  const bF = w('p1-18', 'p1-23');
  const bG = w('p1-24', 'p1-28');
  const bH = w('p1-29', 'p1-31');
  const bI = w('p1-32', 'p1-34');
  const bJ = w('p1-35');
  const bK = w('p1-36', 'p1-39');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P1" tagline="三面蓝图" accent={theme.concept} />

      {/* 1-A 窗口定义 */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="1-A">
        <WindowDefine
          a01={at('p1-01') - bA.from}
          a02={at('p1-02') - bA.from}
          a03={at('p1-03') - bA.from}
          a04={at('p1-04') - bA.from}
        />
      </Sequence>

      {/* 1-B 五类来源：RequestCard + 五类标签 + 对应物连线 */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="1-B">
        <FiveSources
          a05={at('p1-05') - bB.from}
          a07={at('p1-07') - bB.from}
        />
      </Sequence>

      {/* 1-C 来源之外：五类收拢投影 + 两张圈外对象卡 */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="1-C">
        <OutsideSources
          a09={at('p1-09') - bC.from}
          a10={at('p1-10') - bC.from}
          a11={at('p1-11') - bC.from}
        />
      </Sequence>

      {/* 1-D 三面各答一问：arc-facets 锚 + hold 链 */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="1-D">
        <ArchifyRecap slug="blueprint--architecture" caption="三面蓝图 · 三面各答一问" cues={[
          {chapterId: 'arc-facets', at: at('p1-12') - bD.from, durationInFrames: dur('p1-12')},
          {chapterId: 'arc-facets', at: at('p1-13') - bD.from, durationInFrames: dur('p1-13'), fit: 'hold'},
          {chapterId: 'arc-facets', at: at('p1-14') - bD.from, durationInFrames: dur('p1-14'), fit: 'hold'},
          {chapterId: 'arc-facets', at: at('p1-15') - bD.from, durationInFrames: dur('p1-15'), fit: 'hold'},
        ]} />
      </Sequence>

      {/* 1-E 面到请求：RequestCard + 三指线（装置）+ arc-facets recap 后置遮盖 */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="1-E">
        <FacetPointers a16={at('p1-16') - bE.from} a17={at('p1-17') - bE.from} />
        <ArchifyRecap slug="blueprint--architecture" caption="三面蓝图 · 面到请求" lead={false} cues={[
          {chapterId: 'arc-facets', at: at('p1-16') - bE.from, durationInFrames: dur('p1-16')},
          {chapterId: 'arc-facets', at: at('p1-17') - bE.from, durationInFrames: dur('p1-17'), fit: 'hold'},
        ]} />
      </Sequence>

      {/* 1-F 五轴点名：arc-axes 锚 + hold 链 */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="1-F">
        <ArchifyRecap slug="blueprint--architecture" caption="三面蓝图 · 五轴" lead={false} cues={[
          {chapterId: 'arc-axes', at: at('p1-18') - bF.from, durationInFrames: dur('p1-18')},
          {chapterId: 'arc-axes', at: at('p1-19') - bF.from, durationInFrames: dur('p1-19'), fit: 'hold'},
          {chapterId: 'arc-axes', at: at('p1-20') - bF.from, durationInFrames: dur('p1-20'), fit: 'hold'},
          {chapterId: 'arc-axes', at: at('p1-21') - bF.from, durationInFrames: dur('p1-21'), fit: 'hold'},
          {chapterId: 'arc-axes', at: at('p1-22') - bF.from, durationInFrames: dur('p1-22'), fit: 'hold'},
          {chapterId: 'arc-axes', at: at('p1-23') - bF.from, durationInFrames: dur('p1-23'), fit: 'hold'},
        ]} />
      </Sequence>

      {/* 1-G 换轴不动：FiveAxisMap 首建 + 四行对照 + 拔轴消融 */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="1-G">
        <AxisIndependence
          a24={at('p1-24') - bG.from}
          a25={at('p1-25') - bG.from}
          a26={at('p1-26') - bG.from}
          a27={at('p1-27') - bG.from}
          a28={at('p1-28') - bG.from}
        />
      </Sequence>

      {/* 1-H 六段总览：lc2-open 锚 + hold 链（空窗后重现 → 默认 lead） */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="1-H">
        <ArchifyRecap slug="lifecycle" caption="三面蓝图 · 时间面六段" cues={[
          {chapterId: 'lc2-open', at: at('p1-29') - bH.from, durationInFrames: dur('p1-29')},
          {chapterId: 'lc2-open', at: at('p1-30') - bH.from, durationInFrames: dur('p1-30'), fit: 'hold'},
          {chapterId: 'lc2-open', at: at('p1-31') - bH.from, durationInFrames: dur('p1-31'), fit: 'hold'},
        ]} />
      </Sequence>

      {/* 1-I 两环：lc2-loops 锚 + hold 链；断环双角标走画框外左余量 */}
      <Sequence from={bI.from} durationInFrames={bI.durationInFrames} name="1-I">
        <BrokenLoopTags a34={at('p1-34') - bI.from} />
        <ArchifyRecap slug="lifecycle" caption="三面蓝图 · 两环" lead={false} cues={[
          {chapterId: 'lc2-loops', at: at('p1-32') - bI.from, durationInFrames: dur('p1-32')},
          {chapterId: 'lc2-loops', at: at('p1-33') - bI.from, durationInFrames: dur('p1-33'), fit: 'hold'},
          {chapterId: 'lc2-loops', at: at('p1-34') - bI.from, durationInFrames: dur('p1-34'), fit: 'hold'},
        ]} />
      </Sequence>

      {/* 1-J 法则点名：G1–G7 小标快闪钉六段接缝缩略条 */}
      <Sequence from={bJ.from} durationInFrames={bJ.durationInFrames} name="1-J">
        <RulePins a35={at('p1-35') - bJ.from} />
      </Sequence>

      {/* 1-K 预算公理：token 持续落入 + 倒 U 下垂 + 金句卡 + 预告条 */}
      <Sequence from={bK.from} durationInFrames={bK.durationInFrames} name="1-K">
        <BudgetAxiom
          a36={at('p1-36') - bK.from}
          a37={at('p1-37') - bK.from}
          a38={at('p1-38') - bK.from}
          a39={at('p1-39') - bK.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 1-A 窗口定义：模型窗口框 + 三动词标签 + token 阵列点亮。 */
const WindowDefine: React.FC<{a01: number; a02: number; a03: number; a04: number}> = ({a01, a02, a03, a04}) => {
  const frame = useCurrentFrame();
  const enter = useEnter('pop', {at: a01, dur: 20});
  const tokens = useStagger(20, {stride: 3, at: a04});
  const noteIn = clamp01(progress(frame, a04 + 12, 12));
  // 三动词标签：p1-02 起依次贴上（tie together / add / package）
  const verbAnchors = [a02, a03, a03 + 18];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{...enter, position: 'absolute', left: 630, top: 210, width: 660, height: 380, border: `3px solid ${theme.concept}`, borderRadius: 14, background: theme.panel, overflow: 'hidden'}}>
        {/* token 方块阵列 */}
        <div style={{position: 'absolute', inset: 24, display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 8, alignContent: 'start'}}>
          {tokens.map((k, i) => (
            <div
              key={i}
              style={{
                height: 30,
                borderRadius: 4,
                border: `1.5px solid ${k > 0.3 ? withAlpha(theme.concept, 0.9) : theme.panelBorder}`,
                background: k > 0.3 ? withAlpha(theme.concept, 0.12) : 'transparent',
                opacity: 0.35 + 0.65 * k,
              }}
            />
          ))}
        </div>
        <div style={{position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center', fontSize: 18, color: theme.dim, opacity: noteIn}}>
          上下文 ＝ 采样时纳入的 token 集合
        </div>
      </div>
      {/* 三动词标签（a16z 定义角标） */}
      {[
        {zh: '接起来', en: 'tie together'},
        {zh: '加业务逻辑', en: 'add'},
        {zh: '打包供给', en: 'package'},
      ].map((v, i) => {
        const k = clamp01(progress(frame, verbAnchors[i], 12));
        return (
          <div
            key={v.zh}
            style={{
              position: 'absolute',
              left: 630 + i * 226,
              top: 146,
              padding: '6px 14px',
              borderRadius: 8,
              border: `1.5px solid ${theme.concept}`,
              background: theme.panel,
              opacity: k,
              transform: `translateY(${(1 - k) * -14}px)`,
            }}
          >
            <span style={{fontSize: 19, color: theme.text}}>{v.zh}</span>
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginLeft: 8}}>{v.en}</span>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 1320, top: 152, fontFamily: theme.mono, fontSize: 14, color: theme.dim, opacity: clamp01(progress(frame, a03, 10))}}>
        a16z 定义 · 三动词
      </div>
    </AbsoluteFill>
  );
};

/** 五类来源标签与请求对应物（1-B/1-C 共用几何）。 */
const SRC_LABELS = ['指令', '记忆', '知识', '工具与技能', '会话'] as const;
const SRC_OBJECTS = ['指标定义', '负责华东区', '指标说明文档', '查库工具', '这几轮对话'] as const;
const SRC_W = 240;
const SRC_STRIDE = 282;
const SRC_X0 = Math.round((1920 - (5 * SRC_W + 4 * (SRC_STRIDE - SRC_W))) / 2);
const SRC_Y = 560;
const OBJ_Y = 452;
const srcCx = (i: number) => SRC_X0 + i * SRC_STRIDE + SRC_W / 2;

/** 1-B 五类来源：RequestCard 居中 + 五类标签排开 + 连线逐条落到请求对应物。 */
const FiveSources: React.FC<{a05: number; a07: number}> = ({a05, a07}) => {
  const frame = useCurrentFrame();
  const labels = useStagger(5, {stride: 8, at: a05 + 4});
  const lines = useStagger(5, {stride: 16, at: a07});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 580, top: 150}}>
        <RequestCard at={a05} />
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {SRC_OBJECTS.map((_, i) => (
          <path
            key={i}
            d={`M 960 356 C 960 ${396 + i * 4}, ${srcCx(i)} ${408}, ${srcCx(i)} ${OBJ_Y - 6}`}
            fill="none"
            stroke={theme.concept}
            strokeWidth={2}
            opacity={lines[i] * 0.8}
            pathLength={1}
            strokeDasharray={lines[i]}
            strokeDashoffset={1 - lines[i]}
          />
        ))}
      </svg>
      {SRC_OBJECTS.map((o, i) => (
        <div
          key={o}
          style={{
            position: 'absolute',
            left: srcCx(i) - 105,
            top: OBJ_Y,
            width: 210,
            height: 44,
            borderRadius: 7,
            border: `1.5px solid ${theme.panelBorder}`,
            background: theme.panel,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 17,
            color: theme.dim,
            opacity: lines[i],
          }}
        >
          {o}
        </div>
      ))}
      {SRC_LABELS.map((s, i) => (
        <div
          key={s}
          style={{
            position: 'absolute',
            left: SRC_X0 + i * SRC_STRIDE,
            top: SRC_Y,
            width: SRC_W,
            height: 62,
            borderRadius: 8,
            border: `1.5px solid ${theme.concept}`,
            background: theme.panel,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            color: theme.text,
            opacity: labels[i],
            transform: `translateY(${(1 - labels[i]) * 14}px)`,
          }}
        >
          {s}
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** 1-C 来源之外：五类收拢压缩为投影行 + 血缘/核准问答对两卡 fall + 「视角之一」章。 */
const OutsideSources: React.FC<{a09: number; a10: number; a11: number}> = ({a09, a10, a11}) => {
  const frame = useCurrentFrame();
  const conv = useSpring('settle', {at: a09, dur: 26});
  const cards = useStagger(2, {stride: 14, at: a10});
  const stamp = useSpring('snap', {at: a11, dur: 14});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 五类标签收拢：向中心压缩淡出 */}
      {SRC_LABELS.map((s, i) => {
        const cx = srcCx(i);
        return (
          <div
            key={s}
            style={{
              position: 'absolute',
              left: SRC_X0 + i * SRC_STRIDE,
              top: SRC_Y,
              width: SRC_W,
              height: 62,
              borderRadius: 8,
              border: `1.5px solid ${theme.panelBorder}`,
              background: theme.panel,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              color: theme.dim,
              opacity: (1 - conv * 0.85) * (i === 2 ? 1 : 0.8),
              transform: `translate(${(960 - cx) * conv * 0.8}px, 0) scale(${1 - 0.5 * conv})`,
            }}
          >
            {s}
          </div>
        );
      })}
      {/* 投影行：五类来源 · 视角 */}
      <div
        style={{
          position: 'absolute',
          left: 960 - 190,
          top: SRC_Y + 6,
          width: 380,
          height: 50,
          borderRadius: 8,
          border: `2px solid ${theme.concept}`,
          background: withAlpha(theme.concept, 0.12),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          color: theme.concept,
          letterSpacing: 2,
          opacity: clamp01((conv - 0.55) / 0.3),
          transform: `scale(${0.7 + 0.3 * clamp01((conv - 0.55) / 0.45)})`,
        }}
      >
        五类来源 · 投影行
      </div>
      <div
        style={{
          position: 'absolute',
          left: 960 + 96,
          top: SRC_Y - 12,
          padding: '6px 16px',
          border: `2.5px solid ${theme.ok}`,
          borderRadius: 8,
          fontSize: 20,
          color: theme.ok,
          background: theme.panel,
          transform: `rotate(-7deg) scale(${stamp})`,
          opacity: stamp,
        }}
      >
        视角之一
      </div>
      {/* 两张五类之外的对象卡 */}
      {[
        {t: '血缘', s: '每个数从哪几张表算出来', x: 300},
        {t: '核准问答对 · 标签规则', s: '也落在五类之外', x: 1140},
      ].map((c, i) => (
        <div
          key={c.t}
          style={{
            position: 'absolute',
            left: c.x,
            top: 690 + (1 - cards[i]) * -46,
            width: 480,
            height: 130,
            borderRadius: 10,
            border: `1.5px solid ${theme.panelBorder}`,
            background: theme.panel,
            padding: '20px 26px',
            boxSizing: 'border-box',
            opacity: cards[i],
          }}
        >
          <div style={{fontSize: 26, color: theme.text}}>{c.t}</div>
          <div style={{fontSize: 17, color: theme.dim, marginTop: 10}}>{c.s}</div>
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** 1-E 面到请求：RequestCard 回屏 + 三指线指向三面缩略。 */
const FacetPointers: React.FC<{a16: number; a17: number}> = ({a16, a17}) => {
  const thumbs = useStagger(3, {stride: 10, at: a16});
  const lines = useStagger(3, {stride: 14, at: a16 + 6});
  const lift = useProgress(a17, 14);
  const FACETS = [
    {t: '验收面', s: '属于哪一行', y: 260},
    {t: '结构面', s: '该改哪条轴', y: 430},
    {t: '时间面', s: '错在哪一段', y: 600},
  ];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 500, top: 260, transform: `translateY(${-6 * lift}px)`}}>
        <RequestCard at={a16} />
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {FACETS.map((f, i) => (
          <g key={f.t} opacity={lines[i]}>
            <path
              d={`M 1268 ${356} C 1420 ${356}, 1500 ${f.y + 34}, 1636 ${f.y + 34}`}
              fill="none"
              stroke={theme.concept}
              strokeWidth={2.5}
              pathLength={1}
              strokeDasharray={lines[i]}
              strokeDashoffset={1 - lines[i]}
            />
            <text x={1420} y={(356 + f.y + 34) / 2 - 10} fill={theme.dim} fontSize={16}>
              {f.s}
            </text>
          </g>
        ))}
      </svg>
      {FACETS.map((f, i) => (
        <div
          key={f.t}
          style={{
            position: 'absolute',
            left: 1640,
            top: f.y,
            width: 240,
            height: 68,
            borderRadius: 8,
            border: `1.5px solid ${theme.panelBorder}`,
            background: theme.panel,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 23,
            color: theme.text,
            opacity: thumbs[i],
            transform: `translateX(${(1 - thumbs[i]) * 24}px)`,
          }}
        >
          {f.t}
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** 1-G 换轴不动：FiveAxisMap 建立面生长 + 「换 X 不动 Y」四行对照 + 拔轴消融演示。 */
const INDEPENDENCE_ROWS = [
  {a: '换检索算法', b: '不动权限规则'},
  {a: '换进窗档位', b: '不动对象清单'},
  {a: '执法点挪层', b: '候选生成不受影响'},
  {a: '加回写回路', b: '装配不用改'},
] as const;

const AxisIndependence: React.FC<{a24: number; a25: number; a26: number; a27: number; a28: number}> = ({a24, a25, a26, a27, a28}) => {
  const frame = useCurrentFrame();
  const header = useEnter('rise', {at: a24, dur: 14});
  // 四行对照：p1-25 两行、p1-26、p1-27 各一行（行锚数组 + 纯函数 progress——map 内禁 hook）
  const rowAnchors = [a25, a25 + 16, a26, a27];
  const pulled = useProgress(a28, 12);
  const pullFlash = useImpulse({at: a28 + 8, dur: 24, peak: 1});
  const dim = useDim({at: a28, to: 0.45, dur: 14});
  const gx = FIVE_AXIS_GEOM.nodes[3].x;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{opacity: pulled > 0 ? dim : 1}}>
        <FiveAxisMap built={false} at={0} />
      </div>
      {/* 判据 + 四行对照 */}
      <div style={{...header, position: 'absolute', left: 560, top: 448, padding: '6px 20px', border: `2px solid ${theme.concept}`, borderRadius: 8, fontSize: 22, color: theme.concept, background: theme.panel, letterSpacing: 2}}>
        判据 · 换掉一条 · 不动其他
      </div>
      {INDEPENDENCE_ROWS.map((r, i) => {
        const k = clamp01(progress(frame, rowAnchors[i], 14));
        return (
          <div
            key={r.a}
            style={{
              position: 'absolute',
              left: 460,
              top: 516 + i * 84,
              width: 1000,
              height: 66,
              borderRadius: 9,
              border: `1.5px solid ${theme.panelBorder}`,
              background: theme.panel,
              display: 'flex',
              alignItems: 'center',
              padding: '0 26px',
              gap: 22,
              opacity: k,
              transform: `translateX(${(1 - k) * -26}px)`,
              boxSizing: 'border-box',
            }}
          >
            <span style={{fontSize: 22, color: theme.text, width: 300}}>{r.a}</span>
            <svg width={90} height={20}>
              <line x1={0} y1={10} x2={70} y2={10} stroke={theme.dim} strokeWidth={2.5} />
              <path d="M 70 4 L 86 10 L 70 16 Z" fill={theme.dim} />
            </svg>
            <span style={{fontSize: 22, color: theme.concept}}>{r.b}</span>
          </div>
        );
      })}
      {/* 拔轴消融演示：检索轴拆除（警示红 · 破坏实验），其余轴救不了 */}
      <div style={{opacity: pulled}}>
        <div
          style={{
            position: 'absolute',
            left: gx,
            top: FIVE_AXIS_GEOM.node.y,
            width: FIVE_AXIS_GEOM.node.w,
            height: FIVE_AXIS_GEOM.node.h,
            borderRadius: 10,
            border: `2.5px dashed ${theme.danger}`,
            transform: `translateY(${pulled * 16}px) rotate(${pulled * -1.2}deg)`,
            opacity: 0.4 + 0.6 * pullFlash,
          }}
        />
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: pulled}}>
          <line x1={gx + 18} y1={FIVE_AXIS_GEOM.node.y + 20} x2={gx + FIVE_AXIS_GEOM.node.w - 18} y2={FIVE_AXIS_GEOM.node.y + FIVE_AXIS_GEOM.node.h - 20} stroke={theme.danger} strokeWidth={3} />
        </svg>
        <div style={{position: 'absolute', left: gx, top: FIVE_AXIS_GEOM.node.y - 44, padding: '4px 14px', border: `2px solid ${theme.danger}`, borderRadius: 7, fontSize: 18, color: theme.danger, background: theme.panel, opacity: pulled}}>
          检索轴 · 拆除
        </div>
        <div style={{position: 'absolute', left: gx - 4, top: FIVE_AXIS_GEOM.node.y + FIVE_AXIS_GEOM.node.h + 16, fontSize: 17, color: theme.danger, opacity: pulled}}>
          失效可复现 · 其余四轴补不上
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 1-I 断环双角标（画框外左余量）：验证环断 / 进化环断。 */
const BrokenLoopTags: React.FC<{a34: number}> = ({a34}) => {
  const ins = useStagger(2, {stride: 14, at: a34});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {[
        {t: '验证环断 · 错误静默积累', y: 540},
        {t: '进化环断 · 停在最初质量', y: 612},
      ].map((c, i) => (
        <div
          key={c.t}
          style={{
            position: 'absolute',
            left: 36,
            top: c.y,
            width: 262,
            padding: '10px 12px',
            borderRadius: 8,
            border: `1.5px solid ${theme.conceptDeep}`,
            background: theme.panel,
            fontSize: 16,
            color: theme.conceptDeep,
            lineHeight: 1.5,
            opacity: ins[i],
            boxSizing: 'border-box',
          }}
        >
          {c.t}
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** 1-J 法则点名：六段缩略条 + G1–G7 小标快闪钉接缝。 */
const STAGES6 = ['采集登记', '校验裁决', '装配执法', '应答锚定', '沉淀回写', '衰减退役'] as const;
const RULES7 = [
  'G1 执法点绑定',
  'G2 双期校验',
  'G3 裁决不自动化',
  'G4 分开落位',
  'G5 指针不副本',
  'G6 退役路径',
  'G7 闭环可观测',
] as const;
const CELL_W = 240;
const CELL_GAP = 24;
const CELL_X0 = Math.round((1920 - (6 * CELL_W + 5 * CELL_GAP)) / 2);
const CELL_Y = 540;

const RulePins: React.FC<{a35: number}> = ({a35}) => {
  const cells = useStagger(6, {stride: 3, at: a35});
  const pins = useStagger(7, {stride: 4, at: a35 + 14, dur: 4});
  const flash = useImpulse({at: a35 + 48, dur: 20, peak: 0.7});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 420, textAlign: 'center', fontSize: 20, color: theme.dim, opacity: cells[0]}}>
        七条治理法则 · 落在段与段的转换上
      </div>
      {STAGES6.map((s, i) => (
        <div
          key={s}
          style={{
            position: 'absolute',
            left: CELL_X0 + i * (CELL_W + CELL_GAP),
            top: CELL_Y,
            width: CELL_W,
            height: 96,
            borderRadius: 9,
            border: `1.5px solid ${theme.panelBorder}`,
            background: theme.panel,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            opacity: cells[i],
            transform: `translateY(${(1 - cells[i]) * 12}px)`,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>L{i + 1}</span>
          <span style={{fontSize: 22, color: theme.text}}>{s}</span>
        </div>
      ))}
      {RULES7.map((r, i) => {
        // 钉位：首段前缘 / 五处段间接缝 / 末段后缘（法则落在段与段的转换上）
        const px =
          i === 0
            ? CELL_X0
            : i === 6
              ? CELL_X0 + 6 * CELL_W + 5 * CELL_GAP
              : CELL_X0 + i * (CELL_W + CELL_GAP) - CELL_GAP / 2;
        const k = pins[i];
        return (
          <div
            key={r}
            style={{
              position: 'absolute',
              left: px - 95,
              top: 460 + (i % 2) * 0 + (1 - k) * -20,
              width: 190,
              padding: '5px 0',
              textAlign: 'center',
              borderRadius: 7,
              border: `1.5px solid ${i % 2 ? theme.conceptDeep : theme.concept}`,
              color: i % 2 ? theme.conceptDeep : theme.concept,
              fontSize: 15,
              background: theme.panel,
              opacity: k * (1 - 0.4 * flash),
              transform: `translateY(${(1 - k) * -18}px) rotate(${i % 2 ? 1.6 : -1.6}deg)`,
              boxSizing: 'border-box',
            }}
          >
            {r}
          </div>
        );
      })}
      {/* 接缝钉点（法则落在接缝上） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: 0.7}}>
        {[1, 2, 3, 4, 5].map((i) => (
          <circle
            key={i}
            cx={CELL_X0 + i * (CELL_W + CELL_GAP) - CELL_GAP / 2}
            cy={CELL_Y - 8}
            r={4}
            fill={theme.dim}
            opacity={cells[i]}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

/** 1-K 预算公理：token 方块持续落入（持续态）+ 倒 U 下垂 + 金句卡 + 预告条。 */
const BudgetAxiom: React.FC<{a36: number; a37: number; a38: number; a39: number}> = ({a36, a37, a38, a39}) => {
  const frame = useCurrentFrame();
  const quoteIn = clamp01(progress(frame, a38, 10));
  const capIn = clamp01(progress(frame, a37, 12));
  const barIn = clamp01(progress(frame, a39, 10));
  const curveDim = 1 - 0.72 * quoteIn;
  // token 方块持续落入（帧驱动确定性循环；167 与 470 互素保证相位均匀不扎堆）
  const COLS = 9;
  const squares = Array.from({length: 27}, (_, i) => {
    const col = i % COLS;
    const phase = (i * 167) % 470;
    const y = 250 + ((frame * 3 + phase) % 470);
    return {col, y, o: y > 660 ? 0.15 : 0.55};
  });
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', inset: 0, opacity: curveDim}}>
        {/* 左：窗口填充（token 持续落入 + 有限预算线） */}
        <div style={{position: 'absolute', left: 250, top: 230, width: 640, height: 470, borderRadius: 12, border: `1.5px solid ${theme.panelBorder}`, background: theme.panel, overflow: 'hidden'}}>
          <div style={{position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center', fontSize: 17, color: theme.dim}}>模型窗口 · 填充演示</div>
          {squares.map((s, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 28 + s.col * 66,
                top: s.y,
                width: 48,
                height: 26,
                borderRadius: 4,
                border: `1.5px solid ${withAlpha(theme.concept, 0.8)}`,
                background: withAlpha(theme.concept, 0.1),
                opacity: s.o,
              }}
            />
          ))}
          <div style={{position: 'absolute', left: 0, right: 0, top: 120 + (1 - capIn) * -30, height: 2, background: theme.conceptDeep, opacity: capIn}} />
          <div style={{position: 'absolute', right: 16, top: 100, fontSize: 15, color: theme.conceptDeep, opacity: capIn}}>有限预算</div>
        </div>
        {/* 右：倒 U（塞得越多越找不准） */}
        <div style={{position: 'absolute', left: 920, right: 40, top: 150, bottom: 60}}>
          <InvertedU at={a36} />
        </div>
      </div>
      {/* 金句卡（蓝图目标只有一句） */}
      <div style={{position: 'absolute', inset: 0, opacity: quoteIn, pointerEvents: 'none'}}>
        <QuoteCard zh="预算之内 · 只放最有用的那一小部分" accent={theme.concept} />
      </div>
      {/* 预告条：从资产轴开始 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 170,
          display: 'flex',
          justifyContent: 'center',
          opacity: barIn * (1 - 0.3 * quoteIn),
        }}
      >
        <span style={{padding: '8px 26px', border: `1.5px solid ${theme.concept}`, borderRadius: 8, fontSize: 21, color: theme.concept, background: theme.panel, letterSpacing: 2}}>
          从资产轴开始
        </span>
      </div>
    </AbsoluteFill>
  );
};
