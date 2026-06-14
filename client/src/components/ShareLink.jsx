// components/ShareLink.jsx
import { useState } from 'react'

export default function ShareLink({ roomId, secretKey }) {
  const [copied, setCopied] = useState(false)

  const fullLink = `${window.location.origin}/room/${roomId}#${secretKey}`

  async function copy() {
    await navigator.clipboard.writeText(fullLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wider">
        Paylaşım Linki
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          value={fullLink}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-300 font-mono focus:outline-none truncate"
        />
        <button
          onClick={copy}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex-shrink-0 ${
            copied
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
        >
          {copied ? '✓ Kopyalandı' : 'Kopyala'}
        </button>
      </div>
      <p className="text-xs text-gray-600 mt-2">
        # işaretinden sonrası şifreleme anahtarı — sunucu görmez.
      </p>
    </div>
  )
}
