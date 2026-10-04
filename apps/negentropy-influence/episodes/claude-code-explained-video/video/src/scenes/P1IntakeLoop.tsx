/** P1 接诊循环（p1-01..26，7 镜 10 cue）——分镜 1-A…1-G。
 *
 *  ★ 循环本体五步特写（M-001 近景：core 橙 5px 描边同形，步位标签换「进诊…回喂」）
 *    → 病历两署名（问方/答方，科室报告无署名贴进问方）→ 内容块判停（两态拨杆收尾）。
 *  ★ 实验 1：信迟到的停止标记 vs 看病历内容（传真吐纸＋双轨小卡）；生产版对照
 *    （千行级文件虚化 · 三十来行内核高亮 · 四枚保护壳）；交棒＝行数尺第一格复亮
 *    ＋命令行卡片（拼查看/拼替换）＋开单表剪影自右缘探入。
 *  archify 全屏独占：intake-loop 5 cue·3 实例＋stop-reason-race 五章。1-C discharge-return
 *    提前让位留空窗 → 1-D stream-order 走默认 lead 入场（原 lead={false}「镜界背靠背」
 *    前提不成立，2026-10-02 评审移除）；1-E 四章一实例（stop-late 承封条卡
 *    句尾让位与 stop-die 分锚 p1-16/p1-17——同锚句双 cue 是硬 FAIL，两章不能共锚一句；
 *    verdict 经 p1-19 空窗后由实例内空窗判定恢复入场）。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Doctor, ExpBadge, LineGauge, MonoTag, ProvenanceTag, withAlpha} from '../components/clinic';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {
  DUR,
  useEnter,
  useFlowDash,
  useImpulse,
  useProgress,
  useReveal,
  useSpring,
  useStagger,
} from '../motion';

// ── 1-A 圆环特写：五步位逐个点亮＋导流虚线缓转＋角标三枚浮现 ────────────────

const LOOP_STEPS = ['进诊', '落账', '收单', '执行', '回喂'];

const LoopCloseup: React.FC<{stepsAt: readonly number[]; tagsAt: readonly number[]}> = ({
  stepsAt,
  tagsAt,
}) => {
  // 五步逐句锚定（2026-10-02 评审修复）：均匀 fit 会把点亮摊平——「第四步」句
  // 全程无新点亮、「第五步」句尾才亮第④项；改各步独立 useProgress 锚「第N步」句头，
  // ①随特写出现预点亮（第一步口播在 p1-02 的 archify 全屏窗内，早已讲过）
  const s1 = useProgress(stepsAt[0], DUR.f5);
  const s2 = useProgress(stepsAt[1], DUR.f5);
  const s3 = useProgress(stepsAt[2], DUR.f5);
  const s4 = useProgress(stepsAt[3], DUR.f5);
  const s5 = useProgress(stepsAt[4], DUR.f5);
  const steps = [s1, s2, s3, s4, s5];
  const dash = useFlowDash({dash: 14, gap: 22, period: 46});
  const inP = useProgress(0, DUR.f4); // 承 archify 全屏窗的硬切缓入
  const tag0 = useReveal('messages', {at: tagsAt[0], cps: 12});
  const tag1 = useReveal('tool_use', {at: tagsAt[1], cps: 12});
  const tag2 = useReveal('tool_result', {at: tagsAt[2], cps: 12});
  const tags = [tag0, tag1, tag2];
  const size = 340;
  const r = size / 2;
  // 标签半径 r+38=208 超出半视口 170：画布四周外扩 PAD 容纳步位标签
  // （2026-10-03 评审修复：原视口裁掉「进诊/落账/回喂」三枚、切「收单/执行」）
  const pad = 62;
  const canvas = size + pad * 2;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 960 - r - pad,
          top: 268 - pad,
          width: canvas,
          height: canvas,
          opacity: inP,
        }}
      >
        <svg width={canvas} height={canvas} viewBox={`${-pad} ${-pad} ${canvas} ${canvas}`}>
          {/* M-001 母题描边：色与线宽锁死 */}
          <circle cx={r} cy={r} r={r - 6} fill="none" stroke={theme.core} strokeWidth={5} />
          <circle
            cx={r}
            cy={r}
            r={r - 26}
            fill="none"
            stroke={withAlpha(theme.core, 0.45)}
            strokeWidth={2}
            {...dash}
          />
          {LOOP_STEPS.map((s, i) => {
            const p = steps[i];
            const lit = p > 0.55;
            const ang = (i / LOOP_STEPS.length) * Math.PI * 2 - Math.PI / 2;
            const tx = r + Math.cos(ang) * (r - 6);
            const ty = r + Math.sin(ang) * (r - 6);
            const lx = r + Math.cos(ang) * (r + 38);
            const ly = r + Math.sin(ang) * (r + 38);
            return (
              <g key={s} opacity={0.4 + 0.6 * p}>
                <circle
                  cx={tx}
                  cy={ty}
                  r={14}
                  fill={theme.bg}
                  stroke={lit ? theme.core : withAlpha(theme.core, 0.4)}
                  strokeWidth={2.5}
                />
                <text x={tx} y={ty + 5} textAnchor="middle" fontFamily={theme.mono} fontSize={13} fill={lit ? theme.text : theme.dim}>
                  {i + 1}
                </text>
                <text
                  x={lx}
                  y={ly + 6}
                  textAnchor="middle"
                  fontFamily={theme.sans}
                  fontSize={19}
                  fill={lit ? theme.text : withAlpha(theme.dim, 0.55)}
                >
                  {s}
                </text>
              </g>
            );
          })}
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontSize: 25,
            color: theme.dim,
            letterSpacing: 8,
          }}
        >
          {'接诊循环'}
        </div>
      </div>
      {/* 角标三枚逐步浮现（mono） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 706,
          width: 1920,
          display: 'flex',
          justifyContent: 'center',
          gap: 22,
        }}
      >
        {/* 恒渲染＋满文定宽（R11 修复：原条件 null＋逐字加宽使 flex 居中组随打字
            连续 reflow，已浮现角标被横向推移——同 DualTrack/FaxStack opacity 占位
            形态；打字机 useReveal 保留在文本层，@reveal token 语义不变） */}
        {tags.map((t, i) => (
          <span
            key={i}
            style={{
              width: [86, 86, 118][i],
              textAlign: 'center',
              boxSizing: 'border-box',
              padding: '5px 4px',
              border: `1.5px solid ${withAlpha(theme.dim, 0.45)}`,
              borderRadius: 5,
              fontFamily: theme.mono,
              fontSize: 17,
              color: theme.dim,
              opacity: t ? 1 : 0,
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </>
  );
};

// ── 1-B 病历本两署名：两栏问方/答方，落字逐条；报告贴进问方栏（mech 高亮） ────

type LedgerRow = {col: 0 | 1; text: string};

/** 病历本特写书壳（纯渲染件，无 hook） */
const LedgerFace: React.FC<{fade: number; rows: readonly LedgerRow[]; children?: React.ReactNode}> = ({
  fade,
  rows,
  children,
}) => (
  <div
    style={{
      position: 'absolute',
      left: 660,
      top: 190,
      width: 600,
      height: 470,
      opacity: fade,
      background: theme.panel,
      border: `2px solid ${theme.panelBorder}`,
      borderRadius: 10,
    }}
  >
    <div style={{position: 'absolute', left: 299, top: 14, bottom: 14, width: 2, background: theme.panelBorder}} />
    <div style={{position: 'absolute', left: 90, top: 20, width: 120, textAlign: 'center', fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>
      {'问方'}
    </div>
    <div style={{position: 'absolute', left: 390, top: 20, width: 120, textAlign: 'center', fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>
      {'答方'}
    </div>
    {rows.map((rw, i) =>
      rw.text ? (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: rw.col === 0 ? 36 : 336,
            top: 84 + i * 88,
            width: 240,
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'›'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 21, color: rw.col === 0 ? theme.dim : theme.text}}>
            {rw.text}
          </span>
        </div>
      ) : null,
    )}
    {children}
  </div>
);

/** p1-07/08：表头与两行落字（mono 逐条） */
const LedgerIntro: React.FC<{atHead: number; atDoc: number}> = ({atHead, atDoc}) => {
  const head = useProgress(atHead, DUR.f4);
  const qRow = useReveal('清理一下项目', {at: atHead + 8, cps: 11});
  const aRow = useReveal('判断 · 开单', {at: atDoc, cps: 11});
  return (
    <LedgerFace
      fade={head}
      rows={[
        {col: 0, text: qRow},
        {col: 1, text: aRow},
      ]}
    />
  );
};

/** p1-10 回落：轮流往下写＋科室报告贴进问方栏（贴栏瞬间 mech 高亮） */
const LedgerPasted: React.FC<{at: number}> = ({at}) => {
  const inP = useProgress(at, DUR.f4);
  const hot = useImpulse({at: at + 4, dur: DUR.f5, peak: 1});
  return (
    <>
      <LedgerFace
        fade={inP}
        rows={[
          {col: 0, text: '清理一下项目'},
          {col: 1, text: '判断 · 开单'},
        ]}
      >
        <div
          style={{
            position: 'absolute',
            left: 36,
            top: 260,
            width: 250,
            padding: '10px 16px',
            background: withAlpha(theme.mech, 0.1),
            border: `2px solid ${theme.mech}`,
            borderRadius: 8,
            boxShadow: `0 0 ${16 * hot}px ${withAlpha(theme.mech, 0.6 * hot)}`,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.text}}>{'科室报告'}</div>
          <div style={{marginTop: 4, fontFamily: theme.sans, fontSize: 15, color: theme.dim}}>{'贴进问方'}</div>
        </div>
      </LedgerFace>
      <MonoTag x={724} y={688} at={at + 8}>{'tool_result → user 信封'}</MonoTag>
    </>
  );
};

// ── 1-C 判停拨杆收尾：环上两态（开单→转／没单→停），指针弹簧落位 ─────────────

const StopDial: React.FC<{at: number}> = ({at}) => {
  const inP = useProgress(at, DUR.f4);
  const s = useSpring('settle', {at: at + 3, dur: DUR.f5});
  const sw = useProgress(at + 3, DUR.f5); // effects 通道不吃弹簧（铁律③）
  // 拨杆行程贴合轨道两端（700..1220、knob 宽 30）：s=0 左缘贴左端、s=1 右缘贴右端
  // （2026-10-04 评审：原 712+420 终位悬停轨道末端前 73px 已对齐）
  const knobX = 715 + 490 * s;
  // 判据两态对照的「迟到方」：stop_reason 打叉后淡出（对照右侧常亮的 内容块）
  const strikeIn = useProgress(at + 2, DUR.f3);
  const strikeOut = 1 - useProgress(at + 34, DUR.f4);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: inP}}>
      <svg width={190} height={190} style={{position: 'absolute', left: 865, top: 300}}>
        <circle cx={95} cy={95} r={89} fill="none" stroke={theme.core} strokeWidth={5} />
        <circle cx={95} cy={95} r={10} fill={theme.core} />
      </svg>
      <div style={{position: 'absolute', left: 830, top: 506, width: 260, textAlign: 'center', fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>
        {'接诊循环 · 判停'}
      </div>
      {/* 两态拨杆：左 core（转）右 dim（停） */}
      <div
        style={{
          position: 'absolute',
          left: 700,
          top: 560,
          width: 520,
          height: 16,
          borderRadius: 8,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          overflow: 'hidden',
        }}
      >
        <div style={{position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', background: withAlpha(theme.core, 0.35)}} />
      </div>
      <div style={{position: 'absolute', left: 700, top: 520, width: 260, textAlign: 'center', fontFamily: theme.sans, fontSize: 22, color: theme.core}}>
        {'开单→转'}
      </div>
      <div style={{position: 'absolute', left: 960, top: 520, width: 260, textAlign: 'center', fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
        {'没单→停'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: knobX - 15,
          top: 548,
          width: 30,
          height: 40,
          borderRadius: 8,
          background: theme.panel,
          border: `3px solid ${sw > 0.5 ? theme.dim : theme.core}`,
        }}
      />
      {/* 分镜 1-C 角标两态对照：stop_reason 打叉淡出（迟到的标记不让看）vs
          内容块 点亮（真正该看的判据）——2026-10-02 评审修复补齐缺的半边 */}
      <span
        style={{
          position: 'absolute',
          left: 640,
          top: 276,
          opacity: strikeIn * strikeOut,
          padding: '4px 12px',
          border: `1.5px solid ${withAlpha(theme.dim, 0.5)}`,
          borderRadius: 5,
          fontFamily: theme.mono,
          fontSize: 16,
          color: theme.dim,
          textDecoration: 'line-through',
          textDecorationColor: theme.deny,
          textDecorationThickness: 2,
        }}
      >
        stop_reason
      </span>
      <MonoTag x={898} y={276} at={at + 2}>{'内容块'}</MonoTag>
    </div>
  );
};

// ── 1-D 流式坑：传真纸页逐页吐出，停止标记迟到（deny 红闪） ─────────────────

const FaxStack: React.FC<{atPages: number; atStamp: number}> = ({atPages, atStamp}) => {
  const pages = useStagger(3, {at: atPages, stride: 13, dur: DUR.f5});
  const slotIn = useProgress(atPages, DUR.f3); // 承 archify 全屏窗的硬切缓入
  const stampIn = useProgress(atStamp, DUR.f3);
  const flash = useImpulse({at: atStamp, dur: DUR.f4, peak: 1});
  return (
    <>
      {/* 出纸口 */}
      <div
        style={{
          position: 'absolute',
          left: 790,
          top: 168,
          width: 340,
          height: 62,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 10,
          opacity: slotIn,
        }}
      >
        <div style={{position: 'absolute', left: 24, top: 26, width: 292, height: 8, borderRadius: 4, background: theme.bgDeep}} />
      </div>
      {pages.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 812 + i * 14,
            top: 250 + i * 46,
            width: 296,
            height: 130,
            background: withAlpha(theme.text, 0.05),
            border: `2px solid ${withAlpha(theme.dim, 0.4)}`,
            borderRadius: 4,
            opacity: p,
            transform: `translateY(${(1 - p) * -84}px)`,
            padding: '12px 16px',
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'> 已落盘'}</div>
          {[0, 1, 2].map((k) => (
            <div
              key={k}
              style={{marginTop: 10, width: 220 - k * 40, height: 6, borderRadius: 3, background: withAlpha(theme.dim, 0.25)}}
            />
          ))}
        </div>
      ))}
      {/* 迟到的停止标记 */}
      <div
        style={{
          position: 'absolute',
          left: 1080,
          top: 210,
          opacity: stampIn,
          transform: `scale(${1 + 0.1 * flash})`,
          padding: '8px 18px',
          background: withAlpha(theme.deny, 0.12),
          border: `2.5px solid ${theme.deny}`,
          borderRadius: 8,
          boxShadow: `0 0 ${16 * flash}px ${withAlpha(theme.deny, 0.7 * flash)}`,
          fontFamily: theme.sans,
          fontSize: 20,
          color: theme.deny,
        }}
      >
        {'停止标记 · 迟到'}
      </div>
      <MonoTag x={772} y={126} at={atPages}>{'流式=逐段输出'}</MonoTag>
    </>
  );
};

// ── 1-E 实验封条卡（ExpBadge，clinic 共享）+ 双轨小卡 ────────────────

/** p1-19 双轨小卡：旧判据（信迟到的标记）vs 新判据（看病历内容）对切 */
const DualTrack: React.FC<{at: number}> = ({at}) => {
  const cards = useStagger(2, {at, stride: 10, dur: DUR.f5});
  const sides = [
    {x: 500, tag: '旧判据', sub: '信迟到的标记', num: '1 轮 · 0 工具', verdict: '✗ 半途而废', tone: theme.deny, face: theme.dim},
    {x: 1060, tag: '新判据', sub: '看病历内容', num: '3 轮 · 2 工具', verdict: '✓ 任务交付', tone: theme.ok, face: theme.text},
  ];
  return (
    <>
      {sides.map((sd, i) => {
        const p = cards[i];
        return (
          <div
            key={sd.tag}
            style={{
              position: 'absolute',
              left: sd.x,
              top: 360,
              width: 360,
              padding: '20px 26px',
              background: theme.panel,
              border: `2px solid ${withAlpha(sd.tone, 0.55)}`,
              borderRadius: 10,
              opacity: p,
              transform: `translateY(${(1 - p) * 18}px)`,
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 26, color: sd.face}}>{sd.tag}</div>
            <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{sd.sub}</div>
            <div style={{marginTop: 18, fontFamily: theme.mono, fontSize: 30, color: sd.tone}}>{sd.num}</div>
            <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 22, color: sd.tone}}>{sd.verdict}</div>
          </div>
        );
      })}
      <MonoTag x={700} y={298} at={at + 4}>{'1 轮 0 工具 vs 3 轮 2 工具'}</MonoTag>
    </>
  );
};

// ── 1-F 生产版对照：千行级文件（虚化）＋三十来行内核＋四枚保护壳 ─────────────

const KiloFile: React.FC<{atBox: number; atCore: number; atShell: number}> = ({atBox, atCore, atShell}) => {
  const box = useEnter('fade', {at: atBox, dur: DUR.f5});
  const coreIn = useProgress(atCore, DUR.f4);
  const hot = useImpulse({at: atCore, dur: DUR.f5, peak: 1});
  const shells = useStagger(4, {at: atShell, stride: 8, dur: DUR.f4});
  const shellNames = ['超时', '报错', '中止', '停机'];
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 610,
          top: 170,
          width: 700,
          height: 500,
          ...box,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {/* 千行代码暗示（虚化行墙） */}
        <div style={{position: 'absolute', inset: 0, padding: '30px 36px', filter: 'blur(1.6px)', opacity: 0.55}}>
          {Array.from({length: 14}, (_, i) => (
            <div
              key={i}
              style={{marginBottom: 22, width: 560 - (i % 4) * 90, height: 8, borderRadius: 4, background: withAlpha(theme.dim, 0.28)}}
            />
          ))}
        </div>
        <div style={{position: 'absolute', right: 18, top: 14, fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>
          {'千行级'}
        </div>
        {/* 循环内核段（core 高亮） */}
        <div
          style={{
            position: 'absolute',
            left: 40,
            top: 196,
            width: 620,
            height: 108,
            opacity: coreIn,
            background: withAlpha(theme.core, 0.1),
            border: `3px solid ${theme.core}`,
            borderRadius: 8,
            boxShadow: `0 0 ${22 * hot}px ${withAlpha(theme.core, 0.55 * hot)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 26px',
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 27, color: theme.text}}>{'循环内核'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.core}}>{'三十来行'}</span>
        </div>
      </div>
      {/* 保护壳图标阵列 */}
      {shellNames.map((nm, i) => {
        const p = shells[i];
        return (
          <div
            key={nm}
            style={{
              position: 'absolute',
              left: 650 + i * 160,
              top: 726,
              width: 140,
              height: 62,
              opacity: p,
              transform: `translateY(${(1 - p) * 14}px)`,
              background: theme.panel,
              border: `2px solid ${withAlpha(theme.dim, 0.45)}`,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
            }}
          >
            <svg width={22} height={22}>
              {i === 0 ? (
                <>
                  <circle cx={11} cy={11} r={8.5} fill="none" stroke={theme.dim} strokeWidth={2.5} />
                  <line x1={11} y1={6.5} x2={11} y2={11} stroke={theme.dim} strokeWidth={2.5} strokeLinecap="round" />
                </>
              ) : null}
              {i === 1 ? (
                <>
                  <line x1={5} y1={5} x2={17} y2={17} stroke={theme.dim} strokeWidth={2.5} strokeLinecap="round" />
                  <line x1={17} y1={5} x2={5} y2={17} stroke={theme.dim} strokeWidth={2.5} strokeLinecap="round" />
                </>
              ) : null}
              {i === 2 ? (
                <>
                  <line x1={8} y1={4} x2={8} y2={18} stroke={theme.dim} strokeWidth={3} strokeLinecap="round" />
                  <line x1={14} y1={4} x2={14} y2={18} stroke={theme.dim} strokeWidth={3} strokeLinecap="round" />
                </>
              ) : null}
              {i === 3 ? <rect x={4.5} y={4.5} width={13} height={13} rx={2} fill="none" stroke={theme.dim} strokeWidth={2.5} /> : null}
            </svg>
            <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{nm}</span>
          </div>
        );
      })}
      <ProvenanceTag x={1404} y={96} at={atBox} />
    </>
  );
};

// ── 1-G 交棒：命令行卡片（弹簧微歪）＋开单表剪影自右缘探入 ───────────────────

/** 轻量淡入罩（医生位等静件入场） */
const FadeBox: React.FC<{at: number; children: React.ReactNode}> = ({at, children}) => {
  const e = useProgress(at, DUR.f4);
  return <div style={{position: 'absolute', inset: 0, opacity: e}}>{children}</div>;
};

const CmdCard: React.FC<{at: number}> = ({at}) => {
  const inP = useProgress(at, DUR.f4);
  const tilt = useSpring('snap', {at, dur: DUR.f5});
  return (
    <div
      style={{
        position: 'absolute',
        left: 470,
        top: 340,
        width: 560,
        opacity: inP,
        transform: `translateY(${(1 - tilt) * 22}px) rotate(${2.2 * tilt}deg)`,
        background: theme.bgDeep,
        border: `2px solid ${theme.panelBorder}`,
        borderRadius: 10,
        padding: '14px 20px 18px',
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 10, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>
        <span style={{width: 9, height: 9, borderRadius: 999, background: theme.dim}} />
        {'命令行'}
        {/* 皱眉小脸（SVG 手绘，无 emoji） */}
        <svg width={26} height={26} style={{marginLeft: 'auto'}}>
          <circle cx={13} cy={13} r={10} fill="none" stroke={theme.dim} strokeWidth={2.5} />
          <circle cx={9.5} cy={11} r={1.4} fill={theme.dim} />
          <circle cx={16.5} cy={11} r={1.4} fill={theme.dim} />
          <path d="M8.5 17 Q13 20 17.5 17" fill="none" stroke={theme.dim} strokeWidth={2} strokeLinecap="round" />
        </svg>
      </div>
      {[
        {tag: '拼查看', cmd: 'cat docs/notes.md'},
        {tag: '拼替换', cmd: "sed -i 's/a/b/' f.txt"},
      ].map((r) => (
        <div key={r.tag} style={{marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 14}}>
          <span style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim}}>{r.tag}</span>
          <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.text}}>{r.cmd}</span>
        </div>
      ))}
    </div>
  );
};

const TablePeek: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('slideR', {at, dist: 150, dur: DUR.f5});
  return (
    <div
      style={{
        position: 'absolute',
        left: 1580,
        top: 420,
        ...e,
        width: 250,
        padding: '16px 0 14px',
        textAlign: 'center',
        background: withAlpha(theme.mech, 0.08),
        border: `2px solid ${withAlpha(theme.mech, 0.7)}`,
        borderRadius: 10,
      }}
    >
      <svg width={120} height={64}>
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={10} y1={10 + i * 14} x2={110} y2={10 + i * 14} stroke={withAlpha(theme.mech, 0.8)} strokeWidth={3} />
        ))}
      </svg>
      <div style={{marginTop: 6, fontFamily: theme.sans, fontSize: 20, color: theme.mech}}>{'开单表'}</div>
    </div>
  );
};

// ── 幕组装 ─────────────────────────────────────────────────────────────────

export const P1IntakeLoop: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const bA = w('p1-01', 'p1-06');
  const bB = w('p1-07', 'p1-10');
  const bC = w('p1-11', 'p1-12');
  const bD = w('p1-13', 'p1-15');
  const bE = w('p1-16', 'p1-20');
  const bF = w('p1-21', 'p1-23');
  const bG = w('p1-24', 'p1-26');
  // 句内切分（帧数全部由句窗推导，禁写死）：
  //  · seal16＝p1-16 前半给封条卡，stop-late 句尾让位（1-E）
  //  · tail12＝p1-12 尾段给判停拨杆收尾（1-C）
  //  · core21＝1-F 内核点亮＝「循环内核就三十来行」口播位（≈第 24/33 字，
  //    p1-21 实长 8.13s 见 video/public/audio/manifest.json——R11 修复原 +14f 提前 5s+）
  const seal16 = Math.round(dur('p1-16') * 0.5);
  const tail12 = Math.round(dur('p1-12') * 0.35);
  const core21 = Math.round(dur('p1-21') * 0.66);

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A 循环本体五步">
        {/* 两章同实例背靠背（实例内自动抑制换章弹入）。
            lead={false}：承 0-D gap-preview 镜界背靠背（p0-15 窗尽接 p1-01，
            全片唯一幕界 archify→archify 相邻——R11 修复） */}
        <ArchifyRecap
          slug="intake-loop"
          lead={false}
          caption="循环本体"
          cues={[
            {chapterId: 'five-steps', at: at('p1-01') - bA.from, durationInFrames: dur('p1-01')},
            {chapterId: 'full-reread', at: at('p1-02') - bA.from, durationInFrames: dur('p1-02')},
          ]}
        />
        {/* p1-03..06 回落自制：圆环特写（五步位点亮＋角标三枚浮现） */}
        <Sequence from={at('p1-03') - bA.from} name="1-A 五步特写">
          <LoopCloseup
            stepsAt={[
              2, // ① 预点亮：第一步口播（p1-02）在 archify 窗内已讲过
              8, // ②「第二步」＝本特写首句（p1-03 句头），紧随①稍错峰
              at('p1-04') - at('p1-03'), // ③「第三步」
              at('p1-05') - at('p1-03'), // ④「第四步」
              at('p1-06') - at('p1-03'), // ⑤「第五步」
            ]}
            tagsAt={[2, at('p1-04') - at('p1-03'), at('p1-06') - at('p1-03')]}
          />
        </Sequence>
      </Sequence>

      <Sequence {...bB} name="1-B 病历本两署名">
        <Sequence durationInFrames={at('p1-09') - bB.from} name="1-B 两栏落字">
          <LedgerIntro atHead={2} atDoc={at('p1-08') - bB.from} />
        </Sequence>
        {/* p1-09 句让位：两署名一瞥 */}
        <ArchifyRecap
          slug="intake-loop"
          caption="两栏署名"
          cues={[{chapterId: 'two-signatures', at: at('p1-09') - bB.from, durationInFrames: dur('p1-09')}]}
        />
        {/* p1-10 回落：轮流往下写＋报告贴进问方栏 */}
        <Sequence from={at('p1-10') - bB.from} name="1-B 报告贴栏">
          <LedgerPasted at={2} />
        </Sequence>
      </Sequence>

      <Sequence {...bC} name="1-C 判停分屏">
        {/* 同图相邻两章背靠背（实例内自动处理）；p1-12 尾段留给判停拨杆收尾 */}
        <ArchifyRecap
          slug="intake-loop"
          caption="判停分屏"
          cues={[
            {chapterId: 'order-or-done', at: at('p1-11') - bC.from, durationInFrames: dur('p1-11')},
            {chapterId: 'discharge-return', at: at('p1-12') - bC.from, durationInFrames: dur('p1-12') - tail12},
          ]}
        />
        <Sequence from={at('p1-12') - bC.from + dur('p1-12') - tail12} name="1-C 判停拨杆">
          <StopDial at={2} />
        </Sequence>
      </Sequence>

      <Sequence {...bD} name="1-D 流式坑">
        {/* 1-C 的 discharge-return 提前 tail12（65 帧）让位给 StopDial，本实例首 cue
            距上个 archify 卸载有整段空窗（>2 帧）→ lead 走默认 true 恢复入场弹簧
            （2026-10-02 评审修复：原 lead={false} 的「镜界背靠背」前提不成立） */}
        <ArchifyRecap
          slug="stop-reason-race"
          caption="流式时序"
          cues={[{chapterId: 'stream-order', at: at('p1-13') - bD.from, durationInFrames: dur('p1-13')}]}
        />
        <Sequence from={at('p1-14') - bD.from} name="1-D 传真吐纸">
          <FaxStack atPages={2} atStamp={at('p1-15') - at('p1-14')} />
        </Sequence>
      </Sequence>

      <Sequence {...bE} name="1-E 实验1对照">
        {/* stop-late 与 stop-die 分锚 p1-16/p1-17（同锚句双 cue 是硬 FAIL）；
            verdict 经 p1-19 空窗后由实例内空窗判定恢复入场 */}
        <ArchifyRecap
          slug="stop-reason-race"
          caption="实验1 · 判据对照"
          cues={[
            // stop-late 落 trim 留痕（契约同 P4 recall-loop）：seal16 让位封条卡后窗仅
            // 44 帧=1.47s vs storySec 3.22s → rate 2.20，原速播＋裁尾约 1.75s（后两拍
            // 大部分被裁，属封条卡让位的叙事取舍；89−Math.round(44.5)=44 帧实窗口径）
            {chapterId: 'stop-late', at: at('p1-16') - bE.from + seal16, durationInFrames: dur('p1-16') - seal16, fit: 'trim'},
            {chapterId: 'stop-die', at: at('p1-17') - bE.from, durationInFrames: dur('p1-17')},
            {chapterId: 'block-live', at: at('p1-18') - bE.from, durationInFrames: dur('p1-18')},
            {chapterId: 'verdict', at: at('p1-20') - bE.from, durationInFrames: dur('p1-20')},
          ]}
        />
        {/* p1-16 前半：实验封条卡（句尾让位给 stop-late） */}
        <Sequence durationInFrames={seal16} name="1-E 实验封条">
          <ExpBadge x={742} y={408} at={2} n={1} />
        </Sequence>
        {/* p1-19 回落：双轨小卡（旧判据/新判据两卡对切） */}
        <Sequence from={at('p1-19') - bE.from} durationInFrames={dur('p1-19')} name="1-E 双轨小卡">
          <DualTrack at={2} />
        </Sequence>
      </Sequence>

      <Sequence {...bF} name="1-F 生产版对照">
        <KiloFile atBox={at('p1-21') - bF.from} atCore={at('p1-21') - bF.from + core21} atShell={at('p1-22') - bF.from} />
      </Sequence>

      <Sequence {...bG} name="1-G 交棒">
        <LineGauge lit={1} />
        <FadeBox at={at('p1-24') - bG.from}>
          <Doctor x={150} y={300} scale={0.78} />
          <div style={{position: 'absolute', left: 98, top: 452, width: 200, textAlign: 'center', fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>
            {'医生'}
          </div>
        </FadeBox>
        <CmdCard at={at('p1-24') - bG.from} />
        <TablePeek at={at('p1-26') - bG.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1IntakeLoop;
