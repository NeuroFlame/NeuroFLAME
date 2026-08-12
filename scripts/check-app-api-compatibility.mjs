import { readFile } from 'node:fs/promises'

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const parse = (version, label) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) throw new Error(`${label} has invalid version ${version}`)
  return match.slice(1).map(Number)
}

const electronPackage = await readJson('desktopApp/electronApp/package.json')
const apiPackage = await readJson('centralApi/package.json')
const versionsSource = await readFile('centralApi/src/versions.ts', 'utf8')
const declaredApiVersion = /APPLICATION_API_VERSION = '([^']+)'/.exec(
  versionsSource,
)?.[1]

if (declaredApiVersion !== apiPackage.version) {
  throw new Error(
    `Central API package version ${apiPackage.version} does not match endpoint version ${declaredApiVersion}`,
  )
}

const [appMajor, appMinor] = parse(electronPackage.version, 'Electron app')
const [apiMajor, apiMinor] = parse(apiPackage.version, 'Central API')
if (appMajor !== apiMajor || appMinor !== apiMinor) {
  throw new Error(
    `Electron ${electronPackage.version} is incompatible with central API ${apiPackage.version}`,
  )
}

console.log(
  `Electron ${electronPackage.version} and central API ${apiPackage.version} are compatible`,
)
