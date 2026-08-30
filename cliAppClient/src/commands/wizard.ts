// Interactive terminal equivalent of the desktop app's ConsortiumWizard
// (desktopApp/reactApp/src/pages/ConsortiumWizard). The step sequence and
// role split (leader vs member) are copied directly from that component so
// the two stay in the same order; see it if this ever needs re-syncing.
//
// Unlike the GUI, this doesn't support going back a step — rerunning the
// wizard is safe and idempotent instead (every step just reflects current
// server/edge-client state), which is simpler for a terminal flow than
// building real back-navigation.

import { promises as fs } from 'fs'
import { spawn } from 'child_process'
import { gqlRequest } from '../graphqlClient.js'
import { resolveEdgeUrl } from '../config.js'
import { requireSession, Session } from './shared.js'
import { positionals, parseFlags } from '../utils/flags.js'
import { ask, askYesNo, askIndex, closePrompt, pausePrompt, resumePrompt } from '../utils/prompt.js'
import { viewMarkdownInBrowser } from '../utils/viewMarkdown.js'
import { fetchDetails, printDetails } from './consortium.js'
import { connectEdgeClient } from './edge.js'
import {
  GET_CONSORTIUM_LIST_QUERY,
  GET_COMPUTATION_LIST_QUERY,
  GET_COMPUTATION_DETAILS_QUERY,
  GET_VAULT_USER_LIST_QUERY,
  CONSORTIUM_CREATE_MUTATION,
  CONSORTIUM_JOIN_MUTATION,
  CONSORTIUM_JOIN_BY_INVITE_MUTATION,
  CONSORTIUM_SET_MEMBER_READY_MUTATION,
  LEADER_ADD_VAULT_USER_MUTATION,
  STUDY_SET_COMPUTATION_MUTATION,
  STUDY_SET_PARAMETERS_MUTATION,
  STUDY_SET_NOTES_MUTATION,
  EDGE_GET_MOUNT_DIR_QUERY,
  EDGE_SET_MOUNT_DIR_MUTATION,
  EDGE_SET_LOCAL_PARAMS_MUTATION,
  ConsortiumListItem,
  ConsortiumDetails,
  ComputationListItem,
  Computation,
  PublicUser,
} from '../graphql/operations.js'

/** Thrown to unwind out of the wizard on request — not an error. */
class WizardQuit extends Error {}

export async function wizardCommand(args: string[]): Promise<void> {
  try {
    await runWizard(args)
  } catch (error) {
    if (error instanceof WizardQuit) {
      console.log(
        '\nStopped. Anything already set is saved on the server — run ' +
          '`neuroflame consortium wizard` again anytime to pick up where you left off.',
      )
      return
    }
    throw error
  } finally {
    // Otherwise the open stdin listener keeps the process alive after the
    // wizard should have exited.
    closePrompt()
  }
}

async function runWizard(args: string[]): Promise<void> {
  const session = await requireSession()
  const positional = positionals(args)
  const mode = positional[0]

  // 'join' and 'create' are just two extra ways to arrive at a
  // consortiumId — everything past this point (membership check, role
  // detection, step selection) is unchanged and identical for all three
  // forms. 'join' with no id still falls through to pickConsortium, same
  // as plain `wizard` with no args; it exists mainly so intent is explicit
  // and discoverable ("I want to join something") rather than a functional
  // difference.
  let consortiumId: string
  if (mode === 'create') {
    consortiumId = await createConsortium(session, args)
  } else if (mode === 'join') {
    consortiumId = positional[1] ?? (await pickConsortium(session))
  } else {
    consortiumId = mode ?? (await pickConsortium(session))
  }

  let details = await fetchDetails(session.httpUrl, session.accessToken, consortiumId)
  console.log(`\n${details.title}${details.isPrivate ? '  [private]' : ''}`)
  if (details.description) console.log(details.description)

  const isMember = details.members.some((m) => m.id === session.userId)
  if (!isMember) {
    await ensureMembership(session, consortiumId, details)
    details = await fetchDetails(session.httpUrl, session.accessToken, consortiumId)
  }

  const isLeader = details.leader.id === session.userId
  console.log(`Role: ${isLeader ? 'Leader' : 'Member'}\n`)

  if (isLeader) {
    await runLeaderSteps(session, consortiumId, details)
  } else {
    await runMemberSteps(session, consortiumId, details)
  }

  console.log('\n--- Current status ---')
  printDetails(await fetchDetails(session.httpUrl, session.accessToken, consortiumId))
  console.log(`\nWatch this consortium's runs live:\n  neuroflame run watch-consortium ${consortiumId} --latest`)
  if (isLeader) {
    console.log(`Start a run when everyone's ready:\n  neuroflame run start ${consortiumId} --wait`)
  }
}

async function pickConsortium(session: Session): Promise<string> {
  const data = await gqlRequest<{ getConsortiumList: ConsortiumListItem[] }>(
    session.httpUrl,
    GET_CONSORTIUM_LIST_QUERY,
    {},
    session.accessToken,
  )
  const list = data.getConsortiumList
  if (list.length === 0) {
    throw new Error(
      'No consortia found. Ask a leader for an invite, or create one with ' +
        '`neuroflame consortium wizard create <title>`.',
    )
  }
  console.log('\nConsortia:')
  list.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.title}${c.isPrivate ? '  [private]' : ''}  — leader: ${c.leader.username}`)
  })
  const idx = await askIndex('\nPick a consortium (number): ', list.length)
  if (idx === null) throw new WizardQuit()
  return list[idx].id
}

async function createConsortium(session: Session, args: string[]): Promise<string> {
  const flags = parseFlags(args)
  // positional[0] is the literal 'create' keyword; the title is whatever
  // follows it (joined, so an unquoted multi-word title still works — same
  // tolerance as edge set-mount-dir's path handling).
  const afterCreate = positionals(args).slice(1)
  const title = afterCreate.join(' ') || (await ask('Consortium title: '))
  if (!title) throw new WizardQuit()

  const description = flags.description ?? (await ask('Description (optional): '))
  const isPrivate = 'private' in flags || (await askYesNo('Make it private?', false))

  const data = await gqlRequest<{ consortiumCreate: string }>(
    session.httpUrl,
    CONSORTIUM_CREATE_MUTATION,
    // Not null — see the comment on the equivalent call in consortium.ts's
    // create(): a stored null description breaks every future
    // `consortium list`/`show` for everyone, not just this record.
    { title, description, isPrivate },
    session.accessToken,
  )
  console.log(`\nCreated consortium: ${title}`)
  return data.consortiumCreate
}

async function ensureMembership(
  session: Session,
  consortiumId: string,
  details: ConsortiumDetails,
): Promise<void> {
  console.log(`You are not currently a member of "${details.title}".`)
  if (!(await askYesNo('Join now?', true))) throw new WizardQuit()

  try {
    await gqlRequest<{ consortiumJoin: boolean }>(
      session.httpUrl,
      CONSORTIUM_JOIN_MUTATION,
      { consortiumId },
      session.accessToken,
    )
    console.log('Joined.')
  } catch (error) {
    console.log(
      `Could not join directly (${error instanceof Error ? error.message : error}).`,
    )
    const token = await ask('If you have an invite token, enter it now (or press Enter to cancel): ')
    if (!token) throw new WizardQuit()
    await gqlRequest<{ consortiumJoinByInvite: boolean }>(
      session.httpUrl,
      CONSORTIUM_JOIN_BY_INVITE_MUTATION,
      { inviteToken: token },
      session.accessToken,
    )
    console.log('Joined via invite.')
  }
}

function runShellCommand(command: string): Promise<number> {
  // The child needs raw stdin/stdout (docker pull's progress bars, in
  // particular) — release the prompt's hold on stdin first, or the two
  // compete for it, then reclaim it once the child exits.
  pausePrompt()
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, stdio: 'inherit' })
    child.on('exit', (code) => {
      resumePrompt()
      resolve(code ?? 1)
    })
    child.on('error', (error) => {
      resumePrompt()
      reject(error)
    })
  })
}

async function downloadImage(imageDownloadUrl: string): Promise<void> {
  if (!(await askYesNo(`Download the image now? (runs: ${imageDownloadUrl})`, true))) {
    console.log('Skipped — you can run that command yourself later.')
    return
  }
  const code = await runShellCommand(imageDownloadUrl)
  console.log(code === 0 ? 'Image downloaded.' : `Download command exited with code ${code}.`)
}

// ---------------------------------------------------------------------------
// Steps shared by both roles
// ---------------------------------------------------------------------------

async function selectDataDirectoryStep(session: Session, consortiumId: string): Promise<void> {
  const edgeUrl = await resolveEdgeUrl(undefined)
  console.log(`(using edge client at ${edgeUrl} — override with NEUROFLAME_EDGE_URL)`)

  let current: string | null = null
  try {
    const data = await gqlRequest<{ getMountDir: string | null }>(
      edgeUrl,
      EDGE_GET_MOUNT_DIR_QUERY,
      { consortiumId },
      session.accessToken,
    )
    current = data.getMountDir
  } catch {
    // Not set yet, or edge client unreachable — treated the same as unset;
    // the set-mount-dir attempt below will surface a real connection error.
  }
  console.log(current ? `Currently set to: ${current}` : 'Not set yet.')

  const path = await ask(`Data directory path${current ? ' (Enter to keep current)' : ''}: `)
  if (path) {
    await gqlRequest<{ setMountDir: boolean }>(
      edgeUrl,
      EDGE_SET_MOUNT_DIR_MUTATION,
      { consortiumId, mountDir: path },
      session.accessToken,
    )
    console.log('Data directory set.')
  } else if (!current) {
    console.log('No directory set — set one later with `neuroflame edge set-mount-dir`.')
  }

  // Easy to forget, and a silent no-op if skipped (see edge.ts) — a mount
  // directory and Ready alone are not enough for this client to pick up
  // runs, so make it part of the same step rather than a separate one the
  // GUI doesn't have an equivalent of anyway.
  try {
    await connectEdgeClient(edgeUrl, session.accessToken)
    console.log('Connected to edge client — it will now pick up runs for this consortium.')
  } catch (error) {
    console.log(
      `Warning: could not connect to edge client (${error instanceof Error ? error.message : error}). ` +
        'Runs won\'t be picked up until you run `neuroflame edge connect`.',
    )
  }
}

async function setLocalParamsStep(session: Session, consortiumId: string): Promise<void> {
  const edgeUrl = await resolveEdgeUrl(undefined)
  const data = await gqlRequest<{ getMountDir: string | null }>(
    edgeUrl,
    EDGE_GET_MOUNT_DIR_QUERY,
    { consortiumId },
    session.accessToken,
  ).catch(() => ({ getMountDir: null }))

  if (!data.getMountDir) {
    console.log('No data directory set yet — skipping local parameters.')
    return
  }

  const answer = await ask('Local parameters as JSON (or @file, or Enter to skip): ')
  if (!answer) {
    console.log('Skipped.')
    return
  }
  const localParams = answer.startsWith('@') ? await fs.readFile(answer.slice(1), 'utf8') : answer
  try {
    JSON.parse(localParams)
  } catch {
    console.log('Invalid JSON — skipped.')
    return
  }
  await gqlRequest<{ setLocalParams: boolean }>(
    edgeUrl,
    EDGE_SET_LOCAL_PARAMS_MUTATION,
    { consortiumId, mountDir: data.getMountDir, localParams },
    session.accessToken,
  )
  console.log('Local parameters saved.')
}

async function setReadyStep(session: Session, consortiumId: string): Promise<void> {
  const details = await fetchDetails(session.httpUrl, session.accessToken, consortiumId)
  console.log(`Members ready: ${details.readyMembers.length}/${details.members.length}`)
  const ready = await askYesNo('Mark yourself as ready?', true)
  await gqlRequest<{ consortiumSetMemberReady: boolean }>(
    session.httpUrl,
    CONSORTIUM_SET_MEMBER_READY_MUTATION,
    { consortiumId, ready },
    session.accessToken,
  )
  console.log(`Ready set to ${ready}.`)
}

// ---------------------------------------------------------------------------
// Leader steps — see ConsortiumWizard.tsx's leaderSteps
// ---------------------------------------------------------------------------

async function runLeaderSteps(
  session: Session,
  consortiumId: string,
  details: ConsortiumDetails,
): Promise<void> {
  let n = 0
  const step = (label: string): void => console.log(`\n--- Step ${++n}: ${label} ---`)

  step('Select Computation & Download Image')
  const computation = await selectComputationStep(session, consortiumId, details)

  step('Add Vault User (optional)')
  if (await askYesNo('Add a vault user to this consortium?', false)) {
    await addVaultUserStep(session, consortiumId)
  } else {
    console.log('Skipped.')
  }

  step('Set Parameters')
  await setParametersStep(session, consortiumId)

  step('Select Data Directory')
  await selectDataDirectoryStep(session, consortiumId)

  if (computation?.hasLocalParameters) {
    step('Set Local Parameters')
    await setLocalParamsStep(session, consortiumId)
  }

  step('Add Leader Notes (optional)')
  if (await askYesNo('Add leader notes?', false)) {
    const notes = await ask('Notes: ')
    if (notes) {
      await gqlRequest<{ studySetNotes: boolean }>(
        session.httpUrl,
        STUDY_SET_NOTES_MUTATION,
        { consortiumId, notes },
        session.accessToken,
      )
      console.log('Notes saved.')
    }
  } else {
    console.log('Skipped.')
  }

  step('Set Ready Status')
  await setReadyStep(session, consortiumId)
}

async function selectComputationStep(
  session: Session,
  consortiumId: string,
  details: ConsortiumDetails,
): Promise<Computation | null> {
  const data = await gqlRequest<{ getComputationList: ComputationListItem[] }>(
    session.httpUrl,
    GET_COMPUTATION_LIST_QUERY,
    {},
    session.accessToken,
  )
  const list = data.getComputationList
  if (list.length === 0) {
    console.log('No computations available — ask an admin to create one first. Skipping.')
    return details.studyConfiguration.computation
  }

  const current = details.studyConfiguration.computation
  console.log(current ? `Currently selected: ${current.title}` : 'No computation currently selected.')
  list.forEach((c, i) => console.log(`  ${i + 1}. ${c.title}  (${c.imageName})`))

  const idx = await askIndex(
    `Pick a computation (number${current ? ', or Enter to keep current' : ''}): `,
    list.length,
  )

  let computationId: string
  if (idx === null) {
    if (!current) throw new WizardQuit()
    const match = list.find((c) => c.title === current.title)
    if (!match) {
      console.log('Could not resolve the current computation to an id — please pick one.')
      return selectComputationStep(session, consortiumId, details)
    }
    computationId = match.id
  } else {
    computationId = list[idx].id
    await gqlRequest<{ studySetComputation: boolean }>(
      session.httpUrl,
      STUDY_SET_COMPUTATION_MUTATION,
      { consortiumId, computationId },
      session.accessToken,
    )
    console.log(`Computation set: ${list[idx].title}`)
  }

  const computationData = await gqlRequest<{ getComputationDetails: Computation }>(
    session.httpUrl,
    GET_COMPUTATION_DETAILS_QUERY,
    { computationId },
    session.accessToken,
  )
  const computation = computationData.getComputationDetails
  await downloadImage(computation.imageDownloadUrl)
  return computation
}

async function addVaultUserStep(session: Session, consortiumId: string): Promise<void> {
  const data = await gqlRequest<{ getVaultUserList: PublicUser[] }>(
    session.httpUrl,
    GET_VAULT_USER_LIST_QUERY,
    {},
    session.accessToken,
  )
  const list = data.getVaultUserList
  if (list.length === 0) {
    console.log('No vault users available.')
    return
  }
  list.forEach((u, i) => console.log(`  ${i + 1}. ${u.username}`))
  const idx = await askIndex('Pick a vault user (number, or Enter to skip): ', list.length)
  if (idx === null) {
    console.log('Skipped.')
    return
  }
  await gqlRequest<{ leaderAddVaultUser: boolean }>(
    session.httpUrl,
    LEADER_ADD_VAULT_USER_MUTATION,
    { consortiumId, userId: list[idx].id },
    session.accessToken,
  )
  console.log(`Added vault user: ${list[idx].username}`)
}

async function setParametersStep(session: Session, consortiumId: string): Promise<void> {
  const answer = await ask('Computation parameters as JSON (or @file, or Enter to skip): ')
  if (!answer) {
    console.log('Skipped.')
    return
  }
  const parameters = answer.startsWith('@') ? await fs.readFile(answer.slice(1), 'utf8') : answer
  try {
    JSON.parse(parameters)
  } catch {
    console.log('Invalid JSON — skipped.')
    return
  }
  await gqlRequest<{ studySetParameters: boolean }>(
    session.httpUrl,
    STUDY_SET_PARAMETERS_MUTATION,
    { consortiumId, parameters },
    session.accessToken,
  )
  console.log('Parameters saved.')
}

// ---------------------------------------------------------------------------
// Member steps — see ConsortiumWizard.tsx's memberSteps
// ---------------------------------------------------------------------------

/**
 * Notes are plain markdown — fine to read as raw text in a terminal for
 * something short, much easier to follow rendered once it starts using
 * headers/tables/links/code blocks. Prints as before regardless (so a
 * scripted/non-interactive run sees no behavior change and this prompt's
 * `false` default just declines), and offers rendering only when there's
 * something to render.
 */
async function offerToViewNotesInBrowser(
  computation: Computation | null | undefined,
  leaderNotes: string | null | undefined,
): Promise<void> {
  if (!computation?.notes && !leaderNotes) return
  if (!(await askYesNo('\nOpen these notes as rendered HTML in your browser instead?', false))) {
    return
  }
  const sections = [
    computation?.notes && `# ${computation.title}\n\n${computation.notes}`,
    leaderNotes && `# Leader notes\n\n${leaderNotes}`,
  ].filter((section): section is string => Boolean(section))
  try {
    await viewMarkdownInBrowser('Consortium Requirements', sections.join('\n\n---\n\n'))
  } catch (error) {
    console.log(
      `Could not open a browser automatically (${error instanceof Error ? error.message : error}).`,
    )
  }
}

async function runMemberSteps(
  session: Session,
  consortiumId: string,
  details: ConsortiumDetails,
): Promise<void> {
  let n = 0
  const step = (label: string): void => console.log(`\n--- Step ${++n}: ${label} ---`)
  const computation = details.studyConfiguration.computation

  step('View Consortium Requirements')
  if (computation) {
    console.log(`\nComputation: ${computation.title}\n${computation.notes}`)
  } else {
    console.log('The leader has not selected a computation yet.')
  }
  if (details.studyConfiguration.consortiumLeaderNotes) {
    console.log(`\nLeader notes:\n${details.studyConfiguration.consortiumLeaderNotes}`)
  }
  await offerToViewNotesInBrowser(computation, details.studyConfiguration.consortiumLeaderNotes)
  if (!(await askYesNo("\nI've read and understand the notes. Continue?", true))) {
    throw new WizardQuit()
  }

  step('Select Data Directory')
  await selectDataDirectoryStep(session, consortiumId)

  if (computation?.hasLocalParameters) {
    step('Set Local Parameters')
    await setLocalParamsStep(session, consortiumId)
  }

  step('Download Computation Image')
  if (computation) {
    await downloadImage(computation.imageDownloadUrl)
  } else {
    console.log('No computation selected yet — ask the leader to select one first.')
  }

  step('Set Ready Status')
  await setReadyStep(session, consortiumId)
}
