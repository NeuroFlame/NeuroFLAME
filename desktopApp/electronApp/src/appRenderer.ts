import type { IpcMain, IpcMainEvent, IpcMainInvokeEvent, WebFrameMain } from 'electron'
import { isTrustedAppUrl } from './windowPolicy.js'

type FrameLike = Pick<WebFrameMain, 'parent' | 'url'>

/**
 * Only the app page itself may use privileged IPC or the edge API. Result reports run
 * in subframes or preload-free windows, and window policy keeps them off the app URL.
 */
export const isAppRendererFrame = (
  trustedUrl: string,
  frame: FrameLike | null | undefined,
): boolean =>
  frame !== null && frame !== undefined && frame.parent === null &&
  isTrustedAppUrl(trustedUrl, frame.url)

export function createAppIpc(
  ipcMain: Pick<IpcMain, 'handle' | 'on'>,
  isTrustedFrame: (frame: WebFrameMain | null | undefined) => boolean,
  onRejected: (channel: string) => void,
) {
  return {
    handle(
      channel: string,
      listener: (event: IpcMainInvokeEvent, ...args: any[]) => unknown,
    ): void {
      ipcMain.handle(channel, (event, ...args) => {
        if (!isTrustedFrame(event.senderFrame)) {
          onRejected(channel)
          throw new Error('IPC requests must originate from the app renderer.')
        }
        return listener(event, ...args)
      })
    },
    on(channel: string, listener: (event: IpcMainEvent, ...args: any[]) => void): void {
      ipcMain.on(channel, (event, ...args) => {
        if (!isTrustedFrame(event.senderFrame)) {
          onRejected(channel)
          return
        }
        listener(event, ...args)
      })
    },
  }
}
