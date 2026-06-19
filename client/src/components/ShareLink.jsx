// components/ShareLink.jsx
import { useState } from 'react'
import QRCode from 'react-qr-code'

export default function ShareLink({ roomId, secretKey }) {
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)

  const fullLink = `${window.location.origin}/room/${roomId}#${secretKey}`

  async function copy() {
    await navigator.clipboard.writeText(fullLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-semibold uppercase tracking-wider">
        Paylaşım Linki
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          value={fullLink}
          className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-700 dark:text-gray-300 font-mono focus:outline-none truncate"
        />
        <button
          onClick={copy}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex-shrink-0 ${
            copied
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white'
          }`}
        >
          {copied ? '✓ Kopyalandı' : 'Kopyala'}
        </button>
        <button
          onClick={() => setShowQR(s => !s)}
          className="px-3 py-2 rounded-xl text-sm font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white transition-colors flex-shrink-0"
          title="QR Kod"
        >
          {showQR ? '✕' : '⬛'}
        </button>
      </div>

      {showQR && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <div className="bg-white p-3 rounded-xl inline-block">
            <QRCode value={fullLink} size={180} />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Karşı taraf bu kodu telefonuyla tarayabilir
          </p>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">
        # işaretinden sonrası şifreleme anahtarı — sunucu görmez.
      </p>
    </div>
  )
}
