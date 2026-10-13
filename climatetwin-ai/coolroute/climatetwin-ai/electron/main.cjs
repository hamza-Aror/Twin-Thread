const { app, BrowserWindow } = require('electron');
const path = require('node:path');

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    title: 'ClimateTwin AI',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (app.isPackaged) {
    window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    window.loadURL('http://127.0.0.1:5173');
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});