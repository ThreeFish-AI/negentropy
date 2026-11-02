/** P4 真实版的墙（p4-01..p4-09，4 镜）——分镜 4-A / 4-B / 4-C / 4-D。
 *
 *  叙事链：4-A 开帧真实版重墙全景一拍（3-E 轮廓兑现：同构加重体量——描边
 *  加粗 + 九槽暗影）→ 急推九字段卡特写（教学卡到真实卡的字段增量揭示）：
 *  六栏与教学卡同位同名 + 三栏新增（activeForm 进行时态描述 / blocks 下游
 *  列表 / metadata 元数据）金边高亮 +「+3」角标 → 文件树自卡背展开（三层：
 *  用户主目录 → 任务文件夹 → 每任务一文件）→ 4-B 认领上锁（3-D 悬置锁剪影
 *  兑现为实体锁，同形）：锁内五步链按口播次序逐节咬合（重读→查归属→查完成
 *  →查依赖→写归属）+ 锁外重试计数条跳动至 30 上限刻度锚定 + 等待拉长条
 *  5→100ms 双端刻度动态拉长 → 4-C 高水位标小卡浮起：刻度尺记最大编号（已用
 *  实色 / 未用虚色）→ 删掉的卡编号淡出、其刻度位保留虚痕 → 新卡跳号越过该
 *  位落下一格（编号不被复用的可视证明）→ 4-D 两步建图对比：左右双轨同卡
 *  同局——左「一把梭」（建卡同时写依赖一次落笔）↔ 右「两步走」（先四卡落位
 *  拿编号、再回头连边两拍分开）→ 上方同一轮回答里的几个调用块互相背对（视
 *  锥朝外）→ 左轨后建卡伸向先建卡编号——连线悬空断头（编号未生成不可引用）
 *  → 右轨连线逐条校验绿点点亮 +「契约」印章盖落定格。
 *
 *  空间契约：九栏中六栏与教学卡同位同名可对位、三栏增量唯一高亮源（金边
 *    不与旧六栏混色）、文件树层级 ≤3 层、路径细节进角标不抢焦；五步链环
 *    次序=口播、计数条带 30 上限刻度与 5/100 双端刻度、锁与 3-D 剪影同形
 *    （兑现非新建）、计数不越 30；刻度只升不降、删卡位留虚痕、新编号越过
 *    旧位；左右轨同卡同局（唯一差异=建图次序）、调用块背对姿态恒定、印章
 *    只盖右轨、左轨连线不得成功引用未生成编号。
 *
 *  红线落实：词落位 = wa(id,f)（manifest 已就位——⑧ 轮按句内字位复核一轮通过，
 *    词级实测复核留 ⑨ 轮 QA；登记口径见 P0 头注）；y≥56 / bottom≥176；TaskRecord ·
 *    ~/.claude/tasks/{taskListId}/ · claimTask · proper-lockfile · retry 30 ·
 *    backoff 5–100 ms · .highwatermark · update_task 只进角标。
 *
 *  承接登记：3-E→4-A morph（storyboard 登记）——重墙轮廓剪影渐显体量（3-E
 *    远处同位）→ 本幕首帧轮廓兑现为真墙全景（体量与九槽暗影显形）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {BuildGraphCompare, ClaimLock, HighWaterMark, TaskWall} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 4-A 真实版重墙：九字段卡急推（六旧栏 + 三新栏金边）+ 文件树展开 ─────────

/** 重墙九槽（3×3——TaskWall heavy 同几何：col 375/780/1185 · row 190/390/590） */
const HEAVY_MID = {x: 780, y: 390, w: 360, h: 160} as const;

/** 九字段栏（前两行 = 教学六字段同位同名；第三行 = 三栏增量，金边 +3） */
const NINE_FIELDS = [
  {k: '编号', v: 'task_001', isNew: false},
  {k: '标题', v: '写初稿', isNew: false},
  {k: '描述', v: '内容工厂首篇', isNew: false},
  {k: '状态', v: '待领', isNew: false},
  {k: '归属人', v: '—', isNew: false},
  {k: '依赖列表', v: '[ ]', isNew: false},
  {k: 'activeForm', v: '进行时态', isNew: true},
  {k: 'blocks', v: '下游列表', isNew: true},
  {k: 'metadata', v: '元数据', isNew: true},
] as const;

const FourA: React.FC<{atZoom: number; atFields: number; atTree: number}> = ({atZoom, atFields, atTree}) => {
  const frame = useCurrentFrame();
  // 急推（显式帧数 26f——@pushIn 词锚动机：教学卡到真实卡的字段增量揭示）
  const zoomP = clamp01(progress(frame, atZoom, 26));
  const o = {x: HEAVY_MID.x + HEAVY_MID.w / 2, y: HEAVY_MID.y + HEAVY_MID.h / 2};
  const c = {x: 880, y: 540};
  const z = 1 + (2.4 - 1) * zoomP;
  const zoomTf = `translate(${(c.x - o.x) * zoomP}px, ${(c.y - o.y) * zoomP}px) scale(${z})`;
  // 九栏 stagger 点亮（次序=行序：六旧栏先亮、三新栏金边随后）
  const fieldP = NINE_FIELDS.map((_, i) => clamp01(progress(frame, atFields + i * 3, 9)));
  // 文件树自卡背展开（zoom 外独立层——三层：主目录 → 任务文件夹 → 每任务一文件）
  const treeRoot = clamp01(progress(frame, atTree, DUR.f4));
  const treeDir = clamp01(progress(frame, atTree + 8, DUR.f4));
  const treeFiles = [0, 1, 2, 3, 4].map((i) => clamp01(progress(frame, atTree + 16 + i * 4, DUR.f3)));
  // 卡背→树根连线
  const linkP = clamp01(progress(frame, atTree + 4, 12));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: zoomTf, transformOrigin: `${o.x}px ${o.y}px`}}>
        {/* 真实版重墙全景（3-E 轮廓兑现——同构加重体量非新建视觉） */}
        <TaskWall litP={1} slotsP={1} glowP={0.35} heavy />
        {/* 九字段卡（中槽——随 zoom 放大为特写；金边 = core 橙系增量高亮） */}
        <div
          style={{
            position: 'absolute',
            left: HEAVY_MID.x,
            top: HEAVY_MID.y,
            width: HEAVY_MID.w,
            height: HEAVY_MID.h,
            borderRadius: 10,
            border: `3px solid ${theme.mech}`,
            background: withAlpha(theme.panel, 0.97),
            padding: 7,
            boxShadow: zoomP > 0.9 ? `0 0 22px ${withAlpha(theme.mech, 0.3)}` : 'none',
          }}
        >
          {/* 九栏 3×3（每栏：字段名 + 极短值；新栏金边 + 单元级边框） */}
          {NINE_FIELDS.map((f, i) => {
            const p = fieldP[i];
            const col = i % 3;
            const row = Math.floor(i / 3);
            return (
              <div
                key={f.k}
                style={{
                  position: 'absolute',
                  left: 7 + col * 116,
                  top: 7 + row * 49,
                  width: 108,
                  height: 43,
                  borderRadius: 6,
                  border: `2px ${p > 0.35 ? 'solid' : 'dashed'} ${p > 0.35 ? (f.isNew ? withAlpha(theme.core, 0.95) : withAlpha(theme.mech, 0.8)) : withAlpha(theme.dim, 0.45)}`,
                  background: p > 0.35 ? (f.isNew ? withAlpha(theme.core, 0.14) : withAlpha(theme.mech, 0.1)) : 'transparent',
                  padding: '3px 7px',
                  opacity: 0.3 + 0.7 * p,
                  boxShadow: f.isNew && p > 0.9 ? `0 0 9px ${withAlpha(theme.core, 0.5)}` : 'none',
                }}
              >
                <div style={{fontFamily: theme.mono, fontSize: 10, color: f.isNew ? theme.core : p > 0.35 ? theme.mech : theme.dim, whiteSpace: 'nowrap'}}>{f.k}</div>
                <div style={{fontFamily: theme.mono, fontSize: 11, color: theme.text, whiteSpace: 'nowrap', opacity: p > 0.5 ? 0.9 : 0}}>{p > 0.5 ? f.v : ''}</div>
              </div>
            );
          })}
        </div>
        {/* 「+3」角标签（三栏增量的计数锚——贴卡右下角外） */}
        {fieldP[8] > 0.5 ? (
          <div
            style={{
              position: 'absolute',
              left: HEAVY_MID.x + HEAVY_MID.w - 40,
              top: HEAVY_MID.y + HEAVY_MID.h + 8,
              padding: '3px 14px',
              borderRadius: 8,
              border: `2.5px solid ${theme.core}`,
              background: theme.panel,
              fontFamily: theme.mono,
              fontSize: 13,
              fontWeight: 700,
              color: theme.core,
              whiteSpace: 'nowrap',
              opacity: clamp01(progress(frame, atFields + 27, DUR.f3)),
            }}
          >
            {'+3'}
          </div>
        ) : null}
      </div>
      {/* 文件树（zoom 外——卡右缘生长的三层树：主目录 → 任务文件夹 → 每任务一文件） */}
      {treeRoot > 0.02 ? (
        <div style={{position: 'absolute', left: 1330, top: 168, width: 540}}>
          <svg width={80} height={140} viewBox="0 0 80 140" style={{position: 'absolute', left: -78, top: 200, overflow: 'visible', opacity: linkP}}>
            <path d="M 4 132 C 40 120 46 40 76 14" fill="none" stroke={withAlpha(theme.tool, 0.65)} strokeWidth={2.5} strokeDasharray="7 6" />
          </svg>
          {/* L1 用户主目录 */}
          <div style={{display: 'flex', alignItems: 'center', gap: 10, opacity: treeRoot}}>
            <svg width={22} height={18} viewBox="0 0 22 18">
              <path d="M 1 4 L 8 4 L 10 6 L 21 6 L 21 17 L 1 17 Z" fill={withAlpha(theme.tool, 0.3)} stroke={withAlpha(theme.tool, 0.8)} strokeWidth={1.6} />
            </svg>
            <span style={{fontFamily: theme.mono, fontSize: 21, color: theme.text, whiteSpace: 'nowrap'}}>{'~/.claude/'}</span>
          </div>
          {/* L2 任务文件夹 */}
          <div style={{display: 'flex', alignItems: 'center', gap: 10, marginLeft: 44, marginTop: 14, opacity: treeDir}}>
            <svg width={22} height={18} viewBox="0 0 22 18">
              <path d="M 1 4 L 8 4 L 10 6 L 21 6 L 21 17 L 1 17 Z" fill={withAlpha(theme.tool, 0.3)} stroke={withAlpha(theme.tool, 0.8)} strokeWidth={1.6} />
            </svg>
            <span style={{fontFamily: theme.mono, fontSize: 21, color: theme.text, whiteSpace: 'nowrap'}}>{'tasks/{taskListId}/'}</span>
          </div>
          {/* L3 每任务一文件 */}
          <div style={{marginLeft: 92, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8}}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={`tf${i}`} style={{display: 'flex', alignItems: 'center', gap: 9, opacity: treeFiles[i], transform: `translateX(${(1 - treeFiles[i]) * -12}px)`}}>
                <svg width={17} height={21} viewBox="0 0 17 21">
                  <path d="M 2 1 L 11 1 L 15 5 L 15 20 L 2 20 Z" fill={withAlpha(theme.panel, 0.95)} stroke={withAlpha(theme.dim, 0.85)} strokeWidth={1.6} />
                </svg>
                <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, whiteSpace: 'nowrap'}}>{`task_00${i + 1}.json`}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'TaskRecord · ~/.claude/tasks/{taskListId}/'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-B 认领上锁：锁体闭合 + 五步链咬合 + 计数跳 30 + 等待拉长 ─────────────

const FourB: React.FC<{atClose: number; atChain: number[]; atRetry: number; atWait: number}> = ({atClose, atChain, atRetry, atWait}) => {
  const frame = useCurrentFrame();
  // 锁体闭合（3-D 剪影兑现为实体锁——同形）
  const close = clamp01(progress(frame, atClose, DUR.f5));
  // 五步链按口播次序逐节咬合（重读→查归属→查完成→查依赖→写归属）
  const chainP = atChain.reduce((acc, a) => acc + clamp01(progress(frame, a, 10)), 0);
  // 重试计数跳动至 30（数据本体禁过冲——线性步进，上限刻度锚定）
  const retryP = clamp01(progress(frame, atRetry, 40));
  const retryN = Math.round(30 * retryP);
  // 等待拉长条 5→100ms（双端刻度锚定）
  const waitP = clamp01(progress(frame, atWait, 34));
  const waitMs = 5 + 95 * waitP;
  return (
    <AbsoluteFill>
      <ClaimLock x={580} y={150} closeP={close} chainP={chainP} retryN={retryN} waitMs={waitMs} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'claimTask · proper-lockfile · retry 30 · backoff 5–100 ms'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C 高水位标：刻度标定 + 删卡虚痕 + 跳号落位 ───────────────────────────

const FourC: React.FC<{atRise: number; atMark: number; atDel: number; atSkip: number; atLabel: number}> = ({atRise, atMark, atDel, atSkip, atLabel}) => {
  const frame = useCurrentFrame();
  const rise = clamp01(progress(frame, atRise, DUR.f5));
  const mark = clamp01(progress(frame, atMark, 14));
  const del = clamp01(progress(frame, atDel, 22));
  const skip = clamp01(progress(frame, atSkip, 26));
  const label = clamp01(progress(frame, atLabel, DUR.f4));
  return (
    <AbsoluteFill>
      <HighWaterMark x={530} y={230} w={860} litP={rise} markP={mark} delP={del} skipP={skip} />
      {/* 「编号不被复用」标签（装置下方——机制名落点） */}
      {label > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 486,
            display: 'flex',
            justifyContent: 'center',
            opacity: label,
            transform: `translateY(${(1 - label) * 12}px)`,
          }}
        >
          <span style={{padding: '8px 28px', borderRadius: 10, border: `2.5px solid ${withAlpha(theme.dim, 0.85)}`, background: theme.panel, fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
            {'编号不被复用'}
          </span>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'.highwatermark'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-D 两步建图对比：一把梭 ↔ 两步走 + 背对调用块 + 悬空断头 + 契约印章 ───

const FourD: React.FC<{atLeft: number; atNodes: number; atEdges: number; atBack: number; atDangle: number; atCheck: number; atStamp: number}> = ({atLeft, atNodes, atEdges, atBack, atDangle, atCheck, atStamp}) => {
  const frame = useCurrentFrame();
  const left = clamp01(progress(frame, atLeft, 24));
  const nodes = clamp01(progress(frame, atNodes, 18));
  const edges = clamp01(progress(frame, atEdges, 20));
  const back = clamp01(progress(frame, atBack, 20));
  const dangle = clamp01(progress(frame, atDangle, 22));
  const check = clamp01(progress(frame, atCheck, 30)) * 3;
  const stamp = clamp01(progress(frame, atStamp, 20));
  // 印章落定轻推近（镜头语言收束——@pushIn 幕内真调用）
  const push = usePushIn(atStamp + 8, {scale: 0.045, dur: DUR.f5});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '62% 38%'}}>
        <BuildGraphCompare x={170} y={214} leftP={left} nodesP={nodes} edgesP={edges} backP={back} dangleP={dangle} checkP={check} stampP={stamp} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'update_task · 先建点 · 再连边'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P4RealWall: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p4-01', 'p4-02');
  const bB = w('p4-03', 'p4-04');
  const bC = w('p4-05');
  const bD = w('p4-06', 'p4-09');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <FourA atZoom={wa('p4-01', 0.55) - bA.from} atFields={wa('p4-01', 0.78) - bA.from} atTree={wa('p4-02', 0.3) - bA.from} />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <FourB
          atClose={wa('p4-03', 0.3) - bB.from}
          atChain={[0.52, 0.62, 0.72, 0.82, 0.9].map((f) => wa('p4-03', f) - bB.from)}
          atRetry={wa('p4-04', 0.36) - bB.from}
          atWait={wa('p4-04', 0.64) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <FourC atRise={4} atMark={wa('p4-05', 0.34) - bC.from} atDel={wa('p4-05', 0.54) - bC.from} atSkip={wa('p4-05', 0.8) - bC.from} atLabel={wa('p4-05', 0.7) - bC.from} />
      </Sequence>
      <Sequence {...bD} name="4-D">
        <FourD
          atLeft={wa('p4-06', 0.52) - bD.from}
          atNodes={wa('p4-06', 0.56) - bD.from}
          atEdges={wa('p4-06', 0.86) - bD.from} // ⑨ QA N2：0.68→0.86——拉开「先建点后连边」两拍间隔（静止帧可辨）
          atBack={wa('p4-07', 0.6) - bD.from}
          atDangle={wa('p4-08', 0.3) - bD.from}
          atCheck={wa('p4-09', 0.4) - bD.from}
          atStamp={wa('p4-09', 0.68) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4RealWall;
