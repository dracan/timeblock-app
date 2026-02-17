import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let widgetWindow: BrowserWindow | null = null;
let lastActiveEntry: unknown = null;

function getDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'days');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 900,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Time Blocker',
    autoHideMenuBar: true,
  });

  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && !input.shift && !input.alt && input.key === '=') {
      const current = mainWindow!.webContents.getZoomLevel();
      mainWindow!.webContents.setZoomLevel(current + 0.5);
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (widgetWindow) {
      widgetWindow.close();
      widgetWindow = null;
    }
  });
}

function createWidgetWindow(): void {
  const { workAreaSize } = screen.getPrimaryDisplay();
  const width = 300;
  const height = 80;

  widgetWindow = new BrowserWindow({
    width,
    height,
    x: workAreaSize.width - width - 16,
    y: workAreaSize.height - height - 16,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    widgetWindow.loadURL('http://localhost:5173/widget.html');
  } else {
    widgetWindow.loadFile(path.join(__dirname, '..', 'renderer', 'widget.html'));
  }

  widgetWindow.webContents.on('did-finish-load', () => {
    if (widgetWindow && lastActiveEntry !== null) {
      widgetWindow.webContents.send('active-entry-update', lastActiveEntry);
    }
  });

  widgetWindow.on('closed', () => {
    widgetWindow = null;
    if (mainWindow) {
      mainWindow.webContents.send('widget-toggled', false);
    }
  });
}

// IPC handlers for file persistence
ipcMain.handle('save-day', async (_event, dateStr: string, content: string) => {
  const filePath = path.join(getDataDir(), `${dateStr}.md`);
  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('load-day', async (_event, dateStr: string) => {
  const filePath = path.join(getDataDir(), `${dateStr}.md`);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return null;
});

ipcMain.handle('get-data-dir', async () => {
  return getDataDir();
});

ipcMain.on('toggle-widget', () => {
  if (widgetWindow) {
    widgetWindow.close();
    // widgetWindow nulled in 'closed' handler
  } else {
    createWidgetWindow();
    if (mainWindow) {
      mainWindow.webContents.send('widget-toggled', true);
    }
  }
});

ipcMain.on('focus-main-window', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.on('active-entry-changed', (_event, entry) => {
  lastActiveEntry = entry;
  if (widgetWindow) {
    widgetWindow.webContents.send('active-entry-update', entry);
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
