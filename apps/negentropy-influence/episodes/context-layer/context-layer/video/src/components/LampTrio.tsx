/** 回路在线三条件三盏灯（P6·6-A/6-B 沉淀轴回路判定装置，v3 新增）。
 *
 *  触发器 / 消费者 / 水位线三盏灯：点亮帧逐灯声明（onAt，null=本次不亮），
 *  missingAt 后仍未亮的灯转「缺」警示（橙虚线环）——回路缺一件即不存在。
 *  点亮 = 绿灯头 + 分层 halo（withAlpha 同心圆，不用 filter blur）。
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {theme, withAlpha} from '../design/theme';
import {useBreathe, useEnter, useProgress, useSpring} from '../motion';

const Lamp: React.FC<{
  label: string;
  /** 灯座入场帧 */
  at: number;
  /** 点亮帧；null = 本次不亮 */
  onAt: number | null;
  /** 未亮灯转「缺」警示的帧；缺省不警示 */
  missingAt?: number;
  index: number;
}> = ({label, at, onAt, missingAt, index}) => {
  const enter = useEnter('rise', {at: at + index * 6, dur: 14});
  // null 安全：onAt=0 兜底后用布尔区分（hooks 不可条件调用）
  const on = useProgress(onAt ?? 0, 8);
  const pop = useSpring('snap', {at: onAt ?? 0, dur: 10});
  const lit = onAt !== null && on > 0.5;
  const breathe = useBreathe({period: 90, amp: 0.18, base: 0.82, offset: index * 30});
  const missing = useProgress(missingAt ?? Number.MAX_SAFE_INTEGER, 10);
  const missPulse = useBreathe({period: 60, amp: 0.25, base: 0.75, offset: index * 20});
  return (
    <div style={{...enter, position: 'relative', width: 236, height: 330, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      {/* 灯头：点亮=校准绿；未亮且过 missingAt=橙虚线「缺」环 */}
      <div style={{position: 'relative', width: 84, height: 84}}>
        {lit ? (
          <div style={{position: 'absolute', inset: -20, borderRadius: 62, background: withAlpha(theme.ok, 0.1), opacity: breathe}} />
        ) : null}
        {lit ? (
          <div style={{position: 'absolute', inset: -8, borderRadius: 50, background: withAlpha(theme.ok, 0.18), opacity: breathe}} />
        ) : null}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 42,
            background: lit ? withAlpha(theme.ok, 0.3) : theme.panel,
            border: `2.5px solid ${lit ? theme.ok : theme.panelBorder}`,
            borderStyle: !lit && missingAt !== undefined && missing > 0.5 ? 'dashed' : 'solid',
            borderColor: !lit && missingAt !== undefined && missing > 0.5 ? theme.conceptDeep : undefined,
            transform: `scale(${lit ? 0.92 + pop * 0.14 : 1})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
            color: lit ? theme.ok : theme.dim,
          }}
        >
          {lit ? '✓' : '—'}
        </div>
      </div>
      {/* 灯杆 + 灯座 */}
      <div style={{width: 8, height: 128, background: theme.panelBorder, borderRadius: 4, marginTop: 8}} />
      <div style={{width: 120, height: 14, borderRadius: 7, background: theme.panelBorder, marginTop: 2}} />
      <div style={{marginTop: 14, fontSize: 21, color: theme.text, textAlign: 'center', lineHeight: 1.4}}>{label}</div>
      {/* 「缺」警示签：未亮灯的停驻态 */}
      {!lit && missingAt !== undefined && missing > 0.5 ? (
        <div
          style={{
            marginTop: 8,
            padding: '3px 14px',
            borderRadius: 6,
            border: `1.5px solid ${theme.conceptDeep}`,
            color: theme.conceptDeep,
            fontSize: 18,
            opacity: missPulse,
          }}
        >
          缺
        </div>
      ) : null}
    </div>
  );
};

export const LampTrio: React.FC<{
  /** 三灯座组入场帧 */
  at: number;
  /** 各灯点亮帧（相对本组件父 Sequence）；null = 本次不亮 */
  onAt: readonly [number | null, number | null, number | null];
  /** 未亮灯转「缺」警示的帧；缺省不警示（6-A 全亮场景不传） */
  missingAt?: number;
  /** 灯名；缺省 触发器/消费者/水位线 */
  labels?: readonly [string, string, string];
}> = ({at, onAt, missingAt, labels = ['触发器', '消费者', '水位线']}) => {
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 56}}>
      {labels.map((t, i) => (
        <Lamp key={t} label={t} at={at} onAt={onAt[i]} missingAt={missingAt} index={i} />
      ))}
    </AbsoluteFill>
  );
};
