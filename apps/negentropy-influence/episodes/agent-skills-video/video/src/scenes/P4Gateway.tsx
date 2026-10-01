/** P4 门口的规矩（p4-01..p4-15，镜 4-A..4-F）——客户端五步生命周期（发现
 *  双域 → 宽容解析 → 披露亮菜单 → 激活 → 长会话；lc-discover 章回放）→
 *  脚本十条军规（首条：禁止交互提示，光标永闪无应答）→ allowed-tools 预授
 *  （左常态弹窗点头 vs 右牌照直达 + 网装自授清单「装前先看」）→ 三家门脸
 *  不对称（约定目录 .agents/skills 在发起方文档里空缺）→ X3 注入（转义是
 *  唯一边界、location 不转义留白；lc-inject 章回放）→ 规范两叠分裂钩到 P5。
 *  幕主色门牌靛（门口/身份延续）；治理段（4-B 军规 / 4-E 转义 / 4-F 分裂）
 *  切年检紫；红绿只进 X3 的拆解/完好两侧（消融对固定语义色）。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useBreathe,
  useDraw,
  useFlowDash,
  useImpulse,
  usePushIn,
  useShake,
  useSpring,
  useStagger,
} from '../motion';
import {SceneTag} from '../components/motifs';
import {CornerNote, SkillMenuCard, Stage} from '../components/e1-motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

/** 文件夹字形（P0 目录树同源路径）：4-A 双域行 / 4-D 三家门脸共用。 */
const Folder: React.FC<{w: number; h: number; stroke: string}> = ({w, h, stroke}) => (
  <svg width={w} height={h} viewBox="0 0 44 34">
    <path
      d="M2 8 Q2 4 6 4 H16 L20 9 H38 Q42 9 42 13 V29 Q42 33 38 33 H6 Q2 33 2 29 Z"
      fill={`${stroke}22`}
      stroke={stroke}
      strokeWidth={2}
    />
  </svg>
);

/** 页面字形：4-A 菜单页小图标 / SKILL.md 说明书行标。 */
const PageGlyph: React.FC<{w: number; h: number; stroke: string}> = ({w, h, stroke}) => (
  <svg width={w} height={h} viewBox="0 0 18 22">
    <path d="M2 1 H12 L17 6 V21 H2 Z" fill={`${stroke}22`} stroke={stroke} strokeWidth={1.6} />
    <line x1={5} y1={9} x2={13} y2={9} stroke={stroke} strokeWidth={1.4} />
    <line x1={5} y1={13} x2={13} y2={13} stroke={stroke} strokeWidth={1.4} />
    <line x1={5} y1={17} x2={10} y2={17} stroke={stroke} strokeWidth={1.4} />
  </svg>
);

/** 幕内退场包装：hideAt 起淡出、不回弹（菜单卡在 4-E archify 窗起永久让位）。 */
const FadeWrap: React.FC<{hideAt: number; children: React.ReactNode}> = ({hideAt, children}) => {
  const frame = useCurrentFrame();
  return <div style={{opacity: 1 - progress(frame, hideAt, DUR.f4)}}>{children}</div>;
};

/** 4-A 底部五步横条：p4-01 口播枚举段五格依次落位、流光沿轨推进；第三格
 *  「披露」亮起时格内弹出菜单页小图标（那页菜单亮给模型看）；p4-02 起游标
 *  回亮「发现」、p4-03 亮「解析」。横条是全 beat 的锚，钉在 archify 画框
 *  （底边 880）与字幕带（920）之间的窄带。 */
const RAIL_STEPS = ['发现', '解析', '披露', '激活', '长会话'] as const;
const RAIL_CELL_W = 186;
const RAIL_GAP = 20;
const LifeRail: React.FC<{at01: number; d01: number; at02: number; at03: number}> = ({
  at01,
  d01,
  at02,
  at03,
}) => {
  const frame = useCurrentFrame();
  const flow = useFlowDash({dash: 9, gap: 13, period: 34});
  const menuPop = useSpring('snap', {at: at01 + Math.round(d01 * 0.62), dur: DUR.f4});
  // 五步在 p4-01 句内的口播落点（发现…长会话 ≈ 33%–85%）
  const fracs = [0.33, 0.4, 0.46, 0.76, 0.85];
  const cells = fracs.map((f) => progress(frame, at01 + Math.round(d01 * f), DUR.f4));
  // 游标：枚举期逐格右移；p4-02 回亮发现(0)、p4-03 亮解析(1)
  const marks = [
    ...fracs.map((f, i) => ({at: at01 + Math.round(d01 * f), step: i})),
    {at: at02, step: 0},
    {at: at03, step: 1},
  ];
  let prev = 0;
  let cur = 0;
  let curAt = at01;
  for (const m of marks) {
    if (frame >= m.at) {
      prev = cur;
      cur = m.step;
      curAt = m.at;
    }
  }
  const center = (i: number) => i * (RAIL_CELL_W + RAIL_GAP) + RAIL_CELL_W / 2;
  const edge = center(prev) + (center(cur) - center(prev)) * progress(frame, curAt, DUR.f5);
  const W = 5 * RAIL_CELL_W + 4 * RAIL_GAP;
  return (
    <div style={{position: 'absolute', left: (1920 - W) / 2, top: 884, width: W, height: 34}}>
      {/* 轨道：底线 + 到游标为止的行进流光（dasharray 与 pathLength 分立元素） */}
      <svg width={W} height={34} style={{position: 'absolute', inset: 0}}>
        <line
          x1={center(0)}
          y1={17}
          x2={center(4)}
          y2={17}
          stroke={theme.panelBorder}
          strokeWidth={2}
        />
        <line
          x1={center(0)}
          y1={17}
          x2={edge}
          y2={17}
          stroke={theme.conceptDeep}
          strokeWidth={2.5}
          strokeLinecap="round"
          {...flow}
        />
      </svg>
      <div style={{position: 'relative', display: 'flex', flexDirection: 'row', gap: RAIL_GAP}}>
        {RAIL_STEPS.map((label, i) => {
          const active = i === cur;
          return (
            <div
              key={label}
              style={{
                width: RAIL_CELL_W,
                height: 34,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                borderRadius: 8,
                background: active ? `${theme.conceptDeep}26` : theme.panel,
                border: `1.5px solid ${active ? theme.conceptDeep : theme.panelBorder}`,
                opacity: cells[i],
                transform: `translateY(${(1 - cells[i]) * 10}px)`,
                color: active ? theme.text : theme.dim,
                fontSize: 15.5,
                fontFamily: theme.sans,
              }}
            >
              {i === 2 && menuPop > 0.05 && (
                <span
                  style={{display: 'inline-flex', transform: `scale(${menuPop})`}}
                >
                  <PageGlyph w={13} h={16} stroke={theme.conceptDeep} />
                </span>
              )}
              <span>{label}</span>
              <span
                style={{
                  fontFamily: theme.mono,
                  fontSize: 11.5,
                  color: active ? theme.conceptDeep : theme.panelBorder,
                }}
              >
                {i + 1}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** 4-A·发现双域（p4-02..02a）：左项目级 / 右用户级两棵目录；同名时项目压住
 *  用户（用户行划线变暗）+ deny 告警章；p4-02a 落「街道为域」灰签——门牌
 *  不必全城唯一，扫到哪条街算哪条街的。 */
const DomainScan: React.FC<{
  at02: number;
  d02: number;
  at02a: number;
  outAt: number;
}> = ({at02, d02, at02a, outAt}) => {
  const frame = useCurrentFrame();
  const inP = progress(frame, at02 + Math.round(d02 * 0.1), DUR.f5);
  const o = inP * (1 - progress(frame, outAt, DUR.f4));
  const ovP = progress(frame, at02 + Math.round(d02 * 0.62), DUR.f4); // 同名压制
  const warnP = progress(frame, at02 + Math.round(d02 * 0.88), DUR.f4); // 还要告警
  const tagP = progress(frame, at02a + 8, DUR.f5);
  const card = (title: string, path: string, rows: string[], isProj: boolean) => (
    <div
      style={{
        width: 390,
        background: theme.panel,
        border: `1.5px solid ${isProj ? `${theme.conceptDeep}77` : theme.panelBorder}`,
        borderRadius: 12,
        padding: '16px 20px',
        transform: `translateX(${(isProj ? -1 : 1) * (1 - inP) * 26}px)`,
      }}
    >
      <div style={{display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: 12}}>
        <span style={{fontSize: 17, color: theme.text}}>{title}</span>
        <span style={{fontFamily: theme.mono, fontSize: 13.5, color: theme.dim}}>{path}</span>
      </div>
      <div style={{marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10}}>
        {rows.map((r) => {
          const struck = !isProj && r === 'shift-swap' ? ovP : 0;
          const hot = isProj && r === 'shift-swap' ? ovP : 0;
          return (
            <div
              key={r}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: '6px 10px',
                borderRadius: 7,
                opacity: 1 - 0.55 * struck,
                textDecoration: struck > 0.5 ? 'line-through' : undefined,
                border: `1.5px solid ${hot > 0.3 ? theme.conceptDeep : 'transparent'}`,
                background: hot > 0.3 ? `${theme.conceptDeep}1f` : 'transparent',
              }}
            >
              <Folder w={22} h={17} stroke={struck > 0.3 ? theme.panelBorder : theme.conceptDeep} />
              <span
                style={{
                  fontFamily: theme.mono,
                  fontSize: 16,
                  color: struck > 0.3 ? theme.dim : theme.text,
                }}
              >
                {r}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: o,
      }}
    >
      <div style={{position: 'relative', display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 90}}>
        {card('项目级', '.agents/skills', ['shift-swap'], true)}
        {card('用户级', '~/.agents/skills', ['shift-swap', 'report-merger'], false)}
        {/* 同名压制章：骑缝盖在两卡之间 */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: -22,
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'row',
            gap: 10,
            opacity: ovP,
          }}
        >
          <span
            style={{
              fontSize: 14.5,
              color: theme.deny,
              border: `1.5px solid ${theme.deny}99`,
              borderRadius: 7,
              padding: '5px 12px',
              background: theme.bg,
            }}
          >
            项目压用户
          </span>
          <span
            style={{
              fontSize: 14.5,
              color: theme.bg,
              background: theme.deny,
              borderRadius: 7,
              padding: '5px 12px',
              opacity: warnP,
            }}
          >
            告警
          </span>
        </div>
      </div>
      <div style={{marginTop: 30, opacity: tagP}}>
        <span
          style={{
            fontSize: 14.5,
            color: theme.dim,
            border: `1.5px dashed ${theme.panelBorder}`,
            borderRadius: 7,
            padding: '5px 14px',
          }}
        >
          街道为域
        </span>
      </div>
    </div>
  );
};

/** 4-A·宽容解析（p4-03）：三档裁决行——名字对不上 / 超长 → 警告照载；
 *  解析不了 → 跳过（虚线灰章）。先保路上通的装载哲学第一次露头。 */
const LenientParse: React.FC<{at03: number; d03: number; outAt: number}> = ({
  at03,
  d03,
  outAt,
}) => {
  const frame = useCurrentFrame();
  const o = progress(frame, at03 + 6, DUR.f5) * (1 - progress(frame, outAt, DUR.f4));
  const st = useStagger(3, {at: at03 + Math.round(d03 * 0.2), dur: DUR.f4, stride: 9});
  const rows = [
    {label: '名字对不上', verdict: '警告 · 照载', drop: false},
    {label: '超长', verdict: '警告 · 照载', drop: false},
    {label: '解析不了', verdict: '跳过', drop: true},
  ];
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: o,
      }}
    >
      <div
        style={{
          fontSize: 20,
          color: theme.text,
          borderLeft: `3px solid ${theme.conceptDeep}`,
          paddingLeft: 14,
          marginBottom: 26,
        }}
      >
        宽容原则
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
        {rows.map((r, i) => (
          <div
            key={r.label}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 20,
              opacity: st[i],
              transform: `translateX(${(1 - st[i]) * -26}px)`,
            }}
          >
            <span style={{fontSize: 20, color: theme.text, width: 160}}>{r.label}</span>
            <span style={{color: theme.dim, fontSize: 18}}>→</span>
            <span
              style={{
                fontSize: 16,
                color: r.drop ? theme.dim : theme.conceptDeep,
                border: r.drop
                  ? `1.5px dashed ${theme.panelBorder}`
                  : `1.5px solid ${theme.conceptDeep}88`,
                borderRadius: 7,
                padding: '6px 16px',
              }}
            >
              {r.verdict}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** 4-A·包裹与引用纪律（p4-04..04a）：mono 目录面板——SKILL.md 说明书行 +
 *  scripts/ 工具行；p4-04a 一支弧线箭头 @draw 只指紧邻文件（同层或下一层），
 *  上行箭头打叉灰显（不往上翻、不提倡绕远）。 */
const ScriptPack: React.FC<{at04: number; d04: number; at04a: number; d04a: number}> = ({
  at04,
  d04,
  at04a,
  d04a,
}) => {
  const frame = useCurrentFrame();
  const inP = progress(frame, at04 + 6, DUR.f5);
  const docP = progress(frame, at04 + Math.round(d04 * 0.3), DUR.f4);
  const toolP = progress(frame, at04 + Math.round(d04 * 0.55), DUR.f4);
  const arrow = useDraw(at04a + Math.round(d04a * 0.25), DUR.f5);
  const chipP = progress(frame, at04a + Math.round(d04a * 0.3), DUR.f4);
  const crossP = progress(frame, at04a + Math.round(d04a * 0.6), DUR.f4);
  const toolColor = (isTool: boolean) => (isTool && toolP > 0.4 ? theme.conceptDeep : theme.text);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: inP,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 560,
          background: theme.panel,
          border: `1.5px solid ${theme.panelBorder}`,
          borderRadius: 12,
          padding: '20px 26px',
          fontFamily: theme.mono,
          fontSize: 19,
        }}
      >
        {/* 可带工具章 */}
        <span
          style={{
            position: 'absolute',
            top: 14,
            right: 16,
            fontSize: 13.5,
            color: theme.conceptDeep,
            border: `1.5px solid ${theme.conceptDeep}88`,
            borderRadius: 6,
            padding: '3px 10px',
            opacity: toolP,
            fontFamily: theme.sans,
          }}
        >
          可带工具
        </span>
        <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, height: 42}}>
          <Folder w={20} h={16} stroke={theme.conceptDeep} />
          <span style={{color: theme.text}}>shift-swap/</span>
        </div>
        <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, height: 42, paddingLeft: 22}}>
          <PageGlyph w={14} h={17} stroke={theme.conceptDeep} />
          <span style={{color: theme.text}}>SKILL.md</span>
          <span
            style={{
              fontSize: 13,
              color: theme.dim,
              border: `1.5px solid ${theme.panelBorder}`,
              borderRadius: 6,
              padding: '2px 9px',
              opacity: docP,
              fontFamily: theme.sans,
            }}
          >
            说明书
          </span>
        </div>
        <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, height: 42, paddingLeft: 22}}>
          <Folder w={20} h={16} stroke={theme.conceptDeep} />
          <span style={{color: toolColor(true)}}>scripts/</span>
        </div>
        <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', height: 42, paddingLeft: 62}}>
          <span style={{color: toolColor(true)}}>submit.py</span>
        </div>
        {/* 引用纪律：一支弧线箭头只指紧邻文件（SKILL.md → 下一层脚本） */}
        <svg width={170} height={130} style={{position: 'absolute', right: 8, top: 54}} viewBox="0 0 170 130">
          <path
            d="M10 29 C 90 29, 90 113, 148 113"
            fill="none"
            stroke={theme.conceptDeep}
            strokeWidth={2.5}
            {...arrow}
          />
          <path
            d="M156 113 L142 106 L142 120 Z"
            fill={theme.conceptDeep}
            opacity={arrow.strokeDashoffset < 0.2 ? 1 : 0}
          />
        </svg>
        <span
          style={{
            position: 'absolute',
            right: 52,
            top: 66,
            fontSize: 13.5,
            color: theme.conceptDeep,
            border: `1.5px solid ${theme.conceptDeep}88`,
            borderRadius: 6,
            padding: '3px 10px',
            opacity: chipP,
            fontFamily: theme.sans,
          }}
        >
          只指紧邻
        </span>
        {/* 上行禁令：往上翻的箭头打叉 */}
        <div
          style={{
            position: 'absolute',
            left: 318,
            top: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            opacity: crossP,
          }}
        >
          <svg width={26} height={32} viewBox="0 0 26 32">
            <line x1={13} y1={28} x2={13} y2={8} stroke={theme.dim} strokeWidth={2} />
            <path d="M13 2 L8 10 H18 Z" fill={theme.dim} />
            <line x1={3} y1={29} x2={23} y2={3} stroke={theme.dim} strokeWidth={2} />
          </svg>
          <span style={{fontSize: 12, color: theme.dim, fontFamily: theme.sans}}>不往上</span>
        </div>
      </div>
    </div>
  );
};

/** 4-B 军规（p4-05..05a）：十枚脚本小卡 5×2 阵列（@stagger）；首卡在 p4-05a
 *  放大置前「禁止交互提示」，卡下一行等待输入的终端光标 @breathe 常闪、
 *  永无应答——没人应答的环境里等输入等于永久挂起。治理段，切年检紫。 */
const RuleTen: React.FC<{at05: number; d05: number; at05a: number; d05a: number}> = ({
  at05,
  d05,
  at05a,
  d05a,
}) => {
  const frame = useCurrentFrame();
  const st = useStagger(10, {at: at05 + Math.round(d05 * 0.15), dur: DUR.f3, stride: 5});
  const bigP = progress(frame, at05a + Math.round(d05a * 0.28), DUR.f5);
  const stripP = progress(frame, at05a + Math.round(d05a * 0.5), DUR.f4);
  const noAns = progress(frame, at05a + Math.round(d05a * 0.72), DUR.f4);
  const blink = useBreathe({period: 30, base: 0.35, amp: 0.65});
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: 14, marginBottom: 28}}>
        <span style={{fontSize: 20, color: theme.text, borderLeft: `3px solid ${theme.deny}`, paddingLeft: 12}}>
          十条军规
        </span>
        <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>scripts/</span>
      </div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, 168px)', gap: 18}}>
        {Array.from({length: 10}, (_, i) => {
          const first = i === 0;
          return (
            <div
              key={i}
              style={{
                position: 'relative',
                zIndex: first ? 5 : 1,
                height: 96,
                borderRadius: 10,
                background: first ? `${theme.deny}14` : theme.panel,
                border: `1.5px solid ${first && bigP > 0.3 ? theme.deny : theme.panelBorder}`,
                boxShadow: first && bigP > 0.3 ? `0 8px 30px ${theme.deny}33` : 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                opacity: first ? st[i] : st[i] * (1 - 0.5 * bigP),
                transform: `translateY(${(1 - st[i]) * -14}px) scale(${first ? 1 + 0.3 * bigP : 1})`,
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 20, color: first && bigP > 0.3 ? theme.deny : theme.dim}}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {first && (
                <span style={{fontSize: 17, color: theme.text, opacity: bigP}}>禁止交互提示</span>
              )}
            </div>
          );
        })}
      </div>
      {/* 等输入的终端行：光标常闪、永无应答 */}
      <div
        style={{
          marginTop: 34,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          width: 430,
          height: 48,
          borderRadius: 8,
          border: `1.5px solid ${theme.panelBorder}`,
          background: '#0B0E13',
          padding: '0 16px',
          opacity: stripP,
          gap: 9,
          fontFamily: theme.mono,
        }}
      >
        <span style={{fontSize: 17, color: theme.dim}}>$</span>
        <span style={{width: 10, height: 22, background: theme.text, opacity: blink}} />
        <span style={{fontSize: 14, color: theme.deny, marginLeft: 12, opacity: noAns}}>无应答</span>
      </div>
    </div>
  );
};

/** 4-C 预授（p4-06..06b）：上半左常态 / 右牌照两列对照——左「动用工具」每回
 *  合弹窗点头（×2，逐次计点）；右 allowed-tools 牌照挂上（@enter:fall）弹窗
 *  消失、箭头直达；p4-06b 整体压暗，下半浮出网上代码库包裹 + 自授清单特写，
 *  放大镜移向清单「装前先看」。 */
const PreAuth: React.FC<{
  at06: number;
  d06: number;
  at06a: number;
  d06a: number;
  at06b: number;
  d06b: number;
}> = ({at06, d06, at06a, d06a, at06b, d06b}) => {
  const frame = useCurrentFrame();
  // 左列两回合弹窗窗函数（弹出 → 打勾 → 消失）
  const cyc = (k: number) => ({
    pop: at06 + Math.round(d06 * (0.08 + 0.48 * k)),
    len: Math.round(d06 * 0.34),
  });
  const win = (c: {pop: number; len: number}, a: number, b: number) =>
    progress(frame, c.pop + Math.round(c.len * a), DUR.f3) *
    (1 - progress(frame, c.pop + Math.round(c.len * b), DUR.f3));
  const c1 = cyc(0);
  const c2 = cyc(1);
  const dialogL = Math.max(win(c1, 0, 0.8), win(c2, 0, 0.8));
  const checkL = Math.max(win(c1, 0.5, 0.8), win(c2, 0.5, 0.8));
  const litL = Math.max(win(c1, 0, 0.8), win(c2, 0, 0.8));
  // 右列：牌照落下 → 弹窗消失、直达
  const plateS = useSpring('settle', {at: at06a + Math.round(d06a * 0.12), dur: DUR.f5});
  const rDie = progress(frame, at06a + Math.round(d06a * 0.35), DUR.f4);
  const directP = progress(frame, at06a + Math.round(d06a * 0.5), DUR.f5);
  const dialogR = Math.max(win(c1, 0, 1), win(c2, 0, 1)) * (1 - rDie);
  // p4-06b 下半场
  const dimTop = 1 - 0.62 * progress(frame, at06b + Math.round(d06b * 0.08), DUR.f4);
  const packP = progress(frame, at06b + Math.round(d06b * 0.15), DUR.f5);
  const listP = progress(frame, at06b + Math.round(d06b * 0.3), DUR.f5);
  const magP = progress(frame, at06b + Math.round(d06b * 0.5), DUR.f6);
  const lookP = progress(frame, at06b + Math.round(d06b * 0.8), DUR.f4);
  const t1 = progress(frame, c1.pop + Math.round(c1.len * 0.5), DUR.f3);
  const t2 = progress(frame, c2.pop + Math.round(c2.len * 0.5), DUR.f3);
  const toolChip = (lit: number) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        border: `1.5px solid ${lit > 0.3 ? theme.conceptDeep : theme.panelBorder}`,
        borderRadius: 9,
        padding: '9px 16px',
        background: lit > 0.3 ? `${theme.conceptDeep}1f` : 'transparent',
      }}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: 5,
          background: lit > 0.3 ? theme.conceptDeep : theme.panelBorder,
        }}
      />
      <span style={{fontSize: 16, color: theme.text}}>动用工具</span>
    </div>
  );
  const dialog = (vis: number, check: number) => (
    <div
      style={{
        width: 200,
        background: theme.panel,
        border: `1.5px solid ${check > 0.4 ? theme.conceptDeep : theme.panelBorder}`,
        borderRadius: 10,
        padding: '14px 16px',
        opacity: vis,
        transform: `scale(${0.86 + 0.14 * vis})`,
      }}
    >
      <div style={{fontSize: 16, color: theme.text}}>允许？</div>
      <div style={{marginTop: 10}}>
        <span
          style={{
            display: 'inline-block',
            fontSize: 14,
            color: theme.conceptDeep,
            border: `1.5px solid ${theme.conceptDeep}88`,
            borderRadius: 7,
            padding: '5px 16px',
            transform: `scale(${1 - 0.08 * check})`,
            background: check > 0.4 ? `${theme.conceptDeep}26` : 'transparent',
          }}
        >
          允许
        </span>
      </div>
    </div>
  );
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', width: 1120}}>
      <div style={{display: 'flex', flexDirection: 'row', gap: 130, opacity: dimTop}}>
        {/* 左列：常态——逐次点头 */}
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14}}>
          <div style={{fontSize: 15, color: theme.dim, letterSpacing: 2}}>常态</div>
          <div style={{height: 84, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 9}}>
            {[t1, t2].map((t, i) => (
              <span
                key={i}
                style={{
                  width: 4,
                  height: 44,
                  background: theme.conceptDeep,
                  borderRadius: 2,
                  opacity: t,
                  transform: `scaleY(${0.4 + 0.6 * t})`,
                  transformOrigin: 'bottom',
                }}
              />
            ))}
            <span style={{fontSize: 13, color: theme.dim, marginLeft: 8, opacity: t1}}>逐次点头</span>
          </div>
          <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14}}>
            {toolChip(litL)}
            <svg width={64} height={24} viewBox="0 0 64 24">
              <line x1={0} y1={12} x2={52} y2={12} stroke={theme.dim} strokeWidth={2} />
              <path d="M52 5 L63 12 L52 19 Z" fill={theme.dim} />
            </svg>
            <div style={{position: 'relative', width: 200, height: 100, display: 'flex', alignItems: 'center'}}>
              {dialog(dialogL, checkL)}
            </div>
          </div>
        </div>
        {/* 右列：allowed-tools 牌照——一回合免点头 */}
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14}}>
          <div style={{fontSize: 15, color: theme.dim, letterSpacing: 2}}>预授</div>
          <div style={{height: 84, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div
              style={{
                position: 'relative',
                width: 250,
                height: 80,
                borderRadius: 10,
                border: `3px solid ${theme.conceptDeep}`,
                background: theme.panel,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: plateS,
                transform: `translateY(${(1 - plateS) * -34}px) rotate(${(1 - plateS) * -4}deg)`,
                boxShadow: `0 6px 24px ${theme.conceptDeep}2e`,
              }}
            >
              <span style={{position: 'absolute', left: 10, top: 36, width: 7, height: 7, borderRadius: 4, background: theme.panelBorder}} />
              <span style={{position: 'absolute', right: 10, top: 36, width: 7, height: 7, borderRadius: 4, background: theme.panelBorder}} />
              <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.conceptDeep, fontWeight: 700}}>
                allowed-tools
              </div>
              <div style={{fontSize: 12.5, color: theme.dim, marginTop: 3}}>一回合免点头</div>
            </div>
          </div>
          <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14}}>
            {toolChip(plateS)}
            <svg width={64} height={24} viewBox="0 0 64 24">
              <line x1={0} y1={12} x2={52} y2={12} stroke={theme.panelBorder} strokeWidth={2} />
              <line x1={0} y1={12} x2={directP * 52} y2={12} stroke={theme.conceptDeep} strokeWidth={2.5} />
              <path d="M52 5 L63 12 L52 19 Z" fill={directP > 0.9 ? theme.conceptDeep : theme.panelBorder} />
            </svg>
            <div style={{position: 'relative', width: 200, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              {dialog(dialogR, 0)}
              <span
                style={{
                  position: 'absolute',
                  fontSize: 16,
                  color: theme.conceptDeep,
                  border: `1.5px solid ${theme.conceptDeep}`,
                  background: `${theme.conceptDeep}26`,
                  borderRadius: 8,
                  padding: '9px 20px',
                  opacity: directP,
                }}
              >
                直达
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* p4-06b：网上代码库包裹 + 自授清单特写 + 放大镜 */}
      <div
        style={{
          marginTop: 36,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 44,
          opacity: packP,
          transform: `translateY(${(1 - packP) * 26}px)`,
        }}
      >
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
          <svg width={110} height={88} viewBox="0 0 110 88">
            <rect x={6} y={14} width={98} height={68} rx={6} fill={`${theme.conceptDeep}1f`} stroke={theme.conceptDeep} strokeWidth={2.5} />
            <line x1={55} y1={14} x2={55} y2={82} stroke={theme.conceptDeep} strokeWidth={2.5} strokeDasharray="6 6" />
            <path d="M6 42 H104" stroke={`${theme.conceptDeep}88`} strokeWidth={1.5} />
          </svg>
          <span style={{fontSize: 15, color: theme.text}}>网上代码库</span>
        </div>
        <div style={{position: 'relative'}}>
          <div
            style={{
              width: 330,
              background: theme.panel,
              border: `1.5px solid ${magP > 0.85 ? theme.conceptDeep : theme.panelBorder}`,
              borderRadius: 10,
              padding: '14px 18px',
              transform: `scale(${1 + 0.05 * Number(magP > 0.85)})`,
              opacity: listP,
            }}
          >
            <div style={{fontSize: 14.5, color: theme.dim, marginBottom: 8}}>自授清单</div>
            <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.text}}>allowed-tools</div>
            <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.panelBorder, marginTop: 4}}>……</div>
          </div>
          {/* 放大镜移向清单 */}
          <svg
            width={54}
            height={54}
            viewBox="0 0 54 54"
            style={{position: 'absolute', left: -172 + magP * 156, top: -22, opacity: listP}}
          >
            <circle cx={22} cy={22} r={15} stroke={theme.text} strokeWidth={3} fill={theme.panel} />
            <line x1={33} y1={33} x2={48} y2={48} stroke={theme.text} strokeWidth={4} strokeLinecap="round" />
          </svg>
        </div>
        <span
          style={{
            fontSize: 15.5,
            color: theme.text,
            border: `1.5px solid ${theme.conceptDeep}`,
            borderRadius: 8,
            padding: '8px 18px',
            opacity: lookP,
            transform: `scale(${0.94 + 0.06 * lookP})`,
          }}
        >
          装前先看
        </span>
      </div>
    </div>
  );
};

/** 4-D 三家不对称（p4-07..10）：约定目录 .agents/skills 头章下三张门脸卡
 *  @stagger——Codex（约定目录图标大而唯一）/ VS Code（+教程标签）/
 *  Claude Code（一排自家目录、约定位置空缺灰显）；p4-10 三卡压暗，金句卡
 *  @pushIn「互操作 = 别人肯多扫你一眼」（衬线；互操作是身份与路由的事，
 *  用门牌靛不用账本金）。 */
const ThreeFaces: React.FC<{
  at07: number;
  d07: number;
  at08: number;
  d08: number;
  at09: number;
  d09: number;
  at10: number;
  d10: number;
}> = ({at07, d07, at08, d08, at09, d09, at10, d10}) => {
  const frame = useCurrentFrame();
  const headP = progress(frame, at07 + Math.round(d07 * 0.12), DUR.f5);
  const c1 = progress(frame, at08 + Math.round(d08 * 0.18), DUR.f5);
  const c2 = progress(frame, at08 + Math.round(d08 * 0.6), DUR.f5);
  const c3 = progress(frame, at09 + Math.round(d09 * 0.15), DUR.f5);
  const gapP = progress(frame, at09 + Math.round(d09 * 0.6), DUR.f5);
  const dimC = 1 - 0.6 * progress(frame, at10 + 4, DUR.f4);
  const quoteAt = at10 + Math.round(d10 * 0.28);
  const quoteT = usePushIn(quoteAt, {scale: 0.05, dur: DUR.f5});
  const quoteO = progress(frame, quoteAt, DUR.f5);
  const cardShell = (name: string, p: number, children: React.ReactNode) => (
    <div
      style={{
        width: 300,
        background: theme.panel,
        border: `1.5px solid ${theme.panelBorder}`,
        borderRadius: 12,
        padding: '18px 20px',
        opacity: p * dimC,
        transform: `translateY(${(1 - p) * 22}px)`,
      }}
    >
      <div style={{fontSize: 18, color: theme.text, fontWeight: 600}}>{name}</div>
      <div style={{marginTop: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
        {children}
      </div>
    </div>
  );
  return (
    <div style={{position: 'relative', width: 1100, height: 520}}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 14,
          opacity: headP * dimC,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.conceptDeep}}>.agents/skills</span>
        <span style={{fontSize: 16, color: theme.dim}}>约定目录</span>
      </div>
      <div style={{marginTop: 30, display: 'flex', flexDirection: 'row', gap: 36}}>
        {cardShell(
          'Codex',
          c1,
          <>
            <Folder w={72} h={56} stroke={theme.conceptDeep} />
            <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>.agents/skills</span>
            <span
              style={{
                fontSize: 13.5,
                color: theme.conceptDeep,
                border: `1.5px solid ${theme.conceptDeep}88`,
                borderRadius: 7,
                padding: '4px 12px',
              }}
            >
              原生 · 唯一
            </span>
          </>,
        )}
        {cardShell(
          'VS Code',
          c2,
          <>
            <Folder w={54} h={42} stroke={theme.conceptDeep} />
            <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>.agents/skills</span>
            <span
              style={{
                fontSize: 13.5,
                color: theme.dim,
                border: `1.5px solid ${theme.panelBorder}`,
                borderRadius: 7,
                padding: '4px 12px',
              }}
            >
              教程
            </span>
          </>,
        )}
        {cardShell(
          'Claude Code',
          c3,
          <>
            <div style={{display: 'flex', flexDirection: 'row', gap: 10}}>
              {[0, 1, 2].map((i) => (
                <Folder key={i} w={36} h={28} stroke={theme.dim} />
              ))}
            </div>
            <span style={{fontSize: 13.5, color: theme.dim}}>自家目录</span>
            <div
              style={{
                width: 170,
                height: 46,
                border: `1.5px dashed ${gapP > 0.4 ? theme.dim : theme.panelBorder}`,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: gapP > 0.4 ? theme.text : theme.dim,
                fontSize: 15,
              }}
            >
              空缺
            </div>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 12.5,
                color: theme.dim,
                opacity: gapP,
              }}
            >
              .agents/skills
            </span>
          </>,
        )}
      </div>
      {/* p4-10 金句卡 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: quoteO,
          transform: quoteT,
        }}
      >
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 44,
            fontWeight: 700,
            color: theme.conceptDeep,
            background: `${theme.bg}d9`,
            border: `1.5px solid ${theme.conceptDeep}55`,
            borderRadius: 12,
            padding: '28px 46px',
          }}
        >
          互操作 = 别人肯多扫你一眼
        </div>
      </div>
    </div>
  );
};

/** 4-E X3 注入（p4-11..14）目录块文本层特写（div + theme.mono——转义字符
 *  显示，不用 SVG text）：p4-12 扫视线掠过（会被照着执行的文字）→ p4-12a
 *  转义改写 `<` → `&lt;`（完好侧绿）→ p4-13 拆解态同一行闭合标签原文混入 +
 *  下一行伪造 fake-admin 目录行（红高亮 @shake，恶意样本=lab4 夹具
 *  evil-craft，与右上菜单卡 forgeAt 同拍）→ archify 注入章（让位层）→
 *  p4-14 location 行旁灰签「不转义 · 留白」。 */
const InjectText: React.FC<{
  at11: number;
  d11: number;
  at12: number;
  d12: number;
  at12a: number;
  d12a: number;
  at13: number;
  d13: number;
  archAt: number;
  at14: number;
  d14: number;
}> = ({at11, d11, at12, d12, at12a, d12a, at13, d13, archAt, at14, d14}) => {
  const frame = useCurrentFrame();
  const inP = progress(frame, at11 + Math.round(d11 * 0.15), DUR.f5);
  const scanP = progress(frame, at12 + Math.round(d12 * 0.25), Math.round(d12 * 0.5));
  const execP = progress(frame, at12 + Math.round(d12 * 0.3), DUR.f4);
  const escP = progress(frame, at12a + Math.round(d12a * 0.25), DUR.f5);
  const boundP = progress(frame, at12a + Math.round(d12a * 0.8), DUR.f4);
  // p4-13 拆解窗：archify 窗起收场（p4-14 回到完好态）
  const rawAt = at13 + Math.round(d13 * 0.15);
  const forgeAt = at13 + Math.round(d13 * 0.35);
  const cntAt = at13 + Math.round(d13 * 0.5);
  const endF = 1 - progress(frame, archAt, DUR.f4);
  const badP = progress(frame, rawAt, DUR.f4) * endF;
  const forgeVis = progress(frame, forgeAt, DUR.f4) * endF;
  const cntVis = progress(frame, cntAt, DUR.f4) * endF;
  const escO = escP * (1 - badP);
  const shakeX = useShake({at: forgeAt, amp: 4, dur: DUR.f6, decay: true});
  const locP = progress(frame, at14 + Math.round(d14 * 0.15), DUR.f5);
  const tagP = progress(frame, at14 + Math.round(d14 * 0.45), DUR.f4);
  return (
    <div
      style={{
        position: 'relative',
        width: 900,
        background: theme.panel,
        border: `1.5px solid ${theme.deny}55`,
        borderRadius: 12,
        padding: '20px 30px 24px',
        opacity: inP,
        fontFamily: theme.mono,
        fontSize: 20,
        lineHeight: 2.05,
        color: theme.text,
      }}
    >
      <div style={{fontSize: 14, color: theme.dim, fontFamily: theme.sans, marginBottom: 8, letterSpacing: 2}}>
        目录块
      </div>
      <div>
        <span style={{color: theme.conceptDeep}}>name:</span> shift-swap
      </div>
      {/* description 行：扫视线 / 转义改写 / 闭合标签混入 */}
      <div style={{position: 'relative'}}>
        <span style={{color: theme.conceptDeep}}>description:</span> 周五换班{' '}
        <span style={{position: 'relative', display: 'inline-block'}}>
          <span style={{opacity: 1 - escO, color: badP > 0.5 ? theme.danger : theme.text}}>
            {'<需审批>'}
          </span>
          <span style={{position: 'absolute', left: 0, top: 0, opacity: escO, color: theme.ok}}>
            {'&lt;需审批&gt;'}
          </span>
        </span>
        <span style={{opacity: badP, color: theme.danger}}>{' </catalog>'}</span>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 130,
            background: `linear-gradient(90deg, transparent, ${theme.deny}33, transparent)`,
            transform: `translateX(${scanP * 620}px)`,
            opacity: Math.sin(Math.PI * scanP),
          }}
        />
      </div>
      {/* 伪造目录行（拆解态） */}
      {forgeVis > 0 && (
        <div
          style={{
            marginTop: 2,
            opacity: forgeVis,
            transform: `translateX(${shakeX}px)`,
            background: `${theme.danger}1f`,
            borderLeft: `3px solid ${theme.danger}`,
            paddingLeft: 10,
            borderRadius: 4,
            color: theme.danger,
          }}
        >
          - name: fake-admin <span style={{fontSize: 14, opacity: 0.8}}>伪</span>
        </div>
      )}
      {/* location 行：官方实现不转义 */}
      <div
        style={{
          paddingLeft: 0,
          opacity: locP,
          transform: `translateY(${(1 - locP) * 8}px)`,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <span>
          <span style={{color: theme.conceptDeep}}>location:</span> ./shift-swap
        </span>
        <span
          style={{
            fontSize: 13.5,
            color: theme.dim,
            border: `1.5px dashed ${theme.dim}99`,
            borderRadius: 6,
            padding: '3px 10px',
            opacity: tagP,
            fontFamily: theme.sans,
          }}
        >
          不转义 · 留白
        </span>
      </div>
      {/* 章语：会被照着执行 / 转义是唯一边界 */}
      <span
        style={{
          position: 'absolute',
          top: -16,
          right: 26,
          fontSize: 13.5,
          color: theme.deny,
          border: `1.5px solid ${theme.deny}88`,
          borderRadius: 6,
          padding: '4px 12px',
          opacity: execP,
          fontFamily: theme.sans,
          background: theme.bg,
        }}
      >
        照着执行
      </span>
      <span
        style={{
          position: 'absolute',
          bottom: -16,
          right: 26,
          fontSize: 13.5,
          color: theme.deny,
          border: `1.5px solid ${theme.deny}88`,
          borderRadius: 6,
          padding: '4px 12px',
          opacity: boundP * endF,
          fontFamily: theme.sans,
          background: theme.bg,
        }}
      >
        唯一边界
      </span>
      {/* 注入计数：从零变成一 */}
      <div
        style={{
          position: 'absolute',
          right: -216,
          top: 96,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          opacity: cntVis,
          transform: `scale(${0.9 + 0.1 * cntVis})`,
        }}
      >
        <span style={{fontSize: 14, color: theme.dim, fontFamily: theme.sans}}>注入</span>
        <span style={{fontSize: 34, color: theme.danger, fontWeight: 700}}>0 → 1</span>
      </div>
    </div>
  );
};

/** 4-F 钩子（p4-15）：同一份规范文档分裂为两叠（@travel 分开），各盖 deny
 *  章「宽容装载」/「严格校验」（@impulse ×2），两叠之间一道闪电分隔线
 *  @draw——同一件事、两份答案，钩向 P5 交警与年检。 */
const SpecDoc: React.FC = () => (
  <div
    style={{
      width: 210,
      height: 264,
      background: theme.panel,
      border: `1.5px solid ${theme.panelBorder}`,
      borderRadius: 10,
      padding: '20px 22px',
    }}
  >
    <div style={{fontSize: 16, color: theme.text, marginBottom: 8}}>规范</div>
    {[150, 122, 138, 98].map((wd, i) => (
      <div
        key={i}
        style={{width: wd, height: 10, borderRadius: 3, background: theme.panelBorder, marginTop: 18}}
      />
    ))}
  </div>
);

const SplitSpec: React.FC<{at15: number; d15: number}> = ({at15, d15}) => {
  const frame = useCurrentFrame();
  const inP = progress(frame, at15 + 4, DUR.f5);
  const splitP = progress(frame, at15 + Math.round(d15 * 0.3), DUR.f6);
  const labelP = progress(frame, at15 + Math.round(d15 * 0.35), DUR.f4);
  const bolt = useDraw(at15 + Math.round(d15 * 0.58), DUR.f5);
  const s1At = at15 + Math.round(d15 * 0.5);
  const s2At = at15 + Math.round(d15 * 0.68);
  const impL = useImpulse({at: s1At, dur: DUR.f5});
  const impR = useImpulse({at: s2At, dur: DUR.f5});
  const oL = progress(frame, s1At, DUR.f4);
  const oR = progress(frame, s2At, DUR.f4);
  const stack = (side: -1 | 1, stamp: string, imp: number, so: number, rot: number) => (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: 96,
        transform: `translateX(calc(-50% + ${side * 265 * splitP}px))`,
        opacity: splitP,
      }}
    >
      {/* 叠影两页 */}
      <div style={{position: 'absolute', left: 10, top: 12, width: 210, height: 264, background: theme.panel, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 10, opacity: 0.4}} />
      <div style={{position: 'absolute', left: 5, top: 6, width: 210, height: 264, background: theme.panel, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 10, opacity: 0.7}} />
      <SpecDoc />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 96,
          transform: `translateX(-50%) rotate(${rot}deg) scale(${1 + 0.3 * imp})`,
          opacity: so,
          border: `3px solid ${theme.deny}`,
          color: theme.deny,
          borderRadius: 9,
          padding: '10px 20px',
          fontSize: 21,
          fontWeight: 700,
          letterSpacing: 5,
          background: `${theme.bg}e6`,
          whiteSpace: 'nowrap',
        }}
      >
        {stamp}
      </div>
    </div>
  );
  return (
    <div style={{position: 'relative', width: 1100, height: 430}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          textAlign: 'center',
          fontSize: 16,
          color: theme.dim,
          letterSpacing: 4,
          opacity: labelP,
        }}
      >
        两份答案
      </div>
      {/* 中央原稿 → 分裂两叠 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 96,
          transform: 'translateX(-50%)',
          opacity: inP * (1 - splitP),
        }}
      >
        <SpecDoc />
      </div>
      {stack(-1, '宽容装载', impL, oL, -8)}
      {stack(1, '严格校验', impR, oR, 6)}
      {/* 闪电分隔线 */}
      <svg
        width={60}
        height={120}
        viewBox="0 0 60 120"
        style={{position: 'absolute', left: '50%', top: 150, marginLeft: -30}}
      >
        <path
          d="M34 0 L14 50 H27 L10 120 L50 44 H32 Z"
          fill="none"
          stroke={theme.deny}
          strokeWidth={2.5}
          {...bolt}
        />
      </svg>
    </div>
  );
};

export const P4Gateway: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p4-01', 'p4-04a');
  const bB = w('p4-05', 'p4-05a');
  const bC = w('p4-06', 'p4-06b');
  const bD = w('p4-07', 'p4-10');
  const bE = w('p4-11', 'p4-14');
  const bF = w('p4-15');
  // 4-E 拆解态与 archify 注入章的分界：伪行/计数器先落（前 70%），后半窗让位画框
  const injWin = {
    at: at('p4-14') - bE.from,
    durationInFrames: dur('p4-14'),
  };
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A 生命周期">
        <SceneTag chapter="P4" tagline="门口的规矩" accent={theme.conceptDeep} />
        <Stage>
          <div style={{position: 'relative', width: 1120, height: 540}}>
            <DomainScan
              at02={at('p4-02') - bA.from}
              d02={dur('p4-02')}
              at02a={at('p4-02a') - bA.from}
              outAt={at('p4-03') - bA.from}
            />
            <LenientParse
              at03={at('p4-03') - bA.from}
              d03={dur('p4-03')}
              outAt={at('p4-04') - bA.from}
            />
            <ScriptPack
              at04={at('p4-04') - bA.from}
              d04={dur('p4-04')}
              at04a={at('p4-04a') - bA.from}
              d04a={dur('p4-04a')}
            />
          </div>
        </Stage>
        {/* lc-discover 章回放挂 p4-01；五步横条钉在画框下方全程推进 */}
        <ArchifyRecap
          slug="lifecycle"
          caption="生命周期"
          cues={[
            {chapterId: 'lc-discover', at: at('p4-01') - bA.from, durationInFrames: dur('p4-01'), },
            {chapterId: 'lc-load', at: at('p4-03') - bA.from, durationInFrames: dur('p4-03'), },
          ]}
        />
        <LifeRail
          at01={at('p4-01') - bA.from}
          d01={dur('p4-01')}
          at02={at('p4-02') - bA.from}
          at03={at('p4-03') - bA.from}
        />
      </Sequence>

      <Sequence {...bB} name="4-B 军规">
        <SceneTag chapter="P4" tagline="门口的规矩" accent={theme.deny} />
        <Stage>
          <RuleTen
            at05={at('p4-05') - bB.from}
            d05={dur('p4-05')}
            at05a={at('p4-05a') - bB.from}
            d05a={dur('p4-05a')}
          />
        </Stage>
      </Sequence>

      <Sequence {...bC} name="4-C 预授">
        <SceneTag chapter="P4" tagline="门口的规矩" accent={theme.conceptDeep} />
        <Stage>
          <PreAuth
            at06={at('p4-06') - bC.from}
            d06={dur('p4-06')}
            at06a={at('p4-06a') - bC.from}
            d06a={dur('p4-06a')}
            at06b={at('p4-06b') - bC.from}
            d06b={dur('p4-06b')}
          />
        </Stage>
      </Sequence>

      <Sequence {...bD} name="4-D 不对称">
        <SceneTag chapter="P4" tagline="门口的规矩" accent={theme.conceptDeep} />
        {/* Codex 扩展面章回放（p4-08「Codex 原生只用它」）——全屏独占期间门脸卡让位 */}
        <ArchifyRecap
          slug="dual-track"
          caption="扩展 · Codex"
          cues={[{chapterId: 'dt-ext-c', at: at('p4-08') - bD.from, durationInFrames: dur('p4-08'), }]}
        />
        <Stage>
          <ThreeFaces
            at07={at('p4-07') - bD.from}
            d07={dur('p4-07')}
            at08={at('p4-08') - bD.from}
            d08={dur('p4-08')}
            at09={at('p4-09') - bD.from}
            d09={dur('p4-09')}
            at10={at('p4-10') - bD.from}
            d10={dur('p4-10')}
          />
        </Stage>
        <CornerNote text="三家文档实测 · 2026-09-30" x={60} y={898} />
      </Sequence>

      <Sequence {...bE} name="4-E X3 注入">
        <SceneTag chapter="P4" tagline="门口的规矩" accent={theme.deny} />
        {/* 目录块文本层：archify 窗内让位、窗外复现（p4-14 回完好态 + location） */}
        <ArchifyYield cues={[{at: injWin.at, durationInFrames: injWin.durationInFrames}]}>
          <InjectText
            at11={at('p4-11') - bE.from}
            d11={dur('p4-11')}
            at12={at('p4-12') - bE.from}
            d12={dur('p4-12')}
            at12a={at('p4-12a') - bE.from}
            d12a={dur('p4-12a')}
            at13={at('p4-13') - bE.from}
            d13={dur('p4-13')}
            archAt={injWin.at}
            at14={at('p4-14') - bE.from}
            d14={dur('p4-14')}
          />
        </ArchifyYield>
        {/* 菜单卡（M-001）：evil-craft 行与伪行同拍染红，archify 窗起永久让位 */}
        <FadeWrap hideAt={injWin.at}>
          <SkillMenuCard
            appearAt={at('p4-11') - bE.from + 10}
            forgedRow="evil-craft"
            forgeAt={at('p4-13') - bE.from + Math.round(dur('p4-13') * 0.35)}
          />
        </FadeWrap>
        {/* archify 注入防御章回放——写在让位层之后（z 序纪律） */}
        <ArchifyRecap
          slug="lifecycle"
          caption="注入防御"
          cues={[
            {chapterId: 'lc-inject', at: at('p4-14') - bE.from, durationInFrames: dur('p4-14'), },
          ]}
        />
      </Sequence>

      <Sequence {...bF} name="4-F 钩子">
        <SceneTag chapter="P4" tagline="门口的规矩" accent={theme.deny} />
        <Stage>
          <SplitSpec at15={at('p4-15') - bF.from} d15={dur('p4-15')} />
        </Stage>
      </Sequence>
    </AbsoluteFill>
  );
};
