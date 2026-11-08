// pendingRecords — the phone-side outbox for records captured while offline.
// Records saved here stay ONLY on this device until the network returns; the
// register table then uploads them in order through the normal create API.
// Serials are assigned at upload time on the server, so numbers never collide.
"use client";

export const PENDING_DB = "zc-pending-outbox";
const STORE = "records";

export type PendingRecord = {
  pendingId: string;      // client-generated dedupe key (also sent to the server)
  payload: Record<string, unknown>; // exact body for POST /api/records
  createdAt: string;      // captured on-device
  note: string;           // why it is still waiting (info only)
  attempts?: number;
};

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const rq = indexedDB.open(PENDING_DB, 1);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: "pendingId" });
          s.createIndex("createdAt", "createdAt");
        }
      };
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => resolve(null);
      rq.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function txRun<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const rq = fn(tx.objectStore(STORE));
      rq.onsuccess = () => resolve(rq.result as T);
      rq.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function putPending(rec: PendingRecord): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await txRun(db, "readwrite", (s) => s.put(rec));
  db.close();
}

export async function listPending(): Promise<PendingRecord[]> {
  const db = await openDb();
  if (!db) return [];
  const out = await txRun<PendingRecord[]>(db, "readonly", (s) => s.getAll() as IDBRequest);
  db.close();
  return (out || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // oldest first
}

export async function deletePending(pendingId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await txRun(db, "readwrite", (s) => s.delete(pendingId));
  db.close();
}

export async function markPendingError(pendingId: string, note: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const cur = await txRun<PendingRecord>(db, "readonly", (s) => s.get(pendingId) as IDBRequest);
  if (cur) {
    cur.note = note;
    cur.attempts = (cur.attempts || 0) + 1;
    await txRun(db, "readwrite", (s) => s.put(cur));
  }
  db.close();
}