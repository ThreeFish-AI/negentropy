/** P4 两套拼法（p4-01..p4-10，4 镜）——分镜 4-A / 4-B / 4-C / 4-D。
 *
 *  叙事链：4-A 两轨双栏全景拉远（每幕首镜全景坐标锚 + 自 P3 峰值降压重锚，
 *  @pushIn 负增量）：左右等高双栏同为绿框（「都对、目标不同」的视觉裁决，不判
 *  优劣）——左栏分章版：四段卡（承 1-A 同形缩微）+ 进程内缓存徽标；右栏集成版：
 *  七段卡阵列（3-C 预告阵列转正——暗转实）+「每轮重建」印章 + 四样动态小卡
 *  （当前时间/技能目录/记忆/外部服务器名）持续刷新位 → p4-02 四词各落位一枚
 *  动态小卡 → p4-03 一枚小卡翻转 → 右栏提示条同步微变（状态联动演示）→
 *  4-B 左栏缓存徽标放大特写：双栏等高裁决线横贯一闪（等高裁决收束）、「本地
 *  开销」小计数卡弹出又收起（无具体数字）→ 4-C 真实 CC 层切分条：教学双栏退
 *  为暗层背景、前景一条真实层提示条横贯、一道分界线切「静态段｜动态段」两截、
 *  静态截挂全局缓存徽标（与 1-C 同形异位——另一层的家族身份）；p4-07 归属句
 *  期间画面零新增静持；p4-08 计费小签沿条边亮起（回扣 P0 计费动因）；p4-08b
 *  分界线一次落下（重音镜）→ 4-D 体量对比条特写：双端增长条（两三万字节 vs
 *  一百五十来个字符）+ 两枚数量级刻度标尺、×100 档位差点亮、定格静持 ≥10 帧。
 *
 *  空间契约：双栏等高同为绿框（无优劣色暗示）、左栏四段卡与 1-A 同形、任一栏
 *    降格/灰暗禁、动态小卡不给具体数值、分界线一次落位（静态左/动态右恒定）、
 *    徽标与 1-C 同形、归属句期间零新增、真实层零信源痕迹、动态截不挂缓存徽标、
 *    长短条比例悬殊可读、双单位分列、约数以约数呈现。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥176；PROMPT_SECTIONS（七键）·
 *    SYSTEM_PROMPT_DYNAMIC_BOUNDARY · prompt cache · CLAUDE_CODE_SIMPLE 只进
 *    角标；给左栏缓存标出省下的大数字禁（逆旁白——只省本地开销）。
 *
 *  morph 登记口径（QA 教训 28）：3-C→4-A 七段阵列转正取**主路径**（同一
 *  SectionCardStack DOM：litP 0.2→1 暗转实 + scale 0.92→1 + 亮度连续变化，
 *  段卡数量/排布/紫描边逐帧不变）；回退形态（cut + 阵列同构入场）不启用。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CacheBadge, LoopRing, PromptBar, SectionCardStack, SizeCompareBar} from '../components/motifs';
import {DUR, clamp01, progress, useBreathe, useImpulse, useProgress, usePushIn, useSpring} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** P4 右栏/暗层的七段卡（identity/tools/tasks/teams/workspace/memory/compaction）
 *  与每卡一行关键词（7 行对 7 卡——缩微态行数收紧防溢出） */
const CARDS_7 = [
  {zh: '身份', en: 'identity'},
  {zh: '工具', en: 'tools'},
  {zh: '任务', en: 'tasks'},
  {zh: '团队', en: 'teams'},
  {zh: '工作目录', en: 'workspace'},
  {zh: '记忆', en: 'memory'},
  {zh: '压缩', en: 'compaction'},
] as const;
const ROWS_7 = [
  {zh: '你是谁 · 恒定', en: 'identity'},
  {zh: '注册表 · 只增', en: 'tools'},
  {zh: '看板 · 常变', en: 'tasks'},
  {zh: '队友 · 常变', en: 'teams'},
  {zh: '目录 · 恒定', en: 'workspace'},
  {zh: '索引 · 常变', en: 'memory'},
  {zh: '阈值 · 恒定', en: 'compaction'},
] as const;

// ── 4-A 双栏全景（拉远降压重锚——左右等高同为绿框） ────────────────────────

const COLS = {lx: 140, rx: 980, y: 160, w: 820, h: 610} as const;
/** 四样动态小卡（持续刷新位——刷新纹帧驱动，无具体数值） */
const DYN_TITLES = ['当前时间', '技能目录', '记忆', '外部服务器名'] as const;

/** 动态小卡（标题 + 刷新纹——条宽随帧呼吸轮替；p4-03 翻转走 flipP） */
const DynCard: React.FC<{x: number; y: number; w: number; h: number; title: string; lit: number; flipP: number}> = ({x, y, w, h, title, lit, flipP}) => {
  const frame = useCurrentFrame();
  const shimmer = 0.35 + 0.3 * Math.sin(frame / 11 + x / 90);
  const sx = Math.max(0.06, Math.abs(1 - 2 * clamp01(flipP)));
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: clamp01(lit),
        transform: `scaleX(${sx})`,
        transformOrigin: 'center center',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          borderRadius: 9,
          border: `2.5px solid ${withAlpha(theme.sky, 0.55 + 0.35 * clamp01(lit))}`,
          background: withAlpha(theme.panel, 0.94),
          padding: '8px 14px',
        }}
      >
        <span style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{title}</span>
        {/* 刷新纹（帧驱动条宽轮替——「持续刷新位」无具体数值） */}
        <div style={{marginTop: 7, width: '100%', height: 9, borderRadius: 5, background: withAlpha(theme.sky, 0.12)}}>
          <div style={{width: `${38 + shimmer * 42}%`, height: '100%', borderRadius: 5, background: withAlpha(theme.sky, 0.55)}} />
        </div>
        <div style={{marginTop: 5, fontFamily: theme.mono, fontSize: 11, color: theme.dim, whiteSpace: 'nowrap'}}>{'刷新中'}</div>
      </div>
    </div>
  );
};

const FourA: React.FC<{atArray: number; atStamp: number; atDyns: number[]; atFlip: number; atBar: number}> = ({atArray, atStamp, atDyns, atFlip, atBar}) => {
  const frame = useCurrentFrame();
  // @pushIn 负增量（拉远降压：1.0→0.94——自 P3 峰值降压重锚）
  const pull = usePushIn(0, {scale: -0.06, dur: DUR.f6});
  // 双栏框架先立（等高同框——不判优劣）
  const cols = useProgress(0, DUR.f5);
  // 右栏阵列 stagger 转正（3-C 暗层 → 实；scale 0.92→1 + 亮度连续变化）
  const arraySeat = clamp01(progress(frame, atArray - 10, 14));
  const arrayLit = [0, 1, 2, 3, 4, 5, 6].map((i) => clamp01(progress(frame, atArray + i * 4, DUR.f4)));
  const arrayOn = arrayLit.reduce((a, v) => a + v, 0) / 7;
  const arrayScale = 0.92 + 0.08 * arrayOn;
  // 「每轮重建」印章落下（盖在阵列右上——rotate 印章 + 落定闪）
  const stamp = useProgress(atStamp, 22, 'decelerate');
  const stampFlash = useImpulse({at: atStamp + 20, dur: DUR.f5, peak: 1});
  // 四样动态小卡入场（stagger——四词各落位一枚）
  const dyns = DYN_TITLES.map((_, i) => clamp01(progress(frame, atDyns[i], DUR.f4)));
  // 一枚小卡翻转（第 2 枚——技能目录）→ 右栏提示条同步微变
  const flip = clamp01(progress(frame, atFlip, 20));
  const barShift = clamp01(progress(frame, atBar, 16));
  const barRound = Math.floor(frame / 26) % 2;
  // 左栏（分章版）四段卡 + 进程内缓存徽标
  const leftSeat = clamp01(progress(frame, 6, DUR.f5));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: pull, transformOrigin: '50% 50%'}}>
        {/* ── 左栏 · 分章版（四段 + 进程内缓存——承 1-A 同形缩微） ── */}
        <div
          style={{
            position: 'absolute',
            left: COLS.lx,
            top: COLS.y,
            width: COLS.w,
            height: COLS.h,
            boxSizing: 'border-box',
            borderRadius: 16,
            border: `3.5px solid ${withAlpha(theme.ok, 0.5)}`,
            background: withAlpha(theme.panel, 0.9),
            opacity: cols,
          }}
        >
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 20px 0'}}>
            <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.ok}}>{'分章版 · 四段'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'状态没变就复用'}</span>
          </div>
          <SectionCardStack x={190 - COLS.lx} y={250 - COLS.y} w={400} h={440} lit={leftSeat} />
          <CacheBadge x={640 - COLS.lx} y={400 - COLS.y} size={62} litP={leftSeat} hitP={leftSeat * 0.7} label={'进程内'} />
          <div style={{position: 'absolute', left: 640 - COLS.lx, top: 470 - COLS.y, fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap'}}>
            {'本地缓存'}
          </div>
        </div>
        {/* ── 右栏 · 集成版（七段阵列 + 每轮重建 + 四样动态小卡） ── */}
        <div
          style={{
            position: 'absolute',
            left: COLS.rx,
            top: COLS.y,
            width: COLS.w,
            height: COLS.h,
            boxSizing: 'border-box',
            borderRadius: 16,
            border: `3.5px solid ${withAlpha(theme.ok, 0.5)}`,
            background: withAlpha(theme.panel, 0.9),
            opacity: cols,
          }}
        >
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 20px 0'}}>
            <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.ok}}>{'集成版 · 七段'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'PROMPT_SECTIONS'}</span>
          </div>
          {/* 七段卡阵列（转正 morph 主路径：3-C 暗层屏位滑入右栏槽位——位置/尺度/
              亮度连续变化，段卡数量·排布·紫描边逐帧不变） */}
          <div style={{position: 'absolute', left: 310 - 280 * arrayOn, top: 50 - 10 * arrayOn, opacity: 0.22 + 0.78 * arrayOn}}>
            <SectionCardStack x={0} y={0} w={440} h={470} cards={CARDS_7} rows={ROWS_7} lit={arraySeat} litP={arrayLit} scale={arrayScale} />
          </div>
          {/* 每轮重建印章（盖阵列右上——落下 + 闪；与动态小卡列净空 ≥30px） */}
          {stamp > 0.02 ? (
            <div
              style={{
                position: 'absolute',
                left: 250,
                top: 120 - (1 - stamp) * -60,
                padding: '8px 22px',
                borderRadius: 10,
                border: `3.5px solid ${theme.danger}`,
                background: withAlpha(theme.panel, 0.92),
                fontFamily: theme.sans,
                fontSize: 21,
                fontWeight: 700,
                color: theme.danger,
                letterSpacing: 3,
                whiteSpace: 'nowrap',
                opacity: stamp,
                transform: `rotate(-10deg) scale(${0.9 + 0.1 * stamp})`,
                boxShadow: `0 0 ${16 * stampFlash}px ${withAlpha(theme.danger, 0.4)}`,
              }}
            >
              {'每轮重建'}
            </div>
          ) : null}
          {/* 四样动态小卡（持续刷新位——右列纵排） */}
          {DYN_TITLES.map((t, i) => (
            <DynCard key={t} x={520} y={40 + i * 102} w={270} h={88} title={t} lit={dyns[i]} flipP={i === 1 ? flip : 0} />
          ))}
          {/* 右栏提示条（状态联动——小卡翻转后同步微变：块序轮替一拍） */}
          <div style={{position: 'absolute', left: 30, top: 540, opacity: clamp01(arrayOn)}}>
            <div style={{display: 'flex', gap: 6, alignItems: 'flex-end', height: 40}}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
                const hot = barShift > 0.3 && (k === barRound * 3 || k === barRound * 3 + 1);
                return (
                  <span
                    key={`sb${k}`}
                    style={{
                      width: 44,
                      height: 18 + (hot ? 12 : 0) * barShift,
                      borderRadius: 4,
                      border: `2px solid ${hot ? theme.sky : withAlpha(theme.panelBorder, 0.95)}`,
                      background: hot ? withAlpha(theme.sky, 0.3) : 'transparent',
                      display: 'inline-block',
                    }}
                  />
                );
              })}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 11, color: theme.dim, marginTop: 4, whiteSpace: 'nowrap'}}>{'提示 · 随状态变'}</div>
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'PROMPT_SECTIONS（七键）· assemble_system_prompt'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-B 左栏缓存徽标放大特写：等高裁决线 + 本地开销小计数卡 ────────────────

const FourB: React.FC<{atRule: number; atZoom: number; atCount: number}> = ({atRule, atZoom, atCount}) => {
  const frame = useCurrentFrame();
  // 徽标放大居中（自左栏位放大——zoom 弹入）
  const zoom = useProgress(atZoom, 26, 'decelerate');
  const badgeScale = 0.6 + 1.7 * zoom;
  // 双栏等高裁决线横贯一闪（等高裁决收束——「都对」）
  const rule = Math.sin(Math.PI * clamp01(progress(frame, atRule, 22)));
  // 「本地重复拼字符串」小计数卡弹出又收起（一拍内；无具体数字——只省本地开销）
  const pop = Math.sin(Math.PI * clamp01(progress(frame, atCount, 30)));
  const tickPhase = Math.floor(frame / 8) % 4;
  return (
    <AbsoluteFill>
      {/* 双栏等高剪影（裁决线两侧——绿框等高对照） */}
      {[
        {x: 240, tag: '四段 · 有本地缓存'},
        {x: 1240, tag: '七段 · 每轮重建'},
      ].map((c) => (
        <div
          key={c.x}
          style={{
            position: 'absolute',
            left: c.x,
            top: 300,
            width: 440,
            height: 340,
            boxSizing: 'border-box',
            borderRadius: 14,
            border: `3px solid ${withAlpha(theme.ok, 0.4)}`,
            opacity: 0.4,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 14,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>{c.tag}</span>
        </div>
      ))}
      {/* 等高裁决线（横贯一闪——两栏顶边齐平的具象） */}
      {rule > 0.03 ? (
        <svg width={1920} height={10} viewBox="0 0 1920 10" style={{position: 'absolute', left: 0, top: 294, opacity: rule}}>
          <line x1={200} y1={5} x2={1720} y2={5} stroke={theme.ok} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - rule} />
        </svg>
      ) : null}
      {/* 左栏缓存徽标（放大居中——与 1-C 同形） */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: zoom}}>
        <CacheBadge x={812} y={430} size={104} scale={badgeScale} litP={1} hitP={0.85} label={'缓存 · 本地'} />
      </div>
      {/* 本地开销小计数卡（弹出又收起——拼装动作计数，无数字；居徽标下方） */}
      {pop > 0.03 ? (
        <div
          style={{
            position: 'absolute',
            left: 760,
            top: 630,
            width: 380,
            boxSizing: 'border-box',
            borderRadius: 10,
            border: `2.5px solid ${withAlpha(theme.dim, 0.8)}`,
            background: withAlpha(theme.panel, 0.96),
            padding: '10px 16px',
            opacity: pop,
            transform: `translateY(${(1 - pop) * 16}px)`,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{'本地开销 · 省重复拼装'}</div>
          <div style={{display: 'flex', gap: 6, marginTop: 8}}>
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <span
                key={`tk${k}`}
                style={{
                  width: 34,
                  height: 12,
                  borderRadius: 3,
                  background: withAlpha(theme.dim, k <= tickPhase ? 0.55 : 0.18),
                  display: 'inline-block',
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'都对 · 目标不同——省的只是本地开销'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C 真实 CC 层切分条（教学双栏退暗 + 分界线 + 全局缓存徽标） ────────────

const REALBAR = {x: 220, y: 420, w: 1480, h: 110} as const;

const FourC: React.FC<{atSwap: number; atBill: number; atDrop: number; atHit: number}> = ({atSwap, atBill, atDrop, atHit}) => {
  const frame = useCurrentFrame();
  // 拉远换层：教学双栏压暗、真实层提示条亮起（p4-06「真实的」词窗）
  const swap = useProgress(atSwap, DUR.f5);
  // 计费小签（沿提示条边亮起——回扣 P0 计费动因）
  const bill = useProgress(atBill, DUR.f4);
  // 分界线一次落下（重音镜——settle 收束）+ 静态段徽标定格
  const drop = useSpring('settle', {at: atDrop, dur: 18});
  const hit = useProgress(atHit, DUR.f4);
  const ringDim = 0.3 + 0.2 * swap;
  return (
    <AbsoluteFill>
      {/* 教学双栏（退为暗层背景——4-A 双栏缩微剪影） */}
      <div style={{position: 'absolute', inset: 0, opacity: 0.2 * (1 - swap) + 0.06, filter: 'saturate(0.5)'}}>
        {[
          {x: 120, w: 700},
          {x: 1100, w: 700},
        ].map((c) => (
          <div
            key={c.x}
            style={{
              position: 'absolute',
              left: c.x,
              top: 180,
              width: c.w,
              height: 520,
              boxSizing: 'border-box',
              borderRadius: 14,
              border: `3px solid ${withAlpha(theme.ok, 0.4)}`,
            }}
          />
        ))}
        <div style={{position: 'absolute', left: 0, right: 0, top: 130, textAlign: 'center', fontFamily: theme.sans, fontSize: 17, color: theme.dim, opacity: 0.8}}>
          {'教学双栏（上一拍）'}
        </div>
      </div>
      {/* 真实层提示条（横贯——静态段｜动态段两截；分界线一次落下） */}
      <div style={{position: 'absolute', left: REALBAR.x, top: REALBAR.y, opacity: swap}}>
        <PromptBar x={0} y={0} w={REALBAR.w} h={REALBAR.h} mode={'boundary'} dropP={drop} staticP={0.62} />
      </div>
      {/* 全局缓存徽标（静态截挂件——与 1-C 缓存徽标同形异位：另一层的家族身份） */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: swap}}>
        <CacheBadge x={320} y={326} size={72} scale={0.9 + 0.1 * hit} litP={0.45 + 0.55 * hit} hitP={hit} label={'全局缓存'} />
      </div>
      {/* 计费小签（沿条边——每轮计费语境回扣 P0） */}
      {bill > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            right: 180,
            top: REALBAR.y + REALBAR.h + 18,
            padding: '4px 16px',
            borderRadius: 8,
            border: `2.5px solid ${withAlpha(theme.core, 0.85)}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 16,
            fontWeight: 700,
            color: theme.core,
            whiteSpace: 'nowrap',
            opacity: bill,
          }}
        >
          {'每轮计费 · 在这一头'}
        </div>
      ) : null}
      {/* 环体缩悬暗位（每轮计费语境——暗态驻屏） */}
      <div style={{position: 'absolute', left: 80, top: 76, opacity: ringDim}}>
        <LoopRing size={110} nodes={[]} showExit={false} dotProgress={(frame / 85) % 1} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'SYSTEM_PROMPT_DYNAMIC_BOUNDARY · prompt cache'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-D 体量对比条特写（双端增长 + 数量级标尺） ────────────────────────────

const FourD: React.FC<{atLong: number; atShort: number; atMag: number}> = ({atLong, atShort, atMag}) => {
  const frame = useCurrentFrame();
  // 长端攀升至满幅（约数区间呈现——数据本体禁过冲：linear 段 + settle 收尾）
  const longP = clamp01(progress(frame, atLong, 34));
  const longFlash = useImpulse({at: atLong + 34, dur: DUR.f6, peak: 1});
  // 短端落定（保底可读 + 精确值旁标）
  const shortP = clamp01(progress(frame, atShort, DUR.f4));
  const shortFlash = useImpulse({at: atShort + DUR.f4, dur: DUR.f6, peak: 1});
  // ×100 数量级档位差点亮（定格静持 ≥10 帧——p4-10 单句尾无新增）
  const magP = clamp01(progress(frame, atMag, DUR.f5));
  const magFlash = useImpulse({at: atMag + DUR.f4, dur: DUR.f6, peak: 1});
  const glow = useBreathe({period: 50, amp: 0.3, base: 0.5});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 260, top: 300, width: 1400, opacity: 0.92 + 0.08 * glow}}>
        <SizeCompareBar x={0} y={0} w={1400} longP={longP} shortP={shortP} magP={magP} />
      </div>
      {/* 重音闪注（长端 / 短端落定 / 数量级——各一拍） */}
      {longFlash > 0.04 ? (
        <div style={{position: 'absolute', left: 300, top: 258, fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.mech, whiteSpace: 'nowrap', opacity: longFlash}}>
          {'攀升至满幅'}
        </div>
      ) : null}
      {shortFlash > 0.04 ? (
        <div style={{position: 'absolute', left: 356, top: 420, fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.sky, whiteSpace: 'nowrap', opacity: shortFlash}}>
          {'只剩一条边'}
        </div>
      ) : null}
      {magFlash > 0.04 ? (
        <div style={{position: 'absolute', left: 1640, top: 560, fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.ok, whiteSpace: 'nowrap', opacity: magFlash}}>
          {'×100'}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'字节 ↔ 字符 · CLAUDE_CODE_SIMPLE · 计数随版本漂移'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P4TwoAssemblies: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p4-01', 'p4-03');
  const bB = w('p4-04', 'p4-05');
  const bC = w('p4-06', 'p4-08b');
  const bD = w('p4-09', 'p4-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <FourA
          atArray={wa('p4-01', 0.3) - bA.from}
          atStamp={wa('p4-01', 0.66) - bA.from}
          atDyns={[
            wa('p4-02', 0.22) - bA.from,
            wa('p4-02', 0.36) - bA.from,
            wa('p4-02', 0.5) - bA.from,
            wa('p4-02', 0.66) - bA.from,
          ]}
          atFlip={wa('p4-03', 0.42) - bA.from}
          atBar={wa('p4-03', 0.74) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <FourB atRule={wa('p4-04', 0.36) - bB.from} atZoom={0} atCount={wa('p4-05', 0.4) - bB.from} />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <FourC atSwap={wa('p4-06', 0.24) - bC.from} atBill={wa('p4-08', 0.5) - bC.from} atDrop={wa('p4-08b', 0.14) - bC.from} atHit={wa('p4-08b', 0.5) - bC.from} />
      </Sequence>
      <Sequence {...bD} name="4-D">
        <FourD atLong={wa('p4-09', 0.36) - bD.from} atShort={wa('p4-09', 0.74) - bD.from} atMag={wa('p4-10', 0.36) - bD.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4TwoAssemblies;
