import type {
  ModalState,
  Notification,
  UIState,
} from "@/types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface UIStateStore extends UIState {
  // Actions
  setTheme: (theme: "light" | "dark" | "system") => void;
  setLanguage: (language: "zh" | "en") => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  addNotification: (
    notification: Omit<Notification, "id" | "timestamp" | "read">,
  ) => void;
  removeNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
  clearAllNotifications: () => void;
  setModal: (modal: keyof ModalState, open: boolean) => void;
  setLoading: (key: keyof UIState["loading"], value: boolean) => void;
  setError: (key: keyof UIState["errors"], error: string | null) => void;
  clearErrors: () => void;
}

export const useUIStore = create<UIStateStore>()(
  devtools(
    immer((set) => ({
      theme: "system",
      sidebarOpen: true,
      sidebarCollapsed: false,
      language: "zh",
      notifications: [],
      modals: {
        uploadPaper: false,
        paperViewer: false,
        taskDetails: false,
        settings: false,
        confirmDialog: false,
      },
      loading: {
        papers: false,
        tasks: false,
        upload: false,
      },
      errors: {},

      setTheme: (theme) =>
        set((state) => {
          state.theme = theme;
        }),

      setLanguage: (language) =>
        set((state) => {
          state.language = language;
        }),

      toggleSidebar: () =>
        set((state) => {
          state.sidebarOpen = !state.sidebarOpen;
        }),

      setSidebarOpen: (open) =>
        set((state) => {
          state.sidebarOpen = open;
        }),

      setSidebarCollapsed: (collapsed) =>
        set((state) => {
          state.sidebarCollapsed = collapsed;
        }),

      addNotification: (notification) =>
        set((state) => {
          const id = Date.now().toString();
          const newNotification: Notification = {
            ...notification,
            id,
            timestamp: new Date().toISOString(),
            read: false,
          };
          state.notifications.unshift(newNotification);

          if (notification.duration && notification.duration > 0) {
            setTimeout(() => {
              set((s) => {
                s.notifications = s.notifications.filter((n) => n.id !== id);
              });
            }, notification.duration);
          }
        }),

      removeNotification: (id) =>
        set((state) => {
          state.notifications = state.notifications.filter((n) => n.id !== id);
        }),

      markNotificationRead: (id) =>
        set((state) => {
          const notification = state.notifications.find((n) => n.id === id);
          if (notification) {
            notification.read = true;
          }
        }),

      clearAllNotifications: () =>
        set((state) => {
          state.notifications = [];
        }),

      setModal: (modal, open) =>
        set((state) => {
          state.modals[modal] = open;
        }),

      setLoading: (key, value) =>
        set((state) => {
          state.loading[key] = value;
        }),

      setError: (key, error) =>
        set((state) => {
          if (error) {
            state.errors[key] = error;
          } else {
            delete state.errors[key];
          }
        }),

      clearErrors: () =>
        set((state) => {
          state.errors = {};
        }),
    })),
    {
      name: "ui-store",
    },
  ),
);
