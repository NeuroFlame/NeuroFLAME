import * as unzipper from 'unzipper';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { logger } from '../../../logger.js';

const readdir = promisify(fs.readdir);
const chmod = promisify(fs.chmod);
const stat = promisify(fs.stat);

type UnzipFileParams = {
  directory: string;
  fileName: string;
};

async function setPermissions(dir: string, mode: number): Promise<void> {
  const files = await readdir(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const fileStat = await stat(filePath);

    if (fileStat.isDirectory()) {
      await setPermissions(filePath, mode);
    } else {
      await chmod(filePath, mode);
    }
  }
}

export async function unzipFile({ directory, fileName }: UnzipFileParams): Promise<void> {
  const zipPath = path.join(directory, fileName);

  try {
    const fileStat = await stat(zipPath);

    if (fileStat.size === 0) {
      throw new Error(`File ${zipPath} is empty.`);
    }
  } catch (err) {
    logger.error(`Error accessing file ${zipPath}: ${(err as Error).message}`);
    throw err;
  }

  logger.info(`Starting to unzip file: ${zipPath}`);

  try {
    await fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: directory })).promise();
    logger.info(`Successfully unzipped file: ${zipPath}`);
  } catch (err) {
    logger.error(`Error unzipping file ${zipPath}: ${(err as Error).message}`);
    throw err;
  }

  try {
    await setPermissions(directory, 0o777);
    logger.info(`Permissions set to 0o777 for all extracted files in: ${directory}`);
  } catch (err) {
    logger.error(`Error setting file permissions: ${(err as Error).message}`);
    throw err;
  }
}
