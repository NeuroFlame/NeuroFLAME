export const applyDefaultConfig = async (): Promise<void> => {
  await window.ElectronAPI.applyDefaultConfig()
}
