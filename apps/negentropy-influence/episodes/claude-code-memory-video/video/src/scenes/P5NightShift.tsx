/** P5 执笔与夜班（p5-01..32，6 镜 10 cue）——分镜 5-A…5-F。
 *
 *  叙事链：写权双人卡（师傅两手空空／收尾工执笔）＋六工具清单快闪（末行空位
 *  deny 虚框）→ stop-extraction 五接力（撂活时刻）→ 时间铰链卡（左＝台面压扁
 *  coreDeep／右＝压缩前快照，抽取箭头单向 mech）→ night-shift 五接力（空窗句
 *  回落职责小条／目录截断小条／无回滚警示条）→【三】四道门引语卡＋官方口径
 *  三连卡（豁免行强调）→ 双层分工一句卡（登记簿管一辈子／便签管这一场）。
 *  空间契约：台面（会丢侧）恒左中锚位；登记簿（不能丢侧）挂右缘——5-F 对置
 *  卡沿用同一左右语义（X-001 防空间逆旁白）。archify：5-B 首实例默认入场
 *  （前镜 2D 装置隔开）；5-D 空窗后重现保持默认 lead。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {DUR, useEnter, useFlowDash, useImpulse, useProgress, useReveal, useStagger} from '../motion';

/** 常驻系列条定位：顶边 y<56 归 frozen ChapterProgress，Badge 下移到 SceneTag
 *  同行（P1–P6 同值，Integrate 统一核对）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

// ── 5-A 写权双人卡（p5-01..05） ─────────────────────────────────────────

const TOOL_LIST = ['bash', 'read', 'write', 'edit', 'glob', 'task'] as const;

const ToolRow: React.FC<{name: string; p: number}> = ({name, p}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      height: 54,
      opacity: p,
      transform: `translateX(${(1 - p) * 22}px)`,
    }}
  >
    <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.panelBorder}}>{'▸'}</span>
    <span style={{fontFamily: theme.mono, fontSize: 27, color: theme.dim}}>{name}</span>
  </div>
);

/** 末行空位：翻遍清单也没有的记忆读写项（deny 虚框＋闪） */
const EmptySlot: React.FC<{at: number}> = ({at}) => {
  const flash = useImpulse({at, dur: DUR.f5});
  return (
    <div
      style={{
        marginTop: 10,
        height: 54,
        borderRadius: 8,
        border: `2px dashed ${theme.deny}`,
        opacity: 0.45 + 0.55 * flash,
        boxShadow: `0 0 ${16 * flash}px ${theme.deny}`,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 18,
      }}
    >
      <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.deny}}>{'— no memory tool'}</span>
    </div>
  );
};

const PenRights: React.FC<{at03: number}> = ({at03}) => {
  const master = useEnter('slideL', {at: 2, dur: DUR.f5, dist: 240, easing: 'decelerate'});
  const scribe = useEnter('slideR', {at: 2, dur: DUR.f5, dist: 240, easing: 'decelerate'});
  const tools = useStagger(TOOL_LIST.length, {at: at03, stride: 4, dur: DUR.f3});

  return (
    <AbsoluteFill>
      {/* 左：师傅剪影——两手空空（text 白无彩），不能记也不能删 */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...master}}>
        <div style={{position: 'absolute', left: 170, top: 300, width: 440}}>
          <Panel style={{padding: '28px 26px', minHeight: 380, boxSizing: 'border-box'}}>
            <svg width={388} height={220}>
              <circle cx={194} cy={64} r={34} fill="none" stroke={theme.text} strokeWidth={4} />
              <path
                d="M104 150 Q194 108 284 150"
                fill="none"
                stroke={theme.text}
                strokeWidth={4}
                strokeLinecap="round"
              />
              {/* 手部特写：两只空手（无笔） */}
              <rect x={70} y={160} width={78} height={26} rx={13} fill="none" stroke={theme.text} strokeWidth={3.5} />
              <rect x={240} y={160} width={78} height={26} rx={13} fill="none" stroke={theme.text} strokeWidth={3.5} />
            </svg>
            <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.text, marginTop: 14}}>
              {'不能记 · 不能删'}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 8}}>
              {'no memory tools'}
            </div>
          </Panel>
        </div>
      </div>

      {/* 右：工坊侧收尾工执笔（mech） */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...scribe}}>
        <div style={{position: 'absolute', left: 1310, top: 300, width: 440}}>
          <Panel accent={theme.mech} style={{padding: '28px 26px', minHeight: 380, boxSizing: 'border-box'}}>
            <svg width={388} height={220}>
              <circle cx={194} cy={64} r={34} fill="none" stroke={theme.mech} strokeWidth={4} />
              <path
                d="M104 150 Q194 108 284 150"
                fill="none"
                stroke={theme.mech}
                strokeWidth={4}
                strokeLinecap="round"
              />
              {/* 执笔的手：笔尖朝上（写权在工坊侧） */}
              <rect x={70} y={160} width={78} height={26} rx={13} fill="none" stroke={theme.mech} strokeWidth={3.5} />
              <rect x={240} y={160} width={78} height={26} rx={13} fill="none" stroke={theme.mech} strokeWidth={3.5} />
              <line x1={279} y1={162} x2={316} y2={112} stroke={theme.mech} strokeWidth={5} strokeLinecap="round" />
            </svg>
            <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.mech, marginTop: 14}}>
              {'收尾工 · 执笔'}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 8}}>
              {'writes the ledger'}
            </div>
          </Panel>
        </div>
      </div>

      {/* 中：六工具清单快闪翻页——翻遍无记忆读写项 */}
      <div style={{position: 'absolute', left: 680, top: 250, width: 560}}>
        <Panel style={{padding: '20px 28px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 1}}>
            {'tool list'}
          </div>
          <div style={{marginTop: 10}}>
            {TOOL_LIST.map((t, i) => (
              <ToolRow key={t} name={t} p={tools[i]} />
            ))}
            <EmptySlot at={at03 + 30} />
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C 时间铰链卡（p5-11..14） ─────────────────────────────────────────

const TimeHinge: React.FC<{at12: number; dur12: number}> = ({at12, dur12}) => {
  const left = useEnter('slideL', {at: 2, dur: DUR.f5, dist: 220, easing: 'decelerate'});
  const right = useEnter('slideR', {at: 2, dur: DUR.f5, dist: 220, easing: 'decelerate'});
  // 左侧压扁：p5-12 句窗内 190px → 26px（台面深态 coreDeep；描边恒 core＝M-001）
  const squash = useProgress(at12, dur12, 'decelerate');
  const h = 190 - squash * 164;
  const dash = useFlowDash({dash: 12, gap: 15, period: 34});

  return (
    <AbsoluteFill>
      {/* 左：台面已被压扁（薄条形态） */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...left}}>
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
          <rect
            x={270}
            y={560 - h / 2}
            width={340}
            height={h}
            rx={Math.min(14, h / 2)}
            fill={theme.coreDeep}
            stroke={theme.core}
            strokeWidth={4}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 260,
            top: 680,
            width: 360,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 28,
            color: theme.dim,
          }}
        >
          {'台面 · 已压扁'}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 260,
            top: 718,
            width: 360,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.dim,
          }}
        >
          {'after'}
        </div>
      </div>

      {/* 右：压缩前快照定格（完整原文页） */}
      <div style={{position: 'absolute', left: 1150, top: 300, width: 500, ...right}}>
        <Panel style={{padding: '26px 34px'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
            <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>{'压缩前快照'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'pre_compress'}</span>
          </div>
          <div style={{marginTop: 20, display: 'flex', flexDirection: 'column', gap: 11}}>
            {[1.0, 0.92, 0.85, 0.96, 0.7, 0.88, 0.55].map((f, i) => (
              <div
                key={i}
                style={{
                  height: 9,
                  width: `${Math.round(f * 100)}%`,
                  borderRadius: 4,
                  background: theme.text,
                  opacity: 0.82,
                }}
              />
            ))}
          </div>
        </Panel>
      </div>

      {/* 抽取箭头：只指右侧（单向，mech 行进虚线） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <line x1={680} y1={560} x2={1078} y2={560} stroke={theme.mech} strokeWidth={6} {...dash} />
        <path d="M1078 560 L1044 542 L1044 578 Z" fill={theme.mech} />
      </svg>

      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 830,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 36,
          color: theme.text,
        }}
      >
        {'压缩管丢 · 记忆管存'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-D 空窗回落三小条（p5-16／p5-17／p5-19） ───────────────────────────

const DutyStrip: React.FC = () => {
  const pop = useEnter('pop', {at: 2, dur: DUR.f4});
  return (
    <div style={{position: 'absolute', left: 570, top: 400, width: 780, ...pop}}>
      <Panel accent={theme.mech} style={{padding: '22px 30px'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <span style={{fontFamily: theme.sans, fontSize: 28, color: theme.text}}>{'夜班职责'}</span>
          {['去重', '合并矛盾', '淘汰过时'].map((s) => (
            <span
              key={s}
              style={{
                padding: '6px 16px',
                borderRadius: 999,
                border: `2px solid ${theme.mech}`,
                fontFamily: theme.sans,
                fontSize: 24,
                color: theme.mech,
              }}
            >
              {s}
            </span>
          ))}
          <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginLeft: 'auto'}}>
            {'consolidate'}
          </span>
        </div>
      </Panel>
    </div>
  );
};

const TruncStrip: React.FC = () => {
  const pop = useEnter('pop', {at: 2, dur: DUR.f4});
  return (
    <div style={{position: 'absolute', left: 570, top: 400, width: 780, ...pop}}>
      <Panel style={{padding: '22px 30px'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <span style={{fontFamily: theme.sans, fontSize: 28, color: theme.text}}>{'目录截断 · 送出'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginLeft: 'auto'}}>
            {'catalog → model'}
          </span>
        </div>
      </Panel>
    </div>
  );
};

const WarnStrip: React.FC = () => {
  const pop = useEnter('pop', {at: 2, dur: DUR.f4});
  return (
    <div style={{position: 'absolute', left: 570, top: 400, width: 780, ...pop}}>
      <Panel accent={theme.deny} style={{padding: '22px 30px'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <span style={{fontFamily: theme.serif, fontSize: 30, color: theme.deny}}>{'无回滚 · 静默'}</span>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: `2px solid ${theme.dim}`,
              fontFamily: theme.sans,
              fontSize: 20,
              color: theme.dim,
            }}
          >
            {'教学版'}
          </span>
          <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginLeft: 'auto'}}>
            {'no rollback'}
          </span>
        </div>
      </Panel>
    </div>
  );
};

// ── 5-E 四道门引语卡＋官方口径三连卡（p5-23..30） ───────────────────────

const GATES = ['时间间隔', '扫描节流', '会话数量', '文件锁'] as const;

/** 豁免行：p5-27 句一次性强调（impulse 辉光） */
const ExemptBadge: React.FC<{at: number}> = ({at}) => {
  const g = useImpulse({at, dur: DUR.f5});
  return (
    <span
      style={{
        display: 'inline-block',
        marginTop: 12,
        padding: '6px 16px',
        borderRadius: 8,
        border: `2px solid ${theme.mech}`,
        fontFamily: theme.sans,
        fontSize: 24,
        color: theme.mech,
        boxShadow: `0 0 ${18 * g}px ${theme.mech}`,
      }}
    >
      {'记忆豁免'}
    </span>
  );
};

const OfficialCard: React.FC<{p: number; children: React.ReactNode}> = ({p, children}) => (
  <div style={{opacity: p, transform: `translateY(${(1 - p) * 22}px)`}}>{children}</div>
);

const GatesAndOfficial: React.FC<{at26: number; at27: number}> = ({at26, at27}) => {
  const header = useReveal('整理 · 四道门', {at: 10, cps: 8});
  const cards = useStagger(3, {at: at26, stride: 12, dur: DUR.f4});
  return (
    <AbsoluteFill>
      {/* 【三】引语卡（mono 引语态） */}
      <div style={{position: 'absolute', left: 460, top: 210, width: 1000}}>
        <Panel style={{padding: '26px 36px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
            <span
              style={{
                fontFamily: theme.sans,
                fontSize: 22,
                color: theme.dim,
                border: `2px solid ${theme.dim}`,
                borderRadius: 6,
                padding: '2px 10px',
              }}
            >
              {'【三】'}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>
              {'开源项目作者 · 源码分析'}
            </span>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 38, color: theme.text, marginTop: 20}}>
            <span style={{fontFamily: theme.serif, fontSize: 52, color: theme.panelBorder}}>{'“'}</span>
            {header}
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 20}}>
            {GATES.map((g) => (
              <span
                key={g}
                style={{
                  padding: '6px 14px',
                  borderRadius: 999,
                  border: `2px solid ${theme.panelBorder}`,
                  fontFamily: theme.sans,
                  fontSize: 22,
                  color: theme.dim,
                }}
              >
                {g}
              </span>
            ))}
            <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginLeft: 'auto'}}>
              {'autoDream'}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'外号 · 做梦'}</span>
          </div>
        </Panel>
      </div>

      {/* 官方口径三连卡 */}
      <div style={{position: 'absolute', left: 290, top: 610, width: 420}}>
        <OfficialCard p={cards[0]}>
          <Panel style={{padding: '20px 26px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'docs'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.text, marginTop: 10}}>
              {'读写主体 · 模型'}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 8}}>
              {'the model itself'}
            </div>
          </Panel>
        </OfficialCard>
      </div>
      <div style={{position: 'absolute', left: 750, top: 610, width: 420}}>
        <OfficialCard p={cards[1]}>
          <Panel style={{padding: '20px 26px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.text}}>{'转录 30 天 · 清理'}</div>
            <ExemptBadge at={at27 + 10} />
          </Panel>
        </OfficialCard>
      </div>
      <div style={{position: 'absolute', left: 1210, top: 610, width: 420}}>
        <OfficialCard p={cards[2]}>
          <Panel style={{padding: '20px 26px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.text}}>{'压后 · 磁盘取回'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginTop: 12}}>
              {'超大 · 只剩路径'}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 8}}>
              {'Referenced file'}
            </div>
          </Panel>
        </OfficialCard>
      </div>
    </AbsoluteFill>
  );
};

// ── 5-F 双层分工一句卡（p5-31..32） ─────────────────────────────────────

const SplitLayers: React.FC<{at32: number}> = ({at32}) => {
  const l = useEnter('slideL', {at: 2, dur: DUR.f5, dist: 220, easing: 'decelerate'});
  const r = useEnter('slideR', {at: 2, dur: DUR.f5, dist: 220, easing: 'decelerate'});
  const sub = useEnter('fade', {at: at32, dur: DUR.f5});
  return (
    <AbsoluteFill>
      {/* 左：跨会话记忆（登记簿小图标，mech） */}
      <div style={{position: 'absolute', left: 360, top: 320, width: 560, ...l}}>
        <Panel accent={theme.mech} style={{padding: '28px 32px', display: 'flex', alignItems: 'center', gap: 28}}>
          <svg width={110} height={140}>
            <rect x={6} y={6} width={98} height={128} rx={8} fill={theme.panel} stroke={theme.mech} strokeWidth={4} />
            <line x1={26} y1={6} x2={26} y2={134} stroke={theme.mechDeep} strokeWidth={3.5} />
            {[0, 1, 2].map((i) => (
              <line
                key={i}
                x1={40}
                y1={36 + i * 30}
                x2={88}
                y2={36 + i * 30}
                stroke={theme.dim}
                strokeWidth={3}
                opacity={0.6}
              />
            ))}
          </svg>
          <div>
            <div style={{fontFamily: theme.sans, fontSize: 34, color: theme.text}}>{'跨会话记忆'}</div>
            <div style={{fontFamily: theme.serif, fontSize: 26, color: theme.mech, marginTop: 12}}>
              {'管一辈子'}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 10}}>
              {'MEMORY.md'}
            </div>
          </div>
        </Panel>
      </div>

      {/* 右：会话记忆（台面便签，core） */}
      <div style={{position: 'absolute', left: 1000, top: 320, width: 560, ...r}}>
        <Panel accent={theme.core} style={{padding: '28px 32px', display: 'flex', alignItems: 'center', gap: 28}}>
          {/* 便签：折角小方纸 */}
          <svg width={110} height={140}>
            <path
              d="M14 14 H76 L96 34 V126 H14 Z"
              fill={theme.panel}
              stroke={theme.core}
              strokeWidth={4}
              strokeLinejoin="round"
            />
            <path d="M76 14 L76 34 L96 34" fill="none" stroke={theme.core} strokeWidth={3} strokeLinejoin="round" />
            {[0, 1, 2].map((i) => (
              <line
                key={i}
                x1={30}
                y1={58 + i * 24}
                x2={80}
                y2={58 + i * 24}
                stroke={theme.dim}
                strokeWidth={3}
                opacity={0.6}
              />
            ))}
          </svg>
          <div>
            <div style={{fontFamily: theme.sans, fontSize: 34, color: theme.text}}>{'会话记忆'}</div>
            <div style={{fontFamily: theme.serif, fontSize: 26, color: theme.core, marginTop: 12}}>
              {'管这一场'}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 10}}>
              {'sticky'}
            </div>
          </div>
        </Panel>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 780,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.dim,
          ...sub,
        }}
      >
        {'教学版未做 · 先记个名'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P5NightShift: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（某句起始帧）；dur() = 与 at 对称的单句取长（cue 窗必须落在同一句 id 上）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p5-01', 'p5-05');
  const bB = w('p5-06', 'p5-10');
  const bC = w('p5-11', 'p5-14');
  const bD = w('p5-15', 'p5-22');
  const bE = w('p5-23', 'p5-30');
  const bF = w('p5-31', 'p5-32');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="5-A 谁执笔">
        <SceneTag chapter="Pen & Night Shift" tagline="执笔与夜班" />
        <PenRights at03={at('p5-03') - bA.from} />
        <Footnote delay={2}>{'bash / read / write / edit / glob / task'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="5-B 撂活抽取">
        {/* 5-A 自制装置隔开 → 首实例默认入场；五章背靠背自动抑制换章弹入 */}
        <ArchifyRecap
          slug="stop-extraction"
          caption="撂活抽取"
          cues={[
            {chapterId: 'stop-moment', at: at('p5-06') - bB.from, durationInFrames: dur('p5-06')},
            {chapterId: 'no-new-call', at: at('p5-07') - bB.from, durationInFrames: dur('p5-07')},
            {chapterId: 'side-extract', at: at('p5-08') - bB.from, durationInFrames: dur('p5-08')},
            {chapterId: 'dedupe-first', at: at('p5-09') - bB.from, durationInFrames: dur('p5-09')},
            {chapterId: 'strong-signals', at: at('p5-10') - bB.from, durationInFrames: dur('p5-10')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="5-C 时间铰链">
        <TimeHinge at12={at('p5-12') - bC.from} dur12={dur('p5-12')} />
      </Sequence>

      <Sequence {...bD} name="5-D 夜班整理">
        {/* 窗 = 本镜 5 条 cue 窗：空窗句小条淡入淡出让位 */}
        <ArchifyYield
          cues={[
            {at: at('p5-15') - bD.from, durationInFrames: dur('p5-15')},
            {at: at('p5-18') - bD.from, durationInFrames: dur('p5-18')},
            {at: at('p5-20') - bD.from, durationInFrames: dur('p5-20')},
            {at: at('p5-21') - bD.from, durationInFrames: dur('p5-21')},
            {at: at('p5-22') - bD.from, durationInFrames: dur('p5-22')},
          ]}
        >
          <Sequence from={at('p5-16') - bD.from} durationInFrames={dur('p5-16')}>
            <DutyStrip />
          </Sequence>
          <Sequence from={at('p5-17') - bD.from} durationInFrames={dur('p5-17')}>
            <TruncStrip />
          </Sequence>
          <Sequence from={at('p5-19') - bD.from} durationInFrames={dur('p5-19')}>
            <WarnStrip />
          </Sequence>
        </ArchifyYield>
        {/* 空窗后重现（p5-16/17/19 隔开）→ 实例内 enters 判定恢复入场 */}
        <ArchifyRecap
          slug="night-shift"
          caption="夜班整理"
          cues={[
            {chapterId: 'threshold-in', at: at('p5-15') - bD.from, durationInFrames: dur('p5-15')},
            {chapterId: 'rough-rewrite', at: at('p5-18') - bD.from, durationInFrames: dur('p5-18')},
            {chapterId: 'reverse-gate', at: at('p5-20') - bD.from, durationInFrames: dur('p5-20')},
            {chapterId: 'outside-deleted', at: at('p5-21') - bD.from, durationInFrames: dur('p5-21')},
            {chapterId: 'stuck-paradox', at: at('p5-22') - bD.from, durationInFrames: dur('p5-22')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="5-E 四道门与官方口径">
        <GatesAndOfficial at26={at('p5-26') - bE.from} at27={at('p5-27') - bE.from} />
        <Footnote delay={2}>{'autoDream · Saved 2 memories · Referenced file'}</Footnote>
      </Sequence>

      <Sequence {...bF} name="5-F 两层分工">
        <SplitLayers at32={at('p5-32') - bF.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5NightShift;
