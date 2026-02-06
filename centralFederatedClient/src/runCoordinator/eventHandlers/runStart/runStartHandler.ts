import reportRunError from '../../report/reportRunError.js'
import reportRunReady from '../../report/reportRunReady.js'
import startRun, { type MemberRole, type UserRolesMap } from './startRun.js'
import { logger } from '../../../logger.js'

type RunMemberRole = { userId: string; role: MemberRole }

function listToRolesMap(userRoles: RunMemberRole[] | undefined | null): UserRolesMap {
  const map: UserRolesMap = {}
  for (const ur of userRoles ?? []) {
    if (!ur?.userId) continue
    map[String(ur.userId)] = ur.role
  }
  return map
}

export const RUN_START_SUBSCRIPTION = `
  subscription runStartSubscription {
    runStartCentral {
      consortiumId
      runId
      userIds
      userRoles { userId role }
      computationParameters
      imageName
    }
  }
`

export const runStartHandler = {
  error: (err: any) => {
    logger.error('Run Start Central - Subscription error', { error: err })
  },
  complete: () => logger.info('Run Start Central - Subscription completed'),
  next: async ({ data }: { data: any }) => {
    const {
      consortiumId,
      runId,
      userIds,
      userRoles,
      computationParameters,
      imageName,
    } = data.runStartCentral

    const rolesMap = listToRolesMap(userRoles as RunMemberRole[])

    // Guardrail: if roles are provided, require at least one contributor
    const contributorCount = Object.values(rolesMap).filter(
      (r) => r === 'contributor',
    ).length
    if (Object.keys(rolesMap).length > 0 && contributorCount === 0) {
      const msg = 'No ready contributors for this run.'
      logger.error(msg, { runId, consortiumId, userIds, userRoles })
      return await reportRunError({ runId, errorMessage: msg })
    }

    try {
      await startRun({
        imageName,
        userIds,
        userRoles: rolesMap,
        consortiumId,
        runId,
        computationParameters,
      })

      // wait a 1 second to report run ready
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // report to the central api that the run is ready
      return await reportRunReady({ runId })
    } catch (error) {
      logger.error('Error in Run Start Central:', { error })

      return await reportRunError({
        runId,
        errorMessage: (error as Error).message,
      })
    }
  },
}
