/** P0 规范里没有的词（p0-01..p0-12，镜 0-A..0-C）——终端判词（247 行只命中
 *  De-SIGN-ed）→ 没有海关的港口（46 家互认 × 空置海关 × 投毒到账；p0-08 港口
 *  隐喻总卡装置桥段）→ 史前悬崖（npm 8 年 vs 本生态 6 个月）收在三场战争宣言。
 *  幕主色关税橙（海关/闸门/攻击面）；〔M-003〕可停驻终态（判词定格、总卡压入
 *  后停驻）；「分发流向永远向右」的空间语义在 0-B 装置落为堆场→海关→泊位。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useCount, useFlowDash, useStagger, useSpring} from '../motion';
import {Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

// ── 0-B p0-08 港口隐喻总卡 ──────────────────────────────────────────────

/** p0-08 装置（唯一非 cue 句）：港口隐喻总卡 useSpring 压入〔M-003〕。
 *  布局＝剧场空间语义：左=堆场/发布方（同型箱堆场）→ 中=虚线空置海关 →
 *  右=泊位/用户端（5 艘小船带同一只箱 stagger 依次停靠），分发流向恒向右
 *  （useFlowDash 流光不设关卡）；「46 家」Counter 滚数收在右舷。
 *  箱体用中性 text/dim 描边（互认≠验证——本集检疫绿专指见证/批准面）。 */
const PortOverview: React.FC<{
  pressAt: number;
  dockAt: number;
  countAt: number;
  countDur: number;
  customsAt: number;
}> = ({pressAt, dockAt, countAt, countDur, customsAt}) => {
  const frame = useCurrentFrame();
  const settle = useSpring('settle', {at: pressAt, dur: DUR.f6});
  const pressP = progress(frame, pressAt, DUR.f5);
  const st = useStagger(5, {at: dockAt, dur: DUR.f4, stride: 9});
  const flow = useFlowDash({dash: 11, gap: 15, period: 46});
  const customsP = progress(frame, customsAt, DUR.f4);
  const fortySix = useCount({to: 46, at: countAt, dur: countDur});
  const dy = (1 - settle) * -34;
  const sc = 0.94 + 0.06 * settle;
  return (
    <div
      style={{
        width: 1460,
        opacity: pressP,
        transform: `translateY(${dy}px) scale(${sc})`,
      }}
    >
      <Panel accent={theme.concept} style={{padding: '26px 34px 18px'}}>
        <svg width={1392} height={470} viewBox="0 0 1392 470">
          {/* 岸线（右=泊位侧水域） */}
          <line
            x1={0}
            y1={418}
            x2={828}
            y2={418}
            stroke={`${theme.panelBorder}`}
            strokeWidth={3}
          />
          <line
            x1={828}
            y1={418}
            x2={1392}
            y2={418}
            stroke={`${theme.dim}55`}
            strokeWidth={3}
            strokeDasharray="3 11"
            strokeLinecap="round"
          />
          {/* 分发流向：堆场 → 直穿空置海关 → 泊位（恒向右，途中无任何关卡） */}
          <line
            x1={214}
            y1={320}
            x2={1216}
            y2={320}
            stroke={`${theme.dim}88`}
            strokeWidth={3.5}
            strokeLinecap="round"
            {...flow}
          />
          <path
            d="M1216 311 L1236 320 L1216 329 Z"
            fill={`${theme.dim}88`}
          />
          {/* 左：堆场（发布方）——六只同型箱：只此一形，别无二样 */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            return (
              <rect
                key={i}
                x={44 + col * 112}
                y={282 - row * 66}
                width={92}
                height={56}
                rx={7}
                fill={`${theme.text}0D`}
                stroke={`${theme.text}AA`}
                strokeWidth={2.5}
              />
            );
          })}
          <text
            x={206}
            y={382}
            textAnchor="middle"
            fontFamily={theme.sans}
            fontSize={26}
            fill={theme.dim}
          >
            {'箱体标准'}
          </text>
          {/* 中：空置海关——关税橙虚线空壳（路中央却无闸：流光直线穿过不停） */}
          <g opacity={customsP}>
            <path
              d="M642 210 L786 210 L786 402 L642 402 Z"
              fill="none"
              stroke={`${theme.concept}CC`}
              strokeWidth={3}
              strokeDasharray="12 10"
            />
            <path d="M628 216 L714 152 L800 216 Z" fill="none" stroke={`${theme.concept}CC`} strokeWidth={3} />
            <text
              x={714}
              y={322}
              textAnchor="middle"
              fontFamily={theme.sans}
              fontSize={30}
              fill={theme.concept}
            >
              {'海关'}
            </text>
            <text
              x={714}
              y={368}
              textAnchor="middle"
              fontFamily={theme.mono}
              fontSize={24}
              fill={theme.deny}
            >
              {'空置'}
            </text>
          </g>
          {/* 右：泊位（用户端）——5 艘小船各驮同一只箱，依次停靠互认 */}
          {[0, 1, 2, 3, 4].map((i) => {
            const x = 864 + i * 106;
            const p = st[i];
            return (
              <g key={i} opacity={p} transform={`translate(${(1 - p) * 44} 0)`}>
                <path
                  d={`M${x} 380 L${x + 84} 380 L${x + 72} 414 L${x + 12} 414 Z`}
                  fill={`${theme.text}14`}
                  stroke={`${theme.text}AA`}
                  strokeWidth={2.5}
                />
                <rect
                  x={x + 22}
                  y={352}
                  width={40}
                  height={26}
                  rx={4}
                  fill={`${theme.text}0D`}
                  stroke={`${theme.text}AA`}
                  strokeWidth={2.5}
                />
              </g>
            );
          })}
          {/* 右舷计数：46 家（口播四十六家的数字锚点） */}
          <text
            x={1168}
            y={262}
            textAnchor="middle"
            fontFamily={theme.mono}
            fontSize={54}
            fill={theme.text}
          >
            {Math.round(fortySix)}
            <tspan fontSize={30} fill={theme.dim}>
              {' 家'}
            </tspan>
          </text>
          <text
            x={1168}
            y={296}
            textAnchor="middle"
            fontFamily={theme.sans}
            fontSize={22}
            fill={theme.dim}
          >
            {'同一只箱'}
          </text>
        </svg>
      </Panel>
    </div>
  );
};

// ── 主组件 ──────────────────────────────────────────────────────────────

export const P0: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p0-01', 'p0-04');
  const bB = w('p0-05', 'p0-09');
  const bC = w('p0-10', 'p0-12');
  const d08 = dur('p0-08');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 终端判词">
        <SceneTag chapter="P0" tagline="规范里没有的词" accent={theme.concept} />
        {/* 全片第一画帧：入场白闪（lead 实测对位）取默认入场 */}
        <ArchifyRecap
          slug="grep-verdict"
          caption="安全词检索"
          cues={[
            {chapterId: 'gv-cmd', at: at('p0-01') - bA.from, durationInFrames: dur('p0-01')},
            {chapterId: 'gv-stems', at: at('p0-02') - bA.from, durationInFrames: dur('p0-02')},
            {chapterId: 'gv-hit', at: at('p0-03') - bA.from, durationInFrames: dur('p0-03')},
            {chapterId: 'gv-designed', at: at('p0-04') - bA.from, durationInFrames: dur('p0-04')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="0-B 没有海关的港口">
        <SceneTag chapter="P0" tagline="规范里没有的词" accent={theme.concept} />
        {/* p0-08 唯一装置句：港口隐喻总卡（其余四句全屏回放期间让位） */}
        <ArchifyYield
          cues={[
            {at: at('p0-05') - bB.from, durationInFrames: dur('p0-05')},
            {at: at('p0-06') - bB.from, durationInFrames: dur('p0-06')},
            {at: at('p0-07') - bB.from, durationInFrames: dur('p0-07')},
            {at: at('p0-09') - bB.from, durationInFrames: dur('p0-09')},
          ]}
        >
          <PortOverview
            pressAt={at('p0-08') - bB.from}
            dockAt={at('p0-08') - bB.from + Math.round(d08 * 0.55)}
            countAt={at('p0-08') - bB.from + Math.round(d08 * 0.5)}
            countDur={Math.round(d08 * 0.42)}
            customsAt={at('p0-08') - bB.from + Math.round(d08 * 0.22)}
          />
        </ArchifyYield>
        {/* gv-designed@p0-04 跨镜背靠背 → 首实例 lead={false}；05→06→07 同实例
            连续换章由 enters 抑制；p0-08 为装置空窗 → pn-ious 另起实例恢复入场 */}
        <ArchifyRecap
          slug="port-no-customs"
          caption="没有海关的港口"
          lead={false}
          cues={[
            {chapterId: 'pn-46', at: at('p0-05') - bB.from, durationInFrames: dur('p0-05')},
            {chapterId: 'pn-gap', at: at('p0-06') - bB.from, durationInFrames: dur('p0-06')},
            {chapterId: 'pn-toxic', at: at('p0-07') - bB.from, durationInFrames: dur('p0-07')},
          ]}
        />
        <ArchifyRecap
          slug="port-no-customs"
          caption="没有海关的港口"
          cues={[{chapterId: 'pn-ious', at: at('p0-09') - bB.from, durationInFrames: dur('p0-09')}]}
        />
      </Sequence>

      <Sequence {...bC} name="0-C 史前悬崖">
        <SceneTag chapter="P0" tagline="规范里没有的词" accent={theme.concept} />
        {/* pn-ious@p0-09 跨镜背靠背 → lead={false}；10→11→12 同实例由 enters 抑制 */}
        <ArchifyRecap
          slug="history-cliff"
          caption="史前悬崖"
          lead={false}
          cues={[
            {chapterId: 'hc-npm', at: at('p0-10') - bC.from, durationInFrames: dur('p0-10')},
            {chapterId: 'hc-six', at: at('p0-11') - bC.from, durationInFrames: dur('p0-11')},
            {chapterId: 'hc-three', at: at('p0-12') - bC.from, durationInFrames: dur('p0-12')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
