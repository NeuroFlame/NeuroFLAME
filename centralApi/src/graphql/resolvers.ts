import { Document, Types } from 'mongoose'
import {
  generateTokens,
  compare,
  hashPassword,
} from '../authentication/authentication.js'
import getConfig from '../config/getConfig.js'
import Consortium from '../database/models/Consortium.js'
import Run, { IRun } from '../database/models/Run.js'
import User from '../database/models/User.js'
import Computation from '../database/models/Computation.js'
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
  LoginOutput,
  RunEventPayload,
  RunListItem,
  RunDetails,
} from './typeDefs.js'
import { logger } from '../logger.js'

interface Context {
  userId: string
  roles: string[]
  error: string
}

export default {
  Query: {
    getConsortiumList: async (): Promise<ConsortiumListItem[]> => {
      const consortiums = await Consortium.find()
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
        })),
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
    getConsortiumDetails: async (
      _: unknown,
      { consortiumId }: { consortiumId: string },
    ): Promise<ConsortiumDetails | null> => {
      try {
        const consortium = await Consortium.findById(consortiumId)
          .populate('leader', 'id username')
          .populate('members', 'id username')
          .populate('activeMembers', 'id username')
          .populate(
            'studyConfiguration.computation',
            'title imageName imageDownloadUrl notes owner',
          )
          .exec()

        if (!consortium) {
          throw new Error('Consortium not found')
        }

        const {
          _id: consortiumObjectId,
          title,
          description,
          leader,
          members,
          activeMembers,
          studyConfiguration: {
            consortiumLeaderNotes,
            computationParameters,
            computation,
          } = {},
        } = consortium

        const transformUser = (user: any): PublicUser => ({
          id: user.id,
          username: user.username,
        })

        return {
          id: consortiumObjectId.toString(),
          title,
          description,
          leader: leader ? transformUser(leader) : null,
          members: members ? members.map(transformUser) : [],
          activeMembers: activeMembers ? activeMembers.map(transformUser) : [],
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
                }
              : null,
          },
        }
      } catch (error) {
        logger.error('Error in getConsortiumDetails:', error)
        throw new Error(`Failed to fetch consortium details: ${error.message}`)
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
    }> => {
      try {
        const computation = await Computation.findById(computationId)
        if (!computation) {
          throw new Error('Computation not found')
        }

        const { title, imageName, imageDownloadUrl, notes, owner } = computation

        return {
          title,
          imageName,
          imageDownloadUrl,
          notes,
          owner,
        }
      } catch (error) {
        logger.error('Error in getComputationDetails:', error)
        throw new Error(`Failed to fetch computation details: ${error.message}`)
      }
    },
    getRunList: async (
      _: unknown,
      __: unknown,
      context: Context,
    ): Promise<RunListItem[]> => {
      const { userId } = context

      try {
        const runs = await Run.find({ members: userId })
          .populate('consortium', 'title')
          .populate('members', 'id username')
          .sort({ lastUpdated: -1 })
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
          .populate('consortium', 'title')
          .populate({
            path: 'members',
            select: 'id username',
            model: User,
          })
          .populate(
            'studyConfiguration.computation',
            'title imageName imageDownloadUrl notes owner',
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

        return {
          runId: run._id.toString(),
          consortiumId: run.consortium._id.toString(),
          consortiumTitle: run.consortium.title as string,
          status: run.status,
          lastUpdated: run.lastUpdated,
          members: run.members.map((member: any) => ({
            id: member._id.toString(),
            username: member.username,
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
            },
          },
        }
      } catch (e) {
        logger.error('Error fetching run details:', e)
        throw new Error('Failed to fetch run details')
      }
    },
  },
  Mutation: {
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
      const tokens = generateTokens({ userId: user._id })
      const { accessToken } = tokens as { accessToken: string }

      return {
        accessToken,
        userId: user._id.toString(),
        username: user.username,
        roles: user.roles,
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

      // create a new run in the database
      const run = await Run.create({
        consortium: consortium._id,
        consortiumLeader: consortium.leader,
        studyConfiguration: consortium.studyConfiguration,
        members: consortium.activeMembers,
        status: 'Provisioning',
        runErrors: [],
        lastUpdated: Date.now(),
      })

      pubsub.publish('RUN_START_CENTRAL', {
        runId: run._id.toString(),
        imageName: consortium.studyConfiguration.computation.imageName,
        userIds: consortium.activeMembers.map((member) => member.toString()),
        consortiumId: consortium._id.toString(),
        computationParameters:
          consortium.studyConfiguration.computationParameters,
      })

      pubsub.publish('RUN_EVENT', {
        consortiumId: consortium._id.toString(),
        consortiumTitle: consortium.title,
        runId: run._id.toString(),
        status: 'Provisioning',
        timestamp: Date.now(),
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
      const result = await Run.updateOne(
        { _id: runId },
        { status: 'Ready', lastUpdated: Date.now() },
      )
      const imageName = run.studyConfiguration.computation.imageName
      const consortiumId = run.consortium._id

      const consortium = await Consortium.findById(consortiumId)

      pubsub.publish('RUN_START_EDGE', {
        runId,
        imageName: imageName,
        consortiumId: consortiumId,
      })

      pubsub.publish('RUN_EVENT', {
        consortiumId: consortium._id.toString(),
        consortiumTitle: consortium.title,
        runId: run._id.toString(),
        status: 'Starting',
        timestamp: Date.now(),
      })

      return true
    },
    reportRunError: async (
      _: unknown,
      { runId, errorMessage }: { runId: string; errorMessage: string },
      context: Context,
    ): Promise<boolean> => {
      logger.info('reportRunError', runId)
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
      const result = await Run.updateOne(
        { _id: runId },
        { status: errorMessage, lastUpdated: Date.now() },
      )

      const consortium = await Consortium.findById(run.consortium._id)

      pubsub.publish('RUN_EVENT', {
        consortiumId: consortium._id.toString(),
        consortiumTitle: consortium.title,
        runId: run._id.toString(),
        status: 'Error',
        timestamp: Date.now(),
      })

      return true
    },
    reportRunComplete: async (
      _: unknown,
      { runId },
      context: Context,
    ): Promise<boolean> => {
      logger.info('reportRunError', runId)
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
      const result = await Run.updateOne(
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
      return true
    },
    reportRunStatus: async (
      _: unknown,
      { runId, statusMessage }: { runId: string; statusMessage: string },
    ): Promise<boolean> => {
      return true
    },
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

        // Set the computation in the study configuration
        consortium.set('studyConfiguration.computation', computation)
        await consortium.save()

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
          const parametersJson = JSON.parse(parameters)
        } catch (e) {
          throw new Error(`failed to parse parameters into JSON ${e}`)
        }

        // Set the computation in the study configuration
        consortium.set('studyConfiguration.computationParameters', parameters)
        await consortium.save()

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

        return true
      } catch (error) {
        logger.error('Error in setStudyNotes:', error)
        throw new Error(`Failed to set computation: ${error.message}`)
      }
    },
    consortiumCreate: async (
      _: unknown,
      { title, description }: { title: string; description: string },
      context: Context,
    ): Promise<any> => {
      if (!title || !description) {
        throw new Error('Title and description are required')
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
        studyConfiguration: {
          consortiumLeaderNotes: '',
          computationParameters: '',
          computation: null,
        },
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
      }: {
        title: string
        imageName: string
        imageDownloadUrl: string
        notes: string
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
      }: {
        computationId: string
        title?: string
        imageName?: string
        imageDownloadUrl?: string
        notes?: string
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
      const updatePayload: { [key: string]: string } = {}
      if (title) updatePayload.title = title
      if (imageName) updatePayload.imageName = imageName
      if (imageDownloadUrl) updatePayload.imageDownloadUrl = imageDownloadUrl
      if (notes) updatePayload.notes = notes

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
      }: { consortiumId: string; title?: string; description?: string },
      context: Context,
    ): Promise<boolean> => {
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
      if (!title && !description) {
        throw new Error('No fields provided to update')
      }

      // Prepare the update payload
      const updatePayload: { [key: string]: string } = {}
      if (title) updatePayload.title = title
      if (description) updatePayload.description = description

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
      const { userId } = context
      if (!userId) {
        throw new Error('User not authenticated')
      }
      await Consortium.findByIdAndUpdate(consortiumId, {
        $addToSet: { members: userId, activeMembers: userId },
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
        $pull: { members: userId, activeMembers: userId },
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
        await consortium.updateOne({
          [active ? '$addToSet' : '$pull']: { activeMembers: userId },
        })
        return true
      } catch (error) {
        logger.error('Error updating consortium active members:', error)
        throw new Error('Failed to update consortium active members')
      }
    },
    userCreate: async (
      _: unknown,
      { username, password }: { username: string; password: string },
    ): Promise<LoginOutput> => {
      try {
        const existingUser = await User.findOne({ username })
        if (existingUser) {
          throw new Error('User already exists')
        }

        const hashedPassword = await hashPassword(password)
        const user = await User.create({
          username,
          hash: hashedPassword,
        })

        const tokens = generateTokens({ userId: user._id })
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
  },

  Subscription: {
    runStartCentral: {
      resolve: (payload: RunStartCentralPayload): RunStartCentralPayload => {
        return payload
      },
      subscribe: withFilter(
        () => pubsub.asyncIterator(['RUN_START_CENTRAL']),
        // Placeholder for future filtering logic. Currently returns true for all payloads.
        (
          payload: RunStartCentralPayload,
          variables: unknown,
          context: Context,
        ) => {
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
        const { runId, imageName, consortiumId } = payload
        // get the user's id from the context
        const userId = context.userId
        // create a token
        const tokens = generateTokens(
          { userId, runId, consortiumId },
          { shouldExpire: true },
        )

        const { accessToken } = tokens as { accessToken: string }

        const { fileServerUrl } = await getConfig()

        const output = {
          userId,
          runId,
          imageName,
          consortiumId,
          downloadUrl: `${fileServerUrl}/download/${consortiumId}/${runId}/${userId}`,
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
            (memberObjectId: any) => {
              return memberObjectId.toString() === userId
            },
          )

          return isActiveMember
        },
      ),
    },
    runEvent: {
      resolve: (payload: RunEventPayload): RunEventPayload => {
        return payload
      },
      subscribe: withFilter(
        () => pubsub.asyncIterator(['RUN_EVENT']),
        async (
          payload: RunEventPayload,
          variables: unknown,
          context: Context,
        ) => {
          logger.info(`Run event emitted`, { payload, context })

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
            (memberObjectId: any) => {
              return memberObjectId.toString()
            },
          )
          const isActiveMember = activeMemberIds.includes(userId)

          logger.info(`Emitting a run event to userId: ${userId}`, )
          return isActiveMember
        },
      ),
    },
  },
}
