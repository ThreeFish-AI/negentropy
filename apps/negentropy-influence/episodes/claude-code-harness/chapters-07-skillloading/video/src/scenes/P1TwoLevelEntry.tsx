/** P1 两级进场（p1-01..p1-10，4 镜）——分镜 1-A / 1-B / 1-C / 1-D。
 *
 *  叙事链：1-A 装置视觉首亮（本集主装置全局位·全景坐标锚 + @pushIn）：病灶带
 *  清空重排——同位细长带转紫（目录带形态）、带内四行书目空位（名字+一句话描述
 *  双字段）；右侧蓝色全文卡（大部头）待命；环体〔M-001〕居中合位、环顶压住常驻
 *  目录带（环+带复合体建锚）；「两级」两枚级别签浮出①②、「目录常驻」「全文按
 *  需」紫带/蓝卡各闪一定 →「扫一遍」扫描光带扫过技能库区（技能册子项逐个点亮，
 *  角标 skills/ · SKILL.md）、「名字」「一句话描述」书目行双字段长出（角标 YAML
 *  frontmatter）→「注进」「每轮常驻」目录行写入开场白带、环体转一圈带仍在
 *  （环每轮一圈、带每轮都在——常驻具象〔M-003〕）、「有什么」带尾小签；级别签
 *  ①②服务完本拍退役〔M-006〕→ 1-B 模型侧判断特写：视线扫过书目行、「数据库
 *  指南」行高亮脉冲；「加载工具」蓝色加载通道首亮（角标 load_skill）、「报上
 *  技能名」名字签飞入通道口 → 1-C 注册表与进场特写：「按名查注册表」名字签落进
 *  注册表、命中行点亮（角标 SKILL_REGISTRY）、「全文送进」蓝色全文卡经通道一次
 *  性进场、贴进当前对话（一次性一拍完成）；「不走文件路径」路径试探签撞上通道口
 *  弹回、「天生堵死」通道口禁行杠落下一拍 → 1-D 代码落点帧（拉回）：工具清单
 *  新卡滑入（角标 TOOLS）、分发表新行滑入（角标 TOOL_HANDLERS——双列同构形态
 *  承查表装置回场一拍、色彩从属本集紫契约）、「循环原样」环体整环静止一拍
 *  （静止即陈述〔M-003〕重音镜）；「几行」左侧小带计数签（4 行）、「上千行」
 *  右侧大部头行数标（两千行级）小/大对照定格；「省多少」算账问号签浮起（幕尾钩）。
 *
 *  空间契约：紫带/蓝卡左右分置、环体同形居中（环+带复合体）、级别签仅两枚且随
 *  拍退役、名字签与书目行同签同色（token 跨镜可追）、注册表双列结构、全文进场
 *  一次一拍完成（不重复二次动画）、路径签不进通道、分发表无双列异构、环体静止
 *  拍 ≥10 帧、对照不越真实行数量级。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；skills/ · SKILL.md ·
 *  YAML frontmatter · SKILL_REGISTRY · load_skill · TOOLS · TOOL_HANDLERS
 *  只进角标；书目行文字只写名字+一句话描述两字段。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CatalogBand, FullTextCard, LoadChannel, LoopRing, RegistryCard} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, useProgress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 主装置全局位（1-A / 5-A 共用——环+带复合体世界坐标锚）：
 *  带横贯 y330..502、环 size 400 冠顶 y280 压带上缘（环每轮一圈、带每轮都在） */
const BAND1 = {x: 380, y: 330, w: 1160, h: 172} as const;
const RING1 = {size: 400, cx: 960, cy: 434} as const;

/** 目录四行（episode C 四技能——名字 + 一句话描述，全片同签同色） */
const CATALOG_ROWS = [
  {name: '界面规范', sub: 'react-style · 组件写法约定'},
  {name: '数据库指南', sub: 'sql-style · 表与迁移规范'},
  {name: '接口文档', sub: 'api-design · REST 设计约定'},
  {name: '文档处理', sub: 'pdf · 文档处理规则'},
] as const;

/** 技能库书架（1-A 扫描区——四册子项 + skills/ 角标） */
const SHELF = {x: 120, y: 300} as const;

const SkillShelf: React.FC<{lit: readonly number[]; beamY?: number; beamLit?: number}> = ({lit, beamY, beamLit = 0}) => (
  <div style={{position: 'absolute', left: SHELF.x, top: SHELF.y, width: 220}}>
    <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginBottom: 10}}>{'skills/ · SKILL.md'}</div>
    <div style={{position: 'relative', width: 200, height: 4 * 86}}>
      {CATALOG_ROWS.map((r, i) => {
        const p = clamp01(lit[i] ?? 0);
        return (
          <div
            key={r.name}
            style={{
              position: 'absolute',
              left: 0,
              top: i * 86,
              width: 190,
              height: 70,
              boxSizing: 'border-box',
              borderRadius: 8,
              border: `2.5px solid ${p > 0.5 ? withAlpha(theme.tool, 0.85) : theme.panelBorder}`,
              background: p > 0.5 ? withAlpha(theme.tool, 0.08) : 'transparent',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 12,
              gap: 10,
              opacity: 0.4 + 0.6 * p,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{String(i + 1).padStart(2, '0')}</span>
            <span style={{fontFamily: theme.sans, fontSize: 18, fontWeight: 600, color: p > 0.5 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{r.name}</span>
          </div>
        );
      })}
    </div>
    {/* 扫描光带（横扫书架——自上而下） */}
    {beamLit > 0.02 && beamY !== undefined ? (
      <div
        style={{
          position: 'absolute',
          left: -14,
          top: beamY,
          width: 228,
          height: 10,
          borderRadius: 5,
          background: withAlpha(theme.tool, 0.75),
          boxShadow: `0 0 ${22 * clamp01(beamLit)}px ${withAlpha(theme.tool, 0.6)}`,
          opacity: clamp01(beamLit),
        }}
      />
    ) : null}
  </div>
);

// ── 1-A 装置首亮：环+带复合体建锚 + 扫描注入 ────────────────────────────

const OneA: React.FC<{
  atLevels: number;
  atFlashBand: number;
  atFlashCard: number;
  atScan: number;
  atRows: number;
  atDesc: number;
  atLap: number;
  atTail: number;
  atRetire: number;
}> = ({atLevels, atFlashBand, atFlashCard, atScan, atRows, atDesc, atLap, atTail, atRetire}) => {
  const frame = useCurrentFrame();
  // @pushIn（动机：p1-01 摆答案起自 0-C 引子压向本集主角双子装置）
  const push = usePushIn(0, {scale: 0.05, dur: DUR.f6});
  // 「两级」两枚级别签浮出①②（编号单套——仅两枚）
  const levels = useProgress(atLevels, DUR.f4);
  const lvFlash = useImpulse({at: atLevels, dur: DUR.f5, peak: 1});
  // 「目录常驻」紫带闪 /「全文按需」蓝卡闪（各闪一定——闪现即锁存常态）
  const bandFlash = useImpulse({at: atFlashBand, dur: DUR.f5, peak: 1});
  const bandLit = useProgress(atFlashBand, DUR.f3);
  const cardFlash = useImpulse({at: atFlashCard, dur: DUR.f5, peak: 1});
  const cardLit = useProgress(atFlashCard, DUR.f3);
  // 「扫一遍」扫描光带自上而下扫过书架；册子随光带逐个点亮
  const scan = clamp01(progress(frame, atScan, DUR.f6 + DUR.f3));
  const beamY = 40 + 350 * scan;
  const shelfLit = CATALOG_ROWS.map((_, i) => clamp01(scan * 4.6 - i));
  // 「名字」书目行长出 →「一句话描述」描述字段长出（双字段分步）
  const rowsLit = 4 * clamp01(progress(frame, atRows, DUR.f6));
  const rowsDesc = useProgress(atDesc, DUR.f5);
  // 「注进」目录行写入（逐行写入脉冲）；「每轮常驻」环转一圈带仍在（单圈显式驱动）
  const writeP = clamp01(progress(frame, atLap - DUR.f4, DUR.f6));
  const writeFlash = CATALOG_ROWS.map((_, i) => Math.sin(Math.PI * clamp01(progress(frame, atLap - DUR.f4 + i * 4, DUR.f4))));
  const lap = clamp01(progress(frame, atLap, 52));
  // 「有什么」带尾小签；级别签①②退役（服务完本拍）
  const tail = useProgress(atTail, DUR.f4);
  const retire = useProgress(atRetire, DUR.f4);
  const hitRow = 1;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '50% 46%'}}>
        {/* 环体（M-001 同形——冠顶压带上缘：环每轮一圈、带每轮都在） */}
        <div style={{position: 'absolute', left: RING1.cx - RING1.size / 2, top: RING1.cy - RING1.size / 2}}>
          <LoopRing size={RING1.size} nodes={[]} showExit={false} dotProgress={lap > 0.001 ? lap : undefined} />
        </div>
        {/* 技能库书架（左侧——扫描光带扫过） */}
        <SkillShelf lit={shelfLit} beamY={beamY} beamLit={scan > 0.01 && scan < 0.99 ? 1 : 0} />
        {/* 目录带（紫——0-C 灰暗带同位转紫；书目四行 + 写入脉冲 + 带尾小签） */}
        <CatalogBand
          x={BAND1.x}
          y={BAND1.y}
          w={BAND1.w}
          h={BAND1.h}
          rows={CATALOG_ROWS}
          rowsLit={rowsLit}
          rowsDesc={rowsDesc}
          hitRow={writeP > 0.02 && writeP < 0.98 ? hitRow : -1}
          rowPulse={Math.max(...writeFlash, 0)}
          tailTag={'有什么'}
          tailLit={tail}
          rowGhost={0}
          lit={0.25 + 0.75 * bandLit}
        />
        {/* 环转一圈注（常驻具象——环每轮一圈、带每轮都在） */}
        {lap > 0.02 ? (
          <div style={{position: 'absolute', left: RING1.cx - 96, top: RING1.cy + 210, width: 192, textAlign: 'center', fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: clamp01(lap * 2)}}>
            {'环一圈 · 带仍在'}
          </div>
        ) : null}
        {/* 蓝色全文卡（右侧大部头待命——「全文按需」闪） */}
        <div style={{position: 'absolute', left: 1600, top: 280, opacity: 0.45 + 0.55 * cardLit}}>
          <FullTextCard x={0} y={0} w={250} h={460} rowsLit={12 * cardLit} flash={cardFlash} />
        </div>
        {/* 级别签①②（仅两枚——目录/全文两级；服务完本拍退役） */}
        {[
          {id: '①', zh: '目录', x: 420, y: 236},
          {id: '②', zh: '全文', x: 1612, y: 206},
        ].map((s) => (
          <div
            key={s.id}
            style={{
              position: 'absolute',
              left: s.x,
              top: s.y,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 16px',
              borderRadius: 9,
              border: `2.5px solid ${withAlpha(theme.text, 0.85)}`,
              background: theme.panel,
              opacity: levels * (1 - retire),
              transform: `translateY(${(1 - levels) * -16}px)`,
              boxShadow: lvFlash > 0.05 ? `0 0 ${18 * lvFlash}px ${withAlpha(theme.text, 0.4)}` : 'none',
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 20, fontWeight: 700, color: theme.text}}>{s.id}</span>
            <span style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 600, color: theme.text}}>{s.zh}</span>
          </div>
        ))}
        {/* 注入注（角标——目录注进开场白） */}
        <div style={{position: 'absolute', left: BAND1.x + 4, top: BAND1.y + BAND1.h + 14, fontFamily: theme.mono, fontSize: 15, color: theme.mech, opacity: clamp01(writeP)}}>
          {'目录注进 · YAML frontmatter'}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'两级进场 · 目录常驻 / 全文按需'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-B 模型侧判断特写：视线扫行 + 行命中 + 通道首亮 + 名字签 ─────────────

const OneB: React.FC<{atSweep: number; atHit: number; atChannel: number; atName: number}> = ({atSweep, atHit, atChannel, atName}) => {
  const frame = useCurrentFrame();
  // 「看目录判断」模型视线扫过书目行（自上而下扫四行）
  const sweep = clamp01(progress(frame, atSweep, DUR.f6));
  const sweepY = sweep * 4;
  // 「数据库指南」行高亮脉冲（命中锁存 + 一拍闪）
  const hit = useProgress(atHit, DUR.f4);
  const hitPulse = useImpulse({at: atHit, dur: DUR.f5, peak: 1});
  // 「加载工具」蓝色加载通道首亮（通道口空——角标 load_skill）
  const channel = useProgress(atChannel, DUR.f5);
  // 「报上技能名」名字签飞入通道口（命中行 → 通道口）
  const nameFly = clamp01(progress(frame, atName, DUR.f5));
  const tagX = 700 + (1700 - 700) * nameFly;
  const tagY = 240 + 118 + (640 - 358) * nameFly * nameFly;
  return (
    <AbsoluteFill>
      {/* 目录带推近（四行书目——同签同色承 1-A） */}
      <CatalogBand
        x={300}
        y={240}
        w={1300}
        h={320}
        rows={CATALOG_ROWS}
        rowsLit={4}
        hitRow={1}
        rowPulse={hit + hitPulse * 0.6}
      />
      {/* 模型脑图标（视线位——左侧） */}
      <div style={{position: 'absolute', left: 96, top: 320}}>
        <div
          style={{
            width: 150,
            height: 120,
            boxSizing: 'border-box',
            borderRadius: 14,
            border: `3px solid ${withAlpha(theme.dim, 0.85)}`,
            background: theme.panel,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'模型'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'判断'}</span>
        </div>
        {/* 视线（虚线扫过——自上而下，扫到命中行停） */}
        <svg width={230} height={220} viewBox="0 0 230 220" style={{position: 'absolute', left: 140, top: -40, overflow: 'visible'}}>
          <line
            x1={6}
            y1={60 + sweepY * 96}
            x2={210}
            y2={60 + sweepY * 96}
            stroke={withAlpha(theme.text, 0.65)}
            strokeWidth={3}
            strokeDasharray="8 8"
            opacity={sweep > 0.01 ? clamp01(1 - (sweep - 0.92) * 12) : 0}
          />
          <circle cx={210} cy={60 + sweepY * 96} r={6} fill={theme.text} opacity={sweep > 0.01 && sweep < 0.95 ? 1 : 0} />
        </svg>
      </div>
      {/* 蓝色加载通道（首亮——通道口空待名；角标 load_skill） */}
      <div style={{position: 'absolute', left: 880, top: 640, opacity: channel}}>
        <LoadChannel x={0} y={0} w={860} h={62} flow={frame / 26} mouthLit={nameFly} />
      </div>
      <div style={{position: 'absolute', left: 880, top: 712, fontFamily: theme.mono, fontSize: 15, color: theme.load, opacity: channel}}>{'load_skill'}</div>
      {/* 名字签（数据库指南——与书目行同签同色，飞入通道口） */}
      {nameFly > 0.01 && nameFly < 0.98 ? (
        <div
          style={{
            position: 'absolute',
            left: tagX,
            top: tagY,
            padding: '7px 18px',
            borderRadius: 9,
            border: `2.5px solid ${theme.mech}`,
            background: withAlpha(theme.mech, 0.12),
            fontFamily: theme.sans,
            fontSize: 21,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
          }}
        >
          {'数据库指南'}
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginLeft: 8}}>{'sql-style'}</span>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'第二级 · 看目录点名'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-C 注册表与进场特写：查表命中 + 全文一拍进场 + 路径弹回 ──────────────

const OneC: React.FC<{atReg: number; atEnter: number; atBounce: number; atBlock: number}> = ({atReg, atEnter, atBounce, atBlock}) => {
  const frame = useCurrentFrame();
  // 「按名查注册表」名字签落进注册表、命中行点亮（角标 SKILL_REGISTRY）
  const reg = clamp01(progress(frame, atReg, DUR.f5));
  const regFlash = useImpulse({at: atReg + DUR.f4, dur: DUR.f5, peak: 1});
  // 「全文送进」全文卡经通道一次性进场（一拍完成——不重复二次动画）。
  // ⑨ QA RISKY-3：飞行走下凸弧线（586 + 26·sin），与注册表卡底边（y=540）
  // 全程净空 ≥46px（辉光半径 26px 计入后仍 ≥20px），穿模窗消除
  const enter = clamp01(progress(frame, atEnter, DUR.f5 + DUR.f4));
  const cardX = 1560 - 1300 * enter;
  const cardFlyY = 586 + 26 * Math.sin(Math.PI * enter);
  const enterFlash = useImpulse({at: atEnter + DUR.f5, dur: DUR.f5, peak: 1});
  // 对话区落账闪（全文贴进当前对话）
  const dialogLit = clamp01(progress(frame, atEnter + DUR.f5, DUR.f4));
  // 「不走文件路径」路径试探签撞上通道口弹回（进不去——不进通道红线）
  const bounce = clamp01(progress(frame, atBounce, DUR.f6));
  const bounceT = bounce < 0.5 ? bounce * 2 : (1 - bounce) * 2;
  const probeX = 1780 - 620 * bounceT;
  // 「天生堵死」通道口禁行杠落下一拍（边界一拍——承系列边界语言）
  const block = useProgress(atBlock, DUR.f4, 'accelerate');
  const blockFlash = useImpulse({at: atBlock, dur: DUR.f5, peak: 1});
  return (
    <AbsoluteFill>
      {/* 注册表卡（紫·双列 名字↔技能——居中） */}
      <div style={{position: 'absolute', left: 620, top: 140}}>
        <RegistryCard x={0} y={0} w={660} h={400} hitP={reg} hitIndex={1} />
      </div>
      {/* 名字签飞行（1-B 同签——落进注册表命中行） */}
      {reg > 0.01 && reg < 0.92 ? (
        <div
          style={{
            position: 'absolute',
            left: 300 + 380 * reg,
            top: 480 - 220 * reg,
            padding: '7px 18px',
            borderRadius: 9,
            border: `2.5px solid ${theme.mech}`,
            background: withAlpha(theme.mech, 0.12),
            fontFamily: theme.sans,
            fontSize: 21,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: 1 - clamp01((reg - 0.85) * 8),
          }}
        >
          {'数据库指南'}
        </div>
      ) : null}
      {/* 加载通道（末端接对话区——右端通道口） */}
      <div style={{position: 'absolute', left: 240, top: 640}}>
        <LoadChannel x={0} y={0} w={920} h={62} flow={frame / 26} mouthLit={0.5 + 0.5 * regFlash} blocked={block} />
      </div>
      {/* 对话区（通道末端——全文贴进当前对话） */}
      <div style={{position: 'absolute', left: 60, top: 560, width: 190, height: 230}}>
        <div
          style={{
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.text, 0.5 + 0.4 * dialogLit)}`,
            background: withAlpha(theme.panel, 0.94),
            padding: '10px 12px',
            boxShadow: enterFlash > 0.05 ? `0 0 ${26 * enterFlash}px ${withAlpha(theme.load, 0.5)}` : 'none',
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'当前对话'}</div>
          {/* 全文落位（mini 卡——蓝） */}
          <div
            style={{
              marginTop: 8,
              height: 150,
              boxSizing: 'border-box',
              borderRadius: 8,
              border: `2.5px solid ${theme.load}`,
              background: withAlpha(theme.load, 0.1),
              opacity: dialogLit,
              padding: '8px 8px',
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 11, color: theme.load}}>{'SKILL.md'}</div>
            {Array.from({length: 5}, (_, k) => (
              <div key={k} style={{height: 6, width: `${90 - k * 12}%`, borderRadius: 3, background: withAlpha(theme.load, 0.3), marginTop: 7}} />
            ))}
          </div>
        </div>
      </div>
      {/* 全文卡沿通道一次性进场（一拍——右→左） */}
      {enter > 0.01 && enter < 0.96 ? (
        <div style={{position: 'absolute', left: cardX, top: cardFlyY, opacity: clamp01(enter * 4) * (1 - clamp01((enter - 0.9) * 8))}}>
          <FullTextCard x={0} y={0} w={150} h={210} rowsLit={12} title={'数据库指南'} tag={''} />
        </div>
      ) : null}
      {/* 路径试探签（带路径串——撞上通道口弹回，永不进通道） */}
      {bounce > 0.01 && bounce < 0.94 ? (
        <div
          style={{
            position: 'absolute',
            left: probeX,
            top: 470,
            padding: '6px 14px',
            borderRadius: 8,
            border: `2.5px dashed ${withAlpha(theme.dim, 0.85)}`,
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.dim,
            whiteSpace: 'nowrap',
            opacity: 1 - clamp01((bounce - 0.8) * 6),
          }}
        >
          {'docs/../../outside.md'}
        </div>
      ) : null}
      {/* 禁行杠注（天生堵死——一拍） */}
      {blockFlash > 0.05 ? (
        <div style={{position: 'absolute', left: 1080, top: 560, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap', opacity: blockFlash}}>
          {'天生堵死'}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'按名查注册表 · 不走文件路径'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-D 代码落点帧：工具清单 + 分发表 + 环体静止拍 + 大小对照 ─────────────

const TOOLS_SEVEN = ['跑命令 bash', '读文件 read', '写文件 write', '改文件 edit', '找文件 glob', '清单 todo', '派活 task'] as const;

const OneD: React.FC<{atTool: number; atRow: number; atStill: number; atSmall: number; atBig: number; atHook: number}> = ({
  atTool,
  atRow,
  atStill,
  atSmall,
  atBig,
  atHook,
}) => {
  const frame = useCurrentFrame();
  // 「添一件」工具清单新卡滑入（角标 TOOLS——7+1=8 件）
  const tool = useProgress(atTool, DUR.f4);
  // 「添一行」分发表新行滑入（角标 TOOL_HANDLERS——双列同构承查表装置）
  const row = useProgress(atRow, DUR.f4);
  // 「循环原样」环体整环静止一拍（≥10 帧——静止即陈述；重音镜）
  const still = useProgress(atStill, DUR.f3);
  const stillFlash = useImpulse({at: atStill, dur: DUR.f5, peak: 1});
  // 静止前匀速巡游、atStill 起整环冻结（静止即陈述——deterministic 冻结值）
  const frozenDot = ((atStill / 75) % 1 + 1) % 1;
  const ringDot = frame < atStill ? (frame / 75) % 1 : frozenDot;
  // 「几行」左侧小带计数签（4 行）；「上千行」右侧大部头行数标（两千行级）
  const small = useProgress(atSmall, DUR.f4);
  const smallFlash = useImpulse({at: atSmall, dur: DUR.f5, peak: 1});
  const big = useProgress(atBig, DUR.f4);
  // 「省多少」算账问号签浮起（幕尾钩）
  const hook = useProgress(atHook, DUR.f5);
  return (
    <AbsoluteFill>
      {/* 工具清单竖列（七件 + 新卡 load_skill——角标 TOOLS） */}
      <div style={{position: 'absolute', left: 120, top: 140, width: 300}}>
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginBottom: 8}}>{'TOOLS'}</div>
        {TOOLS_SEVEN.map((t, i) => (
          <div
            key={t}
            style={{
              height: 40,
              marginBottom: 6,
              boxSizing: 'border-box',
              borderRadius: 7,
              border: `2px solid ${withAlpha(theme.dim, 0.5)}`,
              background: theme.panel,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 12,
              fontFamily: theme.sans,
              fontSize: 16,
              color: theme.dim,
              whiteSpace: 'nowrap',
              opacity: 0.7,
            }}
          >
            {t}
          </div>
        ))}
        {/* 新卡（load_skill——滑入 + 一拍闪） */}
        <div
          style={{
            height: 46,
            marginTop: 4,
            boxSizing: 'border-box',
            borderRadius: 7,
            border: `2.5px solid ${theme.load}`,
            background: withAlpha(theme.load, 0.12),
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 12,
            gap: 10,
            opacity: tool,
            transform: `translateX(${(1 - tool) * -30}px)`,
            boxShadow: stillFlash > 0.05 && tool > 0.9 ? `0 0 ${18 * stillFlash}px ${withAlpha(theme.load, 0.5)}` : 'none',
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.text}}>{'取全文'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.load}}>{'load_skill'}</span>
        </div>
      </div>
      {/* 分发表（双列同构——名字 → 处理；新行 load_skill；色彩从属本集紫契约） */}
      <div style={{position: 'absolute', left: 520, top: 140, width: 560}}>
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginBottom: 8}}>{'TOOL_HANDLERS'}</div>
        {['bash → run', 'read → read_file', 'write → write_file', 'edit → edit_file', 'glob → glob', 'todo → todo_write', 'task → subagent'].map((r, i) => (
          <div
            key={r}
            style={{
              height: 34,
              marginBottom: 6,
              boxSizing: 'border-box',
              borderRadius: 7,
              border: `2px solid ${withAlpha(theme.panelBorder, 0.9)}`,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 14,
              fontFamily: theme.mono,
              fontSize: 14,
              color: theme.dim,
              whiteSpace: 'nowrap',
              opacity: 0.75,
            }}
          >
            {r}
          </div>
        ))}
        {/* 新行（load_skill → load_skill——双列同构 + 滑入） */}
        <div
          style={{
            height: 40,
            marginTop: 4,
            boxSizing: 'border-box',
            borderRadius: 7,
            border: `2.5px solid ${theme.mech}`,
            background: withAlpha(theme.mech, 0.1),
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 14,
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: row,
            transform: `translateX(${(1 - row) * -30}px)`,
          }}
        >
          {'load_skill → load_skill'}
        </div>
      </div>
      {/* 环体缩悬侧位（整环静止一拍——dot 冻结；静止即陈述） */}
      <div style={{position: 'absolute', left: 1520, top: 150, opacity: 0.9}}>
        <LoopRing size={170} nodes={[]} showExit={false} dotProgress={ringDot} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1490,
          top: 330,
          width: 230,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 15,
          color: still > 0.5 ? theme.text : theme.dim,
          whiteSpace: 'nowrap',
          opacity: still,
        }}
      >
        {'循环原样 · 整环静止'}
      </div>
      {/* 小/大对照定格（左：几行目录小带 4 行 vs 右：大部头全文卡两千行级） */}
      <div style={{position: 'absolute', left: 170, top: 640, opacity: small}}>
        <CatalogBand x={0} y={0} w={520} h={150} scale={0.92} rows={CATALOG_ROWS} rowsLit={4} hitRow={-1} />
        {/* 计数签（4 行——数据本体直读） */}
        <div
          style={{
            marginTop: 10,
            display: 'inline-flex',
            padding: '4px 14px',
            borderRadius: 8,
            border: `2.5px solid ${theme.mech}`,
            fontFamily: theme.mono,
            fontSize: 19,
            fontWeight: 700,
            color: theme.text,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
            boxShadow: smallFlash > 0.05 ? `0 0 ${16 * smallFlash}px ${withAlpha(theme.mech, 0.5)}` : 'none',
          }}
        >
          {'4 行'}
        </div>
      </div>
      <div style={{position: 'absolute', left: 1150, top: 560, opacity: big}}>
        <FullTextCard x={0} y={0} w={250} h={330} rowsLit={12} scale={0.92} />
        {/* 行数标（两千行级——不越真实量级） */}
        <div style={{marginTop: 10, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, fontWeight: 700, color: theme.load, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>
          {'~2000 行级'}
        </div>
      </div>
      {/* 对照注（常驻 vs 按需） */}
      <div style={{position: 'absolute', left: 760, top: 700, fontFamily: theme.sans, fontSize: 19, color: theme.dim, whiteSpace: 'nowrap', opacity: clamp01(Math.max(small, big))}}>
        {'常驻的只有几行 · 上千行的用到才进来'}
      </div>
      {/* 算账问号签（幕尾钩——转 P2 实测） */}
      {hook > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 880,
            top: 320,
            padding: '10px 24px',
            borderRadius: 10,
            border: `2.5px solid ${withAlpha(theme.text, 0.8)}`,
            background: theme.panel,
            fontFamily: theme.serif,
            fontSize: 38,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: hook,
            transform: `translateY(${(1 - hook) * 20}px)`,
          }}
        >
          {'省多少？'}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'代码落点 · 添一件添一行'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P1TwoLevelEntry: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p1-01', 'p1-03');
  const bB = w('p1-04', 'p1-05');
  const bC = w('p1-06', 'p1-07');
  const bD = w('p1-08', 'p1-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <OneA
          atLevels={wa('p1-01', 0.38) - bA.from}
          atFlashBand={wa('p1-01', 0.68) - bA.from}
          atFlashCard={wa('p1-01', 0.86) - bA.from}
          atScan={wa('p1-02', 0.3) - bA.from}
          atRows={wa('p1-02', 0.74) - bA.from}
          atDesc={wa('p1-02', 0.9) - bA.from}
          atLap={wa('p1-03', 0.3) - bA.from}
          atTail={wa('p1-03', 0.86) - bA.from}
          atRetire={at('p1-03') + span('p1-03') - 10 - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="1-B">
        <OneB
          atSweep={wa('p1-04', 0.42) - bB.from}
          atHit={wa('p1-04', 0.8) - bB.from}
          atChannel={wa('p1-05', 0.3) - bB.from}
          atName={wa('p1-05', 0.68) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="1-C">
        <OneC
          atReg={wa('p1-06', 0.24) - bC.from}
          atEnter={wa('p1-06', 0.72) - bC.from}
          atBounce={wa('p1-07', 0.28) - bC.from}
          atBlock={wa('p1-07', 0.78) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="1-D">
        <OneD
          atTool={wa('p1-08', 0.42) - bD.from}
          atRow={wa('p1-08', 0.62) - bD.from}
          atStill={wa('p1-08', 0.84) - bD.from}
          atSmall={wa('p1-09', 0.22) - bD.from}
          atBig={wa('p1-09', 0.58) - bD.from}
          atHook={wa('p1-10', 0.18) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1TwoLevelEntry;
