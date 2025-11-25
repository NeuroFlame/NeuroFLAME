export type EndpointStatus = {
  kind: 'http' | 'graphql' | 'ws' | 'runResults' | 'docker' | 'socket'
  name: string
  target: string
  ok: boolean
  details?: string
  latencyMs?: number
}

export type StatusState = 'checking' | 'ok' | 'down'

export type TerminalDockerStatus = {
  cli: { state: StatusState; target: string; details?: string }
  daemon: { state: StatusState; target: string; details?: string }
}
