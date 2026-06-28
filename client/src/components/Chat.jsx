// components/Chat.jsx — sohbet UI
import { useRef, useEffect } from 'react'

export default function Chat({
  dcReady,
  messages, input, peerTyping,
  handleInputChange, send, handleKeyDown,
}) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, peerTyping])

  return (
    <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Sohbet</p>

      <div className="bg-gray-100 dark:bg-gray-950 rounded-xl p-3 h-80 overflow-y-auto flex flex-col gap-2">
        {messages.length === 0 && (
          <span className="text-gray-400 dark:text-gray-700 text-sm m-auto">Henüz mesaj yok — yaz başla 💬</span>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === 'self' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${
              m.from === 'self'
                ? 'bg-emerald-600 text-white rounded-br-sm'
                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-sm'
            }`}>
              <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
              <p className={`text-[10px] mt-0.5 ${m.from === 'self' ? 'text-emerald-100' : 'text-gray-400 dark:text-gray-500'}`}>
                {new Date(m.ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {peerTyping && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-sm px-3 py-2.5 flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!dcReady}
          rows={1}
          placeholder={dcReady ? 'Mesaj yaz… (Enter gönder, Shift+Enter satır)' : 'Bağlantı bekleniyor...'}
          className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 disabled:opacity-40 resize-none max-h-32"
        />
        <button
          onClick={send}
          disabled={!dcReady || !input.trim()}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm shrink-0"
        >
          Gönder
        </button>
      </div>
    </div>
  )
}
