/** P2 规章手册＝M1（p2-01..36）——唯一的**双不变量**机制：
 *  口径单点（声明锁）与查询期重算（计算锁）可各自独立失效，故必须并列演两遍。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useCount, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge, NumberClash, PillarHUD, Stage} from '../components/devices';

/** 2-E 复印机陷阱：一张 100 进去、三张副本出来。
 *  `sumAt` 必须单独传（铁律⑤）：300 的爆红要落在说出「虚增成了三百块」的那句上，
 *  写死 `at + 26` 会提前 8.3s 压到前两句。 */
const CopierTrap: React.FC<{at: number; sumAt: number}> = ({at, sumAt}) => {
  const ps = useStagger(3, {at: at + 8, stride: 7, dur: DUR.f5});
  const total = useCount({from: 100, to: 300, at: sumAt, dur: DUR.f6});
  const boom = useImpulse({at: sumAt + 4, dur: DUR.f6});
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 46}}>
      <div
        style={{
          width: 230,
          padding: '26px 0',
          textAlign: 'center',
          borderRadius: 12,
          border: `2px solid ${theme.manual}`,
          background: `${theme.manual}14`,
          fontFamily: theme.mono,
          fontSize: 40,
          color: theme.manual,
        }}
      >
        $100 订单
      </div>
      <div style={{fontSize: 56}}>🖨️</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 210,
              padding: '12px 0',
              textAlign: 'center',
              borderRadius: 8,
              border: `2px dashed ${theme.danger}`,
              fontFamily: theme.mono,
              fontSize: 26,
              color: theme.danger,
              opacity: ps[i],
              transform: `translateX(${(1 - ps[i]) * -20}px)`,
            }}
          >
            副本 {i + 1} · $100
          </div>
        ))}
      </div>
      <div
        style={{
          fontFamily: theme.mono,
          fontSize: 82,
          color: theme.danger,
          transform: `scale(${1 + 0.16 * boom})`,
        }}
      >
        ${Math.round(total)}
      </div>
    </div>
  );
};

/** 2-F 班级平均分天平：先除后加 vs 先聚后除 */
const AvgScale: React.FC<{at: number}> = ({at}) => {
  const tilt = useSpring('settle', {at, dur: DUR.f6});
  const ghost = useProgress(at + 14, DUR.f6);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 60}}>
      <div style={{textAlign: 'center', transform: `translateY(${-14 * tilt}px)`}}>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>先除后加（平均的平均）</div>
        <div style={{fontFamily: theme.mono, fontSize: 72, color: theme.danger, opacity: 1 - 0.45 * ghost}}>
          122
        </div>
      </div>
      <div style={{fontSize: 52, opacity: 0.7}}>⚖️</div>
      <div style={{textAlign: 'center', transform: `translateY(${14 * tilt}px)`}}>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>先聚后除（真实客单价）</div>
        <div style={{fontFamily: theme.mono, fontSize: 72, color: theme.ok}}>108</div>
      </div>
    </div>
  );
};

/** 2-G 末快照时间闸 */
const LastSnapshot: React.FC<{at: number; clashAt: number}> = ({at, clashAt}) => {
  const frame = useCurrentFrame();
  const days = [5, 6, 7, 4, 6, 5, 7];
  return (
    <div>
      <div style={{display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 22}}>
        {days.map((d, i) => {
          const p = progress(frame, at + i * 3, DUR.f4);
          const isLast = i === days.length - 1;
          return (
            <div key={i} style={{textAlign: 'center'}}>
              <div
                style={{
                  width: 84,
                  height: 26 * d * p,
                  borderRadius: 5,
                  background: isLast ? theme.ok : `${theme.engine}77`,
                  boxShadow: isLast ? `0 0 18px ${theme.ok}88` : 'none',
                }}
              />
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 6}}>{d}</div>
            </div>
          );
        })}
      </div>
      {/* clashAt：24 vs 7 要落在 p2-30（说出「虚增到二十四」）上，写死 at+26 会提前 9.3s */}
      <NumberClash badLabel="七天求和" bad="24" goodLabel="末快照" good="7" at={clashAt} />
    </div>
  );
};

export const P2Manual: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  // 非 beat 用途一律走 dur，不写 w('句id') 字面形态（见 P3Gate 同处注释）
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p2-01', 'p2-04');
  const bB = w('p2-05', 'p2-08');
  const bC = w('p2-09', 'p2-09b');
  const bD = w('p2-10', 'p2-13');
  const bE = w('p2-14', 'p2-20');
  const bF = w('p2-21', 'p2-26');
  const bG = w('p2-27', 'p2-31');
  const bH = w('p2-32', 'p2-36');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A 便利贴到五段式抽屉柜">
        <SceneTag chapter="M1" tagline="规章手册：只印一本且当场套算" accent={theme.manual} />
        {/* FiveDrawers 已退役（p2-01..04 全部入 cue，无可见岛） */}
        <ArchifyRecap
          slug="sticky-notes-to-manual"
          caption="便利贴收拢成手册"
          cues={[
            {chapterId: 'first-mechanism', at: at('p2-01') - bA.from, durationInFrames: dur('p2-01')},
            {chapterId: 'scattered-notes', at: at('p2-02') - bA.from, durationInFrames: dur('p2-02')},
          ]}
        />
        {/* p2-02(scattered-notes)→p2-03 背靠背跨实例 → 补 lead={false} */}
        <ArchifyRecap
          slug="evolution-timeline"
          caption="三阶段演进"
          lead={false}
          cues={[
            {chapterId: 'stage-objects', at: at('p2-03') - bA.from, durationInFrames: dur('p2-03')},
          ]}
        />
        {/* declare 章锚「五段式分工」句（p2-04）；与上图 p2-03 背靠背 → lead={false} */}
        <ArchifyRecap
          slug="declaration-execution"
          caption="声明相 / 执行相"
          lead={false}
          cues={[
            {chapterId: 'declare', at: at('p2-04') - bA.from, durationInFrames: dur('p2-04')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="2-B 代码走廊① 注册校验门">
        {/* 代码走廊①+校验门装置已退役（p2-05..08 全部入 cue） */}
        <EvidenceBadge grade="lab" />
        {/* p2-04(declare)→p2-05 背靠背跨镜跨实例 → lead={false} */}
        <ArchifyRecap
          slug="definition-registration"
          caption="坏定义的注册生死簿"
          lead={false}
          cues={[
            {chapterId: 'strict-gate', at: at('p2-05') - bB.from, durationInFrames: dur('p2-05')},
            {chapterId: 'nonkey-rejected', at: at('p2-06') - bB.from, durationInFrames: dur('p2-06')},
            {chapterId: 'no-runtime-risk', at: at('p2-08') - bB.from, durationInFrames: dur('p2-08')},
          ]}
        />
        {/* p2-06(nonkey-rejected)→p2-07 背靠背跨实例 → 补 lead={false}；
            p2-08 是 definition-registration 空窗后重现，lead={false} 下直接切像 */}
        <ArchifyRecap
          slug="declaration-execution"
          caption="声明相 / 执行相"
          lead={false}
          cues={[
            {chapterId: 'gate', at: at('p2-07') - bB.from, durationInFrames: dur('p2-07')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="2-C 双保险锁">
        {/* DoubleLock 已退役（可见岛仅 p2-09 铺陈，断锁翻数 payoff 已由图接管）。
            p2-09 无 cue，recompute 首章无背靠背前驱 → 不传 lead */}
        <ArchifyRecap
          slug="declaration-execution"
          caption="口径单点 × 查询期重算"
          cues={[
            {chapterId: 'recompute', at: at('p2-09a') - bC.from, durationInFrames: dur('p2-09a')},
          ]}
        />
        {/* p2-09a(recompute)→p2-09b 背靠背跨实例 → lead={false} */}
        <ArchifyRecap
          slug="formula-vs-total"
          caption="手册是算式不是结论"
          lead={false}
          cues={[
            {chapterId: 'declare-execute-split', at: at('p2-09b') - bC.from, durationInFrames: dur('p2-09b')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="2-D 死数字 vs 临机现算">
        {/* 宽表对照卡已退役（p2-10/12/13 全 cue），本镜转图主控。
            p2-09b(declare-execute-split)→p2-10 背靠背跨镜跨实例（narration 无 p2-11）
            → lead={false}；p2-10→p2-12 实例内连续换章由 enters 自动抑制 */}
        <ArchifyRecap
          slug="on-demand-recompute"
          caption="临机现算按粒度翻凭证"
          lead={false}
          cues={[
            {chapterId: 'frozen-widetable', at: at('p2-10') - bD.from, durationInFrames: dur('p2-10')},
            {chapterId: 'formula-only', at: at('p2-12') - bD.from, durationInFrames: dur('p2-12')},
            {chapterId: 'grain-recompute', at: at('p2-13') - bD.from, durationInFrames: dur('p2-13')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="2-E 复印机陷阱">
        {/* 模式 b：副本逐张累积 + 爆红计数是跨句连续状态；可见岛仅 p2-14，
            窗=本镜全部 6 条 cue 窗。440/200 对撞卡已退役（p2-20 由 measured-440 图接管） */}
        <ArchifyYield
          cues={[
            {at: at('p2-15') - bE.from, durationInFrames: dur('p2-15')},
            {at: at('p2-16') - bE.from, durationInFrames: dur('p2-16')},
            {at: at('p2-17') - bE.from, durationInFrames: dur('p2-17')},
            {at: at('p2-18') - bE.from, durationInFrames: dur('p2-18')},
            {at: at('p2-19') - bE.from, durationInFrames: dur('p2-19')},
            {at: at('p2-20') - bE.from, durationInFrames: dur('p2-20')},
          ]}
        >
          <Stage>
            <CopierTrap at={at('p2-15') - bE.from} sumAt={at('p2-17') - bE.from} />
          </Stage>
        </ArchifyYield>
        <EvidenceBadge grade="lab" at={at('p2-20') - bE.from} />
        {/* p2-13(grain-recompute)→p2-14 空档 → event-fanout 首章 p2-15 无背靠背前驱，不传 lead */}
        <ArchifyRecap
          slug="event-fanout"
          caption="一笔订单的三次事件扇出"
          cues={[
            {chapterId: 'hundred-three', at: at('p2-15') - bE.from, durationInFrames: dur('p2-15')},
            {chapterId: 'join-disaster', at: at('p2-16') - bE.from, durationInFrames: dur('p2-16')},
          ]}
        />
        {/* p2-16(join-disaster)→p2-17 背靠背跨实例 → 补 lead={false}；
            p2-19 是本实例空窗后重现，lead={false} 下直接切像 */}
        <ArchifyRecap
          slug="fan-trap"
          caption="复印机陷阱"
          lead={false}
          cues={[
            {chapterId: 'copy-inflate', at: at('p2-17') - bE.from, durationInFrames: dur('p2-17')},
            {chapterId: 'aggregate-first', at: at('p2-19') - bE.from, durationInFrames: dur('p2-19')},
            {chapterId: 'measured-440', at: at('p2-20') - bE.from, durationInFrames: dur('p2-20')},
          ]}
        />
        {/* p2-17(copy-inflate)→p2-18 背靠背跨实例 → lead={false} */}
        <ArchifyRecap
          slug="calc-discipline-matrix"
          caption="计算纪律四条总纲"
          lead={false}
          cues={[
            {chapterId: 'agg-before-join', at: at('p2-18') - bE.from, durationInFrames: dur('p2-18')},
          ]}
        />
      </Sequence>

      <Sequence {...bF} name="2-F 去重安全与派生先聚后除">
        {/* 模式 b：集合圈对撞 + 天平倾斜是跨句连续状态；可见岛仅 p2-24，
            窗=本镜全部 5 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p2-21') - bF.from, durationInFrames: dur('p2-21')},
            {at: at('p2-22') - bF.from, durationInFrames: dur('p2-22')},
            {at: at('p2-23') - bF.from, durationInFrames: dur('p2-23')},
            {at: at('p2-25') - bF.from, durationInFrames: dur('p2-25')},
            {at: at('p2-26') - bF.from, durationInFrames: dur('p2-26')},
          ]}
        >
          <Stage>
            <NumberClash badLabel="不做去重安全" bad="6" goodLabel="按集合去重" good="3" at={at('p2-22') - bF.from} />
            <div style={{marginTop: 46}}>
              <AvgScale at={at('p2-24') - bF.from} />
            </div>
          </Stage>
        </ArchifyYield>
        {/* p2-20(measured-440)→p2-21 背靠背跨镜跨实例 → lead={false}；
            p2-23 是本实例空窗后重现，lead={false} 下直接切像 */}
        <ArchifyRecap
          slug="calc-discipline-matrix"
          caption="计算纪律四条总纲"
          lead={false}
          cues={[
            {chapterId: 'dedup-count', at: at('p2-21') - bF.from, durationInFrames: dur('p2-21')},
            {chapterId: 'divide-after-agg', at: at('p2-23') - bF.from, durationInFrames: dur('p2-23')},
          ]}
        />
        {/* p2-21(dedup-count)→p2-22 背靠背跨实例 → 补 lead={false} */}
        <ArchifyRecap
          slug="dedup-safety"
          caption="去重安全"
          lead={false}
          cues={[
            {chapterId: 'set-vs-rows', at: at('p2-22') - bF.from, durationInFrames: dur('p2-22')},
          ]}
        />
        {/* p2-23 后隔 p2-24 可见岛 → mean-of-means 首章 p2-25 无背靠背前驱，不传 lead */}
        <ArchifyRecap
          slug="mean-of-means"
          caption="平均的平均"
          cues={[
            {chapterId: 'wrong-avg-of-avg', at: at('p2-25') - bF.from, durationInFrames: dur('p2-25')},
            {chapterId: 'measured-122-108', at: at('p2-26') - bF.from, durationInFrames: dur('p2-26')},
          ]}
        />
      </Sequence>

      <Sequence {...bG} name="2-G 半可加末快照与关系消歧">
        {/* 模式 b：天数条逐根点亮/对撞常驻是跨句连续状态；可见岛仅 p2-29，
            窗=本镜全部 4 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p2-27') - bG.from, durationInFrames: dur('p2-27')},
            {at: at('p2-28') - bG.from, durationInFrames: dur('p2-28')},
            {at: at('p2-30') - bG.from, durationInFrames: dur('p2-30')},
            {at: at('p2-31') - bG.from, durationInFrames: dur('p2-31')},
          ]}
        >
          <Stage>
            <LastSnapshot at={at('p2-28') - bG.from} clashAt={at('p2-30') - bG.from} />
            <Panel
              accent={theme.engine}
              style={{marginTop: 26, padding: '18px 26px', width: 1020}}
            >
              <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>
                买家 / 推荐人双路径 → 必须显式声明走哪一条（USING 消歧）
              </span>
            </Panel>
          </Stage>
        </ArchifyYield>
        {/* p2-26(measured-122-108)→p2-27 背靠背跨镜跨实例 → lead={false} */}
        <ArchifyRecap
          slug="calc-discipline-matrix"
          caption="计算纪律四条总纲"
          lead={false}
          cues={[
            {chapterId: 'semi-additive', at: at('p2-27') - bG.from, durationInFrames: dur('p2-27')},
          ]}
        />
        {/* p2-27(calc-discipline)→p2-28 背靠背跨实例 → 补 lead={false}；
            p2-30 是本实例空窗后重现，lead={false} 下直接切像 */}
        <ArchifyRecap
          slug="last-snapshot-gate"
          caption="末快照"
          lead={false}
          cues={[
            {chapterId: 'semi-additive', at: at('p2-28') - bG.from, durationInFrames: dur('p2-28')},
            {chapterId: 'snapshot-vs-sum', at: at('p2-30') - bG.from, durationInFrames: dur('p2-30')},
          ]}
        />
        {/* p2-30→p2-31 背靠背（既有 lead={false} 保持） */}
        <ArchifyRecap
          slug="dual-path-disambiguation"
          caption="关系消歧"
          lead={false}
          cues={[
            {chapterId: 'two-paths', at: at('p2-31') - bG.from, durationInFrames: dur('p2-31')},
          ]}
        />
      </Sequence>

      <Sequence {...bH} name="2-H 题眼金句与手册徽章">
        {/* QuoteCard 已退役（p2-32..36 全 cue，无可见岛），本镜转图主控 */}
        <PillarHUD lit={1} at={at('p2-36') - bH.from} />
        {/* p2-31(two-paths)→p2-32 背靠背跨镜跨实例 → 补 lead={false}（既有 adjacency，本次补齐） */}
        <ArchifyRecap
          slug="valid-sql-wrong-answer"
          caption="语法 × 业务"
          lead={false}
          cues={[
            {chapterId: 'syntax-pass', at: at('p2-32') - bH.from, durationInFrames: dur('p2-32')},
            {chapterId: 'business-fail', at: at('p2-33') - bH.from, durationInFrames: dur('p2-33')},
          ]}
        />
        {/* p2-33(business-fail)→p2-34 背靠背跨实例 → lead={false} */}
        <ArchifyRecap
          slug="multi-entry-single-truth"
          caption="多入口一个正确答案"
          lead={false}
          cues={[
            {chapterId: 'single-point-bind', at: at('p2-34') - bH.from, durationInFrames: dur('p2-34')},
            {chapterId: 'whoever-asks', at: at('p2-35') - bH.from, durationInFrames: dur('p2-35')},
          ]}
        />
        {/* p2-35(whoever-asks)→p2-36 背靠背跨实例 → lead={false} */}
        <ArchifyRecap
          slug="seal-off-caliber"
          caption="第一道防线按死两病灶"
          lead={false}
          cues={[
            {chapterId: 'sealed-off', at: at('p2-36') - bH.from, durationInFrames: dur('p2-36')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
