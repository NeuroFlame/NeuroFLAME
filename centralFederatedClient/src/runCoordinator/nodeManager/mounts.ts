import path from 'path'
import type Docker from 'dockerode'

export interface DirectoryMount {
  hostDirectory: string
  containerDirectory: string
  readOnly?: boolean
}

const assertAbsolute = (mount: DirectoryMount): void => {
  if (!path.isAbsolute(mount.hostDirectory) || !path.posix.isAbsolute(mount.containerDirectory)) {
    throw new Error('Mount paths must be absolute')
  }
}

// Structured mounts carry each path as its own field, so no character in a
// host path can change which directories are mounted or how.
export const dockerMounts = (mounts: DirectoryMount[]): Docker.MountSettings[] =>
  mounts.map((mount) => {
    assertAbsolute(mount)
    return {
      Type: 'bind',
      Source: mount.hostDirectory,
      Target: mount.containerDirectory,
      ReadOnly: mount.readOnly === true,
    }
  })

// Singularity bind specs split on ',' and ':' with no escaping, so a path
// containing either could become an extra, writable bind. Refuse those paths.
const UNSAFE_BIND_PATH = /[,:\0\r\n]/

export const singularityBindArgs = (mounts: DirectoryMount[]): string[] =>
  mounts.flatMap((mount) => {
    assertAbsolute(mount)
    if (UNSAFE_BIND_PATH.test(mount.hostDirectory) || UNSAFE_BIND_PATH.test(mount.containerDirectory)) {
      throw new Error('Singularity cannot mount a path containing "," or ":"')
    }
    return [
      '--bind',
      `${mount.hostDirectory}:${mount.containerDirectory}:${mount.readOnly ? 'ro' : 'rw'}`,
    ]
  })
