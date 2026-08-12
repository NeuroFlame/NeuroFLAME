import axios from 'axios'

export const SHARED_SITE_FAILURE_MESSAGE =
  'Site computation failed. Detailed error is available only to that participant.'

export interface LocalComputationError {
  origin?: string;
  stage?: string;
  scope?: string;
  errorType?: string;
  message: string;
}

interface GetLocalComputationErrorArgs {
  edgeClientRunResultsUrl: string;
  consortiumId: string;
  runId: string;
  participantId: string;
}

export const getLocalComputationError = async ({
  edgeClientRunResultsUrl,
  consortiumId,
  runId,
  participantId,
}: GetLocalComputationErrorArgs): Promise<LocalComputationError | null> => {
  const path = [consortiumId, runId, participantId]
    .map(encodeURIComponent)
    .join('/')
  const response = await axios.get<LocalComputationError>(
    `${edgeClientRunResultsUrl}/error/${path}`,
    { validateStatus: (status) => status === 200 || status === 404 },
  )

  return response.status === 200 ? response.data : null
}
