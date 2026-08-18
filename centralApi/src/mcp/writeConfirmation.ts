import { createHash } from 'crypto'
import { ElicitResultSchema } from '@modelcontextprotocol/sdk/types.js'

type ToolExtra = { sendRequest: Function; signal?: AbortSignal }

const MAX_PREVIEW_VALUE_CHARACTERS = 2_000
const EXCLUDED_PREVIEW_KEYS = /(?:password|secret|token)$/i

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    )
  }
  return value
}

export function writeOperationHash(toolName: string, args: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify({ toolName, args: stableValue(args) }))
    .digest('hex')
}

export interface WritePreviewField {
  label: string
  value: string
}

const previewValue = (value: unknown): Pick<WritePreviewField, 'value'> => {
  const serialized = typeof value === 'string'
    ? value
    : JSON.stringify(stableValue(value), null, 2)
  if (serialized.length <= MAX_PREVIEW_VALUE_CHARACTERS) return { value: serialized }
  const digest = createHash('sha256').update(serialized).digest('hex')
  return {
    value: `${serialized.slice(0, MAX_PREVIEW_VALUE_CHARACTERS)}\n` +
      `[truncated preview: ${serialized.length} characters; full-value SHA-256: ${digest}]`,
  }
}

export function buildWritePreview(
  toolName: string,
  args: unknown,
): WritePreviewField[] {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return []
  const values: Record<string, unknown> = { ...(args as Record<string, unknown>) }
  if (toolName === 'create_consortium') {
    if (!Object.hasOwn(values, 'description')) values.description = '(not provided)'
    if (!Object.hasOwn(values, 'isPrivate')) values.isPrivate = false
  }
  return Object.entries(values)
    .filter(([key]) => !EXCLUDED_PREVIEW_KEYS.test(key))
    .map(([label, value]) => ({ label, ...previewValue(value) }))
}

export function buildWriteConfirmationMessage({
  toolName,
  args,
  summary,
  preview,
}: {
  toolName: string
  args: unknown
  summary: string
  preview: WritePreviewField[]
}): string {
  const values = preview.length > 0
    ? preview.map(({ label, value }) => `${label}:\n${value}`).join('\n\n')
    : '(No non-secret argument values are available for display.)'
  return [
    'NeuroFLAME write confirmation',
    summary,
    `Tool: ${toolName}`,
    `Exact operation fingerprint: ${writeOperationHash(toolName, args)}`,
    'Review these values:',
    values,
    'Approve only if this is the operation you asked the agent to perform.',
  ].join('\n\n')
}

export async function authorizeWrite(
  extra: ToolExtra,
  message: string,
): Promise<boolean> {
  if (extra.signal?.aborted) return false
  try {
    const result = await extra.sendRequest({
      method: 'elicitation/create',
      params: {
        mode: 'form',
        message,
        requestedSchema: {
          type: 'object',
          properties: {
            confirm: {
              type: 'boolean',
              title: 'Approve this exact NeuroFLAME operation',
              description: 'Select true only after reviewing the operation above.',
              default: false,
            },
          },
          required: ['confirm'],
        },
      },
    }, ElicitResultSchema, { signal: extra.signal })
    return !extra.signal?.aborted &&
      result.action === 'accept' &&
      result.content?.confirm === true
  } catch {
    return false
  }
}
