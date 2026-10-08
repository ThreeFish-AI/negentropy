/** P2 三级账本（p2-01..p2-23，镜 2-A..2-E）——全片核心机制幕：
 *  目录常驻（dl-catalog 全屏窗 + 房租金句）→ 正文整载（问句命中 + dl-activate
 *  全屏窗）→ 按需调阅（dl-tier3 全屏窗 + 三级独立格阵）→ 16.9× 双柱标尺 →
 *  OpenAI 预算门（2% 金窄条 / 8000 标尺 / 共识徽章）。
 *  主色目录金；archify 窗句唯一、窗外装置让位由全屏覆盖自然承担。 */
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
  useImpulse,
  useProgress,
  usePushIn,
  useStagger,
} from '../motion';
import {SceneTag} from '../components/motifs';
import {BalanceBars, CatalogCard, GoldenCard, Stage} from '../components/as-motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';

/** 2-A：目录卡落地 pdf-report 摘要行（窗外）；p2-04 全屏窗看台账常驻章。 */
const CatalogLanding: React.FC<{landAt: number; rentAt: number}> = ({landAt, rentAt}) => {
  const row = useEnter('rise', {at: landAt, dur: DUR.f5, springPreset: 'settle'});
  const rent = useEnter('pop', {at: rentAt, dur: DUR.f5, springPreset: 'snap'});
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 66}}>
      <CatalogCard width={520} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
        <div
          style={{
            ...row,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            border: `1.5px solid ${theme.ledger}77`,
            borderRadius: 9,
            padding: '12px 18px',
            background: theme.panel,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.ledger}}>pdf-report</span>
          <span style={{fontSize: 15, color: theme.dim}}>· 解析复杂财务报表（一行摘要）</span>
        </div>
        <GoldenCard
          lines={['这行摘要', '＝全部房租']}
          enter={rent}
          width={340}
        />
      </div>
    </div>
  );
};

/** 2-B：问句气泡 → 目录扫描命中脉冲（窗外）；p2-09 全屏窗看激活章。 */
const HitPulse: React.FC<{askAt: number; hitAt: number}> = ({askAt, hitAt}) => {
  const ask = useEnter('slideR', {at: askAt, dur: DUR.f5, springPreset: 'settle'});
  const hit = useImpulse({at: hitAt, dur: DUR.f5, peak: 1});
  const hitP = useProgress(hitAt + DUR.f5, DUR.f4);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30}}>
      <div
        style={{
          ...ask,
          border: `1.5px solid ${theme.route}88`,
          borderRadius: 999,
          padding: '12px 28px',
          fontSize: 21,
          color: theme.text,
          background: theme.panel,
        }}
      >
        帮我拆这份 PDF 报表
      </div>
      <div style={{fontSize: 30, color: theme.dim}}>↓ 模型扫目录</div>
      <div
        style={{
          border: `2px solid ${theme.route}`,
          borderRadius: 12,
          padding: '14px 26px',
          background: theme.panel,
          boxShadow: `0 0 ${28 * hit}px ${theme.route}66`,
          opacity: 0.55 + 0.45 * hitP,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.route}}>
          description 命中
        </span>
      </div>
    </div>
  );
};

/** 2-C：三级独立格阵（互不连通）+ 收束金句；p2-11 全屏窗看按需章。 */
const TierGrid: React.FC<{tiersAt: number; closeAt: number}> = ({tiersAt, closeAt}) => {
  const cols = useStagger(3, {at: tiersAt, dur: DUR.f6, stride: 10});
  const close = useEnter('pop', {at: closeAt, dur: DUR.f5, springPreset: 'snap'});
  const tier = (t: string, label: string, i: number) => (
    <div
      style={{
        opacity: cols[i],
        transform: `translateY(${18 * (1 - cols[i])}px)`,
        width: 250,
        background: theme.panel,
        border: `1.5px solid ${theme.panelBorder}`,
        borderRadius: 12,
        padding: '18px 20px',
      }}
    >
      <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.ledger, marginBottom: 8}}>
        {t}
      </div>
      <div style={{fontSize: 18, color: theme.text}}>{label}</div>
    </div>
  );
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40}}>
      <div style={{display: 'flex', gap: 40}}>
        {tier('tier 1', '目录常驻', 0)}
        {tier('tier 2', '正文整载', 1)}
        {tier('tier 3', '资源按需', 2)}
      </div>
      <div style={{fontSize: 15, color: theme.dim}}>三级各自独立 · 互不连带</div>
      <GoldenCard
        lines={['安装成本', '→ 使用成本']}
        enter={close}
        width={380}
      />
    </div>
  );
};

/** 2-D：16.9× 双柱标尺（基线虚线常驻；左灰 39,222 vs 右金 2,321）。 */
const ScaleBattle: React.FC<{raceAt: number; multAt: number}> = ({raceAt, multAt}) => {
  const lp = useProgress(raceAt, DUR.f6);
  const rp = useProgress(raceAt + DUR.f4, DUR.f6);
  const mult = useImpulse({at: multAt, dur: DUR.f4, peak: 1.18});
  const multP = useProgress(multAt + DUR.f4, DUR.f4);
  return (
    <div style={{position: 'relative'}}>
      <BalanceBars
        leftValue={39222 * lp}
        rightValue={2321 * rp}
        leftMax={39222}
        leftLabel="全部正文进开场白"
        rightLabel="只挂目录"
        multiplier={16.9}
        multiplierVisible={multP > 0}
        baseY={260}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: -30,
          transform: `translateX(-50%) scale(${mult * (0.8 + 0.2 * multP)})`,
          opacity: multP,
          fontFamily: theme.mono,
          fontSize: 22,
          color: theme.dim,
        }}
      >
        冷启动开销 · 一个数量级的差距
      </div>
    </div>
  );
};

/** 2-E：OpenAI 预算门——上下文横条 + 2% 金窄条 + 8000 标尺截短超长描述。 */
const BudgetGate: React.FC<{barAt: number; rulerAt: number; badgeAt: number}> = ({
  barAt,
  rulerAt,
  badgeAt,
}) => {
  const frame = useCurrentFrame();
  const bar = useEnter('rise', {at: barAt, dur: DUR.f5, springPreset: 'settle'});
  const ruler = useEnter('fall', {at: rulerAt, dur: DUR.f5, springPreset: 'settle'});
  const cut = progress(frame, rulerAt + DUR.f5, DUR.f4);
  const badges = useStagger(3, {at: badgeAt, dur: DUR.f6, stride: 8});
  const fullW = 900;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 44}}>
      <div style={{...bar, width: fullW}}>
        <div style={{fontSize: 14.5, color: theme.dim, marginBottom: 8}}>
          模型单次可读长度（上下文窗口）
        </div>
        <div
          style={{
            height: 46,
            borderRadius: 9,
            background: `${theme.panelBorder}55`,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: fullW * 0.02,
              background: theme.ledger,
              borderRadius: 9,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: fullW * 0.02 + 14,
              top: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              fontSize: 15,
              color: theme.dim,
            }}
          >
            ↑ 2% · 技能目录总量上限
          </div>
        </div>
      </div>
      <div style={{...ruler, display: 'flex', alignItems: 'center', gap: 22}}>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 17,
            color: theme.text,
            textDecoration: 'line-through',
            textDecorationColor: theme.danger,
            textDecorationThickness: 2.5,
            opacity: cut,
            maxWidth: 360,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          一份写得超长超长的说明书描述……
        </div>
        <div
          style={{
            border: `1.5px solid ${theme.ledger}`,
            color: theme.ledger,
            borderRadius: 7,
            padding: '4px 12px',
            fontFamily: theme.mono,
            fontSize: 15,
          }}
        >
          8000 字符封顶 · 超限自动裁剪
        </div>
      </div>
      <div style={{display: 'flex', gap: 22}}>
        {['Claude', 'Codex', 'Gemini'].map((b, i) => (
          <div
            key={b}
            style={{
              opacity: badges[i],
              transform: `translateY(${12 * (1 - badges[i])}px)`,
              border: `1.5px solid ${theme.panelBorder}`,
              borderRadius: 999,
              padding: '8px 22px',
              fontSize: 16,
              color: theme.dim,
              background: theme.panel,
            }}
          >
            {b} · 同一共识
          </div>
        ))}
      </div>
    </div>
  );
};

export const P2Ledger: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string) => w(a).durationInFrames;
  const bA = w('p2-01', 'p2-06');
  const bB = w('p2-07', 'p2-09');
  const bC = w('p2-10', 'p2-14');
  const bD = w('p2-15', 'p2-19');
  const bE = w('p2-20', 'p2-23');
  const push = usePushIn(at('p2-15') - bD.from);
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A 目录常驻">
        <SceneTag chapter="P2" tagline="三级账本" accent={theme.ledger} />
        <Stage>
        <CatalogLanding landAt={at('p2-05') - bA.from} rentAt={at('p2-06') - bA.from} />

        </Stage>

<ArchifyRecap
          slug="disclosure"
          caption="台账常驻 · 每技能一行"
          cues={[
            {chapterId: 'dl-catalog', at: at('p2-04') - bA.from, durationInFrames: dur('p2-04')},
          ]}
        />
      </Sequence>
      <Sequence {...bB} name="2-B 正文整载">
        <SceneTag chapter="P2" tagline="三级账本" accent={theme.ledger} />
        <Stage>
        <HitPulse askAt={at('p2-07') - bB.from} hitAt={at('p2-08') - bB.from} />

        </Stage>

<ArchifyRecap
          slug="disclosure"
          caption="语义路由命中 · 整载正文"
          cues={[
            {chapterId: 'dl-activate', at: at('p2-09') - bB.from, durationInFrames: dur('p2-09')},
          ]}
        />
      </Sequence>
      <Sequence {...bC} name="2-C 按需调阅">
        <SceneTag chapter="P2" tagline="三级账本" accent={theme.ledger} />
        <Stage>
        <TierGrid tiersAt={at('p2-12') - bC.from} closeAt={at('p2-14') - bC.from} />

        </Stage>

<ArchifyRecap
          slug="disclosure"
          caption="模型解释指令 · 资源按需"
          cues={[
            {chapterId: 'dl-tier3', at: at('p2-11') - bC.from, durationInFrames: dur('p2-11')},
          ]}
        />
      </Sequence>
      <Sequence {...bD} name="2-D 十六点九倍">
        <SceneTag chapter="P2" tagline="三级账本" accent={theme.ledger} />
        <Stage>
        <div style={{transform: push}}>
          <ScaleBattle raceAt={at('p2-15') - bD.from} multAt={at('p2-17b') - bD.from} />
        </div>
        </Stage>


      </Sequence>
      <Sequence {...bE} name="2-E 预算门">
        <SceneTag chapter="P2" tagline="三级账本" accent={theme.ledger} />
        <Stage>
        <BudgetGate
          barAt={at('p2-21') - bE.from}
          rulerAt={at('p2-22') - bE.from}
          badgeAt={at('p2-23') - bE.from}
        />

        </Stage>

<ArchifyRecap
          slug="governance"
          caption="规范层 · 建议与上限"
          cues={[
            {chapterId: 'gl-three', at: at('p2-21') - bE.from, durationInFrames: dur('p2-21')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
