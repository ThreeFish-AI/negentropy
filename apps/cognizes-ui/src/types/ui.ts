export interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  duration?: number;
  timestamp: string;
  read: boolean;
}

export interface ModalState {
  uploadPaper: boolean;
  paperViewer: boolean;
  taskDetails: boolean;
  settings: boolean;
  confirmDialog: boolean;
}

export interface UIState {
  theme: "light" | "dark" | "system";
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  language: "zh" | "en";
  notifications: Notification[];
  modals: ModalState;
  loading: {
    papers: boolean;
    tasks: boolean;
    upload: boolean;
  };
  errors: {
    papers?: string;
    tasks?: string;
    upload?: string;
  };
}

export interface AppConfig {
  apiBaseUrl: string;
  wsUrl: string;
  maxFileSize: number;
  supportedFormats: string[];
  uploadChunkSize: number;
  autoSaveInterval: number;
  theme: "light" | "dark" | "system";
  language: "zh" | "en";
}
