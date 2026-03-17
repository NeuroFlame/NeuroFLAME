import { gql } from '@apollo/client'

export const LOGIN_MUTATION = gql`
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      accessToken
      userId
      username
      roles
    }
  }
`

export const SIGNUP_MUTATION = gql`
  mutation UserCreate($username: String!, $password: String!) {
    userCreate(username: $username, password: $password) {
      accessToken
      userId
      username
      roles
    }
  }
`

export const CONSORTIUM_JOIN_BY_INVITE_MUTATION = gql`
  mutation ConsortiumJoinByInvite($inviteToken: String!) {
    consortiumJoinByInvite(inviteToken: $inviteToken)
  }
`
