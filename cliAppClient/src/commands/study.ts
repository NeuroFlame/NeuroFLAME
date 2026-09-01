import { promises as fs } from 'fs'
import { gqlRequest } from '../graphqlClient.js'
import { requireSession, usageError } from './shared.js'
import {
  STUDY_SET_COMPUTATION_MUTATION,
  STUDY_SET_PARAMETERS_MUTATION,
  STUDY_SET_NOTES_MUTATION,
} from '../graphql/operations.js'

export async function studyCommand(
  subcommand: string | undefined,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case 'set-computation':
      return setComputation(args)
    case 'set-parameters':
      return setParameters(args)
    case 'set-notes':
      return setNotes(args)
    default:
      usageError('neuroflame study <set-computation|set-parameters|set-notes> ...')
  }
}

async function setComputation(args: string[]): Promise<void> {
  const [consortiumId, computationId] = args
  if (!consortiumId || !computationId) {
    usageError('neuroflame study set-computation <consortiumId> <computationId>')
  }
  const session = await requireSession()
  await gqlRequest<{ studySetComputation: boolean }>(
    session.httpUrl,
    STUDY_SET_COMPUTATION_MUTATION,
    { consortiumId, computationId },
    session.accessToken,
  )
  console.log('Study computation set.')
}

async function setParameters(args: string[]): Promise<void> {
  const [consortiumId, parametersArg] = args
  if (!consortiumId || !parametersArg) {
    usageError(
      'neuroflame study set-parameters <consortiumId> <parametersJson|@file>',
    )
  }

  const parameters = parametersArg.startsWith('@')
    ? await fs.readFile(parametersArg.slice(1), 'utf8')
    : parametersArg

  // Validate it's parseable JSON before sending — the server stores it as an
  // opaque string, so a typo here would otherwise only surface much later.
  try {
    JSON.parse(parameters)
  } catch {
    throw new Error('Parameters must be valid JSON.')
  }

  const session = await requireSession()
  await gqlRequest<{ studySetParameters: boolean }>(
    session.httpUrl,
    STUDY_SET_PARAMETERS_MUTATION,
    { consortiumId, parameters },
    session.accessToken,
  )
  console.log('Study parameters set.')
}

async function setNotes(args: string[]): Promise<void> {
  const [consortiumId, ...notesParts] = args
  const notes = notesParts.join(' ')
  if (!consortiumId || notesParts.length === 0) {
    usageError('neuroflame study set-notes <consortiumId> <notes>')
  }
  const session = await requireSession()
  await gqlRequest<{ studySetNotes: boolean }>(
    session.httpUrl,
    STUDY_SET_NOTES_MUTATION,
    { consortiumId, notes },
    session.accessToken,
  )
  console.log('Study notes set.')
}
