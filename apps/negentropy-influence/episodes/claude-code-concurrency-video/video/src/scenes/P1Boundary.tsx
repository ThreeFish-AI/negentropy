/** P1 自动清洗槽 · 边界与产品对照半场（p1-23..32，2 镜 0 cue）——分镜 1-E…1-F。
 *
 *  ★ 本文件为 P1 幕的另一半场，由 P1Background 组装层并列挂载（同一 scene 句窗）；
 *    HarnessBadge / SceneTag 归幕首开镜侧，本文件不重挂（chip 半透明，重挂会加深）。
 *  ★ 2D 定制剧场段（无适配图例，storyboard 自检对账：p1-23..p2-02 无锚 run 贴上限）：
 *    1-E 边界三联卡（断电消散 / 线程拴门 / 小票裁切）＋官方确认小卡；
 *    1-F 教学版 vs 产品四连卡（任务号即回 / 快捷键挪后台 / 超时转后台 / 输出落文件）。
 *  ★ 画面文字只放关键词/标签（RSI-007：字幕已烧录同句，禁逐字复述口播）。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel} from '../components/motifs';
import {DUR, clamp01, useDim, useDraw, useEnter, useFlowDash, useImpulse, useProgress, useStagger} from '../motion';

/** hex + 帧驱动透明度（无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 1-E 边界三联卡（p1-23..27） ─────────────────────────────────────────

/** 三联卡通用卡体（宽 440，内容区 190 高——三卡等高并列） */
const EdgeCard: React.FC<{
  idx: string;
  title: string;
  enter: number;
  accent?: string;
  children: React.ReactNode;
}> = ({idx, title, enter, accent = theme.mechDeep, children}) => (
  <div style={{opacity: enter, transform: `translateY(${(1 - enter) * 22}px)`}}>
    <Panel accent={accent} style={{width: 440, height: 300, boxSizing: 'border-box', padding: '22px 26px'}}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
        <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{idx}</span>
        <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>{title}</span>
      </div>
      <div style={{position: 'relative', marginTop: 18, height: 190}}>{children}</div>
    </Panel>
  </div>
);

/** 登记板三行字迹（断电后散粒消散——内存态，dim） */
const BOARD_ROWS = ['0001 · 构建', '0002 · 测试', '0003 · 安装'] as const;

const BoundaryTriptych: React.FC<{
  atHead: number;
  atBoard: number;
  atThread: number;
  atOfficial: number;
  atCut: number;
}> = ({atHead, atBoard, atThread, atOfficial, atCut}) => {
  const head = useEnter('fade', {at: atHead, dur: DUR.f5});
  const cards = useStagger(3, {at: atBoard - DUR.f4, stride: 6, dur: DUR.f4});
  // ① 断电：字迹消散（useProgress 驱动散粒位移，useDim 压暗到零）
  const scatter = useProgress(atBoard + DUR.f5, DUR.f6);
  const fade = useDim({at: atBoard + DUR.f5, to: 0, dur: DUR.f6});
  // ② 线程拴门：链条描线 mech → 门框，打烊即断（deny 暗示）
  const chain = useDraw(atThread, DUR.f5);
  const cutOff = useProgress(atThread + DUR.f6, DUR.f4);
  // 官方确认小卡（p1-26）
  const official = useEnter('rise', {at: atOfficial, dur: DUR.f5, restBottom: 860});
  // ③ 小票裁切：剪刀一剪（impulse），前段高亮后段虚化
  const snip = useImpulse({at: atCut, dur: DUR.f5, peak: 1});
  const cut = useProgress(atCut + DUR.f3, DUR.f4);

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 150, width: 1920, textAlign: 'center', ...head}}>
        <span style={{fontFamily: theme.serif, fontSize: 46, fontWeight: 700, color: theme.text}}>{'后台的边界'}</span>
      </div>

      <div style={{position: 'absolute', left: 0, top: 262, width: 1920, display: 'flex', justifyContent: 'center', gap: 36}}>
        {/* ① 登记板断电 */}
        <EdgeCard idx="01" title="登记板" enter={cards[0]}>
          {BOARD_ROWS.map((r, i) => (
            <div
              key={r}
              style={{
                fontFamily: theme.mono,
                fontSize: 26,
                color: theme.dim,
                height: 52,
                opacity: fade,
                letterSpacing: 2 + 10 * scatter,
                transform: `translate(${(i - 1) * 18 * scatter}px, ${-(i + 1) * 12 * scatter}px)`,
                filter: `blur(${4 * scatter}px)`,
              }}
            >
              {r}
            </div>
          ))}
          <div style={{position: 'absolute', left: 0, bottom: 0, fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
            {'内存态 · 断电即空'}
          </div>
        </EdgeCard>

        {/* ② 线程拴在工坊大门 */}
        <EdgeCard idx="02" title="线程" enter={cards[1]}>
          <svg width={388} height={150} style={{position: 'absolute', left: 0, top: 0}}>
            {/* 清洗槽（mech）与门框（dim） */}
            <rect x={6} y={46} width={96} height={72} rx={10} fill="none" stroke={theme.mech} strokeWidth={3} />
            <text x={54} y={90} textAnchor="middle" fontFamily={theme.sans} fontSize={20} fill={theme.mech}>
              {'清洗槽'}
            </text>
            <path d="M300 18 L300 140 M300 18 L382 18 M382 18 L382 140" fill="none" stroke={theme.panelBorder} strokeWidth={4} />
            <text x={341} y={86} textAnchor="middle" fontFamily={theme.sans} fontSize={20} fill={theme.dim}>
              {'大门'}
            </text>
            {/* 链条：描线（pathLength 归一化） */}
            <path
              d="M102 82 C 170 40, 230 124, 300 82"
              fill="none"
              stroke={cutOff > 0.5 ? theme.deny : theme.mech}
              strokeWidth={4}
              {...chain}
            />
            {/* 打烊即断：中点断口 */}
            <path
              d="M192 66 L212 98 M212 66 L192 98"
              stroke={theme.deny}
              strokeWidth={4}
              strokeLinecap="round"
              opacity={cutOff}
            />
          </svg>
          <div style={{position: 'absolute', left: 0, bottom: 0, fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
            {'随进程退出'}
          </div>
        </EdgeCard>

        {/* ③ 摘要小票只裁开头一段 */}
        <EdgeCard idx="03" title="结果小票" enter={cards[2]}>
          <div style={{position: 'absolute', left: 0, top: 26, width: 388, height: 64, display: 'flex'}}>
            <div
              style={{
                width: 150,
                borderRadius: '8px 0 0 8px',
                border: `2px solid ${theme.mech}`,
                background: withAlpha(theme.mechDeep, 0.2 + 0.25 * cut),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.mono,
                fontSize: 22,
                color: theme.text,
              }}
            >
              {'开头一段'}
            </div>
            <div
              style={{
                flex: 1,
                borderRadius: '0 8px 8px 0',
                border: `2px dashed ${theme.panelBorder}`,
                opacity: 1 - 0.75 * cut,
                transform: `translateX(${18 * cut}px)`,
              }}
            />
          </div>
          {/* 剪刀一剪：裁切线闪一下 */}
          <svg width={388} height={140} style={{position: 'absolute', left: 0, top: 0}}>
            <line x1={152} y1={10} x2={152} y2={108} stroke={theme.accent} strokeWidth={3} strokeDasharray="6 6" opacity={0.3 + 0.7 * snip} />
          </svg>
          <div style={{position: 'absolute', left: 0, bottom: 0, fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
            {'认得出 · 就够'}
          </div>
        </EdgeCard>
      </div>

      {/* p1-26 官方确认小卡（「退出自动清理」标签） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 604,
          width: 1920,
          display: 'flex',
          justifyContent: 'center',
          opacity: official.opacity,
          transform: official.transform,
        }}
      >
        <Panel accent={theme.mech} style={{padding: '14px 30px', display: 'flex', alignItems: 'center', gap: 18}}>
          <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.mech}}>{'官方文档'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>{'退出 · 自动清理'}</span>
        </Panel>
      </div>

      <Footnote delay={atBoard}>{'in-memory · daemon=True · summary[:200]'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-F 官方产品面对照四连卡（p1-28..32） ────────────────────────────────

type Pair = {teach: string; prod: string};

const PAIRS: Pair[] = [
  {teach: '甩出 · 给号牌', prod: '任务号 · 即回'},
  {teach: '模型判定', prod: '快捷键 · 挪后台'},
  {teach: '超时 · 硬停', prod: '超时 · 转后台'},
  {teach: '摘要一小段', prod: '输出落文件 · 读回'},
];

const ProductCompare: React.FC<{atHead: number; atRows: [number, number, number, number]; hourDur: number}> = ({
  atHead,
  atRows,
  hourDur,
}) => {
  const head = useEnter('fade', {at: atHead, dur: DUR.f5});
  const cols = useProgress(atHead + DUR.f4, DUR.f4);
  // 四连卡一句一行（p1-29..32 各锚本句句首；固定四次调用——hooks 顶层）
  const rows = [
    useProgress(atRows[0], DUR.f4),
    useProgress(atRows[1], DUR.f4),
    useProgress(atRows[2], DUR.f4),
    useProgress(atRows[3], DUR.f4),
  ];
  const atHourglass = atRows[2];
  // 沙漏漏完 → 转后台箭头（流光）
  const sand = useProgress(atHourglass, Math.max(DUR.f5, Math.round(hourDur * 0.55)), 'linear');
  const flow = useFlowDash({dash: 12, gap: 12, period: 30});
  const arrow = useProgress(atHourglass + Math.round(hourDur * 0.55), DUR.f4);

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 150, width: 1920, textAlign: 'center', ...head}}>
        <span style={{fontFamily: theme.serif, fontSize: 46, fontWeight: 700, color: theme.text}}>{'产品更讲究'}</span>
      </div>

      {/* 列头：教学版（dim）／产品（mech） */}
      <div style={{position: 'absolute', left: 400, top: 250, width: 1120, display: 'flex', opacity: cols}}>
        <div style={{flex: 1, fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'教学版'}</div>
        <div style={{width: 80}} />
        <div style={{flex: 1, fontFamily: theme.mono, fontSize: 22, color: theme.mech}}>{'产品'}</div>
      </div>

      {PAIRS.map((p, i) => (
        <div
          key={p.prod}
          style={{
            position: 'absolute',
            left: 400,
            top: 296 + i * 100,
            width: 1120,
            display: 'flex',
            alignItems: 'center',
            opacity: rows[i],
            transform: `translateX(${(1 - rows[i]) * 24}px)`,
          }}
        >
          <Panel style={{flex: 1, height: 76, boxSizing: 'border-box', padding: '0 24px', display: 'flex', alignItems: 'center'}}>
            <span style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>{p.teach}</span>
          </Panel>
          <div style={{width: 80, textAlign: 'center', fontFamily: theme.sans, fontSize: 30, color: theme.dim}}>{'→'}</div>
          <Panel accent={theme.mech} style={{flex: 1, height: 76, boxSizing: 'border-box', padding: '0 24px', display: 'flex', alignItems: 'center'}}>
            <span style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>{p.prod}</span>
          </Panel>
        </div>
      ))}

      {/* 第三行右侧：沙漏漏完 → 转后台箭头（p1-31） */}
      <svg width={220} height={120} style={{position: 'absolute', left: 1540, top: 474, opacity: rows[2]}}>
        <path d="M14 12 L62 12 L38 50 L62 88 L14 88 L38 50 Z" fill="none" stroke={theme.dim} strokeWidth={3} />
        {/* 上仓沙量随 sand 递减，下仓递增 */}
        <path d={`M${22 + 16 * sand} ${16 + 30 * sand} L${54 - 16 * sand} ${16 + 30 * sand} L38 46 Z`} fill={theme.accent} opacity={1 - sand} />
        <path d={`M${38 - 20 * sand} 84 L${38 + 20 * sand} 84 L38 ${84 - 30 * sand} Z`} fill={theme.accent} opacity={sand} />
        <path d="M76 50 L200 50" stroke={theme.mech} strokeWidth={4} opacity={arrow} {...flow} />
        <path d="M188 38 L204 50 L188 62" fill="none" stroke={theme.mech} strokeWidth={4} opacity={arrow} />
      </svg>

      <Footnote delay={atRows[0]}>{'Ctrl+B · timeout → background · output file + Read'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 半场组装（由 P1Background 挂载） ─────────────────────────────────────

export const P1Boundary: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bE = w('p1-23', 'p1-27');
  const bF = w('p1-28', 'p1-32');

  return (
    <>
      <Sequence {...bE} name="1-E 边界三联卡">
        <BoundaryTriptych
          atHead={2}
          atBoard={at('p1-24') - bE.from}
          atThread={at('p1-25') - bE.from}
          atOfficial={at('p1-26') - bE.from}
          atCut={at('p1-27') + Math.round(dur('p1-27') * 0.35) - bE.from}
        />
      </Sequence>

      <Sequence {...bF} name="1-F 教学版 vs 产品四连卡">
        <ProductCompare
          atHead={2}
          atRows={[at('p1-29') - bF.from, at('p1-30') - bF.from, at('p1-31') - bF.from, at('p1-32') - bF.from]}
          hourDur={dur('p1-31')}
        />
      </Sequence>
    </>
  );
};

export default P1Boundary;
