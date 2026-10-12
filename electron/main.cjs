const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, dialog, session, desktopCapturer, screen, globalShortcut } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { execFile, spawn } = require('node:child_process');
const nativeAgent = require('./agentBridge.cjs');

const APP_URL = process.env.HUBMIND_APP_URL || 'https://hub-mind.netlify.app';
let mainWindow;
let companionWindow;
let tray;
let quitting = false;
let fullControlActive = false;
let controlSessionStartedAt = null;
let controlAuditPath = null;
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
  mainWindow = new BrowserWindow(secureWindowOptions({ width: 1440, height: 940, minWidth: 900, minHeight: 620, backgroundColor: '#080b12', title: 'Hub-Mind', autoHideMenuBar: true, show: false }));
  guardNavigation(mainWindow);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (event) => { if (!quitting) { event.preventDefault(); mainWindow.hide(); createCompanionWindow(); } });
  mainWindow.on('show', () => { if (companionWindow && !companionWindow.isDestroyed()) companionWindow.hide(); });
  mainWindow.on('restore', () => { if (companionWindow && !companionWindow.isDestroyed()) companionWindow.hide(); });
  mainWindow.on('minimize', () => { createCompanionWindow(); positionCompanionBottomRight(); });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadURL(APP_URL);
}

function positionCompanionBottomRight() {
  if (!companionWindow || companionWindow.isDestroyed()) return;
  const display = screen.getDisplayMatching(companionWindow.getBounds()) || screen.getPrimaryDisplay();
  const area = display.workArea;
  const [width, height] = companionWindow.getSize();
  companionWindow.setPosition(Math.max(area.x, area.x + area.width - width - 18), Math.max(area.y, area.y + area.height - height - 18), false);
}

function createCompanionWindow() {
  if (companionWindow && !companionWindow.isDestroyed()) { companionWindow.show(); companionWindow.focus(); return; }
  companionWindow = new BrowserWindow(secureWindowOptions({ width: 116, height: 116, minWidth: 116, minHeight: 116, maxWidth: 116, maxHeight: 116, frame: false, transparent: true, resizable: false, focusable: false, alwaysOnTop: true, skipTaskbar: true, hasShadow: false, backgroundColor: '#00000000', title: 'Jess · Hub-Mind', show: false }));
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
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
  else { if (companionWindow && !companionWindow.isDestroyed()) companionWindow.hide(); mainWindow.show(); mainWindow.focus(); }
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
  auditNativeAction({ event: 'full-control-stopped', reason });
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

  ipcMain.handle('hubmind:full-control-start', (event) => {
    assertTrustedSender(event);
    fullControlActive = true;
    controlSessionStartedAt = new Date().toISOString();
    auditNativeAction({ event: 'full-control-started', startedAt: controlSessionStartedAt });
    return { ok: true, active: true, startedAt: controlSessionStartedAt, stopHotkey: 'Ctrl+Alt+Shift+J' };
  });
  ipcMain.handle('hubmind:full-control-stop', (event) => { assertTrustedSender(event); return stopFullControl('voice-or-ui-stop'); });
  ipcMain.handle('hubmind:native-status', (event) => { assertTrustedSender(event); return { active: fullControlActive, startedAt: controlSessionStartedAt }; });
  ipcMain.handle('hubmind:native-action', async (event, method, args) => {
    assertTrustedSender(event);
    const allowed = new Set(['list_windows','focus_window','close_window','minimize_window','maximize_window','restore_window','move_window','resize_window','snap_window','mouse_move','click','double_click','right_click','scroll','type_text','press_keys','screenshot','read_screen_text','launch_app','run_command','get_time','system_info']);
    if (typeof method !== 'string' || !allowed.has(method)) throw new Error('Unknown or unavailable native action.');
    requireFullControl(method);
    const safeArgs = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
    if (method === 'run_command') {
      const command = String(safeArgs.command || '');
      if (command.length > 4000) throw new Error('Command exceeds the 4,000-character limit.');
      if (/\b(remove-item|format-volume|format-disk|clear-disk|diskpart|bcdedit|shutdown|restart-computer|stop-computer|set-executionpolicy|reg\s+delete|cipher\s+\/w)\b/i.test(command)) throw new Error('Potentially destructive commands require a separate explicit confirmation flow and are blocked in this release.');
    }
    const started = Date.now();
    try {
      const result = await nativeAgent.call(method, safeArgs, method === 'screenshot' ? 30000 : 15000);
      auditNativeAction({ event: 'native-action-result', method, durationMs: Date.now()-started, ok: result?.ok === true, verified: result?.verified === true, error: result?.error || null });
      return result;
    } catch (error) {
      auditNativeAction({ event: 'native-action-error', method, durationMs: Date.now()-started, error: String(error?.message || error) });
      return { ok: false, verified: false, evidence: null, error: String(error?.message || error) };
    }
  });

  ipcMain.handle('hubmind:show-main', (event) => { assertTrustedSender(event); showMain(); return true; });
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
  createMainWindow();
  createTray();
  app.on('activate', showMain);
});

app.on('before-quit', () => { stopFullControl('app-quit'); globalShortcut.unregisterAll(); quitting = true; });
app.on('window-all-closed', () => { /* Keep tray and companion available until explicit Quit. */ });
