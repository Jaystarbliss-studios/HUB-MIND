const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('hubMindDesktop', Object.freeze({
  platform: process.platform, isDesktopApp: true,
  showMain: () => ipcRenderer.invoke('hubmind:show-main'),
  showCompanion: () => ipcRenderer.invoke('hubmind:show-companion'),
  hideCompanion: () => ipcRenderer.invoke('hubmind:hide-companion'),
  openUserPath: (path) => ipcRenderer.invoke('hubmind:open-user-path', path),
  openUrl: (url) => ipcRenderer.invoke('hubmind:open-url', url),
  launchApp: (appName) => ipcRenderer.invoke('hubmind:launch-app', appName),
  runReadonlyCommand: (commandName) => ipcRenderer.invoke('hubmind:run-readonly-command', commandName),
}));
