export interface InviteInfo {
  consortiumName: string
  leaderName: string
  isExpired: boolean
}

export interface GetInviteInfo {
  getInviteInfo: InviteInfo
}

export interface GetInviteInfoArgs {
  inviteToken: string
}

export type LogInInfo = {
  accessToken: string
  userId: string
  username: string
  roles: string[]
}

export type UserProfile = {
  userId: string
  username: string
  roles: string[]
}
