/** P3 谁的结果归谁（p3-01..p3-10，3 镜）——分镜 3-A / 3-B / 3-C（全片张力峰值）。
 *
 *  叙事链：消息层全景一拍（模型侧 ↔ 执行侧 + 回喂通路；对照表压暗退场——配对
 *  不在表上、在消息层）→ @pushIn 压向编号签：三签逐枚显字（单号 1/2/3）→ 执行
 *  侧结果包裹贴同号回执、沿回喂流飞回、同号绿线接通 → 快递小图插曲 ≤2s（多
 *  订单多包裹各贴单号、到达序乱、逐一按号对回）→ 两枚边界小签对照闪现（快递
 *  单号跨天·可查 ↔ 编号一轮·一份）→ 顺序执行队列（块1→回执1→块2…打字机节奏；
 *  背景乱序残影一闪、编号签虚化半透、残影交叉出珊瑚红叉影）→ 左红右绿消融
 *  同屏：双轨十格轮次带 + 七件活清单同步推进（外观看不出异样）→ 左轨某轮两
 *  结果签被珊瑚红旋转箭头互换、模型侧收到错签、错绑计数 0→2 → 双计数定格 +
 *  教训短签 → 右轨天然对位/编号签悬空未用 vs 左轨整轨泛红一沉。
 *
 *  色彩纪律：左红=warn（反例）/ 右绿=ok（机制在位）全幕恒定不互换（X-001）；
 *  调用块恒 tool 青（P1 建锚语义）；绿线为 3-A 唯一确认绿元素；对照表全程压暗。
 *
 *  红线落实：词落位 = 句首 + 句长比例；前景队列严格按序（教学版语义）、背景
 *  残影恒半透明暗层；快递插曲 ≤2s 即收（不常驻剧场化）；y≥56 / bottom≥150。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {FPS, beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, NumberTag, Panel, SceneTag, TableRegistry} from '../components/motifs';
import {DUR, clamp01, progress, useCount, useEnter, useFlowDash, useImpulse, useProgress, usePushIn} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

type Pt = {x: number; y: number};

const qBez = (p0: Pt, c: Pt, p2: Pt, u: number): Pt => {
  const iu = 1 - u;
  return {
    x: iu * iu * p0.x + 2 * iu * u * c.x + u * u * p2.x,
    y: iu * iu * p0.y + 2 * iu * u * c.y + u * u * p2.y,
  };
};

/** 决策脑图标（只归模型侧——执行侧绝无此件，Visual Lock） */
const BrainGlyph: React.FC<{color: string; s?: number}> = ({color, s = 1}) => (
  <svg width={64 * s} height={52 * s} viewBox="-32 -26 64 52" style={{overflow: 'visible'}}>
    <g stroke={color} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-20 6 Q-27 -4 -18 -11 Q-17 -21 -5 -22 Q6 -23 10 -16 Q21 -14 21 -4 Q21 6 12 9 Q-4 15 -20 6 Z" />
      <path d="M0 -22 Q-3 -8 0 10" />
      <path d="M-12 -6 Q-7 -3 -10 4" />
      <path d="M11 -5 Q7 -1 9 5" />
    </g>
  </svg>
);

/** 结果包裹（青碧小方块 + 同号回执签） */
const ResultParcel: React.FC<{n: number; x: number; y: number; s?: number; warn?: boolean}> = ({n, x, y, s = 1, warn = false}) => (
  <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${s})`}}>
    <div
      style={{
        width: 56,
        height: 44,
        borderRadius: 8,
        border: `2.5px solid ${warn ? theme.warn : theme.tool}`,
        background: theme.panel,
        position: 'relative',
      }}
    >
      <div style={{position: 'absolute', right: -16, top: -16}}>
        <NumberTag n={n} size={34} color={warn ? theme.warn : theme.tool} />
      </div>
    </div>
  </div>
);

// ── 3-A 消息层全景 → 编号签显字 → 同号回执 → 快递插曲 → 边界小签 ────────

const ShotA: React.FC<{
  atTags: number;
  atParcel: number;
  atBack: number;
  atExpress: number;
  atBounds: number;
}> = ({atTags, atParcel, atBack, atExpress, atBounds}) => {
  const frame = useCurrentFrame();
  // 消息层全景：模型侧 ↔ 执行侧 + 回喂通路（分工铭牌小字）
  const vistaO = useProgress(0, DUR.f4);
  // @pushIn：p3-01 揭秘起点——自全景压向编号签（中央三块）
  const push = usePushIn(DUR.f3, {scale: 0.07, dur: DUR.f6});
  // 对照表压暗退场（配对不在表上、在消息层——压暗即语义：2-B 联动位 → 淡出）
  const tableGone = useProgress(DUR.f2, DUR.f4);
  // 三签逐枚显字（单号 1/2/3；角标 tool_use_id）
  const tagLit = [1, 2, 3].map((n) => clamp01(progress(frame, atTags + (n - 1) * 5, DUR.f3)));
  // 执行侧结果包裹贴同号回执 → 沿回喂流飞回 → 同号绿线接通
  const parcelIn = useProgress(atParcel, DUR.f4);
  const backU = [0, 1, 2].map((i) => clamp01(progress(frame, atBack + i * 6, DUR.f5)));
  const greenO = useProgress(atBack + DUR.f5 + 4, DUR.f4);
  // 快递插曲（≤2s 即收）：dim 全场（只在插曲在场窗内 0.3，随插曲退场回亮）
  // ⑨ QA RISKY-1：exOutEnd 锚 atExpress（原写死幕首 2s，exOut 在 p3-01/02 就把
  // 全景乘成 0 → 整镜空台）；退场只作用插曲层自身，全景容器不再乘 (1-exOut)
  const exIn = useProgress(atExpress, DUR.f3);
  const exOutEnd = Math.min(atExpress + 2 * FPS - 6, atBounds - 4);
  const exOut = useProgress(exOutEnd, DUR.f3);
  const exDim = 1 - 0.7 * Math.min(exIn, 1 - exOut);
  // 边界小签（对照闪现即收）
  const b1 = useImpulse({at: atBounds, dur: DUR.f6, peak: 1});
  const bO = useProgress(atBounds, DUR.f3) * (1 - useProgress(atBounds + DUR.f5 + DUR.f4, DUR.f3));
  return (
    <AbsoluteFill>
      <SceneTag chapter="Pairing" tagline="谁的结果归谁" accent={theme.mech} />
      {/* 对照表自 2-B 联动位压暗退场（压暗即语义——配对不在表上、在消息层） */}
      <div style={{position: 'absolute', inset: 0, opacity: 1 - tableGone}}>
        <TableRegistry x={1560} y={100} scale={0.42} rows={5} dim={0.12} />
      </div>
      <AbsoluteFill style={{transform: push}}>
        {/* ⑨ QA RISKY-1②：全景不再随插曲退场清零（exOut 只作用于插曲层自身） */}
        <div style={{position: 'absolute', inset: 0, opacity: vistaO * exDim}}>
          {/* 模型侧铭牌（决策脑恒在模型侧） */}
          <div style={{position: 'absolute', left: 260, top: 330, display: 'flex', alignItems: 'center', gap: 18}}>
            <BrainGlyph color={theme.text} />
            <div>
              <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>{'模型侧'}</div>
              <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'decides'}</div>
            </div>
          </div>
          {/* 执行侧铭牌（无脑——纯执行件） */}
          <div style={{position: 'absolute', left: 1470, top: 330, display: 'flex', alignItems: 'center', gap: 18}}>
            <svg width={60} height={54} viewBox="0 0 60 54">
              <rect x={8} y={14} width={44} height={34} rx={8} fill="none" stroke={theme.tool} strokeWidth={4} />
              <circle cx={22} cy={31} r={5} fill={theme.tool} />
              <circle cx={38} cy={31} r={5} fill={theme.tool} />
            </svg>
            <div>
              <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>{'执行侧'}</div>
              <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'executes'}</div>
            </div>
          </div>
          {/* 回喂通路（青碧弧——执行侧 → 模型侧） */}
          <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
            <path
              d="M 1490 430 C 1250 640, 670 640, 430 430"
              fill="none"
              stroke={withAlpha(theme.tool, 0.6)}
              strokeWidth={4}
              strokeDasharray="12 10"
            />
            <path d="M446 442 L430 430 L452 424 Z" fill={theme.tool} opacity={0.85} />
          </svg>
          {/* 中央三调用块（2-D 同款缩小态；签面显字 1/2/3） */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 620 + i * 260,
                top: 420,
                width: 220,
                height: 120,
                boxSizing: 'border-box',
                borderRadius: 12,
                border: `2.5px solid ${theme.tool}`,
                background: `${theme.tool}18`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.text}}>
                {i < 2 ? '读' : '找'}
              </span>
              <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{i < 2 ? 'read_file' : 'glob'}</span>
              <div style={{transform: `scale(${0.7 + 0.3 * tagLit[i]})`}}>
                <NumberTag n={tagLit[i] > 0.5 ? i + 1 : undefined} size={46} />
              </div>
            </div>
          ))}
          {/* 执行侧三结果包裹（贴同号回执） */}
          {[0, 1, 2].map((i) => (
            <div key={`p-${i}`} style={{position: 'absolute', left: 0, top: 0, opacity: parcelIn}}>
              <ResultParcel n={i + 1} x={1470 + i * 78} y={560} />
            </div>
          ))}
          {/* 回执沿回喂流飞回（三枚 stagger；同号绿线接通=唯一确认绿元素） */}
          {backU.map((u, i) => {
            if (u <= 0 || u >= 1) {
              return null;
            }
            const p0 = {x: 1470 + i * 78, y: 560};
            const p2 = {x: 620 + i * 260 + 110, y: 480};
            const pos = qBez(p0, {x: 960, y: 760}, p2, u);
            return <ResultParcel key={`b-${i}`} n={i + 1} x={pos.x} y={pos.y} s={0.8} />;
          })}
          {/* 同号绿线（回执对回原调用后接通） */}
          <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none', opacity: greenO}}>
            {[0, 1, 2].map((i) => (
              <line
                key={i}
                x1={620 + i * 260 + 110}
                y1={548}
                x2={620 + i * 260 + 110}
                y2={614}
                stroke={theme.ok}
                strokeWidth={3.5}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - greenO}
              />
            ))}
          </svg>
        </div>

        {/* 快递插曲（类比 A#5，≤2s 即收）：多订单多包裹各贴单号、到达序乱、按号对回 */}
        <div style={{position: 'absolute', inset: 0, opacity: 1 - exOut}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: 300, display: 'flex', justifyContent: 'center', gap: 60}}>
            {/* 订单列（到达序乱：3 1 2） */}
            <div>
              <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginBottom: 14}}>{'到达序 · 乱'}</div>
              {[3, 1, 2].map((n, i) => (
                <div key={n} style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, opacity: clamp01(progress(frame, atExpress + 4 + i * 4, DUR.f3))}}>
                  <ResultParcel n={n} x={0} y={0} s={0.9} />
                  <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'包裹'}</span>
                </div>
              ))}
            </div>
            {/* 按号对回（连线 draw 到同号订单） */}
            <svg width={420} height={300} style={{overflow: 'visible'}}>
              {[3, 1, 2].map((n, i) => {
                const p = clamp01(progress(frame, atExpress + 18 + i * 5, DUR.f4));
                const y0 = 40 + i * 66;
                const y1 = 40 + (n - 1) * 66;
                return (
                  <path
                    key={n}
                    d={`M 6 ${y0} C 140 ${y0}, 280 ${y1}, 414 ${y1}`}
                    fill="none"
                    stroke={theme.ok}
                    strokeWidth={3}
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={1 - p}
                  />
                );
              })}
            </svg>
            {/* 订单列（1 2 3） */}
            <div>
              <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginBottom: 14}}>{'订单 · 按号对回'}</div>
              {[1, 2, 3].map((n, i) => (
                <div key={n} style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, opacity: clamp01(progress(frame, atExpress + 4 + i * 4, DUR.f3))}}>
                  <NumberTag n={n} size={40} color={theme.ok} />
                  <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'订单'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 边界小签（快递单号：跨天·可查 ↔ 编号：一轮·一份；闪现即收） */}
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 250, display: 'flex', justifyContent: 'center', gap: 46, opacity: bO, transform: `scale(${1 + 0.05 * b1})`}}>
          <Panel style={{padding: '12px 24px', display: 'flex', alignItems: 'baseline', gap: 12}}>
            <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{'快递单号'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'跨天 · 可查'}</span>
          </Panel>
          <Panel accent={theme.mech} style={{padding: '12px 24px', display: 'flex', alignItems: 'baseline', gap: 12}}>
            <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.mech}}>{'编号'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'一轮 · 一份'}</span>
          </Panel>
        </div>
        <Footnote delay={atTags}>{'tool_use_id · tool_result'}</Footnote>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── 3-B 顺序执行队列 + 乱序残影 ────────────────────────────────────────

const ShotB: React.FC<{atQueue: number; atGhost: number; atGhostTag: number; atCross: number}> = ({
  atQueue,
  atGhost,
  atGhostTag,
  atCross,
}) => {
  const frame = useCurrentFrame();
  // 队列步进（打字机节奏：块1→回执1→块2→回执2→块3→回执3，每步 11 帧）
  const STEP = 11;
  const seqT = (t: number) => clamp01(progress(frame, atQueue + t * STEP, STEP));
  const blockAt = (i: number) => ({go: seqT(i * 2), back: seqT(i * 2 + 1)});
  // 背景乱序残影（多条轨迹交错乱窜的半透明残影——恒暗层，「乱序到达」一闪）
  const ghostO = 0.5 * useProgress(atGhost, DUR.f3) * (1 - useProgress(atGhost + 34, DUR.f4));
  // 残影行进（flow 虚线行进——「乱窜」的运动面）
  const ghostFlow = useFlowDash({dash: 14, gap: 18, period: 16});
  // 前景一枚编号签虚化半透（「拔掉编号」——预告消融）
  const ghostTag = useProgress(atGhostTag, DUR.f4);
  // 两条残影轨迹交叉出珊瑚红叉影一拍（「当场错绑」）
  const cross = useImpulse({at: atCross, dur: DUR.f5, peak: 1});
  // 残影轨迹（确定性贝塞尔组——帧相位推进，无随机）
  const GHOSTS = [
    {d: 'M 700 260 C 980 380, 820 700, 1180 830', ph: 0.0},
    {d: 'M 1180 270 C 900 420, 1060 660, 700 840', ph: 0.18},
    {d: 'M 760 300 C 1120 340, 780 760, 1150 800', ph: 0.42},
  ];
  return (
    <AbsoluteFill>
      {/* 背景暗层：乱序残影轨迹（半透明、行进虚线乱窜、不抢焦） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: ghostO}}>
        {GHOSTS.map((g, i) => (
          <path
            key={i}
            d={g.d}
            fill="none"
            stroke={i === 0 ? theme.warn : theme.dim}
            strokeWidth={3}
            opacity={i === 0 ? 0.8 : 0.55}
            {...ghostFlow}
          />
        ))}
      </svg>
      {/* 交叉红叉影（「当场错绑」一拍） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: cross, pointerEvents: 'none'}}>
        <g stroke={theme.warn} strokeWidth={8} strokeLinecap="round">
          <line x1={910} y1={510} x2={1010} y2={610} />
          <line x1={1010} y1={510} x2={910} y2={610} />
        </g>
      </svg>
      {/* 纵队三调用块（y 330/470/610）→ 执行位（x 1180）→ 回执回左列 */}
      {[0, 1, 2].map((i) => {
        const {go, back} = blockAt(i);
        const y0 = 330 + i * 140;
        const x = 640 + 540 * go;
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: x - 110, top: y0 - 44}}>
              <div
                style={{
                  width: 220,
                  height: 88,
                  boxSizing: 'border-box',
                  borderRadius: 12,
                  border: `2.5px solid ${go > 0.05 ? theme.tool : theme.panelBorder}`,
                  background: go > 0.05 ? `${theme.tool}18` : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '0 18px',
                  opacity: 0.55 + 0.45 * go,
                }}
              >
                <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{i < 2 ? '读' : '找'}</span>
                <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{i < 2 ? 'read_file' : 'glob'}</span>
                {/* 编号签（前景队列的配对面；「拔掉编号」虚化半透） */}
                <div style={{marginLeft: 'auto', opacity: 1 - 0.62 * ghostTag * (i === 1 ? 1 : 0)}}>
                  <NumberTag n={i + 1} size={38} ghost={i === 1 ? ghostTag : 0} />
                </div>
              </div>
            </div>
            {/* 回执条飞回左列 */}
            {back > 0.02 && back < 1 ? (
              <div
                style={{
                  position: 'absolute',
                  left: 1180 - (1180 - 400) * back,
                  top: y0 + 30,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <NumberTag n={i + 1} size={30} color={theme.tool} />
                <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.tool}}>{'tool_result'}</span>
              </div>
            ) : null}
          </React.Fragment>
        );
      })}
      {/* 执行位（队列的目的地） */}
      <div style={{position: 'absolute', left: 1130, top: 250}}>
        <Panel accent={theme.tool} style={{padding: '8px 20px', textAlign: 'center'}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{'执行位'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'in order'}</div>
        </Panel>
      </div>
      <Footnote delay={atQueue}>{'顺序执行 · 教学版'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 3-C 左红右绿消融同屏（张力峰值） ────────────────────────────────────

/** 十格轮次带（同步点亮；missed 不存在——轮次不退） */
const RoundBand: React.FC<{x: number; y: number; fill: number; accent: string}> = ({x, y, fill, accent}) => (
  <div style={{position: 'absolute', left: x, top: y, display: 'flex', gap: 7}}>
    {Array.from({length: 10}, (_, i) => {
      const on = clamp01(fill * 10 - i);
      return (
        <div
          key={i}
          style={{
            width: 52,
            height: 52,
            borderRadius: 8,
            border: `2px solid ${on > 0.5 ? accent : theme.panelBorder}`,
            background: on > 0.5 ? `${accent}26` : 'transparent',
            opacity: 0.55 + 0.45 * on,
          }}
        />
      );
    })}
  </div>
);

/** 七件活清单（逐件落地；两轨同为 7——外观同步） */
const WorkList: React.FC<{x: number; y: number; fill: number; accent: string}> = ({x, y, fill, accent}) => (
  <div style={{position: 'absolute', left: x, top: y}}>
    {Array.from({length: 7}, (_, i) => {
      const on = clamp01(fill * 7 - i);
      return (
        <div key={i} style={{display: 'flex', alignItems: 'center', gap: 12, height: 44, opacity: 0.4 + 0.6 * on}}>
          <div style={{width: 20, height: 20, borderRadius: 5, background: on > 0.5 ? accent : theme.panelBorder, opacity: 0.85}} />
          <div style={{width: 300, height: 18, borderRadius: 4, background: theme.panelBorder, opacity: on > 0.5 ? 0.55 : 0.3}} />
        </div>
      );
    })}
  </div>
);

const ShotC: React.FC<{atRun: number; atSwap: number; atWrong: number; atVerdict: number; atFree: number; atCrash: number}> = ({
  atRun,
  atSwap,
  atWrong,
  atVerdict,
  atFree,
  atCrash,
}) => {
  const frame = useCurrentFrame();
  // 两轨同步推进（十格 + 七件——「外面看不出异样」的视觉化）
  const fill = useProgress(atRun, Math.max(DUR.f6, 66), 'linear');
  // 左轨互换插帧（某轮放大：两枚结果签被旋转箭头对调归属后弹回）
  const swapIn = useProgress(atSwap, DUR.f3);
  const swapU = useProgress(atSwap + DUR.f3, DUR.f5, 'decelerate');
  const swapBack = useProgress(atSwap + DUR.f5 + DUR.f3, DUR.f4, 'accelerate');
  const rot = 180 * swapU;
  // 对调终态弹一下（互换后停在对方位置——归属已换；弹跳只作用概念层）
  const swapSettle = useImpulse({at: atSwap + DUR.f5 + DUR.f4, dur: DUR.f4, peak: 0.07});
  // 模型侧脑图标收到错签（边角闪珊瑚红）
  const wrongIn = useProgress(atWrong, DUR.f3);
  const wrongFlash = useImpulse({at: atWrong + DUR.f2, dur: DUR.f5, peak: 1});
  // ⑨ QA W4：错绑计数改与双计数条同拍起跑（原在 p3-08 内爬完、条亮出时已是
  // 终值 2 vs 0——两侧从未同值起步）；现两侧同值 0 起跑，左轨当场爬升至 2
  const misCount = useCount({to: 2, at: atVerdict, dur: DUR.f5});
  // p3-09：双计数定格对照 + 教训短签
  const verdictO = useProgress(atVerdict, DUR.f4);
  // p3-10：右轨天然对位 + 编号签悬空未用；左轨整轨泛红一沉
  const freeO = useProgress(atFree, DUR.f4);
  const idleTag = useProgress(atFree + DUR.f3, DUR.f3);
  const crash = useProgress(atCrash, DUR.f5, 'accelerate');
  return (
    <AbsoluteFill>
      {/* ── 左轨：拔掉编号（warn）── */}
      <div style={{position: 'absolute', left: 110, top: 150, width: 800, transform: `translateY(${6 * crash}px)`}}>
        <Panel accent={theme.warn} style={{display: 'inline-flex', alignItems: 'center', gap: 12, padding: '10px 20px'}}>
          <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.warn}}>{'拔掉编号'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'no pairing'}</span>
        </Panel>
        <RoundBand x={30} y={70} fill={fill} accent={theme.warn} />
        <WorkList x={34} y={160} fill={fill} accent={theme.warn} />
        {/* 左轨泛红一沉（「一乱，就翻车」——红 overlay，非换色） */}
        <div style={{position: 'absolute', inset: -18, background: withAlpha(theme.warn, 0.16 * crash), borderRadius: 20, pointerEvents: 'none'}} />
        {/* 互换插帧（镜中镜：某轮两枚结果签对调） */}
        <div style={{position: 'absolute', left: 60, top: 520, opacity: swapIn * (1 - 0.25 * swapBack)}}>
          <Panel style={{width: 640, height: 210, boxSizing: 'border-box', position: 'relative'}}>
            <div style={{position: 'absolute', left: 20, top: 14, fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>
              {'第 6 轮 · 放大'}
            </div>
            {[0, 1].map((k) => {
              /* 对调行程：两签沿弧相向换位，终态停在对方位置（归属已换——弹回是微弹非回位） */
              const dir = k === 0 ? 1 : -1;
              const x = 110 + k * 300 + dir * 300 * swapU;
              const y = 70 + dir * 46 * Math.sin(Math.PI * swapU);
              return (
                <div key={k} style={{position: 'absolute', left: x - 60, top: y, transform: `scale(${1 + swapSettle})`}}>
                  <div
                    style={{
                      width: 120,
                      height: 84,
                      borderRadius: 10,
                      border: `2.5px solid ${theme.tool}`,
                      background: theme.panel,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <NumberTag n={k === 0 ? 2 : 1} size={40} color={theme.tool} />
                  </div>
                  <div style={{textAlign: 'center', fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 8}}>
                    {k === 0 ? '结果 B' : '结果 A'}
                  </div>
                </div>
              );
            })}
            {/* 珊瑚红旋转箭头（对调归属） */}
            <svg width={120} height={80} viewBox="0 0 120 80" style={{position: 'absolute', left: 260, top: 66, opacity: swapIn}}>
              <g transform={`rotate(${rot} 60 40)`}>
                <path d="M20 24 A 44 44 0 0 1 100 24" fill="none" stroke={theme.warn} strokeWidth={5} strokeLinecap="round" />
                <path d="M92 12 L104 26 L88 32 Z" fill={theme.warn} />
              </g>
            </svg>
          </Panel>
        </div>
        {/* 模型侧脑图标收到错签（「别人的答案」） */}
        {/* ⑨ QA W2：说明行上移 20px（760→742）+ 行高收紧（签 44→38 / 脑 0.9→0.75），
            底部让开字幕盒（盒顶 ≈943）并与互换插帧（底 ≈880）保持净空 */}
        <div style={{position: 'absolute', left: 60, top: 742, opacity: wrongIn, display: 'flex', alignItems: 'center', gap: 20}}>
          <BrainGlyph color={theme.text} s={0.75} />
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>{'模型收到'}</span>
            <div style={{position: 'relative', boxShadow: `0 0 ${22 * wrongFlash}px ${theme.warn}`}}>
              <NumberTag n={2} size={38} color={theme.warn} />
              <div
                style={{
                  position: 'absolute',
                  right: -7,
                  top: -7,
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  background: theme.warn,
                  opacity: wrongFlash,
                }}
              />
            </div>
            <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.warn}}>{'别人的答案'}</span>
          </div>
        </div>
      </div>

      {/* ── 右轨：配对在位（ok；右侧不出现任何退化）── */}
      <div style={{position: 'absolute', left: 1010, top: 150, width: 800}}>
        <Panel accent={theme.ok} style={{display: 'inline-flex', alignItems: 'center', gap: 12, padding: '10px 20px'}}>
          <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.ok}}>{'配对在位'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'tool_use_id'}</span>
        </Panel>
        <RoundBand x={30} y={70} fill={fill} accent={theme.ok} />
        <WorkList x={34} y={160} fill={fill} accent={theme.ok} />
        {/* 回执天然对位（顺序态：回执逐个对齐调用——「白拿工资」） */}
        <div style={{position: 'absolute', left: 60, top: 520, opacity: freeO}}>
          <Panel accent={theme.ok} style={{width: 640, height: 210, boxSizing: 'border-box', position: 'relative'}}>
            <div style={{position: 'absolute', left: 20, top: 14, fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>
              {'顺序态 · 天然对位'}
            </div>
            {[0, 1, 2].map((i) => {
              const p = clamp01(progress(frame, atFree + 4 + i * 5, DUR.f4));
              return (
                <div key={i} style={{position: 'absolute', left: 40 + i * 190, top: 80, opacity: p}}>
                  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
                    <NumberTag n={i + 1} size={38} color={theme.ok} />
                    <svg width={2} height={26}>
                      <line x1={1} y1={0} x2={1} y2={26} stroke={theme.ok} strokeWidth={2.5} />
                    </svg>
                    <div style={{width: 84, height: 34, borderRadius: 8, border: `2px solid ${theme.ok}`, background: `${theme.ok}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>
                      {'结果'}
                    </div>
                  </div>
                </div>
              );
            })}
            {/* 编号签悬空未用（半透明静置——顺序好时配对闲着） */}
            <div style={{position: 'absolute', right: 22, top: 22, opacity: 0.35 * idleTag}}>
              <NumberTag n={1} size={34} color={theme.ok} ghost={0.55} />
            </div>
          </Panel>
        </div>
      </div>

      {/* 双计数条（基线锚定，p3-09 重音定格） */}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 178, display: 'flex', justifyContent: 'center', gap: 120, opacity: verdictO}}>
        {[
          {label: '错绑 · 拔掉编号', color: theme.warn, v: Math.round(misCount), base: 2},
          {label: '错绑 · 配对在位', color: theme.ok, v: 0, base: 0},
        ].map((c) => (
          <div key={c.label} style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{c.label}</span>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 56,
                fontWeight: 700,
                color: c.color,
                fontVariantNumeric: 'tabular-nums',
                textShadow: `0 0 ${16 * verdictO}px ${c.color}`,
              }}
            >
              {`${c.v}`}
            </span>
          </div>
        ))}
      </div>

      {/* 教训短签（定格仪式——承 storyboard「教训短签」） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 445, display: 'flex', justifyContent: 'center', opacity: verdictO * 0.96, pointerEvents: 'none'}}>
        <Panel accent={theme.warn} style={{padding: '26px 46px', background: theme.bg}}>
          <span style={{fontFamily: theme.serif, fontSize: 50, fontWeight: 700, color: theme.warn}}>{'无配对 · 乱序即错位'}</span>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P3NumberedPairing: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p3-01', 'p3-04');
  const bB = w('p3-05', 'p3-06');
  const bC = w('p3-07', 'p3-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <ShotA
          atTags={wa('p3-01', 0.65) - bA.from}
          atParcel={wa('p3-02', 0.22) - bA.from}
          atBack={wa('p3-02', 0.68) - bA.from}
          atExpress={at('p3-03') - bA.from}
          atBounds={wa('p3-04', 0.5) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="3-B">
        <ShotB
          atQueue={wa('p3-05', 0.12) - bB.from}
          atGhost={wa('p3-06', 0.25) - bB.from}
          atGhostTag={wa('p3-06', 0.45) - bB.from}
          atCross={wa('p3-06', 0.82) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="3-C">
        <ShotC
          atRun={wa('p3-07', 0.1) - bC.from}
          atSwap={wa('p3-08', 0.35) - bC.from}
          atWrong={wa('p3-08', 0.78) - bC.from}
          atVerdict={wa('p3-09', 0.75) - bC.from}
          atFree={wa('p3-10', 0.2) - bC.from}
          atCrash={wa('p3-10', 0.75) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3NumberedPairing;
