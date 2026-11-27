import { execFile } from 'node:child_process'
import { constants } from 'node:fs'
import { lstat, mkdtemp, open, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import type { Activity } from './model'

type Image = NonNullable<Activity['entries'][number]['images']>[number]
const exec = promisify(execFile)
const maxBytes = 8 * 1024 * 1024
const maxPreview = 64 * 1024
const extensions: Record<string, string> = {'.png':'png', '.jpg':'jpeg', '.jpeg':'jpeg', '.webp':'webp'}

function mediaType(data: Buffer): string | undefined {
  if (data.length < 16) return
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png'
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'jpeg'
  if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'webp'
}

async function readCommittedFile(root: string, path: string, bytes: number): Promise<Buffer | undefined> {
  const upload = dirname(path)
  if (path !== resolve(path) || dirname(upload) !== root ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(basename(upload))) return
  if (await realpath(root) !== root || !(await lstat(upload)).isDirectory() || await realpath(path) !== path) return
  const before = await lstat(path)
  if (!before.isFile() || before.nlink !== 1 || before.size !== bytes) return
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const current = await file.stat()
    if (!current.isFile() || current.nlink !== 1 || current.size !== bytes ||
      current.dev !== before.dev || current.ino !== before.ino || await realpath(path) !== path) return
    const buffer = Buffer.alloc(bytes + 1)
    const {bytesRead} = await file.read(buffer, 0, buffer.length, 0)
    if (bytesRead === bytes) return buffer.subarray(0, bytes)
  } finally {
    await file.close()
  }
}

async function thumbnail(data: Buffer, format: string) {
  if (process.platform !== 'darwin') return
  // The converter sees only the bytes already checked against Orca's committed attachment.
  const work = await mkdtemp(join(tmpdir(), 'session-board-image-'))
  try {
    const source = join(work, 'image.' + format)
    const preview = join(work, 'preview.jpg')
    await writeFile(source, data, {mode:0o600})
    const {stdout} = await exec('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', source], {timeout:2000})
    const width = Number(/^\s*pixelWidth:\s+(\d+)$/m.exec(stdout)?.[1])
    const height = Number(/^\s*pixelHeight:\s+(\d+)$/m.exec(stdout)?.[1])
    if (!width || !height || width * height > 24_000_000) return
    if (data.length <= maxPreview && width <= 640 && height <= 640) return {data, format}
    await exec('/usr/bin/sips', ['-Z', '512', '-s', 'format', 'jpeg', '-s', 'formatOptions', '60',
      source, '--out', preview], {timeout:3000})
    const size = (await lstat(preview)).size
    if (!size || size > maxPreview) return
    return {data:await readFile(preview), format:'jpeg'}
  } finally {
    await rm(work, {recursive:true, force:true})
  }
}

// Entry points supply only the structured `data.images` from a verified local Item comment.
export async function itemImage(value: unknown,
  root = join(homedir(), 'Library', 'Application Support', 'orca', 'agent-session-attachments')): Promise<Image | undefined> {
  if (!value || typeof value !== 'object' || !('path' in value) || !('name' in value) ||
      !('bytes' in value) || typeof value.path !== 'string' || typeof value.name !== 'string' ||
      typeof value.bytes !== 'number' || !Number.isSafeInteger(value.bytes) ||
      value.bytes < 16 || value.bytes > maxBytes) return
  const {path, name, bytes} = value
  const format = extensions[extname(path).toLowerCase()]
  if (!format || basename(path) !== name || path.includes('\0')) return
  try {
    const data = await readCommittedFile(root, path, bytes)
    if (!data || mediaType(data) !== format) return
    const result = await thumbnail(data, format)
    if (result) return {alt:name.slice(0, 160), src:'data:image/' + result.format + ';base64,' + result.data.toString('base64')}
  } catch {
    return
  }
}
