/** P4 垫纸重铺（p4-01..22，5 镜 6 cue）——分镜 4-A…4-E。
 *
 *  叙事链：坑四「写死」对账（垫纸上一整段不可分字符串滚出＋三种死法小卡）→
 *  分段定义（图集）→ 事实 vs 猜测分屏＋金句卡 → 循环内重估与缓存（图集）→
 *  最硬官方锚引语卡＋对开小卡＋门槛数字卡。
 *  空间契约：垫纸特写＝coreDeep 台面（DESK 锚位恒静）上的 mech 紫垫纸层（PadSheet，
 *  与 P3 共用）；中段 4-B/4-D 全屏图集承载，本幕两处图集实例均由自制装置隔开、
 *  无背靠背，lead 走默认。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {DeskPlane, Footnote, Panel, SceneTag} from '../components/motifs';
import {QuoteCard} from '../components/cards';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {PadSheet, PitCard} from './P3SkillDrawers';
import {DUR, useCount, useEnter, useImpulse, useProgress, useReveal, useShake, useStagger} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位（P1–P6 同值，见 references/08「HarnessBadge 共存」）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

// ── 4-A 坑四对账＋写死滚屏（p4-01..06） ──────────────────────────────────

/** 三种死法（末卡 deny 描边；标题皆 ≤4 字关键词，不复述口播）。 */
const DEATHS = [
  {label: '整张重写'},
  {label: '新旧打架'},
  {label: '全量白付'},
] as const;

/** 写死串的滚出行（整块不可分：统一密度的点阵行，逐行滚出）。 */
const BLOB_ROW = '·'.repeat(46);

const DeadString: React.FC<{at2: number; at4: number; at6: number}> = ({at2, at4, at6}) => {
  const desk = useProgress(at2, DUR.f5); // 台面/垫纸整层浮现（框体恒静）
  const head = useProgress(at2 + 2, DUR.f4);
  const tail = useProgress(at2 + 74, DUR.f3); // 串尾收引号随末行滚出而落定
  // 一大段字符串整块滚出：五行逐字流出、行距均质（整块感来自统一密度）
  const rows = [
    useReveal(BLOB_ROW, {at: at2 + 10, cps: 60}),
    useReveal(BLOB_ROW, {at: at2 + 26, cps: 60}),
    useReveal(BLOB_ROW, {at: at2 + 42, cps: 60}),
    useReveal(BLOB_ROW, {at: at2 + 58, cps: 60}),
    useReveal(BLOB_ROW, {at: at2 + 74, cps: 60}),
  ];
  const deaths = useStagger(DEATHS.length, {at: at4, stride: Math.max(2, Math.round((at6 - at4) / 2)), dur: DUR.f4});

  return (
    <AbsoluteFill>
      <PitCard n={4} title="写死" sub="三种死法" at={2} />

      <DeskPlane opacity={desk} />
      <PadSheet opacity={desk} />
      <div style={{position: 'absolute', left: 540, top: 318, fontFamily: theme.sans, fontSize: 22, color: theme.dim, opacity: desk}}>
        {'垫纸'}
      </div>

      {/* 写死串：mono 整块（左侧统条暗示不可拆分） */}
      <div style={{position: 'absolute', left: 536, top: 352, width: 850, opacity: desk}}>
        <div style={{fontFamily: theme.mono, fontSize: 28, color: theme.text, opacity: head}}>{'SYSTEM = """'}</div>
        <div style={{marginLeft: 16, borderLeft: `4px solid ${theme.panelBorder}`, paddingLeft: 16, marginTop: 8}}>
          {rows.map((r, i) => (
            <div key={i} style={{fontFamily: theme.mono, fontSize: 22, lineHeight: 1.6, color: theme.dim, whiteSpace: 'pre'}}>
              {r}
            </div>
          ))}
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 28, color: theme.text, marginTop: 8, opacity: tail}}>
          {'"""'}
        </div>
      </div>

      {/* 三种死法：末卡 deny 描边（压在垫纸下半幅，p4-04..06 逐卡对应） */}
      {DEATHS.map((d, i) => (
        <div
          key={d.label}
          style={{
            position: 'absolute',
            left: 530 + i * (272 + 24),
            top: 642,
            width: 272,
            opacity: deaths[i],
            transform: `translateY(${(1 - deaths[i]) * 20}px)`,
          }}
        >
          <Panel accent={i === 2 ? theme.deny : theme.panelBorder} style={{padding: '18px 22px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{`0${i + 1}`}</div>
            <div
              style={{
                fontFamily: theme.sans,
                fontSize: 30,
                fontWeight: 600,
                color: i === 2 ? theme.deny : theme.text,
                marginTop: 6,
              }}
            >
              {d.label}
            </div>
          </Panel>
        </div>
      ))}

      <Footnote delay={at2}>{'SYSTEM = "..."'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-C 事实 vs 猜测分屏＋金句（p4-10..14） ──────────────────────────────

const FactVsGuess: React.FC<{at11: number; at12: number; at13: number}> = ({at11, at12, at13}) => {
  const kicker = useEnter('fade', {at: 2, dur: DUR.f5});
  const left = useEnter('slideL', {at: at11, dur: DUR.f5, dist: 56});
  const right = useEnter('slideR', {at: at11 + 3, dur: DUR.f5, dist: 56});
  // 右侧扫描线：判定前自左向右扫过消息文本（机械等速）
  const scan = useProgress(at11 + DUR.f5 + 4, Math.max(DUR.f5, at12 - at11 - DUR.f5 - 4), 'linear');
  // 判定（p4-12）：左侧存在性检查直接命中（mech）；右侧关键词问号打叉（deny＋抖动）
  const hit = useImpulse({at: at12, dur: DUR.f6, peak: 1});
  const hitSet = useProgress(at12, DUR.f3);
  const shake = useShake({at: at12, amp: 7, decay: true, dur: DUR.f6});

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 158, width: 1920, textAlign: 'center', ...kicker}}>
        <span style={{fontFamily: theme.serif, fontSize: 42, fontWeight: 700, color: theme.dim}}>{'一条设计规则'}</span>
      </div>

      {/* 左：问文件系统（事实 · 直接命中） */}
      <div style={{position: 'absolute', left: 140, top: 250, width: 780, ...left}}>
        <Panel accent={hitSet > 0.5 ? theme.mech : theme.panelBorder} style={{height: 360, boxSizing: 'border-box', padding: '24px 32px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.text}}>{'问文件系统'}</div>
          <div style={{position: 'relative', marginTop: 26, width: 640, height: 230}}>
            {/* 文件图标 */}
            <svg width={86} height={104} style={{position: 'absolute', left: 26, top: 30}}>
              <path
                d="M6 8 Q6 2 12 2 H56 L80 26 V96 Q80 102 74 102 H12 Q6 102 6 96 Z"
                fill={theme.panel}
                stroke={theme.text}
                strokeWidth={4}
              />
              <path d="M56 2 V26 H80" fill="none" stroke={theme.text} strokeWidth={4} />
              <line x1={20} y1={48} x2={64} y2={48} stroke={theme.panelBorder} strokeWidth={4} />
              <line x1={20} y1={64} x2={64} y2={64} stroke={theme.panelBorder} strokeWidth={4} />
            </svg>
            {/* 存在性检查的问与答 */}
            <div style={{position: 'absolute', left: 150, top: 34, fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>
              {'在 · 还是不在'}
            </div>
            <div
              style={{
                position: 'absolute',
                left: 150,
                top: 82,
                fontFamily: theme.sans,
                fontSize: 58,
                fontWeight: 700,
                color: theme.mech,
                opacity: hitSet,
                textShadow: `0 0 ${34 * hit}px ${theme.mech}`,
              }}
            >
              {'✓ 在'}
            </div>
            <div style={{position: 'absolute', left: 150, top: 158, fontFamily: theme.sans, fontSize: 22, color: theme.dim, opacity: hitSet}}>
              {'直接命中 · 一问便知'}
            </div>
          </div>
        </Panel>
      </div>

      {/* 右：扫消息文本找关键词（猜测 · 打叉） */}
      <div style={{position: 'absolute', left: 1000, top: 250, width: 780, ...right}}>
        <Panel accent={hitSet > 0.5 ? theme.deny : theme.panelBorder} style={{height: 360, boxSizing: 'border-box', padding: '24px 32px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.text}}>{'扫消息文本'}</div>
          <div style={{position: 'relative', marginTop: 26, width: 640, height: 230}}>
            {[0.92, 0.74, 0.84].map((wf, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 26,
                  top: 40 + i * 44,
                  width: 560 * wf,
                  height: 16,
                  borderRadius: 8,
                  background: theme.dim,
                  opacity: 0.3,
                }}
              />
            ))}
            {/* 扫描线（sin 包络：进出行内自然显隐） */}
            <div
              style={{
                position: 'absolute',
                left: 26 + scan * 580,
                top: 26,
                width: 3,
                height: 160,
                background: theme.dim,
                opacity: 0.85 * Math.sin(Math.PI * scan),
              }}
            />
            {/* ？→ ✗ */}
            <div
              style={{
                position: 'absolute',
                left: 540,
                top: 60,
                fontFamily: theme.serif,
                fontSize: 88,
                fontWeight: 700,
                color: theme.dim,
                opacity: 1 - hitSet,
              }}
            >
              {'？'}
            </div>
            <div
              style={{
                position: 'absolute',
                left: 532,
                top: 56,
                fontFamily: theme.serif,
                fontSize: 92,
                fontWeight: 700,
                color: theme.deny,
                opacity: hitSet,
                transform: `translateX(${shake}px)`,
              }}
            >
              {'✗'}
            </div>
            <div style={{position: 'absolute', left: 26, top: 196, fontFamily: theme.sans, fontSize: 22, color: theme.deny, opacity: hitSet}}>
              {'话里提没提 · 是猜测'}
            </div>
          </div>
        </Panel>
      </div>

      {/* 金句卡（压短形态，终态停驻〔M-003〕；caption-dup-ok 定格记忆点） */}
      <Sequence from={at13} layout="none">
        <div style={{position: 'absolute', left: 260, top: 660, width: 1400, height: 230}}>
          <QuoteCard zh="看真实状态 · 不听嘴上" />
        </div>
      </Sequence>

      <Footnote delay={at11}>{'os.path.exists · list(TOOL_HANDLERS)'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-E 最硬官方锚引语卡（p4-18..22） ────────────────────────────────────

const HardestAnchor: React.FC<{at19: number; at20: number; at21: number; at22: number; dur22: number}> = ({
  at19,
  at20,
  at21,
  at22,
  dur22,
}) => {
  const page = useEnter('fade', {at: 2, dur: DUR.f5});
  const l1 = useReveal('项目嘱托 · 是一条用户消息', {at: at19 + 4, cps: 7});
  const l2 = useReveal('排在系统提示之后 · 不属系统提示', {at: at20 + 2, cps: 7});
  const pair = useStagger(2, {at: at21, stride: 14, dur: DUR.f4});
  const head = useCount({to: 200, at: at22, dur: dur22});
  const numCard = useProgress(at22, DUR.f4); // 数字卡随 p4-22 淡入（官方引语态注记）

  return (
    <AbsoluteFill>
      {/* 官方文档页样＋中文摘要两行（引语态） */}
      <div style={{position: 'absolute', left: 460, top: 156, ...page}}>
        <Panel style={{width: 1000, boxSizing: 'border-box', padding: '24px 36px'}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              paddingBottom: 12,
              borderBottom: `2px solid ${theme.panelBorder}`,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'官方文档'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.panelBorder}}>{'user message'}</span>
          </div>
          <div style={{marginTop: 20, paddingLeft: 6}}>
            <span style={{fontFamily: theme.serif, fontSize: 62, color: theme.panelBorder}}>{'“'}</span>
            <div style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 600, color: theme.text, marginTop: 2, whiteSpace: 'pre'}}>
              {l1}
            </div>
            <div style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 600, color: theme.dim, marginTop: 14, whiteSpace: 'pre'}}>
              {l2}
            </div>
          </div>
        </Panel>
      </div>

      {/* 对开小卡：垫纸是垫纸 · 条子是条子（两层分开铺） */}
      {[
        {t: '垫纸', s: '系统提示', c: theme.mech},
        {t: '条子', s: '用户消息', c: theme.dim},
      ].map((p, i) => (
        <div
          key={p.t}
          style={{
            position: 'absolute',
            left: 430 + i * 600,
            top: 580,
            width: 460,
            opacity: pair[i],
            transform: `translateY(${(1 - pair[i]) * 20}px)`,
          }}
        >
          <Panel accent={p.c} style={{padding: '20px 28px'}}>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 18}}>
              <span style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: p.c === theme.mech ? theme.mech : theme.text}}>
                {p.t}
              </span>
              <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{p.s}</span>
            </div>
          </Panel>
        </div>
      ))}

      {/* 门槛数字卡（官方引语态注记） */}
      <div style={{position: 'absolute', left: 660, top: 726, width: 600, opacity: numCard, transform: `translateY(${(1 - numCard) * 16}px)`}}>
        <Panel style={{padding: '18px 30px', textAlign: 'center'}}>
          <span style={{fontFamily: theme.mono, fontSize: 72, color: theme.text, fontVariantNumeric: 'tabular-nums'}}>
            {`${Math.round(head)}`}
          </span>
          <span style={{fontFamily: theme.sans, fontSize: 38, fontWeight: 600, color: theme.text, marginLeft: 12}}>{'行'}</span>
          <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginTop: 6}}>{'自动记忆 · 开头 · 每轮先带上'}</div>
        </Panel>
      </div>

      <Footnote delay={2}>{'delivered as a user message, not part of the system prompt'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P4PromptRelay: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p4-01', 'p4-06');
  const bB = w('p4-07', 'p4-09');
  const bC = w('p4-10', 'p4-14');
  const bD = w('p4-15', 'p4-17');
  const bE = w('p4-18', 'p4-22');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="4-A 坑四对账写死">
        <SceneTag chapter="Prompt Relay" tagline="垫纸重铺" />
        <DeadString at2={at('p4-02') - bA.from} at4={at('p4-04') - bA.from} at6={at('p4-06') - bA.from} />
      </Sequence>

      {/* 前镜自制装置 → 首章默认入场 */}
      <Sequence {...bB} name="4-B 分段定义">
        <ArchifyRecap
          slug="plan-prompt-sections"
          caption="分段定义"
          cues={[
            {chapterId: 'sectioned-define', at: at('p4-07') - bB.from, durationInFrames: dur('p4-07')},
            {chapterId: 'always-sections', at: at('p4-08') - bB.from, durationInFrames: dur('p4-08')},
            {chapterId: 'conditional-memory', at: at('p4-09') - bB.from, durationInFrames: dur('p4-09')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="4-C 事实对猜测">
        <FactVsGuess at11={at('p4-11') - bC.from} at12={at('p4-12') - bC.from} at13={at('p4-13') - bC.from} />
      </Sequence>

      {/* 前镜自制装置 → 首章默认入场（非背靠背） */}
      <Sequence {...bD} name="4-D 重估与缓存">
        <ArchifyRecap
          slug="plan-prompt-cache"
          caption="重估与缓存"
          cues={[
            {chapterId: 're-eval-per-turn', at: at('p4-15') - bD.from, durationInFrames: dur('p4-15')},
            {chapterId: 'deterministic-key', at: at('p4-16') - bD.from, durationInFrames: dur('p4-16')},
            {chapterId: 'no-builtin-hash', at: at('p4-17') - bD.from, durationInFrames: dur('p4-17')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="4-E 最硬官方锚">
        <HardestAnchor
          at19={at('p4-19') - bE.from}
          at20={at('p4-20') - bE.from}
          at21={at('p4-21') - bE.from}
          at22={at('p4-22') - bE.from}
          dur22={dur('p4-22')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4PromptRelay;

/** 场景代理路由名（Stage ⑧ 工单）→ 同一组件，供 Main.tsx 两侧命名互通。 */
export const P4Ladder = P4PromptRelay;
