// pages/Landing.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateHex } from '../core/crypto.js'

export default function Landing() {
  const navigate = useNavigate()
  const [joinId, setJoinId]   = useState('')
  const [error, setError]     = useState('')

  function handleCreate() {
    const roomId    = generateHex(16)  // 32 hex char
    const secretKey = generateHex(32)  // 64 hex char → 256-bit AES key
    // URL: /room/{roomId}#{secretKey}
    // # fragment sunucuya HTTP isteğinde gitmez — Zero-Knowledge
    navigate(`/room/${roomId}#${secretKey}`)
  }

  function handleJoin(e) {
    e.preventDefault()
    setError('')
    // Linkin tamamını yapıştırmayı destekle
    try {
      const url   = new URL(joinId.includes('://') ? joinId : `http://x/${joinId}`)
      const parts = url.pathname.split('/room/')
      if (parts.length < 2) throw new Error()
      const roomId = parts[1].replace(/\/$/, '')
      const secret = url.hash.slice(1)
      if (!roomId || !secret) throw new Error()
      navigate(`/room/${roomId}#${secret}`)
    } catch {
      setError('Geçersiz link. Tam URL\'yi yapıştır.')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-12">

      {/* Logo */}
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          P2P <span className="text-emerald-400">LinkDrive</span>
        </h1>
        <p className="mt-2 text-gray-400 text-sm">
          Sıfır Bilgi · Sunucusuz · Tarayıcıdan Tarayıcıya
        </p>
      </div>

      {/* Kartlar */}
      <div className="w-full max-w-md flex flex-col gap-4">

        {/* Oda Oluştur */}
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

        {/* Odaya Katıl */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-1">Odaya Katıl</h2>
          <p className="text-gray-400 text-sm mb-4">
            Sana gönderilen linki yapıştır.
          </p>
          <form onSubmit={handleJoin} className="flex flex-col gap-3">
            <input
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
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
