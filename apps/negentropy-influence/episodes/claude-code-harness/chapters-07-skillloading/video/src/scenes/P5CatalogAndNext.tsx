/** P5 收束与下期（p5-01..p5-08，5 镜）——分镜 5-A / 5-B / 5-C / 5-D / 5-E。
 *
 *  ★ 5-A 环体定格收束 + 金句卡（EWS）：环体居中同形回归（环顶仍压常驻目录带
 *    ——全片锚定形态收束，1-A 复合体同位同形）；目录带 + 全文卡双子装置定格
 *    （紫/蓝）分驻环侧；背景生产舞台元素退为暗层；金句卡（衬线体）「目录常驻 ·
 *    全文按需——有什么常驻，是什么按需」两关键词各压一拍重读排版
 *    （caption-dup-ok：金句卡刻意复述——收束定格仪式，承 ep1–ep6 5-A 豁免先例）。
 *  ★ 5-B 虚拟存储同构一闪（A#7 按需调页——本集唯一实引类比，一闪即收）：内存条
 *    小图——常驻集小格（小）亮、「缺的页」缺页取入箭头一拍（同构映射：小格↔
 *    目录带、箭头↔加载通道——双子装置的操作系统镜像，两组对应同帧可读）；「每
 *    轮全额计费」边界对照签双列点亮（内存：不按次收流量费 ↔ 上下文：每轮全额
 *    计费）、「账更苛刻」上下文侧签加重一拍（失配边界句——类比边界的声明）。
 *  ★ 5-C 下期问题帧：消息历史区全景——「每轮都在场」进了对话的全文卡逐轮复制
 *    叠位（计费帧语义变奏——这次叠的是历史）、「堆得越多」堆积加速、「装满的
 *    一天」窗口上限线（承 4-B 容器同形）压至警戒位一拍（逼近而不停在满——只点
 *    问题）。
 *  ★ 5-D 下期卡（视觉层）：暗场中一道刻度线剪影自下浮起（线上一枚蓄满的格位）、
 *    旁缀「下期」签；历史区堆积退居暗层；「装满了怎么办」句尾卡面微沉一拍（只
 *    点问题不预告机制；单句镜承 ep2 5-C 先例）。
 *  ★ 5-E 片尾署源卡（尾部署源位，RSI I-080 豁免；署源句 = p5-07、漂移警示句 =
 *    p5-08）：主行 Learn Claude Code / 次行仓库地址 / 角注 MIT（卡面 ≤3 行）；
 *    p5-08 期间卡片静持（漂移警示由口播承载、卡面零复述）；全片在此卡收束。
 *  ★ 尾幕渐黑（红线四）：窗取末 beat 总时长（p5-07..p5-08 之和）——终点即本幕
 *    终点。收尾版式不挂 SceneTag（承 ep1–ep6 先例）。
 *
 *  空间契约：金句卡为唯一主体、衬线体、环体同形（描边/线宽承全片锚定）、卡外
 *    新增装饰为零；同构映射两组对应同帧可读、边界签双列对照、类比图一闪即收；
 *    堆积=逐轮叠加可数、上限线与 4-B 窗口容器同形、窗口不被填满、不出现压缩/
 *    删减机制图形；下期卡只含问题意象不点机制名、卡内无压缩机制图形；署源卡为
 *    最后画面、卡面 ≤3 行信息。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；「下期」为唯一顺序词；计数
 *    读数 Math.round(有界值) 直取。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CatalogBand, FullTextCard, LoopRing, Panel} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useFadeOut, useImpulse, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 主装置全局位（承 1-A——环+带复合体同位同形收束） */
const BAND1 = {x: 380, y: 330, w: 1160, h: 172} as const;
const RING1 = {size: 400, cx: 960, cy: 434} as const;

const CATALOG_ROWS = [
  {name: '界面规范', sub: 'react-style · 组件写法约定'},
  {name: '数据库指南', sub: 'sql-style · 表与迁移规范'},
  {name: '接口文档', sub: 'api-design · REST 设计约定'},
  {name: '文档处理', sub: 'pdf · 文档处理规则'},
] as const;

// ── 5-A 环体带带定格收束 + 金句卡 ───────────────────────────────────────

const FiveA: React.FC<{atGroup: number; atCard: number; atK1: number; atK2: number}> = ({atGroup, atCard, atK1, atK2}) => {
  // 群像定格收束（EWS 承 1-A 同形签名回归——非 morph）
  const group = useProgress(atGroup, DUR.f6, 'decelerate');
  // 金句卡淡入 + 两关键词各压一拍重读（衬线体）
  const card = useProgress(atCard, DUR.f6);
  const k1 = useImpulse({at: atK1, dur: DUR.f6, peak: 0.06});
  const k2 = useImpulse({at: atK2, dur: DUR.f6, peak: 0.06});
  const k1Glow = useProgress(atK1, DUR.f5);
  const k2Glow = useProgress(atK2, DUR.f5);
  const dot = ((useCurrentFrame() / 75) % 1 + 1) % 1;
  return (
    <AbsoluteFill>
      {/* 背景生产舞台元素退为暗层（十类暗点 + 窗口暗形——只留剪影） */}
      <div style={{position: 'absolute', inset: 0, opacity: 0.35 * group, pointerEvents: 'none'}}>
        {Array.from({length: 10}, (_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 130 + (i % 5) * 340,
              top: 900,
              width: 22,
              height: 22,
              borderRadius: 5,
              border: `2px solid ${withAlpha(theme.dim, 0.4)}`,
            }}
          />
        ))}
        <div style={{position: 'absolute', left: 130, top: 130, width: 1660, height: 26, borderRadius: 8, border: `2px solid ${withAlpha(theme.dim, 0.25)}`}} />
      </div>
      {/* 环体（居中同形回归——环顶仍压常驻目录带：描边/线宽承全片锚定） */}
      <div style={{position: 'absolute', left: RING1.cx - RING1.size / 2, top: RING1.cy - RING1.size / 2, opacity: group}}>
        <LoopRing size={RING1.size} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {/* 目录带（紫——0-C/1-A 同位；双子定格之紫） */}
      <div style={{position: 'absolute', left: BAND1.x, top: BAND1.y, opacity: group}}>
        <CatalogBand x={0} y={0} w={BAND1.w} h={BAND1.h} rows={CATALOG_ROWS} rowsLit={4} charText={'281'} charLit={group} />
      </div>
      {/* 全文卡（蓝——右侧待命位；双子定格之蓝） */}
      <div style={{position: 'absolute', left: 1600, top: 280, opacity: group * 0.95}}>
        <FullTextCard x={0} y={0} w={250} h={460} rowsLit={12} />
      </div>
      {/* 金句卡（衬线体——覆上层；两关键词各压一拍重读） */}
      <div
        style={{
          position: 'absolute',
          left: 330,
          top: 88,
          opacity: card,
          transform: `translateY(${(1 - card) * 22}px)`,
          zIndex: 3,
        }}
      >
        <Panel accent={theme.mech} style={{padding: '26px 50px', display: 'inline-block'}}>
          <div style={{fontFamily: theme.serif, fontSize: 46, color: theme.text, lineHeight: 1.3, whiteSpace: 'nowrap'}}>
            {/* caption-dup-ok: 金句卡刻意复述（收束定格仪式，承 ep1–ep6 5-A 豁免先例） */}
            <span style={{fontWeight: 700, color: theme.mech, display: 'inline-block', transform: `scale(${1 + k1})`, textShadow: k1Glow > 0.01 ? `0 0 ${22 * k1Glow}px ${withAlpha(theme.mech, 0.5)}` : 'none'}}>
              {'目录常驻'}
            </span>
            <span style={{color: theme.dim}}>{' · '}</span>
            <span style={{fontWeight: 700, color: theme.load, display: 'inline-block', transform: `scale(${1 + k2})`, textShadow: k2Glow > 0.01 ? `0 0 ${22 * k2Glow}px ${withAlpha(theme.load, 0.5)}` : 'none'}}>
              {'全文按需'}
            </span>
            <span style={{color: theme.dim, fontSize: 30}}>{'　有什么常驻，是什么按需'}</span>
          </div>
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7 * group}}>
        {'环一圈 · 带每轮都在'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B 虚拟存储同构一闪：常驻集 + 缺页箭头 + 边界对照签 ──────────────────

const FiveB: React.FC<{atResident: number; atPage: number; atEdge: number; atHarsh: number; atExit: number}> = ({
  atResident,
  atPage,
  atEdge,
  atHarsh,
  atExit,
}) => {
  const frame = useCurrentFrame();
  // 「常驻集要小」常驻集小格亮（小——内存条左端窄格）
  const resident = useProgress(atResident, DUR.f4);
  // 「缺的页」缺页取入箭头一拍（外存 → 内存；帧驱动一拍）
  const pageT = clamp01(progress(frame, atPage, DUR.f6));
  const pageFly = Math.sin(Math.PI * pageT);
  // 「每轮全额计费」边界对照签双列点亮；「账更苛刻」上下文侧签加重一拍
  const edge = useProgress(atEdge, DUR.f5);
  const harsh = useImpulse({at: atHarsh, dur: DUR.f6, peak: 0.12});
  const harshLit = useProgress(atHarsh, DUR.f3);
  // 一闪即收（类比图不剧场化——本镜末整层退场）
  const exit = useProgress(atExit, DUR.f4);
  const MEM = {x: 330, y: 300, w: 640, h: 220} as const;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, opacity: 1 - exit * 0.92}}>
        {/* 内存条（常驻集小格 + 空闲格阵） */}
        <div style={{position: 'absolute', left: MEM.x, top: MEM.y, width: MEM.w, height: MEM.h}}>
          <div
            style={{
              width: '100%',
              height: '100%',
              boxSizing: 'border-box',
              borderRadius: 14,
              border: `3px solid ${withAlpha(theme.dim, 0.85)}`,
              background: withAlpha(theme.panel, 0.9),
              position: 'relative',
              padding: 18,
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginBottom: 10}}>{'内存 · 常驻集'}</div>
            <div style={{display: 'flex', gap: 8, alignItems: 'flex-end'}}>
              {/* 常驻集小格（小——亮） */}
              <div
                style={{
                  width: 92,
                  height: 100,
                  boxSizing: 'border-box',
                  borderRadius: 8,
                  border: `3px solid ${resident > 0.5 ? theme.mech : theme.panelBorder}`,
                  background: withAlpha(theme.mech, 0.16 * resident),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.sans,
                  fontSize: 17,
                  fontWeight: 700,
                  color: theme.text,
                  opacity: 0.4 + 0.6 * resident,
                }}
              >
                {'小'}
              </div>
              {/* 空闲格阵（暗——缺页待取入） */}
              {Array.from({length: 5}, (_, i) => (
                <div
                  key={i}
                  style={{
                    width: 92,
                    height: 100 - (i % 3) * 14,
                    boxSizing: 'border-box',
                    borderRadius: 8,
                    border: `2.5px dashed ${withAlpha(theme.dim, 0.4)}`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        {/* 外存（磁盘——缺页来源） */}
        <div style={{position: 'absolute', left: 1230, top: 340, width: 200}}>
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 10,
              border: `2.5px solid ${withAlpha(theme.dim, 0.6)}`,
              fontFamily: theme.sans,
              fontSize: 17,
              color: theme.dim,
              textAlign: 'center',
            }}
          >
            {'外存 · 缺的页'}
          </div>
        </div>
        {/* 缺页取入箭头（外存 → 内存第二格——一拍） */}
        <svg width={520} height={90} viewBox="0 0 520 90" style={{position: 'absolute', left: 760, top: 250, overflow: 'visible', opacity: pageFly}}>
          <line x1={500} y1={70} x2={40 + 460 * pageT} y2={40} stroke={theme.load} strokeWidth={4} strokeDasharray="10 9" />
          <path
            d={`M ${34 + 460 * pageT} ${34} L ${16 + 460 * pageT} ${42} L ${38 + 460 * pageT} ${52}`}
            fill="none"
            stroke={theme.load}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* 同构映射注（两组对应同帧可读：带↔常驻集、通道↔缺页箭头） */}
        <div style={{position: 'absolute', left: 330, top: 580, display: 'flex', gap: 40, fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: resident}}>
          <span>{'目录带 ↔ 常驻集'}</span>
          <span>{'加载通道 ↔ 缺页箭头'}</span>
        </div>
        {/* 边界对照签（双列——内存 vs 上下文；账更苛刻加重左拍） */}
        <div style={{position: 'absolute', left: 430, top: 660, display: 'flex', gap: 26, opacity: edge}}>
          {[
            {tag: '内存', zh: '不按次收流量费', harsh: false},
            {tag: '上下文', zh: '每轮全额计费', harsh: true},
          ].map((c) => (
            <div
              key={c.tag}
              style={{
                width: 460,
                padding: '14px 20px',
                boxSizing: 'border-box',
                borderRadius: 10,
                border: `2.5px solid ${c.harsh ? theme.danger : withAlpha(theme.dim, 0.8)}`,
                background: c.harsh ? withAlpha(theme.danger, 0.08) : theme.panel,
                transform: c.harsh ? `scale(${1 + harsh * 0.5})` : 'none',
                boxShadow: c.harsh && harsh > 0.05 ? `0 0 ${22 * harsh}px ${withAlpha(theme.danger, 0.45)}` : 'none',
              }}
            >
              <div style={{fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: c.harsh && harshLit > 0.5 ? theme.danger : theme.text}}>{c.tag}</div>
              <div style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 600, color: theme.dim, marginTop: 6, whiteSpace: 'nowrap'}}>{c.zh}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7 * (1 - exit)}}>
        {'同构一闪 · 按需调页'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C 下期问题帧：全文卡逐轮堆积 + 上限线逼近 ──────────────────────────

const WINC = {x: 360, y: 190, w: 1200, h: 640} as const;

const FiveC: React.FC<{atStack: number; atAccel: number; atLimit: number}> = ({atStack, atAccel, atLimit}) => {
  const frame = useCurrentFrame();
  // 「每轮都在场」全文卡逐轮复制叠位（计费帧语义变奏——叠的是历史；逐轮可数）
  const stackT = clamp01(progress(frame, atStack, DUR.f6));
  // 「堆得越多」堆积加速（后半程加速——加速不减轮数可数性：6 层封顶）
  const accel = clamp01(progress(frame, atAccel, DUR.f6 + DUR.f4));
  const layers = 2 * stackT + 4 * accel;
  // 「装满的一天」上限线压至警戒位一拍（逼近而不停在满——窗口不被填满）
  const limit = useProgress(atLimit, DUR.f5, 'decelerate');
  const limitFlash = useImpulse({at: atLimit + DUR.f4, dur: DUR.f6, peak: 1});
  const limitY = 60 + 90 * limit;
  return (
    <AbsoluteFill>
      {/* 窗口容器（承 4-B 容器同形——上限线的母形） */}
      <div style={{position: 'absolute', left: WINC.x, top: WINC.y, width: WINC.w, height: WINC.h}}>
        <div
          style={{
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            borderRadius: 16,
            border: `3.5px solid ${withAlpha(theme.dim, 0.85)}`,
            background: withAlpha(theme.panel, 0.55),
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{position: 'absolute', left: 24, top: 16, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'消息历史区 · 每轮都在场'}</div>
          {/* 全文卡逐轮叠位（自底向上堆——每轮一层、逐轮可数） */}
          {Array.from({length: 6}, (_, i) => {
            const on = clamp01(layers - i);
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 120 + i * 34,
                  bottom: 24 + i * 74,
                  width: 560,
                  height: 62,
                  boxSizing: 'border-box',
                  borderRadius: 9,
                  border: `2.5px solid ${withAlpha(theme.load, 0.4 + 0.5 * on)}`,
                  background: withAlpha(theme.load, 0.07 + 0.08 * on),
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 14,
                  gap: 12,
                  opacity: on,
                }}
              >
                <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.load}}>{`轮 ${i + 1}`}</span>
                <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>{'SKILL.md · 全文在场'}</span>
              </div>
            );
          })}
          {/* 堆积读数（层数——逐轮叠加可数） */}
          <div style={{position: 'absolute', right: 30, bottom: 28, fontFamily: theme.mono, fontSize: 26, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums'}}>
            {`${Math.round(layers)} 份`}
          </div>
          {/* 窗口上限线（承 4-B——自上方逼近、压至警戒位一拍即停） */}
          {limit > 0.02 ? (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: limitY,
                  height: 0,
                  borderTop: `4px dashed ${theme.danger}`,
                  opacity: clamp01(limit),
                  boxShadow: limitFlash > 0.05 ? `0 0 ${20 * limitFlash}px ${withAlpha(theme.danger, 0.5)}` : 'none',
                }}
              />
              <div style={{position: 'absolute', right: 30, top: limitY - 34, fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap', opacity: clamp01(limit)}}>
                {'上限 · 装满的一天'}
              </div>
            </>
          ) : null}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'进了对话 · 每轮都在场'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-D 下期卡（视觉层）：刻度线剪影 + 蓄满格位 + 「下期」签 ──────────────

const FiveD: React.FC<{atRise: number; atDip: number}> = ({atRise, atDip}) => {
  // 刻度线剪影自下浮起（线上一枚蓄满的格位）
  const rise = useProgress(atRise, DUR.f5, 'decelerate');
  // 「装满了怎么办」句尾卡面微沉一拍（只点问题不预告机制）
  const dip = useImpulse({at: atDip, dur: DUR.f5, peak: 1});
  return (
    <AbsoluteFill>
      {/* 历史区堆积退居暗层（5-C 残影） */}
      <div style={{position: 'absolute', inset: 0, background: withAlpha(theme.bg, 0.55), pointerEvents: 'none'}} />
      {/* 下期卡（暗场剪影——刻度线 + 蓄满格位 + 「下期」签） */}
      <div
        style={{
          position: 'absolute',
          left: 660,
          top: 470 - 60 * rise,
          opacity: rise,
          transform: `translateY(${(1 - rise) * 40}px) scale(${1 - dip * 0.03})`,
        }}
      >
        <Panel accent={withAlpha(theme.core, 0.55)} style={{padding: '28px 40px', position: 'relative'}}>
          {/* 刻度线剪影（一道横线 + 一枚蓄满的格位——问题意象、无机制图形） */}
          <svg width={360} height={110} viewBox="0 0 360 110">
            <line x1={12} y1={78} x2={348} y2={78} stroke={withAlpha(theme.dim, 0.8)} strokeWidth={5} strokeLinecap="round" />
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <line key={i} x1={30 + i * 50} y1={70} x2={30 + i * 50} y2={86} stroke={withAlpha(theme.dim, 0.6)} strokeWidth={3} />
            ))}
            {/* 蓄满的格位（一枚——装满意象的定格） */}
            <rect x={30} y={38} width={50} height={32} rx={6} fill={withAlpha(theme.text, 0.9)} />
          </svg>
          <div style={{textAlign: 'center', fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.text, letterSpacing: 12, paddingLeft: 12, marginTop: 12}}>
            {'下期'}
          </div>
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.55 * rise}}>
        {'刻度线 · 只点问题'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-E 片尾署源卡（尾部署源位，RSI I-080 豁免） ─────────────────────────

const CreditCard: React.FC<{atCard: number; durCard: number}> = ({atCard, durCard}) => {
  // 卡随 p5-07 口播同拍淡入；两行先后落定（署源专名约 0.6 处被念到，次行隔拍跟落）
  const card = useEnter('rise', {at: atCard + 2, dur: DUR.f6, dist: 24, restBottom: 560});
  const l1At = atCard + Math.round(durCard * 0.6);
  const l1 = useProgress(l1At, DUR.f5);
  const l2At = l1At + DUR.f6;
  const l2 = useProgress(l2At, DUR.f5);
  const mit = useProgress(l2At + 8, DUR.f4);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: 316,
        opacity: card.opacity,
        transform: card.transform,
      }}
    >
      <Panel accent={withAlpha(theme.mech, 0.4)} style={{position: 'relative', padding: '46px 64px', textAlign: 'center'}}>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 56,
            fontWeight: 700,
            color: theme.text,
            letterSpacing: 2,
            whiteSpace: 'nowrap',
            opacity: l1,
            transform: `translateY(${(1 - l1) * 12}px)`,
          }}
        >
          {'Learn Claude Code'}
        </div>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 28,
            color: theme.dim,
            marginTop: 20,
            whiteSpace: 'nowrap',
            opacity: l2,
            transform: `translateY(${(1 - l2) * 10}px)`,
          }}
        >
          {'github.com/shareAI-lab/learn-claude-code'}
        </div>
        {/* 角注（卡面第 3 行信息，≤3 行封顶） */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 20,
            fontFamily: theme.mono,
            fontSize: 16,
            color: theme.dim,
            letterSpacing: 1,
            opacity: mit * 0.9,
          }}
        >
          {'MIT'}
        </div>
      </Panel>
    </div>
  );
};

/** 幕末渐黑（红线四）：窗 = 末 beat 总时长（p5-07..p5-08 之和），终点即本幕终点 */
const FadeTail: React.FC<{span: number}> = ({span}) => {
  const keep = useFadeOut(span, {frames: 36});
  return <AbsoluteFill style={{background: '#000', opacity: 1 - keep, pointerEvents: 'none'}} />;
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P5CatalogAndNext: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p5-01');
  const bB = w('p5-02', 'p5-03');
  const bC = w('p5-04', 'p5-05');
  const bD = w('p5-06');
  const bE = w('p5-07', 'p5-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A">
        <FiveA
          atGroup={0}
          atCard={wa('p5-01', 0.22) - bA.from}
          atK1={wa('p5-01', 0.46) - bA.from}
          atK2={wa('p5-01', 0.7) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <FiveB
          atResident={wa('p5-02', 0.26) - bB.from}
          atPage={wa('p5-02', 0.6) - bB.from}
          atEdge={wa('p5-03', 0.34) - bB.from}
          atHarsh={wa('p5-03', 0.78) - bB.from}
          atExit={at('p5-03') + span('p5-03') - 8 - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="5-C">
        <FiveC
          atStack={wa('p5-04', 0.4) - bC.from}
          atAccel={wa('p5-05', 0.2) - bC.from}
          atLimit={wa('p5-05', 0.62) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="5-D">
        <FiveD atRise={wa('p5-06', 0.24) - bD.from} atDip={wa('p5-06', 0.82) - bD.from} />
      </Sequence>
      <Sequence {...bE} name="5-E">
        <CreditCard atCard={at('p5-07') - bE.from} durCard={span('p5-07')} />
        {/* 幕末渐黑：最后子节点，盖过署源卡（全片最后画面在此收束） */}
        <FadeTail span={bE.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5CatalogAndNext;
