// components/DocEditor.jsx — ortak editör (gutter, yorum, kilit, tema, değişiklik vurgusu)
import { useRef, useState, useEffect } from 'react'

// Renk temaları (gerçek syntax highlight değil — editör renk şeması)
const THEMES = {
  light:   { label: 'Açık',    wrap: 'bg-white',      text: 'text-gray-900',   gutter: 'bg-gray-50 text-gray-400' },
  dracula: { label: 'Dracula', wrap: 'bg-[#282a36]',  text: 'text-[#f8f8f2]',  gutter: 'bg-[#21222c] text-[#6272a4]' },
  github:  { label: 'GitHub',  wrap: 'bg-[#f6f8fa]',  text: 'text-[#24292f]',  gutter: 'bg-[#eaeef2] text-[#8c959f]' },
  monokai: { label: 'Monokai', wrap: 'bg-[#272822]',  text: 'text-[#f8f8f2]',  gutter: 'bg-[#1e1f1c] text-[#75715e]' },
}
const LINE_H = 24 // px — gutter ile textarea satır yüksekliği eşit olmalı

export default function DocEditor({
  editorOpen, fileName, content, peerTyping, openedBy, loadingPct,
  locked, lockedByPeer, comments, flash, lang,
  handleContentChange, closeEditor, saveFile, copyToClipboard, toggleLock, addComment,
  dcReady,
}) {
  const taRef     = useRef(null)
  const gutterRef = useRef(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('editor_theme') || 'light')
  const [showThemes, setShowThemes] = useState(false)
  const [commentLine, setCommentLine] = useState(0) // yorum yazılacak satır
  const [commentText, setCommentText] = useState('')
  const [flashLine, setFlashLine] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => { localStorage.setItem('editor_theme', theme) }, [theme])
  useEffect(() => {
    if (flash?.line) { setFlashLine(flash.line); const t = setTimeout(() => setFlashLine(0), 1500); return () => clearTimeout(t) }
  }, [flash])

  if (!editorOpen) {
    return (
      <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 min-h-[200px]">
        {loadingPct > 0 && loadingPct < 100 ? (
          <>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Belge alınıyor… %{loadingPct.toFixed(0)}</p>
            <div className="w-40 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${loadingPct}%` }} />
            </div>
          </>
        ) : (
          <>
            <p className="text-gray-400 dark:text-gray-600 text-sm">Henüz açık dosya yok.</p>
            <p className="text-gray-300 dark:text-gray-700 text-xs text-center">Dosyalar sekmesinde bir metin/kod dosyasına <b>Düzenle</b> de.</p>
          </>
        )}
      </div>
    )
  }

  const t          = THEMES[theme] || THEMES.light
  const lineCount  = content.split('\n').length
  const commentSet = new Set(comments.map(c => c.line))
  const readOnly   = lockedByPeer

  function syncScroll() {
    if (gutterRef.current && taRef.current) gutterRef.current.scrollTop = taRef.current.scrollTop
  }

  function goToLine(line) {
    const ta = taRef.current
    if (!ta) return
    ta.scrollTop = (line - 1) * LINE_H
    syncScroll()
  }

  function submitComment() {
    addComment(commentLine, commentText)
    setCommentText('')
    setCommentLine(0)
  }

  function onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveFile() }
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = e.target, start = el.selectionStart, end = el.selectionEnd
      handleContentChange(content.slice(0, start) + '  ' + content.slice(end))
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 2 })
    }
  }

  async function doCopy() {
    const ok = await copyToClipboard()
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500) }
  }

  return (
    <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden flex flex-col">

      {/* Başlık */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-mono text-gray-700 dark:text-gray-300 truncate">{fileName}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 shrink-0">{lang}</span>
          {peerTyping && <span className="text-xs text-emerald-500 shrink-0">✎ yazıyor…</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setShowThemes(v => !v)} title="Tema" className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-xs">🎨</button>
          <button onClick={toggleLock} title="Düzenlemeyi kilitle"
            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-colors ${locked ? 'bg-amber-500 text-white' : 'bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700'}`}>
            {locked ? '🔒' : '🔓'}
          </button>
          <button onClick={doCopy} title="Panoya kopyala" className="px-2 h-7 flex items-center rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-xs font-semibold">
            {copied ? '✓' : 'Kopyala'}
          </button>
          <button onClick={saveFile} title="Ctrl+S" className="px-2 h-7 flex items-center bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg">Kaydet</button>
          <button onClick={closeEditor} className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm">✕</button>
        </div>
      </div>

      {/* Tema seçici */}
      {showThemes && (
        <div className="flex gap-1.5 px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
          {Object.entries(THEMES).map(([key, th]) => (
            <button key={key} onClick={() => { setTheme(key); setShowThemes(false) }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${theme === key ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
              {th.label}
            </button>
          ))}
        </div>
      )}

      {lockedByPeer && (
        <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs">
          🔒 Karşı taraf düzenlemeyi kilitledi — salt okunur
        </div>
      )}

      {/* Editör gövdesi: gutter + textarea */}
      <div className={`flex h-[440px] ${t.wrap}`}>
        {/* Satır numaraları (tıkla → yorum) */}
        <div ref={gutterRef} className={`overflow-hidden select-none text-right ${t.gutter} font-mono text-xs`} style={{ width: 44 }}>
          <div style={{ paddingTop: 8, paddingBottom: 8 }}>
            {Array.from({ length: lineCount }, (_, i) => i + 1).map(n => (
              <div key={n}
                onClick={() => { setCommentLine(n); setCommentText('') }}
                title="Yorum ekle"
                className={`px-2 cursor-pointer hover:text-emerald-500 flex items-center justify-end gap-1 ${flashLine === n ? 'bg-yellow-300/40' : ''}`}
                style={{ height: LINE_H, lineHeight: `${LINE_H}px` }}>
                {commentSet.has(n) && <span className="text-emerald-500 text-[10px]">💬</span>}
                {n}
              </div>
            ))}
          </div>
        </div>

        {/* Metin */}
        <textarea
          ref={taRef}
          value={content}
          onChange={e => handleContentChange(e.target.value)}
          onKeyDown={onKeyDown}
          onScroll={syncScroll}
          readOnly={readOnly}
          spellCheck={false}
          className={`flex-1 resize-none font-mono text-sm ${t.text} bg-transparent px-3 focus:outline-none ${readOnly ? 'cursor-not-allowed' : ''}`}
          style={{ lineHeight: `${LINE_H}px`, paddingTop: 8, paddingBottom: 8, tabSize: 2 }}
          placeholder="Dosya içeriği burada…"
        />
      </div>

      {/* Yorum yazma çubuğu */}
      {commentLine > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-200 dark:border-gray-800 bg-emerald-50 dark:bg-emerald-950">
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">Satır {commentLine}:</span>
          <input
            autoFocus value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitComment()}
            placeholder="Yorumun…"
            className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none"
          />
          <button onClick={submitComment} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg">Ekle</button>
          <button onClick={() => setCommentLine(0)} className="text-gray-400 hover:text-red-400 text-sm">✕</button>
        </div>
      )}

      {/* Yorum listesi */}
      {comments.length > 0 && (
        <div className="max-h-32 overflow-y-auto border-t border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {comments.map((c, i) => (
            <button key={i} onClick={() => goToLine(c.line)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-start gap-2">
              <span className="text-[10px] font-mono px-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 shrink-0 mt-0.5">L{c.line}</span>
              <span className="text-xs text-gray-700 dark:text-gray-300">
                <b className={c.from === 'self' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}>{c.from === 'self' ? 'Sen' : 'Karşı'}:</b> {c.text}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Alt bilgi */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
        <span className="text-xs text-gray-400 dark:text-gray-600">{lineCount} satır · {content.length} karakter</span>
        <span className="text-xs text-gray-400 dark:text-gray-600">{openedBy === 'peer' ? 'Karşı taraf açtı' : 'Sen açtın'}{!dcReady && ' · çevrimdışı'}</span>
      </div>
    </div>
  )
}
