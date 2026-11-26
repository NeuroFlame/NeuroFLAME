export async function spawnTerminal(): Promise<void> {
  await window.ElectronAPI.spawnTerminal()
}
