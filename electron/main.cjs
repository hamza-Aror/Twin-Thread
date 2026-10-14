const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

const PROJECT_URL = 'https://github.com/hamza-Aror/Twin-Thread/';
const OVERPASS_ENDPOINTS = new Set([
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]);

const COOLDOWN_MS = 30_000;
const blockedUntilByEndpoint = new Map();
let requestInProgress = false;

ipcMain.handle('overpass:request', async (event, input) => {
  const senderUrl = event.senderFrame?.url ?? '';

  const trustedRenderer = app.isPackaged
    ? senderUrl.startsWith('file://') && senderUrl.includes('/dist/index.html')
    : senderUrl.startsWith('http://127.0.0.1:5173/');

  if (!trustedRenderer) {
    throw new Error('Blocked Overpass request from an untrusted renderer.');
  }

  const endpoint = input?.endpoint;
  const query = input?.query;
  const suppliedTimeout = Number(input?.timeoutMs);

  if (
    typeof endpoint !== 'string' ||
    !OVERPASS_ENDPOINTS.has(endpoint) ||
    typeof query !== 'string' ||
    !query.startsWith('[out:json]') ||
    query.length > 50_000
  ) {
    return { status: 400, body: 'Invalid Overpass request.' };
  }

  const endpointBlockedUntil =
  blockedUntilByEndpoint.get(endpoint) ?? 0;

if (Date.now() < endpointBlockedUntil) {
  return {
    status: 429,
    body: 'This map data endpoint is cooling down. Please wait before retrying.',
  };
}

  if (requestInProgress) {
    return {
      status: 429,
      body: 'A map data request is already in progress. Please wait.',
    };
  }

  requestInProgress = true;

  const controller = new AbortController();
  const timeoutMs = Number.isFinite(suppliedTimeout)
    ? Math.min(Math.max(suppliedTimeout, 1000), 30_000)
    : 25_000;

  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': `CoolRoute/${app.getVersion()} (+${PROJECT_URL})`,
        Referer: PROJECT_URL,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    const body = await response.text();

    if (response.status === 429) {
  blockedUntilByEndpoint.set(
    endpoint,
    Date.now() + COOLDOWN_MS,
  );
}

    return { status: response.status, body };
  } catch {
    if (controller.signal.aborted) {
      return { status: 504, body: 'The map data request timed out.' };
    }

    return { status: 503, body: 'Could not reach the map data service.' };
  } finally {
    clearTimeout(timer);
    requestInProgress = false;
  }
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    title: 'CoolRoute',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
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