#!/usr/bin/env node

import { loginCommand } from './commands/login.js'
import { logoutCommand } from './commands/logout.js'
import { whoamiCommand } from './commands/whoami.js'
import { userCommand } from './commands/user.js'
import { consortiumCommand } from './commands/consortium.js'
import { computationCommand } from './commands/computation.js'
import { studyCommand } from './commands/study.js'
import { runCommand } from './commands/run.js'
import { vaultCommand } from './commands/vault.js'
import { adminCommand } from './commands/admin.js'
import { edgeCommand } from './commands/edge.js'
import { wizardCommand } from './commands/wizard.js'
import { statusCommand } from './commands/status.js'
import { configureCommand } from './commands/configure.js'

const HELP = `NeuroFLAME CLI

Usage:
  neuroflame configure
  neuroflame status [--json]
  neuroflame login [--username <name>] [--password <pass>] [--connect-edge] [--url <edgeUrl>]
  neuroflame logout
  neuroflame whoami

  neuroflame user create <username> <password>
  neuroflame user change-password <newPassword>
  neuroflame user request-password-reset <username>
  neuroflame user reset-password <token> <newPassword>

  neuroflame consortium wizard [consortiumId]
  neuroflame consortium wizard join [consortiumId]
  neuroflame consortium wizard create [title] [--description <text>] [--private]
  neuroflame consortium list [--json]
  neuroflame consortium show <consortiumId> [--json]
  neuroflame consortium create <title> [--description <text>] [--private]
  neuroflame consortium edit <consortiumId> <title> <description> [--private]
  neuroflame consortium join <consortiumId>
  neuroflame consortium join-by-invite <token>
  neuroflame consortium leave <consortiumId>
  neuroflame consortium delete <consortiumId>
  neuroflame consortium invite <consortiumId> <email>
  neuroflame consortium invite-info <token> [--json]
  neuroflame consortium set-active <consortiumId> <true|false>
  neuroflame consortium set-ready <consortiumId> <true|false>
  neuroflame consortium add-vault <consortiumId> <vaultId>
  neuroflame consortium remove-vault <consortiumId> <vaultId>
  neuroflame consortium set-vault-active <consortiumId> <vaultId> <true|false>
  neuroflame consortium set-member-inactive <consortiumId> <userId> <true|false>
  neuroflame consortium remove-member <consortiumId> <userId>
  neuroflame consortium add-vault-user <consortiumId> <userId>
  neuroflame consortium watch <consortiumId> [--json]

  neuroflame computation list [--json]
  neuroflame computation show <computationId> [--json]
  neuroflame computation create <title> <imageName> <imageDownloadUrl> <notes> [--has-local-parameters]
  neuroflame computation edit <computationId> <title> <imageName> <imageDownloadUrl> <notes> [--has-local-parameters]

  neuroflame study set-computation <consortiumId> <computationId>
  neuroflame study set-parameters <consortiumId> <parametersJson|@file>
  neuroflame study set-notes <consortiumId> <notes>

  neuroflame run start <consortiumId> [--wait] [--json]
  neuroflame run list [consortiumId] [--latest] [--json]
  neuroflame run show <runId> [--json]
  neuroflame run watch <runId> [--json]
  neuroflame run watch-consortium <consortiumId> [--latest] [--json]
  neuroflame run delete <runId>

  neuroflame vault my-config [--json]
  neuroflame vault my-server [--json]
  neuroflame vault list-users [--json]
  neuroflame vault list-servers [--json]
  neuroflame vault list-hosted [serverId] [--json]

  neuroflame edge connect [--url <edgeUrl>]
  neuroflame edge get-mount-dir <consortiumId> [--url <edgeUrl>] [--json]
  neuroflame edge set-mount-dir <consortiumId> <path> [--url <edgeUrl>]
  neuroflame edge get-local-params <consortiumId> <mountDir> [--url <edgeUrl>]
  neuroflame edge set-local-params <consortiumId> <mountDir> <paramsJson|@file> [--url <edgeUrl>]
  neuroflame edge list-results <consortiumId> <runId> [participantId] [--url <edgeUrl>] [--json]
  neuroflame edge download-results <consortiumId> <runId> [participantId] [--out <file>] [--url <edgeUrl>]
  neuroflame edge open-results <consortiumId> <runId> [participantId] [--url <edgeUrl>]

  neuroflame admin create-vault-user <username> <password>
  neuroflame admin set-roles <username> <role...>
  neuroflame admin set-password <username> <password>
  neuroflame admin set-vault-computations <userId> <computationId...>
  neuroflame admin set-vault-datasets <userId> <computationId:datasetKey...>
  neuroflame admin create-hosted-vault <serverId> <name> <description> <datasetKey>
  neuroflame admin update-hosted-vault <vaultId> <name> <description>
  neuroflame admin set-hosted-vault-computations <vaultId> <computationId...>

Environment:
  NEUROFLAME_HTTP_URL   Central API GraphQL HTTP endpoint (default http://localhost:3001/graphql)
  NEUROFLAME_WS_URL     Central API GraphQL WS endpoint (default ws://localhost:3001/graphql)
  NEUROFLAME_EDGE_URL           Local edge client GraphQL endpoint, for \`edge\` commands
                                (default http://localhost:4001/graphql — check your
                                edge client's configured hostingPort)
  NEUROFLAME_EDGE_WS_URL        Edge client subscription endpoint (default: derived
                                from NEUROFLAME_EDGE_URL)
  NEUROFLAME_EDGE_RESULTS_URL   Edge client run-results endpoint (default: derived
                                from NEUROFLAME_EDGE_URL)
  NEUROFLAME_USERNAME   Username for non-interactive login
  NEUROFLAME_PASSWORD   Password for non-interactive login
  NEUROFLAME_DEBUG      Set to "true" for verbose diagnostics on stderr

Session (access token + server) is stored at ~/.config/neuroflame-cli/session.json.
Persisted config (from \`neuroflame configure\`) is stored at
~/.config/neuroflame-cli/config.json — env vars always take precedence over it.

Not included: vaultHeartbeat, reportRun*, and the runStartCentral/runStartEdge
subscriptions — those are used internally by edgeFederatedClient/
vaultFederatedClient, not by a human operator.
`

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const command = argv[0]
  const sub = argv[1]
  const rest = argv.slice(2)

  switch (command) {
    case 'configure':
      return configureCommand()
    case 'status':
      return statusCommand(argv.slice(1))
    case 'login':
      return loginCommand(argv.slice(1))
    case 'logout':
      return logoutCommand()
    case 'whoami':
      return whoamiCommand()
    case 'user':
      return userCommand(sub, rest)
    case 'consortium':
      // Handled directly here rather than inside consortiumCommand's
      // switch: wizard.ts imports from consortium.ts (fetchDetails,
      // printDetails), so routing it back through consortium.ts would be
      // a circular import.
      if (sub === 'wizard') return wizardCommand(rest)
      return consortiumCommand(sub, rest)
    case 'computation':
      return computationCommand(sub, rest)
    case 'study':
      return studyCommand(sub, rest)
    case 'run':
      return runCommand(sub, rest)
    case 'vault':
      return vaultCommand(sub, rest)
    case 'edge':
      return edgeCommand(sub, rest)
    case 'admin':
      return adminCommand(sub, rest)

    case '--help':
    case '-h':
    case 'help':
    case undefined:
      console.log(HELP)
      return

    default:
      throw new Error(
        `Unknown command: ${command}\n\n${HELP}`,
      )
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message.startsWith('Usage:') ? message : `Error: ${message}`)
  process.exitCode = 1
})
