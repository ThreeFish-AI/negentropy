/** P4 规程节点（p4-01..27，6 镜 15 cue）——分镜 4-A…4-F。
 *
 *  ★ 叙事链：循环膨胀反模式（立场金句「扩行为 · 不动循环」）→ 四点位挂载＋
 *    注册表（节点座 mech 插座长在环外）→ 三值语义与假值陷阱（deny 判空警示）→
 *    实验 4 语义反转 → 结诊双保险 → 4↔27↔33 规模对账。
 *  ★ 空间契约：循环圆环恒居中央 core 橙〔M-001〕；4-A 是 M-001「非：需表现
 *    演进时」的特许病态演出（本镜主题就是循环被塞坏），此后环体即刻复形。
 *  ★ archify 三图全屏独占：hook-mount 五章穿插（p4-06 自制小卡隔章）、
 *    hookresult-tri 两段（4-C 三章＋4-D 两章，两实例间隔 p4-16 空窗句）、
 *    stop-guard 五章穿插（p4-22 过渡小卡隔章）。各实例首章前均有整句空窗、
 *    全片无跨实例背靠背接缝，lead 一律走默认；穿插空窗后的换章弹入抑制由
 *    ArchifyRecap 实例内「空窗重现恢复入场」机制接管，自制卡窗一律=本句窗、
 *    勿越后续 cue 窗。4-D 首章为 p4-17 句尾让位：切点由句窗比例推导（锚句与
 *    时长句同为 p4-17，覆盖门可对账）。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {ExpBadge, LoopRing, QuoteCard, withAlpha} from '../components/clinic';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {
  DUR,
  useBreathe,
  useCount,
  useDim,
  useDraw,
  useEnter,
  useImpulse,
  useProgress,
  useSpring,
  useStagger,
} from '../motion';

/** 轻量角标（P0 FootnoteGhost 同形制；英文标识符只落角标位） */
const FootnoteChip: React.FC<{x: number; y: number; at: number; children: React.ReactNode}> = ({
  x,
  y,
  at,
  children,
}) => {
  const e = useEnter('fade', {at, dur: DUR.f3});
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        ...e,
        padding: '4px 12px',
        border: `1.5px solid ${withAlpha(theme.dim, 0.5)}`,
        borderRadius: 5,
        fontFamily: theme.mono,
        fontSize: 16,
        color: theme.dim,
      }}
    >
      {children}
    </div>
  );
};

// ── 4-A 循环膨胀（p4-01..04） ────────────────────────────────────────────

/** 检查代码行：首行真名 check_permission()，其余为无差别点阵行（不虚构函数名） */
const ROWS_HEAD = ['·'.repeat(20), 'check_permission()'] as const;
const ROWS_MORE = ['·'.repeat(22), '·'.repeat(20), '·'.repeat(24)] as const;

/** 循环被逐行塞胖：环体缓涨＋p4-03 再撑一档（「撑皱」的微幅形变）；
 *  行底压暗落进环内，逐条埋掉环心标签＝「认不出来」 */
const BloatLoop: React.FC<{atRing: number; atMore: number; atWorse: number}> = ({
  atRing,
  atMore,
  atWorse,
}) => {
  const stage = useProgress(atRing, DUR.f4);
  const head = useStagger(ROWS_HEAD.length, {at: atRing + 10, stride: 16, dur: DUR.f4});
  const more = useStagger(ROWS_MORE.length, {at: atMore, stride: 14, dur: DUR.f4});
  const grow = useSpring('settle', {at: atRing + 10, dur: DUR.f6});
  const wring = useSpring('settleSoft', {at: atWorse, dur: DUR.f5});
  const rows = [head[0], head[1], more[0], more[1], more[2]];
  const texts = [...ROWS_HEAD, ...ROWS_MORE];
  return (
    <div style={{position: 'absolute', inset: 0, opacity: stage}}>
      <div
        style={{
          position: 'absolute',
          left: 790,
          top: 240,
          width: 340,
          height: 340,
          transform: `scale(${1 + 0.1 * grow + 0.05 * wring})`,
        }}
      >
        <LoopRing x={0} y={0} size={340} litSteps={5} spin />
      </div>
      <div style={{position: 'absolute', left: 852, top: 330, width: 216}}>
        {texts.map((t, i) => (
          <div
            key={i}
            style={{
              opacity: rows[i],
              marginBottom: 6,
              padding: '2px 8px',
              background: theme.bg,
              borderRadius: 4,
              fontFamily: theme.mono,
              fontSize: i === 1 ? 16 : 14,
              color: i === 1 ? theme.text : theme.dim,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {t}
          </div>
        ))}
      </div>
    </div>
  );
};

/** p4-03 注释行定格（窗=本句，让位给 p4-04 金句卡） */
const WorseNote: React.FC<{at: number}> = ({at}) => {
  const e = useProgress(at, DUR.f4);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 646,
        width: 1920,
        textAlign: 'center',
        fontFamily: theme.mono,
        fontSize: 26,
        color: theme.dim,
        opacity: e,
      }}
    >
      {'// 很快认不出来'}
    </div>
  );
};

// ── 4-B 四点位挂载（p4-05..11） ─────────────────────────────────────────

/** p4-06 空窗回落：第一个点位（提交后）小卡——窗=本句，勿越 p4-07 cue 窗 */
const MountCard: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('pop', {at, dur: DUR.f4});
  return (
    <div style={{position: 'absolute', left: 700, top: 370, width: 520, ...e, textAlign: 'center'}}>
      <div
        style={{
          display: 'inline-block',
          padding: '20px 44px',
          background: theme.panel,
          border: `2.5px solid ${theme.mech}`,
          borderRadius: 12,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.mech}}>{'01'}</div>
        <div style={{fontFamily: theme.sans, fontSize: 42, color: theme.text, marginTop: 6}}>
          {'提交后'}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 8}}>
          {'进医生之前'}
        </div>
        <div
          style={{
            marginTop: 12,
            display: 'inline-block',
            padding: '3px 10px',
            border: `1.5px solid ${withAlpha(theme.dim, 0.5)}`,
            borderRadius: 5,
            fontFamily: theme.mono,
            fontSize: 14,
            color: theme.dim,
          }}
        >
          {'UserPromptSubmit'}
        </div>
      </div>
    </div>
  );
};

/** 四向节点座：环体四方 mech 插座（提交后/执行前/执行后/结诊时，英文落角标位） */
const SEATS = [
  {zh: '提交后', id: 'UserPromptSubmit', x: 878, y: 232},
  {zh: '执行前', id: 'PreToolUse', x: 1130, y: 428},
  {zh: '执行后', id: 'PostToolUse', x: 878, y: 624},
  {zh: '结诊时', id: 'Stop', x: 626, y: 428},
] as const;

/** p4-11 收束：四座错峰入场＋微光定格，「到点喊一嗓子」声波纹一次 */
const FourSeats: React.FC<{at: number; atShout: number}> = ({at, atShout}) => {
  const enters = useStagger(SEATS.length, {at, stride: 6, dur: DUR.f4});
  // 四座微光错峰呼吸（hooks 顶层恒定序：固定四次调用，map 只消费数值）
  const g0 = useBreathe({period: 96, amp: 0.22, base: 0.78});
  const g1 = useBreathe({period: 96, amp: 0.22, base: 0.78, offset: 24});
  const g2 = useBreathe({period: 96, amp: 0.22, base: 0.78, offset: 48});
  const g3 = useBreathe({period: 96, amp: 0.22, base: 0.78, offset: 72});
  const glow = [g0, g1, g2, g3];
  const ringIn = useProgress(at, DUR.f4);
  const wave = useImpulse({at: atShout, dur: DUR.f5, peak: 1});
  const cap = useProgress(atShout - DUR.f4, DUR.f4);
  return (
    <>
      <div style={{position: 'absolute', left: 810, top: 300, opacity: ringIn}}>
        <LoopRing x={0} y={0} size={300} litSteps={5} spin />
        <svg
          width={300}
          height={300}
          viewBox="0 0 300 300"
          style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}
        >
          {wave > 0.01 && (
            <circle
              cx={150}
              cy={150}
              r={150 + wave * 84}
              fill="none"
              stroke={theme.mech}
              strokeWidth={3}
              opacity={wave * 0.75}
            />
          )}
        </svg>
      </div>
      {SEATS.map((s, i) => (
        <div
          key={s.zh}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: 164,
            opacity: enters[i],
            transform: `translateY(${(1 - enters[i]) * 14}px)`,
            textAlign: 'center',
            padding: '8px 6px',
            background: theme.panel,
            border: `2px solid ${withAlpha(theme.mech, glow[i])}`,
            borderRadius: 9,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.mech}}>{s.zh}</div>
          <div style={{fontFamily: theme.mono, fontSize: 11, color: theme.dim, marginTop: 3}}>
            {s.id}
          </div>
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 726,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.dim,
          opacity: cap,
        }}
      >
        {'到点喊一嗓子'}
      </div>
    </>
  );
};

// ── 4-C 三值语义（p4-12..16） ───────────────────────────────────────────

/** p4-13 空窗回落：空槽 → 问下一个 小卡（窗=本句，勿越 p4-14 cue 窗） */
const EmptyNextCard: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('pop', {at, dur: DUR.f4});
  return (
    <div style={{position: 'absolute', left: 660, top: 390, width: 600, ...e}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 30,
          padding: '30px',
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 12,
        }}
      >
        <div style={{textAlign: 'center'}}>
          <div style={{fontFamily: theme.mono, fontSize: 40, color: theme.dim}}>{'空'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginTop: 4}}>
            {'None'}
          </div>
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 34, color: theme.dim}}>{'→'}</div>
        <div style={{textAlign: 'center'}}>
          <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>{'下一个'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 15, color: theme.dim, marginTop: 4}}>
            {'接着问'}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 14,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 20,
          color: theme.dim,
        }}
      >
        {'没意见 · 不生效'}
      </div>
    </div>
  );
};

/** p4-16 回落：陷阱警示条——mono 判词＋deny 下划线描线（本幕末句，停驻至镜尾） */
const TrapStrip: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('fade', {at, dur: DUR.f4});
  const line = useDraw(at + DUR.f4, DUR.f5);
  return (
    <div style={{position: 'absolute', left: 0, top: 420, width: 1920, ...e, textAlign: 'center'}}>
      <div
        style={{
          display: 'inline-block',
          padding: '22px 46px 14px',
          background: theme.panel,
          border: `2px solid ${withAlpha(theme.deny, 0.55)}`,
          borderRadius: 10,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 38, color: theme.text, letterSpacing: 2}}>
          {'空不空 ≠ 真不真'}
        </div>
        <svg width={380} height={12} viewBox="0 0 380 12">
          <line x1={8} y1={6} x2={372} y2={6} stroke={theme.deny} strokeWidth={4} {...line} />
        </svg>
      </div>
    </div>
  );
};

// ── 4-D 实验 4（p4-17..19） ─────────────────────────────────────────────

/** p4-17 句尾让位切点：前 55% 封条卡、后 45% 首章（句窗比例推导，禁写死帧数） */
const TAIL_SPLIT = 0.55;

/** p4-19 实验读数（图内为证的画面落点，deny=失灵侧） */
const ReadTags: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('fade', {at: at + DUR.f3, dur: DUR.f3});
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 690,
        width: 1920,
        textAlign: 'center',
        opacity: e.opacity,
      }}
    >
      {['0 工具', '轮次封顶'].map((t) => (
        <span
          key={t}
          style={{
            display: 'inline-block',
            margin: '0 14px',
            padding: '4px 16px',
            border: `1.5px solid ${withAlpha(theme.deny, 0.55)}`,
            borderRadius: 5,
            fontFamily: theme.mono,
            fontSize: 18,
            color: theme.deny,
          }}
        >
          {t}
        </span>
      ))}
    </div>
  );
};

// ── 4-E 双保险（p4-20..25） ─────────────────────────────────────────────

/** p4-22 空窗回落：真实产品 · 双保险过渡小卡（两道保险名目落角标位；窗=本句） */
const GuardCard: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('pop', {at, dur: DUR.f4});
  const chip: React.CSSProperties = {
    display: 'inline-block',
    padding: '3px 10px',
    border: `1.5px solid ${withAlpha(theme.dim, 0.5)}`,
    borderRadius: 5,
    fontFamily: theme.mono,
    fontSize: 14,
    color: theme.dim,
  };
  return (
    <div style={{position: 'absolute', left: 660, top: 360, width: 600, ...e, textAlign: 'center'}}>
      <div
        style={{
          display: 'inline-block',
          padding: '22px 48px',
          background: theme.panel,
          border: `2.5px solid ${theme.mech}`,
          borderRadius: 12,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 42, color: theme.text}}>{'双保险'}</div>
        <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 8}}>
          {'真实产品'}
        </div>
        <div style={{marginTop: 14, display: 'flex', gap: 10, justifyContent: 'center'}}>
          <span style={chip}>{'stopHookActive'}</span>
          <span style={chip}>{'官方：连续 8 次硬停'}</span>
        </div>
      </div>
    </div>
  );
};

// ── 4-F 规模对账（p4-26..27） ───────────────────────────────────────────

/** 三格口径：教学版 4 ↔ 拆解口径 27 ↔ 官方今天 33（第三格带日期戳） */
const SCALE_CELLS = [
  {label: '教学版', to: 4},
  {label: '拆解口径', to: 27},
  {label: '官方今天', to: 33},
] as const;

const WALL_COLS = 22;
const WALL_ROWS = 4;

/** 对账卡：三格数字 useCount 递进点亮；背景节点墙（mech 剪影）绵延淡出让位，
 *  p4-27 右缘再亮一列＝「清单一直在长」 */
const ScaleLedger: React.FC<{at: number; atMore: number}> = ({at, atMore}) => {
  const wallIn = useProgress(2, DUR.f5);
  const wallDim = useDim({at, to: 0.35, dur: DUR.f5});
  const enters = useStagger(SCALE_CELLS.length, {at, stride: 12, dur: DUR.f5});
  const c0 = useCount({to: SCALE_CELLS[0].to, at, dur: DUR.f6});
  const c1 = useCount({to: SCALE_CELLS[1].to, at: at + 12, dur: DUR.f6});
  const c2 = useCount({to: SCALE_CELLS[2].to, at: at + 24, dur: DUR.f6});
  const counts = [c0, c1, c2];
  const more = useStagger(WALL_ROWS, {at: atMore, stride: 5, dur: DUR.f4});
  const cell: React.CSSProperties = {
    width: 400,
    padding: '22px 0',
    textAlign: 'center',
    background: theme.panel,
    border: `2px solid ${theme.panelBorder}`,
    borderRadius: 12,
  };
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 170,
          width: 1920,
          opacity: wallIn * wallDim,
          display: 'flex',
          justifyContent: 'center',
          gap: 14,
        }}
      >
        <div style={{display: 'grid', gridTemplateColumns: `repeat(${WALL_COLS}, 20px)`, gap: 12}}>
          {Array.from({length: WALL_COLS * WALL_ROWS}, (_, i) => (
            <div
              key={i}
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                background: theme.panel,
                border: `1.5px solid ${withAlpha(theme.mech, 0.3)}`,
              }}
            />
          ))}
        </div>
        <div style={{display: 'grid', gridTemplateColumns: '20px', gap: 12}}>
          {Array.from({length: WALL_ROWS}, (_, i) => (
            <div
              key={i}
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                opacity: more[i],
                background: theme.panel,
                border: `1.5px solid ${withAlpha(theme.mech, 0.4)}`,
              }}
            />
          ))}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 330,
          top: 420,
          display: 'flex',
          alignItems: 'center',
          gap: 26,
        }}
      >
        {SCALE_CELLS.map((c, i) => (
          <React.Fragment key={c.label}>
            {i > 0 && (
              <div style={{fontFamily: theme.mono, fontSize: 40, color: theme.dim}}>{'↔'}</div>
            )}
            <div
              style={{
                ...cell,
                opacity: enters[i],
                transform: `translateY(${(1 - enters[i]) * 18}px)`,
              }}
            >
              <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{c.label}</div>
              <div
                style={{
                  fontFamily: theme.mono,
                  fontSize: 96,
                  color: theme.text,
                  marginTop: 6,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {Math.round(counts[i])}
              </div>
              {i === 2 && (
                <div style={{marginTop: 6}}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      border: `1.5px solid ${withAlpha(theme.dim, 0.5)}`,
                      borderRadius: 5,
                      fontFamily: theme.mono,
                      fontSize: 14,
                      color: theme.dim,
                    }}
                  >
                    {'2026-09'}
                  </span>
                </div>
              )}
            </div>
          </React.Fragment>
        ))}
      </div>
    </>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P4HookNodes: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p4-01', 'p4-04');
  const bB = w('p4-05', 'p4-11');
  const bC = w('p4-12', 'p4-16');
  const bD = w('p4-17', 'p4-19');
  const bE = w('p4-20', 'p4-25');
  const bF = w('p4-26', 'p4-27');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A 循环膨胀">
        <BloatLoop
          atRing={2}
          atMore={at('p4-02') - bA.from}
          atWorse={at('p4-03') - bA.from}
        />
        <Sequence from={at('p4-03') - bA.from} durationInFrames={dur('p4-03')}>
          <WorseNote at={6} />
        </Sequence>
        <QuoteCard x={560} y={680} at={at('p4-04') - bA.from} width={800}>
          {'扩行为 · 不动循环'}
        </QuoteCard>
        <FootnoteChip x={246} y={64} at={2}>
          {'check_permission() · 内嵌'}
        </FootnoteChip>
      </Sequence>

      {/* 首章（p4-05）前为自制镜 4-A，无跨实例背靠背 → lead 走默认；
          p4-06 空窗后的换章由实例内「空窗重现恢复入场」接管（ArchifyRecap lead 注释） */}
      <Sequence {...bB} name="4-B 四点位挂载">
        <Sequence from={at('p4-06') - bB.from} durationInFrames={dur('p4-06')}>
          <MountCard at={2} />
        </Sequence>
        <FourSeats
          at={at('p4-11') - bB.from}
          atShout={at('p4-11') - bB.from + Math.round(dur('p4-11') * 0.5)}
        />
        <ArchifyRecap
          slug="hook-mount"
          caption="四点位挂载"
          cues={[
            {chapterId: 'four-mounts', at: at('p4-05') - bB.from, durationInFrames: dur('p4-05')},
            {chapterId: 'pre-intercept', at: at('p4-07') - bB.from, durationInFrames: dur('p4-07')},
            {chapterId: 'post-ledger', at: at('p4-08') - bB.from, durationInFrames: dur('p4-08')},
            {chapterId: 'stop-recall', at: at('p4-09') - bB.from, durationInFrames: dur('p4-09')},
            {chapterId: 'registry', at: at('p4-10') - bB.from, durationInFrames: dur('p4-10')},
          ]}
        />
      </Sequence>

      {/* 首章（p4-12）前隔 p4-11 自制句 → lead 走默认；章间 p4-13 空窗同上 */}
      <Sequence {...bC} name="4-C 三值语义">
        <Sequence from={at('p4-13') - bC.from} durationInFrames={dur('p4-13')}>
          <EmptyNextCard at={2} />
        </Sequence>
        <TrapStrip at={at('p4-16') - bC.from} />
        <FootnoteChip x={660} y={640} at={at('p4-16') - bC.from}>
          {'None / not None · 判空不判真'}
        </FootnoteChip>
        <ArchifyRecap
          slug="hookresult-tri"
          caption="三值语义"
          cues={[
            {chapterId: 'tri-overview', at: at('p4-12') - bC.from, durationInFrames: dur('p4-12')},
            {chapterId: 'first-wins', at: at('p4-14') - bC.from, durationInFrames: dur('p4-14')},
            {chapterId: 'false-trap', at: at('p4-15') - bC.from, durationInFrames: dur('p4-15')},
          ]}
        />
      </Sequence>

      {/* 与 4-C 同图异实例：两实例间隔 p4-16 空窗句，非背靠背 → lead 走默认；
          首章为 p4-17 句尾让位（切点见 TAIL_SPLIT；半窗偏短，storySec 偏长时
          pickFit 会落 trim 档＝原速播＋裁尾，属预期兜底） */}
      <Sequence {...bD} name="4-D 实验4 反转">
        <Sequence from={at('p4-17') - bD.from} durationInFrames={dur('p4-17')}>
          <ExpBadge x={835} y={300} at={2} n={4} />
        </Sequence>
        <ArchifyRecap
          slug="hookresult-tri"
          caption="语义反转"
          cues={[
            // 句尾让位：前 55% 封条卡、后 45% 本章（切点=句窗比例推导，锚句与时长句同为 p4-17）
            {chapterId: 'flip-zero-tools', at: at('p4-17') - bD.from + Math.round(dur('p4-17') * TAIL_SPLIT), durationInFrames: dur('p4-17') - Math.round(dur('p4-17') * TAIL_SPLIT)},
            {chapterId: 'flip-stop-hijack', at: at('p4-18') - bD.from, durationInFrames: dur('p4-18')},
          ]}
        />
        <QuoteCard x={560} y={520} at={at('p4-19') - bD.from} width={800}>
          {'空不空 · 共享的契约'}
        </QuoteCard>
        <ReadTags at={at('p4-19') - bD.from} />
      </Sequence>

      {/* 首章（p4-20）前隔 p4-19 金句句 → lead 走默认；p4-22 空窗同 4-B 机制 */}
      <Sequence {...bE} name="4-E 双保险">
        <Sequence from={at('p4-22') - bE.from} durationInFrames={dur('p4-22')}>
          <GuardCard at={2} />
        </Sequence>
        <ArchifyRecap
          slug="stop-guard"
          caption="结诊双保险"
          cues={[
            // recall-loop 落 trim 留痕（契约：ArchifyRecap 头注「落 trim 的 cue 一律显式
            // fit 留痕」）：p4-20 窗 4.13s vs storySec 6.06s → rate 1.47，原速播＋裁尾
            // 约 1.9s（第三拍 loop「拉回来再跑一轮」大部分被裁，属本镜叙事让位）
            {chapterId: 'recall-loop', at: at('p4-20') - bE.from, durationInFrames: dur('p4-20'), fit: 'trim'},
            {chapterId: 'cap-100', at: at('p4-21') - bE.from, durationInFrames: dur('p4-21')},
            {chapterId: 'guard-flag', at: at('p4-23') - bE.from, durationInFrames: dur('p4-23')},
            {chapterId: 'guard-cap8', at: at('p4-24') - bE.from, durationInFrames: dur('p4-24')},
            {chapterId: 'stop-clean', at: at('p4-25') - bE.from, durationInFrames: dur('p4-25')},
          ]}
        />
      </Sequence>

      <Sequence {...bF} name="4-F 规模对账">
        <ScaleLedger at={at('p4-26') - bF.from} atMore={at('p4-27') - bF.from} />
        <FootnoteChip x={246} y={64} at={2}>
          {'2026-09 官方口径'}
        </FootnoteChip>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4HookNodes;
