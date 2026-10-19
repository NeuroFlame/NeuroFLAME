import { BlockList, isIP } from 'node:net'
import type { IncomingHttpHeaders } from 'node:http'

export interface ClientAddressRequest {
  headers: IncomingHttpHeaders
  socket?: { remoteAddress?: string }
}

const normalizeAddress = (value: string): string | undefined => {
  if (value.startsWith('::ffff:') && isIP(value.slice(7)) === 4) return value.slice(7)
  if (isIP(value) === 4) return value
  if (isIP(value) === 6) return new URL(`http://[${value}]/`).hostname.slice(1, -1)
  return undefined
}

export const createClientAddressResolver = (trustedProxies = '') => {
  const trusted = new BlockList()
  for (const entry of trustedProxies.split(',').map((value) => value.trim()).filter(Boolean)) {
    const [address, prefix, ...extra] = entry.split('/')
    const version = isIP(address)
    const family = version === 4 ? 'ipv4' : 'ipv6'
    if (!version || extra.length || (prefix !== undefined &&
        (!/^\d+$/.test(prefix) || Number(prefix) > (version === 4 ? 32 : 128)))) {
      throw new Error('AUTH_RATE_LIMIT_TRUSTED_PROXIES must contain IP addresses or CIDR networks')
    }
    if (prefix === undefined) trusted.addAddress(address, family)
    else trusted.addSubnet(address, Number(prefix), family)
  }
  return (request?: ClientAddressRequest): string => {
    let address = normalizeAddress(request?.socket?.remoteAddress ?? '') ?? 'unknown'
    const forwarded = request?.headers['x-forwarded-for']
    if (typeof forwarded !== 'string') return address
    // Walk from the socket towards the client, stopping at the first untrusted hop.
    for (const hop of forwarded.split(',').reverse()) {
      if (address === 'unknown' || !trusted.check(address, isIP(address) === 4 ? 'ipv4' : 'ipv6')) break
      const next = normalizeAddress(hop.trim())
      if (!next) break
      address = next
    }
    return address
  }
}

export const getClientAddress = createClientAddressResolver(process.env.AUTH_RATE_LIMIT_TRUSTED_PROXIES)
