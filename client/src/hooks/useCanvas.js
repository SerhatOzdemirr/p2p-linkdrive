// hooks/useCanvas.js
import { useState, useRef, useCallback, useEffect } from 'react'

const CANVAS_W = 1200
const CANVAS_H = 675

export function useCanvas({ dcReady, sendEncrypted, registerMessageHandler }) {
  const canvasRef  = useRef(null)
  const isDrawing  = useRef(false)
  const lastPos    = useRef({ x: 0, y: 0 })

  const [color, setColor] = useState('#22c55e')
  const [size, setSize]   = useState(4)
  const [tool, setTool]   = useState('pen') // 'pen' | 'eraser'

  // Kanvası beyaz zemin ile başlat
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  function drawSegment(ctx, x0, y0, x1, y1, c, s, t) {
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.strokeStyle = t === 'eraser' ? '#ffffff' : c
    ctx.lineWidth   = t === 'eraser' ? s * 4 : s
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.stroke()
  }

  const handleMessage = useCallback((msg) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    if (msg.type === 'CANVAS_DRAW') {
      drawSegment(ctx, msg.x0, msg.y0, msg.x1, msg.y1, msg.color, msg.size, msg.tool)
    }
    if (msg.type === 'CANVAS_CLEAR') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
  }, [])

  useEffect(() => {
    registerMessageHandler('CANVAS_DRAW', handleMessage)
    registerMessageHandler('CANVAS_CLEAR', handleMessage)
  }, []) // eslint-disable-line

  function getPos(e) {
    const canvas = canvasRef.current
    const rect   = canvas.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    const src    = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top)  * scaleY,
    }
  }

  function onPointerDown(e) {
    e.preventDefault()
    isDrawing.current = true
    lastPos.current   = getPos(e)
  }

  function onPointerMove(e) {
    if (!isDrawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx  = canvas.getContext('2d')
    const pos  = getPos(e)
    const { x: x0, y: y0 } = lastPos.current
    const { x: x1, y: y1 } = pos

    // Çok küçük hareket → atla (DataChannel flood koruması)
    if (Math.abs(x1 - x0) < 1 && Math.abs(y1 - y0) < 1) return

    drawSegment(ctx, x0, y0, x1, y1, color, size, tool)
    if (dcReady) {
      sendEncrypted({ type: 'CANVAS_DRAW', x0, y0, x1, y1, color, size, tool })
    }
    lastPos.current = pos
  }

  function onPointerUp(e) {
    isDrawing.current = false
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (dcReady) sendEncrypted({ type: 'CANVAS_CLEAR' })
  }

  function downloadCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link    = document.createElement('a')
    link.download = 'linkdrive-canvas.png'
    link.href     = canvas.toDataURL('image/png')
    link.click()
  }

  return {
    canvasRef,
    color, setColor,
    size, setSize,
    tool, setTool,
    onPointerDown, onPointerMove, onPointerUp,
    clearCanvas, downloadCanvas,
  }
}
