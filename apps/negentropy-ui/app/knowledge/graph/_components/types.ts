export interface GraphCanvasNode {
  id: string;
  label?: string;
  type?: string;
  importance?: number | null;
  community_id?: number | null;
}

export interface GraphCanvasEdge {
  source: string;
  target: string;
  type?: string;
}

export interface NodeHoverInfo {
  nodeId: string;
  x: number;
  y: number;
}

export interface GraphCanvasProps {
  corpusId: string;
  nodes: GraphCanvasNode[];
  edges: GraphCanvasEdge[];
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  asOf?: string | null;
  onSubgraphMerge?: (
    nodes: GraphCanvasNode[],
    edges: GraphCanvasEdge[],
  ) => void;
  truncateThreshold?: number;
  onNodeHover?: (info: NodeHoverInfo | null) => void;
}
