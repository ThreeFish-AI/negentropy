// fCoSE (Fast Compound Spring Embedder) Cytoscape 扩展无官方类型定义
// 此 shim 文件提供最小可用 declare，允许通过 cytoscape.use(fcose) 注册。
// 参考：Dogrusoz et al. (2009) "fCoSE: A Fast Compound Spring Embedder"
declare module "cytoscape-fcose" {
  const fcose: cytoscape.Ext;
  export default fcose;
}
