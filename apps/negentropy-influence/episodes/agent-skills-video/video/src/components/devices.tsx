/** 本集专用视觉装置库（agent-skills-video）。
 *
 *  统一空间隐喻 = **公司手册柜**：一格放一本（格子标签 = 文件夹名）、书脊朝外
 *  （书脊 = 名字 + 描述）、一整排书脊 = 目录；全片不换剧场。
 *
 *  设计纪律（与运动层铁律一致）：本文件只产出形状与排版；动画时点一律由调用侧
 *  以 `at` / `delay` 传入；组件内部只在顶层调 hooks，map 内一律用纯函数 progress。
 */
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {DUR, progress, useImpulse, useProgress, useSpring, useStagger} from '../motion';

/** 证据分级角标——口播义务的画面执法点（planning §二） */
export type EvidenceGrade = 'lab' | 'official' | 'vendor' | 'thirdparty';
const GRADE: Record<EvidenceGrade, {t: string; c: string}> = {
  lab: {t: '【一】本仓原型实测输出', c: theme.ok},
  official: {t: '【二】官方文档讲法', c: theme.dim},
  vendor: {t: '【三】厂商口径（须归属）', c: theme.forge},
  thirdparty: {t: '【四】第三方文献（须归属）', c: theme.spine},
};

export const EvidenceBadge: React.FC<{grade: EvidenceGrade; at?: number; top?: number}> = ({
  grade,
  at = 4,
  top = 44,
}) => {
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

/** 三格进度 HUD：淬炼 → 装配 → 边界（本集三段主线），常驻左下，讲完一段亮一格。 */
export const ActHUD: React.FC<{lit: number; at?: number}> = ({lit, at = 0}) => {
  const frame = useCurrentFrame();
  const o = useProgress(at, DUR.f5);
  const names = ['淬炼', '装配', '边界'];
  return (
    <div style={{position: 'absolute', left: 72, bottom: 170, display: 'flex', gap: 10, opacity: o}}>
      {names.map((n, i) => {
        const on = progress(frame, at + 6 + i * 4, DUR.f3);
        const active = i < lit;
        return (
          <div
            key={n}
            style={{
              padding: '5px 12px',
              borderRadius: 8,
              border: `1.5px solid ${active ? theme.forge : theme.panelBorder}`,
              color: active ? theme.forge : theme.dim,
              fontFamily: theme.sans,
              fontSize: 18,
              opacity: 0.35 + on * (active ? 0.65 : 0),
            }}
          >
            {n}
          </div>
        );
      })}
    </div>
  );
};

/** 经验气泡：老师傅头顶只增不散的隐性经验（0-A）。 */
export const NoteBubbles: React.FC<{items: string[]; at: number}> = ({items, at}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'absolute', left: 360, top: 330, width: 900, display: 'flex', flexWrap: 'wrap', gap: 14}}>
      {items.map((t, i) => {
        const p = progress(frame, at + i * 10, DUR.f4);
        return (
          <div
            key={t}
            style={{
              padding: '10px 18px',
              borderRadius: 16,
              background: `${theme.forge}1E`,
              border: `1.5px solid ${theme.forge}55`,
              color: theme.forge,
              fontFamily: theme.sans,
              fontSize: 24,
              opacity: p,
              transform: `translateY(${(1 - p) * 14}px)`,
            }}
          >
            {t}
          </div>
        );
      })}
    </div>
  );
};

/** 四格便签：步骤 / 纠正 / 格式 / 背景（1-C）。 */
export const NoteQuad: React.FC<{labels: string[]; at: number}> = ({labels, at}) => {
  const st = useStagger(labels.length, {at, dur: DUR.f4, stride: 6});
  const colors = [theme.forge, theme.danger, theme.book, theme.spine];
  return (
    <div style={{display: 'flex', gap: 26}}>
      {labels.map((t, i) => (
        <div
          key={t}
          style={{
            width: 250,
            height: 190,
            padding: '18px 20px',
            borderRadius: 4,
            background: theme.panel,
            borderTop: `6px solid ${colors[i]}`,
            boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
            color: theme.text,
            fontFamily: theme.sans,
            fontSize: 30,
            lineHeight: 1.4,
            opacity: st[i],
            transform: `translateY(${(1 - st[i]) * 26}px) rotate(${(i % 2 ? 1 : -1) * (1 - st[i]) * 4}deg)`,
          }}
        >
          第{i + 1}格
          <div style={{fontSize: 26, color: colors[i], marginTop: 10}}>{t}</div>
        </div>
      ))}
    </div>
  );
};

/** 手册柜格阵：一格一本、格子贴标签、书脊朝外（2-A / P3 背景 / 5-E）。
 *  slots: [{label, spine, tone}]；litTo 依次点亮前 litTo 个格位。 */
export const CabinetGrid: React.FC<{
  slots: {label: string; spine: string; tone?: string}[];
  at: number;
  litTo?: number;
}> = ({slots, at, litTo = slots.length}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(6, 150px)', gap: 18}}>
      {slots.map((s, i) => {
        const lit = i < litTo ? progress(frame, at + i * 5, DUR.f4) : 0;
        const tone = s.tone ?? theme.spine;
        return (
          <div key={s.label + i} style={{opacity: 0.25 + lit * 0.75}}>
            <div
              style={{
                height: 200,
                borderRadius: 6,
                border: `2px solid ${tone}${lit > 0.5 ? 'AA' : '44'}`,
                background: theme.panel,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 54,
                  height: 150,
                  borderRadius: 4,
                  background: `${tone}2E`,
                  border: `1.5px solid ${tone}88`,
                  writingMode: 'vertical-rl',
                  textAlign: 'center',
                  fontFamily: theme.sans,
                  fontSize: 19,
                  color: tone,
                  letterSpacing: 2,
                }}
              >
                {s.spine}
              </div>
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginTop: 8, textAlign: 'center'}}>
              {s.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** 一排书脊（无格框的轻量版，P3/P4 背景）。 */
export const SpineRow: React.FC<{names: string[]; at?: number; dimIndex?: number}> = ({
  names,
  at = 0,
  dimIndex = -1,
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{display: 'flex', gap: 12, alignItems: 'flex-end'}}>
      {names.map((n, i) => {
        const p = progress(frame, at + i * 3, DUR.f3);
        const dim = i === dimIndex;
        return (
          <div
            key={n + i}
            style={{
              width: 64,
              height: 40 + ((i * 37) % 60),
              borderRadius: 4,
              background: `${theme.spine}${dim ? '14' : '2E'}`,
              border: `1.5px solid ${theme.spine}${dim ? '33' : '88'}`,
              color: dim ? theme.dim : theme.spine,
              fontFamily: theme.sans,
              fontSize: 15,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              writingMode: 'vertical-rl',
              opacity: (0.3 + p * 0.7) * (dim ? 0.55 : 1),
            }}
          >
            {n}
          </div>
        );
      })}
    </div>
  );
};

/** 漏斗撑爆：全部手册塞进开场白直到爆开（0-D）。 */
export const FunnelBurst: React.FC<{at: number}> = ({at}) => {
  const fill = useProgress(at, DUR.f6);
  const burst = useImpulse({at: at + DUR.f6, dur: DUR.f4, peak: 1});
  const tilt = burst * 8;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
      <div style={{display: 'flex', gap: 8}}>
        {Array.from({length: 7}).map((_, i) => {
          const p = progress(Math.min(fill * 7, 7), i, 1);
          return (
            <div
              key={i}
              style={{
                width: 56,
                height: 76,
                borderRadius: 4,
                background: `${theme.danger}${Math.round(p * 40 + 16).toString(16).padStart(2, '0')}`,
                border: `1.5px solid ${theme.danger}88`,
                opacity: 0.3 + p * 0.7,
                transform: `translateY(${burst * (i - 3) * 22}px) rotate(${burst * (i - 3) * 9}deg)`,
              }}
            />
          );
        })}
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.danger, opacity: fill}}>
        开场白（每次对话都要重读）
      </div>
      <div
        style={{
          width: 720,
          height: 120,
          border: `2.5px solid ${theme.danger}`,
          borderRadius: '60px 60px 16px 16px',
          position: 'relative',
          transform: `scale(${1 + burst * 0.12}) rotate(${tilt}deg)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 6,
            right: 6,
            bottom: 6,
            top: 6,
            borderRadius: '54px 54px 12px 12px',
            background: `${theme.danger}33`,
            transformOrigin: 'bottom',
            transform: `scaleY(${fill})`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 54,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 24,
            color: theme.text,
            opacity: fill * (1 - burst * 0.6),
          }}
        >
          {Math.round(fill * 100)}%
        </div>
      </div>
    </div>
  );
};

/** 账本柱：按需 vs 预载（3-D）/ 目录开销 1206→4285（5-C）。 */
export const LedgerBars: React.FC<{
  bars: {label: string; value: number; color: string}[];
  at: number;
  max: number;
  unit?: string;
}> = ({bars, at, max, unit = ''}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{display: 'flex', gap: 90, alignItems: 'flex-end', height: 360}}>
      {bars.map((b, i) => {
        const p = progress(frame, at + i * 8, DUR.f6);
        const h = 40 + (b.value / max) * 300 * p;
        return (
          <div key={b.label} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
            <div style={{fontFamily: theme.mono, fontSize: 30, color: b.color, opacity: p}}>
              {Math.round(b.value * p).toLocaleString('en-US')}
              {unit}
            </div>
            <div
              style={{
                width: 120,
                height: h,
                borderRadius: '8px 8px 0 0',
                background: `${b.color}CC`,
                borderTop: `3px solid ${b.color}`,
              }}
            />
            <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{b.label}</div>
          </div>
        );
      })}
    </div>
  );
};

/** 书脊墙 vs 按次付费（3-E）：左墙随藏书逐格变宽，右侧按抽取计数。 */
export const CostWall: React.FC<{books: number; draws: number; at: number}> = ({books, draws, at}) => {
  const frame = useCurrentFrame();
  const cells = Array.from({length: books});
  return (
    <div style={{display: 'flex', gap: 70, alignItems: 'stretch'}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.spine}}>书脊墙 · 每次开工都付</div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(10, 34px)', gap: 6}}>
          {cells.map((_, i) => {
            const p = progress(frame, at + i * 2, DUR.f2);
            return (
              <div
                key={i}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 4,
                  background: `${theme.spine}${p > 0.5 ? '55' : '18'}`,
                  border: `1px solid ${theme.spine}${p > 0.5 ? 'AA' : '33'}`,
                  opacity: p,
                }}
              />
            );
          })}
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>藏书 {books} 本 → 墙宽只增不减</div>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.book}}>按次付费 · 抽到才计</div>
        <div style={{display: 'flex', gap: 10, alignItems: 'flex-end', height: 100}}>
          {Array.from({length: draws}).map((_, i) => {
            const p = progress(frame, at + 30 + i * 14, DUR.f4);
            return (
              <div
                key={i}
                style={{
                  width: 54,
                  height: 30 + p * 60,
                  borderRadius: 6,
                  background: `${theme.book}44`,
                  border: `1.5px solid ${theme.book}AA`,
                  opacity: p,
                }}
              />
            );
          })}
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>本次会话抽了 {draws} 次</div>
      </div>
    </div>
  );
};

/** 拆解三栏卡（5-A 起，全 P5 复用）：改了什么 / 实测怎样坏 / 教训。 */
export const TeardownCard: React.FC<{
  title: string;
  changed: string;
  broke: string;
  lesson: string;
  at: number;
}> = ({title, changed, broke, lesson, at}) => {
  const rise = useSpring('settle', {at, dur: DUR.f5});
  const frame = useCurrentFrame();
  const cols: [string, string, string][] = [
    ['改了什么', changed, theme.book],
    ['实测怎样坏', broke, theme.danger],
    ['教训', lesson, theme.ok],
  ];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        opacity: rise,
        transform: `translateY(${(1 - rise) * 40}px)`,
      }}
    >
      <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text}}>{title}</div>
      <div style={{display: 'flex', gap: 20}}>
        {cols.map(([h, body, c], i) => {
          const p = progress(frame, at + 8 + i * 7, DUR.f4);
          return (
            <div
              key={h}
              style={{
                width: 330,
                minHeight: 170,
                padding: '16px 18px',
                borderRadius: 10,
                background: theme.panel,
                border: `2px solid ${c}55`,
                opacity: p,
              }}
            >
              <div style={{fontFamily: theme.sans, fontSize: 20, color: c, marginBottom: 10}}>{h}</div>
              <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.text, lineHeight: 1.5}}>{body}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** 舞台：把装置放进内容安全区正中（y 140–880，避让顶部章节条与底部字幕带）。
 *  ArchifyYield 是全屏 AbsoluteFill，装置必须经本容器定位，否则贴顶压章节条。 */
export const Stage: React.FC<{children: React.ReactNode; top?: number; bottom?: number}> = ({
  children,
  top = 140,
  bottom = 210,
}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      top,
      bottom,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {children}
  </div>
);
