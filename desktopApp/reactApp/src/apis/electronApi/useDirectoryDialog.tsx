export function useDirectoryDialog(directory: string) {
  return window.ElectronAPI.useDirectoryDialog(directory)
}
