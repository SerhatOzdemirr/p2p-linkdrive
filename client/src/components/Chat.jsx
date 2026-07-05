// components/Chat.jsx — sohbet UI (tam ekran + temalar + alıntılı cevap)
import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconMaximize, IconMinimize } from './icons.jsx'

const EMOJIS = [
  '😀','😂','🤣','😊','😍','😎','🥳','😉','😭','😅','😴','🤔','😡','😱','🥺','😘',
  '👍','👎','👏','🙏','🙌','💪','👀','🤝','✌️','🤞','👌','🫶','🔥','💯','✨','🎉',
  '❤️','🧡','💛','💚','💙','💜','🖤','💔','⭐','🚀','🎈','🎁','✅','❌','⚡','💬',
]

// Renk temaları — mesaj alanı zemini + kendi baloncuk rengi
const THEMES = {
  default: { label: '💬 Varsayılan', area: 'bg-gray-100 dark:bg-gray-950',                         self: 'bg-emerald-600' },
  sunset:  { label: '🌅 Gün Batımı',  area: 'bg-gradient-to-b from-orange-100 to-pink-100 dark:from-orange-950 dark:to-pink-950', self: 'bg-orange-500' },
  ocean:   { label: '🌊 Okyanus',     area: 'bg-gradient-to-b from-sky-100 to-blue-100 dark:from-sky-950 dark:to-blue-950',       self: 'bg-blue-600' },
  forest:  { label: '🌲 Orman',       area: 'bg-gradient-to-b from-green-100 to-emerald-100 dark:from-green-950 dark:to-emerald-950', self: 'bg-green-600' },
  grape:   { label: '🍇 Üzüm',        area: 'bg-gradient-to-b from-violet-100 to-fuchsia-100 dark:from-violet-950 dark:to-fuchsia-950', self: 'bg-violet-600' },
  night:   { label: '🌙 Gece',        area: 'bg-slate-900',                                         self: 'bg-indigo-600' },
}

function Ticks({ status }) {
  if (!status) return null
  const blue   = status === 'read'
  const double = status === 'delivered' || status === 'read'
  return (
    <span className={`inline-flex items-center ${blue ? 'text-sky-300' : 'text-white/70'}`} title={
      status === 'read' ? 'Okundu' : status === 'delivered' ? 'İletildi' : 'Gönderildi'
    }>
      <svg width={double ? 15 : 10} height="11" viewBox={double ? '0 0 15 11' : '0 0 10 11'} fill="none">
        <path d="M1 6L4 9L9 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        {double && <path d="M5.5 6L8 9L13.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>}
      </svg>
    </span>
  )
}

export default function Chat({
  dcReady,
  messages, input, peerTyping, replyingTo,
  handleInputChange, send, handleKeyDown, insertEmoji,
  setReplyTo, cancelReply,
}) {
  const bottomRef = useRef(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showThemes, setShowThemes] = useState(false)
  const [isFs, setIsFs] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('chat_theme') || 'default')

  const t = THEMES[theme] || THEMES.default

  useEffect(() => { localStorage.setItem('chat_theme', theme) }, [theme])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, peerTyping])

  // CSS tam ekran (Fullscreen API değil) — mobilde klavye açılınca alan küçülür, input görünür kalır
  function toggleFullscreen() { setIsFs(v => !v) }

  return (
    <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-col gap-3 ${
      isFs ? 'fixed inset-0 z-50 h-[100dvh] rounded-none p-3' : 'w-full rounded-2xl p-4'}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Sohbet</p>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowThemes(v => !v)} title="Tema"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">🎨</button>
          <button onClick={toggleFullscreen} title={isFs ? 'Çık' : 'Tam ekran'}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">
            {isFs ? <IconMinimize width={16} height={16} /> : <IconMaximize width={16} height={16} />}
          </button>
        </div>
      </div>

      {/* Tema seçici */}
      <AnimatePresence>
        {showThemes && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="flex gap-1.5 flex-wrap">
            {Object.entries(THEMES).map(([key, th]) => (
              <button key={key} onClick={() => { setTheme(key); setShowThemes(false) }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  theme === key ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                {th.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mesaj alanı */}
      <div className={`${t.area} rounded-xl p-3 overflow-y-auto flex flex-col gap-2 ${isFs ? 'flex-1' : 'h-80'}`}>
        {messages.length === 0 && (
          <span className="text-gray-400 dark:text-gray-600 text-sm m-auto">Henüz mesaj yok — yaz başla 💬</span>
        )}
        {messages.map((m, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={`group flex items-center gap-1.5 ${m.from === 'self' ? 'justify-end' : 'justify-start'}`}
          >
            {m.from === 'self' && (
              <button onClick={() => setReplyTo(m)} title="Yanıtla"
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-opacity text-sm">↩</button>
            )}
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${
              m.from === 'self' ? `${t.self} text-white rounded-br-sm`
                                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-sm'}`}>
              {/* Alıntı */}
              {m.replyTo && (
                <div className={`mb-1 px-2 py-1 rounded-lg border-l-2 text-xs ${
                  m.from === 'self' ? 'bg-black/15 border-white/60' : 'bg-black/5 dark:bg-white/10 border-emerald-500'}`}>
                  <span className="opacity-70">{m.replyTo.from === 'self' ? 'Sen' : 'Karşı taraf'}: </span>
                  <span className="opacity-90 line-clamp-2">{m.replyTo.text}</span>
                </div>
              )}
              <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
              <div className={`flex items-center gap-1 justify-end mt-0.5 ${m.from === 'self' ? 'text-white/70' : 'text-gray-400 dark:text-gray-500'}`}>
                <span className="text-[10px]">{new Date(m.ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                {m.from === 'self' && <Ticks status={m.status} />}
              </div>
            </div>
            {m.from === 'peer' && (
              <button onClick={() => setReplyTo(m)} title="Yanıtla"
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-opacity text-sm">↩</button>
            )}
          </motion.div>
        ))}
        <AnimatePresence>
          {peerTyping && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="flex justify-start">
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
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="grid grid-cols-8 gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-2 max-h-40 overflow-y-auto">
            {EMOJIS.map(e => (
              <button key={e} onClick={() => insertEmoji(e)}
                className="text-xl hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg p-1 transition-colors">{e}</button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Yanıtlama önizleme çubuğu */}
      <AnimatePresence>
        {replyingTo && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 border-l-4 border-emerald-500 rounded-lg px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                {replyingTo.from === 'self' ? 'Kendine' : 'Karşı tarafa'} yanıt
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{replyingTo.text}</p>
            </div>
            <button onClick={cancelReply} className="text-gray-400 hover:text-red-400 text-sm shrink-0">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 items-end">
        <button onClick={() => setShowEmoji(s => !s)} disabled={!dcReady}
          className={`px-2.5 py-2.5 rounded-xl text-lg shrink-0 transition-colors disabled:opacity-40 ${
            showEmoji ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>😊</button>
        <textarea
          value={input}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setTimeout(() => bottomRef.current?.scrollIntoView({ block: 'end' }), 300)}
          disabled={!dcReady}
          rows={1}
          placeholder={dcReady ? 'Mesaj yaz… (Enter gönder, Shift+Enter satır)' : 'Bağlantı bekleniyor...'}
          className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 disabled:opacity-40 resize-none max-h-32"
        />
        <button onClick={send} disabled={!dcReady || !input.trim()}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm shrink-0">
          Gönder
        </button>
      </div>
    </div>
  )
}
