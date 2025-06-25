import { applyDefaultConfig } from "./applyDefaultConfig";
import { getConfig } from "./getConfig";
import { getConfigPath } from "./getConfigPath";
import { openConfig } from "./openConfig";
import { useDirectoryDialog } from "./useDirectoryDialog";
import { saveConfig } from "./saveConfig";
import { restartApp } from "./restartApp";
import { spawnTerminal } from "./spawnTerminal";
import { terminalInput } from "./terminalInput";
import { terminalOutput } from "./terminalOutput";
import { removeTerminalOutputListener } from "./removeTerminalOutputListener";

export interface Config {
  centralServerQueryUrl: string;
  centralServerSubscriptionUrl: string;
  edgeClientQueryUrl: string;
  edgeClientSubscriptionUrl: string;
  edgeClientRunResultsUrl: string;
  startEdgeClientOnLaunch: boolean;
  edgeClientConfig: {
    httpUrl: string,
    wsUrl: string,
    path_base_directory: string,
    authenticationEndpoint: string,
    hostingPort: number
  }
}

interface ElectronAPI {
  getConfigPath: () => Promise<string>;
  getConfig: () => Promise<Config>;
  openConfig: () => Promise<void>;
  saveConfig: (configString: string) => Promise<void>;
  applyDefaultConfig: () => Promise<void>;
  useDirectoryDialog: (pathString?: string) => Promise<{ directoryPath: undefined | string, canceled: boolean, error: string | null }>;
  restartApp: () => void;
  spawnTerminal: () => void;
  terminalOutput: (output: any) => Promise<{ output: any }>;
  terminalInput: (input: any) => Promise<{ input: any }>;
  removeTerminalOutputListener: () => void;
}

declare global {
  interface Window {
    ElectronAPI: ElectronAPI;
  }
}

export const electronApi = {
  getConfig,
  openConfig,
  getConfigPath,
  saveConfig,
  applyDefaultConfig,
  useDirectoryDialog,
  restartApp,
  terminalOutput,
  terminalInput,
  spawnTerminal,
  removeTerminalOutputListener
}


