/** P2 一页菜单（p2-01..p2-24，镜 2-A..2-F）——全片核心幕：餐厅三联类比收拢为
 *  三级记账（archify 三章连播）→ 原型走查（任务单→正文→审批名单，账本条逐格
 *  累计 454+62+97=613）→ Codex 预算门（2% 金条 / 8000 字符标尺 / 二十行≠二十份）
 *  → X4 消融（预载的 submit.py 从未被读，613→694）→ X5 压缩保护（豁免盾 vs
 *  压碎零报错）→ 钩子推向下一行菜的 description 那句话（P3）。
 *  幕主色账本金（经济学核心）；〔M-001〕菜单卡 + 〔M-002〕账本条全幕常驻——
 *  数值/打勾/红侧随镜演进，archify 全屏窗内 dimmed 让位（幕级 chrome 层统一驱动）。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useBreathe,
  useCount,
  useDraw,
  useEnter,
  useImpulse,
  useProgress,
  usePushIn,
  useShake,
  useSpring,
  useStagger,
  win,
} from '../motion';
import {SceneTag} from '../components/motifs';
import {
  CornerNote,
  LedgerBar,
  MENU_ROWS,
  SkillMenuCard,
  Stage,
} from '../components/e1-motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';

/** 2-A 餐厅三联：菜单一行常驻（p2-02 高亮首行）→ 点了才开火（p2-03 灶焰）→
 *  后厨备料手册（p2-04 架上册子抽出一本）→ p2-05 三联向中收拢，浮出
 *  t1/t2/t3 三级标签条（配色对齐底部账本条三格）。 */
const RestaurantTrio: React.FC<{
  menuAt: number;
  rowAt: number;
  fireAt: number;
  shelfAt: number;
  foldAt: number;
}> = ({menuAt, rowAt, fireAt, shelfAt, foldAt}) => {
  const frame = useCurrentFrame();
  const menu = useEnter('fall', {at: menuAt, dur: DUR.f5, springPreset: 'settle'});
  const kitchen = useEnter('rise', {at: fireAt, dur: DUR.f5, springPreset: 'settle'});
  const shelf = useEnter('rise', {at: shelfAt, dur: DUR.f5, springPreset: 'settle'});
  const rowP = progress(frame, rowAt, DUR.f4); // p2-02：首行高亮 + 常驻标签
  const fireP = progress(frame, fireAt + DUR.f5, DUR.f4); // p2-03：灶焰点亮（卡入后即燃）
  const ember = useBreathe({period: 34, amp: 0.3, base: 0.7}); // 点燃后的余晖
  const pullP = progress(frame, shelfAt + DUR.f5, DUR.f4); // p2-04：抽出一本手册
  const foldP = progress(frame, foldAt, DUR.f6); // p2-05：收拢
  const box = (e: {opacity: number; transform: string}, driftX: number): React.CSSProperties => ({
    width: 300,
    height: 286,
    background: theme.panel,
    border: `1.5px solid ${theme.panelBorder}`,
    borderRadius: 12,
    padding: '18px 20px',
    opacity: e.opacity * (1 - foldP),
    transform: `${e.transform} translateX(${driftX}px) scale(${1 - 0.32 * foldP})`,
  });
  const chip = (c: string): React.CSSProperties => ({
    fontSize: 13.5,
    color: c,
    border: `1.5px solid ${c}88`,
    borderRadius: 999,
    padding: '3px 10px',
  });
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36}}>
      <div style={{display: 'flex', flexDirection: 'row', gap: 44}}>
        {/* 菜单一页：每行 = 菜名 + 一句话 */}
        <div style={box(menu, 190 * foldP)}>
          <div style={{fontSize: 14, color: theme.dim, letterSpacing: 3}}>菜单</div>
          {['招牌菜', '家常菜', '例汤'].map((d, i) => {
            const hot = i === 0 ? rowP : 0;
            return (
              <div
                key={d}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 12,
                  padding: '11px 12px',
                  borderRadius: 8,
                  border: `1.5px solid ${hot > 0 ? theme.conceptDeep : theme.panelBorder}`,
                  background: hot > 0 ? `${theme.conceptDeep}1F` : 'transparent',
                  opacity: i === 0 ? 0.55 + 0.45 * hot : 0.55,
                }}
              >
                <span style={{fontSize: 16.5, color: i === 0 ? theme.text : theme.dim, minWidth: 58}}>
                  {d}
                </span>
                {/* 一句话介绍：占位横线，不复述口播 */}
                <span
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    background: i === 0 && hot > 0 ? `${theme.conceptDeep}88` : theme.panelBorder,
                  }}
                />
              </div>
            );
          })}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: 10,
              marginTop: 16,
              opacity: rowP,
              transform: `translateY(${(1 - rowP) * 10}px)`,
            }}
          >
            <span style={chip(theme.conceptDeep)}>常驻</span>
            <span style={chip(theme.dim)}>不占厨房</span>
          </div>
        </div>
        {/* 厨房：点了才开火 */}
        <div style={box(kitchen, 0)}>
          <div style={{fontSize: 14, color: theme.dim, letterSpacing: 3}}>厨房</div>
          <svg width={240} height={170} viewBox="0 0 240 170" style={{marginTop: 6}}>
            <rect
              x={16}
              y={72}
              width={208}
              height={78}
              rx={12}
              fill={theme.panel}
              stroke={theme.panelBorder}
              strokeWidth={2}
            />
            <circle cx={78} cy={111} r={24} fill="none" stroke={theme.dim} strokeWidth={2.5} />
            <circle cx={162} cy={111} r={24} fill="none" stroke={theme.panelBorder} strokeWidth={2.5} />
            {/* 灶焰：外焰余晖呼吸 + 内焰实心 */}
            <g opacity={fireP}>
              <path
                d="M78 136 C67 120 69 104 78 90 C87 104 89 120 78 136 Z"
                fill={theme.concept}
                opacity={0.24 + 0.3 * ember}
              />
              <path d="M78 130 C72 119 74 108 78 99 C82 108 84 119 78 130 Z" fill={theme.concept} />
            </g>
          </svg>
          <div
            style={{
              fontSize: 16,
              color: theme.concept,
              marginTop: 10,
              opacity: fireP,
              textAlign: 'center',
            }}
          >
            点了才开火
          </div>
        </div>
        {/* 后厨架：备料手册，做到这步才翻 */}
        <div style={box(shelf, -190 * foldP)}>
          <div style={{fontSize: 14, color: theme.dim, letterSpacing: 3}}>后厨架</div>
          <div style={{position: 'relative', width: 240, height: 170, marginTop: 6}}>
            {[62, 128].map((y) => (
              <div
                key={y}
                style={{
                  position: 'absolute',
                  left: 8,
                  right: 8,
                  top: y,
                  height: 5,
                  borderRadius: 3,
                  background: theme.panelBorder,
                }}
              />
            ))}
            {/* 上层五本手册，中间一本被抽出 */}
            <div style={{position: 'absolute', left: 20, top: 8, display: 'flex', flexDirection: 'row', gap: 8}}>
              {[0, 1, 2, 3, 4].map((i) => {
                const pulled = i === 2;
                return (
                  <div
                    key={i}
                    style={{
                      width: 30,
                      height: 52,
                      borderRadius: 4,
                      background: pulled ? `${theme.concept}2E` : theme.panel,
                      border: `1.5px solid ${pulled ? theme.concept : theme.panelBorder}`,
                      transform: pulled ? `translateY(${-pullP * 16}px)` : undefined,
                      opacity: pulled ? 1 : 0.7,
                    }}
                  />
                );
              })}
            </div>
            {/* 下层三本 */}
            <div style={{position: 'absolute', left: 46, top: 78, display: 'flex', flexDirection: 'row', gap: 10}}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 34,
                    height: 46,
                    borderRadius: 4,
                    background: theme.panel,
                    border: `1.5px solid ${theme.panelBorder}`,
                    opacity: 0.7,
                  }}
                />
              ))}
            </div>
          </div>
          <div
            style={{
              fontSize: 16,
              color: theme.text,
              marginTop: 8,
              opacity: pullP,
              textAlign: 'center',
            }}
          >
            用到才翻
          </div>
        </div>
      </div>
      {/* p2-05 收拢产物：三级标签条（与账本条 t1/t2/t3 同色） */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 24,
          opacity: foldP,
          transform: `translateY(${(1 - foldP) * 26}px)`,
        }}
      >
        {([
          ['目录', 't1 · 常驻', theme.conceptDeep],
          ['正文', 't2 · 对口才读', theme.concept],
          ['资源', 't3 · 用到才读', theme.concept],
        ] as const).map(([k, sub, c]) => (
          <div
            key={k}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 10,
              padding: '12px 22px',
              borderRadius: 10,
              background: theme.panel,
              border: `1.5px solid ${c}77`,
            }}
          >
            <span style={{fontSize: 24, color: c, fontWeight: 600}}>{k}</span>
            <span style={{fontFamily: theme.mono, fontSize: 13.5, color: theme.dim}}>{sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** 2-B p2-09 回装置：六行目录块逐行亮出（M-001 同源夹具名），右侧 454 计数
 *  起跳——与底部账本条 t1 同锚双呈现（条上滚动、幕内定标）。 */
const CatalogStack: React.FC<{rowsAt: number; countAt: number; countDur: number}> = ({
  rowsAt,
  countAt,
  countDur,
}) => {
  const frame = useCurrentFrame();
  const st = useStagger(6, {at: rowsAt, dur: DUR.f3, stride: 4});
  const n = useCount({to: 454, at: countAt, dur: countDur});
  const showP = progress(frame, countAt, DUR.f4);
  return (
    <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 96}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 9, width: 620}}>
        {MENU_ROWS.map((r, i) => (
          <div
            key={r.id}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 14,
              paddingLeft: 14,
              borderLeft: `3px solid ${theme.concept}`,
              opacity: st[i],
              transform: `translateX(${(1 - st[i]) * -18}px)`,
            }}
          >
            <span
              style={{fontFamily: theme.mono, fontSize: 16.5, color: theme.conceptDeep, minWidth: 128}}
            >
              {r.id}
            </span>
            <span style={{fontSize: 14.5, color: theme.text}}>{r.label}</span>
            <span style={{fontSize: 13, color: theme.dim, marginLeft: 'auto'}}>一行</span>
          </div>
        ))}
      </div>
      <div style={{opacity: showP, transform: `translateY(${(1 - showP) * 16}px)`}}>
        <div style={{fontFamily: theme.mono, fontSize: 78, fontWeight: 700, color: theme.concept}}>
          {Math.round(n)}
        </div>
        <div style={{fontSize: 16, color: theme.text, marginTop: 6}}>目录块 · 常驻</div>
        <div style={{fontSize: 14, color: theme.dim, marginTop: 4}}>6 个 · 一行一个</div>
      </div>
    </div>
  );
};

/** 2-C 原型走查：任务单〔M-005〕→ 目录对上（菜单卡打勾在幕级 chrome 层同步）→
 *  正文整份翻开（t2 逐笔滚动累计）→ 审批名单文件弹出（+97 计 t3）→ p2-13
 *  「五份共 +62」合计徽章随口播弹出（62 是整轮五份正文的合计，非单份——与
 *  口播「五份正文共加约六十二」对齐；合计 613 由底部账本条定格）。 */
const Walkthrough: React.FC<{
  taskAt: number;
  matchAt: number;
  plus62At: number;
  fileAt: number;
  plus97At: number;
  sumAt: number;
}> = ({taskAt, matchAt, plus62At, fileAt, plus97At, sumAt}) => {
  const frame = useCurrentFrame();
  const ticket = useEnter('pop', {at: taskAt, dur: DUR.f5, springPreset: 'settle'});
  const arrow = useDraw(matchAt, DUR.f5); // p2-11：目录行对上号
  const matchP = progress(frame, matchAt, DUR.f4);
  const pageOpen = useSpring('settle', {at: matchAt, dur: DUR.f6}); // 正文翻开的位移通道
  const pageO = progress(frame, matchAt, DUR.f4);
  const lines = useStagger(5, {at: matchAt, dur: DUR.f3, stride: 6});
  const b62 = useSpring('settle', {at: plus62At, dur: DUR.f4});
  const b62o = progress(frame, plus62At, DUR.f3);
  const file = useEnter('fall', {at: fileAt, dur: DUR.f5, springPreset: 'settle'});
  const b97 = progress(frame, plus97At, DUR.f3);
  const restP = progress(frame, sumAt, DUR.f5); // p2-13：没点到的技能
  const dimDone = 1 - 0.35 * restP; // 走查完成后走查件轻微退后
  const badge = (o: number, s: number): React.CSSProperties => ({
    fontFamily: theme.mono,
    fontSize: 22,
    fontWeight: 700,
    color: theme.concept,
    border: `2px solid ${theme.concept}`,
    borderRadius: 999,
    padding: '4px 14px',
    opacity: o,
    transform: `scale(${0.6 + 0.4 * s})`,
    background: `${theme.concept}14`,
  });
  return (
    <div style={{position: 'relative', width: 1180, height: 600}}>
      {/* 任务单：第一句请求 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 44,
          width: 282,
          background: theme.panel,
          border: `1.5px dashed ${theme.conceptDeep}99`,
          borderRadius: 12,
          padding: '16px 20px',
          opacity: ticket.opacity * dimDone,
          transform: ticket.transform,
        }}
      >
        <div style={{fontSize: 13, color: theme.dim, letterSpacing: 2}}>任务单</div>
        <div style={{fontSize: 25, color: theme.text, marginTop: 8}}>换班</div>
        <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 6}}>
          周五 × 小李
        </div>
      </div>
      {/* 对上号：任务单 → 正文页的连线（菜单卡打勾同步在 chrome 层） */}
      <svg width={116} height={46} viewBox="0 0 116 46" style={{position: 'absolute', left: 306, top: 104}}>
        <line
          x1={2}
          y1={23}
          x2={98}
          y2={23}
          stroke={theme.conceptDeep}
          strokeWidth={3}
          strokeLinecap="round"
          {...arrow}
        />
        <path d="M96 14 L114 23 L96 32 Z" fill={theme.conceptDeep} opacity={matchP} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 318,
          top: 148,
          fontSize: 14,
          color: theme.conceptDeep,
          border: `1.5px solid ${theme.conceptDeep}66`,
          borderRadius: 999,
          padding: '2px 10px',
          opacity: matchP * dimDone,
        }}
      >
        对上号
      </div>
      {/* 正文页：整份读入（合页式翻开） */}
      <div
        style={{
          position: 'absolute',
          left: 448,
          top: 0,
          width: 350,
          height: 442,
          background: theme.panel,
          border: `1.5px solid ${theme.panelBorder}`,
          borderRadius: 10,
          padding: '18px 22px',
          opacity: pageO * dimDone,
          transform: `scaleX(${0.1 + 0.9 * pageOpen})`,
          transformOrigin: 'left center',
        }}
      >
        <div style={{display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: 12}}>
          <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.text}}>SKILL.md</span>
          <span style={{fontSize: 13.5, color: theme.concept}}>正文 · 整份读入</span>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 18, marginTop: 24}}>
          {lines.map((p, i) => (
            <div
              key={i}
              style={{
                height: 11,
                borderRadius: 5,
                background: i % 3 === 2 ? `${theme.panelBorder}AA` : `${theme.conceptDeep}44`,
                width: [100, 86, 96, 70, 90][i],
                opacity: p,
                transform: `translateX(${(1 - p) * -14}px)`,
              }}
            />
          ))}
        </div>
        <div style={{fontSize: 13, color: theme.dim, marginTop: 26, opacity: lines[4]}}>
          整份读入 · 账上添一笔
        </div>
      </div>
      {/* 五份共 +62 徽章：整轮正文的合计账（p2-13 口播「五份正文共加约六十二」；
       *  单份≈12 不单独标数；t2 在底部账本条滚动累计） */}
      <div style={{position: 'absolute', left: 812, top: 128}}>
        <span style={badge(b62o, b62)}>五份共 +62</span>
      </div>
      {/* 审批名单：正文指路翻出的参考文件（t3） */}
      <div
        style={{
          position: 'absolute',
          left: 812,
          top: 236,
          width: 306,
          background: theme.panel,
          border: `1.5px solid ${theme.panelBorder}`,
          borderRadius: 10,
          padding: '14px 18px',
          opacity: file.opacity * dimDone,
          transform: file.transform,
        }}
      >
        <div style={{fontSize: 13, color: theme.dim, letterSpacing: 2}}>参考文件</div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            marginTop: 8,
          }}
        >
          <span style={{fontSize: 19, color: theme.text}}>审批名单</span>
          <span style={badge(b97, 1)}>+97</span>
        </div>
      </div>
      {/* p2-13：没被点到的技能，始终只占一行 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: 1180,
          opacity: restP,
          transform: `translateY(${(1 - restP) * 18}px)`,
        }}
      >
        <div style={{fontSize: 15, color: theme.dim, marginBottom: 10}}>未点到 · 一行</div>
        <div style={{display: 'flex', flexDirection: 'row', gap: 12}}>
          {MENU_ROWS.filter((r) => r.id !== 'shift-swap').map((r) => (
            <span
              key={r.id}
              style={{
                fontFamily: theme.mono,
                fontSize: 13.5,
                color: theme.dim,
                border: `1px solid ${theme.panelBorder}`,
                borderRadius: 8,
                padding: '6px 12px',
                opacity: 0.75,
              }}
            >
              {r.id} · 一行
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

/** 2-D 预算门：Codex 把账硬化成配额——2% 金条推入（p2-14）→ 整条上下文窗口
 *  点亮为开工视野（p2-14a）→ 8000 字符标尺落下、截短一条 description（p2-15）
 *  → 二十行目录 ≠ 二十份正文的天平（p2-16：重侧先坐实再化影——未预付）。 */
const BudgetGate: React.FC<{
  gateAt: number;
  winAt: number;
  rulerAt: number;
  cutAt: number;
  scaleAt: number;
  scaleDur: number;
}> = ({gateAt, winAt, rulerAt, cutAt, scaleAt, scaleDur}) => {
  const frame = useCurrentFrame();
  const panelO = progress(frame, gateAt, DUR.f4); // p2-14：面板 + 2% 金条
  const stripP = progress(frame, gateAt, DUR.f5);
  const winP = progress(frame, winAt, DUR.f5); // p2-14a：窗口整条点亮
  const ruler = useEnter('fall', {at: rulerAt, dur: DUR.f5, springPreset: 'settle'}); // p2-15：标尺落下
  const cutP = progress(frame, cutAt, DUR.f5); // 截短：尾部剥落
  const scaleP = progress(frame, scaleAt, scaleDur); // p2-16：天平
  const tilt = 9 * (win(scaleP, [0, 0.4]) - win(scaleP, [0.4, 1])); // 先倾向正文侧，后回平
  const ghost = win(scaleP, [0.45, 0.95]); // 正文堆化影：不预付
  const descBarW = 620;
  const cutX = 470; // 截短线 = 标尺落点
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 30,
        width: 1120,
        opacity: panelO,
      }}
    >
      {/* 面板抬头 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 18,
          alignSelf: 'flex-start',
          paddingLeft: 6,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.deny, fontWeight: 600}}>
          Codex · 预算门
        </span>
        <span style={{fontSize: 15, color: theme.dim}}>上下文窗口配额</span>
      </div>
      {/* 上下文窗口横条：整条 = 开工视野，左端金条 = 技能目录 */}
      <div style={{position: 'relative', width: 1040, height: 86}}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 32,
            width: '100%',
            height: 54,
            borderRadius: 8,
            border: `1.5px solid ${theme.panelBorder}`,
            overflow: 'hidden',
          }}
        >
          {/* p2-14a：整条点亮（自左向右铺满） */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${100 * winP}%`,
              background: `${theme.conceptDeep}30`,
              borderRight: `2px solid ${theme.conceptDeep}AA`,
            }}
          />
          {/* p2-14：2% 窄金条推入 */}
          <div
            style={{
              position: 'absolute',
              left: 8,
              top: 6,
              bottom: 6,
              width: 21,
              borderRadius: 4,
              background: theme.concept,
              transform: `scaleX(${stripP})`,
              transformOrigin: 'left center',
            }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 2,
            top: 0,
            fontSize: 13.5,
            color: theme.concept,
            opacity: stripP,
          }}
        >
          技能目录 · 2%
        </div>
        <div
          style={{
            position: 'absolute',
            right: 2,
            top: 0,
            fontSize: 13.5,
            color: theme.conceptDeep,
            opacity: winP,
          }}
        >
          开工视野
        </div>
      </div>
      {/* 8000 字符标尺 + 截短一条 description */}
      <div style={{position: 'relative', width: 1040, height: 132, opacity: ruler.opacity}}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 58,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>description</span>
          <div style={{position: 'relative', width: descBarW, height: 18}}>
            {/* 保留段：截短后以省略号收尾 */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: 18,
                borderRadius: 5,
                width: cutX,
                background: `${theme.conceptDeep}55`,
                border: `1px solid ${cutP > 0 ? theme.conceptDeep : theme.panelBorder}`,
              }}
            />
            {/* 剥落段：被标尺截掉、坠落淡出 */}
            <div
              style={{
                position: 'absolute',
                left: cutX,
                top: 0,
                height: 18,
                borderRadius: 5,
                width: descBarW - cutX,
                background: `${theme.danger}44`,
                border: `1px solid ${theme.danger}88`,
                transform: `translateY(${cutP * 44}px) rotate(${cutP * 26}deg)`,
                opacity: 1 - cutP,
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: cutX + 8,
                top: 0,
                fontSize: 15,
                color: theme.dim,
                opacity: cutP,
              }}
            >
              …
            </span>
          </div>
          {cutP > 0.5 && (
            <span
              style={{
                fontSize: 13.5,
                color: theme.danger,
                border: `1.5px solid ${theme.danger}88`,
                borderRadius: 999,
                padding: '2px 10px',
                opacity: cutP,
              }}
            >
              截短
            </span>
          )}
        </div>
        {/* 标尺本体：竖线 + 端帽 + 8000 刻度（落在截短线上方） */}
        <div style={{position: 'absolute', left: cutX + 96, top: 0, transform: ruler.transform}}>
          <svg width={10} height={54} viewBox="0 0 10 54">
            <line x1={5} y1={4} x2={5} y2={50} stroke={theme.deny} strokeWidth={3} strokeLinecap="round" />
            <line x1={0} y1={4} x2={10} y2={4} stroke={theme.deny} strokeWidth={3} strokeLinecap="round" />
            <line x1={0} y1={50} x2={10} y2={50} stroke={theme.deny} strokeWidth={3} strokeLinecap="round" />
          </svg>
          <div
            style={{
              position: 'absolute',
              left: 18,
              top: 16,
              whiteSpace: 'nowrap',
              fontFamily: theme.mono,
              fontSize: 14.5,
              color: theme.deny,
            }}
          >
            ≤ 8000 字符
          </div>
        </div>
      </div>
      {/* p2-16 天平：左盘 20 枚目录行（金），右盘 20 份正文（化影） */}
      <div style={{position: 'relative', width: 620, height: 236}}>
        <svg width={620} height={236} viewBox="0 0 620 236">
          <polygon points="310,236 282,176 338,176" fill={theme.panelBorder} />
          <g transform={`rotate(${tilt} 310 96)`} opacity={scaleP > 0 ? 1 : 0}>
            <line x1={70} y1={96} x2={550} y2={96} stroke={theme.dim} strokeWidth={5} strokeLinecap="round" />
            <line x1={70} y1={96} x2={70} y2={150} stroke={theme.panelBorder} strokeWidth={2.5} />
            <path d="M30 150 H110 L96 184 H44 Z" fill={theme.panel} stroke={theme.concept} strokeWidth={2} />
            <line x1={550} y1={96} x2={550} y2={150} stroke={theme.panelBorder} strokeWidth={2.5} />
            <path d="M505 150 H595 L578 184 H522 Z" fill={theme.panel} stroke={theme.panelBorder} strokeWidth={2} />
            {/* 左盘：20 枚小金格（5×4）——装 20 个技能的目录行 */}
            {Array.from({length: 20}, (_, i) => (
              <rect
                key={i}
                x={40 + (i % 5) * 13}
                y={156 + Math.floor(i / 5) * 7}
                width={10}
                height={5}
                fill={theme.concept}
                opacity={0.9}
              />
            ))}
            {/* 右盘：页堆——先坐实（naive 预付）再化影（未预付） */}
            {[0, 1, 2].map((i) => (
              <rect
                key={i}
                x={520 + i * 9}
                y={150 - i * 9}
                width={54}
                height={30}
                rx={3}
                fill={theme.panel}
                stroke={theme.dim}
                strokeWidth={1.5}
                opacity={1 - ghost * 0.78}
              />
            ))}
          </g>
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: 260,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 14.5,
            color: theme.concept,
            opacity: scaleP,
          }}
        >
          20 × 目录行
        </div>
        <div
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 300,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            opacity: scaleP,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 14.5, color: theme.dim}}>≠ 20 份正文</span>
          <span style={{fontSize: 13, color: theme.concept, opacity: ghost}}>不预付</span>
        </div>
      </div>
    </div>
  );
};

/** 2-E X4 消融（p2-18..20）：常驻水位 613→694——红段延伸的长度，恰好是那份
 *  从未被读的 submit.py（预载侧镜在底部账本条：t2 暴涨 / t3 清零 / 合计染红）；
 *  p2-20 金句卡压场。 */
const X4Mirror: React.FC<{riseAt: number; fileAt: number; quoteAt: number}> = ({
  riseAt,
  fileAt,
  quoteAt,
}) => {
  const frame = useCurrentFrame();
  const showP = progress(frame, riseAt, DUR.f4); // p2-18：水位轨登场
  const drawRed = useDraw(riseAt, DUR.f6); // 红段自 613 向 694 延伸
  const fileP = progress(frame, fileAt, DUR.f4); // p2-19：元凶文件亮出
  const quoteP = progress(frame, quoteAt, DUR.f5); // p2-20：金句卡
  const quotePush = usePushIn(quoteAt, {scale: 0.05});
  const trackDim = 1 - 0.72 * quoteP;
  // 轨道几何：0..750 token 映射到 x 20..1100（1.44 px/token）
  const x613 = Math.round(20 + 613 * 1.44);
  const x694 = Math.round(20 + 694 * 1.44);
  const midX = Math.round((x613 + x694) / 2);
  return (
    <div style={{position: 'relative', width: 1120, height: 560}}>
      <div style={{position: 'absolute', left: 0, top: 60, width: 1120, opacity: showP * trackDim}}>
        <svg width={1120} height={214} viewBox="0 0 1120 214">
          {/* 基线轴 */}
          <line
            x1={20}
            y1={150}
            x2={1100}
            y2={150}
            stroke={theme.panelBorder}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          {/* 613 基线刻度（消融前水位） */}
          <line x1={x613} y1={136} x2={x613} y2={164} stroke={`${theme.concept}AA`} strokeWidth={3} strokeLinecap="round" />
          {/* 红段：613 → 694（pathLength 描线延伸） */}
          <line
            x1={x613}
            y1={150}
            x2={x694}
            y2={150}
            stroke={theme.danger}
            strokeWidth={8}
            strokeLinecap="round"
            {...drawRed}
          />
          {/* 694 端刻度 + 元凶吊线 */}
          <line x1={x694} y1={128} x2={x694} y2={164} stroke={theme.danger} strokeWidth={3} strokeLinecap="round" />
          <line
            x1={midX}
            y1={140}
            x2={midX}
            y2={96}
            stroke={theme.danger}
            strokeWidth={2}
            strokeDasharray="4 6"
            opacity={fileP}
          />
        </svg>
        {/* 刻度数字（实测口径） */}
        <div
          style={{
            position: 'absolute',
            left: x613 - 30,
            top: 172,
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.concept,
          }}
        >
          613
        </div>
        <div style={{position: 'absolute', left: x613 - 42, top: 200, fontSize: 12.5, color: theme.dim}}>
          消融前水位
        </div>
        <div
          style={{
            position: 'absolute',
            left: x694 - 96,
            top: 172,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 8,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 26, fontWeight: 700, color: theme.danger}}>694</span>
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.danger}}>+13%</span>
        </div>
        {/* p2-19：红段端头标签——那份从未被读的脚本 */}
        <div
          style={{
            position: 'absolute',
            left: midX - 158,
            top: 26,
            width: 316,
            textAlign: 'center',
            opacity: fileP,
            transform: `translateY(${(1 - fileP) * -10}px)`,
          }}
        >
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 15,
              color: theme.danger,
              border: `1.5px dashed ${theme.danger}99`,
              borderRadius: 8,
              padding: '4px 12px',
            }}
          >
            submit.py
          </span>
          <div style={{fontSize: 14, color: theme.danger, marginTop: 8}}>管提交的脚本 · 从未被读</div>
        </div>
      </div>
      {/* p2-20 金句卡 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: quoteP,
          transform: quotePush,
          pointerEvents: 'none',
        }}
      >
        <div style={{textAlign: 'center'}}>
          <div style={{fontSize: 16, color: theme.dim, letterSpacing: 3, marginBottom: 16}}>X4 消融</div>
          <div
            style={{
              fontFamily: theme.serif,
              fontSize: 46,
              fontWeight: 700,
              color: theme.concept,
              lineHeight: 1.4,
            }}
          >
            按需 = 成本模型本身
          </div>
        </div>
      </div>
    </div>
  );
};

/** 2-F X5 压缩保护 + 钩子：压缩机横扫上下文格阵——左卡正文带豁免盾纹丝不动，
 *  右卡拆掉保护后正文被压碎（留存 0 份 · 报错信号：无）；p2-23 焦点让给菜单
 *  卡上的不撤桌章（幕级 chrome 层）；p2-24 推向下一行菜的 description。 */
const CompactGuard: React.FC<{
  sweepAt: number;
  sweepDur: number;
  crushAt: number;
  focusAt: number;
  hookAt: number;
}> = ({sweepAt, sweepDur, crushAt, focusAt, hookAt}) => {
  const frame = useCurrentFrame();
  const sweepP = progress(frame, sweepAt, sweepDur); // p2-22：压缩机横扫
  const crushP = progress(frame, crushAt, DUR.f5); // 右卡正文压碎
  const shakeX = useShake({at: crushAt, amp: 4, freq: 1.4, decay: true, dur: DUR.f6});
  const shieldGlow = useBreathe({period: 40, amp: 0.25, base: 0.75}); // 豁免盾常亮呼吸
  const shieldFlash = useImpulse({at: sweepAt + Math.round(sweepDur * 0.28), dur: DUR.f5}); // 扫过盾时的一次强调
  const focusP = progress(frame, focusAt, DUR.f5); // p2-23：让位给不撤桌章
  const hookP = progress(frame, hookAt, DUR.f4); // p2-24：钩子
  const hookPush = usePushIn(hookAt, {scale: 0.07});
  const hookGlow = useBreathe({period: 46, amp: 0.3, base: 0.7});
  const lp = win(sweepP * 2, [0, 1]); // 扫过左卡的局部进度
  const rp = win(sweepP * 2 - 1, [0, 1]); // 扫过右卡的局部进度
  const guardO = (1 - 0.55 * focusP) * (1 - hookP);
  // 下一道菜：M-001 事实源里的 report-merger（换班之后的那行）
  const nextRow = MENU_ROWS[1];
  // 格阵几何：8×3 格，格宽 50 / 格高 34 / 间隙 4；正文块压在第 2 行第 4..6 格。
  //  blockTop 基数 = padding-top 16 + 表头行高 ~22 + 格阵 marginTop 12（对齐卡内
  // 第 2 行格顶；此前基数 66 漏算表头，块整体低 ~16px 且因缺 relative 锚错容器）
  const CELL_W = 50;
  const CELL_H = 34;
  const GAP = 4;
  const blockLeft = 20 + 3 * (CELL_W + GAP);
  const blockTop = 50 + 1 * (CELL_H + GAP);
  const blockW = 3 * CELL_W + 2 * GAP;
  /** 上下文格阵：横扫过的早期内容压暗（压缩腾地方），正文块独立叠加。 */
  const grid = (localP: number) => (
    <div style={{position: 'relative', width: 428, height: 3 * CELL_H + 2 * GAP, marginTop: 12}}>
      {Array.from({length: 24}, (_, i) => {
        const col = i % 8;
        const compacted = col / 8 < localP; // 扫过即压缩
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: col * (CELL_W + GAP),
              top: Math.floor(i / 8) * (CELL_H + GAP),
              width: CELL_W,
              height: CELL_H,
              borderRadius: 4,
              background: compacted ? `${theme.panelBorder}22` : `${theme.panelBorder}55`,
              border: `1px solid ${compacted ? theme.panelBorder : `${theme.panelBorder}AA`}`,
            }}
          />
        );
      })}
    </div>
  );
  /** 单卡壳：prot 决定完好（ok 绿沿）/ 拆解（danger 沿）双态语义色。
   *  position:relative 是卡内 absolute 正文块/碎片的定位锚——缺了会锚到
   * 外层行容器，双卡同值坐标全部叠到左卡。 */
  const cardBox = (prot: boolean): React.CSSProperties => ({
    position: 'relative',
    width: 470,
    background: theme.panel,
    border: `1.5px solid ${prot ? `${theme.ok}55` : `${theme.danger}55`}`,
    borderRadius: 12,
    padding: '16px 20px',
  });
  return (
    <div style={{position: 'relative', width: 1120, height: 520}}>
      {/* 双卡：左完好 / 右拆解 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          display: 'flex',
          flexDirection: 'row',
          gap: 60,
          opacity: guardO,
        }}
      >
        {/* 左卡：正文带豁免盾，纹丝不动 */}
        <div style={cardBox(true)}>
          <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10}}>
            <span style={{fontSize: 16, color: theme.ok, fontWeight: 600}}>保护开启</span>
            <span style={{fontSize: 13, color: theme.dim}}>长对话压缩</span>
          </div>
          {grid(lp)}
          {/* 正文块：金 + 豁免盾（扫过时一次强调，此后常亮呼吸） */}
          <div
            style={{
              position: 'absolute',
              left: blockLeft,
              top: blockTop,
              width: blockW,
              height: CELL_H,
              borderRadius: 4,
              background: `${theme.concept}33`,
              border: `1.5px solid ${theme.concept}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transform: `scale(${1 + 0.1 * shieldFlash})`,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.concept}}>正文</span>
            <span
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                fontSize: 12.5,
                color: theme.ok,
                border: `1.5px solid ${theme.ok}99`,
                borderRadius: 6,
                padding: '1px 7px',
                opacity: 0.55 + 0.45 * shieldGlow,
                background: `${theme.ok}14`,
              }}
            >
              <svg width={11} height={13} viewBox="0 0 11 13">
                <path
                  d="M5.5 1 L10 3 V7 C10 10 8 11.6 5.5 12.5 C3 11.6 1 10 1 7 V3 Z"
                  fill={`${theme.ok}33`}
                  stroke={theme.ok}
                  strokeWidth={1.5}
                />
              </svg>
              豁免
            </span>
          </div>
          <div style={{fontSize: 13.5, color: theme.ok, marginTop: 16, opacity: lp}}>
            不被裁走
          </div>
        </div>
        {/* 右卡：拆掉保护，正文被压碎 */}
        <div style={cardBox(false)}>
          <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10}}>
            <span style={{fontSize: 16, color: theme.danger, fontWeight: 600}}>保护拆除</span>
            <span style={{fontSize: 13, color: theme.dim}}>同一轮压缩</span>
          </div>
          {grid(rp)}
          {/* 正文块：压碎（红） + 碎片飞散 */}
          <div
            style={{
              position: 'absolute',
              left: blockLeft,
              top: blockTop,
              width: blockW,
              height: CELL_H,
              borderRadius: 4,
              background: crushP > 0 ? `${theme.danger}33` : `${theme.concept}33`,
              border: `1.5px solid ${crushP > 0 ? theme.danger : theme.concept}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `translateX(${shakeX}px)`,
            }}
          >
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 14,
                color: crushP > 0 ? theme.danger : theme.concept,
              }}
            >
              正文
            </span>
          </div>
          {/* 碎片：四枚小金格自块心飞散淡出 */}
          {crushP > 0 &&
            [0, 1, 2, 3].map((j) => (
              <div
                key={j}
                style={{
                  position: 'absolute',
                  left: blockLeft + blockW / 2 + (j % 2 === 0 ? -30 : 18),
                  top: blockTop + 8,
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: theme.danger,
                  opacity: 1 - crushP,
                  transform: `translate(${(j % 2 === 0 ? -1 : 1) * 34 * crushP}px, ${
                    (j < 2 ? -1 : 1) * 26 * crushP
                  }px) rotate(${crushP * 90}deg)`,
                }}
              />
            ))}
          {/* 拆解侧的判词：静默退化 */}
          <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, opacity: crushP}}>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 13.5,
                color: theme.danger,
                border: `1.5px solid ${theme.danger}88`,
                borderRadius: 999,
                padding: '2px 10px',
              }}
            >
              留存 0 份
            </span>
            <span style={{fontSize: 13, color: theme.dim, opacity: 0.85}}>策略悄悄失效</span>
          </div>
        </div>
      </div>
      {/* 压缩机：自左横扫双卡的斜纹竖杠 */}
      <div
        style={{
          position: 'absolute',
          left: -40 + sweepP * 1200,
          top: -14,
          width: 12,
          height: 400,
          opacity: sweepP > 0 && sweepP < 1 ? 1 : 0,
          background: `repeating-linear-gradient(45deg, ${theme.danger}66 0 8px, transparent 8px 16px)`,
          borderLeft: `2px solid ${theme.danger}`,
          borderRadius: 3,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: -22,
            left: -14,
            fontSize: 12.5,
            color: theme.danger,
            whiteSpace: 'nowrap',
          }}
        >
          压缩
        </span>
      </div>
      {/* 拆解侧的大判词：报错信号：无（压碎后定格） */}
      <div
        style={{
          position: 'absolute',
          right: 40,
          top: 400,
          fontSize: 30,
          fontWeight: 700,
          color: theme.danger,
          letterSpacing: 2,
          opacity: guardO * crushP,
        }}
      >
        报错信号：无
      </div>
      {/* p2-24 钩子：镜头推向下一道菜的 description 那句话（靛蓝高亮） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: hookP,
          transform: hookPush,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 780,
            background: theme.panel,
            border: `1.5px solid ${theme.panelBorder}`,
            borderRadius: 12,
            padding: '28px 36px',
          }}
        >
          <div style={{display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: 14}}>
            <span style={{fontFamily: theme.mono, fontSize: 23, color: theme.conceptDeep}}>
              {nextRow.id}
            </span>
            <span style={{fontSize: 17, color: theme.text}}>{nextRow.label}</span>
            <span style={{fontSize: 13.5, color: theme.dim, marginLeft: 'auto'}}>下一道菜</span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              marginTop: 22,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>description</span>
            {/* 那句话：靛蓝高亮呼吸（P3 的主角在此预亮） */}
            <div
              style={{
                flex: 1,
                height: 22,
                borderRadius: 6,
                background: `${theme.conceptDeep}44`,
                border: `1.5px solid ${theme.conceptDeep}`,
                boxShadow: `0 0 ${8 + 16 * hookGlow}px ${theme.conceptDeep}55`,
              }}
            />
            <span style={{fontFamily: theme.serif, fontSize: 34, color: theme.conceptDeep}}>?</span>
          </div>
          <div style={{fontSize: 14.5, color: theme.dim, marginTop: 18}}>谁被点上</div>
        </div>
      </div>
    </div>
  );
};

/** 幕级常驻层：〔M-001〕菜单卡 + 〔M-002〕账本条整幕不卸载——打勾（p2-11）、
 *  三格计数（p2-09 起 t1、2-C 累计 t2/t3）、红侧镜（p2-18：t2 暴涨 / t3 清零 /
 *  合计 694 染红 +13%）、不撤桌章（p2-23）都在这一层演进；archify 全屏窗内
 *  双装置 dimmed 让位（窗列表与各镜 ArchifyRecap cues 同源、独立字面量维护）。
 *  合计恒等于 t1+t2+t3（帧驱动纯函数，三格与合计永不脱账）。 */
const MenuLedgerChrome: React.FC<{
  checkAt: number;
  t1At: number;
  t1Dur: number;
  t2At: number;
  t2Span: number;
  t3At: number;
  t3Dur: number;
  redAt: number;
  redDur: number;
  stampAt: number;
  coverWins: {at: number; durationInFrames: number}[];
}> = ({checkAt, t1At, t1Dur, t2At, t2Span, t3At, t3Dur, redAt, redDur, stampAt, coverWins}) => {
  const frame = useCurrentFrame();
  // t1：p2-09 六行目录 454 起跳
  const t1 = useCount({to: 454, at: t1At, dur: t1Dur});
  // t2：2-C 五份正文累计 +62 → X4 预载暴涨 +178（62→240）
  const t2a = useCount({to: 62, at: t2At, dur: t2Span});
  const t2b = useCount({to: 178, at: redAt, dur: redDur});
  // t3：p2-12 审批名单 +97 → X4 预载后资源并入正文侧、格清零（清零须与 t2b
  //  同曲线同速对冲——useProgress 与 useCount 同走 standard 缓动，合计恒
  //  613+81·e(p) 单调涨；clear 用 DUR.f4 或线性 progress 都会在句首/句末
  //  跌穿 613，与口播「从六百一十三涨到六百九十四」相悖）
  const t3raw = useCount({to: 97, at: t3At, dur: t3Dur});
  const clear = useProgress(redAt, redDur);
  const t2 = t2a + t2b;
  const t3 = t3raw * (1 - clear);
  // archify 全屏窗：双装置 dimmed（cover>0.4 阈值布尔硬跳——非 ArchifyYield 连续淡化口径，
  // 双装置 opacity 单帧阶跃 1.0→0.45/0.35；v1–v11 QA 无闪烁瑕疵证据，v11 如实登记差异）
  const cover = Math.max(
    0,
    ...coverWins.map((c) =>
      progress(frame, c.at, DUR.f3) * (1 - progress(frame, c.at + c.durationInFrames, DUR.f3)),
    ),
  );
  const dimmed = cover > 0.4;
  // p2-11：目录对上号，菜单卡换班行打勾（chrome 层与 2-C 舞台同步）
  const checkedRow = frame >= checkAt ? 'shift-swap' : undefined;
  // p2-23：点过的菜不撤桌——已打勾行盖「不撤桌」章（snap 落章 + 轻微旋转）
  const stampS = useSpring('snap', {at: stampAt, dur: DUR.f5});
  const stampO = progress(frame, stampAt, DUR.f3);
  return (
    <>
      <SkillMenuCard appearAt={0} checkedRow={checkedRow} dimmed={dimmed} />
      <LedgerBar t1={t1} t2={t2} t3={t3} sum={t1 + t2 + t3} redModeAt={redAt} dimmed={dimmed} />
      {/* 不撤桌章：盖在菜单卡首行（shift-swap）上，卡几何 right:40/top:72/w:316 */}
      {stampO > 0 && (
        <div
          style={{
            position: 'absolute',
            right: 148,
            top: 84,
            width: 94,
            height: 94,
            borderRadius: '50%',
            border: `2.5px solid ${theme.concept}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.concept,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 2,
            opacity: stampO,
            transform: `rotate(-9deg) scale(${1.9 - 0.9 * stampS})`,
            zIndex: 41,
            pointerEvents: 'none',
            background: `${theme.bg}d9`,  /* 底板对齐 P3「独扛路由」章语言（透明底致章字与行名叠成乱字） */
          }}
        >
          不撤桌
        </div>
      )}
    </>
  );
};

export const P2MenuLedger: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p2-01', 'p2-05');
  const bB = w('p2-06', 'p2-09');
  const bC = w('p2-10', 'p2-13');
  const bD = w('p2-14', 'p2-16');
  const bE = w('p2-17', 'p2-20');
  const bF = w('p2-21', 'p2-24');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A 餐厅类比">
        <SceneTag chapter="P2" tagline="一页菜单" accent={theme.concept} />
        <Stage>
          <RestaurantTrio
            menuAt={at('p2-01') - bA.from}
            rowAt={at('p2-02') - bA.from}
            fireAt={at('p2-03') - bA.from}
            shelfAt={at('p2-04') - bA.from}
            foldAt={at('p2-05') - bA.from}
          />
        </Stage>
      </Sequence>

      <Sequence {...bB} name="2-B 三级记账">
        <SceneTag chapter="P2" tagline="一页菜单" accent={theme.concept} />
        {/* lifecycle 三章连播：目录常驻 → 激活 → 按需执行（同实例连续换章；
            p2-06a 并入首章窗消空窗，p2-09 无 cue 回装置） */}
        <ArchifyRecap
          slug="lifecycle"
          caption="生命周期 · 三级记账"
          cues={[
            {chapterId: 'lc-catalog', at: at('p2-06') - bB.from, durationInFrames: dur('p2-06') + dur('p2-06a'), },
            {chapterId: 'lc-activate', at: at('p2-07') - bB.from, durationInFrames: dur('p2-07')},
            {chapterId: 'lc-execute', at: at('p2-08') - bB.from, durationInFrames: dur('p2-08')},
          ]}
        />
        {/* p2-09：回装置——六行目录 + 454 定标（账本条 t1 同锚滚动） */}
        <Stage>
          <CatalogStack
            rowsAt={at('p2-09') - bB.from}
            countAt={at('p2-09') - bB.from}
            countDur={dur('p2-09')}
          />
        </Stage>
        <CornerNote text="454 · 原型实测（chars/4）" x={48} y={904} />
      </Sequence>

      <Sequence {...bC} name="2-C 原型走查">
        <SceneTag chapter="P2" tagline="一页菜单" accent={theme.concept} />
        <Stage>
          <Walkthrough
            taskAt={at('p2-10') - bC.from}
            matchAt={at('p2-11') - bC.from}
            plus62At={at('p2-13') - bC.from + Math.round(dur('p2-13') * 0.22)}
            fileAt={at('p2-12') - bC.from}
            plus97At={at('p2-12') - bC.from + Math.round(dur('p2-12') * 0.5)}
            sumAt={at('p2-13') - bC.from}
          />
        </Stage>
        <CornerNote text="454+62+97 → 613 · 原型实测（chars/4）" x={48} y={904} />
      </Sequence>

      <Sequence {...bD} name="2-D 预算门">
        <SceneTag chapter="P2" tagline="一页菜单" accent={theme.concept} />
        <Stage>
          <BudgetGate
            gateAt={at('p2-14') - bD.from}
            winAt={at('p2-14a') - bD.from}
            rulerAt={at('p2-15') - bD.from}
            cutAt={at('p2-15') - bD.from + Math.round(dur('p2-15') * 0.5)}
            scaleAt={at('p2-16') - bD.from}
            scaleDur={dur('p2-16')}
          />
        </Stage>
        <CornerNote text="Codex 预算门 · 官方文档口径" x={48} y={904} />
      </Sequence>

      <Sequence {...bE} name="2-E X4 消融">
        <SceneTag chapter="P2" tagline="一页菜单" accent={theme.concept} />
        {/* lifecycle 按需执行章：p2-17 全屏；p2-18..20 回装置看水位与金句 */}
        <ArchifyRecap
          slug="lifecycle"
          caption="生命周期 · 按需执行"
          cues={[
            {chapterId: 'lc-execute', at: at('p2-17') - bE.from, durationInFrames: dur('p2-17')},
          ]}
        />
        <Stage>
          <X4Mirror
            riseAt={at('p2-18') - bE.from}
            fileAt={at('p2-19') - bE.from}
            quoteAt={at('p2-20') - bE.from}
          />
        </Stage>
        <CornerNote text="X4 预载消融 · 原型实测（chars/4）" x={48} y={904} />
      </Sequence>

      <Sequence {...bF} name="2-F X5 与钩子">
        <SceneTag chapter="P2" tagline="一页菜单" accent={theme.concept} />
        {/* lifecycle 压缩保护章：p2-21 全屏；p2-22..24 回装置（章/钩子） */}
        <ArchifyRecap
          slug="lifecycle"
          caption="生命周期 · 压缩保护"
          cues={[
            {chapterId: 'lc-compact', at: at('p2-21') - bF.from, durationInFrames: dur('p2-21')},
          ]}
        />
        <Stage>
          <CompactGuard
            sweepAt={at('p2-22') - bF.from}
            sweepDur={dur('p2-22')}
            crushAt={at('p2-22') - bF.from + Math.round(dur('p2-22') * 0.72)}
            focusAt={at('p2-23') - bF.from}
            hookAt={at('p2-24') - bF.from}
          />
        </Stage>
        <CornerNote text="X5 拆保护消融 · 原型实测" x={48} y={904} />
      </Sequence>

      {/* 幕级常驻装置（最后挂载：z 序在镜内容之上，archify 窗内 dimmed） */}
      <MenuLedgerChrome
        checkAt={at('p2-11') + Math.round(dur('p2-11') * 0.35)}
        t1At={at('p2-09')}
        t1Dur={dur('p2-09')}
        t2At={at('p2-11')}
        t2Span={dur('p2-11') + dur('p2-12') + dur('p2-13')}
        t3At={at('p2-12')}
        t3Dur={dur('p2-12')}
        redAt={at('p2-18')}
        redDur={dur('p2-18')}
        stampAt={at('p2-23') + Math.round(dur('p2-23') * 0.45)}
        coverWins={[
          {at: at('p2-06'), durationInFrames: dur('p2-06') + dur('p2-06a')},
          {at: at('p2-07'), durationInFrames: dur('p2-07')},
          {at: at('p2-08'), durationInFrames: dur('p2-08')},
          {at: at('p2-17'), durationInFrames: dur('p2-17')},
          {at: at('p2-21'), durationInFrames: dur('p2-21')},
        ]}
      />
    </AbsoluteFill>
  );
};
