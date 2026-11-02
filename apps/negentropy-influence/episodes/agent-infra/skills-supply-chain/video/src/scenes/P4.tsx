/** P4 隔壁港开了航线（p4-01..12，镜 4-A..4-C）——左港冻结 49 天 × 右港 81 天定稿：
 *  4-A dual-harbor 四章（冻结/81 天/四理由否决/砍小 Final）→ 4-B sep-mechanism 五章
 *  （逐文件清单/批准锁定/换货可测/来源命名/预授权闸）→ 4-C honest-boundary 与
 *  dual-harbor 交错（自认边界/三家部分/内部原型/唯一的桥/#546 报关无人签）。
 *  装置句仅两处：p4-09 规范原文引号卡（useDraw）；p4-12 48 卷宗排队（useStagger）。
 *  主色关税橙=闸门/攻击面；检疫绿=验证面；警示金=冻结悬案（卷宗/停摆）。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useDraw, useProgress, useSpring, useStagger} from '../motion';
import {Counter, Footnote, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

/** 4-C① 装置（p4-09）：规范原文引号卡——SEP-2640「Digests Are Not a Trust Anchor」
 *  节 MUST NOT 条款原句（钉点 b0b3272f 已核），两侧引号描笔 + 关键词下划线描线
 *  （useDraw）；「安全边界」词组否认关系用 ≠ 锚点收口（画面词为关键词锚，
 *  原文证据属第三方引用面，不复述口播）。 */
const SpecQuote: React.FC = () => {
  const card = useProgress(2, DUR.f4);
  const rise = useSpring('settle', {at: 2, dur: DUR.f5});
  const markL = useDraw(2, DUR.f5);
  const markR = useDraw(9, DUR.f5);
  const text = useProgress(6, DUR.f5);
  const strike = useDraw(16, DUR.f5);
  const chips = useStagger(3, {at: 22, dur: DUR.f3, stride: 5});
  const cite = useProgress(30, DUR.f4);
  return (
    <Panel
      accent={theme.panelBorder}
      style={{
        position: 'relative',
        width: 1060,
        padding: '38px 92px 34px',
        opacity: card,
        transform: `translateY(${(1 - rise) * 20}px)`,
        boxSizing: 'border-box',
      }}
    >
      {/* 两侧引号：描线入场（描笔画=原文被翻出） */}
      <svg width={52} height={44} viewBox="0 0 52 44" style={{position: 'absolute', left: 22, top: 30}}>
        <path d="M4 40 L4 14 Q4 4 16 4" fill="none" stroke={theme.dim} strokeWidth={4} strokeLinecap="round" {...markL} />
        <path d="M26 40 L26 14 Q26 4 38 4" fill="none" stroke={theme.dim} strokeWidth={4} strokeLinecap="round" {...markL} />
      </svg>
      <svg width={52} height={44} viewBox="0 0 52 44" style={{position: 'absolute', right: 22, bottom: 92}}>
        <path d="M48 4 L48 30 Q48 40 36 40" fill="none" stroke={theme.dim} strokeWidth={4} strokeLinecap="round" {...markR} />
        <path d="M26 4 L26 30 Q26 40 14 40" fill="none" stroke={theme.dim} strokeWidth={4} strokeLinecap="round" {...markR} />
      </svg>
      <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 1}}>
        {'SEP-2640 · Digests Are Not a Trust Anchor'}
      </div>
      <div style={{marginTop: 24, fontFamily: theme.serif, fontSize: 40, fontStyle: 'italic', lineHeight: 1.55, color: theme.text, opacity: text}}>
        {'Hosts '}
        <span style={{color: theme.concept, fontWeight: 700}}>{'MUST NOT'}</span>
        {' treat a digest match as a '}
        <span style={{position: 'relative', display: 'inline-block'}}>
          {'security boundary'}
          <svg width={'100%'} height={10} viewBox="0 0 100 10" preserveAspectRatio="none" style={{position: 'absolute', left: 0, bottom: -6}}>
            <line x1={2} y1={5} x2={98} y2={5} stroke={theme.concept} strokeWidth={3} strokeLinecap="round" {...strike} />
          </svg>
        </span>
        {'.'}
      </div>
      <div style={{marginTop: 30, display: 'flex', alignItems: 'center', gap: 18}}>
        <span
          style={{
            padding: '7px 20px',
            borderRadius: 999,
            border: `2px solid ${theme.conceptDeep}`,
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.conceptDeep,
            opacity: chips[0],
          }}
        >
          {'digest 匹配'}
        </span>
        <span style={{fontFamily: theme.mono, fontSize: 34, color: theme.deny, opacity: chips[1]}}>{'≠'}</span>
        <span
          style={{
            padding: '7px 20px',
            borderRadius: 999,
            border: `2px solid ${theme.concept}`,
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.concept,
            opacity: chips[2],
          }}
        >
          {'安全边界'}
        </span>
      </div>
      <div style={{marginTop: 26, fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: cite}}>
        {'摘要无签名 · 与内容同源 · 网关可同改'}
      </div>
    </Panel>
  );
};

/** 4-C② 装置（p4-12）：48 卷宗排队——提案队列 4×12 卷宗 useStagger 从闸口向左
 *  长出（队首先到，空间语义：右=闸口/泊位、流向向右），闸门横杆警示金常闭定格
 *  （M-003 持续态；「就这么排队等着」配以静写闷，入场后零强调动效）。 */
const DossierQueue: React.FC<{span: number}> = ({span}) => {
  const head = useProgress(2, DUR.f4);
  const gate = useProgress(10, DUR.f4);
  const cards = useStagger(48, {at: 6, dur: DUR.f3, fit: {total: Math.max(56, Math.round(span * 0.6))}});
  const tagged = [
    {label: '#546', hot: true},
    {label: '#254', hot: false},
    {label: '#380', hot: false},
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, opacity: head}}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 24}}>
        <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>{'提案队列'}</span>
        <span style={{fontFamily: theme.mono, fontSize: 56, color: theme.deny}}>
          <Counter from={0} to={48} start={10} frames={DUR.f6} />
          {' 份'}
        </span>
        <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'· 排队中'}</span>
      </div>
      <div style={{position: 'relative', width: 1190, height: 252}}>
        {/* 卷宗堆场：行内 row-reverse ⇒ 索引 0 落在最右（队首贴闸） */}
        <div style={{position: 'absolute', left: 0, top: 6, display: 'flex', flexDirection: 'column', gap: 10}}>
          {[0, 1, 2, 3].map((r) => (
            <div key={r} style={{display: 'flex', flexDirection: 'row-reverse', gap: 10}}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((c) => {
                const i = r * 12 + c;
                const p = cards[i];
                const tag = r === 0 && c < 3 ? tagged[c] : null;
                const edge = tag ? (tag.hot ? theme.concept : theme.dim) : `${theme.deny}66`;
                return (
                  <div
                    key={c}
                    style={{
                      position: 'relative',
                      width: 70,
                      height: 48,
                      borderRadius: 8,
                      border: `2px solid ${edge}`,
                      background: tag ? `${theme.concept}12` : `${theme.deny}10`,
                      opacity: p,
                      transform: `translateX(${(1 - p) * -26}px)`,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: -8,
                        left: 9,
                        width: 30,
                        height: 8,
                        borderRadius: '5px 5px 0 0',
                        border: `2px solid ${edge}`,
                        borderBottom: 'none',
                      }}
                    />
                    {tag ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          fontFamily: theme.mono,
                          fontSize: 16,
                          color: tag.hot ? theme.concept : theme.dim,
                        }}
                      >
                        {tag.label}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {/* 常闭闸口：双柱 + 警示金横杆（冻结=悬案金，非攻击红） */}
        <div style={{position: 'absolute', right: 0, top: 0, width: 208, height: 246, opacity: gate}}>
          <div style={{position: 'absolute', left: 8, top: 8, width: 8, height: 224, borderRadius: 4, background: theme.panelBorder}} />
          <div style={{position: 'absolute', right: 8, top: 8, width: 8, height: 224, borderRadius: 4, background: theme.panelBorder}} />
          <div
            style={{
              position: 'absolute',
              left: 8,
              right: 8,
              top: 104,
              height: 14,
              borderRadius: 7,
              background: `repeating-linear-gradient(45deg, ${theme.deny} 0 14px, #0B0E13 14px 28px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 158,
              textAlign: 'center',
              fontFamily: theme.mono,
              fontSize: 24,
              color: theme.deny,
              padding: '6px 0',
              border: `2px solid ${theme.deny}88`,
              borderRadius: 10,
            }}
          >
            {'冻结'}
          </div>
        </div>
      </div>
    </div>
  );
};

export const P4: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p4-01', 'p4-04');
  const bB = w('p4-05', 'p4-07b');
  const bC = w('p4-08', 'p4-12');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A 双港区对照">
        <SceneTag chapter="P4" tagline="隔壁港开了航线" accent={theme.concept} />
        {/* 幕首：P3 末句 p3-13 非锚句（幕间已有呼吸淡入）→ 首章正常入场 */}
        <ArchifyRecap
          slug="dual-harbor"
          caption="双港区对照"
          cues={[
            {chapterId: 'dh-frozen', at: at('p4-01') - bA.from, durationInFrames: dur('p4-01')},
            {chapterId: 'dh-81', at: at('p4-02') - bA.from, durationInFrames: dur('p4-02')},
            {chapterId: 'dh-veto', at: at('p4-03') - bA.from, durationInFrames: dur('p4-03')},
            {chapterId: 'dh-final', at: at('p4-04') - bA.from, durationInFrames: dur('p4-04')},
          ]}
        />
        <Footnote delay={at('p4-02') - bA.from + Math.round(dur('p4-02') / 2)}>{'49 天 ⇄ 81 天'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="4-B 航线机制">
        <SceneTag chapter="P4" tagline="隔壁港开了航线" accent={theme.concept} />
        {/* dh-final@p4-04 跨镜背靠背 → lead={false}；五句连排由实例内 enters 抑制 */}
        <ArchifyRecap
          slug="sep-mechanism"
          caption="航线机制拆解"
          lead={false}
          cues={[
            {chapterId: 'sm-list', at: at('p4-05') - bB.from, durationInFrames: dur('p4-05')},
            {chapterId: 'sm-approval', at: at('p4-06') - bB.from, durationInFrames: dur('p4-06')},
            {chapterId: 'sm-detect', at: at('p4-07') - bB.from, durationInFrames: dur('p4-07')},
            {chapterId: 'sm-identity', at: at('p4-07a') - bB.from, durationInFrames: dur('p4-07a')},
            {chapterId: 'sm-gate', at: at('p4-07b') - bB.from, durationInFrames: dur('p4-07b')},
          ]}
        />
        <Footnote delay={at('p4-07') - bB.from + Math.round(dur('p4-07') / 2)}>{'批准作废 · 铁闸'}</Footnote>
      </Sequence>

      <Sequence {...bC} name="4-C 诚实边界与人事桥">
        <SceneTag chapter="P4" tagline="隔壁港开了航线" accent={theme.concept} />
        {/* 装置窗：p4-09 引号卡 / p4-12 卷宗排队（窗内窗均与 Recap cue 同步维护） */}
        <ArchifyYield
          cues={[
            {at: at('p4-08') - bC.from, durationInFrames: dur('p4-08')},
            {at: at('p4-09a') - bC.from, durationInFrames: dur('p4-09a')},
            {at: at('p4-09b') - bC.from, durationInFrames: dur('p4-09b')},
            {at: at('p4-10') - bC.from, durationInFrames: dur('p4-10')},
            {at: at('p4-11') - bC.from, durationInFrames: dur('p4-11')},
          ]}
        >
          <Sequence layout="none" from={at('p4-09') - bC.from} durationInFrames={at('p4-09a') - at('p4-09')}>
            <SpecQuote />
          </Sequence>
          <Sequence
            layout="none"
            from={at('p4-12') - bC.from}
            durationInFrames={bC.from + bC.durationInFrames - at('p4-12')}
          >
            <DossierQueue span={bC.from + bC.durationInFrames - at('p4-12')} />
          </Sequence>
        </ArchifyYield>
        {/* sm-gate@p4-07b 跨镜背靠背 → lead={false}；p4-09 为装置空窗 */}
        <ArchifyRecap
          slug="honest-boundary"
          caption="诚实边界"
          lead={false}
          cues={[{chapterId: 'hb-mustnot', at: at('p4-08') - bC.from, durationInFrames: dur('p4-08')}]}
        />
        {/* p4-09 装置空窗后重现 → 恢复入场；09a→09b 同实例由 enters 抑制 */}
        <ArchifyRecap
          slug="honest-boundary"
          caption="诚实边界"
          cues={[
            {chapterId: 'hb-partial', at: at('p4-09a') - bC.from, durationInFrames: dur('p4-09a')},
            {chapterId: 'hb-proto', at: at('p4-09b') - bC.from, durationInFrames: dur('p4-09b')},
          ]}
        />
        {/* hb-proto@p4-09b 背靠背（跨 slug 换章）→ lead={false} */}
        <ArchifyRecap
          slug="dual-harbor"
          caption="双港区对照"
          lead={false}
          cues={[{chapterId: 'dh-bridge', at: at('p4-10') - bC.from, durationInFrames: dur('p4-10')}]}
        />
        {/* dh-bridge@p4-10 背靠背 → lead={false}；p4-12 为装置空窗 */}
        <ArchifyRecap
          slug="honest-boundary"
          caption="诚实边界"
          lead={false}
          cues={[{chapterId: 'hb-546', at: at('p4-11') - bC.from, durationInFrames: dur('p4-11')}]}
        />
        <Footnote delay={at('p4-11') - bC.from + Math.round(dur('p4-11') / 2)}>{'#546 · 8 行 · 24 天 · 0 评论'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};
