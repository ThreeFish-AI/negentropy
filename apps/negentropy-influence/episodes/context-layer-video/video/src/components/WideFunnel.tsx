/** 宽进严出三段流水线（P5·5-B 检索装置，v3 新增）。
 *
 *  三拍对三句：宽进抱回一摞候选（carryAt，150 角标）→ 台面重排（rerankAt，
 *  散堆收拢成有序两列）→ 闸口截断只放行少数（gateAt，前 20 角标）。
 *  漏掉的卡淡出不删（透明度压到 0.22，禁 display:none——「截断=信噪比控制」）。
 *  底部信噪比标尺：左密右疏，示意输入多、进窗少。
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {theme} from '../design/theme';
import {useProgress, useSpring, useStagger} from '../motion';

/** 确定性散布（禁随机数）：三段位置由桩点算出，可抽帧对账。 */
const hash = (i: number, salt = 1): number => Math.abs(Math.sin(i * 127.1 + salt * 311.7)) % 1;

const N_CARDS = 12;
const PASS_N = 4;
const W = 1040;
const H = 430;
const ZONE = {
  carry: {x0: 36, x1: 330},
  rerank: {x0: 392, x1: 700},
  gate: {x0: 762, x1: 1004},
};

type Pos = {x: number; y: number};

/** 第 i 张卡的三段位置：散堆 → 有序列 → 过闸/滞留。 */
const cardPos = (i: number): {p0: Pos; p1: Pos; p2: Pos; pass: boolean} => {
  // 宽进段：台面上的散堆（桩点抖散）
  const p0: Pos = {
    x: ZONE.carry.x0 + 30 + hash(i) * (ZONE.carry.x1 - ZONE.carry.x0 - 100),
    y: 96 + hash(i, 2) * 150,
  };
  // 重排段：两列有序（rank 升序左上→右下）
  const p1: Pos = {
    x: ZONE.rerank.x0 + 24 + (i % 6) * 48,
    y: i < 6 ? 96 : 176,
  };
  const pass = i < PASS_N;
  // 截断段：过闸的滑入闸后区；滞留的原地下沉半格
  const p2: Pos = pass
    ? {x: ZONE.gate.x0 + 40 + i * 52, y: 128}
    : {x: p1.x, y: p1.y + 26};
  return {p0, p1, p2, pass};
};

const FunnelCard: React.FC<{
  i: number;
  appear: number;
  sortP: number;
  passP: number;
  faded: number;
}> = ({i, appear, sortP, passP, faded}) => {
  const {p0, p1, p2, pass} = cardPos(i);
  const xA = p0.x + (p1.x - p0.x) * sortP;
  const yA = p0.y + (p1.y - p0.y) * sortP;
  const x = xA + (p2.x - xA) * passP;
  const y = yA + (p2.y - yA) * passP;
  const through = pass && passP > 0.6;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 44,
        height: 60,
        borderRadius: 5,
        background: theme.panel,
        border: `1.5px solid ${through ? theme.ok : theme.panelBorder}`,
        opacity: appear * (pass ? 1 : faded),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 15,
        color: through ? theme.ok : theme.dim,
        fontFamily: theme.mono,
      }}
    >
      {`c${String(i + 1).padStart(2, '0')}`}
    </div>
  );
};

export const WideFunnel: React.FC<{
  /** 流水线框架入场帧 */
  at: number;
  /** 第一段·宽进抱回（150 候选）帧 */
  carryAt: number;
  /** 第二段·重排帧 */
  rerankAt: number;
  /** 第三段·截断闸口（前 20）帧 */
  gateAt: number;
}> = ({at, carryAt, rerankAt, gateAt}) => {
  const frameEnter = useSpring('settle', {at, dur: 20});
  const appear = useStagger(N_CARDS, {stride: 3, at: carryAt, dur: 4});
  const sortP = useSpring('settle', {at: rerankAt, dur: 30});
  const gateDrop = useSpring('settle', {at: gateAt, dur: 16});
  const passP = useSpring('settle', {at: gateAt + 14, dur: 26});
  // 淡出不删：未过闸的卡自闸口开启起压暗到 0.22
  const faded = 1 - useProgress(gateAt + 14, 26) * 0.78;
  const zone = (z: {x0: number; x1: number}, label: string, tag?: string, tagColor?: string) => (
    <div style={{position: 'absolute', left: z.x0, top: 66, width: z.x1 - z.x0, height: 250}}>
      <div style={{textAlign: 'center', fontSize: 21, color: theme.text}}>{label}</div>
      {tag ? (
        <div
          style={{
            marginTop: 8,
            margin: '8px auto 0',
            width: 'fit-content',
            padding: '3px 12px',
            borderRadius: 999,
            border: `1.5px solid ${tagColor ?? theme.panelBorder}`,
            color: tagColor ?? theme.dim,
            fontSize: 17,
            fontFamily: theme.mono,
          }}
        >
          {tag}
        </div>
      ) : null}
    </div>
  );
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          position: 'relative',
          width: W,
          height: H,
          transform: `scale(${0.96 + frameEnter * 0.04})`,
          opacity: frameEnter,
        }}
      >
        {zone(ZONE.carry, '① 宽进 · 抱回来', '150 条候选', theme.concept)}
        {zone(ZONE.rerank, '② 重排 · 细看一遍')}
        {zone(ZONE.gate, '③ 截断 · 只保留少数', '前 20', theme.ok)}
        {/* 三段地面 */}
        <div style={{position: 'absolute', left: 24, right: 24, top: 316, height: 2, background: theme.panelBorder}} />
        {/* 闸口横杆：落下后开启放行 */}
        <div
          style={{
            position: 'absolute',
            left: ZONE.gate.x0 - 10,
            top: 84,
            width: 6,
            height: 236,
            borderRadius: 3,
            background: theme.concept,
            transformOrigin: 'top center',
            transform: `scaleY(${1 - gateDrop})`,
            opacity: 0.9,
          }}
        />
        <div style={{position: 'absolute', left: ZONE.gate.x0 - 10, top: 320, width: 6, height: 6, borderRadius: 3, background: theme.concept}} />
        {appear.map((k, i) => (
          <FunnelCard key={i} i={i} appear={k} sortP={sortP} passP={passP} faded={faded} />
        ))}
        {/* 信噪比标尺：左密右疏 */}
        <div style={{position: 'absolute', left: 60, right: 60, bottom: 22, height: 34}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: 16, height: 2, background: theme.panelBorder}} />
          {Array.from({length: 30}, (_, i) => {
            const t = i / 29;
            const show = t < 0.25 || i % 6 === 0;
            return show ? (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${t * 100}%`,
                  top: 8,
                  width: 2,
                  height: 8,
                  background: t < 0.3 ? theme.conceptDeep : theme.ok,
                }}
              />
            ) : null;
          })}
          <span style={{position: 'absolute', left: 0, top: -8, fontSize: 16, color: theme.dim}}>噪 · 输入多</span>
          <span style={{position: 'absolute', right: 0, top: -8, fontSize: 16, color: theme.ok}}>信 · 进窗少</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
