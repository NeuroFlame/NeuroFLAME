export function saveConfig(configString: string) {
  return window.ElectronAPI.saveConfig(configString)
}
