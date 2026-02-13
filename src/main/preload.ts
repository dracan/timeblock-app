import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveDay: (dateStr: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('save-day', dateStr, content),
  loadDay: (dateStr: string): Promise<string | null> =>
    ipcRenderer.invoke('load-day', dateStr),
  getDataDir: (): Promise<string> =>
    ipcRenderer.invoke('get-data-dir'),
});
