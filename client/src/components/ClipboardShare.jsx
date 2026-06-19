// components/ClipboardShare.jsx — pure UI
export default function ClipboardShare({
  dcReady,
  input, setInput,
  received,
  copiedIdx,
  sendText,
  pasteFromClipboard,
  copyText,
  handleKeyDown,
}) {
  return (
    <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Metin / Pano</p>

      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={!dcReady}
        placeholder={dcReady ? 'Metin yaz veya yapıştır… (Ctrl+Enter ile gönder)' : 'Bağlantı bekleniyor...'}
        rows={3}
        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-emerald-500 disabled:opacity-40 resize-none"
      />

      <div className="flex gap-2">
        <button
          onClick={pasteFromClipboard}
          disabled={!dcReady}
          className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-800 dark:text-white text-xs font-semibold rounded-xl transition-colors"
        >
          Panodan Yapıştır
        </button>
        <button
          onClick={sendText}
          disabled={!dcReady || !input.trim()}
          className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-colors"
        >
          Gönder
        </button>
      </div>

      {received.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Alınan</p>
          {received.map((r, i) => (
            <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-xl p-3 flex flex-col gap-2">
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-all">{r.text}</p>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 dark:text-gray-600">
                  {new Date(r.ts).toLocaleTimeString('tr-TR')}
                </span>
                <button
                  onClick={() => copyText(r.text, i)}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors"
                >
                  {copiedIdx === i ? 'Kopyalandı!' : 'Kopyala'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
