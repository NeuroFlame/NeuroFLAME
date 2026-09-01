import { gqlRequest } from '../graphqlClient.js'
import { requireSession, usageError } from './shared.js'
import { closePrompt } from '../utils/prompt.js'
import { getNotesViewStyle, showNotes } from '../utils/notesStyle.js'
import {
  GET_COMPUTATION_LIST_QUERY,
  GET_COMPUTATION_DETAILS_QUERY,
  COMPUTATION_CREATE_MUTATION,
  COMPUTATION_EDIT_MUTATION,
  ComputationListItem,
  Computation,
} from '../graphql/operations.js'

export async function computationCommand(
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
    default:
      usageError('neuroflame computation <list|show|create|edit> ...')
  }
}

async function list(args: string[]): Promise<void> {
  const session = await requireSession()
  const data = await gqlRequest<{ getComputationList: ComputationListItem[] }>(
    session.httpUrl,
    GET_COMPUTATION_LIST_QUERY,
    {},
    session.accessToken,
  )
  const list = data.getComputationList

  if (args.includes('--json')) {
    console.log(JSON.stringify(list, null, 2))
    return
  }
  if (list.length === 0) {
    console.log('No computations found.')
    return
  }
  for (const c of list) {
    console.log(`${c.id}  ${c.title}  (${c.imageName})`)
  }
}

async function show(args: string[]): Promise<void> {
  const [computationId] = args
  if (!computationId) usageError('neuroflame computation show <computationId> [--json]')
  const session = await requireSession()
  const data = await gqlRequest<{ getComputationDetails: Computation }>(
    session.httpUrl,
    GET_COMPUTATION_DETAILS_QUERY,
    { computationId },
    session.accessToken,
  )
  const c = data.getComputationDetails

  if (args.includes('--json')) {
    // Scripted use — raw notes, no interactive style prompt.
    console.log(JSON.stringify(c, null, 2))
    return
  }

  console.log(
    [
      `${c.title}  (${c.imageName})`,
      `owner: ${c.owner}`,
      `has local parameters: ${c.hasLocalParameters}`,
      `download url: ${c.imageDownloadUrl}`,
      '',
    ].join('\n'),
  )
  try {
    const style = await getNotesViewStyle()
    await showNotes(c.title, c.notes, style)
  } finally {
    closePrompt()
  }
}

async function create(args: string[]): Promise<void> {
  const positional = args.filter((a) => !a.startsWith('--'))
  const [title, imageName, imageDownloadUrl, notes] = positional
  if (!title || !imageName || !imageDownloadUrl || notes === undefined) {
    usageError(
      'neuroflame computation create <title> <imageName> <imageDownloadUrl> <notes> [--has-local-parameters]',
    )
  }
  const session = await requireSession()
  await gqlRequest<{ computationCreate: boolean }>(
    session.httpUrl,
    COMPUTATION_CREATE_MUTATION,
    {
      title,
      imageName,
      imageDownloadUrl,
      notes,
      hasLocalParameters: args.includes('--has-local-parameters'),
    },
    session.accessToken,
  )
  console.log(`Computation created: ${title}`)
}

async function edit(args: string[]): Promise<void> {
  const positional = args.filter((a) => !a.startsWith('--'))
  const [computationId, title, imageName, imageDownloadUrl, notes] = positional
  if (!computationId || !title || !imageName || !imageDownloadUrl || notes === undefined) {
    usageError(
      'neuroflame computation edit <computationId> <title> <imageName> ' +
        '<imageDownloadUrl> <notes> [--has-local-parameters]',
    )
  }
  const session = await requireSession()
  await gqlRequest<{ computationEdit: boolean }>(
    session.httpUrl,
    COMPUTATION_EDIT_MUTATION,
    {
      computationId,
      title,
      imageName,
      imageDownloadUrl,
      notes,
      hasLocalParameters: args.includes('--has-local-parameters'),
    },
    session.accessToken,
  )
  console.log('Computation updated.')
}
