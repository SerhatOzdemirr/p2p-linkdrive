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
