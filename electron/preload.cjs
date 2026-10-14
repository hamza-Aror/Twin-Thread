const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('climateTwinDesktop', {
  requestOverpass: (request) =>
    ipcRenderer.invoke('overpass:request', request),
});