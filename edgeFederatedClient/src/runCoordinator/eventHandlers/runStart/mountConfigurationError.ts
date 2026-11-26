export const mountConfigurationErrorMessage = (error: unknown): string => {
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
    return 'No data directory selected for this consortium in this client. ' +
      'Select and save a Data Directory, then start a new run.'
  }

  return 'Could not read the saved data directory selection for this consortium in this client. ' +
    'Select and save a Data Directory again, then start a new run.'
}
