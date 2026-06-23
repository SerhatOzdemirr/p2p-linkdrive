// core/preview.js — gönderen tarafta önizleme üretir, DataChannel'dan karşıya gönderilir
import { isHeic, heicToBlob } from './heic.js'

const THUMB = 260 // maksimum thumbnail boyutu (px)

async function imageThumb(file) {
  // HEIC/HEIF native açılmaz — önce JPEG'e çevir
  const src    = isHeic(file) ? await heicToBlob(file, 'image/jpeg', 0.85) : file
  const bitmap = await createImageBitmap(src)
  const scale  = Math.min(THUMB / bitmap.width, THUMB / bitmap.height, 1)
  const w = Math.round(bitmap.width  * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width  = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.72)
}

async function videoFirstFrame(file) {
  return new Promise((resolve) => {
    const url   = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.muted   = true
    video.preload = 'metadata'
    video.src     = url

    video.addEventListener('loadedmetadata', () => {
      video.currentTime = Math.min(0.5, video.duration * 0.1)
    }, { once: true })

    video.addEventListener('seeked', () => {
      const scale = Math.min(THUMB / video.videoWidth, 1)
      const w = Math.round(video.videoWidth  * scale)
      const h = Math.round(video.videoHeight * scale)
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      canvas.getContext('2d').drawImage(video, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.72))
    }, { once: true })

    video.addEventListener('error', () => { URL.revokeObjectURL(url); resolve(null) }, { once: true })
  })
}

async function pdfFirstPage(file) {
  try {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).href

    const buf  = await file.arrayBuffer()
    const pdf  = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
    const page = await pdf.getPage(1)
    const vp0  = page.getViewport({ scale: 1 })
    const scale = Math.min(THUMB / vp0.width, THUMB / vp0.height)
    const vp   = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width  = Math.round(vp.width)
    canvas.height = Math.round(vp.height)
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
    await pdf.destroy()
    return canvas.toDataURL('image/jpeg', 0.75)
  } catch {
    return null
  }
}

export async function generatePreview(file) {
  try {
    if (isHeic(file))                    return await imageThumb(file)
    if (file.type.startsWith('image/'))  return await imageThumb(file)
    if (file.type.startsWith('video/'))  return await videoFirstFrame(file)
    if (file.type === 'application/pdf') return await pdfFirstPage(file)
    return null
  } catch {
    return null
  }
}
