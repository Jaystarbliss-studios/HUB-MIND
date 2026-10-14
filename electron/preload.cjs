const { contextBridge, ipcRenderer } = require('electron');
let controlCapability = null;
ipcRenderer.on('hubmind:full-control-capability', (_event, capability) => {
  controlCapability = typeof capability === 'string' && /^[a-f0-9]{64}$/.test(capability) ? capability : null;
});
async function startFullControl(userId) {
  const result = await ipcRenderer.invoke('hubmind:full-control-start', userId);
  controlCapability = typeof result?.capability === 'string' && /^[a-f0-9]{64}$/.test(result.capability) ? result.capability : null;
  if (!result || typeof result !== 'object') return result;
  const { capability: _privateCapability, ...publicResult } = result;
  return publicResult;
}
async function stopFullControl() {
  const result = await ipcRenderer.invoke('hubmind:full-control-stop');
  controlCapability = null;
  return result;
}
contextBridge.exposeInMainWorld('hubMindDesktop', Object.freeze({
  platform: process.platform, isDesktopApp: true,
  startFullControl,
  setJessPreferences: (prefs, userId) => ipcRenderer.invoke('hubmind:jess-preferences-set', prefs, userId),
  getJessPreferences: (userId) => ipcRenderer.invoke('hubmind:jess-preferences-get', userId),
  stopFullControl,
  nativeStatus: () => ipcRenderer.invoke('hubmind:native-status'),
  chromeStatus: () => ipcRenderer.invoke('hubmind:chrome-status'),
  mcpListServers: (userId) => ipcRenderer.invoke('hubmind:mcp-list-servers', userId),
  mcpListTools: (userId) => ipcRenderer.invoke('hubmind:mcp-list-tools', userId),
  mcpSaveServer: (config, userId) => ipcRenderer.invoke('hubmind:mcp-save-server', config, userId),
  mcpConnectServer: (serverId, userId) => ipcRenderer.invoke('hubmind:mcp-connect-server', serverId, userId),
  mcpRemoveServer: (serverId, userId) => ipcRenderer.invoke('hubmind:mcp-remove-server', serverId, userId),
  mcpCallTool: (modelToolName, args, userId, executionId) => ipcRenderer.invoke('hubmind:mcp-tool-call', modelToolName, args, userId, executionId, controlCapability),
  chromeAction: (method, args, userId, executionId) => ipcRenderer.invoke('hubmind:chrome-action', method, args, userId, executionId, controlCapability),
  startOfflineWake: () => ipcRenderer.invoke('hubmind:offline-wake-start'),
  stopOfflineWake: () => ipcRenderer.invoke('hubmind:offline-wake-stop'),
  onOfflineWake: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('hubmind:offline-wake', listener);
    return () => ipcRenderer.removeListener('hubmind:offline-wake', listener);
  },
  nativeAction: (method, args, userId, executionId) => ipcRenderer.invoke('hubmind:native-action', method, args, userId, executionId, controlCapability),
  showMain: () => ipcRenderer.invoke('hubmind:show-main'),
  showWorkspace: () => ipcRenderer.invoke('hubmind:show-workspace'),
  showCompanion: () => ipcRenderer.invoke('hubmind:show-companion'),
  resetOrbPosition: () => ipcRenderer.invoke('hubmind:reset-orb-position'),
  hideCompanion: () => ipcRenderer.invoke('hubmind:hide-companion'),
  setCompanionTranscriptVisible: (visible) => ipcRenderer.invoke('hubmind:set-companion-transcript-visible', visible === true),
  setTranscriptOverlayVisible: (visible) => ipcRenderer.invoke('hubmind:set-transcript-overlay-visible', visible === true),
  setCompanionInteractive: (interactive) => ipcRenderer.invoke('hubmind:set-companion-interactive', interactive === true),
  moveCompanionBy: (dx, dy) => ipcRenderer.invoke('hubmind:move-companion-by', dx, dy),
  openUserPath: (path) => ipcRenderer.invoke('hubmind:open-user-path', path, controlCapability),
  openUrl: (url) => ipcRenderer.invoke('hubmind:open-url', url, controlCapability),
  launchApp: (appName) => ipcRenderer.invoke('hubmind:launch-app', appName, controlCapability),
  runReadonlyCommand: (commandName) => ipcRenderer.invoke('hubmind:run-readonly-command', commandName, controlCapability),
  runSystemCommand: (command, purpose) => ipcRenderer.invoke('hubmind:run-system-command', command, purpose, controlCapability),
  typeText: (text) => ipcRenderer.invoke('hubmind:type-text', text, controlCapability),
  pressShortcut: (shortcutName) => ipcRenderer.invoke('hubmind:press-shortcut', shortcutName, controlCapability),
}));
