import { Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
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

const walkDirectory = (dirPath: string, baseUrl: string): FileInfo[] => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let results: FileInfo[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(dirPath, fullPath);
    const stat = fs.statSync(fullPath);

    const fileInfo: FileInfo = {
      name: entry.name,
      path: fullPath,
      size: stat.size,
      isDirectory: entry.isDirectory(),
      lastModified: stat.mtime,
      url: path.join(baseUrl, entry.name).replace(/\\/g, '/'), // Windows compatibility
    };

    results.push(fileInfo);

    if (entry.isDirectory()) {
      const subResults = walkDirectory(fullPath, fileInfo.url);
      results = results.concat(subResults);
    }
  }

  return results;
};

export const listRunFiles = async (req: Request, res: Response) => {
  try {
    const { path_base_directory: filesDirectory } = await getConfig();
    const { consortiumId, runId } = req.params;
    const directoryPath = path.join(filesDirectory, consortiumId, runId, 'results');

    if (!fs.existsSync(directoryPath)) {
      logger.warn(`Directory not found: ${directoryPath}`);
      return res.status(404).json({ error: 'Run directory not found' });
    }

    const baseUrl = `${consortiumId}/${runId}`;
    const fileList = walkDirectory(directoryPath, baseUrl);

    res.json(fileList);
  } catch (error) {
    logger.error(`Error in listRunFiles: ${(error as Error).message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const serveRunFile = async (req: Request, res: Response) => {
  try {
    const { path_base_directory: filesDirectory } = await getConfig();
    const { consortiumId, runId } = req.params;
    const filePathParam = req.params[0]; // captures the wildcard route

    const baseDirectory = path.join(filesDirectory, consortiumId, runId, 'results');
    const filePath = path.join(baseDirectory, filePathParam);
    const resolvedBase = path.resolve(baseDirectory);
    const resolvedFile = path.resolve(filePath);
    const currentFileName = path.basename(resolvedFile); // e.g., "some_report.html"

    // Prevent directory traversal attacks
    if (!resolvedFile.startsWith(resolvedBase)) {
      logger.warn(`Attempt to access unauthorized path: ${resolvedFile}`);
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    if (resolvedFile.endsWith('.html')) {
      let contents = fs.readFileSync(resolvedFile, 'utf8');
    
      // Inject <base href="./"> if not present
      if (!contents.includes('<base')) {
        contents = contents.replace('<head>', `<head><base href="./">`);
      }

      // Append x-access-token to all img src attributes
      const token = req.query['x-access-token'];

      if (token) {
        contents = contents.replace(
          /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*?>/gi,
          (match, src) => {
            // Don't double-append token
            const hasToken = src.includes('x-access-token=');
            const connector = src.includes('?') ? '&' : '?';
            const newSrc = hasToken ? src : `${src}${connector}x-access-token=${token}`;
            return match.replace(src, newSrc);
          }
        );

        contents = contents.replace(
          /<a\s+[^>]*?href\s*=\s*["']#([^"']+)["']/gi,
          (match, anchor) => {
            const hasToken = currentFileName.includes('x-access-token=');
            const connector = currentFileName.includes('?') ? '&' : '?';
            const tokenizedHref = hasToken || !token
              ? `${currentFileName}#${anchor}`
              : `${currentFileName}${connector}x-access-token=${token}#${anchor}`;
        
            return match.replace(`#${anchor}`, tokenizedHref);
          }
        );

        // Optional: Append token to other assets like CSS/JS
        contents = contents.replace(
          /<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*?>/gi,
          (match, href) => {
            if (
              href.startsWith('mailto:') ||
              href.startsWith('tel:')
            ) {
              return match; // Leave anchors, mailto, tel alone
            }
        
            if (!href.endsWith('.html')) {
              return match; // Only rewrite .html links
            }
        
            const hasToken = href.includes('x-access-token=');
            const connector = href.includes('?') ? '&' : '?';
            const newHref = hasToken ? href : `${href}${connector}x-access-token=${token}`;
        
            return match.replace(href, newHref);
          }
        );
      }
    
      res.setHeader('Content-Type', 'text/html');
      return res.send(contents);
    }    

    if (fs.existsSync(resolvedFile) && fs.lstatSync(resolvedFile).isFile()) {
      res.sendFile(resolvedFile);
    } else {
      logger.warn(`File not found: ${resolvedFile}`);
      res.status(404).send('File not found');
    }
  } catch (error) {
    logger.error(`Error in serveRunFile: ${(error as Error).message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};