declare module 'ws' {
  export class WebSocket {
    constructor(address: string, protocols?: any, options?: any)
    on(event: string, listener: (...args: any[]) => void): this
    once(event: string, listener: (...args: any[]) => void): this
    send(data: any, cb?: (err?: Error) => void): void
    close(code?: number, reason?: string): void
    terminate(): void
    readyState: number
  }

  export class WebSocketServer {
    constructor(options?: any, callback?: () => void)
    on(event: string, listener: (...args: any[]) => void): this
    close(cb?: (err?: Error) => void): void
    clients: Set<WebSocket>
  }

  export default WebSocket
}
