// Consortium, run and participant IDs are MongoDB ObjectIds. Accept nothing else
// before joining them into local filesystem paths.
const RUN_PATH_SEGMENT = /^[a-f0-9]{24}$/i

export const isRunPathSegment = (value: unknown): value is string =>
  typeof value === 'string' && RUN_PATH_SEGMENT.test(value)
