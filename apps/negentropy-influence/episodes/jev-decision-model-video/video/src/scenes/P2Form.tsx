/** P2 预印的格子＝机制一（p2-01..29，5 镜 10 cue）。
 *
 *  M-001 预报单全片首亮相：格黄描边＋三类行（Choice／Score／Noul）＋预印格。
 *  叙事链：三类行样张（archify 三连）→ 没有空白处（封边／≤255／其他格）→
 *  契约实证（原型 S10＋外测 nibzard 225/225 全拒收）→ 高潮「窗外大雨、单上晴」
 *  （conf 0.981〔M-003 定格〕）→ 口径收束「保证形状，不保证每个判断都对」。
 *  局部装置全收在本文件（ForecastSheet／NoBlankZone／ProtoDesk／TicketBoard／
 *  ZeroClaim／MiniMechMap＋三级角标 Badge）；components/ 公共件定形后可上收。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useBreathe,
  useCount,
  useDraw,
  useEnter,
  useImpulse,
  useProgress,
  usePushIn,
  useShake,
  useSpring,
  useStagger,
} from '../motion';
import {Panel, SceneTag} from '../components/motifs';
import {QuoteCard} from '../components/cards';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

// ── 小工具（纯函数）──────────────────────────────────────────────────────

const hexToRgb = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

/** 两 hex 间线性插值（帧驱动的边框/文字渐变，无随机） */
const mix = (a: string, b: string, t: number): string => {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(r1, r2)}, ${c(g1, g2)}, ${c(b1, b2)})`;
};

/** 紫色＝「不存在的选项」这一叙事内容本身（2-B 印章），一次性外来物、非概念色 */
const STAMP_INK = '#B18CFF';

// ── 三级角标（本地版；0-C 图例卡定形后由 BadgeTriad 收编）────────────────

type BadgeKind = 'official' | 'external' | 'recompute';

const Badge: React.FC<{kind: BadgeKind; who?: string; note?: string}> = ({kind, who, note}) => (
  <span style={{display: 'inline-flex', alignItems: 'center', gap: 9}}>
    <svg width={22} height={22} viewBox="0 0 22 22" style={{flexShrink: 0}}>
      {kind === 'recompute' ? (
        <>
          <circle cx={11} cy={11} r={8.5} fill={theme.text} />
          <path
            d="M6.6 11.5 L9.5 14.3 L15.4 7.9"
            fill="none"
            stroke={theme.bg}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <circle
          cx={11}
          cy={11}
          r={8.5}
          fill="none"
          stroke={theme.text}
          strokeWidth={2}
          strokeDasharray={kind === 'official' ? '3.2 3.2' : undefined}
        />
      )}
    </svg>
    <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, whiteSpace: 'nowrap'}}>
      {kind === 'official' ? '官方自报' : `${kind === 'external' ? '外测' : '复算'}·${who ?? ''}`}
    </span>
    {note ? (
      <span
        style={{
          fontFamily: theme.mono,
          fontSize: 16,
          fontStyle: 'italic',
          color: theme.dim,
          opacity: 0.78,
          whiteSpace: 'nowrap',
        }}
      >
        {note}
      </span>
    ) : null}
  </span>
);

/** 居中舞台（垂直列；y≥56 与底部字幕带由坐标选择保证） */
const Stage: React.FC<{children: React.ReactNode; gap?: number; y?: number}> = ({
  children,
  gap = 0,
  y = 0,
}) => (
  <AbsoluteFill
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap,
      transform: `translateY(${y}px)`,
    }}
  >
    {children}
  </AbsoluteFill>
);

// ── 2-A 预报单全貌（M-001 首亮相）───────────────────────────────────────

const CHOICE_CELLS = ['晴', '多云', '雨'] as const;
const GRADE_TICKS = ['无雨', '小雨', '小到中雨', '中雨', '大雨'] as const;

const ForecastSheet: React.FC<{
  /** p2-04：全貌展开（等级行同句滑出） */
  atForm: number;
  /** 「小到中雨」档高亮（p2-04 句中） */
  atGradeHot: number;
  /** p2-05：是否行初现 */
  atNoul: number;
  /** p2-06：判读桌上资料 小注压向行首 */
  atNote: number;
}> = ({atForm, atGradeHot, atNoul, atNote}) => {
  const enter = useEnter('rise', {at: atForm, springPreset: 'settle', dur: DUR.f5});
  const grade = useProgress(atForm + 8, DUR.f5, 'decelerate');
  const hot = useProgress(atGradeHot, DUR.f4);
  const noul = useProgress(atNoul, DUR.f5, 'decelerate');
  const note = useEnter('slideR', {at: atNote, springPreset: 'settleSoft', dur: DUR.f4, dist: 96});

  const rowTag = (zh: string, en: string) => (
    <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginTop: 6}}>
      {zh} · {en}
    </div>
  );

  return (
    <div style={{position: 'relative'}}>
      {/* p2-06 小注：压向行首（label 列），滑入停靠在表格左缘外 */}
      <div
        style={{
          position: 'absolute',
          left: -352,
          top: 178,
          width: 320,
          ...note,
        }}
      >
        <div
          style={{
            border: `2px solid ${theme.slot}`,
            background: 'rgba(224,226,90,0.10)',
            borderRadius: 10,
            padding: '10px 16px',
            transform: 'rotate(-3deg)',
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.slot}}>判读桌上资料</div>
          <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 4}}>
            判读 ≠ 预测
          </div>
        </div>
        <svg width={46} height={18} viewBox="0 0 46 18" style={{position: 'absolute', right: -48, top: 24}}>
          <path d="M2 9 H36" stroke={theme.slot} strokeWidth={2.5} fill="none" />
          <path d="M34 2 L44 9 L34 16 Z" fill={theme.slot} />
        </svg>
      </div>

      <div
        style={{
          width: 1150,
          border: `3px solid ${theme.slot}`,
          borderRadius: 18,
          background: theme.panel,
          boxShadow: '0 0 46px rgba(224,226,90,0.08)',
          opacity: enter.opacity,
          transform: enter.transform,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '20px 30px 12px',
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>
            天气预报单
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>
            三类行 · criteria 预印
          </div>
        </div>
        <div style={{height: 1, background: theme.panelBorder, margin: '0 30px'}} />

        <div style={{padding: '18px 30px 28px', display: 'flex', flexDirection: 'column', gap: 16}}>
          {/* 单选行 */}
          <div style={{display: 'flex', gap: 24, alignItems: 'center'}}>
            <div style={{width: 240}}>
              <div style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 600, color: theme.text}}>
                今日天气
              </div>
              {rowTag('单选', 'Choice')}
            </div>
            <div style={{display: 'flex', gap: 14, flex: 1}}>
              {CHOICE_CELLS.map((c) => (
                <div
                  key={c}
                  style={{
                    flex: 1,
                    height: 60,
                    border: `2px solid ${theme.slot}`,
                    borderRadius: 10,
                    background: 'rgba(224,226,90,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: theme.sans,
                    fontSize: 27,
                    color: theme.text,
                  }}
                >
                  {c}
                </div>
              ))}
              <div
                style={{
                  width: 150,
                  height: 60,
                  border: `2px dashed rgba(224,226,90,0.62)`,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.sans,
                  fontSize: 24,
                  color: theme.dim,
                }}
              >
                其他
              </div>
            </div>
          </div>

          {/* 等级行：档位刻度（柱青）滑出，「小到中雨」高亮 */}
          <div style={{display: 'flex', gap: 24, alignItems: 'center'}}>
            <div style={{width: 240}}>
              <div style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 600, color: theme.text}}>
                降雨强度
              </div>
              {rowTag('等级', 'Score')}
            </div>
            <div
              style={{
                flex: 1,
                height: 70,
                opacity: grade,
                clipPath: `inset(0 ${Math.round((1 - grade) * 100)}% 0 0)`,
              }}
            >
              <div style={{position: 'relative', height: 26}}>
                <div
                  style={{
                    position: 'absolute',
                    left: 6,
                    right: 6,
                    top: 12,
                    height: 2,
                    background: theme.bar,
                    opacity: 0.35,
                  }}
                />
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                {GRADE_TICKS.map((t, i) => {
                  const isHot = i === 2;
                  return (
                    <div key={t} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', width: 96}}>
                      <div
                        style={{
                          width: 10,
                          height: 24 + (isHot ? 12 * hot : 0),
                          borderRadius: 2,
                          background: theme.bar,
                          opacity: isHot ? 1 : 0.8,
                          boxShadow: isHot
                            ? `0 0 ${Math.round(8 + 16 * hot)}px rgba(27,181,209,${(0.25 + 0.45 * hot).toFixed(2)})`
                            : 'none',
                        }}
                      />
                      <div
                        style={{
                          fontFamily: theme.mono,
                          fontSize: 16,
                          marginTop: 8,
                          color: isHot ? mix(theme.dim, theme.text, hot) : theme.dim,
                          fontWeight: isHot ? 700 : 400,
                        }}
                      >
                        {t}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 是否行：单格＋描边读数条初现 */}
          <div style={{display: 'flex', gap: 24, alignItems: 'center'}}>
            <div style={{width: 240}}>
              <div style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 600, color: theme.text}}>
                明早有雾吗
              </div>
              {rowTag('是否', 'Noul')}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                flex: 1,
                opacity: noul,
                transform: `translateY(${(1 - noul) * 14}px)`,
              }}
            >
              <div
                style={{
                  width: 200,
                  height: 60,
                  border: `2px solid ${theme.slot}`,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.mono,
                  fontSize: 26,
                  color: theme.bar,
                }}
              >
                0.30
              </div>
              <div
                style={{
                  width: 320,
                  height: 18,
                  border: `2px solid ${theme.bar}`,
                  borderRadius: 999,
                  padding: 2,
                }}
              >
                <div
                  style={{
                    width: `${Math.round(30 * noul)}%`,
                    height: '100%',
                    background: theme.bar,
                    opacity: 0.45,
                    borderRadius: 999,
                  }}
                />
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>P（雾）</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 2-B 没有空白处（预报单推近）─────────────────────────────────────────

const BIG_CELLS = ['晴', '多云', '雨'] as const;
const STAMP_SHARDS = [
  {dx: 1.0, dy: -0.4, rot: 52},
  {dx: 0.5, dy: -1.0, rot: -38},
  {dx: 1.2, dy: 0.3, rot: 24},
  {dx: 0.2, dy: -1.3, rot: -65},
  {dx: -0.6, dy: -0.8, rot: 40},
  {dx: 1.4, dy: -0.9, rot: -20},
] as const;

const NoBlankZone: React.FC<{
  /** p2-07：格黄描边逐格封边巡回 */
  atSeal: number;
  /** p2-09：紫色印章盖向单外 */
  atStamp: number;
  /** impact 距句首帧数（句中） */
  stampLead: number;
  /** p2-10：「≤255」硬规尺 */
  atRuler: number;
  /** p2-11：拆两段接力卡 */
  atRelay: number;
  /** p2-12：「其他」虚格转实格 */
  atOther: number;
  /** 硬塞警示距句首帧数 */
  otherLead: number;
}> = ({atSeal, atStamp, stampLead, atRuler, atRelay, atOther, otherLead}) => {
  const frame = useCurrentFrame();
  const zoom = usePushIn(0, {scale: 0.1, dur: DUR.f6});
  // 封边巡回只扫三枚已印格——「其他」还是虚格，须等 p2-12 转实（叙事即纪律）
  const seal = useStagger(3, {at: atSeal, stride: 10, dur: DUR.f5});
  const slam = useProgress(atStamp, Math.max(8, stampLead), 'accelerate');
  const rebound = useSpring('snap', {at: atStamp + stampLead, dur: DUR.f5});
  const frag = progress(frame, atStamp + stampLead, DUR.f5);
  const shake = useShake({at: atStamp + stampLead, amp: 5, freq: 1.4, decay: true, dur: DUR.f5});
  const flash = useImpulse({at: atStamp + stampLead, dur: DUR.f4});
  const stampO = useProgress(atStamp, DUR.f2);
  const ruler = useEnter('slideR', {at: atRuler, springPreset: 'settle', dur: DUR.f4, dist: 46});
  const cardA = useEnter('rise', {at: atRelay, springPreset: 'settle', dur: DUR.f4});
  const cardB = useEnter('rise', {at: atRelay + 16, springPreset: 'settle', dur: DUR.f4});
  const arrowShaft = useDraw(atRelay + 10);
  const arrowHead = useProgress(atRelay + 19, DUR.f2);
  const gateNote = useProgress(atRelay + 26, DUR.f3);
  const solidP = useProgress(atOther, DUR.f4);
  const solidGlow = useImpulse({at: atOther + 4, dur: DUR.f5});
  const warnP = useProgress(atOther + otherLead - 6, DUR.f4);
  const warnFlash = useImpulse({at: atOther + otherLead, dur: DUR.f5});

  const stampX = 190 * (1 - slam) + 84 * rebound;
  const stampY = -90 * (1 - slam) - 64 * rebound;

  return (
    <Stage gap={52}>
      {/* 推近的单选行（含封边巡回 / 其他格 / 规尺 / 印章） */}
      <div style={{position: 'relative', transform: `${zoom} translateX(${shake}px)`}}>
        <div style={{display: 'flex', gap: 20}}>
          {BIG_CELLS.map((c, i) => {
            const s = seal[i];
            return (
              <div
                key={c}
                style={{
                  width: 260,
                  height: 104,
                  border: `3px solid rgba(224,226,90,${(0.35 + 0.65 * s).toFixed(2)})`,
                  borderRadius: 14,
                  background: 'rgba(224,226,90,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.sans,
                  fontSize: 40,
                  color: theme.text,
                  boxShadow: `0 0 ${Math.round(18 * s)}px rgba(224,226,90,${(0.3 * s).toFixed(2)})`,
                }}
              >
                {c}
              </div>
            );
          })}
          {/* 其他：虚格转实格（p2-12） */}
          <div
            style={{
              position: 'relative',
              width: 240,
              height: 104,
              borderRadius: 14,
              background: 'rgba(224,226,90,0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.sans,
              fontSize: 34,
              color: mix(theme.dim, theme.text, solidP),
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                border: `3px dashed rgba(224,226,90,0.62)`,
                borderRadius: 14,
                opacity: 1 - solidP,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                border: `3px solid ${theme.slot}`,
                borderRadius: 14,
                opacity: solidP,
                boxShadow: `0 0 ${Math.round(20 * solidGlow)}px rgba(224,226,90,${(0.35 * solidGlow).toFixed(2)})`,
              }}
            />
            其他
          </div>
        </div>

        {/* 行尾「≤255」硬规尺（校验层＝闸品） */}
        <div style={{position: 'absolute', right: -122, top: -10, opacity: ruler.opacity, transform: ruler.transform}}>
          <svg width={46} height={132} viewBox="0 0 46 132">
            <rect x={1.5} y={1.5} width={43} height={112} rx={6} fill="none" stroke="rgba(154,167,184,0.55)" strokeWidth={2} />
            {Array.from({length: 6}, (_, i) => (
              <line key={i} x1={8} y1={16 + i * 17} x2={38} y2={16 + i * 17} stroke="rgba(154,167,184,0.4)" strokeWidth={2} />
            ))}
          </svg>
          <div style={{fontFamily: theme.mono, fontSize: 27, color: theme.gate, marginTop: 8, textAlign: 'center'}}>
            ≤255
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 4, textAlign: 'center'}}>
            每行格数上限
          </div>
        </div>

        {/* 「紫色的雨」印章：盖向单外、被弹开（碎裂） */}
        <div style={{position: 'absolute', right: -34, top: -176, width: 300, height: 96, opacity: stampO}}>
          <div
            style={{
              transform: `translate(${stampX.toFixed(1)}px, ${stampY.toFixed(1)}px) rotate(${(-20 + 6 * slam + 9 * rebound).toFixed(1)}deg)`,
            }}
          >
            <div
              style={{
                border: `3px solid ${STAMP_INK}`,
                borderRadius: 12,
                background: '#12101C',
                padding: '14px 24px',
                fontFamily: theme.sans,
                fontSize: 32,
                fontWeight: 700,
                color: STAMP_INK,
                letterSpacing: 4,
                whiteSpace: 'nowrap',
                boxShadow: `0 0 ${Math.round(26 * flash)}px rgba(255,92,92,${(0.8 * flash).toFixed(2)})`,
              }}
            >
              紫色的雨
            </div>
          </div>
          {/* 碎裂碎片（impact 后一拍） */}
          {frag > 0
            ? STAMP_SHARDS.map((s, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: 130,
                    top: 40,
                    width: 26 + i * 5,
                    height: 9,
                    border: `2px solid ${STAMP_INK}`,
                    borderRadius: 3,
                    opacity: 1 - frag,
                    transform: `translate(${(s.dx * 130 * frag).toFixed(1)}px, ${(s.dy * 130 * frag - 18 * frag).toFixed(1)}px) rotate(${(s.rot * frag).toFixed(1)}deg)`,
                  }}
                />
              ))
            : null}
        </div>
        {/* impact：行右缘警示红闪一拍 */}
        <div
          style={{
            position: 'absolute',
            right: -16,
            top: -8,
            width: 5,
            height: 120,
            borderRadius: 3,
            background: theme.danger,
            opacity: 0.8 * flash,
          }}
        />
      </div>

      {/* p2-11 拆两段接力 + p2-12 硬塞警示卡 */}
      <div style={{display: 'flex', gap: 36, alignItems: 'stretch'}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center'}}>
          <div style={{display: 'flex', gap: 18, alignItems: 'center'}}>
            <div style={{...cardA}}>
              <div
                style={{
                  width: 320,
                  height: 116,
                  border: `2px solid ${theme.bar}`,
                  borderRadius: 12,
                  background: 'rgba(27,181,209,0.08)',
                  padding: '14px 18px',
                }}
              >
                <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.text}}>粗筛打分</div>
                <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginTop: 4}}>
                  全部候选 · 柱青淡
                </div>
                <div style={{display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 10, height: 30}}>
                  <div style={{width: 64, height: 12, background: theme.bar, opacity: 0.35, borderRadius: 2}} />
                  <div style={{width: 64, height: 18, background: theme.bar, opacity: 0.35, borderRadius: 2}} />
                  <div style={{width: 64, height: 8, background: theme.bar, opacity: 0.35, borderRadius: 2}} />
                </div>
              </div>
            </div>
            <svg width={74} height={40} viewBox="0 0 74 40">
              <path d="M4 20 H58" stroke={theme.bar} strokeWidth={3} fill="none" {...arrowShaft} />
              <path d="M56 10 L70 20 L56 30 Z" fill={theme.bar} opacity={arrowHead} />
            </svg>
            <div style={{...cardB}}>
              <div
                style={{
                  width: 320,
                  height: 116,
                  border: `2px solid ${theme.bar}`,
                  borderRadius: 12,
                  background: 'rgba(27,181,209,0.22)',
                  padding: '14px 18px',
                }}
              >
                <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.text}}>入围细挑</div>
                <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginTop: 4}}>
                  只对入围 · 柱青深
                </div>
                <div style={{display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 10, height: 30}}>
                  <div style={{width: 64, height: 30, background: theme.bar, borderRadius: 2}} />
                  <div style={{width: 64, height: 10, background: theme.bar, opacity: 0.5, borderRadius: 2}} />
                  <div style={{width: 64, height: 6, background: theme.bar, opacity: 0.5, borderRadius: 2}} />
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              border: `2px solid ${theme.gate}`,
              borderRadius: 999,
              padding: '6px 18px',
              fontFamily: theme.mono,
              fontSize: 19,
              color: theme.gate,
              opacity: gateNote,
            }}
          >
            这活在你的代码里
          </div>
        </div>

        {/* 没印「其他」→ 硬塞最像的格 */}
        <Panel style={{width: 400, padding: '16px 20px', opacity: warnP}}>
          <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>没印『其他』时</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 12}}>
            <div
              style={{
                width: 120,
                height: 56,
                border: `2px solid ${mix(theme.slot, theme.danger, warnFlash)}`,
                borderRadius: 8,
                background: `rgba(255,92,92,${(0.22 * warnFlash).toFixed(2)})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.sans,
                fontSize: 24,
                color: theme.text,
                boxShadow: `0 0 ${Math.round(18 * warnFlash)}px rgba(255,92,92,${(0.5 * warnFlash).toFixed(2)})`,
              }}
            >
              多云
            </div>
            <svg width={40} height={16} viewBox="0 0 40 16">
              <path d="M2 8 H28" stroke={theme.danger} strokeWidth={2.5} fill="none" />
              <path d="M26 2 L36 8 L26 14 Z" fill={theme.danger} />
            </svg>
            <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.danger}}>硬塞最像的</div>
          </div>
        </Panel>
      </div>
    </Stage>
  );
};

// ── 2-C 校验层打回（玩具原型小窗＋外测计数）──────────────────────────────

const ProtoDesk: React.FC<{
  /** p2-13：原型小窗亮起 */
  atLight: number;
  /** p2-15：「225/225 拒收」计数器逐条跳满 */
  atCount: number;
  countDur: number;
}> = ({atLight, atCount, countDur}) => {
  const frame = useCurrentFrame();
  const win = useEnter('pop', {at: atLight, springPreset: 'settle', dur: DUR.f5});
  const lit = useProgress(atLight, DUR.f5);
  const card = useEnter('rise', {at: atLight + 6, springPreset: 'settle', dur: DUR.f4});
  const cnt = useCount({from: 0, to: 225, at: atCount, dur: countDur});
  const fillP = progress(frame, atCount, countDur);
  const tag400 = useProgress(atCount, DUR.f4);
  const filledN = Math.round(fillP * 225);

  return (
    <div style={{display: 'flex', gap: 64, alignItems: 'center'}}>
      {/* 玩具原型小窗 */}
      <div
        style={{
          width: 660,
          borderRadius: 14,
          background: theme.panel,
          border: `2px solid ${mix(theme.panelBorder, '#8D99AC', lit)}`,
          boxShadow: `0 0 ${Math.round(26 * lit)}px rgba(242,245,250,${(0.1 * lit).toFixed(2)})`,
          opacity: win.opacity,
          transform: win.transform,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px'}}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{width: 12, height: 12, borderRadius: 999, background: theme.panelBorder}} />
          ))}
          <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.text, marginLeft: 10}}>玩具原型 S10</div>
          <div style={{flex: 1}} />
          <Badge kind="recompute" who="原型" />
        </div>
        <div style={{height: 1, background: theme.panelBorder}} />
        <div style={{padding: '18px 22px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 23, color: theme.dim, lineHeight: 1.8}}>
            <div>
              criteria = ['晴','多云','雨', …] <span style={{color: theme.text, fontWeight: 700}}>×256</span>
            </div>
            <div>POST /v1/systemone</div>
          </div>
          <div
            style={{
              display: 'inline-block',
              marginTop: 12,
              border: `2px solid ${theme.danger}`,
              borderRadius: 8,
              background: 'rgba(255,92,92,0.08)',
              padding: '8px 14px',
              fontFamily: theme.mono,
              fontSize: 20,
              color: theme.danger,
              opacity: tag400,
            }}
          >
            400 · 超过 255 格，打回
          </div>
        </div>
      </div>

      {/* 外测·nibzard：225/225 全拒收 */}
      <Panel style={{width: 560, padding: '22px 26px', opacity: card.opacity, transform: card.transform}}>
        <Badge kind="external" who="nibzard" note="✓ 原始数据核对过" />
        <div style={{display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 14}}>
          <div style={{fontFamily: theme.mono, fontSize: 58, color: theme.bar, fontVariantNumeric: 'tabular-nums'}}>
            {Math.round(cnt)} / 225
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>超限请求 · 全部拒收</div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(25, 16px)',
            gap: '3px 3px',
            marginTop: 16,
          }}
        >
          {Array.from({length: 225}, (_, i) => (
            <div
              key={i}
              style={{
                width: 16,
                height: 10,
                borderRadius: 2,
                background: i < filledN ? 'rgba(27,181,209,0.5)' : 'transparent',
                border: i < filledN ? 'none' : `1px solid rgba(42,50,66,0.9)`,
              }}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
};

// ── 2-D 格式对了天气没对（六张测试单→分屏高潮）───────────────────────────

const WRONG_SHEETS = [1, 4] as const;
const RAIN_N = 26;

const TicketBoard: React.FC<{
  /** p2-17：「不越界」压在单角 */
  atStamp: number;
  /** p2-19：错格两张翻红 */
  atFlip: number;
  /** p2-21：「技术问题」机械勾上 */
  atCheck: number;
  /** conf 冲到 0.981 */
  atConf: number;
  confDur: number;
  /** p2-23：分屏定格＋金句卡 */
  atClimax: number;
}> = ({atStamp, atFlip, atCheck, atConf, confDur, atClimax}) => {
  const frame = useCurrentFrame();
  const rowIn = useEnter('rise', {at: 0, springPreset: 'settle', dur: DUR.f5});
  const stamp = useEnter('pop', {at: atStamp, springPreset: 'snap', dur: DUR.f4});
  const flipGlow = useImpulse({at: atFlip, dur: DUR.f5});
  const badgeO = useProgress(atStamp + 6, DUR.f3);
  const checkDraw = useDraw(atCheck, DUR.f2);
  const checkedP = useProgress(atCheck, DUR.f2);
  const literal = useProgress(atCheck + 5, DUR.f3);
  const conf = useCount({from: 0.85, to: 0.981, at: atConf, dur: confDur});
  const autoO = useProgress(atConf + Math.round(confDur * 0.8), DUR.f3);
  const climaxO = useProgress(atClimax, DUR.f3);

  return (
    <AbsoluteFill>
      <Stage gap={36} y={-14}>
        {/* 六张测试单缩略排开（实心徽：复算·原型 S2） */}
        <div style={{position: 'relative', opacity: rowIn.opacity, transform: rowIn.transform}}>
          <div style={{display: 'flex', gap: 22}}>
            {Array.from({length: 6}, (_, i) => {
              const wrong = (WRONG_SHEETS as readonly number[]).includes(i);
              const p = progress(frame, atFlip + (wrong ? 4 : 0), DUR.f5);
              const scaleX = p < 0.5 ? 1 - 2 * p : 2 * p - 1;
              const showBack = p >= 0.5;
              const borderColor = wrong
                ? showBack
                  ? theme.danger
                  : 'rgba(224,226,90,0.55)'
                : mix(theme.slot, theme.ok, p);
              return (
                <div
                  key={i}
                  style={{
                    width: 236,
                    height: 148,
                    borderRadius: 12,
                    background: theme.panel,
                    border: `2.5px solid ${borderColor}`,
                    transform: `scaleX(${scaleX.toFixed(3)})`,
                    boxShadow: wrong && showBack ? `0 0 ${Math.round(16 * flipGlow)}px rgba(255,92,92,${(0.4 * flipGlow).toFixed(2)})` : 'none',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: 24,
                      background: 'rgba(224,226,90,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 10,
                      fontFamily: theme.mono,
                      fontSize: 13,
                      color: theme.dim,
                    }}
                  >
                    S2-0{i + 1}
                  </div>
                  <div style={{padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8}}>
                    {[0, 1].map((r) => (
                      <div key={r} style={{display: 'flex', gap: 8}}>
                        {[0, 1, 2].map((c) => (
                          <div
                            key={c}
                            style={{
                              flex: 1,
                              height: 26,
                              borderRadius: 4,
                              border: `1.5px solid rgba(224,226,90,0.45)`,
                              background: r === 0 && c === 0 ? 'rgba(224,226,90,0.3)' : 'transparent',
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  {/* 翻面后：内容错角标 / 正确：绿勾角标 */}
                  {wrong && showBack ? (
                    <div
                      style={{
                        position: 'absolute',
                        right: 8,
                        bottom: 8,
                        fontFamily: theme.mono,
                        fontSize: 15,
                        color: theme.danger,
                        border: `1.5px solid ${theme.danger}`,
                        borderRadius: 6,
                        padding: '2px 8px',
                        background: theme.bg,
                      }}
                    >
                      内容错
                    </div>
                  ) : null}
                  {!wrong && p > 0.5 ? (
                    <svg width={22} height={22} viewBox="0 0 22 22" style={{position: 'absolute', right: 8, bottom: 8}}>
                      <circle cx={11} cy={11} r={9} fill="none" stroke={theme.ok} strokeWidth={2} />
                      <path d="M6.4 11.4 L9.4 14.4 L15.8 7.8" fill="none" stroke={theme.ok} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </div>
              );
            })}
          </div>
          {/* 「不越界」三字压在单角（关键词） */}
          <div
            style={{
              position: 'absolute',
              right: -26,
              top: -52,
              ...stamp,
              transform: `${stamp.transform} rotate(-8deg)`,
            }}
          >
            <div
              style={{
                border: `3px solid ${theme.slot}`,
                background: theme.bg,
                borderRadius: 10,
                padding: '10px 22px',
                fontFamily: theme.sans,
                fontSize: 36,
                fontWeight: 700,
                color: theme.slot,
                letterSpacing: 8,
                whiteSpace: 'nowrap',
              }}
            >
              不越界
            </div>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 26, marginTop: 18, paddingLeft: 4, opacity: badgeO}}>
            <Badge kind="recompute" who="原型 S2" />
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>
              越界 0/6 · 内容错 2/6
            </span>
          </div>
        </div>

        {/* 工单原话卡 + 行尾读数卡 */}
        <div style={{display: 'flex', gap: 40, alignItems: 'stretch'}}>
          <Panel style={{width: 680, padding: '20px 26px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>客服工单 · 原话引用</div>
            <div style={{fontFamily: theme.sans, fontSize: 29, color: theme.text, marginTop: 10, lineHeight: 1.5}}>
              「没有报错，我就是要退款」
            </div>
            <div style={{display: 'flex', gap: 30, marginTop: 18, alignItems: 'center'}}>
              <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                <div style={{position: 'relative', width: 26, height: 26, border: `2px solid ${mix(theme.slot, theme.danger, checkedP)}`, borderRadius: 6}}>
                  <svg width={26} height={26} viewBox="0 0 26 26">
                    <path d="M5 13 L10.5 18.5 L21 6.5" {...checkDraw} stroke={theme.danger} strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span style={{fontFamily: theme.sans, fontSize: 22, color: mix(theme.text, theme.danger, checkedP)}}>
                  技术问题
                </span>
              </div>
              {['账单疑问', '功能建议'].map((o) => (
                <div key={o} style={{display: 'flex', gap: 10, alignItems: 'center', opacity: 0.55}}>
                  <div style={{width: 26, height: 26, border: `2px solid ${theme.panelBorder}`, borderRadius: 6}} />
                  <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{o}</span>
                </div>
              ))}
              <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: literal}}>按字面读</span>
            </div>
          </Panel>

          <Panel style={{width: 430, padding: '20px 24px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>集中度 conf</span>
              <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: 0.7}}>原型 S3b</span>
            </div>
            <div
              style={{
                marginTop: 12,
                height: 22,
                border: `2px solid ${theme.bar}`,
                borderRadius: 999,
                padding: 2,
              }}
            >
              <div
                style={{
                  width: `${(conf * 100).toFixed(1)}%`,
                  height: '100%',
                  background: theme.bar,
                  opacity: 0.5,
                  borderRadius: 999,
                }}
              />
            </div>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 8}}>
              <div style={{fontFamily: theme.mono, fontSize: 54, color: theme.bar, fontVariantNumeric: 'tabular-nums'}}>
                {conf.toFixed(3)}
              </div>
              <div
                style={{
                  border: `2px solid ${theme.gate}`,
                  borderRadius: 999,
                  padding: '4px 12px',
                  fontFamily: theme.mono,
                  fontSize: 16,
                  color: theme.gate,
                  opacity: autoO,
                }}
              >
                触发自动执行
              </div>
            </div>
          </Panel>
        </div>
      </Stage>

      {/* p2-23 分屏高潮：左窗外大雨 vs 右单上「晴」，定格停驻＋金句卡〔M-003〕 */}
      <AbsoluteFill style={{background: theme.bg, opacity: climaxO}}>
        <div style={{display: 'flex', gap: 60, alignItems: 'center', justifyContent: 'center', height: '100%'}}>
          {/* 左半：窗外雨幕（确定性帧驱动，无随机） */}
          <div
            style={{
              width: 700,
              height: 440,
              border: `3px solid ${theme.panelBorder}`,
              borderRadius: 18,
              background: '#0B0E13',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{position: 'absolute', left: 18, top: 14, fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>
              窗外 · 实况
            </div>
            <svg width={700} height={440} viewBox="0 0 700 440" style={{position: 'absolute', inset: 0}}>
              {Array.from({length: RAIN_N}, (_, i) => {
                const x = 24 + i * 26 + (i % 3) * 9;
                const speed = 9 + (i % 5) * 2.4;
                const y = ((frame * speed + i * 191) % 520) - 40;
                const len = 30 + (i % 3) * 13;
                return (
                  <line
                    key={i}
                    x1={x}
                    y1={y}
                    x2={x + len * 0.26}
                    y2={y + len}
                    stroke={theme.dim}
                    strokeWidth={2}
                    strokeLinecap="round"
                    opacity={0.2 + (i % 4) * 0.08}
                  />
                );
              })}
            </svg>
          </div>
          {/* 右半：单上「晴」格勾 */}
          <div
            style={{
              width: 700,
              border: `3px solid ${theme.slot}`,
              borderRadius: 16,
              background: theme.panel,
              padding: '24px 30px',
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
              <div style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>今日天气</div>
              <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>单选 · Choice</div>
            </div>
            <div style={{display: 'flex', gap: 18, marginTop: 18}}>
              <div
                style={{
                  flex: 1,
                  height: 88,
                  border: `3px solid ${theme.slot}`,
                  borderRadius: 12,
                  background: theme.slot,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.sans,
                  fontSize: 38,
                  fontWeight: 700,
                  color: theme.bg,
                }}
              >
                晴
              </div>
              {['多云', '雨'].map((c) => (
                <div
                  key={c}
                  style={{
                    flex: 1,
                    height: 88,
                    border: `2px solid rgba(224,226,90,0.5)`,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: theme.sans,
                    fontSize: 34,
                    color: theme.dim,
                  }}
                >
                  {c}
                </div>
              ))}
            </div>
            <div style={{display: 'flex', gap: 16, alignItems: 'center', marginTop: 20}}>
              <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.bar, fontVariantNumeric: 'tabular-nums'}}>
                conf 0.981
              </span>
              <span
                style={{
                  border: `2px solid ${theme.gate}`,
                  borderRadius: 999,
                  padding: '3px 12px',
                  fontFamily: theme.mono,
                  fontSize: 16,
                  color: theme.gate,
                }}
              >
                自动执行
              </span>
            </div>
          </div>
        </div>
        {/* 金句卡：衬线浮出、停驻（caption-dup-ok：幕末金句回扣 p2-23） */}
        <Sequence from={atClimax + 14} layout="none" name="2-D 金句卡">
          <QuoteCard zh="格式对了 · 天气没对" />
        </Sequence>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── 2-E 零幻觉的口径 ────────────────────────────────────────────────────

const ZeroClaim: React.FC<{
  /** p2-24：官方 FAQ 引文卡 */
  atFaq: number;
  /** p2-25：宣传横幅掠过 */
  atBanner: number;
  /** p2-26：「构造推出」小注 */
  atNote: number;
  /** p2-28：回分拆条 */
  atSplit: number;
  /** p2-29：机制地图预亮＋下一关 */
  atNext: number;
}> = ({atFaq, atBanner, atNote, atSplit, atNext}) => {
  const faq = useEnter('slideL', {at: atFaq, springPreset: 'settle', dur: DUR.f5, dist: 120});
  const banner = useEnter('slideL', {at: atBanner, dur: DUR.f6, dist: 620, easing: 'decelerate'});
  const note = useEnter('pop', {at: atNote, springPreset: 'snap', dur: DUR.f4});
  const noteP = useProgress(atNote, DUR.f3);
  const split = useProgress(atSplit, DUR.f5, 'decelerate');
  const underline = useProgress(atSplit + 10, DUR.f4, 'decelerate');
  const wholeO = (1 - split) * (1 - 0.22 * noteP);

  return (
    <AbsoluteFill>
      {/* 官方 FAQ 引文卡（虚线徽） */}
      <div style={{position: 'absolute', left: 470, top: 132, width: 980, ...faq}}>
        <Panel style={{padding: '20px 30px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <Badge kind="official" />
            <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>官方 FAQ · 引文</span>
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 33, color: theme.text, marginTop: 12, lineHeight: 1.55}}>
            「保证形状，不保证每个判断都对」
          </div>
        </Panel>
      </div>

      {/* 宣传条「零幻觉」→ 拆成两半 */}
      <div style={{position: 'absolute', left: 440, top: 430, width: 1040, height: 132}}>
        <div style={{...banner, opacity: wholeO * banner.opacity}}>
          <div
            style={{
              width: 1040,
              height: 132,
              borderRadius: 999,
              border: '2px solid rgba(242,245,250,0.55)',
              background: 'rgba(242,245,250,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 28,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 52, fontWeight: 800, color: theme.text, letterSpacing: 14}}>
              零 幻 觉
            </span>
            <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>宣传条</span>
          </div>
        </div>
        {/* 分拆两半（p2-28 回条）：左「形状保证」稳固 / 右「判断对错」灰格＋量尺 */}
        <div style={{position: 'absolute', inset: 0, opacity: split, display: 'flex', gap: 48, justifyContent: 'center'}}>
          <div style={{transform: `translateX(${(-46 * split).toFixed(1)}px)`}}>
            <div
              style={{
                width: 470,
                height: 132,
                borderRadius: 16,
                border: `3px solid ${theme.slot}`,
                background: 'rgba(224,226,90,0.14)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 38, fontWeight: 700, color: theme.slot}}>形状保证</span>
              <div
                style={{
                  width: 170,
                  height: 5,
                  borderRadius: 999,
                  background: theme.slot,
                  transform: `scaleX(${underline.toFixed(2)})`,
                }}
              />
            </div>
          </div>
          <div style={{transform: `translateX(${(46 * split).toFixed(1)}px)`}}>
            <div
              style={{
                width: 470,
                height: 132,
                borderRadius: 16,
                border: `2px solid ${theme.panelBorder}`,
                background: theme.panel,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 38, fontWeight: 700, color: theme.dim}}>判断对错</span>
              <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={{width: 30, height: 22, borderRadius: 4, border: `1.5px solid ${theme.panelBorder}`}} />
                ))}
                {/* 量尺图标：能测量、能设门槛 */}
                <svg width={38} height={20} viewBox="0 0 38 20">
                  <rect x={1.5} y={1.5} width={35} height={17} rx={3} fill="none" stroke={theme.dim} strokeWidth={2} />
                  {[0, 1, 2, 3].map((i) => (
                    <line key={i} x1={7 + i * 8} y1={2} x2={7 + i * 8} y2={8} stroke={theme.dim} strokeWidth={1.6} />
                  ))}
                </svg>
                <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>能测量 · 能设门槛</span>
              </div>
            </div>
          </div>
        </div>
        {/* 「构造推出」小注（mono）盖在宣传条上 */}
        <div style={{position: 'absolute', left: 560, top: -26, ...note, transform: `${note.transform} rotate(-6deg)`}}>
          <div
            style={{
              border: `2px solid ${theme.text}`,
              background: theme.bg,
              borderRadius: 8,
              padding: '8px 18px',
              fontFamily: theme.mono,
              fontSize: 23,
              color: theme.text,
              whiteSpace: 'nowrap',
            }}
          >
            非实测 · 构造推出
          </div>
        </div>
      </div>

      <MiniMechMap at={atNext} />
    </AbsoluteFill>
  );
};

// ── 机制地图小徽（右下角；P1 1-E 立的「全片机制进度器」本幕局部版） ───────

const MECH_NODES = [
  {id: 'm1', state: 'done'},
  {id: 'm2', state: 'next'},
  {id: 'm3', state: 'todo'},
  {id: 'm4', state: 'todo'},
] as const;

/** p2-29 幕末预亮：storyboard 原文写「m3」，但下一幕 P3 开场即 m2 高亮
 *  （3-A p3-01），且 1-F 先例是「幕末预亮下一幕机制」（m1 呼吸预告 P2）——
 *  按 m2 实现以维持链路一致，已在交付报告登记偏离。 */
const MiniMechMap: React.FC<{at: number}> = ({at}) => {
  const o = useProgress(at, DUR.f4);
  const breathe = useBreathe({period: 96, amp: 0.5, base: 0.5});
  const arrow = useDraw(at + 6);
  return (
    <div style={{position: 'absolute', right: 84, bottom: 176, opacity: o}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
        <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.gate, whiteSpace: 'nowrap'}}>下一关</span>
        <svg width={60} height={16} viewBox="0 0 60 16">
          <path d="M2 8 H48" stroke={theme.gate} strokeWidth={2.5} fill="none" {...arrow} />
          <path d="M46 2 L56 8 L46 14 Z" fill={theme.gate} />
        </svg>
        <div style={{display: 'flex', gap: 8}}>
          {MECH_NODES.map((n) => (
            <div
              key={n.id}
              style={{
                width: 52,
                height: 34,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.mono,
                fontSize: 20,
                border:
                  n.state === 'done'
                    ? `2px solid ${theme.slot}`
                    : n.state === 'next'
                      ? `2px solid ${theme.bar}`
                      : `2px solid ${theme.panelBorder}`,
                color: n.state === 'done' ? theme.slot : n.state === 'next' ? theme.bar : theme.dim,
                background: n.state === 'done' ? 'rgba(224,226,90,0.16)' : 'transparent',
                opacity: n.state === 'todo' ? 0.6 : 1,
                boxShadow:
                  n.state === 'next'
                    ? `0 0 ${Math.round(8 + 16 * breathe)}px rgba(27,181,209,${(0.2 + 0.4 * breathe).toFixed(2)})`
                    : 'none',
              }}
            >
              {n.id}
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          marginTop: 8,
          textAlign: 'right',
          fontFamily: theme.mono,
          fontSize: 14,
          color: theme.dim,
          opacity: 0.7,
        }}
      >
        机制地图 · 按幕点亮
      </div>
    </div>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P2Form: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;

  const bA = w('p2-01', 'p2-06');
  const bB = w('p2-07', 'p2-12');
  const bC = w('p2-13', 'p2-16');
  const bD = w('p2-17', 'p2-23');
  const bE = w('p2-24', 'p2-29');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A 三类行样张">
        <SceneTag chapter="M1" tagline="预印的格子：答案空间钉进请求" accent={theme.slot} />
        {/* 可见岛 p2-04..06；窗=本镜 3 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p2-01') - bA.from, durationInFrames: dur('p2-01')},
            {at: at('p2-02') - bA.from, durationInFrames: dur('p2-02')},
            {at: at('p2-03') - bA.from, durationInFrames: dur('p2-03')},
          ]}
        >
          <Stage>
            <ForecastSheet
              atForm={at('p2-04') - bA.from}
              atGradeHot={at('p2-04') - bA.from + Math.round(dur('p2-04') * 0.62)}
              atNoul={at('p2-05') - bA.from}
              atNote={at('p2-06') - bA.from}
            />
          </Stage>
        </ArchifyYield>
        {/* p2-01 机制地图重放（图名级标注）：幕首例、默认 lead */}
        <ArchifyRecap
          slug="lesions-to-specs"
          caption="机制地图"
          cues={[{chapterId: 'ls-mech', at: at('p2-01') - bA.from, durationInFrames: dur('p2-01')}]}
        />
        {/* p2-01→p2-02 背靠背跨实例 → lead={false}；p2-02→p2-03 实例内连续换章自动抑制 */}
        <ArchifyRecap
          slug="forecast-form-rows"
          caption="预报单三类行"
          lead={false}
          cues={[
            {chapterId: 'ff-rows', at: at('p2-02') - bA.from, durationInFrames: dur('p2-02')},
            {chapterId: 'ff-choice', at: at('p2-03') - bA.from, durationInFrames: dur('p2-03')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="2-B 没有空白处">
        {/* 可见岛 p2-07/09..12；窗=本镜 1 条 cue 窗 */}
        <ArchifyYield
          cues={[{at: at('p2-08') - bB.from, durationInFrames: dur('p2-08')}]}
        >
          <NoBlankZone
            atSeal={at('p2-07') - bB.from}
            atStamp={at('p2-09') - bB.from}
            stampLead={Math.round(dur('p2-09') * 0.5)}
            atRuler={at('p2-10') - bB.from}
            atRelay={at('p2-11') - bB.from}
            atOther={at('p2-12') - bB.from}
            otherLead={Math.round(dur('p2-12') * 0.55)}
          />
        </ArchifyYield>
        {/* p2-03 后隔 4 句空档 → 默认 lead */}
        <ArchifyRecap
          slug="forecast-form-rows"
          caption="预报单三类行"
          cues={[{chapterId: 'ff-closure', at: at('p2-08') - bB.from, durationInFrames: dur('p2-08')}]}
        />
      </Sequence>

      <Sequence {...bC} name="2-C 校验层打回">
        {/* 可见岛 p2-13/15；窗=本镜 2 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p2-14') - bC.from, durationInFrames: dur('p2-14')},
            {at: at('p2-16') - bC.from, durationInFrames: dur('p2-16')},
          ]}
        >
          <Stage>
            <ProtoDesk
              atLight={at('p2-13') - bC.from}
              atCount={at('p2-15') - bC.from}
              countDur={Math.round(dur('p2-15') * 0.85)}
            />
          </Stage>
        </ArchifyYield>
        {/* 实例内两章隔 p2-15 空档 → 各自默认 lead */}
        <ArchifyRecap
          slug="validation-roundtrip"
          caption="请求往返"
          cues={[
            {chapterId: 'vr-request', at: at('p2-14') - bC.from, durationInFrames: dur('p2-14')},
            {chapterId: 'vr-return', at: at('p2-16') - bC.from, durationInFrames: dur('p2-16')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="2-D 格式对了天气没对">
        {/* 可见岛 p2-17/19/21/23；窗=本镜 3 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p2-18') - bD.from, durationInFrames: dur('p2-18')},
            {at: at('p2-20') - bD.from, durationInFrames: dur('p2-20')},
            {at: at('p2-22') - bD.from, durationInFrames: dur('p2-22')},
          ]}
        >
          <TicketBoard
            atStamp={at('p2-17') - bD.from}
            atFlip={at('p2-19') - bD.from}
            atCheck={at('p2-21') - bD.from}
            atConf={at('p2-21') - bD.from}
            confDur={dur('p2-21')}
            atClimax={at('p2-23') - bD.from}
          />
        </ArchifyYield>
        {/* 实例内 vr-judge/vr-route 各隔空档 → 默认 lead */}
        <ArchifyRecap
          slug="validation-roundtrip"
          caption="请求往返"
          cues={[
            {chapterId: 'vr-judge', at: at('p2-18') - bD.from, durationInFrames: dur('p2-18')},
            {chapterId: 'vr-route', at: at('p2-22') - bD.from, durationInFrames: dur('p2-22')},
          ]}
        />
        <ArchifyRecap
          slug="forecast-form-rows"
          caption="预报单三类行"
          cues={[{chapterId: 'ff-trap', at: at('p2-20') - bD.from, durationInFrames: dur('p2-20')}]}
        />
      </Sequence>

      <Sequence {...bE} name="2-E 零幻觉的口径">
        {/* 可见岛 p2-24..26/28..29；窗=本镜 1 条 cue 窗 */}
        <ArchifyYield cues={[{at: at('p2-27') - bE.from, durationInFrames: dur('p2-27')}]}>
          <ZeroClaim
            atFaq={at('p2-24') - bE.from}
            atBanner={at('p2-25') - bE.from}
            atNote={at('p2-26') - bE.from}
            atSplit={at('p2-28') - bE.from}
            atNext={at('p2-29') - bE.from}
          />
        </ArchifyYield>
        {/* td-shape 首锚；p2-26 后空档 → 默认 lead */}
        <ArchifyRecap
          slug="two-deliveries"
          caption="两种交付路径"
          cues={[{chapterId: 'td-shape', at: at('p2-27') - bE.from, durationInFrames: dur('p2-27')}]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
