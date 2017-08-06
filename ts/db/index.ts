/**
 * IndexedDB database controller.
 */

const DB_VERSION = 3;
let db = null as IDBDatabase;

// FF IndexedDB implementation is broken in private mode, see:
// <https://bugzilla.mozilla.org/show_bug.cgi?id=781982>.
// Catch the error and NOOP all further DB requests.
const FF_PRIVATE_MODE_MSG = "A mutation operation was attempted on a database that did not allow mutations.";
let ffPrivateMode = false;

// Expiring post ID object stores.
const postStores = [
  "mine",      // Posts created by this client
  "hidden",    // Posts hidden by client
  "seen",      // Replies to the user's posts that have already been seen
  "seenPost",  // Posts that the user has viewed or scrolled past
];

// Store for caching embed metadata.
const embedStore = "embedCache";

// Open a connection to the IndexedDB database.
export function init(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const r = indexedDB.open("cutechan", DB_VERSION);
    // Prepare for operation.
    r.onsuccess = () => {
      db = r.result;
      db.onerror = logErr;

      // Reload this tab, if another tab requires a DB upgrade.
      // TODO(Kagami): Set onbeforeunload in reply-form in order to
      // avoid losing typed text.
      db.onversionchange = () => {
        db.close();
        location.reload(true);
      };

      // Delay for quicker starts.
      setTimeout(() => {
        // No need to delete IDs because they consume quite a little of
        // disk space and threads might be alive for several years so it
        // doesn't make sense to show old posts as unread again.
        //
        // for (let name of postStores) {
        //   deleteExpired(name)
        // }

        // On the other hand, no need to store embed metadata for a long
        // time, it's just a cache.
        deleteExpired(embedStore);
      }, 10000);

      resolve();
    };
    r.onupgradeneeded = upgradeDB;
    r.onerror = () => {
      reject(r.error);
    };
  }).catch((err) => {
    if (err.message === FF_PRIVATE_MODE_MSG) {
      ffPrivateMode = true;
    } else {
      throw err;
    }
  });
}

// Upgrade or initialize the database.
function upgradeDB(event: IDBVersionChangeEvent) {
  const req = event.target as IDBRequest;
  let s = null as IDBObjectStore;
  db = req.result;
  switch (event.oldVersion) {
  case 0:
    for (const name of postStores) {
      s = db.createObjectStore(name, {autoIncrement: true});
      s.createIndex("expires", "expires");
      s.createIndex("op", "op");
    }
    s = db.createObjectStore(embedStore, {keyPath: "url"});
    s.createIndex("expires", "expires");
    break;
  case 1:
    s = db.createObjectStore(embedStore, {keyPath: "url"});
    s.createIndex("expires", "expires");
    break;
  case 2:
    s = req.transaction.objectStore(embedStore);
    s.clear();
    break;
  }
}

// Helper for logging errors with event-based error passing.
function logErr(err: ErrorEvent) {
  // tslint:disable-next-line:no-console
  console.error(err);
}

// Delete expired records from object store.
function deleteExpired(name: string) {
  const req = newTransaction(name, true)
    .index("expires")
    .openCursor(IDBKeyRange.upperBound(Date.now()));

  req.onsuccess = (event) => {
    const cursor = (event.target as any).result as IDBCursor;
    if (!cursor) return;
    cursor.delete();
    cursor.continue();
  };

  req.onerror = logErr;
}

// Helper for initiating transactions on a single object store
function newTransaction(store: string, write: boolean): IDBObjectStore {
  const t = db.transaction(store, write ? "readwrite" : "readonly");
  t.onerror = logErr;
  return t.objectStore(store);
}

// Read the contents of a postStore for specific threads into an array
export function readIDs(store: string, ...ops: number[]): Promise<number[]> {
  if (ffPrivateMode || !ops.length) return Promise.resolve([]);
  ops.sort((a, b) =>
    a - b);
  return new Promise<number[]>((resolve, reject) => {
    const ids: number[] = [];
    const req = newTransaction(store, false)
        .index("op")
        .openCursor(IDBKeyRange.bound(ops[0], ops[ops.length - 1]));

    req.onerror = reject;

    req.onsuccess = (event) => {
      const cursor = (event as any).target.result as IDBCursorWithValue;
      if (cursor) {
        if (ops.includes(cursor.value.op)) {
          ids.push(cursor.value.id);
        }
        cursor.continue();
      } else {
        resolve(ids);
      }
    };
  });
}

// Retrieve an object from a specific object store.
function getObj<T>(store: string, id: any): Promise<T> {
  if (ffPrivateMode) return Promise.resolve({} as T);
  return new Promise<T>((resolve, reject) => {
    const t = newTransaction(store, false);
    const req = t.get(id);
    req.onsuccess = () => {
      if (!req.result) {
        reject(new Error());
        return;
      }
      resolve(req.result);
    };
    req.onerror = () => {
      reject(req.error);
    };
  });
}

// Insert object.
function addObj(store: string, obj: any) {
  newTransaction(store, true).add(obj).onerror = logErr;
}

// Insert or update object.
function putObj(store: string, obj: any) {
  newTransaction(store, true).put(obj).onerror = logErr;
}

// Asynchronously insert a new expiring post id object into a postStore.
export function storeID(store: string, id: number, op: number, expiry: number) {
  if (ffPrivateMode) return;
  addObj(store, {id, op, expires: Date.now() + expiry });
}

// Clear the target object store asynchronously.
export function clearStore(store: string) {
  if (ffPrivateMode) return;
  const trans = newTransaction(store, true);
  const req = trans.clear();
  req.onerror = logErr;
}

// TODO(Kagami): Normalize urls, `youtube.com/watch?v=xxx` and
// `youtu.be/xxx` should be stored under the same key.
export function getEmbed<T>(url: string): Promise<T> {
  return getObj<T>(embedStore, url);
}

export function storeEmbed(url: string, obj: any, expiry: number) {
  const expires = Date.now() + expiry;
  return putObj(embedStore, {...obj, url, expires});
}
