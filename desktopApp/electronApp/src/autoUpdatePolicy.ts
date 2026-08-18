export type AutoUpdateEligibility =
  | { enabled: true }
  | {
    enabled: false
    reason: 'development' | 'linux-not-appimage' | 'unsupported-platform'
  }

export function autoUpdateEligibility(
  isPackaged: boolean,
  platform: NodeJS.Platform,
  appImagePath?: string,
): AutoUpdateEligibility {
  if (!isPackaged) {
    return { enabled: false, reason: 'development' }
  }

  if (platform === 'linux' && !appImagePath) {
    return { enabled: false, reason: 'linux-not-appimage' }
  }

  if (!['darwin', 'linux', 'win32'].includes(platform)) {
    return { enabled: false, reason: 'unsupported-platform' }
  }

  return { enabled: true }
}
