import { render, RenderOptions } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { ReactElement, ReactNode } from "react";
import { SWRConfig } from "swr";

// Custom providers wrapper
interface AllTheProvidersProps {
  children: ReactNode;
  theme?: string;
}

const AllTheProviders = ({
  children,
  theme = "light",
}: AllTheProvidersProps) => {
  return (
    <ThemeProvider attribute="class" defaultTheme={theme} enableSystem={false}>
      <SWRConfig
        value={{
          provider: () => new Map(),
          revalidateOnFocus: false,
          revalidateOnReconnect: false,
        }}
      >
        {children}
      </SWRConfig>
    </ThemeProvider>
  );
};

// Custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  theme?: string;
  initialRoute?: string;
}

const customRender = (
  ui: ReactElement,
  {
    theme = "light",
    initialRoute = "/",
    ...renderOptions
  }: CustomRenderOptions = {}
) => {
  // Mock Next.js router if needed
  if (initialRoute) {
    window.history.pushState({}, "Test", initialRoute);
  }

  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders theme={theme}>{children}</AllTheProviders>
    ),
    ...renderOptions,
  });
};

// Re-export everything from testing-library
export * from "@testing-library/react";
export { customRender as render };

// Custom render without providers for isolated component tests
export const renderWithoutProviders = (
  ui: ReactElement,
  options?: RenderOptions
) => render(ui, options);

// Helper to wait for next tick
export const waitForNextTick = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

// Helper to create mock props
export const createMockProps = <T extends Record<string, any>>(
  defaultProps: T,
  overrides: Partial<T> = {}
): T => ({ ...defaultProps, ...overrides });

import { vi } from "vitest";

// Helper to mock async functions
export const createMockAsyncFn = <T extends any[], R>(
  implementation?: (...args: T) => Promise<R>
) => vi.fn().mockImplementation(implementation || (() => Promise.resolve({})));
