/** 本集 3D 原语层（seeded 档，与 motifs.tsx 严格平行）。
 *
 *  溯源与裁剪（2026-10-03 评审）：本文件随 ep4《并发》整体拷贝建立（V3D 接线），
 *  ep4 专属装置 Rim3D/Socket3D/Plug3D/Drum3D 与其面色常量（SHELL_FACES 等）
 *  在本集零接线，已裁——仅保留本集实际消费的 Slab3D 系；下文宪法中的 ep4 场景
 *  举例（LoopRing 六次出场、5-D 壳等）保留原叙事作为约束出处。
 *
 *  分层理由与 frozen 边界一致：**frozen 的 motion/ 共享「怎么动」（机制），
 *  本层给「画什么的三维形状」（策略）**。故本层：
 *    - 零 useCurrentFrame、零 motion hook、零 import '../motion'；
 *      所有运动量（settle/close/seat/opacity）由调用方以 prop 注入；
 *    - 只读 theme 颜色 token（与 motifs.tsx 同权限）。
 *
 *  ── 三条本集 3D 宪法（改这里之前先读） ─────────────────────────────
 *  ① **只做直角体，不做任何圆/环/曲面**。画面里的「圆」已被 LoopRing 独占
 *     （恒 core 色、恒 6px 线宽、六次出场同形），它是「循环始终不变」这个
 *     主题**被看见**的唯一载体。一旦出现三维的环/球/柱面，读法就变成
 *     「环有两种」，唯一性即失。副作用是工程护栏：元素词表被钉死在
 *     box/edges/lineLoop/basic 材质 —— 恰好等于 PlateSlab3D 已跑通并过
 *     tsc 的那一组，新增 3D **不引入任何新类型面**。
 *  ② **读感来自转物体，不来自动相机**。正交 + zoom:1 下 1 世界单位 = 1 CSS
 *     像素，这是 3D 与 DOM 叠层能手算对位的唯一前提。相机一动，所有 DOM
 *     叠层坐标都要走投影反算（P5Stack 的 BAR_BASE 45 就是这类手算偏移
 *     留下的疤）。故**相机全片零动画**；深度感靠物体静置俯角/偏航。
 *     副产品：没有相机插值就没有浮点累积 ⇒ 无头渲染确定性。
 *  ③ **每个颜色必须是 theme token 字面值或有注释的确定性派生，永不是
 *     「光 × 材质」的运行时乘积**。真光照让最终像素成为运行时乘积——没有
 *     名字、不可 grep、--check-theme 看不见、WCAG 无法预先计算，而
 *     ISSUE-177 教训二（emissive 把点亮层烧成实心橙块、压掉文字对比）正是
 *     这个形态。故本层**零光源、只用 unlit 材质**，明暗靠手写面色梯度。
 *
 *  ── ISSUE-177 教训一写进类型 ────────────────────────────────────────
 *  容器的 position/width 属**调用点契约**，不属被抽取内容。故本层
 *  **没有任何导出会产生带 position 的 DOM 节点**：实体原语一律返回 <group>，
 *  不建画布（画布由 harness-stack 的 ThreeCanvas 承担）。
 */
import React, {useMemo} from 'react';
import * as THREE from 'three';

/** 读色皮肤——「平面语义 → 3D 属性」的唯一载体。
 *  face 大面积**永不**用概念色（core/mech/deny）；概念色只走 edge。 */
export type SolidSkin = {
  /** 面色：不吃光（材质恒 basic） */
  face: string;
  /** 棱线色：概念色只在此出现 */
  edge: string;
  /** 整体不透明度（对应平面档的 dim） */
  opacity?: number;
  /** 棱线不透明度（缺省随 opacity） */
  edgeOpacity?: number;
  /** 正面加权描边：edges 的单像素棱线在暗底读不出 2px border，故正面再叠 lineLoop。缺省 true */
  faceOutline?: boolean;
  /** 半透明壳套住实心内容时必须 true：关 depthWrite，否则内容被壳的深度缓冲剔除 */
  seeThrough?: boolean;
  /** 关掉 box 的 12 条 edges，只留正面轮廓。
   *  ⚠️ 多层嵌套时必须关：N 层 × 每层 4 条 Slab × (12 edges + 1 lineLoop) 的线条密度会
   *  压倒面，整组读成「一堆细线框」而不是「体」（5-D 壳首版实景抽帧的修复）。 */
  noEdges?: boolean;
};

/** 正面轮廓线顶点（矩形四角闭合）：edges 的单像素棱线在暗底不足以读作 2px 描边，
 *  故在正面再叠一圈 lineLoop 加权。 */
const faceOutlineAttrs = (w: number, h: number) => {
  const x = w / 2;
  const y = h / 2;
  return {
    attributes: {
      position: new THREE.BufferAttribute(
        new Float32Array([-x, -y, 0, x, -y, 0, x, y, 0, -x, y, 0]),
        3,
      ),
    },
  };
};

/** 板：box + edges + 正面 lineLoop 的最小实体。
 *  ★ 返回 <group>——不建画布、不设定位、不含文字（文字永不进 3D）。 */
export const Slab3D: React.FC<{
  width: number;
  height: number;
  depth?: number;
  skin: SolidSkin;
  position?: [number, number, number];
  rotation?: [number, number, number];
  renderOrder?: number;
}> = ({width, height, depth = 14, skin, position, rotation, renderOrder}) => {
  const boxGeo = useMemo(
    // ★ 依赖数组刻意不含 frame：几何缓存跨帧复用是无头渲染确定性的一部分
    () => new THREE.BoxGeometry(width, height, depth),
    [width, height, depth],
  );
  const op = skin.opacity ?? 1;
  const eop = skin.edgeOpacity ?? op;
  return (
    <group position={position} rotation={rotation}>
      <mesh renderOrder={renderOrder}>
        <boxGeometry args={[width, height, depth]} />
        {/* basic：面色恒等于给定字面量，不受光（宪法三）。
            半透明壳须关 depthWrite，否则套在里面的实心体会被深度缓冲剔掉 */}
        <meshBasicMaterial
          color={skin.face}
          opacity={op}
          transparent
          depthWrite={skin.seeThrough ? false : undefined}
        />
      </mesh>
      {skin.noEdges ? null : (
        <lineSegments renderOrder={renderOrder}>
          <edgesGeometry args={[boxGeo]} />
          <lineBasicMaterial color={skin.edge} transparent opacity={eop} />
        </lineSegments>
      )}
      {skin.faceOutline === false ? null : (
        <lineLoop position={[0, 0, depth / 2 + 0.5]} renderOrder={renderOrder}>
          <bufferGeometry attach="geometry" {...faceOutlineAttrs(width, height)} />
          <lineBasicMaterial color={skin.edge} transparent opacity={eop} />
        </lineLoop>
      )}
    </group>
  );
};
