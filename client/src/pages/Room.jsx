// pages/Room.jsx
import { useRef, useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useRoom } from '../hooks/useRoom.js'
import { useFileTransfer } from '../hooks/useFileTransfer.js'
import { useClipboard } from '../hooks/useClipboard.js'
import { useTheme } from '../hooks/useTheme.js'
import { useCanvas } from '../hooks/useCanvas.js'
import { useDocEditor } from '../hooks/useDocEditor.js'
import ShareLink from '../components/ShareLink.jsx'
import ConnectionStatus from '../components/ConnectionStatus.jsx'
import MessageTest from '../components/MessageTest.jsx'
import FileTransfer from '../components/FileTransfer.jsx'
import ClipboardShare from '../components/ClipboardShare.jsx'
import Canvas from '../components/Canvas.jsx'
import DocEditor from '../components/DocEditor.jsx'

const TABS = [
  { id: 'files',   label: 'Dosyalar' },
  { id: 'canvas',  label: 'Tahta'    },
  { id: 'text',    label: 'Metin'    },
  { id: 'editor',  label: 'Editör'   },
  { id: 'test',    label: 'Test'     },
]

export default function Room() {
  const { roomId }        = useParams()
  const secretKey         = useRef(window.location.hash.slice(1)).current
  const { dark, toggle }  = useTheme()
  const [activeTab, setActiveTab] = useState('files')

  const {
    role, connState, dcReady, fatalErr,
    messages, dcRef, sendEncrypted, registerMessageHandler, sendPing,
  } = useRoom(roomId, secretKey)

  const fileTransfer = useFileTransfer({ dcReady, dcRef, sendEncrypted, registerMessageHandler })
  const clipboard    = useClipboard({ dcReady, sendEncrypted, registerMessageHandler })
  const canvas       = useCanvas({ dcReady, sendEncrypted, registerMessageHandler })
  const docEditor    = useDocEditor({ dcReady, sendEncrypted, registerMessageHandler })

  // Tab badge'leri
  const filesBadge   = fileTransfer.pendingFiles.length > 0 || !!fileTransfer.incomingMeta
  const editorBadge  = docEditor.editorOpen

  // Editör açılınca otomatik tab geçişi
  const prevEditorOpen = useRef(false)
  useEffect(() => {
    if (docEditor.editorOpen && !prevEditorOpen.current) setActiveTab('editor')
    prevEditorOpen.current = docEditor.editorOpen
  }, [docEditor.editorOpen])

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

      {/* Tab çubuğu */}
      <div className="w-full flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-2xl p-1">
        {TABS.map(tab => {
          const hasBadge = (tab.id === 'files' && filesBadge && activeTab !== 'files') ||
                           (tab.id === 'editor' && editorBadge && activeTab !== 'editor')
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 py-2 text-sm font-semibold rounded-xl transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
              {hasBadge && (
                <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab içerikleri — grid stacking: hepsi aynı hücrede, boyut en büyüğe (Tahta) göre sabit kalır */}
      <div className="w-full grid">
        <div style={{ gridArea: '1/1' }} className={activeTab === 'files'  ? '' : 'invisible pointer-events-none'}>
          <FileTransfer dcReady={dcReady} {...fileTransfer} onEditFile={docEditor.openFromUrl} />
        </div>
        <div style={{ gridArea: '1/1' }} className={activeTab === 'canvas' ? '' : 'invisible pointer-events-none'}>
          <Canvas dcReady={dcReady} {...canvas} />
        </div>
        <div style={{ gridArea: '1/1' }} className={activeTab === 'text'   ? '' : 'invisible pointer-events-none'}>
          <ClipboardShare dcReady={dcReady} {...clipboard} />
        </div>
        <div style={{ gridArea: '1/1' }} className={activeTab === 'editor' ? '' : 'invisible pointer-events-none'}>
          <DocEditor dcReady={dcReady} {...docEditor} />
        </div>

        <div style={{ gridArea: '1/1' }} className={activeTab === 'test'   ? '' : 'invisible pointer-events-none'}>
          <MessageTest dcReady={dcReady} messages={messages} onSend={sendPing} />
        </div>
      </div>

    </div>
  )
}
