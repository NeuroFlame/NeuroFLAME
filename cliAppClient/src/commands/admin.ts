import { gqlRequest } from '../graphqlClient.js'
import { requireSession, usageError, printJsonOrHuman, trailingPositionals } from './shared.js'
import {
  ADMIN_CREATE_VAULT_USER_MUTATION,
  ADMIN_CHANGE_USER_ROLES_MUTATION,
  ADMIN_CHANGE_USER_PASSWORD_MUTATION,
  ADMIN_SET_VAULT_ALLOWED_COMPUTATIONS_MUTATION,
  ADMIN_SET_VAULT_DATASET_MAPPINGS_MUTATION,
  ADMIN_CREATE_HOSTED_VAULT_MUTATION,
  ADMIN_UPDATE_HOSTED_VAULT_MUTATION,
  ADMIN_SET_HOSTED_VAULT_ALLOWED_COMPUTATIONS_MUTATION,
  LoginOutput,
} from '../graphql/operations.js'

export async function adminCommand(
  subcommand: string | undefined,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case 'create-vault-user':
      return createVaultUser(args)
    case 'set-roles':
      return setRoles(args)
    case 'set-password':
      return setPassword(args)
    case 'set-vault-computations':
      return setVaultComputations(args)
    case 'set-vault-datasets':
      return setVaultDatasets(args)
    case 'create-hosted-vault':
      return createHostedVault(args)
    case 'update-hosted-vault':
      return updateHostedVault(args)
    case 'set-hosted-vault-computations':
      return setHostedVaultComputations(args)
    default:
      usageError(
        'neuroflame admin <create-vault-user|set-roles|set-password|' +
          'set-vault-computations|set-vault-datasets|create-hosted-vault|' +
          'update-hosted-vault|set-hosted-vault-computations> ...',
      )
  }
}

async function createVaultUser(args: string[]): Promise<void> {
  const [username, password] = args
  if (!username || !password) {
    usageError('neuroflame admin create-vault-user <username> <password>')
  }
  const session = await requireSession()
  const data = await gqlRequest<{ adminCreateVaultUser: LoginOutput }>(
    session.httpUrl,
    ADMIN_CREATE_VAULT_USER_MUTATION,
    { username, password },
    session.accessToken,
  )
  printJsonOrHuman(
    args.includes('--json'),
    data.adminCreateVaultUser,
    `Vault user created: ${data.adminCreateVaultUser.username} (id: ${data.adminCreateVaultUser.userId})`,
  )
}

async function setRoles(args: string[]): Promise<void> {
  const [username] = args
  const roles = trailingPositionals(args, 1)
  if (!username || roles.length === 0) {
    usageError('neuroflame admin set-roles <username> <role...>')
  }
  const session = await requireSession()
  await gqlRequest<{ adminChangeUserRoles: boolean }>(
    session.httpUrl,
    ADMIN_CHANGE_USER_ROLES_MUTATION,
    { username, roles },
    session.accessToken,
  )
  console.log(`Roles for ${username} set to: ${roles.join(', ')}`)
}

async function setPassword(args: string[]): Promise<void> {
  const [username, password] = args
  if (!username || !password) {
    usageError('neuroflame admin set-password <username> <password>')
  }
  const session = await requireSession()
  await gqlRequest<{ adminChangeUserPassword: boolean }>(
    session.httpUrl,
    ADMIN_CHANGE_USER_PASSWORD_MUTATION,
    { username, password },
    session.accessToken,
  )
  console.log(`Password for ${username} changed.`)
}

async function setVaultComputations(args: string[]): Promise<void> {
  const [userId] = args
  const computationIds = trailingPositionals(args, 1)
  if (!userId || computationIds.length === 0) {
    usageError('neuroflame admin set-vault-computations <userId> <computationId...>')
  }
  const session = await requireSession()
  await gqlRequest<{ adminSetVaultAllowedComputations: boolean }>(
    session.httpUrl,
    ADMIN_SET_VAULT_ALLOWED_COMPUTATIONS_MUTATION,
    { userId, computationIds },
    session.accessToken,
  )
  console.log(`Allowed computations for vault user ${userId} updated.`)
}

async function setVaultDatasets(args: string[]): Promise<void> {
  const [userId] = args
  const pairs = trailingPositionals(args, 1)
  if (!userId || pairs.length === 0) {
    usageError(
      'neuroflame admin set-vault-datasets <userId> <computationId:datasetKey...>',
    )
  }
  const mappings = pairs.map((pair) => {
    const [computationId, datasetKey] = pair.split(':')
    if (!computationId || !datasetKey) {
      throw new Error(`Invalid mapping "${pair}", expected computationId:datasetKey`)
    }
    return { computationId, datasetKey }
  })
  const session = await requireSession()
  await gqlRequest<{ adminSetVaultDatasetMappings: boolean }>(
    session.httpUrl,
    ADMIN_SET_VAULT_DATASET_MAPPINGS_MUTATION,
    { userId, mappings },
    session.accessToken,
  )
  console.log(`Dataset mappings for vault user ${userId} updated.`)
}

async function createHostedVault(args: string[]): Promise<void> {
  const positional = args.filter((a) => !a.startsWith('--'))
  const [serverId, name, description, datasetKey] = positional
  if (!serverId || !name || description === undefined || !datasetKey) {
    usageError(
      'neuroflame admin create-hosted-vault <serverId> <name> <description> <datasetKey>',
    )
  }
  const session = await requireSession()
  const data = await gqlRequest<{ adminCreateHostedVault: string }>(
    session.httpUrl,
    ADMIN_CREATE_HOSTED_VAULT_MUTATION,
    { serverId, name, description, datasetKey },
    session.accessToken,
  )
  printJsonOrHuman(
    args.includes('--json'),
    { vaultId: data.adminCreateHostedVault },
    `Hosted vault created: ${data.adminCreateHostedVault}`,
  )
}

async function updateHostedVault(args: string[]): Promise<void> {
  const positional = args.filter((a) => !a.startsWith('--'))
  const [vaultId, name, description] = positional
  if (!vaultId || !name || description === undefined) {
    usageError('neuroflame admin update-hosted-vault <vaultId> <name> <description>')
  }
  const session = await requireSession()
  await gqlRequest<{ adminUpdateHostedVault: boolean }>(
    session.httpUrl,
    ADMIN_UPDATE_HOSTED_VAULT_MUTATION,
    { vaultId, name, description },
    session.accessToken,
  )
  console.log('Hosted vault updated.')
}

async function setHostedVaultComputations(args: string[]): Promise<void> {
  const [vaultId] = args
  const computationIds = trailingPositionals(args, 1)
  if (!vaultId || computationIds.length === 0) {
    usageError(
      'neuroflame admin set-hosted-vault-computations <vaultId> <computationId...>',
    )
  }
  const session = await requireSession()
  await gqlRequest<{ adminSetHostedVaultAllowedComputations: boolean }>(
    session.httpUrl,
    ADMIN_SET_HOSTED_VAULT_ALLOWED_COMPUTATIONS_MUTATION,
    { vaultId, computationIds },
    session.accessToken,
  )
  console.log(`Allowed computations for hosted vault ${vaultId} updated.`)
}
