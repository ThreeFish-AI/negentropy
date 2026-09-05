/** LottieEmphasis——装饰强调资产的统一入口（C 轨：形状归 Lottie、文字归 Remotion）。
 *
 * 职责（调研文档 D3 结论的工程化，见 docs/research/video-production/160 号 §5.3）：
 *  1. 加载：delayRender + fetch(staticFile) + continueRender——渲染确定性不靠网络时钟；
 *  2. 结构断言（违约 cancelRender）：无 fonts/chars、无文本图层、无表达式——Lottie 文本双轨
 *     与表达式 seek 在无头渲染下不可靠，准入即拦；
 *  3. 时长归一：getLottieMetadata 现读 w/h/fr/op（fresh-derive，不落第二事实源），
 *     duration 只作上限钳制；playbackRate 恒 1（拉伸旋钮留给未来真资产）。
 *
 * ⚠️ 当前仓内唯一资产为手工占位（见 public/lottie/README.md），待设计工具同名替换。
 */
import React, {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender, Sequence, staticFile} from 'remotion';
import {getLottieMetadata, Lottie} from '@remotion/lottie';
import type {LottieAnimationData} from '@remotion/lottie';

/** 违约即整片渲染失败：资产准入是契约不是建议。 */
const assertAsset = (data: unknown): LottieAnimationData => {
  const d = data as Record<string, unknown>;
  if (typeof d !== 'object' || d === null || Array.isArray(d)) {
    cancelRender('LottieEmphasis: 资产不是 JSON 对象');
  }
  if ('fonts' in d) {
    cancelRender('LottieEmphasis: 资产含 fonts（文字必须留 Remotion，见 public/lottie/README.md 契约）');
  }
  if ('chars' in d) {
    cancelRender('LottieEmphasis: 资产含 chars 字形轮廓（体积爆炸且不可编辑，见契约）');
  }
  const layers = d.layers;
  if (!Array.isArray(layers)) {
    cancelRender('LottieEmphasis: 资产无 layers');
  }
  for (const layer of layers) {
    const l = layer as Record<string, unknown>;
    if (l.ty === 5) {
      cancelRender(`LottieEmphasis: 图层 ${String(l.nm)} 是文本层（ty=5）`);
    }
  }
  // 表达式 = 可动画属性对象（有 a/k）上出现字符串型 x 键；关键帧切线 i/o 内的
  // 数值 x/y 不在此列。表达式经 goToAndStop 逐帧寻址可能非确定性闪烁。
  const hasExpression = (node: unknown): boolean => {
    if (Array.isArray(node)) {
      return node.some(hasExpression);
    }
    if (typeof node !== 'object' || node === null) {
      return false;
    }
    const o = node as Record<string, unknown>;
    if ('k' in o && 'x' in o && typeof o.x === 'string') {
      return true;
    }
    return Object.values(o).some(hasExpression);
  };
  if (hasExpression(layers) || hasExpression(d.shapes)) {
    cancelRender('LottieEmphasis: 资产含表达式（确定性红线）');
  }
  return d as unknown as LottieAnimationData;
};

export const LottieEmphasis: React.FC<{
  /** staticFile 相对路径，如 'lottie/plug-pulse.json' */
  src: string;
  /** 句边界锚（本组件所在 Sequence 的局部帧）——沿用「禁写死帧数」纪律 */
  at: number;
  /** 播放窗上限（帧）；缺省取资产时长，超出资产时长的部分不会播放 */
  duration?: number;
  style?: React.CSSProperties;
}> = ({src, at, duration, style}) => {
  const [handle] = useState(() => delayRender(`LottieEmphasis:${src}`));
  const [data, setData] = useState<LottieAnimationData | null>(null);

  useEffect(() => {
    fetch(staticFile(src))
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        setData(assertAsset(json));
        continueRender(handle);
      })
      .catch((err: unknown) => {
        cancelRender(new Error(`LottieEmphasis: 加载 ${src} 失败——${String(err)}`));
      });
  }, [src, handle]);

  if (!data) {
    return null;
  }
  const meta = getLottieMetadata(data);
  if (!meta) {
    cancelRender('LottieEmphasis: 资产缺 w/h/fr/op，无法现读时长');
  }
  const assetFrames = meta.durationInFrames;
  const playFrames = Math.max(1, Math.floor(Math.min(duration ?? assetFrames, assetFrames)));
  return (
    <Sequence from={at} durationInFrames={playFrames} layout="none" name={`lottie:${src}`}>
      <Lottie animationData={data} loop={false} direction="forward" playbackRate={1} style={style} />
    </Sequence>
  );
};
