/** P0 挤爆的开场白（p0-01..p0-15，镜 0-A..0-E）——钩子幕：目录索引卡翻入
 *  （〔M-001〕首秀、第一秒高反差）→ 两难分栏（自由发挥 × 全塞开场白）→
 *  示意算式 20×3000→60,000（示意角标常驻）→ 安装成本循环 + 注意力稀释 →
 *  第三条路问句金句 +「开放规范」印鉴落定（切 P1）。
 *  无 archify 锚（钩子定式幕）；主色目录金。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useCount,
  useEnter,
  useFlowDash,
  useProgress,
  usePushIn,
  useShake,
  useStagger,
} from '../motion';
import {SceneTag} from '../components/motifs';
import {CatalogCard, GoldenCard} from '../components/as-motifs';

/** 0-A 钩子卡：卡片 3D 翻入（第一秒冲击）→「开放规范」金印 → 问题气泡。 */
const HookCard: React.FC<{cardAt: number; sealAt: number; askAt: number}> = ({
  cardAt,
  sealAt,
  askAt,
}) => {
  const card = useEnter('fall', {at: cardAt, dur: DUR.f6, springPreset: 'settle'});
  const seal = useEnter('pop', {at: sealAt, dur: DUR.f5, springPreset: 'snap'});
  const ask = useEnter('pop', {at: askAt, dur: DUR.f5, springPreset: 'snap'});
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34}}>
      <div style={{position: 'relative'}}>
        <CatalogCard enter={card} breathe width={620} scale={1.06} />
        <div
          style={{
            position: 'absolute',
            right: -26,
            top: -22,
            transform: `rotate(12deg) ${seal.transform}`,
            opacity: seal.opacity,
            border: `2.5px solid ${theme.ledger}`,
            color: theme.ledger,
            borderRadius: 10,
            padding: '6px 14px',
            fontFamily: theme.serif,
            fontSize: 22,
            fontWeight: 700,
            background: theme.bg,
          }}
        >
          开放规范
        </div>
      </div>
      <div
        style={{
          ...ask,
          border: `1.5px solid ${theme.panelBorder}`,
          borderRadius: 999,
          padding: '10px 26px',
          fontSize: 20,
          color: theme.dim,
          background: theme.panel,
        }}
      >
        团队的规矩，从哪来？
      </div>
    </div>
  );
};

/** 0-B 两难分栏：左自由发挥（红叉纸带抖动）× 右全塞开场白（说明书墙堆高压弯进度条）。 */
const DilemmaSplit: React.FC<{leftAt: number; crossAt: number; stackAt: number}> = ({
  leftAt,
  crossAt,
  stackAt,
}) => {
  const frame = useCurrentFrame();
  const left = useEnter('slideL', {at: leftAt, dur: DUR.f5, springPreset: 'settle'});
  const right = useEnter('slideR', {at: leftAt + DUR.f4, dur: DUR.f5, springPreset: 'settle'});
  const cross = useShake({at: crossAt, amp: 5, decay: true, dur: DUR.f6});
  const stack = useStagger(7, {at: stackAt, dur: DUR.f5, stride: 4});
  const bend = progress(frame, stackAt + 24, DUR.f6);
  const shelf = (label: string, accent: string, e: {opacity: number; transform: string}) => (
    <div
      style={{
        width: 400,
        background: theme.panel,
        border: `1.5px solid ${theme.panelBorder}`,
        borderRadius: 14,
        padding: '22px 26px',
        opacity: e.opacity,
        transform: e.transform,
      }}
    >
      <div style={{fontSize: 17, color: accent, letterSpacing: 3, marginBottom: 14}}>{label}</div>
      <div style={{fontSize: 15.5, color: theme.dim, lineHeight: 1.7, minHeight: 88}}>
        {label === '自由发挥'
          ? '没有项目规范 · 没有踩坑经验 · 没有工具参数'
          : '全部规则 · 全部文档 · 全部塞进开场白'}
      </div>
      {label === '自由发挥' ? (
        <div style={{fontSize: 20, color: theme.danger, transform: `translateX(${cross}px)`}}>
          ✗ 一本正经地编造 / 跑偏
        </div>
      ) : (
        <div>
          <div style={{display: 'flex', gap: 5, marginBottom: 8}}>
            {stack.map((s, i) => (
              <div
                key={i}
                style={{
                  width: 34,
                  height: 20,
                  borderRadius: 3,
                  background: theme.dim,
                  opacity: 0.25 + 0.5 * s,
                }}
              />
            ))}
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 4,
              background: `${theme.panelBorder}88`,
              transform: `scaleX(${1 - 0.35 * bend}) rotate(${4 * bend}deg)`,
              transformOrigin: 'left center',
            }}
          />
        </div>
      )}
    </div>
  );
  return (
    <div style={{display: 'flex', gap: 60, alignItems: 'center'}}>
      {shelf('自由发挥', theme.danger, left)}
      {shelf('全塞开场白', theme.dim, right)}
    </div>
  );
};

/** 0-C 示意账：20 × 约3000 → 60,000 爬升；右上示意角标常驻。 */
const EstimateMath: React.FC<{factorsAt: number; sumAt: number}> = ({factorsAt, sumAt}) => {
  const f1 = useEnter('pop', {at: factorsAt, dur: DUR.f4, springPreset: 'snap'});
  const f2 = useEnter('pop', {at: factorsAt + DUR.f3, dur: DUR.f4, springPreset: 'snap'});
  const sum = useCount({at: sumAt, dur: DUR.f6, to: 60000});
  const unit = useEnter('fade', {at: sumAt + DUR.f5, dur: DUR.f4});
  return (
    <div style={{position: 'relative'}}>
      <div
        style={{
          position: 'absolute',
          right: -30,
          top: -54,
          fontSize: 14.5,
          color: theme.dim,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: 6,
          padding: '4px 10px',
        }}
      >
        示意估算 · 推断演示（非实测）
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 26, fontFamily: theme.mono}}>
        <div style={{...f1, fontSize: 44, color: theme.text}}>20 份</div>
        <div style={{fontSize: 38, color: theme.dim}}>×</div>
        <div style={{...f2, fontSize: 44, color: theme.text}}>约 3000 token</div>
        <div style={{fontSize: 38, color: theme.dim}}>=</div>
        <div
          style={{
            fontSize: 58,
            fontWeight: 700,
            color: theme.ledger,
            opacity: unit.opacity,
            transform: unit.transform,
          }}
        >
          {sum.toLocaleString('en-US')}
        </div>
      </div>
    </div>
  );
};

/** 0-D 安装成本循环：环形虚线绕说明书墙（flow 像素虚线）+ 注意力格阵逐列压灰
 *  （纯函数 progress 驱动——列表内不落 hook，铁律①）。 */
const RecurringCost: React.FC<{loopAt: number; gridAt: number}> = ({loopAt, gridAt}) => {
  const frame = useCurrentFrame();
  const fd = useFlowDash({dash: 10, gap: 9, period: 42});
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 90}}>
      <div style={{position: 'relative', width: 340, height: 300}}>
        <svg width={340} height={300} viewBox="0 0 340 300">
          <ellipse
            cx={170}
            cy={150}
            rx={158}
            ry={118}
            fill="none"
            stroke={theme.ledger}
            strokeWidth={2.5}
            opacity={0.85}
            {...fd}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {[0, 1, 2].map((r) => (
            <div key={r} style={{display: 'flex', gap: 8}}>
              {[0, 1, 2, 3].map((c) => (
                <div
                  key={c}
                  style={{
                    width: 44,
                    height: 30,
                    borderRadius: 4,
                    background: theme.panel,
                    border: `1px solid ${theme.panelBorder}`,
                  }}
                />
              ))}
            </div>
          ))}
          <div style={{fontSize: 14, color: theme.dim, marginTop: 6}}>每开一次新会话 · 重付一遍</div>
        </div>
      </div>
      <div>
        <div style={{fontSize: 15, color: theme.dim, letterSpacing: 2, marginBottom: 12}}>
          注意力格阵
        </div>
        <div style={{display: 'flex', gap: 6}}>
          {[0, 1, 2, 3, 4, 5].map((c) => {
            const p = progress(frame, gridAt + c * 9, DUR.f4);
            return (
              <div key={c} style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                {[0, 1, 2, 3, 4, 5].map((r) => (
                  <div
                    key={r}
                    style={{width: 26, height: 26, borderRadius: 5, background: theme.ok, opacity: 1 - 0.8 * p}}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const P0Hook: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-09');
  const bC = w('p0-10', 'p0-10c');
  const bD = w('p0-11', 'p0-13');
  const bE = w('p0-14', 'p0-15');
  const push = usePushIn(at('p0-14'));
  const askCard = useEnter('pop', {at: at('p0-14') - bE.from, dur: DUR.f5, springPreset: 'snap'});
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 钩子卡">
        <SceneTag chapter="P0" tagline="挤爆的开场白" accent={theme.ledger} />
        <HookCard
          cardAt={at('p0-01') - bA.from}
          sealAt={at('p0-02') - bA.from}
          askAt={at('p0-03') - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="0-B 两难分栏">
        <SceneTag chapter="P0" tagline="挤爆的开场白" accent={theme.ledger} />
        <div style={{transform: push}}>
          <DilemmaSplit
            leftAt={at('p0-04') - bB.from}
            crossAt={at('p0-08') - bB.from}
            stackAt={at('p0-09') - bB.from}
          />
        </div>
      </Sequence>
      <Sequence {...bC} name="0-C 示意账">
        <SceneTag chapter="P0" tagline="挤爆的开场白" accent={theme.ledger} />
        <EstimateMath factorsAt={at('p0-10b') - bC.from} sumAt={at('p0-10c') - bC.from} />
      </Sequence>
      <Sequence {...bD} name="0-D 安装成本循环">
        <SceneTag chapter="P0" tagline="挤爆的开场白" accent={theme.ledger} />
        <RecurringCost loopAt={at('p0-11') - bD.from} gridAt={at('p0-12') - bD.from} />
      </Sequence>
      <Sequence {...bE} name="0-E 第三条路">
        <SceneTag chapter="P0" tagline="挤爆的开场白" accent={theme.ledger} />
        <ThirdRoad sealAt={at('p0-15') - bE.from} cardStyle={askCard} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 0-E：问句金句卡（p0-14 起）→ p0-15 金句退场、全幅「开放规范」印鉴落定。 */
const ThirdRoad: React.FC<{sealAt: number; cardStyle: {opacity: number; transform: string}}> = ({
  sealAt,
  cardStyle,
}) => {
  const fade = useProgress(sealAt, DUR.f5); // 金句随印鉴退场
  const sealP = useProgress(sealAt + DUR.f3, DUR.f5, 'decelerate');
  return (
    <div>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 380,
          transform: 'translateX(-50%)',
          opacity: cardStyle.opacity * (1 - fade),
        }}
      >
        <GoldenCard lines={['知识备着', '不占地方？']} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 470,
          transform: `translateX(-50%) rotate(-6deg) scale(${0.7 + 0.3 * sealP})`,
          opacity: sealP,
          border: `3px solid ${theme.ledger}`,
          color: theme.ledger,
          borderRadius: 12,
          padding: '12px 30px',
          fontFamily: theme.serif,
          fontSize: 34,
          fontWeight: 700,
          background: `${theme.bg}cc`,
          whiteSpace: 'nowrap',
        }}
      >
        开放规范 · 立起来了
      </div>
    </div>
  );
};
