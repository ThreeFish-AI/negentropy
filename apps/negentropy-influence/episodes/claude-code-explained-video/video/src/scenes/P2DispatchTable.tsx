/** P2 开单表（p2-01..21，6 镜 8 cue）——分镜 2-A…2-F。
 *
 *  ★ 单工具时代痛点（意图书 → 缠绕翻译 → 拼长命令）→ 表册翻开两笔登记（说明单落页＋
 *    登记行钉入，mech 青）→ 执行行唯一一回翻转（写死调用 → 查表，行数尺第二格 135 点亮）。
 *  ★ 实验 2：未知名字的分叉（硬取值当场崩 vs 软查表回一句自纠）；多单串行 vs 分批并行；
 *    院内围栏（文件科被细线围栏圈住、命令外线绕开）＋埋雷定格「下一幕出事」。
 *  archify 全屏独占：dispatch-table 三章（table-lookup/grow-table 同实例连播、dept-exec
 *    围栏一瞥）＋lookup-failure 五章一实例连播（unknown-in 承封条卡句尾让位，五章窗相邻
 *    由实例内背靠背自动处理）。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Doctor, ExpBadge, LINE_GAUGE, LineGauge, MonoTag, ProvenanceTag, withAlpha} from '../components/clinic';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {
  DUR,
  useBreathe,
  useCount,
  useDraw,
  useEnter,
  useImpulse,
  useProgress,
  useSpring,
  useStagger,
} from '../motion';

// ── 2-A 单工具时代：命令单卡 / 意图书→长命令（缠绕箭头）/ 册页剪影探入 ───────

const BashOnlyCard: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('fade', {at, dur: DUR.f4});
  return (
    <div
      style={{
        position: 'absolute',
        left: 430,
        top: 380,
        ...e,
        width: 340,
        padding: '16px 22px',
        background: theme.panel,
        border: `2px solid ${theme.panelBorder}`,
        borderRadius: 10,
      }}
    >
      <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'命令单'}</div>
      <div style={{marginTop: 12, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between'}}>
        <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.text}}>{'bash'}</span>
        <span style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim}}>{'唯一工具'}</span>
      </div>
    </div>
  );
};

/** 翻译损耗：意图书卡 → 拼出的命令卡，中间缠绕箭头（dim 描线） */
const IntentSwap: React.FC<{at: number}> = ({at}) => {
  const cards = useStagger(2, {at, stride: 12, dur: DUR.f5});
  const draw = useDraw(at + 14, DUR.f5);
  const head = useProgress(at + 14 + DUR.f5, DUR.f3);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 500,
          top: 236,
          width: 330,
          padding: '18px 24px',
          background: theme.panel,
          border: `2px solid ${withAlpha(theme.dim, 0.5)}`,
          borderRadius: 10,
          opacity: cards[0],
          transform: `translateY(${(1 - cards[0]) * 16}px)`,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'意图'}</div>
        <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{'想读文件'}</div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1090,
          top: 236,
          width: 380,
          padding: '18px 24px',
          background: theme.bgDeep,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 10,
          opacity: cards[1],
          transform: `translateY(${(1 - cards[1]) * 16}px)`,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'拼出来的命令'}</div>
        <div style={{marginTop: 8, fontFamily: theme.mono, fontSize: 21, color: theme.text}}>{'cat docs/notes.md'}</div>
      </div>
      <svg width={246} height={120} style={{position: 'absolute', left: 850, top: 258}}>
        <path
          d="M4 60 C 50 10, 110 110, 150 60 S 210 10, 226 60"
          fill="none"
          stroke={theme.dim}
          strokeWidth={3}
          {...draw}
        />
        <polygon points="224,52 224,68 240,60" fill={theme.dim} opacity={head} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 870,
          top: 384,
          width: 190,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 18,
          color: theme.dim,
          opacity: head,
        }}
      >
        {'翻译损耗'}
      </div>
    </>
  );
};

const BookletPeek: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('slideR', {at, dist: 140, dur: DUR.f5});
  return (
    <div
      style={{
        position: 'absolute',
        left: 1600,
        top: 400,
        ...e,
        width: 220,
        textAlign: 'center',
      }}
    >
      <svg width={150} height={96}>
        <path d="M75 8 L18 28 V88 L75 68 Z" fill={withAlpha(theme.mech, 0.1)} stroke={theme.mech} strokeWidth={3} />
        <path d="M75 8 L132 28 V88 L75 68 Z" fill={withAlpha(theme.mech, 0.06)} stroke={withAlpha(theme.mech, 0.7)} strokeWidth={3} />
      </svg>
      <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 20, color: theme.mech}}>{'开单表'}</div>
    </div>
  );
};

// ── 2-B 表册登记：翻开（spring）＋两笔登记＋五科室行 ─────────────────────────

const RegistryBook: React.FC<{atOpen: number; atReg: number; atFive: number}> = ({atOpen, atReg, atFive}) => {
  const open = useSpring('settle', {at: atOpen, dur: DUR.f5});
  const regs = useStagger(2, {at: atReg, stride: 16, dur: DUR.f5});
  const fives = useStagger(5, {at: atFive, stride: 7, dur: DUR.f4});
  const inP = useProgress(atOpen, DUR.f4); // 承前镜自制段的切换缓入
  const depts = ['跑命令', '读文件', '写文件', '改文件', '找文件'];
  const specP = regs[0];
  const rowP = regs[1];
  return (
    <>
      {/* 册体：左＝说明单页，右＝登记页 */}
      <div
        style={{
          position: 'absolute',
          left: 630,
          top: 190,
          width: 660,
          height: 450,
          display: 'flex',
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 10,
          overflow: 'hidden',
          opacity: inP,
        }}
      >
        <div style={{flex: 1, position: 'relative', borderRight: `2px solid ${theme.panelBorder}`, padding: '20px 24px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'说明单页'}</div>
          <div
            style={{
              marginTop: 18,
              width: 250,
              padding: '14px 18px',
              background: withAlpha(theme.mech, 0.08),
              border: `2px solid ${withAlpha(theme.mech, 0.7)}`,
              borderRadius: 8,
              opacity: specP,
              transform: `translateY(${(1 - specP) * -26}px)`,
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.text}}>{'说明单'}</div>
            <div style={{marginTop: 8, fontFamily: theme.mono, fontSize: 15, color: theme.mech}}>{'TOOLS'}</div>
            {/* 压短关键词对（R11 改词：原「叫什么 · 怎么开」系口播 p2-04 逐字子串未登记豁免——RSI-007） */}
            <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 17, color: theme.dim}}>{'名称 · 开法'}</div>
          </div>
        </div>
        <div style={{flex: 1, position: 'relative', padding: '20px 24px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
            <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'登记页'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.mech, opacity: rowP}}>{'TOOL_HANDLERS'}</span>
          </div>
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              opacity: rowP,
              transform: `translateX(${(1 - rowP) * 18}px)`,
              borderBottom: `2px solid ${withAlpha(theme.mech, 0.75)}`,
              paddingBottom: 8,
            }}
          >
            <svg width={16} height={16}>
              <circle cx={8} cy={8} r={5} fill={theme.mech} />
            </svg>
            <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.text}}>{'name → handler'}</span>
          </div>
          {depts.map((dp, i) => {
            const p = fives[i];
            return (
              <div key={dp} style={{marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.3 + 0.7 * p}}>
                <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{`0${i + 1}`}</span>
                <span style={{fontFamily: theme.sans, fontSize: 19, color: p > 0.5 ? theme.text : theme.dim}}>{dp}</span>
              </div>
            );
          })}
        </div>
      </div>
      {/* 封面（spring 旋开）。backfaceVisibility 必须保留：过 90° 后渲染的是元素背面
          （「开单表」镜像反字），且投影落 [647,962] 会整盖左页说明单——藏背面后
          翻开只呈现 0→90° 的旋开段，左页说明单全程可见（2026-10-02 评审修复） */}
      <div
        style={{
          position: 'absolute',
          left: 962,
          top: 192,
          width: 326,
          height: 446,
          transformOrigin: 'left center',
          transform: `perspective(1300px) rotateY(${-165 * open}deg)`,
          backfaceVisibility: 'hidden',
          background: theme.bgDeep,
          border: `2px solid ${withAlpha(theme.mech, 0.5)}`,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.mech, letterSpacing: 4}}>{'开单表'}</span>
      </div>
    </>
  );
};

// ── 2-C 执行行翻转：写死调用 → 查表（spring 翻面＋mech 下划线）＋135 计数 ────

const FlipLine: React.FC<{at: number}> = ({at}) => {
  // R9 修复：翻面弹簧让位入场（原同锚 at=0——fade 7 帧内弹簧已过 90°，
  // 写死版正面从未以可读亮度呈现，见 2026-10-04 评审 F16）
  const s = useSpring('settle', {at: at + DUR.f4, dur: DUR.f5});
  const inP = useProgress(at, DUR.f4); // 承 archify 全屏窗的硬切缓入
  const under = useProgress(at + DUR.f4 + DUR.f5 - 3, DUR.f4); // effects 通道不吃弹簧（铁律③）
  return (
    <div style={{position: 'absolute', left: 560, top: 320, width: 800, height: 200, perspective: 1500, opacity: inP}}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transform: `rotateY(${180 * s}deg)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            background: theme.bgDeep,
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'写死调用'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.dim}}>{'run_bash()'}</span>
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: theme.bgDeep,
            border: `2px solid ${withAlpha(theme.mech, 0.7)}`,
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.mech}}>{'查表'}</span>
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 26,
              color: theme.text,
              borderBottom: `3px solid ${withAlpha(theme.mech, 0.9)}`,
              paddingBottom: 4,
              opacity: 0.45 + 0.55 * under,
            }}
          >
            {'HANDLERS[name](**input)'}
          </span>
        </div>
      </div>
    </div>
  );
};

const GaugeCell: React.FC<{at: number}> = ({at}) => {
  // 102→135 由 LINE_GAUGE 数据面派生（R10：消硬编码副本，与尺带同源）
  const n = Math.round(useCount({from: Number(LINE_GAUGE[0].label), to: Number(LINE_GAUGE[1].label), at, dur: DUR.f6}));
  const inP = useProgress(at, DUR.f3);
  return (
    <div style={{position: 'absolute', left: 684, top: 620, width: 190, textAlign: 'center', opacity: inP}}>
      <div style={{fontFamily: theme.mono, fontSize: 84, color: theme.core}}>{n}</div>
      <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'第二格 · +表'}</div>
    </div>
  );
};

// ── 2-D 破坏性实验封条卡＝ExpBadge（clinic 共享） ─────────────────────

// ── 2-E 多单与并行：左＝教学版按序串行（dim 排队）；右＝分批并行（mech 齐闪） ──

const SerialParallel: React.FC<{atCards: number; atQueue: number; atFlash: number; atNote: number}> = ({
  atCards,
  atQueue,
  atFlash,
  atNote,
}) => {
  const panels = useStagger(2, {at: atCards, stride: 12, dur: DUR.f5});
  const queue = useStagger(3, {at: atQueue, stride: 24, dur: DUR.f6});
  const flash = useImpulse({at: atFlash, dur: DUR.f5, peak: 1});
  const note = useProgress(atNote, DUR.f5); // 小注挂 p2-18（R11：原挂 panels[1] 提前 15s 泄结论）
  const names = ['查看', '列目录', '读配置'];
  const batch = ['只读 A', '只读 B', '只读 C'];
  return (
    <>
      {/* 左卡：按序串行（教学版，dim） */}
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 190,
          width: 730,
          height: 420,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 12,
          opacity: panels[0],
        }}
      >
        <div style={{padding: '16px 24px', fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>{'按序串行 · 教学版'}</div>
        <div
          style={{
            position: 'absolute',
            right: 26,
            top: 96,
            width: 120,
            height: 250,
            border: `2px solid ${withAlpha(theme.dim, 0.5)}`,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontSize: 19,
            color: theme.dim,
          }}
        >
          {'科室'}
        </div>
        {names.map((nm, i) => {
          const p = queue[i];
          return (
            <div
              key={nm}
              style={{
                position: 'absolute',
                // R12：stride 370=门框左缘 pb 580（730−2×2 边框−26−120）−起点 40−单宽 170，
                // 终位右缘恰贴门缘；原 380 越门框 10px 呈「破门」
                left: 40 + p * 370,
                top: 128 + i * 74,
                width: 170,
                padding: '10px 0',
                textAlign: 'center',
                background: theme.bgDeep,
                border: `2px solid ${withAlpha(theme.dim, 0.55)}`,
                borderRadius: 7,
                fontFamily: theme.sans,
                fontSize: 19,
                color: theme.dim,
                opacity: Math.min(1, p * 3),
              }}
            >
              {nm}
            </div>
          );
        })}
      </div>
      {/* 右卡：分批并行（真实实现，mech 批内齐闪＋批间保序） */}
      <div
        style={{
          position: 'absolute',
          left: 1040,
          top: 190,
          width: 730,
          height: 420,
          background: theme.panel,
          border: `2px solid ${withAlpha(theme.mech, 0.5)}`,
          borderRadius: 12,
          opacity: panels[1],
        }}
      >
        <div style={{padding: '16px 24px', fontFamily: theme.sans, fontSize: 23, color: theme.mech}}>{'分批并行 · 真实实现'}</div>
        {batch.map((tk) => (
          <div
            key={tk}
            style={{
              position: 'absolute',
              left: 40 + batch.indexOf(tk) * 190,
              top: 110,
              width: 168,
              padding: '12px 0',
              textAlign: 'center',
              background: theme.bgDeep,
              border: `2px solid ${theme.mech}`,
              borderRadius: 7,
              fontFamily: theme.sans,
              fontSize: 18,
              color: theme.text,
              transform: `scale(${1 + 0.06 * flash})`,
              boxShadow: `0 0 ${14 * flash}px ${withAlpha(theme.mech, 0.6 * flash)}`,
            }}
          >
            {tk}
          </div>
        ))}
        <svg width={60} height={90} style={{position: 'absolute', left: 330, top: 240}}>
          <path d="M30 6 V70 M18 58 L30 74 L42 58" fill="none" stroke={withAlpha(theme.mech, 0.8)} strokeWidth={4} strokeLinecap="round" />
        </svg>
        {batch.map((tk) => (
          <div
            key={`b2-${tk}`}
            style={{
              position: 'absolute',
              left: 40 + batch.indexOf(tk) * 190,
              top: 328,
              width: 168,
              padding: '12px 0',
              textAlign: 'center',
              background: theme.bgDeep,
              border: `2px solid ${withAlpha(theme.dim, 0.4)}`,
              borderRadius: 7,
              fontFamily: theme.sans,
              fontSize: 18,
              color: theme.dim,
            }}
          >
            {tk}
          </div>
        ))}
      </div>
      {/* 小注（分镜规格原文） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 664,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 21,
          color: theme.dim,
          opacity: note,
        }}
      >
        {'同一工具两个实例：'}
        <span style={{color: theme.ok}}>{'只读 ✓ 并行'}</span>
        {' ／ '}
        <span style={{color: theme.deny}}>{'带删除 ✗ 排队'}</span>
      </div>
      <ProvenanceTag x={1548} y={96} at={atFlash} />
    </>
  );
};

// ── 2-F 院内围栏：文件科细线围栏（mech 微光描线）＋命令外线（deny 警示一次） ──

const FenceCloseup: React.FC<{at: number; atBypass: number}> = ({at, atBypass}) => {
  const draw = useDraw(at, DUR.f5);
  const glow = useBreathe({period: 170, amp: 0.16, base: 0.84});
  const hot = useImpulse({at: atBypass, dur: DUR.f5, peak: 1});
  const mineIn = useEnter('pop', {at: atBypass + 6, dur: DUR.f4});
  const inP = useProgress(at, DUR.f4);
  // 四窗＝文件科全部四个工具（读/写/改/找——教学源工具表的 read/write/edit/glob）
  // ——原 3 窗漏「找文件」，暗示 glob 单子在围栏外，与 p2-19「文件类的单子
  // 不许出项目文件夹半步」相悖（2026-10-02 评审修复，围栏随之加宽 60px）
  const windows = [
    {x: 480, t: '读文件'},
    {x: 620, t: '写文件'},
    {x: 760, t: '改文件'},
    {x: 900, t: '找文件'},
  ];
  return (
    <div style={{position: 'absolute', inset: 0, opacity: inP}}>
      {/* 围栏（pathLength 归一化描画＋mech 微光） */}
      <svg width={680} height={430} style={{position: 'absolute', left: 420, top: 210}}>
        <path
          d="M26 14 H654 Q666 14 666 26 V404 Q666 416 654 416 H26 Q14 416 14 404 V26 Q14 14 26 14 Z"
          fill={withAlpha(theme.mech, 0.04)}
          stroke={theme.mech}
          strokeWidth={2.5}
          opacity={glow}
          {...draw}
        />
      </svg>
      <div style={{position: 'absolute', left: 420, top: 236, width: 680, textAlign: 'center', fontFamily: theme.sans, fontSize: 20, color: theme.mech}}>
        {'文件科 · 院内'}
      </div>
      {windows.map((wd) => (
        <div
          key={wd.t}
          style={{
            position: 'absolute',
            left: wd.x,
            top: 320,
            width: 130,
            height: 74,
            background: theme.panel,
            border: `2px solid ${withAlpha(theme.dim, 0.5)}`,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontSize: 19,
            color: theme.dim,
          }}
        >
          {wd.t}
        </div>
      ))}
      {/* 命令外线：绕开围栏直通门外（deny 警示描边一次） */}
      <div
        style={{
          position: 'absolute',
          left: 1180,
          top: 300,
          padding: '8px 18px',
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 8,
          fontFamily: theme.mono,
          fontSize: 20,
          color: theme.dim,
        }}
      >
        {'bash · 外线'}
      </div>
      <svg width={680} height={120} style={{position: 'absolute', left: 1210, top: 404}}>
        <path
          d="M10 100 C 160 20, 380 110, 560 40"
          fill="none"
          stroke={theme.deny}
          strokeWidth={3 + 2 * hot}
          strokeDasharray="16 14"
          opacity={0.5 + 0.5 * hot}
        />
        <polygon points="556,30 572,44 556,52" fill={theme.deny} opacity={0.5 + 0.5 * hot} />
      </svg>
      {/* 埋雷定格小卡 */}
      <div
        style={{
          position: 'absolute',
          left: 1300,
          top: 560,
          ...mineIn,
          padding: '10px 24px',
          background: withAlpha(theme.deny, 0.1),
          border: `2.5px dashed ${withAlpha(theme.deny, 0.85)}`,
          borderRadius: 8,
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.deny,
          letterSpacing: 2,
        }}
      >
        {'下一幕出事'}
      </div>
      <MonoTag x={436} y={166} at={at + 4}>{'safe_path · 仅文件科'}</MonoTag>
    </div>
  );
};

// ── 幕组装 ─────────────────────────────────────────────────────────────────

export const P2DispatchTable: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const bA = w('p2-01', 'p2-03');
  const bB = w('p2-04', 'p2-08');
  const bC = w('p2-09', 'p2-10');
  const bD = w('p2-11', 'p2-15');
  const bE = w('p2-16', 'p2-18');
  const bF = w('p2-19', 'p2-21');
  // p2-11 前半给封条卡（句尾让位给 unknown-in），帧数由句窗推导
  const seal11 = Math.round(dur('p2-11') * 0.5);

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A 单工具时代">
        <Doctor x={120} y={340} scale={0.7} />
        <div style={{position: 'absolute', left: 60, top: 476, width: 200, textAlign: 'center', fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>
          {'医生'}
        </div>
        <BashOnlyCard at={2} />
        <IntentSwap at={at('p2-02') - bA.from} />
        <BookletPeek at={at('p2-03') - bA.from} />
        <MonoTag x={884} y={146} at={2}>{'bash only'}</MonoTag>
      </Sequence>

      <Sequence {...bB} name="2-B 开单表登记">
        {/* p2-04..06 回落自制：表册翻开＋两笔登记＋五科室行 */}
        <Sequence durationInFrames={at('p2-07') - bB.from} name="2-B 表册两笔登记">
          <RegistryBook atOpen={at('p2-04') - bB.from} atReg={at('p2-04') - bB.from + 10} atFive={at('p2-06') - bB.from} />
        </Sequence>
        {/* 两章同实例背靠背（实例内自动抑制换章弹入） */}
        <ArchifyRecap
          slug="dispatch-table"
          caption="查表分发"
          cues={[
            {chapterId: 'table-lookup', at: at('p2-07') - bB.from, durationInFrames: dur('p2-07')},
            {chapterId: 'grow-table', at: at('p2-08') - bB.from, durationInFrames: dur('p2-08')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="2-C 执行行翻转">
        <FlipLine at={at('p2-09') - bC.from} />
        <GaugeCell at={at('p2-10') - bC.from} />
        <LineGauge lit={2} />
        {/* 口径注 y=830：原 y=878 落进行数尺格带（880..916）压住已点亮的第二格文字
            （2026-10-02 评审修复）——上移至尺带上方 50px 留隙 */}
        <MonoTag x={712} y={830} at={at('p2-09') - bC.from}>{'执行行：只换过一次 · 教学版'}</MonoTag>
      </Sequence>

      <Sequence {...bD} name="2-D 实验2取值分叉">
        {/* 同图五章连播一实例：unknown-in 承封条卡句尾让位，后四章窗窗相邻自动背靠背 */}
        <ArchifyRecap
          slug="lookup-failure"
          caption="未知名字的分叉"
          cues={[
            {chapterId: 'unknown-in', at: at('p2-11') - bD.from + seal11, durationInFrames: dur('p2-11') - seal11},
            // hard-crash 落 trim 留痕（契约同 P4 recall-loop）：p2-12 窗 4.47s vs
            // storySec 6.72s → rate 1.50，原速播＋裁尾约 2.2s（崩溃拍收束让位给自纠起句）
            {chapterId: 'hard-crash', at: at('p2-12') - bD.from, durationInFrames: dur('p2-12'), fit: 'trim'},
            {chapterId: 'soft-unknown', at: at('p2-13') - bD.from, durationInFrames: dur('p2-13')},
            {chapterId: 'self-fix', at: at('p2-14') - bD.from, durationInFrames: dur('p2-14')},
            {chapterId: 'verdict', at: at('p2-15') - bD.from, durationInFrames: dur('p2-15')},
          ]}
        />
        {/* p2-11 前半：实验封条卡（句尾让位给 unknown-in） */}
        <Sequence durationInFrames={seal11} name="2-D 实验封条">
          <ExpBadge x={742} y={408} at={2} n={2} />
          <MonoTag x={748} y={300} at={6}>{'KeyError vs Unknown'}</MonoTag>
        </Sequence>
      </Sequence>

      <Sequence {...bE} name="2-E 多单与并行">
        <SerialParallel
          atCards={at('p2-16') - bE.from}
          atQueue={at('p2-16') - bE.from + 8}
          atFlash={at('p2-17') - bE.from + 10}
          atNote={at('p2-18') - bE.from}
        />
      </Sequence>

      <Sequence {...bF} name="2-F 院内围栏">
        <ArchifyRecap
          slug="dispatch-table"
          caption="院内围栏"
          cues={[{chapterId: 'dept-exec', at: at('p2-19') - bF.from, durationInFrames: dur('p2-19')}]}
        />
        {/* p2-20..21 回落：围栏特写＋外线警示＋埋雷定格 */}
        <Sequence from={at('p2-20') - bF.from} name="2-F 围栏特写">
          <FenceCloseup at={2} atBypass={at('p2-21') - at('p2-20')} />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2DispatchTable;
