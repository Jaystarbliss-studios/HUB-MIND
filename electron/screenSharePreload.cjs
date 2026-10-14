'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('hubMindScreenShare', Object.freeze({
  onSources(callback) {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, sources) => callback(sources);
    ipcRenderer.on('hubmind:screen-share-sources', listener);
    return () => ipcRenderer.removeListener('hubmind:screen-share-sources', listener);
  },
  choose(sourceId) { return ipcRenderer.invoke('hubmind:screen-share-choose', sourceId); },
  cancel() { return ipcRenderer.invoke('hubmind:screen-share-cancel'); },
}));
