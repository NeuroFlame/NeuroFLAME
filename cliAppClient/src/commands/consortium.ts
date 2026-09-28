import { gqlRequest, subscribeToCentral } from '../graphqlClient.js'
import { requireSession, usageError, parseBool, printJsonOrHuman } from './shared.js'
import { parseFlags } from '../utils/flags.js'
import {
  GET_CONSORTIUM_LIST_QUERY,
  GET_CONSORTIUM_DETAILS_QUERY,
  CONSORTIUM_CREATE_MUTATION,
  CONSORTIUM_EDIT_MUTATION,
  CONSORTIUM_JOIN_MUTATION,
  CONSORTIUM_JOIN_BY_INVITE_MUTATION,
  CONSORTIUM_DELETE_MUTATION,
  CONSORTIUM_LEAVE_MUTATION,
  CONSORTIUM_SET_MEMBER_ACTIVE_MUTATION,
  CONSORTIUM_SET_MEMBER_READY_MUTATION,
  CONSORTIUM_INVITE_MUTATION,
  GET_INVITE_INFO_QUERY,
  LEADER_ADD_HOSTED_VAULT_MUTATION,
  LEADER_SET_HOSTED_VAULT_ACTIVE_MUTATION,
  LEADER_REMOVE_HOSTED_VAULT_MUTATION,
  LEADER_SET_MEMBER_INACTIVE_MUTATION,
  LEADER_REMOVE_MEMBER_MUTATION,
  LEADER_ADD_VAULT_USER_MUTATION,
  CONSORTIUM_DETAILS_CHANGED_SUBSCRIPTION,
  ConsortiumListItem,
  ConsortiumDetails,
  InviteInfo,
} from '../graphql/operations.js'

export async function consortiumCommand(
  subcommand: string | undefined,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case 'list':
      return list(args)
    case 'show':
      return show(args)
    case 'create':
      return create(args)
    case 'edit':
      return edit(args)
    case 'join':
      return join(args)
    case 'join-by-invite':
      return joinByInvite(args)
    case 'leave':
      return leave(args)
    case 'delete':
      return remove(args)
    case 'invite':
      return invite(args)
    case 'invite-info':
      return inviteInfo(args)
    case 'set-active':
      return setActive(args)
    case 'set-ready':
      return setReady(args)
    case 'add-vault':
      return addVault(args)
    case 'remove-vault':
      return removeVault(args)
    case 'set-vault-active':
      return setVaultActive(args)
    case 'set-member-inactive':
      return setMemberInactive(args)
    case 'remove-member':
      return removeMember(args)
    case 'add-vault-user':
      return addVaultUser(args)
    case 'watch':
      return watch(args)
    default:
      usageError(
        'neuroflame consortium <list|show|create|edit|join|join-by-invite|' +
          'leave|delete|invite|invite-info|set-active|set-ready|add-vault|' +
          'remove-vault|set-vault-active|set-member-inactive|remove-member|' +
          'add-vault-user|watch> ...',
      )
  }
}

async function list(args: string[]): Promise<void> {
  const session = await requireSession()
  const data = await gqlRequest<{ getConsortiumList: ConsortiumListItem[] }>(
    session.httpUrl,
    GET_CONSORTIUM_LIST_QUERY,
    {},
    session.accessToken,
  )
  const list = data.getConsortiumList

  if (args.includes('--json')) {
    console.log(JSON.stringify(list, null, 2))
    return
  }
  if (list.length === 0) {
    console.log('No consortia found.')
    return
  }
  for (const c of list) {
    console.log(`${c.id}  ${c.title}${c.isPrivate ? '  [private]' : ''}`)
    console.log(`    leader: ${c.leader.username}  members: ${c.members.length}`)
  }
}

export async function fetchDetails(
  httpUrl: string,
  accessToken: string,
  consortiumId: string,
): Promise<ConsortiumDetails> {
  const data = await gqlRequest<{ getConsortiumDetails: ConsortiumDetails }>(
    httpUrl,
    GET_CONSORTIUM_DETAILS_QUERY,
    { consortiumId },
    accessToken,
  )
  return data.getConsortiumDetails
}

export function printDetails(details: ConsortiumDetails): void {
  console.log(`${details.title}${details.isPrivate ? '  [private]' : ''}`)
  console.log(details.description)
  console.log(`leader: ${details.leader.username}`)
  console.log(
    `members: ${details.members.length}  active: ${details.activeMembers.length}  ready: ${details.readyMembers.length}`,
  )
  console.log(
    `vaults: ${details.vaultMembers.length}  active: ${details.activeVaultMembers.length}  ready: ${details.readyVaultMembers.length}`,
  )
  const computation = details.studyConfiguration.computation
  console.log(
    `study computation: ${computation ? computation.title : '(none set)'}`,
  )
}

async function show(args: string[]): Promise<void> {
  const [consortiumId] = args
  if (!consortiumId) {
    usageError('neuroflame consortium show <consortiumId> [--json]')
  }
  const session = await requireSession()
  const details = await fetchDetails(session.httpUrl, session.accessToken, consortiumId)

  if (args.includes('--json')) {
    console.log(JSON.stringify(details, null, 2))
    return
  }
  printDetails(details)
}

async function create(args: string[]): Promise<void> {
  const flags = parseFlags(args)
  const title = args.find((a) => !a.startsWith('--'))
  if (!title) {
    usageError(
      'neuroflame consortium create <title> [--description <text>] [--private]',
    )
  }
  const session = await requireSession()
  const data = await gqlRequest<{ consortiumCreate: string }>(
    session.httpUrl,
    CONSORTIUM_CREATE_MUTATION,
    {
      // Not `?? null` — centralApi stores this verbatim with no fallback
      // (see consortiumCreate in resolvers.ts), and ConsortiumDetails/
      // ConsortiumListItem.description is non-nullable, so a stored `null`
      // breaks *every* future `consortium list`/`show` for anyone, not
      // just this record. Always send a string.
      title,
      description: flags.description ?? '',
      isPrivate: 'private' in flags,
    },
    session.accessToken,
  )
  printJsonOrHuman(
    args.includes('--json'),
    { consortiumId: data.consortiumCreate },
    `Created consortium: ${data.consortiumCreate}`,
  )
}

async function edit(args: string[]): Promise<void> {
  const positional = args.filter((a) => !a.startsWith('--'))
  const [consortiumId, title, description] = positional
  if (!consortiumId || !title || description === undefined) {
    usageError(
      'neuroflame consortium edit <consortiumId> <title> <description> [--private]',
    )
  }
  const session = await requireSession()
  await gqlRequest<{ consortiumEdit: boolean }>(
    session.httpUrl,
    CONSORTIUM_EDIT_MUTATION,
    { consortiumId, title, description, isPrivate: args.includes('--private') },
    session.accessToken,
  )
  console.log('Consortium updated.')
}

async function join(args: string[]): Promise<void> {
  const [consortiumId] = args
  if (!consortiumId) usageError('neuroflame consortium join <consortiumId>')
  const session = await requireSession()
  await gqlRequest<{ consortiumJoin: boolean }>(
    session.httpUrl,
    CONSORTIUM_JOIN_MUTATION,
    { consortiumId },
    session.accessToken,
  )
  console.log('Joined consortium.')
}

async function joinByInvite(args: string[]): Promise<void> {
  const [inviteToken] = args
  if (!inviteToken) usageError('neuroflame consortium join-by-invite <token>')
  const session = await requireSession()
  await gqlRequest<{ consortiumJoinByInvite: boolean }>(
    session.httpUrl,
    CONSORTIUM_JOIN_BY_INVITE_MUTATION,
    { inviteToken },
    session.accessToken,
  )
  console.log('Joined consortium.')
}

async function leave(args: string[]): Promise<void> {
  const [consortiumId] = args
  if (!consortiumId) usageError('neuroflame consortium leave <consortiumId>')
  const session = await requireSession()
  await gqlRequest<{ consortiumLeave: boolean }>(
    session.httpUrl,
    CONSORTIUM_LEAVE_MUTATION,
    { consortiumId },
    session.accessToken,
  )
  console.log('Left consortium.')
}

async function remove(args: string[]): Promise<void> {
  const [consortiumId] = args
  if (!consortiumId) usageError('neuroflame consortium delete <consortiumId>')
  const session = await requireSession()
  await gqlRequest<{ consortiumDelete: boolean }>(
    session.httpUrl,
    CONSORTIUM_DELETE_MUTATION,
    { consortiumId },
    session.accessToken,
  )
  console.log('Consortium deleted.')
}

async function invite(args: string[]): Promise<void> {
  const [consortiumId, email] = args
  if (!consortiumId || !email) {
    usageError('neuroflame consortium invite <consortiumId> <email>')
  }
  const session = await requireSession()
  await gqlRequest<{ consortiumInvite: boolean }>(
    session.httpUrl,
    CONSORTIUM_INVITE_MUTATION,
    { consortiumId, email },
    session.accessToken,
  )
  console.log(`Invite sent to ${email}.`)
}

async function inviteInfo(args: string[]): Promise<void> {
  const [inviteToken] = args
  if (!inviteToken) usageError('neuroflame consortium invite-info <token> [--json]')
  const session = await requireSession()
  const data = await gqlRequest<{ getInviteInfo: InviteInfo }>(
    session.httpUrl,
    GET_INVITE_INFO_QUERY,
    { inviteToken },
    session.accessToken,
  )
  const info = data.getInviteInfo
  printJsonOrHuman(
    args.includes('--json'),
    info,
    `${info.consortiumName} (leader: ${info.leaderName})${info.isExpired ? '  [expired]' : ''}`,
  )
}

async function setActive(args: string[]): Promise<void> {
  const [consortiumId, activeStr] = args
  if (!consortiumId || activeStr === undefined) {
    usageError('neuroflame consortium set-active <consortiumId> <true|false>')
  }
  const active = parseBool(activeStr, 'active')
  const session = await requireSession()
  await gqlRequest<{ consortiumSetMemberActive: boolean }>(
    session.httpUrl,
    CONSORTIUM_SET_MEMBER_ACTIVE_MUTATION,
    { consortiumId, active },
    session.accessToken,
  )
  console.log(`Active set to ${active}.`)
}

async function setReady(args: string[]): Promise<void> {
  const [consortiumId, readyStr] = args
  if (!consortiumId || readyStr === undefined) {
    usageError('neuroflame consortium set-ready <consortiumId> <true|false>')
  }
  const ready = parseBool(readyStr, 'ready')
  const session = await requireSession()
  await gqlRequest<{ consortiumSetMemberReady: boolean }>(
    session.httpUrl,
    CONSORTIUM_SET_MEMBER_READY_MUTATION,
    { consortiumId, ready },
    session.accessToken,
  )
  console.log(`Ready set to ${ready}.`)
}

async function addVault(args: string[]): Promise<void> {
  const [consortiumId, vaultId] = args
  if (!consortiumId || !vaultId) {
    usageError('neuroflame consortium add-vault <consortiumId> <vaultId>')
  }
  const session = await requireSession()
  await gqlRequest<{ leaderAddHostedVault: boolean }>(
    session.httpUrl,
    LEADER_ADD_HOSTED_VAULT_MUTATION,
    { consortiumId, vaultId },
    session.accessToken,
  )
  console.log('Vault added to consortium.')
}

async function removeVault(args: string[]): Promise<void> {
  const [consortiumId, vaultId] = args
  if (!consortiumId || !vaultId) {
    usageError('neuroflame consortium remove-vault <consortiumId> <vaultId>')
  }
  const session = await requireSession()
  await gqlRequest<{ leaderRemoveHostedVault: boolean }>(
    session.httpUrl,
    LEADER_REMOVE_HOSTED_VAULT_MUTATION,
    { consortiumId, vaultId },
    session.accessToken,
  )
  console.log('Vault removed from consortium.')
}

async function setVaultActive(args: string[]): Promise<void> {
  const [consortiumId, vaultId, activeStr] = args
  if (!consortiumId || !vaultId || activeStr === undefined) {
    usageError(
      'neuroflame consortium set-vault-active <consortiumId> <vaultId> <true|false>',
    )
  }
  const active = parseBool(activeStr, 'active')
  const session = await requireSession()
  await gqlRequest<{ leaderSetHostedVaultActive: boolean }>(
    session.httpUrl,
    LEADER_SET_HOSTED_VAULT_ACTIVE_MUTATION,
    { consortiumId, vaultId, active },
    session.accessToken,
  )
  console.log(`Vault active set to ${active}.`)
}

async function setMemberInactive(args: string[]): Promise<void> {
  const [consortiumId, userId, activeStr] = args
  if (!consortiumId || !userId || activeStr === undefined) {
    usageError(
      'neuroflame consortium set-member-inactive <consortiumId> <userId> <true|false>',
    )
  }
  const active = parseBool(activeStr, 'active')
  const session = await requireSession()
  await gqlRequest<{ leaderSetMemberInactive: boolean }>(
    session.httpUrl,
    LEADER_SET_MEMBER_INACTIVE_MUTATION,
    { consortiumId, userId, active },
    session.accessToken,
  )
  console.log(`Member active set to ${active}.`)
}

async function removeMember(args: string[]): Promise<void> {
  const [consortiumId, userId] = args
  if (!consortiumId || !userId) {
    usageError('neuroflame consortium remove-member <consortiumId> <userId>')
  }
  const session = await requireSession()
  await gqlRequest<{ leaderRemoveMember: boolean }>(
    session.httpUrl,
    LEADER_REMOVE_MEMBER_MUTATION,
    { consortiumId, userId },
    session.accessToken,
  )
  console.log('Member removed.')
}

async function addVaultUser(args: string[]): Promise<void> {
  const [consortiumId, userId] = args
  if (!consortiumId || !userId) {
    usageError('neuroflame consortium add-vault-user <consortiumId> <userId>')
  }
  const session = await requireSession()
  await gqlRequest<{ leaderAddVaultUser: boolean }>(
    session.httpUrl,
    LEADER_ADD_VAULT_USER_MUTATION,
    { consortiumId, userId },
    session.accessToken,
  )
  console.log('Vault user added to consortium.')
}

async function watch(args: string[]): Promise<void> {
  const [consortiumId] = args
  if (!consortiumId) usageError('neuroflame consortium watch <consortiumId> [--json]')
  const json = args.includes('--json')
  const session = await requireSession()

  const initial = await fetchDetails(session.httpUrl, session.accessToken, consortiumId)
  if (json) console.log(JSON.stringify(initial, null, 2))
  else printDetails(initial)

  console.error('Watching for changes. Press Ctrl+C to stop.')

  await new Promise<void>((resolve) => {
    process.on('SIGINT', () => {
      unsubscribe()
      resolve()
    })

    const unsubscribe = subscribeToCentral<string>(
      session.wsUrl,
      session.accessToken,
      CONSORTIUM_DETAILS_CHANGED_SUBSCRIPTION,
      () => {
        fetchDetails(session.httpUrl, session.accessToken, consortiumId)
          .then((details) => {
            if (json) console.log(JSON.stringify(details, null, 2))
            else printDetails(details)
          })
          .catch((error: unknown) => {
            console.error(
              'Failed to refresh consortium details:',
              error instanceof Error ? error.message : error,
            )
          })
      },
      (error) => {
        console.error(
          'Subscription error:',
          error instanceof Error ? error.message : error,
        )
        process.exitCode = 1
        unsubscribe()
        resolve()
      },
      { consortiumId },
    )
  })
}
