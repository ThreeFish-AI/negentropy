/** P3 三重把关（p3-01..26，6 镜 13 cue）——分镜 3-A…3-F。
 *
 *  ★ 事故快闪（清理项目 → 整盘删除单递到科室门口，deny 急闪）→ 三重把关主体
 *    （禁忌表硬拒 / 规则 / 问人签字默认拒 / 皆空默认直行道）→ 铁律「翻不了案」。
 *  ★ 实验 3 调序（一个 y 就放行 → 4 文件清零，金句「次序 · 就是机制」）→ 字面匹配
 *    两面性（过拦连坐 / 漏拦逃逸＋作者自认＋词边界补丁）→ 生产版对照（放行的永远是
 *    关卡，不是开单的医生）。
 *  archify 全屏独占：gate-three-tier 五章（arrive 承事故快闪句尾让位；3-B 四章一实例，
 *    default-pass 经 p3-07/08 空窗后恢复入场）＋gate-order-ablation 四章（3-D 三章承 3-C
 *    normal-first 镜界背靠背 → lead={false}）＋gate-four-result 四章一实例连播。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {DeptGate, Doctor, MonoTag, QuoteCard, ProvenanceTag, withAlpha} from '../components/clinic';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {
  DUR,
  clamp01,
  useEnter,
  useFlowDash,
  useImpulse,
  useProgress,
  useReveal,
  useSpring,
  useStagger,
} from '../motion';

// ── 3-A 事故快闪：指令卡 → 整盘删除命令单（rm 字样，deny 急闪） ─────────────

const IncidentFlash: React.FC<{at: number}> = ({at}) => {
  const cards = useStagger(2, {at, stride: 9, dur: DUR.f4});
  const flash = useImpulse({at: at + 24, dur: DUR.f4, peak: 1});
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 470,
          top: 400,
          width: 360,
          padding: '16px 24px',
          background: theme.panel,
          border: `2px solid ${withAlpha(theme.dim, 0.5)}`,
          borderRadius: 10,
          opacity: cards[0],
          transform: `translateY(${(1 - cards[0]) * 14}px)`,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim}}>{'指令'}</div>
        <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 25, color: theme.text}}>{'清理一下项目'}</div>
      </div>
      <DeptGate x={1210} y={300} />
      <div
        style={{
          position: 'absolute',
          left: 1040,
          top: 420,
          width: 320,
          padding: '14px 22px',
          background: withAlpha(theme.deny, 0.1),
          border: `2.5px solid ${theme.deny}`,
          borderRadius: 10,
          boxShadow: `0 0 ${20 * flash}px ${withAlpha(theme.deny, 0.75 * flash)}`,
          transform: `scale(${1 + 0.05 * flash})`,
          opacity: cards[1],
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.deny}}>{'命令单'}</div>
        <div style={{marginTop: 8, fontFamily: theme.mono, fontSize: 27, color: theme.deny}}>{'rm -rf /'}</div>
        <div style={{marginTop: 6, fontFamily: theme.sans, fontSize: 16, color: theme.dim}}>{'整盘删除'}</div>
      </div>
    </>
  );
};

// ── 3-A 三层筛剪影：自右缘旋入（mech） ─────────────────────────────────────

const SieveStack: React.FC<{at: number}> = ({at}) => {
  const e0 = useEnter('slideR', {at, dist: 170, dur: DUR.f5});
  const e1 = useEnter('slideR', {at: at + 8, dist: 170, dur: DUR.f5});
  const e2 = useEnter('slideR', {at: at + 16, dist: 170, dur: DUR.f5});
  const enters = [e0, e1, e2];
  return (
    <>
      <div style={{position: 'absolute', left: 1330, top: 258, width: 360, textAlign: 'center', fontFamily: theme.sans, fontSize: 21, color: theme.mech, opacity: e0.opacity}}>
        {'三重把关'}
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 1330,
            top: 300 + i * 128,
            ...enters[i],
            width: 360,
            height: 92,
            background: withAlpha(theme.mech, 0.07),
            border: `2px solid ${withAlpha(theme.mech, 0.75)}`,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '0 20px',
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.mech}}>{`0${i + 1}`}</span>
          <svg width={250} height={54}>
            {[0, 1, 2, 3, 4].map((k) => (
              <line
                key={k}
                x1={8 + k * 50}
                y1={8}
                x2={8 + k * 50}
                y2={46}
                stroke={withAlpha(theme.mech, 0.55)}
                strokeWidth={4}
                strokeLinecap="round"
              />
            ))}
          </svg>
        </div>
      ))}
    </>
  );
};

// ── 3-B 皆空默认直行道：单据列队过闸（ok 绿瞬态） ───────────────────────────

const FastLane: React.FC<{at: number}> = ({at}) => {
  const queue = useStagger(3, {at, stride: 26, dur: DUR.f6});
  // 逐卡放行绿闪（R10 修复：原单发 at+40 魔数与三卡过闸时刻全不重合）——
  // 卡 i 翻绿帧 = stagger 起点 [2,28,54]（at=2 起、stride 26）+ eased 0.62 ≈ +5.4
  // （DUR.f6=21 帧 standard 贝塞尔）：[7, 33, 59]，闪窗跨翻绿点前 2 帧
  const pass0 = useImpulse({at: at + 7, dur: DUR.f4, peak: 1});
  const pass1 = useImpulse({at: at + 33, dur: DUR.f4, peak: 1});
  const pass2 = useImpulse({at: at + 59, dur: DUR.f4, peak: 1});
  const pass = [pass0, pass1, pass2];
  const gateIn = useProgress(at, DUR.f4);
  const names = ['查看', '列目录', '日常单'];
  return (
    <>
      {/* 闸柱三根（DENY→RULES→ASK） */}
      <div style={{position: 'absolute', left: 800, top: 330, opacity: gateIn}}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: i * 46,
              top: 0,
              width: 14,
              // 高 250：盖住第三行卡（行 3 顶 528+卡高≈51=底 579，R10 修复原
              // 220 底 550 使「日常单」下半段从闸体外穿过）
              height: 250,
              borderRadius: 7,
              background: theme.panel,
              border: `2px solid ${withAlpha(theme.dim, 0.55)}`,
            }}
          />
        ))}
        <div style={{position: 'absolute', left: -58, top: -44, width: 260, textAlign: 'center', fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>
          {'DENY→RULES→ASK'}
        </div>
      </div>
      {names.map((nm, i) => {
        const p = queue[i];
        const done = p > 0.62;
        return (
          <div
            key={nm}
            style={{
              position: 'absolute',
              left: 240 + p * 1120,
              top: 396 + i * 66,
              width: 170,
              padding: '10px 0',
              textAlign: 'center',
              background: theme.bgDeep,
              border: `2px solid ${done ? withAlpha(theme.ok, 0.8) : withAlpha(theme.dim, 0.55)}`,
              borderRadius: 7,
              fontFamily: theme.sans,
              fontSize: 19,
              color: done ? theme.text : theme.dim,
              opacity: Math.min(1, p * 4),
              boxShadow: done ? `0 0 ${12 * pass[i]}px ${withAlpha(theme.ok, 0.6 * pass[i])}` : 'none',
            }}
          >
            {nm}
            {done ? (
              <span style={{marginLeft: 8, color: theme.ok}}>{'✓'}</span>
            ) : null}
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 760, top: 606, width: 400, textAlign: 'center', fontFamily: theme.sans, fontSize: 20, color: theme.dim, opacity: gateIn}}>
        {'皆空 · 直行'}
      </div>
    </>
  );
};

// ── 3-C 禁忌铁律：禁忌表＋「翻不了案」封条章压顶（deny） ────────────────────

const IronRuleCard: React.FC<{at: number}> = ({at}) => {
  const inP = useProgress(at, DUR.f4);
  const stamp = useEnter('fall', {at: at + 12, dur: DUR.f4, dist: 130});
  const quake = useSpring('snap', {at: at + 20, dur: DUR.f5});
  const rows = ['整盘删除', '冒充管理员', '格式化'];
  return (
    <div style={{position: 'absolute', inset: 0, opacity: inP}}>
      <div
        style={{
          position: 'absolute',
          left: 740,
          top: 300,
          width: 440,
          padding: '20px 28px',
          background: theme.panel,
          border: `2px solid ${withAlpha(theme.deny, 0.55)}`,
          borderLeft: `6px solid ${theme.deny}`,
          borderRadius: 10,
          transform: `translateY(${-4 * Math.sin(Math.PI * quake)}px)`,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.text}}>{'禁忌表'}</div>
        {rows.map((rw) => (
          <div
            key={rw}
            style={{marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, fontFamily: theme.mono, fontSize: 19, color: theme.dim}}
          >
            <span style={{color: theme.deny}}>{'✗'}</span>
            {rw}
          </div>
        ))}
      </div>
      {/* 封条章：盖下＋压纸震颤（spring 微幅） */}
      <div
        style={{
          position: 'absolute',
          left: 1030,
          top: 236,
          ...stamp,
          transform: `${stamp.transform} rotate(-12deg)`,
          padding: '10px 22px',
          background: withAlpha(theme.deny, 0.16),
          border: `3px double ${theme.deny}`,
          borderRadius: 8,
          fontFamily: theme.serif,
          fontSize: 27,
          color: theme.deny,
          letterSpacing: 4,
        }}
      >
        {'翻不了案'}
      </div>
      <MonoTag x={876} y={192} at={at + 4}>{'顺序=机制'}</MonoTag>
    </div>
  );
};

// ── 3-E 字面匹配两面性：过拦（连坐划线）/ 漏拦（变体逃逸）＋自认引语＋词边界补丁 ──

const OverUnder: React.FC<{at: number; atStrike: number; atQuote: number; atPatch: number}> = ({
  at,
  atStrike,
  atQuote,
  atPatch,
}) => {
  const panelsIn = useProgress(at, DUR.f5);
  const strike = useProgress(atStrike, DUR.f6);
  const flow = useFlowDash({dash: 12, gap: 16, period: 34});
  const quoteIn = useProgress(atQuote, DUR.f3);
  const quote = useReveal('示意 · 不是安全边界', {at: atQuote + 4, cps: 9});
  const patchIn = useProgress(atPatch, DUR.f4);
  const patchHot = useImpulse({at: atPatch, dur: DUR.f5, peak: 1});
  const paths = ['/data/logs', '/home/u/tmp', '/var/cache/x'];
  const variants = ['命令变体', '套层展开'];
  return (
    <>
      {/* 左：过拦（绝对路径逐条划掉——deny 连坐线） */}
      <div
        style={{
          position: 'absolute',
          left: 170,
          top: 170,
          width: 720,
          height: 330,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 12,
          opacity: panelsIn,
        }}
      >
        <div style={{padding: '16px 24px', fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'过拦 · 宁可错拦'}</div>
        {paths.map((pp, i) => {
          const w = clamp01(strike * 3 - i);
          return (
            <div key={pp} style={{position: 'absolute', left: 40, top: 86 + i * 74, width: 620}}>
              <span style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim}}>{pp}</span>
              <div style={{position: 'absolute', left: 0, top: 14, width: 240 * w, height: 3.5, background: theme.deny, borderRadius: 2}} />
            </div>
          );
        })}
      </div>
      {/* 右：漏拦（两条小字逃逸箭头绕过筛子——dim 行进虚线） */}
      <div
        style={{
          position: 'absolute',
          left: 1030,
          top: 170,
          width: 720,
          height: 330,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 12,
          opacity: panelsIn,
        }}
      >
        <div style={{padding: '16px 24px', fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'漏拦 · 可能放过'}</div>
        <svg width={130} height={150} style={{position: 'absolute', left: 300, top: 96}}>
          {[0, 1, 2].map((i) => (
            <line key={i} x1={16} y1={30 + i * 44} x2={114} y2={30 + i * 44} stroke={withAlpha(theme.mech, 0.7)} strokeWidth={5} strokeLinecap="round" />
          ))}
        </svg>
        {variants.map((v, i) => (
          <div
            key={v}
            style={{
              position: 'absolute',
              left: 60,
              top: 110 + i * 92,
              width: 150,
              padding: '8px 0',
              textAlign: 'center',
              background: theme.bgDeep,
              border: `2px solid ${withAlpha(theme.dim, 0.5)}`,
              borderRadius: 7,
              fontFamily: theme.sans,
              fontSize: 18,
              color: theme.dim,
            }}
          >
            {v}
          </div>
        ))}
        <svg width={330} height={230} style={{position: 'absolute', left: 200, top: 70}}>
          <path d="M8 60 C 120 20, 200 40, 320 22" fill="none" stroke={theme.dim} strokeWidth={3} {...flow} />
          <path d="M8 160 C 120 200, 200 180, 320 198" fill="none" stroke={theme.dim} strokeWidth={3} {...flow} />
        </svg>
      </div>
      {/* 作者自认引语（mono 逐字） */}
      <div style={{position: 'absolute', left: 560, top: 556, width: 800, opacity: quoteIn}}>
        <span style={{fontFamily: theme.serif, fontSize: 44, color: theme.panelBorder}}>{'“'}</span>
        <span style={{fontFamily: theme.mono, fontSize: 28, color: theme.text}}>{quote}</span>
        <span style={{fontFamily: theme.serif, fontSize: 44, color: theme.panelBorder}}>{'”'}</span>
        <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 18, color: theme.dim}}>{'教学版作者自认'}</div>
      </div>
      {/* 词边界补丁小卡（mech 点亮，归属注「规则层补丁」） */}
      <div
        style={{
          position: 'absolute',
          left: 1400,
          top: 640,
          width: 300,
          opacity: patchIn,
          transform: `scale(${1 + 0.05 * patchHot})`,
          padding: '14px 20px',
          background: withAlpha(theme.mech, 0.08),
          border: `2px solid ${theme.mech}`,
          borderRadius: 10,
          boxShadow: `0 0 ${16 * patchHot}px ${withAlpha(theme.mech, 0.55 * patchHot)}`,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.mech}}>{'词边界'}</div>
        <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 17, color: theme.dim}}>{'规则层补丁'}</div>
      </div>
      <MonoTag x={876} y={126} at={atPatch}>{'词边界正则'}</MonoTag>
    </>
  );
};

// ── 3-F 过渡小卡 + 放行权收束（关卡徽章 ok vs 医生无徽章 dim） ───────────────

const ThickCard: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('pop', {at, dur: DUR.f4, springPreset: 'settle'});
  return (
    <div
      style={{
        position: 'absolute',
        left: 660,
        top: 420,
        ...e,
        width: 600,
        textAlign: 'center',
        fontFamily: theme.serif,
        fontSize: 34,
        color: theme.text,
        letterSpacing: 3,
      }}
    >
      {'真实产品里 · 厚得多'}
    </div>
  );
};

const BadgeSplit: React.FC<{at: number}> = ({at}) => {
  const inP = useProgress(at, DUR.f4);
  const hot = useImpulse({at: at + 5, dur: DUR.f5, peak: 1});
  return (
    <div style={{position: 'absolute', inset: 0, opacity: inP}}>
      <Doctor x={330} y={280} scale={0.82} opacity={0.62} />
      <div style={{position: 'absolute', left: 270, top: 440, width: 220, textAlign: 'center', fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>
        {'医生 · 开单'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1150,
          top: 300,
          width: 320,
          padding: '24px 0',
          textAlign: 'center',
          background: theme.panel,
          border: `3px solid ${theme.mech}`,
          borderRadius: 12,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.mech}}>{'关卡'}</div>
        <div
          style={{
            display: 'inline-block',
            marginTop: 12,
            padding: '4px 20px',
            borderRadius: 999,
            background: withAlpha(theme.ok, 0.15),
            border: `2px solid ${theme.ok}`,
            fontFamily: theme.sans,
            fontSize: 21,
            color: theme.ok,
            transform: `scale(${1 + 0.08 * hot})`,
            boxShadow: `0 0 ${16 * hot}px ${withAlpha(theme.ok, 0.6 * hot)}`,
          }}
        >
          {'放行'}
        </div>
      </div>
      <ProvenanceTag x={600} y={640} at={at + 6} text={'对外拆解口径'} />
      <ProvenanceTag x={880} y={640} at={at + 8} text={'官方分层口径'} />
    </div>
  );
};

// ── 幕组装 ─────────────────────────────────────────────────────────────────

export const P3ThreeGates: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const bA = w('p3-01', 'p3-03');
  const bB = w('p3-04', 'p3-09');
  const bC = w('p3-10', 'p3-11');
  const bD = w('p3-12', 'p3-15');
  const bE = w('p3-16', 'p3-20');
  const bF = w('p3-21', 'p3-26');
  // p3-01 前段给事故快闪卡（句尾让位给 arrive），帧数由句窗推导
  const flash1 = Math.round(dur('p3-01') * 0.55);

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A 事故快闪">
        <ArchifyRecap
          slug="gate-three-tier"
          caption="事故起点"
          cues={[{chapterId: 'arrive', at: at('p3-01') - bA.from + flash1, durationInFrames: dur('p3-01') - flash1}]}
        />
        {/* p3-01 前段：指令卡→整盘删除命令单（deny 急闪），句尾让位给 arrive */}
        <Sequence durationInFrames={flash1} name="3-A 事故快闪卡">
          <IncidentFlash at={2} />
        </Sequence>
        {/* p3-02..03 回落：三层筛剪影自右缘旋入 */}
        <Sequence from={at('p3-02') - bA.from} name="3-A 三层筛旋入">
          <SieveStack at={2} />
        </Sequence>
      </Sequence>

      <Sequence {...bB} name="3-B 三重把关">
        {/* 同图四章一实例：前三章窗窗相邻自动背靠背；default-pass 经 p3-07/08
            空窗后由实例内空窗判定恢复入场 */}
        <ArchifyRecap
          slug="gate-three-tier"
          caption="三重把关"
          cues={[
            {chapterId: 'hard-deny', at: at('p3-04') - bB.from, durationInFrames: dur('p3-04')},
            {chapterId: 'rule-hit', at: at('p3-05') - bB.from, durationInFrames: dur('p3-05')},
            {chapterId: 'ask-sign', at: at('p3-06') - bB.from, durationInFrames: dur('p3-06')},
            {chapterId: 'default-pass', at: at('p3-09') - bB.from, durationInFrames: dur('p3-09')},
          ]}
        />
        {/* p3-07..08 回落：皆空默认直行道（单据列队过闸，ok 绿瞬态） */}
        <Sequence from={at('p3-07') - bB.from} durationInFrames={at('p3-09') - at('p3-07')} name="3-B 直行道">
          <FastLane at={2} />
        </Sequence>
      </Sequence>

      <Sequence {...bC} name="3-C 铁律卡">
        {/* p3-10 回落：禁忌表＋封条章盖下＋压纸震颤 */}
        <Sequence durationInFrames={at('p3-11') - bC.from} name="3-C 禁忌铁律">
          <IronRuleCard at={2} />
        </Sequence>
        {/* p3-11 句让位：正常序基准一瞥 */}
        <ArchifyRecap
          slug="gate-order-ablation"
          caption="正常序基准"
          cues={[{chapterId: 'normal-first', at: at('p3-11') - bC.from, durationInFrames: dur('p3-11')}]}
        />
      </Sequence>

      <Sequence {...bD} name="3-D 实验3调序">
        {/* 承 3-C normal-first 镜界背靠背（p3-11 窗尽接 p3-12）→ lead={false}；
            同图三章连播一实例（窗窗相邻自动背靠背） */}
        <ArchifyRecap
          slug="gate-order-ablation"
          caption="调序实验"
          lead={false}
          cues={[
            {chapterId: 'reorder-early', at: at('p3-12') - bD.from, durationInFrames: dur('p3-12')},
            {chapterId: 'one-y-pass', at: at('p3-13') - bD.from, durationInFrames: dur('p3-13')},
            {chapterId: 'wipe-zero', at: at('p3-14') - bD.from, durationInFrames: dur('p3-14')},
          ]}
        />
        {/* p3-15 回落：金句卡（QuoteCard 为 components 承担者，不产生 scene 动效 token） */}
        <Sequence from={at('p3-15') - bD.from} name="3-D 次序金句">
          <QuoteCard x={560} y={380} at={2} width={800}>
            {'次序 · 就是机制'}
          </QuoteCard>
          <MonoTag x={848} y={560} at={8}>{'4 文件 → 0'}</MonoTag>
        </Sequence>
      </Sequence>

      <Sequence {...bE} name="3-E 两面性">
        <OverUnder
          at={at('p3-16') - bE.from}
          atStrike={at('p3-17') - bE.from}
          atQuote={at('p3-19') - bE.from}
          atPatch={at('p3-20') - bE.from}
        />
      </Sequence>

      <Sequence {...bF} name="3-F 生产版对照">
        {/* p3-21 自制过渡小卡 */}
        <Sequence durationInFrames={at('p3-22') - bF.from} name="3-F 厚得多过渡">
          <ThickCard at={2} />
        </Sequence>
        {/* 同图四章一实例连播 */}
        <ArchifyRecap
          slug="gate-four-result"
          caption="生产版把关"
          cues={[
            {chapterId: 'four-states', at: at('p3-22') - bF.from, durationInFrames: dur('p3-22')},
            {chapterId: 'eight-sources', at: at('p3-23') - bF.from, durationInFrames: dur('p3-23')},
            {chapterId: 'classifier', at: at('p3-24') - bF.from, durationInFrames: dur('p3-24')},
            {chapterId: 'fallback-human', at: at('p3-25') - bF.from, durationInFrames: dur('p3-25')},
          ]}
        />
        {/* p3-26 回落：放行权收束（关卡徽章 vs 医生位） */}
        <Sequence from={at('p3-26') - bF.from} name="3-F 放行权收束">
          <BadgeSplit at={2} />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3ThreeGates;
