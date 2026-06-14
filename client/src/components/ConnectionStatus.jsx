// components/ConnectionStatus.jsx
const STATE_MAP = {
  idle:        { label: 'Bekliyor',        color: 'text-gray-400',   dot: 'bg-gray-600' },
  waiting:     { label: 'Guest bekleniyor', color: 'text-yellow-400', dot: 'bg-yellow-500 animate-pulse' },
  connecting:  { label: 'Bağlanıyor...',   color: 'text-blue-400',   dot: 'bg-blue-500 animate-pulse' },
  connected:   { label: 'Bağlı',           color: 'text-emerald-400', dot: 'bg-emerald-500' },
  disconnected:{ label: 'Bağlantı koptu',  color: 'text-red-400',    dot: 'bg-red-500' },
  failed:      { label: 'Bağlantı başarısız', color: 'text-red-400', dot: 'bg-red-500' },
}

export default function ConnectionStatus({ state, dcReady }) {
  const s = STATE_MAP[state] || STATE_MAP.idle
  return (
    <div className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
      <div className="flex-1">
        <p className={`text-sm font-semibold ${s.color}`}>{s.label}</p>
        {dcReady && (
          <p className="text-xs text-emerald-500 mt-0.5">✓ DataChannel hazır — dosya transferine hazır</p>
        )}
      </div>
      <div className="text-xs text-gray-600 font-mono">{state}</div>
    </div>
  )
}
