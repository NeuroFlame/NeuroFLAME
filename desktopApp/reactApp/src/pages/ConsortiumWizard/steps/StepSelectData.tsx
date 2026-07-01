import { Box } from '@mui/material'
import DirectorySelect from '../../ConsortiumDetails/DirectorySelect/DirectorySelect'

export default function StepSelectData({ onDirectorySet }: { onDirectorySet?: (isSet: boolean) => void }) {
  return (
    <Box
      style={{
        maxWidth: '400px',
        border: '1px solid #eee',
      }}
    >
      <DirectorySelect showReadyToggle={false} onDirectorySet={onDirectorySet} />
    </Box>
  )
}
