import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// Path to the GraphQL typeDefs file
const typeDefsPath = join(process.cwd(), 'src/graphql/typeDefs.graphql')
// Path to the output TypeScript file
const outputTsPath = join(process.cwd(), 'src/graphql/generated/typeDefs.ts')

// Read the typeDefs.graphql file
const typeDefsContent = readFileSync(typeDefsPath, 'utf-8')

// Generate the TypeScript content
const tsContent = `export const typeDefs = \`${typeDefsContent}\`;\n`

// Write the content to typeDefs.ts
writeFileSync(outputTsPath, tsContent, 'utf-8')

console.log('Converted typeDefs.graphql to typeDefs.ts')
