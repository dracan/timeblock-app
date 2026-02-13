export interface TimeEntry {
  id: string;
  title: string;
  startMinutes: number; // minutes from midnight
  endMinutes: number;   // minutes from midnight
  color: string;        // hex color
}

export interface ElectronAPI {
  saveDay: (dateStr: string, content: string) => Promise<boolean>;
  loadDay: (dateStr: string) => Promise<string | null>;
  getDataDir: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
