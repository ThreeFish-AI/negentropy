/** P1 一个记忆一个文件（p1-01..p1-09，3 镜）——分镜 1-A / 1-B / 1-C。
 *
 *  叙事链：1-A 开帧承 0-C 推入——库体占屏全局位一拍（morph continuity：记忆紫
 *  方体轮廓/描边/屏位不变，仅尺度已放大）→「一个记忆，一个文件」门缝光开、内里
 *  文件卡暗格 stagger 显形〔M-005〕、首卡滑出放大至屏中——卡头三行小字槽 +
 *  卡尾类型槽 →「名字、简介、类型」三槽逐一亮起填字（槽内仅短词）→「四种」
 *  卡尾类型槽翻出四分小扇（预告不展开）→ 1-B 四张类型卡等宽一排随句依次翻面
 *  入场（次序 = 口播次序），每卡一例一图：①缩进符号线亮（空格点灰）②假数据行
 *  打红叉 ③合规章盖下 ④看板指针指向一格 → 1-C 索引页首亮（index 索引蓝——本集
 *  主装置）：自库体侧页位翻出、行 + 指向线逐行点亮（指向线断在文件图标处）、
 *  「自动重建」新行写入 → 整页闪一下重建（重建闪烁首演——签名动作）→「带多少
 *  条进门」问号签升起悬停（悬念交给 P2；2-A 首帧答题位呼应）。
 *
 *  空间契约：首卡为唯一放大主体、三槽为关键词槽位、四卡等宽一排且翻面次序 =
 *  口播次序、四卡不一次全亮、索引页为唯一焦点、行内容仅名字 + 指向线、重建
 *  闪烁一次即收、问号签不带具体数字。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥176；.memory/ · Markdown ·
 *  name / description / type 只进角标；文件卡文字不成句复述口播；四类型
 *  提前展开禁（1-B 的粮）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {IndexPage, MemoryFileCard, MemoryVault, TypeCard} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 1-A 库体开门 + 首卡特写：暗格纵深 → 首卡滑出 → 三槽填字 → 四分小扇 ────

/** 库体全局位（承 0-C pushIn 末态——屏位不变仅尺度已放大；门缝未开 → 渐张） */
const VAULT_1A = {x: 520, y: 280, w: 880, h: 420} as const;
/** 首卡落定位（自库体门缝滑出放大至屏中） */
const CARD_1A = {x: 610, y: 250, w: 700, h: 430} as const;

const OneA: React.FC<{atOpen: number; atGhost: number; atCard: number; atFields: number; atFan: number}> = ({atOpen, atGhost, atCard, atFields, atFan}) => {
  const frame = useCurrentFrame();
  // 门缝光开（渐张——morph 中间态：轮廓/描边/屏位逐帧不变，仅门缝渐张）
  const door = useProgress(atOpen, 30, 'decelerate');
  // 暗格轮廓 stagger 显形（ghostP 实数——首卡滑出前的纵深底）
  const ghost = clamp01(progress(frame, atGhost, 34));
  // 首卡滑出放大（自库体门缝中位滑至屏中 + scale；settle 手感）
  const card = useProgress(atCard, 26, 'decelerate');
  const cardScale = 0.55 + 0.45 * card;
  const cardX = 880 + (CARD_1A.x - 880) * card;
  const cardY = 420 + (CARD_1A.y - 420) * card;
  // 三行小字槽逐一亮起填字（名字/简介/类型——槽内仅短词）
  const fields = [0, 1, 2].map((i) => clamp01(progress(frame, atFields + i * 8, DUR.f4)));
  // 「四种」四分小扇翻出（四类型预告，不展开文字）
  const fan = clamp01(progress(frame, atFan, DUR.f5));
  const fanFlash = useImpulse({at: atFan + DUR.f4, dur: DUR.f5, peak: 1});
  return (
    <AbsoluteFill>
      {/* 库体（全局位一拍 → 开门露暗格；首卡特写期退居暗层） */}
      <MemoryVault
        x={VAULT_1A.x}
        y={VAULT_1A.y}
        w={VAULT_1A.w}
        h={VAULT_1A.h}
        doorP={door}
        ghostP={ghost}
        dim={card * 0.45}
      />
      {/* 首卡（滑出放大——卡头三行小字槽 + 卡尾类型槽） */}
      <div style={{position: 'absolute', left: cardX, top: cardY, opacity: clamp01(card * 1.6)}}>
        <MemoryFileCard x={0} y={0} w={CARD_1A.w} h={CARD_1A.h} scale={cardScale} fieldsLit={fields[0] + fields[1] + fields[2]} fanP={fan} flash={fanFlash} />
      </div>
      {/* 三槽词签闪注（名字/简介/类型——槽亮拍各一拍，锚在卡右上） */}
      {['名字', '简介', '类型'].map((t, i) => {
        const f = Math.sin(Math.PI * clamp01(progress(frame, atFields + i * 8, DUR.f5 + 4)));
        if (f <= 0.04) {
          return null;
        }
        return (
          <div key={t} style={{position: 'absolute', left: 1360, top: 300 + i * 76, padding: '4px 14px', borderRadius: 8, border: `2.5px solid ${withAlpha(theme.mech, 0.9)}`, background: theme.panel, fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap', opacity: f}}>
            {t}
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'.memory/ · Markdown · name / description / type'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-B 四类型卡：随句依次翻面 + 每卡一例一图 ─────────────────────────────

/** 四卡等宽一排（次序 = 口播次序①→④） */
const TYPE_ROW = {x: 150, y: 250, w: 405, h: 400, gap: 17} as const;

const OneB: React.FC<{atFlips: number[]; atExs: number[]}> = ({atFlips, atExs}) => {
  const frame = useCurrentFrame();
  // 翻面/例图 = 帧内纯函数（progress 非 hook，map 内合法——铁律①只禁 hooks）
  const flips = atFlips.map((a) => clamp01(progress(frame, a, DUR.f5)));
  const exs = atExs.map((a) => clamp01(progress(frame, a, DUR.f5)));
  return (
    <AbsoluteFill>
      {[0, 1, 2, 3].map((i) => (
        <TypeCard key={i} x={TYPE_ROW.x + i * (TYPE_ROW.w + TYPE_ROW.gap)} y={TYPE_ROW.y} w={TYPE_ROW.w} h={TYPE_ROW.h} i={i} flipP={flips[i]} exLit={exs[i]} />
      ))}
      <div style={{position: 'absolute', left: 0, right: 0, top: 180, textAlign: 'center', fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.text, opacity: 0.85}}>
        {'四种类型 · 各有各的分工'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'user · feedback · project · reference — tab / mock / auth / Linear'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-C 索引页首亮：翻出 → 逐行点亮 → 新行写入 → 重建闪烁首演 → 问号签 ────

/** 索引页全局位（居中——主装置坐标锚） */
const IDX_1C = {x: 560, y: 210, w: 800, h: 560} as const;

const OneC: React.FC<{atPage: number; atRows: number; atWrite: number; atRebuild: number; atQ: number}> = ({atPage, atRows, atWrite, atRebuild, atQ}) => {
  const frame = useCurrentFrame();
  // 索引页自库体侧页位翻出（库体缩退左缘暗层，页 scaleX 翻入）
  const page = useProgress(atPage, DUR.f5, 'decelerate');
  const flip = clamp01(page);
  // 行 + 指向线逐行点亮（stagger——行内容仅名字 + 指向线）
  const rowsLit = 6 * clamp01(progress(frame, atRows, 34));
  // 新行写入（页角写入位 → 新行生长）
  const write = clamp01(progress(frame, atWrite, DUR.f5));
  // 重建闪烁首演（整页闪一下——sin 包络一拍即收）
  const rebuild = Math.sin(Math.PI * clamp01(progress(frame, atRebuild, 16)));
  // 「带多少条进门」问号签升起悬停（？+ 空数字槽——悬念交给 P2，不带具体数字）
  const q = useProgress(atQ, DUR.f5);
  const qFloat = useImpulse({at: atQ + DUR.f5, dur: 40, peak: 6});
  return (
    <AbsoluteFill>
      {/* 库体（侧页位暗层——索引页自其侧翻出） */}
      <MemoryVault x={120} y={300} w={380} h={220} scale={0.9} lit={flip * 0.8} dim={0.35} />
      {/* 索引页（scaleX 翻入——自库体侧页位） */}
      <div style={{position: 'absolute', left: IDX_1C.x, top: IDX_1C.y, transform: `scaleX(${Math.max(0.05, flip)})`, transformOrigin: 'left center', opacity: clamp01(flip * 2)}}>
        <IndexPage x={0} y={0} w={IDX_1C.w} h={IDX_1C.h} rowsLit={rowsLit} writeP={write} rebuildP={rebuild} />
      </div>
      {/* 问号签（？+ 空数字槽——屏位 = 2-A 首帧答题位（幕间位置呼应）） */}
      {q > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 870,
            top: 120 - 40 * q - qFloat,
            padding: '10px 34px',
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.index, 0.85)}`,
            background: theme.panel,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            opacity: q,
            transform: `translateY(${(1 - q) * 22}px)`,
          }}
        >
          <span style={{fontFamily: theme.serif, fontSize: 54, fontWeight: 700, color: theme.index}}>{'？'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, border: `2px dashed ${withAlpha(theme.dim, 0.6)}`, borderRadius: 7, padding: '3px 18px'}}>{'＿ 条'}</span>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'MEMORY.md · 一行一链接 · 新记忆写入自动重建'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P1OneFileOneMemory: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p1-01', 'p1-03');
  const bB = w('p1-04', 'p1-07');
  const bC = w('p1-08', 'p1-09');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <OneA
          atOpen={wa('p1-01', 0.24) - bA.from}
          atGhost={wa('p1-01', 0.34) - bA.from}
          atCard={wa('p1-01', 0.6) - bA.from}
          atFields={wa('p1-02', 0.4) - bA.from}
          atFan={wa('p1-03', 0.3) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="1-B">
        <OneB
          atFlips={[
            wa('p1-04', 0.16) - bB.from,
            wa('p1-05', 0.16) - bB.from,
            wa('p1-06', 0.2) - bB.from,
            wa('p1-07', 0.2) - bB.from,
          ]}
          atExs={[
            wa('p1-04', 0.6) - bB.from,
            wa('p1-05', 0.62) - bB.from,
            wa('p1-06', 0.66) - bB.from,
            wa('p1-07', 0.62) - bB.from,
          ]}
        />
      </Sequence>
      <Sequence {...bC} name="1-C">
        <OneC
          atPage={wa('p1-08', 0.14) - bC.from}
          atRows={wa('p1-08', 0.32) - bC.from}
          atWrite={wa('p1-08', 0.72) - bC.from}
          atRebuild={wa('p1-08', 0.86) - bC.from}
          atQ={wa('p1-09', 0.56) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1OneFileOneMemory;
