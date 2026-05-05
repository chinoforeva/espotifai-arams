const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    fetchGames: () => ipcRenderer.invoke('fetch-games'),
    getData: () => ipcRenderer.invoke('get-data'),
    onGamesUpdated: (callback) => ipcRenderer.on('games-updated', callback)
});
