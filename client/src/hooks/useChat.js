// hooks/useChat.js — gerçek zamanlı sohbet (DataChannel üzerinden, AES-256 şifreli)
import { useState, useRef, useCallback, useEffect } from 'react'

export function useChat({ dcReady, sendEncrypted, registerMessageHandler }) {
  const [messages, setMessages] = useState([]) // { from: 'self'|'peer', text, ts }
  const [input, setInput]       = useState('')
  const [peerTyping, setPeerTyping] = useState(false)
  const [unread, setUnread]     = useState(0)

  const typingTimerRef    = useRef(null)
  const selfTypingSentRef = useRef(false)

  const handleMessage = useCallback((msg) => {
    if (msg.type === 'CHAT_MSG') {
      setMessages(prev => [...prev, { from: 'peer', text: msg.text, ts: msg.ts }])
      setPeerTyping(false)
      setUnread(u => u + 1)
    }
    if (msg.type === 'CHAT_TYPING') {
      setPeerTyping(true)
      clearTimeout(typingTimerRef.current)
      typingTimerRef.current = setTimeout(() => setPeerTyping(false), 2000)
    }
  }, [])

  useEffect(() => {
    registerMessageHandler('CHAT_MSG', handleMessage)
    registerMessageHandler('CHAT_TYPING', handleMessage)
  }, []) // eslint-disable-line

  function send() {
    const text = input.trim()
    if (!text || !dcReady) return
    const ts = Date.now()
    setMessages(prev => [...prev, { from: 'self', text, ts }])
    sendEncrypted({ type: 'CHAT_MSG', text, ts })
    setInput('')
    selfTypingSentRef.current = false
  }

  function handleInputChange(value) {
    setInput(value)
    // "Yazıyor" sinyali — saniyede bir kez
    if (dcReady && !selfTypingSentRef.current && value.trim()) {
      selfTypingSentRef.current = true
      sendEncrypted({ type: 'CHAT_TYPING' })
      setTimeout(() => { selfTypingSentRef.current = false }, 1000)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const clearUnread = useCallback(() => setUnread(0), [])

  return {
    messages, input, peerTyping, unread,
    handleInputChange, send, handleKeyDown, clearUnread,
  }
}
