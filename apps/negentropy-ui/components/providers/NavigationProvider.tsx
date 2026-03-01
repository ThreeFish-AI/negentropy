"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface NavigationInfo {
  moduleLabel: string;
  pageTitle: string;
}

interface NavigationContextValue {
  navigationInfo: NavigationInfo | null;
  setNavigationInfo: (info: NavigationInfo | null) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return context;
}

interface NavigationProviderProps {
  children: ReactNode;
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const [navigationInfo, setNavigationInfo] = useState<NavigationInfo | null>(
    null,
  );

  return (
    <NavigationContext.Provider value={{ navigationInfo, setNavigationInfo }}>
      {children}
    </NavigationContext.Provider>
  );
}
