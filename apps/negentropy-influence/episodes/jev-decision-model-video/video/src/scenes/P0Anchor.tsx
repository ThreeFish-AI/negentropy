/** P0 主播与判读员（p0-01..22 · 4 镜）——暴雨夜双景对切 / 判读员工位首亮相 /
 *  三级角标图例卡 / 三承诺过秤。
 *
 *  幕内局部装置（均在本文件，禁改公共件）：
 *  - ForecastOutline：预报单轮廓〔M-001〕全片首次出场——格黄描边全片恒定，只露轮廓不填内容；
 *  - ReaderDesk：判读员工位〔M-002 以静写闷〕——匀速落笔（线性帧驱动）、零强调动效，
 *    p0-08 笔尖停在格心 + 镜头推近（大特写）；
 *  - TriadBadge：三级角标图例（虚线=官方自报 / 实线+署名位=第三方实测 / 实心+✓=我们复算），
 *    单色不占概念色相（来源维度用线型/亮度编码——08 契约第 5 条）；
 *  - ScalePan：过秤天平（三枚承诺砝码；P1-D「两个优化目标」为同款语义的姊妹装置）。
 *
 *  archify（two-deliveries，3 cue）：td-old@p0-03、td-new@p0-09、td-new@p0-20（重放）。
 *  前两镜 cue 窗延展为「锚句起至幕末」的句 dur 之和——分镜规定 p0-04/05 引文小条与
 *  p0-10..12 三枚角标逐一压在图角，fit 自动落 hold（章播完定格承接角标注入）；
 *  p0-20 重放为单句窗，p0-21 天平回位（ArchifyYield 淡回舞台）。三个 cue 均默认 lead。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import {DUR, progress, useImpulse, useSpring} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import type {SceneRange} from '../types';

/** archify 画框几何镜像（SSOT=components/ArchifyClip.tsx 的 BOX；角标注入层的落点依据）。 */
const FRAME = {left: 311, top: 150, w: 1298, h: 730} as const;

// ── 0-A 暴雨夜 ────────────────────────────────────────────────────────────

/** 雨丝：等速线性下落（逃生舱签名镜头——暴雨的机械感是主题，缓动反而失真）。 */
const RainLayer: React.FC<{dense?: boolean}> = ({dense = false}) => {
  const frame = useCurrentFrame();
  const n = dense ? 44 : 26;
  return (
    <AbsoluteFill style={{overflow: 'hidden', pointerEvents: 'none'}}>
      {Array.from({length: n}, (_, i) => {
        const speed = dense ? 6.5 + (i % 5) : 3.5 + (i % 4);
        const x = (i * 197 + ((i * i * 31) % 181)) % 1920;
        const y = ((i * 163 + Math.round(frame * speed)) % 1260) - 180;
        const len = dense ? 24 + (i % 3) * 11 : 16 + (i % 3) * 8;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: dense ? 2 : 1.5,
              height: len,
              background: theme.dim,
              opacity: dense ? 0.2 : 0.11,
              transform: 'rotate(9deg)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** 城市剪影（确定性生成，无随机）：楼群 + 零星亮窗，中性 dim、不占概念色。 */
const CityScape: React.FC = () => {
  const blocks = Array.from({length: 16}, (_, i) => ({
    x: i * 122 - 10,
    w: 86 + ((i * 37) % 50),
    h: 120 + ((i * 53) % 190),
  }));
  return (
    <svg
      width={1920}
      height={340}
      style={{position: 'absolute', left: 0, bottom: 0}}
      viewBox="0 0 1920 340"
    >
      {blocks.map((b, i) => (
        <rect key={i} x={b.x} y={340 - b.h} width={b.w} height={b.h} fill={theme.panel} />
      ))}
      {blocks.map((b, i) =>
        Array.from({length: 3}, (_, k) => {
          const wy = 340 - b.h + 22 + k * 34;
          if (wy > 318 || (i * 7 + k * 3) % 4 !== 0) return null;
          return (
            <rect
              key={`${i}-${k}`}
              x={b.x + 14 + ((i * 29 + k * 41) % Math.max(8, b.w - 34))}
              y={wy}
              width={7}
              height={9}
              fill={theme.dim}
              opacity={0.34}
            />
          );
        }),
      )}
    </svg>
  );
};

/** 主播口播条：街名雨量逐条滚动（等速线性 + 定宽集合取模，接缝无缝）。 */
const RainTicker: React.FC = () => {
  const frame = useCurrentFrame();
  const items = [
    '中山路 46mm/h',
    '延安西路 38mm/h',
    '滨江道 52mm/h',
    '人民路 31mm/h',
    '八一路 44mm/h',
    '解放路 29mm/h',
  ];
  const SET_W = 1150;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 46,
        background: '#0B0E13',
        borderTop: `1.5px solid ${theme.panelBorder}`,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {[0, 1, 2].map((s) => (
        <div
          key={s}
          style={{
            flex: '0 0 auto',
            width: SET_W,
            display: 'flex',
            justifyContent: 'space-between',
            paddingRight: 12,
            transform: `translateX(${-((frame * 2.1) % SET_W)}px)`,
          }}
        >
          {items.map((t) => (
            <span key={t} style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, whiteSpace: 'nowrap'}}>
              {t}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

/** 上半：电视墙＝主播演播室（base dim 中性光、不丑化——官方立场：纯聊天是正解）。 */
const StudioWall: React.FC = () => (
  <div style={{position: 'absolute', left: 300, top: 168, width: 1320, height: 330}}>
    {/* 两侧小监视器（电视墙） */}
    {[0, 1].map((s) => (
      <div
        key={s}
        style={{
          position: 'absolute',
          top: 46,
          width: 130,
          height: 220,
          borderRadius: 10,
          border: `2px solid ${theme.panelBorder}`,
          background: theme.panel,
          left: s === 0 ? 0 : undefined,
          right: s === 1 ? 0 : undefined,
          padding: 10,
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 110 200">
          {[0, 1, 2, 3].map((k) => (
            <rect
              key={k}
              x={12 + k * 25}
              y={160 - (34 + ((k * 37) % 30))}
              width={16}
              height={34 + ((k * 37) % 30)}
              fill={theme.dim}
              opacity={0.4}
            />
          ))}
          <line x1="6" y1="160" x2="104" y2="160" stroke={theme.panelBorder} strokeWidth={2} />
        </svg>
      </div>
    ))}
    {/* 主屏：主播台 */}
    <div
      style={{
        position: 'absolute',
        left: 170,
        right: 170,
        top: 0,
        bottom: 0,
        borderRadius: 14,
        border: `3px solid ${theme.panelBorder}`,
        background: '#0B0E13',
        padding: 8,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 8,
          background: theme.panel,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: 16,
            top: 12,
            fontFamily: theme.mono,
            fontSize: 17,
            color: theme.dim,
            letterSpacing: 2,
          }}
        >
          {'LIVE · AI 天气主播'}
        </div>
        <svg width="100%" height="218" viewBox="0 0 960 218" style={{display: 'block'}}>
          <ellipse cx="480" cy="112" rx="330" ry="86" fill={theme.dim} opacity={0.08} />
          <rect x="330" y="168" width="300" height="12" rx="4" fill={theme.panelBorder} />
          <path d="M392 168 Q400 106 480 100 Q560 106 568 168 Z" fill={theme.panelBorder} />
          <circle cx="480" cy="80" r="30" fill={theme.panelBorder} />
          <line x1="560" y1="150" x2="596" y2="112" stroke={theme.dim} strokeWidth="3" />
          <circle cx="600" cy="108" r="7" fill={theme.dim} />
        </svg>
        <RainTicker />
      </div>
    </div>
  </div>
);

/** 下半：值班室＝人工拍板台（章戳＋电话）——承接装置（P6 复核章戳同款语义）。 */
const DutyRoom: React.FC<{stampAt: number}> = ({stampAt}) => {
  const frame = useCurrentFrame();
  const drop = useSpring('settleSoft', {at: stampAt, dur: DUR.f6});
  const squash = useImpulse({at: stampAt + 16, dur: DUR.f4, peak: 0.16});
  const mark = progress(frame, stampAt + 20, DUR.f4);
  return (
    <div
      style={{
        position: 'absolute',
        left: 220,
        top: 538,
        width: 1480,
        height: 330,
        borderRadius: 14,
        border: `2px solid ${theme.panelBorder}`,
        background: theme.panel,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 20,
          top: 14,
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.dim,
          letterSpacing: 1,
        }}
      >
        {'值班室 · 人工拍板台'}
      </div>
      {/* 桌面 */}
      <div
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          bottom: 56,
          height: 12,
          borderRadius: 4,
          background: theme.panelBorder,
        }}
      />
      {/* 电话（老式） */}
      <svg width="150" height="120" viewBox="0 0 150 120" style={{position: 'absolute', right: 120, bottom: 66}}>
        <rect x="30" y="52" width="90" height="40" rx="10" fill={theme.panelBorder} />
        <rect x="22" y="30" width="106" height="14" rx="7" fill={theme.panelBorder} />
        <circle cx="30" cy="37" r="12" fill={theme.panelBorder} />
        <circle cx="120" cy="37" r="12" fill={theme.panelBorder} />
        <circle cx="55" cy="72" r="6" fill={theme.dim} opacity={0.5} />
        <circle cx="95" cy="72" r="6" fill={theme.dim} opacity={0.5} />
      </svg>
      {/* 停课决定单 */}
      <div
        style={{
          position: 'absolute',
          left: 300,
          bottom: 66,
          width: 300,
          height: 168,
          background: `${theme.text}0D`,
          border: `1.5px solid ${theme.dim}59`,
          borderRadius: 4,
          transform: 'rotate(-2deg)',
          padding: '14px 18px',
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'停课决定'}</div>
        {[0, 1, 2].map((k) => (
          <div
            key={k}
            style={{marginTop: 16, height: 2, width: k === 2 ? '62%' : '100%', background: `${theme.dim}38`}}
          />
        ))}
        {/* 章戳印痕：虚线圆环（官方印样式，非失败态——不用警示红） */}
        <div
          style={{
            position: 'absolute',
            right: 18,
            bottom: 14,
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: `2.5px dashed ${theme.dim}73`,
            opacity: mark,
            transform: `rotate(-14deg) scale(${0.8 + 0.2 * mark})`,
          }}
        />
      </div>
      {/* 章戳：落下 + 落地压扁一拍 */}
      <div
        style={{
          position: 'absolute',
          left: 560,
          bottom: 200,
          opacity: drop,
          transform: `translateY(${(1 - drop) * -190}px) scaleY(${1 - squash})`,
        }}
      >
        <svg width="90" height="104" viewBox="0 0 90 104">
          <rect x="34" y="0" width="22" height="46" rx="8" fill={theme.panelBorder} />
          <rect x="14" y="46" width="62" height="16" rx="5" fill={theme.dim} opacity={0.55} />
          <rect x="6" y="62" width="78" height="16" rx="4" fill={theme.panelBorder} />
          <rect x="10" y="78" width="70" height="6" rx="3" fill={theme.dim} opacity={0.4} />
        </svg>
      </div>
    </div>
  );
};

/** 0-A 舞台：雨夜城市 + 双景对切。 */
const NightSplit: React.FC<{stampAt: number}> = ({stampAt}) => (
  <AbsoluteFill>
    <RainLayer dense />
    <RainLayer />
    <CityScape />
    <StudioWall />
    <DutyRoom stampAt={stampAt} />
  </AbsoluteFill>
);

// ── 通用角标注入层（压在 archify 画框角上，画框外独立于 ArchifyYield） ──────

/** 图角小条：mono 标签，落点=画框右上角内缩 16px。 */
const CornerChip: React.FC<{
  at: number;
  top?: number;
  accent?: string;
  dimAfter?: number;
  children: React.ReactNode;
}> = ({at, top = FRAME.top + 16, accent, dimAfter, children}) => {
  const frame = useCurrentFrame();
  const o = progress(frame, at, DUR.f4);
  const dim = dimAfter !== undefined ? 1 - 0.62 * progress(frame, dimAfter, DUR.f4) : 1;
  return (
    <div
      style={{
        position: 'absolute',
        right: 1920 - (FRAME.left + FRAME.w) + 16,
        top,
        padding: '8px 16px',
        borderRadius: 8,
        background: `${theme.panel}E6`,
        border: `1.5px solid ${accent ?? theme.panelBorder}`,
        fontFamily: theme.mono,
        fontSize: 20,
        color: accent ?? theme.text,
        whiteSpace: 'nowrap',
        opacity: o * dim,
        transform: `translateY(${(1 - o) * -10}px)`,
      }}
    >
      {children}
    </div>
  );
};

/** p0-05 官方开篇引文小条（虚线徽＝官方自报样式，引文有归属、非复述卡）。 */
const QuoteStrip: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const o = progress(frame, at, DUR.f5);
  return (
    <div
      style={{
        position: 'absolute',
        right: 1920 - (FRAME.left + FRAME.w) + 16,
        top: FRAME.top + 16,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 18px',
        borderRadius: 10,
        border: `1.5px dashed ${theme.dim}99`,
        background: `${theme.panel}F2`,
        opacity: o,
        transform: `translateY(${(1 - o) * -12}px)`,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          border: `2px dashed ${theme.dim}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.sans,
          fontSize: 15,
          color: theme.dim,
          flex: '0 0 auto',
        }}
      >
        {'官'}
      </div>
      <div>
        <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.text}}>
          {'「聊天早就超人了，自动化呢？」'}
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginTop: 3}}>
          {'官方文档 · 开篇之问'}
        </div>
      </div>
    </div>
  );
};

// ── 0-B/0-D 判读员工位 ────────────────────────────────────────────────────

/** 预报单轮廓〔M-001〕：格黄描边 + 行线 + 预印格虚框，只露轮廓不填内容（全片母题首亮相）。
 *  markW：第 1 行第 2 格（判读员落笔目标格）内的笔迹宽度，由 ReaderDesk 按笔尖位置喂入。 */
const ForecastOutline: React.FC<{markW?: number}> = ({markW}) => {
  const rows = [3, 5, 4]; // 每行预印格数
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        padding: 13,
      }}
    >
      {rows.map((cells, r) => (
        <div
          key={r}
          style={{
            height: '33.33%',
            borderBottom: r < 2 ? `1.5px solid ${theme.slot}47` : 'none',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: '6px 4px',
          }}
        >
          {Array.from({length: cells}, (_, c) => {
            const isTarget = r === 0 && c === 1;
            return (
              <div
                key={c}
                style={{
                  flex: 1,
                  height: '72%',
                  borderRadius: 3,
                  border: `1.2px solid ${theme.slot}59`,
                  position: 'relative',
                }}
              >
                {isTarget && markW !== undefined && markW > 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      height: 2.5,
                      width: markW,
                      background: `${theme.dim}A8`,
                      borderRadius: 2,
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** 判读员工位：一桌一灯一剪影 + 预报单 + 匀速落笔（〔M-002〕零强调动效）。
 *  stopAt 后笔尖停在格心；zoomAt 起镜头推近（大特写）。shift 用于 0-D 左移让位天平。 */
const ReaderDesk: React.FC<{
  stopAt: number;
  zoomAt?: number;
  shift?: number;
  penHold?: boolean;
  lightAt?: number;
}> = ({stopAt, zoomAt, shift = 0, penHold = false, lightAt}) => {
  const frame = useCurrentFrame();
  const cx = 960 + shift;
  // M-002：匀速线性落笔，从 beat 起写到位（不缓动、不弹簧）；0-D 直接持笔停格心。
  // 坐标系=预报单内：起笔在第 1 行第 1 格，停笔在第 1 行第 2 格中心（大特写焦点）。
  const TIP_Y = 52;
  const PEN_FROM = 40;
  const PEN_TO = 346;
  const CELL2_FROM = 239;
  const CELL2_W = 214;
  const p = penHold ? 1 : Math.min(1, frame / Math.max(1, stopAt));
  const penX = PEN_FROM + (PEN_TO - PEN_FROM) * p;
  const wiggle = p < 1 ? Math.sin(frame / 2.2) * 1.5 : 0;
  const markW = Math.max(0, Math.min(CELL2_W, penX - CELL2_FROM));
  const zoom = 1 + (zoomAt !== undefined ? 0.35 * progress(frame, zoomAt, DUR.f6) : 0);
  const light =
    lightAt !== undefined ? 0.3 + 0.7 * progress(frame, lightAt, DUR.f5) : 1;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${zoom})`,
          transformOrigin: `${cx}px 700px`,
        }}
      >
        {/* 灯：吊线 + 罩 + 光锥（0-D 复亮：lightAt 起从 0.3 提到 1） */}
        <div style={{position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: light}}>
          <div
            style={{
              position: 'absolute',
              left: cx - 1.5,
              top: 150,
              width: 3,
              height: 56,
              background: theme.panelBorder,
            }}
          />
          <svg width={700} height={500} viewBox="0 0 700 500" style={{position: 'absolute', left: cx - 350, top: 150}}>
            <polygon
              points={`${350-70},66 ${350+70},66 ${350+34},20 ${350-34},20`}
              fill={theme.panelBorder}
            />
            <circle cx={350} cy={64} r={6} fill={theme.dim} />
            <polygon points={`298,66 402,66 680,490 20,490`} fill={theme.dim} opacity={0.1} />
          </svg>
        </div>
        {/* 判读员剪影（伏案） */}
        <svg width={520} height={330} viewBox="0 0 520 330" style={{position: 'absolute', left: cx - 260, top: 300}}>
          <circle cx={260} cy={64} r={34} fill={theme.panelBorder} />
          <path d="M186 330 Q192 176 260 168 Q328 176 334 330 Z" fill={theme.panelBorder} />
          <path d="M300 250 Q350 262 386 300" stroke={theme.panelBorder} strokeWidth={13} strokeLinecap="round" fill="none" />
        </svg>
        {/* 桌面 */}
        <div
          style={{
            position: 'absolute',
            left: cx - 480,
            top: 560,
            width: 960,
            height: 13,
            borderRadius: 4,
            background: theme.panelBorder,
          }}
        />
        {/* 预报单轮廓（M-001）+ 笔 */}
        <div
          style={{
            position: 'absolute',
            left: cx - 350,
            top: 600,
            width: 700,
            height: 262,
            borderRadius: 6,
            border: `2.5px solid ${theme.slot}`,
            background: `${theme.slot}08`,
            transform: 'rotate(-1.2deg)',
            opacity: light === 1 ? 1 : Math.max(0.55, light),
            /* position 已是 absolute：笔与轮廓以其为定位祖先（旋转随单面） */
          }}
        >
          <ForecastOutline markW={markW} />
          {/* 笔：匀速移动，笔尖=锚点；p0-08 停在格心（第 1 行第 2 格中心） */}
          <div
            style={{
              position: 'absolute',
              left: penX - 2,
              top: TIP_Y - 72 + wiggle,
              width: 4,
              height: 64,
              borderRadius: 2,
              background: theme.dim,
              transform: 'rotate(16deg)',
              transformOrigin: '50% 100%',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                bottom: -7,
                marginLeft: -3,
                width: 0,
                height: 0,
                borderLeft: '3px solid transparent',
                borderRight: '3px solid transparent',
                borderBottom: `8px solid ${theme.text}`,
              }}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 0-C 三级角标图例卡 ────────────────────────────────────────────────────

type BadgeKind = 'official' | 'field' | 'recompute';

const BADGE_META: Record<BadgeKind, {face: string; label: string; sub: string}> = {
  official: {face: '官', label: '官方自报', sub: ''},
  field: {face: '测', label: '第三方实测', sub: '外测 · ＿＿＿'},
  recompute: {face: '✓', label: '我们复算', sub: '复算 · ＿＿＿'},
};

/** 单枚圆徽：线型/亮度编码来源（虚线/实线/实心），单色不占概念色相。 */
const TriadBadge: React.FC<{kind: BadgeKind; lit: number; size?: number}> = ({kind, lit, size = 96}) => {
  const m = BADGE_META[kind];
  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: theme.sans,
    fontWeight: 600,
    opacity: 0.28 + 0.72 * lit,
    transform: `scale(${0.9 + 0.1 * lit})`,
    flex: '0 0 auto',
  };
  if (kind === 'official') {
    return (
      <div style={{...base, border: `2.5px dashed ${theme.dim}`, color: theme.dim, fontSize: 32}}>
        {m.face}
      </div>
    );
  }
  if (kind === 'field') {
    return (
      <div style={{...base, border: `2.5px solid ${theme.dim}`, color: theme.dim, fontSize: 32}}>
        {m.face}
      </div>
    );
  }
  return (
    <div style={{...base, background: theme.dim, color: theme.bg, fontSize: 42}}>{m.face}</div>
  );
};

/** 0-C 图例卡：卡顶「谁量的？」+ 三徽随句各亮；p0-18 三徽缩小飞向画面角、轻晃一拍。 */
const LegendCard: React.FC<{a15: number; a16: number; a17: number; a18: number}> = ({a15, a16, a17, a18}) => {
  const frame = useCurrentFrame();
  const cardIn = useSpring('settle', {at: 0, dur: DUR.f5}); // p0-13 卡片下滑入停驻
  const lits = [a15, a16, a17].map((a) => progress(frame, a, DUR.f4));
  const kinds: BadgeKind[] = ['official', 'field', 'recompute'];
  // 飞向占位角（避开 y<56 章节条与 y>920 字幕带）
  const targets: [number, number][] = [
    [1755, 172],
    [1755, 742],
    [165, 742],
  ];
  const slots: [number, number][] = [
    [660, 402],
    [960, 402],
    [1260, 402],
  ];
  const cardDim = 1 - 0.6 * progress(frame, a18, DUR.f5);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, opacity: cardDim}}>
        <div
          style={{
            position: 'absolute',
            left: 370,
            top: 236,
            width: 1180,
            height: 560,
            borderRadius: 16,
            background: theme.panel,
            border: `2px solid ${theme.panelBorder}`,
            opacity: cardIn,
            transform: `translateY(${(1 - cardIn) * -64}px)`,
          }}
        >
          <div
            style={{
              textAlign: 'center',
              marginTop: 34,
              fontFamily: theme.serif,
              fontSize: 42,
              fontWeight: 700,
              color: theme.text,
            }}
          >
            {'谁量的？'}
          </div>
          <div
            style={{
              textAlign: 'center',
              marginTop: 10,
              fontFamily: theme.mono,
              fontSize: 18,
              color: theme.dim,
            }}
          >
            {'数字可信度 · 三级角标'}
          </div>
        </div>
      </div>
      {kinds.map((k, i) => {
        const m = BADGE_META[k];
        const t = progress(frame, a18 + i * 3, DUR.f6);
        const acc = t * t; // 出场加速
        const [tx, ty] = targets[i];
        const [sx, sy] = slots[i];
        const land = a18 + i * 3 + DUR.f6 + 4;
        const wob = t >= 1 ? Math.sin((frame - land) / 1.6) * 3.5 * (1 - progress(frame, land, 16)) : 0;
        return (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: sx,
              top: sy,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14,
              opacity: cardIn,
              transform: `translate(calc(-50% + ${(tx - sx) * acc}px), ${
                (ty - sy) * acc + (1 - cardIn) * -64
              }px) scale(${1 - 0.55 * acc}) rotate(${wob}deg)`,
            }}
          >
            <TriadBadge kind={k} lit={lits[i]} />
            <div style={{fontFamily: theme.sans, fontSize: 27, color: theme.text}}>{m.label}</div>
            {m.sub ? (
              <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: -6}}>{m.sub}</div>
            ) : (
              <div style={{height: 27, marginTop: -6}} /> // 占位对齐（官方自报无署名位）
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── 0-D 三承诺过秤 ────────────────────────────────────────────────────────

/** 过秤天平：三枚承诺砝码（不越界/诚实/快两个数量级——关键词）；pressAt 起整体压向「过秤」端。 */
const ScalePan: React.FC<{hangAt: number; pressAt: number}> = ({hangAt, pressAt}) => {
  const hang = useSpring('settleSoft', {at: hangAt, dur: DUR.f6});
  const press = useSpring('settle', {at: pressAt, dur: DUR.f6});
  const weights = [
    {label: '不越界', accent: theme.slot},
    {label: '诚实', accent: theme.bar},
    {label: '快两个数量级', accent: theme.text},
  ];
  const angle = -8 * press;
  return (
    <div
      style={{
        position: 'absolute',
        left: 1290,
        top: 316,
        width: 480,
        height: 440,
        opacity: hang,
        transform: `translateY(${(1 - hang) * -170}px)`,
      }}
    >
      <svg width="480" height="440" viewBox="0 0 480 440">
        {/* 底座 + 立柱 + 支点 */}
        <path d="M186 432 L294 432 L266 398 L214 398 Z" fill={theme.panelBorder} />
        <rect x="236" y="112" width="8" height="290" fill={theme.panelBorder} />
        <circle cx="240" cy="106" r="8" fill={theme.dim} />
        <g transform={`rotate(${angle} 240 106)`}>
          <rect x="80" y="100" width="320" height="9" rx="4" fill={theme.panelBorder} />
          <line x1="90" y1="109" x2="90" y2="212" stroke={theme.dim} strokeWidth="2" />
          <line x1="390" y1="109" x2="390" y2="212" stroke={theme.dim} strokeWidth="2" />
          {/* 左盘（砝码侧） */}
          <rect x="15" y="212" width="150" height="24" rx="12" fill={theme.panel} stroke={theme.panelBorder} strokeWidth="2" />
          <text x="90" y="266" textAnchor="middle" fontFamily={theme.mono} fontSize="20" fill={theme.dim}>
            过秤
          </text>
          {/* 右盘 */}
          <rect x="315" y="212" width="150" height="24" rx="12" fill={theme.panel} stroke={theme.panelBorder} strokeWidth="2" />
        </g>
      </svg>
      {/* 三枚砝码：随梁倾斜的组（挂在左盘上方） */}
      <div
        style={{
          position: 'absolute',
          left: 15,
          top: 104,
          width: 150,
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: 6,
          alignItems: 'center',
          transform: `rotate(${angle}deg)`,
          transformOrigin: '240px 106px',
        }}
      >
        {weights.map((w) => (
          <div
            key={w.label}
            style={{
              width: 142,
              padding: '7px 6px',
              borderRadius: 6,
              background: theme.panel,
              border: `2px solid ${w.accent}`,
              color: w.accent,
              fontFamily: theme.sans,
              fontSize: 19,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {w.label}
          </div>
        ))}
      </div>
    </div>
  );
};

/** p0-22 画面右缘暗红门缝（P1 转场预告——分镜明示的警示红唯一豁免点）。 */
const DoorCrack: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const p = progress(frame, at, DUR.f6);
  return (
    <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, width: 130, pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 26 * p,
          background: `linear-gradient(to left, ${theme.danger}5C, transparent)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: theme.danger,
          opacity: 0.85 * p,
          boxShadow: `0 0 22px ${theme.danger}66`,
        }}
      />
    </div>
  );
};

// ── 幕组装 ────────────────────────────────────────────────────────────────

export const P0Anchor: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const bA = w('p0-01', 'p0-05');
  const bB = w('p0-06', 'p0-12');
  const bC = w('p0-13', 'p0-18');
  const bD = w('p0-19', 'p0-22');
  // 0-D 三段路径承诺标签：沿画框顶边按段落分布（左/中/右），句内错峰
  const promiseTags = [
    {label: '不越界', accent: theme.slot},
    {label: '诚实', accent: theme.bar},
    {label: '快两个数量级', accent: theme.text},
  ];
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 暴雨夜双景对切">
        <SceneTag chapter="P0" tagline="主播与判读员" accent={theme.dim} />
        <ArchifyYield
          cues={[
            {at: at('p0-03') - bA.from, durationInFrames: dur('p0-03') + dur('p0-04') + dur('p0-05')},
          ]}
        >
          <NightSplit stampAt={at('p0-02') - bA.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="two-deliveries"
          caption="两种交付路径 · 旧路"
          cues={[
            {chapterId: 'td-old', at: at('p0-03') - bA.from, durationInFrames: dur('p0-03') + dur('p0-04') + dur('p0-05')},
          ]}
        />
        <QuoteStrip at={at('p0-05') - bA.from} />
      </Sequence>

      <Sequence {...bB} name="0-B 判读员工位首亮相">
        <SceneTag chapter="P0" tagline="主播与判读员" accent={theme.dim} />
        <ArchifyYield
          cues={[
            {at: at('p0-09') - bB.from, durationInFrames: dur('p0-09') + dur('p0-10') + dur('p0-11') + dur('p0-12')},
          ]}
        >
          <ReaderDesk stopAt={at('p0-08') - bB.from} zoomAt={at('p0-08') - bB.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="two-deliveries"
          caption="两种交付路径 · 新路"
          cues={[
            {chapterId: 'td-new', at: at('p0-09') - bB.from, durationInFrames: dur('p0-09') + dur('p0-10') + dur('p0-11') + dur('p0-12')},
          ]}
        />
        <CornerChip at={at('p0-10') - bB.from} top={FRAME.top + 16} dimAfter={at('p0-12') - bB.from}>
          {'Jev · System One'}
        </CornerChip>
        <CornerChip at={at('p0-11') - bB.from} top={FRAME.top + 74} dimAfter={at('p0-12') - bB.from}>
          {'Kahneman ·《思考，快与慢》'}
        </CornerChip>
        <CornerChip at={at('p0-12') - bB.from} top={FRAME.top + 132}>
          {'训练有素的快判'}
        </CornerChip>
      </Sequence>

      <Sequence {...bC} name="0-C 三级角标图例卡">
        <SceneTag chapter="P0" tagline="主播与判读员" accent={theme.dim} />
        <LegendCard
          a15={at('p0-15') - bC.from}
          a16={at('p0-16') - bC.from}
          a17={at('p0-17') - bC.from}
          a18={at('p0-18') - bC.from}
        />
      </Sequence>

      <Sequence {...bD} name="0-D 三承诺过秤">
        <SceneTag chapter="P0" tagline="主播与判读员" accent={theme.dim} />
        <ArchifyYield cues={[{at: at('p0-20') - bD.from, durationInFrames: dur('p0-20')}]}>
          <ReaderDesk shift={-260} stopAt={0} penHold lightAt={0} />
          <ScalePan hangAt={0} pressAt={at('p0-21') - bD.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="two-deliveries"
          caption="两种交付路径 · 新路（重放）"
          cues={[{chapterId: 'td-new', at: at('p0-20') - bD.from, durationInFrames: dur('p0-20')}]}
        />
        <PromiseTags at20={at('p0-20') - bD.from} tags={promiseTags} />
        <DoorCrack at={at('p0-22') - bD.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 0-D 承诺标签组：三段路径各钉一枚，句内错峰亮起（钩子须在组件顶层——map 内不调用）。 */
const PromiseTags: React.FC<{at20: number; tags: {label: string; accent: string}[]}> = ({at20, tags}) => {
  const frame = useCurrentFrame();
  const xs = [FRAME.left + 0.26 * FRAME.w, FRAME.left + 0.52 * FRAME.w, FRAME.left + 0.78 * FRAME.w];
  return (
    <>
      {tags.map((t, i) => {
        const o = progress(frame, at20 + 8 + i * 10, DUR.f4);
        return (
          <div
            key={t.label}
            style={{
              position: 'absolute',
              left: xs[i],
              top: FRAME.top + 18,
              transform: `translateX(-50%) translateY(${(1 - o) * -10}px)`,
              padding: '8px 18px',
              borderRadius: 8,
              background: `${theme.panel}E6`,
              border: `2px solid ${t.accent}`,
              color: t.accent,
              fontFamily: theme.sans,
              fontSize: 22,
              whiteSpace: 'nowrap',
              opacity: o,
            }}
          >
            {t.label}
          </div>
        );
      })}
    </>
  );
};
