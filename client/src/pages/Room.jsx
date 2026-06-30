// pages/Room.jsx
import { useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams } from 'react-router-dom'
import { useRoom } from '../hooks/useRoom.js'
import { useFileTransfer } from '../hooks/useFileTransfer.js'
import { useTheme } from '../hooks/useTheme.js'
import { useDocEditor } from '../hooks/useDocEditor.js'
import { useChat } from '../hooks/useChat.js'
import { useCall } from '../hooks/useCall.js'
import { useCinema } from '../hooks/useCinema.js'
import { useNotifications } from '../hooks/useNotifications.js'
import ShareLink from '../components/ShareLink.jsx'
import ConnectionStatus from '../components/ConnectionStatus.jsx'
import FileTransfer from '../components/FileTransfer.jsx'
import DocEditor from '../components/DocEditor.jsx'
import Chat from '../components/Chat.jsx'
import Call from '../components/Call.jsx'
import Cinema from '../components/Cinema.jsx'
import FloatingCall from '../components/FloatingCall.jsx'
import { AnimatePresence } from 'framer-motion'

const TABS = [
  { id: 'files',  label: 'Dosyalar' },
  { id: 'call',   label: 'Arama'    },
  { id: 'cinema', label: 'Sinema'   },
  { id: 'chat',   label: 'Sohbet'   },
  { id: 'editor', label: 'Editör'   },
]

export default function Room() {
  const { roomId }        = useParams()
  const secretKey         = useRef(window.location.hash.slice(1)).current
  const { dark, toggle }  = useTheme()
  const [activeTab, setActiveTab] = useState('files')

  const {
    role, connState, dcReady, fatalErr,
    dcRef, peerRef, sendEncrypted, registerMessageHandler,
    setDefaultTrackHandler, registerStreamRoute, unregisterStreamRoute,
  } = useRoom(roomId, secretKey)

  const fileTransfer = useFileTransfer({ dcReady, dcRef, sendEncrypted, registerMessageHandler })
  const docEditor    = useDocEditor({ dcReady, sendEncrypted, registerMessageHandler })
  const chat         = useChat({ dcReady, sendEncrypted, registerMessageHandler })
  const call         = useCall({ dcReady, peerRef, sendEncrypted, registerMessageHandler, setDefaultTrackHandler })
  const cinema       = useCinema({ dcReady, peerRef, sendEncrypted, registerMessageHandler, registerStreamRoute, unregisterStreamRoute })
  const { notify }   = useNotifications()

  // ── Bildirimler (arka plan/başka sekme) ──────────────────────────────────
  // Yeni sohbet mesajı
  const prevMsgCount = useRef(0)
  useEffect(() => {
    const msgs = chat.messages
    if (msgs.length > prevMsgCount.current) {
      const last = msgs[msgs.length - 1]
      if (last?.from === 'peer' && (document.hidden || activeTab !== 'chat')) {
        notify({ title: 'Yeni mesaj', body: last.text.slice(0, 80) })
      }
    }
    prevMsgCount.current = msgs.length
  }, [chat.messages]) // eslint-disable-line

  // Gelen dosya
  const prevPendingCount = useRef(0)
  useEffect(() => {
    const n = fileTransfer.pendingFiles.length
    if (n > prevPendingCount.current) {
      const f = fileTransfer.pendingFiles[n - 1]
      notify({ title: 'Dosya geldi', body: f?.name || '' })
    }
    prevPendingCount.current = n
  }, [fileTransfer.pendingFiles]) // eslint-disable-line

  // Gelen arama
  const prevCall = useRef('idle')
  useEffect(() => {
    if (call.callState === 'incoming' && prevCall.current !== 'incoming') {
      notify({ title: 'Gelen arama', body: call.withVideo ? 'Görüntülü arama' : 'Sesli arama' })
    }
    prevCall.current = call.callState
  }, [call.callState]) // eslint-disable-line

  // Karşı taraf film başlatınca Sinema sekmesine geç + bildir
  const prevCinema = useRef('idle')
  useEffect(() => {
    if (cinema.mode === 'guest' && prevCinema.current !== 'guest') {
      setActiveTab('cinema')
      notify({ title: 'Sinema başladı', body: cinema.movieName })
    }
    prevCinema.current = cinema.mode
  }, [cinema.mode]) // eslint-disable-line

  // Tab badge'leri
  const filesBadge  = fileTransfer.pendingFiles.length > 0 || !!fileTransfer.incomingMeta
  const editorBadge = docEditor.editorOpen
  const chatBadge   = chat.unread > 0
  const callBadge   = call.callState === 'incoming'

  // Editör açılınca otomatik tab geçişi
  const prevEditorOpen = useRef(false)
  useEffect(() => {
    if (docEditor.editorOpen && !prevEditorOpen.current) setActiveTab('editor')
    prevEditorOpen.current = docEditor.editorOpen
  }, [docEditor.editorOpen])

  // Gelen arama / aktif görüşmede Arama sekmesine geç
  const prevCallState = useRef('idle')
  useEffect(() => {
    if (call.callState !== 'idle' && prevCallState.current === 'idle') setActiveTab('call')
    prevCallState.current = call.callState
  }, [call.callState])

  // Sohbet sekmesi aktifken: okundu bilgisi gönder + okunmadı sıfırla
  useEffect(() => {
    chat.setViewing(activeTab === 'chat')
  }, [activeTab, chat.messages.length]) // eslint-disable-line

  if (fatalErr) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-red-950 border border-red-800 rounded-2xl p-6 max-w-md w-full text-center">
          <p className="text-red-400 font-semibold mb-2">Hata</p>
          <p className="text-gray-300 text-sm">{fatalErr}</p>
          <a href="/" className="mt-4 inline-block text-emerald-400 text-sm hover:underline">← Ana sayfa</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-6 gap-4 max-w-2xl mx-auto">

      {/* Header */}
      <div className="w-full flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          P2P <span className="text-emerald-500 dark:text-emerald-400">LinkDrive</span>
          {role && <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">({role})</span>}
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            title={dark ? 'Açık mod' : 'Koyu mod'}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors text-base"
          >
            {dark ? '☀️' : '🌙'}
          </button>
          <a href="/" className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-sm transition-colors">✕ Çık</a>
        </div>
      </div>

      {/* Bağlantı durumu — her zaman görünür */}
      <ConnectionStatus state={connState} dcReady={dcReady} />

      {/* Link paylaşımı — sadece host, her zaman görünür */}
      {role === 'host' && <ShareLink roomId={roomId} secretKey={secretKey} />}

      {/* Tab çubuğu — kayan pill animasyonu (layoutId) */}
      <div className="w-full flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-2xl p-1">
        {TABS.map(tab => {
          const active   = activeTab === tab.id
          const hasBadge = (tab.id === 'files'  && filesBadge  && activeTab !== 'files') ||
                           (tab.id === 'editor' && editorBadge && activeTab !== 'editor') ||
                           (tab.id === 'chat'   && chatBadge   && activeTab !== 'chat') ||
                           (tab.id === 'call'   && callBadge   && activeTab !== 'call')
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 py-2 text-sm font-semibold rounded-xl transition-colors ${
                active
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 bg-white dark:bg-gray-900 rounded-xl shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
              {hasBadge && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-1.5 right-2 z-10 min-w-[8px] h-2 px-1 flex items-center justify-center bg-red-500 rounded-full text-[9px] text-white leading-none"
                >
                  {tab.id === 'chat' && chat.unread > 0 ? chat.unread : ''}
                </motion.span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab içerikleri — grid stacking: hepsi aynı hücrede, boyut en büyüğe göre sabit kalır */}
      <div className="w-full grid">
        <div style={{ gridArea: '1/1' }} className={activeTab === 'files'  ? '' : 'invisible pointer-events-none'}>
          <FileTransfer dcReady={dcReady} {...fileTransfer} onEditFile={docEditor.openFromUrl} />
        </div>
        <div style={{ gridArea: '1/1' }} className={activeTab === 'call'   ? '' : 'invisible pointer-events-none'}>
          <Call dcReady={dcReady} {...call} />
        </div>
        <div style={{ gridArea: '1/1' }} className={activeTab === 'cinema' ? '' : 'invisible pointer-events-none'}>
          <Cinema dcReady={dcReady} {...cinema} />
        </div>
        <div style={{ gridArea: '1/1' }} className={activeTab === 'chat'   ? '' : 'invisible pointer-events-none'}>
          <Chat dcReady={dcReady} {...chat} />
        </div>
        <div style={{ gridArea: '1/1' }} className={activeTab === 'editor' ? '' : 'invisible pointer-events-none'}>
          <DocEditor dcReady={dcReady} {...docEditor} />
        </div>
      </div>

      {/* Görüşme aktifken başka sekmedeysen sağ altta yüzen pencere */}
      <AnimatePresence>
        {call.callState === 'active' && activeTab !== 'call' && (
          <FloatingCall
            remoteStream={call.remoteStream}
            withVideo={call.withVideo}
            onExpand={() => setActiveTab('call')}
            onEnd={call.endCall}
          />
        )}
      </AnimatePresence>

    </div>
  )
}
