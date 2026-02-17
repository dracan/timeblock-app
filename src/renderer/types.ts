export interface TimeEntry {
  id: string;
  title: string;
  startMinutes: number; // minutes from midnight
  endMinutes: number;   // minutes from midnight
  color: string;        // hex color
  done?: boolean;
}

export interface ElectronAPI {
  saveDay: (dateStr: string, content: string) => Promise<boolean>;
  loadDay: (dateStr: string) => Promise<string | null>;
  getDataDir: () => Promise<string>;
  toggleWidget: () => void;
  sendActiveEntry: (entry: TimeEntry | null) => void;
  onActiveEntryUpdate: (cb: (entry: TimeEntry | null) => void) => () => void;
  focusMainWindow: () => void;
  onWidgetToggled: (cb: (open: boolean) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
