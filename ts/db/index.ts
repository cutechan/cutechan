/**
 * IndexedDB database controller.
 */

const DB_VERSION = 6;
let db = null as IDBDatabase;
let dbDisabled = false;

// Post number sets.
const postStores = [
  "mine",
];

// Store for caching embed metadata.
const embedStore = "embedCache";

/** Open a connection to the IndexedDB database. */
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
        deleteExpired(embedStore);
      }, 10000);

      resolve();
    };
    r.onupgradeneeded = upgradeDB;
    r.onerror = () => {
      reject(r.error);
    };
  }).catch((err) => {
    if (
      // IndexedDB is unavailable in Tor Browser.
      typeof indexedDB === "undefined"
      // FF IndexedDB implementation is broken in private mode, see:
      // <https://bugzilla.mozilla.org/show_bug.cgi?id=781982>.
      || err.message === "A mutation operation was attempted on a database that did not allow mutations."
    ) {
      dbDisabled = true;
      return;
    }
    throw err;
  });
}

// Upgrade or initialize the database.
function upgradeDB({ oldVersion, target }: IDBVersionChangeEvent) {
  db = (target as IDBRequest).result;
  const t = (target as IDBRequest).transaction;
  // Helpers because case statements are not blocks.
  let r = null as IDBRequest;
  let s = null as IDBObjectStore;

  switch (oldVersion) {
  // Clean state.
  case 0:
    for (const name of postStores) {
      s = db.createObjectStore(name, {keyPath: "id"});
      s.createIndex("op", "op");
    }
    s = db.createObjectStore(embedStore, {keyPath: "url"});
    s.createIndex("expires", "expires");
    break;
  // Migrations. Must fall through.
  case 1:
    s = db.createObjectStore(embedStore, {keyPath: "url"});
    s.createIndex("expires", "expires");
    /* fall-through */
  case 2:
  case 3:
    t.objectStore(embedStore).clear();
    /* fall-through */
  case 4:
    db.deleteObjectStore("seen");
    db.deleteObjectStore("seenPost");
    db.deleteObjectStore("hidden");

    const mine = [] as Array<[number, number]>;
    const migrateMine = () => {
      db.deleteObjectStore("mine");
      s = db.createObjectStore("mine", {keyPath: "id"});
      s.createIndex("op", "op");
      for (const [id, op] of mine) {
        s.put({id, op});
      }
    };

    r = t.objectStore("mine").openCursor();
    r.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) {
        mine.push([cursor.value.id, cursor.value.op]);
        cursor.continue();
      } else {
        migrateMine();
      }
    };
    /* fall-through */
  case 5:
    const mine2 = [] as number[];
    const migrateMine2 = () => {
      localStorage.mine = JSON.stringify(mine2);
      // Keep post store for now.
    };

    r = t.objectStore("mine").openCursor();
    r.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) {
        mine2.push(cursor.value.id);
        cursor.continue();
      } else {
        migrateMine2();
      }
    };
    /* fall-through */
  }
}

// Helper for logging errors with event-based error passing.
function logErr(err: ErrorEvent) {
  // tslint:disable-next-line:no-console
  console.error(err);
}

// Delete expired records from object store.
function deleteExpired(name: string) {
  const r = newTransaction(name, true)
    .index("expires")
    .openCursor(IDBKeyRange.upperBound(Date.now()));

  r.onsuccess = (event) => {
    const cursor = (event.target as IDBRequest).result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };

  r.onerror = logErr;
}

// Helper for initiating transactions on a single object store.
function newTransaction(store: string, write: boolean): IDBObjectStore {
  const t = db.transaction(store, write ? "readwrite" : "readonly");
  t.onerror = logErr;
  return t.objectStore(store);
}

// Retrieve an object from a specific object store.
function getObj<T>(store: string, id: any): Promise<T> {
  if (dbDisabled) return Promise.reject(new Error("db unavailable"));
  return new Promise((resolve, reject) => {
    const r = newTransaction(store, false).get(id);

    r.onsuccess = () => {
      if (!r.result) {
        reject(new Error("empty getObj result"));
        return;
      }
      resolve(r.result);
    };

    r.onerror = () => {
      reject(r.error);
    };
  });
}

// Insert or update object.
function putObj(store: string, obj: any) {
  if (dbDisabled) return;
  newTransaction(store, true).put(obj).onerror = logErr;
}

/** Read the contents of a postStore for specific threads into an array. */
export function getIDs(store: string, ...ops: number[]): Promise<number[]> {
  if (dbDisabled || !ops.length) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const ids = [] as number[];
    // DB API doesn't support queries like `op IN (1, 2, 3)`, so use
    // `first_op < op < last_op` instead. Doesn't matter if we will read
    // more IDs than needed.
    ops.sort((a, b) => a - b);
    const r = newTransaction(store, false)
        .index("op")
        .openCursor(IDBKeyRange.bound(ops[0], ops[ops.length - 1]));

    r.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) {
        ids.push(cursor.value.id);
        cursor.continue();
      } else {
        resolve(ids);
      }
    };

    r.onerror = () => {
      reject(r.error);
    };
  });
}

/** Asynchronously add new post id object into postStore. */
export function setID(store: string, id: number, op: number) {
  putObj(store, {id, op});
}

/** Clear the target object store asynchronously. */
export function clearStore(store: string) {
  if (dbDisabled) return;
  newTransaction(store, true).clear().onerror = logErr;
}

// TODO(Kagami): Normalize urls, e.g. `youtube.com/watch?v=xxx` and
// `youtu.be/xxx` should be stored under the same key.
export function getEmbed<T>(url: string): Promise<T> {
  return getObj<T>(embedStore, url);
}

export function setEmbed(url: string, obj: any, expiry: number) {
  const expires = Date.now() + expiry;
  return putObj(embedStore, {...obj, url, expires});
}
