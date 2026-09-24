/** P3 把握对账（p3-01..28）——M3 概率 · 校准 · 对账（calib 兰紫）。
 *  失火 / 嘴硬 / 准确率红降由 danger 承担；温度缩放后的防线语义用 ok。
 *  七镜：3-A 训练目标 → 3-B 读数公式（图）→ 3-C 校准台阶（图）→ 3-D 对账与温度（图）
 *  → 3-E 原型对照 → 3-F 拆校准的账单 → 3-G 分布外两难。
 *  图例 cue 均锚单句；本幕各实例间 cue 均隔 ≥1 句空窗，无跨实例背靠背（无需 lead 抑制）。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useCount, useDraw, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge, LedgerBars, Stage, TerminalFeed} from '../components/devices';

/** 16 进色插值：calib → danger 的台阶渐变（纯函数）。 */
const mixHex = (a: string, b: string, t: number): string => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa
    .map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0'))
    .join('')}`;
};

/** 3-A 对齐卡：说八成 ↔ 十次对八次（useDraw 对齐刻度，十枚圆点随句点亮）。 */
const AlignScale: React.FC<{at: number; dotsAt: number}> = ({at, dotsAt}) => {
  const frame = useCurrentFrame();
  const draw = useDraw(at, DUR.f5);
  const o = useProgress(at, DUR.f4);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34, opacity: o}}>
      <div style={{fontFamily: theme.serif, fontSize: 32, color: theme.text}}>校准训练目标</div>
      <div style={{display: 'flex', alignItems: 'center', gap: 30}}>
        <div
          style={{
            padding: '18px 32px',
            borderRadius: 12,
            border: `2.5px solid ${theme.calib}`,
            background: `${theme.calib}14`,
            textAlign: 'center',
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.calib}}>说八成</div>
          <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>嘴上的把握</div>
        </div>
        <svg width={210} height={130} viewBox="0 0 210 130">
          <path
            d="M 6 65 C 76 65, 76 28, 144 28 M 144 28 L 132 20 M 144 28 L 132 36 M 6 65 C 76 65, 76 102, 144 102 M 144 102 L 132 94 M 144 102 L 132 110"
            fill="none"
            stroke={theme.calib}
            strokeWidth={3}
            strokeLinecap="round"
            {...draw}
          />
        </svg>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14}}>
          <div style={{display: 'flex', gap: 12}}>
            {Array.from({length: 10}, (_, i) => {
              // map 内纯函数派生（progress），不调 hook（铁律①）
              const on = progress(frame, dotsAt + i * 2, DUR.f2);
              const hit = i < 8;
              return (
                <div
                  key={i}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: on > 0.5 && hit ? theme.calib : 'transparent',
                    border: `2.5px solid ${hit ? theme.calib : theme.panelBorder}`,
                    transform: `scale(${0.6 + 0.4 * on})`,
                  }}
                />
              );
            })}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>就该十次对八次</div>
          <div
            style={{
              padding: '6px 18px',
              borderRadius: 999,
              border: `2px solid ${theme.calib}88`,
              fontFamily: theme.sans,
              fontSize: 21,
              color: theme.calib,
            }}
          >
            对齐 = 校准
          </div>
        </div>
      </div>
    </div>
  );
};

/** 3-B 公式卡：把握读数 =（最高概率 − 瞎猜线）÷ 归一化（useProgress 分段点亮）。 */
const ReadoutFormula: React.FC<{at: number; sweepAt: number}> = ({at, sweepAt}) => {
  const o = useProgress(at, DUR.f4);
  const sweep = useProgress(sweepAt, DUR.f6);
  const segs = [
    {pre: '(', t: '最高概率'},
    {pre: ' − ', t: '瞎猜线'},
    {pre: ') ÷ ', t: '归一化'},
  ];
  return (
    <Panel accent={`${theme.calib}88`} style={{width: 1180, padding: '22px 30px', opacity: o}}>
      <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.calib}}>
        {'官方适配器代码 · 固定公式'}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: 6,
          marginTop: 12,
          fontFamily: theme.mono,
          fontSize: 34,
        }}
      >
        <span style={{color: theme.text}}>{'把握读数 ='}</span>
        {segs.map((s, i) => {
          const lit = Math.min(1, Math.max(0, sweep * 3 - i));
          return (
            <span key={s.t} style={{display: 'inline-flex', alignItems: 'baseline'}}>
              <span style={{color: theme.dim}}>{s.pre}</span>
              <span
                style={{
                  color: lit > 0.5 ? theme.calib : theme.dim,
                  background: lit > 0.5 ? `${theme.calib}22` : 'transparent',
                  padding: '2px 10px',
                  borderRadius: 8,
                }}
              >
                {s.t}
              </span>
            </span>
          );
        })}
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 10}}>
        不是模型自己悟出来的——只是概率分布的另一种读法
      </div>
    </Panel>
  );
};

/** 3-C 校准台阶：0.03 → 0.107 → 0.246 逐句逐级落下（纯函数 progress 派生，calib→danger 渐变）
 *  + 「承认不知道」对比条（useCount：大模型 97.3–100% vs 老分拣员 49.7%）。 */
/** 三级台阶各锚自己那一句（p3-10/11/12）：旁白逐级报数，画面逐级落下；
 *  当前句那一级描边加粗提亮，其余压暗——持续态画面 + 随句推进的焦点（M-003）。 */
const EceSteps: React.FC<{stepAts: [number, number, number]; cmpAt: number}> = ({stepAts, cmpAt}) => {
  const frame = useCurrentFrame();
  const cmpIn = useProgress(cmpAt, DUR.f4);
  const lit = useProgress(stepAts[0], DUR.f4);
  // 铁律①：逐级入场与焦点用纯函数派生（map 内不调 hook）
  const st = stepAts.map((a) => progress(frame, a, DUR.f5));
  const focusIdx = stepAts.reduce((acc, a, i) => (frame >= a ? i : acc), -1);
  const big = useCount({from: 0, to: 97.3, at: cmpAt, dur: DUR.f6});
  const small = useCount({from: 0, to: 49.7, at: cmpAt, dur: DUR.f6});
  const steps = [
    {v: '0.03', name: '分布内基准', h: 57},
    {v: '0.107', name: '合成工单', h: 126},
    {v: '0.246', name: '强制不确定', h: 251},
  ];
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 90}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16}}>
        <div style={{fontFamily: theme.serif, fontSize: 30, color: theme.text, opacity: 0.4 + 0.6 * lit}}>校准误差 ECE · 越右越嘴硬</div>
        <div style={{display: 'flex', alignItems: 'flex-end', gap: 20}}>
          {steps.map((s, i) => {
            const c = mixHex(theme.calib, theme.danger, i / 2);
            return (
              <div
                key={s.v}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  opacity: st[i] * (focusIdx === i || focusIdx < 0 ? 1 : 0.5),
                  transform: `translateY(${(1 - st[i]) * -34}px)`,
                }}
              >
                <div style={{fontFamily: theme.mono, fontSize: focusIdx === i ? 36 : 30, color: c}}>{s.v}</div>
                <div
                  style={{
                    width: 150,
                    height: s.h,
                    borderRadius: '10px 10px 0 0',
                    background: `${c}${focusIdx === i ? '40' : '26'}`,
                    border: `${focusIdx === i ? 4 : 2.5}px solid ${c}`,
                    borderBottom: 'none',
                  }}
                />
                <div
                  style={{
                    width: 190,
                    textAlign: 'center',
                    borderTop: `2.5px solid ${theme.panelBorder}`,
                    paddingTop: 8,
                    fontFamily: theme.sans,
                    fontSize: 21,
                    color: theme.dim,
                  }}
                >
                  {s.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Panel accent={theme.panelBorder} style={{width: 500, padding: '22px 26px', opacity: cmpIn}}>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>肯说「不知道」的比例</div>
        <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 4}}>
          同一批「该认不知道」的题
        </div>
        {[
          {label: '大模型', v: big, suffix: '–100%', c: theme.ok},
          {label: '老分拣员', v: small, suffix: '%', c: theme.danger},
        ].map((r) => (
          <div key={r.label} style={{marginTop: 20}}>
            <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.sans, fontSize: 22}}>
              <span style={{color: theme.text}}>{r.label}</span>
              <span style={{fontFamily: theme.mono, color: r.c}}>
                {r.v.toFixed(1)}
                {r.suffix}
              </span>
            </div>
            <div style={{height: 28, borderRadius: 8, background: theme.panelBorder, marginTop: 8}}>
              <div
                style={{
                  height: 28,
                  borderRadius: 8,
                  background: r.c,
                  width: `${Math.min(100, r.v)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
};

/** 3-D 对账账本两栏（useStagger）+ 统一打折印章（useImpulse 盖章辉光）。 */
const TempLedger: React.FC<{at: number; stampAt: number; noteAt: number}> = ({at, stampAt, noteAt}) => {
  const frame = useCurrentFrame();
  const st = useStagger(2, {at, dur: DUR.f4, stride: 8});
  const imp = useImpulse({at: stampAt, dur: DUR.f6, peak: 1});
  const note = useProgress(noteAt, DUR.f4);
  const landed = progress(frame, stampAt, DUR.f4);
  const cols = [
    {t: '自称把握', tag: '「十拿九稳」', h: 198, c: theme.calib},
    {t: '实际命中', tag: '对不上', h: 145, c: theme.dim},
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30}}>
      <div style={{fontFamily: theme.serif, fontSize: 32, color: theme.text}}>定期对账：自称 vs 实际</div>
      <div style={{position: 'relative'}}>
        <div style={{display: 'flex', gap: 120, alignItems: 'flex-end'}}>
          {cols.map((c2, i) => (
            <div
              key={c2.t}
              style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: st[i]}}
            >
              <div style={{fontFamily: theme.sans, fontSize: 24, color: c2.c}}>{c2.tag}</div>
              <div
                style={{
                  width: 150,
                  height: c2.h,
                  borderRadius: '10px 10px 0 0',
                  background: `${c2.c}2E`,
                  border: `2.5px solid ${c2.c}`,
                  borderBottom: 'none',
                }}
              />
              <div
                style={{
                  width: 190,
                  textAlign: 'center',
                  borderTop: `2.5px solid ${theme.panelBorder}`,
                  paddingTop: 8,
                  fontFamily: theme.sans,
                  fontSize: 24,
                  color: theme.text,
                }}
              >
                {c2.t}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 26,
            transform: `translate(-50%, 0) rotate(-9deg) scale(${1 + 0.7 * (1 - landed)})`,
            opacity: landed,
            border: `4px solid ${theme.danger}`,
            color: theme.danger,
            borderRadius: 12,
            padding: '10px 28px',
            fontFamily: theme.serif,
            fontSize: 38,
            background: '#0E1116E6',
            boxShadow: `0 0 ${Math.round(36 * imp)}px ${theme.danger}55`,
            whiteSpace: 'nowrap',
          }}
        >
          统一打折
          <div style={{fontSize: 19, fontFamily: theme.mono, textAlign: 'center', marginTop: 2}}>
            {'温度缩放 · T↑'}
          </div>
        </div>
      </div>
      <div style={{display: 'flex', gap: 18, opacity: note}}>
        {['排序不动', '准确率不动'].map((t) => (
          <span
            key={t}
            style={{
              padding: '8px 22px',
              borderRadius: 999,
              border: `2px solid ${theme.dim}88`,
              color: theme.dim,
              fontFamily: theme.sans,
              fontSize: 23,
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
};

/** 3-E 原型对照双面板（useProgress 交叉亮）：未校准账面好看车间失火 → 校准后误差归位。 */
const FireLedger: React.FC<{aAt: number; flameAt: number; bAt: number}> = ({aAt, flameAt, bAt}) => {
  const frame = useCurrentFrame();
  const a = useProgress(aAt, DUR.f5);
  const b = useProgress(bAt, DUR.f5);
  const flame = useImpulse({at: flameAt, dur: DUR.f6, peak: 1});
  const dimA = progress(frame, bAt, DUR.f6) * 0.35; // 校准后面板登场后，未校准面板压暗
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 40}}>
      <Panel accent={`${theme.danger}99`} style={{width: 520, padding: '24px 28px', opacity: a * (1 - dimA)}}>
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.danger}}>{'未校准 · 直投'}</div>
        <div style={{fontFamily: theme.mono, fontSize: 52, color: theme.text, marginTop: 8}}>{'直投 68%'}</div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14}}>
          <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.calib}}>
            自称只错 0.7% —— 账面好看
          </div>
          <div
            style={{
              fontFamily: theme.sans,
              fontSize: 23,
              color: theme.danger,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: 38,
                transform: `scale(${1 + 0.35 * flame})`,
                textShadow: `0 0 ${Math.round(22 * flame + 6)}px ${theme.danger}`,
                opacity: progress(frame, flameAt, DUR.f3),
              }}
            >
              🔥
            </span>
            <span>实际错 12% —— 车间失火</span>
          </div>
        </div>
      </Panel>
      <div style={{fontFamily: theme.serif, fontSize: 44, color: theme.dim, opacity: b}}>{'→'}</div>
      <Panel
        accent={`${theme.calib}99`}
        style={{width: 520, padding: '24px 28px', opacity: b, transform: `translateX(${(1 - b) * 30}px)`}}
      >
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.calib}}>{'校准后'}</div>
        <div style={{fontFamily: theme.mono, fontSize: 52, color: theme.text, marginTop: 8}}>
          {'直投 19.7%'}
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14}}>
          <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.ok}}>误差归位</div>
          <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>
            其余 → 复核 / 人工
          </div>
        </div>
      </Panel>
    </div>
  );
};

/** 3-F 成本头条：useCount 从 10.8 滚落到 4.6（与账柱同锚）。 */
const CostHead: React.FC<{at: number}> = ({at}) => {
  const v = useCount({from: 10.8, to: 4.6, at, dur: DUR.f6});
  return (
    <div style={{display: 'flex', alignItems: 'baseline', gap: 18, fontFamily: theme.mono}}>
      <span style={{fontSize: 30, color: theme.dim}}>{'成本'}</span>
      <span style={{fontSize: 30, color: theme.dim, textDecoration: 'line-through'}}>10.8</span>
      <span style={{fontSize: 30, color: theme.dim}}>{'→'}</span>
      <span style={{fontSize: 48, color: theme.ok}}>{v.toFixed(1)}</span>
      <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>看着省了一半多</span>
    </div>
  );
};

/** 3-F 准确率线：0.972 → 0.91（useDraw 红降；y 轴 0.85..1.00 线性）。 */
const AccLine: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const draw = useDraw(at, DUR.f6);
  const end = progress(frame, at + 20, DUR.f4);
  const y = (v: number) => 170 - ((v - 0.85) / 0.15) * 140;
  return (
    <Panel accent={`${theme.danger}88`} style={{width: 560, padding: '20px 26px'}}>
      <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.danger}}>{'整体准确率 · 红降'}</div>
      <svg width={500} height={210} viewBox="0 0 500 210">
        {[0.85, 0.9, 0.95, 1.0].map((g) => (
          <g key={g}>
            <line
              x1={60}
              x2={460}
              y1={y(g)}
              y2={y(g)}
              stroke={theme.panelBorder}
              strokeWidth={1.5}
              strokeDasharray="4 8"
            />
            <text x={52} y={y(g) + 5} textAnchor="end" fontFamily={theme.mono} fontSize={16} fill={theme.dim}>
              {g.toFixed(2)}
            </text>
          </g>
        ))}
        <path
          d={`M 60 ${y(0.972)} C 180 ${y(0.972)}, 300 ${y(0.93)}, 460 ${y(0.91)}`}
          fill="none"
          stroke={theme.danger}
          strokeWidth={4}
          strokeLinecap="round"
          {...draw}
        />
        <circle cx={60} cy={y(0.972)} r={5} fill={theme.danger} />
        <circle cx={460} cy={y(0.91)} r={5} fill={theme.danger} opacity={end} />
        <text x={60} y={y(0.972) - 16} fontFamily={theme.mono} fontSize={22} fill={theme.text}>
          0.972
        </text>
        <text
          x={458}
          y={y(0.91) + 32}
          textAnchor="end"
          fontFamily={theme.mono}
          fontSize={22}
          fill={theme.danger}
          opacity={end}
        >
          0.91
        </text>
      </svg>
    </Panel>
  );
};

/** 3-F 金句压条：useSpring 空间通道 + progress 透明度（effects 不吃弹簧，铁律③）。 */
const QuoteBar: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const press = useSpring('settle', {at, dur: DUR.f6});
  const o = progress(frame, at, DUR.f4);
  return (
    <div style={{opacity: o, transform: `translateY(${(1 - press) * 44}px) scale(${1 + 0.06 * (1 - press)})`}}>
      <div
        style={{
          padding: '16px 44px',
          borderRadius: 12,
          border: `2.5px solid ${theme.danger}99`,
          borderLeft: `8px solid ${theme.danger}`,
          background: `${theme.danger}12`,
        }}
      >
        <span style={{fontFamily: theme.serif, fontSize: 34, color: theme.text}}>
          拆看得见的成本，烧看不见的质量
        </span>
      </div>
    </div>
  );
};

/** 3-G 双门对开（useProgress）：嘴硬门 danger / 闭嘴门 calib，中间「免费中庸」
 *  通道以 ⌀ 划掉（useDraw）——要么嘴硬，要么闭嘴。 */
const TwoDoors: React.FC<{headAt: number; openAt: number; strikeAt: number; endAt: number}> = ({
  headAt,
  openAt,
  strikeAt,
  endAt,
}) => {
  const frame = useCurrentFrame();
  const head = useProgress(headAt, DUR.f4);
  const swing = useProgress(openAt, DUR.f6);
  const draw = useDraw(strikeAt, DUR.f4);
  const end = useProgress(endAt, DUR.f4);
  const struck = progress(frame, strikeAt + 6, DUR.f3);
  const doors = [
    {t: '嘴硬', s: '照投 · 把握虚高', inner: '错误照单执行', c: theme.danger},
    {t: '闭嘴', s: '全升级 · 直投归零', inner: '流量涌向复核与人工', c: theme.calib},
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, perspective: 900}}>
      <div style={{fontFamily: theme.serif, fontSize: 32, color: theme.text, opacity: head}}>
        分布外的选择题
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 60}}>
        {doors.map((d, i) => (
          <React.Fragment key={d.t}>
            {i === 1 ? (
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
                <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>免费中庸</div>
                <div style={{position: 'relative', width: 120, height: 120}}>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: theme.mono,
                      fontSize: 76,
                      color: theme.dim,
                    }}
                  >
                    ⌀
                  </div>
                  <svg width={120} height={120} viewBox="0 0 120 120" style={{position: 'absolute', inset: 0}}>
                    <line
                      x1={14}
                      y1={104}
                      x2={106}
                      y2={16}
                      stroke={theme.danger}
                      strokeWidth={5}
                      strokeLinecap="round"
                      {...draw}
                    />
                  </svg>
                </div>
                <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.danger, opacity: struck}}>
                  不存在
                </div>
              </div>
            ) : null}
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
              <div style={{fontFamily: theme.serif, fontSize: 36, color: d.c}}>{d.t}</div>
              <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>{d.s}</div>
              <div
                style={{
                  width: 320,
                  height: 330,
                  borderRadius: 14,
                  border: `3px solid ${d.c}`,
                  background: `${d.c}0F`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 128,
                    textAlign: 'center',
                    fontFamily: theme.sans,
                    fontSize: 23,
                    color: theme.dim,
                    padding: '0 24px',
                  }}
                >
                  {d.inner}
                </div>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `${d.c}26`,
                    border: `2px solid ${d.c}66`,
                    borderRadius: 11,
                    transformOrigin: i === 0 ? 'left center' : 'right center',
                    transform: `rotateY(${(i === 0 ? -1 : 1) * 78 * swing}deg)`,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      right: i === 0 ? 18 : undefined,
                      left: i === 1 ? 18 : undefined,
                      width: 14,
                      height: 14,
                      marginTop: -7,
                      borderRadius: '50%',
                      background: d.c,
                    }}
                  />
                </div>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
      <div style={{fontFamily: theme.serif, fontSize: 30, color: theme.text, opacity: end}}>
        二选一 · 中庸要另付代价
      </div>
    </div>
  );
};

export const P3Calib: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  // 与 at 对称的取长辅助：非 beat 用途一律走它，不写 w('句id') 字面形态
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p3-01', 'p3-03');
  const bB = w('p3-04', 'p3-08');
  const bC = w('p3-09', 'p3-14');
  const bD = w('p3-15', 'p3-18');
  const bE = w('p3-19', 'p3-22');
  const bF = w('p3-23', 'p3-25');
  const bG = w('p3-26', 'p3-28');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A 校准训练目标">
        <SceneTag chapter="P3" tagline="把握对账" accent={theme.calib} />
        <EvidenceBadge text="RLCD · 校准训练配方未公开" at={at('p3-03') - bA.from} />
        <Stage>
          <AlignScale at={at('p3-02') - bA.from} dotsAt={at('p3-02') - bA.from + 16} />
        </Stage>
      </Sequence>

      <Sequence {...bB} name="3-B 把握读数公式">
        {/* 可见岛 p3-04/05/07：公式卡前两句铺陈，复算终端在 p3-07 岛句滚入 */}
        <SceneTag chapter="P3" tagline="把握对账" accent={theme.calib} />
        <ArchifyYield
          cues={[
            {at: at('p3-06') - bB.from, durationInFrames: dur('p3-06')},
            {at: at('p3-08') - bB.from, durationInFrames: dur('p3-08')},
          ]}
        >
          <Stage>
            <div style={{display: 'flex', flexDirection: 'column', gap: 34, alignItems: 'center'}}>
              <ReadoutFormula at={at('p3-04') - bB.from} sweepAt={at('p3-05') - bB.from} />
              <TerminalFeed
                title="recompute_confidence.py"
                at={at('p3-07') - bB.from}
                lines={[
                  {text: 'choice [0.88, 0.12, 0.00]  ->  readout = 0.820  (doc 0.81)', ok: true},
                  {text: 'score  [0.00, 0.95, 0.05]  ->  readout = 0.925  (doc 0.92)', ok: true},
                  {text: '# 全部可复算——只是概率分布的另一种读法'},
                ]}
              />
            </div>
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="confidence-readout"
          caption="把握读数公式"
          cues={[
            {chapterId: 'cr-formula', at: at('p3-06') - bB.from, durationInFrames: dur('p3-06')},
            {chapterId: 'cr-no-new-info', at: at('p3-08') - bB.from, durationInFrames: dur('p3-08')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="3-C 校准台阶">
        {/* 可见岛 p3-09..11 / 13 / 14：三级台阶随前三句落下，对比条压 p3-14 */}
        <SceneTag chapter="P3" tagline="把握对账" accent={theme.calib} />
        <Footnote delay={at('p3-10') - bC.from}>
          {'分布内 0.03 · 合成工单 0.107 · 强制不确定 0.246 — 三组第三方实测'}
        </Footnote>
        <ArchifyYield cues={[{at: at('p3-12') - bC.from, durationInFrames: dur('p3-12')}]}>
          <Stage>
            <EceSteps
              stepAts={[at('p3-10') - bC.from, at('p3-11') - bC.from, at('p3-12') - bC.from]}
              cmpAt={at('p3-14') - bC.from}
            />
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="calibration-ladder"
          caption="校准台阶三级"
          cues={[{chapterId: 'cl-ladder', at: at('p3-12') - bC.from, durationInFrames: dur('p3-12')}]}
        />
      </Sequence>

      <Sequence {...bD} name="3-D 对账与温度">
        {/* 可见岛 p3-15 / 17：账本两栏在首句立起，印章盖在「温度缩放」句；p3-18 边界
            旁注提前到 p3-17 后半句落位（cue 窗内由图接管） */}
        <SceneTag chapter="P3" tagline="把握对账" accent={theme.calib} />
        <ArchifyYield
          cues={[
            {at: at('p3-16') - bD.from, durationInFrames: dur('p3-16')},
            {at: at('p3-18') - bD.from, durationInFrames: dur('p3-18')},
          ]}
        >
          <Stage>
            <TempLedger
              at={at('p3-15') - bD.from}
              stampAt={at('p3-17') - bD.from}
              noteAt={at('p3-17') - bD.from + Math.round(dur('p3-17') * 0.7)}
            />
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="calibration-ladder"
          caption="对账与温度打折"
          cues={[
            {chapterId: 'cl-ledger', at: at('p3-16') - bD.from, durationInFrames: dur('p3-16')},
            {chapterId: 'cl-temperature', at: at('p3-18') - bD.from, durationInFrames: dur('p3-18')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="3-E 原型对照">
        <SceneTag chapter="P3" tagline="把握对账" accent={theme.calib} />
        <EvidenceBadge text="S8 对照 — 本仓简化原型" at={at('p3-19') - bE.from} />
        <Stage>
          <FireLedger
            aAt={at('p3-20') - bE.from}
            flameAt={at('p3-21') - bE.from}
            bAt={at('p3-22') - bE.from}
          />
        </Stage>
      </Sequence>

      <Sequence {...bF} name="3-F 拆校准的账单">
        <SceneTag chapter="P3" tagline="把握对账" accent={theme.calib} />
        <Stage>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24}}>
            <CostHead at={at('p3-23') - bF.from} />
            <div style={{display: 'flex', gap: 70, alignItems: 'center'}}>
              {/* 账柱计数只滚整数且 unit 为整组共用：两柱小数尾不同（.8 / .6），
                  故拆成两个单柱实例各带自己的 unit，max 同取 10 保柱高等比（10 : 4 ≈ 10.8 : 4.6） */}
              <div style={{display: 'flex', gap: 70, alignItems: 'flex-end'}}>
                <LedgerBars
                  at={at('p3-23') - bF.from}
                  items={[{label: '校准在岗', value: 10, color: theme.ok, note: '成本 10.8'}]}
                  unit=".8"
                  max={10}
                />
                <LedgerBars
                  at={at('p3-23') - bF.from}
                  items={[{label: '拆掉校准', value: 4, color: theme.ok, note: '成本 4.6 · 省一半多'}]}
                  unit=".6"
                  max={10}
                />
              </div>
              <AccLine at={at('p3-24') - bF.from} />
            </div>
            <QuoteBar at={at('p3-25') - bF.from} />
          </div>
        </Stage>
      </Sequence>

      <Sequence {...bG} name="3-G 分布外两难">
        <SceneTag chapter="P3" tagline="把握对账" accent={theme.calib} />
        <Stage>
          <TwoDoors
            headAt={at('p3-26') - bG.from}
            openAt={at('p3-27') - bG.from}
            strikeAt={at('p3-28') - bG.from}
            endAt={at('p3-28') - bG.from + Math.round(dur('p3-28') * 0.5)}
          />
        </Stage>
      </Sequence>
    </AbsoluteFill>
  );
};
