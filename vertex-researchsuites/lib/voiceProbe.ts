import ffmpegPath from 'ffmpeg-static'
import { execFile } from 'node:child_process'
import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function headerDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath as string, ['-i', filePath], (_error, _stdout, stderr) => {
      const match = String(stderr || '').match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/)
      if (!match) {
        reject(new Error('no duration'))
        return
      }
      resolve(parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseFloat(match[3]))
    })
  })
}

function decodedDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    execFile(
      ffmpegPath as string,
      ['-nostdin', '-i', filePath, '-vn', '-f', 'null', '-'],
      { timeout: 40000, maxBuffer: 8 * 1024 * 1024 },
      (_error, _stdout, stderr) => {
        const all = String(stderr || '').match(/time=(\d+):(\d+):(\d+\.\d+)/g)
        if (!all || all.length === 0) { resolve(0); return }
        const m = /time=(\d+):(\d+):(\d+\.\d+)/.exec(all[all.length - 1])
        if (!m) { resolve(0); return }
        resolve(parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]))
      }
    )
  })
}

export async function probeAudioSeconds(admin: any, audioPath: string): Promise<number> {
  const { data, error } = await admin.storage.from('interview-audio').download(audioPath)
  if (error || !data) throw new Error('download failed')
  const tmp = join(tmpdir(), 'vprobe-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '.audio')
  try {
    await writeFile(tmp, Buffer.from(await data.arrayBuffer()))
    const h = await headerDuration(tmp)
    const d = await decodedDuration(tmp)
    return Math.max(h, d)
  } finally {
    try { await unlink(tmp) } catch {}
  }
}
