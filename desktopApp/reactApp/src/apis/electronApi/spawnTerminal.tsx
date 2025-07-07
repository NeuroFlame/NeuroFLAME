export function spawnTerminal(setTerminalReady: any) {
    window.ElectronAPI.spawnTerminal();
    setTerminalReady(true);
}