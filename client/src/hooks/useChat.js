// hooks/useChat.js — gerçek zamanlı sohbet + okundu bilgisi (tek/çift tik, mavi)
import { useState, useRef, useCallback, useEffect } from 'react'

export function useChat({ dcReady, sendEncrypted, registerMessageHandler }) {
  const [messages, setMessages] = useState([]) // { from, text, ts, status? }
  const [input, setInput]       = useState('')
  const [peerTyping, setPeerTyping] = useState(false)
  const [unread, setUnread]     = useState(0)

  const typingTimerRef    = useRef(null)
  const selfTypingSentRef = useRef(false)
  const viewingRef        = useRef(false)
  const lastPeerTsRef     = useRef(0)
  const lastTsRef         = useRef(0) // gönderilen mesajlara benzersiz artan ts

  function sendRead() {
    if (lastPeerTsRef.current && dcReady) {
      sendEncrypted({ type: 'CHAT_READ', ts: lastPeerTsRef.current })
    }
  }

  const handleMessage = useCallback((msg) => {
    if (msg.type === 'CHAT_MSG') {
      lastPeerTsRef.current = msg.ts
      setMessages(prev => [...prev, { from: 'peer', text: msg.text, ts: msg.ts }])
      setPeerTyping(false)
      sendEncrypted({ type: 'CHAT_DELIVERED', ts: msg.ts }) // ✓✓ ulaştı
      if (viewingRef.current) {
        sendEncrypted({ type: 'CHAT_READ', ts: msg.ts })    // mavi: zaten bakıyorum
      } else {
        setUnread(u => u + 1)
      }
    }
    else if (msg.type === 'CHAT_TYPING') {
      setPeerTyping(true)
      clearTimeout(typingTimerRef.current)
      typingTimerRef.current = setTimeout(() => setPeerTyping(false), 2000)
    }
    else if (msg.type === 'CHAT_DELIVERED') {
      setMessages(prev => prev.map(m =>
        m.from === 'self' && m.ts === msg.ts && m.status !== 'read'
          ? { ...m, status: 'delivered' } : m))
    }
    else if (msg.type === 'CHAT_READ') {
      setMessages(prev => prev.map(m =>
        m.from === 'self' && m.ts <= msg.ts ? { ...m, status: 'read' } : m))
    }
  }, [])

  useEffect(() => {
    ['CHAT_MSG', 'CHAT_TYPING', 'CHAT_DELIVERED', 'CHAT_READ']
      .forEach(t => registerMessageHandler(t, handleMessage))
  }, []) // eslint-disable-line

  function send() {
    const text = input.trim()
    if (!text || !dcReady) return
    const ts = Math.max(Date.now(), lastTsRef.current + 1) // benzersiz + artan
    lastTsRef.current = ts
    setMessages(prev => [...prev, { from: 'self', text, ts, status: 'sent' }])
    sendEncrypted({ type: 'CHAT_MSG', text, ts })
    setInput('')
    selfTypingSentRef.current = false
  }

  function handleInputChange(value) {
    setInput(value)
    if (dcReady && !selfTypingSentRef.current && value.trim()) {
      selfTypingSentRef.current = true
      sendEncrypted({ type: 'CHAT_TYPING' })
      setTimeout(() => { selfTypingSentRef.current = false }, 1000)
    }
  }

  function insertEmoji(emoji) {
    setInput(prev => prev + emoji)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Sohbet sekmesi görünür olunca: okundu gönder + okunmadı sıfırla
  const setViewing = useCallback((v) => {
    viewingRef.current = v
    if (v) {
      setUnread(0)
      sendRead()
    }
  }, [dcReady]) // eslint-disable-line

  return {
    messages, input, peerTyping, unread,
    handleInputChange, send, handleKeyDown, insertEmoji, setViewing,
  }
}
