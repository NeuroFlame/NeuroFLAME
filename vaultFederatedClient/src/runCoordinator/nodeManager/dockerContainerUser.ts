export function dockerContainerUser(
  platform: NodeJS.Platform,
  uid: number | undefined,
  gid: number | undefined,
): string | undefined {
  if (platform === 'win32' || uid === undefined || gid === undefined) {
    return undefined
  }
  return `${uid}:${gid}`
}
