const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const APP_URL = process.env.HUBMIND_APP_URL || 'https://hub-mind.netlify.app';
let mainWindow;
let companionWindow;
let tray;
let quitting = false;
const hasSingleInstanceLock = app.requestSingleInstanceLock();
const trustedAppHosts = new Set(['hub-mind.netlify.app']);
const googleAuthHosts = new Set(['accounts.google.com', 'oauth2.googleapis.com', 'identitytoolkit.googleapis.com']);

function isTrustedAppUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && trustedAppHosts.has(url.hostname);
  } catch { return false; }
}

function secureWindowOptions(options = {}) {
  const { webPreferences = {}, ...windowOptions } = options;
  return {
    ...windowOptions,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs'),
      ...webPreferences,
    },
  };
}

function guardNavigation(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' && (googleAuthHosts.has(parsed.hostname) || parsed.hostname.endsWith('.firebaseapp.com') || parsed.hostname.endsWith('.web.app'))) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: secureWindowOptions({ width: 520, height: 720, autoHideMenuBar: true, title: 'Sign in to Hub-Mind' }),
        };
      }
      if (parsed.protocol === 'https:' || parsed.protocol === 'mailto:') shell.openExternal(url);
    } catch {}
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedAppUrl(url)) event.preventDefault();
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow(secureWindowOptions({ width: 1440, height: 940, minWidth: 900, minHeight: 620, backgroundColor: '#080b12', title: 'Hub-Mind', autoHideMenuBar: true, show: false }));
  guardNavigation(mainWindow);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (event) => {
    if (!quitting && process.platform === 'win32') { event.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on('minimize', () => createCompanionWindow());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadURL(APP_URL);
}

function createCompanionWindow() {
  if (companionWindow && !companionWindow.isDestroyed()) { companionWindow.show(); companionWindow.focus(); return; }
  companionWindow = new BrowserWindow(secureWindowOptions({ width: 380, height: 600, minWidth: 320, minHeight: 360, frame: false, transparent: false, resizable: true, alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#080b12', title: 'Jess · Hub-Mind', show: false }));
  guardNavigation(companionWindow);
  companionWindow.once('ready-to-show', () => companionWindow.show());
  companionWindow.on('closed', () => { companionWindow = null; });
  companionWindow.loadURL(APP_URL + '/companion');
}

function showMain() {
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
  else { mainWindow.show(); mainWindow.focus(); }
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'public', 'icon.svg');
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }) : nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('Hub-Mind');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Hub-Mind', click: showMain },
    { label: 'Show Jess companion', click: createCompanionWindow },
    { type: 'separator' },
    { label: 'Quit Hub-Mind', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('double-click', showMain);
}

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) { app.quit(); return; }
  app.on('second-instance', () => showMain());
  if (process.platform === 'win32') app.setAppUserModelId('studios.jaystarbliss.hubmind');
  ipcMain.handle('hubmind:show-main', () => { showMain(); return true; });
  ipcMain.handle('hubmind:show-companion', () => { createCompanionWindow(); return true; });
  ipcMain.handle('hubmind:open-user-path', async (_event, requestedPath) => {
    if (typeof requestedPath !== 'string' || requestedPath.length > 2048 || requestedPath.includes('\0')) throw new Error('Invalid path.');
    const result = await dialog.showMessageBox(mainWindow || companionWindow, {
      type: 'warning', buttons: ['Cancel', 'Open selected path'], defaultId: 0, cancelId: 0,
      title: 'Allow Hub-Mind to open a file or folder?',
      message: 'Open a local path using the Windows default application?',
      detail: 'Only continue if you trust this action. Hub-Mind will not execute the file as a command.',
    });
    if (result.response !== 1) return { opened: false };
    const resolved = path.resolve(requestedPath);
    const error = await shell.openPath(resolved);
    if (error) throw new Error(error);
    return { opened: true };
  });
  createMainWindow();
  createTray();
  app.on('activate', showMain);
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { /* Keep tray and companion available until explicit Quit. */ });
