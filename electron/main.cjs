const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, dialog, session, desktopCapturer } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { execFile } = require('node:child_process');

const APP_URL = process.env.HUBMIND_APP_URL || 'https://hub-mind.netlify.app';
let mainWindow;
let companionWindow;
let tray;
let quitting = false;
let companionHiddenByUser = false;
const trustedAppHosts = new Set(['hub-mind.netlify.app']);
const googleAuthHosts = new Set(['accounts.google.com', 'oauth2.googleapis.com', 'identitytoolkit.googleapis.com']);
const WINDOWS_APPS = Object.freeze({ calculator: 'calc.exe', notepad: 'notepad.exe', paint: 'mspaint.exe', explorer: 'explorer.exe', taskManager: 'taskmgr.exe' });
const READ_ONLY_COMMANDS = Object.freeze({ ipconfig: ['ipconfig.exe', []], systemInfo: ['systeminfo.exe', []], runningProcesses: ['tasklist.exe', []], diskSpace: ['wmic.exe', ['logicaldisk', 'get', 'caption,freespace,size']] });

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
  mainWindow.on('close', () => { /* Close the workspace window; Jess remains available from the tray. */ });
  mainWindow.on('minimize', () => createCompanionWindow());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadURL(APP_URL);
}

function createCompanionWindow() {
  companionHiddenByUser = false;
  if (companionWindow && !companionWindow.isDestroyed()) { companionWindow.show(); companionWindow.focus(); return; }
  companionWindow = new BrowserWindow(secureWindowOptions({ width: 116, height: 116, minWidth: 116, minHeight: 116, maxWidth: 116, maxHeight: 116, frame: false, transparent: true, resizable: false, alwaysOnTop: true, skipTaskbar: true, hasShadow: false, backgroundColor: '#00000000', title: 'Jess · Hub-Mind', show: false }));
  guardNavigation(companionWindow);
  companionWindow.setAlwaysOnTop(true, 'screen-saver');
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
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
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
  ipcMain.handle('hubmind:show-main', () => { showMain(); return true; });
  ipcMain.handle('hubmind:show-companion', () => { createCompanionWindow(); return true; });
  ipcMain.handle('hubmind:hide-companion', () => { companionHiddenByUser = true; companionWindow?.hide(); return true; });
  ipcMain.handle('hubmind:open-url', async (_event, requestedUrl) => {
    if (typeof requestedUrl !== 'string' || requestedUrl.length > 2048) throw new Error('Invalid URL.');
    let parsed; try { parsed = new URL(requestedUrl); } catch { throw new Error('Enter a valid URL.'); }
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Only web URLs can be opened.');
    const choice = await dialog.showMessageBox(mainWindow || companionWindow, { type: 'question', buttons: ['Cancel', 'Open website'], defaultId: 0, cancelId: 0, title: 'Open website?', message: parsed.href, detail: 'Jess will open this page in your default browser.' });
    if (choice.response !== 1) return { opened: false };
    await shell.openExternal(parsed.href); return { opened: true, url: parsed.href };
  });
  ipcMain.handle('hubmind:launch-app', async (_event, appName) => {
    if (typeof appName !== 'string' || !Object.prototype.hasOwnProperty.call(WINDOWS_APPS, appName)) throw new Error('That application is not on the approved launch list.');
    const choice = await dialog.showMessageBox(mainWindow || companionWindow, { type: 'question', buttons: ['Cancel', 'Launch app'], defaultId: 0, cancelId: 0, title: 'Launch Windows application?', message: 'Jess wants to launch ' + appName + '.', detail: 'This opens the selected built-in Windows application.' });
    if (choice.response !== 1) return { launched: false };
    await new Promise((resolve, reject) => execFile(WINDOWS_APPS[appName], [], { windowsHide: true, timeout: 10000 }, error => error ? reject(error) : resolve(true)));
    return { launched: true, app: appName };
  });
  ipcMain.handle('hubmind:run-readonly-command', async (_event, commandName) => {
    if (typeof commandName !== 'string' || !Object.prototype.hasOwnProperty.call(READ_ONLY_COMMANDS, commandName)) throw new Error('That command is not on the approved read-only list.');
    const choice = await dialog.showMessageBox(mainWindow || companionWindow, { type: 'warning', buttons: ['Cancel', 'Run command'], defaultId: 0, cancelId: 0, title: 'Run a Windows diagnostic?', message: 'Jess wants to run ' + commandName + '.', detail: 'This approved command reads system information only. It cannot change files or settings.' });
    if (choice.response !== 1) return { ran: false, cancelled: true };
    const [binary, args] = READ_ONLY_COMMANDS[commandName];
    const result = await new Promise((resolve, reject) => execFile(binary, args, { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024, shell: false }, (error, stdout, stderr) => {
      if (error && !stdout) return reject(new Error(String(stderr || error.message).slice(0, 1000)));
      resolve({ output: String(stdout || stderr || '').slice(0, 12000), exitCode: error?.code || 0 });
    }));
    return { ran: true, command: commandName, ...result };
  });
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
    if (!fs.existsSync(resolved)) throw new Error('That file or folder does not exist.');
    const error = await shell.openPath(resolved);
    if (error) throw new Error(error);
    return { opened: true };
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = (() => { try { return new URL(details.requestingUrl || webContents.getURL()).origin; } catch { return ''; } })();
    const trustedOrigin = (() => { try { return new URL(APP_URL).origin; } catch { return ''; } })();
    const allowed = origin === trustedOrigin && ['media', 'display-capture', 'notifications', 'clipboard-read', 'clipboard-sanitized-write'].includes(permission);
    callback(allowed);
  });
  // Let Windows/Electron display its native screen/window picker when supported.
  // Never silently select and stream the entire screen without the user's choice.
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } });
      callback({ video: sources[0] });
    } catch { callback({}); }
  }, { useSystemPicker: true });
  createMainWindow();
  createTray();
  app.on('activate', showMain);
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { /* Keep tray and companion available until explicit Quit. */ });
