const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('ElectronAPI', { canary: true })
