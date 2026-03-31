import {
  generateTokens,
  compare,
  hashPassword,
} from '../authentication/authentication.js'
import { CLIENT_FILE_SERVER_URL, CONSORTIUM_INVITE_URL, RESEND_API_KEY } from '../config.js'
import Consortium from '../database/models/Consortium.js'
import Run, { IRun } from '../database/models/Run.js'
import User from '../database/models/User.js'
import Computation from '../database/models/Computation.js'
import Invite from '../database/models/Invite.js'
import pubsub from './pubSubService.js'
import { withFilter } from 'graphql-subscriptions'
import {
  ConsortiumListItem,
  ComputationListItem,
  StartRunInput,
  StartRunOutput,
  RunStartCentralPayload,
  RunStartEdgePayload,
  PublicUser,
  ConsortiumDetails,
  InviteInfo,
  LoginOutput,
  RunEventPayload,
  RunListItem,
  RunDetails,
  UserProfile,
} from './generated/graphql.js'
import { Resend } from 'resend'
import { logger } from '../logger.js'
import { randomBytes } from 'crypto'

interface Context {
  userId: string
  roles: string[]
  error: string
}

const resend = new Resend(RESEND_API_KEY)
const INVITE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const mapAllowedComputations = (
  computations: any[] | undefined,
): ComputationListItem[] => (
  Array.isArray(computations)
    ? computations
      .filter(
        (computation) =>
          computation &&
          typeof computation === 'object' &&
          'title' in computation &&
          'imageName' in computation,
      )
      .map((computation: any) => ({
        id: computation._id.toString(),
        title: computation.title,
        imageName: computation.imageName,
      }))
    : []
)

const ensureValidComputationParameters = (
  rawParameters: string | null | undefined,
): string => {
  const normalizedParameters =
    typeof rawParameters === 'string' ? rawParameters.trim() : ''

  if (normalizedParameters.length === 0) {
    throw new Error(
      'Computation parameters are required before starting a run.',
    )
  }

  let parsedParameters: unknown
  try {
    parsedParameters = JSON.parse(normalizedParameters)
  } catch (error) {
    throw new Error(
      `Computation parameters must be valid JSON before starting a run: ${(error as Error).message}`,
    )
  }

  if (
    parsedParameters === null ||
    Array.isArray(parsedParameters) ||
    typeof parsedParameters !== 'object'
  ) {
    throw new Error(
      'Computation parameters must be a JSON object before starting a run.',
    )
  }

  return normalizedParameters
}

const mapDatasetMappings = (
  datasetMappings: Array<{ computationId: unknown; datasetKey?: string | null }> | undefined,
): Array<{ computationId: string; datasetKey: string }> => (
  Array.isArray(datasetMappings)
    ? datasetMappings
      .filter(
        (mapping) =>
          mapping &&
          typeof mapping === 'object' &&
          mapping.computationId &&
          typeof mapping.datasetKey === 'string' &&
          mapping.datasetKey.trim().length > 0,
      )
      .map((mapping) => ({
        computationId: mapping.computationId.toString(),
        datasetKey: mapping.datasetKey!.trim(),
      }))
    : []
)

const mapAvailableDatasets = (
  datasets:
    | Array<{
        key?: string | null
        path?: string | null
        label?: string | null
        lastSeenAt?: Date | string | null
      }>
    | undefined,
): Array<{
  key: string
  path: string
  label: string | null
  lastSeenAt: string
}> => (
  Array.isArray(datasets)
    ? datasets
      .filter(
        (dataset) =>
          dataset &&
          typeof dataset === 'object' &&
          typeof dataset.key === 'string' &&
          dataset.key.trim().length > 0 &&
          typeof dataset.path === 'string' &&
          dataset.path.trim().length > 0 &&
          dataset.lastSeenAt,
      )
      .map((dataset) => ({
        key: dataset.key!.trim(),
        path: dataset.path!.trim(),
        label:
          typeof dataset.label === 'string' && dataset.label.trim().length > 0
            ? dataset.label.trim()
            : null,
        lastSeenAt: new Date(dataset.lastSeenAt as Date | string).toISOString(),
      }))
    : []
)

const mapVault = (
  vault:
    | {
        name?: string | null
        description?: string | null
        allowedComputations?: any[]
        datasetMappings?: Array<{ computationId: unknown; datasetKey?: string | null }>
      }
    | null
    | undefined,
) => (
  vault &&
  typeof vault.name === 'string' &&
  typeof vault.description === 'string'
    ? {
        name: vault.name,
        description: vault.description,
        allowedComputations: mapAllowedComputations(vault.allowedComputations),
        datasetMappings: mapDatasetMappings(vault.datasetMappings),
      }
    : null
)

const mapVaultStatus = (
  vaultStatus:
    | {
        status: string
        version: string
        uptime: number
        websocketConnected: boolean
        lastHeartbeat: Date
        runningComputations: Array<{
          runId: string
          consortiumId: string
          startedAt: Date
        }>
        availableDatasets?: Array<{
          key?: string | null
          path?: string | null
          label?: string | null
          lastSeenAt?: Date | string | null
        }>
      }
    | null
    | undefined,
  consortiumMap?: Map<string, string>,
) => (
  vaultStatus
    ? {
        status: vaultStatus.status,
        version: vaultStatus.version,
        uptime: vaultStatus.uptime,
        websocketConnected: vaultStatus.websocketConnected,
        lastHeartbeat: vaultStatus.lastHeartbeat.toISOString(),
        runningComputations: vaultStatus.runningComputations.map((comp) => ({
          runId: comp.runId,
          consortiumId: comp.consortiumId,
          consortiumTitle: consortiumMap?.get(comp.consortiumId) || null,
          runStartedAt: comp.startedAt.toISOString(),
          runningFor: Math.floor(
            (Date.now() - comp.startedAt.getTime()) / 1000,
          ),
        })),
        availableDatasets: mapAvailableDatasets(vaultStatus.availableDatasets),
      }
    : null
)

const allowsComputation = (
  user: { vault?: { allowedComputations?: Array<{ _id: unknown }> } },
  computationId: string,
): boolean =>
  Array.isArray(user.vault?.allowedComputations) &&
  user.vault.allowedComputations.some(
    (computation) => computation._id.toString() === computationId,
  )

const getInviteUrl = (token: string): string => {
  const baseUrl = CONSORTIUM_INVITE_URL.endsWith('/')
    ? CONSORTIUM_INVITE_URL
    : `${CONSORTIUM_INVITE_URL}/`

  return new URL(`invite/${token}`, baseUrl).toString()
}

const sendInviteEmail = async ({
  email,
  leaderName,
  consortiumTitle,
  token,
}: {
  email: string
  leaderName: string
  consortiumTitle: string
  token: string
}): Promise<void> => {
  const html = `${leaderName} invites you to join ${consortiumTitle} on NeuroFLAME. <br/>
      Please click this <a href="${getInviteUrl(token)}">link</a> to join.`

  await resend.emails.send({
    to: email,
    from: 'no-reply@coinstac.org',
    subject: `Invitation to join ${consortiumTitle}`,
    html,
  })
}

export default {
  Query: {
    getUserProfile: async (
      _: unknown,
      __: unknown,
      context: Context,
    ): Promise<UserProfile> => {
      const { userId } = context
      if (!userId) {
        throw new Error('User is not authenticated')
      }

      const user = await User.findById(userId)

      if (!user) {
        throw new Error('User not found')
      }

      return {
        userId: user._id.toString(),
        username: user.username,
        roles: user.roles,
      }
    },
    getConsortiumList: async (
      _: unknown,
      _args: unknown,
      context: Context,
    ): Promise<ConsortiumListItem[]> => {
      const { userId, roles } = context
      const isAdmin = roles?.includes('admin')

      const filter: Record<string, unknown> = (() => {
        if (isAdmin) return {}
        if (!userId) {
          return {
            $or: [
              { isPrivate: { $exists: false } },
              { isPrivate: false },
            ],
          }
        }

        return {
          $or: [
            { isPrivate: { $exists: false } },
            { isPrivate: false },
            { isPrivate: true, leader: userId },
            { isPrivate: true, members: userId },
          ],
        }
      })()

      const consortiums = await Consortium.find(filter)
        .populate('leader')
        .populate('members')
        .lean() // Use lean() for better performance and to get plain JavaScript objects

      return consortiums.map((consortium) => ({
        id: consortium._id.toString(),
        title: consortium.title,
        description: consortium.description,
        leader: {
          id: (consortium.leader as any)._id.toString(),
          username: (consortium.leader as any).username,
        },
        members: (consortium.members as any[]).map((member) => ({
          id: member._id.toString(),
          username: member.username,
          vault: mapVault(member.vault),
        })),
        isPrivate: consortium.isPrivate ?? false,
      }))
    },
    getComputationList: async (): Promise<ComputationListItem[]> => {
      const computations = await Computation.find().lean()
      return computations.map((computation) => ({
        id: computation._id.toString(),
        title: computation.title,
        imageName: computation.imageName,
      }))
    },
    getMyAllowedComputations: async (
      _: unknown,
      __: unknown,
      context: Context,
    ): Promise<ComputationListItem[]> => {
      if (!context.userId) {
        throw new Error('User is not authenticated')
      }

      const user = await User.findById(context.userId)
        .populate('vault.allowedComputations', 'title imageName')
        .exec()

      if (!user) {
        throw new Error('User not found')
      }

      if (!user.roles.includes('vault')) {
        throw new Error('User is not a vault user')
      }

      return mapAllowedComputations(user.vault?.allowedComputations as any[])
    },
    getMyVaultConfig: async (
      _: unknown,
      __: unknown,
      context: Context,
    ) => {
      if (!context.userId) {
        throw new Error('User is not authenticated')
      }

      const user = await User.findById(context.userId)
        .populate('vault.allowedComputations', 'title imageName')
        .exec()

      if (!user) {
        throw new Error('User not found')
      }

      if (!user.roles.includes('vault')) {
        throw new Error('User is not a vault user')
      }

      if (!user.vault) {
        throw new Error('Vault settings not found for this user')
      }

      return mapVault(user.vault)
    },
    getConsortiumDetails: async (
      _: unknown,
      { consortiumId }: { consortiumId: string },
      context: Context,
    ): Promise<ConsortiumDetails | null> => {
      try {
        const consortium = await Consortium.findById(consortiumId)
          .populate({
            path: 'leader',
            select: 'id username vault',
            populate: {
              path: 'vault.allowedComputations',
              select: 'title imageName',
            },
          })
          .populate({
            path: 'members',
            select: 'id username vault',
            populate: {
              path: 'vault.allowedComputations',
              select: 'title imageName',
            },
          })
          .populate({
            path: 'activeMembers',
            select: 'id username vault',
            populate: {
              path: 'vault.allowedComputations',
              select: 'title imageName',
            },
          })
          .populate({
            path: 'readyMembers',
            select: 'id username vault',
            populate: {
              path: 'vault.allowedComputations',
              select: 'title imageName',
            },
          })
          .populate(
            'studyConfiguration.computation',
            'title imageName imageDownloadUrl notes owner hasLocalParameters',
          )
          .exec()

        if (!consortium) {
          throw new Error('Consortium not found or inaccessible')
        }

        if (consortium.isPrivate) {
          const { userId, roles } = context
          const isAdmin = roles?.includes('admin')

          if (!isAdmin) {
            if (!userId) throw new Error('Consortium not found or inaccessible')
            const leaderId = consortium.leader._id.toString()
            const isLeader = leaderId === userId
            const isMember = consortium.members.map((member) => member._id.toString()).includes(userId)
            if (!isLeader && !isMember) {
              throw new Error('Consortium not found or inaccessible')
            }
          }
        }

        const {
          _id: consortiumObjectId,
          title,
          description,
          leader,
          members,
          activeMembers,
          readyMembers,
          studyConfiguration: {
            consortiumLeaderNotes,
            computationParameters,
            computation,
          } = {},
        } = consortium

        const transformUser = (user: any): PublicUser => ({
          id: user.id,
          username: user.username,
          vault: mapVault(user.vault),
        })

        return {
          id: consortiumObjectId.toString(),
          title,
          description,
          leader: leader ? transformUser(leader) : null,
          members: members ? members.map(transformUser) : [],
          activeMembers: activeMembers ? activeMembers.map(transformUser) : [],
          readyMembers: readyMembers ? readyMembers.map(transformUser) : [],
          studyConfiguration: {
            consortiumLeaderNotes,
            computationParameters,
            computation: computation
              ? {
                  title: computation.title,
                  imageName: computation.imageName,
                  imageDownloadUrl: computation.imageDownloadUrl,
                  notes: computation.notes,
                  owner: computation.owner,
                  hasLocalParameters: computation.hasLocalParameters,
                }
              : null,
          },
          isPrivate: consortium.isPrivate ?? false,
        }
      } catch (error) {
        logger.error('Error in getConsortiumDetails:', error)
        throw new Error('Failed to fetch consortium details')
      }
    },
    getComputationDetails: async (
      _: unknown,
      { computationId }: { computationId: string },
    ): Promise<{
      title: string
      imageName: string
      imageDownloadUrl: string
      notes: string
      owner: string
      hasLocalParameters?: boolean
    }> => {
      try {
        const computation = await Computation.findById(computationId)
        if (!computation) {
          throw new Error('Computation not found')
        }

        const { title, imageName, imageDownloadUrl, notes, owner, hasLocalParameters } = computation

        return {
          title,
          imageName,
          imageDownloadUrl,
          notes,
          owner,
          hasLocalParameters,
        }
      } catch (error) {
        logger.error('Error in getComputationDetails:', error)
        throw new Error(`Failed to fetch computation details: ${error.message}`)
      }
    },
    getRunList: async (
      _: unknown,
      args: { consortiumId?: string }, // Accept consortiumId as an optional argument
      context: Context,
    ): Promise<RunListItem[]> => {
      const { userId } = context
      const { consortiumId } = args // Extract consortiumId from args

      try {
        // Build the query filter
        const query: any = {
          members: userId,
        }

        // Add consortiumId to the query if it's specified
        if (consortiumId) {
          query.consortium = consortiumId
        }

        // Perform the query with the filter
        const runs = await Run.find(query)
          .populate('consortium', 'title')
          .populate('members', 'id username')
          .sort({ createdAt: -1 })
          .lean()
          .exec()

        return runs.map((run) => {
          if (!('title' in run.consortium)) {
            throw new Error('Consortium data is missing or incomplete')
          }

          return {
            consortiumId: run.consortium._id.toString(),
            consortiumTitle: run.consortium.title as string,
            runId: run._id.toString(),
            status: run.status,
            createdAt: run.createdAt,
            lastUpdated: run.lastUpdated,
          }
        })
      } catch (error) {
        logger.error('Error fetching run list:', error)
        throw new Error('Failed to fetch run list')
      }
    },

    getRunDetails: async (
      _: unknown,
      { runId }: { runId: string },
      context: Context,
    ): Promise<RunDetails> => {
      const { userId } = context
      if (!userId) {
        throw new Error('User not authenticated')
      }

      try {
        const run: IRun = await Run.findById(runId)
          .populate({
            path: 'consortium',
            select: 'title leader activeMembers readyMembers',
            populate: [
              { path: 'leader', select: 'id username' },
              { path: 'activeMembers', select: 'id username' },
              { path: 'readyMembers', select: 'id username' },
            ],
          })
          .populate({
            path: 'members',
            select: 'id username vault',
            model: User,
          })
          .populate({
            path: 'runErrors.user',
            select: 'id username', // Populate the user field in runErrors with id, username
            model: User,
          })
          .populate(
            'studyConfiguration.computation',
            'title imageName imageDownloadUrl notes owner hasLocalParameters',
          )
          .lean()
          .exec()

        // if the userId is not in the members array, throw an error
        if (
          !run.members
            .map((member: any) => member._id.toString())
            .includes(userId)
        ) {
          throw new Error('User not authorized to view this run')
        }

        if (!('title' in run.consortium)) {
          throw new Error('Consortium data is missing or incomplete')
        }

        const transformUser = (user: any): PublicUser => ({
          id: user._id.toString(),
          username: user.username,
        })

        const consortium = run.consortium as unknown as {
          _id: any
          title: string
          leader: any
          activeMembers: any[]
          readyMembers: any[]
        }

        return {
          runId: run._id.toString(),
          consortium: {
            id: consortium._id.toString(),
            title: consortium.title as string,
            leader: consortium.leader ? transformUser(consortium.leader) : null,
            activeMembers: (consortium.activeMembers || []).map(transformUser),
            readyMembers: (consortium.readyMembers || []).map(transformUser),
          },
          status: run.status,
          lastUpdated: run.lastUpdated,
          createdAt: run.createdAt,
          members: run.members.map((member: any) => ({
            id: member._id.toString(),
            username: member.username,
            vault: mapVault(member.vault),
          })),
          studyConfiguration: {
            consortiumLeaderNotes: run.studyConfiguration.consortiumLeaderNotes,
            computationParameters: run.studyConfiguration.computationParameters,
            computation: {
              title: run.studyConfiguration.computation.title,
              imageName: run.studyConfiguration.computation.imageName,
              imageDownloadUrl:
                run.studyConfiguration.computation.imageDownloadUrl,
              notes: run.studyConfiguration.computation.notes,
              owner: run.studyConfiguration.computation.owner,
              hasLocalParameters: run.studyConfiguration.computation.hasLocalParameters || false,
            },
          },
          runErrors: run.runErrors.map((error: any) => ({
            user: {
              id: error.user._id.toString(),
              username: error.user.username,
            },
            timestamp: error.timestamp,
            message: error.message,
          })),
        }
      } catch (e) {
        logger.error(`Error fetching run details: ${JSON.stringify(e)}`)
        throw new Error('Failed to fetch run details')
      }
    },
    getVaultUserList: async (): Promise<PublicUser[]> => {
      const users = await User.find({ roles: 'vault' })
        .populate('vault.allowedComputations', 'title imageName')
        .exec()

      // Get consortium titles for any running computations
      const consortiumIds = new Set<string>()
      users.forEach((user) => {
        user.vaultStatus?.runningComputations?.forEach((comp) => {
          consortiumIds.add(comp.consortiumId)
        })
      })

      const consortiums = await Consortium.find({
        _id: { $in: Array.from(consortiumIds) },
      })
        .select('_id title')
        .lean()
      const consortiumMap = new Map(
        consortiums.map((c) => [c._id.toString(), c.title]),
      )

      return users.map((user) => ({
        id: user._id.toString(),
        username: user.username,
        vault: mapVault(user.vault),
        vaultStatus: mapVaultStatus(user.vaultStatus, consortiumMap),
      }))
    },
    getInviteInfo: async (
      _: unknown,
      { inviteToken }: { inviteToken: string },
    ): Promise<InviteInfo> => {
      const invite = await Invite.findOne({ token: inviteToken })
        .populate('leader')
        .populate('consortium')
        .lean()

      if (!invite) {
        throw new Error('Invalid invite link')
      }

      const consortium: any = invite.consortium
      const leader: any = invite.leader

      if (!consortium || !leader) {
        throw new Error('Invite is missing consortium or leader information')
      }

      const createdAtMs = new Date(invite.createdAt).getTime()
      const isExpired = createdAtMs < Date.now() - INVITE_EXPIRATION_MS

      return {
        consortiumName: consortium.title,
        leaderName: leader.username,
        isExpired,
      }
    },
  },
  Mutation: {
    // Vault heartbeat - updates vault status
    vaultHeartbeat: async (
      _: unknown,
      {
        heartbeat,
      }: {
        heartbeat: {
          status: string
          version: string
          uptime: number
          websocketConnected: boolean
          runningComputations: Array<{
            runId: string
            consortiumId: string
            startedAt: string
          }>
          availableDatasets: Array<{
            key: string
            path: string
            label?: string | null
            lastSeenAt: string
          }>
        }
      },
      context: Context,
    ): Promise<boolean> => {
      // Authenticate the user
      if (!context.userId) {
        throw new Error('User not authenticated')
      }

      // Authorize - must be a vault user
      if (!context.roles.includes('vault')) {
        throw new Error('User not authorized - not a vault user')
      }

      // Update the user's vault status
      await User.findByIdAndUpdate(context.userId, {
        vaultStatus: {
          status: heartbeat.status,
          version: heartbeat.version,
          uptime: heartbeat.uptime,
          websocketConnected: heartbeat.websocketConnected,
          lastHeartbeat: new Date(),
          runningComputations: heartbeat.runningComputations.map((comp) => ({
            runId: comp.runId,
            consortiumId: comp.consortiumId,
            startedAt: new Date(comp.startedAt),
          })),
          availableDatasets: heartbeat.availableDatasets.map((dataset) => ({
            key: dataset.key.trim(),
            path: dataset.path.trim(),
            label: dataset.label?.trim() || undefined,
            lastSeenAt: new Date(dataset.lastSeenAt),
          })),
        },
      })

      logger.debug('Vault heartbeat received', {
        context: {
          userId: context.userId,
          status: heartbeat.status,
          runningComputations: heartbeat.runningComputations.length,
          availableDatasets: heartbeat.availableDatasets.length,
        },
      })

      return true
    },
    login: async (
      _,
      {
        username,
        password,
      }: {
        username: string
        password: string
      },
      context,
    ): Promise<LoginOutput> => {
      // get the user from the database
      const user = await User.findOne({ username })
      if (!user) {
        throw new Error('User not found')
      }
      // compare the password
      if (!(await compare(password, user.hash))) {
        throw new Error('Invalid username or password')
      }

      // create a token
      const tokens = generateTokens({
        userId: user._id,
        roles: user.roles,
      })
      const { accessToken } = tokens as { accessToken: string }

      return {
        accessToken,
        userId: user._id.toString(),
        username: user.username,
        roles: user.roles,
      }
    },
    requestPasswordReset: async (
      _: unknown,
      { username }: { username: string },
    ): Promise<boolean> => {
      const user = await User.findOne({ username })
      if (!user) {
        throw new Error('User not found')
      }

      const resetToken = randomBytes(32).toString('hex')
      user.resetToken = resetToken
      user.resetTokenExpiry = Date.now() + 1000 * 60 * 60 * 24 // 24 hours
      await user.save()

      const email = user.username
      const msg = {
        to: email,
        from: 'no-reply@coinstac.org',
        subject: 'Password Reset Request',
        html: `We received your password reset request. <br/>
            Please use this token for password reset. <br/>
            Username: <strong>${username}</strong> <br/>
            Token: <strong>${resetToken}</strong>`,
      }

      try {
        await resend.emails.send(msg)
      } catch (error: any) {
        throw new Error(`Failed to send email: ${error.message}`)
      }

      return true
    },
    resetPassword: async (
      _: unknown,
      { token, newPassword }: { token: string; newPassword: string },
    ): Promise<{
      accessToken: string
      userId: string
      username: string
      roles: string[]
    }> => {
      try {
        const user = await User.findOne({
          resetToken: token,
          resetTokenExpiry: { $gt: Date.now() },
        })

        if (!user) {
          throw new Error('Invalid or expired token')
        }

        const hashedPassword = await hashPassword(newPassword)
        user.hash = hashedPassword
        user.resetToken = undefined
        user.resetTokenExpiry = undefined
        await user.save()

        const tokens = generateTokens({
          userId: user._id,
          roles: user.roles,
        })
        const { accessToken } = tokens as { accessToken: string }

        return {
          accessToken,
          userId: user._id.toString(),
          username: user.username,
          roles: user.roles,
        }
      } catch (error: any) {
        logger.error('Error resetting password:', error.message)
        throw new Error(error.message)
      }
    },
    startRun: async (
      _: unknown,
      { input }: { input: StartRunInput },
      context: Context,
    ): Promise<StartRunOutput> => {
      // authenticate the user
      if (!context.userId) {
        throw new Error('User not authenticated')
      }

      // get the consortium details from the database
      const consortium = await Consortium.findById(input.consortiumId)
      if (!consortium) {
        throw new Error('Consortium not found')
      }

      // authorize the user
      if (consortium.leader.toString() !== context.userId) {
        throw new Error(
          'User is not authorized to start a run for this consortium',
        )
      }

      if (!consortium.studyConfiguration?.computation) {
        throw new Error('A computation must be selected before starting a run.')
      }

      const computationParameters = ensureValidComputationParameters(
        consortium.studyConfiguration?.computationParameters,
      )

      // create a new run in the database
      const run = await Run.create({
        consortium: consortium._id,
        consortiumLeader: consortium.leader,
        studyConfiguration: {
          ...consortium.studyConfiguration,
          computationParameters,
        },
        members: consortium.activeMembers,
        status: 'Provisioning',
        runErrors: [],
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      })

      pubsub.publish('RUN_START_CENTRAL', {
        runId: run._id.toString(),
        imageName: consortium.studyConfiguration.computation.imageName,
        userIds: consortium.activeMembers.map((member) => member.toString()),
        consortiumId: consortium._id.toString(),
        computationParameters,
      })

      pubsub.publish('RUN_EVENT', {
        consortiumId: consortium._id.toString(),
        consortiumTitle: consortium.title,
        runId: run._id.toString(),
        status: 'Provisioning',
        timestamp: Date.now(),
      })

      pubsub.publish('CONSORTIUM_LATEST_RUN_CHANGED', {
        consortiumId: consortium._id.toString(),
      })

      pubsub.publish('RUN_DETAILS_CHANGED', {
        runId: run._id.toString(),
      })

      return { runId: run._id.toString() }
    },
    reportRunReady: async (
      _: unknown,
      { runId }: { runId: string },
      context: Context,
    ): Promise<boolean> => {
      logger.info('reportRunReady', runId)
      // authenticate the user
      // is the token valid?
      if (!context.userId) {
        throw new Error('User not authenticated')
      }

      // authorize the user
      if (!context.roles.includes('central')) {
        throw new Error('User not authorized')
      }

      // get the run's details from the database
      const run = await Run.findById(runId)
      await Run.updateOne(
        { _id: runId },
        { status: 'In Progress', lastUpdated: Date.now() },
      )
      const imageName = run.studyConfiguration.computation.imageName
      const computationId = run.studyConfiguration.computation._id.toString()
      const consortiumId = run.consortium._id

      const consortium = await Consortium.findById(consortiumId)

      pubsub.publish('RUN_START_EDGE', {
        runId,
        computationId,
        imageName,
        consortiumId,
      })

      pubsub.publish('RUN_EVENT', {
        consortiumId: consortium._id.toString(),
        consortiumTitle: consortium.title,
        runId: run._id.toString(),
        status: 'Starting',
        timestamp: Date.now(),
      })

      pubsub.publish('CONSORTIUM_LATEST_RUN_CHANGED', {
        consortiumId: consortium._id.toString(),
      })

      pubsub.publish('RUN_DETAILS_CHANGED', {
        runId: run._id.toString(),
      })

      return true
    },
    reportRunError: async (
      _: unknown,
      { runId, errorMessage }: { runId: string; errorMessage: string },
      context: Context,
    ): Promise<boolean> => {
      logger.info('reportRunError', { runId })

      if (!context.userId) {
        throw new Error('User not authenticated')
      }

      // Find the run and verify the user's authorization
      const run = await Run.findById(runId)
      if (!run) {
        throw new Error(`Run with id ${runId} not found`)
      }

      const isUserCentral = context?.roles?.includes('central')
      const isUserMember = run.members.some((memberId) =>
        memberId.equals(context.userId),
      )

      if (!isUserCentral && !isUserMember) {
        throw new Error('User not authorized')
      }

      // Append the error to the runErrors array and update the run's status and lastUpdated fields
      await Run.updateOne(
        { _id: runId },
        {
          status: 'Error',
          lastUpdated: Date.now().toString(), // Store as a string
          $push: {
            runErrors: {
              user: context.userId, // Reference to the user who reported the error
              message: errorMessage,
              timestamp: Date.now().toString(), // Store as a string
            },
          },
        },
      )

      const consortium = await Consortium.findById(run.consortium._id)
      if (!consortium) {
        throw new Error(`Consortium with id ${run.consortium._id} not found`)
      }

      pubsub.publish('RUN_EVENT', {
        consortiumId: consortium._id.toString(),
        consortiumTitle: consortium.title,
        runId: run._id.toString(),
        status: 'Error',
        timestamp: Date.now(),
      })

      pubsub.publish('CONSORTIUM_LATEST_RUN_CHANGED', {
        consortiumId: consortium._id.toString(),
      })

      pubsub.publish('RUN_DETAILS_CHANGED', {
        runId: run._id.toString(),
      })

      return true
    },

    reportRunComplete: async (
      _: unknown,
      { runId },
      context: Context,
    ): Promise<boolean> => {
      logger.info('reportRunComplete', runId)
      // authenticate the user
      // is the token valid?
      if (!context.userId) {
        throw new Error('User not authenticated')
      }

      // authorize the user
      if (!context.roles.includes('central')) {
        throw new Error('User not authorized')
      }

      // get the run's details from the database
      const run = await Run.findById(runId)
      await Run.updateOne(
        { _id: runId },
        { status: 'Complete', lastUpdated: Date.now() },
      )

      const consortium = await Consortium.findById(run.consortium._id)

      pubsub.publish('RUN_EVENT', {
        consortiumId: consortium._id.toString(),
        consortiumTitle: consortium.title,
        runId: run._id.toString(),
        status: 'Complete',
        timestamp: Date.now(),
      })

      pubsub.publish('CONSORTIUM_LATEST_RUN_CHANGED', {
        consortiumId: consortium._id.toString(),
      })

      pubsub.publish('RUN_DETAILS_CHANGED', {
        runId: run._id.toString(),
      })

      return true
    },
    reportRunStatus: async (
      _: unknown,
      { runId, statusMessage }: { runId: string; statusMessage: string },
    ): Promise<boolean> => true,
    studySetComputation: async (
      _: unknown,
      {
        consortiumId,
        computationId,
      }: { consortiumId: String; computationId: String },
      context: Context,
    ): Promise<boolean> => {
      try {
        // Check to see if the consortium exists
        const consortium = await Consortium.findById(consortiumId)
        if (!consortium) {
          throw new Error('Consortium not found')
        }

        // Check if the caller is authorized
        if (consortium.leader.toString() !== context.userId) {
          throw new Error('Not authorized')
        }

        // Check to see if the computation exists
        const computation = await Computation.findById(computationId)
        if (!computation) {
          throw new Error('Computation not found')
        }

        const vaultMembers = await User.find({
          _id: { $in: consortium.members },
          roles: 'vault',
        })
          .populate('vault.allowedComputations', 'title imageName')
          .exec()

        const incompatibleVaults = vaultMembers.filter(
          (member) => !allowsComputation(member as any, computationId.toString()),
        )
        if (incompatibleVaults.length > 0) {
          const vaultNames = incompatibleVaults.map(
            (member) => member.vault?.name || member.username,
          )
          throw new Error(
            `The following vaults do not allow "${computation.title}": ${vaultNames.join(', ')}`,
          )
        }

        // Set the computation in the study configuration
        consortium.set('studyConfiguration.computation', computation)
        await consortium.save()

        pubsub.publish('CONSORTIUM_DETAILS_CHANGED', {
          consortiumId,
        })

        return true
      } catch (error) {
        logger.error('Error in studySetComputation:', error)
        throw new Error(`Failed to set computation: ${error.message}`)
      }
    },
    studySetParameters: async (
      _: unknown,
      {
        consortiumId,
        parameters,
      }: { consortiumId: string; parameters: string },
      context: Context,
    ): Promise<boolean> => {
      try {
        // Check to see if the consortium exists
        const consortium = await Consortium.findById(consortiumId)
        if (!consortium) {
          throw new Error('Consortium not found')
        }

        // Check if the caller is authorized
        if (consortium.leader.toString() !== context.userId) {
          throw new Error('Not authorized')
        }

        // see if the string is valid json
        try {
          JSON.parse(parameters)
        } catch (e) {
          throw new Error(`failed to parse parameters into JSON ${e}`)
        }

        // Set the computation in the study configuration
        consortium.set('studyConfiguration.computationParameters', parameters)
        await consortium.save()

        pubsub.publish('CONSORTIUM_DETAILS_CHANGED', {
          consortiumId,
        })

        return true
      } catch (error) {
        logger.error('Error in setStudyParameters:', error)
        throw new Error(`Failed to set computation: ${error.message}`)
      }
    },
    studySetNotes: async (
      _: unknown,
      { consortiumId, notes }: { consortiumId: String; notes: String },
      context: Context,
    ): Promise<boolean> => {
      try {
        // Check to see if the consortium exists
        const consortium = await Consortium.findById(consortiumId)
        if (!consortium) {
          throw new Error('Consortium not found')
        }

        // Check if the caller is authorized
        if (consortium.leader.toString() !== context.userId) {
          throw new Error('Not authorized')
        }

        // Set the computation in the study configuration
        consortium.set('studyConfiguration.consortiumLeaderNotes', notes)
        await consortium.save()

        pubsub.publish('CONSORTIUM_DETAILS_CHANGED', {
          consortiumId,
        })

        return true
      } catch (error) {
        logger.error('Error in setStudyNotes:', error)
        throw new Error(`Failed to set computation: ${error.message}`)
      }
    },
    consortiumCreate: async (
      _: unknown,
      { title, description, isPrivate = false }: { title: string; description: string; isPrivate: boolean },
      context: Context,
    ): Promise<any> => {
      if (!title) {
        throw new Error('Title is required')
      }

      if (title) {
        const otherConsortium = await Consortium.findOne({
          title,
        })
        if (otherConsortium) {
          throw new Error('Consortium with that title already exists')
        }
      }

      const consortium = await Consortium.create({
        title,
        description,
        leader: context.userId,
        members: [context.userId],
        activeMembers: [context.userId],
        readyMembers: [],
        studyConfiguration: {
          computationParameters: '',
          computation: null,
        },
        isPrivate,
      })

      return consortium._id.toString()
    },
    computationCreate: async (
      _: unknown,
      {
        title,
        imageName,
        imageDownloadUrl,
        notes,
        hasLocalParameters,
      }: {
        title: string
        imageName: string
        imageDownloadUrl: string
        notes: string
        hasLocalParameters?: boolean
      },
      context: Context,
    ): Promise<boolean> => {
      if (!title || !imageName || !imageDownloadUrl || !notes) {
        throw new Error(
          'Title, imageName, imageDownloadUrl, and notes are required',
        )
      }

      const existingComputation = await Computation.findOne({ title })

      if (existingComputation) {
        throw new Error('Computation with that title already exists')
      }

      await Computation.create({
        title,
        imageName,
        imageDownloadUrl,
        notes,
        owner: context.userId,
        hasLocalParameters,
      })

      return true
    },
    computationEdit: async (
      _: unknown,
      {
        computationId,
        title,
        imageName,
        imageDownloadUrl,
        notes,
        hasLocalParameters,
      }: {
        computationId: string
        title?: string
        imageName?: string
        imageDownloadUrl?: string
        notes?: string
        hasLocalParameters?: boolean
      },
      context: Context,
    ): Promise<boolean> => {
      // Ensure the computation exists
      const computation = await Computation.findById(computationId)
      if (!computation) {
        throw new Error('Computation not found')
      }

      // Verify that the user is the owner of the computation
      if (computation.owner.toString() !== context.userId) {
        throw new Error('User not authorized to edit this computation')
      }

      // Ensure at least one field is provided for update
      if (!title && !imageName && !imageDownloadUrl && !notes) {
        throw new Error('No fields provided to update')
      }

      // Check if the title is provided and validate it against existing computations
      if (title) {
        const otherComputation = await Computation.findOne({
          title,
          _id: { $ne: computationId },
        })
        if (otherComputation) {
          throw new Error('Computation with that title already exists')
        }
      }

      // Prepare the update payload
      type UpdatePayload = Partial<{
        title: string
        imageName: string
        imageDownloadUrl: string
        notes: string
        hasLocalParameters: boolean
      }>

      const updatePayload: UpdatePayload = {}

      if (title !== undefined) updatePayload.title = title
      if (imageName !== undefined) updatePayload.imageName = imageName
      if (imageDownloadUrl !== undefined) updatePayload.imageDownloadUrl = imageDownloadUrl
      if (notes !== undefined) updatePayload.notes = notes
      if (hasLocalParameters !== undefined) updatePayload.hasLocalParameters = hasLocalParameters

      // Perform the update operation
      try {
        await Computation.updateOne(
          { _id: computationId, owner: context.userId },
          { $set: updatePayload },
        )
        return true
      } catch (error) {
        logger.error('Error updating computation:', error)
        throw new Error('Failed to update computation')
      }
    },
    consortiumEdit: async (
      _: unknown,
      {
        consortiumId,
        title,
        description,
        isPrivate,
      }: { consortiumId: string; title?: string; description?: string; isPrivate?: boolean },
      context: Context,
    ): Promise<boolean> => {
      const consortium = await Consortium.findById(consortiumId)
      if (!consortium) {
        throw new Error('Consortium not found')
      }

      const isAdmin = context.roles?.includes('admin')
      const isLeader = consortium.leader.toString() === context.userId
      if (!isAdmin && !isLeader) {
        throw new Error('User not authorized to edit this consortium')
      }

      // Check if the title is provided and validate it against existing consortia
      if (title) {
        const otherConsortium = await Consortium.findOne({
          title,
          _id: { $ne: consortiumId },
        })
        if (otherConsortium) {
          throw new Error('Consortium with that title already exists')
        }
      }

      // Ensure at least one field is provided for update
      if (!title && !description && isPrivate === undefined) {
        throw new Error('No fields provided to update')
      }

      // Prepare the update payload
      const updatePayload: { [key: string]: string | boolean } = {}
      if (title) updatePayload.title = title
      if (description) updatePayload.description = description
      if (isPrivate !== undefined) updatePayload.isPrivate = isPrivate

      // Perform the update operation
      try {
        await Consortium.updateOne(
          { _id: consortiumId },
          { $set: updatePayload },
        )
        return true
      } catch (error) {
        logger.error('Error updating consortium:', error)
        throw new Error('Failed to update consortium')
      }
    },
    consortiumJoin: async (
      _: unknown,
      { consortiumId }: { consortiumId: string },
      context: Context,
    ): Promise<boolean> => {
      const { userId, roles } = context
      if (!userId) {
        throw new Error('User not authenticated')
      }

      const consortium = await Consortium.findById(consortiumId)
      if (!consortium) {
        throw new Error('Consortium not found')
      }

      const isAdmin = roles?.includes('admin')
      const isExistingMember = consortium.members
        .map((memberId) => memberId.toString())
        .includes(userId)
      if (consortium.isPrivate && !isAdmin && !isExistingMember) {
        throw new Error('This consortium is private and cannot be joined directly')
      }

      await Consortium.findByIdAndUpdate(consortiumId, {
        $addToSet: { members: userId, activeMembers: userId },
      })

      pubsub.publish('CONSORTIUM_DETAILS_CHANGED', {
        consortiumId,
      })

      return true
    },
    consortiumJoinByInvite: async (
      _: unknown,
      { inviteToken }: { inviteToken: string },
      context: Context,
    ): Promise<boolean> => {
      const { userId } = context
      if (!userId) {
        throw new Error('User not authenticated')
      }

      const invite = await Invite.findOne({ token: inviteToken })
        .populate('leader', 'id username')
        .populate('consortium', 'id members') as any

      if (!invite) {
        throw new Error('Invalid invite link')
      }

      if (!invite.consortium || !invite.leader) {
        throw new Error('Invite is missing consortium or leader information')
      }

      const consortiumId = invite.consortium._id?.toString?.() ?? invite.consortium.id
      const isExistingMember = invite.consortium.members.some(
        (memberId: { toString: () => string }) => memberId.toString() === userId,
      )

      if (isExistingMember) {
        throw new Error('You\'re already a member of this consortium')
      }

      // Invite was sent to someone else.
      const user = await User.findById(userId)
      if (!user) {
        throw new Error('User not found')
      }

      if (user.username !== invite.email) {
        throw new Error('Invalid invite link')
      }

      const createdAtMs = new Date(invite.createdAt).getTime()
      const isExpired = createdAtMs < Date.now() - INVITE_EXPIRATION_MS

      // Invite is expired
      if (isExpired) {
        throw new Error('Invite is expired')
      }

      await Consortium.findByIdAndUpdate(consortiumId, {
        $addToSet: { members: userId, activeMembers: userId },
      })

      await invite.deleteOne()

      pubsub.publish('CONSORTIUM_DETAILS_CHANGED', {
        consortiumId,
      })

      return true
    },
    consortiumDelete: async (
      _: unknown,
      { consortiumId }: { consortiumId: string },
      context: Context,
    ): Promise<boolean> => {
      const { userId } = context
      if (!userId) {
        throw new Error('User not authenticated')
      }

      const consortium = await Consortium.findById(consortiumId)
      if (!consortium) {
        throw new Error('Consortium not found')
      }

      if (consortium.leader?.toString() !== userId) {
        throw new Error('You do not have permission to delete this consortium')
      }

      await Consortium.findByIdAndDelete(consortiumId)

      pubsub.publish('CONSORTIUM_DETAILS_CHANGED', {
        consortiumId,
      })

      return true
    },
    consortiumLeave: async (
      _: unknown,
      { consortiumId }: { consortiumId: string },
      context: Context,
    ): Promise<boolean> => {
      const { userId } = context
      if (!userId) {
        throw new Error('User not authenticated')
      }

      await Consortium.findByIdAndUpdate(consortiumId, {
        $pull: { members: userId, activeMembers: userId, readyMembers: userId },
      })

      pubsub.publish('CONSORTIUM_DETAILS_CHANGED', {
        consortiumId,
      })

      return true
    },
    consortiumSetMemberActive: async (
      _: unknown,
      { consortiumId, active }: { consortiumId: string; active: boolean },
      context: Context,
    ): Promise<boolean> => {
      const { userId } = context

      const consortium = await Consortium.findById(consortiumId)
      if (!consortium) {
        throw new Error('Consortium not found')
      }

      // Check if the caller is a member of the consortium
      if (
        !consortium.members.map((member) => member.toString()).includes(userId)
      ) {
        throw new Error('User is not a member of the consortium')
      }

      // Update the activeMembers array

      try {
        if (active) {
          await consortium.updateOne({
            $addToSet: { activeMembers: userId },
          })
        } else {
          await consortium.updateOne({
            $pull: { activeMembers: userId, readyMembers: userId },
          })
        }

        pubsub.publish('CONSORTIUM_DETAILS_CHANGED', {
          consortiumId,
        })

        return true
      } catch (error) {
        logger.error('Error updating consortium active members:', error)
        throw new Error('Failed to update consortium active members')
      }
    },
    consortiumSetMemberReady: async (
      _: unknown,
      { consortiumId, ready }: { consortiumId: string; ready: boolean },
      context: Context,
    ): Promise<boolean> => {
      const { userId } = context

      // Find the consortium by ID
      const consortium = await Consortium.findById(consortiumId)
      if (!consortium) {
        throw new Error('Consortium not found')
      }

      // Check if the caller is a member of the consortium
      if (
        !consortium.members.map((member) => member.toString()).includes(userId)
      ) {
        throw new Error('User is not a member of the consortium')
      }

      // If trying to set ready to true, check if the member is active
      if (
        ready &&
        !consortium.activeMembers
          .map((member) => member.toString())
          .includes(userId)
      ) {
        throw new Error('User must be active to be set as ready')
      }

      // Update the readyMembers array
      try {
        await consortium.updateOne({
          [ready ? '$addToSet' : '$pull']: { readyMembers: userId }, // Add if ready, remove if unready
        })

        // Publish an event indicating the consortium details have changed
        pubsub.publish('CONSORTIUM_DETAILS_CHANGED', {
          consortiumId,
        })

        return true
      } catch (error) {
        logger.error('Error updating consortium ready members:', error)
        throw new Error('Failed to update consortium ready members')
      }
    },
    consortiumInvite: async (
      _: unknown,
      { consortiumId, email }: { consortiumId: string; email: string },
      context: Context,
    ): Promise<boolean> => {
      if (!context.userId) {
        throw new Error('User not authenticated')
      }

      // Provided email is not valid
      if (!EMAIL_REGEX.test(email)) {
        throw new Error('Invalid email')
      }

      const consortium = await Consortium.findById(consortiumId)
        .populate('leader', 'username')
        .populate('members', 'id username vault')
        .lean()

      if (!consortium) {
        throw new Error('Consortium not found')
      }

      // Only consortium leader can send invites
      if ((consortium.leader as any)._id.toString() !== context.userId) {
        throw new Error('Only the consortium leader can send invites')
      }

      const isAlreadyMember = (consortium.members as any).some(
        (member) => member.username === email,
      )

      // User is already a member of the consortium
      if (isAlreadyMember) {
        throw new Error('User is already a member of the consortium')
      }

      // Set current time on createdAt if invite already exists
      const invite = await Invite.findOne({ email, consortium: consortiumId })
      const token = randomBytes(32).toString('hex')

      if (invite) {
        invite.token = token
        invite.createdAt = new Date()
        await invite.save()
      } else {
        await Invite.create({
          leader: context.userId,
          consortium: consortiumId,
          email,
          token,
          createdAt: Date.now(),
        })
      }

      const leaderName = (consortium.leader as any).username
      const consortiumTitle = consortium.title

      try {
        await sendInviteEmail({
          email,
          leaderName,
          consortiumTitle,
          token,
        })
      } catch (error: any) {
        logger.error('Failed to send invite email', error)
        throw new Error(`Failed to send invite email: ${error.message}`)
      }

      return true
    },
    userCreate: async (
      _: unknown,
      { username, password }: { username: string; password: string },
    ): Promise<LoginOutput> => {
      try {
        if (!EMAIL_REGEX.test(username)) {
          throw new Error('Username should be email')
        }

        const existingUser = await User.findOne({ username })
        if (existingUser) {
          throw new Error('User already exists')
        }

        const hashedPassword = await hashPassword(password)
        const user = await User.create({
          username,
          hash: hashedPassword,
        })

        const tokens = generateTokens({
          userId: user._id,
          roles: user.roles,
        })
        const { accessToken } = tokens as { accessToken: string }

        return {
          accessToken,
          userId: user._id.toString(),
          username: user.username,
          roles: user.roles,
        }
      } catch (error) {
        logger.error('Error creating user:', error.message)
        throw new Error(error.message)
      }
    },

    userChangePassword: async (
      _: unknown,
      { password }: { userId: string; password: string },
      context: any,
    ): Promise<boolean> => {
      const { userId } = context
      if (!userId) {
        throw new Error('User not authenticated')
      }

      try {
        const hashedPassword = await hashPassword(password)
        await User.updateOne({ _id: userId }, { hash: hashedPassword })
        return true
      } catch (error) {
        logger.error('Error changing password:', error)
        throw new Error('Failed to change password')
      }
    },
    adminChangeUserPassword: async (
      _: unknown,
      { username, password }: { username: string; password: string },
      context: any,
    ): Promise<boolean> => {
      // Get the user based on context.userId
      const callingUser = await User.findById(context.userId)

      // Check if the user is the same or an admin
      const isAuthorized = callingUser.roles.includes('admin')
      if (!isAuthorized) {
        throw new Error('Unauthorized')
      }

      try {
        const hashedPassword = await hashPassword(password)
        await User.updateOne({ username }, { hash: hashedPassword })
        return true
      } catch (error) {
        logger.error('Error changing password:', error)
        throw new Error('Failed to change password')
      }
    },
    adminChangeUserRoles: async (
      _: unknown,
      { username, roles }: { username: string; roles: string[] },
      context: any,
    ): Promise<boolean> => {
      if (!context.userId) {
        throw new Error('User not authenticated')
      }

      const callingUser = await User.findById(context.userId)
      const isAdmin = callingUser.roles.includes('admin')

      if (!isAdmin) {
        throw new Error('Unauthorized')
      }

      try {
        await User.updateOne({ username }, { roles })
        return true
      } catch (error) {
        logger.error('Error changing roles:', error)
        throw new Error('Failed to change roles')
      }
    },
    adminSetVaultAllowedComputations: async (
      _: unknown,
      {
        userId,
        computationIds,
      }: { userId: string; computationIds: string[] },
      context: Context,
    ): Promise<boolean> => {
      if (!context.userId) {
        throw new Error('User not authenticated')
      }

      if (!context.roles.includes('admin')) {
        throw new Error('Unauthorized')
      }

      const user = await User.findById(userId).exec()
      if (!user) {
        throw new Error('User not found')
      }

      if (!user.roles.includes('vault')) {
        throw new Error('User is not a vault user')
      }

      const uniqueComputationIds = Array.from(new Set(computationIds))
      const computations = await Computation.find({
        _id: { $in: uniqueComputationIds },
      })
        .select('title')
        .exec()

      if (computations.length !== uniqueComputationIds.length) {
        throw new Error('One or more computations were not found')
      }

      const incompatibleConsortia = await Consortium.find({
        members: user._id,
        'studyConfiguration.computation': { $exists: true, $ne: null },
      })
        .populate('studyConfiguration.computation', 'title')
        .select('title studyConfiguration')
        .exec()

      const blockedConsortia = incompatibleConsortia.filter((consortium) => {
        const selectedComputation = consortium.studyConfiguration?.computation as any
        if (!selectedComputation?._id) {
          return false
        }
        return !uniqueComputationIds.includes(selectedComputation._id.toString())
      })

      if (blockedConsortia.length > 0) {
        const consortiumTitles = blockedConsortia.map((consortium) => consortium.title)
        throw new Error(
          `Cannot remove required computations while this vault belongs to: ${consortiumTitles.join(', ')}`,
        )
      }

      if (!user.vault) {
        throw new Error('Vault settings not found for this user')
      }

      user.vault.allowedComputations = uniqueComputationIds as any
      user.vault.datasetMappings = (user.vault.datasetMappings ?? []).filter(
        (mapping) => uniqueComputationIds.includes(mapping.computationId.toString()),
      ) as any
      await user.save()

      return true
    },
    adminSetVaultDatasetMappings: async (
      _: unknown,
      {
        userId,
        mappings,
      }: {
        userId: string
        mappings: Array<{ computationId: string; datasetKey: string }>
      },
      context: Context,
    ): Promise<boolean> => {
      if (!context.userId) {
        throw new Error('User not authenticated')
      }

      if (!context.roles.includes('admin')) {
        throw new Error('Unauthorized')
      }

      const user = await User.findById(userId)
        .populate('vault.allowedComputations', 'title imageName')
        .exec()
      if (!user) {
        throw new Error('User not found')
      }

      if (!user.roles.includes('vault')) {
        throw new Error('User is not a vault user')
      }

      if (!user.vault) {
        throw new Error('Vault settings not found for this user')
      }

      const normalizedMappings = mappings.map((mapping) => ({
        computationId: mapping.computationId,
        datasetKey: mapping.datasetKey.trim(),
      }))

      if (normalizedMappings.some((mapping) => mapping.datasetKey.length === 0)) {
        throw new Error('Dataset key is required for every mapping')
      }

      const uniqueComputationIds = new Set<string>()
      for (const mapping of normalizedMappings) {
        if (uniqueComputationIds.has(mapping.computationId)) {
          throw new Error('Each computation may only have one dataset mapping')
        }
        uniqueComputationIds.add(mapping.computationId)
      }

      const computations = await Computation.find({
        _id: { $in: Array.from(uniqueComputationIds) },
      })
        .select('title')
        .exec()

      if (computations.length !== uniqueComputationIds.size) {
        throw new Error('One or more computations were not found')
      }

      const allowedComputationIds = new Set(
        (user.vault.allowedComputations as any[]).map((computation) =>
          computation._id.toString(),
        ),
      )

      for (const mapping of normalizedMappings) {
        if (!allowedComputationIds.has(mapping.computationId)) {
          throw new Error('Dataset mappings must reference allowed computations')
        }
      }

      user.vault.datasetMappings = normalizedMappings as any
      await user.save()

      return true
    },
    leaderSetMemberInactive: async (
      _: unknown,
      {
        consortiumId,
        userId,
        active,
      }: {
        consortiumId: string
        userId: string
        active: boolean
      },
      context,
    ): Promise<Boolean> => {
      // is the user authenticated?
      if (!context.userId) {
        throw new Error('User not authenticated')
      }

      const consortium = await Consortium.findById(consortiumId)
      if (!consortium) {
        throw new Error('Consortium not found')
      }
      // is this being called by the consortium leader
      if (consortium.leader.toString() !== context.userId) {
        throw new Error('User not authorized')
      }
      // is the user a member of the consortium
      if (!consortium.members.map((member) => member.toString()).includes(userId)) {
        throw new Error('User not a member of the consortium')
      }
      if (active) {
        await consortium.updateOne({
          $addToSet: { activeMembers: userId },
        })
      } else {
        await consortium.updateOne({
          $pull: { activeMembers: userId, readyMembers: userId },
        })
      }

      pubsub.publish('CONSORTIUM_DETAILS_CHANGED', {
        consortiumId,
      })

      return true
    },
    leaderRemoveMember: async (
      _: unknown,
      { consortiumId, userId },
      context,
    ): Promise<Boolean> => {
      // is the user authenticated?
      if (!context.userId) {
        throw new Error('User not authenticated')
      }

      const consortium = await Consortium.findById(consortiumId)
      if (!consortium) {
        throw new Error('Consortium not found')
      }
      // is this being called by the consortium leader
      if (consortium.leader.toString() !== context.userId) {
        throw new Error('User not authorized')
      }

      // remove from the members, active members, and ready members
      await consortium.updateOne({
        $pull: { members: userId, activeMembers: userId, readyMembers: userId },
      })

      pubsub.publish('CONSORTIUM_DETAILS_CHANGED', {
        consortiumId,
      })

      return true
    },
    leaderAddVaultUser: async (
      _: unknown,
      { consortiumId, userId },
      context,
    ): Promise<Boolean> => {
      // is the user authenticated?
      if (!context.userId) {
        throw new Error('User not authenticated')
      }

      const consortium = await Consortium.findById(consortiumId)
      if (!consortium) {
        throw new Error('Consortium not found')
      }
      // is this being called by the consortium leader
      if (consortium.leader.toString() !== context.userId) {
        throw new Error('User not authorized')
      }

      // is the user a vault user
      const user = await User.findById(userId)
        .populate('vault.allowedComputations', 'title imageName')
        .exec()
      if (!user) {
        throw new Error('User not found')
      }
      // does the user have the role of vault?
      if (!user.roles.includes('vault')) {
        throw new Error('User is not a vault user')
      }

      const selectedComputationId = consortium.studyConfiguration?.computation?.toString()
      if (
        selectedComputationId &&
        !allowsComputation(user as any, selectedComputationId)
      ) {
        const selectedComputation = await Computation.findById(
          selectedComputationId,
        )
          .select('title')
          .exec()
        throw new Error(
          `Vault ${user.vault?.name || user.username} does not allow "${selectedComputation?.title || 'the selected computation'}"`,
        )
      }

      // add the user to the members, active members, and ready members
      await consortium.updateOne({
        $addToSet: {
          members: userId,
          activeMembers: userId,
          readyMembers: userId,
        },
      })

      pubsub.publish('CONSORTIUM_DETAILS_CHANGED', {
        consortiumId,
      })

      return true
    },
    runDelete: async (
      _: unknown,
      { runId }: { runId: string },
      context: Context,
    ): Promise<boolean> => {
      const { userId } = context
      if (!userId) {
        throw new Error('User not authenticated')
      }

      const run = await Run.findById(runId)
        .populate('consortium', 'leader')

      if (!run) {
        throw new Error('Run not found')
      }

      if ((run as any).consortium.leader.toString() !== userId) {
        throw new Error('You do not have permission to delete this run')
      }

      if (run.status !== 'Complete') {
        throw new Error('You cannot delete uncompleted run')
      }

      const consortiumId = (run as any).consortium._id.toString()

      await Run.findByIdAndDelete(runId)

      pubsub.publish('CONSORTIUM_LATEST_RUN_CHANGED', {
        consortiumId,
      })

      pubsub.publish('RUN_DETAILS_CHANGED', {
        runId,
      })

      return true
    },
  },

  Subscription: {
    runStartCentral: {
      resolve: (payload: RunStartCentralPayload): RunStartCentralPayload => {
        logger.info(
          `Event emitted for runStartCentral: \n${JSON.stringify(
            payload,
            null,
            2,
          )}`,
        )
        return payload
      },
      subscribe: withFilter(
        () => {
          logger.info('Subscription attempt for runStartCentral')
          return pubsub.asyncIterator(['RUN_START_CENTRAL'])
        },
        (
          payload: RunStartCentralPayload,
          variables: unknown,
          context: Context,
        ) => {
          logger.info(
            `Subscription attempt for runStartCentral: context: \n${JSON.stringify(
              context,
              null,
              2,
            )}`,
          )
          return context.roles.includes('central')
        },
      ),
    },
    runStartEdge: {
      resolve: async (
        payload: RunStartEdgePayload,
        args: unknown,
        context: Context,
      ): Promise<RunStartEdgePayload> => {
        const { runId, computationId, imageName, consortiumId } = payload
        // get the user's id from the context
        const userId = context.userId
        // create a token
        const tokens = generateTokens(
          { userId, runId, consortiumId },
          { shouldExpire: true },
        )

        const { accessToken } = tokens as { accessToken: string }

        const output = {
          userId,
          runId,
          computationId,
          imageName,
          consortiumId,
          downloadUrl: `${CLIENT_FILE_SERVER_URL}/download/${consortiumId}/${runId}/${userId}`,
          downloadToken: accessToken,
        }

        return output
      },
      subscribe: withFilter(
        () => pubsub.asyncIterator(['RUN_START_EDGE']),
        async (
          payload: RunStartEdgePayload,
          variables: unknown,
          context: Context,
        ) => {
          const { consortiumId } = payload
          const { userId } = context

          // Check if the user is part of the consortium's active members
          const consortium = await Consortium.findById(consortiumId).lean()
          if (!consortium) {
            logger.error('Consortium not found')
            throw new Error('Consortium not found')
          }

          const isActiveMember = consortium.activeMembers.some(
            (memberObjectId: any) => memberObjectId.toString() === userId,
          )

          return isActiveMember
        },
      ),
    },
    runEvent: {
      resolve: (payload: RunEventPayload): RunEventPayload => payload,
      subscribe: withFilter(
        () => pubsub.asyncIterator(['RUN_EVENT']),
        async (
          payload: RunEventPayload,
          variables: unknown,
          context: Context,
        ) => {
          logger.info('Run event emitted', { payload, context })

          if (context.error) {
            logger.error(`Error subscribing to runEvent: ${context.error}`)
            throw new Error(`Error subscribing to runEvent: ${context.error}`)
          }

          const { consortiumId } = payload
          const { userId } = context

          // Check if the user is part of the consortium's active members
          const consortium = await Consortium.findById(consortiumId).lean()
          if (!consortium) {
            logger.error('Consortium not found')
            throw new Error('Consortium not found')
          }

          const activeMemberIds = consortium.activeMembers.map(
            (memberObjectId: any) => memberObjectId.toString(),
          )
          const isActiveMember = activeMemberIds.includes(userId)

          logger.info(`Emitting a run event to userId: ${userId}`)
          return isActiveMember
        },
      ),
    },
    consortiumLatestRunChanged: {
      resolve: (): string => 'Consortium latest run changed',
      subscribe: withFilter(
        () => pubsub.asyncIterator(['CONSORTIUM_LATEST_RUN_CHANGED']),
        async (
          payload: { consortiumId: string },
          variables: unknown,
          context: Context,
        ) => {
          const { userId } = context
          const { consortiumId } = payload

          // Check if the user is part of the consortium's active members
          const consortium = await Consortium.findById(consortiumId).lean()
          if (!consortium) {
            logger.error('Consortium not found')
            throw new Error('Consortium not found')
          }

          const isMember = consortium.members.some(
            (memberObjectId: any) => memberObjectId.toString() === userId,
          )

          return isMember
        },
      ),
    },

    consortiumDetailsChanged: {
      resolve: (): string => 'Consortium details changed',
      subscribe: withFilter(
        () => pubsub.asyncIterator(['CONSORTIUM_DETAILS_CHANGED']),
        async (
          payload: { consortiumId: string },
          variables: unknown,
          context: Context,
        ) => {
          const { userId } = context
          const { consortiumId } = payload

          // Check if the user is part of the consortium's active members
          const consortium = await Consortium.findById(consortiumId).lean()
          if (!consortium) {
            logger.error('Consortium not found')
            throw new Error('Consortium not found')
          }

          const isMember = consortium.members.some(
            (memberObjectId: any) => memberObjectId.toString() === userId,
          )

          return isMember
        },
      ),
    },

    runDetailsChanged: {
      resolve: (payload: { runId: string }): string => 'Run details changed',
      subscribe: withFilter(
        () => pubsub.asyncIterator(['RUN_DETAILS_CHANGED']),
        async (
          payload: { runId: string },
          variables: unknown,
          context: Context,
        ) => {
          const { userId } = context
          const { runId } = payload

          // Find the run by its ID
          const run = await Run.findById(runId).lean()
          if (!run) {
            logger.error('Run not found')
            throw new Error('Run not found')
          }

          // Check if the user is a member of the run's consortium
          const consortium = await Consortium.findById(run.consortium).lean()
          if (!consortium) {
            logger.error('Consortium not found')
            throw new Error('Consortium not found')
          }

          // Verify if the user is part of the consortium's members
          const isMember = consortium.members.some(
            (memberObjectId: any) => memberObjectId.toString() === userId,
          )

          return isMember
        },
      ),
    },
  },
}
