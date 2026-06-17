// pages/Room.jsx
import { useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useRoom } from '../hooks/useRoom.js'
import { useFileTransfer } from '../hooks/useFileTransfer.js'
import { useClipboard } from '../hooks/useClipboard.js'
import ShareLink from '../components/ShareLink.jsx'
import ConnectionStatus from '../components/ConnectionStatus.jsx'
import MessageTest from '../components/MessageTest.jsx'
import FileTransfer from '../components/FileTransfer.jsx'
import ClipboardShare from '../components/ClipboardShare.jsx'

export default function Room() {
  const { roomId } = useParams()
  const secretKey  = useRef(window.location.hash.slice(1)).current

  const {
    role, connState, dcReady, fatalErr,
    messages, dcRef, sendEncrypted, registerMessageHandler, sendPing,
  } = useRoom(roomId, secretKey)

  const fileTransfer = useFileTransfer({ dcReady, dcRef, sendEncrypted, registerMessageHandler })
  const clipboard    = useClipboard({ dcReady, sendEncrypted, registerMessageHandler })

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
    <div className="min-h-screen flex flex-col items-center px-4 py-8 gap-6 max-w-2xl mx-auto">

      <div className="w-full flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">
          P2P <span className="text-emerald-400">LinkDrive</span>
          {role && <span className="ml-2 text-sm font-normal text-gray-400">({role})</span>}
        </h1>
        <a href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">✕ Çık</a>
      </div>

      <ConnectionStatus state={connState} dcReady={dcReady} />

      {role === 'host' && <ShareLink roomId={roomId} secretKey={secretKey} />}

      <FileTransfer dcReady={dcReady} {...fileTransfer} />

      <ClipboardShare dcReady={dcReady} {...clipboard} />

      <MessageTest dcReady={dcReady} messages={messages} onSend={sendPing} />
    </div>
  )
}
