/**
 * UI 状态管理 Hook
 *
 * 从 app/page.tsx HomeBody 组件提取的 UI 状态管理逻辑
 */

import { useState, useCallback } from "react";

export function useUIState() {
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);

  const toggleLeftPanel = useCallback(() => {
    setShowLeftPanel((prev) => !prev);
  }, []);

  const toggleRightPanel = useCallback(() => {
    setShowRightPanel((prev) => !prev);
  }, []);

  return {
    showLeftPanel,
    showRightPanel,
    toggleLeftPanel,
    toggleRightPanel,
    setShowLeftPanel,
    setShowRightPanel,
  };
}
