// components/MessageTest.jsx — DataChannel PING/PONG bağlantı testi
import { useState, useRef, useEffect } from 'react'

export default function MessageTest({ dcReady, messages, onSend }) {
  const [input, setInput]  = useState('Merhaba!')
  const bottomRef          = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function send() {
    if (!input.trim() || !dcReady) return
    onSend(input.trim())
    setInput('')
  }

  const COLOR = {
    system: 'text-gray-500',
    self:   'text-emerald-400',
    peer:   'text-blue-400',
  }

  return (
    <div className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
        Bağlantı Testi — PING / PONG
      </p>

      {/* Log */}
      <div className="bg-gray-950 rounded-xl p-3 h-48 overflow-y-auto font-mono text-xs flex flex-col gap-1">
        {messages.length === 0 && (
          <span className="text-gray-700">Henüz mesaj yok...</span>
        )}
        {messages.map((m, i) => (
          <span key={i} className={COLOR[m.from] || 'text-gray-400'}>
            {m.text}
          </span>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={!dcReady}
          placeholder={dcReady ? 'Mesaj yaz...' : 'Bağlantı bekleniyor...'}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 disabled:opacity-40"
        />
        <button
          onClick={send}
          disabled={!dcReady}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
        >
          PING →
        </button>
      </div>
    </div>
  )
}
