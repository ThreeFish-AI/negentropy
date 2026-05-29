// fCoSE (Fast Compound Spring Embedder) Cytoscape 扩展无官方类型定义。
// 此 shim 提供最小可用 declare，允许通过 cytoscape.use(fcose) 注册。
// 与主站 apps/negentropy-ui/types/cytoscape-fcose.d.ts 保持一致。
// 参考：Dogrusoz et al. (2009) "fCoSE: A Fast Compound Spring Embedder"
declare module "cytoscape-fcose" {
  const fcose: cytoscape.Ext;
  export default fcose;
}
