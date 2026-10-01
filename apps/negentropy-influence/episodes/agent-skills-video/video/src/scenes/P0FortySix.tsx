/** P0 四十六家之谜（p0-01..p0-12，镜 0-A..0-E）——目录树开场（一个文件夹=一份
 *  说明书）→ 46 家登记名单（含正面竞对；dt-eco 章回放）→ 工序知识两会命门 →
 *  两条老路死法（猜=不可靠 / 塞=贵且稀释）→ 反转金句「常驻一行·用到才付钱」
 *  + 门牌引入钩子。
 *  幕主色门牌靛（名单/登记/身份感的悬念态）；〔M-003〕目录树全片开场锚，
 *  P6-D 同机位回扣。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {CornerNote, Plaque, Stage} from '../components/e1-motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';

/** 0-A 目录树：`.agents/skills/` 下六个文件夹逐个落位（lab4 六夹具，与
 *  〔M-001〕菜单卡同源——观众在此第一次见到这六个名字）。 */
const DirTree: React.FC<{fallAt: number; cardAt: number}> = ({fallAt, cardAt}) => {
  const frame = useCurrentFrame();
  const st = useStagger(6, {at: fallAt, dur: DUR.f5, stride: 7});
  const cardP = progress(frame, cardAt, DUR.f4);
  const dirs = ['shift-swap', 'report-merger', 'deploy-helper', 'pantry-inventory', 'legacy-notes', 'evil-craft'];
  return (
    <div style={{position: 'relative', width: 940, height: 560}}>
      {/* 根目录标签 */}
      <div
        style={{
          fontFamily: theme.mono,
          fontSize: 18,
          color: theme.dim,
          marginBottom: 18,
          paddingLeft: 8,
        }}
      >
        .agents/skills/
      </div>
      {/* 树干线 */}
      <div style={{position: 'absolute', left: 26, top: 62, bottom: 12, width: 2, background: theme.panelBorder}} />
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 286px)', gap: '26px 22px'}}>
        {dirs.map((d, i) => (
          <div
            key={d}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              paddingLeft: 26,
              opacity: st[i],
              transform: `translateY(${(1 - st[i]) * -22}px)`,
            }}
          >
            {/* 文件夹图形 */}
            <svg width={44} height={34} viewBox="0 0 44 34">
              <path
                d="M2 8 Q2 4 6 4 H16 L20 9 H38 Q42 9 42 13 V29 Q42 33 38 33 H6 Q2 33 2 29 Z"
                fill={`${theme.conceptDeep}26`}
                stroke={theme.conceptDeep}
                strokeWidth={2}
              />
            </svg>
            <div>
              <div style={{fontFamily: theme.mono, fontSize: 16.5, color: theme.text}}>{d}</div>
              <div style={{fontSize: 13, color: theme.dim, marginTop: 2}}>SKILL.md</div>
            </div>
          </div>
        ))}
      </div>
      {/* 两件套定格卡（p0-02）：文件夹 + SKILL.md + 两行必填 */}
      <div
        style={{
          position: 'absolute',
          right: -70,
          bottom: -64,
          width: 300,
          background: theme.panel,
          border: `1.5px solid ${theme.conceptDeep}66`,
          borderRadius: 10,
          padding: '14px 18px',
          opacity: cardP,
          transform: `translateY(${(1 - cardP) * 14}px)`,
        }}
      >
        <div style={{fontSize: 14, color: theme.dim, marginBottom: 8}}>就这么简单</div>
        <div style={{display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap'}}>
          <span style={{fontSize: 15, color: theme.text}}>一个文件夹</span>
          <span style={{color: theme.dim}}>+</span>
          <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.text}}>SKILL.md</span>
        </div>
        <div style={{fontSize: 14, color: theme.concept, marginTop: 8}}>两行必填信息</div>
      </div>
    </div>
  );
};

/** 0-C 痛点：左列三个工序词条；右列「开工视野」卡（p0-07 同位语时铺开
 *  上下文格阵——它一次开工能看到的全部内容）。 */
const PainSplit: React.FC<{listAt: number; viewAt: number; gridAt: number}> = ({
  listAt,
  viewAt,
  gridAt,
}) => {
  const frame = useCurrentFrame();
  const st = useStagger(3, {at: listAt, dur: DUR.f4, stride: 10});
  const viewP = progress(frame, viewAt, DUR.f5);
  const gridP = progress(frame, gridAt, DUR.f5);
  const items = ['团队约定', '工具细节', '踩过的坑'];
  return (
    <div style={{display: 'flex', gap: 90, alignItems: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 34}}>
        {items.map((t, i) => (
          <div
            key={t}
            style={{
              fontSize: 27,
              color: theme.text,
              opacity: st[i],
              transform: `translateX(${(1 - st[i]) * -30}px)`,
              borderLeft: `3px solid ${theme.conceptDeep}`,
              paddingLeft: 18,
            }}
          >
            {t}
          </div>
        ))}
        <div style={{fontSize: 17, color: theme.dim, paddingLeft: 21, opacity: st[2]}}>
          这类工序知识，模型记不住
        </div>
      </div>
      {/* 开工视野卡：上下文=一次开工能看到的全部内容 */}
      <div
        style={{
          width: 470,
          background: theme.panel,
          border: `1.5px solid ${theme.panelBorder}`,
          borderRadius: 12,
          padding: '18px 22px',
          opacity: viewP,
          transform: `translateY(${(1 - viewP) * 20}px)`,
        }}
      >
        <div style={{fontSize: 15, color: theme.dim, marginBottom: 12}}>开工视野（上下文）</div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6}}>
          {Array.from({length: 24}, (_, i) => {
            const lit = i / 24 < gridP;
            return (
              <div
                key={i}
                style={{
                  height: 26,
                  borderRadius: 4,
                  background: lit ? `${theme.conceptDeep}55` : `${theme.panelBorder}33`,
                  border: `1px solid ${lit ? theme.conceptDeep : theme.panelBorder}`,
                }}
              />
            );
          })}
        </div>
        <div style={{fontSize: 14.5, color: theme.dim, marginTop: 12, opacity: gridP}}>
          一次开工能看到的全部内容 —— 塞进去的每格都有代价
        </div>
      </div>
    </div>
  );
};

/** 0-D 两条老路：上「猜」（抖动问号+虚线结果）；下「塞手册」（开场白格阵
 *  填满变暗、指令色块互相挤压）+ 账单跳涨。 */
const TwoDeadEnds: React.FC<{guessAt: number; stuffAt: number; billAt: number; billDur: number}> = ({
  guessAt,
  stuffAt,
  billAt,
  billDur,
}) => {
  const frame = useCurrentFrame();
  const guessP = progress(frame, guessAt, DUR.f4);
  const stuffP = progress(frame, stuffAt, DUR.f6);
  const billP = progress(frame, billAt, billDur);
  const shake = Math.sin(frame * 1.7) * 3 * (guessP > 0 ? 1 : 0);
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 44, width: 1080}}>
      {/* 路线一：猜 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 26,
          opacity: guessP,
        }}
      >
        <div style={{fontSize: 16, color: theme.dim, width: 74}}>路线一</div>
        <div style={{fontSize: 21, color: theme.text, transform: `translateX(${shake}px)` }}>
          让模型自己猜
        </div>
        <svg width={280} height={30} viewBox="0 0 280 30">
          <line
            x1={0}
            y1={15}
            x2={236}
            y2={15}
            stroke={theme.dim}
            strokeWidth={2.5}
            strokeDasharray="4 10"
            strokeLinecap="round"
          />
          <path d="M236 8 L252 15 L236 22 Z" fill={theme.dim} />
        </svg>
        <div
          style={{
            fontSize: 17,
            color: theme.danger,
            border: `1.5px dashed ${theme.danger}88`,
            borderRadius: 8,
            padding: '6px 14px',
          }}
        >
          不可靠 · 不可复现
        </div>
      </div>
      {/* 路线二：塞开场白 */}
      <div style={{display: 'flex', alignItems: 'center', gap: 26, opacity: stuffP}}>
        <div style={{fontSize: 16, color: theme.dim, width: 74}}>路线二</div>
        <div style={{fontSize: 21, color: theme.text}}>手册全塞进开场白</div>
        {/* 格阵：填满 → 变暗 → 挤压 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 22px)',
            gap: 4,
            padding: 10,
            border: `1.5px solid ${theme.panelBorder}`,
            borderRadius: 8,
          }}
        >
          {Array.from({length: 48}, (_, i) => {
            const filled = i / 48 < stuffP;
            const squeezed = stuffP > 0.6;
            return (
              <div
                key={i}
                style={{
                  width: 22,
                  height: 20,
                  borderRadius: 3,
                  background: filled
                    ? squeezed
                      ? `${theme.danger}44`
                      : `${theme.conceptDeep}44`
                    : 'transparent',
                  border: `1px solid ${filled ? (squeezed ? theme.danger : theme.conceptDeep) : theme.panelBorder}`,
                  transform: squeezed ? `scale(${0.86 + (i % 3) * 0.04})` : undefined,
                }}
              />
            );
          })}
        </div>
        <div style={{fontSize: 17, color: theme.danger}}>指令互相稀释</div>
      </div>
      {/* 账单：按装机量涨 */}
      <div
        style={{
          alignSelf: 'flex-end',
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          opacity: billP,
        }}
      >
        <span style={{fontSize: 15, color: theme.dim}}>账单（按装机量）</span>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 34,
            fontWeight: 700,
            color: theme.danger,
          }}
        >
          {Math.round(20 + billP * 2140)}
        </span>
        <span style={{fontSize: 15, color: theme.dim}}>token ↑ 还在涨</span>
      </div>
    </div>
  );
};

/** 0-E 反转：金句卡「常驻一行 · 用到才付钱」+ 门牌滑入（钩到 P1）。 */
const Flip: React.FC<{cardAt: number; doorAt: number}> = ({cardAt, doorAt}) => {
  const frame = useCurrentFrame();
  const settle = useSpring('settle', {at: cardAt, dur: DUR.f6});
  const settleO = progress(frame, cardAt, DUR.f6); // opacity 走时长缓动（effects 不变量）
  const doorP = progress(frame, doorAt, DUR.f5);
  return (
    <div style={{position: 'relative', width: 1100, height: 520}}>
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 120,
          opacity: settleO,
          transform: `translateY(${(1 - settle) * 26}px)`,
        }}
      >
        <div style={{fontSize: 17, color: theme.dim, marginBottom: 14, letterSpacing: 2}}>
          Agent Skills 把这笔账整个反过来
        </div>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 46,
            color: theme.concept,
            lineHeight: 1.5,
            fontWeight: 700,
          }}
        >
          常驻的只留一行
          <br />
          用到的，才付钱
        </div>
      </div>
      {/* 门牌：答案的前一半 */}
      <div
        style={{
          position: 'absolute',
          right: 80,
          bottom: 96,
          opacity: doorP,
          transform: `translateY(${(1 - doorP) * 40}px) rotate(${(1 - doorP) * -6}deg)`,
        }}
      >
        <Plaque variant="door" title="?" sub="答案的前一半，钉在门牌上" />
      </div>
    </div>
  );
};

export const P0FortySix: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p0-01', 'p0-02');
  const bB = w('p0-03', 'p0-04');
  const bC = w('p0-05', 'p0-07');
  const bD = w('p0-08', 'p0-10');
  const bE = w('p0-11', 'p0-12');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 目录树">
        <SceneTag chapter="P0" tagline="四十六家之谜" accent={theme.conceptDeep} />
        <Stage>
          <DirTree
            fallAt={at('p0-01') - bA.from}
            cardAt={at('p0-02') - bA.from + Math.round(dur('p0-02') * 0.35)}
          />
        </Stage>
      </Sequence>

      <Sequence {...bB} name="0-B 登记名单">
        <SceneTag chapter="P0" tagline="四十六家之谜" accent={theme.conceptDeep} />
        {/* dt-eco 章回放承载 46 家生态面；p0-04 三枚「无」标签走角标层 */}
        <ArchifyRecap
          slug="dual-track"
          caption="生态登记 · 46 家"
          cues={[
            {chapterId: 'dt-eco', at: at('p0-03') - bB.from, durationInFrames: dur('p0-03') + dur('p0-04'), },
          ]}
        />
        <CornerNote text="取数 2026-09-30 · 登记口径（自报）" y={150} x={60} />
      </Sequence>

      <Sequence {...bC} name="0-C 工序知识">
        <SceneTag chapter="P0" tagline="四十六家之谜" accent={theme.conceptDeep} />
        <Stage>
          <PainSplit
            listAt={at('p0-05') - bC.from + Math.round(dur('p0-05') * 0.3)}
            viewAt={at('p0-06') - bC.from}
            gridAt={at('p0-07') - bC.from + Math.round(dur('p0-07') * 0.45)}
          />
        </Stage>
      </Sequence>

      <Sequence {...bD} name="0-D 两条老路">
        <SceneTag chapter="P0" tagline="四十六家之谜" accent={theme.conceptDeep} />
        <Stage>
          <TwoDeadEnds
            guessAt={at('p0-08') - bD.from}
            stuffAt={at('p0-09') - bD.from}
            billAt={at('p0-10') - bD.from}
            billDur={dur('p0-10')}
          />
        </Stage>
      </Sequence>

      <Sequence {...bE} name="0-E 反转">
        <SceneTag chapter="P0" tagline="四十六家之谜" accent={theme.conceptDeep} />
        <Stage>
          <Flip
            cardAt={at('p0-11') - bE.from}
            doorAt={at('p0-12') - bE.from + Math.round(dur('p0-12') * 0.3)}
          />
        </Stage>
      </Sequence>
    </AbsoluteFill>
  );
};
