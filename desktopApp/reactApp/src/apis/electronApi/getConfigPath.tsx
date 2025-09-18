export const getConfigPath = async (): Promise<string> => {
  const configPath = await window.ElectronAPI.getConfigPath()
  return configPath
}
