/** P4 生产版对照（p4-01..p4-07，4 镜）——分镜 4-A / 4-B / 4-C / 4-D。
 *
 *  叙事链：4-A 拉远全景（@pushIn 负增量——自 P3 峰值降压重锚）：判定全表 17 行
 *  缩略网格自中心波纹式显形（归属句前段铺满防空窗，显形段约 3s）、「十几种」
 *  词落位波纹收束整幅定格可数；教学版三行分类表缩微驻网格左上（活切片）→
 *  p4-02「只展开五种」前 5 行高亮 stagger 点亮（教学边界的显式划定）→ 4-B
 *  增量检查特写（单句镜）：续写块（承 1-B 续写签同款）上浮「增量检查」小卡、
 *  三格增量条逐格递减每格落定闪一次、「判停」红边小签落下压住续写块 → 4-C
 *  参数对照天平：两卡入场（补镜首空窗）、天平升起落定、右卡三参数逐词点亮、
 *  「哪组对？都对」等权重摇摆至水平定格（重音镜——两卡同色恢复蓝系无优劣
 *  色差，G1②）、两枚优先小签并列点亮 → 4-D 收束预备：两组参数卡自外向内
 *  溶解、碎片汇入骨架线稿描边（参数归于骨架）、骨架线稿整体点亮一拍（机制层
 *  与选择层分层定格）→「收成一句话」镜头向环体居中位收拢交棒 5-A。
 *
 *  空间契约：网格行数可数（17）、五行高亮与教学展开位对应（gl-notes B.3 全表
 *    前 5 行 = 教学版展开位）、缩略行不展开细节、暗行不抢焦；17 计数不进口播
 *    字幕层（口播恒「十几种」）；增量条逐格递减、判停签为唯一红边元素、判停
 *    前无第四格；两卡等大等权重、天平水平定格禁倾斜、参数数字与角标一致；
 *    骨架线稿与环体同形（线稿=同一主体的白描态）、参数溶解有轨迹、机制/选择
 *    两层可辨、线稿不残留参数数字。
 *
 *  红线落实：词落位 = wa(id,f)（manifest 已就位；⑧ 轮已按句内字位复核一轮微调，词级实测复核留 ⑨ 轮 QA）；
 *    y≥56 / bottom≥176；reason/transition 全表（17 行）· tokenBudget.ts ·
 *    diminishing returns · ESCALATED_MAX_TOKENS=16000 · MAX_RETRIES=3 ·
 *    MAX_CONSECUTIVE_529=2 只进角标。
 *
 *  幕间转场（3-D→4-A / 4-D→5-A，storyboard 登记）：断裂走 SceneFade＋拉远
 *  重锚（承 ep2 3-C→4-A 同款）；环体以〔M-001〕同形签名回归（4-D 线稿→5-A
 *  实线为状态升级非 morph——镜间身份恒常）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {BalanceScale, RoutingTable} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 判定全表 17 行（gl-notes B.3 附录全表——reason/transition 清单；教学版只
 *  展开前 5 种） */
const VERDICT_ROWS = [
  'completed',
  'next_turn',
  'max_output_tokens_escalate',
  'max_output_tokens_recovery',
  'reactive_compact_retry',
  'prompt_too_long',
  'collapse_drain_retry',
  'model_error',
  'image_error',
  'aborted_streaming',
  'aborted_tools',
  'stop_hook_blocking',
  'stop_hook_prevented',
  'hook_stopped',
  'token_budget_continuation',
  'blocking_limit',
  'max_turns',
] as const;

// ── 4-A 判定全表拉远：17 行波纹显形 + 五行高亮（教学展开位） ───────────────

const GRID_4A = {x: 430, y: 118, w: 1180, rowH: 30, gap: 4} as const;

const FourA: React.FC<{atPush: number; atWave: number; atCount: number; atFive: number}> = ({atPush, atWave, atCount, atFive}) => {
  const frame = useCurrentFrame();
  const push = usePushIn(atPush, {scale: -0.06, dur: 40});
  // 波纹式显形：行延迟 = |行号 − 中心|（自中心向两侧展开，≈3s 铺满整幅）
  const rowIn = (i: number) => clamp01(progress(frame, atWave + Math.abs(i - 8) * 5, DUR.f3));
  // 波纹收束整幅定格可数（「十几种」词落位——轻脉冲一次）
  const settlePulse = Math.sin(Math.PI * clamp01(progress(frame, atCount, 18)));
  // 前 5 行高亮（教学版展开位——stagger 点亮；其余十二行缩略暗态）
  const five = [0, 1, 2, 3, 4].map((i) => clamp01(progress(frame, atFive + i * 5, DUR.f4)));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '50% 46%'}}>
        {/* 教学版三行分类表缩微（驻网格左上——三行是全表的活切片） */}
        <div style={{position: 'absolute', left: 130, top: 130}}>
          <RoutingTable x={0} y={0} w={520} h={250} litP={1} rowsLit={3} scale={0.4} />
        </div>
        <div style={{position: 'absolute', left: 130, top: 250, fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap', opacity: clamp01(progress(frame, atWave, 8))}}>{'教学版 · 三行'}</div>
        {/* 活切片连线（缩微表 → 高亮块——对应关系可追） */}
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <path d={`M 350 262 Q 420 220 ${GRID_4A.x - 10} ${GRID_4A.y + 5 * (GRID_4A.rowH + GRID_4A.gap) - 8}`} fill="none" stroke={withAlpha(theme.mech, 0.45)} strokeWidth={2.5} strokeDasharray="6 6" opacity={clamp01(five[4])} />
        </svg>
        {/* 17 行缩略网格（恢复蓝描边——波纹显形；每行右端去向小签） */}
        <div style={{position: 'absolute', left: GRID_4A.x, top: GRID_4A.y, width: GRID_4A.w, opacity: 1 + 0.012 * settlePulse}}>
          {VERDICT_ROWS.map((code, i) => {
            const p = rowIn(i);
            const hot = i < 5 ? five[i] : 0;
            return (
              <div
                key={`vr${i}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: i * (GRID_4A.rowH + GRID_4A.gap),
                  width: GRID_4A.w,
                  height: GRID_4A.rowH,
                  borderRadius: 7,
                  border: `2px solid ${hot > 0.35 ? withAlpha(theme.mech, 0.85) : withAlpha(theme.panelBorder, 0.8)}`,
                  background: hot > 0.35 ? withAlpha(theme.mech, 0.16) : withAlpha(theme.panel, 0.55),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '0 14px',
                  opacity: p * (hot > 0.35 ? 1 : 0.62),
                }}
              >
                <span style={{width: 26, fontFamily: theme.mono, fontSize: 13, color: hot > 0.35 ? theme.mech : theme.dim, whiteSpace: 'nowrap'}}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{fontFamily: theme.mono, fontSize: 14, color: hot > 0.35 ? theme.text : theme.dim, whiteSpace: 'nowrap', opacity: 0.9}}>{code}</span>
                {/* 去向小签（行右端） */}
                <span style={{marginLeft: 'auto', fontFamily: theme.mono, fontSize: 14, color: hot > 0.35 ? withAlpha(theme.mech, 0.9) : theme.dim, whiteSpace: 'nowrap'}}>{'→'}</span>
              </div>
            );
          })}
          {/* 教学展开括线（前 5 行——高亮块左缘） */}
          <div
            style={{
              position: 'absolute',
              left: -16,
              top: 0,
              width: 5,
              height: 5 * GRID_4A.rowH + 4 * GRID_4A.gap,
              borderRadius: 3,
              background: withAlpha(theme.mech, 0.7),
              opacity: clamp01(five[4]),
            }}
          />
        </div>
        {/* 行数读数（17 行可数——数字层与角标对账） */}
        <div style={{position: 'absolute', left: GRID_4A.x + GRID_4A.w + 26, top: GRID_4A.y + 8 * (GRID_4A.rowH + GRID_4A.gap) - 6, fontFamily: theme.mono, fontSize: 20, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap', opacity: clamp01(progress(frame, atCount, 10))}}>
          {'17 行'}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'reason/transition 全表（17 行） · 教学版展开前 5 行'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-B 增量检查特写（单句镜）：三格递减 + 判停签落下 ───────────────────────

const FourB: React.FC<{atBars: number; atStop: number}> = ({atBars, atStop}) => {
  const frame = useCurrentFrame();
  const bars = [0, 1, 2].map((i) => clamp01(progress(frame, atBars + i * 9, DUR.f4)));
  const flash = bars.map((b) => Math.sin(Math.PI * b));
  const stop = clamp01(progress(frame, atStop, DUR.f5));
  const stopDrop = Math.sin(Math.PI * clamp01(stop)) * 0.4 + stop * 0.6;
  return (
    <AbsoluteFill>
      {/* 续写块（承 1-B 续写签同款——目标件） */}
      <div
        style={{
          position: 'absolute',
          left: 740,
          top: 350,
          width: 420,
          height: 180,
          borderRadius: 14,
          border: `3.5px solid ${withAlpha(theme.mech, 0.8)}`,
          background: withAlpha(theme.panel, 0.96),
          padding: '18px 22px',
          opacity: clamp01(progress(frame, 4, DUR.f4)),
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.mech, whiteSpace: 'nowrap'}}>{'续写'}</div>
        <div style={{display: 'flex', gap: 10, marginTop: 14}}>
          {[0, 1, 2].map((k) => (
            <span key={`wb${k}`} style={{width: 108, height: 13, borderRadius: 4, background: withAlpha(theme.dim, 0.3)}} />
          ))}
        </div>
      </div>
      {/* 增量检查小卡（上浮——三格增量条逐格递减） */}
      <div
        style={{
          position: 'absolute',
          left: 760,
          top: 178,
          width: 380,
          borderRadius: 12,
          border: `3px solid ${withAlpha(theme.mech, 0.6)}`,
          background: withAlpha(theme.panel, 0.98),
          padding: '14px 20px',
          opacity: clamp01(progress(frame, 4, DUR.f4)),
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{'增量检查'}</div>
        <div style={{display: 'flex', gap: 14, alignItems: 'flex-end', marginTop: 12, height: 56}}>
          {[0, 1, 2].map((i) => {
            const p = bars[i];
            const w = [148, 92, 44][i];
            return (
              <div
                key={`ib${i}`}
                style={{
                  width: w,
                  height: 40,
                  borderRadius: 6,
                  border: `2.5px solid ${p > 0.35 ? theme.mech : theme.panelBorder}`,
                  background: p > 0.35 ? withAlpha(theme.mech, 0.2 + 0.15 * flash[i]) : 'transparent',
                  opacity: 0.35 + 0.65 * p,
                  boxShadow: flash[i] > 0.05 ? `0 0 ${12 * flash[i]}px ${withAlpha(theme.mech, 0.5)}` : 'none',
                }}
              />
            );
          })}
        </div>
      </div>
      {/* 判停签（红边——落下压住续写块；唯一红边元素） */}
      {stop > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 856,
            top: 282 + (1 - stopDrop) * -120,
            padding: '8px 26px',
            borderRadius: 10,
            border: `3.5px solid ${theme.danger}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 24,
            fontWeight: 700,
            color: theme.danger,
            whiteSpace: 'nowrap',
            opacity: stop,
            transform: `rotate(${(1 - stop) * -10}deg)`,
            boxShadow: `0 0 ${18 * stop}px ${withAlpha(theme.danger, 0.45)}`,
            zIndex: 3,
          }}
        >
          {'判停'}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'tokenBudget.ts · diminishing returns（连续 3 次增量太小）'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C 参数对照天平：两卡入场 → 升起 → 右卡逐行点亮 → 摇摆水平定格 ───────

const FourC: React.FC<{atCards: number; atRise: number; atRows: number[]; atSway: number; atTagL: number; atTagR: number}> = ({atCards, atRise, atRows, atSway, atTagL, atTagR}) => {
  const frame = useCurrentFrame();
  const cards = clamp01(progress(frame, atCards, DUR.f5));
  const rise = clamp01(progress(frame, atRise, DUR.f5 + 8));
  const rightRows = atRows.reduce((acc, a) => acc + clamp01(progress(frame, a, DUR.f4)), 0);
  // 等权重摇摆 → 水平定格（衰减正弦——峰值不倾斜定格；0=水平=都对）
  const sway = clamp01(progress(frame, atSway, 56));
  const tilt = 0.55 * Math.sin(sway * Math.PI * 3) * (1 - sway);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, opacity: cards}}>
        <BalanceScale
          x={460}
          y={130}
          w={1000}
          h={600}
          riseP={rise}
          tilt={tilt}
          rightRowsLit={rightRows}
          tagLit={{left: clamp01(progress(frame, atTagL, DUR.f4)), right: clamp01(progress(frame, atTagR, DUR.f4))}}
          litP={1}
        />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'ESCALATED_MAX_TOKENS=16000 · MAX_RETRIES=3 · MAX_CONSECUTIVE_529=2'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-D 收束预备：参数溶解归骨架 + 线稿点亮分层 + 收拢交棒 ─────────────────

/** 骨架线稿环体位（与 LoopRing 同形几何：r = size/2 - 46——线稿=同一主体白描态） */
const SKEL = {x: 690, y: 210, size: 480} as const;

const FourD: React.FC<{atDissolve: number; atLight: number; atLayer: number; atPush: number}> = ({atDissolve, atLight, atLayer, atPush}) => {
  const frame = useCurrentFrame();
  const dissolve = clamp01(progress(frame, atDissolve, 42));
  // 碎片汇入（两卡自外向内溶解——6 枚确定性碎片飞向线稿描边）
  const frag = clamp01(progress(frame, atDissolve + 6, 40));
  // 骨架线稿点亮一拍 + 机制/选择分层微光（壳位 vs 主体分层）
  const light = Math.sin(Math.PI * clamp01(progress(frame, atLight, 30))) * 0.5 + clamp01(progress(frame, atLight, 30)) * 0.5;
  const layer = clamp01(progress(frame, atLayer, DUR.f5));
  const push = usePushIn(atPush, {scale: 0.06, dur: 40});
  const cx = SKEL.size / 2;
  const r = SKEL.size / 2 - 46;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '50% 50%' }}>
        {/* 残余参数卡影（溶解尾迹——自外向内收拢渐隐） */}
        {[
          {x: 320, y: 300},
          {x: 1380, y: 300},
        ].map((pos, i) => (
          <div
            key={`dk${i}`}
            style={{
              position: 'absolute',
              left: pos.x + (i === 0 ? 1 : -1) * 120 * dissolve,
              top: pos.y,
              width: 260,
              height: 200,
              borderRadius: 14,
              border: `3px solid ${withAlpha(theme.mech, 0.4 * (1 - dissolve))}`,
              background: withAlpha(theme.panel, 0.4 * (1 - dissolve)),
              opacity: 1 - dissolve,
            }}
          />
        ))}
        {/* 骨架线稿（恢复蓝细线——环体同形白描；线稿态细线无气泡） */}
        <div style={{position: 'absolute', left: SKEL.x, top: SKEL.y, opacity: 0.5 + 0.5 * light}}>
          <svg width={SKEL.size} height={SKEL.size} viewBox={`0 0 ${SKEL.size} ${SKEL.size}`} style={{overflow: 'visible'}}>
            <circle cx={cx} cy={cx} r={r} fill="none" stroke={withAlpha(theme.mech, 0.55 + 0.4 * light)} strokeWidth={2.5} />
            {/* 「调用模型」段位（机构层微光——段弧加粗） */}
            <path
              d={`M ${cx + r * Math.cos((-120 * Math.PI) / 180)} ${cx + r * Math.sin((-120 * Math.PI) / 180)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos((-60 * Math.PI) / 180)} ${cx + r * Math.sin((-60 * Math.PI) / 180)}`}
              fill="none"
              stroke={withAlpha(theme.mech, 0.7 + 0.3 * layer)}
              strokeWidth={4.5 + 3 * layer}
              strokeLinecap="round"
            />
            {/* 保护壳线稿（选择层——壳位分层微光） */}
            <path
              d={`M ${cx + (r + 26) * Math.cos((-132 * Math.PI) / 180)} ${cx + (r + 26) * Math.sin((-132 * Math.PI) / 180)} A ${r + 26} ${r + 26} 0 0 1 ${cx + (r + 26) * Math.cos((-48 * Math.PI) / 180)} ${cx + (r + 26) * Math.sin((-48 * Math.PI) / 180)}`}
              fill="none"
              stroke={withAlpha(theme.mech, 0.5 + 0.45 * layer)}
              strokeWidth={2.5}
              strokeDasharray="8 7"
            />
            {/* 分类分发位线稿（环底三分支 + 小表轮廓——分发位分层微光） */}
            {[-1, 0, 1].map((k) => {
              const bx = cx + k * 86;
              return (
                <g key={`bf${k}`} opacity={0.5 + 0.5 * layer}>
                  <line x1={cx + k * 30} y1={cx + r - 4} x2={bx} y2={cx + r + 64} stroke={withAlpha(theme.mech, 0.55)} strokeWidth={2} strokeDasharray="5 6" />
                  <rect x={bx - 26} y={cx + r + 64} width={52} height={32} rx={7} fill="none" stroke={withAlpha(theme.mech, 0.55)} strokeWidth={2} strokeDasharray="4 5" />
                </g>
              );
            })}
          </svg>
        </div>
        {/* 碎片（参数归于骨架——确定性轨迹飞向描边） */}
        {frag > 0.02 && frag < 0.98
          ? Array.from({length: 6}, (_, i) => {
              const fromX = i < 3 ? 380 : 1460;
              const fromY = 340 + (i % 3) * 60;
              const ang = -135 + i * 22;
              const tx = SKEL.x + cx + r * 0.92 * Math.cos((ang * Math.PI) / 180);
              const ty = SKEL.y + cx + r * 0.92 * Math.sin((ang * Math.PI) / 180);
              const fx = fromX + (tx - fromX) * frag;
              const fy = fromY + (ty - fromY) * frag;
              return (
                <div
                  key={`fg${i}`}
                  style={{
                    position: 'absolute',
                    left: fx,
                    top: fy,
                    width: 14,
                    height: 9,
                    borderRadius: 2,
                    background: withAlpha(theme.mech, 0.85),
                    opacity: 1 - frag,
                    transform: `rotate(${i * 41 + frag * 120}deg)`,
                  }}
                />
              );
            })
          : null}
        {/* 分层注记（机制层 / 选择层——关键词签） */}
        {layer > 0.5 ? (
          <>
            <div style={{position: 'absolute', left: SKEL.x - 128, top: SKEL.y + 20, fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: withAlpha(theme.mech, 0.9), whiteSpace: 'nowrap', opacity: layer}}>{'机制 · 骨架'}</div>
            <div style={{position: 'absolute', left: SKEL.x + SKEL.size - 60, top: SKEL.y - 44, fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: withAlpha(theme.mech, 0.75), whiteSpace: 'nowrap', opacity: layer}}>{'选择 · 预算'}</div>
          </>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'骨架是机制 · 预算是选择'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P4ProductionDuel: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p4-01', 'p4-02');
  const bB = w('p4-02b');
  const bC = w('p4-03', 'p4-05');
  const bD = w('p4-06', 'p4-07');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <FourA
          atPush={0}
          atWave={wa('p4-01', 0.22) - bA.from}
          atCount={wa('p4-01', 0.7) - bA.from}
          atFive={wa('p4-02', 0.3) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <FourB atBars={wa('p4-02b', 0.26) - bB.from} atStop={wa('p4-02b', 0.66) - bB.from} />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <FourC
          atCards={wa('p4-03', 0.16) - bC.from}
          atRise={wa('p4-03', 0.72) - bC.from}
          atRows={[wa('p4-04', 0.28), wa('p4-04', 0.5), wa('p4-04', 0.72)].map((v) => v - bC.from)}
          atSway={wa('p4-05', 0.15) - bC.from}
          atTagL={wa('p4-05', 0.55) - bC.from}
          atTagR={wa('p4-05', 0.8) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="4-D">
        <FourD
          atDissolve={wa('p4-06', 0.42) - bD.from}
          atLight={wa('p4-07', 0.12) - bD.from}
          atLayer={wa('p4-07', 0.3) - bD.from}
          atPush={wa('p4-07', 0.62) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4ProductionDuel;
