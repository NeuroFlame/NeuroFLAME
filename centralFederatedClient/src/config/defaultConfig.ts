export default {
  httpUrl: 'http://localhost:4000/graphql',
  wsUrl: 'ws://localhost:4000/graphql',
  accessToken:
    // eslint-disable-next-line @stylistic/max-len
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NjI4OWM3OWFlYmFiNjcwNDBhMjAwNjciLCJyb2xlcyI6WyJjZW50cmFsIl0sImlhdCI6MTcxMzkzODM5Mn0.xtJwKGbAK5veZIcxlFBXbLM2-oT2h6MJkf-D1JllybM',
  userId: 'central',
  fileServerUrl: 'http://localhost:4002',
  baseDir:
    '/tmp/neuroflame/_devTestDirectories/centralFederatedClientDir',
  FQDN: 'host.docker.internal',
  hostingPortRange: {
    start: 3000,
    end: 3099,
  },
}
