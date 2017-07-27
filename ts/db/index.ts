/**
 * IndexedDB database controller.
 */

const DB_VERSION = 1
let db = null as IDBDatabase

// FF IndexedDB implementation is broken in private mode.
// See https://bugzilla.mozilla.org/show_bug.cgi?id=781982
// Catch the error and NOOP all further DB requests.
const FF_PRIVATE_MODE_MSG = "A mutation operation was attempted on a database that did not allow mutations."
let ffPrivateMode = false

// Expiring post ID object stores.
const postStores = [
  "mine",      // Posts created by this client
  "hidden",    // Posts hidden by client
  "seen",      // Replies to the user's posts that have already been seen
  "seenPost",  // Posts that the user has viewed or scrolled past
]

// Open a connection to the IndexedDB database.
export function init(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const r = indexedDB.open("cutechan", DB_VERSION)
    // Prepare for operation.
    r.onsuccess = () => {
      db = r.result
      db.onerror = throwErr
      // Reload this tab, if another tab requires a DB upgrade.
      db.onversionchange = () => {
        db.close()
        location.reload(true)
      }
      // Delay for quicker starts.
      // setTimeout(() => {
      //   for (let name of postStores) {
      //     deleteExpired(name)
      //   }
      // }, 10000)
      resolve()
    }
    r.onupgradeneeded = upgradeDB
    r.onerror = () => {
      reject(r.error)
    }
  }).catch(err => {
    if (err.message === FF_PRIVATE_MODE_MSG) {
      ffPrivateMode = true
    } else {
      throw err
    }
  })
}

// Upgrade or initialize the database.
function upgradeDB(event: IDBVersionChangeEvent) {
  db = (event.target as any).result
  switch (event.oldVersion) {
  case 0:
    for (const name of postStores) {
      const s = db.createObjectStore(name, {autoIncrement: true})
      s.createIndex("expires", "expires")
      s.createIndex("op", "op")
    }
    break
  }
}

// Helper for throwing errors with event-based error passing.
function throwErr(err: ErrorEvent) {
  throw err
}

// Delete expired keys from post ID object stores.
// function deleteExpired(name: string) {
//   const req = newTransaction(name, true)
//     .index("expires")
//     .openCursor(IDBKeyRange.upperBound(Date.now()))

//   req.onerror = throwErr

//   req.onsuccess = event => {
//     const cursor = (event.target as any).result as IDBCursor
//     if (!cursor) {
//       return
//     }
//     cursor.delete()
//     cursor.continue()
//   }
// }

// Helper for initiating transactions on a single object store
function newTransaction(store: string, write: boolean): IDBObjectStore {
  const t = db.transaction(store, write ? "readwrite" : "readonly")
  t.onerror = throwErr
  return t.objectStore(store)
}

// Read the contents of a postStore for specific threads into an array
export function readIDs(store: string, ...ops: number[]): Promise<number[]> {
  if (ffPrivateMode || !ops.length) return Promise.resolve([])
  ops.sort((a, b) =>
    a - b)
  return new Promise<number[]>((resolve, reject) => {
    const ids: number[] = [],
      req = newTransaction(store, false)
        .index("op")
        .openCursor(IDBKeyRange.bound(ops[0], ops[ops.length - 1]))

    req.onerror = reject

    req.onsuccess = event => {
      const cursor = (event as any).target.result as IDBCursorWithValue
      if (cursor) {
        if (ops.includes(cursor.value.op)) {
          ids.push(cursor.value.id)
        }
        cursor.continue()
      } else {
        resolve(ids)
      }
    }
  })
}

// Asynchronously insert a new expiring post id object into a postStore
export function storeID(store: string, id: number, op: number, expiry: number) {
  if (ffPrivateMode) return
  addObj(store, {
    id, op,
    expires: Date.now() + expiry,
  })
}

function addObj(store: string, obj: any) {
  newTransaction(store, true).add(obj).onerror = throwErr
}

// Clear the target object store asynchronously
export function clearStore(store: string) {
  if (ffPrivateMode) return
  const trans = newTransaction(store, true),
    req = trans.clear()
  req.onerror = throwErr
}

// Retrieve an object from a specific object store
export function getObj<T>(store: string, id: any): Promise<T> {
  if (ffPrivateMode) return Promise.resolve({} as T)
  return new Promise<T>((resolve, reject) => {
    const t = newTransaction(store, false),
      r = t.get(id)
    r.onerror = () =>
      reject(r.error)
    r.onsuccess = () =>
      resolve(r.result)
  })
}

// Put an object in the specific object store
export function putObj(store: string, obj: any): Promise<void> {
  if (ffPrivateMode) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const t = newTransaction(store, true),
      r = t.put(obj)
    r.onerror = () =>
      reject(r.error)
    r.onsuccess = () =>
      resolve()
  })
}
