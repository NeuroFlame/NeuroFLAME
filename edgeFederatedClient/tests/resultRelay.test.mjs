import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import fs, { mkdtemp, mkdir, realpath, rename, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { promisify } from 'node:util'
import {
  htmlToInactiveText,
  isResultRelayRequestForUser,
  resolveSafeEntry,
  serializeDerivativeResult,
  validateResultRoot,
} from '../dist/runCoordinator/resultRelay.js'

const execFileAsync = promisify(execFile)

describe('MCP derivative result filesystem boundary', () => {
  it('resolves an ordinary file under the result root', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'neuroflame-result-'))
    await writeFile(path.join(root, 'summary.csv'), 'metric,value\nscore,1')
    assert.equal(await resolveSafeEntry(root, 'summary.csv'), await realpath(path.join(root, 'summary.csv')))
  })

  it('rejects traversal, private logs, and symlink escapes', async () => {
    const base = await mkdtemp(path.join(tmpdir(), 'neuroflame-result-'))
    const root = path.join(base, 'results')
    await mkdir(root)
    await writeFile(path.join(base, 'outside.txt'), 'private')
    await writeFile(path.join(root, 'failed-container.log'), 'private')
    await symlink(path.join(base, 'outside.txt'), path.join(root, 'escape.txt'))

    await assert.rejects(resolveSafeEntry(root, '../outside.txt'))
    await assert.rejects(resolveSafeEntry(root, 'failed-container.log'))
    await assert.rejects(resolveSafeEntry(root, 'escape.txt'))
  })

  it('rejects a supported-extension FIFO promptly without a writer', {
    skip: process.platform === 'win32',
  }, async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'neuroflame-result-'))
    await execFileAsync('mkfifo', [path.join(root, 'summary.txt')])
    const moduleUrl = new URL('../dist/runCoordinator/resultRelay.js', import.meta.url).href
    const probe = `
      import { serializeDerivativeResult } from ${JSON.stringify(moduleUrl)};
      try {
        await serializeDerivativeResult(${JSON.stringify(root)}, {
          operation: 'read', relativePath: 'summary.txt'
        });
      } catch (error) {
        if (String(error).includes('not a regular file')) process.exit(0);
        throw error;
      }
      throw new Error('FIFO was accepted as a derivative result');
    `
    await execFileAsync(process.execPath, ['--input-type=module', '--eval', probe], {
      timeout: 2_000,
    })
  })

  it('rejects intermediate and result-root symlinks', async () => {
    const base = await mkdtemp(path.join(tmpdir(), 'neuroflame-result-'))
    const privateDirectory = path.join(base, '.private')
    const root = path.join(base, 'results')
    await mkdir(privateDirectory)
    await mkdir(root)
    await writeFile(path.join(privateDirectory, 'diagnostic.txt'), 'private')
    await symlink(privateDirectory, path.join(root, 'public'))
    await assert.rejects(resolveSafeEntry(root, 'public/diagnostic.txt'))

    const linkedRoot = path.join(base, 'linked-results')
    await symlink(root, linkedRoot)
    await assert.rejects(validateResultRoot(base, linkedRoot))
  })

  it('rejects result-root replacement after ownership validation', async () => {
    const base = await mkdtemp(path.join(tmpdir(), 'neuroflame-result-'))
    const root = path.join(base, 'consortium', 'run', 'user', 'results')
    await mkdir(root, { recursive: true })
    await writeFile(path.join(root, 'summary.txt'), 'original')
    const validated = await validateResultRoot(base, root)
    await rename(root, `${root}-original`)
    await mkdir(root)
    await writeFile(path.join(root, 'summary.txt'), 'replacement')
    await assert.rejects(serializeDerivativeResult(validated, {
      operation: 'read', relativePath: 'summary.txt',
    }), /root changed/)
  })

  it('rejects an intermediate directory replaced by an in-root private symlink', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'neuroflame-result-'))
    await mkdir(path.join(root, 'public'))
    await mkdir(path.join(root, '.private'))
    await writeFile(path.join(root, 'public', 'summary.txt'), 'public')
    await writeFile(path.join(root, '.private', 'summary.txt'), 'private')
    await rename(path.join(root, 'public'), path.join(root, 'public-original'))
    await symlink(path.join(root, '.private'), path.join(root, 'public'))
    await assert.rejects(serializeDerivativeResult(root, {
      operation: 'read', relativePath: 'public/summary.txt',
    }))
    const listed = await serializeDerivativeResult(root, { operation: 'list' })
    assert.doesNotMatch(listed.blocks[0].text, /private|public\/summary/)
  })

  it('rejects a deterministic intermediate swap between directory binding and file open', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'neuroflame-result-'))
    const publicDirectory = path.join(root, 'public')
    const privateDirectory = path.join(root, '.private')
    const target = path.join(publicDirectory, 'summary.txt')
    await mkdir(publicDirectory)
    await mkdir(privateDirectory)
    await writeFile(target, 'public')
    await writeFile(path.join(privateDirectory, 'summary.txt'), 'private')

    const originalOpen = fs.open
    let releaseOpen
    let reachedOpen
    const openGate = new Promise((resolve) => { releaseOpen = resolve })
    const openReached = new Promise((resolve) => { reachedOpen = resolve })
    fs.open = async (candidate, ...args) => {
      if (candidate === target) {
        reachedOpen()
        await openGate
      }
      return originalOpen.call(fs, candidate, ...args)
    }
    try {
      const serialization = serializeDerivativeResult(root, {
        operation: 'read', relativePath: 'public/summary.txt',
      })
      await openReached
      await rename(publicDirectory, `${publicDirectory}-original`)
      await symlink(privateDirectory, publicDirectory)
      releaseOpen()
      await assert.rejects(serialization)
    } finally {
      releaseOpen()
      fs.open = originalOpen
    }
  })

  it('rejects a deterministic intermediate swap during directory listing', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'neuroflame-result-'))
    const publicDirectory = path.join(root, 'public')
    const privateDirectory = path.join(root, '.private')
    await mkdir(publicDirectory)
    await mkdir(privateDirectory)
    await writeFile(path.join(publicDirectory, 'summary.txt'), 'public')
    await writeFile(path.join(privateDirectory, 'summary.txt'), 'private')

    const originalOpenDirectory = fs.opendir
    let releaseOpen
    let reachedOpen
    const openGate = new Promise((resolve) => { releaseOpen = resolve })
    const openReached = new Promise((resolve) => { reachedOpen = resolve })
    fs.opendir = async (candidate, ...args) => {
      if (candidate === publicDirectory) {
        reachedOpen()
        await openGate
      }
      return originalOpenDirectory.call(fs, candidate, ...args)
    }
    try {
      const serialization = serializeDerivativeResult(root, { operation: 'list' })
      await openReached
      await rename(publicDirectory, `${publicDirectory}-original`)
      await symlink(privateDirectory, publicDirectory)
      releaseOpen()
      await assert.rejects(serialization)
    } finally {
      releaseOpen()
      fs.opendir = originalOpenDirectory
    }
  })

  it('turns the Results page report into inactive visible text', () => {
    const html = '<h1>Derivative summary</h1><script>ignore()</script><p>Score &amp; result</p>'
    assert.equal(htmlToInactiveText(html), 'Derivative summary Score & result')
  })

  it('serializes the Results page report and its referenced figure', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'neuroflame-result-'))
    await writeFile(
      path.join(root, 'index.html'),
      '<h1>Derivative summary</h1><img src="figure.png">',
    )
    await writeFile(
      path.join(root, 'figure.png'),
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    )

    const result = await serializeDerivativeResult(root, {
      operation: 'report',
    })
    assert.equal(result.blocks[0].text, 'Derivative summary')
    assert.equal(result.blocks[1].type, 'image')
    assert.equal(result.blocks[1].mimeType, 'image/png')
  })

  it('lists relative derivatives without local paths or private files', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'neuroflame-result-'))
    await writeFile(path.join(root, 'summary.csv'), 'metric,value\nscore,1')
    await writeFile(path.join(root, 'failed-container.log'), 'private')
    await writeFile(path.join(root, 'unsupported.mat'), 'private binary')
    await writeFile(path.join(root, 'oversized.txt'), Buffer.alloc(1024 * 1024 + 1))

    const result = await serializeDerivativeResult(root, { operation: 'list' })
    const serialized = result.blocks[0].text
    assert.match(serialized, /summary\.csv/)
    assert.doesNotMatch(serialized, /failed-container|unsupported\.mat|oversized\.txt|\/private\/|\/var\//)
  })

  it('stops listing after a bounded number of unsupported filesystem nodes', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'neuroflame-result-'))
    for (let start = 0; start < 2_050; start += 100) {
      await Promise.all(Array.from({ length: Math.min(100, 2_050 - start) }, (_, index) =>
        writeFile(path.join(root, `unsupported-${start + index}.bin`), 'x')))
    }
    await assert.rejects(
      serializeDerivativeResult(root, { operation: 'list' }),
      /work limit/,
    )
  })

  it('accepts relay events only for the subscription user', () => {
    const request = {
      requestId: 'request',
      targetUserId: 'user-a',
      consortiumId: 'consortium',
      runId: 'run',
      operation: 'list',
      callbackUrl: 'https://example.test/callback',
      callbackToken: 'token',
      expiresAt: '2000',
    }
    assert.equal(isResultRelayRequestForUser(request, 'user-a', 1000), true)
    assert.equal(isResultRelayRequestForUser(request, 'user-b', 1000), false)
    assert.equal(isResultRelayRequestForUser(request, 'user-a', 3000), false)
  })
})
