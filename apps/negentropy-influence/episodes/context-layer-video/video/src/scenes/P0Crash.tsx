/** P0 两答案事故（p0-01..24）——冷开场：同一份数据两个答案 + 双基线 + 天才实习生 + 三病灶。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useCount, useDraw, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {Footnote, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge, NumberClash, PillarHUD} from '../components/devices';

/** 0-C 记忆条：两句边界之间匀速攒满，到清零句 3 帧抹平（清零点=句边界，无 use 模型）。 */
const MemoryBar: React.FC<{fillAt: number; fillDur: number; wipeAt: number}> = ({fillAt, fillDur, wipeAt}) => {
  const frame = useCurrentFrame();
  const fill = progress(frame, fillAt, fillDur);
  const wipe = useImpulse({at: wipeAt, dur: DUR.f2, peak: 1});
  return (
    <div style={{width: 360, height: 18, borderRadius: 9, background: theme.panelBorder, overflow: 'hidden'}}>
      <div style={{width: `${fill * (1 - wipe) * 100}%`, height: '100%', background: theme.grown}} />
    </div>
  );
};

/** 0-D 三病灶裂纹：三道缝在大厦立面上 danger 生长。 */
const Crack: React.FC<{at: number; label: string}> = ({at, label}) => {
  const g = useDraw(at, DUR.f6);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
      <svg width={64} height={110} viewBox="0 0 64 110">
        <path
          d="M32 0 L26 22 L38 40 L24 62 L36 84 L30 110"
          stroke={theme.danger}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          {...g}
        />
      </svg>
      <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.danger}}>{label}</span>
    </div>
  );
};

export const P0Crash: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p0-01', 'p0-05');
  const bB = w('p0-06', 'p0-09');
  const bC = w('p0-10', 'p0-14');
  const bD = w('p0-15', 'p0-21');
  const bE = w('p0-22', 'p0-24');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 会议室双屏对撞">
        <SceneTag chapter="P0" tagline="两答案事故" accent={theme.blueprint} />
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '72%'}}>
          <NumberClash
            badLabel="销售口径"
            bad="$14.2M"
            goodLabel="财务口径"
            good="$12.8M"
            at={at('p0-02') - bA.from}
          />
        </div>
        <Footnote delay={30}>同一份数据 · 没有人算错数</Footnote>
      </Sequence>

      <Sequence {...bB} name="0-B 双基线大数字">
        <SceneTag chapter="P0" tagline="两答案事故" accent={theme.blueprint} />
        <BaselinePair at={at('p0-09') - bB.from} />
        <EvidenceBadge grade="vendor" />
      </Sequence>

      <Sequence {...bC} name="0-C 天才实习生">
        <SceneTag chapter="P0" tagline="两答案事故" accent={theme.blueprint} />
        <InternIntro at={at('p0-11') - bC.from} wipeAt={at('p0-13') - bC.from} />
      </Sequence>

      <Sequence {...bD} name="0-D 判词与三病灶">
        <SceneTag chapter="P0" tagline="两答案事故" accent={theme.blueprint} />
        <VerdictLadder at={at('p0-16') - bD.from} />
        <div style={{position: 'absolute', right: 120, top: 200, display: 'flex', flexDirection: 'column', gap: 18}}>
          <Crack at={at('p0-19') - bD.from} label="口径打架" />
          <Crack at={at('p0-20') - bD.from} label="定义漂移" />
          <Crack at={at('p0-21') - bD.from} label="门禁穿透" />
        </div>
      </Sequence>

      <Sequence {...bE} name="0-E 定名与蓝图铺开">
        <SceneTag chapter="P0" tagline="两答案事故" accent={theme.blueprint} />
        <ArchifyYield
          cues={[
            {at: at('p0-22') - bE.from, durationInFrames: dur('p0-22')},
            {at: at('p0-24') - bE.from, durationInFrames: dur('p0-24')},
          ]}
        >
          <NameCard at={at('p0-22') - bE.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="architecture"
          caption="五正交层总架构"
          cues={[
            {chapterId: 'overview', at: at('p0-22') - bE.from, durationInFrames: dur('p0-22')},
            {chapterId: 'activate', at: at('p0-24') - bE.from, durationInFrames: dur('p0-24')},
          ]}
        />
        <PillarHUD lit={0} at={10} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 0-B 双基线：两块大数字卡官方归属行并列。 */
const BaselinePair: React.FC<{at: number}> = ({at}) => {
  const a = useCount({from: 0, to: 25, at, dur: DUR.f6});
  const b = useCount({from: 0, to: 21, at: at + 6, dur: DUR.f6});
  const o1 = useProgress(at - 4, DUR.f5);
  const o2 = useProgress(at + 2, DUR.f5);
  const card = (v: number, label: string, sub: string, o: number) => (
    <div style={{opacity: o, padding: '34px 46px', borderRadius: 14, border: `2px solid ${theme.danger}66`, background: `${theme.danger}10`, textAlign: 'center'}}>
      <div style={{fontFamily: theme.mono, fontSize: 96, color: theme.danger}}>{Math.round(v)}%</div>
      <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text, marginTop: 8}}>{label}</div>
      <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 4}}>{sub}</div>
    </div>
  );
  return (
    <div style={{display: 'flex', gap: 60, justifyContent: 'center', alignItems: 'center', height: '62%'}}>
      {card(a, '裸问准确率', 'Snowflake 官方内测', o1)}
      {card(b, '独立复测', 'Anthropic 复测', o2)}
    </div>
  );
};

/** 0-C 实习生入场：日历撕碎 + 记忆条 + 乱码列名墙。 */
const InternIntro: React.FC<{at: number; wipeAt: number}> = ({at, wipeAt}) => {
  const pieces = useStagger(5, {at: at + 4, stride: 5, dur: DUR.f4});
  const wall = useStagger(8, {at: wipeAt - 12, stride: 2, dur: DUR.f4});
  const cols = ['amt_ttl_pre_dsc', 'cust_lvl_cd', 'rev_adj_fy', 'mrg_pct_net', 'ar_aging_bkt', 'sku_pln_qty', 'geo_reg_id', 'fin_cls_cde'];
  return (
    <AbsoluteFill style={{paddingTop: 150}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 40, paddingLeft: 120}}>
        <div style={{fontSize: 110}}>🧑‍💻</div>
        <div>
          <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>天才实习生 · 每天重新入职</div>
          <div style={{marginTop: 14}}>
            <MemoryBar fillAt={at + 10} fillDur={40} wipeAt={wipeAt} />
          </div>
        </div>
        <div style={{display: 'flex', marginLeft: 60}}>
          {pieces.map((p, i) => (
            <div
              key={i}
              style={{
                width: 34,
                height: 46,
                marginLeft: -8,
                transform: `translateY(${p * (26 + i * 7)}px) rotate(${(i % 2 ? -1 : 1) * (12 + 20 * p)}deg)`,
                borderRadius: 4,
                background: theme.panel,
                border: `1px solid ${theme.panelBorder}`,
                opacity: 1 - p * 0.55,
              }}
            />
          ))}
        </div>
      </div>
      <div style={{marginTop: 60, paddingLeft: 120}}>
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginBottom: 14}}>物理列名 · 像密码</div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
          {cols.map((c, i) => (
            <div
              key={c}
              style={{
                fontFamily: theme.mono,
                fontSize: 24,
                color: i === 0 ? theme.blueprint : theme.dim,
                opacity: wall[i],
                transform: `translateX(${(1 - wall[i]) * -26}px)`,
              }}
            >
              {c}
              {i === 0 ? '   ← 毛收入' : ''}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 0-D 官方判词三段阶梯（英文原句进角标）。 */
const VerdictLadder: React.FC<{at: number}> = ({at}) => {
  const s1 = useSpring('settle', {at, dur: DUR.f5});
  const s2 = useSpring('settle', {at: at + 12, dur: DUR.f5});
  const s3 = useSpring('settle', {at: at + 24, dur: DUR.f5});
  const step = (t: number, zh: string, en: string) => (
    <div style={{opacity: t, transform: `translateY(${(1 - t) * 18}px)`, padding: '16px 24px', borderRadius: 10, border: `1px solid ${theme.panelBorder}`, background: theme.panel, maxWidth: 640}}>
      <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.text}}>{zh}</div>
      <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 4}}>{en}</div>
    </div>
  );
  return (
    <div style={{position: 'absolute', left: 120, top: 190, display: 'flex', flexDirection: 'column', gap: 14}}>
      {step(s1, '没有上下文，agent 只能瞎猜', 'Without context, an agent guesses.')}
      {step(s2, '含义内嵌进平台，才能行动', 'built natively into the platform → acts')}
      {step(s3, '同时被治理，才值得托付', 'also governed natively → can be trusted')}
    </div>
  );
};

/** 0-E 定名卡：解药的名字。 */
const NameCard: React.FC<{at: number}> = ({at}) => {
  const t = useSpring('settle', {at, dur: DUR.f6});
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 300, display: 'flex', justifyContent: 'center'}}>
      <div
        style={{
          opacity: t,
          transform: `scale(${0.92 + 0.08 * t})`,
          padding: '30px 60px',
          borderRadius: 16,
          border: `2px solid ${theme.blueprint}`,
          background: `${theme.blueprint}12`,
          textAlign: 'center',
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, letterSpacing: 2}}>解药的名字</div>
        <div style={{fontFamily: theme.sans, fontSize: 46, color: theme.text, marginTop: 8}}>上下文层</div>
        <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.blueprint, marginTop: 4}}>Context Layer</div>
      </div>
    </div>
  );
};
