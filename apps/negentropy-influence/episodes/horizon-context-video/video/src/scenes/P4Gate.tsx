/** P4 门禁装在楼里（分镜 4-A…4-E）
 *  墙上告示反例 → 引擎剖面命名帧 → 双层防线实测 → 出口保险 → 楼界伏笔。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel} from '../components/motifs';
import {CodeWalk, TerminalLog} from '../components/CodeWalk';
import {DUR, progress, useBreathe, useDraw, useImpulse, useProgress, useSpring, useStagger} from '../motion';

/** 4-A 墙上的告示：三个应用各拦一道，小人翻墙 */
const SignOnWall: React.FC<{jumpAt: number}> = ({jumpAt}) => {
  const signs = useStagger(3, {at: 4, stride: 9});
  const frame = useCurrentFrame();
  const jp = progress(frame - jumpAt, 0, 18);
  const labels = ['报表系统', '导出工具', 'AI 应用'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 50}}>
        {labels.map((l, i) => (
          <div key={i} style={{opacity: signs[i]}}>
            <Panel style={{width: 300, padding: '22px 16px', textAlign: 'center'}}>
              <div style={{fontSize: 44}}>{'🚧'}</div>
              <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text, marginTop: 8}}>{l}</div>
              <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.danger, marginTop: 6}}>{'闲人免进'}</div>
            </Panel>
          </div>
        ))}
      </div>
      {/* 翻墙小人 */}
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <rect x={880} y={640} width={160} height={220} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={3} opacity={signs[2]} />
        {jp > 0 ? (
          <g>
            <circle cx={960 + (jp - 0.5) * 420} cy={660 - Math.sin(jp * Math.PI) * 150} r={16} fill={theme.danger} />
            <text x={1120} y={900} fontSize={26} fill={theme.danger} fontFamily={theme.sans} opacity={progress(frame - jumpAt - 12, 0, 10)}>
              {'绕开应用 · 直查原始库'}
            </text>
          </g>
        ) : null}
      </svg>
    </AbsoluteFill>
  );
};

/** 4-B 引擎剖面命名帧：闸机嵌在承重墙里，三类访客同闸 */
const BuildingGate: React.FC = () => {
  const draw = useDraw(4, DUR.f6);
  const gate = useSpring('settle', {at: 34});
  const visitors = useStagger(3, {at: 52, stride: 12});
  const who = ['👤 人', '📊 BI', '🤖 AI'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <rect x={660} y={300} width={600} height={460} rx={14} fill="none" stroke={theme.engine} strokeWidth={5}
          {...draw} />
        {/* 电梯闸机（嵌在墙体） */}
        <rect x={930} y={300} width={60} height={460 * gate} fill={theme.engine} opacity={0.85}
          style={{filter: `drop-shadow(0 0 12px ${theme.engine})`}} />
        <text x={960} y={280} textAnchor="middle" fontSize={30} fill={theme.engine} fontFamily={theme.sans} opacity={gate}>
          {'引擎级闸机'}
        </text>
      </svg>
      <div style={{position: 'absolute', top: 240, width: '100%', textAlign: 'center', fontFamily: theme.serif, fontSize: 44, color: theme.text, opacity: gate}}>
        {'门禁，装进楼里'}
      </div>
      <div style={{position: 'absolute', top: 800, width: '100%', display: 'flex', justifyContent: 'center', gap: 80}}>
        {who.map((v, i) => (
          <div key={i} style={{opacity: visitors[i], transform: `translateY(${(1 - visitors[i]) * 20}px)`}}>
            <Panel style={{padding: '14px 28px'}}>
              <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{v}</div>
            </Panel>
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', bottom: 215, width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: visitors[2]}}>
        {'「治理策略在引擎层执行，不在应用层」—— 官方文档'}
      </div>
    </AbsoluteFill>
  );
};

/** 4-C 双层防线：前台滤卡（体验）+ 闸机拒绝（底线） */
const TwoGates: React.FC<{denyAt: number; leakAt: number}> = ({denyAt, leakAt}) => {
  const desk = useProgress(6, DUR.f5);
  const filter = useProgress(24, DUR.f5);
  const sneak = useProgress(denyAt - 18, 20);
  const deny = useImpulse({at: denyAt, dur: DUR.f5});
  const redLight = useProgress(denyAt, DUR.f4);
  const leak = useProgress(leakAt, DUR.f5);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        {/* 前台 */}
        <rect x={430} y={620} width={280} height={26} rx={8} fill={theme.panelBorder} opacity={desk} />
        <text x={570} y={600} textAnchor="middle" fontSize={24} fill={theme.dim} fontFamily={theme.sans} opacity={desk}>
          {'第一道 · 前台过滤（体验）'}
        </text>
        <rect x={470} y={560} width={200} height={44} rx={8} fill={theme.panel} stroke={theme.panelBorder} opacity={filter}
          transform={`translate(${filter * 130}, ${-filter * 90}) rotate(${filter * -12})`} />
        <text x={570} y={588} textAnchor="middle" fontSize={18} fill={theme.danger} fontFamily={theme.mono} opacity={filter}>
          {'PRIVATE 维度'}
        </text>
        {/* 绕行弧线 + 闸机 */}
        <path d={`M 700 560 Q 950 ${480 - sneak * 80} 1190 560`} stroke={deny > 0 ? theme.danger : theme.dim} strokeWidth={3} fill="none" opacity={sneak} strokeDasharray="7 7" />
        <rect x={1210} y={440} width={40} height={260} rx={6} fill={redLight > 0.3 ? theme.danger : theme.engine}
          style={{filter: `drop-shadow(0 0 ${10 + deny * 30}px ${redLight > 0.3 ? theme.danger : theme.engine})`}} />
        <text x={1230} y={410} textAnchor="middle" fontSize={24} fill={theme.engine} fontFamily={theme.sans} opacity={desk}>
          {'第二道 · 引擎闸机'}
        </text>
        <text x={1230} y={740} textAnchor="middle" fontSize={30} fill={theme.danger} fontFamily={theme.sans} opacity={redLight}>
          {'✗ AccessDenied'}
        </text>
        {/* 反事实泄露 */}
        <g opacity={leak}>
          <rect x={1420} y={480} width={200} height={80} rx={10} fill={theme.panel} stroke={theme.danger} strokeWidth={2} />
          <text x={1520} y={528} textAnchor="middle" fontSize={26} fill={theme.danger} fontFamily={theme.mono}>
            {'[90, 560]'}
          </text>
          <text x={1520} y={596} textAnchor="middle" fontSize={20} fill={theme.danger} fontFamily={theme.sans}>
            {'拆掉闸机 → 泄露'}
          </text>
        </g>
      </svg>
      <div style={{position: 'absolute', bottom: 220, right: 220, fontFamily: theme.sans, fontSize: 20, color: theme.dim, opacity: redLight}}>
        {'本仓原型实测输出 · C2 / D5'}
      </div>
    </AbsoluteFill>
  );
};


/** 4-C 代码走廊 ③：RBAC 三行 + C2 实测 */
const RbacCode: React.FC<{outAt: number}> = ({outAt}) => {
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 40, alignItems: 'stretch'}}>
        <CodeWalk
          width={640}
          caption="本仓 lab · 执行层防线"
          lines={[
            'if metric.visibility == "PRIVATE"',
            '    and role not in PRIVATE_ALLOWED:',
            '    raise AccessDenied(...)',
          ]}
          hi={[
            {line: 0, at: 6, color: theme.engine},
            {line: 1, at: 18, color: theme.engine},
            {line: 2, at: 32, color: theme.danger},
          ]}
        />
        <TerminalLog
          width={520}
          prompt="selftest · 场景 C2"
          caption="本仓原型实测输出 · C2"
          lines={[
            {text: 'intern 直闯执行层', color: theme.dim, at: outAt},
            {text: '→ AccessDenied', color: theme.danger, at: outAt + 10, bold: true},
            {text: '[PASS] C2: 引擎是最后防线', color: theme.ok, at: outAt + 22},
          ]}
        />
      </div>
    </AbsoluteFill>
  );
};

/** 4-D 出口保险：PII 扫描打码 */
const ExitGuard: React.FC<{quoteAt: number}> = ({quoteAt}) => {
  const rise = useProgress(4, DUR.f6);
  const scan = useProgress(20, DUR.f5);
  const mask = useStagger(4, {at: 34, stride: 5});
  const quote = useProgress(quoteAt, DUR.f5);
  const cells = ['本月', '活跃', '用户', '138-xxxx', '共', '1,204', '人', '@邮箱'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: rise, transform: `translateY(${(1 - rise) * 60}px)`}}>
        <Panel style={{width: 860, padding: '30px 40px', position: 'relative'}}>
          <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.text, display: 'flex', gap: 14, flexWrap: 'wrap'}}>
            {cells.map((c, i) => {
              const sensitive = i === 3 || i === 7;
              const m = sensitive ? mask[i - 3] ?? 0 : 1;
              return (
                <span
                  key={i}
                  style={{
                    background: sensitive && m > 0.5 ? theme.danger : 'transparent',
                    color: sensitive && m > 0.5 ? 'transparent' : theme.text,
                    borderRadius: 6,
                    padding: '2px 8px',
                    border: sensitive ? `2px solid ${theme.danger}66` : 'none',
                  }}
                >
                  {c}
                </span>
              );
            })}
          </div>
          {/* 扫描线 */}
          <div style={{position: 'absolute', left: 0, top: 0, width: `${scan * 100}%`, height: 3, background: theme.engine, boxShadow: `0 0 14px ${theme.engine}`}} />
          <div style={{marginTop: 20, fontFamily: theme.sans, fontSize: 20, color: theme.engine, opacity: mask[3]}}>
            {'出口检测 · 脱敏 · 拦截'}
          </div>
        </Panel>
      </div>
      <div style={{position: 'absolute', bottom: 250, fontFamily: theme.serif, fontSize: 40, color: theme.engine, opacity: quote}}>
        {'引擎级的治理，绕不过去。'}
      </div>
    </AbsoluteFill>
  );
};

/** 4-E 楼界伏笔：光圈外失效 */
const BoundaryFog: React.FC = () => {
  const shrink = useProgress(4, DUR.f6);
  const step = useProgress(40, DUR.f5);
  const fade = useBreathe({period: 140});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <circle cx={960} cy={520} r={330 * (1 - shrink * 0.35)} fill="none" stroke={theme.engine} strokeWidth={4}
          opacity={0.8 * (1 - step * 0.5)} style={{filter: `drop-shadow(0 0 ${10 + fade * 8}px ${theme.engine})`}} />
        {/* 光圈外的数据拷贝 */}
        <g transform={`translate(${1250 + step * 220}, 480)`} opacity={step}>
          <rect x={0} y={0} width={130} height={90} rx={10} fill={theme.panel} stroke={theme.danger} strokeWidth={2} />
          <text x={65} y={54} textAnchor="middle" fontSize={30} fill={theme.dim} fontFamily={theme.mono}>{'CSV'}</text>
          <text x={65} y={130} textAnchor="middle" fontSize={20} fill={theme.danger} fontFamily={theme.sans}>
            {'门禁失效区'}
          </text>
        </g>
        {/* 雾 */}
        <text x={500} y={880} fontSize={26} fill={theme.dim} fontFamily={theme.sans} opacity={step * 0.7}>
          {'数据一旦导出楼外……'}
        </text>
      </svg>
      <div style={{position: 'absolute', bottom: 215, width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: step}}>
        {'记住这个伏笔——下一幕之后我们回收它'}
      </div>
    </AbsoluteFill>
  );
};

export const P4Gate: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p4-01', 'p4-05');
  const bB = w('p4-06', 'p4-09');
  const bC = w('p4-10', 'p4-12');
  const bD = w('p4-13', 'p4-16');
  const bE = w('p4-17', 'p4-18');
  const bF = w('p4-19', 'p4-20');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A 墙上告示">
        <SignOnWall jumpAt={at('p4-05') - bA.from} />
      </Sequence>
      <Sequence {...bB} name="4-B 引擎剖面">
        <BuildingGate />
      </Sequence>
      <Sequence {...bC} name="4-C RBAC三行代码">
        <RbacCode outAt={at('p4-11') - bC.from} />
      </Sequence>
      <Sequence {...bD} name="4-D 双层防线">
        <TwoGates denyAt={at('p4-15') - bD.from} leakAt={at('p4-16') - bD.from} />
      </Sequence>
      <Sequence {...bE} name="4-E 出口保险">
        <ExitGuard quoteAt={at('p4-18') - bE.from - 8} />
      </Sequence>
      <Sequence {...bF} name="4-F 楼界伏笔">
        <BoundaryFog />
      </Sequence>
    </AbsoluteFill>
  );
};
