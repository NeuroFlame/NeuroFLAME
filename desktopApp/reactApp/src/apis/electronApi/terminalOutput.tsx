export function terminalOutput(onOutput: (data: string) => void) {
  window.ElectronAPI.terminalOutput((_event: unknown, data: string) => {
    if (data) onOutput(data)
  })
}
