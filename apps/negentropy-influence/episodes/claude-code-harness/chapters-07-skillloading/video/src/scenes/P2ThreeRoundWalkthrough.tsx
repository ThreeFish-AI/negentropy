/** P2 三轮实测（p2-01..p2-09，4 镜）——分镜 2-A / 2-B / 2-C / 2-D。
 *
 *  叙事链：2-A 走查舞台全景（全景坐标锚）：三件套并置——左开场白带（紫、含目录
 *  四行）+ 中消息条队列（三轮格位）+ 右蓝色全文卡待命；顶部三轮输入计数器（323
 *  待命）；环体〔M-001〕缩悬顶角。「四个技能」目录四行逐行点亮〔M-005〕、
 *  「两百来个字符」带尾字符计数签（角标 episode C）→「二百八十一」开场白带角标
 *  定格 281（角标 system_chars）+ 计数器首轮亮 323（角标 per_turn_input——两
 *  口径分置并列、同拍落账）→「要动数据库」任务签落入消息首格、「点了名」目录
 *  「数据库指南」行高亮（承 1-B 同签，token 跨幕可追）→ 2-B 加载进场特写：
 *  「进场一次」全文卡沿通道一次性贴入（承 1-C 同款通道）、「两千三百八十四」
 *  计数器两跳定格——323→352（轻跳）→2384（重跳）→「已在历史」全文卡驻历史区、
 *  「不再重复加载」通道口「已在内」标记亮起、重复加载箭头虚化禁行 → 2-C 总账
 *  定格重音镜：计数器放大居中——三轮总输入 3059 count-up 定格（基线锚定：三小
 *  格汇入总格——加法关系可读；终值不过冲）→ 2-D 量级对比条舞台：「原作者给过
 *  估计」口径签贴上（量级估计·非实测口径）、「计价单位」量轴单位签（角标 ~100
 *  vs ~2000 tokens/skill）、「百来个」目录小格长到位；「两千上下」全文大格长到
 *  位（百级 vs 千级一拍拉开）、「差一个数量级」10× 落差带点亮（重音镜）；「全
 *  塞进开场白」悬念签浮起（反问钩，转 P3）。
 *
 *  空间契约：三件套左中右恒定、281 与 323 两口径角标分置不混写、计数器跳格不
 *  早于点名（次序=口播次序）、全文卡只进场一次、计数器三值与角标序列一致
 *  （323/352/2384）、总账=三轮之和的加法关系、count-up 不越 3059、口径签全程
 *  可见（量级估计归属——禁实测化）、两格比例一个数量级（10×）。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；episode C · system_chars
 *  281 · per_turn_input · total 3059 · ~100 vs ~2000 tokens/skill 只进角标；
 *  计数读数 Math.round(有界值) 直取、不经 clamp01。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CatalogBand, FullTextCard, LoadChannel, LoopRing, RoundCounter} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 目录四行（承 P1 同签同色——token 跨幕可追） */
const CATALOG_ROWS = [
  {name: '界面规范', sub: 'react-style · 组件写法约定'},
  {name: '数据库指南', sub: 'sql-style · 表与迁移规范'},
  {name: '接口文档', sub: 'api-design · REST 设计约定'},
  {name: '文档处理', sub: 'pdf · 文档处理规则'},
] as const;

/** 消息条队列（三轮格位） */
const MsgQueue: React.FC<{x: number; y: number; w: number; taskLit: number; cardIn: number; cardGhost: number}> = ({x, y, w, taskLit, cardIn, cardGhost}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w}}>
    <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginBottom: 10}}>{'messages · 三轮'}</div>
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        style={{
          position: 'relative',
          height: 88,
          marginBottom: 14,
          boxSizing: 'border-box',
          borderRadius: 10,
          border: `2.5px solid ${withAlpha(theme.panelBorder, 0.9)}`,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 14,
          gap: 12,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{`轮 ${i + 1}`}</span>
        {/* 首格任务签（2-A「要动数据库」落入） */}
        {i === 0 ? (
          <span
            style={{
              padding: '4px 12px',
              borderRadius: 7,
              border: `2px solid ${theme.text}`,
              fontFamily: theme.sans,
              fontSize: 16,
              fontWeight: 600,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: clamp01(taskLit),
            }}
          >
            {'动数据库'}
          </span>
        ) : null}
        {/* 第二格全文卡落位（2-B 一次性进场、贴进历史区——已在历史） */}
        {i === 1 ? (
          <span
            style={{
              width: 240,
              height: 58,
              boxSizing: 'border-box',
              borderRadius: 8,
              border: `2.5px solid ${theme.load}`,
              background: withAlpha(theme.load, 0.12),
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 10,
              fontFamily: theme.mono,
              fontSize: 13,
              color: theme.load,
              whiteSpace: 'nowrap',
              opacity: clamp01(cardIn),
            }}
          >
            {'SKILL.md · 全文'}
          </span>
        ) : null}
        {/* 第三格：全文驻历史（每轮在场——承 P5 堆积伏笔的静态面） */}
        {i === 2 ? (
          <span
            style={{
              width: 240,
              height: 58,
              boxSizing: 'border-box',
              borderRadius: 8,
              border: `2px solid ${withAlpha(theme.load, 0.5)}`,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 10,
              fontFamily: theme.mono,
              fontSize: 13,
              color: theme.dim,
              whiteSpace: 'nowrap',
              opacity: clamp01(cardGhost),
            }}
          >
            {'全文 · 已在历史'}
          </span>
        ) : null}
      </div>
    ))}
  </div>
);

// ── 2-A 走查舞台全景：三件套 + 双口径落账 + 点名 ─────────────────────────

const TwoA: React.FC<{atRows: number; atChars: number; atSys: number; atTask: number; atHit: number}> = ({
  atRows,
  atChars,
  atSys,
  atTask,
  atHit,
}) => {
  const frame = useCurrentFrame();
  // 「四个技能」目录四行逐行点亮（次序=口播）
  const rowsLit = 4 * clamp01(progress(frame, atRows, DUR.f6));
  // 「两百来个字符」带尾字符计数签（角标 episode C）
  const chars = useProgress(atChars, DUR.f4);
  // 「二百八十一」带角标定格 281（system_chars）+ 计数器首轮亮 323（per_turn_input）
  // ——双计数同拍、两口径分置不混写
  const sys = useProgress(atSys, DUR.f4);
  const sysFlash = useImpulse({at: atSys, dur: DUR.f5, peak: 1});
  const cell1 = useProgress(atSys + 3, DUR.f4);
  // 「要动数据库」任务签落入消息首格；「点了名」目录「数据库指南」行高亮
  const task = useProgress(atTask, DUR.f4);
  const hit = useProgress(atHit, DUR.f4);
  const hitPulse = useImpulse({at: atHit, dur: DUR.f5, peak: 1});
  const dot = ((frame / 75) % 1 + 1) % 1;
  return (
    <AbsoluteFill>
      {/* 环体缩悬顶角（M-001 同形小尺度） */}
      <div style={{position: 'absolute', left: 120, top: 96, opacity: 0.9}}>
        <LoopRing size={130} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {/* 左：开场白带（紫·含目录四行 + 双口径角标） */}
      <div style={{position: 'absolute', left: 110, top: 360}}>
        <CatalogBand
          x={0}
          y={0}
          w={560}
          h={196}
          rows={CATALOG_ROWS}
          rowsLit={rowsLit}
          hitRow={hit > 0.02 ? 1 : -1}
          rowPulse={hit + hitPulse * 0.5}
          charText={'281'}
          charLit={sys}
        />
        {/* system_chars 角标（281 定格口径——与 323 分置） */}
        <div style={{position: 'absolute', right: 14, bottom: -34, fontFamily: theme.mono, fontSize: 14, color: theme.dim, opacity: sys, whiteSpace: 'nowrap'}}>
          {'system_chars 281'}
        </div>
        {/* 带尾字符计数签（~两百字符——episode C 角标） */}
        <div style={{position: 'absolute', left: 0, bottom: -34, fontFamily: theme.mono, fontSize: 14, color: theme.dim, opacity: chars, whiteSpace: 'nowrap'}}>
          {'目录四行 · ~200 字符 · episode C'}
        </div>
      </div>
      {/* 中：消息条队列（三轮格位） */}
      <MsgQueue x={760} y={380} w={470} taskLit={task} cardIn={0} cardGhost={0} />
      {/* 右：蓝色全文卡待命 */}
      <div style={{position: 'absolute', left: 1500, top: 320}}>
        <FullTextCard x={0} y={0} w={250} h={430} rowsLit={6} dim={0.25} />
      </div>
      {/* 顶部三轮输入计数器（323 待命→首轮亮——per_turn_input 口径） */}
      <div style={{position: 'absolute', left: 760, top: 150}}>
        <RoundCounter
          x={0}
          y={0}
          bigValue={323 * clamp01(cell1)}
          label={'per_turn_input'}
          cellsLit={cell1}
          activeCell={cell1 > 0.5 ? 0 : -1}
          flash={sysFlash}
        />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'走查 · episode C 三轮'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-B 加载进场特写：一拍进场 + 计数器两跳 + 已在内 ──────────────────────

const TwoB: React.FC<{atEnter: number; atJump1: number; atJump2: number; atHist: number; atMark: number}> = ({
  atEnter,
  atJump1,
  atJump2,
  atHist,
  atMark,
}) => {
  const frame = useCurrentFrame();
  // 「进场一次」全文卡沿通道一次性贴入（承 1-C 同款通道——一次一拍完成）
  const enter = clamp01(progress(frame, atEnter, DUR.f5 + DUR.f3));
  const enterFlash = useImpulse({at: atEnter + DUR.f5, dur: DUR.f5, peak: 1});
  // 「两千三百八十四」计数器两跳定格：323→352（轻跳）→2384（重跳）
  const j1 = useProgress(atJump1, DUR.f4);
  const j2 = useProgress(atJump2, DUR.f5);
  const bigValue = 323 + (352 - 323) * j1 + (2384 - 352) * j2;
  const cellsLit = 1 + j1 + j2;
  const activeCell = j2 > 0.02 ? 2 : j1 > 0.02 ? 1 : 0;
  const jumpFlash = useImpulse({at: atJump1, dur: DUR.f5, peak: 0.6});
  const jumpFlash2 = useImpulse({at: atJump2, dur: DUR.f6, peak: 1});
  // 「已在历史」全文卡驻历史区（ghostMark）；「不再重复加载」通道口「已在内」
  const hist = useProgress(atHist, DUR.f4);
  const mark = useProgress(atMark, DUR.f4);
  const markFlash = useImpulse({at: atMark, dur: DUR.f5, peak: 1});
  // 全文卡飞行（通道右口 → 历史区第二格）
  const flyX = 1480 - 940 * enter;
  return (
    <AbsoluteFill>
      {/* 加载通道（承 1-C 同款——右口进、左端接消息历史区） */}
      <div style={{position: 'absolute', left: 260, top: 330}}>
        <LoadChannel x={0} y={0} w={880} h={62} flow={frame / 26} mouthLit={enter > 0.02 ? 1 : 0.4} inMark={mark} ghostArrow={mark} />
      </div>
      <div style={{position: 'absolute', left: 262, top: 402, fontFamily: theme.mono, fontSize: 14, color: theme.load}}>{'load_skill · 一次性进场'}</div>
      {/* 消息历史区（三轮格位——全文贴进第二格、驻历史） */}
      <MsgQueue x={180} y={520} w={620} taskLit={1} cardIn={Math.max(enter * 1.6 - 0.6, 0)} cardGhost={hist} />
      {/* 全文卡沿通道飞行（一拍——右→左） */}
      {enter > 0.01 && enter < 0.9 ? (
        <div style={{position: 'absolute', left: flyX, top: 300, opacity: clamp01(enter * 5) * (1 - clamp01((enter - 0.82) * 6))}}>
          <FullTextCard x={0} y={0} w={160} h={220} rowsLit={12} title={'数据库指南'} tag={''} flash={enterFlash} />
        </div>
      ) : null}
      {/* 全文卡驻历史区（放大些的历史位——ghostMark 已在内） */}
      <div style={{position: 'absolute', left: 900, top: 480, opacity: hist}}>
        <FullTextCard x={0} y={0} w={240} h={360} rowsLit={12} ghostMark={mark} flash={markFlash} />
      </div>
      {/* 计数器（两跳定格——323→352→2384；⑨ QA RISKY-4：352 中间值句中先跳、
          保持 36f（≥15f）后句尾再重跳 2384） */}
      <div style={{position: 'absolute', left: 1240, top: 170}}>
        <RoundCounter
          x={0}
          y={0}
          scale={0.9}
          bigValue={bigValue}
          label={'per_turn_input'}
          cellsLit={cellsLit}
          activeCell={activeCell}
          flash={Math.max(jumpFlash, jumpFlash2)}
        />
        {/* ⑨ QA N2：口径切换小标——2384 为三轮上下文累计读数 */}
        <div style={{marginTop: 8, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap', opacity: clamp01(j2)}}>
          {'轮 3 · 上下文累计'}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'进场一次 · 此后都在历史里'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-C 总账定格重音镜：count-up 3059 + 三小格汇入 ────────────────────────

const TwoC: React.FC<{atCount: number; atHold: number}> = ({atCount, atHold}) => {
  const frame = useCurrentFrame();
  // ⑨ QA W2：分镜锁定式台账——总账按三轮部分和阶梯累进（0→323→675→3059，
  // 每个显示值都是闭合值：323 / 323+352 / 3059），三步各 DUR.f3 近定格步进，
  // 不出现 956/2061 类不闭合中间数；算式行自 beat 起点常驻可读
  const s1 = clamp01(progress(frame, atCount, DUR.f3));
  const s2 = clamp01(progress(frame, atCount + 10, DUR.f3));
  const s3 = clamp01(progress(frame, atCount + 20, DUR.f3));
  const total = 323 * s1 + 352 * s2 + 2384 * s3;
  const cellsLit = s1 + s2 + s3;
  const eqLit = useProgress(atCount, DUR.f4);
  const cellsJoin = useProgress(atCount + 26, DUR.f5);
  // punch 定格一拍（1–2s 重音镜）
  const hold = useImpulse({at: atHold, dur: DUR.f6, peak: 0.1});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 560, top: 240, transform: `scale(${1.35 + hold * 0.1})`, transformOrigin: 'left top'}}>
        <RoundCounter
          x={0}
          y={0}
          bigValue={total}
          label={'total · 三轮总输入'}
          cellsLit={cellsLit}
          activeCell={-1}
          flash={cellsJoin}
          totalMode={cellsJoin}
          totalFrom={[323, 352, 2384]}
        />
      </div>
      {/* 加法关系注（323+352+2384=3059——基线锚定可读，⑨ QA W2：beat 起点常驻） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 780, textAlign: 'center', fontFamily: theme.mono, fontSize: 22, color: theme.dim, opacity: eqLit, fontVariantNumeric: 'tabular-nums'}}>
        {'323 + 352 + 2384 = 3059'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'三轮跑完 · 总输入定格'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-D 量级对比条舞台：百级 vs 千级 + 10× 落差带 ─────────────────────────

const TwoD: React.FC<{atCaliber: number; atUnit: number; atSmall: number; atBig: number; atGap: number; atHook: number}> = ({
  atCaliber,
  atUnit,
  atSmall,
  atBig,
  atGap,
  atHook,
}) => {
  // 口径签（量级估计·非实测口径——全程可见）+ 单位签（~100 vs ~2000 tokens/skill）
  const caliber = useProgress(atCaliber, DUR.f4);
  const unit = useProgress(atUnit, DUR.f4);
  // 目录小格（百级）长到位 / 全文大格（千级）长到位——一拍拉开
  const small = useProgress(atSmall, DUR.f5);
  const big = useProgress(atBig, DUR.f5, 'decelerate');
  // 10× 落差带点亮（重音镜——真实比例 100:2000）
  const gap = useProgress(atGap, DUR.f5);
  const gapPulse = useImpulse({at: atGap, dur: DUR.f6, peak: 0.08});
  // 悬念签（反问钩——转 P3）
  const hook = useProgress(atHook, DUR.f5);
  const BAR = {x: 360, w: 1280} as const;
  const smallW = 1280 * (100 / 2000);
  return (
    <AbsoluteFill>
      {/* 口径签（原作者的量级估计——非实测口径；全程可见） */}
      <div
        style={{
          position: 'absolute',
          left: 360,
          top: 150,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 16px',
          borderRadius: 8,
          border: `2.5px solid ${withAlpha(theme.dim, 0.85)}`,
          background: theme.panel,
          fontFamily: theme.sans,
          fontSize: 18,
          color: theme.text,
          whiteSpace: 'nowrap',
          opacity: caliber,
        }}
      >
        {'量级估计 · 非实测口径'}
        <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'原作者给过'}</span>
      </div>
      {/* 单位签（计价单位——tokens/skill 角标） */}
      <div style={{position: 'absolute', left: 360, top: 218, fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: unit, whiteSpace: 'nowrap'}}>
        {'计价单位 · ~100 vs ~2000 tokens/skill'}
      </div>
      {/* 目录小格（百级——紫） */}
      <div style={{position: 'absolute', left: BAR.x, top: 360}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 8}}>
          <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.mech}}>{'目录 · 每技能'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'~100'}</span>
        </div>
        <div
          style={{
            width: smallW * small + 14,
            height: 64,
            boxSizing: 'border-box',
            borderRadius: 9,
            border: `3px solid ${theme.mech}`,
            background: withAlpha(theme.mech, 0.14),
          }}
        />
      </div>
      {/* 全文大格（千级——蓝） */}
      <div style={{position: 'absolute', left: BAR.x, top: 540}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 8}}>
          <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.load}}>{'全文 · 每技能'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'~2000'}</span>
        </div>
        <div
          style={{
            width: (BAR.w - 14) * big + 14,
            height: 64,
            boxSizing: 'border-box',
            borderRadius: 9,
            border: `3px solid ${theme.load}`,
            background: withAlpha(theme.load, 0.14),
          }}
        />
      </div>
      {/* 数量级落差带（10×——两格右端落差的可读标注；真实比例） */}
      {gap > 0.02 ? (
        <svg width={260} height={280} viewBox="0 0 260 280" style={{position: 'absolute', left: BAR.x + smallW + 30, top: 350, overflow: 'visible', opacity: gap}}>
          <path d={`M 10 ${86} L 200 ${86} L 200 ${266}`} fill="none" stroke={withAlpha(theme.text, 0.7)} strokeWidth={3} strokeDasharray="8 8" />
          <g transform={`translate(96 70) scale(${1 + gapPulse}) translate(-96 -70)`}>
            <text x={96} y={70} textAnchor="middle" fontFamily={theme.mono} fontSize={40} fontWeight={700} fill={theme.text}>
              {'10×'}
            </text>
          </g>
          <text x={96} y={104} textAnchor="middle" fontFamily={theme.sans} fontSize={15} fill={theme.dim}>
            {'差一个数量级'}
          </text>
        </svg>
      ) : null}
      {/* 悬念签（反问钩——转 P3 破坏实验） */}
      {hook > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 660,
            top: 760,
            padding: '12px 28px',
            borderRadius: 10,
            border: `2.5px solid ${withAlpha(theme.danger, 0.8)}`,
            background: theme.panel,
            fontFamily: theme.serif,
            fontSize: 32,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: hook,
            transform: `translateY(${(1 - hook) * 18}px)`,
          }}
        >
          {'全塞进开场白呢？'}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'百级 vs 千级 · 用到才付'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P2ThreeRoundWalkthrough: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p2-01', 'p2-03');
  const bB = w('p2-04', 'p2-05');
  const bC = w('p2-06');
  const bD = w('p2-07', 'p2-09');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A">
        <TwoA
          atRows={wa('p2-01', 0.36) - bA.from}
          atChars={wa('p2-01', 0.78) - bA.from}
          atSys={wa('p2-02', 0.34) - bA.from}
          atTask={wa('p2-03', 0.46) - bA.from}
          atHit={wa('p2-03', 0.78) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <TwoB
          atEnter={wa('p2-04', 0.22) - bB.from}
          atJump1={wa('p2-04', 0.42) - bB.from}
          atJump2={wa('p2-04', 0.66) - bB.from}
          atHist={wa('p2-05', 0.24) - bB.from}
          atMark={wa('p2-05', 0.6) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <TwoC atCount={wa('p2-06', 0.24) - bC.from} atHold={wa('p2-06', 0.72) - bC.from} />
      </Sequence>
      <Sequence {...bD} name="2-D">
        <TwoD
          atCaliber={wa('p2-07', 0.28) - bD.from}
          atUnit={wa('p2-07', 0.56) - bD.from}
          atSmall={wa('p2-07', 0.8) - bD.from}
          atBig={wa('p2-08', 0.18) - bD.from}
          atGap={wa('p2-08', 0.6) - bD.from}
          atHook={wa('p2-09', 0.5) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2ThreeRoundWalkthrough;
