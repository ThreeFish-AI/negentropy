/** P4 生产版：分级判案（p4-01..p4-10，4 镜）——分镜 4-A / 4-B / 4-C / 4-D。
 *
 *  叙事链：拉远全景重锚（自 P3 峰值降压 @pushIn 负增量）——生产裁决面板纵深：
 *  四格答案卡横列（PermissionResult · allow/deny/ask/passthrough）、右缘八层
 *  规则来源层叠（8 rule sources，顶层「用户设置」）、环体缩悬执行区深处 →
 *  三格齐亮一拍、第四格「不表态」亮起 + 短接细线交常规流、八层 stagger 展开、
 *  顶层下压其下依次压暗一档 → 4-B 分级判案机器：「问人」闸卡（承 1-D 同形）
 *  打开、内部四级子链铺成（acceptEdits → 白名单 → 安全分类器 → 回退人工）、
 *  一枚文件改动调用依次过级（mini 走查：单一输入穿四级）、第四级触发一拍、
 *  链末判决卡特写理由栏空白划斜线（判案机器类比的失配边界）→ 4-C 认危险
 *  命令三步走时间轴：字符串表（自标裂纹）→ model 词卡「del」子串误亮警示红
 *  （误伤具象）→ 词边界框只框整词、model 放行绿 → 第三站分类器徽记判定 →
 *  4-D 六模式卡横排、「跳过询问」卡抽出前置 + 隔离容器罩壳合拢扣住 + 警示
 *  描边（重音镜——官方警告原文进角标）。
 *
 *  空间契约：幕间转场（3-C→4-A）语义断裂走 SceneFade + 拉远重锚；闸门链以
 *  裁决紫描边签名回归（四格=闸链成年态）；子链闸卡属问人环内部（与三道闸卡
 *  同拱形语言、小一号，不混淆）。4-C 三站次序=演进时间序、误伤只发生在第
 *  一站；4-D 六卡等高、被抽出卡带罩壳、警告原文只在角标。
 *
 *  红线落实：词落位 = 句首 + 句长比例；四格不一次全亮；层叠压覆方向恒上→下；
 *  短接细线不接执行区（语义是常规流程非放行）；分类器节点不给理由文字；
 *  y≥56 / bottom≥168。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CallCard, GateCard, LoopRing, Panel, SceneTag, TribunalChain, VerdictPanel} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useImpulse, useProgress, usePushIn, useSpring} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const Foot4: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 168,
      textAlign: 'center',
      fontFamily: theme.mono,
      fontSize: 21,
      color: theme.dim,
      opacity: 0.85,
    }}
  >
    {children}
  </div>
);

// ── 4-A 拉远全景：生产裁决面板（四格 + 八层来源） ────────────────────────

const ShotA: React.FC<{atPanel: number; atThree: number; atFourth: number; atLink: number; atStack: number; atPress: number}> = ({
  atPanel,
  atThree,
  atFourth,
  atLink,
  atStack,
  atPress,
}) => {
  // @pushIn 负增量：自 P3 峰值拉远降压、重锚生产全景
  const push = usePushIn(0, {scale: -0.06, dur: DUR.f6});
  const frame = useCurrentFrame();
  const frameLit = useProgress(atPanel, DUR.f5);
  // 三格齐亮一拍 → 第四格亮起 → 短接细线
  const three = useProgress(atThree, DUR.f3);
  const lit = [three, three, three, useProgress(atFourth, DUR.f3)];
  const link = useProgress(atLink, DUR.f4, 'decelerate');
  // 八层 stagger 展开（0..8）→ 顶层下压、其下依次压暗一档
  const stackLit = clamp01(progress(frame, atStack, DUR.f5 + 7 * 4)) * 8;
  const press = useProgress(atPress, DUR.f4);
  return (
    <AbsoluteFill style={{transform: push}}>
      <SceneTag chapter="Production" tagline="生产版 · 分级判案" accent={theme.mech} />
      <VerdictPanel x={210} y={240} frameLit={frameLit} lit={lit} link={link} stackLit={stackLit} press={press} />
      {/* 环体缩悬执行区深处（M-001；教学版位置示意——底缘守住字幕安全带） */}
      <div style={{position: 'absolute', left: 170, top: 780, opacity: 0.5}}>
        <LoopRing size={120} nodes={[0, 1, 2, 3, 4].map((i) => ({label: `s${i}`, angle: -90 + i * 72}))} showLabels={false} showExit={false} dimNodes />
      </div>
      <Foot4>{'PermissionResult · 8 rule sources'}</Foot4>
    </AbsoluteFill>
  );
};

// ── 4-B 分级判案机器：问人环内部四级子链 + 判决卡 ────────────────────────

const ShotB: React.FC<{atOpen: number; atStep: number; atTrip: number; atVerdict: number}> = ({atOpen, atStep, atTrip, atVerdict}) => {
  const frame = useCurrentFrame();
  // 「问人」闸卡（承 1-D 同形）打开：卡面旋开 + 子链铺成
  const open = useProgress(atOpen, DUR.f5);
  const doorRot = -18 * (1 - open);
  // 调用过级：step 0..4 线性推进（单一输入穿四级——mini 走查）
  const step = clamp01(progress(frame, atStep, DUR.f6 + DUR.f5)) * 4;
  // 第四级触发一拍（连续拒绝太多 → 回退人工）
  const trip = useImpulse({at: atTrip, dur: DUR.f4, peak: 1});
  // 判决卡特写（理由栏空白 + 斜线划过——「不写判决书」）
  const verdict = useProgress(atVerdict, DUR.f5);
  // 调用卡沿四节点位插值（节点中心 = 210 + 60 + i*360 + 140）
  const NODE_CX = [410, 770, 1130, 1490];
  const seg = Math.min(3.999, Math.floor(step));
  const callX = NODE_CX[Math.min(3, seg)] + (NODE_CX[Math.min(3, seg + 1)] - NODE_CX[Math.min(3, seg)]) * (step - seg);
  return (
    <AbsoluteFill>
      {/* 问人闸卡（1-D 同形——打开态：旋开让位给内部子链） */}
      <div style={{position: 'absolute', left: 850, top: 120, transform: `rotate(${doorRot}deg)`, transformOrigin: '120px 200px', opacity: 1 - 0.5 * open}}>
        <GateCard x={0} y={0} w={240} h={210} kind="ask" lit={1} />
      </div>
      {/* 四级子链（acceptEdits → 白名单 → 安全分类器 → 回退人工） */}
      <TribunalChain x={210} y={300} open={open} step={step} trip={trip} verdict={verdict} />
      {/* 文件改动调用（单一输入穿四级——同签可追） */}
      {step > 0.1 && step < 3.95 ? (
        <div style={{position: 'absolute', left: callX, top: 500, transform: 'translate(-50%, -50%)'}}>
          <CallCard x={0} y={0} en="edit ./app.py" w={280} h={72} />
        </div>
      ) : null}
      {/* 第四级触发注记（回退人工——红沿一拍加重） */}
      <div
        style={{
          position: 'absolute',
          left: 1400,
          top: 560,
          fontFamily: theme.sans,
          fontSize: 21,
          color: theme.danger,
          opacity: trip,
          whiteSpace: 'nowrap',
        }}
      >
        {'连续拒绝太多 → 回退人工'}
      </div>
      <Foot4>{'ask 内部 · 四级判案子链'}</Foot4>
    </AbsoluteFill>
  );
};

// ── 4-C 三步走时间轴：字符串表 → 词边界 → 分类器 ────────────────────────

const STATIONS = [
  {zh: '字符串表', en: 'DESTRUCTIVE_COMMAND_WORD'},
  {zh: '词边界正则', en: 'word boundary'},
  {zh: '分类器徽记', en: 'classifier'},
] as const;

const ShotC: React.FC<{atStations: number; atCrack: number; atHurt: number; atWord: number; atThird: number; atSend: number}> = ({
  atStations,
  atCrack,
  atHurt,
  atWord,
  atThird,
  atSend,
}) => {
  const frame = useCurrentFrame();
  // 三站展开（stagger；时间轴基线 + 无号圆点——两套编号语言不同帧并用之禁）
  const st = [0, 1, 2].map((i) => clamp01(progress(frame, atStations + i * 6, DUR.f4)));
  // 第一站自标裂纹（自己都承认不可靠——裂纹一闪）
  const crack = useImpulse({at: atCrack, dur: DUR.f5, peak: 1});
  // model 词卡：路过第一站 →「del」子串误亮警示红（误伤具象）→ 第二站整词框
  // 只框整词 → 放行确认绿 → 直送第三站分类器判定
  const hurt = useProgress(atHurt, DUR.f4);
  const moveTo2 = useProgress(atWord, DUR.f5, 'decelerate');
  const release = useProgress(atWord + DUR.f4, DUR.f3);
  const third = useProgress(atThird, DUR.f3);
  const send = useProgress(atSend, DUR.f5, 'decelerate');
  const cardX = 300 + 320 * hurt + 480 * moveTo2 + 560 * send;
  const cardY = 660 - 90 * (moveTo2 + send * 0.8);
  const judged = useProgress(atSend + DUR.f4, DUR.f3);
  return (
    <AbsoluteFill>
      {/* 时间轴基线 + 三站（演进时间序；无号圆点） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <line x1={330} y1={470} x2={330 + 1230 * clamp01(st[2])} y2={470} stroke={withAlpha(theme.dim, 0.4)} strokeWidth={2.5} strokeDasharray="8 10" />
      </svg>
      {STATIONS.map((s, i) => {
        const cx = 400 + i * 560;
        const on = st[i];
        return (
          <div key={s.en} style={{position: 'absolute', left: cx - 190, top: 300, opacity: on}}>
            <div
              style={{
                width: 380,
                height: 128,
                boxSizing: 'border-box',
                borderRadius: '64px 64px 12px 12px',
                border: `3px solid ${on > 0.4 ? theme.mech : theme.panelBorder}`,
                background: on > 0.4 ? withAlpha(theme.mech, 0.1) : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                position: 'relative',
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 700, color: on > 0.4 ? theme.text : theme.dim}}>{s.zh}</span>
              <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{s.en}</span>
              {/* 第一站自标裂纹（不可靠自认——裂纹一闪 + 常驻细纹） */}
              {i === 0 && crack > 0.01 ? (
                <svg width={90} height={70} viewBox="0 0 90 70" style={{position: 'absolute', right: 18, top: 12, opacity: 0.35 + 0.65 * crack}}>
                  <path d="M10 8 L34 30 L22 44 L46 64" fill="none" stroke={theme.danger} strokeWidth={3.5} strokeLinecap="round" />
                </svg>
              ) : null}
              {/* 第三站小模型节点（分类器徽记——脑纹小形） */}
              {i === 2 ? (
                <svg width={44} height={38} viewBox="-22 -19 44 38" style={{position: 'absolute', right: 22, top: 14, opacity: third}}>
                  <g stroke={third > 0.5 ? theme.mech : theme.dim} strokeWidth={3} fill="none" strokeLinecap="round">
                    <path d="M-14 4 Q-19 -3 -12 -8 Q-11 -15 -3 -16 Q5 -17 7 -12 Q15 -10 15 -3 Q15 4 9 7 Q-3 11 -14 4 Z" />
                    <path d="M0 -16 Q-2 -6 0 7" />
                  </g>
                </svg>
              ) : null}
            </div>
            {/* 站下圆点（时间轴台位——无号） */}
            <div
              style={{
                position: 'absolute',
                left: 190 - 7,
                top: 156,
                width: 14,
                height: 14,
                borderRadius: 999,
                background: on > 0.4 ? theme.mech : theme.panelBorder,
              }}
            />
          </div>
        );
      })}
      {/* model 负例词卡（只显词面；「del」子串误亮=第一站误伤具象） */}
      <div style={{position: 'absolute', left: cardX, top: cardY, opacity: hurt > 0.01 ? 1 : 0}}>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 38,
            color: theme.text,
            background: theme.panel,
            // ⑨ QA W3：第二站整词放行（release && moveTo2>0.5）即转确认绿——原
            // 边框绿延迟到第三站 judged 锚（p4-08c 尾），与「改成只认整个词→
            // model 词卡放行（确认绿）」的镜内时序错位；第三站判定再叠加绿框
            // 加粗（borderWidth 3→4.5，判定语义层级不丢）
            border: `${judged > 0.5 ? 4.5 : 3}px solid ${
              release > 0.3 && moveTo2 > 0.5 ? theme.ok : theme.panelBorder
            }`,
            borderRadius: 10,
            padding: '10px 26px',
            position: 'relative',
            boxShadow: judged > 0.5 ? `0 0 ${20 * judged}px ${withAlpha(theme.ok, 0.7)}` : 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{color: theme.text}}>{'mo'}</span>
          <span
            style={{
              color: release > 0.3 && moveTo2 > 0.5 ? theme.text : theme.danger,
              background: release > 0.3 && moveTo2 > 0.5 ? 'transparent' : withAlpha(theme.danger, 0.3),
              borderRadius: 4,
              padding: '0 2px',
            }}
          >
            {'del'}
          </span>
          {/* 整词框（第二站：词边界只框整词——只框 model 全词） */}
          {moveTo2 > 0.5 && send < 0.3 ? (
            <span
              style={{
                position: 'absolute',
                inset: -9,
                borderRadius: 12,
                border: `2.5px solid ${theme.edge}`,
                opacity: clamp01((moveTo2 - 0.5) * 2),
              }}
            />
          ) : null}
        </div>
        {/* 误伤警示签（第一站：子串误亮——只发生在第一站） */}
        <div
          style={{
            position: 'absolute',
            right: -10,
            top: -42,
            fontFamily: theme.sans,
            fontSize: 20,
            fontWeight: 700,
            color: theme.danger,
            background: theme.bg,
            border: `2px solid ${theme.danger}`,
            borderRadius: 7,
            padding: '2px 12px',
            whiteSpace: 'nowrap',
            opacity: hurt * (1 - release) * (moveTo2 < 0.2 ? 1 : 0),
          }}
        >
          {'子串误伤'}
        </div>
      </div>
      {/* 负例词卡余两枚（delimiter / echo del——待检，只显词面） */}
      {['delimiter', 'echo del'].map((w, i) => (
        <div
          key={w}
          style={{
            position: 'absolute',
            left: 700 + i * 330,
            top: 760,
            fontFamily: theme.mono,
            fontSize: 28,
            color: theme.dim,
            border: `2.5px solid ${theme.panelBorder}`,
            borderRadius: 9,
            padding: '8px 20px',
            opacity: 0.75,
            whiteSpace: 'nowrap',
          }}
        >
          {w}
        </div>
      ))}
      {/* 分类器判定帧（第三站——徽记下判定注记） */}
      <div
        style={{
          position: 'absolute',
          left: 1330,
          top: 470,
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.ok,
          opacity: judged,
        }}
      >
        {/* ⑨ QA W4：model 是被误伤的好词——分类器判定其不危险、放行；绿字承载
            「不危险 · 放行」语义（原「危险」拧巴：非危险词判危险与画面放行矛盾） */}
        {'判定 ✓ 不危险 · 放行'}
      </div>
      <Foot4>{'认危险命令 · 三步演进'}</Foot4>
    </AbsoluteFill>
  );
};

// ── 4-D 六模式卡横排 + 跳过询问卡抽出 + 隔离罩壳 ────────────────────────

/** 五张常规模式卡：名目不具名上卡（角标 Footnote 承载 acceptEdits · plan ·
 *  auto · bypassPermissions 等；卡面逐一展开名目为 Visual Lock 禁止项）——
 *  mono 位号 + 中性概念条占位，唯一指认卡 = 第六张「跳过询问」。 */
const MODE_CARDS = [0, 1, 2, 3, 4] as const;

const ShotD: React.FC<{atRow: number; atCards: number; atPull: number; atShell: number}> = ({atRow, atCards, atPull, atShell}) => {
  const frame = useCurrentFrame();
  // 底座亮起 → 六卡 stagger 点亮（六种权限模式——名目进角标）
  const baseO = useProgress(atRow, DUR.f4);
  const cards = [0, 1, 2, 3, 4, 5].map((i) => clamp01(progress(frame, atCards + i * 4, DUR.f3)));
  // 「跳过询问」卡（第六位）抽出前置：spring 位移，其余五卡右移让位
  const pull = useSpring('settle', {at: atPull, dur: DUR.f5});
  const pulledO = useProgress(atPull, DUR.f3);
  // 隔离容器罩壳合拢扣住该卡 + 警示描边亮起（重音镜）
  const shell = useProgress(atShell, DUR.f4);
  const shellFlash = useImpulse({at: atShell + DUR.f3, dur: DUR.f5, peak: 1});
  const CARD_W = 262;
  const GAP = 22;
  const startX = 120;
  const pullCardX = startX + (5 * (CARD_W + GAP) - 0) * (1 - pull);
  return (
    <AbsoluteFill>
      {/* 横排底座（六模式卡列的地面） */}
      <div style={{position: 'absolute', left: 80, right: 80, top: 690, height: 3, background: withAlpha(theme.dim, 0.35), opacity: baseO}} />
      {/* 五张常规模式卡（名目进角标——卡面 mono 位号 + 中性概念条） */}
      {MODE_CARDS.map((i) => {
        const x = startX + (i + 1) * (CARD_W + GAP) * pull + i * (CARD_W + GAP) * (1 - pull);
        return (
          <div key={`m${i}`} style={{position: 'absolute', left: x, top: 480, opacity: cards[i] * baseO}}>
            <div
              style={{
                width: CARD_W,
                height: 190,
                boxSizing: 'border-box',
                borderRadius: 14,
                border: `2.5px solid ${theme.panelBorder}`,
                background: theme.panel,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{`mode 0${i + 1}`}</span>
              {/* ⑨ QA N3：中性灰条改「标签页/刻度」图形（三条递减刻度——settings
                  页签隐喻，不具名）；名目由底部角标补足（含 default） */}
              <span style={{display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'center'}}>
                <span style={{width: 120, height: 8, borderRadius: 4, background: theme.panelBorder, opacity: 0.85}} />
                <span style={{width: 86, height: 8, borderRadius: 4, background: theme.panelBorder, opacity: 0.6}} />
                <span style={{width: 56, height: 8, borderRadius: 4, background: theme.panelBorder, opacity: 0.4}} />
              </span>
            </div>
          </div>
        );
      })}
      {/* 「跳过询问」卡（第六位抽出前置——高亮 + 罩壳） */}
      <div style={{position: 'absolute', left: pullCardX, top: 456, opacity: cards[5] * baseO, zIndex: 2}}>
        <div
          style={{
            width: CARD_W,
            height: 220,
            boxSizing: 'border-box',
            borderRadius: 14,
            border: `3px solid ${theme.danger}`,
            background: withAlpha(theme.danger, 0.1),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            transform: `scale(${1 + 0.04 * pulledO})`,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.danger}}>{'mode 06'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>{'跳过询问'}</span>
          {/* 隔离容器罩壳（容器/VM——合拢扣住该卡） */}
          {shell > 0.01 ? (
            <div
              style={{
                position: 'absolute',
                inset: -14 + 14 * (1 - shell),
                borderRadius: 20,
                border: `3px ${shell > 0.5 ? 'solid' : 'dashed'} ${theme.danger}`,
                boxShadow: `0 0 ${30 * shellFlash}px ${withAlpha(theme.danger, 0.7)}`,
                opacity: shell,
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  right: 12,
                  top: -34,
                  fontFamily: theme.mono,
                  fontSize: 17,
                  color: theme.danger,
                  background: theme.bg,
                  padding: '1px 10px',
                  borderRadius: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                容器 / VM
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <Foot4>{'default · acceptEdits · plan · auto · bypassPermissions …'}</Foot4>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P4TieredTribunal: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p4-01', 'p4-04');
  const bB = w('p4-05', 'p4-07');
  const bC = w('p4-08', 'p4-08c');
  const bD = w('p4-09', 'p4-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <ShotA
          atPanel={wa('p4-01', 0.4) - bA.from}
          atThree={wa('p4-02', 0.55) - bA.from}
          atFourth={wa('p4-03', 0.3) - bA.from}
          atLink={wa('p4-03', 0.68) - bA.from}
          atStack={wa('p4-04', 0.3) - bA.from}
          atPress={wa('p4-04', 0.75) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <ShotB
          atOpen={wa('p4-05', 0.28) - bB.from}
          atStep={wa('p4-06', 0.2) - bB.from}
          atTrip={wa('p4-07', 0.2) - bB.from}
          atVerdict={wa('p4-07', 0.68) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <ShotC
          atStations={wa('p4-08', 0.2) - bC.from}
          atCrack={wa('p4-08', 0.72) - bC.from}
          atHurt={wa('p4-08b', 0.2) - bC.from}
          atWord={wa('p4-08b', 0.55) - bC.from}
          atThird={wa('p4-08c', 0.2) - bC.from}
          atSend={wa('p4-08c', 0.55) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="4-D">
        <ShotD
          atRow={wa('p4-09', 0.25) - bD.from}
          atCards={wa('p4-09', 0.5) - bD.from}
          atPull={wa('p4-10', 0.28) - bD.from}
          atShell={wa('p4-10', 0.68) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4TieredTribunal;
