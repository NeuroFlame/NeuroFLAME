import { requireSession } from '../session.js'
import { gqlRequest } from '../graphqlClient.js'
import { GET_USER_PROFILE_QUERY, UserProfile } from '../graphql/operations.js'

interface ProfileData {
  getUserProfile: UserProfile
}

export async function whoamiCommand(): Promise<void> {
  const session = await requireSession()
  const data = await gqlRequest<ProfileData>(
    session.httpUrl,
    GET_USER_PROFILE_QUERY,
    {},
    session.accessToken,
  )
  console.log(JSON.stringify(data.getUserProfile, null, 2))
  console.log(`Server: ${session.httpUrl}`)
}
