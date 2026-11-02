/** P1 一人一只信箱（p1-01..p1-08，4 镜）——分镜 1-A / 1-B / 1-C / 1-D。
 *
 *  叙事链：1-A 直觉帧全景（承 0-C 虚线预演 morph 而来——四体围一列拓扑 +
 *  中央列屏位逐帧不变，SceneFade 隔断下同构实线入场）：四枚代理节点围一条
 *  中央共享消息列（四枚含主代理：橙环缩悬列顶一角=主角位标识；余位三枚灰
 *  节点=队友预告，拆解后退役）→ p1-01「共用同一段对话记录」词落位中央列实线
 *  化、四条视线连线依次接通〔M-005〕→ p1-02「吐出一串中间结果」词落位建库
 *  节点吐出长条结果串、「灌进」词落位结果串以红色渗染同时漫进四个气泡（写
 *  接口侧冲花最重）→ 1-B 拆解帧：开帧左右同题并列一拍（左=共用列残影红渗染
 *  萎缩退暗 / 右=新拓扑等高起位）→ @pushIn（p1-03「递信」）急推右半：共用列
 *  断口闪断、四段独立对话自断口生长；p1-04 四只信箱先后落定（四只之内含主
 *  代理箱，驻主环侧以位置标识点亮）、「磁盘上的普通文件」词落位信箱特写亮出
 *  （.jsonl 角标 + 旁挂「直观 · 可检查」小签——文件选型 rationale 位）→ p1-05
 *  「追加一行」词落位一行消息自写信端逐字落格（发信=追加一行，承袭语义①）
 *  → 1-C 信箱双动作后半：p1-06「整摞信一次取走」词落位整摞条目打包飞向读信
 *  端、「文件就删」词落位一拍清空（收信=整摞取走，承袭语义②）→ p1-07「恰好
 *  被处理一次」词落位三短语签列定、「恰好一次」签压一拍（重音镜，P1 记忆点）
 *  → 1-D 拉回编队位：四段对话+四只信箱微缩定格全景，主代理信箱旁两枚空白
 *  坐席签（对应 2-A 两侧坐席与走查双人位）——p1-08「就差会用它的人」词落位
 *  坐席签轻晃两下（悬念钩）、信箱群整体呼吸一次。
 *
 *  空间契约：1-A 四节点围列拓扑与 0-C 预演同构、渗染自建库侧单向漫出、主环
 *    缩悬不抢焦；1-B 左残影只萎缩不消失、信箱四只等大同款、追加逐字可见、
 *    左残影不高于右半（X-001 等高起位）；1-C 清空整摞一次性、三短语签压缩
 *    重组；1-D 坐席签空白两枚、无新机制元素。
 *  红线落实：信箱禁长出收件人形（拟人）、追加禁一次成摞、取走后箱内禁残留、
 *    渗染禁反向、四节点目标卡只冲花不全灭；词落位 = wa(id,f)；y≥56 /
 *    bottom≥176；MessageBus / .jsonl / read_inbox 只进角标。
 *
 *  承接登记：1-D→2-A cut+位置呼应（判新增主体不 morph）：1-D 末帧两枚空坐席
 *    签位 = 2-A 两侧品红环体亮起位。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LoopRing, MailboxFile, useRingDot} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 1-A 直觉帧：四节点（含主代理）围中央共享列 → 连线接通 → 渗染崩坏 ───────

/** 四节点象限位（= 0-C HUDDLE_0C 围拢位——morph 屏位不变；左上=主代理橙环位） */
const NODES_1A = [
  {x: 872, y: 306, kind: 'lead', goal: '认证'},
  {x: 1308, y: 316, kind: 'mate', goal: '数据库'},
  {x: 872, y: 652, kind: 'mate', goal: '测试'},
  {x: 1308, y: 652, kind: 'mate', goal: '接口'},
] as const;
/** 中央共享消息列位（= 0-C COL_0C 虚列位——实线化 morph） */
const COL_1A = {x: 1086, y: 430, w: 96, h: 344} as const;
/** 建库节点（右上，goal=数据库——p1-02 吐结果串侧） */
const BUILDER = 1;
/** 写接口节点（右下，goal=接口——口播点名的灌进侧，冲花最重） */
const WRITER = 3;

const OneA: React.FC<{atSolid: number; atLink: number[]; atSpit: number; atSoak: number}> = ({atSolid, atLink, atSpit, atSoak}) => {
  const frame = useCurrentFrame();
  // 主代理橙环缩悬（列顶一角——主角位标识 + 常态节律）
  const dot = useRingDot(2.5);
  // 中央列实线化（虚线描边变实——morph 中间态）
  const solid = clamp01(progress(frame, atSolid, 20));
  // 四条视线连线依次接通（谁都看得见全部）
  const links = atLink.map((a) => clamp01(progress(frame, a, 14)));
  // 建库节点吐出长条结果串（横串自节点伸向列）
  const spit = clamp01(progress(frame, atSpit, 26));
  // 结果串红色渗染同时漫进四个气泡（写接口侧最重——各节点气泡红罩加深）
  const soak = clamp01(progress(frame, atSoak, 34));
  const colCx = COL_1A.x + COL_1A.w / 2;
  const colCy = COL_1A.y + COL_1A.h / 2;
  return (
    <AbsoluteFill>
      {/* 中央共享消息列（实线化——承 0-C 虚列位；行条四格=谁都看得见全部） */}
      <div
        style={{
          position: 'absolute',
          left: COL_1A.x,
          top: COL_1A.y,
          width: COL_1A.w,
          height: COL_1A.h,
          borderRadius: 12,
          border: `3px ${solid > 0.5 ? 'solid' : 'dashed'} ${withAlpha(solid > 0.5 ? theme.dim : theme.panelBorder, 0.9)}`,
          background: withAlpha(theme.panel, 0.95),
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-evenly',
          padding: '14px 0',
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <span key={`cc${i}`} style={{height: 18, margin: '0 12px', borderRadius: 4, background: withAlpha(theme.dim, 0.4)}} />
        ))}
      </div>
      {/* 四节点（左上=主代理橙环缩悬；余位三枚灰节点卡=队友预告）+ 目标小卡 + 气泡 */}
      {NODES_1A.map((n, i) => {
        const cx = n.x + (n.kind === 'lead' ? 85 : 75);
        const cy = n.y + (n.kind === 'lead' ? 85 : 55);
        // 渗染深度：写接口侧最重、主代理侧最轻（口播点名的灌进侧）
        const soakDepth = i === WRITER ? soak : i === BUILDER ? soak * 0.7 : soak * 0.45;
        // 视线连线终点（列中心）
        return (
          <React.Fragment key={`nd${i}`}>
            {/* 视线连线（依次接通——节点中心 → 列中心，虚线承载） */}
            {links[i] > 0.02 ? (
              <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
                <line
                  x1={cx}
                  y1={cy}
                  x2={cx + (colCx - cx) * links[i]}
                  y2={cy + (colCy - cy) * links[i]}
                  stroke={withAlpha(soakDepth > 0.3 ? theme.danger : theme.dim, 0.6 + 0.3 * soakDepth)}
                  strokeWidth={3}
                  strokeDasharray="10 8"
                />
              </svg>
            ) : null}
            {n.kind === 'lead' ? (
              // 主代理节点 = 橙环缩悬（LoopRing mini——主角位标识，坐标锚）
              <div style={{position: 'absolute', left: n.x, top: n.y}}>
                <LoopRing size={170} nodes={[]} showExit={false} dotProgress={dot} />
                <div style={{position: 'absolute', left: 34, top: 176, fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.core, whiteSpace: 'nowrap'}}>
                  主代理
                </div>
              </div>
            ) : (
              // 队友预告节点（灰节点卡——直觉组法余位，拆解后退役）
              <div
                style={{
                  position: 'absolute',
                  left: n.x,
                  top: n.y,
                  width: 150,
                  height: 110,
                  borderRadius: 12,
                  border: `2.5px solid ${withAlpha(theme.panelBorder, 0.95)}`,
                  background: withAlpha(theme.panel, 0.92),
                }}
              >
                {/* 气泡（推理位——渗染漫进处） */}
                <span
                  style={{
                    position: 'absolute',
                    left: 12,
                    right: 12,
                    top: 12,
                    height: 44,
                    borderRadius: 8,
                    background: withAlpha(soakDepth > 0.05 ? theme.danger : theme.dim, soakDepth > 0.05 ? 0.14 + 0.3 * soakDepth : 0.16),
                    border: `2px solid ${withAlpha(soakDepth > 0.2 ? theme.danger : theme.panelBorder, 0.5 + 0.5 * soakDepth)}`,
                  }}
                />
                <span style={{position: 'absolute', left: 12, bottom: 8, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>
                  {'推理中…'}
                </span>
              </div>
            )}
            {/* 目标小卡（各节点旁一枚——只冲花不全灭：红蒙层罩过仍可读） */}
            <div
              style={{
                position: 'absolute',
                left: n.x + (i % 2 === 0 ? -150 : n.kind === 'lead' ? 188 : 162),
                top: n.y + (i < 2 ? 6 : 62),
                padding: '5px 14px',
                borderRadius: 8,
                border: `2.5px solid ${withAlpha(theme.core, 0.85)}`,
                background: soakDepth > 0.15 ? withAlpha(theme.danger, 0.18) : withAlpha(theme.panel, 0.97),
                fontFamily: theme.sans,
                fontSize: 18,
                fontWeight: 700,
                color: theme.text,
                whiteSpace: 'nowrap',
              }}
            >
              {n.goal}
            </div>
          </React.Fragment>
        );
      })}
      {/* 建库节点吐出的长条结果串（横串伸向列——中间结果的体量感） */}
      {spit > 0.02 ? (
        <div style={{position: 'absolute', left: NODES_1A[BUILDER].x - 214, top: NODES_1A[BUILDER].y + 46, opacity: Math.min(1, spit * 1.4) * (1 - 0.25 * soak)}}>
          {[0, 1, 2].map((k) => (
            <div
              key={`sp${k}`}
              style={{
                height: 16,
                width: 214,
                marginBottom: 8,
                borderRadius: 5,
                background: withAlpha(soak > 0.1 ? theme.danger : theme.dim, 0.55),
                transformOrigin: '100% 50%',
                transform: `scaleX(${clamp01(progress(frame, atSpit + k * 6, 12))})`,
              }}
            />
          ))}
        </div>
      ) : null}
      {/* 主代理侧气泡（橙环内小消息泡——也被渗染漫到，最轻一档） */}
      <div style={{position: 'absolute', left: NODES_1A[0].x + 20, top: NODES_1A[0].y + 120, width: 130, height: 44, borderRadius: 8, background: withAlpha(soak > 0.1 ? theme.danger : theme.dim, 0.12 + 0.2 * soak), border: `2px solid ${withAlpha(theme.panelBorder, 0.8)}`}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'共用一段对话 · 谁都看得见全部'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-B 拆解帧：左右同题并列 → pushIn 右半 → 四段独立对话 + 四信箱 + 特写首亮 ──

/** 特写信箱位（1-B 首亮 → 1-C 双动作同台延续——本集主装置首亮舞台） */
const FEATURE = {x: 750, y: 280, w: 420, h: 330} as const;
/** 读信端小环位（1-C——读信=整摞取走的取走方） */
const READER = {x: 200, y: 330, size: 180} as const;
/** 右半四段独立对话（段位 x）与四只信箱 mini 位 */
const SEG_X = [1000, 1210, 1420, 1630];
const MAIL_Y = 636;

const OneB: React.FC<{atBreak: number; atSeg: number; atMail: number[]; atLead: number; atReveal: number; atAppend: number}> = ({atBreak, atSeg, atMail, atLead, atReveal, atAppend}) => {
  const frame = useCurrentFrame();
  // pushIn 压向右半（transformOrigin 右半中心——p1-03「递信」起）
  const push = usePushIn(atBreak, {scale: 0.07, dur: DUR.f6});
  // 左残影萎缩退暗（只萎缩不消失——对照记忆）
  const shrink = clamp01(progress(frame, atBreak, 40));
  // 四段独立对话自断口生长（右半——自上而下逐段）
  const segs = clamp01(progress(frame, atSeg, 26));
  // 追加一行逐字落格（p1-05——写信端逐字，非一次成行）
  const append = clamp01(progress(frame, atAppend, 44));
  // 特写亮出（p1-04 后半——.jsonl 角标 + rationale 小签随行）
  const reveal = clamp01(progress(frame, atReveal, DUR.f5));
  const dot = useRingDot(2.5);
  return (
    <AbsoluteFill style={{transform: push, transformOrigin: '68% 46%'}}>
      {/* ── 左半：共用列残影（红渗染定格、萎缩退暗——等高起位左翼） ── */}
      <div style={{position: 'absolute', left: 300, top: 250, width: 200, height: 420, opacity: (1 - 0.6 * shrink) * 0.95, transform: `scale(${1 - 0.22 * shrink})`, transformOrigin: '50% 40%'}}>
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 14,
            border: `3px solid ${withAlpha(theme.danger, 0.75)}`,
            background: withAlpha(theme.panel, 0.92),
            padding: '18px 16px',
            opacity: 1 - 0.35 * shrink,
          }}
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={`rz${i}`} style={{height: 22, marginTop: 12, borderRadius: 5, background: withAlpha(theme.danger, 0.3 - 0.18 * shrink), border: `2px solid ${withAlpha(theme.danger, 0.5)}`}} />
          ))}
        </div>
        <div style={{position: 'absolute', left: 8, top: -44, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: withAlpha(theme.danger, 0.9), whiteSpace: 'nowrap'}}>
          共用列 · 渗染崩坏
        </div>
      </div>
      {/* ── 右半：新拓扑生长位（等高起位右翼）——四段独立对话 + 主环 mini ── */}
      {/* 主代理橙环 mini（右半之首——主代理箱驻主环侧） */}
      <div style={{position: 'absolute', left: SEG_X[0], top: 190, opacity: clamp01(progress(frame, atSeg, 10))}}>
        <LoopRing size={150} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {SEG_X.map((sx, i) => {
        // 四段独立对话（自断口生长——每段一条短竖列，段间空白=不共享）
        const grow = clamp01(progress(frame, atSeg + i * 5, 16));
        // 四只信箱 mini 先后落定（每代理一只；第一只=主代理箱驻主环侧）
        const mail = clamp01(progress(frame, atMail[i], 16));
        const leadBox = i === 0;
        const leadLit = leadBox ? clamp01(progress(frame, atLead, DUR.f4)) : 0;
        return (
          <React.Fragment key={`seg${i}`}>
            <div
              style={{
                position: 'absolute',
                left: sx,
                top: 356,
                width: 128,
                height: 200,
                borderRadius: 10,
                border: `2.5px dashed ${withAlpha(theme.dim, 0.7)}`,
                background: withAlpha(theme.panel, 0.9),
                opacity: grow,
                transform: `scaleY(${0.4 + 0.6 * grow})`,
                transformOrigin: '50% 0%',
                padding: '12px 10px',
              }}
            >
              {[0, 1, 2].map((k) => (
                <span key={`sl${k}`} style={{display: 'block', height: 16, marginTop: 10, borderRadius: 4, background: withAlpha(theme.dim, 0.35)}} />
              ))}
            </div>
            {/* 信箱 mini（MailboxFile 缩微——同形不重绘；主代理箱位置标识点亮） */}
            <div style={{position: 'absolute', left: sx - 8, top: MAIL_Y, opacity: mail}}>
              <MailboxFile
                x={0}
                y={0}
                w={144}
                h={126}
                name={leadBox ? 'lead.jsonl' : `mate-${i}.jsonl`}
                litP={1}
                glowP={leadBox ? leadLit : 0}
              />
              {leadBox ? (
                <div
                  style={{
                    position: 'absolute',
                    left: 6,
                    top: -34,
                    fontFamily: theme.sans,
                    fontSize: 17,
                    fontWeight: 700,
                    color: leadLit > 0.3 ? theme.core : theme.dim,
                    whiteSpace: 'nowrap',
                    opacity: 0.4 + 0.6 * leadLit,
                  }}
                >
                  主代理也有
                </div>
              ) : null}
            </div>
          </React.Fragment>
        );
      })}
      {/* ── 特写信箱首亮（本集主装置——盖层呈现，背景组压暗一档） ── */}
      {reveal > 0.02 ? (
        <>
          <AbsoluteFill style={{background: withAlpha(theme.bg, 0.55 * reveal), pointerEvents: 'none'}} />
          <div style={{position: 'absolute', left: FEATURE.x, top: FEATURE.y, opacity: reveal, transform: `translateY(${(1 - reveal) * 22}px)`}}>
            <MailboxFile x={0} y={0} w={FEATURE.w} h={FEATURE.h} name="lead.jsonl" litP={1} rows={0} appendP={append} />
            {/* 文件选型 rationale 小签（挂 .jsonl 角标旁——文件选型理由） */}
            <div
              style={{
                position: 'absolute',
                left: 28,
                top: -42,
                padding: '5px 14px',
                borderRadius: 8,
                border: `2px solid ${withAlpha(theme.inbox, 0.6)}`,
                background: withAlpha(theme.panel, 0.97),
                fontFamily: theme.mono,
                fontSize: 16,
                color: theme.dim,
                whiteSpace: 'nowrap',
                opacity: clamp01(progress(frame, atReveal + 10, DUR.f4)),
              }}
            >
              直观 · 可检查
            </div>
            {/* 写信端（追加一行=发信——逐字落格的写字侧小光标） */}
            <div
              style={{
                position: 'absolute',
                left: -96,
                top: 96,
                fontFamily: theme.mono,
                fontSize: 17,
                color: theme.inbox,
                whiteSpace: 'nowrap',
                opacity: append > 0.02 ? 1 : 0.35,
              }}
            >
              写信端 →
            </div>
          </div>
        </>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'MessageBus · .mailboxes/{name}.jsonl'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-C 信箱双动作后半：整摞取走 → 一拍清空 → 三短语签（P1 记忆点） ──────────

/** 三短语压缩签（追加＝发信 / 取走＝收信 / 取空＝恰好一次——压缩重组形态） */
const SIGNS_1C = ['追加一行＝发信', '整摞取走＝收信', '取走即空＝恰好一次'];

const OneC: React.FC<{atTake: number; atWipe: number; atSign: number}> = ({atTake, atWipe, atSign}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  // 整摞条目打包飞向读信端（takeP 前半：条目堆升起离箱 → 场景侧抛物线飞向左环）
  const take = clamp01(progress(frame, atTake, 30));
  // 信箱一拍清空（wipe：行区整幅闪空——整摞一次性，非逐条）
  const wipe = clamp01(progress(frame, atWipe, 12));
  // 三短语签列定 + 「恰好一次」签压一拍（重音镜）
  const sign = clamp01(progress(frame, atSign, 20));
  const punch = Math.sin(Math.PI * clamp01(progress(frame, atSign + 12, 26)));
  // 飞行条目（箱 → 读信端——三段避让：先爬升（前 30%）后平移（中 40%）再降落（后 30%））
  const fly = clamp01(progress(frame, atTake + 10, 26));
  const startX = FEATURE.x + 60;
  const endX = READER.x + 90;
  const fx = startX + (endX - startX) * fly;
  const startY = FEATURE.y + 130;
  const peakY = startY - 120;
  const endY = READER.y + 60;
  const fy = fly < 0.3 ? startY + (peakY - startY) * (fly / 0.3) : fly < 0.7 ? peakY : peakY + (endY - peakY) * ((fly - 0.7) / 0.3);
  return (
    <AbsoluteFill>
      {/* 读信端小环（读信=整摞取走的取走方——收信侧） */}
      <div style={{position: 'absolute', left: READER.x, top: READER.y}}>
        <LoopRing size={READER.size} nodes={[]} showExit={false} dotProgress={dot} />
        <div style={{position: 'absolute', left: 18, top: 188, fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>读信端</div>
      </div>
      {/* 特写信箱（承 1-B 位——rows=2 整摞在箱 → takeP 打包飞出 → wipe 清空） */}
      <div style={{position: 'absolute', left: FEATURE.x, top: FEATURE.y}}>
        <MailboxFile x={0} y={0} w={FEATURE.w} h={FEATURE.h} name="lead.jsonl" litP={1} rows={wipe > 0.4 ? 0 : 2} takeP={take} count={wipe > 0.4 ? 0 : -1} />
        {/* 一拍清空闪条（wipe——文件归零的「删」拍） */}
        {wipe > 0.05 && wipe < 0.95 ? (
          <div style={{position: 'absolute', inset: 0, borderRadius: 14, border: `3px solid ${withAlpha(theme.inbox, 0.9 * (1 - wipe))}`, background: withAlpha(theme.inbox, 0.12 * (1 - wipe)), pointerEvents: 'none'}} />
        ) : null}
      </div>
      {/* 飞行中的整摞（条目堆打包——沿三段避让轨迹飞向读信端） */}
      {take > 0.2 && take < 0.98 ? (
        <div style={{position: 'absolute', left: fx, top: fy, opacity: 1 - Math.max(0, fly - 0.75) * 4}}>
          {[0, 1].map((k) => (
            <div key={`fly${k}`} style={{width: 190, height: 20, marginTop: 8, borderRadius: 5, background: withAlpha(theme.inbox, 0.45), border: `2px solid ${withAlpha(theme.inbox, 0.85)}`}} />
          ))}
        </div>
      ) : null}
      {/* 三短语压缩签（列定——底部横排，字幕带上方） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 748, display: 'flex', justifyContent: 'center', gap: 36}}>
        {SIGNS_1C.map((s, i) => {
          const o = clamp01(progress(frame, atSign + i * 6, 14));
          const hot = i === 2;
          return (
            <div
              key={`sg${i}`}
              style={{
                padding: '12px 26px',
                borderRadius: 11,
                border: `3px solid ${hot ? withAlpha(theme.inbox, 0.95) : withAlpha(theme.dim, 0.65)}`,
                background: withAlpha(theme.panel, 0.97),
                fontFamily: theme.sans,
                fontSize: 23,
                fontWeight: 700,
                color: theme.text,
                whiteSpace: 'nowrap',
                opacity: o,
                transform: `translateY(${(1 - o) * 16}px) scale(${hot ? 1 + 0.07 * punch : 1})`,
                boxShadow: hot && punch > 0.05 ? `0 0 ${22 * punch}px ${withAlpha(theme.inbox, 0.55)}` : 'none',
              }}
            >
              {s}
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'read_inbox · 消费式收信'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-D 编队位全景：四组微缩 + 两枚空白坐席签（悬念钩） ─────────────────────

/** 四组微缩位（组=段列+信箱；主代理组居首——橙环 mini 领衔） */
const GROUPS_1D = [
  {x: 250, lead: true},
  {x: 700, lead: false},
  {x: 1150, lead: false},
  {x: 1600, lead: false},
] as const;
/** 两枚空白坐席签位（主代理组两侧——对应 2-A 两侧坐席与走查双人位） */
const SEATS_1D = [
  {x: 620, y: 470},
  {x: 1350, y: 470},
] as const;

const OneD: React.FC<{atWobble: number; atBreath: number}> = ({atWobble, atBreath}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  // 两枚空坐席签轻晃两下（悬念钩——就差会用它的人：两个正弦周期后衰减归零）
  const wobbleT = clamp01(progress(frame, atWobble, 44));
  const wobble = wobbleT > 0 ? Math.sin(wobbleT * Math.PI * 4) * 6 * (1 - wobbleT) : 0;
  // 信箱群整体呼吸一次（useImpulse——微脉冲收势）
  const breath = useImpulse({at: atBreath, dur: 30, peak: 1});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${1 + 0.015 * breath})`, transformOrigin: '50% 55%'}}>
        {GROUPS_1D.map((g, i) => (
          <React.Fragment key={`gp${i}`}>
            {/* 微缩环（主代理组=橙环 mini；队友组=灰环轮廓） */}
            <div style={{position: 'absolute', left: g.x, top: 300, opacity: 0.95}}>
              {g.lead ? (
                <LoopRing size={130} nodes={[]} showExit={false} dotProgress={dot} />
              ) : (
                <svg width={130} height={130} viewBox="0 0 130 130">
                  <circle cx={65} cy={65} r={50} fill="none" stroke={withAlpha(theme.panelBorder, 0.95)} strokeWidth={5} />
                </svg>
              )}
              {/* 微缩段列（独立对话） */}
              <div
                style={{
                  position: 'absolute',
                  left: 148,
                  top: 8,
                  width: 66,
                  height: 112,
                  borderRadius: 8,
                  border: `2.5px dashed ${withAlpha(theme.dim, 0.6)}`,
                  padding: '10px 8px',
                }}
              >
                {[0, 1, 2].map((k) => (
                  <span key={`gl${k}`} style={{display: 'block', height: 12, marginTop: 8, borderRadius: 3, background: withAlpha(theme.dim, 0.35)}} />
                ))}
              </div>
              {/* 微缩信箱（同形缩微） */}
              <div style={{position: 'absolute', left: 226, top: 4}}>
                <MailboxFile x={0} y={0} w={124} h={112} name={g.lead ? 'lead.jsonl' : `mate-${i}.jsonl`} litP={1} />
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
      {/* 两枚空白坐席签（虚线剪影签——空挂；2-A 品红环亮起位伏笔） */}
      {SEATS_1D.map((s, i) => (
        <div
          key={`seat${i}`}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: 116,
            height: 126,
            borderRadius: '58px 58px 16px 16px',
            border: `3px dashed ${withAlpha(theme.mate, 0.55)}`,
            background: withAlpha(theme.panel, 0.55),
            transform: `rotate(${wobble * (i === 0 ? 1 : -1) * 0.35}deg) translateY(${Math.abs(wobble) * 0.4}px)`,
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -40,
              textAlign: 'center',
              fontFamily: theme.mono,
              fontSize: 16,
              color: withAlpha(theme.mate, 0.8),
              whiteSpace: 'nowrap',
            }}
          >
            {`坐席 · 空`}
          </span>
        </div>
      ))}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'信箱就位 · 虚位待人'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P1OneMailboxEach: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p1-01', 'p1-02');
  const bB = w('p1-03', 'p1-05');
  const bC = w('p1-06', 'p1-07');
  const bD = w('p1-08', 'p1-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <OneA
          atSolid={wa('p1-01', 0.38) - bA.from}
          atLink={[wa('p1-01', 0.62), wa('p1-01', 0.72), wa('p1-01', 0.82), wa('p1-01', 0.92)].map((v) => v - bA.from)}
          atSpit={wa('p1-02', 0.43) - bA.from}
          atSoak={wa('p1-02', 0.62) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="1-B">
        <OneB
          atBreak={wa('p1-03', 0.75) - bB.from}
          atSeg={wa('p1-03', 0.82) - bB.from}
          atMail={[wa('p1-04', 0.12), wa('p1-04', 0.22), wa('p1-04', 0.32), wa('p1-04', 0.42)].map((v) => v - bB.from)}
          atLead={wa('p1-04', 0.45) - bB.from}
          atReveal={wa('p1-04', 0.7) - bB.from}
          atAppend={wa('p1-05', 0.62) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="1-C">
        <OneC
          atTake={wa('p1-06', 0.38) - bC.from}
          atWipe={wa('p1-06', 0.85) - bC.from}
          atSign={wa('p1-07', 0.78) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="1-D">
        <OneD atWobble={wa('p1-08', 0.5) - bD.from} atBreath={wa('p1-08', 0.72) - bD.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1OneMailboxEach;
