// components/Chat.jsx — sohbet UI (okundu tikleri + emoji)
import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const EMOJIS = [
  '😀','😂','🤣','😊','😍','😎','🥳','😉','😭','😅','😴','🤔','😡','😱','🥺','😘',
  '👍','👎','👏','🙏','🙌','💪','👀','🤝','✌️','🤞','👌','🫶','🔥','💯','✨','🎉',
  '❤️','🧡','💛','💚','💙','💜','🖤','💔','⭐','🚀','🎈','🎁','✅','❌','⚡','💬',
]

// Mesaj durumu: tek tik (gönderildi) / çift tik (ulaştı) / mavi çift tik (okundu)
function Ticks({ status }) {
  if (!status) return null
  const blue   = status === 'read'
  const double = status === 'delivered' || status === 'read'
  return (
    <span className={`inline-flex items-center ${blue ? 'text-sky-300' : 'text-emerald-200/80'}`} title={
      status === 'read' ? 'Okundu' : status === 'delivered' ? 'İletildi' : 'Gönderildi'
    }>
      <svg width={double ? 15 : 10} height="11" viewBox={double ? '0 0 15 11' : '0 0 10 11'} fill="none">
        <path d="M1 6L4 9L9 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        {double && (
          <path d="M5.5 6L8 9L13.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        )}
      </svg>
    </span>
  )
}

export default function Chat({
  dcReady,
  messages, input, peerTyping,
  handleInputChange, send, handleKeyDown, insertEmoji,
}) {
  const bottomRef = useRef(null)
  const [showEmoji, setShowEmoji] = useState(false)

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
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={`flex ${m.from === 'self' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${
              m.from === 'self'
                ? 'bg-emerald-600 text-white rounded-br-sm'
                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-sm'
            }`}>
              <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
              <div className={`flex items-center gap-1 justify-end mt-0.5 ${m.from === 'self' ? 'text-emerald-100' : 'text-gray-400 dark:text-gray-500'}`}>
                <span className="text-[10px]">
                  {new Date(m.ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {m.from === 'self' && <Ticks status={m.status} />}
              </div>
            </div>
          </motion.div>
        ))}
        <AnimatePresence>
          {peerTyping && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="flex justify-start"
            >
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-sm px-3 py-2.5 flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Emoji paneli */}
      <AnimatePresence>
        {showEmoji && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="grid grid-cols-8 gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-2 max-h-40 overflow-y-auto"
          >
            {EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => insertEmoji(e)}
                className="text-xl hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg p-1 transition-colors"
              >
                {e}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 items-end">
        <button
          onClick={() => setShowEmoji(s => !s)}
          disabled={!dcReady}
          className={`px-2.5 py-2.5 rounded-xl text-lg shrink-0 transition-colors disabled:opacity-40 ${
            showEmoji ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          😊
        </button>
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
