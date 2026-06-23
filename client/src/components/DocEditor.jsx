// components/DocEditor.jsx
export default function DocEditor({
  editorOpen, fileName, content, peerTyping, openedBy,
  handleContentChange, closeEditor, saveFile,
  dcReady,
}) {
  if (!editorOpen) {
    return (
      <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 min-h-[200px]">
        <p className="text-gray-400 dark:text-gray-600 text-sm">
          Henüz açık dosya yok.
        </p>
        <p className="text-gray-300 dark:text-gray-700 text-xs text-center">
          Dosyalar sekmesinde alınan bir metin dosyasına tıklayarak editörü aç.
        </p>
      </div>
    )
  }

  const lines = content.split('\n').length
  const chars = content.length

  function onKeyDown(e) {
    // Ctrl+S → kaydet
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      saveFile()
    }
    // Tab → 2 boşluk ekle
    if (e.key === 'Tab') {
      e.preventDefault()
      const el    = e.target
      const start = el.selectionStart
      const end   = el.selectionEnd
      const next  = content.slice(0, start) + '  ' + content.slice(end)
      handleContentChange(next)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2
      })
    }
  }

  return (
    <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden flex flex-col">

      {/* Başlık çubuğu */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-mono text-gray-700 dark:text-gray-300 truncate">{fileName}</span>
          {peerTyping && (
            <span className="flex items-center gap-1 text-xs text-emerald-500 dark:text-emerald-400 shrink-0">
              <span className="flex gap-0.5">
                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
              karşı taraf yazıyor
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!dcReady && (
            <span className="text-xs text-yellow-500 dark:text-yellow-400">çevrimdışı</span>
          )}
          <button
            onClick={saveFile}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
            title="Ctrl+S"
          >
            Kaydet
          </button>
          <button
            onClick={closeEditor}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>

      {/* Editör alanı */}
      <textarea
        value={content}
        onChange={e => handleContentChange(e.target.value)}
        onKeyDown={onKeyDown}
        spellCheck={false}
        className="w-full resize-none font-mono text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 p-4 focus:outline-none leading-relaxed"
        style={{ minHeight: '420px', tabSize: 2 }}
        placeholder="Dosya içeriği burada görünecek…"
      />

      {/* Alt bilgi */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
        <span className="text-xs text-gray-400 dark:text-gray-600">
          {lines} satır · {chars} karakter
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-600">
          {openedBy === 'peer' ? 'Karşı taraf açtı' : 'Sen açtın'} · Ctrl+S kaydet
        </span>
      </div>
    </div>
  )
}
