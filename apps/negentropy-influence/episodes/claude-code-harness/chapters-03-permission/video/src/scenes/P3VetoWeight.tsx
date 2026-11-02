/** P3 拒绝票更重（p3-01..p3-10，3 镜）——分镜 3-A / 3-B / 3-C（全片张力峰值）。
 *
 *  叙事链：实验 3 开关面板（「放行 > 硬拒绝」拨杆接线连向第一道门；三闸卡
 *  缩悬面板侧后、环体更深处）——开关闭合接线紫→红（权限改写）、sudo 卡
 *  〔2-E 同卡签名〕再次出发、第一道门形同虚设、卡直接落地（警示红落地帧）→
 *  轮次带 10/10 亮满、executed 计数 7→8（账面绿）→ deny_listed_executed
 *  计数 0→1 警示红跳变（重音镜）、第一道门卡灰化空心（名存实亡）→ 3-B 裁决
 *  不变式特写：投票装置亮起、摇头签自上沉压过整排点头签（重者在下压）、
 *  点头签齐亮→一方摇头全灭、计票器划掉退役、「一票否决」红章砸落定格 →
 *  3-C 左红右绿消融同屏：左轨实验 3 复现态（sudo 落地 1）→ 升级实验 4 三道
 *  门灰化拆除（拆解轨迹可见）→ 拦截/询问双计数同拍齐落 0、越界文件卡自轨
 *  外写入、问人门全程灰；右轨不变式在位全绿零越界 + 基线数字帧（十轮 · 拦 2
 *  · 问 2 · 越界 0）点亮（重音镜）→ 教训短签「无闸门 → 伤害显形」定格。
 *
 *  空间契约：幕间承接（2-E→3-A 判续不 morph）——sudo 卡以同卡签名回归（同形、
 *  同警示红描边、同 sudo 角标），弹回与再出发之间隔着实验开关操作，走幕界
 *  SceneFade + 镜间身份恒常。3-C 红左绿右恒定不互换（X-001）；双轨轮次同为
 *  10/10 且同步点亮；左轨按时序分相呈现（先实验 3 复现态、后升级实验 4，
 *  镜末四项数字不同屏混读）；计数与轮次数字=口播数字。
 *
 *  红线落实：词落位 = 句首 + 句长比例；计数 useCount 钳制（数据永不过冲）、
 *  数字必带基线标尺；deny 计数不提前跳变；拆除有拆解轨迹；y≥56 / bottom≥168。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CallCard, GateCard, GateChain, LoopRing, Panel, SceneTag, SwitchPanel, VoteBoard} from '../components/motifs';
import {DUR, clamp01, progress, useCount, useEnter, useImpulse, useProgress} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const Foot3: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 168,
      textAlign: 'center',
      fontFamily: theme.mono,
      fontSize: 22,
      color: theme.dim,
      opacity: 0.85,
    }}
  >
    {children}
  </div>
);

/** 计数位（带基线标尺——数字下恒常驻基线刻度与标签；useCount 钳制不过冲） */
const CountCell: React.FC<{label: string; value: number; color: string; base: string}> = ({label, value, color, base}) => (
  <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
    <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{label}</span>
    <span
      style={{
        fontFamily: theme.mono,
        fontSize: 54,
        fontWeight: 700,
        color,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}
    >
      {`${Math.round(value)}`}
    </span>
    {/* 基线标尺（底线 + 基准标签——Baseline-Anchored Counter） */}
    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
      <div style={{width: 150, height: 3, background: withAlpha(color, 0.75), borderRadius: 2}} />
      <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{base}</span>
    </div>
  </div>
);

/** 十格轮次带（同步点亮；轮次不退） */
const RoundBand: React.FC<{x: number; y: number; fill: number; accent: string; scale?: number}> = ({x, y, fill, accent, scale = 1}) => (
  <div style={{position: 'absolute', left: x, top: y, display: 'flex', gap: 7, transform: `scale(${scale})`, transformOrigin: 'left top'}}>
    {Array.from({length: 10}, (_, i) => {
      const on = clamp01(fill * 10 - i);
      return (
        <div
          key={i}
          style={{
            width: 44,
            height: 44,
            borderRadius: 7,
            border: `2px solid ${on > 0.5 ? accent : theme.panelBorder}`,
            background: on > 0.5 ? `${accent}22` : 'transparent',
            opacity: 0.55 + 0.45 * on,
          }}
        />
      );
    })}
  </div>
);

// ── 3-A 实验 3：开关闭合 + sudo 落地 + 双计数跳变 ────────────────────────

const ShotA: React.FC<{atPanel: number; atClose: number; atWire: number; atGo: number; atLand: number; atRounds: number; atExec: number; atDeny: number; atHollow: number}> = ({
  atPanel,
  atClose,
  atWire,
  atGo,
  atLand,
  atRounds,
  atExec,
  atDeny,
  atHollow,
}) => {
  const frame = useCurrentFrame();
  // 面板亮起 → 开关闭合（拨向 allow）→ 接线紫→红（权限改写）
  const lit = useProgress(atPanel, DUR.f4);
  const closed = useProgress(atClose, DUR.f4);
  const wireRed = useProgress(atWire, DUR.f4);
  const punch = useImpulse({at: atClose + DUR.f3, dur: DUR.f4, peak: 0.1});
  // sudo 卡（2-E 同签名）：候发位 → 出发 → 穿过形同虚设的门 → 直接落地
  // （路径走面板下缘之下——轨迹不穿开关面板）
  const goP = useProgress(atGo, DUR.f5, 'decelerate');
  const landP = useProgress(atLand, DUR.f3, 'accelerate');
  const sudoX = 280 + 560 * goP + 420 * landP;
  const sudoY = 340 + 130 * goP + 90 * landP;
  const landFlash = useImpulse({at: atLand + DUR.f3, dur: DUR.f5, peak: 1});
  // 第一道门形同虚设（sudo 穿门时灰化渐入）→「名存实亡」灰化空心
  const gateHollow = Math.max(clamp01(progress(frame, atGo + DUR.f4, DUR.f4)), clamp01(progress(frame, atHollow, DUR.f4)));
  // 轮次带 10/10 亮满；executed 7→8（账面绿）；deny_listed_executed 0→1（红）
  const rounds = useProgress(atRounds, DUR.f6, 'linear');
  const execN = 7 + useCount({from: 0, to: 1, at: atExec, dur: DUR.f4});
  const denyN = useCount({from: 0, to: 1, at: atDeny, dur: DUR.f4});
  const denyPulse = useImpulse({at: atDeny, dur: DUR.f5, peak: 1});
  return (
    <AbsoluteFill>
      <SceneTag chapter="Ablation 3" tagline="放行盖过硬拒绝" accent={theme.mech} />
      {/* 三闸卡缩悬面板侧后（同装置缩置 dim≥0.35；第一道门灰化空心=名存实亡） */}
      <div style={{position: 'absolute', left: 1330, top: 200, opacity: 0.9}}>
        <GateChain
          x={0}
          y={0}
          cardW={140}
          cardH={130}
          spacing={172}
          lit={[1, 1, 1]}
          ghost={[gateHollow, 0, 0]}
          dim={0.25}
          showNames={false}
        />
      </div>
      {/* 环体缩悬更深处（M-001 更深一档） */}
      <div style={{position: 'absolute', left: 1660, top: 620, opacity: 0.5}}>
        <LoopRing size={130} nodes={[0, 1, 2, 3, 4].map((i) => ({label: `s${i}`, angle: -90 + i * 72}))} showLabels={false} showExit={false} dimNodes />
      </div>
      {/* 开关面板（拨杆 allow > deny；接线连向第一道门） */}
      <div style={{opacity: lit}}>
        <SwitchPanel x={740} y={230} lit={1} closed={closed} wireRed={wireRed} punch={punch} />
      </div>
      {/* 接线延长段：开关 → 第一道门卡（颜色随改写同步） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none', opacity: lit}}>
        <path
          d="M 1160 290 C 1250 290, 1280 260, 1330 262"
          fill="none"
          stroke={wireRed > 0.5 ? theme.danger : theme.mech}
          strokeWidth={3.5}
          strokeDasharray="8 7"
        />
      </svg>
      {/* sudo 卡（同卡签名候发 → 出发 → 落地；警示红落地帧=横线+红光圈） */}
      <div style={{position: 'absolute', left: sudoX, top: sudoY, transform: 'translate(-50%,-50%)'}}>
        <div style={{transform: `scale(${1 + 0.06 * landFlash})`}}>
          <CallCard x={0} y={0} en="sudo …" w={220} h={76} accent={theme.danger} landed={landP} />
        </div>
      </div>
      {/* 落地冲击圈（警示红——命令已成事实） */}
      {landFlash > 0.01 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          <circle cx={1260} cy={560} r={20 + 60 * landFlash} fill="none" stroke={theme.danger} strokeWidth={4} opacity={landFlash} />
        </svg>
      ) : null}
      {/* 地面线（落地判据） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <line x1={1080} y1={600} x2={1450} y2={600} stroke={withAlpha(theme.danger, 0.45)} strokeWidth={3} strokeDasharray="8 8" />
      </svg>
      {/* 底部双计数位（executed · deny_listed_executed；数字必带基线标尺） */}
      <div style={{position: 'absolute', left: 560, top: 770, display: 'flex', gap: 130}}>
        <CountCell label="executed" value={execN} color={theme.ok} base="基线 7" />
        <CountCell label="deny_listed_executed" value={denyN} color={theme.danger} base="基线 0" />
      </div>
      {/* 十格轮次带（10/10 亮满——不退化） */}
      <RoundBand x={1230} y={845} fill={rounds} accent={theme.mech} scale={0.72} />
      <Foot3>{'实验 3 · allow > deny · 十轮实测'}</Foot3>
    </AbsoluteFill>
  );
};

// ── 3-B 裁决不变式：拒绝票更重 + 一票否决章 ─────────────────────────────

const ShotB: React.FC<{atLit: number; atPress: number; atNods: number; atKill: number; atRetire: number; atStamp: number}> = ({
  atLit,
  atPress,
  atNods,
  atKill,
  atRetire,
  atStamp,
}) => {
  const frame = useCurrentFrame();
  const lit = useProgress(atLit, DUR.f4);
  // 「比允许票重」：摇头签自上沉压过整排点头签（沉压 punch 后移贴重音字「重」）
  const press = useProgress(atPress, DUR.f4, 'accelerate');
  // 「多方点头才放行」点头签齐亮 →「一方摇头就拦下」点头全灭
  const nods = [0, 1, 2, 3, 4].map(() => clamp01(progress(frame, atNods, DUR.f4)));
  const kill = useProgress(atKill, DUR.f3);
  // 计票器划掉退役 → 红章砸落定格（重音镜）
  const retire = useProgress(atRetire, DUR.f4);
  const stamp = useProgress(atStamp, DUR.f4, 'accelerate');
  const stampPulse = useImpulse({at: atStamp + DUR.f4, dur: DUR.f5, peak: 1});
  return (
    <AbsoluteFill>
      <VoteBoard x={510} y={240} lit={lit} nods={nods} press={press} kill={kill} counterRetire={retire} stamp={stamp} />
      {/* 红章砸落冲击（定格一拍加重） */}
      {stampPulse > 0.01 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          <circle cx={960} cy={500} r={120 + 90 * stampPulse} fill="none" stroke={theme.danger} strokeWidth={4} opacity={stampPulse * 0.8} />
        </svg>
      ) : null}
      {/* 不变式铭牌（章下压轴——章为唯一落定元素） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 850,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          fontWeight: 600,
          color: theme.dim,
          opacity: lit,
        }}
      >
        {'多方点头才放行 · 一方摇头就拦下'}
      </div>
      <Foot3>{'裁决不变式 · deny > allow'}</Foot3>
    </AbsoluteFill>
  );
};

// ── 3-C 左红右绿消融同屏（张力峰值；红左绿右恒定） ───────────────────────

const ShotC: React.FC<{atRuin: number; atZero: number; atWrite: number; atGrey: number; atBase: number; atLesson: number}> = ({
  atRuin,
  atZero,
  atWrite,
  atGrey,
  atBase,
  atLesson,
}) => {
  const frame = useCurrentFrame();
  // 双轨轮次同步推进（同一 progress——两轨同为 10/10、同拍加一）
  const rounds = useProgress(DUR.f2, DUR.f6, 'linear');
  // 左轨时序分相：开帧=实验 3 复现态（sudo 落地 1）；p3-07「整个拆掉」升级实验 4
  // ——三道门灰化拆除（拆解轨迹可见：各卡错向滑出 + 残位虚线）
  const ruin = useProgress(atRuin, DUR.f5);
  const ruinPieces = useProgress(atRuin + DUR.f3, DUR.f5, 'accelerate');
  // 拦截/询问双计数器同拍齐落 0（同拍减——QA-10 双计数同拍演化）
  const zero = clamp01(progress(frame, atZero, DUR.f4));
  const blockN = 2 * (1 - zero);
  const askN = 2 * (1 - zero);
  // 越界文件卡自轨外区写入（outside_writes 警示红）+ 问人门灰置
  const write = useProgress(atWrite, DUR.f4, 'decelerate');
  const writeFlash = useImpulse({at: atWrite + DUR.f4, dur: DUR.f5, peak: 1});
  const greyAsk = useProgress(atGrey, DUR.f3);
  // 右轨基线数字帧（十轮 · 拦 2 · 问 2 · 越界 0——重音镜）
  // ⑨ QA W1：基线帧锚同时驱动左轨 sudo 落地卡退场（归档，消除同屏混读）
  const sudoFade = useProgress(atBase, DUR.f4);
  const baseRows = [0, 1, 2, 3].map((i) => clamp01(progress(frame, atBase + i * 5, DUR.f4)));
  const baseGlow = useImpulse({at: atBase + DUR.f4, dur: DUR.f5, peak: 1});
  // 教训短签定格
  const lesson = useProgress(atLesson, DUR.f4);
  const lessonPulse = useImpulse({at: atLesson + DUR.f3, dur: DUR.f5, peak: 0.06});
  const BASE_FRAME = [
    {k: '十轮', v: '10'},
    {k: '被拦', v: '2'},
    {k: '待问', v: '2'},
    {k: '越界', v: '0'},
  ] as const;
  return (
    <AbsoluteFill>
      {/* ── 左轨：拔掉闸门（警示红——反例）── */}
      <div style={{position: 'absolute', left: 100, top: 150}}>
        <Panel accent={theme.danger} style={{display: 'inline-flex', alignItems: 'center', gap: 12, padding: '8px 18px'}}>
          <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.danger}}>{'拔掉闸门'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'实验 4'}</span>
        </Panel>
      </div>
      {/* 左轨三道门（实验 3 复现态在位 → 灰化拆除：错向滑出+残位虚线留位） */}
      <div style={{position: 'absolute', left: 130, top: 280}}>
        {(['deny', 'rule', 'ask'] as const).map((k, i) => {
          const dx = [-160, 0, 180][i] * ruinPieces;
          const dy = [60, 210, 40][i] * ruinPieces;
          const rot = [-14, 0, 18][i] * ruinPieces;
          const ghost = k === 'ask' ? Math.max(ruin, greyAsk) : ruin;
          return (
            <div
              key={k}
              style={{
                position: 'absolute',
                left: i * 152 + dx,
                top: dy,
                transform: `rotate(${rot}deg)`,
                opacity: 1 - ruinPieces * 0.7,
              }}
            >
              <GateCard x={0} y={0} w={132} h={122} kind={k} lit={1} ghost={ghost} showName={false} />
            </div>
          );
        })}
        {/* 残位虚线（拆解轨迹的终点——位还在、门没了） */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: i * 152,
              top: 0,
              width: 132,
              height: 122,
              borderRadius: 12,
              border: `2px dashed ${theme.panelBorder}`,
              opacity: ruinPieces * 0.9,
            }}
          />
        ))}
      </div>
      {/* 左轨 sudo 落地帧（实验 3 复现态——落地 1 承 3-A 口播锚）。
          ⑨ QA W1：atBase（基线帧）时退场淡出归档（残位虚线留痕），镜末左轨
          只剩实验 4 终态——与右轨四项基线数字不再同屏混读（原同屏约 6s） */}
      <div style={{position: 'absolute', left: 680, top: 310, opacity: 0.92 * (1 - sudoFade)}}>
        <CallCard x={0} y={0} en="sudo …" w={190} h={64} accent={theme.danger} landed={1} />
      </div>
      {/* sudo 落地残位虚线（归档留痕——实验 3 证据位，不与数字混读） */}
      <div
        style={{
          position: 'absolute',
          left: 680,
          top: 310,
          width: 190,
          height: 64,
          borderRadius: 11,
          border: `2px dashed ${theme.panelBorder}`,
          opacity: sudoFade * 0.8,
        }}
      />
      {/* 左轨双计数器（拦截/询问同拍齐落 0——数字带基线标尺） */}
      <div style={{position: 'absolute', left: 130, top: 480, display: 'flex', gap: 110}}>
        <CountCell label="拦截" value={blockN} color={theme.danger} base="基线 2" />
        <CountCell label="询问" value={askN} color={theme.danger} base="基线 2" />
      </div>
      {/* 越界文件卡（自轨外区写入——outside_writes 警示红；+1） */}
      <div style={{position: 'absolute', left: -220 + 650 * write, top: 660, opacity: clamp01(write * 1.5)}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 18px',
            borderRadius: 10,
            border: `2.5px solid ${theme.danger}`,
            background: withAlpha(theme.danger, 0.12),
            boxShadow: `0 0 ${26 * writeFlash}px ${withAlpha(theme.danger, 0.7)}`,
            whiteSpace: 'nowrap',
          }}
        >
          <svg width={30} height={36} viewBox="0 0 30 36">
            <path d="M4 3 L20 3 L26 10 L26 33 L4 33 Z" fill={theme.panel} stroke={theme.danger} strokeWidth={2.5} strokeLinejoin="round" />
          </svg>
          <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.danger}}>{'outside_writes'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 20, fontWeight: 700, color: theme.danger, fontVariantNumeric: 'tabular-nums'}}>
            {`+${Math.round(1 * write)}`}
          </span>
        </div>
      </div>
      {/* 左轨轮次带（10/10——与右轨同一 fill 同拍） */}
      <RoundBand x={130} y={852} fill={rounds} accent={theme.danger} scale={0.66} />
      {/* ── 右轨：不变式在位（确认绿——闸链在位全绿零越界；无任何退化）── */}
      <div style={{position: 'absolute', left: 1030, top: 150}}>
        <Panel accent={theme.ok} style={{display: 'inline-flex', alignItems: 'center', gap: 12, padding: '8px 18px'}}>
          <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.ok}}>{'不变式在位'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'deny > allow'}</span>
        </Panel>
      </div>
      {/* 右轨闸链在位（三卡全带绿痕——机制在位/拦截成功的常驻态） */}
      <div style={{position: 'absolute', left: 1120, top: 280}}>
        <GateChain x={0} y={0} cardW={132} cardH={122} spacing={166} lit={[1, 1, 1]} pass={[1, 1, 1]} showNames={false} dim={0.1} />
      </div>
      {/* 右轨基线数字帧（十轮 · 拦 2 · 问 2 · 越界 0——重音镜、逐行点亮） */}
      <div style={{position: 'absolute', left: 1030, top: 470, opacity: 0.95}}>
        <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginBottom: 12}}>{'基线 · baseline'}</div>
        {BASE_FRAME.map((row, i) => (
          <div key={row.k} style={{display: 'flex', alignItems: 'baseline', gap: 16, height: 46, opacity: baseRows[i]}}>
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, width: 110}}>{row.k}</span>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 46,
                fontWeight: 700,
                color: row.v === '0' ? theme.ok : theme.text,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
                textShadow: i === 3 ? `0 0 ${18 * baseGlow}px ${withAlpha(theme.ok, 0.8)}` : 'none',
              }}
            >
              {row.v}
            </span>
          </div>
        ))}
        <div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, opacity: baseRows[3]}}>
          <div style={{width: 430, height: 3, background: withAlpha(theme.ok, 0.7), borderRadius: 2}} />
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'十轮实测'}</span>
        </div>
      </div>
      {/* 右轨轮次带（与左轨同一 fill——同步演化） */}
      <RoundBand x={1030} y={852} fill={rounds} accent={theme.ok} scale={0.66} />
      {/* 教训短签（定格仪式——承 ep1/ep2 教训短签形态；与口播非逐字） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 728,
          display: 'flex',
          justifyContent: 'center',
          opacity: lesson * 0.97,
          pointerEvents: 'none',
        }}
      >
        <Panel accent={theme.danger} style={{padding: '24px 44px', background: theme.bg, transform: `scale(${1 + lessonPulse})`}}>
          <span style={{fontFamily: theme.serif, fontSize: 48, fontWeight: 700, color: theme.danger}}>{'无闸门 → 伤害显形'}</span>
        </Panel>
      </div>
      <Foot3>{'实验 4 · 拆掉三道门 ↔ 在位基线'}</Foot3>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P3VetoWeight: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p3-01', 'p3-04');
  const bB = w('p3-05', 'p3-06');
  const bC = w('p3-07', 'p3-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <ShotA
          atPanel={wa('p3-01', 0.28) - bA.from}
          atClose={wa('p3-01', 0.62) - bA.from}
          atWire={wa('p3-01', 0.78) - bA.from}
          atGo={wa('p3-02', 0.32) - bA.from}
          atLand={wa('p3-02', 0.72) - bA.from}
          atRounds={wa('p3-03', 0.22) - bA.from}
          atExec={wa('p3-03', 0.66) - bA.from}
          atDeny={wa('p3-04', 0.3) - bA.from}
          atHollow={wa('p3-04', 0.72) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="3-B">
        <ShotB
          atLit={wa('p3-05', 0.3) - bB.from}
          atPress={wa('p3-05', 0.68) - bB.from}
          atNods={wa('p3-06', 0.22) - bB.from}
          atKill={wa('p3-06', 0.48) - bB.from}
          atRetire={wa('p3-06', 0.7) - bB.from}
          atStamp={wa('p3-06', 0.85) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="3-C">
        <ShotC
          atRuin={wa('p3-07', 0.5) - bC.from}
          atZero={wa('p3-08', 0.28) - bC.from}
          atWrite={wa('p3-08', 0.58) - bC.from}
          atGrey={wa('p3-08', 0.85) - bC.from}
          atBase={wa('p3-09', 0.35) - bC.from}
          atLesson={wa('p3-10', 0.45) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3VetoWeight;
