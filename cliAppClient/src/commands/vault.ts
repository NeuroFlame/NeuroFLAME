import { gqlRequest } from '../graphqlClient.js'
import { requireSession, usageError } from './shared.js'
import {
  GET_MY_VAULT_CONFIG_QUERY,
  GET_MY_VAULT_SERVER_CONFIG_QUERY,
  GET_VAULT_USER_LIST_QUERY,
  GET_VAULT_SERVER_LIST_QUERY,
  GET_HOSTED_VAULT_LIST_QUERY,
  Vault,
  VaultServer,
  PublicUser,
  HostedVault,
} from '../graphql/operations.js'

export async function vaultCommand(
  subcommand: string | undefined,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case 'my-config':
      return myConfig(args)
    case 'my-server':
      return myServer(args)
    case 'list-users':
      return listUsers(args)
    case 'list-servers':
      return listServers(args)
    case 'list-hosted':
      return listHosted(args)
    default:
      usageError('neuroflame vault <my-config|my-server|list-users|list-servers|list-hosted> ...')
  }
}

async function myConfig(args: string[]): Promise<void> {
  const session = await requireSession()
  const data = await gqlRequest<{ getMyVaultConfig: Vault }>(
    session.httpUrl,
    GET_MY_VAULT_CONFIG_QUERY,
    {},
    session.accessToken,
  )
  if (args.includes('--json')) {
    console.log(JSON.stringify(data.getMyVaultConfig, null, 2))
    return
  }
  const v = data.getMyVaultConfig
  console.log(`${v.name}: ${v.description}`)
  console.log(`allowed computations: ${v.allowedComputations.map((c) => c.title).join(', ') || '(none)'}`)
  console.log(`dataset mappings: ${v.datasetMappings.length}`)
}

async function myServer(args: string[]): Promise<void> {
  const session = await requireSession()
  const data = await gqlRequest<{ getMyVaultServerConfig: VaultServer }>(
    session.httpUrl,
    GET_MY_VAULT_SERVER_CONFIG_QUERY,
    {},
    session.accessToken,
  )
  if (args.includes('--json')) {
    console.log(JSON.stringify(data.getMyVaultServerConfig, null, 2))
    return
  }
  const s = data.getMyVaultServerConfig
  console.log(`${s.name} (${s.username})`)
  console.log(`status: ${s.status?.status ?? 'unknown'}  websocket: ${s.status?.websocketConnected ?? 'unknown'}`)
  console.log(`hosted vaults: ${s.vaults.length}`)
  const datasets = s.status?.availableDatasets ?? []
  console.log(
    `available datasets: ${datasets.length === 0 ? '(none reported)' : datasets.map((d) => d.key).join(', ')}`,
  )
}

async function listUsers(args: string[]): Promise<void> {
  const session = await requireSession()
  const data = await gqlRequest<{ getVaultUserList: PublicUser[] }>(
    session.httpUrl,
    GET_VAULT_USER_LIST_QUERY,
    {},
    session.accessToken,
  )
  const list = data.getVaultUserList
  if (args.includes('--json')) {
    console.log(JSON.stringify(list, null, 2))
    return
  }
  if (list.length === 0) {
    console.log('No vault users found.')
    return
  }
  for (const u of list) {
    console.log(`${u.id}  ${u.username}`)
  }
}

async function listServers(args: string[]): Promise<void> {
  const session = await requireSession()
  const data = await gqlRequest<{ getVaultServerList: VaultServer[] }>(
    session.httpUrl,
    GET_VAULT_SERVER_LIST_QUERY,
    {},
    session.accessToken,
  )
  const list = data.getVaultServerList
  if (args.includes('--json')) {
    console.log(JSON.stringify(list, null, 2))
    return
  }
  if (list.length === 0) {
    console.log('No vault servers found.')
    return
  }
  for (const s of list) {
    const datasets = s.status?.availableDatasets ?? []
    console.log(`${s.id}  ${s.name}  (${s.username})  status: ${s.status?.status ?? 'unknown'}  vaults: ${s.vaults.length}`)
    console.log(
      `    available datasets: ${datasets.length === 0 ? '(none reported)' : datasets.map((d) => d.key).join(', ')}`,
    )
  }
}

async function listHosted(args: string[]): Promise<void> {
  const serverId = args.find((a) => !a.startsWith('--'))
  const session = await requireSession()
  const data = await gqlRequest<{ getHostedVaultList: HostedVault[] }>(
    session.httpUrl,
    GET_HOSTED_VAULT_LIST_QUERY,
    { serverId: serverId ?? null },
    session.accessToken,
  )
  const list = data.getHostedVaultList
  if (args.includes('--json')) {
    console.log(JSON.stringify(list, null, 2))
    return
  }
  if (list.length === 0) {
    console.log('No hosted vaults found.')
    return
  }
  for (const v of list) {
    console.log(`${v.id}  ${v.name}${v.active ? '' : '  [inactive]'}  dataset: ${v.datasetKey}`)
  }
}
