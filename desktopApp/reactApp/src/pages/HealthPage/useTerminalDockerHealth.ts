import { useCallback, useEffect, useRef, useState } from 'react'
import { electronApi } from '../../apis/electronApi/electronApi'

export type StatusState = 'checking' | 'ok' | 'down'
export type TerminalDockerStatus = {
  cli: { state: StatusState; target: string; details?: string }
  daemon: { state: StatusState; target: string; details?: string }
}

// Permissive matchers
const CLIENT_OK = [
  /^[0-9]+\.[0-9.]+(?:-[\w.+]+)?$/i,          // docker version --format "{{.Client.Version}}"
  /Docker version\s+\d+\.\d+[^\s]*/i,         // docker --version
  /Client:\s*Docker Engine/i,
]
const SERVER_OK = [
  /^[0-9]+\.[0-9.]+(?:-[\w.+]+)?$/i,          // docker info --format "{{.ServerVersion}}"
  /Server:\s*Docker Engine/i,
  /Server Version:\s*[\w.\-+]+/i,
  /Storage Driver:\s+\w+/i,
]
const CLI_NOT_FOUND = [
  /docker: command not found/i,
  /'docker' is not recognized as an internal or external command/i,
  /executable file not found in \$PATH/i,
]
const DAEMON_ERRORS = [
  /Cannot connect to the Docker daemon/i,
  /daemon.+is it running\?/i,
  /permission denied.*docker\.sock/i,
  /dial unix .*docker\.sock/i,
  /connect .* (unix|tcp):\/\//i,
]

const DEFAULT_TIMEOUT_MS = 8000

export function useTerminalDockerHealth(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<TerminalDockerStatus>({
    cli: { state: 'checking', target: 'docker version (client)' },
    daemon: { state: 'checking', target: 'docker info (server)' },
  })

  const bufferRef = useRef<string[]>([])              // full output buffer
  const settledRef = useRef({ cli: false, daemon: false })
  const timersRef = useRef<{ cli?: number; daemon?: number }>({})

  const {
    spawnTerminal,
    terminalInput,
    terminalOutput,
    removeTerminalOutputListener,
  } = electronApi

  // Ensure newline so the command runs
  const send = useCallback((cmd: string) => {
    const needsNL = !/\n$/.test(cmd)
    terminalInput(needsNL ? cmd + '\n' : cmd)
  }, [terminalInput])

  const scanLines = (lines: string[]) => {
    for (const raw of lines) {
      const line = String(raw ?? '').trim()
      if (!line) continue

      if (!settledRef.current.cli) {
        if (CLIENT_OK.some(rx => rx.test(line))) {
          settledRef.current.cli = true
          setStatus(s => ({ ...s, cli: { state: 'ok', target: s.cli.target, details: 'CLI detected' }}))
        } else if (CLI_NOT_FOUND.some(rx => rx.test(line))) {
          settledRef.current.cli = true
          setStatus(s => ({ ...s, cli: { state: 'down', target: s.cli.target, details: 'docker not found in PATH' }}))
        }
      }

      if (!settledRef.current.daemon) {
        if (SERVER_OK.some(rx => rx.test(line))) {
          settledRef.current.daemon = true
          setStatus(s => ({ ...s, daemon: { state: 'ok', target: s.daemon.target, details: 'Docker Engine reachable' }}))
        } else if (DAEMON_ERRORS.some(rx => rx.test(line))) {
          settledRef.current.daemon = true
          setStatus(s => ({ ...s, daemon: { state: 'down', target: s.daemon.target, details: 'Cannot connect to Docker daemon (socket/permissions)' }}))
        }
      }
    }
  }

  // Wrapped setter that can handle function updaters
  const setOutputDetecting = useCallback((val: any) => {
    if (typeof val === 'function') {
      const prev = bufferRef.current
      const next = val(prev) as string[]           // let the bridge build the next array
      const added = next.slice(prev.length)        // diff = new lines appended
      bufferRef.current = next
      if (added.length) scanLines(added)
    } else {
      const arr = Array.isArray(val) ? val : [val]
      if (arr.length === 0) return
      bufferRef.current = [...bufferRef.current, ...arr]
      scanLines(arr)
    }
  }, [])

  useEffect(() => {
    spawnTerminal(() => setReady(true))

    // IMPORTANT: pass (outputArray, setter) like your API expects
    terminalOutput(bufferRef.current, setOutputDetecting)

    return () => {
      removeTerminalOutputListener()
      if (timersRef.current.cli) clearTimeout(timersRef.current.cli)
      if (timersRef.current.daemon) clearTimeout(timersRef.current.daemon)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runDockerChecks = useCallback(() => {
    if (timersRef.current.cli) clearTimeout(timersRef.current.cli)
    if (timersRef.current.daemon) clearTimeout(timersRef.current.daemon)
    settledRef.current = { cli: false, daemon: false }
    setStatus({
      cli: { state: 'checking', target: 'docker version (client)' },
      daemon: { state: 'checking', target: 'docker info (server)' },
    })

    // CLI (doesn't require daemon)
    send(`docker version --format "{{.Client.Version}}"`)
    send(`docker --version`)

    // Daemon (requires engine)
    send(`docker info --format "{{.ServerVersion}}"`)
    send(`docker info`)

    // Timeouts (only mark down if nothing matched)
    timersRef.current.cli = window.setTimeout(() => {
      if (!settledRef.current.cli) {
        settledRef.current.cli = true
        setStatus(s => ({ ...s, cli: { state: 'down', target: s.cli.target, details: 'timeout waiting for client version' }}))
      }
    }, timeoutMs)

    timersRef.current.daemon = window.setTimeout(() => {
      if (!settledRef.current.daemon) {
        settledRef.current.daemon = true
        setStatus(s => ({ ...s, daemon: { state: 'down', target: s.daemon.target, details: 'timeout waiting for daemon response' }}))
      }
    }, timeoutMs)
  }, [send, timeoutMs])

  // expose last N lines for your log viewer
  const getLastLines = useCallback((n: number = 50) => {
    return bufferRef.current.slice(-n).map((l, i) => `${i}: ${l}`)
  }, [])

  // image probe utility (unchanged)
  const checkImageExists = useCallback((imageName: string, onDone?: (exists: boolean) => void) => {
    const rx = new RegExp(imageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    send(`docker image inspect ${imageName}`)
    const t = setTimeout(() => {
      const last = bufferRef.current.slice(-300).join('\n')
      const exists = /"Id":\s*"sha256:/.test(last) || rx.test(last) || /Status:\s+Downloaded newer image for/i.test(last)
      onDone?.(exists)
    }, 900)
    return () => clearTimeout(t)
  }, [send])

  return { ready, status, runDockerChecks, checkImageExists, getLastLines }
}
