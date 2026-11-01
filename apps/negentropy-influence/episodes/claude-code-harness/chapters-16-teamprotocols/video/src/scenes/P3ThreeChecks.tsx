/** P3 三道检查（p3-01..p3-11，4 镜）——分镜 3-A / 3-B / 3-C / 3-D。
 *
 *  Morph Continuity（2-D→3-A，头注明示）：同一主体 = 「对号」三枚碎片
 *  （号 / 类型 / 状态）。起止态：2-D 末帧三碎片悬浮半空（微光可见）→ 3-A
 *  首帧三碎片飞入三栏检查卡栏头落位。中间态：飞入过程三签文字、色相、相对
 *  次序逐帧不变，仅位置与归属容器变化。身份线索：三签文字 + 相对次序。
 *
 *  叙事链：3-A 开帧销账动线全景一拍（P2 末态缩微）→ @pushIn 推近三栏检查卡：
 *  p3-01「三道检查挨个过」词落位三栏卡立起、三碎片飞入栏头 → p3-02「查编号」
 *  词落位栏①演示（携异号签的回复入站、号签比对无重合闪灰 → 弹开）→ p3-03
 *  「查类型」词落位栏②演示（关机回复撞计划单、类型对不上 → 弹开）→ p3-04
 *  「查状态」词落位栏③演示（回复撞已办结单 → 弹开，「不许生效两次」加重一拍）
 *  → 3-B E2 消融双屏（全片张力峰值，左红右绿恒定——左=拆掉类型检查·关机回复
 *  硬批计划 ↔ 右=类型检查在位·错配被拦·计划仍待处理）：p3-05「把第二道拆了」
 *  词落位左轨栏②闸片抽出移除、「编号照留」词落位栏①闸片亮一下、右轨闸片
 *  亮绿（基线）→ p3-06「一条关机回复」词落位双轨同款回复同时入站——右轨即被
 *  栏②弹开定格「待处理」基线、左轨长驱直入、「把一单挂着的计划审批」词落位
 *  号徽章与计划行号签同形重合、「硬改成已批准」词落位状态胶囊被硬翻「已批准」
 *  整行泛警示红一沉（误批！重音镜，全片张力峰值）→ p3-07 教训签横贯双轨底部
 *  → 3-C S2 防重消融双屏（左红=关掉状态检查·同意投两遍改写计数 1→2·反话翻案
 *  计数 3 ↔ 右绿=防重在位·第二投被拦·计数停 1）：p3-08「第三道也拆过」词落位
 *  左轨栏③闸片抽出、右轨闸片亮绿 → p3-09「投两遍」词落位左轨第二投长驱入账
 *  计数 1→2、「反话」词落位「不同意」副本入账绿翻红当场翻案（重音镜）、计数
 *  2→3；右轨第二遍被栏③弹开计数停 1、双计数定格对照 → 3-D 底线裁决+悬念钩：
 *  p3-10「只决议一次」词落位底线签压顶定格（重音镜）、「第三道兜着」词落位
 *  栏③双闪两下 → p3-11「谁来读那条回复」词落位暗窗拉开、回复信悬停箱口微微
 *  晃动（P4 接棒位）。
 *
 *  空间契约：三栏等距同构、演示次序 = 口播次序、弹开帧带 ignored 角标；红左
 *  绿右恒定、左轨侵入有号签重合动作再翻态（因果可追）、右轨弹开帧 ignored
 *  角标在位、两轨初态公平（同为待处理 / 同为已批准）；计数跳变与口播数字一致
 *  （1→2→3 ↔ 停 1）、翻案帧绿转红可读；底线签 ≤6 字、栏③双闪为唯一强调动效、
 *  暗窗内不显 P4 机制细节。
 *  红线落实：任一栏禁提前演示、弹开禁显示为入账成功态、演示回复禁发明号数
 *  （narration 未给——号签以 №? 占位）、右轨禁任何退化、左轨禁无对号动作直接
 *  翻态、右轨计数器禁动格、左轨投递禁无入账轨迹、计数禁越过 3、底线签禁复述
 *  整句口播、暗窗禁提前演出双读者；词落位 = wa(id,f)；y≥56 / bottom≥176。
 *
 *  承接登记：3-D→4-A 幕间 SceneFade + 全景重锚（换层断裂，走非 morph——承
 *    ep2 3-C→4-A / ep15 形态）；位置呼应：3-D 末帧暗窗收件箱剪影 = 4-A 首帧
 *    收件箱特写位；环/表/箱同款签名跨镜恒常。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {AblationSplit, CHECK_LANES, RegistryTable, RewriteCounter, StatePill} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 3-A 三栏检查卡：三碎片飞入栏头 + 三道演示逐条弹开（各拦一种错） ──────────

/** 三栏位（纵列——等距同构；开帧销账动线全景缩微压上方）。
 *  安全带红线（ep15 底环侵入返工教训）：三栏底边 = y 656 + COL_H 196 = 852，
 *  恒 ≤ 860（字幕带上方 160px 带之上）；往下加内容须同步核此常量。 */
const COLS_3A = [
  {x: 340, y: 208, title: '① 编号', demo: '号在表上没有？', code: 'unknown_id', hit: '№?'},
  {x: 340, y: 432, title: '② 类型', demo: '关机回复 × 计划单', code: 'type_mismatch', hit: '关机回复'},
  {x: 340, y: 656, title: '③ 状态', demo: '这单已办结？', code: 'duplicate', hit: '回复'},
] as const;
const COL_W = 1240;
const COL_H = 196;
/** 2-D 三碎片屏位（morph 起点——号/类型/状态 横排悬浮位） */
const SHARD_FROM = [
  {x: 700, y: 640},
  {x: 930, y: 660},
  {x: 1160, y: 640},
] as const;

/** 三栏检查卡（哑装置——闸片在位恒绿边、演示进度/弹开全 props）。
 *  `gateP` 栏立起；`shardP` 碎片自 2-D 悬浮位飞入栏头（0..1）；
 *  `demoP` 演示进度（0..0.5 入站、0.5..0.75 比对闪、0.75..1 弹开）；
 *  `heavyP` 弹开加重（栏③「不许生效两次」）。 */
const GateColumn: React.FC<{
  geo: {x: number; y: number; title: string; demo: string; code: string; hit: string};
  gateP: number;
  shardP: number;
  shardLabel: string;
  demoP: number;
  heavyP: number;
}> = ({geo, gateP, shardP, shardLabel, demoP, heavyP}) => {
  const gate = clamp01(gateP);
  const shard = clamp01(shardP);
  const demo = clamp01(demoP);
  const heavy = clamp01(heavyP);
  // 演示三段：入站（0..0.5）→ 比对闪灰（0.5..0.72）→ 弹开飞出（0.72..1）
  const inbound = clamp01(demo / 0.5);
  const compare = clamp01((demo - 0.5) / 0.22);
  const bounce = clamp01((demo - 0.72) / 0.28);
  const replyX = geo.x + COL_W - 40 - inbound * (COL_W - 520);
  const replyY = geo.y + 118;
  const bounceDx = bounce * 190;
  const bounceDy = -Math.sin(Math.PI * bounce) * 60;
  return (
    <div style={{position: 'absolute', left: geo.x, top: geo.y, width: COL_W, height: COL_H, opacity: gate}}>
      {/* 栏卡体 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          border: `3px solid ${withAlpha(theme.dim, 0.75)}`,
          background: withAlpha(theme.panel, 0.96),
          transform: `translateY(${(1 - gate) * 22}px)`,
        }}
      >
        {/* 栏头（碎片签落位——号 / 类型 / 状态） */}
        <div style={{position: 'absolute', left: 22, top: -26, display: 'flex', alignItems: 'center', gap: 12}}>
          <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{geo.title}</span>
          <span
            style={{
              padding: '4px 16px',
              borderRadius: 9,
              border: `3px solid ${withAlpha(theme.text, 0.85)}`,
              background: withAlpha(theme.panel, 0.98),
              fontFamily: theme.serif,
              fontSize: 22,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: shard,
            }}
          >
            {shardLabel}
          </span>
        </div>
        {/* 演示说明签（关键词——检查内容） */}
        <div style={{position: 'absolute', left: 26, top: 58, fontFamily: theme.sans, fontSize: 21, color: theme.dim, whiteSpace: 'nowrap'}}>
          {geo.demo}
        </div>
        {/* 闸片（检查在位——绿边闸片横挡在入站轨道上） */}
        <div
          style={{
            position: 'absolute',
            left: 470,
            top: 96,
            width: 56,
            height: 44,
            borderRadius: 8,
            border: `3px solid ${withAlpha(theme.ok, 0.9)}`,
            background: withAlpha(theme.ok, 0.12),
            opacity: 0.9,
          }}
        >
          <span style={{display: 'block', textAlign: 'center', fontFamily: theme.mono, fontSize: 13, color: theme.ok, marginTop: 10}}>闸</span>
        </div>
        {/* 比对闪（无果闪灰 / 类型对不上 / 已定格——比对拍的读出） */}
        {compare > 0.05 && compare < 0.98 ? (
          <div
            style={{
              position: 'absolute',
              left: 560,
              top: 60,
              fontFamily: theme.mono,
              fontSize: 17,
              color: theme.danger,
              whiteSpace: 'nowrap',
              opacity: Math.sin(Math.PI * compare),
            }}
          >
            {`对不上 ✗`}
          </div>
        ) : null}
        {/* ignored 角标（弹开帧——随弹开飞出贴回复旁；容器内相对坐标） */}
        {bounce > 0.15 ? (
          <div
            style={{
              position: 'absolute',
              left: replyX - geo.x + bounceDx - 40,
              top: 66,
              fontFamily: theme.mono,
              fontSize: 15,
              color: theme.danger,
              whiteSpace: 'nowrap',
              opacity: clamp01(bounce * 1.6) * (heavy > 0.3 ? 1 : 0.85),
              fontWeight: heavy > 0.3 ? 700 : 400,
            }}
          >
            {`ignored · ${geo.code}`}
          </div>
        ) : null}
        {/* 入站轨道（右侧 → 闸片：回复小卡） */}
        <svg width={COL_W} height={COL_H} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          <line x1={COL_W - 40} y1={replyY - geo.y} x2={640} y2={replyY - geo.y} stroke={withAlpha(theme.panelBorder, 0.9)} strokeWidth={2.5} strokeDasharray="8 8" />
          {/* 弹开轨迹（撞闸斜飞出——有轨迹可追） */}
          {bounce > 0.02 && bounce < 0.99 ? (
            <path
              d={`M ${replyX - geo.x} ${replyY - geo.y} q ${bounceDx * 0.6} ${bounceDy} ${bounceDx} ${bounceDy}`}
              stroke={withAlpha(theme.danger, 0.6)}
              strokeWidth={2.5}
              fill="none"
              strokeDasharray="5 6"
            />
          ) : null}
        </svg>
      </div>
      {/* 入站回复小卡（携签入站 → 撞闸弹开——容器内相对坐标 + 弹开轨迹真实偏移） */}
      {demo > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: replyX - geo.x + bounceDx,
            top: replyY - geo.y + bounceDy,
            padding: '7px 18px',
            borderRadius: 9,
            border: `2.5px solid ${bounce > 0.5 ? withAlpha(theme.danger, 0.9) : withAlpha(theme.dim, 0.8)}`,
            background: withAlpha(theme.panel, 0.98),
            fontFamily: theme.sans,
            fontSize: 18,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: inbound > 0.02 ? (bounce >= 1 ? 0 : 1) : 0,
            transform: `rotate(${bounce * -16}deg)`,
          }}
        >
          {geo.hit}
        </div>
      ) : null}
    </div>
  );
};

const ThreeA: React.FC<{atGates: number; atShards: number; atDemos: number[]; atHeavy: number}> = ({atGates, atShards, atDemos, atHeavy}) => {
  const frame = useCurrentFrame();
  const push = usePushIn(14, {scale: 0.07, dur: DUR.f6});
  // 开帧销账动线全景一拍（P2 末态缩微——表+外框缩小压上方，三栏立起时退暗让位）
  const wide = 1 - clamp01(progress(frame, atGates - 4, 14));
  // 三栏立起 + 三碎片飞入栏头（morph：自 2-D 悬浮位——文字/色相/次序不变）
  const gates = [0, 1, 2].map((i) => clamp01(progress(frame, atGates + i * 4, DUR.f5)));
  const shards = [0, 1, 2].map((i) => clamp01(progress(frame, atShards + i * 5, 16)));
  // 三栏演示（次序 = 口播次序——逐栏各演一遍）
  const demos = atDemos.map((a) => clamp01(progress(frame, a, 46)));
  const heavy = Math.sin(Math.PI * clamp01(progress(frame, atHeavy, 18)));
  return (
    <AbsoluteFill style={{transform: push, transformOrigin: '50% 44%'}}>
      {/* P2 末态缩微（开帧全景坐标锚一拍——表+外框；三栏立起时退暗） */}
      <div style={{position: 'absolute', left: 660, top: 96, opacity: wide * 0.85, transform: `scale(${0.5 + 0.5 * wide})`, transformOrigin: '50% 0%'}}>
        <RegistryTable x={0} y={0} w={600} micro nameP={1} rows={[{key: 'p', badge: undefined, type: '计划审批', to: '主代理', state: 'approved', stateP: 1}]} />
      </div>
      {/* 三栏检查卡（纵列——① 编号 ② 类型 ③ 状态） */}
      {COLS_3A.map((c, i) => (
        <React.Fragment key={`col${i}`}>
          <GateColumn geo={c} gateP={gates[i]} shardP={shards[i]} shardLabel={['号', '类型', '状态'][i]} demoP={demos[i]} heavyP={i === 2 ? heavy : 0} />
        </React.Fragment>
      ))}
      {/* 碎片飞行（morph 中间态：2-D 悬浮位 → 栏头位；文字/色相/次序不变） */}
      {shards.map((s, i) => {
        if (s <= 0.02 || s >= 0.98) return null;
        const from = SHARD_FROM[i];
        const to = {x: cHeadX(i), y: COLS_3A[i].y - 4};
        return (
          <div
            key={`fly${i}`}
            style={{
              position: 'absolute',
              left: from.x + (to.x - from.x) * s,
              top: from.y + (to.y - from.y) * s,
              transform: 'translate(-50%, -50%)',
              opacity: 1,
            }}
          >
            <span
              style={{
                padding: '12px 28px',
                borderRadius: 11,
                border: `3px solid ${withAlpha(theme.text, 0.85)}`,
                background: withAlpha(theme.panel, 0.98),
                fontFamily: theme.serif,
                fontSize: 30,
                fontWeight: 700,
                color: theme.text,
                whiteSpace: 'nowrap',
              }}
            >
              {['号', '类型', '状态'][i]}
            </span>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'match_response · 一道拦一种错'}
      </div>
    </AbsoluteFill>
  );
};

/** 栏头碎片落位 x（GateColumn 内栏头签位——碎片终点） */
const cHeadX = (i: number) => COLS_3A[i].x + 130;

// ── 3-B E2 消融（左红=拆掉类型检查 / 右绿=类型检查在位——全片张力峰值） ───────

/** 轨内 mini 闸片行（栏①②③——`removed` 序号位闸片抽出虚框、`litNo` 点亮序号） */
const MiniGates: React.FC<{x: number; y: number; removed?: number; litNo?: number; onP?: number}> = ({x, y, removed = -1, litNo = -1, onP = 1}) => {
  const labels = ['①', '②', '③'];
  return (
    <div style={{position: 'absolute', left: x, top: y, display: 'flex', gap: 16, opacity: onP}}>
      {labels.map((l, i) => {
        const isRemoved = i === removed;
        const isLit = i === litNo;
        return (
          <div
            key={`mg${i}`}
            style={{
              width: 118,
              padding: '8px 0',
              textAlign: 'center',
              borderRadius: 9,
              border: isRemoved
                ? `2px dashed ${withAlpha(theme.panelBorder, 0.9)}`
                : `2.5px solid ${i === 1 || i === 2 ? withAlpha(theme.ok, 0.85) : withAlpha(theme.dim, 0.8)}`,
              background: isRemoved ? 'transparent' : i === 1 || i === 2 ? withAlpha(theme.ok, 0.1) : 'transparent',
              fontFamily: theme.sans,
              fontSize: 17,
              fontWeight: 700,
              color: isRemoved ? theme.dim : i === 1 || i === 2 ? theme.ok : theme.dim,
              whiteSpace: 'nowrap',
              boxShadow: isLit ? `0 0 ${16 * 0.9}px ${withAlpha(theme.text, 0.6)}` : 'none',
            }}
          >
            {isRemoved ? `${l} 移除` : `${l} 在位`}
          </div>
        );
      })}
    </div>
  );
};

const ThreeB: React.FC<{atRemove: number; atKeepId: number; atBase: number; atInbound: number; atBounceR: number; atThru: number; atBadgeHit: number; atHard: number; atLesson: number}> = ({
  atRemove,
  atKeepId,
  atBase,
  atInbound,
  atBounceR,
  atThru,
  atBadgeHit,
  atHard,
  atLesson,
}) => {
  const frame = useCurrentFrame();
  // 双轨立起 + 左轨栏②闸片抽出移除（拆除有轨迹——闸片飞出位）
  const rise = clamp01(progress(frame, 4, 16));
  const remove = clamp01(progress(frame, atRemove, 14));
  const removeFly = remove < 1 ? remove : 1;
  // 左轨栏①闸片亮一下（编号照留）
  const keepId = Math.sin(Math.PI * clamp01(progress(frame, atKeepId, 20)));
  // 右轨闸片亮绿（基线）
  const baseG = clamp01(progress(frame, atBase, DUR.f4));
  // 双轨同款回复同时入站
  const inbound = clamp01(progress(frame, atInbound, 22));
  // 右轨即被栏②弹开（type_mismatch → ignored）定格「待处理」基线
  const bounceR = clamp01(progress(frame, atBounceR, 16));
  // 左轨长驱直入 + 号徽章与计划行号签同形重合（号对上·类型对不上）
  const thru = clamp01(progress(frame, atThru, 16));
  const badgeHit = clamp01(progress(frame, atBadgeHit, 10));
  const hitGlow = Math.sin(Math.PI * clamp01(progress(frame, atBadgeHit + 8, 24)));
  // 状态胶囊被硬翻成「已批准」、整行泛警示红一沉（误批！重音镜）
  const hard = clamp01(progress(frame, atHard, 12));
  const hardSink = Math.sin(Math.PI * clamp01(progress(frame, atHard, 30)));
  // 教训签横贯双轨底部（号对=找对单 · 类型对=同一件事）
  const lesson = clamp01(progress(frame, atLesson, DUR.f5));
  // 轨内坐标（左右同构）
  const geoOf = (side: 'L' | 'R') => {
    const lane = side === 'L' ? CHECK_LANES.left : CHECK_LANES.right;
    return {cx: lane.x + 40, tableX: lane.x + 250, railY: 620};
  };
  const L = geoOf('L');
  const R = geoOf('R');
  // 回复小卡（双轨同款「关机回复」——号数不显字，不造 narration 外号数）
  const replyTag = '关机回复';
  return (
    <AbsoluteFill>
      <AblationSplit litP={rise} leftP={rise} rightP={rise} leftTitle="拆掉类型检查" leftSub="E2 · 实测" rightTitle="类型检查在位" rightSub="基线" />
      {/* 左轨：闸片行（②抽出移除虚框、①在位——编号照留） */}
      <MiniGates x={L.cx} y={216} removed={1} litNo={keepId > 0.2 ? 0 : -1} onP={rise} />
      {/* ②闸片抽出轨迹（移除的闸片飞出轨外淡出——拆除有轨迹） */}
      <div
        style={{
          position: 'absolute',
          left: L.cx + 134,
          top: 208,
          padding: '8px 0',
          width: 118,
          textAlign: 'center',
          borderRadius: 9,
          border: `2.5px solid ${withAlpha(theme.dim, 0.8)}`,
          background: withAlpha(theme.panel, 0.95),
          fontFamily: theme.sans,
          fontSize: 17,
          fontWeight: 700,
          color: theme.dim,
          opacity: (1 - remove) * rise,
          transform: `translate(${-removeFly * 160}px, ${-removeFly * 90}px) rotate(${removeFly * -18}deg)`,
          whiteSpace: 'nowrap',
        }}
      >
        ② 在位
      </div>
      {/* 左轨：迷你登记表（计划审批行·待处理——号签列位占位不显数） */}
      <div style={{position: 'absolute', left: L.tableX, top: 300, opacity: rise}}>
        <RegistryTable
          x={0}
          y={0}
          w={470}
          micro
          rows={[{key: 'plan', badge: undefined, type: '计划审批', to: '主代理', state: 'approved', stateP: hard, hardP: hard, hotP: Math.max(0.2, hitGlow)}]}
        />
        {/* 号徽章重合（左轨侵入——号徽章与计划行号签同形重合：号对上·类型对不上） */}
        {badgeHit > 0.05 ? (
          <div
            style={{
              position: 'absolute',
              left: 6,
              top: 38,
              transform: `translate(${(1 - badgeHit) * 90}px, ${(1 - badgeHit) * 40}px)`,
              opacity: badgeHit,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: `3px solid ${theme.req}`,
                background: withAlpha(theme.req, 0.16),
                boxShadow: hitGlow > 0.03 ? `0 0 ${22 * hitGlow}px ${withAlpha(theme.req, 0.7)}` : 'none',
              }}
            />
          </div>
        ) : null}
        {/* 误批红沉（整行泛警示红一沉——重音镜） */}
        {hardSink > 0.03 ? (
          <div
            style={{
              position: 'absolute',
              left: -8,
              top: 30,
              width: 486,
              height: 56,
              borderRadius: 8,
              boxShadow: `0 0 ${34 * hardSink}px ${withAlpha(theme.danger, 0.55 * hardSink)}`,
              border: `2.5px solid ${withAlpha(theme.danger, 0.8 * hardSink)}`,
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>
      {/* 左轨：回复长驱直入（入站 → 撞表入账——侵入轨迹） */}
      <div
        style={{
          position: 'absolute',
          left: L.cx + 640 - inbound * 320 - thru * 60,
          top: L.railY,
          padding: '7px 18px',
          borderRadius: 9,
          border: `2.5px solid ${withAlpha(theme.danger, 0.85)}`,
          background: withAlpha(theme.panel, 0.98),
          fontFamily: theme.sans,
          fontSize: 18,
          fontWeight: 700,
          color: theme.text,
          whiteSpace: 'nowrap',
          opacity: inbound > 0.02 ? 1 - thru * 0.75 : 0,
        }}
      >
        {replyTag}
      </div>
      {/* 右轨：闸片行（②绿边在位——基线） */}
      <MiniGates x={R.cx} y={216} litNo={baseG > 0.4 ? 1 : -1} onP={rise} />
      {/* 右轨：迷你登记表（计划审批行·待处理定格——公平基线） */}
      <div style={{position: 'absolute', left: R.tableX, top: 300, opacity: rise}}>
        <RegistryTable x={0} y={0} w={470} micro rows={[{key: 'plan', badge: undefined, type: '计划审批', to: '主代理', state: 'pending'}]} />
      </div>
      {/* 右轨：回复入站 → 撞栏②弹开（type_mismatch → ignored） */}
      <div
        style={{
          position: 'absolute',
          left: R.cx + 640 - inbound * 330,
          top: R.railY,
          padding: '7px 18px',
          borderRadius: 9,
          border: `2.5px solid ${withAlpha(theme.dim, 0.85)}`,
          background: withAlpha(theme.panel, 0.98),
          fontFamily: theme.sans,
          fontSize: 18,
          fontWeight: 700,
          color: theme.text,
          whiteSpace: 'nowrap',
          opacity: inbound > 0.02 ? (bounceR >= 1 ? 0 : 1) : 0,
          transform: `translate(${bounceR * 150}px, ${-Math.sin(Math.PI * bounceR) * 70}px) rotate(${bounceR * 14}deg)`,
        }}
      >
        {replyTag}
      </div>
      {/* 右轨 ignored 角标（弹开帧在位） */}
      {bounceR > 0.3 ? (
        <div
          style={{
            position: 'absolute',
            left: R.cx + 140 + bounceR * 150,
            top: R.railY - 48,
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.ok,
            whiteSpace: 'nowrap',
            opacity: clamp01(bounceR * 1.6),
          }}
        >
          {`ignored · type_mismatch`}
        </div>
      ) : null}
      {/* 教训签（横贯双轨底部——压缩签：号对=找对单 · 类型对=同一件事） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 856,
          display: 'flex',
          justifyContent: 'center',
          gap: 30,
          opacity: lesson,
          transform: `translateY(${(1 - lesson) * 18}px)`,
        }}
      >
        {['号对 = 找对了单', '类型对 = 同一件事'].map((s, i) => (
          <div
            key={`ls${i}`}
            style={{
              padding: '11px 30px',
              borderRadius: 11,
              border: `3px solid ${withAlpha(i === 0 ? theme.req : theme.ok, 0.85)}`,
              background: withAlpha(theme.panel, 0.98),
              fontFamily: theme.sans,
              fontSize: 24,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
            }}
          >
            {s}
          </div>
        ))}
      </div>
      {/* 本镜底部角标右置避让居中的教训签（教训签横贯底部 y 856——水平错开防叠） */}
      <div style={{position: 'absolute', right: 90, bottom: 176, textAlign: 'right', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'实测：拆掉第二道 → 关机回复硬批了计划'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C S2 防重消融（左红=关掉状态检查 / 右绿=防重在位）+ 改写计数器 ──────────

const ThreeC: React.FC<{atRemove: number; atBase: number; atSecond: number; atCount2: number; atAgainst: number; atFlip: number; atCount3: number; atBounceR: number; atFreeze: number}> = ({
  atRemove,
  atBase,
  atSecond,
  atCount2,
  atAgainst,
  atFlip,
  atCount3,
  atBounceR,
  atFreeze,
}) => {
  const frame = useCurrentFrame();
  const rise = clamp01(progress(frame, 4, 16));
  // 左轨栏③闸片抽出（拆除语法承 3-B——观众已识）、右轨闸片亮绿
  const remove = clamp01(progress(frame, atRemove, 14));
  const baseG = clamp01(progress(frame, atBase, DUR.f4));
  // 第一投（开帧已入账——计数 1 基线）；第二投长驱入账（p3-08 句尾「投两遍」）
  const second = clamp01(progress(frame, atSecond, 20));
  // 计数跳 1→2（「表被改写两次」——离散直取，禁连续滚动）
  const at2 = clamp01(progress(frame, atCount2, 4));
  // 「不同意」副本入账（反话）
  const against = clamp01(progress(frame, atAgainst, 18));
  // 翻案帧（绿「已批准」当场翻红「已拒绝」——重音镜）
  const flip = clamp01(progress(frame, atFlip, DUR.f4));
  const flipFlash = Math.sin(Math.PI * clamp01(progress(frame, atFlip, 26)));
  // 计数跳 2→3
  const at3 = clamp01(progress(frame, atCount3, 4));
  // 右轨第二遍投递被栏③弹开（already approved → ignored）、计数停 1
  const secondR = clamp01(progress(frame, atSecond, 20));
  const bounceR = clamp01(progress(frame, atBounceR, 16));
  // 双计数位定格对照（1 ↔ 3，基线锚定）
  const freeze = clamp01(progress(frame, atFreeze, DUR.f4));
  // 左轨计数器值（离散：1 → 2 → 3，与口播数字一致、禁越 3）
  const leftVal = at3 > 0.5 ? 3 : at2 > 0.5 ? 2 : 1;
  const L = {cx: CHECK_LANES.left.x + 40, tableX: CHECK_LANES.left.x + 250, railY: 620};
  const R = {cx: CHECK_LANES.right.x + 40, tableX: CHECK_LANES.right.x + 250, railY: 620};
  return (
    <AbsoluteFill>
      <AblationSplit litP={rise} leftP={rise} rightP={rise} leftTitle="关掉状态检查" leftSub="S2 · 实测" rightTitle="防重在位" rightSub="基线" />
      {/* 左轨：闸片行（③抽出移除）+ 抽出轨迹 */}
      <MiniGates x={L.cx} y={216} removed={2} onP={rise} />
      <div
        style={{
          position: 'absolute',
          left: L.cx + 268,
          top: 208,
          width: 118,
          padding: '8px 0',
          textAlign: 'center',
          borderRadius: 9,
          border: `2.5px solid ${withAlpha(theme.dim, 0.8)}`,
          background: withAlpha(theme.panel, 0.95),
          fontFamily: theme.sans,
          fontSize: 17,
          fontWeight: 700,
          color: theme.dim,
          whiteSpace: 'nowrap',
          opacity: (1 - remove) * rise,
          transform: `translate(${remove * 160}px, ${-remove * 90}px) rotate(${remove * 18}deg)`,
        }}
      >
        ③ 在位
      </div>
      {/* 左轨：迷你登记表（计划审批行·已批准——公平基线；翻案帧绿翻红） */}
      <div style={{position: 'absolute', left: L.tableX, top: 300, opacity: rise}}>
        <RegistryTable
          x={0}
          y={0}
          w={470}
          micro
          rows={[{key: 'plan', badge: undefined, type: '计划审批', to: '主代理', state: flip > 0.5 ? 'rejected' : 'approved', stateP: 1, hotP: flipFlash}]}
        />
      </div>
      {/* 左轨：第二投「同意」长驱入账（有入账轨迹）+ 反话「不同意」副本 */}
      <div
        style={{
          position: 'absolute',
          left: L.cx + 640 - second * 400,
          top: L.railY,
          padding: '7px 18px',
          borderRadius: 9,
          border: `2.5px solid ${withAlpha(theme.danger, 0.85)}`,
          background: withAlpha(theme.panel, 0.98),
          fontFamily: theme.sans,
          fontSize: 18,
          fontWeight: 700,
          color: theme.text,
          whiteSpace: 'nowrap',
          opacity: second > 0.02 && second < 1 ? 1 : second >= 1 ? 0.25 : 0,
        }}
      >
        同意 · 第二遍
      </div>
      <div
        style={{
          position: 'absolute',
          left: L.cx + 640 - against * 380,
          top: L.railY + 66,
          padding: '7px 18px',
          borderRadius: 9,
          border: `2.5px solid ${theme.danger}`,
          background: withAlpha(theme.danger, 0.12),
          fontFamily: theme.sans,
          fontSize: 18,
          fontWeight: 700,
          color: theme.text,
          whiteSpace: 'nowrap',
          opacity: against > 0.02 ? 1 - against * 0.7 : 0,
        }}
      >
        不同意 · 反话副本
      </div>
      {/* 右轨：闸片行（③绿边在位）+ 迷你表（已批准——公平基线） */}
      <MiniGates x={R.cx} y={216} litNo={baseG > 0.4 ? 2 : -1} onP={rise} />
      <div style={{position: 'absolute', left: R.tableX, top: 300, opacity: rise}}>
        <RegistryTable x={0} y={0} w={470} micro rows={[{key: 'plan', badge: undefined, type: '计划审批', to: '主代理', state: 'approved'}]} />
      </div>
      {/* 右轨：第二遍投递 → 撞栏③弹开（already approved → ignored） */}
      <div
        style={{
          position: 'absolute',
          left: R.cx + 640 - secondR * 340,
          top: R.railY,
          padding: '7px 18px',
          borderRadius: 9,
          border: `2.5px solid ${withAlpha(theme.dim, 0.85)}`,
          background: withAlpha(theme.panel, 0.98),
          fontFamily: theme.sans,
          fontSize: 18,
          fontWeight: 700,
          color: theme.text,
          whiteSpace: 'nowrap',
          opacity: secondR > 0.02 ? (bounceR >= 1 ? 0 : 1) : 0,
          transform: `translate(${bounceR * 150}px, ${-Math.sin(Math.PI * bounceR) * 70}px) rotate(${bounceR * 14}deg)`,
        }}
      >
        同意 · 第二遍
      </div>
      {bounceR > 0.3 ? (
        <div
          style={{
            position: 'absolute',
            left: R.cx + 140 + bounceR * 150,
            top: R.railY - 48,
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.ok,
            whiteSpace: 'nowrap',
            opacity: clamp01(bounceR * 1.6),
          }}
        >
          {`ignored · duplicate`}
        </div>
      ) : null}
      {/* 双改写计数器（左 1→2→3 ↔ 右停 1——轨立起即常驻可见，计数跳变离散直取；
          freeze 定格拍加对照读出签） */}
      <RewriteCounter x={L.cx + 560} y={520} value={leftVal} litP={rise} label="状态改写次数" />
      <RewriteCounter x={R.cx + 560} y={520} value={1} litP={rise} label="状态改写次数 · 停 1" />
      {/* 双计数定格对照（1 ↔ 3——基线锚定读出签；居双轨中缝、计数器上方） */}
      {freeze > 0.5 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 458,
            display: 'flex',
            justifyContent: 'center',
            fontFamily: theme.mono,
            fontSize: 26,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: clamp01((freeze - 0.5) * 2),
          }}
        >
          {`改写计数 3 ↔ 停 1`}
        </div>
      ) : null}
      {/* 翻案帧辉光（绿转红——重音镜可读性） */}
      {flipFlash > 0.03 ? (
        <div
          style={{
            position: 'absolute',
            left: L.tableX - 8,
            top: 292,
            width: 486,
            height: 60,
            borderRadius: 8,
            boxShadow: `0 0 ${40 * flipFlash}px ${withAlpha(theme.danger, 0.6 * flipFlash)}`,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'实测：同意投两遍 → 反话翻案 · 计数 3 ↔ 停 1'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-D 底线裁决 + 暗窗钩：三栏同框全亮 + 只决议一次 + 收件箱剪影 ─────────────

const ROWS_3D = [
  {x: 240, y: 260},
  {x: 750, y: 260},
  {x: 1260, y: 260},
] as const;
const DARK_3D = {x: 710, y: 636, w: 500, h: 210} as const;

const ThreeD: React.FC<{atRule: number; atFlash: number; atDark: number}> = ({atRule, atFlash, atDark}) => {
  const frame = useCurrentFrame();
  // 三栏回位同框（①②③ 三闸全亮）
  const back = clamp01(progress(frame, 4, 16));
  // 底线签压顶定格（「只决议一次」——重音镜）
  const rule = clamp01(progress(frame, atRule, DUR.f5));
  // 栏③双闪两下（「第三道兜着」——兜底具象，唯一强调动效）
  const fl = clamp01(progress(frame, atFlash, 36));
  const flash = fl > 0 ? (Math.sin(Math.PI * 4 * fl) > 0 ? 1 : 0.25) * Math.min(1, fl * 4) * (1 - Math.max(0, fl - 0.9) * 10) : 0;
  // 暗窗拉开（「谁来读那条回复」——P4 接棒位）
  const dark = clamp01(progress(frame, atDark, 18));
  // 回复信悬停箱口微微晃动（更隐蔽的坑预告）
  const sway = Math.sin(frame / 11) * 7;
  return (
    <AbsoluteFill>
      {/* 三栏卡回位同框（横排 mini——三闸全亮） */}
      {ROWS_3D.map((r, i) => (
        <div
          key={`rd${i}`}
          style={{
            position: 'absolute',
            left: r.x,
            top: r.y,
            width: 420,
            height: 230,
            borderRadius: 14,
            border: `3px solid ${withAlpha(i === 2 && flash > 0.3 ? theme.ok : theme.dim, 0.8)}`,
            background: withAlpha(theme.panel, 0.96),
            opacity: back,
            transform: `translateY(${(1 - back) * 20}px)`,
            boxShadow: i === 2 && flash > 0.3 ? `0 0 ${22 * flash}px ${withAlpha(theme.ok, 0.55)}` : 'none',
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '18px 24px 0'}}>
            <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text}}>{['① 编号', '② 类型', '③ 状态'][i]}</span>
            <span style={{fontFamily: theme.serif, fontSize: 20, fontWeight: 700, color: theme.dim}}>{['号', '类型', '状态'][i]}</span>
          </div>
          <div style={{margin: '22px 24px 0', height: 52, borderRadius: 9, border: `2.5px solid ${withAlpha(theme.ok, 0.85)}`, background: withAlpha(theme.ok, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.mono, fontSize: 17, color: theme.ok}}>
            闸 · 在位
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, padding: '14px 24px 0', whiteSpace: 'nowrap'}}>
            {['拦住认错单', '拦住错配回复', '拦住重复生效'][i]}
          </div>
        </div>
      ))}
      {/* 底线签（衬线体 ≤6 字——压顶定格） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 540,
          display: 'flex',
          justifyContent: 'center',
          opacity: rule,
          transform: `translateY(${(1 - rule) * -16}px)`,
        }}
      >
        <div
          style={{
            padding: '16px 46px',
            borderRadius: 13,
            border: `3.5px solid ${withAlpha(theme.text, 0.9)}`,
            background: withAlpha(theme.panel, 0.98),
            fontFamily: theme.serif,
            fontSize: 36,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            boxShadow: `0 0 ${26 * rule}px ${withAlpha(theme.text, 0.35 * rule)}`,
          }}
        >
          只决议一次
        </div>
      </div>
      {/* 暗窗（镜尾拉开——收件箱剪影 + 一条回复信悬在箱口；不显 P4 机制细节） */}
      <div
        style={{
          position: 'absolute',
          left: DARK_3D.x,
          top: DARK_3D.y,
          width: DARK_3D.w,
          height: DARK_3D.h,
          borderRadius: 14,
          border: `3px solid ${withAlpha(theme.panelBorder, 0.95)}`,
          background: withAlpha(theme.bg, 0.92),
          opacity: dark,
          transform: `translateY(${(1 - dark) * 26}px)`,
        }}
      >
        {/* 收件箱剪影（暗色轮廓——承 ep15 信箱形） */}
        <div
          style={{
            position: 'absolute',
            left: 90,
            top: 66,
            width: 320,
            height: 108,
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.dim, 0.55)}`,
            background: 'transparent',
          }}
        />
        <div style={{position: 'absolute', left: 110, top: 78, fontFamily: theme.mono, fontSize: 15, color: withAlpha(theme.dim, 0.8), whiteSpace: 'nowrap'}}>
          收件箱 · 剪影
        </div>
        {/* 悬停箱口的回复信（微微晃动——谁读到它？） */}
        <div
          style={{
            position: 'absolute',
            left: 236 + sway,
            top: 20,
            width: 84,
            height: 54,
            borderRadius: 7,
            border: `2.5px solid ${withAlpha(theme.dim, 0.9)}`,
            background: withAlpha(theme.panel, 0.95),
            transform: `rotate(${sway / 14}deg)`,
          }}
        >
          <svg width={84} height={54} viewBox="0 0 84 54">
            <path d="M6 10 L42 30 L78 10" fill="none" stroke={withAlpha(theme.dim, 0.9)} strokeWidth={2.5} />
          </svg>
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center', fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>
          谁来读那条回复？
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'一个请求，只决议一次 · 第三道兜着'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P3ThreeChecks: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p3-01', 'p3-04');
  const bB = w('p3-05', 'p3-07');
  const bC = w('p3-08', 'p3-09');
  const bD = w('p3-10', 'p3-11');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <ThreeA
          atGates={wa('p3-01', 0.2) - bA.from}
          atShards={wa('p3-01', 0.35) - bA.from}
          atDemos={[wa('p3-02', 0.25), wa('p3-03', 0.25), wa('p3-04', 0.25)].map((v) => v - bA.from)}
          atHeavy={wa('p3-04', 0.8) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="3-B">
        <ThreeB
          atRemove={wa('p3-05', 0.36) - bB.from}
          atKeepId={wa('p3-05', 0.52) - bB.from}
          atBase={wa('p3-05', 0.3) - bB.from}
          atInbound={wa('p3-06', 0.14) - bB.from}
          atBounceR={wa('p3-06', 0.3) - bB.from}
          atThru={wa('p3-06', 0.35) - bB.from}
          atBadgeHit={wa('p3-06', 0.45) - bB.from}
          atHard={wa('p3-06', 0.68) - bB.from}
          atLesson={wa('p3-07', 0.35) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="3-C">
        <ThreeC
          atRemove={wa('p3-08', 0.15) - bC.from}
          atBase={wa('p3-08', 0.25) - bC.from}
          atSecond={wa('p3-08', 0.68) - bC.from}
          atCount2={wa('p3-09', 0.1) - bC.from}
          atAgainst={wa('p3-09', 0.3) - bC.from}
          atFlip={wa('p3-09', 0.72) - bC.from}
          atCount3={wa('p3-09', 0.78) - bC.from}
          atBounceR={wa('p3-09', 0.42) - bC.from}
          atFreeze={wa('p3-09', 0.85) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="3-D">
        <ThreeD atRule={wa('p3-10', 0.28) - bD.from} atFlash={wa('p3-10', 0.62) - bD.from} atDark={wa('p3-11', 0.5) - bD.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3ThreeChecks;
