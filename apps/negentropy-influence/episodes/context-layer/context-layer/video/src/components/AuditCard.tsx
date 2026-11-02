/** 8-L2 三步审计装置（AuditCard）：把 p8-28b..g 的「对账方法能带走」画成可复用的
 *  三步卡——对一张宣称做审计的固定动作序列。
 *
 *  ① 宣言气泡（p8-28b）落进登记簿：翻成失效形态 → 找同形簇与反例（p8-28c）；
 *  ② 拆桥探针（p8-28d..e）：「拆掉会出什么错」要可复现证据（反事实存在性律），
 *     答不上来 ⇒ 不存在；
 *  ③ 按存在 / 接线 / 在线核生产路径（p8-28f）：挂载点、调用方计数、消费者与水位；
 *  末格（p8-28g）：三步任一不过 ⇒ 登记成新的一行（失效登记簿 +1 行）。
 *
 *  契约：
 *  - 时点一律句边界锚（铁律⑤）：六个 at 全部由调用侧以 `at('p8-28x') - beat.from` 传入；
 *  - 纯 effects 通道走 progress / useEnter，几何量（气泡下落、卡片位移）走缓动而非
 *    弹簧（登记簿语义无「弹」感）；@shake 只落 step 2（拆桥探针）；
 *  - 画面文字只放结构标签与字段名（存在/接线/在线、挂载点、调用方计数），不复述口播；
 *  - 色彩：登记簿/警示走橙（theme.conceptDeep），结论放行走绿（theme.ok）——与 0-G
 *    「行橙描边」的登记簿语义一致。
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {theme, withAlpha} from '../design/theme';
import {clamp01, progress, useEnter, useImpulse, useProgress, useShake, useStagger} from '../motion';

export const AuditCard: React.FC<{
  /** p8-28b：宣言气泡入场 */
  claimAt: number;
  /** p8-28c：step 1 翻失效形态 → 同形簇 / 反例 */
  s1At: number;
  /** p8-28d：step 2 拆桥探针（shake 起） */
  s2At: number;
  /** p8-28e：step 2 判定行「答不上来 ⇒ 不存在」（shake 止） */
  s2xAt: number;
  /** p8-28f：step 3 三态核验灯 */
  s3At: number;
  /** p8-28g：末格「任一不过 ⇒ 登记成新的一行」 */
  rowAt: number;
}> = ({claimAt, s1At, s2At, s2xAt, s3At, rowAt}) => {
  const frame = useCurrentFrame();
  const claim = useEnter('pop', {at: claimAt, dur: 20});
  // 宣言气泡「落进登记簿」：step 1 入场时下坠并淡出为底噪
  const drop = clamp01(progress(frame, s1At, 18));
  const s1 = useProgress(s1At, 14);
  const s2 = useProgress(s2At, 14);
  const verdict = useProgress(s2xAt, 12);
  // 拆桥探针：shake 活跃至判定行落定（p8-28d..e 一句半）
  const shake = useShake({at: s2At, amp: 4, freq: 1.6}) * (1 - clamp01(progress(frame, s2xAt, 12)));
  const s3 = useProgress(s3At, 14);
  const lamps = useStagger(3, {stride: 10, at: s3At});
  const row = useProgress(rowAt, 14);
  const rowChip = useImpulse({at: rowAt + 10, dur: 26, peak: 1});
  // 末格入场时步骤卡整组缓动让位（suppression）
  const stepYield = 1 - 0.45 * row;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 宣言气泡：审计对象（下坠淡出 = 落进登记簿） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 148,
          display: 'flex',
          justifyContent: 'center',
          opacity: claim.opacity * (1 - 0.78 * drop),
          transform: `${claim.transform} translateY(${drop * 46}px)`,
        }}
      >
        <div style={{position: 'relative', padding: '12px 30px', border: `2px solid ${theme.conceptDeep}`, borderRadius: 14, background: withAlpha(theme.bg, 0.92)}}>
          <span style={{position: 'absolute', left: 22, top: -14, padding: '1px 12px', border: `1.5px solid ${theme.dim}`, borderRadius: 999, fontSize: 14, fontFamily: theme.mono, color: theme.dim, background: theme.bg}}>
            宣称
          </span>
          <span style={{fontSize: 25, color: theme.text, letterSpacing: 1}}>「我们有语义层 · 治理不可绕过」</span>
        </div>
      </div>
      {/* 三步卡（横排） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 316, display: 'flex', justifyContent: 'center', gap: 26}}>
        {/* step 1：宣言 → 失效形态 → 同形簇 / 反例 */}
        <div
          style={{
            width: 470,
            padding: '16px 22px',
            border: `2px solid ${s1 > 0.4 ? theme.conceptDeep : theme.panelBorder}`,
            borderRadius: 12,
            background: theme.panel,
            opacity: (0.3 + s1 * 0.7) * stepYield,
            transform: `translateY(${(1 - s1) * 16}px)`,
          }}
        >
          <div style={{fontSize: 16, color: theme.dim, fontFamily: theme.mono}}>step 1</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap'}}>
            {['宣言', '问题类型', '同形簇 · 反例'].map((c, i) => (
              <span key={c} style={{display: 'flex', alignItems: 'center', gap: 10}}>
                <span style={{padding: '5px 12px', border: `1.5px solid ${theme.conceptDeep}`, borderRadius: 7, fontSize: 16, color: theme.conceptDeep, whiteSpace: 'nowrap'}}>
                  {c}
                </span>
                {i < 2 ? <span style={{fontSize: 16, color: theme.dim}}>→</span> : null}
              </span>
            ))}
          </div>
          <div style={{marginTop: 12, fontSize: 16, color: theme.dim, fontFamily: theme.mono, opacity: s1}}>去登记簿翻 49 行 · 找同形簇与反例</div>
        </div>
        {/* step 2：拆桥探针（shake）→ 可复现证据 */}
        <div
          style={{
            width: 470,
            padding: '16px 22px',
            border: `2px solid ${s2 > 0.4 ? theme.conceptDeep : theme.panelBorder}`,
            borderRadius: 12,
            background: theme.panel,
            opacity: (0.3 + s2 * 0.7) * stepYield,
            transform: `translateX(${shake}px) translateY(${(1 - s2) * 16}px)`,
          }}
        >
          <div style={{fontSize: 16, color: theme.dim, fontFamily: theme.mono}}>step 2</div>
          <div style={{marginTop: 12, fontSize: 21, color: theme.text}}>去掉它 · 会出什么错？</div>
          <div style={{marginTop: 10, display: 'flex', alignItems: 'center', gap: 12}}>
            <span style={{padding: '5px 12px', border: `1.5px solid ${theme.ok}`, borderRadius: 7, fontSize: 16, color: theme.ok}}>要可复现证据</span>
            <span style={{fontSize: 15, fontFamily: theme.mono, color: theme.dim}}>反事实存在性</span>
          </div>
          <div style={{marginTop: 12, fontSize: 18, color: theme.conceptDeep, opacity: verdict}}>
            答不上来 ⇒ 不存在
          </div>
        </div>
        {/* step 3：存在 / 接线 / 在线 三态核验灯 */}
        <div
          style={{
            width: 470,
            padding: '16px 22px',
            border: `2px solid ${s3 > 0.4 ? theme.conceptDeep : theme.panelBorder}`,
            borderRadius: 12,
            background: theme.panel,
            opacity: (0.3 + s3 * 0.7) * stepYield,
            transform: `translateY(${(1 - s3) * 16}px)`,
          }}
        >
          <div style={{fontSize: 16, color: theme.dim, fontFamily: theme.mono}}>step 3</div>
          {[
            {t: '存在', s: '挂载点'},
            {t: '接线', s: '调用方计数'},
            {t: '在线', s: '消费者与水位'},
          ].map((l, i) => (
            <div key={l.t} style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: i === 0 ? 12 : 8, opacity: lamps[i]}}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  border: `2px solid ${theme.ok}`,
                  background: lamps[i] > 0.6 ? theme.ok : 'transparent',
                }}
              />
              <span style={{fontSize: 18, color: theme.text, width: 52}}>{l.t}</span>
              <span style={{fontSize: 15, fontFamily: theme.mono, color: theme.dim}}>{l.s}</span>
            </div>
          ))}
        </div>
      </div>
      {/* 末格：三步任一不过 ⇒ 登记成新的一行 */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 620, display: 'flex', justifyContent: 'center'}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '13px 30px',
            border: `2.5px solid ${theme.conceptDeep}`,
            borderRadius: 12,
            background: withAlpha(theme.bg, 0.92),
            opacity: row,
            transform: `translateY(${(1 - row) * 16}px)`,
          }}
        >
          <span style={{fontSize: 21, color: theme.text}}>三步任一不过</span>
          <span style={{fontSize: 22, color: theme.conceptDeep}}>⇒</span>
          <span style={{fontSize: 21, color: theme.conceptDeep}}>登记成新的一行</span>
          <span
            style={{
              padding: '3px 12px',
              border: `2px solid ${theme.conceptDeep}`,
              borderRadius: 8,
              fontSize: 18,
              fontFamily: theme.mono,
              color: theme.conceptDeep,
              transform: `scale(${1 + rowChip * 0.25})`,
              opacity: row * Math.max(0.4, rowChip),
            }}
          >
            +1 行
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
