// core/heic.js — HEIC/HEIF dönüştürme (libheif WASM, tarayıcı native açamıyor)

let heic2anyPromise = null
function loadHeic2any() {
  // Lazy import: ~1.5 MB WASM sadece gerektiğinde yüklensin
  if (!heic2anyPromise) heic2anyPromise = import('heic2any').then(m => m.default)
  return heic2anyPromise
}

export function isHeicName(name = '') {
  return /\.(heic|heif)$/i.test(name)
}

export function isHeic(file) {
  return isHeicName(file.name) || file.type === 'image/heic' || file.type === 'image/heif'
}

// HEIC blob → JPEG/PNG blob
export async function heicToBlob(blob, toType = 'image/jpeg', quality = 0.92) {
  const heic2any = await loadHeic2any()
  const out = await heic2any({ blob, toType, quality })
  return Array.isArray(out) ? out[0] : out
}

// Alıcı tarafta: blob URL'den oku → çevir → indir
export async function convertAndDownload(url, name, toType = 'image/jpeg') {
  const srcBlob = await fetch(url).then(r => r.blob())
  const outBlob = await heicToBlob(srcBlob, toType, 0.92)
  const ext     = toType === 'image/png' ? 'png' : 'jpg'
  const newName = name.replace(/\.(heic|heif)$/i, '') + '.' + ext

  const outUrl = URL.createObjectURL(outBlob)
  const a = document.createElement('a')
  a.href     = outUrl
  a.download = newName
  a.click()
  setTimeout(() => URL.revokeObjectURL(outUrl), 1000)
}
