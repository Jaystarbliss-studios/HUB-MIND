const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, dialog, session, desktopCapturer, screen, globalShortcut } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { execFile, spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const nativeAgent = require('./agentBridge.cjs');
const chromeBridge = require('./chromeBridge.cjs');

const APP_URL = process.env.HUBMIND_APP_URL || 'https://hub-mind.netlify.app';
let mainWindow;
let companionWindow;
let tray;
let quitting = false;
let fullControlActive = false;
let controlSessionStartedAt = null;
let controlSessionUserId = null;
let controlAuditPath = null;
let offlineWakeProcess = null;
let offlineWakeConsentAsked = false;
let offlineWakeConsentGranted = false;
const hasSingleInstanceLock = app.requestSingleInstanceLock();
const trustedAppHosts = new Set(['hub-mind.netlify.app']);
const googleAuthHosts = new Set(['accounts.google.com', 'oauth2.googleapis.com', 'identitytoolkit.googleapis.com']);
const WINDOWS_APPS = Object.freeze({ calculator: 'calc.exe', notepad: 'notepad.exe', paint: 'mspaint.exe', explorer: 'explorer.exe', taskManager: 'taskmgr.exe', edge: 'msedge.exe', chrome: 'chrome.exe', word: 'winword.exe', excel: 'excel.exe', powerpoint: 'powerpnt.exe', teams: 'ms-teams.exe', vscode: 'code.exe' });
const READ_ONLY_COMMANDS = Object.freeze({ ipconfig: ['ipconfig.exe', []], systemInfo: ['systeminfo.exe', []], runningProcesses: ['tasklist.exe', []] });
const WINDOWS_SHORTCUTS = Object.freeze({ save: '^s', selectAll: '^a', copy: '^c', paste: '^v', undo: '^z', redo: '^y', find: '^f', closeWindow: '%{F4}', switchWindow: '%{TAB}', taskManager: '^+{ESC}', enter: '{ENTER}', escape: '{ESC}', tab: '{TAB}' });
function assertTrustedSender(event) {
  let origin = ''; try { origin = new URL(event.senderFrame?.url || '').origin; } catch {}
  if (origin !== new URL(APP_URL).origin) throw new Error('Blocked desktop action from an untrusted page.');
}

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
          overrideBrowserWindowOptions: secureWindowOptions({ width: 520, height: 720, autoHideMenuBar: true, title: 'Sign in to Hub-Mind', webPreferences: { preload: undefined } }),
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
  mainWindow = new BrowserWindow(secureWindowOptions({ width: 1440, height: 940, minWidth: 900, minHeight: 620, backgroundColor: '#020617', title: 'Hub-Mind', autoHideMenuBar: true, show: false, webPreferences: { backgroundThrottling: false } }));
  guardNavigation(mainWindow);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (event) => { if (!quitting) { event.preventDefault(); mainWindow.hide(); createCompanionWindow(); } });
  // Keep Jess's native overlay visible above the workspace as well as other desktop apps.
  const keepCompanionVisible = () => {
    if (!companionWindow || companionWindow.isDestroyed()) createCompanionWindow();
    else if (!companionWindow.isVisible()) companionWindow.showInactive();
  };
  mainWindow.on('show', keepCompanionVisible);
  mainWindow.on('restore', keepCompanionVisible);
  mainWindow.on('minimize', () => { createCompanionWindow(); positionCompanionBottomRight(); });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadURL(APP_URL);
}

function positionCompanionBottomRight() {
  if (!companionWindow || companionWindow.isDestroyed()) return;
  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  const [width, height] = companionWindow.getSize();
  companionWindow.setPosition(Math.max(area.x, area.x + area.width - width - 18), Math.max(area.y, area.y + area.height - height - 18), false);
}

function createCompanionWindow() {
  if (companionWindow && !companionWindow.isDestroyed()) { companionWindow.showInactive(); return; }
  companionWindow = new BrowserWindow(secureWindowOptions({ width: 420, height: 560, minWidth: 360, minHeight: 420, maxWidth: 520, maxHeight: 760, frame: false, transparent: true, resizable: true, focusable: true, alwaysOnTop: true, skipTaskbar: true, hasShadow: false, backgroundColor: '#00000000', title: 'Jess · Hub-Mind', show: false, webPreferences: { backgroundThrottling: false } }));
  companionWindow.on('blur', () => { /* The overlay remains available until explicitly hidden or the workspace is restored. */ });
  guardNavigation(companionWindow);
  companionWindow.setAlwaysOnTop(true, 'screen-saver');
  positionCompanionBottomRight();
  companionWindow.once('ready-to-show', () => companionWindow.show());
  companionWindow.on('closed', () => { companionWindow = null; });
  companionWindow.loadURL(APP_URL + '/companion');
}

function getDialogParent() {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) return mainWindow;
  if (companionWindow && !companionWindow.isDestroyed() && companionWindow.isVisible()) return companionWindow;
  return undefined;
}

function showMain() {
  if (!companionWindow || companionWindow.isDestroyed()) createCompanionWindow();
  else if (!companionWindow.isVisible()) companionWindow.showInactive();
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function showMainVerified(timeoutMs = 5000) {
  showMain();
  const deadline = Date.now() + timeoutMs;
  return await new Promise((resolve) => {
    const check = () => {
      const ready = !!mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && mainWindow.isFocused();
      if (ready) { clearInterval(timer); resolve(true); return; }
      if (Date.now() >= deadline) { clearInterval(timer); resolve(false); }
    };
    const timer = setInterval(check, 50);
    check();
  });
}

function stopOfflineWake() {
  const child = offlineWakeProcess;
  offlineWakeProcess = null;
  if (child && !child.killed) {
    try { child.kill(); } catch {}
  }
  return { stopped: true };
}

async function startOfflineWake(event) {
  assertTrustedSender(event);
  if (process.platform !== 'win32') return { started: false, error: 'Offline Windows wake detection is available only in the Windows desktop app.' };
  if (offlineWakeProcess && !offlineWakeProcess.killed && offlineWakeProcess.exitCode === null) return { started: true, alreadyRunning: true, source: 'Windows offline recognizer' };
  if (!offlineWakeConsentAsked) {
    offlineWakeConsentAsked = true;
    const choice = await dialog.showMessageBox(getDialogParent(), {
      type: 'question', buttons: ['Not now', 'Enable offline wake word'], defaultId: 0, cancelId: 0,
      title: 'Enable local Jess wake-word detection?',
      message: 'Allow Hub-Mind to listen locally for “Jess” while the workspace is running?',
      detail: 'Speech recognition runs on this PC using Windows speech components. Audio is not sent to Hub-Mind servers by this wake listener. Listening stops when Jess wakes, when you stop it, or when Hub-Mind quits. A compatible Windows speech recognizer and microphone are required.'
    });
    offlineWakeConsentGranted = choice.response === 1;
  }
  if (!offlineWakeConsentGranted) return { started: false, cancelled: true, error: 'Offline wake-word listening was not enabled.' };
  const exePath = app.isPackaged
    ? path.join(process.resourcesPath, 'JessOfflineWake.exe')
    : path.join(__dirname, '..', 'native', 'JessOfflineWake', 'publish', 'JessOfflineWake.exe');
  if (!fs.existsSync(exePath)) return { started: false, error: 'The offline wake helper is not installed. Rebuild the Windows desktop package with the native helpers.' };
  const child = spawn(exePath, [], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
  offlineWakeProcess = child;
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => console.warn('[Jess offline wake]', String(chunk).slice(0, 800)));
  let buffer = '';
  let resolved = false;
  let readyTimer;
  const settle = value => {
    if (resolved) return;
    resolved = true;
    clearTimeout(readyTimer);
    resolveStart(value);
  };
  let resolveStart;
  const ready = new Promise(resolve => { resolveStart = resolve; });
  readyTimer = setTimeout(() => {
    if (offlineWakeProcess === child) stopOfflineWake();
    settle({ started: false, error: 'Windows offline speech recognizer did not become ready. Check microphone access and installed speech recognition language support.' });
  }, 5000);
  child.stdout.on('data', chunk => {
    buffer += chunk;
    if (buffer.length > 65536) { stopOfflineWake(); settle({ started: false, error: 'Offline wake helper returned an oversized message.' }); return; }
    let at;
    while ((at = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, at).trim();
      buffer = buffer.slice(at + 1);
      if (!line) continue;
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      if (message.type === 'ready') settle({ started: true, source: message.source || 'Windows offline recognizer' });
      if (message.type === 'wake') {
        stopOfflineWake();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('hubmind:offline-wake', { prompt: String(message.prompt || '').slice(0, 2000), source: message.source || 'Windows offline recognizer' });
      }
    }
  });
  child.once('error', error => {
    if (offlineWakeProcess === child) offlineWakeProcess = null;
    settle({ started: false, error: String(error?.message || 'Could not start offline wake helper.').slice(0, 500) });
  });
  child.once('exit', code => {
    if (offlineWakeProcess === child) offlineWakeProcess = null;
    if (!resolved) settle({ started: false, error: 'Offline wake helper exited before becoming ready (code ' + String(code) + ').' });
  });
  return await ready;
}

async function readWindowsOcrFallback() {
  const exePath = app.isPackaged
    ? path.join(process.resourcesPath, 'JessWindowsOcr.exe')
    : path.join(__dirname, '..', 'native', 'JessWindowsOcr', 'publish', 'JessWindowsOcr.exe');
  if (!fs.existsSync(exePath)) return { ok: false, error: 'Windows OCR helper is not installed.' };
  const capture = await nativeAgent.call('screenshot', {}, 30000);
  const monitors = Array.isArray(capture?.evidence?.monitors) ? capture.evidence.monitors : [];
  const monitor = monitors.find(item => item?.primary && typeof item.imageBase64 === 'string') || monitors.find(item => typeof item?.imageBase64 === 'string');
  if (!monitor) return { ok: false, error: 'No screenshot image was returned for OCR.' };
  const bytes = Buffer.from(monitor.imageBase64, 'base64');
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) return { ok: false, error: 'Screenshot size is empty or exceeds the OCR safety limit.' };
  const tempPath = path.join(app.getPath('temp'), 'hubmind-jess-ocr-' + randomUUID() + '.jpg');
  try {
    fs.writeFileSync(tempPath, bytes, { flag: 'wx' });
    return await new Promise(resolve => {
      execFile(exePath, [tempPath], { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024, shell: false }, (error, stdout, stderr) => {
        let parsed;
        try { parsed = JSON.parse(String(stdout || '').trim()); } catch {}
        if (parsed && typeof parsed.text === 'string') return resolve({ ok: parsed.ok === true && !!parsed.text.trim(), text: parsed.text, lineCount: parsed.lineCount, source: parsed.source || 'Windows.Media.Ocr', error: parsed.error || (error ? String(stderr || error.message || 'OCR failed').slice(0, 500) : null), monitor: monitor.monitor, bounds: monitor.bounds });
        resolve({ ok: false, error: String(stderr || error?.message || 'Windows OCR returned no structured result.').slice(0, 500) });
      });
    });
  } finally {
    try { fs.unlinkSync(tempPath); } catch {}
  }
}

function auditNativeAction(entry) {
  try {
    if (!controlAuditPath) controlAuditPath = path.join(app.getPath('userData'), 'jess-native-audit.jsonl');
    fs.appendFileSync(controlAuditPath, JSON.stringify({ at: new Date().toISOString(), sessionActive: fullControlActive, ...entry }) + '\n', { encoding: 'utf8' });
  } catch (error) { console.error('[Jess audit] Could not append audit entry:', error); }
}
function stopFullControl(reason = 'user-stop') {
  fullControlActive = false;
  controlSessionStartedAt = null;
  const previousUserId = controlSessionUserId;
  controlSessionUserId = null;
  // End the PowerShell sidecar and drop in-flight Chrome messages immediately.
  try { nativeAgent.stop(); } catch {}
  try { chromeBridge.cancelPending('Full Control Session stopped.'); } catch {}
  auditNativeAction({ event: 'full-control-stopped', reason, userId: previousUserId });
  return { ok: true, active: false, reason };
}
function requireFullControl(method) {
  if (!fullControlActive) throw new Error('Full Control Session is off. Say “Jess, full control” to enable native actions, or use the tray control.');
  auditNativeAction({ event: 'native-action-request', method });
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'dist', 'icon.svg');
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }) : nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('Hub-Mind');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Hub-Mind', click: showMain },
    { label: 'Show Jess companion', click: () => { createCompanionWindow(); positionCompanionBottomRight(); } },
    { label: 'Reset Jess orb to bottom-right', click: () => { createCompanionWindow(); positionCompanionBottomRight(); } },
    { label: 'Stop Jess (end Full Control Session)', click: () => stopFullControl('tray-stop') },
    { label: 'Start Hub-Mind at Windows sign-in (this user)', type: 'checkbox', checked: !!app.getLoginItemSettings().openAtLogin, click: item => { try { app.setLoginItemSettings({ openAtLogin: item.checked }); item.checked = !!app.getLoginItemSettings().openAtLogin; } catch (error) { item.checked = !!app.getLoginItemSettings().openAtLogin; console.error('[Hub-Mind] Could not update per-user startup setting:', error); } } },
    { type: 'separator' },
    { label: 'Quit Hub-Mind', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('double-click', showMain);
}

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) { app.quit(); return; }
  app.on('second-instance', () => showMain());
  if (process.platform === 'win32') app.setAppUserModelId('studios.jaystarbliss.hubmind');
  chromeBridge.start();
  ipcMain.handle('hubmind:full-control-start', (event, userId) => {
    assertTrustedSender(event);
    if (typeof userId !== 'string' || !userId.trim() || userId.length > 256) throw new Error('A signed-in Hub-Mind user ID is required.');
    fullControlActive = true;
    controlSessionUserId = userId;
    controlSessionStartedAt = new Date().toISOString();
    auditNativeAction({ event: 'full-control-started', startedAt: controlSessionStartedAt, userId });
    return { ok: true, active: true, startedAt: controlSessionStartedAt, userId, stopHotkey: 'Ctrl+Alt+Shift+J' };
  });
  ipcMain.handle('hubmind:full-control-stop', (event) => { assertTrustedSender(event); return stopFullControl('voice-or-ui-stop'); });
  ipcMain.handle('hubmind:native-status', (event) => { assertTrustedSender(event); return { active: fullControlActive, startedAt: controlSessionStartedAt, userId: controlSessionUserId }; });
  ipcMain.handle('hubmind:chrome-status', (event) => { assertTrustedSender(event); return chromeBridge.status(); });
  ipcMain.handle('hubmind:offline-wake-start', (event) => startOfflineWake(event));
  ipcMain.handle('hubmind:offline-wake-stop', (event) => { assertTrustedSender(event); return stopOfflineWake(); });
  ipcMain.handle('hubmind:chrome-action', async (event, method, args, userId) => {
    assertTrustedSender(event);
    if (!fullControlActive || typeof userId !== 'string' || userId !== controlSessionUserId) {
      return { ok: false, verified: false, error: 'Chrome control requires an active Full Control Session owned by the signed-in user.' };
    }
    const allowed = new Set(['chrome_list_tabs','chrome_open_tab','chrome_close_tab','chrome_activate_tab','chrome_navigate_tab','chrome_reload_tab','chrome_scroll','chrome_read_page','chrome_find_element','chrome_click_element','chrome_fill_field']);
    if (typeof method !== 'string' || !allowed.has(method)) return { ok: false, verified: false, error: 'Unsupported Chrome action.' };
    const safeArgs = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
    if (safeArgs.tabId !== undefined && (!Number.isInteger(Number(safeArgs.tabId)) || Number(safeArgs.tabId) < 1)) return { ok: false, verified: false, error: 'Invalid Chrome tab ID.' };
    if (['chrome_open_tab','chrome_navigate_tab'].includes(method) && (typeof safeArgs.url !== 'string' || safeArgs.url.length > 2048)) return { ok: false, verified: false, error: 'A valid HTTP or HTTPS URL is required.' };
    if (method === 'chrome_fill_field' && (typeof safeArgs.selector !== 'string' || !safeArgs.selector.trim() || safeArgs.selector.length > 500 || typeof safeArgs.value !== 'string' || safeArgs.value.length > 10000)) return { ok: false, verified: false, error: 'A field selector and value under 10,000 characters are required.' };
    if (['chrome_find_element','chrome_click_element'].includes(method) && ((safeArgs.selector && (typeof safeArgs.selector !== 'string' || safeArgs.selector.length > 500)) || (safeArgs.text && (typeof safeArgs.text !== 'string' || safeArgs.text.length > 500)))) return { ok: false, verified: false, error: 'Element selectors and text queries must be under 500 characters.' };
    auditNativeAction({ event: 'chrome-action-request', method, userId });
    const started = Date.now();
    const result = await chromeBridge.request(method, safeArgs, method === 'chrome_read_page' ? 20000 : 12000);
    auditNativeAction({ event: 'chrome-action-result', method, userId, durationMs: Date.now() - started, ok: result?.ok === true, verified: result?.verified === true, error: result?.error || null });
    return result;
  });
  ipcMain.handle('hubmind:native-action', async (event, method, args, userId) => {
    assertTrustedSender(event);
    if (typeof userId !== 'string' || !userId.trim() || userId.length > 256) throw new Error('A signed-in Hub-Mind user ID is required.');
    if (!['get_time','system_info'].includes(method) && userId !== controlSessionUserId) throw new Error('Native action blocked because the signed-in user does not own this Full Control Session.');
    const allowed = new Set(['list_windows','focus_window','close_window','minimize_window','maximize_window','restore_window','move_window','resize_window','snap_window','mouse_move','click','double_click','drag','right_click','scroll','type_text','press_keys','screenshot','read_screen_text','find_ui_element','invoke_ui_element','launch_app','run_command','get_time','system_info','open_path']);
    if (typeof method !== 'string' || !allowed.has(method)) throw new Error('Unknown or unavailable native action.');
    if (!['get_time','system_info'].includes(method)) requireFullControl(method);
    const safeArgs = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
    if (method === 'run_command') {
      const command = String(safeArgs.command || '');
      if (command.length > 4000) throw new Error('Command exceeds the 4,000-character limit.');
      if (/\b(remove-item|format-volume|format-disk|clear-disk|diskpart|bcdedit|shutdown|restart-computer|stop-computer|set-executionpolicy|reg\s+delete|cipher\s+\/w)\b/i.test(command)) throw new Error('Potentially destructive commands require a separate explicit confirmation flow and are blocked in this release.');
    }
    if (['focus_window','close_window','minimize_window','maximize_window','restore_window','move_window','resize_window','snap_window'].includes(method) && !safeArgs.handle && !String(safeArgs.title || '').trim()) throw new Error('Provide a window title or handle.');
    if (method === 'move_window' && (!Number.isFinite(safeArgs.x) || !Number.isFinite(safeArgs.y))) throw new Error('Moving a window requires numeric x and y coordinates.');
    if (method === 'resize_window' && (!Number.isFinite(safeArgs.width) || !Number.isFinite(safeArgs.height))) throw new Error('Resizing a window requires numeric width and height.');
    if (method === 'snap_window' && !['left','right','top-left','top-right','bottom-left','bottom-right'].includes(String(safeArgs.position))) throw new Error('Choose a supported snap position.');
    if (['mouse_move','click','double_click','right_click','scroll'].includes(method) && (!Number.isFinite(safeArgs.x) || !Number.isFinite(safeArgs.y))) throw new Error('Mouse actions require numeric screen coordinates.');
    if (method === 'drag' && !['fromX','fromY','toX','toY'].every(key => Number.isFinite(safeArgs[key]))) throw new Error('Drag requires start and end screen coordinates.');
    if (method === 'type_text' && (typeof safeArgs.text !== 'string' || safeArgs.text.length > 10000)) throw new Error('Text must be a string no longer than 10,000 characters.');
    if (method === 'press_keys' && (typeof safeArgs.keys !== 'string' || !safeArgs.keys.trim() || safeArgs.keys.length > 80)) throw new Error('Provide a key combination under 80 characters.');
    if (method === 'launch_app' && (typeof safeArgs.name !== 'string' || !safeArgs.name.trim() || safeArgs.name.length > 160)) throw new Error('Provide an application name under 160 characters.');
    if (method === 'open_path' && (typeof safeArgs.path !== 'string' || !safeArgs.path.trim() || safeArgs.path.length > 2048)) throw new Error('Provide a valid local file path.');
    const started = Date.now();
    try {
      let result = await nativeAgent.call(method, safeArgs, method === 'screenshot' ? 30000 : 15000);
      if (method === 'read_screen_text' && !String(result?.evidence?.text || '').trim()) {
        try {
          const ocr = await readWindowsOcrFallback();
          if (ocr?.ok && String(ocr.text || '').trim()) {
            result = { ok: true, verified: true, evidence: { text: ocr.text.slice(0, 20000), source: ocr.source || 'Windows.Media.Ocr', lineCount: ocr.lineCount, monitor: ocr.monitor, bounds: ocr.bounds, fallback: true } };
          } else {
            result = { ...result, evidence: { ...(result?.evidence || {}), ocrFallback: { ok: false, error: ocr?.error || 'OCR did not recognize text.' } } };
          }
        } catch (ocrError) {
          result = { ...result, evidence: { ...(result?.evidence || {}), ocrFallback: { ok: false, error: String(ocrError?.message || ocrError).slice(0, 500) } } };
        }
      }
      auditNativeAction({ event: 'native-action-result', method, userId, durationMs: Date.now()-started, ok: result?.ok === true, verified: result?.verified === true, error: result?.error || null });
      return result;
    } catch (error) {
      auditNativeAction({ event: 'native-action-error', method, userId, durationMs: Date.now()-started, error: String(error?.message || error) });
      return { ok: false, verified: false, evidence: null, error: String(error?.message || error) };
    }
  });

  ipcMain.handle('hubmind:show-main', async (event) => { assertTrustedSender(event); return await showMainVerified(); });
  ipcMain.handle('hubmind:show-companion', (event) => { assertTrustedSender(event); createCompanionWindow(); return true; });
  ipcMain.handle('hubmind:hide-companion', (event) => { assertTrustedSender(event); companionWindow?.hide(); return true; });
  ipcMain.handle('hubmind:move-companion-by', (event, dx, dy) => { assertTrustedSender(event); if (!companionWindow || !Number.isFinite(dx) || !Number.isFinite(dy)) return false; const [x, y] = companionWindow.getPosition(); const display = screen.getDisplayMatching(companionWindow.getBounds()) || screen.getPrimaryDisplay(); const area = display.workArea; const [width, height] = companionWindow.getSize(); const nextX = Math.max(area.x, Math.min(area.x + area.width - width, x + Math.max(-200, Math.min(200, dx)))); const nextY = Math.max(area.y, Math.min(area.y + area.height - height, y + Math.max(-200, Math.min(200, dy)))); companionWindow.setPosition(Math.round(nextX), Math.round(nextY)); return true; });
  ipcMain.handle('hubmind:open-user-path', async (event, requestedPath) => {
    assertTrustedSender(event);
    if (typeof requestedPath !== 'string' || requestedPath.length > 2048 || requestedPath.includes('\0')) throw new Error('Invalid path.');
    const result = await dialog.showMessageBox(getDialogParent(), {
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
  ipcMain.handle('hubmind:type-text', async (event, requestedText) => {
    assertTrustedSender(event);
    if (typeof requestedText !== 'string' || !requestedText.length || requestedText.length > 3000) throw new Error('Text must be between 1 and 3,000 characters.');
    const preview = requestedText.length > 500 ? requestedText.slice(0, 500) + '…' : requestedText;
    const choice = await dialog.showMessageBox(getDialogParent(), { type: 'warning', buttons: ['Cancel', 'Type this text'], defaultId: 0, cancelId: 0, title: 'Type into the active Windows application?', message: 'Jess wants to type text into whichever app currently has keyboard focus.', detail: preview + (requestedText.length > 500 ? '\n\n[Preview truncated; full text will be typed.]' : '') });
    if (choice.response !== 1) return { typed: false, cancelled: true };
    const textBase64 = Buffer.from(requestedText, 'utf8').toString('base64');
    const script = String.raw`Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class HubMindUnicodeInput {
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public InputUnion U; }
  [StructLayout(LayoutKind.Explicit)] public struct InputUnion { [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
  public static void Type(string value) {
    foreach (char ch in value) {
      INPUT down = new INPUT(); down.type = 1; down.U.ki.wScan = ch; down.U.ki.dwFlags = 4;
      INPUT up = new INPUT(); up.type = 1; up.U.ki.wScan = ch; up.U.ki.dwFlags = 6;
      INPUT[] pair = new INPUT[] { down, up };
      SendInput(2, pair, Marshal.SizeOf(typeof(INPUT)));
    }
  }
}
'@
$text = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${textBase64}'))
[HubMindUnicodeInput]::Type($text)`;
    await new Promise((resolve, reject) => execFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024, shell: false }, error => error ? reject(new Error(String(error.message || 'Text entry failed.').slice(0, 1000))) : resolve(true)));
    return { typed: true, characterCount: requestedText.length };
  });
  ipcMain.handle('hubmind:press-shortcut', async (event, shortcutName) => {
    assertTrustedSender(event);
    if (typeof shortcutName !== 'string' || !Object.prototype.hasOwnProperty.call(WINDOWS_SHORTCUTS, shortcutName)) throw new Error('That keyboard shortcut is not approved.');
    const choice = await dialog.showMessageBox(getDialogParent(), { type: 'warning', buttons: ['Cancel', 'Press shortcut'], defaultId: 0, cancelId: 0, title: 'Send a keyboard shortcut?', message: 'Jess wants to send ' + shortcutName + ' to the active Windows application.', detail: 'The shortcut will be sent to whichever window has keyboard focus after you confirm.' });
    if (choice.response !== 1) return { pressed: false, cancelled: true };
    const sequence = WINDOWS_SHORTCUTS[shortcutName];
    const script = String.raw`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${sequence}')`;
    await new Promise((resolve, reject) => execFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 10000, shell: false }, error => error ? reject(new Error(String(error.message || 'Keyboard shortcut failed.').slice(0, 1000))) : resolve(true)));
    return { pressed: true, shortcut: shortcutName };
  });
  ipcMain.handle('hubmind:open-url', async (event, requestedUrl) => {
    assertTrustedSender(event);
    if (typeof requestedUrl !== 'string' || requestedUrl.length > 2048) throw new Error('Invalid URL.');
    let parsed; try { parsed = new URL(requestedUrl); } catch { throw new Error('Enter a valid URL.'); }
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Only web URLs can be opened.');
    const choice = await dialog.showMessageBox(getDialogParent(), { type: 'question', buttons: ['Cancel', 'Open website'], defaultId: 0, cancelId: 0, title: 'Open website?', message: parsed.href, detail: 'Jess will open this page in your default browser.' });
    if (choice.response !== 1) return { opened: false };
    await shell.openExternal(parsed.href); return { opened: true, url: parsed.href };
  });
  ipcMain.handle('hubmind:launch-app', async (event, appName) => {
    assertTrustedSender(event);
    if (typeof appName !== 'string' || !Object.prototype.hasOwnProperty.call(WINDOWS_APPS, appName)) throw new Error('That application is not on the approved launch list.');
    const choice = await dialog.showMessageBox(getDialogParent(), { type: 'question', buttons: ['Cancel', 'Launch app'], defaultId: 0, cancelId: 0, title: 'Launch Windows application?', message: 'Jess wants to launch ' + appName + '.', detail: 'This opens the selected built-in Windows application.' });
    if (choice.response !== 1) return { launched: false };
    await new Promise((resolve, reject) => { const child = spawn(WINDOWS_APPS[appName], [], { windowsHide: true, detached: true, stdio: 'ignore', shell: false }); child.once('error', reject); child.once('spawn', () => { child.unref(); resolve(true); }); });
    return { launched: true, app: appName };
  });
  ipcMain.handle('hubmind:run-system-command', async (event, requestedCommand, requestedPurpose) => {
    assertTrustedSender(event);
    if (typeof requestedCommand !== 'string' || !requestedCommand.trim() || requestedCommand.length > 1200) throw new Error('Command must be between 1 and 1,200 characters.');
    if (typeof requestedPurpose !== 'string' || !requestedPurpose.trim() || requestedPurpose.length > 300) throw new Error('A short purpose is required.');
    const command = requestedCommand.trim();
    const blocked = /\b(remove-item|format-volume|format-disk|clear-disk|diskpart|bcdedit|shutdown|restart-computer|stop-computer|set-executionpolicy|cipher\s+\/w|reg\s+delete)\b/i;
    if (blocked.test(command)) throw new Error('This high-risk destructive command is blocked by Hub-Mind.');
    const choice = await dialog.showMessageBox(getDialogParent(), {
      type: 'warning', buttons: ['Cancel', 'Run this command'], defaultId: 0, cancelId: 0,
      title: 'Jess wants to run a Windows command', message: requestedPurpose.trim(),
      detail: 'Exact PowerShell command:\n\n' + command + '\n\nRuns with your current Windows user permissions, not as administrator. Review it carefully before allowing it.',
    });
    if (choice.response !== 1) return { ran: false, cancelled: true };
    const result = await new Promise((resolve, reject) => execFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024, shell: false }, (error, stdout, stderr) => {
      const output = String(stdout || stderr || '').slice(0, 12000);
      if (error && !output) return reject(new Error(String(error.message || 'PowerShell command failed.').slice(0, 1000)));
      resolve({ output, exitCode: typeof error?.code === 'number' ? error.code : (error ? 1 : 0) });
    }));
    return { ran: true, purpose: requestedPurpose.trim(), command, ...result };
  });
  ipcMain.handle('hubmind:run-readonly-command', async (event, commandName) => {
    assertTrustedSender(event);
    if (typeof commandName !== 'string' || !Object.prototype.hasOwnProperty.call(READ_ONLY_COMMANDS, commandName)) throw new Error('That command is not on the approved read-only list.');
    const choice = await dialog.showMessageBox(getDialogParent(), { type: 'warning', buttons: ['Cancel', 'Run command'], defaultId: 0, cancelId: 0, title: 'Run a Windows diagnostic?', message: 'Jess wants to run ' + commandName + '.', detail: 'This approved command reads system information only. It cannot change files or settings.' });
    if (choice.response !== 1) return { ran: false, cancelled: true };
    const [binary, args] = READ_ONLY_COMMANDS[commandName];
    const result = await new Promise((resolve, reject) => execFile(binary, args, { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024, shell: false }, (error, stdout, stderr) => {
      if (error && !stdout) return reject(new Error(String(stderr || error.message).slice(0, 1000)));
      resolve({ output: String(stdout || stderr || '').slice(0, 12000), exitCode: error?.code || 0 });
    }));
    return { ran: true, command: commandName, ...result };
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = (() => { try { return new URL(details.requestingUrl || webContents.getURL()).origin; } catch { return ''; } })();
    const trustedOrigin = (() => { try { return new URL(APP_URL).origin; } catch { return ''; } })();
    callback(origin === trustedOrigin && ['media', 'display-capture', 'notifications', 'clipboard-read', 'clipboard-sanitized-write'].includes(permission));
  });
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } });
      if (!sources.length) { callback({}); return; }
      // On Windows builds where the native system picker is unavailable, show
      // an explicit source chooser. Never silently share the first screen.
      const buttons = ['Cancel', ...sources.slice(0, 8).map(source => source.name || source.id)];
      const choice = await dialog.showMessageBox(getDialogParent(), {
        type: 'question', buttons, defaultId: 0, cancelId: 0,
        title: 'Choose what Jess can see',
        message: 'Select a screen or application window to share.',
        detail: 'Choose “Share entire screen” only when you intend to share the full display. Only the selected source will be shared, and you can stop sharing at any time.',
      });
      const selected = choice.response > 0 ? sources[choice.response - 1] : null;
      callback(selected ? { video: selected } : {});
    } catch { callback({}); }
  }, { useSystemPicker: true });
  const stopHotkeyRegistered = globalShortcut.register('Control+Alt+Shift+J', () => {
    if (fullControlActive) stopFullControl('global-hotkey');
  });
  if (!stopHotkeyRegistered) console.warn('[Jess native control] Could not register Ctrl+Alt+Shift+J emergency stop hotkey.');
  createMainWindow();
  createTray();
  app.on('activate', showMain);
});

app.on('before-quit', () => { stopFullControl('app-quit'); stopOfflineWake(); chromeBridge.stop(); globalShortcut.unregisterAll(); quitting = true; });
app.on('window-all-closed', () => { /* Keep tray and companion available until explicit Quit. */ });
