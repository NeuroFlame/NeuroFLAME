import { Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import archiver from 'archiver'
import { getConfig } from '../../config/config.js'
import { logger } from '../../logger.js'

interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  lastModified: Date;
  url: string;
}

const walkDirectory = (
  dirPath: string,
  baseUrl: string,
  rootPath: string,
): FileInfo[] => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  let results: FileInfo[] = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    const stat = fs.statSync(fullPath)
    const relativePath = path.relative(rootPath, fullPath) // key fix here

    const fileInfo: FileInfo = {
      name: entry.name,
      path: fullPath,
      size: stat.size,
      isDirectory: entry.isDirectory(),
      lastModified: stat.mtime,
      url: path.join(baseUrl, relativePath).replace(/\\/g, '/'), // consistent relative path
    }

    results.push(fileInfo)

    if (entry.isDirectory()) {
      const subResults = walkDirectory(fullPath, baseUrl, rootPath)
      results = results.concat(subResults)
    }
  }

  return results
}

export const listRunFiles = async (req: Request, res: Response) => {
  try {
    const { pathBaseDirectory: filesDirectory } = await getConfig()
    const { consortiumId, runId } = req.params
    const directoryPath = path.join(filesDirectory, consortiumId, runId, 'results')

    if (!fs.existsSync(directoryPath)) {
      logger.warn(`Directory not found: ${directoryPath}`)
      return res.status(404).json({ error: 'Run directory not found' })
    }

    const baseUrl = `${consortiumId}/${runId}`
    const rootPath = directoryPath
    const fileList = walkDirectory(directoryPath, baseUrl, rootPath)

    res.json(fileList)
  } catch (error) {
    logger.error(`Error in listRunFiles: ${(error as Error).message}`)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}

export const serveRunFile = async (req: Request, res: Response) => {
  try {
    const { pathBaseDirectory: filesDirectory } = await getConfig()
    const { consortiumId, runId } = req.params
    const filePathParam = req.params[0] // catch-all route segment

    const baseDirectory = path.join(filesDirectory, consortiumId, runId, 'results')
    const resolvedBase = path.resolve(baseDirectory)
    const resolvedFile = path.resolve(baseDirectory, filePathParam)
    const currentFileName = path.basename(resolvedFile)

    // Ensure path is within allowed directory
    if (!resolvedFile.startsWith(resolvedBase)) {
      logger.warn(`Unauthorized path access attempt: ${resolvedFile}`)
      return res.status(403).json({ error: 'Unauthorized access' })
    }

    // Fail fast if it doesn't exist
    if (!fs.existsSync(resolvedFile)) {
      logger.warn(`File not found: ${resolvedFile}`)
      return res.status(404).send('File not found')
    }

    const stat = fs.lstatSync(resolvedFile)

    // ✅ Handle directories
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(resolvedFile, { withFileTypes: true })

      const directoryContents: FileInfo[] = entries.map((entry) => {
        const entryPath = path.join(resolvedFile, entry.name)
        const entryStat = fs.statSync(entryPath)
        const relativeUrl = path.relative(
          path.join(filesDirectory, consortiumId, runId, 'results'),
          entryPath,
        )

        return {
          name: entry.name,
          path: entryPath,
          size: entryStat.size,
          isDirectory: entry.isDirectory(),
          lastModified: entryStat.mtime,
          url: `${consortiumId}/${runId}/${relativeUrl}`.replace(/\\/g, '/'),
        }
      })

      return res.json(directoryContents)
    }

    // ✅ Handle .html files
    if (stat.isFile() && resolvedFile.endsWith('.html')) {
      let contents = fs.readFileSync(resolvedFile, 'utf8')

      if (!contents.includes('<base')) {
        contents = contents.replace('<head>', '<head><base href="./">')
      }

      const token = req.query['x-access-token']
      if (token) {
        contents = contents.replace(
          /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*?>/gi,
          (match, src) => {
            const hasToken = src.includes('x-access-token=')
            const connector = src.includes('?') ? '&' : '?'
            return match.replace(src, hasToken ? src : `${src}${connector}x-access-token=${token}`)
          },
        )

        contents = contents.replace(
          /<a\s+[^>]*?href\s*=\s*["']#([^"']+)["']/gi,
          (match, anchor) => {
            const connector = currentFileName.includes('?') ? '&' : '?'
            return match.replace(`#${anchor}`, `${currentFileName}${connector}x-access-token=${token}#${anchor}`)
          },
        )

        contents = contents.replace(
          /<a\b[^>]*?\bhref\s*=\s*["']([^"']+\.html)["'][^>]*?>/gi,
          (match, href) => {
            if (href.startsWith('mailto:') || href.startsWith('tel:')) return match
            const connector = href.includes('?') ? '&' : '?'
            return match.replace(href, `${href}${connector}x-access-token=${token}`)
          },
        )
      }

      res.setHeader('Content-Type', 'text/html')
      return res.send(contents)
    }

    // ✅ Serve other files
    if (stat.isFile()) {
      return res.sendFile(resolvedFile)
    }

    logger.warn(`Unsupported file type at path: ${resolvedFile}`)
    return res.status(400).send('Unsupported file type')
  } catch (error) {
    logger.error(`Error in serveRunFile: ${(error as Error).message}`)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

export const serveRunFolder = async (req: Request, res: Response) => {
  try {
    const { pathBaseDirectory: filesDirectory } = await getConfig()
    const { consortiumId, runId } = req.params
    const directoryPath = path.join(filesDirectory, consortiumId, runId, 'results')

    if (!fs.existsSync(directoryPath)) {
      logger.warn(`Directory not found: ${directoryPath}`)
      return res.status(404).json({ error: 'Run directory not found' })
    }
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename=${runId}_results.zip`)

    const archive = archiver('zip', {
      zlib: { level: 9 },
    })

    archive.on('error', (err) => {
      logger.error(`Archive error: ${err.message}`)
      res.status(500).end()
    })

    archive.pipe(res)
    archive.directory(directoryPath, false)
    archive.finalize()
  } catch (error) {
    logger.error(`Error in serveRunFolder: ${(error as Error).message}`)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}
