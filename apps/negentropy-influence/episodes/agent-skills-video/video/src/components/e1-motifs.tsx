/** E1《刻意做小》跨幕共享装置（seeded 档）。
 *
 *  三个恒定母题装置 + 舞台/角标基元：
 *   〔M-001〕SkillMenuCard  技能菜单卡（右上恒定锚，六行 = lab4 真实夹具名）
 *   〔M-002〕LedgerBar      账本条（底部 tier1/2/3 计数带，X4 红侧跳 694）
 *   〔M-004〕Plaque         门牌/招牌字形系统（靛蓝统一）
 *  幕内一次性装置一律 scene-local（复用边界：Remotion 原语复制不共享）。
 *  运动层铁律：hooks 只在组件顶层；弹簧只喂局部帧；时长取 DUR token；
 *  动画时点由调用方以 at('句id')-beat.from 推导后传入。 */
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {DUR, progress, useSpring} from '../motion';

/** 屏内墨色：比 bg 更深一档的「屏内」黑——archify 画框（ArchifyClip）/ P4 终端
 *  条 / P5 年检机屏共用的内衬底色。单点登记于本集组件库（theme 不收：主题门
 *  将 theme 键一律按概念色检对比度，容器色会被误拦）。 */
export const SCREEN_INK = '#0B0E13';

/** 舞台：内容居中 + 顶部安全带（y≥56 起步，章节条占 y14–42）。 */
export const Stage: React.FC<{children: React.ReactNode; top?: number}> = ({children, top = 56}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: top,
    }}
  >
    {children}
  </div>
);

/** 实测数字角标（等宽，右下口径标注用）。 */
export const CornerNote: React.FC<{text: string; x?: number; y?: number}> = ({
  text,
  x = 40,
  y = 920,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      fontFamily: theme.mono,
      fontSize: 17,
      color: theme.dim,
      letterSpacing: 1,
    }}
  >
    {text}
  </div>
);

/** lab4 六行夹具名（M-001 的唯一事实源；行 id 与原型目录一致）。 */
export const MENU_ROWS = [
  {id: 'shift-swap', label: '换班', note: '周五和小李换班'},
  {id: 'report-merger', label: '周报合并', note: '三季度周报合一'},
  {id: 'deploy-helper', label: '部署', note: '新预发环境部署'},
  {id: 'pantry-inventory', label: '盘点', note: '库房季度盘点'},
  {id: 'legacy-notes', label: '归档', note: '旧文档归档'},
  {id: 'evil-craft', label: '恶意样本', note: '注入演示专用'},
] as const;

/** 〔M-001〕技能菜单卡：右上恒定锚。剧情打点全由 props 声明：
 *  appearAt 入场帧；checkedRow 打勾行（激活）；vanishedRow 静默消失行（X1）；
 *  forgedRow 染红伪造行（X3）；collapsed 合页收拢（P6 收束）。 */
export const SkillMenuCard: React.FC<{
  appearAt: number;
  checkedRow?: string;
  checkAt?: number;
  vanishedRow?: string;
  vanishAt?: number;
  forgedRow?: string;
  forgeAt?: number;
  collapsed?: boolean;
  collapseAt?: number;
  dimmed?: boolean;
}> = ({
  appearAt,
  checkedRow,
  checkAt = 0,
  vanishedRow,
  vanishAt = 0,
  forgedRow,
  forgeAt = 0,
  collapsed = false,
  collapseAt = 0,
  dimmed = false,
}) => {
  const frame = useCurrentFrame();
  const enter = useSpring('settle', {at: appearAt, dur: DUR.f6});
  const collapseP = collapsed ? progress(frame, collapseAt, DUR.f5) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        right: 40,
        top: 72,
        width: 316,
        opacity: (0.22 + 0.78 * enter) * (1 - 0.55 * Number(dimmed)),
        transform: `translateY(${(1 - enter) * -26}px) scale(${collapsed ? 1 - 0.18 * collapseP : 1})`,
        background: theme.panel,
        border: `1.5px solid ${theme.panelBorder}`,
        borderRadius: 12,
        padding: '14px 16px 10px',
        zIndex: 40,
      }}
    >
      <div style={{fontSize: 15, color: theme.dim, marginBottom: 8, letterSpacing: 2}}>
        技能菜单 · 六行
      </div>
      {MENU_ROWS.map((r) => {
        const gone = vanishedRow === r.id ? progress(frame, vanishAt, DUR.f5) : 0;
        const forged = forgedRow === r.id;
        const forgedP = forged ? progress(frame, forgeAt, DUR.f4) : 0;
        const checked = checkedRow === r.id;
        return (
          <div
            key={r.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 0',
              opacity: (1 - gone) * (forged ? 0.55 + 0.45 * forgedP : 1),
              filter: gone > 0.5 ? 'blur(1px)' : undefined,
            }}
          >
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 14.5,
                color: forged ? theme.danger : theme.conceptDeep,
                minWidth: 126,
                textDecoration: gone > 0.6 ? 'line-through' : undefined,
              }}
            >
              {r.id}
            </span>
            <span style={{fontSize: 14.5, color: gone > 0 ? theme.dim : theme.text}}>
              {r.label}
            </span>
            {checked && (
              <span style={{fontSize: 15, color: theme.ok, marginLeft: 'auto'}}>✓</span>
            )}
            {forged && forgedP > 0.4 && (
              <span style={{fontSize: 12, color: theme.danger, marginLeft: 'auto'}}>伪</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** 〔M-002〕账本条：底部三级计数带。
 *  t1/t2/t3 三格数值；sum 合计；redMode 开启时合计染红跳变（X4：613→694）。 */
export const LedgerBar: React.FC<{
  t1: number;
  t2: number;
  t3: number;
  sum: number;
  redModeAt?: number;
  dimmed?: boolean;
  visible?: boolean;
}> = ({t1, t2, t3, sum, redModeAt, dimmed = false, visible = true}) => {
  const frame = useCurrentFrame();
  const red = redModeAt !== undefined ? progress(frame, redModeAt, DUR.f4) : 0;
  if (!visible) return null;
  const cell = (label: string, val: number, accent: string) => (
    <div style={{display: 'flex', alignItems: 'baseline', gap: 8}}>
      <span style={{fontSize: 14, color: theme.dim, fontFamily: theme.mono}}>{label}</span>
      <span
        style={{
          fontFamily: theme.mono,
          fontSize: 26,
          color: accent,
          fontWeight: 600,
          minWidth: 64,
          textAlign: 'right',
        }}
      >
        {Math.round(val)}
      </span>
    </div>
  );
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 96,
        background: `${theme.panel}e8`,
        borderTop: `1.5px solid ${theme.panelBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 56,
        opacity: dimmed ? 0.35 : 1,
        zIndex: 40,
      }}
    >
      {cell('目录 t1', t1, theme.conceptDeep)}
      {cell('正文 t2', t2, theme.concept)}
      {cell('资源 t3', t3, theme.concept)}
      <div style={{width: 1, height: 44, background: theme.panelBorder}} />
      <div style={{display: 'flex', alignItems: 'baseline', gap: 8}}>
        <span style={{fontSize: 14, color: theme.dim, fontFamily: theme.mono}}>常驻合计</span>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 30,
            fontWeight: 700,
            color: red > 0.5 ? theme.danger : theme.concept,
          }}
        >
          {Math.round(sum)}
        </span>
        {red > 0.5 && (
          <span style={{fontSize: 13, color: theme.danger, fontFamily: theme.mono}}>+13%</span>
        )}
      </div>
    </div>
  );
};

/** 〔M-004〕门牌/招牌字形系统。
 *  variant='door'：靛蓝底白字门牌（name=目录名，身份面）
 *  variant='sign'：街头招牌框（description，路由面）；lit 点亮招牌文字。 */
export const Plaque: React.FC<{
  variant: 'door' | 'sign';
  title: string;
  sub?: string;
  width?: number;
  lit?: boolean;
}> = ({variant, title, sub, width = 340, lit = true}) => {
  if (variant === 'door') {
    return (
      <div
        style={{
          width,
          background: theme.conceptDeep,
          borderRadius: 10,
          padding: '12px 18px',
          textAlign: 'center',
          boxShadow: `0 6px 24px ${theme.conceptDeep}33`,
        }}
      >
        <div style={{fontSize: 15, color: theme.bg, opacity: 0.72, letterSpacing: 3}}>
          户口登记名
        </div>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 22,
            color: theme.bg,
            fontWeight: 700,
            marginTop: 2,
          }}
        >
          {title}
        </div>
        {sub && (
          <div style={{fontSize: 13, color: theme.bg, opacity: 0.72, marginTop: 4}}>{sub}</div>
        )}
      </div>
    );
  }
  return (
    <div
      style={{
        width,
        border: `3px solid ${lit ? theme.conceptDeep : theme.panelBorder}`,
        borderRadius: 8,
        padding: '14px 18px 10px',
        background: theme.panel,
        position: 'relative',
      }}
    >
      {/* 招牌吊臂 */}
      <div
        style={{
          position: 'absolute',
          top: -14,
          left: 24,
          width: 5,
          height: 14,
          background: theme.panelBorder,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: -14,
          right: 24,
          width: 5,
          height: 14,
          background: theme.panelBorder,
        }}
      />
      <div style={{fontSize: 14, color: theme.dim, letterSpacing: 3, marginBottom: 4}}>招牌</div>
      <div
        style={{
          fontFamily: theme.mono,
          fontSize: 17,
          lineHeight: 1.5,
          color: lit ? theme.text : theme.dim,
        }}
      >
        {title}
      </div>
      {sub && <div style={{fontSize: 13, color: theme.dim, marginTop: 6}}>{sub}</div>}
    </div>
  );
};
