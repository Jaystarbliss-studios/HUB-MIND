const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hubMindDesktop', Object.freeze({
  platform: process.platform,
  showMain: () => ipcRenderer.invoke('hubmind:show-main'),
  showCompanion: () => ipcRenderer.invoke('hubmind:show-companion'),
  hideCompanion: () => ipcRenderer.invoke('hubmind:hide-companion'),
  openUserPath: (path) => ipcRenderer.invoke('hubmind:open-user-path', path),
}));
