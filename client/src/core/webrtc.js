// core/webrtc.js — RTCPeerConnection yaşam döngüsü

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

const TURN_URL  = import.meta.env.VITE_TURN_URL
const TURN_USER = import.meta.env.VITE_TURN_USER
const TURN_PASS = import.meta.env.VITE_TURN_PASS

if (TURN_URL && TURN_USER && TURN_PASS) {
  ICE_SERVERS.push({ urls: TURN_URL, username: TURN_USER, credential: TURN_PASS })
}

/**
 * Peer bağlantısı yöneticisi.
 * onDataChannel: (RTCDataChannel) => void
 * onConnectionChange: (state: string) => void
 */
export class PeerConnection {
  constructor({ onDataChannel, onConnectionChange, onIceCandidate }) {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.dc = null
    this._onDataChannel    = onDataChannel
    this._onConnChange     = onConnectionChange
    this._onIceCandidate   = onIceCandidate

    this._bindEvents()
  }

  _bindEvents() {
    const pc = this.pc

    // ICE adayları — trickle: geldiği anda gönder
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this._onIceCandidate(candidate)
    }

    // Bağlantı durumu değişimi
    pc.onconnectionstatechange = () => {
      this._onConnChange(pc.connectionState)
    }

    // Guest tarafı: Host'un açtığı DataChannel'ı yakala
    pc.ondatachannel = ({ channel }) => {
      this.dc = channel
      this._setupDataChannel(channel)
      this._onDataChannel(channel)
    }

    // Uzak medya track'i geldi (sesli/görüntülü arama)
    pc.ontrack = (e) => { this._onTrack?.(e) }
  }

  // ── Medya (arama) ────────────────────────────────────────────────────────
  setOnTrack(cb) { this._onTrack = cb }

  addLocalStream(stream) {
    for (const track of stream.getTracks()) this.pc.addTrack(track, stream)
  }

  /** Mevcut bağlantı üzerinde medya için yeniden anlaşma offer'ı */
  async createRenegotiationOffer() {
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    return offer
  }

  /** Arama biterken yerel track'leri durdur ve kaldır */
  stopLocalTracks() {
    for (const sender of this.pc.getSenders()) {
      if (sender.track) {
        sender.track.stop()
        try { this.pc.removeTrack(sender) } catch {}
      }
    }
  }

  getVideoSender() {
    return this.pc.getSenders().find(s => s.track && s.track.kind === 'video')
  }

  /** Giden video track'ini değiştir (kamera ↔ ekran) — renegotiation gerektirmez */
  async replaceVideoTrack(track) {
    const sender = this.getVideoSender()
    if (sender) { await sender.replaceTrack(track); return true }
    return false
  }

  addTrackToStream(track, stream) {
    this.pc.addTrack(track, stream)
  }

  /** Bir track'in maksimum bitrate'ini ayarla (sinema için yüksek kalite) */
  async setTrackMaxBitrate(track, bps) {
    const sender = this.pc.getSenders().find(s => s.track === track)
    if (!sender) return
    const params = sender.getParameters()
    if (!params.encodings || !params.encodings.length) params.encodings = [{}]
    params.encodings[0].maxBitrate   = bps
    params.encodings[0].maxFramerate = 30
    // Akıcılık öncelikli: bant düşünce çözünürlüğü kıs ama fps'i koru → film takılmaz
    params.degradationPreference = 'balanced'
    try { await sender.setParameters(params) } catch {}
  }

  /** Host DataChannel açar */
  createDataChannel(label = 'linkdrive') {
    this.dc = this.pc.createDataChannel(label, {
      ordered: true, // TCP-like güvenilir teslimat
    })
    this.dc.binaryType = 'arraybuffer'
    this._setupDataChannel(this.dc)
    this._onDataChannel(this.dc)
    return this.dc
  }

  _setupDataChannel(dc) {
    dc.binaryType = 'arraybuffer'
    // Backpressure eşiği (Faz 3 transfer'da kullanılacak)
    dc.bufferedAmountLowThreshold = 8 * 1024 * 1024 // 8 MB
  }

  async createOffer() {
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    return offer
  }

  /** ICE'i yeniden başlat — kopan bağlantıyı kurtarır (sadece host çağırmalı) */
  async restartIce() {
    const offer = await this.pc.createOffer({ iceRestart: true })
    await this.pc.setLocalDescription(offer)
    return offer
  }

  async handleOffer(offer) {
    await this.pc.setRemoteDescription(offer)
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    return answer
  }

  async handleAnswer(answer) {
    await this.pc.setRemoteDescription(answer)
  }

  async addIceCandidate(candidate) {
    try {
      await this.pc.addIceCandidate(candidate)
    } catch (e) {
      console.warn('[ICE] Aday eklenemedi:', e)
    }
  }

  get connectionState() {
    return this.pc.connectionState
  }

  close() {
    this.dc?.close()
    this.pc.close()
  }
}
