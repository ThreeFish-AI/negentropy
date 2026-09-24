/** P6 各归其位（p6-01..21）——分工线 / 四拿四缺 / 用法四条 / 金句信源收尾渐黑。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useDraw,
  useFadeOut,
  useImpulse,
  useProgress,
  useSpring,
  useStagger,
} from '../motion';
import {Footnote, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {Stage} from '../components/devices';

/** 6-A 分工线：左半调度员写专著（生成），右半老分拣员盖章（判断），中间一道接口线。 */
const SplitFloor: React.FC<{at: number; lampAt: number; lineAt: number}> = ({at, lampAt, lineAt}) => {
  const show = useProgress(at, DUR.f5);
  const lamps = useStagger(2, {at: lampAt, stride: 8, dur: DUR.f5});
  const line = useDraw(lineAt, DUR.f6);
  const lamp = (i: number, left: number): React.CSSProperties => ({
    position: 'absolute',
    left: left - 14,
    top: 0,
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: i === 0 ? theme.slot : theme.pass,
    opacity: lamps[i],
    boxShadow: `0 0 ${26 * lamps[i]}px ${i === 0 ? theme.slot : theme.pass}`,
  });
  const panel = (side: 'l' | 'r'): React.CSSProperties => ({
    position: 'absolute',
    top: 52,
    width: 700,
    height: 400,
    borderRadius: 14,
    border: `2.5px solid ${theme.panelBorder}`,
    background: theme.panel,
    padding: '24px 30px',
    ...(side === 'l' ? {left: 0} : {right: 0}),
  });
  return (
    <div style={{position: 'relative', width: 1640, height: 470, opacity: show}}>
      <div style={lamp(0, 350)} />
      <div style={lamp(1, 1290)} />
      <div style={panel('l')}>
        <div style={{fontFamily: theme.sans, fontSize: 27, color: theme.slot}}>生成 · 调度员（大模型）</div>
        <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 6}}>
          {'Jev is not a chat or completion model'}
        </div>
        <div
          style={{
            marginTop: 20,
            padding: '18px 24px',
            borderRadius: 10,
            border: `1.5px dashed ${theme.panelBorder}`,
            fontFamily: theme.serif,
            fontSize: 21,
            lineHeight: 2.0,
            color: theme.dim,
          }}
        >
          {'第一章 分拣中心的路网规划……'}
          <div style={{background: theme.panelBorder, height: 2, margin: '10px 0', width: '92%'}} />
          <div style={{background: theme.panelBorder, height: 2, margin: '10px 0', width: '84%'}} />
          <div style={{background: theme.panelBorder, height: 2, margin: '10px 0', width: '88%'}} />
          {'—— 本章小结（一段说明文）'}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 18}}>
          会规划 · 会写说明 · 慢，而且贵
        </div>
      </div>
      <div style={panel('r')}>
        <div style={{fontFamily: theme.sans, fontSize: 27, color: theme.pass}}>判断 · 老分拣员（Jev）</div>
        <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 6}}>一次前向 · 逐项打分</div>
        <div style={{display: 'flex', gap: 18, marginTop: 20}}>
          {[
            {t: '是非小票', s: '0–1', c: theme.slot},
            {t: '选格口小票', s: '≤255', c: theme.pass},
            {t: '打等级小票', s: '2–10', c: theme.route},
          ].map((k) => (
            <div
              key={k.t}
              style={{
                flex: 1,
                padding: '14px 12px',
                borderRadius: 10,
                border: `2px solid ${k.c}88`,
                textAlign: 'center',
              }}
            >
              <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.text}}>{k.t}</div>
              <div style={{fontFamily: theme.mono, fontSize: 22, color: k.c, marginTop: 6}}>{k.s}</div>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 22,
            display: 'inline-block',
            padding: '10px 24px',
            borderRadius: 10,
            border: `3px solid ${theme.slot}`,
            fontFamily: theme.serif,
            fontSize: 26,
            color: theme.slot,
            transform: 'rotate(-8deg)',
          }}
        >
          {'盖章 · 带把握读数'}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 16}}>
          一眼多票 · 快而便宜 · 只投挂牌格口
        </div>
      </div>
      {/* 中间接口线 */}
      <svg style={{position: 'absolute', left: 818, top: 0}} width={4} height={470} viewBox="0 0 4 470">
        <line x1={2} y1={0} x2={2} y2={470} stroke={theme.text} strokeWidth={4} {...line} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 726,
          top: 210,
          width: 188,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 18,
          color: theme.text,
          background: theme.bg,
          padding: '4px 0',
          opacity: line.strokeDashoffset < 0.35 ? 1 : 0,
        }}
      >
        清晰接口
      </div>
    </div>
  );
};

/** 6-B 四拿四缺：左列机制色四卡，右列灰卡加 danger 角标，右列头盖「给不了」章。 */
const GainLossCards: React.FC<{leftAt: number; rightAt: number; stampAt: number}> = ({leftAt, rightAt, stampAt}) => {
  const left = useStagger(4, {at: leftAt, stride: 7, dur: DUR.f5});
  const right = useStagger(4, {at: rightAt, stride: 12, dur: DUR.f5});
  const stampIn = useProgress(stampAt, DUR.f4);
  const slam = useImpulse({at: stampAt + DUR.f4, dur: DUR.f5, peak: 1});
  const gains = [
    {t: '闭合的答案空间', s: '只能投挂牌的格口', c: theme.slot},
    {t: '只读一次的底单', s: '一次编码 · 批量提问', c: theme.pass},
    {t: '能对账的概率', s: '说八成，可对账验证', c: theme.calib},
    {t: '三条去向的分流', s: '直投 / 复核 / 人工', c: theme.route},
  ];
  const lacks = [
    {t: '架构零公开', s: '逆向画像里，连规模都是最没把握的一环'},
    {t: '构造保证 ≠ 答对率', s: '零幻觉是构造保证 · 67.8% 是自报'},
    {t: '倍数口径未对齐', s: '193.6× 对 1.2× · 评测还缺校准指标'},
    {t: '中文未证', s: '官方只自认偏弱 · 第三方实测全英文'},
  ];
  const col: React.CSSProperties = {display: 'flex', flexDirection: 'column', gap: 14, width: 660};
  return (
    <div style={{display: 'flex', gap: 80}}>
      <div style={col}>
        <div style={{fontFamily: theme.serif, fontSize: 28, color: theme.slot, marginBottom: 4}}>四样 · 拿到了</div>
        {gains.map((g, i) => (
          <div
            key={g.t}
            style={{
              padding: '14px 20px',
              borderRadius: 10,
              border: `2px solid ${g.c}77`,
              borderLeft: `6px solid ${g.c}`,
              background: theme.panel,
              opacity: left[i],
              transform: `translateX(${(1 - left[i]) * -30}px)`,
            }}
          >
            <div style={{display: 'flex', gap: 14, alignItems: 'baseline'}}>
              <span style={{fontFamily: theme.mono, fontSize: 19, color: g.c}}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{fontFamily: theme.sans, fontSize: 25, color: theme.text}}>{g.t}</span>
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 4, paddingLeft: 38}}>{g.s}</div>
          </div>
        ))}
      </div>
      <div style={{...col, position: 'relative'}}>
        <div style={{fontFamily: theme.serif, fontSize: 28, color: theme.danger, marginBottom: 4}}>四样 · 给不了</div>
        <div
          style={{
            position: 'absolute',
            right: -6,
            top: -18,
            padding: '8px 18px',
            borderRadius: 10,
            border: `3px solid ${theme.danger}`,
            fontFamily: theme.serif,
            fontSize: 24,
            color: theme.danger,
            letterSpacing: 3,
            opacity: stampIn,
            transform: `rotate(9deg) scale(${1.6 - 0.6 * stampIn + slam * 0.05})`,
            zIndex: 2,
          }}
        >
          {'给不了'}
        </div>
        {lacks.map((l, i) => (
          <div
            key={l.t}
            style={{
              padding: '14px 20px',
              borderRadius: 10,
              border: `2px dashed ${theme.panelBorder}`,
              background: theme.panel,
              opacity: right[i],
              transform: `translateX(${(1 - right[i]) * 30}px)`,
            }}
          >
            <div style={{display: 'flex', gap: 14, alignItems: 'baseline'}}>
              <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.danger}}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{fontFamily: theme.sans, fontSize: 25, color: theme.text}}>{l.t}</span>
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 4, paddingLeft: 38}}>{l.s}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/** 6-C 用法四条：清单卡逐条钉上。 */
/** 四条用法各锚自己那一句（p6-12..15）：旁白念到哪条，哪条钉上并提亮，
 *  已念过的保持在场但压暗——持续态清单 + 随句推进的焦点（M-003）。 */
const UseRules: React.FC<{titleAt: number; ruleAts: [number, number, number, number]}> = ({titleAt, ruleAts}) => {
  const frame = useCurrentFrame();
  const title = useProgress(titleAt, DUR.f5);
  // 铁律①：逐条入场与焦点用纯函数派生（map 内不调 hook）
  const rules = ruleAts.map((a) => progress(frame, a, DUR.f5));
  const focusIdx = ruleAts.reduce((acc, a, i) => (frame >= a ? i : acc), -1);
  const items = [
    '答案空间 · 自己写死',
    '互斥判断 · 并成选择题 / 代码兜底',
    '门槛随风险 · 升级留人',
    '上线前 · 自家分布对一次账',
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 26, alignItems: 'center'}}>
      <div style={{fontFamily: theme.serif, fontSize: 32, color: theme.text, letterSpacing: 2, opacity: title}}>
        {'怎么用，才不算翻车'}
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
        {items.map((t, i) => (
          <div key={t} style={{position: 'relative', opacity: rules[i] * (focusIdx === i ? 1 : 0.55), transform: `translateY(${(1 - rules[i]) * -26}px) rotate(${(1 - rules[i]) * -1.2}deg)`}}>
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: -9,
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: theme.slot,
                boxShadow: `0 0 ${10 * rules[i]}px ${theme.slot}`,
                transform: 'translateX(-50%)',
              }}
            />
            <div
              style={{
                width: 1160,
                padding: '20px 30px',
                borderRadius: 12,
                border: `2px solid ${focusIdx === i ? theme.slot : theme.panelBorder}`,
                background: theme.panel,
                display: 'flex',
                gap: 22,
                alignItems: 'baseline',
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.slot}}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{fontFamily: theme.sans, fontSize: 27, color: theme.text}}>{t}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/** 6-D 收尾：杰文斯回环一行字 → 金句卡 → 信源卡 → 末帧渐黑（渐黑在 FadeVeil）。 */
const EndFade: React.FC<{loopAt: number; quoteAt: number; srcAt: number}> = ({loopAt, quoteAt, srcAt}) => {
  const loop = useProgress(loopAt, DUR.f5);
  const rise = useSpring('settle', {at: quoteAt, dur: DUR.f6});
  const srcs = useStagger(4, {at: srcAt, stride: 7, dur: DUR.f4});
  const lines = [
    '信源 · TypeSafe 官方文档站 docs.typesafe.ai（2026-09-24 取数）',
    '官方适配器与开源复刻 · 固定提交 e1d4cc9 / b8aa777 / 76361c8',
    '三组第三方实测 · nibzard / AbdelStark / scienthoon',
    '本仓精读 200 @ 5ed96405 · 画面数字均为分级归属口径',
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 74}}>
      <div style={{fontFamily: theme.sans, fontSize: 27, color: theme.dim, opacity: loop, letterSpacing: 1}}>
        {'让判断变便宜 ↻ 判断的密度，自己涨上来'}
      </div>
      <div style={{textAlign: 'center', opacity: rise, transform: `translateY(${(1 - rise) * 46}px)`}}>
        <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.text, letterSpacing: 2}}>
          {'判断 ≈ 随手一次'}
        </div>
        <div style={{fontFamily: theme.serif, fontSize: 54, color: theme.slot, marginTop: 26, letterSpacing: 4}}>
          {'量什么？'}
        </div>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center'}}>
        {lines.map((s, i) => (
          <div key={s} style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, opacity: srcs[i] * 0.88}}>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
};

/** 末帧渐黑：窗口从末 beat 总时长推导（红线四），盖住幕内全部图层（含 SceneTag 与回放残帧）。 */
const FadeVeil: React.FC<{beatFrames: number}> = ({beatFrames}) => {
  const out = useFadeOut(beatFrames, {frames: 90});
  return <AbsoluteFill style={{background: theme.bg, opacity: 1 - out}} />;
};

export const P6Verdict: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p6-01', 'p6-03');
  const bB = w('p6-04', 'p6-10');
  const bC = w('p6-11', 'p6-15');
  const bD = w('p6-16', 'p6-21');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="6-A 分工线">
        <SceneTag chapter="P6" tagline="各归其位" accent={theme.slot} />
        <ArchifyYield cues={[{at: at('p6-03') - bA.from, durationInFrames: dur('p6-03')}]}>
          <SplitFloor at={at('p6-01') - bA.from} lampAt={at('p6-02') - bA.from} lineAt={at('p6-03') - bA.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="decision-vs-generation"
          caption="生成与判断的分工线"
          cues={[{chapterId: 'dg-split', at: at('p6-03') - bA.from, durationInFrames: dur('p6-03')}]}
        />
        <Footnote delay={40}>{'「它替代不了写代码的大模型」—— 官方文档'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="6-B 四拿四缺">
        <SceneTag chapter="P6" tagline="各归其位" accent={theme.slot} />
        <ArchifyYield cues={[{at: at('p6-08') - bB.from, durationInFrames: dur('p6-08')}]}>
          <GainLossCards leftAt={at('p6-05') - bB.from} rightAt={at('p6-06') - bB.from} stampAt={at('p6-06') - bB.from + 6} />
        </ArchifyYield>
        <ArchifyRecap
          slug="decision-vs-generation"
          caption="四拿四缺清单"
          cues={[{chapterId: 'dg-checklist', at: at('p6-08') - bB.from, durationInFrames: dur('p6-08')}]}
        />
      </Sequence>

      <Sequence {...bC} name="6-C 用法四条">
        <SceneTag chapter="P6" tagline="各归其位" accent={theme.slot} />
        <Stage>
          <UseRules
            titleAt={at('p6-11') - bC.from}
            ruleAts={[at('p6-12') - bC.from, at('p6-13') - bC.from, at('p6-14') - bC.from, at('p6-15') - bC.from]}
          />
        </Stage>
      </Sequence>

      <Sequence {...bD} name="6-D 金句与渐黑">
        <SceneTag chapter="P6" tagline="各归其位" accent={theme.slot} />
        <ArchifyYield cues={[{at: at('p6-19') - bD.from, durationInFrames: dur('p6-19')}]}>
          <EndFade loopAt={at('p6-17') - bD.from} quoteAt={at('p6-18') - bD.from} srcAt={at('p6-20') - bD.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="decision-vs-generation"
          caption="开放问题：便宜之后，量什么"
          cues={[{chapterId: 'dg-open', at: at('p6-19') - bD.from, durationInFrames: dur('p6-19')}]}
        />
        <FadeVeil beatFrames={bD.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};
