/** P4 磁盘不等于活着（p4-01..15，5 镜 5 cue）——分镜 4-A…4-E。
 *
 *  ★ cue 清单（archify full 全屏独占，画框 top150/底880）：
 *    · 4-A disk-not-alive  `two-lives`     @p4-01（dur p4-01+02+03）
 *    · 4-B disk-not-alive  `shutdown`      @p4-05（dur p4-05）
 *                         `restore`        @p4-06（dur p4-06+07）——单实例两 cue
 *                          帧窗相接，实例内背靠背由 ArchifyRecap 自动抑制换章弹入
 *    · 4-D disk-not-alive  `escape-routes` @p4-11（dur p4-11+12）
 *    · 4-E cron-four-layers `durable-side` @p4-13（dur p4-13+14）
 *  ★ lead 判定（跨实例不传 lead={false} 的依据）：4-A 实例末 cue 窗止于 p4-03
 *    末帧，4-B 首 cue 起于 p4-05 首帧，中隔 p4-04 整句（TTS 实测句窗 ≥60 帧，
 *    ≫ ArchifyRecap 的 2 帧背靠背容差）⇒ 非紧邻 ⇒ 默认 lead；4-D 与 4-B 同 slug
 *    但隔 4-C 整镜（3 句）⇒ 默认 lead；4-E 换图且与 P3 末实例隔整幕（SceneFade
 *    交叉淡化）⇒ 默认 lead。
 *  ★ 空窗回落（native 件，零 Lottie 全 svg/CSS）：
 *    · p4-04 两档旋钮件——左磁盘文件（文件名小字 .scheduled_tasks.json）/右
 *      内存条/中间旋钮两档各拧一次、两侧图标随档位明暗；末段「进程」虚线框
 *      包住旋钮+内存、磁盘留框外，为 4-B「进程关了磁盘还在」预铺空间语义。
 *    · 4-C 官方边界三行卡——逐行浮现、四例外 chip 错峰、「不执行」deny 红下划线。
 *    · p4-15 双开发线彩蛋——A 灯 core 亮/B 灯灭同拍切换＋「两边相反」accent
 *      标签，末段推镜转场入 P5 实验室。
 *  ★ 4-B（卷帘门下落＝进程关、钟指针停摆〔M-003〕、重开门补触发）与 4-D
 *    （三联窗云例程/桌面端/仓库自动化＋三档取舍表勾叉逐格落定）的画面由
 *    disk-not-alive 的 shutdown/restore/escape-routes 章承载——两镜句窗被
 *    cue 全覆盖、无空窗句，native 侧不重复绘制（archify 全屏独占契约）。
 *  ★ 色彩纪律：磁盘持久=text 白（微光恒定呼吸〔M-003 持续态——「磁盘介质
 *    永在」的持续陈述〕）；内存会话=mech 蓝（本集时机色，熄灭走透明度）；
 *    A 线流水线灯=core 橙（循环内核恒定语义）；「不执行」下划线=deny（拒绝/
 *    危险唯一语义）；「两边相反」=accent 金（强调）。
 *  空间契约：本幕自有内容 y≥130 起（顶带 y<56 让给 ChapterProgress/HarnessBadge
 *  常驻装置），底缘 ≤920（字幕安全带）；SceneTag 用组件默认 top:64（本集左置）。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {
  DUR,
  clamp01,
  useBreathe,
  useEnter,
  useImpulse,
  useProgress,
  usePushIn,
  useStagger,
} from '../motion';

/** theme 色 + α（hex 后缀形态）：改值不漂移、撞色登记口径可清点（系列同款工具） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 4-A p4-04 空窗回落：两档旋钮（磁盘 ↔ 内存） ─────────────────────────

/** 磁盘文件图标（持久任务）：折角文件＋体内文件名小字。lit 只控内容亮度，
 *  外层微光恒定呼吸（〔M-003〕持续态，不随档位熄灭——磁盘介质永在）。 */
const DiskFile: React.FC<{lit: number; glow: number}> = ({lit, glow}) => {
  const edge = withAlpha(theme.text, 0.35 + 0.65 * lit);
  return (
    <div
      style={{
        position: 'absolute',
        left: 430,
        top: 390,
        borderRadius: 10,
        boxShadow: `0 0 ${14 + 20 * glow}px ${withAlpha(theme.text, 0.1 + 0.16 * glow)}`,
      }}
    >
      <svg width={170} height={210}>
        <path
          d="M18 12 H104 L152 60 V198 H18 Z"
          fill={theme.panel}
          stroke={edge}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <path d="M104 12 V60 H152" fill="none" stroke={edge} strokeWidth={4} strokeLinejoin="round" />
        <text
          x={85}
          y={130}
          textAnchor="middle"
          fontFamily={theme.mono}
          fontSize={15}
          fill={withAlpha(theme.text, lit)}
        >
          {'.scheduled_'}
        </text>
        <text
          x={85}
          y={154}
          textAnchor="middle"
          fontFamily={theme.mono}
          fontSize={15}
          fill={withAlpha(theme.text, lit)}
        >
          {'tasks.json'}
        </text>
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 218,
          width: 170,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 23,
          color: theme.dim,
        }}
      >
        {'持久任务'}
      </div>
    </div>
  );
};

/** 内存条图标（会话任务）：PCB 板＋八格＋金手指；lit 0..1 经 mech 透明度连续点亮。 */
const RamStick: React.FC<{lit: number}> = ({lit}) => (
  <div style={{position: 'absolute', left: 1290, top: 460}}>
    <svg width={230} height={110}>
      <rect
        x={6}
        y={6}
        width={218}
        height={62}
        rx={6}
        fill={theme.panel}
        stroke={theme.panelBorder}
        strokeWidth={4}
      />
      {Array.from({length: 8}, (_, i) => (
        <rect
          key={i}
          x={18 + i * 26}
          y={18}
          width={18}
          height={38}
          rx={2}
          fill={withAlpha(theme.mech, 0.12 + 0.5 * lit * (0.6 + 0.4 * ((i % 3) / 2)))}
          stroke={theme.panelBorder}
          strokeWidth={1.5}
        />
      ))}
      {Array.from({length: 8}, (_, i) => (
        <rect key={`f${i}`} x={20 + i * 26} y={74} width={16} height={24} rx={2} fill={theme.panelBorder} />
      ))}
    </svg>
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 118,
        width: 230,
        textAlign: 'center',
        fontFamily: theme.sans,
        fontSize: 23,
        color: theme.dim,
      }}
    >
      {'会话任务'}
    </div>
  </div>
);

/** 两档旋钮：指针 0°（居中）→ -46°（存盘）→ +46°（内存），档位点点亮。 */
const DialKnob: React.FC<{deg: number; onLeft: boolean; onRight: boolean}> = ({deg, onLeft, onRight}) => (
  <svg width={220} height={220} style={{position: 'absolute', left: 850, top: 400}}>
    <circle cx={110} cy={110} r={80} fill={theme.panel} stroke={withAlpha(theme.mech, 0.85)} strokeWidth={6} />
    <circle
      cx={70}
      cy={71}
      r={7}
      fill={onLeft ? withAlpha(theme.mech, 0.95) : 'transparent'}
      stroke={theme.panelBorder}
      strokeWidth={2}
    />
    <circle
      cx={150}
      cy={71}
      r={7}
      fill={onRight ? withAlpha(theme.mech, 0.95) : 'transparent'}
      stroke={theme.panelBorder}
      strokeWidth={2}
    />
    <g transform={`rotate(${deg} 110 110)`}>
      <line x1={110} y1={110} x2={110} y2={40} stroke={theme.text} strokeWidth={7} strokeLinecap="round" />
    </g>
    <circle cx={110} cy={110} r={13} fill={theme.panel} stroke={theme.text} strokeWidth={4} />
  </svg>
);

/** p4-04 空窗件：两档各拧一次 → 「进程」虚线框收束（调度器+内存入框、磁盘在外）。 */
const DialTwoLives: React.FC<{span: number}> = ({span}) => {
  const inAll = useEnter('fade', {at: 2, dur: DUR.f5});
  // 拧档/框线均为一次性推进（useProgress），锚点串行防两档行程交叠
  const aDial1 = 2 + DUR.f5 + Math.round(span * 0.06);
  const aDial2 = aDial1 + DUR.f5 + Math.round(span * 0.12);
  const aProc = aDial2 + DUR.f5 + Math.round(span * 0.1);
  const dial1 = useProgress(aDial1, DUR.f5, 'decelerate');
  const dial2 = useProgress(aDial2, DUR.f5, 'decelerate');
  const procP = useProgress(aProc, DUR.f5);
  // 磁盘微光恒定呼吸〔M-003〕——不乘档位亮度（持续陈述配持续态）
  const glow = useBreathe({period: 55, amp: 0.16, base: 0.34});
  const deg = -46 * dial1 + 92 * dial2;
  const diskLit = 0.3 + 0.7 * dial1 * (1 - dial2);
  const memLit = dial2;
  const lineL = dial1 * (1 - dial2);
  const lineR = dial2;

  return (
    <AbsoluteFill style={{...inAll}}>
      {/* 连线：旋钮 → 磁盘 / 旋钮 → 内存（当前档实、对侧虚） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <line
          x1={872}
          y1={505}
          x2={612}
          y2={495}
          stroke={withAlpha(theme.text, 0.12 + 0.68 * lineL)}
          strokeWidth={3.5}
          strokeDasharray={lineL > 0.5 ? undefined : '8 8'}
        />
        <line
          x1={1048}
          y1={505}
          x2={1278}
          y2={495}
          stroke={withAlpha(theme.mech, 0.12 + 0.72 * lineR)}
          strokeWidth={3.5}
          strokeDasharray={lineR > 0.5 ? undefined : '8 8'}
        />
      </svg>

      <DiskFile lit={diskLit} glow={glow} />
      <RamStick lit={memLit} />
      <DialKnob deg={deg} onLeft={dial1 > 0.5 && dial2 < 0.5} onRight={dial2 > 0.5} />

      {/* 档位小字：激活档 text、另一档 dim */}
      <div
        style={{
          position: 'absolute',
          left: 890,
          top: 648,
          width: 60,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 22,
          color: dial1 > 0.5 && dial2 < 0.5 ? theme.text : theme.dim,
        }}
      >
        {'存盘'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 970,
          top: 648,
          width: 60,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 22,
          color: dial2 > 0.5 ? theme.text : theme.dim,
        }}
      >
        {'内存'}
      </div>

      {/* 进程虚线框（p4-04「调度器活在这个程序自己的进程里」）：包旋钮+内存，磁盘留框外 */}
      <div
        style={{
          position: 'absolute',
          left: 805,
          top: 355,
          width: 760,
          height: 330,
          border: `3px dashed ${theme.panelBorder}`,
          borderRadius: 18,
          opacity: procP,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 18,
            top: -14,
            padding: '0 12px',
            background: theme.bg,
            fontFamily: theme.mono,
            fontSize: 19,
            color: theme.dim,
          }}
        >
          {'进程'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C 官方边界三行卡（p4-08..10，native 镜） ──────────────────────────

/** 恢复四例外 chip（storyboard 4-C 行 2 指定的四个名词） */
const RESUME_EXCEPTIONS = ['自定节奏', '后台', '过期', '错过'] as const;

const OfficialBoundaryCard: React.FC<{atDefault: number; atExcept: number; atCopy: number}> = ({
  atDefault,
  atExcept,
  atCopy,
}) => {
  const head = useEnter('fade', {at: 2, dur: DUR.f5});
  const r1 = useEnter('rise', {at: atDefault, dur: DUR.f5, dist: 22});
  const r2 = useEnter('rise', {at: atExcept, dur: DUR.f5, dist: 22});
  const r3 = useEnter('rise', {at: atCopy, dur: DUR.f5, dist: 22});
  // 四例外 chip 错峰（行 2 内）
  const chips = useStagger(RESUME_EXCEPTIONS.length, {at: atExcept + 6, stride: 6, dur: DUR.f4});
  // 「不执行」deny 红下划线：宽度一次性推进
  const strike = useProgress(atCopy + 8, DUR.f5, 'decelerate');

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 420, top: 250, width: 1080, opacity: head.opacity}}>
        <Panel style={{padding: '26px 36px'}}>
          {/* 头行：角标（storyboard 4-C 角标列） */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              paddingBottom: 14,
              borderBottom: `2px solid ${theme.panelBorder}`,
            }}
          >
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 20,
                color: theme.dim,
                border: `2px solid ${theme.dim}`,
                borderRadius: 6,
                padding: '3px 10px',
              }}
            >
              {'--resume'}
            </span>
            <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.8}}>
              {'.claude/scheduled_tasks.json'}
            </span>
          </div>

          {/* 行 1（p4-08）：会话默认 · 关终端即停 */}
          <div style={{...r1, display: 'flex', alignItems: 'baseline', gap: 18, padding: '20px 4px 14px'}}>
            <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'01'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 33, fontWeight: 600, color: theme.text}}>
              {'关终端 · 即停'}
            </span>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 18,
                color: theme.dim,
                marginLeft: 'auto',
                opacity: 0.75,
              }}
            >
              {'session default'}
            </span>
          </div>

          {/* 行 2（p4-09）：恢复四例外 chip 错峰 */}
          <div style={{...r2, padding: '14px 4px 12px', borderTop: `2px solid ${theme.panelBorder}`}}>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 18}}>
              <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'02'}</span>
              <span style={{fontFamily: theme.sans, fontSize: 33, fontWeight: 600, color: theme.text}}>
                {'恢复 · 四例外'}
              </span>
            </div>
            <div style={{display: 'flex', gap: 12, marginTop: 12, paddingLeft: 42}}>
              {RESUME_EXCEPTIONS.map((e, i) => (
                <span
                  key={e}
                  style={{
                    fontFamily: theme.sans,
                    fontSize: 22,
                    color: theme.mech,
                    border: `2px solid ${theme.mech}`,
                    borderRadius: 999,
                    padding: '4px 14px',
                    opacity: chips[i],
                    transform: `translateY(${(1 - chips[i]) * 12}px)`,
                  }}
                >
                  {e}
                </span>
              ))}
            </div>
          </div>

          {/* 行 3（p4-10）：复制到别处只列出 · 不执行（deny 下划线） */}
          <div
            style={{
              ...r3,
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
              padding: '18px 4px 6px',
              borderTop: `2px solid ${theme.panelBorder}`,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'03'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 33, fontWeight: 600, color: theme.text}}>
              {'复制到别处 · 只列出'}
            </span>
            <span
              style={{
                position: 'relative',
                fontFamily: theme.sans,
                fontSize: 33,
                fontWeight: 700,
                color: theme.deny,
              }}
            >
              {'不执行'}
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: -6,
                  height: 4,
                  width: `${Math.round(strike * 100)}%`,
                  background: theme.deny,
                  borderRadius: 2,
                }}
              />
            </span>
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 4-E p4-15 空窗回落：双开发线彩蛋＋推镜转场 ───────────────────────────

/** 单侧开发线卡：灯（指示灯）＋主字；A 线灯 core 亮、B 线灯恒灭。 */
const DevLineCard: React.FC<{
  side: 'A' | 'B';
  title: string;
  main: string;
  sub: string;
  enter: {opacity: number; transform: string};
  lit: number;
  flash: number;
  dim: number;
}> = ({side, title, main, sub, enter, lit, flash, dim}) => (
  <div
    style={{
      position: 'absolute',
      left: side === 'A' ? 250 : 1130,
      top: 360,
      width: 540,
      opacity: enter.opacity * (1 - 0.3 * dim),
      transform: enter.transform,
    }}
  >
    <Panel accent={theme.panelBorder} style={{boxSizing: 'border-box', padding: '24px 30px'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 19,
            color: theme.dim,
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 6,
            padding: '2px 10px',
          }}
        >
          {title}
        </span>
        {/* 指示灯：A=core 填充+辉光（亮），B=空心恒灭 */}
        <div
          style={{
            marginLeft: 'auto',
            width: 34,
            height: 34,
            borderRadius: 999,
            background: side === 'A' ? withAlpha(theme.core, lit) : 'transparent',
            border: `3px solid ${side === 'A' ? withAlpha(theme.core, 0.4 + 0.6 * lit) : theme.panelBorder}`,
            boxShadow:
              side === 'A' && lit > 0.02
                ? `0 0 ${14 + 30 * flash}px ${withAlpha(theme.core, 0.5)}`
                : 'none',
          }}
        />
      </div>
      <div
        style={{
          marginTop: 20,
          fontFamily: theme.sans,
          fontSize: 38,
          fontWeight: 700,
          color: side === 'A' ? theme.text : theme.dim,
        }}
      >
        {main}
      </div>
      <div style={{marginTop: 12, fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {sub}
      </div>
    </Panel>
  </div>
);

const TwoDevLines: React.FC<{span: number}> = ({span}) => {
  const eA = useEnter('slideL', {at: 2, dur: DUR.f5, dist: 70});
  const eB = useEnter('slideR', {at: 2, dur: DUR.f5, dist: 70});
  // A 亮 / B 压暗同拍（同一 aLamp 锚）；标签与推镜串行其后
  const aLamp = 2 + DUR.f5 + Math.round(span * 0.16);
  const aTag = aLamp + DUR.f4 + Math.round(span * 0.08);
  const aPush = aTag + DUR.f5 + Math.round(span * 0.06);
  const lit = useProgress(aLamp, DUR.f4);
  const flash = useImpulse({at: aLamp, dur: DUR.f5, peak: 1});
  const bDim = useProgress(aLamp, DUR.f5);
  const tagIn = useProgress(aTag, DUR.f5);
  const push = usePushIn(aPush, {scale: 0.06, dur: DUR.f6});

  return (
    <AbsoluteFill style={{transform: push, transformOrigin: '50% 52%'}}>
      <DevLineCard
        side="A"
        title="A · 教学版"
        main="导入 · 流水线起"
        sub="import → pipeline"
        enter={eA}
        lit={lit}
        flash={flash}
        dim={0}
      />
      <DevLineCard
        side="B"
        title="B · 另一条线"
        main="导入 · 不起"
        sub="import → nothing"
        enter={eB}
        lit={0}
        flash={0}
        dim={bDim}
      />
      {/* 中缝标签：两边相反（accent 金 · 强调语义） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 432,
          width: 1920,
          textAlign: 'center',
          opacity: tagIn,
          transform: `scale(${0.9 + 0.1 * tagIn})`,
        }}
      >
        <span style={{fontFamily: theme.serif, fontSize: 36, fontWeight: 700, color: theme.accent}}>
          {'两边相反'}
        </span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 700,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 21,
          color: theme.dim,
          opacity: tagIn * 0.85,
        }}
      >
        {'same project · two import paths'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P4DiskNotAlive: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（某句起始帧）；dur() = 与 at 对称的单句取长（cue 窗落在同一句 id 上）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p4-01', 'p4-04');
  const bB = w('p4-05', 'p4-07');
  const bC = w('p4-08', 'p4-10');
  const bD = w('p4-11', 'p4-12');
  const bE = w('p4-13', 'p4-15');

  return (
    <AbsoluteFill>
      {/* 本集 SceneTag 左置 top:64 ⇒ 常驻系列条保持组件默认顶边位（y12–48）；
          勿仿他集传 top:64——那会正压 SceneTag。幕自有内容一律 y≥56 起。 */}
      <HarnessBadge />

      <Sequence {...bA} name="4-A 两档旋钮">
        <SceneTag chapter="durable" tagline="两档旋钮" />
        {/* P4 首个 archify 实例（与 P3 末实例隔幕间淡化）⇒ 默认 lead */}
        <ArchifyRecap
          slug="disk-not-alive"
          caption="磁盘与活着"
          cues={[
            {
              chapterId: 'two-lives',
              at: at('p4-01') - bA.from,
              durationInFrames: dur('p4-01') + dur('p4-02') + dur('p4-03'),
            },
          ]}
        />
        <Sequence from={at('p4-04') - bA.from} durationInFrames={dur('p4-04')} name="4-A 旋钮回落">
          <DialTwoLives span={dur('p4-04')} />
        </Sequence>
        <Footnote delay={at('p4-04') - bA.from}>{'.scheduled_tasks.json · durable'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="4-B 进程边界">
        {/* 跨实例 lead 判定见头注释（隔 p4-04 整句 ⇒ 默认 lead）；shutdown→restore
            实例内背靠背，换章弹入由 ArchifyRecap 自动抑制 */}
        <ArchifyRecap
          slug="disk-not-alive"
          caption="磁盘与活着"
          cues={[
            {chapterId: 'shutdown', at: at('p4-05') - bB.from, durationInFrames: dur('p4-05')},
            {chapterId: 'restore', at: at('p4-06') - bB.from, durationInFrames: dur('p4-06') + dur('p4-07')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="4-C 官方边界">
        <SceneTag chapter="durable" tagline="官方边界" />
        <OfficialBoundaryCard
          atDefault={at('p4-08') - bC.from}
          atExcept={at('p4-09') - bC.from}
          atCopy={at('p4-10') - bC.from}
        />
        <Footnote delay={2}>{'--resume · .claude/scheduled_tasks.json'}</Footnote>
      </Sequence>

      <Sequence {...bD} name="4-D 三条出路">
        {/* 同 slug 隔 4-C 整镜 ⇒ 默认 lead；三联窗+取舍表由 escape-routes 章承载 */}
        <ArchifyRecap
          slug="disk-not-alive"
          caption="磁盘与活着"
          cues={[
            {
              chapterId: 'escape-routes',
              at: at('p4-11') - bD.from,
              durationInFrames: dur('p4-11') + dur('p4-12'),
            },
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="4-E 彩蛋对比">
        {/* 换图（cron-four-layers）且与 P3 末实例隔整幕 ⇒ 默认 lead */}
        <ArchifyRecap
          slug="cron-four-layers"
          caption="四层钟"
          cues={[
            {
              chapterId: 'durable-side',
              at: at('p4-13') - bE.from,
              durationInFrames: dur('p4-13') + dur('p4-14'),
            },
          ]}
        />
        <Sequence from={at('p4-15') - bE.from} durationInFrames={dur('p4-15')} name="4-E 双线彩蛋">
          <TwoDevLines span={dur('p4-15')} />
        </Sequence>
        <Footnote delay={at('p4-15') - bE.from}>{'import → pipeline · 两线相反'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4DiskNotAlive;
