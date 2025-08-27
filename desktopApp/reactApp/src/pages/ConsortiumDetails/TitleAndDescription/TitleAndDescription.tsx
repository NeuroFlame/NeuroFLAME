import { Typography, Box } from '@mui/material'

export function TitleAndDescription({ title, description }: { title: string, description: string }) {
  return (
    <Box marginBottom={2}>
      <Typography fontSize='11px'>Consortium:</Typography>
      <Typography variant='h4' gutterBottom>
        {title}
      </Typography>
      <Typography variant='body1' color='textSecondary'>
        {description}
      </Typography>
    </Box>
  )
}
