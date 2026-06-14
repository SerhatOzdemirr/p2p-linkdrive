# P2P LinkDrive

> Tarayıcıdan tarayıcıya, sıfır bilgi, sunucusuz dosya paylaşımı.
> WebRTC DataChannel + AES-GCM 256-bit şifreleme.

## Hızlı Başlangıç

### Sunucu
```bash
cd server
npm install
npm run dev
```

### Client
```bash
cd client
npm install
cp .env.example .env
npm run dev
```

## Mimari

```
URL: /room/{32-hex-roomId}#{64-hex-aesKey}
```

- `roomId` → sunucu görür (oda yönetimi için)
- `aesKey` → `#` fragment'ta, sunucuya **hiç gitmez** (Zero-Knowledge)

## Faz Planı

- [x] Faz 1: P2P bağlantı + DataChannel
- [ ] Faz 2: AES-GCM şifreleme + klasör ağacı
- [ ] Faz 3: On-demand dosya transferi + backpressure
- [ ] Faz 4: Resume + hata yönetimi
