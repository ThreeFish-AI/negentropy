/** P1 机库全景：三面蓝图（p1-01..p1-39，39 句；storyboard「P1 机库全景：三面蓝图」节）。
 *
 *  10 镜 / 16 条 archify cue（镜内锚点一律 at(句id) − 所在镜.from，ArchifyRecap 契约）：
 *   1-A 设问一扇窗（装置：模型窗口 + 五色流光自五方涌入）
 *   1-B 机库剖面建立面〔M-004〕built=false + 五储位标签随句点亮（p1-03..06）、p1-07 收拢为投影标记
 *   1-C 投影表拍（装置：三面骨架 + 一把尺三问纠缠 + 权威/复利两把空椅子 + 旧标签降级滑入）
 *   1-D arc-facets@p1-12（单 cue 覆盖 p1-12..15 整镜 stretch——章长 13.29s，逐句 hold 会
 *       每句从头重播且 stageL1..L6 时间面 beats 永不可见，故整镜一镜一章）
 *   1-E arc-axes hold 链：p1-16 缺省 + p1-17..22、p1-24 hold（p1-23 留空窗给「换检索 ·
 *       不动权限」演示；承 1-D 尾镜界背靠背 → lead=false；recap 后置=画框遮盖剖面高亮）
 *   1-F lc2-open@p1-25（trim）→ arc-stages@p1-26..27 hold 链（六段点名两句；承 1-E 链尾
 *       背靠背 → lifecycle 实例 lead=false）+ 六格流程线装置（recap 后置遮盖）
 *   1-G lc2-l4@p1-28 → lc2-l5@p1-29 → lc2-loops@p1-30（三章三句 1:1；loops 压断环句、hold 冻结）
 *   1-H G 法则（装置：六段流程线四枚图钉钉入段间接缝 @p1-32）
 *   1-I 范本三卡 @p1-34 + context rot 曲线（InvertedU 自绘）@p1-36 + 目标函数金句卡 @p1-38
 *   1-J 转场（剖面推进聚焦库房，空货架待命）
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme, withAlpha} from '../design/theme';
import {clamp01, progress, useDraw, useEnter, useImpulse, useProgress, usePushIn, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {QuoteCard} from '../components/cards';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {HangarCrossSection} from '../components/HangarCrossSection';
import {InvertedU} from '../components/InvertedU';

export const P1Blueprint: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p1-01', 'p1-02');
  const bB = w('p1-03', 'p1-07');
  const bC = w('p1-08', 'p1-11');
  const bD = w('p1-12', 'p1-15');
  const bE = w('p1-16', 'p1-24');
  const bF = w('p1-25', 'p1-27');
  const bG = w('p1-28', 'p1-30');
  const bH = w('p1-31', 'p1-33');
  const bI = w('p1-34', 'p1-38');
  const bJ = w('p1-39');
  // 1-E 五轴逐句高亮 + 独立性三句（嵌套窗 from 相对 bE）
  const eAsset = w('p1-17');
  const eAuth = w('p1-18');
  const eAsm = w('p1-19');
  const eRet = w('p1-20');
  const eComp = w('p1-21');
  const eOrtho = w('p1-22', 'p1-24');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P1" tagline="机库全景 · 三面蓝图" accent={theme.concept} />

      {/* 1-A 设问一扇窗 */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="1-A">
        <ModelWindow at01={at('p1-01') - bA.from} at02={at('p1-02') - bA.from} />
      </Sequence>

      {/* 1-B 机库剖面建立面 + 五储位标签 */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="1-B">
        <HangarCrossSection built={false} at={0} />
        <FiveSlots
          a3={at('p1-03') - bB.from}
          a4={at('p1-04') - bB.from}
          a5={at('p1-05') - bB.from}
          a6={at('p1-06') - bB.from}
          a7={at('p1-07') - bB.from}
        />
      </Sequence>

      {/* 1-C 投影表拍 */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="1-C">
        <ProjectionTable
          a8={at('p1-08') - bC.from}
          a9={at('p1-09') - bC.from}
          a10={at('p1-10') - bC.from}
          a11={at('p1-11') - bC.from}
        />
      </Sequence>

      {/* 1-D 三面各答一问：arc-facets 整镜单 cue（12 beats 全数过完，末段 hold 冻结收台） */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="1-D">
        <ArchifyRecap
          slug="blueprint--architecture"
          caption="三面骨架"
          cues={[{chapterId: 'arc-facets', at: at('p1-12') - bD.from, durationInFrames: dur('p1-12') + dur('p1-13') + dur('p1-14') + dur('p1-15')}]}
        />
      </Sequence>

      {/* 1-E 五轴五工位：arc-axes hold 链（p1-23 空窗留给「换检索 · 不动权限」演示）；
          recap 后置 = 画框遮盖范式（hold 窗内剖面高亮让位） */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="1-E">
        <Sequence from={eAsset.from - bE.from} durationInFrames={eAsset.durationInFrames} name="1-E-资产">
          <HangarCrossSection built highlight="asset" at={0} />
        </Sequence>
        <Sequence from={eAuth.from - bE.from} durationInFrames={eAuth.durationInFrames} name="1-E-权威">
          <HangarCrossSection built highlight="authority" at={0} />
        </Sequence>
        <Sequence from={eAsm.from - bE.from} durationInFrames={eAsm.durationInFrames} name="1-E-装配">
          <HangarCrossSection built highlight="assembly" at={0} />
        </Sequence>
        <Sequence from={eRet.from - bE.from} durationInFrames={eRet.durationInFrames} name="1-E-检索">
          <HangarCrossSection built highlight="retrieval" at={0} />
        </Sequence>
        <Sequence from={eComp.from - bE.from} durationInFrames={eComp.durationInFrames} name="1-E-复利">
          <HangarCrossSection built highlight="compounding" at={0} />
        </Sequence>
        <Sequence from={eOrtho.from - bE.from} durationInFrames={eOrtho.durationInFrames} name="1-E-独立">
          <HangarCrossSection built at={0} />
          <SwapDemo at={at('p1-23') - eOrtho.from} />
        </Sequence>
        <ArchifyRecap
          slug="blueprint--architecture"
          caption="五轴与独立性"
          cues={[
            {chapterId: 'arc-axes', at: at('p1-16') - bE.from, durationInFrames: dur('p1-16')},
            {chapterId: 'arc-axes', at: at('p1-17') - bE.from, durationInFrames: dur('p1-17'), fit: 'hold'},
            {chapterId: 'arc-axes', at: at('p1-18') - bE.from, durationInFrames: dur('p1-18'), fit: 'hold'},
            {chapterId: 'arc-axes', at: at('p1-19') - bE.from, durationInFrames: dur('p1-19'), fit: 'hold'},
            {chapterId: 'arc-axes', at: at('p1-20') - bE.from, durationInFrames: dur('p1-20'), fit: 'hold'},
            {chapterId: 'arc-axes', at: at('p1-21') - bE.from, durationInFrames: dur('p1-21'), fit: 'hold'},
            {chapterId: 'arc-axes', at: at('p1-22') - bE.from, durationInFrames: dur('p1-22'), fit: 'hold'},
            {chapterId: 'arc-axes', at: at('p1-24') - bE.from, durationInFrames: dur('p1-24'), fit: 'hold'},
          ]}
          lead={false}
        />
      </Sequence>

      {/* 1-F 六道手续：lc2-open@p1-25 → arc-stages hold 链（p1-26..27 六段点名两句）；
          流程线装置 recap 后置遮盖；lifecycle 实例承 1-E 链尾背靠背 → lead=false */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="1-F">
        <StageWalk at={at('p1-26') - bF.from} walkDur={dur('p1-26') - 20} loopsAt={at('p1-27') - bF.from} />
        <ArchifyRecap
          slug="lifecycle"
          caption="时间面 · 六段两环"
          cues={[{chapterId: 'lc2-open', at: at('p1-25') - bF.from, durationInFrames: dur('p1-25')}]}
          lead={false}
        />
        <ArchifyRecap
          slug="blueprint--architecture"
          caption="时间面 · 六段"
          cues={[
            {chapterId: 'arc-stages', at: at('p1-26') - bF.from, durationInFrames: dur('p1-26')},
            {chapterId: 'arc-stages', at: at('p1-27') - bF.from, durationInFrames: dur('p1-27'), fit: 'hold'},
          ]}
        />
      </Sequence>

      {/* 1-G 两环：三章三句 1:1（l4=验证环句、l5=进化环句、loops=断环句 hold 冻结总览） */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="1-G">
        <ArchifyRecap
          slug="lifecycle"
          caption="验证环 · 进化环"
          cues={[
            {chapterId: 'lc2-l4', at: at('p1-28') - bG.from, durationInFrames: dur('p1-28')},
            {chapterId: 'lc2-l5', at: at('p1-29') - bG.from, durationInFrames: dur('p1-29')},
            {chapterId: 'lc2-loops', at: at('p1-30') - bG.from, durationInFrames: dur('p1-30')},
          ]}
        />
      </Sequence>

      {/* 1-H G 法则：四枚图钉钉入段间接缝 */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="1-H">
        <StagePins at={at('p1-32') - bH.from} />
      </Sequence>

      {/* 1-I 范本 + context rot 曲线 + 目标函数金句卡 */}
      <Sequence from={bI.from} durationInFrames={bI.durationInFrames} name="1-I">
        <CorsetShot a34={at('p1-34') - bI.from} a36={at('p1-36') - bI.from} a37={at('p1-37') - bI.from} a38={at('p1-38') - bI.from} />
      </Sequence>

      {/* 1-J 转场：剖面推进聚焦库房 */}
      <Sequence from={bJ.from} durationInFrames={bJ.durationInFrames} name="1-J">
        <FocusAsset />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 1-A「一扇窗」：模型窗口框 + 五色流光自五方涌入（左右交替五向，汇入窗口）。 */
const ModelWindow: React.FC<{at01: number; at02: number}> = ({at01, at02}) => {
  const enter = useEnter('pop', {at: at01, dur: 20});
  const bars = useStagger(5, {stride: 7, at: at02});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{...enter, position: 'relative', width: 640, height: 360, border: `3px solid ${theme.concept}`, borderRadius: 14, background: theme.panel, overflow: 'hidden'}}>
        {theme.sourceFlows.map((c, i) => {
          const fromLeft = i % 2 === 0;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${16 + i * 15}%`,
                left: fromLeft ? 0 : undefined,
                right: fromLeft ? undefined : 0,
                width: `${(34 + i * 11) * bars[i]}%`,
                height: 10,
                borderRadius: 5,
                background: c,
                opacity: 0.75,
              }}
            />
          );
        })}
        <div style={{position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center', fontSize: 20, color: theme.dim}}>
          一次能读的 · 就一扇窗
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 1-B 五储位标签：随句点亮（纯函数 progress——map 内禁 hook），p1-07 收拢为「五源 · 投影」。 */
const SLOT_LABELS = ['工卡开工页', '技术档案', '手册库', '工具格 · 当版页', '签署轨迹'] as const;
const FiveSlots: React.FC<{a3: number; a4: number; a5: number; a6: number; a7: number}> = ({a3, a4, a5, a6, a7}) => {
  const frame = useCurrentFrame();
  const anchors = [a3, a4, a5, a6, a6 + 10];
  const conv = clamp01(progress(frame, a7, 18));
  const pop = useSpring('settle', {at: a7, dur: 16});
  const chipW = 250;
  const x0 = (1920 - (5 * chipW + 4 * 24)) / 2;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {SLOT_LABELS.map((label, i) => {
        const k = clamp01(progress(frame, anchors[i], 12));
        const cx = x0 + i * (chipW + 24) + chipW / 2;
        const tx = (960 - cx) * conv * 0.9;
        return (
          <div
            key={label}
            style={{
              position: 'absolute',
              left: cx - chipW / 2,
              top: 168,
              width: chipW,
              height: 54,
              borderRadius: 8,
              border: `1.5px solid ${k > 0.1 ? theme.dim : theme.panelBorder}`,
              background: theme.panel,
              opacity: k * (1 - 0.75 * conv),
              transform: `translate(${tx}px, ${conv * 26}px) scale(${1 - 0.45 * conv})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 21,
              color: theme.text,
            }}
          >
            {label}
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 960 - 130,
          top: 186,
          width: 260,
          height: 50,
          borderRadius: 8,
          border: `2px solid ${theme.concept}`,
          background: withAlpha(theme.concept, 0.12),
          transform: `scale(${pop})`,
          opacity: pop,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 21,
          color: theme.concept,
          letterSpacing: 2,
        }}
      >
        五源 · 投影
      </div>
    </AbsoluteFill>
  );
};

/** 1-C 投影表拍：三面骨架面板 + 一把尺三问纠缠 + 两把空椅子（blink×2）+ 旧标签降级滑入投影层。 */
const ProjectionTable: React.FC<{a8: number; a9: number; a10: number; a11: number}> = ({a8, a9, a10, a11}) => {
  const panels = useStagger(3, {stride: 8, at: a8});
  const tangle = useStagger(3, {stride: 7, at: a9});
  const blinkA = useImpulse({at: a10, dur: 16});
  const blinkB = useImpulse({at: a10 + 22, dur: 16});
  const blink = Math.max(blinkA, blinkB);
  const slide = useSpring('settle', {at: a11, dur: 26});
  const names = ['验收面', '结构面', '时间面'];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 三面骨架面板 */}
      {names.map((n, i) => (
        <div
          key={n}
          style={{
            position: 'absolute',
            left: 240 + i * 400,
            top: 200,
            width: 320,
            height: 270,
            borderRadius: 12,
            border: `2px solid ${theme.concept}`,
            background: theme.panel,
            opacity: panels[i],
            transform: `translateY(${(1 - panels[i]) * 22}px)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{['F1', 'F2', 'F3'][i]}</span>
          <span style={{fontSize: 33, color: theme.text}}>{n}</span>
        </div>
      ))}
      {/* 投影层插槽带 */}
      <div
        style={{
          position: 'absolute',
          left: 240,
          top: 490,
          width: 1120,
          height: 56,
          borderRadius: 8,
          border: `1.5px dashed ${theme.panelBorder}`,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 16,
          gap: 22,
          opacity: panels[0],
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>投影层</span>
        {['五源', '五层'].map((t, i) => (
          <span
            key={t}
            style={{
              fontSize: 18,
              color: theme.dim,
              border: `1.5px solid ${theme.panelBorder}`,
              borderRadius: 6,
              padding: '3px 16px',
              opacity: slide,
              transform: `translateY(${(1 - slide) * 54}px)`,
            }}
          >
            {t}
          </span>
        ))}
      </div>
      {/* 一把尺：三问纠缠（同一把尺上叠放） */}
      <div style={{position: 'absolute', left: 240, top: 592, width: 1120, height: 64, opacity: tangle[0]}}>
        <div style={{position: 'absolute', left: 0, top: 26, width: '100%', height: 5, background: theme.panelBorder, borderRadius: 3}} />
        {['放什么', '怎么找', '怎么用'].map((t, i) => (
          <span
            key={t}
            style={{
              position: 'absolute',
              left: 140 + i * 84,
              top: 6,
              fontSize: 19,
              color: theme.dim,
              background: theme.panel,
              border: `1.5px solid ${theme.panelBorder}`,
              borderRadius: 7,
              padding: '4px 14px',
              opacity: tangle[i],
              transform: `rotate(${[-6, 4, -2][i]}deg)`,
            }}
          >
            {t}
          </span>
        ))}
      </div>
      {/* 两把空椅子：权威 / 复利（blink×2 缺座暗示） */}
      {['权威', '复利'].map((t, i) => (
        <div key={t} style={{position: 'absolute', left: 1560 + i * 150, top: 280, opacity: 0.35 + 0.65 * blink, textAlign: 'center'}}>
          <svg width={96} height={110}>
            <rect x={14} y={38} width={68} height={12} rx={3} fill="none" stroke={theme.dim} strokeWidth={3} />
            <rect x={14} y={6} width={12} height={40} rx={3} fill="none" stroke={theme.dim} strokeWidth={3} />
            <line x1={22} y1={50} x2={22} y2={96} stroke={theme.dim} strokeWidth={3} />
            <line x1={74} y1={50} x2={74} y2={96} stroke={theme.dim} strokeWidth={3} />
          </svg>
          <div style={{fontSize: 20, color: theme.dim, marginTop: 6}}>{t}</div>
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** 1-E p1-23「换 X 不动 Y」演示：检索工位可换（弧箭旋转）· 权限工位锁定（锁形静止）。 */
const SwapDemo: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const e1 = useEnter('rise', {at, dur: 16});
  const e2 = useEnter('rise', {at: at + 8, dur: 16});
  const rot = frame * 3;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{...e1, position: 'absolute', left: 1500, top: 160, width: 300, height: 62, borderRadius: 9, border: `1.5px solid ${theme.concept}`, background: theme.panel, display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', boxSizing: 'border-box'}}>
        <svg width={30} height={30} style={{transform: `rotate(${rot}deg)`}}>
          <path d="M 6 19 A 9 9 0 1 1 22 21" fill="none" stroke={theme.concept} strokeWidth={3} strokeLinecap="round" />
          <path d="M 22 21 l 5 -6 M 22 21 l -7 -2" fill="none" stroke={theme.concept} strokeWidth={3} strokeLinecap="round" />
        </svg>
        <span style={{fontSize: 20, color: theme.concept}}>换 · 检索</span>
      </div>
      <div style={{...e2, position: 'absolute', left: 1500, top: 234, width: 300, height: 62, borderRadius: 9, border: `1.5px solid ${theme.panelBorder}`, background: theme.panel, display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', boxSizing: 'border-box'}}>
        <svg width={30} height={30}>
          <rect x={7} y={14} width={16} height={12} rx={2} fill="none" stroke={theme.dim} strokeWidth={3} />
          <path d="M 10 14 v -4 a 5 5 0 0 1 10 0 v 4" fill="none" stroke={theme.dim} strokeWidth={3} />
        </svg>
        <span style={{fontSize: 20, color: theme.dim}}>不动 · 权限</span>
      </div>
    </AbsoluteFill>
  );
};

/** 六格流程线几何：六段 L1..L6（登记/裁决/装配/锚定/回灌/归档）。 */
const STAGE_CELLS = ['登记', '裁决', '装配', '锚定', '回灌', '归档'] as const;
const CELL_W = 200;
const CELL_GAP = 36;
const CELL_X0 = 270;
const CELL_Y = 430;
const CELL_H = 120;
const cellCx = (i: number) => CELL_X0 + i * (CELL_W + CELL_GAP) + CELL_W / 2;

/** 1-F 六格流程线：小工卡沿六格走位（p1-26 六段点名）+ 两环弧线（p1-27）。 */
const StageWalk: React.FC<{at: number; walkDur: number; loopsAt: number}> = ({at, walkDur, loopsAt}) => {
  const frame = useCurrentFrame();
  const ins = useStagger(6, {stride: 6, at});
  const arc1 = useDraw(loopsAt, 20);
  const arc2 = useDraw(loopsAt + 12, 20);
  const loopIn = useProgress(loopsAt, 30);
  const units = Math.min(5, progress(frame, at + 10, walkDur) * 5.4);
  const cardX = CELL_X0 + units * (CELL_W + CELL_GAP) + CELL_W / 2;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <path d={`M ${cellCx(3)} ${CELL_Y - 8} Q ${(cellCx(3) + cellCx(1)) / 2} ${CELL_Y - 170} ${cellCx(1)} ${CELL_Y - 8}`} fill="none" stroke={theme.ok} strokeWidth={3} {...arc1} />
        <path d={`M ${cellCx(4)} ${CELL_Y - 8} Q ${(cellCx(4) + cellCx(1)) / 2} ${CELL_Y - 210} ${cellCx(1)} ${CELL_Y - 8}`} fill="none" stroke={theme.ok} strokeWidth={3} {...arc2} />
      </svg>
      <span style={{position: 'absolute', left: cellCx(2) - 150, top: CELL_Y - 150, width: 120, textAlign: 'center', fontSize: 19, color: theme.ok, opacity: loopIn}}>验证环</span>
      <span style={{position: 'absolute', left: cellCx(3) - 40, top: CELL_Y - 196, width: 120, textAlign: 'center', fontSize: 19, color: theme.ok, opacity: loopIn}}>进化环</span>
      {STAGE_CELLS.map((c, i) => {
        const lit = units >= i - 0.001;
        return (
          <div
            key={c}
            style={{
              position: 'absolute',
              left: CELL_X0 + i * (CELL_W + CELL_GAP),
              top: CELL_Y,
              width: CELL_W,
              height: CELL_H,
              borderRadius: 10,
              border: `1.5px solid ${lit ? theme.concept : theme.panelBorder}`,
              background: lit ? withAlpha(theme.concept, 0.08) : theme.panel,
              opacity: ins[i],
              transform: `translateY(${(1 - ins[i]) * 16}px)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>L{i + 1}</span>
            <span style={{fontSize: 27, color: lit ? theme.text : theme.dim}}>{c}</span>
          </div>
        );
      })}
      {/* 小工卡：恒定锚化身，沿格顶滑行 */}
      <div
        style={{
          position: 'absolute',
          left: cardX - 32,
          top: CELL_Y - 52,
          width: 64,
          height: 44,
          borderRadius: 6,
          border: `2px solid ${theme.concept}`,
          background: theme.panel,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.mono,
          fontSize: 13,
          color: theme.concept,
        }}
      >
        工卡
      </div>
    </AbsoluteFill>
  );
};

/** 1-H G 法则：四枚图钉钉入段间接缝（闸门在通道/裁决留人/死有葬礼/回环有回执）。 */
const PIN_TAGS = ['闸门 · 通道', '裁决 · 留人', '死 · 葬礼', '回环 · 回执'] as const;
const StagePins: React.FC<{at: number}> = ({at}) => {
  const pins = useStagger(4, {stride: 14, at, dur: 12});
  const glow = useProgress(at + 70, 20);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {STAGE_CELLS.map((c, i) => (
        <div
          key={c}
          style={{
            position: 'absolute',
            left: CELL_X0 + i * (CELL_W + CELL_GAP),
            top: CELL_Y,
            width: CELL_W,
            height: CELL_H,
            borderRadius: 10,
            border: `1.5px solid ${theme.concept}`,
            background: withAlpha(theme.concept, 0.08),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>L{i + 1}</span>
          <span style={{fontSize: 27, color: theme.text}}>{c}</span>
        </div>
      ))}
      {PIN_TAGS.map((t, i) => {
        const seamX = CELL_X0 + (i + 1) * (CELL_W + CELL_GAP) - CELL_GAP / 2;
        const k = pins[i];
        return (
          <div key={t} style={{position: 'absolute', left: seamX - 14, top: CELL_Y - 96 + (1 - k) * -44, opacity: k}}>
            <svg width={28} height={54}>
              <line x1={14} y1={16} x2={14} y2={50} stroke={theme.conceptDeep} strokeWidth={3} />
              <circle cx={14} cy={10} r={8} fill={theme.conceptDeep} opacity={0.75 + 0.25 * glow} />
            </svg>
            <div
              style={{
                position: 'absolute',
                left: -58,
                top: 58,
                width: 144,
                textAlign: 'center',
                fontSize: 17,
                color: theme.conceptDeep,
                border: `1.5px solid ${withAlpha(theme.conceptDeep, 0.7)}`,
                borderRadius: 7,
                padding: '4px 6px',
                background: theme.panel,
                transform: 'rotate(-3deg)',
                boxSizing: 'border-box',
              }}
            >
              {t}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** 1-I 范本三卡 + context rot 曲线（InvertedU）+ 目标函数金句卡。 */
const CorsetShot: React.FC<{a34: number; a36: number; a37: number; a38: number}> = ({a34, a36, a37, a38}) => {
  const frame = useCurrentFrame();
  const chips = useStagger(3, {stride: 10, at: a34});
  const lift = clamp01(progress(frame, a36, 16));
  const quoteIn = clamp01(progress(frame, a38, 10));
  const curveDim = 1 - 0.72 * quoteIn;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          top: 150 - lift * 26,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 26,
          opacity: (1 - lift * 0.65) * 1,
        }}
      >
        {['数据平台 · 词表', '会话记忆 · 回写闭环', '工程 · 装配纪律'].map((t, i) => (
          <span
            key={t}
            style={{
              fontSize: 20,
              color: theme.dim,
              border: `1.5px solid ${theme.panelBorder}`,
              borderRadius: 8,
              padding: '8px 20px',
              background: theme.panel,
              opacity: chips[i],
              transform: `translateY(${(1 - chips[i]) * 16}px)`,
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <div style={{position: 'absolute', inset: 0, opacity: curveDim}}>
        <InvertedU at={a36} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1400,
          top: 640,
          fontSize: 19,
          color: theme.dim,
          border: `1.5px solid ${theme.panelBorder}`,
          borderRadius: 7,
          padding: '5px 14px',
          background: theme.panel,
          opacity: clamp01(progress(frame, a37, 12)) * curveDim,
        }}
      >
        不随升级消失
      </div>
      <div style={{position: 'absolute', inset: 0, opacity: quoteIn}}>
        <QuoteCard zh="预算之内 · 最有用的一小撮" accent={theme.concept} />
      </div>
    </AbsoluteFill>
  );
};

/** 1-J 剖面推进聚焦库房（transformOrigin 落在库房工位，空货架右侧待命）。 */
const FocusAsset: React.FC = () => {
  const push = usePushIn(0, {scale: 0.1, dur: 80});
  return (
    <div style={{position: 'absolute', inset: 0, transformOrigin: '28% 62%', transform: push}}>
      <HangarCrossSection built highlight="asset" at={0} />
    </div>
  );
};
