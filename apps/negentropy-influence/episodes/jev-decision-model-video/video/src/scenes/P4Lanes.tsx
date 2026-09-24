/** P4 三条去向（p4-01..25）——快慢分流 / 官方成绩单 / 速通时间轴 / 评审实验 / 有把握的大多数 / 杰文斯效应。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useCount,
  useDraw,
  useFlowDash,
  useImpulse,
  useProgress,
  useStagger,
} from '../motion';
import {Footnote, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge, Stage, StatRing} from '../components/devices';

/** 4-A 三岔传送带：主带在闸门处按把握读数分三条去向，闸门落杆。 */
const ConveyorFlow: React.FC<{at: number; gateAt: number; splitAt: number}> = ({at, gateAt, splitAt}) => {
  const frame = useCurrentFrame();
  const open = useProgress(at, DUR.f5);
  const drop = useProgress(gateAt, DUR.f4);
  const impact = useImpulse({at: gateAt + DUR.f4, dur: DUR.f3, peak: 1});
  const dash = useFlowDash({dash: 16, gap: 22, period: 34});
  const lanes = [
    {y: 120, name: '直投格口', sub: '代码照单执行', th: '≥ 0.95', hot: true},
    {y: 310, name: '调度员复核', sub: '大模型慢道', th: '0.6 – 0.95', hot: false},
    {y: 500, name: '人工异常台', sub: '人来兜底', th: '< 0.6', hot: false},
  ];
  const gateArm = -65 * (1 - drop);
  // 包裹沿带行进：分段纯函数（主带水平 → 分岔过渡 → 去向道水平），勿用 hook
  const parcelY = (x: number, laneY: number) => {
    if (x < 560) return 310;
    if (x < 770) return 310 + ((laneY - 310) * (x - 560)) / 210;
    return laneY;
  };
  return (
    <svg width={1500} height={620} viewBox="0 0 1500 620" style={{opacity: open}}>
      <text x={50} y={70} fontFamily={theme.sans} fontSize={24} fill={theme.dim}>
        每次判断的把握读数，决定它走哪条道
      </text>
      {/* 主传送带 */}
      <path d="M 50 310 H 560" stroke={theme.route} strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.85} />
      <path d="M 50 310 H 560" stroke={theme.route} strokeWidth={4} fill="none" opacity={0.5} {...dash} />
      {/* 三条分支 */}
      {lanes.map((ln) => (
        <path
          key={ln.name}
          d={
            ln.y === 310
              ? 'M 560 310 L 1130 310'
              : `M 560 310 C 690 310, 630 ${ln.y}, 770 ${ln.y} L 1130 ${ln.y}`
          }
          stroke={theme.route}
          strokeWidth={8}
          fill="none"
          opacity={ln.hot ? 0.85 : 0.5}
          strokeLinecap="round"
        />
      ))}
      {/* 闸门柱 + 阈值标注 */}
      <line x1={560} y1={200} x2={560} y2={420} stroke={theme.panelBorder} strokeWidth={7} />
      <text x={586} y={238} fontFamily={theme.mono} fontSize={22} fill={theme.route}>
        0.95
      </text>
      <text x={586} y={402} fontFamily={theme.mono} fontSize={22} fill={theme.route}>
        0.6
      </text>
      {/* 落杆：从竖起旋到横档（弹簧感由 impact 补一记冲击辉光） */}
      <g transform={`rotate(${gateArm} 560 205)`}>
        <line
          x1={560}
          y1={205}
          x2={695}
          y2={205}
          stroke={theme.route}
          strokeWidth={9}
          strokeLinecap="round"
          opacity={0.6 + impact * 0.4}
        />
        <circle cx={560} cy={205} r={9} fill={theme.route} opacity={0.6 + impact * 0.4} />
      </g>
      {/* 去向格口 */}
      {lanes.map((ln) => (
        <g key={`box-${ln.name}`}>
          <rect
            x={1130}
            y={ln.y - 56}
            width={330}
            height={112}
            rx={12}
            fill={ln.hot ? `${theme.route}14` : theme.panel}
            stroke={ln.hot ? theme.route : theme.panelBorder}
            strokeWidth={2.5}
          />
          <text x={1156} y={ln.y - 12} fontFamily={theme.sans} fontSize={25} fill={theme.text}>
            {ln.name}
          </text>
          <text x={1156} y={ln.y + 22} fontFamily={theme.mono} fontSize={17} fill={theme.dim}>
            {ln.sub}
          </text>
          <text x={1290} y={ln.y - 44} fontFamily={theme.mono} fontSize={19} fill={ln.hot ? theme.route : theme.dim}>
            {ln.th}
          </text>
        </g>
      ))}
      {/* 流动包裹：每道两件，先后出发 */}
      {lanes.map((ln, li) =>
        [0, 1].map((j) => {
          const t = progress(frame, splitAt + li * 10 + j * 72, 150);
          const x = 70 + t * 1050;
          const y = parcelY(x, ln.y);
          return (
            <rect
              key={`p-${li}-${j}`}
              x={x - 23}
              y={y - 18}
              width={46}
              height={36}
              rx={7}
              fill={ln.hot ? `${theme.route}33` : theme.panel}
              stroke={theme.route}
              strokeWidth={2.5}
              opacity={0.45 + 0.55 * t}
            />
          );
        }),
      )}
    </svg>
  );
};

/** 4-B 对照组跌落条：同一评测里，「思维链全包」的柱子从 54 掉到 18。 */
const PromptDrop: React.FC<{at: number; dropAt: number}> = ({at, dropAt}) => {
  const show = useProgress(at, DUR.f5);
  const fall = useProgress(dropAt, DUR.f6);
  const num = useCount({from: 54, to: 18, at: dropAt, dur: DUR.f6});
  const gone = fall > 0.92;
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', opacity: show}}>
      <div style={{display: 'flex', gap: 90, alignItems: 'flex-end', height: 300}}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
          <div style={{fontFamily: theme.mono, fontSize: 34, color: theme.route}}>54%</div>
          <div style={{width: 130, height: 270, borderRadius: '8px 8px 0 0', background: `${theme.route}30`, border: `2.5px solid ${theme.route}`, borderBottom: 'none'}} />
        </div>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
          <div style={{fontFamily: theme.mono, fontSize: 34, color: theme.danger}}>
            {Math.round(num)}%
          </div>
          <div
            style={{
              width: 130,
              height: Math.max(14, (54 - 36 * fall) * 5),
              borderRadius: '8px 8px 0 0',
              background: `${theme.danger}2E`,
              border: `2.5px solid ${theme.danger}`,
              borderBottom: 'none',
              transform: `translateY(${fall * 8}px)`,
            }}
          />
        </div>
      </div>
      <div style={{width: 350, height: 2.5, background: theme.panelBorder}} />
      <div style={{display: 'flex', gap: 90, fontFamily: theme.sans, fontSize: 20}}>
        <div style={{width: 130, textAlign: 'center', color: theme.text}}>
          {'拆成「代码规则 + 窄问题」'}
        </div>
        <div style={{width: 130, textAlign: 'center', color: theme.danger}}>
          {'大模型思考链全包'}
          <div style={{fontSize: 17, color: gone ? theme.danger : theme.dim, fontFamily: theme.mono}}>
            {'官方表内：54% → 18%'}
          </div>
        </div>
      </div>
    </div>
  );
};

/** 4-C 《我的世界》速通时间轴：每 15 秒一颗规划星标，候选挑拣点铺满轴。 */
const TimelineStars: React.FC<{at: number; starAt: number; dotAt: number; countAt: number}> = ({
  at,
  starAt,
  dotAt,
  countAt,
}) => {
  const frame = useCurrentFrame();
  const base = useProgress(at, DUR.f5);
  const stars = useStagger(6, {at: starAt, stride: 7, dur: DUR.f4});
  const dots = useStagger(26, {at: dotAt, dur: DUR.f3, fit: {total: 90}});
  const jev = useCount({to: 131, at: countAt, dur: DUR.f6});
  const llm = useCount({to: 35, at: countAt + 10, dur: DUR.f6});
  const tickX = (sec: number) => 60 + (sec / 75) * 1320;
  const starPts = (cx: number, cy: number, r: number) =>
    Array.from({length: 10}, (_, k) => {
      const rr = k % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center', opacity: base}}>
      <div style={{display: 'flex', gap: 46, alignItems: 'center', fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
        <span>
          <span style={{color: theme.route}}>★</span> 每 15 秒一次高层规划（大模型）
        </span>
        <span>
          <span style={{color: theme.route}}>●</span> 连续候选挑拣（Jev + 代码）
        </span>
      </div>
      <svg width={1440} height={190} viewBox="0 0 1440 190">
        <line x1={60} y1={120} x2={1380} y2={120} stroke={theme.panelBorder} strokeWidth={4} />
        {[0, 15, 30, 45, 60, 75].map((sec) => (
          <g key={sec}>
            <line x1={tickX(sec)} y1={112} x2={tickX(sec)} y2={128} stroke={theme.dim} strokeWidth={2.5} />
            <text
              x={tickX(sec)}
              y={162}
              textAnchor="middle"
              fontFamily={theme.mono}
              fontSize={17}
              fill={theme.dim}
            >
              {`${sec}s`}
            </text>
          </g>
        ))}
        {[0, 15, 30, 45, 60, 75].map((sec, i) => (
          <polygon
            key={`st-${sec}`}
            points={starPts(tickX(sec), 66 + (1 - stars[i]) * 14, 20 * (0.7 + 0.3 * stars[i]))}
            fill={theme.route}
            opacity={stars[i]}
          />
        ))}
        {dots.map((d, i) => {
          const x = 105 + (i / 25) * 1250;
          return <circle key={`d-${i}`} cx={x} cy={120} r={5.5} fill={theme.route} opacity={d * 0.55} />;
        })}
        {/* 规划到挑拣的派生关系（示意两条） */}
        {[1, 3].map((k) => (
          <path
            key={`ln-${k}`}
            d={`M ${tickX(k * 15)} 86 Q ${tickX(k * 15) + 70} 104, ${tickX(k * 15) + 104} 116`}
            stroke={theme.dim}
            strokeWidth={2}
            fill="none"
            opacity={0.5 * stars[k + 1]}
          />
        ))}
      </svg>
      <div style={{display: 'flex', gap: 70, alignItems: 'baseline'}}>
        <div style={{fontFamily: theme.mono, fontSize: 46, color: theme.route}}>
          {Math.round(jev)}
          <span style={{fontSize: 22, color: theme.dim}}> 次 Jev 判断</span>
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 46, color: theme.text}}>
          {Math.round(llm)}
          <span style={{fontSize: 22, color: theme.dim}}> 次大模型调用</span>
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>
          一次成功通关 · 具体动作程序生成，Jev 只管挑
        </div>
      </div>
    </div>
  );
};

/** 4-D 评审实验：五份固定输出 × 100 遍，对照一位人工评审。 */
const JudgeBench: React.FC<{at: number; ringAt: number; limitAt: number}> = ({at, ringAt, limitAt}) => {
  const seats = useStagger(5, {at, stride: 5, dur: DUR.f4});
  const ring = useCount({to: 100, at: ringAt, dur: DUR.f6});
  const limits = useStagger(3, {at: limitAt, stride: 7, dur: DUR.f4});
  const r = 92;
  const c = 2 * Math.PI * r;
  const sz = 220;
  return (
    <div style={{display: 'flex', gap: 90, alignItems: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center'}}>
        <div style={{display: 'flex', gap: 14}}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                width: 150,
                padding: '16px 0',
                borderRadius: 10,
                border: `2px solid ${theme.panelBorder}`,
                background: theme.panel,
                textAlign: 'center',
                opacity: seats[i],
                transform: `translateY(${(1 - seats[i]) * 16}px)`,
              }}
            >
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.text}}>输出 {i + 1}</div>
              <div
                style={{
                  display: 'inline-block',
                  marginTop: 8,
                  padding: '3px 10px',
                  borderRadius: 6,
                  border: `1.5px solid ${theme.route}88`,
                  fontFamily: theme.mono,
                  fontSize: 16,
                  color: theme.route,
                }}
              >
                ×100 遍
              </div>
            </div>
          ))}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.route, padding: '8px 22px', borderRadius: 8, border: `2px solid ${theme.route}88`}}>
          Jev 评审位 · 同一份输出，逐遍打分
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>对照 · 一位人工评审</div>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center'}}>
        <div style={{position: 'relative', width: sz, height: sz}}>
          <svg width={sz} height={sz}>
            <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke={theme.panelBorder} strokeWidth={10} />
            <circle
              cx={sz / 2}
              cy={sz / 2}
              r={r}
              fill="none"
              stroke={theme.route}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${(c * ring) / 100} ${c}`}
              transform={`rotate(-90 ${sz / 2} ${sz / 2})`}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 52,
              color: theme.text,
            }}
          >
            {Math.round(ring)}%
          </div>
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>与人工评审的一致率</div>
        <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>
          打分抖动比大模型评委小 92–913 倍
        </div>
        <div style={{display: 'flex', gap: 12}}>
          {['样本极小', '只对照一位评审', '厂商联合发布'].map((t, i) => (
            <div
              key={t}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: `1.5px solid ${theme.danger}77`,
                fontFamily: theme.sans,
                fontSize: 18,
                color: theme.danger,
                opacity: limits[i],
                transform: `rotate(${(1 - limits[i]) * -4}deg)`,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** 4-E 有把握的大多数：一只桶，直投只占两成，八成走复核和人工。 */
const ConfidenceMass: React.FC<{at: number}> = ({at}) => {
  const fill = useProgress(at, DUR.f6);
  const W = 1240;
  const direct = 0.197;
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 26, alignItems: 'center'}}>
      <div style={{fontFamily: theme.serif, fontSize: 32, color: theme.text, letterSpacing: 2}}>
        {'省多少钱，不取决于单价'}
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
        {'取决于「有把握的大多数」有多大'}
      </div>
      <div
        style={{
          position: 'relative',
          width: W,
          height: 150,
          borderRadius: 14,
          border: `2.5px solid ${theme.panelBorder}`,
          background: theme.panel,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: W * direct * fill,
            background: `${theme.route}30`,
            borderRight: `3px solid ${theme.route}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 26,
            top: 30,
            fontFamily: theme.mono,
            fontSize: 40,
            color: theme.route,
            opacity: fill,
          }}
        >
          {(19.7 * fill).toFixed(1)}%
        </div>
        <div style={{position: 'absolute', left: 26, top: 86, fontFamily: theme.sans, fontSize: 21, color: theme.route, opacity: fill}}>
          够自信 · 直投
        </div>
        <div
          style={{
            position: 'absolute',
            right: 26,
            top: 30,
            fontFamily: theme.mono,
            fontSize: 40,
            color: theme.dim,
            opacity: fill,
          }}
        >
          ≈ 八成
        </div>
        <div style={{position: 'absolute', right: 26, top: 86, fontFamily: theme.sans, fontSize: 21, color: theme.dim, opacity: fill}}>
          复核 + 人工
        </div>
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>
        简化原型实测 · 阈值放到 0.95 之后，敢直投的只剩两成
      </div>
    </div>
  );
};

/** 4-F 杰文斯效应：效率与总量双曲线同升，叠化成逐格点亮的判断密度网格。 */
const JevonsFuse: React.FC<{at: number; fuseAt: number; gridAt: number}> = ({at, fuseAt, gridAt}) => {
  const eff = useDraw(at, DUR.f6);
  const total = useDraw(at + 9, DUR.f6);
  const fuse = useProgress(fuseAt, DUR.f6);
  const cells = useStagger(40, {at: gridAt, dur: DUR.f3, fit: {total: 70}});
  return (
    <div style={{position: 'relative', width: 1060, height: 430}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 1 - fuse,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <svg width={1000} height={360} viewBox="0 0 1000 360">
          <line x1={60} y1={330} x2={950} y2={330} stroke={theme.panelBorder} strokeWidth={3} />
          <line x1={60} y1={40} x2={60} y2={330} stroke={theme.panelBorder} strokeWidth={3} />
          <polyline points="60,320 220,268 380,222 540,180 700,142 860,108" fill="none" stroke={theme.route} strokeWidth={5} {...eff} />
          <polyline points="60,334 220,306 380,258 540,192 700,112 860,38" fill="none" stroke={theme.slot} strokeWidth={5} {...total} />
          <text x={878} y={104} fontFamily={theme.mono} fontSize={19} fill={theme.route}>
            效率
          </text>
          <text x={878} y={34} fontFamily={theme.mono} fontSize={19} fill={theme.slot}>
            用量
          </text>
        </svg>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text}}>
          煤炉效率越高 · 煤烧得越多（1865）
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: fuse,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(10, 88px)', gap: 10}}>
          {cells.map((c, i) => (
            <div
              key={i}
              style={{
                width: 88,
                height: 64,
                borderRadius: 8,
                border: `2px solid ${c > 0.15 ? theme.route : theme.panelBorder}`,
                background: `${theme.route}${c > 0.15 ? '26' : '00'}`,
                opacity: 0.25 + 0.75 * c,
              }}
            />
          ))}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text}}>
          判断的密度，会自己涨上来
        </div>
      </div>
    </div>
  );
};

export const P4Lanes: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p4-01', 'p4-05');
  const bB = w('p4-06', 'p4-11');
  const bC = w('p4-12', 'p4-15');
  const bD = w('p4-16', 'p4-18');
  const bE = w('p4-19', 'p4-21');
  const bF = w('p4-22', 'p4-25');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A 三岔去向">
        <SceneTag chapter="P4" tagline="三条去向" accent={theme.route} />
        <ArchifyYield
          cues={[
            {at: at('p4-02') - bA.from, durationInFrames: dur('p4-02')},
            {at: at('p4-03') - bA.from, durationInFrames: dur('p4-03')},
          ]}
        >
          <ConveyorFlow at={at('p4-01') - bA.from} gateAt={at('p4-02') - bA.from} splitAt={at('p4-03') - bA.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="gate-thresholds"
          caption="三档阈值 · 分流闸门"
          cues={[{chapterId: 'gt-gates', at: at('p4-02') - bA.from, durationInFrames: dur('p4-02')}]}
        />
        <ArchifyRecap
          slug="fast-slow-harness"
          caption="快慢分工 · 三条去向"
          lead={false}
          cues={[{chapterId: 'fs-three-lanes', at: at('p4-03') - bA.from, durationInFrames: dur('p4-03')}]}
        />
        <Footnote delay={40}>{'阈值 0.95 / 0.6 —— 官方文档的部署建议'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="4-B 官方编法与成绩单">
        <SceneTag chapter="P4" tagline="三条去向" accent={theme.route} />
        <ArchifyYield cues={[{at: at('p4-06') - bB.from, durationInFrames: dur('p4-06')}]}>
          <div style={{display: 'flex', gap: 110, alignItems: 'center'}}>
            <div style={{display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center'}}>
              <StatRing
                value={0.678}
                at={at('p4-07') - bB.from}
                label="准确率 · 9 个模型里第 4"
                color={theme.route}
                size={230}
              />
              <div style={{display: 'flex', gap: 18}}>
                <div
                  style={{
                    width: 210,
                    padding: '14px 0',
                    borderRadius: 10,
                    border: `2px solid ${theme.panelBorder}`,
                    background: theme.panel,
                    textAlign: 'center',
                  }}
                >
                  <div style={{fontFamily: theme.mono, fontSize: 30, color: theme.route}}>$0.0004</div>
                  <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 4}}>单次成本 / 例</div>
                </div>
                <div
                  style={{
                    width: 210,
                    padding: '14px 0',
                    borderRadius: 10,
                    border: `2px solid ${theme.panelBorder}`,
                    background: theme.panel,
                    textAlign: 'center',
                  }}
                >
                  <div style={{fontFamily: theme.mono, fontSize: 30, color: theme.route}}>0.4 s</div>
                  <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 4}}>单次延迟 / 例</div>
                </div>
              </div>
            </div>
            <PromptDrop at={at('p4-10') - bB.from} dropAt={at('p4-11') - bB.from} />
          </div>
        </ArchifyYield>
        <ArchifyRecap
          slug="fast-slow-harness"
          caption="代码规则 + 窄问题"
          cues={[{chapterId: 'fs-rules', at: at('p4-06') - bB.from, durationInFrames: dur('p4-06')}]}
        />
        <EvidenceBadge text="官方自报" at={at('p4-07') - bB.from} />
        <Footnote delay={40}>{'数量级优势 = 官方评测页口径；对照组 = 同表「思维链全包」模型'}</Footnote>
      </Sequence>

      <Sequence {...bC} name="4-C 速通时间轴">
        <SceneTag chapter="P4" tagline="三条去向" accent={theme.route} />
        <Stage>
          <TimelineStars
            at={at('p4-12') - bC.from}
            starAt={at('p4-13') - bC.from}
            dotAt={at('p4-14') - bC.from}
            countAt={at('p4-15') - bC.from}
          />
        </Stage>
        <EvidenceBadge text="社区速通案例" at={at('p4-12') - bC.from} />
        <Footnote delay={40}>{'规划 15s 一次 · 候选动作由程序生成，Jev 从里挑，代码执行'}</Footnote>
      </Sequence>

      <Sequence {...bD} name="4-D 评审实验">
        <SceneTag chapter="P4" tagline="三条去向" accent={theme.route} />
        <ArchifyYield cues={[{at: at('p4-16') - bD.from, durationInFrames: dur('p4-16')}]}>
          <JudgeBench at={at('p4-16') - bD.from} ringAt={at('p4-17') - bD.from} limitAt={at('p4-18') - bD.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="fast-slow-harness"
          caption="评审位实验设计"
          cues={[{chapterId: 'fs-judge', at: at('p4-16') - bD.from, durationInFrames: dur('p4-16')}]}
        />
        <Footnote delay={40}>{'一致率 100%（500/500）· 三限定：样本极小 / 单一评审 / 联合发布'}</Footnote>
      </Sequence>

      <Sequence {...bE} name="4-E 有把握的大多数">
        <SceneTag chapter="P4" tagline="三条去向" accent={theme.route} />
        <ArchifyYield cues={[{at: at('p4-20') - bE.from, durationInFrames: dur('p4-20')}]}>
          <ConfidenceMass at={at('p4-20') - bE.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="gate-thresholds"
          caption="省钱取决于有把握的大多数"
          cues={[{chapterId: 'gt-budget', at: at('p4-20') - bE.from, durationInFrames: dur('p4-20')}]}
        />
        <EvidenceBadge text="简化原型" at={at('p4-21') - bE.from} />
      </Sequence>

      <Sequence {...bF} name="4-F 杰文斯效应">
        <SceneTag chapter="P4" tagline="三条去向" accent={theme.route} />
        <ArchifyYield cues={[{at: at('p4-24') - bF.from, durationInFrames: dur('p4-24')}]}>
          <JevonsFuse at={at('p4-23') - bF.from} fuseAt={at('p4-25') - bF.from} gridAt={at('p4-25') - bF.from + 8} />
        </ArchifyYield>
        <ArchifyRecap
          slug="fast-slow-harness"
          caption="杰文斯回路：判断越便宜，用量越大"
          cues={[{chapterId: 'fs-jevons', at: at('p4-24') - bF.from, durationInFrames: dur('p4-24')}]}
        />
        <Footnote delay={34}>{'Jevons, 1865《煤炭问题》—— 效率越高，用量越大'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};
