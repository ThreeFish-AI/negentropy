/** P5 交警与年检（p5-01..p5-16，镜 5-A..5-E）——治理幕：官方校验器=车辆年检定位
 *  （dt-lenient/dt-strict 双章对照）→ 三方六处分歧与字段徽章 6=6（dt-ext-b/dt-ext-a）→
 *  X2 消融：年检机装进店门、红叉拦下扩展卡、装载面 6→5（lc-load）→ 关门哲学：
 *  拿不准就不加、51 条建议排队、侧门自开（dt-gate）→ 五规律卡飞入钩子。
 *  幕主色年检紫（规范/校验/守门）；danger/ok 只用于消融红绿侧与打回/放行判定。
 *  空间语义：左=官方/校验轨（发布方），右=装载轨（客户端）；
 *  archify 全屏独占期（p5-02/03/07/08/09/13）自制装置全部让位到窗外句窗或左带。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useCount, useDraw, useImpulse, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {SCREEN_INK, Stage} from '../components/e1-motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';

/** 小车图形（零 hooks 的静态 glyph；位移由外层 g transform 驱动）。 */
const CarGlyph: React.FC<{x: number; tone: string}> = ({x, tone}) => (
  <g transform={`translate(${x},0)`}>
    <rect x={0} y={92} width={68} height={22} rx={8} fill={theme.panel} stroke={tone} strokeWidth={2} />
    <rect x={14} y={79} width={36} height={17} rx={6} fill={theme.panel} stroke={tone} strokeWidth={2} />
    <circle cx={18} cy={120} r={8} fill={theme.bg} stroke={tone} strokeWidth={2} />
    <circle cx={52} cy={120} r={8} fill={theme.bg} stroke={tone} strokeWidth={2} />
  </g>
);

/** 5-A 开场（p5-01，非 cue 句）：官方校验器定位卡 + 车辆年检印章盖落。 */
const ValidatorIntro: React.FC<{cardAt: number; sealAt: number}> = ({cardAt, sealAt}) => {
  const frame = useCurrentFrame();
  const enter = useSpring('settle', {at: cardAt, dur: DUR.f5});
  const enterO = progress(frame, cardAt, DUR.f5); // effects 不变量：透明度走时长缓动
  const seal = useSpring('snap', {at: sealAt, dur: DUR.f4});
  const sealO = progress(frame, sealAt, DUR.f3);
  return (
    <div style={{position: 'relative', width: 600, height: 380}}>
      <div
        style={{
          width: 560,
          background: theme.panel,
          border: `1.5px solid ${theme.deny}55`,
          borderRadius: 14,
          padding: '36px 42px',
          opacity: enterO,
          transform: `translateY(${(1 - enter) * 22}px)`,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, letterSpacing: 2, marginBottom: 14}}>
          spec 自带
        </div>
        <div style={{fontSize: 44, fontWeight: 700, color: theme.text}}>官方校验器</div>
        <div style={{fontSize: 19, color: theme.dim, marginTop: 14}}>定位 · 车辆年检</div>
      </div>
      {/* 年检印章：斜盖右上角，snap 弹入带轻微过冲 */}
      <div
        style={{
          position: 'absolute',
          right: 4,
          top: -28,
          opacity: sealO,
          transform: `rotate(-14deg) scale(${1.7 - 0.7 * seal})`,
        }}
      >
        <div
          style={{
            width: 128,
            height: 128,
            borderRadius: '50%',
            border: `3.5px solid ${theme.deny}`,
            background: `${theme.deny}14`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: theme.deny}}>年检</span>
        </div>
      </div>
    </div>
  );
};

/** 5-A 轨间虚线断开（p5-04）：短划 stagger 落位，中段留空嵌「无强制联动」标签。 */
const LinkBreak: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const st = useStagger(12, {at, dur: DUR.f3, stride: 3});
  const labelP = progress(frame, at + 18, DUR.f4);
  const dash = (p: number, up: boolean, k: string) => (
    <div
      key={k}
      style={{
        width: 3,
        height: 14,
        borderRadius: 2,
        background: theme.dim,
        opacity: p * 0.8,
        transform: `translateY(${(1 - p) * (up ? -8 : 8)}px)`,
      }}
    />
  );
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, height: 320, justifyContent: 'center'}}>
      {st.slice(0, 4).map((p, i) => dash(p, true, `t${i}`))}
      <div style={{fontSize: 15, color: theme.dim, letterSpacing: 1, padding: '10px 2px', whiteSpace: 'nowrap', opacity: labelP}}>
        无强制联动
      </div>
      {st.slice(4).map((p, i) => dash(p, false, `b${i}`))}
    </div>
  );
};

/** 5-A 单轨卡（p5-04）：strict=左（官方年检线，车到闸前被打回）/ lenient=右
 *  （客户端路面，交警警告一句照放行）。时点全部由 TrackSplit 按句窗分数传入。 */
const LaneCard: React.FC<{
  kind: 'strict' | 'lenient';
  enter: number;
  carAt: number;
  carDur: number;
  bubbleAt: number;
  stampAt: number;
  verdictAt: number;
  extraAt: number;
}> = ({kind, enter, carAt, carDur, bubbleAt, stampAt, verdictAt, extraAt}) => {
  const frame = useCurrentFrame();
  const strict = kind === 'strict';
  const t = progress(frame, carAt, carDur);
  // strict 车提前停在闸前；lenient 车一路通行到画面外沿
  const x = strict ? 6 + Math.min(1, t * 1.3) * 160 : 6 + t * 380;
  const bubble = useSpring('snap', {at: bubbleAt, dur: DUR.f4});
  const bubbleO = progress(frame, bubbleAt, DUR.f3);
  const stamp = useSpring('snap', {at: stampAt, dur: DUR.f4});
  const stampO = progress(frame, stampAt, DUR.f3);
  const verdictP = progress(frame, verdictAt, DUR.f4);
  const extraP = progress(frame, extraAt, DUR.f4);
  return (
    <div
      style={{
        width: 500,
        background: theme.panel,
        border: `1.5px solid ${theme.panelBorder}`,
        borderRadius: 12,
        padding: '16px 20px 14px',
        opacity: enter,
        transform: `translateY(${(1 - enter) * 18}px)`,
      }}
    >
      <div style={{display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: 12, marginBottom: 4}}>
        <span style={{fontSize: 20, fontWeight: 700, color: theme.text}}>{strict ? '校验轨' : '装载轨'}</span>
        <span style={{fontSize: 14, color: theme.dim}}>{strict ? '官方 · 年检' : '客户端 · 路面'}</span>
      </div>
      <svg width={460} height={140} viewBox="0 0 460 140">
        {/* 路面与中线 */}
        <path d="M12 130 H448" stroke={theme.panelBorder} strokeWidth={3} strokeLinecap="round" />
        <path d="M24 130 H436" stroke={`${theme.panelBorder}55`} strokeWidth={2} strokeDasharray="14 20" />
        {strict ? (
          <>
            {/* 年检闸口 */}
            <path d="M246 130 V40" stroke={theme.deny} strokeWidth={4} />
            <path d="M266 130 V40" stroke={theme.deny} strokeWidth={4} />
            <path d="M238 42 H274" stroke={theme.deny} strokeWidth={5} strokeLinecap="round" />
            {/* p5-03 红章：未登记字段 */}
            <g transform={`translate(112,4) rotate(-10) scale(${0.7 + 0.3 * stamp})`} opacity={stampO}>
              <rect x={0} y={0} width={136} height={40} rx={6} fill={theme.bg} stroke={theme.danger} strokeWidth={2.5} />
              <text x={68} y={26} textAnchor="middle" fontFamily={theme.mono} fontSize={15} fill={theme.danger}>
                未登记字段
              </text>
            </g>
          </>
        ) : (
          <>
            {/* p5-02 交警（敬礼小人） */}
            <circle cx={175} cy={60} r={7} fill="none" stroke={theme.deny} strokeWidth={2.5} />
            <path d="M166 68 L184 68 L188 126 L162 126 Z" fill={`${theme.deny}26`} stroke={theme.deny} strokeWidth={2.5} />
            <path d="M183 74 L196 60" stroke={theme.deny} strokeWidth={3} strokeLinecap="round" />
            {/* 警告气泡：车牌样式 */}
            <g transform={`translate(196,2) scale(${0.7 + 0.3 * bubble})`} opacity={bubbleO}>
              <rect x={0} y={0} width={128} height={36} rx={8} fill={theme.panel} stroke={theme.deny} strokeWidth={2} />
              <path d="M22 36 L32 50 L42 36 Z" fill={theme.deny} />
              <text x={64} y={23} textAnchor="middle" fontFamily={theme.sans} fontSize={14} fill={theme.deny}>
                车牌样式
              </text>
            </g>
          </>
        )}
        <CarGlyph x={x} tone={strict ? theme.danger : theme.dim} />
      </svg>
      {/* 判定行：p5-03 打回 / p5-02 照放行 */}
      <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, height: 34}}>
        <span style={{fontSize: 14, color: theme.dim}}>判定</span>
        <span
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: strict ? theme.danger : theme.ok,
            border: `1.5px solid ${strict ? theme.danger : theme.ok}88`,
            borderRadius: 8,
            padding: '3px 12px',
            opacity: verdictP,
          }}
        >
          {strict ? '打回' : '照放行'}
        </span>
        {/* p5-04 年检自愿：打回的，宽容客户端照样跑 */}
        {!strict && (
          <span style={{fontSize: 14, color: theme.ok, opacity: extraP}}>打回的 · 照样跑</span>
        )}
      </div>
    </div>
  );
};

/** 5-A 收束（p5-04）：两轨并行不悖——左校验轨打回 / 右装载轨放行，轨间虚线断开。 */
const TrackSplit: React.FC<{at: number; dur: number}> = ({at, dur}) => {
  const lanes = useStagger(2, {at, dur: DUR.f5, stride: 9});
  const f = (k: number) => at + Math.round(dur * k); // 句窗分数 → 局部帧
  return (
    <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 26}}>
      <LaneCard
        kind="strict"
        enter={lanes[0]}
        carAt={f(0.16)}
        carDur={Math.round(dur * 0.5)}
        bubbleAt={f(0.9)}
        stampAt={f(0.42)}
        verdictAt={f(0.58)}
        extraAt={f(0.95)}
      />
      <LinkBreak at={f(0.28)} />
      <LaneCard
        kind="lenient"
        enter={lanes[1]}
        carAt={f(0.16)}
        carDur={Math.round(dur * 0.5)}
        bubbleAt={f(0.34)}
        stampAt={f(0.95)}
        verdictAt={f(0.5)}
        extraAt={f(0.72)}
      />
    </div>
  );
};

/** 5-B 分歧（p5-05/06，非 cue 句连窗）：三方六处分歧总卡 → 规范字段 6 = 校验
 *  白名单 6（多一个打回）。计数徽章 @count 跳数。 */
const DivergenceBoard: React.FC<{at: number; badgeAt: number}> = ({at, badgeAt}) => {
  const frame = useCurrentFrame();
  const headP = progress(frame, at, DUR.f5);
  const chips = useStagger(3, {at: at + 6, dur: DUR.f3, stride: 8});
  const six = useCount({to: 6, at: at + 2, dur: DUR.f5});
  const badgeP = progress(frame, badgeAt, DUR.f5);
  const c1 = useCount({to: 6, at: badgeAt + 4, dur: DUR.f5});
  const c2 = useCount({to: 6, at: badgeAt + 9, dur: DUR.f5});
  const noteP = progress(frame, badgeAt + 14, DUR.f4);
  const parties = ['规范', '参考实现', '客户端'];
  const badge = (title: string, val: number) => (
    <div
      style={{
        width: 330,
        background: theme.panel,
        border: `1.5px solid ${theme.deny}44`,
        borderRadius: 12,
        padding: '16px 26px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span style={{fontSize: 18, color: theme.text}}>{title}</span>
      <span style={{fontFamily: theme.mono, fontSize: 50, fontWeight: 700, color: theme.deny}}>{Math.round(val)}</span>
    </div>
  );
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 46, alignItems: 'center'}}>
      {/* p5-05 总卡：六处分歧 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 60,
          opacity: headP,
          transform: `translateY(${(1 - headP) * 18}px)`,
        }}
      >
        <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
          <span style={{fontFamily: theme.mono, fontSize: 96, fontWeight: 700, color: theme.deny}}>{Math.round(six)}</span>
          <span style={{fontSize: 30, color: theme.text}}>处分歧</span>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
          <div style={{display: 'flex', flexDirection: 'row', gap: 12}}>
            {parties.map((p, i) => (
              <span
                key={p}
                style={{
                  fontSize: 16,
                  color: theme.text,
                  border: `1.5px solid ${theme.panelBorder}`,
                  borderRadius: 999,
                  padding: '5px 16px',
                  opacity: chips[i],
                  transform: `translateX(${(1 - chips[i]) * -16}px)`,
                }}
              >
                {p}
              </span>
            ))}
          </div>
          <span style={{fontSize: 14.5, color: theme.dim, opacity: chips[2]}}>最直观 · 在字段</span>
        </div>
      </div>
      {/* p5-06 徽章对：6 = 6，多一个打回 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          opacity: badgeP,
          transform: `translateY(${(1 - badgeP) * 22}px)`,
        }}
      >
        <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 30}}>
          {badge('规范字段', c1)}
          <span style={{fontFamily: theme.mono, fontSize: 44, color: theme.dim}}>=</span>
          {badge('校验白名单', c2)}
        </div>
        <span
          style={{
            fontSize: 15,
            color: theme.danger,
            border: `1.5px dashed ${theme.danger}77`,
            borderRadius: 8,
            padding: '4px 14px',
            opacity: noteP,
          }}
        >
          多一个 · 打回
        </span>
      </div>
    </div>
  );
};

/** 5-B 左带徽章（p5-07，archify 窗外）：同一家厂商两面——上传面 6（+1 即红错）/ 本地面 20。 */
const FaceBadges: React.FC<{at: number}> = ({at}) => {
  const st = useStagger(2, {at, dur: DUR.f4, stride: 9});
  const rows = [
    {label: '上传面', n: 6, note: '+1 即红错', tone: theme.danger},
    {label: '本地面', n: 20, note: '', tone: theme.dim},
  ];
  return (
    <div
      style={{
        position: 'absolute',
        left: 36,
        top: 336,
        width: 254,
        background: `${theme.panel}f2`,
        border: `1.5px solid ${theme.deny}44`,
        borderRadius: 12,
        padding: '14px 18px',
        zIndex: 40,
      }}
    >
      <div style={{fontSize: 13.5, color: theme.dim, letterSpacing: 2, marginBottom: 10}}>同一家厂商</div>
      {rows.map((r, i) => (
        <div
          key={r.label}
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 10,
            padding: '6px 0',
            opacity: st[i],
            transform: `translateX(${(1 - st[i]) * -14}px)`,
          }}
        >
          <span style={{fontSize: 15.5, color: theme.text}}>{r.label}</span>
          <span style={{fontFamily: theme.mono, fontSize: 30, fontWeight: 700, color: theme.deny, marginLeft: 'auto'}}>{r.n}</span>
          <span style={{fontSize: 12.5, color: r.tone, width: 68}}>{r.note}</span>
        </div>
      ))}
    </div>
  );
};

/** 5-B 左带对照（p5-08，archify 窗外）：必填各说各话——规范 name 必填 vs CC 可选。 */
const RequiredTable: React.FC<{at: number}> = ({at}) => {
  const st = useStagger(2, {at, dur: DUR.f4, stride: 10});
  const rows = [
    {who: '规范', verdict: '必填', tone: theme.deny},
    {who: 'Claude Code', verdict: '可选', tone: theme.dim},
  ];
  return (
    <div
      style={{
        position: 'absolute',
        left: 36,
        top: 336,
        width: 254,
        background: `${theme.panel}f2`,
        border: `1.5px solid ${theme.deny}44`,
        borderRadius: 12,
        padding: '14px 18px',
        zIndex: 40,
      }}
    >
      <div style={{fontSize: 13.5, color: theme.dim, letterSpacing: 2, marginBottom: 10}}>必填 · name</div>
      {rows.map((r, i) => (
        <div
          key={r.who}
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: '7px 0',
            opacity: st[i],
            transform: `translateX(${(1 - st[i]) * -14}px)`,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 13.5, color: i === 0 ? theme.text : theme.dim, minWidth: 118}}>{r.who}</span>
          <span style={{fontSize: 16, fontWeight: 700, color: r.tone}}>{r.verdict}</span>
        </div>
      ))}
      <div style={{fontSize: 12.5, color: theme.dim, marginTop: 6, opacity: st[1]}}>不填 · 默认目录名</div>
    </div>
  );
};

/** 5-C X2 消融（p5-10）：店门口装年检机——带扩展字段的技能卡被红叉整体拦下，
 *  装载面 6→5（六分之一没了）。红绿语义：拦下=danger，仅消融侧使用。 */
const GateAtStore: React.FC<{at: number; dur: number}> = ({at, dur}) => {
  const frame = useCurrentFrame();
  const doorP = progress(frame, at, DUR.f6);
  const travel = progress(frame, at + 4, Math.round(dur * 0.38));
  const blockAt = at + Math.round(dur * 0.5);
  const blockP = progress(frame, blockAt, DUR.f5);
  const x1 = useDraw(blockAt, DUR.f4);
  const x2 = useDraw(blockAt + 2, DUR.f4);
  const pulse = useImpulse({at: blockAt + 8, dur: DUR.f5, peak: 0.3});
  const gone = progress(frame, blockAt + 8, DUR.f5);
  const loaded = useCount({from: 6, to: 5, at: blockAt + 12, dur: DUR.f5});
  const slots = useStagger(6, {at: at + 4, dur: DUR.f3, stride: 5});
  const cardX = 690 - travel * 320; // 技能卡滑向店门（右 → 左）
  return (
    <div style={{position: 'relative', width: 1150, height: 520, opacity: doorP, transform: `translateY(${(1 - doorP) * 22}px)`}}>
      {/* 店门 + 年检机（官方治理面挪进客户端店门） */}
      <div style={{position: 'absolute', left: 0, top: 6, width: 320, height: 446}}>
        <div style={{fontSize: 13.5, color: theme.dim, marginBottom: 8, letterSpacing: 2}}>店门</div>
        <div style={{width: 300, height: 404, border: `4px solid ${theme.panelBorder}`, borderRadius: 10, background: theme.panel, position: 'relative'}}>
          <div style={{position: 'absolute', inset: 24, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 4}} />
          <div style={{position: 'absolute', right: 22, top: '46%', width: 7, height: 34, borderRadius: 4, background: theme.dim}} />
        </div>
        <div style={{position: 'absolute', left: 236, top: 96, width: 132, background: theme.panel, border: `2px solid ${theme.deny}88`, borderRadius: 8, padding: '8px 10px'}}>
          <div style={{fontSize: 12.5, color: theme.deny, letterSpacing: 2}}>年检机</div>
          <div
            style={{
              marginTop: 6,
              height: 42,
              borderRadius: 4,
              background: SCREEN_INK,
              border: `1.5px solid ${theme.panelBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: blockP,
            }}
          >
            <svg width={26} height={26} viewBox="0 0 26 26">
              <path d="M5 5 L21 21" stroke={theme.danger} strokeWidth={4} strokeLinecap="round" />
              <path d="M21 5 L5 21" stroke={theme.danger} strokeWidth={4} strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
      {/* 带扩展字段的技能卡：进门即被红叉拦下、淡成残影下沉（红叉钉住=拦下证据
       *  陈列；「整体消失」由右侧装载面 6→5 那格承载，口播 p5-10） */}
      <div style={{position: 'absolute', left: cardX, top: 128, width: 236, opacity: 1 - 0.88 * gone, transform: `translateY(${gone * 36}px)`}}>
        <div style={{background: theme.panel, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 10, padding: '12px 16px'}}>
          <div style={{fontSize: 12.5, color: theme.dim, marginBottom: 8}}>技能卡</div>
          <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, padding: '3px 0'}}>name</div>
          <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, padding: '3px 0'}}>description</div>
          <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.deny, background: `${theme.deny}1c`, borderRadius: 4, padding: '3px 8px', marginTop: 4}}>扩展字段</div>
        </div>
      </div>
      {/* 红叉：pathLength 描线两笔 + impulse 脉冲 */}
      <svg
        width={190}
        height={190}
        viewBox="0 0 190 190"
        style={{
          position: 'absolute',
          left: cardX + 23,
          top: 128,
          pointerEvents: 'none',
          opacity: Math.min(1, blockP * 2),
          transform: `scale(${1 + pulse})`,
        }}
      >
        <path d="M34 34 L156 156" stroke={theme.danger} strokeWidth={11} strokeLinecap="round" fill="none" {...x1} />
        <path d="M156 34 L34 156" stroke={theme.danger} strokeWidth={11} strokeLinecap="round" fill="none" {...x2} />
      </svg>
      {/* 挪用注记 */}
      <div style={{position: 'absolute', left: 600, top: 84, fontSize: 15, color: theme.dim, letterSpacing: 2}}>挪进装载路径</div>
      {/* 装载面：六格少一格（6→5） */}
      <div style={{position: 'absolute', left: 600, top: 388}}>
        <div style={{display: 'flex', flexDirection: 'row', gap: 9}}>
          {slots.map((p, i) => {
            const ext = i === 2; // 第 3 格 = 带扩展字段的那张
            const dead = ext ? gone : 0;
            return (
              <div
                key={i}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 7,
                  border: `1.5px solid ${ext ? theme.deny : theme.panelBorder}`,
                  background: dead > 0.5 ? 'transparent' : theme.panel,
                  opacity: (0.3 + 0.7 * p) * (1 - 0.82 * dead),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {ext && dead > 0.4 && (
                  <svg width={20} height={20} viewBox="0 0 20 20">
                    <path d="M4 4 L16 16" stroke={theme.danger} strokeWidth={3} strokeLinecap="round" />
                    <path d="M16 4 L4 16" stroke={theme.danger} strokeWidth={3} strokeLinecap="round" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 14}}>
          <span style={{fontSize: 15, color: theme.dim}}>装载面</span>
          <span style={{fontFamily: theme.mono, fontSize: 44, fontWeight: 700, color: theme.deny}}>{Math.round(loaded)}</span>
          <span style={{fontSize: 14.5, color: theme.danger, opacity: blockP}}>六分之一 · 没了</span>
        </div>
      </div>
    </div>
  );
};

/** 金句卡（衬线体，@pushIn 落定）：p5-11「出厂检验的门 ≠ 店门」/ p5-15「门关越久 · 侧门越多」。 */
const QuoteCard: React.FC<{
  at: number;
  lines: string[];
  subs: {text: string; color: string}[];
  crackAt?: number;
}> = ({at, lines, subs, crackAt}) => {
  const frame = useCurrentFrame();
  const s = useSpring('settle', {at, dur: DUR.f6});
  const o = progress(frame, at, DUR.f5);
  const subSt = useStagger(subs.length, {at: at + 8, dur: DUR.f4, stride: 8});
  const crack = useDraw(crackAt ?? at + 30, DUR.f6);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 30,
        opacity: o,
        transform: `translateY(${(1 - s) * 30}px) scale(${1 + (1 - s) * 0.05})`,
      }}
    >
      <div style={{fontFamily: theme.serif, fontSize: 48, fontWeight: 700, color: theme.deny, lineHeight: 1.5, textAlign: 'center'}}>
        {lines.map((l) => (
          <div key={l}>{l}</div>
        ))}
      </div>
      {/* p5-15 互操作裂缝：一条描线裂痕 */}
      {crackAt !== undefined && (
        <svg width={460} height={56} viewBox="0 0 460 56">
          <path
            d="M6 30 L64 38 L118 24 L178 42 L236 28 L298 46 L356 26 L416 40 L454 32"
            fill="none"
            stroke={theme.panelBorder}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...crack}
          />
        </svg>
      )}
      <div style={{display: 'flex', flexDirection: 'row', gap: 18}}>
        {subs.map((sb, i) => (
          <span
            key={sb.text}
            style={{
              fontSize: 16,
              color: sb.color,
              border: `1.5px solid ${sb.color}55`,
              borderRadius: 999,
              padding: '5px 18px',
              opacity: subSt[i],
            }}
          >
            {sb.text}
          </span>
        ))}
      </div>
    </div>
  );
};

/** 5-D 关门（p5-12）：管住复杂度的答案——门上挂牌「拿不准就不加」，旁注 加易 · 删难。 */
const DoorPlaque: React.FC<{at: number; dur: number}> = ({at, dur}) => {
  const frame = useCurrentFrame();
  const doorP = progress(frame, at, DUR.f6);
  const plaqueAt = at + Math.round(dur * 0.3);
  const plaque = useSpring('settleSoft', {at: plaqueAt, dur: DUR.f5});
  const plaqueO = progress(frame, plaqueAt, DUR.f4);
  const sway = Math.sin((frame - plaqueAt) / 12) * 1.6 * plaqueO; // 挂稳后的余摆
  const ruleP = progress(frame, at + Math.round(dur * 0.62), DUR.f5);
  return (
    <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 110, opacity: doorP, transform: `translateY(${(1 - doorP) * 20}px)`}}>
      {/* 规范之门 + 吊挂牌 */}
      <div style={{position: 'relative', width: 330, height: 440}}>
        <div style={{position: 'absolute', left: 15, top: 0, width: 300, height: 440, border: `4px solid ${theme.panelBorder}`, borderRadius: 10, background: theme.panel}}>
          <div style={{position: 'absolute', inset: 26, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 4}} />
          <div style={{position: 'absolute', right: 26, top: '48%', width: 7, height: 34, borderRadius: 4, background: theme.dim}} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 74,
            display: 'flex',
            justifyContent: 'center',
            opacity: plaqueO,
            transform: `rotate(${(1 - plaque) * -9 + sway}deg)`,
            transformOrigin: 'top center',
          }}
        >
          <div style={{position: 'relative'}}>
            <div style={{position: 'absolute', left: 34, top: -58, width: 2, height: 58, background: theme.panelBorder}} />
            <div style={{position: 'absolute', right: 34, top: -58, width: 2, height: 58, background: theme.panelBorder}} />
            <div style={{background: theme.deny, borderRadius: 8, padding: '12px 26px', boxShadow: `0 6px 22px ${theme.deny}33`}}>
              <div style={{fontSize: 13, color: theme.bg, opacity: 0.72, letterSpacing: 3, textAlign: 'center'}}>规范之门</div>
              <div style={{fontSize: 22, fontWeight: 700, color: theme.bg, marginTop: 2}}>拿不准就不加</div>
            </div>
          </div>
        </div>
      </div>
      {/* 加易 · 删难 */}
      <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
        <div style={{fontSize: 17, color: theme.dim, letterSpacing: 2}}>管住复杂度</div>
        <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16, opacity: ruleP}}>
          <span style={{fontSize: 26, color: theme.dim}}>加 · 易</span>
          <div style={{width: 1, height: 30, background: theme.panelBorder}} />
          <span style={{fontSize: 26, fontWeight: 700, color: theme.text}}>删 · 难</span>
        </div>
        <div style={{fontSize: 14.5, color: theme.dim, opacity: ruleP}}>成本不对称</div>
      </div>
    </div>
  );
};

/** 5-D 左带排队（p5-13，archify 窗外）：51 条公开修改建议逐点排入——真画 51 个
 *  小圆点（11 列网阵，末行 7 个），随句 fit 铺满；旁挂主线冻结 1 个月+。 */
const QueueStrip: React.FC<{at: number; dur: number}> = ({at, dur}) => {
  const frame = useCurrentFrame();
  const o = progress(frame, at, DUR.f4);
  const dots = useStagger(51, {at: at + 3, dur: DUR.f3, fit: {total: Math.max(60, Math.round(dur * 0.85))}});
  const filled = dots.reduce((a, d) => a + (d > 0.5 ? 1 : 0), 0); // 计数=已落位点数
  const freezeP = progress(frame, at + Math.round(dur * 0.55), DUR.f5);
  return (
    <div
      style={{
        position: 'absolute',
        left: 36,
        top: 300,
        width: 256,
        background: `${theme.panel}f2`,
        border: `1.5px solid ${theme.deny}44`,
        borderRadius: 12,
        padding: '14px 16px',
        zIndex: 40,
        opacity: o,
      }}
    >
      <div style={{fontSize: 13.5, color: theme.dim, letterSpacing: 2}}>公开修改建议</div>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4}}>
        <span style={{fontFamily: theme.mono, fontSize: 40, fontWeight: 700, color: theme.deny}}>{filled}</span>
        <span style={{fontSize: 13.5, color: theme.dim}}>/ 51 · 在排队</span>
      </div>
      {/* 51 个小圆点：11×5 网阵（末行 7 个） */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(11, 15px)', gap: 5, marginTop: 10}}>
        {dots.map((p, i) => (
          <div
            key={i}
            style={{
              width: 15,
              height: 15,
              borderRadius: '50%',
              background: p > 0.5 ? `${theme.deny}66` : 'transparent',
              border: `1.5px solid ${p > 0.5 ? theme.deny : theme.panelBorder}`,
              opacity: 0.35 + 0.65 * p,
              transform: `scale(${0.6 + 0.4 * p})`,
            }}
          />
        ))}
      </div>
      {/* 主线冻结（斜纹条 + 时长） */}
      <div style={{marginTop: 12, opacity: freezeP}}>
        <div style={{fontSize: 13.5, color: theme.text}}>主线冻结</div>
        <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4}}>
          <div
            style={{
              width: 118,
              height: 22,
              borderRadius: 4,
              border: `1.5px solid ${theme.panelBorder}`,
              backgroundImage: `repeating-linear-gradient(45deg, ${theme.panelBorder}88 0 5px, transparent 5px 11px)`,
            }}
          />
          <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>1 个月+</span>
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, marginTop: 8, opacity: 0.8}}>截至 2026-09-30</div>
      </div>
    </div>
  );
};

/** 5-D 侧门（p5-14）：正门紧闭压暗，私有扩展的侧门一扇扇自己打开（绕开规范自己生长）。 */
const SideDoors: React.FC<{at: number; dur: number}> = ({at, dur}) => {
  const frame = useCurrentFrame();
  const wallP = progress(frame, at, DUR.f5);
  const doors = useStagger(4, {at: at + Math.round(dur * 0.22), dur: DUR.f5, fit: {total: Math.max(40, Math.round(dur * 0.55))}});
  const chips = useStagger(2, {at: at + Math.round(dur * 0.66), dur: DUR.f4, stride: 8});
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40, opacity: wallP, transform: `translateY(${(1 - wallP) * 18}px)`}}>
      <div style={{display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 42}}>
        {/* 正门：紧闭（上一镜同形，压暗） */}
        <div
          style={{
            width: 128,
            height: 216,
            border: `3.5px solid ${theme.panelBorder}`,
            borderRadius: 8,
            background: theme.panel,
            opacity: 0.4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{fontSize: 13, color: theme.dim}}>正门</span>
        </div>
        {doors.map((p, i) => (
          <div key={i} style={{position: 'relative', width: 226, height: 320, perspective: 760}}>
            {/* 门后光位：开后显出私有扩展 */}
            <div
              style={{
                position: 'absolute',
                inset: 5,
                borderRadius: 5,
                background: `${theme.deny}1c`,
                border: `1.5px solid ${theme.deny}55`,
                opacity: p,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{fontSize: 15, color: theme.deny, opacity: 0.9}}>私有扩展</span>
            </div>
            {/* 门扇：绕左铰链外开 */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 5,
                background: theme.panel,
                border: `2px solid ${theme.panelBorder}`,
                transformOrigin: 'left center',
                transform: `rotateY(${-76 * p}deg)`,
                backfaceVisibility: 'hidden',
              }}
            >
              <div style={{position: 'absolute', left: 16, right: 16, top: 18, height: 118, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 3}} />
              <div style={{position: 'absolute', left: 16, right: 16, bottom: 18, height: 118, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 3}} />
              <div style={{position: 'absolute', right: 14, top: '47%', width: 6, height: 26, borderRadius: 3, background: theme.dim}} />
            </div>
          </div>
        ))}
      </div>
      <div style={{display: 'flex', flexDirection: 'row', gap: 18}}>
        {['绕开规范', '自己生长'].map((t, i) => (
          <span
            key={t}
            style={{
              fontSize: 15,
              color: theme.dim,
              border: `1.5px solid ${theme.panelBorder}`,
              borderRadius: 999,
              padding: '5px 16px',
              opacity: chips[i],
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
};

/** 5-E 钩子（p5-16）：五张规律卡从各幕方向飞入，悬停一字排开（卡面只见编号一至五）。 */
const FiveLaws: React.FC<{at: number; dur: number}> = ({at, dur}) => {
  const frame = useCurrentFrame();
  const headP = progress(frame, at, DUR.f5);
  const st = useStagger(5, {at: at + 3, dur: DUR.f5, stride: 10});
  const noteP = progress(frame, at + Math.round(dur * 0.62), DUR.f5);
  const nums = ['一', '二', '三', '四', '五'];
  // 各幕来向：左上 / 正上 / 右上 / 左下 / 右下
  const vecs: [number, number][] = [
    [-560, -330],
    [-40, -470],
    [560, -330],
    [-680, 250],
    [680, 250],
  ];
  const rots = [-13, -4, 13, -17, 17];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 46}}>
      <div style={{fontSize: 17, color: theme.dim, letterSpacing: 8, opacity: headP}}>五条规律</div>
      <div style={{display: 'flex', flexDirection: 'row', gap: 34}}>
        {nums.map((n, i) => {
          const p = st[i];
          const float = Math.sin(frame / 26 + i * 1.35) * 3.5 * p; // 悬停微浮（逐卡错相）
          return (
            <div
              key={n}
              style={{
                width: 190,
                height: 248,
                background: theme.panel,
                border: `1.5px solid ${theme.deny}55`,
                borderRadius: 14,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: Math.min(1, p * 1.5),
                transform: `translate(${vecs[i][0] * (1 - p)}px, ${vecs[i][1] * (1 - p) + float}px) rotate(${rots[i] * (1 - p)}deg)`,
              }}
            >
              <div style={{position: 'absolute', left: 14, top: 12, width: 26, height: 3, background: `${theme.deny}88`, borderRadius: 2}} />
              <span style={{fontFamily: theme.serif, fontSize: 64, fontWeight: 700, color: theme.deny}}>{n}</span>
            </div>
          );
        })}
      </div>
      <div style={{fontSize: 16, color: theme.dim, letterSpacing: 3, opacity: noteP}}>答案会浮出来</div>
    </div>
  );
};

export const P5TwoTracks: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p5-01', 'p5-04');
  const bB = w('p5-05', 'p5-08');
  const bC = w('p5-09', 'p5-11');
  const bD = w('p5-12', 'p5-15');
  const bE = w('p5-16');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A 双轨">
        <SceneTag chapter="P5" tagline="交警与年检" accent={theme.deny} />
        {/* p5-01 定位卡（非 cue 句）；p5-02/03 archify 双章同实例独占 */}
        <Sequence from={at('p5-01') - bA.from} durationInFrames={dur('p5-01')}>
          <Stage>
            <ValidatorIntro cardAt={2} sealAt={Math.round(dur('p5-01') * 0.5)} />
          </Stage>
        </Sequence>
        <ArchifyRecap
          slug="dual-track"
          caption="双轨 · 装载/校验"
          cues={[
            {chapterId: 'dt-lenient', at: at('p5-02') - bA.from, durationInFrames: dur('p5-02')},
            {chapterId: 'dt-strict', at: at('p5-03') - bA.from, durationInFrames: dur('p5-03')},
          ]}
        />
        {/* p5-04 两轨并行不悖（非 cue 句） */}
        <Sequence from={at('p5-04') - bA.from} durationInFrames={dur('p5-04')}>
          <Stage>
            <TrackSplit at={2} dur={dur('p5-04')} />
          </Stage>
        </Sequence>
      </Sequence>

      <Sequence {...bB} name="5-B 分歧">
        <SceneTag chapter="P5" tagline="交警与年检" accent={theme.deny} />
        {/* p5-05/06 分歧总卡 → 6=6 徽章（非 cue 句连窗） */}
        <Sequence from={at('p5-05') - bB.from} durationInFrames={dur('p5-05', 'p5-06')}>
          <Stage>
            <DivergenceBoard at={2} badgeAt={at('p5-06') - at('p5-05') + 2} />
          </Stage>
        </Sequence>
        {/* p5-07/08 archify 扩展双章 + 窗外左带侧栏（徽章/对照随句切换） */}
        <ArchifyRecap
          slug="dual-track"
          caption="三方分歧"
          cues={[
            {chapterId: 'dt-ext-b', at: at('p5-07') - bB.from, durationInFrames: dur('p5-07')},
            {chapterId: 'dt-ext-a', at: at('p5-08') - bB.from, durationInFrames: dur('p5-08')},
          ]}
        />
        <Sequence from={at('p5-07') - bB.from} durationInFrames={dur('p5-07')}>
          <FaceBadges at={3} />
        </Sequence>
        <Sequence from={at('p5-08') - bB.from} durationInFrames={dur('p5-08')}>
          <RequiredTable at={3} />
        </Sequence>
      </Sequence>

      <Sequence {...bC} name="5-C 消融">
        <SceneTag chapter="P5" tagline="交警与年检" accent={theme.deny} />
        {/* 与 5-B 的 dt-ext-a 跨 Sequence 逐帧背靠背（dur 含句尾 gap），抑制入场弹簧重放 */}
        <ArchifyRecap
          slug="lifecycle"
          caption="装载路径"
          lead={false}
          cues={[{chapterId: 'lc-load', at: at('p5-09') - bC.from, durationInFrames: dur('p5-09')}]}
        />
        {/* p5-10 年检机进店门：红叉拦下 + 装载面 6→5 */}
        <Sequence from={at('p5-10') - bC.from} durationInFrames={dur('p5-10')}>
          <Stage>
            <GateAtStore at={2} dur={dur('p5-10')} />
          </Stage>
        </Sequence>
        {/* p5-11 金句卡 */}
        <Sequence from={at('p5-11') - bC.from} durationInFrames={dur('p5-11')}>
          <Stage>
            <QuoteCard
              at={2}
              lines={['出厂检验的门', '≠ 店门']}
              subs={[
                {text: '严格 · 保纯净', color: theme.deny},
                {text: '宽容 · 保连通', color: theme.ok},
              ]}
            />
          </Stage>
        </Sequence>
      </Sequence>

      <Sequence {...bD} name="5-D 关门">
        <SceneTag chapter="P5" tagline="交警与年检" accent={theme.deny} />
        {/* p5-12 门上挂牌 */}
        <Sequence from={at('p5-12') - bD.from} durationInFrames={dur('p5-12')}>
          <Stage>
            <DoorPlaque at={2} dur={dur('p5-12')} />
          </Stage>
        </Sequence>
        {/* p5-13 archify 守门哲学 + 窗外左带：51 点排队 / 主线冻结 */}
        <ArchifyRecap
          slug="dual-track"
          caption="守门哲学"
          cues={[{chapterId: 'dt-gate', at: at('p5-13') - bD.from, durationInFrames: dur('p5-13')}]}
        />
        <Sequence from={at('p5-13') - bD.from} durationInFrames={dur('p5-13')}>
          <QueueStrip at={3} dur={dur('p5-13')} />
        </Sequence>
        {/* p5-14 侧门自开 */}
        <Sequence from={at('p5-14') - bD.from} durationInFrames={dur('p5-14')}>
          <Stage>
            <SideDoors at={2} dur={dur('p5-14')} />
          </Stage>
        </Sequence>
        {/* p5-15 金句卡 */}
        <Sequence from={at('p5-15') - bD.from} durationInFrames={dur('p5-15')}>
          <Stage>
            <QuoteCard
              at={2}
              lines={['门关越久', '侧门越多']}
              subs={[{text: '互操作 · 裂缝', color: theme.dim}]}
              crackAt={Math.round(dur('p5-15') * 0.55)}
            />
          </Stage>
        </Sequence>
      </Sequence>

      <Sequence {...bE} name="5-E 钩子">
        <SceneTag chapter="P5" tagline="交警与年检" accent={theme.deny} />
        <Stage>
          <FiveLaws at={2} dur={dur('p5-16')} />
        </Stage>
      </Sequence>
    </AbsoluteFill>
  );
};
