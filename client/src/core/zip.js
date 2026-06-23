// core/zip.js — alınan dosyaları tek ZIP'e paketle (çoklu indirme bloğunu aşar)
import { isHeicName, heicToBlob } from './heic.js'

export async function zipAndDownload(files, { convertHeicToJpg = false, onProgress } = {}) {
  const JSZip = (await import('jszip')).default
  const zip   = new JSZip()
  const used  = new Set()

  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    onProgress?.({ phase: 'add', index: i + 1, total: files.length, name: f.name })

    let blob = await fetch(f.url).then(r => r.blob())
    let name = f.name

    // İstenirse HEIC'leri JPG'ye çevirerek ekle
    if (convertHeicToJpg && isHeicName(f.name)) {
      try {
        blob = await heicToBlob(blob, 'image/jpeg', 0.92)
        name = f.name.replace(/\.(heic|heif)$/i, '') + '.jpg'
      } catch { /* çevrilemezse orijinali ekle */ }
    }

    // Aynı isimli dosyalar için çakışma önleme: "ad (2).ext"
    let unique = name
    let n = 1
    while (used.has(unique)) {
      const dot = name.lastIndexOf('.')
      unique = dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`
      n++
    }
    used.add(unique)

    // STORE: fotoğraf/video zaten sıkışık, tekrar sıkıştırmak boşuna CPU
    zip.file(unique, blob, { compression: 'STORE' })
  }

  const out = await zip.generateAsync(
    { type: 'blob', compression: 'STORE' },
    (meta) => onProgress?.({ phase: 'zip', percent: meta.percent }),
  )

  const url = URL.createObjectURL(out)
  const a = document.createElement('a')
  a.href     = url
  a.download = `linkdrive-${files.length}-dosya.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
