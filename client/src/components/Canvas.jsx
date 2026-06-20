// components/Canvas.jsx
const COLORS = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff']
const SIZES  = [2, 5, 10, 20]

export default function Canvas({
  canvasRef,
  color, setColor,
  size, setSize,
  tool, setTool,
  onPointerDown, onPointerMove, onPointerUp,
  clearCanvas, downloadCanvas,
  dcReady,
}) {
  return (
    <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Beyaz Tahta</p>
        {!dcReady && <span className="text-xs text-gray-400 dark:text-gray-600">Bağlantı bekleniyor</span>}
      </div>

      {/* Araç çubuğu */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Renkler */}
        <div className="flex items-center gap-1">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => { setColor(c); setTool('pen') }}
              title={c}
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                color === c && tool === 'pen'
                  ? 'border-gray-700 dark:border-gray-200 scale-110'
                  : 'border-gray-300 dark:border-gray-600'
              } ${c === '#ffffff' ? 'shadow-sm' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={e => { setColor(e.target.value); setTool('pen') }}
            title="Özel renk"
            className="w-6 h-6 rounded-full cursor-pointer border-2 border-gray-300 dark:border-gray-600 bg-transparent"
          />
        </div>

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

        {/* Fırça boyutları */}
        <div className="flex items-center gap-1">
          {SIZES.map(s => (
            <button
              key={s}
              onClick={() => setSize(s)}
              title={`${s}px`}
              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                size === s
                  ? 'bg-gray-800 dark:bg-gray-200'
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span
                className={`rounded-full block ${size === s ? 'bg-white dark:bg-gray-900' : 'bg-gray-600 dark:bg-gray-400'}`}
                style={{ width: Math.max(s * 0.7, 2), height: Math.max(s * 0.7, 2) }}
              />
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

        {/* Silgi */}
        <button
          onClick={() => setTool(tool === 'eraser' ? 'pen' : 'eraser')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
            tool === 'eraser'
              ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Silgi
        </button>

        {/* Temizle */}
        <button
          onClick={clearCanvas}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
        >
          Temizle
        </button>

        {/* İndir */}
        <button
          onClick={downloadCanvas}
          className="ml-auto px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          PNG İndir
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={1200}
        height={675}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white cursor-crosshair touch-none"
        style={{ aspectRatio: '16/9' }}
      />

      <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
        Çizimler uçtan uca şifreli · Karşı taraf gerçek zamanlı görür
      </p>
    </div>
  )
}
