import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveDay: (dateStr: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('save-day', dateStr, content),
  loadDay: (dateStr: string): Promise<string | null> =>
    ipcRenderer.invoke('load-day', dateStr),
  getDataDir: (): Promise<string> =>
    ipcRenderer.invoke('get-data-dir'),
  toggleWidget: (): void => {
    ipcRenderer.send('toggle-widget');
  },
  sendActiveEntry: (entry: unknown): void => {
    ipcRenderer.send('active-entry-changed', entry);
  },
  onActiveEntryUpdate: (cb: (entry: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, entry: unknown) => cb(entry);
    ipcRenderer.on('active-entry-update', handler);
    return () => ipcRenderer.removeListener('active-entry-update', handler);
  },
  focusMainWindow: (): void => {
    ipcRenderer.send('focus-main-window');
  },
  onWidgetToggled: (cb: (open: boolean) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, open: boolean) => cb(open);
    ipcRenderer.on('widget-toggled', handler);
    return () => ipcRenderer.removeListener('widget-toggled', handler);
  },
});
