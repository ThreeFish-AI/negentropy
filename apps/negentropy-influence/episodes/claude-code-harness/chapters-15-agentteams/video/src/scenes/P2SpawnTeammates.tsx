/** P2 拉起队友（p2-01..p2-12，5 镜）——分镜 2-A / 2-B / 2-C / 2-D / 2-E。
 *
 *  叙事链：2-A 编队全景（本集主形态首亮——多枚同款环体并列）：主代理橙环
 *  〔M-001〕居中，p2-01「调一件工具」词落位「拉队友」工具卡自环工具带抽出、
 *  向两侧坐席位先后掷出起环光弧〔M-005〕→ p2-02「并行执行流」「同时跑」词落位
 *  两枚品红同款环体自两侧坐席并行亮起（同尺寸同转速、仅描边色区别）〔M-005〕
 *  〔M-001〕→ 2-B 队友环解剖特写：p2-03「角色设定、消息历史」词落位角色卡贴上
 *  +历史角标小签 → p2-04「四件」词落位四枚工具小签 stagger 亮出 → p2-05「限了
 *  十轮」词落位十格轮次带立起（十格全暗+工况角标基线标尺）→ 2-C 对照定格：
 *  p2-06「一次性的」「一直活着的」词落位等高对照条左右栏各亮一拍 → p2-07「添了
 *  三件」词落位三卡滑入、「从十一件长到十四件」词落位计数条 11 跳格 14（重音
 *  镜，数字与口播一致）→ 2-D 走查舞台开台（Animated Worked Example）：p2-08
 *  「接了个大活」「组队」词落位任务卡自顶落下 → p2-09 两枚品红环体先后滑入双轨
 *  （名牌 alice·建数据库 / bob·写接口客户端——视觉层）→ p2-10「同时开工」词落位
 *  双轨并行点亮（命令行逐字符敲出 / 文件卡逐行写——关键词签级、双轨同速）→
 *  2-E 收信端特写：p2-11「互不打扰」词落位双轨间空白间隔带显形（无连线跨越）、
 *  「总结发回」词落位两条总结信先后沿湛蓝信流飞入主代理信箱 → p2-12「信到了
 *  门口」词落位信箱亮起一拍、待取辉光呼吸（幕尾钩——怎么看见它留给 P3）。
 *
 *  空间契约：三环等距同尺寸同转速、品红与橙描边线宽一致、光弧单向；小卡关键
 *    词化 ≤6 字；轮次带十格等宽全暗（上限未动用）；左右栏等高（分工对照不判
 *    高下）；计数条两档跳变与口播数字一致；双轨等高并行、无交叉连线；总结信
 *    携同款模块签可追；信箱承 1-B 同款同形、本镜不被取信。
 *  红线落实：队友环体转速/尺寸禁异于主环、第三枚环禁入场（编队恒三环）、命令
 *    行/文件内容禁成句、计数条禁越过 14、信箱禁被取信；词落位 = wa(id,f)；
 *    y≥56 / bottom≥176；spawn_teammate / send_message / check_inbox /
 *    range(10) 只进角标。
 *
 *  承接登记：1-D→2-A cut+位置呼应（1-D 末帧两枚空坐席签位 = 2-A 两侧品红环
 *    亮起位）；2-E→3-A morph（信箱携两信——文件形/角标/湛蓝描边/两信计数
 *    逐帧不变，仅位置与伴随元素变化）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {ContrastStrip, LoopRing, MailboxFile, RoundCapBar, STAGE, TeammateRing, ToolBeltBar, useRingDot} from '../components/motifs';
import {DUR, clamp01, progress, useReveal} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 2-A 编队全景：主环居中 + 工具卡抽卡掷弧 + 两侧品红同款环亮起 ────────────

const TOOL_2A = {x: 806, y: 646, w: 310, h: 84} as const;

const TwoA: React.FC<{atCard: number; atArcL: number; atArcR: number; atL: number; atR: number}> = ({atCard, atArcL, atArcR, atL, atR}) => {
  const frame = useCurrentFrame();
  // 三环同相位匀速转（同款节律——「没换循环、只是多了几条」）
  const dot = useRingDot(2.5);
  // 工具卡自环工具带抽出（滑出 + 角标）
  const card = clamp01(progress(frame, atCard, DUR.f5));
  // 起环光弧（单向掷出：工具卡 → 坐席位；左先右后）
  const arcL = clamp01(progress(frame, atArcL, 14));
  const arcR = clamp01(progress(frame, atArcR, 14));
  // 两枚品红同款环并行亮起（draw 描线起环——同尺寸同转速）
  const litL = clamp01(progress(frame, atL, 22));
  const litR = clamp01(progress(frame, atR, 22));
  const arc = (t: number, tx: number) => {
    const x0 = TOOL_2A.x + TOOL_2A.w / 2;
    const y0 = TOOL_2A.y;
    const mx = (x0 + tx) / 2;
    const my = 470;
    const k = 24;
    return `M ${x0} ${y0} Q ${mx} ${my} ${x0 + (tx - x0) * t} ${y0 + (STAGE.mates[0].y + 140 - y0) * t}`;
  };
  return (
    <AbsoluteFill>
      {/* 主代理橙环（居中——编队主位） */}
      <div style={{position: 'absolute', left: STAGE.ring.x, top: STAGE.ring.y}}>
        <LoopRing size={STAGE.ring.size} nodes={[]} showExit={false} dotProgress={dot} />
        <div style={{position: 'absolute', left: STAGE.ring.size / 2 - 44, top: STAGE.ring.size + 14, fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: theme.core, whiteSpace: 'nowrap'}}>
          主代理
        </div>
      </div>
      {/* 两侧坐席位（承 1-D 空坐席签位——品红环亮起位；亮起前虚线坐席框在场） */}
      {STAGE.mates.map((m, i) => {
        const lit = i === 0 ? litL : litR;
        return (
          <div key={`mt${i}`} style={{position: 'absolute', left: m.x, top: m.y}}>
            <div
              style={{
                position: 'absolute',
                left: 60,
                top: 60,
                width: m.size - 120,
                height: m.size - 120,
                borderRadius: '50%',
                border: `2.5px dashed ${withAlpha(theme.mate, 0.4 + 0.2 * lit)}`,
                opacity: 1 - 0.4 * lit,
              }}
            />
            {lit > 0.01 ? <TeammateRing size={m.size} draw={lit} dotProgress={dot} /> : null}
            <div
              style={{
                position: 'absolute',
                left: m.size / 2 - 44,
                top: m.size + 14,
                fontFamily: theme.sans,
                fontSize: 21,
                fontWeight: 700,
                color: lit > 0.5 ? theme.mate : theme.dim,
                whiteSpace: 'nowrap',
                opacity: 0.5 + 0.5 * lit,
              }}
            >
              队友 {i + 1}
            </div>
          </div>
        );
      })}
      {/* 起环光弧（单向掷出——两条先后，各自触发对侧亮起） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        {arcL > 0.02 && arcL < 0.98 ? (
          <path d={arc(arcL, STAGE.mates[0].x + STAGE.mates[0].size / 2)} fill="none" stroke={withAlpha(theme.mate, 0.85)} strokeWidth={5} strokeLinecap="round" strokeDasharray="16 12" />
        ) : null}
        {arcR > 0.02 && arcR < 0.98 ? (
          <path d={arc(arcR, STAGE.mates[1].x + STAGE.mates[1].size / 2)} fill="none" stroke={withAlpha(theme.mate, 0.85)} strokeWidth={5} strokeLinecap="round" strokeDasharray="16 12" />
        ) : null}
      </svg>
      {/* 「拉队友」工具卡（自主环工具带抽出——mono 角标） */}
      <div
        style={{
          position: 'absolute',
          left: TOOL_2A.x,
          top: TOOL_2A.y,
          width: TOOL_2A.w,
          borderRadius: 12,
          border: `3px solid ${withAlpha(theme.mate, 0.85)}`,
          background: withAlpha(theme.panel, 0.97),
          padding: '14px 22px',
          opacity: card,
          transform: `translateY(${(1 - card) * 30}px)`,
        }}
      >
        <div style={{display: 'flex', alignItems: 'baseline', gap: 14, whiteSpace: 'nowrap'}}>
          <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text}}>拉队友</span>
          <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.mate}}>{'spawn_teammate'}</span>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'并行执行流 · 同尺寸同转速 · 只换描边色'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-B 队友环解剖特写：角色卡 + 历史角标 + 四件工具签 + 十格轮次带 ──────────

const RING_2B = {x: 300, y: 150, size: 440} as const;
const CARD1_2B = {x: 900, y: 160} as const;
const CARD2_2B = {x: 900, y: 396} as const;
const TOOLS_2B = [
  {zh: '跑命令', en: 'bash'},
  {zh: '读文件', en: 'read_file'},
  {zh: '写文件', en: 'write_file'},
  {zh: '发消息', en: 'send_message'},
] as const;

const TwoB: React.FC<{atRole: number; atHist: number; atTool: number[]; atCap: number}> = ({atRole, atHist, atTool, atCap}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  const role = clamp01(progress(frame, atRole, DUR.f5));
  const hist = clamp01(progress(frame, atHist, DUR.f4));
  const cap = clamp01(progress(frame, atCap, 18));
  return (
    <AbsoluteFill>
      {/* 队友环体大特写（品红同款——解剖对象） */}
      <div style={{position: 'absolute', left: RING_2B.x, top: RING_2B.y}}>
        <TeammateRing size={RING_2B.size} dotProgress={dot} />
        <div style={{position: 'absolute', left: RING_2B.size / 2 - 44, top: RING_2B.size + 12, fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: theme.mate, whiteSpace: 'nowrap'}}>
          队友 · 环体
        </div>
        {/* 消息历史角标小签（环下随行——自带三样之一） */}
        <div
          style={{
            position: 'absolute',
            left: 96,
            top: RING_2B.size + 64,
            padding: '6px 16px',
            borderRadius: 9,
            border: `2.5px solid ${withAlpha(theme.dim, 0.7)}`,
            background: withAlpha(theme.panel, 0.97),
            fontFamily: theme.mono,
            fontSize: 16,
            color: theme.dim,
            whiteSpace: 'nowrap',
            opacity: hist,
            transform: `translateY(${(1 - hist) * 10}px)`,
          }}
        >
          {'消息历史 · 自带'}
        </div>
      </div>
      {/* 角色设定卡（关键词化 ≤6 字） */}
      <div
        style={{
          position: 'absolute',
          left: CARD1_2B.x,
          top: CARD1_2B.y,
          width: 430,
          borderRadius: 12,
          border: `3px solid ${withAlpha(theme.mate, 0.7)}`,
          background: withAlpha(theme.panel, 0.97),
          padding: '18px 24px',
          opacity: role,
          transform: `translateX(${(1 - role) * 40}px)`,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>角色设定</div>
        <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 10, whiteSpace: 'nowrap'}}>{'建数据库 · 专注一件事'}</div>
      </div>
      {/* 工具套卡（四件——一次亮齐后静置） */}
      <div
        style={{
          position: 'absolute',
          left: CARD2_2B.x,
          top: CARD2_2B.y,
          width: 430,
          borderRadius: 12,
          border: `3px solid ${withAlpha(theme.panelBorder, 0.9)}`,
          background: withAlpha(theme.panel, 0.97),
          padding: '18px 24px',
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>一小套工具 · 四件</div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14}}>
          {TOOLS_2B.map((t, i) => {
            const lit = clamp01(progress(frame, atTool[i], DUR.f4));
            return (
              <div
                key={`tool${i}`}
                style={{
                  padding: '9px 14px',
                  borderRadius: 9,
                  border: `2.5px solid ${lit > 0.4 ? withAlpha(theme.tool, 0.85) : withAlpha(theme.panelBorder, 0.9)}`,
                  background: lit > 0.4 ? withAlpha(theme.tool, 0.12) : 'transparent',
                  opacity: lit,
                  transform: `translateY(${(1 - lit) * 12}px)`,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: theme.text}}>{t.zh}</span>
                <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginLeft: 8}}>{t.en}</span>
              </div>
            );
          })}
        </div>
      </div>
      {/* 十格轮次带（基线标尺——十格全暗：上限未动用） */}
      <RoundCapBar x={560} y={790} w={800} litP={cap} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'角色 · 历史 · 四件工具 · 限十轮'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-C 对照定格：等高对照条 + 工具计数条 11→14 + 三新卡滑入 ────────────────

const NEWTOOLS_2C = [
  {zh: '拉队友', en: 'spawn_teammate'},
  {zh: '发消息', en: 'send_message'},
  {zh: '查信箱', en: 'check_inbox'},
] as const;

const TwoC: React.FC<{atLeft: number; atRight: number; atNew: number[]; atCount: number}> = ({atLeft, atRight, atNew, atCount}) => {
  const frame = useCurrentFrame();
  const left = clamp01(progress(frame, atLeft, DUR.f5));
  const right = clamp01(progress(frame, atRight, DUR.f5));
  const count = clamp01(progress(frame, atCount, DUR.f4));
  return (
    <AbsoluteFill>
      {/* 上带：等高对照条（左子代理 / 右队友——分工对照非优劣裁决） */}
      <ContrastStrip x={180} y={150} w={1560} h={300} leftP={left} rightP={right} />
      {/* 下带：主代理工具计数条（11 → 14 两档跳变） */}
      <ToolBeltBar x={180} y={590} w={1560} litP={1} countP={count} />
      {/* 三新工具卡（滑入跳格——与 2-A 已见「拉队友」卡同款） */}
      <div style={{position: 'absolute', left: 180, top: 716, display: 'flex', gap: 40}}>
        {NEWTOOLS_2C.map((t, i) => {
          const lit = clamp01(progress(frame, atNew[i], DUR.f5));
          return (
            <div
              key={`nt${i}`}
              style={{
                width: 300,
                borderRadius: 12,
                border: `3px solid ${lit > 0.4 ? withAlpha(theme.mate, 0.85) : withAlpha(theme.panelBorder, 0.9)}`,
                background: withAlpha(theme.panel, 0.97),
                padding: '13px 20px',
                opacity: lit,
                transform: `translateX(${(1 - lit) * -46}px)`,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.text}}>{t.zh}</span>
              <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginLeft: 12}}>{t.en}</span>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'一次性管互不干扰 · 一直活着管随时递话'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-D 走查舞台：任务卡落下 + 双轨并行（alice 敲命令 / bob 写文件） ─────────

const TASK_2D = {x: 560, y: 54, w: 800, h: 128} as const;
const RING_2D = {x: 850, y: 200, size: 220} as const;
const TRACK_2D = {alice: {x: 150, y: 430}, bob: {x: 1050, y: 430}, w: 720, h: 400} as const;
const ALICE_LINES = ['$ createdb team', 'CREATE TABLE users', '( id · name · email )'] as const;
const BOB_LINES = ['client.ts', 'route GET /users', 'route POST /users', 'export client'] as const;

const TwoD: React.FC<{atTask: number; atAlice: number; atBob: number; atGo: number}> = ({atTask, atAlice, atBob, atGo}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  // 任务卡自顶落下压进舞台（spring 重量感）
  const task = clamp01(progress(frame, atTask, 20));
  // 两枚品红环先后滑入双轨（名牌随行）
  const inA = clamp01(progress(frame, atAlice, 18));
  const inB = clamp01(progress(frame, atBob, 18));
  // 双轨并行点亮（同速——命令行逐字符 / 文件逐行）
  const go = clamp01(progress(frame, atGo, 16));
  const typing1 = useReveal(ALICE_LINES[0], {at: atGo + 2, cps: 14});
  const typing2 = useReveal(ALICE_LINES[1], {at: atGo + 20, cps: 12});
  const typing3 = useReveal(ALICE_LINES[2], {at: atGo + 40, cps: 10});
  const typed = [typing1, typing2, typing3];
  return (
    <AbsoluteFill>
      {/* 任务卡（自顶落下——四模块签承 0-A 同款同序） */}
      <div
        style={{
          position: 'absolute',
          left: TASK_2D.x,
          top: TASK_2D.y,
          width: TASK_2D.w,
          height: TASK_2D.h,
          borderRadius: 14,
          border: `3px solid ${withAlpha(theme.core, 0.7)}`,
          background: withAlpha(theme.panel, 0.97),
          padding: '14px 26px',
          opacity: task,
          transform: `translateY(${(1 - task) * -70}px)`,
        }}
      >
        <div style={{display: 'flex', alignItems: 'baseline', gap: 16, whiteSpace: 'nowrap'}}>
          <span style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 700, color: theme.text}}>搭后端 · 组队走查</span>
          {['认证', '数据库', '接口', '测试'].map((m, i) => (
            <span
              key={`tm${i}`}
              style={{
                padding: '3px 12px',
                borderRadius: 7,
                border: `2px solid ${i === 1 || i === 2 ? withAlpha(theme.core, 0.85) : withAlpha(theme.dim, 0.5)}`,
                fontFamily: theme.sans,
                fontSize: 18,
                fontWeight: 600,
                color: i === 1 || i === 2 ? theme.text : theme.dim,
              }}
            >
              {m}
            </span>
          ))}
        </div>
      </div>
      {/* 主环缩微（编队锚——三环编队就位的中位） */}
      <div style={{position: 'absolute', left: RING_2D.x, top: RING_2D.y, opacity: clamp01(progress(frame, atTask + 6, 14))}}>
        <LoopRing size={RING_2D.size} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {/* alice 轨：品红环 + 名牌 + 命令行窗（逐字符敲出——关键词签级） */}
      <div style={{position: 'absolute', left: TRACK_2D.alice.x, top: TRACK_2D.alice.y - 150, opacity: inA, transform: `translateX(${(1 - inA) * -80}px)`, width: TRACK_2D.w}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <TeammateRing size={130} dotProgress={dot} />
          <div style={{padding: '6px 16px', borderRadius: 9, border: `2.5px solid ${withAlpha(theme.mate, 0.8)}`, background: withAlpha(theme.panel, 0.97)}}>
            <span style={{fontFamily: theme.mono, fontSize: 20, fontWeight: 700, color: theme.mate}}>alice</span>
            <span style={{fontFamily: theme.sans, fontSize: 18, color: theme.text, marginLeft: 10, whiteSpace: 'nowrap'}}>{'· 建数据库'}</span>
          </div>
          <span style={{padding: '4px 12px', borderRadius: 7, border: `2px solid ${withAlpha(theme.core, 0.8)}`, fontFamily: theme.sans, fontSize: 16, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap'}}>建表</span>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: TRACK_2D.alice.x,
          top: TRACK_2D.alice.y,
          width: TRACK_2D.w,
          height: TRACK_2D.h,
          borderRadius: 14,
          border: `3px solid ${go > 0.3 ? withAlpha(theme.tool, 0.75) : withAlpha(theme.panelBorder, 0.9)}`,
          background: withAlpha(theme.panel, 0.96),
          padding: '18px 26px',
          opacity: inA,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, paddingBottom: 10, borderBottom: `2px solid ${withAlpha(theme.panelBorder, 0.8)}`, whiteSpace: 'nowrap'}}>{'terminal · alice'}</div>
        {ALICE_LINES.map((_, i) => (
          <div key={`al${i}`} style={{fontFamily: theme.mono, fontSize: 24, color: theme.text, marginTop: 22, whiteSpace: 'nowrap', opacity: go > 0 ? 1 : 0.25}}>
            {typed[i]}
            {i === Math.min(2, Math.floor(clamp01(progress(frame, atGo, 60)) * 3)) && go > 0 ? <span style={{color: theme.tool, opacity: 0.9}}>{'▍'}</span> : null}
          </div>
        ))}
      </div>
      {/* bob 轨：品红环 + 名牌 + 文件卡（逐行写——关键词签级） */}
      <div style={{position: 'absolute', left: TRACK_2D.bob.x, top: TRACK_2D.bob.y - 150, opacity: inB, transform: `translateX(${(1 - inB) * 80}px)`, width: TRACK_2D.w}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <TeammateRing size={130} dotProgress={dot} />
          <div style={{padding: '6px 16px', borderRadius: 9, border: `2.5px solid ${withAlpha(theme.mate, 0.8)}`, background: withAlpha(theme.panel, 0.97)}}>
            <span style={{fontFamily: theme.mono, fontSize: 20, fontWeight: 700, color: theme.mate}}>bob</span>
            <span style={{fontFamily: theme.sans, fontSize: 18, color: theme.text, marginLeft: 10, whiteSpace: 'nowrap'}}>{'· 写接口客户端'}</span>
          </div>
          <span style={{padding: '4px 12px', borderRadius: 7, border: `2px solid ${withAlpha(theme.core, 0.8)}`, fontFamily: theme.sans, fontSize: 16, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap'}}>客户端</span>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: TRACK_2D.bob.x,
          top: TRACK_2D.bob.y,
          width: TRACK_2D.w,
          height: TRACK_2D.h,
          borderRadius: 14,
          border: `3px solid ${go > 0.3 ? withAlpha(theme.tool, 0.75) : withAlpha(theme.panelBorder, 0.9)}`,
          background: withAlpha(theme.panel, 0.96),
          padding: '18px 26px',
          opacity: inB,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, paddingBottom: 10, borderBottom: `2px solid ${withAlpha(theme.panelBorder, 0.8)}`, whiteSpace: 'nowrap'}}>{'client.ts · bob'}</div>
        {BOB_LINES.map((ln, i) => {
          const lit = clamp01(progress(frame, atGo + i * 14, 12));
          return (
            <div key={`bl${i}`} style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 18, opacity: lit * (go > 0 ? 1 : 0.3) + 0.1}}>
              <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.panelBorder}}>{i + 1}</span>
              <span style={{flex: 1, height: 14, borderRadius: 4, background: withAlpha(theme.dim, 0.22), transformOrigin: '0% 50%', transform: `scaleX(${lit})`}} />
              <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.text, whiteSpace: 'nowrap', opacity: lit}}>{ln}</span>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'同时开工 · 双轨同速 · 互不交叉'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-E 收信端特写：间隔带显形 + 两条总结信先后飞入主代理信箱 ────────────────

const MAIL_2E = {x: 760, y: 240, w: 400, h: 320} as const;
const MINI_2E = {alice: {x: 190, y: 560}, bob: {x: 1400, y: 560}, w: 330, h: 210} as const;
const GAP_2E = {x: 935, y: 470, w: 50, h: 380} as const;

/** 总结信（携同款模块签——与任务卡/双轨签同源可追） */
const SummaryLetter: React.FC<{zh: string; tone: string; style?: React.CSSProperties}> = ({zh, tone, style}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 18px',
      borderRadius: 10,
      border: `2.5px solid ${tone}`,
      background: withAlpha(theme.panel, 0.98),
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    <svg width={20} height={20} viewBox="0 0 20 20">
      <path d="M2 4 h16 v12 h-16 z" fill="none" stroke={tone} strokeWidth={2} />
      <path d="M2 4 l8 6 l8 -6" fill="none" stroke={tone} strokeWidth={2} />
    </svg>
    <span style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.text}}>{zh}</span>
  </div>
);

const TwoE: React.FC<{atGap: number; atFlyA: number; atFlyB: number; atGlow: number}> = ({atGap, atFlyA, atFlyB, atGlow}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  // 双轨间空白间隔带显形（无任何连线跨越——互不打扰的实体化）
  const gap = clamp01(progress(frame, atGap, 16));
  // 两条总结信先后起飞（三段避让：先爬升后平移再降落——沿湛蓝信流入箱）
  const flyA = clamp01(progress(frame, atFlyA, 30));
  const flyB = clamp01(progress(frame, atFlyB, 30));
  // 信箱亮起一拍 + 待取辉光呼吸（幕尾钩）
  const litPulse = Math.sin(Math.PI * clamp01(progress(frame, atGlow, 22)));
  const breathe = 0.4 + 0.6 * Math.abs(Math.sin(frame / 22));
  const glow = clamp01(progress(frame, atGlow, DUR.f5));
  const letters = [
    {t: flyA, from: {x: MINI_2E.alice.x + 60, y: MINI_2E.alice.y - 40}, zh: '数据库 · 建好'},
    {t: flyB, from: {x: MINI_2E.bob.x + 60, y: MINI_2E.bob.y - 40}, zh: '客户端 · 写好'},
  ];
  const boxCx = MAIL_2E.x + MAIL_2E.w / 2;
  return (
    <AbsoluteFill>
      {/* 双轨微缩（承 2-D——收信端特写下的信源侧） */}
      {([['alice', '数据库'], ['bob', '接口']] as const).map(([who, mod], i) => {
        const g = i === 0 ? MINI_2E.alice : MINI_2E.bob;
        return (
          <div key={`mn${i}`} style={{position: 'absolute', left: g.x, top: g.y, width: MINI_2E.w, height: MINI_2E.h, borderRadius: 12, border: `2.5px solid ${withAlpha(theme.panelBorder, 0.9)}`, background: withAlpha(theme.panel, 0.92), padding: '12px 18px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap'}}>
              <span style={{width: 34, height: 34, borderRadius: '50%', border: `3px solid ${theme.mate}`}} />
              <span style={{fontFamily: theme.mono, fontSize: 19, fontWeight: 700, color: theme.mate}}>{who}</span>
              <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{`轨 · ${mod}`}</span>
            </div>
            {[0, 1].map((k) => (
              <span key={`ml${k}`} style={{display: 'block', height: 14, marginTop: 14, borderRadius: 4, background: withAlpha(theme.dim, 0.3)}} />
            ))}
          </div>
        );
      })}
      {/* 空白间隔带（互不打扰——虚线边界围出的空带，无任何连线跨越） */}
      <div style={{position: 'absolute', left: GAP_2E.x, top: GAP_2E.y, width: GAP_2E.w, height: GAP_2E.h, opacity: gap}}>
        <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, borderLeft: `3px dashed ${withAlpha(theme.dim, 0.7)}`}} />
        <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, borderRight: `3px dashed ${withAlpha(theme.dim, 0.7)}`}} />
        <div style={{position: 'absolute', left: -46, top: GAP_2E.h / 2 - 16, width: 142, textAlign: 'center', fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap'}}>互不打扰</div>
      </div>
      {/* 湛蓝信流（总结信的入箱轨迹——先爬升后平移再降落的弧线带） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        {letters.map((L, i) => {
          const t = L.t;
          if (t <= 0.02 || t >= 0.98) return null;
          const from = L.from;
          const to = {x: boxCx - 100 + i * 40, y: MAIL_2E.y + 70};
          const mid = {x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 160};
          return (
            <path
              key={`fl${i}`}
              d={`M ${from.x} ${from.y} Q ${mid.x} ${mid.y} ${to.x} ${to.y}`}
              fill="none"
              stroke={withAlpha(theme.inbox, 0.5)}
              strokeWidth={3.5}
              strokeDasharray="12 10"
              opacity={t}
            />
          );
        })}
      </svg>
      {/* 飞行中的总结信（沿弧线——三段避让插值） */}
      {letters.map((L, i) => {
        const t = L.t;
        if (t <= 0.02) return null;
        const from = L.from;
        const to = {x: boxCx - 100 + i * 40, y: MAIL_2E.y + 70};
        // 分段：0-0.3 爬升 / 0.3-0.7 平移 / 0.7-1 降落
        const x = from.x + (to.x - from.x) * (t < 0.3 ? 0.1 : t < 0.7 ? (t - 0.3) / 0.4 * 0.8 + 0.1 : 0.9 + (t - 0.7) / 0.3 * 0.1);
        const peak = Math.min(from.y, to.y) - 120;
        const y = t < 0.3 ? from.y + (peak - from.y) * (t / 0.3) : t < 0.7 ? peak : peak + (to.y - peak) * ((t - 0.7) / 0.3);
        return (
          <div key={`lt${i}`} style={{position: 'absolute', left: x, top: y, opacity: t < 0.9 ? 1 : 1 - (t - 0.9) * 10}}>
            <SummaryLetter zh={L.zh} tone={theme.inbox} />
          </div>
        );
      })}
      {/* 主代理信箱（承 1-B 同款同形——两信在箱待取（morph 起点）、亮起一拍辉光呼吸） */}
      <div style={{position: 'absolute', left: MAIL_2E.x, top: MAIL_2E.y}}>
        <MailboxFile x={0} y={0} w={MAIL_2E.w} h={MAIL_2E.h} name="lead.jsonl" litP={1} rows={2} count={2} glowP={Math.max(glow * breathe * 0.7, litPulse)} />
        {/* 环-箱呼应（主环缩悬箱上——信箱属主代理） */}
        <div style={{position: 'absolute', left: MAIL_2E.w / 2 - 60, top: -96, opacity: 0.85}}>
          <LoopRing size={120} nodes={[]} showExit={false} dotProgress={dot} />
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'总结发回 · 信到了门口'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P2SpawnTeammates: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p2-01', 'p2-02');
  const bB = w('p2-03', 'p2-05');
  const bC = w('p2-06', 'p2-07');
  const bD = w('p2-08', 'p2-10');
  const bE = w('p2-11', 'p2-12');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A">
        <TwoA
          atCard={wa('p2-01', 0.42) - bA.from}
          atArcL={wa('p2-01', 0.62) - bA.from}
          atArcR={wa('p2-01', 0.82) - bA.from}
          atL={wa('p2-02', 0.4) - bA.from}
          atR={wa('p2-02', 0.72) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <TwoB
          atRole={wa('p2-03', 0.2) - bB.from}
          atHist={wa('p2-03', 0.4) - bB.from}
          atTool={[wa('p2-04', 0.35), wa('p2-04', 0.48), wa('p2-04', 0.61), wa('p2-04', 0.74)].map((v) => v - bB.from)}
          atCap={wa('p2-05', 0.4) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <TwoC
          atLeft={wa('p2-06', 0.28) - bC.from}
          atRight={wa('p2-06', 0.5) - bC.from}
          atNew={[wa('p2-07', 0.18), wa('p2-07', 0.28), wa('p2-07', 0.38)].map((v) => v - bC.from)}
          atCount={wa('p2-07', 0.62) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="2-D">
        <TwoD
          atTask={wa('p2-08', 0.3) - bD.from}
          atAlice={wa('p2-09', 0.15) - bD.from}
          atBob={wa('p2-09', 0.5) - bD.from}
          atGo={wa('p2-10', 0.15) - bD.from}
        />
      </Sequence>
      <Sequence {...bE} name="2-E">
        <TwoE
          atGap={wa('p2-11', 0.2) - bE.from}
          atFlyA={wa('p2-11', 0.5) - bE.from}
          atFlyB={wa('p2-11', 0.68) - bE.from}
          atGlow={wa('p2-12', 0.08) - bE.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2SpawnTeammates;
