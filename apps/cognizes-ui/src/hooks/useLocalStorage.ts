import type { PaperFilters } from "@/types";
import { useCallback, useEffect, useState } from "react";

// 通用 localStorage hook
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  // 从 localStorage 获取初始值
  const readValue = useCallback((): T => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  // 设置值的函数
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        if (typeof window === "undefined") {
          return;
        }
        const newValue = value instanceof Function ? value(storedValue) : value;
        window.localStorage.setItem(key, JSON.stringify(newValue));
        setStoredValue(newValue);
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue],
  );

  // 删除值的函数
  const removeValue = useCallback(() => {
    try {
      if (typeof window === "undefined") {
        return;
      }
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  // 监听其他标签页的变化
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          console.warn(`Error parsing stored value for key "${key}":`, error);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key]);

  return [storedValue, setValue, removeValue];
}

// 论文筛选器 hook
export function usePaperFilters() {
  return useLocalStorage<PaperFilters>("paper-filters", {
    search: "",
    category: "all",
    status: "all",
    sortBy: "uploadedAt",
    sortOrder: "desc",
  });
}

// 搜索历史 hook
export function useSearchHistory() {
  const [history, setHistory, clearHistory] = useLocalStorage<string[]>(
    "search-history",
    [],
  );

  const addToHistory = useCallback(
    (query: string) => {
      if (!query.trim()) return;

      setHistory((prevHistory) => {
        // 移除重复项并添加到开头
        const filtered = prevHistory.filter((item) => item !== query);
        const newHistory = [query, ...filtered];
        // 限制历史记录数量
        return newHistory.slice(0, 20);
      });
    },
    [setHistory],
  );

  const removeFromHistory = useCallback(
    (query: string) => {
      setHistory((prevHistory) => prevHistory.filter((item) => item !== query));
    },
    [setHistory],
  );

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
  };
}

// 最近查看的论文 hook
export function useRecentPapers() {
  const [recentPapers, setRecentPapers] = useLocalStorage<string[]>(
    "recent-papers",
    [],
  );

  const addRecentPaper = useCallback(
    (paperId: string) => {
      setRecentPapers((prev) => {
        // 移除重复项并添加到开头
        const filtered = prev.filter((id) => id !== paperId);
        const newRecent = [paperId, ...filtered];
        // 限制数量为 10
        return newRecent.slice(0, 10);
      });
    },
    [setRecentPapers],
  );

  const removeRecentPaper = useCallback(
    (paperId: string) => {
      setRecentPapers((prev) => prev.filter((id) => id !== paperId));
    },
    [setRecentPapers],
  );

  return {
    recentPapers,
    addRecentPaper,
    removeRecentPaper,
  };
}

// 用户偏好设置 hook
export function useUserPreferences() {
  const [preferences, setPreferences] = useLocalStorage("user-preferences", {
    language: "zh" as "zh" | "en",
    theme: "system" as "light" | "dark" | "system",
    pageSize: 20 as number,
    autoSave: true as boolean,
    showNotifications: true as boolean,
    compactMode: false as boolean,
  });

  const updatePreference = useCallback(
    <K extends keyof typeof preferences>(
      key: K,
      value: (typeof preferences)[K],
    ) => {
      setPreferences((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    [setPreferences],
  );

  return {
    preferences,
    updatePreference,
  };
}

// 表格列设置 hook
export function useTableColumns(tableId: string) {
  const [columns, setColumns] = useLocalStorage(`${tableId}-columns`, {
    // 默认列配置
    visible: {} as Record<string, boolean>,
    order: [] as string[],
    widths: {} as Record<string, number>,
  });

  const toggleColumn = useCallback(
    (columnId: string) => {
      setColumns((prev) => ({
        ...prev,
        visible: {
          ...prev.visible,
          [columnId]: !prev.visible[columnId],
        },
      }));
    },
    [setColumns],
  );

  const setColumnOrder = useCallback(
    (order: string[]) => {
      setColumns((prev) => ({
        ...prev,
        order,
      }));
    },
    [setColumns],
  );

  const setColumnWidth = useCallback(
    (columnId: string, width: number) => {
      setColumns((prev) => ({
        ...prev,
        widths: {
          ...prev.widths,
          [columnId]: width,
        },
      }));
    },
    [setColumns],
  );

  return {
    columns,
    toggleColumn,
    setColumnOrder,
    setColumnWidth,
  };
}

// 下载队列 hook
export function useDownloadQueue() {
  const [queue, setQueue] = useLocalStorage<{
    items: Array<{
      id: string;
      type: "paper" | "batch";
      status: "pending" | "downloading" | "completed" | "failed";
      progress: number;
      url?: string;
      error?: string;
    }>;
  }>("download-queue", { items: [] });

  const addToQueue = useCallback(
    (id: string, type: "paper" | "batch") => {
      setQueue((prev) => ({
        items: [
          ...prev.items,
          {
            id,
            type,
            status: "pending",
            progress: 0,
          },
        ],
      }));
    },
    [setQueue],
  );

  const updateItem = useCallback(
    (id: string, updates: Partial<(typeof queue.items)[0]>) => {
      setQueue((prev) => ({
        items: prev.items.map((item) =>
          item.id === id ? { ...item, ...updates } : item,
        ),
      }));
    },
    [setQueue, queue],
  );

  const removeFromQueue = useCallback(
    (id: string) => {
      setQueue((prev) => ({
        items: prev.items.filter((item) => item.id !== id),
      }));
    },
    [setQueue],
  );

  const clearQueue = useCallback(() => {
    setQueue({ items: [] });
  }, [setQueue]);

  return {
    queue: queue.items,
    addToQueue,
    updateItem,
    removeFromQueue,
    clearQueue,
  };
}

// 缓存管理 hook
export function useCache() {
  const getCached = useCallback(<T>(key: string): T | null => {
    try {
      if (typeof window === "undefined") {
        return null;
      }
      const item = window.localStorage.getItem(`cache-${key}`);
      if (!item) return null;

      const { data, timestamp, ttl } = JSON.parse(item);
      const now = Date.now();

      // 检查是否过期
      if (ttl && now - timestamp > ttl) {
        window.localStorage.removeItem(`cache-${key}`);
        return null;
      }

      return data;
    } catch {
      return null;
    }
  }, []);

  const setCached = useCallback(<T>(key: string, data: T, ttl?: number) => {
    try {
      if (typeof window === "undefined") {
        return;
      }
      const item = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      window.localStorage.setItem(`cache-${key}`, JSON.stringify(item));
    } catch (error) {
      console.warn(`Error caching data for key "${key}":`, error);
    }
  }, []);

  const removeCached = useCallback((key: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(`cache-${key}`);
    }
  }, []);

  const clearCache = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const keys = Object.keys(window.localStorage);
    keys.forEach((key) => {
      if (key.startsWith("cache-")) {
        window.localStorage.removeItem(key);
      }
    });
  }, []);

  return {
    getCached,
    setCached,
    removeCached,
    clearCache,
  };
}

// 导出所有 hooks
export { useLocalStorage as default };
