// pages/Landing.jsx
import { useState } from 'react'
import { generateHex } from '../core/crypto.js'

export default function Landing() {
  const [joinInput, setJoinInput] = useState('')
  const [error, setError]         = useState('')

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
      // Tam URL veya sadece /room/xxx#yyy formatını destekle
      let roomId, secretKey

      if (raw.includes('/room/')) {
        const afterRoom = raw.split('/room/')[1]         // "abc123#key456"
        const hashIdx   = afterRoom.indexOf('#')
        if (hashIdx === -1) throw new Error('hash yok')
        roomId    = afterRoom.slice(0, hashIdx)
        secretKey = afterRoom.slice(hashIdx + 1)
      } else {
        throw new Error('format hatalı')
      }

      if (!roomId || !secretKey) throw new Error('eksik')

      // window.location ile git — hash korunur
      window.location.href = `/room/${roomId}#${secretKey}`
    } catch {
      setError('Geçersiz link. Tam URL\'yi yapıştır.')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-12">

      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          P2P <span className="text-emerald-400">LinkDrive</span>
        </h1>
        <p className="mt-2 text-gray-400 text-sm">
          Sıfır Bilgi · Sunucusuz · Tarayıcıdan Tarayıcıya
        </p>
      </div>

      <div className="w-full max-w-md flex flex-col gap-4">

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-1">Klasör Paylaş</h2>
          <p className="text-gray-400 text-sm mb-4">
            Yeni bir oda oluştur, linki karşı tarafa gönder.
          </p>
          <button
            onClick={handleCreate}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-2.5 rounded-xl transition-colors"
          >
            Oda Oluştur →
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-1">Odaya Katıl</h2>
          <p className="text-gray-400 text-sm mb-4">
            Sana gönderilen linki yapıştır.
          </p>
          <form onSubmit={handleJoin} className="flex flex-col gap-3">
            <input
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="http://localhost:5173/room/abc...#key..."
              className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              type="submit"
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2.5 rounded-xl transition-colors"
            >
              Katıl
            </button>
          </form>
        </div>

      </div>

      <p className="text-gray-600 text-xs text-center">
        Şifreleme anahtarı URL'nin # kısmında — sunucu asla görmez.
      </p>
    </div>
  )
}
