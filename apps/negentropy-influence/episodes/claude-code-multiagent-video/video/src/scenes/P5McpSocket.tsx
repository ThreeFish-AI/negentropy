/** P5 插口（p5-01..16，4 镜 7 cue）——分镜 5-A…5-D。
 *
 *  叙事链：手写工具墙（逐台手造·三张小卡×重复堆叠）→ 标准插口机制
 *  （mcp-toolpool 六章全屏接力）→ 缓存拆解（堆叠→拆散→旧清单叫空一章→取舍卡）
 *  → 自我介绍链（名片递入 → 门禁摇头 → 工坊登记放行 → 官方两档引语卡＋金句）。
 *  空间契约：外部机器自右缘挂入（dim 虚线＝墙外），工坊机器居中三台；「标准
 *  协议」字卡自上缘降下（五物件上缘挂入位）；传送带母题（core 橙〔M-001〕）
 *  5-A 左下一现，「加机制」动效不触碰内核图形。
 *  用色纪律：齿轮/卡片＝无彩装置（text/dim）；提示缓存＝core（循环的缓存）；
 *  标准插口 herald＝mech（协作装置）；门禁摇头＝dim（人色·审查）；放行瞬态＝ok。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel, SceneTag} from '../components/motifs';
import {QuoteCard} from '../components/cards';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {
  DUR,
  clamp01,
  useDim,
  useDraw,
  useEnter,
  useImpulse,
  useProgress,
  useReveal,
  useShake,
  useStagger,
} from '../motion';
import type {DrawProps} from '../motion';

/** 常驻系列条定位：与 SceneTag 同行（P1–P6 同值，由 Integrate 统一核对） */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** 传送带巡游节律：2.5s/圈（全片同值） */
const LAP_FRAMES = 75;

/** 左中锚位内核（恒定锚 + 匀速巡游光点；锁芯恒静＝环不动，只有光点在走） */
const KernelCore: React.FC<{size: number; left: number; top: number; span: number}> = ({
  size,
  left,
  top,
  span,
}) => {
  const laps = useProgress(0, Math.max(1, span), 'linear') * (span / LAP_FRAMES);
  return (
    <div style={{position: 'absolute', left, top}}>
      <LoopRing size={size} dotProgress={laps} showLabels={false} showExit={false} />
    </div>
  );
};

/** 齿轮（纯组件）：外圈描线生长 + 八齿随进度亮起 + 中心轴 */
const GearGlyph: React.FC<{
  cx: number;
  cy: number;
  r: number;
  ring: DrawProps;
  teeth: number;
  color?: string;
  dashed?: boolean;
  opacity?: number;
}> = ({cx, cy, r, ring, teeth, color = theme.dim, dashed = false, opacity = 1}) => (
  <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity}}>
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={5}
      strokeDasharray={dashed ? '10 9' : ring.strokeDasharray}
      strokeDashoffset={dashed ? 0 : ring.strokeDashoffset}
      pathLength={dashed ? undefined : ring.pathLength}
      transform={`rotate(-90 ${cx} ${cy})`}
      opacity={0.9}
    />
    {Array.from({length: 8}, (_, i) => {
      const a = ((i * 45 + 22.5) * Math.PI) / 180;
      return (
        <line
          key={i}
          x1={cx + (r + 5) * Math.cos(a)}
          y1={cy + (r + 5) * Math.sin(a)}
          x2={cx + (r + 18) * Math.cos(a)}
          y2={cy + (r + 18) * Math.sin(a)}
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          opacity={clamp01(teeth)}
        />
      );
    })}
    <circle cx={cx} cy={cy} r={9} fill={color} opacity={0.8 * clamp01(teeth)} />
  </svg>
);

// ── 5-A 手写工具墙（p5-01..03） ──────────────────────────────────────────

/** 三台手写机器（居中）+ 各配验证/执行/报错三张小卡；p5-03 再堆一套（示累） */
const GEAR_CX = [520, 960, 1400] as const;
const GEAR_CY = 265;
const GEAR_R = 64;
const TRIO = ['验证', '执行', '报错'] as const;

const HandToolWall: React.FC<{atMachines: number; atCards: number; atProto: number; span: number}> = ({
  atMachines,
  atCards,
  atProto,
  span,
}) => {
  // 外部机器（右缘墙外，dim 虚线——p5-01 主问题的画面锚）
  const extIn = useProgress(2, DUR.f5);
  // 三台机器：齿轮逐台描线生长（@draw ×3，错峰一台一时长）
  const draw0 = useDraw(atMachines, DUR.f5);
  const draw1 = useDraw(atMachines + DUR.f5, DUR.f5);
  const draw2 = useDraw(atMachines + 2 * DUR.f5, DUR.f5);
  const teeth0 = useProgress(atMachines + DUR.f5, DUR.f4);
  const teeth1 = useProgress(atMachines + 2 * DUR.f5, DUR.f4);
  const teeth2 = useProgress(atMachines + 3 * DUR.f5, DUR.f4);
  // 第一套三张小卡 ×3 台（@stagger 9 项）+ 第二套重复堆叠（示累）
  const cards = useStagger(9, {at: atCards, stride: 4, dur: DUR.f3});
  const pile = useStagger(9, {at: atCards + DUR.f6, stride: 4, dur: DUR.f3});
  const again = useProgress(atCards + DUR.f6 + 9 * 4 + 4, DUR.f4);
  // 「标准协议」字卡自上缘降下（@enter:fall）
  const proto = useEnter('fall', {at: atProto, dur: DUR.f5, dist: 120});

  const trioCard = (machine: number, row: number, e: number, pileLayer: boolean) => (
    <div
      key={`t-${machine}-${row}-${pileLayer ? 1 : 0}`}
      style={{
        position: 'absolute',
        left: GEAR_CX[machine] - 95 + (pileLayer ? 34 : 0),
        top: 430 + row * 56 - (pileLayer ? 10 : 0),
        width: 190,
        height: 44,
        borderRadius: 9,
        border: `2px solid ${pileLayer ? theme.panelBorder : theme.dim}`,
        background: theme.panel,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.sans,
        fontSize: 22,
        color: theme.dim,
        opacity: e * (pileLayer ? 0.85 : 1),
        transform: `rotate(${((machine * 3 + row) % 2 === 0 ? 2 : -2) * (pileLayer ? 1 : 0)}deg)`,
      }}
    >
      {TRIO[row]}
    </div>
  );

  return (
    <AbsoluteFill>
      <KernelCore size={130} left={110} top={706} span={span} />

      {/* 工坊右墙（dim 虚线）：墙外是别人家的机器 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <line x1={1640} y1={180} x2={1640} y2={640} stroke={theme.panelBorder} strokeWidth={4} strokeDasharray="12 10" opacity={extIn} />
      </svg>
      {/* 外部机器（墙外，虚线齿轮 + 悬问） */}
      <div style={{opacity: extIn}}>
        <GearGlyph cx={1758} cy={250} r={50} ring={{pathLength: 1, strokeDasharray: 1, strokeDashoffset: 0}} teeth={1} dashed />
        <div
          style={{
            position: 'absolute',
            left: 1690,
            top: 336,
            width: 136,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 22,
            color: theme.dim,
          }}
        >
          {'外接'}
        </div>
      </div>

      {/* 三台手写机器：齿轮 + 机座 */}
      <GearGlyph cx={GEAR_CX[0]} cy={GEAR_CY} r={GEAR_R} ring={draw0} teeth={teeth0} />
      <GearGlyph cx={GEAR_CX[1]} cy={GEAR_CY} r={GEAR_R} ring={draw1} teeth={teeth1} />
      <GearGlyph cx={GEAR_CX[2]} cy={GEAR_CY} r={GEAR_R} ring={draw2} teeth={teeth2} />
      {GEAR_CX.map((cx, i) => (
        <div
          key={cx}
          style={{
            position: 'absolute',
            left: cx - 84,
            top: GEAR_CY + 86,
            width: 168,
            height: 22,
            borderRadius: 6,
            background: theme.panel,
            border: `2px solid ${theme.panelBorder}`,
            opacity: [teeth0, teeth1, teeth2][i],
          }}
        >
          <div style={{display: 'flex', justifyContent: 'space-around', height: '100%', alignItems: 'center'}}>
            <div style={{width: 6, height: 6, borderRadius: 99, background: theme.panelBorder}} />
            <div style={{width: 6, height: 6, borderRadius: 99, background: theme.panelBorder}} />
          </div>
        </div>
      ))}

      {/* 小卡两套：第一套齐整、第二套偏移压叠（接一个，写一套） */}
      {[0, 1, 2].map((m) =>
        [0, 1, 2].map((row) => trioCard(m, row, cards[m * 3 + row], false)),
      )}
      {[0, 1, 2].map((m) =>
        [0, 1, 2].map((row) => trioCard(m, row, pile[m * 3 + row], true)),
      )}
      <div
        style={{
          position: 'absolute',
          left: 1540,
          top: 470,
          padding: '6px 18px',
          borderRadius: 999,
          border: `2px solid ${theme.panelBorder}`,
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.dim,
          opacity: again,
        }}
      >
        {'又一套'}
      </div>

      {/* 「标准协议」字卡：自上缘降下（五物件上缘挂入位，mech 金） */}
      <div style={{position: 'absolute', left: 760, top: 640, ...proto}}>
        <Panel
          accent={theme.mech}
          style={{width: 400, boxSizing: 'border-box', padding: '18px 0', textAlign: 'center'}}
        >
          <span style={{fontFamily: theme.serif, fontSize: 38, fontWeight: 700, color: theme.mech}}>
            {'标准协议'}
          </span>
        </Panel>
      </div>
      <Footnote delay={2}>{'search / deploy'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 5-C p5-10 缓存堆叠：攒下的提示缓存，句尾亲手拆散 ────────────────────

const CacheStack: React.FC<{atScatter: number}> = ({atScatter}) => {
  const title = useEnter('fade', {at: 2, dur: DUR.f5});
  // 六层缓存板依次落位（@stagger）——core 橙描边：缓存是循环（内核）的缓存
  const slabs = useStagger(6, {at: 6, stride: 5, dur: DUR.f3});
  const scatter = useProgress(atScatter, DUR.f5, 'accelerate');

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...title}}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 236,
            width: 1920,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 32,
            fontWeight: 700,
            color: theme.text,
          }}
        >
          {'提示缓存'}
        </div>
      </div>
      {slabs.map((e, i) => {
        // 拆散：向外飞离 + 各自翻转（确定性 per-index，无随机）
        const k = i - 2.5;
        const s = clamp01(scatter);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 700 + k * 58 * s,
              top: 320 + i * 44 - Math.abs(k) * 26 * s,
              width: 520,
              height: 32,
              borderRadius: 8,
              background: theme.panel,
              border: `3px solid ${theme.core}`,
              opacity: e * (1 - 0.45 * s),
              transform: `rotate(${k * 7 * s}deg)`,
            }}
          />
        );
      })}
      <Footnote delay={2}>{'prompt cache'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 5-D 自我介绍链（p5-13..16）：名片 → 门禁摇头 → 登记放行 ──────────────

const SelfIntro: React.FC<{atCard: number; atClaims: number; atReg: number; atOfficial: number}> = ({
  atCard,
  atClaims,
  atReg,
  atOfficial,
}) => {
  // 名片递入（@enter:slideR）+ p5-14 起向门禁递近
  const card = useEnter('slideR', {at: atCard, dur: DUR.f5, dist: 80});
  const nudge = useProgress(atClaims, DUR.f5, 'decelerate');
  // 「只是文本」标签（写在说明里——虚线＝不算数的自我声明）
  const claims = useProgress(atClaims + DUR.f4, DUR.f4);
  // 门禁摇头（@shake decay；dim 灰门柱——审查是人色环节）
  const headShake = useShake({at: atClaims + DUR.f4, decay: true, amp: 6, dur: DUR.f6});
  // 登记表三行 + 放行瞬态（@impulse ok）
  const rows = useStagger(3, {at: atCard + DUR.f4, stride: 12, dur: DUR.f4});
  const okLight = useImpulse({at: atReg, dur: DUR.f6});
  const okOn = useProgress(atReg, DUR.f4);
  const gateLabel = useProgress(atReg + DUR.f4, DUR.f4);
  // p5-16 官方两档引语卡（@reveal 逐字）＋金句定格；链条退后
  const dim = useDim({at: atOfficial, to: 0.22, dur: DUR.f5});
  const quote = useReveal('filters the tool out before Claude sees it', {at: atOfficial + DUR.f4, cps: 20});
  const tiers = useStagger(2, {at: atOfficial + DUR.f3, stride: 10, dur: DUR.f4});
  const thesis = useProgress(atOfficial + DUR.f6, DUR.f4);

  const regRows = [
    {key: 'search', zh: '放行', ok: true},
    {key: 'deploy', zh: '拦下', ok: false},
    {key: '…', zh: '', ok: false},
  ] as const;

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: dim}}>
        {/* 工坊登记表（左）：放不放行，看登记 */}
        <div style={{position: 'absolute', left: 180, top: 330}}>
          <Panel accent={theme.mech} style={{width: 480, boxSizing: 'border-box', padding: '20px 28px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>{'工坊登记表'}</div>
            <div style={{marginTop: 14}}>
              {regRows.map((r, i) => (
                <div
                  key={r.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    height: 58,
                    marginTop: 8,
                    borderRadius: 8,
                    paddingLeft: 14,
                    border: `2px solid ${r.ok && okOn > 0.5 ? theme.ok : theme.panelBorder}`,
                    background: r.ok ? `rgba(126,211,33,${0.05 + 0.14 * clamp01(okLight)})` : 'transparent',
                    opacity: rows[i],
                  }}
                >
                  <span style={{fontFamily: theme.mono, fontSize: 24, color: i === 2 ? theme.panelBorder : theme.text}}>
                    {r.key}
                  </span>
                  {r.zh ? (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontFamily: theme.sans,
                        fontSize: 23,
                        fontWeight: 600,
                        color: r.ok ? theme.ok : theme.dim,
                        opacity: r.ok ? 0.4 + 0.6 * clamp01(okOn) : 1,
                      }}
                    >
                      {r.zh}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* 门禁（中，dim 灰门柱 + 横杠摇头）：名片不算数 */}
        <div style={{position: 'absolute', left: 825, top: 282, transform: `translateX(${headShake}px)`}}>
          <svg width={210} height={340}>
            <rect x={0} y={0} width={210} height={20} rx={6} fill={theme.panel} stroke={theme.dim} strokeWidth={3} />
            <rect x={20} y={18} width={20} height={300} rx={6} fill={theme.panel} stroke={theme.dim} strokeWidth={3} />
            <rect x={170} y={18} width={20} height={300} rx={6} fill={theme.panel} stroke={theme.dim} strokeWidth={3} />
            {/* 横杠：拦在门中间（摇头＝连杠带柱一起晃） */}
            <rect x={40} y={150} width={130} height={14} rx={7} fill={theme.dim} opacity={0.85} />
          </svg>
        </div>
        <div
          style={{
            position: 'absolute',
            left: 760,
            top: 648,
            width: 340,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 25,
            fontWeight: 600,
            color: theme.dim,
            opacity: gateLabel,
          }}
        >
          {'门在分发前'}
        </div>

        {/* 外接机器名片（右，slideR 递入）：自称只读/安全——只是文本。
            外层 div 管 p5-14 的递近位移，内层 {...card} 管入场——两层分开防 transform 互覆 */}
        <div style={{position: 'absolute', left: 1160, top: 330, transform: `translateX(${-70 * clamp01(nudge)}px)`}}>
          <div style={{...card}}>
            <Panel style={{width: 480, boxSizing: 'border-box', padding: '20px 28px'}}>
              <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
                <span style={{fontFamily: theme.sans, fontSize: 29, fontWeight: 700, color: theme.text}}>{'外接机器'}</span>
                <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'名片'}</span>
              </div>
              <div style={{display: 'flex', gap: 14, marginTop: 22}}>
                {['(readOnly)', '(destructive)'].map((t) => (
                  <span
                    key={t}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 8,
                      border: `2px dashed ${theme.dim}`,
                      fontFamily: theme.mono,
                      fontSize: 21,
                      color: theme.dim,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div
                style={{
                  marginTop: 18,
                  fontFamily: theme.sans,
                  fontSize: 22,
                  color: theme.dim,
                  opacity: claims,
                }}
              >
                {'只是文本'}
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {/* p5-16 官方两档引语卡（mono 引语态；链条退后） */}
      <div style={{position: 'absolute', left: 560, top: 210}}>
        <Panel style={{width: 800, boxSizing: 'border-box', padding: '22px 32px'}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
              paddingBottom: 10,
              borderBottom: `2px solid ${theme.panelBorder}`,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'官方文档'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.panelBorder}}>{'mcp · ask / blocked'}</span>
          </div>
          {[
            {key: 'ask', zh: '每次都问'},
            {key: 'blocked', zh: '提前滤掉'},
          ].map((t, i) => (
            <div
              key={t.key}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 20,
                marginTop: 16,
                opacity: tiers[i],
                transform: `translateX(${(1 - tiers[i]) * 22}px)`,
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 27, color: t.key === 'blocked' ? theme.deny : theme.text, width: 170}}>
                {t.key}
              </span>
              <span style={{fontFamily: theme.sans, fontSize: 27, color: theme.text}}>{t.zh}</span>
            </div>
          ))}
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 16, whiteSpace: 'pre', minHeight: 28}}>
            {`"${quote}"`}
          </div>
        </Panel>
      </div>

      {/* 金句定格（p5-16 记忆点⑮；caption-dup-ok: 记忆点标签，主字已压短非逐字） */}
      <div style={{position: 'absolute', left: 360, top: 660, width: 1200, height: 200, opacity: thesis}}>
        <QuoteCard zh="自我介绍 · 不算数" />
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P5McpSocket: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（某句起始帧）；dur() = 与 at 对称的单句取长（cue 窗落在同一句 id 上）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p5-01', 'p5-03');
  const bB = w('p5-04', 'p5-09');
  const bC = w('p5-10', 'p5-12');
  const bD = w('p5-13', 'p5-16');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="5-A 手写工具墙">
        <SceneTag chapter="mcp" tagline="插口" />
        <HandToolWall
          atMachines={at('p5-02') - bA.from}
          atCards={at('p5-03') - bA.from}
          atProto={at('p5-03') - bA.from + 3 * DUR.f6}
          span={bA.durationInFrames}
        />
      </Sequence>

      <Sequence {...bB} name="5-B 标准插口机制">
        {/* 本幕首个回放实例（前一 cue 在 4-C 末，隔 4-D 与 5-A 两镜空窗）⇒ 默认入场 */}
        <ArchifyRecap
          slug="mcp-toolpool"
          caption="标准插口"
          cues={[
            {chapterId: 'standard-socket', at: at('p5-04') - bB.from, durationInFrames: dur('p5-04')},
            {chapterId: 'connect-discover', at: at('p5-05') - bB.from, durationInFrames: dur('p5-05')},
            {chapterId: 'namespace-rename', at: at('p5-06') - bB.from, durationInFrames: dur('p5-06')},
            {chapterId: 'no-collision', at: at('p5-07') - bB.from, durationInFrames: dur('p5-07')},
            {chapterId: 'rebuild-each-round', at: at('p5-08') - bB.from, durationInFrames: dur('p5-08')},
            {chapterId: 'new-machine-next-round', at: at('p5-09') - bB.from, durationInFrames: dur('p5-09')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="5-C 缓存拆解">
        {/* 堆叠装置在 stale-list-miss 全屏窗内让位（b 模式：opacity 淡出让位） */}
        <ArchifyYield cues={[{at: at('p5-11') - bC.from, durationInFrames: dur('p5-11')}]}>
          <Sequence durationInFrames={dur('p5-10')} name="5-C 缓存堆叠">
            <CacheStack atScatter={3 * DUR.f6} />
          </Sequence>
        </ArchifyYield>
        {/* 5-B 末章（p5-09）隔 p5-10 空窗一句后重现 ⇒ 默认入场 */}
        <ArchifyRecap
          slug="mcp-toolpool"
          caption="标准插口"
          cues={[{chapterId: 'stale-list-miss', at: at('p5-11') - bC.from, durationInFrames: dur('p5-11')}]}
        />
        <Sequence from={at('p5-12') - bC.from} name="5-C 取舍卡">
          <QuoteCard zh="动态换新鲜" />
        </Sequence>
      </Sequence>

      <Sequence {...bD} name="5-D 自我介绍卡">
        <SelfIntro
          atCard={at('p5-13') - bD.from}
          atClaims={at('p5-14') - bD.from}
          atReg={at('p5-15') - bD.from}
          atOfficial={at('p5-16') - bD.from}
        />
        <Footnote delay={0}>{'ask / blocked'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5McpSocket;
