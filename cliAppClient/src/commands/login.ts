import { gqlRequest } from '../graphqlClient.js'
import { saveSession } from '../session.js'
import { resolveServerUrls, resolveEdgeUrl } from '../config.js'
import { parseFlags } from '../utils/flags.js'
import { ask, closePrompt } from '../utils/prompt.js'
import { LOGIN_MUTATION, LoginOutput } from '../graphql/operations.js'
import { connectEdgeClient, warnAboutMissingMountDirs } from './edge.js'
import { ENV_FILE_PATH } from '../envFile.js'

interface LoginData {
  login: LoginOutput
}

const CTRL_C = '' // Ctrl+C
const CTRL_D = '' // Ctrl+D
const BACKSPACE = ''

// Reads a line without echoing it, for password entry. Falls back to a
// plain (visible) prompt when stdin isn't a TTY — e.g. piped input in a
// script, where masking has no meaning anyway.
function askHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    return ask(question)
  }

  return new Promise((resolve) => {
    const stdin = process.stdin
    process.stdout.write(question)
    let value = ''

    const onData = (chunk: Buffer): void => {
      const char = chunk.toString('utf8')

      if (char === '\n' || char === '\r' || char === CTRL_D) {
        stdin.setRawMode(false)
        stdin.pause()
        stdin.removeListener('data', onData)
        process.stdout.write('\n')
        resolve(value)
        return
      }

      if (char === CTRL_C) {
        process.stdout.write('\n')
        process.exit(130)
      }

      if (char === BACKSPACE) {
        value = value.slice(0, -1)
        return
      }

      value += char
    }

    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    stdin.on('data', onData)
  })
}

export async function loginCommand(args: string[]): Promise<void> {
  const flags = parseFlags(args)
  const { httpUrl, wsUrl } = await resolveServerUrls(null)

  const usernameProvided = flags.username || process.env.NEUROFLAME_USERNAME
  const passwordProvided = flags.password || process.env.NEUROFLAME_PASSWORD

  // Fail fast rather than hang: with no terminal to prompt on (a SLURM
  // batch job, systemd, CI) and credentials not fully provided some other
  // way, `ask()`'s underlying readline.question() can sit waiting on a
  // stdin that will never produce a line — silently burning the job's
  // whole time allocation instead of erroring immediately.
  if ((!usernameProvided || !passwordProvided) && !process.stdin.isTTY) {
    throw new Error(
      'Not running in a terminal, and credentials were not fully provided. ' +
        'Set NEUROFLAME_USERNAME/NEUROFLAME_PASSWORD — as real env vars, ' +
        `--username/--password flags, or in ${ENV_FILE_PATH} — before ` +
        'running `login` non-interactively (e.g. from a SLURM batch job).',
    )
  }

  const username = usernameProvided || (await ask('Username: '))
  // Release the shared readline interface (a no-op if `ask` was never
  // called) before askHidden takes raw stdin mode for password entry — the
  // two must not both be attached to stdin at once.
  closePrompt()
  const password = passwordProvided || (await askHidden('Password: '))

  const data = await gqlRequest<LoginData>(httpUrl, LOGIN_MUTATION, {
    username,
    password,
  })

  await saveSession({ httpUrl, wsUrl, ...data.login })
  console.log(
    `Logged in as ${data.login.username} (roles: ${
      data.login.roles.join(', ') || 'none'
    })`,
  )
  console.log(`Server: ${httpUrl}`)

  // Opt-in only: most CLI usage is pure central-API work (admin, consortium
  // management, run start/watch) with no edge client anywhere nearby, so
  // attempting this on every login would throw an unhelpful connection
  // error at everyone who isn't doing edge-client work. Only do it when
  // asked, and don't fail the login if it doesn't work — login already
  // succeeded regardless.
  if (flags['connect-edge'] === 'true') {
    const edgeUrl = await resolveEdgeUrl(flags.url)
    try {
      await connectEdgeClient(edgeUrl, data.login.accessToken)
      console.log(`Connected to edge client at ${edgeUrl}.`)
      await warnAboutMissingMountDirs(httpUrl, edgeUrl, data.login.accessToken, data.login.userId)
    } catch (error) {
      console.error(
        `Warning: logged in, but could not connect to edge client at ${edgeUrl}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
