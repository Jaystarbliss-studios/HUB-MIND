'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

/**
 * Deliberately smaller than the workspace preload. The local offline character
 * can render state and request a few narrowly scoped desktop actions; it cannot
 * access filesystem, shell, browser, MCP, or arbitrary native-action APIs.
 */
contextBridge.exposeInMainWorld('jessCompanion', Object.freeze({
  onState: callback => subscribe('hubmind:jess-state', callback),
  action: action => ipcRenderer.invoke('hubmind:jess-companion-action', action),
  moveBy: (dx, dy) => ipcRenderer.invoke('hubmind:jess-companion-move', { dx, dy }),
  resize: (width, height) => ipcRenderer.invoke('hubmind:jess-companion-resize', { width, height }),
  setInteractive: interactive => ipcRenderer.invoke('hubmind:jess-companion-interactive', interactive === true),
}));
