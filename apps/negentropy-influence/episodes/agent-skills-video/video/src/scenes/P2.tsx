/** P2 台账与提箱（p2-01..p2-12c）——港口开张：台账墙逐行点亮（tier-0 常驻成本）
 *  → 吊臂提箱·渐进披露（全片空间语义教学起点：左堆场=存量，右作业台=使用中）
 *  → 正文软预算标尺 → 17 倍翻牌账 → 对岸同一条红线 → 脚本舱钉版本·四条家规。
 *  主色引航青（台账体制面）；集装箱恒走货签粉〔M-001〕；预算红线走警示金。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useDraw,
  useFlowDash,
  useImpulse,
  useProgress,
  useSpring,
  useStagger,
  win,
} from '../motion';
import {EvidenceBadge, LedgerBars, Stage} from '../components/devices';
import {
  CargoBox,
  Counter,
  Footnote,
  LedgerWall,
  NumberedCard,
  Panel,
  SceneTag,
} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

// ── 2-A 台账墙 ───────────────────────────────────────────────────────────────

/** 台账行（箱号 + 一句货签）：画面词汇为港口台账，非口播复述。 */
const LEDGER_ROWS = [
  {id: 'csv-clean', desc: '乱表清洗 · 导出前'},
  {id: 'pdf-forms', desc: '表单三坑速查'},
  {id: 'expense', desc: '报销单口径'},
  {id: 'review', desc: '评审盯什么'},
  {id: 'release', desc: '发版检查单'},
  {id: 'sql-tune', desc: '慢查询改写'},
  {id: 'doc-sync', desc: '文档同步'},
];

/** 空泊位：右侧恒空（空间语义：右=使用中，此刻待命）。 */
const EmptyBerth: React.FC = () => (
  <div
    style={{
      width: 400,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      borderLeft: `2px dashed ${theme.panelBorder}`,
      paddingLeft: 44,
    }}
  >
    <div
      style={{
        width: 320,
        height: 236,
        borderRadius: 12,
        border: `2.5px dashed ${theme.panelBorder}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <div style={{fontFamily: theme.mono, fontSize: 40, color: `${theme.dim}88`}}>[ … ]</div>
      <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>泊位 · 空</div>
      <div style={{fontFamily: theme.mono, fontSize: 17, color: `${theme.dim}99`}}>按需才提箱</div>
    </div>
  </div>
);

/** 2-A 调度室：账行随 p2-02 逐行点亮〔M-003〕停驻；token 角标随 p2-04 滚数。 */
const DispatchBoard: React.FC<{rowAt: number; rowWin: number; tokAt: number}> = ({
  rowAt,
  rowWin,
  tokAt,
}) => {
  const lit = useStagger(LEDGER_ROWS.length, {
    at: rowAt,
    dur: DUR.f4,
    fit: {total: Math.max(60, rowWin)},
  });
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34}}>
      <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text}}>
        调度室 · 常驻台账
      </div>
      <div style={{display: 'flex', alignItems: 'stretch', gap: 44}}>
        <Panel accent={`${theme.concept}77`} style={{padding: '18px 22px', position: 'relative'}}>
          <LedgerWall rows={LEDGER_ROWS} visible={lit} rowH={42} width={660} />
          <div
            style={{
              position: 'absolute',
              right: 14,
              top: -44,
              padding: '6px 14px',
              borderRadius: 8,
              border: `1.5px solid ${theme.concept}66`,
              background: `${theme.panel}E6`,
              fontFamily: theme.mono,
              fontSize: 20,
              color: theme.concept,
            }}
          >
            ≈<Counter from={50} to={100} start={tokAt} style={{color: theme.concept}} /> token/行
          </div>
        </Panel>
        <EmptyBerth />
      </div>
    </div>
  );
};

// ── 2-B 吊臂提箱（空间语义教学起点）─────────────────────────────────────────

/** 2-B 提箱开箱：命中行 → 龙门吊左堆场吊往右作业台 → 指导书摊开 → 三隔层按需抽拉。
 *  p2-07 是本镜唯一无工程图窗的句窗，吊运编排全部锚在它上面（口播点名「渐进披露」
 *  时装置完整走完机制）。 */
const CraneBoard: React.FC<{
  moveAt: number;
  moveDur: number;
  bookAt: number;
  tierAt: number;
  titleAt: number;
}> = ({moveAt, moveDur, bookAt, tierAt, titleAt}) => {
  const move = useProgress(moveAt, moveDur, 'decelerate');
  const book = useSpring('settle', {at: bookAt, dur: DUR.f5});
  const frame = useCurrentFrame();
  const bookO = progress(frame, bookAt, DUR.f4);
  const tiers = useStagger(3, {at: tierAt, dur: DUR.f4, stride: 7});
  const title = progress(frame, titleAt, DUR.f5);
  // 轨迹三段：升（离开堆场顶）→ 平（跨场）→ 落（上台面）
  const liftP = win(move, [0, 0.3]);
  const carryP = win(move, [0.28, 0.82]);
  const dropP = win(move, [0.8, 1]);
  const yardX = 210;
  const dockX = 1170;
  const yardTopY = 296;
  const beamY = 128;
  const dockY = 300;
  const x = yardX + (dockX - yardX) * carryP;
  const y = yardTopY + (beamY - yardTopY) * liftP + (dockY - beamY) * dropP;
  const opened = dropP >= 0.99;
  const tierNames = ['scripts', 'references', 'assets'];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20}}>
      <div style={{position: 'relative', width: 1500, height: 560}}>
        {/* 命中行：台账上对上的那一句（hot 底即 LedgerWall 的 hot 语义） */}
        <div
          style={{
            position: 'absolute',
            left: 250,
            top: 0,
            width: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            height: 46,
            borderRadius: 8,
            border: `1.5px solid ${theme.concept}55`,
            background: `${theme.concept}1E`,
            padding: '0 16px',
            fontFamily: theme.mono,
          }}
        >
          <span style={{color: theme.concept, fontSize: 18, minWidth: 170}}>csv-clean</span>
          <span style={{color: theme.text, fontSize: 17, fontFamily: theme.sans}}>
            乱表清洗 · 导出前
          </span>
          <span style={{marginLeft: 'auto', color: theme.concept, fontSize: 15}}>命中</span>
        </div>
        {/* 龙门吊：横梁 + 双柱 */}
        <div
          style={{
            position: 'absolute',
            left: 60,
            right: 60,
            top: 92,
            height: 8,
            borderRadius: 4,
            background: theme.panelBorder,
          }}
        />
        <div style={{position: 'absolute', left: 68, top: 92, width: 10, height: 190, background: theme.panelBorder}} />
        <div style={{position: 'absolute', right: 68, top: 92, width: 10, height: 190, background: theme.panelBorder}} />
        {/* 小车 + 缆绳 + 活动箱 */}
        <div
          style={{
            position: 'absolute',
            left: x - 16,
            top: 84,
            width: 32,
            height: 20,
            borderRadius: 5,
            background: theme.dim,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: x - 1.5,
            top: 104,
            width: 3,
            height: Math.max(0, y - 104),
            background: `${theme.dim}CC`,
          }}
        />
        <div style={{position: 'absolute', left: x - 75, top: y}}>
          <CargoBox label="csv-clean" opened={opened} />
        </div>
        {/* 左堆场：顶层箱吊离（ghost 虚位）+ 底层两箱常驻 */}
        <div style={{position: 'absolute', left: yardX - 75, top: yardTopY, opacity: 1 - liftP}}>
          <CargoBox label="csv-clean" />
        </div>
        <div
          style={{
            position: 'absolute',
            left: yardX - 75,
            top: yardTopY,
            width: 150,
            height: 104,
            borderRadius: 10,
            border: `2px dashed ${theme.conceptDeep}44`,
            opacity: liftP,
          }}
        />
        <div style={{position: 'absolute', left: yardX - 165, top: yardTopY + 108}}>
          <CargoBox label="pdf-forms" width={140} height={96} />
        </div>
        <div style={{position: 'absolute', left: yardX + 25, top: yardTopY + 108}}>
          <CargoBox label="expense" width={140} height={96} />
        </div>
        {/* 右作业台：台面 + 台腿 */}
        <div
          style={{
            position: 'absolute',
            left: dockX - 190,
            top: dockY + 104,
            width: 380,
            height: 12,
            borderRadius: 6,
            background: theme.panelBorder,
          }}
        />
        <div style={{position: 'absolute', left: dockX - 178, top: dockY + 116, width: 8, height: 116, background: `${theme.panelBorder}AA`}} />
        <div style={{position: 'absolute', left: dockX + 170, top: dockY + 116, width: 8, height: 116, background: `${theme.panelBorder}AA`}} />
        {/* 指导书摊开：两页自箱内展开（opacity 走缓动、scale 走弹簧） */}
        <div
          style={{
            position: 'absolute',
            left: dockX + 62,
            top: dockY - 34,
            width: 250,
            height: 158,
            opacity: bookO,
            transform: `scale(${0.5 + 0.5 * book})`,
          }}
        >
          <div style={{position: 'absolute', inset: 0, display: 'flex'}}>
            <div
              style={{
                flex: 1,
                background: '#F2F5FA',
                borderRadius: '8px 3px 3px 8px',
                margin: 3,
                padding: '14px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 9,
                transform: `rotate(${(1 - book) * -8}deg)`,
              }}
            >
              {[0.9, 0.75, 0.85, 0.6].map((wd, i) => (
                <div key={i} style={{height: 7, borderRadius: 4, background: '#C6CEDC', width: `${wd * 100}%`}} />
              ))}
            </div>
            <div
              style={{
                flex: 1,
                background: '#E7ECF4',
                borderRadius: '3px 8px 8px 3px',
                margin: 3,
                padding: '14px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 9,
                transform: `rotate(${(1 - book) * 8}deg)`,
              }}
            >
              {[0.7, 0.85, 0.55, 0.8].map((wd, i) => (
                <div key={i} style={{height: 7, borderRadius: 4, background: '#C6CEDC', width: `${wd * 100}%`}} />
              ))}
            </div>
          </div>
        </div>
        {/* 三隔层：用到哪层取哪层（抽屉式拉出） */}
        {tiers.map((p, i) => (
          <div
            key={tierNames[i]}
            style={{
              position: 'absolute',
              left: dockX - 185 + i * 128,
              top: dockY + 134 + (1 - p) * 18,
              width: 118,
              textAlign: 'center',
              padding: '8px 0',
              borderRadius: 7,
              border: `2px solid ${theme.conceptDeep}`,
              color: theme.conceptDeep,
              fontFamily: theme.mono,
              fontSize: 16,
              opacity: p,
            }}
          >
            {tierNames[i]}
          </div>
        ))}
        {/* 空间语义恒定锚：左存量 / 右使用中 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            fontFamily: theme.mono,
            fontSize: 18,
            color: theme.dim,
          }}
        >
          ◀ 堆场 · 存量
        </div>
        <div
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            fontFamily: theme.mono,
            fontSize: 18,
            color: theme.concept,
          }}
        >
          作业台 · 使用中 ▶
        </div>
        {/* 点题：p2-07 口播报名时压上 */}
        <div
          style={{
            position: 'absolute',
            left: 330,
            right: 330,
            top: 352,
            textAlign: 'center',
            fontFamily: theme.serif,
            fontSize: 46,
            letterSpacing: 10,
            color: theme.concept,
            opacity: title,
            transform: `translateY(${(1 - title) * 14}px)`,
          }}
        >
          渐进披露
        </div>
      </div>
    </div>
  );
};

// ── 2-C 软预算标尺 ───────────────────────────────────────────────────────────

/** 参考分册：三本手册自右侧依次弹出（写不下的拆出去）。 */
const RefShelf: React.FC<{at: number}> = ({at}) => {
  const st = useStagger(3, {at, dur: DUR.f5, stride: 9});
  const books = [
    {name: 'manual.md', zh: '使用手册'},
    {name: 'api.md', zh: '接口表'},
    {name: 'tpl.md', zh: '模板库'},
  ];
  return (
    <div style={{display: 'flex', gap: 18, alignItems: 'flex-end', height: 170}}>
      {books.map((b, i) => (
        <div
          key={b.name}
          style={{
            width: 104,
            height: 158,
            borderRadius: '7px 10px 10px 7px',
            border: `2.5px solid ${st[i] > 0.05 ? theme.conceptDeep : theme.panelBorder}`,
            background: `${theme.conceptDeep}10`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: st[i],
            transform: `translateX(${(1 - st[i]) * 36}px)`,
            borderLeft: `7px solid ${theme.conceptDeep}`,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.text}}>{b.zh}</div>
          <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{b.name}</div>
        </div>
      ))}
    </div>
  );
};

/** 2-C 正文软预算：5000/500 标尺（警示金）+ 越界块被弹回 + 参考分册 + 一层深对比。 */
const BudgetBoard: React.FC<{
  at: number;
  rulerAt: number;
  volAt: number;
  backAt: number;
  refAt: number;
  hopAt: number;
  mazeAt: number;
}> = ({at, rulerAt, volAt, backAt, refAt, hopAt, mazeAt}) => {
  const ruler = useDraw(rulerAt, DUR.f6);
  const push = useProgress(volAt, DUR.f6, 'accelerate');
  const back = useSpring('snap', {at: backAt, dur: DUR.f5});
  const frame = useCurrentFrame();
  const hop = progress(frame, hopAt, DUR.f5);
  const maze = progress(frame, mazeAt, DUR.f5);
  const mazeX = useImpulse({at: mazeAt, dur: DUR.f4, peak: 1});
  const enter = progress(frame, at, DUR.f5);
  // 标尺几何：量程 6000，满宽 1030px，5000 红线在 x=878
  const RULER_W = 1030;
  const LINE_X = Math.round((5000 / 6000) * RULER_W);
  const volX = 0.15 + 0.91 * push - 0.19 * back; // 0.15 → 1.06（越线）→ 0.87（弹回线内）
  const nodeBox = (t: string, hot: boolean): React.CSSProperties => ({
    padding: '7px 12px',
    borderRadius: 7,
    border: `2px solid ${hot ? theme.concept : theme.panelBorder}`,
    background: theme.panel,
    fontFamily: theme.mono,
    fontSize: 16,
    color: hot ? theme.concept : theme.dim,
    whiteSpace: 'nowrap',
  });
  const arrow = (w: number, dashed: boolean): React.CSSProperties => ({
    width: w,
    height: 0,
    borderTop: `2.5px ${dashed ? 'dashed' : 'solid'} ${dashed ? theme.dim : theme.concept}`,
  });
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, opacity: enter}}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 26}}>
        <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text}}>正文 · 软预算</div>
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.deny}}>超了不违规 · 账难看</div>
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 40}}>
        {/* 正文卡：宽度可承载、超载预警 */}
        <Panel accent={theme.conceptDeep} style={{width: 470, padding: '14px 20px', position: 'relative'}}>
          <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.conceptDeep}}>SKILL.md</div>
          {[0.94, 0.86, 0.9, 0.72, 0.88, 0.66].map((wd, i) => (
            <div key={i} style={{height: 7, borderRadius: 4, background: `${theme.dim}55`, width: `${wd * 100}%`, marginTop: 11}} />
          ))}
          <div style={{position: 'absolute', right: 14, bottom: 8, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>
            ≈ 320 行
          </div>
        </Panel>
        <div style={{fontFamily: theme.serif, fontSize: 30, color: theme.dim}}>→</div>
        <RefShelf at={refAt} />
      </div>
      {/* 标尺：0..6000 量程，5000 处警示金虚线 */}
      <svg width={1080} height={104}>
        <line x1={20} y1={44} x2={20 + RULER_W} y2={44} stroke={theme.dim} strokeWidth={2.5} {...ruler} />
        {[0, 3000, 6000].map((tk) => (
          <line
            key={tk}
            x1={20 + (tk / 6000) * RULER_W}
            y1={36}
            x2={20 + (tk / 6000) * RULER_W}
            y2={52}
            stroke={theme.dim}
            strokeWidth={2}
          />
        ))}
        <text x={20} y={74} fill={theme.dim} fontSize={16} fontFamily={theme.mono}>0</text>
        <text x={20 + RULER_W / 2 - 20} y={74} fill={theme.dim} fontSize={16} fontFamily={theme.mono}>3000</text>
        <text x={20 + RULER_W - 44} y={74} fill={theme.dim} fontSize={16} fontFamily={theme.mono}>6000</text>
        {/* 5000 红线（虚线警示金，主线描完后浮现） */}
        <line
          x1={20 + LINE_X}
          y1={16}
          x2={20 + LINE_X}
          y2={92}
          stroke={theme.deny}
          strokeWidth={3}
          strokeDasharray="7 6"
          opacity={progress(frame, rulerAt + 8, DUR.f4)}
        />
        {/* 越界块：冲过红线 → 被弹回线内 */}
        <g>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect
              key={i}
              x={40 + (20 + LINE_X - 60) * volX + i * 15}
              y={34}
              width={11}
              height={20}
              rx={2.5}
              fill={volX > 1.005 ? theme.deny : theme.concept}
              opacity={0.9}
            />
          ))}
        </g>
      </svg>
      <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.deny}}>
        5000 tok · 500 行 —— 建议值
      </div>
      {/* 引用深度：一跳可达 vs 串三层迷宫 */}
      <div style={{display: 'flex', gap: 90, alignItems: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, opacity: 0.35 + 0.65 * hop}}>
          <div style={nodeBox('SKILL.md', true)} />
          <div style={arrow(64, false)} />
          <div style={{width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: `10px solid ${theme.concept}`}} />
          <div style={nodeBox('ref 手册', true)} />
          <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.concept, marginLeft: 10}}>一跳可达</div>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, opacity: maze}}>
          <div style={nodeBox('SKILL.md', false)} />
          <div style={arrow(34, true)} />
          <div style={nodeBox('ref1', false)} />
          <div style={arrow(34, true)} />
          <div style={nodeBox('ref2', false)} />
          <div style={arrow(34, true)} />
          <div style={nodeBox('ref3', false)} />
          <div
            style={{
              marginLeft: 12,
              fontFamily: theme.mono,
              fontSize: 26,
              color: theme.deny,
              textShadow: `0 0 ${12 * mazeX}px ${theme.deny}`,
            }}
          >
            ✗ 迷宫
          </div>
        </div>
      </div>
      <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>正文 → 附件 · 只许一层深</div>
    </div>
  );
};

// ── 2-D 数字翻牌账 ───────────────────────────────────────────────────────────

/** 2-D 玩具实测对账：全载 vs 台账（useCount 对向生长）+ ≈17× 横幅压入。 */
const ToyCompare: React.FC<{at: number; bannerAt: number}> = ({at, bannerAt}) => {
  const banner = useSpring('settle', {at: bannerAt, dur: DUR.f5});
  const bannerO = useProgress(bannerAt, DUR.f4);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36}}>
      <LedgerBars
        at={at}
        unit=" tok"
        items={[
          {label: '开场白全载', value: 39222, color: theme.conceptDeep, note: '20 册全载'},
          {label: '台账常驻', value: 2321, color: theme.concept, note: '20 行目录'},
        ]}
      />
      <div
        style={{
          padding: '12px 44px',
          borderRadius: 12,
          border: `3px solid ${theme.deny}`,
          background: `${theme.deny}14`,
          fontFamily: theme.mono,
          fontSize: 44,
          color: theme.deny,
          opacity: bannerO,
          transform: `scale(${1.3 - 0.3 * banner})`,
        }}
      >
        ≈ 17×
      </div>
    </div>
  );
};

// ── 2-E 对岸同款 ─────────────────────────────────────────────────────────────

const TWIN_ROWS_OWN = [
  {id: 'csv-clean', desc: '乱表清洗 · 导出前'},
  {id: 'pdf-forms', desc: '表单三坑速查'},
  {id: 'release', desc: '发版检查单'},
];
const TWIN_ROWS_FAR = [
  {id: 'web-research', desc: '网页检索 · 出报告'},
  {id: 'slide-deck', desc: '幻灯片生成'},
  {id: 'sql-helper', desc: 'SQL 助手'},
];

/** 2-E 双港隔海相望：对岸台账镜像点亮，两段红线在 p2-12 连成同一条。 */
const TwinPorts: React.FC<{mirrorAt: number; mirrorWin: number; bridgeAt: number}> = ({
  mirrorAt,
  mirrorWin,
  bridgeAt,
}) => {
  const st = useStagger(TWIN_ROWS_FAR.length, {
    at: mirrorAt,
    dur: DUR.f4,
    fit: {total: Math.max(50, mirrorWin)},
  });
  const frame = useCurrentFrame();
  const leftLine = progress(frame, mirrorAt, DUR.f5);
  const rightLine = progress(frame, mirrorAt + 14, DUR.f5);
  const bridge = progress(frame, bridgeAt, DUR.f5);
  const sea = useFlowDash({dash: 12, gap: 16, period: 70});
  const mirror = st.slice().reverse(); // 镜像：对岸墙自下而上亮
  const seg = (op: number, origin: 'left' | 'right'): React.CSSProperties => ({
    height: 3,
    background: theme.deny,
    transform: `scaleX(${op})`,
    transformOrigin: `${origin} center`,
  });
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24}}>
      <div style={{position: 'relative', width: 1500, height: 540}}>
        {/* 同一条红线：左段 / 右段各自划出，p2-12 中桥连通 */}
        <div style={{position: 'absolute', left: 110, top: 64, width: 440, ...seg(leftLine, 'left')}} />
        <div style={{position: 'absolute', right: 110, top: 64, width: 440, ...seg(rightLine, 'right')}} />
        <div style={{position: 'absolute', left: 550, top: 64, width: 400, ...seg(bridge, 'left')}} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 14,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.deny,
            opacity: bridge,
          }}
        >
          ≤2% 或 8000 字符
        </div>
        {/* 本港 */}
        <Panel accent={`${theme.concept}77`} style={{position: 'absolute', left: 110, top: 110, width: 440, padding: '14px 18px'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 10}}>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.concept}}>本港</div>
            <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>台账 · 软预算</div>
          </div>
          <LedgerWall rows={TWIN_ROWS_OWN} rowH={40} width={400} />
        </Panel>
        {/* 对岸：OpenAI 旗 + 同款台账（镜像点亮） */}
        <Panel accent={`${theme.concept}55`} style={{position: 'absolute', right: 110, top: 110, width: 440, padding: '14px 18px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10}}>
            {/* OpenAI 旗：旗杆 + 旗面 */}
            <div style={{position: 'relative', width: 34, height: 30}}>
              <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 2.5, background: theme.dim}} />
              <div
                style={{
                  position: 'absolute',
                  left: 3,
                  top: 2,
                  width: 30,
                  height: 18,
                  background: `${theme.concept}22`,
                  border: `1.5px solid ${theme.concept}66`,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.mono,
                  fontSize: 8,
                  color: theme.concept,
                }}
              >
                OA
              </div>
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.concept}}>OpenAI</div>
            <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>同款台账</div>
          </div>
          <LedgerWall rows={TWIN_ROWS_FAR} visible={mirror} rowH={40} width={400} />
        </Panel>
        {/* 海：流动虚线两道 */}
        <svg width={380} height={140} style={{position: 'absolute', left: 560, top: 250}}>
          <path d="M 10 46 Q 60 30, 110 46 T 210 46 T 310 46 T 370 46" fill="none" stroke={theme.dim} strokeWidth={2.5} opacity={0.6} {...sea} />
          <path d="M 30 96 Q 80 82, 130 96 T 230 96 T 330 96" fill="none" stroke={`${theme.dim}88`} strokeWidth={2.5} opacity={0.4} {...sea} />
        </svg>
      </div>
    </div>
  );
};

// ── 2-F 脚本舱家规 ───────────────────────────────────────────────────────────

const SCRIPT_RULES = ['不问交互', '报错说人话', '结果吐结构化', '能空跑'];

/** 2-F 箱内脚本舱：版本号钉死（图钉锤落）+ 四条家规牌 + 新同事金句。 */
const ScriptBay: React.FC<{pinAt: number; rulesAt: number; rulesWin: number; quoteAt: number}> = ({
  pinAt,
  rulesAt,
  rulesWin,
  quoteAt,
}) => {
  const pinGlow = useImpulse({at: pinAt, dur: DUR.f5, peak: 1});
  const frame = useCurrentFrame();
  const pinDrop = progress(frame, pinAt, DUR.f4);
  const pinOn = progress(frame, pinAt + 3, 2);
  const rules = useStagger(SCRIPT_RULES.length, {
    at: rulesAt,
    dur: DUR.f4,
    fit: {total: Math.max(60, rulesWin)},
  });
  const quote = progress(frame, quoteAt, DUR.f5);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34}}>
      <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text}}>箱内 · 脚本舱</div>
      <div style={{display: 'flex', alignItems: 'center', gap: 70}}>
        {/* 左：脚本舱剖面 + 版本钉 */}
        <div style={{position: 'relative', padding: 6}}>
          <CargoBox label="scripts/" opened width={190} height={124} />
          <Panel accent={`${theme.conceptDeep}88`} style={{marginTop: 18, width: 330, padding: '13px 16px', position: 'relative'}}>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.text}}>pandas==2.1.4</div>
            <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 5}}>
              临时工具 · 版本钉死
            </div>
            {/* 图钉：锤落后常驻（opacity 走缓动、辉光脉冲走 impulse） */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: -26 - (1 - pinDrop) * 34,
                marginLeft: -9,
                width: 18,
                height: 18,
                borderRadius: 9,
                background: pinOn > 0 ? theme.concept : theme.dim,
                boxShadow: pinOn > 0 ? `0 0 ${10 + 8 * pinGlow}px ${theme.concept}` : 'none',
                opacity: 0.55 + 0.45 * pinOn,
              }}
            />
          </Panel>
          <div
            style={{
              marginTop: 12,
              textAlign: 'center',
              fontFamily: theme.mono,
              fontSize: 17,
              color: theme.concept,
              opacity: pinOn,
            }}
          >
            钉死版本
          </div>
        </div>
        {/* 右：四条家规牌 */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 250px)', gap: 18}}>
          {SCRIPT_RULES.map((r, i) => (
            <div key={r} style={{opacity: rules[i], transform: `translateY(${(1 - rules[i]) * 18}px)`}}>
              <NumberedCard index={i + 1} label={r} active accent={theme.concept} width={250} />
            </div>
          ))}
        </div>
      </div>
      {/* 金句（p2-12c）：给看不见屏幕的新同事写 */}
      <div
        style={{
          fontFamily: theme.serif,
          fontSize: 30,
          color: theme.dim,
          letterSpacing: 4,
          opacity: quote,
          transform: `translateY(${(1 - quote) * 12}px)`,
        }}
      >
        看不见屏幕 · 新同事
      </div>
    </div>
  );
};

// ── 主组件 ───────────────────────────────────────────────────────────────────

export const P2: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p2-01', 'p2-04');
  const bB = w('p2-05', 'p2-08');
  const bC = w('p2-08a', 'p2-08c');
  const bD = w('p2-09', 'p2-10');
  const bE = w('p2-11', 'p2-12');
  const bF = w('p2-12a', 'p2-12c');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A 台账墙点亮">
        <SceneTag chapter="P2" tagline="台账与提箱" accent={theme.concept} />
        <ArchifyYield
          cues={[
            {at: at('p2-01') - bA.from, durationInFrames: dur('p2-01')},
            {at: at('p2-03') - bA.from, durationInFrames: dur('p2-03')},
          ]}
        >
          <DispatchBoard
            rowAt={at('p2-02') - bA.from}
            rowWin={dur('p2-02')}
            tokAt={at('p2-04') - bA.from}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="disclosure-lifecycle"
          caption="渐进披露 · 生命周期"
          cues={[
            {chapterId: 'dl-discover', at: at('p2-01') - bA.from, durationInFrames: dur('p2-01')},
            {chapterId: 'dl-catalog', at: at('p2-03') - bA.from, durationInFrames: dur('p2-03')},
          ]}
        />
        <Footnote delay={at('p2-04') - bA.from}>{'一行一签 · 一眼成本'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="2-B 吊臂提箱">
        <SceneTag chapter="P2" tagline="台账与提箱" accent={theme.concept} />
        <ArchifyYield
          cues={[
            {at: at('p2-05') - bB.from, durationInFrames: dur('p2-05')},
            {at: at('p2-06') - bB.from, durationInFrames: dur('p2-06')},
            {at: at('p2-08') - bB.from, durationInFrames: dur('p2-08')},
          ]}
        >
          <CraneBoard
            moveAt={at('p2-07') - bB.from}
            moveDur={Math.round(dur('p2-07') * 0.5)}
            bookAt={at('p2-07') - bB.from + Math.round(dur('p2-07') * 0.5)}
            tierAt={at('p2-07') - bB.from + Math.round(dur('p2-07') * 0.62)}
            titleAt={at('p2-07') - bB.from + Math.round(dur('p2-07') * 0.74)}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="disclosure-lifecycle"
          caption="渐进披露 · 生命周期"
          cues={[
            {chapterId: 'dl-activate', at: at('p2-05') - bB.from, durationInFrames: dur('p2-05')},
            {chapterId: 'dl-tier3', at: at('p2-06') - bB.from, durationInFrames: dur('p2-06')},
            {chapterId: 'dl-rewrite', at: at('p2-08') - bB.from, durationInFrames: dur('p2-08')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="2-C 软预算标尺">
        <SceneTag chapter="P2" tagline="台账与提箱" accent={theme.concept} />
        <Stage>
          <BudgetBoard
            at={at('p2-08a') - bC.from}
            rulerAt={at('p2-08a') - bC.from}
            volAt={at('p2-08a') - bC.from + Math.round(dur('p2-08a') * 0.42)}
            backAt={at('p2-08a') - bC.from + Math.round(dur('p2-08a') * 0.42) + DUR.f6}
            refAt={at('p2-08b') - bC.from}
            hopAt={at('p2-08c') - bC.from}
            mazeAt={at('p2-08c') - bC.from + Math.round(dur('p2-08c') * 0.5)}
          />
        </Stage>
      </Sequence>

      <Sequence {...bD} name="2-D 十七倍账">
        <SceneTag chapter="P2" tagline="台账与提箱" accent={theme.concept} />
        <EvidenceBadge text="自建玩具实测" at={at('p2-09') - bD.from} />
        <ArchifyYield
          cues={[
            {at: at('p2-09') - bD.from, durationInFrames: dur('p2-09')},
            {at: at('p2-10') - bD.from, durationInFrames: dur('p2-10')},
          ]}
        >
          <ToyCompare at={at('p2-09') - bD.from} bannerAt={at('p2-10') - bD.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="budget-flipboard"
          caption="预算翻牌 · 玩具实测"
          cues={[
            {chapterId: 'bf-toy', at: at('p2-09') - bD.from, durationInFrames: dur('p2-09')},
            {chapterId: 'bf-times', at: at('p2-10') - bD.from, durationInFrames: dur('p2-10')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="2-E 对岸同款">
        <SceneTag chapter="P2" tagline="台账与提箱" accent={theme.concept} />
        <EvidenceBadge text="OpenAI 文档口径" at={at('p2-11') - bE.from} />
        <ArchifyYield cues={[{at: at('p2-11') - bE.from, durationInFrames: dur('p2-11')}]}>
          <TwinPorts
            mirrorAt={at('p2-11') - bE.from + Math.round(dur('p2-11') * 0.4)}
            mirrorWin={Math.round(dur('p2-11') * 0.6)}
            bridgeAt={at('p2-12') - bE.from}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="budget-flipboard"
          caption="预算翻牌 · 玩具实测"
          cues={[{chapterId: 'bf-openai', at: at('p2-11') - bE.from, durationInFrames: dur('p2-11')}]}
        />
        <Footnote delay={at('p2-12') - bE.from}>{'打得凶 · 同一条红线'}</Footnote>
      </Sequence>

      <Sequence {...bF} name="2-F 脚本家规">
        <SceneTag chapter="P2" tagline="台账与提箱" accent={theme.concept} />
        <ArchifyYield
          cues={[
            {at: at('p2-12a') - bF.from, durationInFrames: dur('p2-12a')},
            {at: at('p2-12b') - bF.from, durationInFrames: dur('p2-12b')},
          ]}
        >
          <ScriptBay
            pinAt={at('p2-12a') - bF.from + Math.round(dur('p2-12a') * 0.45)}
            rulesAt={at('p2-12b') - bF.from}
            rulesWin={dur('p2-12b')}
            quoteAt={at('p2-12c') - bF.from}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="script-craft"
          caption="脚本工艺 · 家规四条"
          cues={[
            {chapterId: 'sc-pin', at: at('p2-12a') - bF.from, durationInFrames: dur('p2-12a')},
            {chapterId: 'sc-rules', at: at('p2-12b') - bF.from, durationInFrames: dur('p2-12b')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
