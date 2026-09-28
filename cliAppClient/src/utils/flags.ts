// Minimal argv parsing — no external dependency (mirrors the manual
// process.argv handling already used in vaultFederatedClient's cli.ts).
// Supports `--flag value` and boolean `--flag`.

export function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = args[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      flags[key] = next
      i++
    } else {
      flags[key] = 'true'
    }
  }
  return flags
}

export function positionals(args: string[]): string[] {
  const result: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const next = args[i + 1]
      if (next !== undefined && !next.startsWith('--')) i++
      continue
    }
    result.push(arg)
  }
  return result
}
