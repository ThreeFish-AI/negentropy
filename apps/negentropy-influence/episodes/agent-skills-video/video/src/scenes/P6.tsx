/** P6 留白处的战争（p6-01..13）——三处留白摊牌成金边卷宗 → 悬案两宗（停摆/对冲）
 *  → 互通先落地 → 集装箱史押韵 → 先事实后条文 → 金句/下期/信源收尾渐黑。
 *  主色 deny 警示金（悬案卷宗/时间线/留白）；concept 青=条文与算法卡；
 *  conceptDeep 粉=金句卡与母题回归；danger/ok 本幕不用。
 *  6-B/6-C 句句皆为 archify full（v4 全屏独占契约：装置不与画框同屏），
 *  卷宗堆/日期章由录制的 pending-wars 章承担，关键词条由 Footnote 锚定。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  useBreathe,
  useDraw,
  useFadeOut,
  useImpulse,
  useProgress,
  useSpring,
  useStagger,
} from '../motion';
import {CargoBox, Footnote, Panel, SceneTag} from '../components/motifs';
import {QuoteCard} from '../components/cards';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {Stage} from '../components/devices';

/** 6-A 摊牌装置：CargoBox〔M-001〕恒定锚上三块留白（放哪/谁查/航线，呼应 1-G）
 *  问号面翻成金边卷宗面；加入/拒绝两签 + 「少管→多用」算法卡（concept 青）。 */
const ShowdownBox: React.FC<{
  at: number; // p6-01：标题 + 箱体 + 问号三块
  flipAt: number; // 问号 → 金边卷宗（useSpring 分段翻转）
  pillsAt: number; // p6-03：加入/拒绝两签
  algoAt: number; // 算法卡（箭头 useDraw）
}> = ({at, flipAt, pillsAt, algoAt}) => {
  const title = useProgress(at, DUR.f5);
  const boxVis = useProgress(at + DUR.f2, DUR.f5);
  const boxIn = useSpring('settle', {at: at + DUR.f2, dur: DUR.f5});
  const marks = useStagger(3, {at: at + DUR.f4, stride: 4, dur: DUR.f4});
  const flips = useStagger(3, {at: flipAt, stride: 5, dur: DUR.f4});
  // 卷宗翻入后的停驻辉光（〔M-003〕终态保持，effects 走呼吸不走弹簧）
  const glow = useBreathe({period: 46, amp: 0.3, base: 0.7});
  const pills = useStagger(2, {at: pillsAt, stride: 6, dur: DUR.f5});
  const algo = useProgress(algoAt, DUR.f5);
  const arrow = useDraw(algoAt + DUR.f3, DUR.f5);
  const blanks = ['放哪', '谁查', '航线'];
  const pillDefs = [
    {t: '加入 · 码头原样', c: theme.concept},
    {t: '拒绝 · 全网出局', c: theme.deny},
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28}}>
      <div style={{fontFamily: theme.serif, fontSize: 32, color: theme.deny, letterSpacing: 2, opacity: title}}>
        三处留白 · 摊牌
      </div>
      <div
        style={{
          position: 'relative',
          width: 660,
          height: 320,
          opacity: boxVis,
          transform: `translateY(${(1 - boxIn) * 18}px)`,
        }}
      >
        <CargoBox width={660} height={320} />
        <div style={{position: 'absolute', inset: 0, display: 'flex', gap: 14, padding: 22, perspective: 900}}>
          {blanks.map((k, i) => {
            // 铁律①：map 内纯函数派生（翻转分两段：前半问号翻出、后半卷宗翻入）
            const fp = flips[i];
            const outP = Math.min(1, fp * 2);
            const inP = Math.max(0, fp * 2 - 1);
            return (
              <div key={k} style={{position: 'relative', flex: 1, opacity: marks[i]}}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 10,
                    border: `2.5px dashed ${theme.deny}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    opacity: 1 - outP,
                    transform: `rotateY(${outP * 90}deg)`,
                  }}
                >
                  <div style={{fontFamily: theme.serif, fontSize: 64, color: theme.deny}}>{'?'}</div>
                  <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{k}</div>
                </div>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 10,
                    border: `3px solid ${theme.deny}`,
                    background: `${theme.deny}1A`,
                    boxShadow: `0 0 ${18 * glow * inP}px ${theme.deny}66`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: inP,
                    transform: `rotateY(${inP * 90 - 90}deg)`,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: -12,
                      left: 16,
                      width: 64,
                      height: 15,
                      borderRadius: 4,
                      border: `2.5px solid ${theme.deny}`,
                      background: theme.panel,
                    }}
                  />
                  <div style={{fontFamily: theme.serif, fontSize: 30, color: theme.deny}}>{k}</div>
                  <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, letterSpacing: 2}}>
                    {'pending'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{display: 'flex', gap: 26}}>
        {pillDefs.map((p, i) => (
          <div
            key={p.t}
            style={{
              padding: '12px 26px',
              borderRadius: 999,
              border: `2px solid ${p.c}`,
              fontFamily: theme.sans,
              fontSize: 25,
              color: p.c,
              opacity: pills[i],
              transform: `translateY(${(1 - pills[i]) * 16}px)`,
            }}
          >
            {p.t}
          </div>
        ))}
      </div>
      <Panel accent={theme.concept} style={{width: 620, padding: '14px 28px', opacity: algo}}>
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.concept, letterSpacing: 2}}>
          {'生态算法'}
        </div>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 26, marginTop: 8}}>
          <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text}}>{'少管'}</div>
          <svg width={150} height={24} viewBox="0 0 150 24">
            <line
              x1={6}
              y1={12}
              x2={128}
              y2={12}
              stroke={theme.concept}
              strokeWidth={3.5}
              strokeLinecap="round"
              {...arrow}
            />
            <polygon points={'128,3 146,12 128,21'} fill={theme.concept} opacity={algo} />
          </svg>
          <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text}}>{'多用'}</div>
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, textAlign: 'center', marginTop: 6}}>
          {'scope ↓ · adoption ↑'}
        </div>
      </Panel>
    </div>
  );
};

/** 6-D 押韵时间线：1956 卡车 → ISO 箱体 → … → CSI 海关（事故倒逼）→ 2026 本格式；
 *  押韵箭头折向本格式（conceptDeep=母题回归色；时间线主色 deny 金）。 */
const RhymeTimeline: React.FC<{at: number; win: number}> = ({at, win}) => {
  const title = useProgress(at, DUR.f5);
  const line = useDraw(at + DUR.f2, DUR.f6);
  const nodes = useStagger(4, {at: at + DUR.f4, stride: 7, dur: DUR.f5});
  const warn = useImpulse({at: at + Math.round(win * 0.4), dur: DUR.f6, peak: 1});
  const rhymeAt = at + Math.round(win * 0.52);
  const rhymeVis = useProgress(rhymeAt, DUR.f5);
  const rhymeIn = useSpring('settleSoft', {at: rhymeAt, dur: DUR.f6});
  const rhymeLine = useDraw(rhymeAt, DUR.f5);
  const stops = [
    {x: 170, tag: '1956', label: '卡车'},
    {x: 520, tag: 'ISO', label: '箱体统一'},
    {x: 900, tag: 'CSI', label: '海关协作'},
    {x: 1240, tag: '2026', label: '本格式'},
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16}}>
      <div style={{fontFamily: theme.serif, fontSize: 31, color: theme.deny, letterSpacing: 2, opacity: title}}>
        历史押韵
      </div>
      <div style={{position: 'relative', width: 1400, height: 440}}>
        <svg width={1400} height={440} viewBox="0 0 1400 440">
          <line
            x1={70}
            y1={310}
            x2={1330}
            y2={310}
            stroke={`${theme.deny}66`}
            strokeWidth={3}
            strokeLinecap="round"
            {...line}
          />
          {[660, 688, 716].map((cx) => (
            <circle key={cx} cx={cx} cy={310} r={3.5} fill={theme.dim} opacity={nodes[1] * 0.8} />
          ))}
          {stops.map((s, i) => (
            <circle
              key={s.tag}
              cx={s.x}
              cy={310}
              r={7}
              fill={i === 3 ? theme.conceptDeep : theme.deny}
              opacity={nodes[i]}
            />
          ))}
          {/* 2026 锚点竖签（点 → 悬浮箱） */}
          <line
            x1={1240}
            y1={238}
            x2={1240}
            y2={302}
            stroke={theme.conceptDeep}
            strokeWidth={2.5}
            opacity={nodes[3] * 0.8}
          />
          {/* 押韵箭头：自 CSI 一段折向 2026 本格式箱（useDraw 描线 + 箭头弹簧） */}
          <path
            d="M 900 282 C 980 168, 1120 150, 1235 236"
            stroke={theme.conceptDeep}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
            {...rhymeLine}
          />
          <g
            opacity={rhymeVis}
            transform={`translate(1232 234) scale(${0.4 + 0.6 * rhymeIn}) translate(-1232 -234)`}
          >
            <polygon points={'1220,218 1244,230 1222,246'} fill={theme.conceptDeep} />
          </g>
        </svg>
        {stops.slice(0, 3).map((s, i) => (
          <React.Fragment key={s.tag}>
            <div
              style={{
                position: 'absolute',
                left: s.x - 70,
                top: 256,
                width: 140,
                textAlign: 'center',
                fontFamily: theme.mono,
                fontSize: 26,
                color: theme.deny,
                opacity: nodes[i],
              }}
            >
              {s.tag}
            </div>
            <div
              style={{
                position: 'absolute',
                left: s.x - 70,
                top: 332,
                width: 140,
                textAlign: 'center',
                fontFamily: theme.sans,
                fontSize: 21,
                color: theme.dim,
                opacity: nodes[i],
              }}
            >
              {s.label}
            </div>
          </React.Fragment>
        ))}
        {/* 事故标记：CSI 节点上方菱形警示 + 关键词（deny 金） */}
        <div
          style={{
            position: 'absolute',
            left: 900 - 11,
            top: 244,
            width: 22,
            height: 22,
            borderRadius: 4,
            border: `2.5px solid ${theme.deny}`,
            background: `${theme.deny}26`,
            transform: 'rotate(45deg)',
            opacity: nodes[2] * (0.7 + 0.3 * warn),
            boxShadow: `0 0 ${14 * warn}px ${theme.deny}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 928,
            top: 246,
            fontFamily: theme.mono,
            fontSize: 19,
            color: theme.deny,
            opacity: nodes[2],
          }}
        >
          事故倒逼
        </div>
        {/* 2026：悬浮的〔M-001〕集装箱=本格式（母题回归，conceptDeep 恒定锚） */}
        <div style={{position: 'absolute', left: 1240 - 55, top: 160, opacity: nodes[3]}}>
          <CargoBox width={110} height={74} label="2026" />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 1240 - 70,
            top: 332,
            width: 140,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 21,
            color: theme.conceptDeep,
            opacity: nodes[3],
          }}
        >
          本格式
        </div>
        <div
          style={{
            position: 'absolute',
            left: 988,
            top: 122,
            fontFamily: theme.serif,
            fontSize: 27,
            color: theme.conceptDeep,
            letterSpacing: 2,
            opacity: rhymeVis,
          }}
        >
          同一押韵
        </div>
      </div>
      <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: title}}>
        箱体先行 · 协作后补
      </div>
    </div>
  );
};

/** 6-E 边界收束：「先事实后条文」牌 + 三行清单（保证/好用/可信）逐行定格〔M-003〕。 */
const VerdictList: React.FC<{at: number}> = ({at}) => {
  const head = useProgress(at, DUR.f5);
  const rows = useStagger(3, {at: at + DUR.f4, stride: 9, dur: DUR.f5});
  const items = [
    {k: '保证', v: '包里是什么', c: theme.concept},
    {k: '好用', v: '看货签功夫', c: theme.conceptDeep},
    {k: '可信', v: '看港口岗哨', c: theme.concept},
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30}}>
      <div style={{textAlign: 'center', opacity: head, transform: `translateY(${(1 - head) * -18}px)`}}>
        <div style={{fontFamily: theme.serif, fontSize: 38, color: theme.concept, letterSpacing: 3}}>
          先事实后条文
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 8}}>
          {'fact first · spec later'}
        </div>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 18}}>
        {items.map((it, i) => (
          <div
            key={it.k}
            style={{
              width: 1060,
              padding: '20px 28px',
              borderRadius: 12,
              border: `2px solid ${it.c}77`,
              borderLeft: `6px solid ${it.c}`,
              background: theme.panel,
              display: 'flex',
              alignItems: 'baseline',
              gap: 24,
              opacity: rows[i],
              transform: `translateY(${(1 - rows[i]) * 24}px)`,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 24, color: it.c}}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.text}}>{it.k}</span>
            <span style={{fontFamily: theme.sans, fontSize: 27, color: theme.dim}}>{it.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** 6-F 金句卡的让位窗：p6-12 全程在场，p6-13 起淡出让位给下期/信源卡（effects 纯时长缓动）。 */
const QuoteGate: React.FC<{hideAt: number; children: React.ReactNode}> = ({hideAt, children}) => {
  const vis = 1 - useProgress(hideAt, DUR.f5);
  return <div style={{position: 'absolute', inset: 0, opacity: vis}}>{children}</div>;
};

/** 6-F 收尾：下期占位卡（「下期」+ 留白空槽——反串线红线，不写下集标题，留待系列卡）
 *  + 信源三行（agentskills.io 规范 / 本仓精读 210·211 / 自建实测原型）。 */
const ClosingBoard: React.FC<{nextAt: number; srcAt: number}> = ({nextAt, srcAt}) => {
  const nextVis = useProgress(nextAt, DUR.f5);
  const nextIn = useSpring('settle', {at: nextAt, dur: DUR.f6});
  const srcs = useStagger(3, {at: srcAt, stride: 7, dur: DUR.f4});
  const lines = [
    '信源 · agentskills.io 规范 @ 69ef37e9',
    '本仓精读 210 · 211',
    '自建实测原型',
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 64}}>
      <div style={{textAlign: 'center', opacity: nextVis, transform: `translateY(${(1 - nextIn) * 40}px)`}}>
        <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.deny, letterSpacing: 6}}>{'下期'}</div>
        <div
          style={{
            marginTop: 22,
            width: 760,
            height: 96,
            borderRadius: 12,
            border: `2.5px dashed ${theme.deny}88`,
          }}
        />
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center'}}>
        {lines.map((s, i) => (
          <div key={s} style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, opacity: srcs[i] * 0.9}}>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
};

/** 末帧渐黑：窗口从末 beat 总时长推导（红线四：beat 时长而非末句时长，防收尾长黑屏），
 *  盖住幕内全部图层（含 SceneTag 与金句残帧）。 */
const FadeVeil: React.FC<{beatFrames: number}> = ({beatFrames}) => {
  const out = useFadeOut(beatFrames, {frames: 90});
  return <AbsoluteFill style={{background: theme.bg, opacity: 1 - out}} />;
};

export const P6: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p6-01', 'p6-04');
  const bB = w('p6-05', 'p6-06');
  const bC = w('p6-07');
  const bD = w('p6-08', 'p6-08b');
  const bE = w('p6-09', 'p6-11');
  const bF = w('p6-12', 'p6-13');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="6-A 摊牌">
        <SceneTag chapter="P6" tagline="留白处的战争" accent={theme.deny} />
        <ArchifyYield
          cues={[
            {at: at('p6-02') - bA.from, durationInFrames: dur('p6-02')},
            {at: at('p6-04') - bA.from, durationInFrames: dur('p6-04')},
          ]}
        >
          <ShowdownBox
            at={at('p6-01') - bA.from}
            flipAt={at('p6-01') - bA.from + Math.round(dur('p6-01') * 0.55)}
            pillsAt={at('p6-03') - bA.from}
            algoAt={at('p6-03') - bA.from + Math.round(dur('p6-03') * 0.5)}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="governance-layers"
          caption="留白三层 · 生态算法"
          cues={[
            {chapterId: 'gl-three', at: at('p6-02') - bA.from, durationInFrames: dur('p6-02')},
            {chapterId: 'gl-algo', at: at('p6-04') - bA.from, durationInFrames: dur('p6-04')},
          ]}
        />
        <Footnote delay={at('p6-04') - bA.from}>{'算法的代价 · 记在留白'}</Footnote>
      </Sequence>

      {/* 6-B/6-C：句句 archify full（全屏独占），卷宗堆/日期章/抽卷由 pending-wars
          录制章承担；lead={false}——pw-stall 与 6-A 的 gl-algo 跨镜背靠背 */}
      <Sequence {...bB} name="6-B 悬案卷宗堆">
        <SceneTag chapter="P6" tagline="留白处的战争" accent={theme.deny} />
        <ArchifyRecap
          slug="pending-wars"
          caption="悬案：停摆与对冲"
          lead={false}
          cues={[
            {chapterId: 'pw-stall', at: at('p6-05') - bB.from, durationInFrames: dur('p6-05')},
            {chapterId: 'pw-clash', at: at('p6-06') - bB.from, durationInFrames: dur('p6-06')},
          ]}
        />
        <Footnote delay={at('p6-05') - bB.from}>{'停摆 7 个月 · 对冲无裁决'}</Footnote>
      </Sequence>

      <Sequence {...bC} name="6-C 互通先落地">
        <SceneTag chapter="P6" tagline="留白处的战争" accent={theme.deny} />
        <ArchifyRecap
          slug="pending-wars"
          caption="互通最先落地"
          lead={false}
          cues={[{chapterId: 'pw-interop', at: at('p6-07') - bC.from, durationInFrames: dur('p6-07')}]}
        />
        <Footnote delay={at('p6-07') - bC.from}>{'互通 · 最先落地'}</Footnote>
      </Sequence>

      <Sequence {...bD} name="6-D 集装箱史押韵">
        <SceneTag chapter="P6" tagline="留白处的战争" accent={theme.deny} />
        <ArchifyYield
          cues={[
            {at: at('p6-08a') - bD.from, durationInFrames: dur('p6-08a')},
            {at: at('p6-08b') - bD.from, durationInFrames: dur('p6-08b')},
          ]}
        >
          <RhymeTimeline at={at('p6-08') - bD.from} win={dur('p6-08')} />
        </ArchifyYield>
        <ArchifyRecap
          slug="box-history-rhyme"
          caption="箱体史押韵"
          cues={[
            {chapterId: 'hr-mclean', at: at('p6-08a') - bD.from, durationInFrames: dur('p6-08a')},
            {chapterId: 'hr-csi', at: at('p6-08b') - bD.from, durationInFrames: dur('p6-08b')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="6-E 边界收束">
        <SceneTag chapter="P6" tagline="留白处的战争" accent={theme.deny} />
        <ArchifyYield
          cues={[
            {at: at('p6-09') - bE.from, durationInFrames: dur('p6-09')},
            {at: at('p6-10') - bE.from, durationInFrames: dur('p6-10')},
          ]}
        >
          <VerdictList at={at('p6-11') - bE.from} />
        </ArchifyYield>
        {/* hr-rhyme 与 6-D 的 hr-csi 跨镜背靠背 → lead={false} */}
        <ArchifyRecap
          slug="box-history-rhyme"
          caption="事实先行"
          lead={false}
          cues={[{chapterId: 'hr-rhyme', at: at('p6-09') - bE.from, durationInFrames: dur('p6-09')}]}
        />
        {/* gl-verdict 与同镜 hr-rhyme 背靠背（跨实例）→ lead={false} */}
        <ArchifyRecap
          slug="governance-layers"
          caption="只保证一件事"
          lead={false}
          cues={[{chapterId: 'gl-verdict', at: at('p6-10') - bE.from, durationInFrames: dur('p6-10')}]}
        />
      </Sequence>

      <Sequence {...bF} name="6-F 收尾">
        <SceneTag chapter="P6" tagline="留白处的战争" accent={theme.deny} />
        {/* 金句卡：serif 全句上屏是复述门唯一例外——上屏为口播的变体写法（逐字不同） */}
        <QuoteGate hideAt={at('p6-13') - bF.from}>
          <QuoteCard zh={'一个文件夹 · 一份说明 · 一行货签'} accent={theme.conceptDeep} />
        </QuoteGate>
        <Stage>
          <ClosingBoard
            nextAt={at('p6-13') - bF.from}
            srcAt={at('p6-13') - bF.from + Math.round(dur('p6-13') * 0.5)}
          />
        </Stage>
        <FadeVeil beatFrames={bF.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};
