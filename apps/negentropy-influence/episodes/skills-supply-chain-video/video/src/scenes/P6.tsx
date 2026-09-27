/** P6 三张欠条的对账（p6-01..10）——盖章对账（对账路线图逐章回放，与开场三张
 *  欠条闭环）→ 信号灯面板（合并/解冻/首验签三盏待决灯 + 包管理器战例两枚勋章
 *  + 强制力对照条）→ 裸运收尾（港口全景横移、海关大楼第一盏灯反转帧、下期卡
 *  与信源卡、末 beat 渐黑）。
 *  色板：concept 关税橙=海关面/强制力闸门/裸运攻击面；conceptDeep 检疫绿=
 *  既成验证基建（不可变仓库 / 无密钥签名）；deny 警示金=待决悬案（三信号 /
 *  提案队列 / 下期）。danger/ok 本幕不用——「第一盏红灯」按色板落 concept
 *  海关橙（灯属海关信号，非攻击命中瞬间）。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useBreathe,
  useDraw,
  useFadeOut,
  useImpulse,
  useProgress,
  useSpring,
  useStagger,
} from '../motion';
import {CargoBox, Footnote, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

/** 0..1 → 两位十六进制透明度（概念色叠加层的统一算子）。 */
const a2 = (v: number): string =>
  Math.round(Math.min(1, Math.max(0, v)) * 255)
    .toString(16)
    .padStart(2, '0');

/** 6-B 信号灯面板：p6-06 三个分句各点亮一盏待决灯（合并/解冻/首验签），点亮即
 *  停驻〔M-003〕；p6-07 包管理器战例两枚勋章弹簧压入（那次=不可变仓库 /
 *  这次=无密钥签名+透明日志，conceptDeep=既成验证面）；p6-08 差别条：他们长出
 *  了带强制力的中心设施（concept 实线闸门），这里的答案还压在提案队列
 *  （deny 虚线悬案），中缝分隔线＝「差别只有一个」。 */
const SignalBoard: React.FC<{
  at6: number;
  win6: number;
  at7: number;
  win7: number;
  at8: number;
  win8: number;
}> = ({at6, win6, at7, win7, at8, win8}) => {
  const frame = useCurrentFrame();
  const head = useProgress(at6, DUR.f5);
  // 信号灯：fit 进 p6-06 句窗前 72%（三盏随三个分句依次亮，亮后不熄）
  const lamps = useStagger(3, {
    at: at6 + DUR.f3,
    dur: DUR.f4,
    fit: {total: Math.max(30, Math.round(win6 * 0.72))},
  });
  const lampGlow = useBreathe({period: 56, amp: 0.18, base: 0.82});
  // 勋章：p6-07「那次 / 这次」两枚战例压入（snap 轻过冲＝荣誉感）
  const medalAt1 = at7 + Math.round(win7 * 0.3);
  const medalAt2 = at7 + Math.round(win7 * 0.72);
  const medalHead = useProgress(at7, DUR.f4);
  const m1 = useSpring('snap', {at: medalAt1, dur: DUR.f5});
  const m2 = useSpring('snap', {at: medalAt2, dur: DUR.f5});
  const medalGlow = useBreathe({period: 50, amp: 0.25, base: 0.75});
  // 差别条：p6-08 左右对照先后入场 + 中缝描线
  const sideL = useProgress(at8 + DUR.f2, DUR.f5);
  const sideR = useProgress(at8 + Math.round(win8 * 0.55), DUR.f5);
  const seam = useDraw(at8 + Math.round(win8 * 0.3), DUR.f5);
  const lampDefs = [
    {k: '合并', sub: '停摆提案'},
    {k: '解冻', sub: '排队方案'},
    {k: '首验签', sub: '客户端'},
  ];
  const medalDefs = [
    {tag: '那次', k: '不可变仓库', sub: 'registry', at: medalAt1, s: m1},
    {tag: '这次', k: '无密钥签名', sub: '透明日志', at: medalAt2, s: m2},
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 18, opacity: head}}>
        <span style={{fontFamily: theme.serif, fontSize: 36, color: theme.deny, letterSpacing: 3}}>
          三个信号
        </span>
        <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'盯 · 等 · 验'}</span>
      </div>
      <Panel accent={theme.deny} style={{padding: '20px 44px', display: 'flex', gap: 70, opacity: head}}>
        {lampDefs.map((d, i) => {
          const p = lamps[i];
          return (
            <div
              key={d.k}
              style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}
            >
              <div
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: 46,
                  border: `3px solid ${theme.deny}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.3 + 0.7 * p,
                  boxShadow: `0 0 ${Math.round(8 + 30 * p * lampGlow)}px ${
                    theme.deny
                  }${a2(0.3 + 0.5 * p)}`,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    background: theme.deny,
                    opacity: 0.9 * p,
                  }}
                />
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>
                {d.k}
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{d.sub}</div>
            </div>
          );
        })}
      </Panel>
      <div style={{display: 'flex', gap: 130, opacity: medalHead}}>
        {medalDefs.map((m) => {
          // 铁律①：map 内纯函数派生（effects=progress 缓动，空间=弹簧）
          const op = progress(frame, m.at, DUR.f4);
          return (
            <div
              key={m.tag}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                opacity: op * medalHead,
                transform: `translateY(${(1 - m.s) * 26}px) scale(${0.6 + 0.4 * m.s})`,
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 38,
                  background: `${theme.conceptDeep}CC`,
                  clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 76%, 0 100%)',
                }}
              />
              <div
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: 70,
                  border: `3.5px solid ${theme.conceptDeep}`,
                  background: `${theme.conceptDeep}12`,
                  boxShadow: `0 0 ${Math.round(20 * op * medalGlow)}px ${theme.conceptDeep}55`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <div style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>
                  {m.k}
                </div>
                <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{m.sub}</div>
              </div>
              <div
                style={{
                  padding: '3px 14px',
                  borderRadius: 999,
                  border: `1.5px solid ${theme.deny}88`,
                  fontFamily: theme.mono,
                  fontSize: 16,
                  color: theme.deny,
                }}
              >
                {m.tag}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display: 'flex', alignItems: 'stretch', gap: 30}}>
        <div style={{opacity: sideL, transform: `translateY(${(1 - sideL) * 14}px)`}}>
          <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginBottom: 6}}>
            他们
          </div>
          <Panel
            accent={theme.concept}
            style={{
              width: 520,
              padding: '16px 22px',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>
              中心设施
            </span>
            <span
              style={{
                padding: '4px 14px',
                borderRadius: 999,
                border: `2px solid ${theme.concept}`,
                fontFamily: theme.mono,
                fontSize: 18,
                color: theme.concept,
              }}
            >
              强制力
            </span>
          </Panel>
        </div>
        <svg width={4} height={150} viewBox="0 0 4 150" style={{marginTop: 28}}>
          <line
            x1={2}
            y1={4}
            x2={2}
            y2={146}
            stroke={theme.dim}
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.7}
            {...seam}
          />
        </svg>
        <div style={{opacity: sideR, transform: `translateY(${(1 - sideR) * 14}px)`}}>
          <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginBottom: 6}}>
            这里
          </div>
          <div
            style={{
              width: 520,
              padding: '16px 22px',
              borderRadius: 14,
              border: `2.5px dashed ${theme.deny}`,
              background: `${theme.deny}0F`,
              display: 'flex',
              alignItems: 'center',
              gap: 18,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>
              提案队列
            </span>
            <span
              style={{
                padding: '4px 14px',
                borderRadius: 999,
                border: `2px solid ${theme.deny}`,
                fontFamily: theme.mono,
                fontSize: 18,
                color: theme.deny,
              }}
            >
              排队中
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/** 全景箱位（模块级纯常量）：远排在后（贴远岸线）、近排在前（贴码头线），
 *  横移 480px——每箱铅封位虚线空置＝裸运，流向恒定向右（堆场→泊位）。 */
const FAR_XS = Array.from({length: 11}, (_, i) => -700 + i * 235);
const NEAR_XS = Array.from({length: 11}, (_, i) => -590 + i * 235);

/** 无铅封箱：M-001 同形箱体 + 橙描边虚线铅封槽（缺席本身是画面语义）。 */
const SeallessBox: React.FC<{x: number; y: number; scale?: number}> = ({x, y, scale = 1}) => (
  <div
    style={{position: 'absolute', left: x, top: y, transformOrigin: 'top left', transform: `scale(${scale})`}}
  >
    <CargoBox width={132} height={90} />
    <div
      style={{
        position: 'absolute',
        right: 10,
        top: -13,
        width: 18,
        height: 18,
        borderRadius: 4,
        border: `2px dashed ${theme.concept}`,
        opacity: 0.55,
      }}
    />
  </div>
);

/** 信源卡五钉（与 storyboard 收尾行一致）。 */
const SRC_LINES = [
  '信源 · agentskills @ 69ef37e9',
  'ext-skills @ b0b3272f',
  'cloudflare-rfc @ 1bd11679',
  '本仓精读 220 · 221',
  'lab3 实测',
];

/** 6-C 裸运收尾：p6-09 港口全景横移（46 家进出、铅封位全空置）；p6-10 海关
 *  大楼第一盏灯亮起（impulse 闪现 + 停驻辉光的反转帧），下期卡（不写题名，
 *  只放信号关键词）与信源卡入场，全景同时上移让位。渐黑由 FadeVeil 承担。 */
const HarborClose: React.FC<{at9: number; win9: number; at10: number; win10: number}> = ({
  at9,
  win9,
  at10,
  win10,
}) => {
  // 全景横移：贯穿 p6-09 与 p6-10 前段（港口「还在营业」的持续感）
  const drift = useProgress(at9, win9 + Math.round(win10 * 0.55), 'linear');
  const tag46 = useProgress(at9 + DUR.f2, DUR.f4);
  // 「裸运」印章：p6-09 尾段盖下定格〔M-003〕
  const stampAt = at9 + Math.round(win9 * 0.6);
  const stampVis = useProgress(stampAt, DUR.f4);
  const stampIn = useSpring('snap', {at: stampAt, dur: DUR.f5});
  // 第一盏灯（反转帧）：闪现 + 常亮辉光
  const flash = useImpulse({at: at10, dur: DUR.f5, peak: 1});
  const lit = useProgress(at10, DUR.f4);
  const lampGlow = useBreathe({period: 64, amp: 0.2, base: 0.8});
  // 下期卡 + 信源卡：p6-10 中段起，全景弹簧上移让位
  const cardAt = at10 + DUR.f6;
  const rise = useSpring('settle', {at: cardAt, dur: DUR.f6});
  const nextVis = useProgress(cardAt, DUR.f4);
  const chips = useStagger(3, {at: cardAt + DUR.f3, dur: DUR.f3, stride: 4});
  const srcs = useStagger(5, {at: at10 + Math.round(win10 * 0.45), dur: DUR.f3, stride: 4});
  const beacon = Math.max(flash, lit * lampGlow);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14}}>
      <div
        style={{
          position: 'relative',
          width: 1800,
          height: 400,
          overflow: 'hidden',
          transform: `translateY(${(1 - rise) * 74}px)`,
        }}
      >
        {/* 远岸线 + 远排箱（先渲染：可被大楼遮挡） */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 190,
            borderTop: `2px solid ${theme.panelBorder}`,
            opacity: 0.6,
          }}
        />
        {FAR_XS.map((x) => (
          <SeallessBox key={`f${x}`} x={x + drift * 480} y={118} scale={0.78} />
        ))}
        {/* 海关大楼：空置 → p6-10 第一盏灯亮（concept 海关橙） */}
        <div style={{position: 'absolute', left: 1180, top: 62, width: 300, height: 130}}>
          <div
            style={{
              position: 'absolute',
              left: 147,
              top: -36,
              width: 3,
              height: 22,
              background: `${theme.concept}99`,
              opacity: lit,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 138,
              top: -50,
              width: 20,
              height: 20,
              borderRadius: 10,
              border: `2.5px solid ${theme.concept}`,
              background: `${theme.concept}${a2(beacon)}`,
              boxShadow: `0 0 ${Math.round(10 + 30 * beacon)}px ${theme.concept}`,
              opacity: Math.max(flash, lit),
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 170,
              top: -48,
              fontFamily: theme.mono,
              fontSize: 15,
              color: theme.concept,
              opacity: lit,
            }}
          >
            第一盏
          </div>
          <div
            style={{
              position: 'absolute',
              left: -10,
              right: -10,
              top: -16,
              height: 16,
              borderRadius: 4,
              background: `${theme.concept}30`,
              border: `2.5px solid ${theme.concept}`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 8,
              border: `2.5px solid ${theme.concept}99`,
              background: '#0B0E13',
            }}
          />
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            // 铁律①：map 内纯函数派生（窗位与亮度的帧数学）
            const col = idx % 3;
            const row = Math.floor(idx / 3);
            const isLit = idx === 0;
            return (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  left: 34 + col * 86,
                  top: 24 + row * 44,
                  width: 56,
                  height: 32,
                  borderRadius: 5,
                  border: `2.5px solid ${isLit ? theme.concept : theme.panelBorder}`,
                  background: isLit ? `${theme.concept}${a2(0.2 + 0.6 * beacon)}` : theme.panel,
                  boxShadow: isLit ? `0 0 ${Math.round(8 + 26 * beacon)}px ${theme.concept}` : 'none',
                  opacity: isLit ? 0.35 + 0.65 * Math.max(lit, flash) : 0.85,
                }}
              />
            );
          })}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 1180,
            top: 198,
            width: 300,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.dim,
            opacity: tag46,
          }}
        >
          海关
        </div>
        {/* 码头线 + 近排箱（贴线而行，径直向右过港不停） */}
        <div
          style={{position: 'absolute', left: 0, right: 0, top: 328, borderTop: `2px solid ${theme.panelBorder}`}}
        />
        {NEAR_XS.map((x) => (
          <SeallessBox key={`n${x}`} x={x + drift * 480} y={236} />
        ))}
        <div
          style={{
            position: 'absolute',
            right: 12,
            top: 318,
            width: 0,
            height: 0,
            borderTop: '9px solid transparent',
            borderBottom: '9px solid transparent',
            borderLeft: `14px solid ${theme.panelBorder}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 8,
            top: 4,
            fontFamily: theme.mono,
            fontSize: 22,
            color: theme.dim,
            opacity: tag46,
          }}
        >
          {'46 家 · 进出'}
        </div>
        {/* 「裸运」印章：盖在近排箱流上（bg 压底保可读） */}
        <div
          style={{
            position: 'absolute',
            right: 90,
            top: 200,
            padding: '8px 26px',
            borderRadius: 8,
            border: `3px dashed ${theme.concept}`,
            background: '#0E1116E6',
            fontFamily: theme.serif,
            fontSize: 44,
            color: theme.concept,
            letterSpacing: 8,
            opacity: stampVis,
            transform: `rotate(-6deg) scale(${0.7 + 0.3 * stampIn})`,
          }}
        >
          裸运
        </div>
      </div>
      {/* 下期卡 + 信源卡（p6-10 中段起） */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 46,
          opacity: nextVis,
          transform: `translateY(${(1 - rise) * -20}px)`,
        }}
      >
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
          <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.deny, letterSpacing: 6}}>
            下期
          </div>
          <div
            style={{
              width: 760,
              minHeight: 96,
              borderRadius: 12,
              border: `2.5px dashed ${theme.deny}88`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 18,
            }}
          >
            {['四家客户端', '谁先跑通', '活清单 ≠ 快照'].map((c, i) => (
              <span
                key={c}
                style={{
                  padding: '6px 16px',
                  borderRadius: 999,
                  border: `2px solid ${theme.deny}77`,
                  fontFamily: theme.sans,
                  fontSize: 23,
                  color: theme.text,
                  opacity: chips[i],
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
            paddingLeft: 30,
            borderLeft: `2px solid ${theme.panelBorder}`,
            alignItems: 'flex-start',
          }}
        >
          {SRC_LINES.map((s, i) => (
            <div
              key={s}
              style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, opacity: srcs[i] * 0.95}}
            >
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** 末帧渐黑：窗口从末 beat（整个 6-C）总时长推导（红线四：beat 时长而非末句
 *  时长，防收尾长黑屏），盖住幕内全部图层（含 SceneTag 与信源残帧）。 */
const FadeVeil: React.FC<{beatFrames: number}> = ({beatFrames}) => {
  const out = useFadeOut(beatFrames, {frames: 90});
  return <AbsoluteFill style={{background: theme.bg, opacity: 1 - out}} />;
};

export const P6: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p6-01', 'p6-05');
  const bB = w('p6-06', 'p6-08');
  const bC = w('p6-09', 'p6-10');
  return (
    <AbsoluteFill>
      {/* 6-A 盖章对账：句句对账路线图逐章回放（回放期间装置全屏让位）；
          P5 末句非 cue（5-C 收尾为装置句），本镜首个回放不挂 lead={false} */}
      <Sequence {...bA} name="6-A 盖章对账">
        <SceneTag chapter="P6" tagline="三张欠条的对账" accent={theme.concept} />
        <ArchifyRecap
          slug="ious-route"
          caption="三张欠条 · 对账"
          cues={[
            {chapterId: 'ir-sign', at: at('p6-01') - bA.from, durationInFrames: dur('p6-01')},
            {chapterId: 'ir-stack', at: at('p6-02') - bA.from, durationInFrames: dur('p6-02')},
            {chapterId: 'ir-dist', at: at('p6-03') - bA.from, durationInFrames: dur('p6-03')},
            {chapterId: 'ir-404', at: at('p6-04') - bA.from, durationInFrames: dur('p6-04')},
            {chapterId: 'ir-vers', at: at('p6-05') - bA.from, durationInFrames: dur('p6-05')},
          ]}
        />
        <Footnote delay={at('p6-01') - bA.from}>{'三张欠条 · 逐张对账'}</Footnote>
      </Sequence>

      {/* 6-B 信号灯面板：本镜无 cue 句（空窗列表＝装置独占全程） */}
      <Sequence {...bB} name="6-B 信号灯面板">
        <SceneTag chapter="P6" tagline="三张欠条的对账" accent={theme.concept} />
        <ArchifyYield cues={[]}>
          <SignalBoard
            at6={at('p6-06') - bB.from}
            win6={dur('p6-06')}
            at7={at('p6-07') - bB.from}
            win7={dur('p6-07')}
            at8={at('p6-08') - bB.from}
            win8={dur('p6-08')}
          />
        </ArchifyYield>
      </Sequence>

      {/* 6-C 裸运收尾：本镜无 cue 句；末 beat 渐黑盖全幕 */}
      <Sequence {...bC} name="6-C 裸运收尾">
        <SceneTag chapter="P6" tagline="三张欠条的对账" accent={theme.concept} />
        <ArchifyYield cues={[]}>
          <HarborClose
            at9={at('p6-09') - bC.from}
            win9={dur('p6-09')}
            at10={at('p6-10') - bC.from}
            win10={dur('p6-10')}
          />
        </ArchifyYield>
        <FadeVeil beatFrames={bC.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};
