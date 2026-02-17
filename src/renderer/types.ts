export interface TimeEntry {
  id: string;
  title: string;
  startMinutes: number; // minutes from midnight
  endMinutes: number;   // minutes from midnight
  color: string;        // hex color
  done?: boolean;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
}

export interface ElectronAPI {
  saveDay: (dateStr: string, content: string) => Promise<boolean>;
  loadDay: (dateStr: string) => Promise<string | null>;
  getDataDir: () => Promise<string>;
  toggleWidget: () => void;
  sendActiveEntry: (entry: TimeEntry | null) => void;
  onActiveEntryUpdate: (cb: (entry: TimeEntry | null) => void) => () => void;
  focusMainWindow: () => void;
  widgetDragStart: (screenX: number, screenY: number) => void;
  widgetDragMove: (screenX: number, screenY: number) => void;
  widgetDragEnd: () => void;
  onWidgetToggled: (cb: (open: boolean) => void) => () => void;
  checkForUpdate: () => Promise<UpdateInfo | null>;
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
