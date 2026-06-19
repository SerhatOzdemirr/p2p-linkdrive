// pages/Landing.jsx
import { useState } from 'react'
import { generateHex } from '../core/crypto.js'
import { useTheme } from '../hooks/useTheme.js'

export default function Landing() {
  const [joinInput, setJoinInput] = useState('')
  const [error, setError]         = useState('')
  const { dark, toggle }          = useTheme()

  function handleCreate() {
    const roomId    = generateHex(16) // 32 hex char
    const secretKey = generateHex(32) // 64 hex char = 256-bit AES key

    // window.location ile git — React Router navigate() hash'i strip ediyor!
    window.location.href = `/room/${roomId}#${secretKey}`
  }

  function handleJoin(e) {
    e.preventDefault()
    setError('')

    const raw = joinInput.trim()
    if (!raw) return

    try {
      let roomId, secretKey

      if (raw.includes('/room/')) {
        const afterRoom = raw.split('/room/')[1]
        const hashIdx   = afterRoom.indexOf('#')
        if (hashIdx === -1) throw new Error('hash yok')
        roomId    = afterRoom.slice(0, hashIdx)
        secretKey = afterRoom.slice(hashIdx + 1)
      } else {
        throw new Error('format hatalı')
      }

      if (!roomId || !secretKey) throw new Error('eksik')

      window.location.href = `/room/${roomId}#${secretKey}`
    } catch {
      setError('Geçersiz link. Tam URL\'yi yapıştır.')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-12">

      <div className="absolute top-4 right-4">
        <button
          onClick={toggle}
          title={dark ? 'Açık mod' : 'Koyu mod'}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors text-base"
        >
          {dark ? '☀️' : '🌙'}
        </button>
      </div>

      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
          P2P <span className="text-emerald-500 dark:text-emerald-400">LinkDrive</span>
        </h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm">
          Sıfır Bilgi · Sunucusuz · Tarayıcıdan Tarayıcıya
        </p>
      </div>

      <div className="w-full max-w-md flex flex-col gap-4">

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Klasör Paylaş</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            Yeni bir oda oluştur, linki karşı tarafa gönder.
          </p>
          <button
            onClick={handleCreate}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-2.5 rounded-xl transition-colors"
          >
            Oda Oluştur →
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Odaya Katıl</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            Sana gönderilen linki yapıştır.
          </p>
          <form onSubmit={handleJoin} className="flex flex-col gap-3">
            <input
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="http://localhost:5173/room/abc...#key..."
              className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
            {error && <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>}
            <button
              type="submit"
              className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold py-2.5 rounded-xl transition-colors"
            >
              Katıl
            </button>
          </form>
        </div>

      </div>

      <p className="text-gray-400 dark:text-gray-600 text-xs text-center">
        Şifreleme anahtarı URL'nin # kısmında — sunucu asla görmez.
      </p>
    </div>
  )
}
