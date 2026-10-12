const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('hubMindDesktop', Object.freeze({
  platform: process.platform, isDesktopApp: true,
  startFullControl: () => ipcRenderer.invoke('hubmind:full-control-start'),
  stopFullControl: () => ipcRenderer.invoke('hubmind:full-control-stop'),
  nativeStatus: () => ipcRenderer.invoke('hubmind:native-status'),
  nativeAction: (method, args) => ipcRenderer.invoke('hubmind:native-action', method, args),
  showMain: () => ipcRenderer.invoke('hubmind:show-main'),
  showCompanion: () => ipcRenderer.invoke('hubmind:show-companion'),
  hideCompanion: () => ipcRenderer.invoke('hubmind:hide-companion'),
  moveCompanionBy: (dx, dy) => ipcRenderer.invoke('hubmind:move-companion-by', dx, dy),
  openUserPath: (path) => ipcRenderer.invoke('hubmind:open-user-path', path),
  openUrl: (url) => ipcRenderer.invoke('hubmind:open-url', url),
  launchApp: (appName) => ipcRenderer.invoke('hubmind:launch-app', appName),
  runReadonlyCommand: (commandName) => ipcRenderer.invoke('hubmind:run-readonly-command', commandName),
  runSystemCommand: (command, purpose) => ipcRenderer.invoke('hubmind:run-system-command', command, purpose),
  typeText: (text) => ipcRenderer.invoke('hubmind:type-text', text),
  pressShortcut: (shortcutName) => ipcRenderer.invoke('hubmind:press-shortcut', shortcutName),
}));
