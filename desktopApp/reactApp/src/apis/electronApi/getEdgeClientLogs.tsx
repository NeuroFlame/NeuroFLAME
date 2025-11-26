import { EdgeClientLogsResponse } from './electronApi'

type EdgeLogsOptions = {
  maxBytes?: number;
  maxLines?: number;
}

export const getEdgeClientLogs = async (
  options?: EdgeLogsOptions,
): Promise<EdgeClientLogsResponse> => window.ElectronAPI.getEdgeClientLogs(options)
