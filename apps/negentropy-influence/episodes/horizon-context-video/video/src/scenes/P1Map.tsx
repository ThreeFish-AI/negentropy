/** P1 七机制地图：四层信号 → 八层栈 → 承重七件 → 拆解宣言（p1-01..p1-10；storyboard v3「P1 七机制地图」节）。
 *
 *  4 镜 / 5 条 archify cue（镜内锚点一律 at(句id) − 所在镜.from，ArchifyRecap 契约）：
 *   1-A 四层信号——四问卡 + 列名 chip 巡游落卡（@stagger / @travel，装置本文件定义）
 *   1-B 八层栈——LayerStack 自底向上垒起、当前层金描边 → caliber-spine@05 全屏收束（栈随 cue 淡出）
 *   1-C 承重七件——consumer-feed@06 → reserved-supply@07 两章接力（承 1-B 尾背靠背 lead=false）；
 *         顶带图例金样呼吸（@breathe）承接「承重格脉冲点亮」的场外半边（画框内脉冲由录制件承担）
 *   1-D 拆解宣言——three-lesions@08 → ten-teardowns@09 接力（承 1-C 尾 lead=false）；p1-10 定义卡
 *         母题空卡座推近（@pushIn），接 P2-B 注册转场
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import type {SceneRange} from '../types';
import {
  DUR,
  progress,
  useBreathe,
  useDim,
  useEnter,
  usePushIn,
  useStagger,
  useTravel,
} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DefinitionCard, LayerStack} from '../components/devices';

/** #RRGGBB → rgba（theme 未导出 withAlpha 的本地替身；纯函数）。 */
const withA = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** 两 token 色按进度插值（effects 通道走时长+缓动，不吃弹簧）。 */
const mixHex = (a: string, b: string, t: number): string => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
};

export const P1Map: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p1-01', 'p1-03');
  const bB = w('p1-04', 'p1-05');
  const bC = w('p1-06', 'p1-07');
  const bD = w('p1-08', 'p1-10');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P1" tagline="七机制地图 · 坐标系" accent={theme.concept} />

      {/* 1-A 四问卡横排 + 列名 chip 巡游依次落卡（p1-01 建排，p1-02/03 四层逐张点亮） */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="1-A 四层信号">
        <SignalFourCards
          cardsAt={at('p1-01') - bA.from}
          visitAt={at('p1-02') - bA.from}
          endAt={at('p1-03') + Math.round(dur('p1-03') / 2)}
          shotDur={bA.durationInFrames}
        />
      </Sequence>

      {/* 1-B 八层栈：p1-04 自底向上垒起 + 当前层金描边；p1-05 全景图收束（栈淡出让位） */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="1-B 八层栈">
        <EightLayerSlate at={at('p1-04') - bB.from} cueAt={at('p1-05') - bB.from} />
        <ArchifyRecap
          slug="component-panorama"
          caption="口径主线 · 全景收束"
          cues={[{chapterId: 'caliber-spine', at: at('p1-05') - bB.from, durationInFrames: dur('p1-05')}]}
        />
      </Sequence>

      {/* 1-C 承重七件：两章接力全屏独占（承 1-B 尾背靠背 → lead=false 不重放入场）；顶带图例常驻 */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="1-C 承重七件">
        <LoadLegend at={0} />
        <ArchifyRecap
          slug="component-panorama"
          caption="承重七件 · 供给出口可换"
          cues={[
            {chapterId: 'consumer-feed', at: at('p1-06') - bC.from, durationInFrames: dur('p1-06')},
            {chapterId: 'reserved-supply', at: at('p1-07') - bC.from, durationInFrames: dur('p1-07')},
          ]}
          lead={false}
        />
      </Sequence>

      {/* 1-D 拆解宣言：两章接力（承 1-C 尾 → lead=false）；p1-10 空卡座推近接 P2 注册转场 */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="1-D 拆解宣言">
        <ArchifyRecap
          slug="mechanism-experiment-matrix"
          caption="七机制 × 十次拆坏"
          cues={[
            {chapterId: 'three-lesions', at: at('p1-08') - bD.from, durationInFrames: dur('p1-08')},
            {chapterId: 'ten-teardowns', at: at('p1-09') - bD.from, durationInFrames: dur('p1-09')},
          ]}
          lead={false}
        />
        <PreRegisterPush at={at('p1-10') - bD.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 1-A 四层信号

/** 四层问卡文案（口播关键词的结构化落位，不复述整句）。 */
const LAYERS = [
  {q: '有什么', tag: 'Structural', items: '表 · 列 · 血缘', sig: '结构信号'},
  {q: '正在发生什么', tag: 'Operational', items: '查询 · 新鲜度', sig: '运行信号'},
  {q: '它是什么意思', tag: 'Semantic', items: '定义 · 指标', sig: '语义信号'},
  {q: '它被怎么用', tag: 'Behavioral', items: '热度 · 模式', sig: '行为信号'},
] as const;

/** 卡排几何：四卡横排居中（px 量纲，红线一）。 */
const CW = 380;
const CH = 330;
const CGAP = 28;
const ROW_TOP = 400;
const CENTERS = [0, 1, 2, 3].map(
  (i) => (1920 - (4 * CW + 3 * CGAP)) / 2 + CW / 2 + i * (CW + CGAP),
);

/** 巡游弧几何：圆弧浅窗掠过四卡上方（useTravel 的匀速圆巡游，端点恰在各卡中心上方 28px）。 */
const ARC = (() => {
  const half = (CENTERS[3] - CENTERS[0]) / 2; // 612：中心到外侧卡
  const sag = 56; // 弧顶相对端点的抬升
  const gamma = 2 * Math.atan(sag / half); // 半张角（rad）
  const r = half / Math.sin(gamma);
  const apexY = ROW_TOP - 28 - sag; // 316：弧顶
  return {gamma, r, cx: 960, cy: apexY + r};
})();

/** 列名 chip（巡游者与落卡副本同形——同一列的同一枚）。 */
const ChipPill: React.FC<{glow?: boolean}> = ({glow = false}) => (
  <div
    style={{
      fontFamily: theme.mono,
      fontSize: 19,
      color: theme.text,
      whiteSpace: 'nowrap',
      background: theme.bg,
      border: `1.5px solid ${withA(theme.concept, glow ? 1 : 0.85)}`,
      borderRadius: 8,
      padding: '9px 14px',
      boxShadow: glow ? `0 0 14px ${withA(theme.concept, 0.35)}` : 'none',
    }}
  >
    {'amt_ttl_pre_dsc'}
  </div>
);

/** 巡游 chip：嵌套 Sequence 从 visitAt 起算局部帧（useTravel 从 frame 0 起匀速，
 *  延迟只能靠挂载点解决——漏掉这层会让 chip 提前跑完半程）。 */
const ColumnChipSweep: React.FC<{secPerLap: number; offset: number; sweepFrames: number}> = ({
  secPerLap,
  offset,
  sweepFrames,
}) => {
  const frame = useCurrentFrame();
  const t = useTravel({cx: ARC.cx, cy: ARC.cy, r: ARC.r, secPerLap, offset});
  // 到达末卡即溶入落卡副本（旅程终点 = 第 4 枚落位，不越界漂走）
  const o = Math.min(progress(frame, 0, DUR.f3), 1 - progress(frame, sweepFrames - 6, DUR.f3));
  return (
    <div
      style={{
        position: 'absolute',
        left: t.x,
        top: t.y,
        transform: 'translate(-50%, -50%)',
        opacity: o,
      }}
    >
      <ChipPill glow />
    </div>
  );
};

/** 1-A 装置：四问卡错峰亮（@stagger）→ 列名 chip 巡游（@travel）依次落入四卡。
 *  落卡时点由弧几何解析求逆（chip 横坐标过卡中心的帧），与巡游者同源故恒同步；
 *  句对齐靠「p1-02 起点 → p1-03 中点」的匀速扫掠（p1-02≈p1-03 等长时恰为
 *  [02起, 02中, 03起, 03中] 四拍，两句时长差 <10% 时偏移不足半句）。 */
const SignalFourCards: React.FC<{cardsAt: number; visitAt: number; endAt: number; shotDur: number}> = ({
  cardsAt,
  visitAt,
  endAt,
  shotDur,
}) => {
  const {fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const enters = useStagger(4, {at: cardsAt, stride: 9, dur: DUR.f4});
  const sweepFrames = Math.max(1, endAt - visitAt);
  const gammaDeg = (ARC.gamma * 180) / Math.PI;
  // 整窗 2γ 恰好在 sweepFrames 内走完 ⇒ secPerLap = (360/2γ) × sweepSec
  const secPerLap = (180 / gammaDeg) * (sweepFrames / fps);
  const offset = (360 - gammaDeg) / 360; // 局部帧 0 时 chip 位于首卡上方（270° − γ）
  const land = CENTERS.map((x) =>
    Math.max(visitAt, visitAt + ((ARC.gamma - Math.asin((ARC.cx - x) / ARC.r)) / (2 * ARC.gamma)) * sweepFrames),
  );
  return (
    <AbsoluteFill>
      {LAYERS.map((L, i) => {
        const e = enters[i];
        const drop = progress(frame, land[i], DUR.f4); // 落卡副本
        const lit = progress(frame, land[i] + 3, DUR.f3); // 卡体点亮（反枚举：panel 底+编号，激活才染金）
        return (
          <div
            key={L.tag}
            style={{
              position: 'absolute',
              left: CENTERS[i] - CW / 2,
              top: ROW_TOP,
              width: CW,
              height: CH,
              borderRadius: 14,
              background: theme.panel,
              border: `2px solid ${mixHex(theme.panelBorder, theme.concept, lit)}`,
              boxShadow: lit > 0 ? `0 0 ${20 * lit}px ${withA(theme.concept, 0.32 * lit)}` : 'none',
              opacity: e,
              transform: `translateY(${(1 - e) * 26}px)`,
              padding: 24,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
              <span style={{fontFamily: theme.mono, fontSize: 20, color: mixHex(theme.dim, theme.concept, lit)}}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                style={{
                  fontFamily: theme.mono,
                  fontSize: 13,
                  letterSpacing: 1,
                  color: theme.dim,
                  border: `1.5px solid ${theme.panelBorder}`,
                  borderRadius: 6,
                  padding: '3px 8px',
                }}
              >
                {L.tag}
              </span>
            </div>
            <div style={{marginTop: 16, fontFamily: theme.sans, fontSize: 31, fontWeight: 700, color: theme.text}}>
              {L.q}
            </div>
            <div style={{position: 'relative', height: 48, marginTop: 22, opacity: drop, transform: `translateY(${(1 - drop) * -46}px)`}}>
              <ChipPill />
            </div>
            <div style={{marginTop: 18, fontFamily: theme.sans, fontSize: 23, color: mixHex(theme.dim, theme.text, lit)}}>
              {L.items}
            </div>
            <div style={{marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10}}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  border: `2px solid ${mixHex(theme.panelBorder, theme.concept, lit)}`,
                }}
              />
              <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{L.sig}</span>
            </div>
          </div>
        );
      })}
      {/* 巡游者：p1-02 起挂在嵌套 Sequence 上，局部帧 0 = chip 在首卡上方 */}
      <Sequence from={visitAt} durationInFrames={Math.max(1, shotDur - visitAt)}>
        <ColumnChipSweep secPerLap={secPerLap} offset={offset} sweepFrames={sweepFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 1-B 八层栈

/** 1-B 装置：八层自底向上垒起（层落=translateY+透明度，LayerStack 内置），
 *  当前层金描边=「定义」（p1-10 起本集从语义视图开拆，锚定转场）；供给/出口
 *  预降饱和（p1-07「配件可换」的伏笔）；cue 起前整片淡出让位全屏画框。 */
const EightLayerSlate: React.FC<{at: number; cueAt: number}> = ({at, cueAt}) => {
  const dim = useDim({at: cueAt - 6, to: 0});
  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 34,
        opacity: dim,
      }}
    >
      <div style={{fontFamily: theme.mono, fontSize: 18, letterSpacing: 2, color: theme.dim}}>
        {'四层信号 → 受治理对象'}
      </div>
      <LayerStack
        at={at}
        activeIndex={1}
        activeAt={at + 42}
        desat={[3, 7]}
        width={760}
        layerH={58}
        layers={[
          {name: '数据 · 引擎', sub: '底座'},
          {name: '定义'},
          {name: '执行'},
          {name: '供给'},
          {name: '应答'},
          {name: '账本'},
          {name: '身份'},
          {name: '出口'},
        ]}
      />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 1-C 顶带图例

/** 1-C 图例：承重七件（金·呼吸辉光 @breathe）/ 供给出口可换（灰）——挂幕顶带
 *  （y 96–124，画框顶 150 之上、章节条 42 之下，右缘与 SceneTag 左右对峙），
 *  为画框内金描边/降饱和两区补一枚色钥匙。 */
const LoadLegend: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('rise', {at, dur: DUR.f4, dist: 18});
  const glow = useBreathe({period: 120, base: 0.45, amp: 0.55});
  return (
    <div style={{...e, position: 'absolute', right: 72, top: 96, display: 'flex', gap: 28, alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            border: `2px solid ${theme.concept}`,
            boxShadow: `0 0 ${8 + 10 * glow}px ${withA(theme.concept, 0.55)}`,
          }}
        />
        <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.text}}>{'承重七件'}</span>
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
        <div style={{width: 16, height: 16, borderRadius: 4, border: `2px solid ${theme.panelBorder}`}} />
        <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'供给出口 · 可换'}</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────── 1-D 收尾推近

/** 1-D 收尾：定义卡母题空卡座（P0 同形缺席态）推近（@pushIn）——注册发生在 P2-B，
 *  此处只把卡座送到台口。 */
const PreRegisterPush: React.FC<{at: number}> = ({at}) => {
  const push = usePushIn(at, {scale: 0.07, dur: DUR.f6});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{transform: push}}>
        <DefinitionCard at={at} empty enter="fade" halo={0.25} />
      </div>
    </AbsoluteFill>
  );
};
