import { RenderResult, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, vi } from "vitest";

// Define UserEvent type from usage
type UserEvent = ReturnType<typeof userEvent.setup>;

// Enhanced user event setup
export const setupUserEvent = (): UserEvent => {
  return userEvent.setup({
    delay: null,
    advanceTimers: vi.advanceTimersByTime.bind(vi),
  });
};
// ... (skip unchanged lines)

// Timer helpers
export const advanceTimersByTime = (ms: number) => {
  vi.advanceTimersByTime(ms);
};

export const runAllTimers = () => {
  vi.runAllTimers();
};

// Custom screen queries with better error messages
export const queryByTestIdWithText = (testId: string, text?: string) => {
  const element = screen.queryByTestId(testId);
  if (!element) {
    throw new Error(`Element with test-id "${testId}" not found`);
  }
  if (text && !element.textContent?.includes(text)) {
    throw new Error(
      `Element with test-id "${testId}" does not contain text "${text}"`
    );
  }
  return element;
};

export const getByTestIdWithText = (testId: string, text?: string) => {
  const element = screen.getByTestId(testId);
  if (text && !element.textContent?.includes(text)) {
    throw new Error(
      `Element with test-id "${testId}" does not contain text "${text}"`
    );
  }
  return element;
};

// Async wait helpers
export const waitForElementToBeRemoved = (
  element: HTMLElement | (() => HTMLElement | null)
) => {
  return waitFor(() => {
    const el = typeof element === "function" ? element() : element;
    if (el && document.body.contains(el)) {
      throw new Error("Element still in DOM");
    }
  });
};

export const waitForTextToAppear = (text: string, timeout = 5000) => {
  return waitFor(
    () => {
      const element = screen.getByText(text);
      return element;
    },
    { timeout }
  );
};

// Form helpers
export const fillForm = async (
  user: UserEvent,
  fields: Record<string, string | number>
) => {
  for (const [name, value] of Object.entries(fields)) {
    const field =
      screen.getByLabelText(name, { exact: false }) ||
      screen.getByPlaceholderText(name, { exact: false }) ||
      screen.getByRole("textbox", { name });

    await user.clear(field);
    await user.type(field, String(value));
  }
};

export const submitForm = async (
  user: UserEvent,
  submitButtonText = "Submit"
) => {
  const submitButton = screen.getByRole("button", { name: submitButtonText });
  await user.click(submitButton);
};

// File upload helpers
export const uploadFile = async (
  user: UserEvent,
  testId: string,
  file: File
) => {
  const uploadArea = screen.getByTestId(testId);
  const fileInput = within(uploadArea).getByRole("button", {
    hidden: true,
  }) as HTMLInputElement;

  await user.upload(fileInput, file);
};

// Table helpers
export const getTableRow = (rowIndex: number) => {
  const rows = screen.getAllByRole("row");
  if (rowIndex >= rows.length) {
    throw new Error(
      `Row index ${rowIndex} out of bounds. Total rows: ${rows.length}`
    );
  }
  return rows[rowIndex];
};

export const getTableCell = (rowIndex: number, cellIndex: number) => {
  const row = getTableRow(rowIndex);
  const cells = within(row).getAllByRole("cell");
  if (cellIndex >= cells.length) {
    throw new Error(
      `Cell index ${cellIndex} out of bounds. Total cells: ${cells.length}`
    );
  }
  return cells[cellIndex];
};

// Modal helpers
export const expectModalToBeOpen = (title: string) => {
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText(title)).toBeInTheDocument();
};

export const expectModalToBeClosed = () => {
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
};

// Loading and error state helpers
export const expectLoadingState = () => {
  expect(
    screen.getByRole("progressbar") || screen.getByText(/loading/i)
  ).toBeInTheDocument();
};

export const expectErrorState = (errorMessage?: string) => {
  if (errorMessage) {
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  } else {
    expect(
      screen.getByRole("alert") || screen.getByText(/error/i)
    ).toBeInTheDocument();
  }
};

// Toast/notification helpers
export const expectToast = (message: string) => {
  const toast = screen.getByRole("alert") || screen.getByText(message);
  expect(toast).toBeInTheDocument();
};

// Accessibility helpers
export const checkAccessibility = async (container: HTMLElement) => {
  // This would be used with jest-axe
  // import { toHaveNoViolations } from 'jest-axe'
  // expect.extend(toHaveNoViolations)
  // await expect(container).toHaveNoViolations()
};

// Performance test helpers
export const measureRenderTime = async (
  renderFunction: () => RenderResult
): Promise<number> => {
  const start = performance.now();
  await renderFunction();
  const end = performance.now();
  return end - start;
};

// Local storage helpers
export const setLocalStorage = (key: string, value: any) => {
  window.localStorage.setItem(key, JSON.stringify(value));
};

export const getLocalStorage = (key: string) => {
  const item = window.localStorage.getItem(key);
  return item ? JSON.parse(item) : null;
};

export const clearLocalStorage = () => {
  window.localStorage.clear();
};

// Session storage helpers
export const setSessionStorage = (key: string, value: any) => {
  window.sessionStorage.setItem(key, JSON.stringify(value));
};

// Resize observer helper for responsive tests
export const triggerResize = (element: HTMLElement) => {
  const resizeEvent = new Event("resize", {
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(resizeEvent);
  window.dispatchEvent(resizeEvent);
};

// Intersection observer helper for infinite scroll tests
export const triggerIntersection = (
  element: HTMLElement,
  options: IntersectionObserverInit = {}
) => {
  const entries: IntersectionObserverEntry[] = [
    {
      isIntersecting: true,
      target: element,
      intersectionRatio: 1,
      boundingClientRect: element.getBoundingClientRect(),
      intersectionRect: element.getBoundingClientRect(),
      rootBounds: null,
      time: Date.now(),
    },
  ];

  const observer = new IntersectionObserver(() => {}, options);
  // @ts-ignore - Private property access for testing
  observer.callback_(entries, observer);
};

// Timer helpers
// End of test-utils.tsx

// Network helpers
export const mockNetworkError = (url: string | RegExp) => {
  // This would be used with MSW
  // server.use(
  //   rest.get(url, (req, res, ctx) => {
  //     return res.networkError('Network error')
  //   })
  // )
};

// Component state helpers
export const getComponentState = (container: HTMLElement) => {
  // Helper to extract component state for debugging
  return {
    html: container.innerHTML,
    textContent: container.textContent,
    classes: container.className,
    attributes: Array.from(container.attributes).map((attr) => ({
      name: attr.name,
      value: attr.value,
    })),
  };
};
