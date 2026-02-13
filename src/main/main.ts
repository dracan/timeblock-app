import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;

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

  mainWindow.on('closed', () => {
    mainWindow = null;
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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
