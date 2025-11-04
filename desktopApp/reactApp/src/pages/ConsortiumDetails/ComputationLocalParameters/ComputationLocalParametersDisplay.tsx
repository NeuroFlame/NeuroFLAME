interface ComputationLocalParametersDisplayProps {
  ComputationLocalParameters: string;
}

export default function ComputationLocalParametersDisplay({
  ComputationLocalParameters,
}: ComputationLocalParametersDisplayProps) {
  let formattedJson: string

  try {
    // Parse and format the JSON for better readability
    const jsonObject = JSON.parse(ComputationLocalParameters)
    formattedJson = JSON.stringify(jsonObject, null, 2) // Pretty-print JSON
  } catch (error) {
    formattedJson = 'Invalid JSON format'
  }

  return (
    <div>
      <pre
        className='settings'
        style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}
      >
        {ComputationLocalParameters
          ? formattedJson
          // eslint-disable-next-line @stylistic/max-len
          : 'Please provide Local Settings that coorespond to this computation in relation to your data set. Refer to Computation Notes for Example Settings.'}
      </pre>
    </div>
  )
}
