import { gql } from '@apollo/client'

export const GET_USER_PROFILE = gql`
  query getUserProfile {
    getUserProfile {
      userId
      username
      roles
    }
  }
`

export const GET_INVITE_INFO_QUERY = gql`
  query getInviteInfo($inviteToken: String!) {
    getInviteInfo(inviteToken: $inviteToken) {
      consortiumName
      leaderName
      isExpired
    }
  }
`
