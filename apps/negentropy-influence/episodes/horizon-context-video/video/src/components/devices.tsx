/** 本集专用视觉装置库（v3）。
 *
 *  统一空间隐喻 = **受治理带教大厦纵剖面**：七机制各占一个固定部位、严格单射、
 *  全片不换位。角落常驻七格承重列 HUD，讲完一个机制点亮一根柱子。
 *
 *  设计纪律（与运动层铁律一致）：本文件只产出**形状与排版**，动画时点一律由
 *  调用侧用句边界推导后以 `at` / `delay` 传入；组件内部只在顶层调 hooks，
 *  map 内一律用纯函数 `progress`。
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {DUR, progress, useBreathe, useProgress, useSpring, useStagger} from '../motion';

/** 证据分级角标——口播义务的画面执法点（planning §二） */
export type EvidenceGrade = 'lab' | 'official' | 'vendor' | 'thirdparty';
const GRADE: Record<EvidenceGrade, {t: string; c: string}> = {
  lab: {t: '【一】本仓原型实测输出', c: theme.engine},
  official: {t: '【二】官方机制转述', c: theme.dim},
  vendor: {t: '【三】厂商自报基准', c: theme.manual},
  thirdparty: {t: '【四】第三方独立复现', c: theme.dig},
};

export const EvidenceBadge: React.FC<{
  grade: EvidenceGrade;
  at?: number;
  /** 顶边 y。默认 44；同镜有 ArchifyClip 的 inset 画框（y∈[56,315]，底色不透明）时
   *  必须下移到 335 以下，否则角标会被画框整块压住（2026-09-19 抽帧实测）。 */
  top?: number;
}> = ({grade, at = 4, top = 44}) => {
  const o = useProgress(at, DUR.f4);
  const g = GRADE[grade];
  return (
    <div
      style={{
        position: 'absolute',
        right: 44,
        top,
        padding: '6px 14px',
        borderRadius: 999,
        border: `1px solid ${g.c}66`,
        background: `${g.c}14`,
        color: g.c,
        fontFamily: theme.sans,
        fontSize: 20,
        letterSpacing: 0.5,
        opacity: o,
      }}
    >
      {g.t}
    </div>
  );
};

/** 七格承重列 HUD：常驻左下，讲完一个机制点亮一根柱子 */
export const PillarHUD: React.FC<{lit: number; at?: number}> = ({lit, at = 0}) => {
  const frame = useCurrentFrame();
  const o = useProgress(at, DUR.f5);
  const names = ['手册', '验放', '承重墙', '底稿', '台账', '工牌', '贴标'];
  return (
    <div
      style={{
        position: 'absolute',
        left: 44,
        bottom: 196,
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
        opacity: 0.92 * o,
      }}
    >
      {names.map((n, i) => {
        const on = i < lit;
        const p = on ? progress(frame, at + 4 + i * 3, DUR.f4) : 0;
        return (
          <div key={n} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5}}>
            <div
              style={{
                width: 16,
                height: 40 + 14 * p,
                borderRadius: 3,
                background: on ? theme.engine : `${theme.panelBorder}`,
                boxShadow: on ? `0 0 ${10 * p}px ${theme.engine}88` : 'none',
                opacity: on ? 0.55 + 0.45 * p : 0.5,
              }}
            />
            <span
              style={{
                fontFamily: theme.sans,
                fontSize: 13,
                color: on ? theme.text : theme.dim,
                opacity: on ? 0.9 : 0.5,
              }}
            >
              {n}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/** 母图部位名：七机制严格单射，全片不换位 */
export type BuildingFocus = 'manual' | 'gate' | 'wall' | 'stamp' | 'ledger' | 'badge' | 'tag';

/** 大厦纵剖面母图：七个部位固定落位，`focus` 指定本幕高亮哪一层 */
export const BuildingSection: React.FC<{
  focus?: BuildingFocus | null;
  at?: number;
  scale?: number;
  collapsed?: boolean;
  /** 高亮层辉光强度 0..1（时点由调用侧给）；默认 0 = 与旧版逐像素一致 */
  halo?: number;
}> = ({focus = null, at = 0, scale = 1, collapsed = false, halo = 0}) => {
  const grow = useSpring('settle', {at, dur: DUR.f6});
  const frame = useCurrentFrame();
  const floors: {k: NonNullable<typeof focus>; label: string; c: string}[] = [
    {k: 'manual', label: '顶层规章室 · 规章手册', c: theme.manual},
    {k: 'gate', label: '各层电梯厅 · 逐页验放闸', c: theme.engine},
    {k: 'wall', label: '贯穿承重墙 · 焊死的执法点', c: theme.engine},
    {k: 'stamp', label: '一层问询窗口 · 盖章底稿', c: theme.manual},
    {k: 'badge', label: '大门发牌处 · 专用工牌', c: theme.engine},
    {k: 'tag', label: '装卸货码头 · 自动贴标', c: theme.dig},
    {k: 'ledger', label: '地下机房 · 出入库台账', c: theme.engine},
  ];
  const H = 78;
  return (
    <div
      style={{
        position: 'relative',
        width: 760 * scale,
        transform: `scaleY(${grow})`,
        transformOrigin: 'bottom center',
      }}
    >
      {floors.map((f, i) => {
        const on = focus === f.k;
        const p = progress(frame, at + 6 + i * 3, DUR.f5);
        const isLast = i === floors.length - 1;
        const sag = collapsed && isLast ? 30 : 0;   // 只给间距，不再叠 translateY
        return (
          <div
            key={f.k}
            style={{
              height: H * scale,
              marginTop: i === 0 ? 0 : 6,
              marginBottom: sag,
              borderRadius: 8,
              border: `2px solid ${on ? f.c : theme.panelBorder}`,
              background: on ? `${f.c}1C` : `${theme.panel}`,
              boxShadow: on ? `0 0 ${26 + 26 * halo}px ${f.c}55` : 'none',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 22,
              opacity: 0.35 + 0.65 * p,
              transform: sag ? 'rotate(-1.2deg)' : 'none',
            }}
          >
            <span
              style={{
                fontFamily: theme.sans,
                fontSize: 22 * scale,
                color: on ? theme.text : theme.dim,
                letterSpacing: 0.6,
              }}
            >
              {f.label}
            </span>
          </div>
        );
      })}
      {collapsed ? (
        <div
          style={{
            marginTop: 10,
            height: 56 * scale,
            borderRadius: 6,
            background: `${theme.danger}22`,
            border: `2px dashed ${theme.danger}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontSize: 30 * scale,
            color: theme.danger,
          }}
        >
          地基：上游已按天打包塌缩
        </div>
      ) : null}
    </div>
  );
};

/** 机制推近：母图定位该机制所在部位 + 右栏逐句落位的卡片。
 *
 *  planning.md §三 的母图出场契约是「P1 展开 1 + **每机制推近 7** + P5 合拢 1 + P6 塌方 1」，
 *  本组件就是那 7 次推近的载体：讲到哪个机制，先把摄影机推到它在大厦里的固定部位。 */
export const MechZoom: React.FC<{
  focus: BuildingFocus;
  /** 本子镜帧长（调用侧由句边界作差）——推镜匀速铺满全程 */
  spanInFrames: number;
  scale?: number;
  zoom?: number;
  gap?: number;
  children?: React.ReactNode;
}> = ({focus, spanInFrames, scale = 0.78, zoom = 0.07, gap = 56, children}) => {
  // 刻意用线性而非 usePushIn：后者硬编码 decelerate，九成行程压在前三分之一、
  // 留下准静止尾巴 —— 正是 ISSUE-187 ① 要消除的那类缺陷。线性让「无静止段」由构造保证。
  const push = useProgress(0, spanInFrames, 'linear');
  const halo = useBreathe({period: 96, base: 0.5, amp: 0.5});
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap,
        transform: `scale(${1 + zoom * push})`,
        transformOrigin: 'center center',
      }}
    >
      <BuildingSection focus={focus} scale={scale} halo={halo} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 18}}>{children}</div>
    </div>
  );
};

/** 推近右栏的提问卡：把本机制要答的那个问题先摆上桌。
 *  用 dim 不用 danger —— 提问不是错误数字也不是越权泄露（planning §三 色彩语义唯一）。 */
export const AskCard: React.FC<{
  at: number;
  kicker: string;
  body: string;
  width?: number;
}> = ({at, kicker, body, width = 430}) => {
  const p = useProgress(at, DUR.f5);
  return (
    <div
      style={{
        width,
        padding: '22px 26px',
        borderRadius: 12,
        border: `2px solid ${theme.panelBorder}`,
        background: theme.panel,
        opacity: p,
        transform: `translateY(${(1 - p) * 16}px)`,
      }}
    >
      <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginBottom: 8}}>
        {kicker}
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.text, lineHeight: 1.5}}>
        {body}
      </div>
    </div>
  );
};

/** 左右分屏对照台：讲「两种不同的坏法」用——一张图讲不出「两条正交轴」 */
export const SplitCompare: React.FC<{
  left: {title: string; body: string; tone?: string};
  right: {title: string; body: string; tone?: string};
  at?: number;
}> = ({left, right, at = 0}) => {
  const [a, b] = useStagger(2, {at, stride: 8, dur: DUR.f5});
  const cell = (
    s: {title: string; body: string; tone?: string},
    p: number,
  ) => (
    <div
      style={{
        flex: 1,
        padding: '28px 30px',
        borderRadius: 12,
        border: `2px solid ${s.tone ?? theme.danger}`,
        background: `${s.tone ?? theme.danger}12`,
        opacity: p,
        transform: `translateY(${(1 - p) * 18}px)`,
      }}
    >
      <div
        style={{
          fontFamily: theme.sans,
          fontSize: 30,
          color: s.tone ?? theme.danger,
          marginBottom: 14,
          fontWeight: 600,
        }}
      >
        {s.title}
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text, lineHeight: 1.55}}>
        {s.body}
      </div>
    </div>
  );
  return (
    <div style={{display: 'flex', gap: 26, width: 1420}}>
      {cell(left, a)}
      {cell(right, b)}
    </div>
  );
};

/** 数字对撞卡：坏数字 vs 对数字（全片反复出现的实测对照） */
export const NumberClash: React.FC<{
  badLabel: string;
  bad: string;
  goodLabel: string;
  good: string;
  at?: number;
}> = ({badLabel, bad, goodLabel, good, at = 0}) => {
  const [a, b] = useStagger(2, {at, stride: 10, dur: DUR.f5});
  const side = (label: string, v: string, c: string, p: number, dir: number) => (
    <div
      style={{
        padding: '22px 34px',
        borderRadius: 12,
        border: `2px solid ${c}`,
        background: `${c}14`,
        opacity: p,
        transform: `translateX(${(1 - p) * 30 * dir}px)`,
        textAlign: 'center',
      }}
    >
      <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginBottom: 8}}>
        {label}
      </div>
      <div style={{fontFamily: theme.mono, fontSize: 60, color: c, letterSpacing: 1}}>{v}</div>
    </div>
  );
  return (
    <div style={{display: 'flex', gap: 40, alignItems: 'center'}}>
      {side(badLabel, bad, theme.danger, a, -1)}
      <div style={{fontFamily: theme.sans, fontSize: 34, color: theme.dim, opacity: b}}>vs</div>
      {side(goodLabel, good, theme.ok, b, 1)}
    </div>
  );
};

/** 幕级标题条 + 主体插槽：统一每幕的排版骨架 */
export const Stage: React.FC<{
  children: React.ReactNode;
  gap?: number;
  top?: number;
}> = ({children, gap = 34, top = 150}) => (
  <AbsoluteFill
    style={{
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: top,
      gap,
    }}
  >
    {children}
  </AbsoluteFill>
);
