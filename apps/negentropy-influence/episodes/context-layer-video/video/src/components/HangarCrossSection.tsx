/** 机库剖面·五轴导航装置〔M-004 喻体对齐专业视角〕——全片 Map-First 主锚。
 *  五工位（库房/放行席位/机位/工具间/培训室 = 资产/权威/装配/检索/复利五轴）
 *  + 右侧目录货架（catalogCount 张 CatalogCard 缩样；空架为虚线槽位待命态）。
 *  built=false：建立面生长动画（P1 1-B 用——剖面从地平线升起）；built=true：常驻
 *  态，highlight 工位自 at 起 1–1.5s 高亮（其余压暗后回松），axis 轴名签同步亮出。
 *  工程图语言：外图框 + 地平点划中心线 + 右下标题栏；at 为幕内起始帧。
 *  场景对位用 HANGAR_GEOM（工位/货架画布绝对坐标）。 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {theme, withAlpha} from '../design/theme';
import {useBreathe, useProgress, useSpring, useStagger} from '../motion';
import {CatalogCard} from './CatalogCard';

export type HangarAxis = 'asset' | 'authority' | 'assembly' | 'retrieval' | 'compounding';

type StationDef = {key: HangarAxis; name: string; axis: string; x: number; glyph: 'crates' | 'desk' | 'dock' | 'board' | 'podium'};

const ST_W = 225;
const ST_H = 330;
const ST_Y = 450;
const FLOOR_Y = 780;

/** 场景对位用几何（画布绝对坐标）：五工位盒与目录货架。 */
export const HANGAR_GEOM = {
  stations: [
    {key: 'asset', x: 150},
    {key: 'authority', x: 405},
    {key: 'assembly', x: 660},
    {key: 'retrieval', x: 915},
    {key: 'compounding', x: 1170},
  ] as {key: HangarAxis; x: number}[],
  station: {y: ST_Y, w: ST_W, h: ST_H},
  floorY: FLOOR_Y,
  shelf: {x: 1450, y: 320, w: 340, h: 420},
} as const;

const STATIONS: StationDef[] = [
  {key: 'asset', name: '库房', axis: '资产轴', x: 150, glyph: 'crates'},
  {key: 'authority', name: '放行席位', axis: '权威轴', x: 405, glyph: 'desk'},
  {key: 'assembly', name: '机位', axis: '装配轴', x: 660, glyph: 'dock'},
  {key: 'retrieval', name: '工具间', axis: '检索轴', x: 915, glyph: 'board'},
  {key: 'compounding', name: '培训室', axis: '复利轴', x: 1170, glyph: 'podium'},
];

/** 目录货架：2×4 槽位缩样卡架。HangarCrossSection 内嵌于剖面右侧；场景可单独
 *  摆位（P2 2-G 飞落目标 / P7 7-E 起飞点——写读接头的物理落点，SSOT 同文件）。 */
export const CatalogShelf: React.FC<{
  count: number;
  at?: number;
  style?: React.CSSProperties;
}> = ({count, at, style}) => {
  const ins = useSpring('settle', {at: at ?? -1000, dur: 20});
  const slots = 8;
  return (
    <div
      style={{
        position: 'absolute',
        left: HANGAR_GEOM.shelf.x,
        top: HANGAR_GEOM.shelf.y,
        width: HANGAR_GEOM.shelf.w,
        height: HANGAR_GEOM.shelf.h,
        borderRadius: 10,
        border: `2px solid ${theme.panelBorder}`,
        background: theme.panel,
        opacity: ins,
        padding: 14,
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridTemplateRows: 'repeat(4, 1fr)',
        gap: 10,
        ...style,
      }}
    >
      <div style={{gridColumn: '1 / span 2', fontFamily: theme.mono, fontSize: 15, color: theme.dim, letterSpacing: 1}}>
        目录货架 · {Math.max(0, count)}/{slots}
      </div>
      {Array.from({length: slots}, (_, i) =>
        i < Math.max(0, Math.min(count, slots)) ? (
          <CatalogCard key={i} small address="ctx://kb/…" />
        ) : (
          <div
            key={i}
            style={{border: `1.5px dashed ${theme.panelBorder}`, borderRadius: 7, opacity: 0.6}}
          />
        ),
      )}
    </div>
  );
};

const StationGlyph: React.FC<{kind: StationDef['glyph']; color: string}> = ({kind, color}) => {
  const line = {border: `1.5px solid ${color}`, borderRadius: 3} as const;
  switch (kind) {
    case 'crates':
      return (
        <div style={{display: 'flex', gap: 8, alignItems: 'flex-end'}}>
          <div style={{...line, width: 44, height: 44}} />
          <div style={{...line, width: 44, height: 64}} />
          <div style={{...line, width: 44, height: 34}} />
        </div>
      );
    case 'desk':
      return (
        <div style={{display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center'}}>
          <div style={{...line, width: 88, height: 34}} />
          <div style={{width: 88, height: 3, background: color}} />
          <div style={{display: 'flex', gap: 40}}>
            <div style={{width: 4, height: 30, background: color}} />
            <div style={{width: 4, height: 30, background: color}} />
          </div>
        </div>
      );
    case 'dock':
      return (
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
          <div style={{width: 96, height: 5, background: color, borderRadius: 3}} />
          <div style={{width: 0, height: 0, borderLeft: '26px solid transparent', borderRight: '26px solid transparent', borderBottom: `34px solid ${color}`, opacity: 0.85}} />
          <div style={{display: 'flex', gap: 34}}>
            <div style={{width: 10, height: 10, borderRadius: 5, background: color}} />
            <div style={{width: 10, height: 10, borderRadius: 5, background: color}} />
          </div>
        </div>
      );
    case 'board':
      return (
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 30px)', gridTemplateRows: 'repeat(2, 30px)', gap: 7}}>
          {Array.from({length: 6}, (_, i) => (
            <div key={i} style={{...line, width: 30, height: 30, borderRadius: 15}} />
          ))}
        </div>
      );
    case 'podium':
      return (
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
          <div style={{width: 64, height: 64, borderRadius: 32, border: `1.5px solid ${color}`}} />
          <div style={{...line, width: 80, height: 26}} />
        </div>
      );
  }
};

export const HangarCrossSection: React.FC<{
  highlight?: HangarAxis | null;
  built?: boolean;
  catalogCount?: number;
  at?: number;
}> = ({highlight = null, built = true, catalogCount = 0, at = 0}) => {
  const rises = useStagger(5, {stride: built ? 2 : 9, at: built ? at - 100 : at});
  // built=true（常驻态/逐句重挂）：-20 预锚让静态件 0 帧即满——避免逐句高亮镜间软闪
  const frameIn = useProgress(built ? at - 20 : at, 8);
  const glow = useBreathe({period: 110, amp: 0.2, base: 0.8});
  // highlight 包络：at 起 1.5s 内其余工位压暗到 ~0.45，之后回松到 ~0.72（主锚常驻可读）
  const focusIn = useProgress(at, 10);
  const relax = useProgress(at + 45, 24);
  const dimOthers = highlight ? 1 - 0.55 * focusIn * (1 - 0.55 * relax) : 1;
  const settle = built ? 1 : 0;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 外图框 + 标题栏（工程图语言） */}
      <div
        style={{
          position: 'absolute',
          left: 100,
          top: 110,
          width: 1730,
          height: 740,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 6,
          opacity: settle ? frameIn : rises[0],
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: 10,
            bottom: 8,
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.dim,
            letterSpacing: 1,
          }}
        >
          剖面 A-A · 五轴工位 · 1:1
        </div>
      </div>
      {/* 地平点划中心线 */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <line
          x1={120}
          y1={FLOOR_Y}
          x2={1810}
          y2={FLOOR_Y}
          stroke={theme.dim}
          strokeWidth={1.5}
          strokeDasharray="20 7 4 7"
          opacity={(settle ? frameIn : rises[0]) * 0.7}
        />
      </svg>
      {STATIONS.map((st, i) => {
        const hot = highlight === st.key;
        const k = settle ? 1 : rises[i];
        const dim = hot ? 1 : dimOthers;
        return (
          <div
            key={st.key}
            style={{
              position: 'absolute',
              left: st.x,
              top: ST_Y + (1 - k) * 46,
              width: ST_W,
              height: ST_H,
              borderRadius: 10,
              border: hot ? `2.5px solid ${theme.concept}` : `1.5px solid ${theme.panelBorder}`,
              background: hot ? withAlpha(theme.concept, 0.1) : theme.panel,
              boxShadow: hot ? `0 0 ${22 * glow}px ${withAlpha(theme.concept, 0.4)}` : 'none',
              opacity: k * dim,
              padding: '14px 16px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <div style={{fontSize: 25, color: hot ? theme.concept : theme.text, marginTop: 2}}>{st.name}</div>
            <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.85}}>
              <StationGlyph kind={st.glyph} color={hot ? theme.concept : theme.panelBorder} />
            </div>
            {/* 轴名签：highlight 时亮出（Map-First 的轴↔工位绑定） */}
            <div style={{height: 30}}>
              {hot ? (
                <span
                  style={{
                    fontSize: 16,
                    color: theme.concept,
                    border: `1.5px solid ${theme.concept}`,
                    borderRadius: 6,
                    padding: '2px 10px',
                    opacity: focusIn,
                  }}
                >
                  {st.axis}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
      <div style={{opacity: settle ? frameIn : rises[4]}}>
        <CatalogShelf count={catalogCount} at={settle ? at - 20 : at + 30} />
      </div>
    </AbsoluteFill>
  );
};
