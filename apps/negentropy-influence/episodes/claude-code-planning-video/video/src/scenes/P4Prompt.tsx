/** P4 指令按实况拼装（p4-01..p4-21，7 镜）——分镜 4-A…4-G。
 *  挂点④回照（panorama pan-m4）→ 每日菜单意象三拍（原生，失配句角标）→
 *  货架三章（pc2-prompt-shelf）→ 走查命中（pc2-prompt-cache cache-hit）→
 *  拼串做键（cache-fingerprint）→ 键污染消融（cache-dirty）→ 两层缓存双栏收尾（原生）。
 *  空间契约：菜单意象不覆盖分段维护（失配句在场）；双层缓存图本地层左、服务端层右。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {HoldRevive} from '../components/HoldRevive';
import {DUR, useProgress, useStagger} from '../motion';

const BADGE_STYLE: React.CSSProperties = {top: 64};

/** 4-B 每日菜单三拍：招牌菜恒印 / 时令菜看货 / 昨天那页复用（=缓存）——登记表类比带失配句角标。
 *  锚位对齐口播：拍三「这就是缓存」=p4-05 结尾逐字 → 锚 at05；失配句角标=p4-06。 */
const MenuAnalogy: React.FC<{at04: number; at05: number; at06: number}> = ({at04, at05, at06}) => {
  const p1 = useStagger(2, {at: at04, dur: DUR.f4, stride: DUR.f2});
  const p2 = useProgress(at05, DUR.f5); // 拍二记忆段点亮与拍三缓存复用同锚 p4-05
  const edge = useProgress(at06, DUR.f5);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 菜单页主体 */}
      <div
        style={{
          position: 'absolute',
          left: 660,
          top: 220,
          width: 600,
          padding: '36px 44px',
          borderRadius: 14,
          background: theme.panel,
          border: `1px solid ${theme.panelBorder}`,
          transform: `rotate(-1.2deg)`,
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 30, color: theme.text, letterSpacing: 6, marginBottom: 26}}>
          {'每 日 菜 单'}
        </div>
        {/* 拍一：招牌菜恒印 */}
        <div style={{opacity: p1[0] ?? 0, marginBottom: 18}}>
          <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, letterSpacing: 3}}>
            {'招牌 · 永远印'}
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 27, color: theme.core, marginTop: 6}}>
            {'身份 · 工具 · 工作区'}
          </div>
        </div>
        {/* 拍二：时令菜看货（记忆段） */}
        <div style={{opacity: (p1[1] ?? 0) * p2, marginBottom: 18}}>
          <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, letterSpacing: 3}}>
            {'时令 · 看货'}
          </div>
          <div
            style={{
              fontFamily: theme.serif,
              fontSize: 27,
              marginTop: 6,
              color: p2 > 0.5 ? theme.mech : theme.dim,
              textDecoration: p2 > 0.5 ? 'none' : 'line-through',
            }}
          >
            {'记忆段（文件在才印）'}
          </div>
        </div>
        {/* 拍三：昨天那页复用（缓存）——「这就是缓存」为 p4-05 结尾逐字口播 */}
        <div style={{opacity: p2}}>
          <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, letterSpacing: 3}}>
            {'没变 · 复用昨页'}
          </div>
          <div
            style={{
              marginTop: 10,
              padding: '8px 18px',
              borderRadius: 8,
              border: `1px dashed ${theme.ok}88`,
              fontFamily: theme.sans,
              fontSize: 22,
              color: theme.ok,
              display: 'inline-block',
            }}
          >
            {'这就是缓存'}
          </div>
        </div>
      </div>
      {/* 失配句角标（类比纪律） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 170,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 19,
          color: theme.dim,
          letterSpacing: 2,
          opacity: edge,
        }}
      >
        {'类比边界 · 不含 分段维护 / 服务端缓存'}
      </div>
    </AbsoluteFill>
  );
};

/** 4-G 两层缓存双栏：本地拼串层（左）vs 服务端前缀层（右）——开头不变才能按开头复用 */
const TwoLayerCache: React.FC<{at20: number; at20b: number}> = ({at20, at20b}) => {
  const left = useProgress(at20, DUR.f5);
  const right = useProgress(at20b, DUR.f5);
  const col = (title: string, sub: string, body: string, tone: string, vis: number, dashed: boolean) => (
    <div
      style={{
        width: 560,
        padding: '26px 32px',
        borderRadius: 12,
        background: theme.panel,
        border: `1px solid ${dashed ? `${tone}88` : theme.panelBorder}`,
        opacity: vis,
        borderStyle: dashed ? 'dashed' : 'solid',
      }}
    >
      <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, letterSpacing: 3}}>{title}</div>
      <div style={{fontFamily: theme.serif, fontSize: 27, color: tone, marginTop: 10}}>{sub}</div>
      <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.text, marginTop: 16, lineHeight: 1.8}}>{body}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 210, top: 320, display: 'flex', gap: 80}}>
        {col('第一层 · 本地', '拼串的功夫', '状态没变 → 不重拼那页', theme.mech, left, false)}
        {col('第二层 · 服务端', '前缀的重算', '开头不变 → 按开头复用', theme.core, right, true)}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 190,
          width: 1920,
          textAlign: 'center',
          opacity: right,
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.dim,
          letterSpacing: 2,
        }}
      >
        {'两码事 —— 各省各的账'}
      </div>
    </AbsoluteFill>
  );
};

export const P4Prompt: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p4-01', 'p4-03');
  const bB = w('p4-04', 'p4-06');
  const bC = w('p4-07', 'p4-09b');
  const bD = w('p4-10', 'p4-13');
  const bE = w('p4-14', 'p4-15');
  const bF = w('p4-16', 'p4-19');
  const bG = w('p4-20', 'p4-21');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="4-A 挂点④回照">
        {/* 幕界背靠背：3-E cost-ruling 末帧紧接本实例首帧（gap=0），lead={false} 抑制重放入场弹簧 */}
        <ArchifyRecap slug="pc2-panorama" caption="挂点④ · 指令组装" lead={false} cues={[
          {chapterId: 'pan-m4', at: at('p4-01') - bA.from, durationInFrames: dur('p4-01') + dur('p4-02') + dur('p4-03')},
        ]} />
        <HoldRevive at={at('p4-01') - bA.from + 97} points={['堆一段 · 重写 · 怕碰坏', '指令 = 运行时配置']} />
      </Sequence>

      <Sequence {...bB} name="4-B 每日菜单三拍">
        <MenuAnalogy at04={0} at05={at('p4-05') - bB.from} at06={at('p4-06') - bB.from} />
      </Sequence>

      <Sequence {...bC} name="4-C 货架三章">
        <ArchifyRecap slug="pc2-prompt-shelf" caption="垫纸的拼法" cues={[
          {chapterId: 'shelf-sections', at: at('p4-07') - bC.from, durationInFrames: dur('p4-07'), fit: 'trim'},
          {chapterId: 'shelf-state', at: at('p4-08') - bC.from, durationInFrames: dur('p4-08') + dur('p4-09')},
          {chapterId: 'shelf-split', at: at('p4-09b') - bC.from, durationInFrames: dur('p4-09b')},
        ]} />
        <HoldRevive at={at('p4-08') - bC.from + 136} points={['三段恒在：身份类 · 工具类 · 工作区类', '记忆段 · 查文件存续', '判据皆可查 · 非字面匹配']} />
      </Sequence>

      <Sequence {...bD} name="4-D 走查命中">
        {/* 跨图背靠背（4-C shelf-split 尾→本章首章）：lead={false} */}
        <ArchifyRecap slug="pc2-prompt-cache" caption="缓存键" lead={false} cues={[
          {chapterId: 'cache-hit', at: at('p4-10') - bD.from, durationInFrames: dur('p4-10') + dur('p4-11') + dur('p4-12') + dur('p4-13')},
        ]} />
        <HoldRevive at={at('p4-10') - bD.from + 134} points={['原状态 · 命中 · 直返', '文件一建 · 三段变四段']} />
      </Sequence>

      <Sequence {...bE} name="4-E 拼串做键">
        {/* 跨镜背靠背（4-D 尾章→本章首章）：lead={false} */}
        <ArchifyRecap slug="pc2-prompt-cache" caption="缓存键" lead={false} cues={[
          {chapterId: 'cache-fingerprint', at: at('p4-14') - bE.from, durationInFrames: dur('p4-14') + dur('p4-15')},
        ]} />
        <HoldRevive at={at('p4-14') - bE.from + 175} points={['状态拼串 · 同状态同串', '弃自带编号 · 免换运行即变']} />
      </Sequence>

      <Sequence {...bF} name="4-F 键污染消融">
        {/* 同图跨镜背靠背（4-E 尾→本章首章）：lead={false} */}
        <ArchifyRecap slug="pc2-prompt-cache" caption="缓存键" lead={false} cues={[
          {chapterId: 'cache-dirty', at: at('p4-16') - bF.from, durationInFrames: dur('p4-16') + dur('p4-17') + dur('p4-18') + dur('p4-19')},
        ]} />
      </Sequence>

      <Sequence {...bG} name="4-G 两层缓存双栏">
        <TwoLayerCache at20={at('p4-20') - bG.from} at20b={at('p4-20b') - bG.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
