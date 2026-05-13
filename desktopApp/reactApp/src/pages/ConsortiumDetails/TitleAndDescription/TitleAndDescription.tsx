import { Typography, Box } from '@mui/material'

export function TitleAndDescription({
  title,
  description,
}: { title: string, description: string }) {
  return (
    <Box>
      <Typography fontSize='11px' margin={0}>Consortium:</Typography>
      <Typography variant='h4'>
        {title}
      </Typography>
      <Typography variant='body1' color='textSecondary'>
        {description}
      </Typography>
    </Box>
  )
}
