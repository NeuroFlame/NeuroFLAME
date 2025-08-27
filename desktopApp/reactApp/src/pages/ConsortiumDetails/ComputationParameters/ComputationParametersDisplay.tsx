interface ComputationParametersDisplayProps {
  computationParameters: string;
}

export default function ComputationParametersDisplay({ computationParameters }: ComputationParametersDisplayProps) {
  let formattedJson: string

  try {
    // Parse and format the JSON for better readability
    const jsonObject = JSON.parse(computationParameters)
    formattedJson = JSON.stringify(jsonObject, null, 2) // Pretty-print JSON
  } catch (error) {
    formattedJson = 'Invalid JSON format'
  }

  return (
    <div>
      <pre className='settings' style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
        {computationParameters
          ? formattedJson
          : 'Please provide settings that coorespond to your selected Computation. Refer to Computation Notes for Example Settings.'}
      </pre>
    </div>
  )
}
