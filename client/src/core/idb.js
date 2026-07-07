// core/idb.js — küçük IndexedDB sarmalayıcı (yarım kalan transfer durumu)
const DB_NAME = 'linkdrive'
const STORE   = 'transfers'
let dbPromise = null

function open() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => res(req.result)
    req.onerror   = () => rej(req.error)
  })
  return dbPromise
}

function run(mode, fn) {
  return open().then(db => new Promise((res, rej) => {
    const tx    = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    const out   = fn(store)
    tx.oncomplete = () => res(out?.result ?? out)
    tx.onerror    = () => rej(tx.error)
  }))
}

// { id, name, size, mime, totalChunks, receivedChunks }
export const idbPut     = (rec)  => run('readwrite', s => s.put(rec)).catch(() => {})
export const idbDelete  = (id)   => run('readwrite', s => s.delete(id)).catch(() => {})
export const idbGetAll  = ()     => run('readonly',  s => s.getAll()).catch(() => [])
