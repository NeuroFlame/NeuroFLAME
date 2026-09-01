import { gqlRequest } from '../graphqlClient.js'
import { resolveServerUrls } from '../config.js'
import { requireSession, usageError } from './shared.js'
import {
  USER_CREATE_MUTATION,
  USER_CHANGE_PASSWORD_MUTATION,
  REQUEST_PASSWORD_RESET_MUTATION,
  RESET_PASSWORD_MUTATION,
  LoginOutput,
} from '../graphql/operations.js'

export async function userCommand(
  subcommand: string | undefined,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case 'create':
      return userCreate(args)
    case 'change-password':
      return userChangePassword(args)
    case 'request-password-reset':
      return requestPasswordReset(args)
    case 'reset-password':
      return resetPassword(args)
    default:
      usageError(
        'neuroflame user <create|change-password|request-password-reset|reset-password> ...',
      )
  }
}

async function userCreate(args: string[]): Promise<void> {
  const [username, password] = args
  if (!username || !password) {
    usageError('neuroflame user create <username> <password>')
  }
  const { httpUrl } = await resolveServerUrls(null)
  const data = await gqlRequest<{ userCreate: LoginOutput }>(
    httpUrl,
    USER_CREATE_MUTATION,
    { username, password },
  )
  console.log(
    `User created: ${data.userCreate.username} (id: ${data.userCreate.userId})`,
  )
  console.log('Run `neuroflame login` to start a session as this user.')
}

async function userChangePassword(args: string[]): Promise<void> {
  const [password] = args
  if (!password) {
    usageError('neuroflame user change-password <newPassword>')
  }
  const session = await requireSession()
  await gqlRequest<{ userChangePassword: boolean }>(
    session.httpUrl,
    USER_CHANGE_PASSWORD_MUTATION,
    { password },
    session.accessToken,
  )
  console.log('Password changed.')
}

async function requestPasswordReset(args: string[]): Promise<void> {
  const [username] = args
  if (!username) {
    usageError('neuroflame user request-password-reset <username>')
  }
  const { httpUrl } = await resolveServerUrls(null)
  await gqlRequest<{ requestPasswordReset: boolean }>(
    httpUrl,
    REQUEST_PASSWORD_RESET_MUTATION,
    { username },
  )
  console.log(`If ${username} exists, a password reset has been issued.`)
}

async function resetPassword(args: string[]): Promise<void> {
  const [token, newPassword] = args
  if (!token || !newPassword) {
    usageError('neuroflame user reset-password <token> <newPassword>')
  }
  const { httpUrl } = await resolveServerUrls(null)
  const data = await gqlRequest<{ resetPassword: LoginOutput }>(
    httpUrl,
    RESET_PASSWORD_MUTATION,
    { token, newPassword },
  )
  console.log(
    `Password reset for ${data.resetPassword.username}. Run \`neuroflame login\` to start a session.`,
  )
}
