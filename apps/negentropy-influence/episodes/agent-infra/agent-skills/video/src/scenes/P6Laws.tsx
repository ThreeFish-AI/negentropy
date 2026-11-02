/** P6 规律、争议与边界（p6-01..p6-15，镜 6-A..6-D）——五规律卡连翻收拢 →
 *  两块争议牌 → 五枚边界护栏 → 目录索引卡终态回归（〔M-001〕〔M-003〕同形停驻）
 *  + 实验指引签 + 尾幕渐黑（从末 beat 总时长推导，红线四）。
 *  无 archify 锚（收束幕）；主色回归目录金。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useCount, useDim, useEnter, useFadeOut, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {CatalogCard, Stage} from '../components/as-motifs';

/** 6-A：五规律卡连翻 → 收拢一枚「管得少 → 被接受」。 */
const FiveLaws: React.FC<{cardsAt: number; foldAt: number}> = ({cardsAt, foldAt}) => {
  const cards = useStagger(5, {at: cardsAt, dur: DUR.f6, stride: 8});
  const fold = useEnter('pop', {at: foldAt, dur: DUR.f5, springPreset: 'snap'});
  const laws = ['身份锚在文件系统', '成本按使用付费', '路由由语义决定', '资产是被解释的文本', '互操作压倒完备'];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 44}}>
      <div style={{display: 'flex', gap: 20}}>
        {laws.map((l, i) => (
          <div
            key={l}
            style={{
              opacity: cards[i] * (1 - Math.min(1, fold.opacity)),
              transform: `translateY(${16 * (1 - cards[i])}px) scale(${1 - 0.25 * fold.opacity})`,
              width: 190,
              background: theme.panel,
              border: `1.5px solid ${theme.panelBorder}`,
              borderRadius: 11,
              padding: '18px 16px',
              fontSize: 16,
              color: theme.text,
              textAlign: 'center',
            }}
          >
            {l}
          </div>
        ))}
      </div>
      <div
        style={{
          ...fold,
          border: `2px solid ${theme.ledger}`,
          borderRadius: 12,
          padding: '14px 32px',
          fontFamily: theme.serif,
          fontSize: 26,
          fontWeight: 700,
          color: theme.ledger,
          background: theme.panel,
        }}
      >
        管得足够少，才能被足够多人接受
      </div>
    </div>
  );
};

/** 6-B：两块争议牌（自主vs点名 · 信任真空黑幕）。 */
const Disputes: React.FC<{boardAt: number; veilAt: number}> = ({boardAt, veilAt}) => {
  const boards = useStagger(2, {at: boardAt, dur: DUR.f5, stride: 10});
  const dark = useDim({at: veilAt, to: 0.35, dur: DUR.f5});
  return (
    <div style={{display: 'flex', gap: 60, alignItems: 'flex-start'}}>
      <div
        style={{
          opacity: boards[0],
          transform: `translateY(${18 * (1 - boards[0])}px)`,
          width: 480,
          background: theme.panel,
          border: `2px solid ${theme.gov}`,
          borderRadius: 13,
          padding: '24px 28px',
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 23, color: theme.gov, marginBottom: 14}}>
          模型自主 vs 人工点名
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 14, fontSize: 15.5, color: theme.text}}>
          <span style={{border: `1.5px solid ${theme.route}66`, borderRadius: 999, padding: '6px 16px'}}>自动触发</span>
          <span style={{color: theme.dim}}>＋</span>
          <span style={{border: `1.5px solid ${theme.route}66`, borderRadius: 999, padding: '6px 16px'}}>点名调用</span>
          <span style={{color: theme.dim}}>双通道并存</span>
        </div>
      </div>
      <div
        style={{
          opacity: boards[1],
          transform: `translateY(${18 * (1 - boards[1])}px)`,
          width: 480,
          background: theme.panel,
          border: `2px solid ${theme.danger}77`,
          borderRadius: 13,
          padding: '24px 28px',
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 23, color: theme.danger, marginBottom: 14}}>
          信任真空由谁补位
        </div>
        <div style={{fontSize: 15.5, color: theme.dim, opacity: dark}}>
          安全责任全额推给客户端——很可能要等一次真实事件，才倒逼出标准层防线
        </div>
      </div>
    </div>
  );
};

/** 6-C：五枚边界护栏卡（灰阶 + danger 描边）。 */
const Guardrails: React.FC<{railsAt: number}> = ({railsAt}) => {
  const rails = useStagger(5, {at: railsAt, dur: DUR.f6, stride: 7});
  const items = [
    '收益无权威基准',
    '路由无严格对照',
    '名单≠实现深度',
    '防线依旧脆弱',
    '极简治理未经验证',
  ];
  return (
    <div style={{display: 'flex', gap: 20}}>
      {items.map((t, i) => (
        <div
          key={t}
          style={{
            opacity: rails[i],
            transform: `translateY(${14 * (1 - rails[i])}px)`,
            width: 200,
            background: theme.panel,
            border: `1.5px solid ${theme.danger}55`,
            borderRadius: 10,
            padding: '16px 14px',
            fontSize: 15.5,
            color: theme.dim,
            textAlign: 'center',
          }}
        >
          ⚠ {t}
        </div>
      ))}
    </div>
  );
};

export const P6Laws: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p6-01', 'p6-04');
  const bB = w('p6-05', 'p6-08');
  const bC = w('p6-09', 'p6-12');
  const bD = w('p6-13', 'p6-15');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="6-A 五规律">
        <SceneTag chapter="P6" tagline="规律、争议与边界" accent={theme.ledger} />
        <Stage>
        <FiveLaws cardsAt={at('p6-01') - bA.from} foldAt={at('p6-04') - bA.from} />
        </Stage>


      </Sequence>
      <Sequence {...bB} name="6-B 三争议">
        <SceneTag chapter="P6" tagline="规律、争议与边界" accent={theme.ledger} />
        <Stage>
        <Disputes boardAt={at('p6-05') - bB.from} veilAt={at('p6-08') - bB.from} />
        </Stage>


      </Sequence>
      <Sequence {...bC} name="6-C 边界护栏">
        <SceneTag chapter="P6" tagline="规律、争议与边界" accent={theme.ledger} />
        <Stage>
        <Guardrails railsAt={at('p6-10') - bC.from} />
        </Stage>


      </Sequence>
      <Sequence {...bD} name="6-D 回扣收尾">
        <SceneTag chapter="P6" tagline="规律、争议与边界" accent={theme.ledger} />
        <Stage>
        <FinalBeat durationInFrames={bD.durationInFrames} labAt={at('p6-15') - bD.from} />
        </Stage>


      </Sequence>
    </AbsoluteFill>
  );
};

/** 6-D 内容体：useFadeOut 必须在 Sequence 内取 beat 局部帧——组件层调用吃全局帧，
 *  progress 恒 1 → fade 恒 0（2026-10-06 三渲实测整镜隐形缺陷）。 */
const FinalBeat: React.FC<{durationInFrames: number; labAt: number}> = ({
  durationInFrames,
  labAt,
}) => {
  // 红线四：渐黑窗口从末 beat 总时长推导（勿用末句时长）
  const fade = useFadeOut(durationInFrames, {frames: 42});
  const repo = useCount({at: labAt, dur: DUR.f4, to: 5});
  return (
    <div style={{opacity: fade}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 38}}>
        <FinalCard />
        <div
          style={{
            border: `1.5px solid ${theme.panelBorder}`,
            borderRadius: 999,
            padding: '10px 24px',
            fontSize: 15.5,
            color: theme.dim,
            background: theme.panel,
          }}
        >
          实验室 · lab2 五场破坏性实验 × 完整脚本 · 仓库可复现
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: 0.75}}>
          {Math.round(repo)} / 5 · X1–X5
        </div>
      </div>
    </div>
  );
};

/** 终态目录卡：与 0-A 同形（〔M-001〕逐像素一致），金线呼吸停驻（〔M-003〕）。 */
const FinalCard: React.FC = () => {
  return <CatalogCard breathe width={620} scale={1.06} nameText="目录常驻" descText="正文按需" />;
};
