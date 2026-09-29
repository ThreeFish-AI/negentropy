/** P2 叫号器 · 官方同构与诚实注半场（p2-13..23，2 镜 0 cue）——分镜 2-C…2-D。
 *
 *  ★ 本文件为 P2 幕的另一半场，由 P2Notify 组装层并列挂载（同一 scene 句窗）；
 *    HarnessBadge / SceneTag 归幕首开镜侧，本文件不重挂（chip 半透明，重挂会加深）。
 *  ★ 2D 定制剧场段（无适配图例，storyboard 自检对账：p2-13..p3-01 无锚 run 贴上限）：
 *    2-C 左「给模型」（三态徽标＋长调用原路返回）／右「给人」（桌面通知＋门铃）；
 *    2-D 「动机 ≠ 成绩单」分栏卡＋零量化账本翻页＋压短对句定格〔M-003〕。
 *  ★ 画面文字只放关键词/标签（RSI-007：字幕已烧录同句，禁逐字复述口播）。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel} from '../components/motifs';
import {DUR, clamp01, useEnter, useFlowDash, useImpulse, useProgress, useStagger} from '../motion';

/** hex + 帧驱动透明度（无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 2-C 官方同构（p2-13..19） ────────────────────────────────────────────

const STATES = ['完成', '失败', '停止'] as const;

const OfficialIsomorph: React.FC<{
  atHead: number;
  atStates: number;
  atLong: number;
  atHuman: number;
  atPush: number;
  atCouplet: number;
  atTail: number;
}> = ({atHead, atStates, atLong, atHuman, atPush, atCouplet, atTail}) => {
  const head = useEnter('fade', {at: atHead, dur: DUR.f5});
  const left = useEnter('slideL', {at: atHead + DUR.f4, dur: DUR.f5, dist: 40});
  // 三态徽标依次点亮（p2-14）
  const badges = useStagger(STATES.length, {at: atStates + DUR.f5, stride: 12, dur: DUR.f4});
  // 长调用后台化：外部长调用 → 后台 → 结果原路返回（p2-15，流光）
  const longIn = useProgress(atLong, DUR.f5);
  const flow = useFlowDash({dash: 12, gap: 12, period: 30});
  const back = useProgress(atLong + DUR.f6, DUR.f5);
  // 给人通路（p2-16 右栏入场；p2-17 桌面通知弹出＋门铃 ok 一闪）
  const right = useEnter('slideR', {at: atHuman, dur: DUR.f5, dist: 40});
  const toast = useEnter('pop', {at: atPush, dur: DUR.f4});
  const bell = useImpulse({at: atPush + DUR.f4, dur: DUR.f5, peak: 1});
  // 对句题词（p2-18 记忆点定格）与收束小字（p2-19）
  const couplet = useEnter('rise', {at: atCouplet, dur: DUR.f5, restBottom: 780});
  const tail = useProgress(atTail, DUR.f4);

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 150, width: 1920, textAlign: 'center', ...head}}>
        <span style={{fontFamily: theme.serif, fontSize: 46, fontWeight: 700, color: theme.text}}>{'官方 · 同构'}</span>
      </div>

      {/* 左栏：给模型（小票——三态＋原路返回） */}
      <div style={{position: 'absolute', left: 240, top: 250, ...left}}>
        <Panel accent={theme.mech} style={{width: 680, height: 420, boxSizing: 'border-box', padding: '24px 30px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.mech}}>{'给模型 · 小票'}</div>
          <div style={{display: 'flex', gap: 22, marginTop: 22}}>
            {STATES.map((s, i) => (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: 64,
                  borderRadius: 999,
                  border: `3px solid ${badges[i] > 0.5 ? theme.mech : theme.panelBorder}`,
                  background: withAlpha(theme.mechDeep, 0.28 * badges[i]),
                  boxShadow: badges[i] > 0.5 ? `0 0 ${16 * badges[i]}px ${withAlpha(theme.mech, 0.6)}` : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.sans,
                  fontSize: 28,
                  fontWeight: 600,
                  color: badges[i] > 0.5 ? theme.text : theme.dim,
                  opacity: 0.4 + 0.6 * badges[i],
                }}
              >
                {s}
              </div>
            ))}
          </div>
          {/* 长调用后台化小图：外部 → 后台 → 原路回来 */}
          <svg width={620} height={220} style={{position: 'absolute', left: 30, top: 170, opacity: longIn}}>
            <rect x={0} y={70} width={150} height={64} rx={10} fill="none" stroke={theme.dim} strokeWidth={3} />
            <text x={75} y={110} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fill={theme.dim}>
              {'外部长调用'}
            </text>
            <rect x={235} y={70} width={150} height={64} rx={10} fill="none" stroke={theme.mech} strokeWidth={3} />
            <text x={310} y={110} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fill={theme.mech}>
              {'后台'}
            </text>
            <rect x={470} y={70} width={150} height={64} rx={10} fill="none" stroke={theme.core} strokeWidth={3} />
            <text x={545} y={110} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fill={theme.core}>
              {'主循环'}
            </text>
            <path d="M150 102 L235 102" stroke={theme.dim} strokeWidth={3} />
            {/* 真实结果原路返回：流光弧线（结果走同一条通知路） */}
            <path d="M385 90 C 420 30, 440 30, 470 90" fill="none" stroke={theme.mech} strokeWidth={4} opacity={back} {...flow} />
            <path d="M458 80 L472 94 L476 74" fill="none" stroke={theme.mech} strokeWidth={4} opacity={back} />
            <text x={430} y={186} textAnchor="middle" fontFamily={theme.sans} fontSize={20} fill={theme.dim} opacity={back}>
              {'真实结果 · 同一条路'}
            </text>
          </svg>
        </Panel>
      </div>

      {/* 右栏：给人（门铃——桌面通知） */}
      <div style={{position: 'absolute', left: 1000, top: 250, ...right}}>
        <Panel accent={theme.accent} style={{width: 680, height: 420, boxSizing: 'border-box', padding: '24px 30px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.accent}}>{'给人 · 门铃'}</div>
          {/* 桌面屏幕剪影 */}
          <div
            style={{
              position: 'absolute',
              left: 70,
              top: 90,
              width: 540,
              height: 270,
              borderRadius: 12,
              border: `3px solid ${theme.panelBorder}`,
            }}
          />
          {/* 桌面通知弹出（右上角 toast） */}
          <div style={{position: 'absolute', left: 300, top: 116, opacity: toast.opacity, transform: toast.transform}}>
            <Panel accent={theme.ok} style={{width: 280, padding: '12px 18px'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: theme.ok,
                    boxShadow: `0 0 ${18 * bell}px ${withAlpha(theme.ok, 0.8)}`,
                    display: 'inline-block',
                  }}
                />
                <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{'任务完成'}</span>
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 6}}>{'bg_0001'}</div>
            </Panel>
          </div>
          {/* 门铃一声：同心弧外扩（ok 瞬态） */}
          <svg width={200} height={160} style={{position: 'absolute', left: 110, top: 170, opacity: toast.opacity}}>
            <path d="M40 110 Q40 50 80 44 Q120 50 120 110 Z" fill="none" stroke={theme.accent} strokeWidth={4} />
            <circle cx={80} cy={120} r={8} fill={theme.accent} />
            <path d="M136 60 Q150 80 136 100" fill="none" stroke={theme.ok} strokeWidth={4} opacity={bell} />
            <path d="M152 48 Q174 80 152 112" fill="none" stroke={theme.ok} strokeWidth={4} opacity={bell * 0.7} />
          </svg>
        </Panel>
      </div>

      {/* p2-18 对句题词（压短形态定格）＋ p2-19 收束小字 */}
      <div style={{position: 'absolute', left: 0, top: 706, width: 1920, textAlign: 'center', ...couplet}}>
        <span style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.text}}>{'给模型小票 · 给人门铃'}</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 780,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.dim,
          opacity: tail,
        }}
      >
        {'完成 · 独立事件'}
      </div>

      <Footnote delay={atStates}>{'TaskNotificationMessage · PushNotification'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-D 诚实注（p2-20..23） ──────────────────────────────────────────────

/** 账本目录行：只有目录线、没有数字行（零量化记录的具象） */
const LEDGER_ROWS = ['后台省下', '等待时长', '计费差额'] as const;

const HonestNote: React.FC<{atHead: number; atSplit: number; atLedger: number; atCouplet: number}> = ({
  atHead,
  atSplit,
  atLedger,
  atCouplet,
}) => {
  const head = useEnter('fade', {at: atHead, dur: DUR.f5});
  // 「动机 ≠ 成绩单」分栏卡对开（p2-21）
  const eL = useEnter('slideL', {at: atSplit, dur: DUR.f5, dist: 60});
  const eR = useEnter('slideR', {at: atSplit, dur: DUR.f5, dist: 60});
  const neq = useProgress(atSplit + DUR.f5, DUR.f4);
  // 空白页翻页（p2-22）：右页 rotateY 翻过，露出同样空白的下一页
  const book = useProgress(atLedger, DUR.f4);
  const flip = useProgress(atLedger + DUR.f5, DUR.f6);
  // 压短对句定格（p2-23 记忆点〔M-003〕）
  const couplet = useEnter('rise', {at: atCouplet, dur: DUR.f5, restBottom: 800});

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 150, width: 1920, textAlign: 'center', ...head}}>
        <span style={{fontFamily: theme.serif, fontSize: 46, fontWeight: 700, color: theme.dim}}>{'诚实注'}</span>
      </div>

      {/* 分栏卡：动机（有）≠ 成绩单（空白） */}
      <div style={{position: 'absolute', left: 0, top: 246, width: 1920, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 30}}>
        <div style={{...eL}}>
          <Panel accent={theme.accent} style={{width: 520, height: 150, boxSizing: 'border-box', padding: '24px 30px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.accent}}>{'动机'}</div>
            <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.text}}>{'空转烧钱'}</div>
          </Panel>
        </div>
        <span style={{fontFamily: theme.sans, fontSize: 44, color: theme.deny, opacity: neq}}>{'≠'}</span>
        <div style={{...eR}}>
          <Panel accent={theme.panelBorder} style={{width: 520, height: 150, boxSizing: 'border-box', padding: '24px 30px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim}}>{'成绩单'}</div>
            <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.dim}}>{'空白'}</div>
          </Panel>
        </div>
      </div>

      {/* 零量化账本：左页目录线＋右页翻过（数字栏恒空） */}
      <div style={{position: 'absolute', left: 660, top: 440, width: 600, height: 230, opacity: book, perspective: 1200}}>
        <div style={{display: 'flex', height: '100%'}}>
          <div
            style={{
              flex: 1,
              background: theme.panel,
              border: `2px solid ${theme.panelBorder}`,
              borderRadius: '10px 0 0 10px',
              padding: '22px 24px',
              boxSizing: 'border-box',
            }}
          >
            {LEDGER_ROWS.map((r) => (
              <div key={r} style={{display: 'flex', alignItems: 'center', height: 58, borderBottom: `1px solid ${theme.panelBorder}`}}>
                <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{r}</span>
                <span style={{marginLeft: 'auto', fontFamily: theme.mono, fontSize: 22, color: withAlpha(theme.dim, 0.5)}}>{'—'}</span>
              </div>
            ))}
          </div>
          <div style={{flex: 1, position: 'relative'}}>
            {/* 下一页（同样空白） */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: theme.panel,
                border: `2px solid ${theme.panelBorder}`,
                borderRadius: '0 10px 10px 0',
              }}
            >
              <div style={{position: 'absolute', left: 0, right: 0, top: 96, textAlign: 'center', fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>
                {'0 笔记录'}
              </div>
            </div>
            {/* 翻动页：以书脊为轴翻过 */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: theme.panel,
                border: `2px solid ${theme.panelBorder}`,
                borderRadius: '0 10px 10px 0',
                transformOrigin: '0% 50%',
                transform: `rotateY(${-180 * flip}deg)`,
                backfaceVisibility: 'hidden',
              }}
            >
              {[0, 1, 2].map((i) => (
                <div key={i} style={{height: 2, margin: '56px 24px 0', background: withAlpha(theme.dim, 0.22)}} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* p2-23 压短对句定格 */}
      <div style={{position: 'absolute', left: 0, top: 716, width: 1920, textAlign: 'center', ...couplet}}>
        <span style={{fontFamily: theme.serif, fontSize: 46, fontWeight: 700, color: theme.text}}>{'不必干等 · 不是更便宜'}</span>
      </div>

      <Footnote delay={atSplit}>{'token billing'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 半场组装（由 P2Notify 挂载） ─────────────────────────────────────────

export const P2Official: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;

  const bC = w('p2-13', 'p2-19');
  const bD = w('p2-20', 'p2-23');

  return (
    <>
      <Sequence {...bC} name="2-C 官方同构">
        <OfficialIsomorph
          atHead={2}
          atStates={at('p2-14') - bC.from}
          atLong={at('p2-15') - bC.from}
          atHuman={at('p2-16') - bC.from}
          atPush={at('p2-17') - bC.from}
          atCouplet={at('p2-18') - bC.from}
          atTail={at('p2-19') - bC.from}
        />
      </Sequence>

      <Sequence {...bD} name="2-D 诚实注">
        <HonestNote
          atHead={2}
          atSplit={at('p2-21') - bD.from}
          atLedger={at('p2-22') - bD.from}
          atCouplet={at('p2-23') - bD.from}
        />
      </Sequence>
    </>
  );
};

export default P2Official;
