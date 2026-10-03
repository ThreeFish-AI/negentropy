/** P2 递话口（p2-01..19，6 镜 4 cue）——分镜 2-A…2-F。
 *
 *  cue 清单（4）：
 *   2-B mailslot-consume append@p2-05 / take-all@p2-06（跨句扩窗 dur 求和盖
 *      p2-06..08——探测支线在章内；空窗回填的合法拼写）
 *   2-E mailslot-consume wake@p2-16 / b3@p2-17（与 2-B 实例隔 2-C/2-D 两镜空窗
 *      → 默认入场）
 *
 *  ★ 2-A 门上递话口母题首亮相：影子帮工（来去半透明）vs 常驻队友（门牌+工位
 *    长亮 @breathe）；队友=后台线程三件（说明单/对话/工具箱）@stagger。
 *  ★ 2-C 队列汇流：键盘事件与口内信条双流 @flow 汇入同一注入口、师傅被叫醒；
 *    甲乙两口信先后入队长的口、整摞取走同屏（@count 2 条）。
 *  ★ 2-D 边界在工具单：四件工具卡中两格灰缺（✕）＋嵌套示意打叉。
 *  ★ 2-F 官方对照卡【官】：实验性/默认关/环境开关 + 收件箱=文件逐条校验。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LodgeMap, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {
  DUR,
  clamp01,
  progress,
  useBreathe,
  useCount,
  useEnter,
  useFlowDash,
  useImpulse,
  useProgress,
  useReveal,
  useStagger,
  useTravel,
} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const BADGE_STYLE: React.CSSProperties = {top: 64};

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 师傅剪影（text 白无彩） */
const Person: React.FC<{x: number; y: number; color?: string; scale?: number; opacity?: number}> = ({
  x,
  y,
  color = theme.text,
  scale = 1,
  opacity = 0.9,
}) => (
  <svg
    width={120 * scale}
    height={180 * scale}
    viewBox="0 0 120 180"
    style={{position: 'absolute', left: x, top: y, opacity}}
  >
    <circle cx={60} cy={34} r={28} fill={color} />
    <path d="M0 180 Q0 76 60 70 Q120 76 120 180 Z" fill={color} />
  </svg>
);

/** 门＋门上递话口（横缝＋投信滑道）：本幕母题底座。 */
const DoorWithSlot: React.FC<{x: number; y: number; glow?: number; label?: string}> = ({x, y, glow = 0, label}) => (
  <div style={{position: 'absolute', left: x, top: y}}>
    <div
      style={{
        width: 330,
        height: 520,
        boxSizing: 'border-box',
        borderRadius: '14px 14px 6px 6px',
        background: theme.panel,
        border: `3px solid ${glow > 0.1 ? withAlpha(theme.accent, 0.35 + 0.45 * glow) : theme.panelBorder}`,
        boxShadow: glow > 0.1 ? `0 0 ${22 * glow}px ${withAlpha(theme.accent, 0.3)}` : undefined,
        position: 'relative',
      }}
    >
      {/* 门牌 */}
      <div
        style={{
          margin: '26px auto 0',
          width: 190,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          fontWeight: 600,
          color: theme.text,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 8,
          padding: '6px 0',
          background: theme.bg,
        }}
      >
        {label ?? '队友'}
      </div>
      {/* 递话口（横缝） */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 190,
          transform: 'translateX(-50%)',
          width: 190,
          height: 16,
          borderRadius: 8,
          background: theme.bg,
          border: `3px solid ${theme.accent}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 212,
          transform: 'translateX(-50%)',
          fontFamily: theme.mono,
          fontSize: 16,
          color: theme.dim,
        }}
      >
        {'mailslot'}
      </div>
    </div>
  </div>
);

// ── 2-A 帮工 vs 队友 ────────────────────────────────────────────────────

/** 影子帮工（来去半透明 @enter:fade）对照常驻队友（门牌+工位长亮）。 */
const ShadowVsMate: React.FC<{at02: number; at03: number; at04: number}> = ({at02, at03, at04}) => {
  const shadowIn = useEnter('fade', {at: at02, dur: DUR.f5});
  // 影子帮工 p2-02 段末淡走（干完就走）
  const frame = useCurrentFrame();
  const shadowOut = progress(frame, at03 - 10, DUR.f5);
  // 队友工位长亮（呼吸辉光）
  const glowBreathe = useBreathe({period: 46, amp: 0.5, base: 0.5});
  // 三件（后台线程的行头）stagger
  const kit = useStagger(3, {at: at04 + 6, dur: DUR.f4, stride: 10});
  const kits = [
    {k: '说明单', s: 'system prompt'},
    {k: '对话', s: 'own messages'},
    {k: '工具箱', s: 'lean tools'},
  ];
  return (
    <AbsoluteFill>
      {/* 左：影子帮工（半透明来去） */}
      <div style={{position: 'absolute', left: 330, top: 330, ...shadowIn, opacity: (shadowIn.opacity ?? 1) * (1 - shadowOut) * 0.45}}>
        <Person x={0} y={0} color={theme.text} opacity={1} />
        <div style={{marginTop: 12, textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
          {'一次性帮工'}
        </div>
      </div>
      {/* 右：常驻队友（门牌+工位长亮） */}
      <DoorWithSlot x={1180} y={210} glow={glowBreathe} />
      <div style={{position: 'absolute', left: 1560, top: 300}}>
        <Person x={0} y={0} color={theme.text} opacity={0.9} />
      </div>
      {/* 三件行头（p2-04）；left 330：右缘 330+3×250+2×24=1128，避右侧门板（x1180 起） */}
      <div style={{position: 'absolute', left: 330, top: 640, display: 'flex', gap: 24}}>
        {kits.map((k, i) => (
          <div key={k.k} style={{opacity: kit[i], transform: `translateY(${(1 - kit[i]) * 16}px)`}}>
            <Panel accent={theme.accent} style={{width: 250, boxSizing: 'border-box', padding: '16px 20px'}}>
              <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.text}}>{k.k}</div>
              <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 6}}>{k.s}</div>
            </Panel>
          </div>
        ))}
      </div>
      <Footnote delay={12}>{'subagent · spawn_teammate'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-C 楼替人盯口 ──────────────────────────────────────────────────────

/** 队列汇流：键盘事件＋口内信条两条 @flow 流线汇入同一注入口；楼（梁上一只眼）
 *  巡视频闪（useTravel 小环巡游点）；甲乙两口信先后入队长的口、整摞取走（@count 2）。 */
const QueueMerge: React.FC<{at12: number; at13: number}> = ({at12, at13}) => {
  const flowA = useFlowDash({dash: 14, gap: 18, period: 22});
  const flowB = useFlowDash({dash: 14, gap: 18, period: 22, });
  // 楼的巡视小环（恒定巡游——楼替人盯口）
  const watch = useTravel({cx: 960, cy: 258, r: 26, secPerLap: 2.4});
  // 甲乙两口信先后滑入（p2-12），下一秒整摞取走（p2-13）
  const frame = useCurrentFrame();
  const aIn = progress(frame, at12, 16);
  const bIn = progress(frame, at12 + 24, 16);
  const take = progress(frame, at13 + 4, DUR.f5);
  const taken = useCount({to: 2, at: at13 + 6, dur: DUR.f5});
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        {/* 两条汇流线（静态底线 + 行进虚线） */}
        <path d="M320 330 C 560 330, 700 420, 880 500" fill="none" stroke={theme.panelBorder} strokeWidth={3} opacity={0.55} />
        <path d="M320 330 C 560 330, 700 420, 880 500" fill="none" stroke={theme.accent} strokeWidth={4} opacity={0.9} {...flowA} />
        <path d="M1600 330 C 1360 330, 1220 420, 1040 500" fill="none" stroke={theme.panelBorder} strokeWidth={3} opacity={0.55} />
        <path d="M1600 330 C 1360 330, 1220 420, 1040 500" fill="none" stroke={theme.accent} strokeWidth={4} opacity={0.9} {...flowB} />
        {/* 注入口（漏斗） */}
        <path d="M880 500 L1040 500 L980 580 L940 580 Z" fill={theme.panel} stroke={theme.accent} strokeWidth={3} />
        {/* 楼的巡视环（watch loop） */}
        <circle cx={960} cy={258} r={26} fill="none" stroke={theme.panelBorder} strokeWidth={3} />
        <circle cx={watch.x} cy={watch.y} r={8} fill={theme.accent} />
        {/* 两口信条（滑入 → 整摞取走上提） */}
        <g opacity={aIn}>
          <rect x={920 - 60 * take} y={600 - 170 * take} width={80} height={30} rx={5} fill={theme.panel} stroke={theme.accent} strokeWidth={2.5} />
        </g>
        <g opacity={bIn}>
          <rect x={920 - 60 * take} y={644 - 170 * take} width={80} height={30} rx={5} fill={theme.panel} stroke={theme.accent} strokeWidth={2.5} />
        </g>
      </svg>
      {/* 源头标签（键盘 / 口内信） */}
      <div style={{position: 'absolute', left: 190, top: 262, fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'键盘 · key events'}</div>
      <div style={{position: 'absolute', left: 1430, top: 262, fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'口内信 · inbox'}</div>
      {/* 注入口标签 */}
      <div style={{position: 'absolute', left: 880, top: 470, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'同一队列'}</div>
      {/* 被叫醒的师傅（灯亮） */}
      <div style={{position: 'absolute', left: 880, top: 640, opacity: 0.35 + 0.65 * aIn}}>
        <Person x={0} y={0} color={theme.text} opacity={0.92} scale={0.8} />
      </div>
      {/* 整摞取走计数（p2-13） */}
      <div style={{position: 'absolute', left: 1180, top: 560, opacity: progress(frame, at13 + 6, DUR.f4)}}>
        <Panel accent={theme.accent} style={{width: 360, boxSizing: 'border-box', padding: '18px 26px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'整摞取走'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 56, color: theme.accent, marginTop: 4, fontVariantNumeric: 'tabular-nums'}}>
            {`${Math.round(taken)} 条`}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 4}}>{'take_all · 清空'}</div>
        </Panel>
      </div>
      <Footnote delay={10}>{'send_message · check_inbox'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-D 边界在工具单 ────────────────────────────────────────────────────

/** 队友工具单特写：两格灰缺（招队友/开新活 ✕）＋嵌套示意打叉。 */
const ToolBoundary: React.FC<{at15: number}> = ({at15}) => {
  const tools = [
    {k: '执行命令', s: 'run', ok: true},
    {k: '读写文件', s: 'read / write', ok: true},
    {k: '招队友', s: 'spawn_teammate', ok: false},
    {k: '开新活', s: 'new task', ok: false},
  ];
  const cards = useStagger(4, {at: 6, dur: DUR.f4, stride: 8});
  // 灰缺格压暗＋打叉脉冲（p2-15「压根没发」）
  const dim = useProgress(at15, DUR.f4);
  const cross = useImpulse({at: at15 + 6, dur: DUR.f6, peak: 1});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 480, top: 250}}>
        <Panel style={{width: 960, boxSizing: 'border-box', padding: '28px 36px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 2}}>{'TOOLS · 队友工具单'}</div>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 22}}>
            {tools.map((t, i) => {
              const o = t.ok ? cards[i] : cards[i] * (1 - 0.55 * dim);
              return (
                <div key={t.k} style={{opacity: o, transform: `translateY(${(1 - cards[i]) * 14}px)`}}>
                  <div
                    style={{
                      width: 280,
                      boxSizing: 'border-box',
                      padding: '18px 20px',
                      borderRadius: 10,
                      background: theme.bg,
                      border: `2px solid ${t.ok ? theme.panelBorder : theme.danger}`,
                      position: 'relative',
                    }}
                  >
                    <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: t.ok ? theme.text : theme.dim}}>{t.k}</div>
                    <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 6}}>{t.s}</div>
                    {!t.ok ? (
                      <div
                        style={{
                          position: 'absolute',
                          right: 14,
                          top: 10,
                          fontFamily: theme.sans,
                          fontSize: 40,
                          fontWeight: 700,
                          color: theme.danger,
                          opacity: dim,
                          transform: `scale(${0.7 + 0.3 * cross})`,
                          textShadow: `0 0 ${12 * cross}px ${withAlpha(theme.danger, 0.45)}`,
                        }}
                      >
                        {'✕'}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {/* 嵌套示意（套娃打叉）——生不了下属 */}
          <div style={{display: 'flex', alignItems: 'center', gap: 16, marginTop: 24, opacity: dim}}>
            <svg width={90} height={54}>
              <rect x={2} y={6} width={50} height={44} rx={8} fill="none" stroke={theme.dim} strokeWidth={2.5} />
              <rect x={22} y={14} width={34} height={30} rx={6} fill="none" stroke={theme.dim} strokeWidth={2} />
              <line x1={6} y1={50} x2={84} y2={4} stroke={theme.danger} strokeWidth={4} opacity={0.4 + 0.6 * cross} />
            </svg>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'不嵌套 · 没发这门工具'}</div>
          </div>
        </Panel>
      </div>
      <Footnote delay={16}>{'禁嵌套 · 队伍不成树'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-F 官方对照 ────────────────────────────────────────────────────────

/** 官方对照卡【官】：页样＋三行要点 @reveal ＋收件箱=文件行。 */
const OfficialCard: React.FC = () => {
  const rise = useEnter('rise', {at: 2, dur: DUR.f5, springPreset: 'settle', dist: 26});
  const rows = ['实验性 · experimental', '默认关闭 · off by default', '环境开关 · opt-in'];
  const footer = '收件箱 = 文件 · 逐条校验';
  const r1 = useReveal(rows[0], {at: 14, cps: 14});
  const r2 = useReveal(rows[1], {at: 14 + 16, cps: 14});
  const r3 = useReveal(rows[2], {at: 14 + 32, cps: 14});
  const rf = useReveal(footer, {at: 14 + 52, cps: 16});
  const reveals = [r1, r2, r3];
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 530, top: 240, width: 860, ...rise}}>
        <Panel accent={theme.accent} style={{boxSizing: 'border-box', padding: 0, overflow: 'hidden'}}>
          {/* 页样标题栏（文档页） */}
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 26px', borderBottom: `2px solid ${theme.panelBorder}`}}>
            <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'code.claude.com · agent teams'}</span>
            <span
              style={{
                fontFamily: theme.sans,
                fontSize: 20,
                fontWeight: 600,
                color: theme.accent,
                border: `2px solid ${theme.accent}`,
                borderRadius: 999,
                padding: '2px 14px',
              }}
            >
              {'官'}
            </span>
          </div>
          <div style={{padding: '26px 32px'}}>
            {rows.map((r, i) => (
              <div key={r} style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: i === 0 ? 0 : 18}}>
                <div style={{width: 10, height: 10, borderRadius: 999, background: theme.accent}} />
                <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>{reveals[i]}</span>
              </div>
            ))}
            <div style={{marginTop: 30, paddingTop: 20, borderTop: `2px dashed ${theme.panelBorder}`, fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>
              {rf}
            </div>
          </div>
        </Panel>
      </div>
      <Footnote delay={20}>{'产品：15 种消息类型（画面注）'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P2MailSlot: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p2-01', 'p2-04');
  const bB = w('p2-05', 'p2-08');
  const bC = w('p2-09', 'p2-13');
  const bD = w('p2-14', 'p2-15');
  const bE = w('p2-16', 'p2-17');
  const bF = w('p2-18', 'p2-19');

  const frame = useCurrentFrame();
  const mapIn = progress(frame, 6, DUR.f4);

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />
      <SceneTag chapter="P2" tagline="递话口" accent={theme.accent} />
      <div style={{position: 'absolute', left: 1668, top: 56, opacity: mapIn}}>
        <LodgeMap active="slot" />
      </div>

      <Sequence {...bA} name="2-A 帮工 vs 队友">
        <ShadowVsMate at02={at('p2-02') - bA.from} at03={at('p2-03') - bA.from} at04={at('p2-04') - bA.from} />
      </Sequence>

      <Sequence {...bB} name="2-B 口的规矩">
        {/* cue 1-2/4：mailslot-consume（追加一行→整摞取走；跨句扩窗盖 p2-06..08） */}
        <ArchifyRecap
          slug="mailslot-consume"
          caption="递话口·消费式收信"
          cues={[
            {chapterId: 'append', at: at('p2-05') - bB.from, durationInFrames: dur('p2-05')},
            {chapterId: 'take-all', at: at('p2-06') - bB.from, durationInFrames: dur('p2-06') + dur('p2-07') + dur('p2-08')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="2-C 楼替人盯口">
        <QueueMerge at12={at('p2-12') - bC.from} at13={at('p2-13') - bC.from} />
      </Sequence>

      <Sequence {...bD} name="2-D 边界在工具单">
        <ToolBoundary at15={at('p2-15') - bD.from} />
      </Sequence>

      <Sequence {...bE} name="2-E 消融④">
        {/* cue 3-4/4：mailslot-consume（唤醒回路→红侧读两遍）；隔两镜空窗 → 默认入场 */}
        <ArchifyRecap
          slug="mailslot-consume"
          caption="拆消费语义"
          cues={[
            {chapterId: 'wake', at: at('p2-16') - bE.from, durationInFrames: dur('p2-16')},
            {chapterId: 'b3', at: at('p2-17') - bE.from, durationInFrames: dur('p2-17')},
          ]}
        />
      </Sequence>

      <Sequence {...bF} name="2-F 官方对照">
        <OfficialCard />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2MailSlot;
