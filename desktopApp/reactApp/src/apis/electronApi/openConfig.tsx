export const openConfig = async (): Promise<void> => {
  await window.ElectronAPI.openConfig()
}
