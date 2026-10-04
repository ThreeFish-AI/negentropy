/** P6 收束（p6-01..10，3 镜 2 cue）——分镜 6-A…6-C。
 *
 *  ★ 回答 P0：敢让模型动手 = 不换的循环 + 长在圈外的三层外设；分工遗产句
 *    （医生开单、科室干活——放行的永远是关卡）收束全片主线。
 *  ★ 6-C 系列身份卡/下期卡：标题主段是 check_series 规则 8 的受检硬编码——
 *    本集「一个循环，三层外设」＋下集「模型的视野是安排出来的」（改标题先改
 *    series.json 再同步此串）；层短名走 series-layers.json 数据。
 *  ★ 尾幕渐黑：useFadeOut 末 36 帧（窗取整幕时长——渲染红线四）。
 *  archify 全屏独占：five-layer-dependency 两瞥（6-A 本层点亮／6-C 留白预告）。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import layersData from '../series-layers.json';
import {
  Doctor,
  LineGauge,
  LoopRing,
  MonoTag,
  PeripheralRow,
  QuoteCard,
  withAlpha,
} from '../components/clinic';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, useCount, useEnter, useFadeOut, useImpulse, useProgress, useReveal, useStagger} from '../motion';

/** 本集层（series-layers.json 数据面——层短名走数据，集序走 activeIndex，标题主段走规则 8 受检硬编码） */
const LAYERS = layersData.layers as readonly {index: number; layer: string; title: string}[];
const ACTIVE_INDEX = layersData.activeIndex; // 第 1 集 · 工具与执行（数据面派生，勿硬编码副本）
const NEXT_LAYER = LAYERS.find((l) => l.index === ACTIVE_INDEX + 1) ?? null;

/** 五层层板：本集层 core 橙点亮、下集层微亮预告、其余 dim（数据驱动，零硬编码层名） */
const SeriesBoard: React.FC<{at: number; nextHint?: boolean}> = ({at, nextHint = false}) => {
  const enters = useStagger(LAYERS.length, {at, stride: 5, dur: DUR.f4});
  const nextGlow = useImpulse({at: at + 30, dur: DUR.f5, peak: 1});
  return (
    <div style={{position: 'absolute', left: 420, top: 250, width: 1080}}>
      {LAYERS.map((l, i) => {
        const active = l.index === ACTIVE_INDEX;
        const next = nextHint && l.index === ACTIVE_INDEX + 1;
        return (
          <div
            key={l.index}
            style={{
              opacity: enters[i],
              transform: `translateX(${(1 - enters[i]) * 40}px)`,
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '12px 24px',
              marginBottom: 14,
              background: active ? withAlpha(theme.core, 0.1) : '#171C26',
              border: `2px solid ${active ? theme.core : next ? withAlpha(theme.mech, 0.35 + 0.25 * nextGlow) : withAlpha(theme.dim, 0.25)}`,
              borderRadius: 8,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 22, color: active ? theme.core : theme.dim}}>
              {`L${l.index}`}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 26, color: active ? theme.text : next ? theme.mech : theme.dim}}>
              {l.layer}
            </span>
            {active && (
              <span style={{marginLeft: 'auto', fontFamily: theme.sans, fontSize: 17, color: theme.core}}>
                {'本集'}
              </span>
            )}
            {next && nextHint && (
              <span style={{marginLeft: 'auto', fontFamily: theme.sans, fontSize: 17, color: theme.mech}}>
                {'下期'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** 6-B 两步观看卡（先找循环 → 再数挂件） */
const TwoStep: React.FC<{at: number}> = ({at}) => {
  const p1 = useProgress(at, DUR.f5);
  const p2 = useProgress(at + 20, DUR.f5);
  return (
    <div style={{position: 'absolute', left: 520, top: 620, display: 'flex', gap: 36}}>
      {[
        {zh: '先找循环', p: p1},
        {zh: '再数挂件', p: p2},
      ].map((s, i) => (
        <div
          key={s.zh}
          style={{
            opacity: s.p,
            transform: `translateY(${(1 - s.p) * 16}px)`,
            padding: '14px 34px',
            background: '#171C26',
            border: `2px solid ${i === 0 ? withAlpha(theme.core, 0.7) : withAlpha(theme.mech, 0.7)}`,
            borderRadius: 10,
            fontFamily: theme.sans,
            fontSize: 32,
            color: theme.text,
          }}
        >
          {s.zh}
        </div>
      ))}
    </div>
  );
};

/** 6-B 分工定格：分屏对切入场（storyboard 型注记 useStagger）＋放行徽章 ok 点亮
 *  （useImpulse，同 3-F BadgeSplit 形制）——2026-10-02 评审补落：原裸 JSX 直渲，
 *  p6-04..05 约 11s 零运动。标签独立 absolute：Doctor 根节点 absolute 脱流，
 *  in-flow 子元素会从容器顶起排压到头部圆上。 */
const SplitScreen: React.FC<{at: number}> = ({at}) => {
  const enters = useStagger(2, {at, stride: 9, dur: DUR.f5});
  const hot = useImpulse({at: at + 20, dur: DUR.f5, peak: 1});
  return (
    <>
      <div style={{position: 'absolute', left: 330, top: 280, width: 102, opacity: enters[0]}}>
        <Doctor x={0} y={0} scale={0.85} />
        <div
          style={{
            position: 'absolute',
            top: 165,
            left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 20,
            color: theme.dim,
          }}
        >
          {'开单 · 无放行徽'}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1080,
          top: 300,
          width: 300,
          padding: '26px 0',
          textAlign: 'center',
          background: '#171C26',
          border: `3px solid ${theme.mech}`,
          borderRadius: 12,
          opacity: enters[1],
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.mech}}>{'关卡'}</div>
        <div
          style={{
            display: 'inline-block',
            marginTop: 12,
            padding: '4px 18px',
            borderRadius: 999,
            background: withAlpha(theme.ok, 0.15),
            border: `2px solid ${theme.ok}`,
            fontFamily: theme.sans,
            fontSize: 20,
            color: theme.ok,
            transform: `scale(${1 + 0.08 * hot})`,
            boxShadow: `0 0 ${16 * hot}px ${withAlpha(theme.ok, 0.6 * hot)}`,
          }}
        >
          {'放行'}
        </div>
      </div>
    </>
  );
};

/** 规则 8 受检硬编码（check_series 扫 P6 源码文本）：改标题先改 series.json 再同步此串。
 *  本集主段 =「一个循环，三层外设」／下集主段 =「模型的视野是安排出来的」。 */
const RULE8_THIS_MAIN = '一个循环，三层外设';
const RULE8_NEXT_MAIN = '模型的视野是安排出来的';

export const P6Finale: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const bA = w('p6-01', 'p6-03');
  const bB = w('p6-04', 'p6-08');
  const bC = w('p6-09', 'p6-10');
  const fade = useFadeOut(scene.durationInFrames);
  // 6-A：行数尺四格计数点亮 + 三连排比小字条逐条显字（hooks 顶层恒定序）。
  // 字条为关键词对（主语 + 短语），非口播逐字子串——原「一张表 管它能干什么」
  // 三条合计复现 p6-03 约 94%，RSI-007 违例（2026-10-02 评审修复）
  const gaugeLit = Math.round(useCount({to: 4, at: 4, dur: DUR.f6}));
  const t1 = useReveal('一张表 · 能干什么', {at: at('p6-03'), cps: 9});
  const t2 = useReveal('一道关 · 能不能干', {at: at('p6-03') + 14, cps: 9});
  const t3 = useReveal('一圈节点 · 何时说话', {at: at('p6-03') + 28, cps: 9});
  // 6-C：身份卡与下期卡入场——本组件体 hooks 吃 P6 幕局部帧（勿减 bC.from），
  // 且 p6-09 全句被 four-dark-zones archify 独占窗盖住，入场一律锚到 p6-10
  // （画框卸载后）才可见：卡1 +8／卡2 +22，错峰在末幕渐黑起点（36 帧）前完成
  const enterId = useEnter('fade', {at: at('p6-10') + 8, dur: DUR.f5});
  const enterNext = useEnter('fade', {at: at('p6-10') + 22, dur: DUR.f5});

  return (
    <AbsoluteFill style={{opacity: fade}}>
      <Sequence {...bA} name="6-A 诊室收束">
        <div style={{position: 'absolute', left: 660, top: 300}}>
          <LoopRing x={0} y={0} size={300} litSteps={5} spin glow />
        </div>
        <PeripheralRow x={1060} y={430} lit={3} at={at('p6-02') - bA.from} />
        <LineGauge lit={gaugeLit} />
        {/* p6-03 三连排比小字条（关键词对，RSI-007：非逐字复述口播） */}
        {[t1, t2, t3].map((txt, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 470 + i * 380,
              top: 700,
              width: 340,
              padding: '10px 16px',
              background: '#171C26',
              border: `2px solid ${withAlpha(theme.mech, 0.6)}`,
              borderRadius: 8,
              fontFamily: theme.sans,
              fontSize: 21,
              color: theme.text,
              textAlign: 'center',
            }}
          >
            {txt}
          </div>
        ))}
        {/* p6-01 句让位：五层身份卡 · 本层点亮一瞥 */}
        <ArchifyRecap
          slug="five-layer-dependency"
          caption="系列五层"
          cues={[{chapterId: 'layer-flash', at: at('p6-01') - bA.from, durationInFrames: dur('p6-01')}]}
        />
        {/* 分镜 6-A 角标：Harness（画内呈现）——p6-01 为 archify 全屏独占窗（forbid_inset），
            角标按契约锚到窗外 p6-02（(246,64) 本身在画框 x311..1609/y150..880 之外） */}
        <MonoTag x={246} y={64} at={at('p6-02') - bA.from}>{'Harness'}</MonoTag>
      </Sequence>

      <Sequence {...bB} name="6-B 分工与方法论">
        <SplitScreen at={at('p6-04') - bB.from} />
        <TwoStep at={at('p6-06') - bB.from} />
        <QuoteCard x={560} y={820} at={at('p6-08') - bB.from} width={800}>
          {'循环稳 · 外设全'}
        </QuoteCard>
      </Sequence>

      <Sequence {...bC} name="6-C 系列身份与下期">
        {/* 板错峰同样锚到 p6-10（archify 卸载后可见；at 为 bC 局部帧——子组件上下文） */}
        <SeriesBoard at={at('p6-10') - bC.from + 2} nextHint />
        {/* 系列身份卡 → 下期卡：主段为规则 8 受检硬编码（见上方 RULE8_* 注释） */}
        <div
          style={{
            ...enterId,
            position: 'absolute',
            left: 420,
            top: 700,
            width: 1080,
            textAlign: 'center',
            fontFamily: theme.serif,
            fontSize: 30,
            color: theme.text,
            letterSpacing: 3,
          }}
        >
          {`Claude Code Harness Engineering · 第 ${ACTIVE_INDEX} 集 · ${RULE8_THIS_MAIN}`}
        </div>
        {NEXT_LAYER && (
          <div
            style={{
              ...enterNext,
              position: 'absolute',
              left: 420,
              top: 790,
              width: 1080,
              textAlign: 'center',
              fontFamily: theme.serif,
              fontSize: 26,
              color: theme.mech,
            }}
          >
            {`下期 · ${RULE8_NEXT_MAIN}`}
          </div>
        )}
        {/* p6-09 句让位：留白预告一瞥（四层还没开灯 = 后续各层） */}
        <ArchifyRecap
          slug="five-layer-dependency"
          caption="留白预告"
          cues={[{chapterId: 'four-dark-zones', at: at('p6-09') - bC.from, durationInFrames: dur('p6-09')}]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P6Finale;
