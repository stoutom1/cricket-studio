"use client";

const DB_NAME = "cric4all-offline-scoring";
const DB_VERSION = 1;
const EVENT_STORE = "ballEvents";
const META_STORE = "meta";

function hasIndexedDb() {
  return typeof window !== "undefined" && Boolean(window.indexedDB);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted."));
  });
}

let dbPromise = null;

function openDb() {
  if (!hasIndexedDb()) {
    return Promise.reject(new Error("IndexedDB is not available on this device."));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(EVENT_STORE)) {
        const store = db.createObjectStore(EVENT_STORE, {
          keyPath: "clientEventId",
        });
        store.createIndex("matchId", "matchId", { unique: false });
        store.createIndex("matchStatus", ["matchId", "status"], { unique: false });
        store.createIndex("localOrder", "localOrder", { unique: false });
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };

    request.onerror = () => reject(request.error || new Error("Unable to open offline scoring database."));
  });

  return dbPromise;
}

export function createClientEventId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `c4a-${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

export async function getOfflineDeviceId() {
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readwrite");
  const store = tx.objectStore(META_STORE);
  const existing = await requestToPromise(store.get("deviceId"));

  if (existing?.value) {
    await transactionDone(tx);
    return existing.value;
  }

  const value = createClientEventId();
  store.put({ key: "deviceId", value });
  await transactionDone(tx);
  return value;
}

export async function queueOfflineBall(event) {
  const db = await openDb();
  const tx = db.transaction(EVENT_STORE, "readwrite");
  tx.objectStore(EVENT_STORE).put({
    ...event,
    status: "PENDING",
    createdAt: event.createdAt || new Date().toISOString(),
    localOrder: Number(event.localOrder || Date.now() * 1000 + Math.floor(Math.random() * 999)),
  });
  await transactionDone(tx);
  return event;
}

export async function removeOfflineBall(clientEventId) {
  const db = await openDb();
  const tx = db.transaction(EVENT_STORE, "readwrite");
  tx.objectStore(EVENT_STORE).delete(clientEventId);
  await transactionDone(tx);
}

export async function updateOfflineBall(clientEventId, patch) {
  const db = await openDb();
  const tx = db.transaction(EVENT_STORE, "readwrite");
  const store = tx.objectStore(EVENT_STORE);
  const current = await requestToPromise(store.get(clientEventId));
  if (current) store.put({ ...current, ...patch });
  await transactionDone(tx);
}

export async function listPendingOfflineBalls(matchId) {
  const db = await openDb();
  const tx = db.transaction(EVENT_STORE, "readonly");
  const store = tx.objectStore(EVENT_STORE);
  const all = await requestToPromise(store.getAll());
  await transactionDone(tx);

  return (all || [])
    .filter((item) => item.status === "PENDING" && Number(item.matchId) === Number(matchId))
    .sort((a, b) => Number(a.localOrder || 0) - Number(b.localOrder || 0));
}

export async function getPendingOfflineBallCount(matchId) {
  return (await listPendingOfflineBalls(matchId)).length;
}

export async function getLastPendingOfflineBall(matchId) {
  const rows = await listPendingOfflineBalls(matchId);
  return rows.length ? rows[rows.length - 1] : null;
}

export async function cacheOfflineMatchSnapshot(matchId, snapshot) {
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readwrite");
  tx.objectStore(META_STORE).put({
    key: `matchSnapshot:${Number(matchId)}`,
    value: snapshot,
    savedAt: new Date().toISOString(),
  });
  await transactionDone(tx);
}

export async function getOfflineMatchSnapshot(matchId) {
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readonly");
  const value = await requestToPromise(
    tx.objectStore(META_STORE).get(`matchSnapshot:${Number(matchId)}`)
  );
  await transactionDone(tx);
  return value?.value || null;
}

export function isOfflineRetryableError(error) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (!error?.status) return true; // fetch/network failure
  return Number(error.status) >= 500;
}

function keeperChangeMetaKey(matchId) {
  return `pendingKeeperChanges:${Number(matchId)}`;
}

export async function listPendingOfflineKeeperChanges(matchId) {
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readonly");
  const row = await requestToPromise(
    tx.objectStore(META_STORE).get(
      keeperChangeMetaKey(matchId)
    )
  );
  await transactionDone(tx);

  return Array.isArray(row?.value)
    ? [...row.value].sort(
        (a, b) =>
          Number(a.localOrder || 0) -
          Number(b.localOrder || 0)
      )
    : [];
}

export async function queueOfflineKeeperChange(change) {
  const matchId = Number(change?.matchId);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    throw new Error("Invalid match id for offline wicketkeeper change.");
  }

  const db = await openDb();
  const tx = db.transaction(META_STORE, "readwrite");
  const meta = tx.objectStore(META_STORE);
  const key = keeperChangeMetaKey(matchId);
  const current = await requestToPromise(meta.get(key));

  const changes = Array.isArray(current?.value)
    ? current.value
    : [];

  const clientActionId =
    change.clientActionId ||
    createClientEventId();

  /*
   * Replace an unsynced keeper change at the same local point rather than
   * creating accidental duplicates from a double-tap.
   */
  const next = [
    ...changes.filter(
      (item) =>
        item.clientActionId !== clientActionId
    ),
    {
      ...change,
      matchId,
      clientActionId,
      status: "PENDING",
      createdAt:
        change.createdAt ||
        new Date().toISOString(),
      localOrder:
        Number(
          change.localOrder ||
          Date.now() * 1000 +
            Math.floor(
              Math.random() * 999
            )
        ),
    },
  ];

  meta.put({
    key,
    value: next,
    savedAt: new Date().toISOString(),
  });

  await transactionDone(tx);

  return next.find(
    (item) =>
      item.clientActionId ===
      clientActionId
  );
}

export async function removeOfflineKeeperChange(
  matchId,
  clientActionId
) {
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readwrite");
  const meta = tx.objectStore(META_STORE);
  const key = keeperChangeMetaKey(matchId);
  const current = await requestToPromise(meta.get(key));

  const next = (
    Array.isArray(current?.value)
      ? current.value
      : []
  ).filter(
    (item) =>
      item.clientActionId !==
      clientActionId
  );

  if (next.length) {
    meta.put({
      key,
      value: next,
      savedAt: new Date().toISOString(),
    });
  } else {
    meta.delete(key);
  }

  await transactionDone(tx);
}

export async function getPendingOfflineKeeperChangeCount(matchId) {
  return (
    await listPendingOfflineKeeperChanges(matchId)
  ).length;
}



function inningsTransitionMetaKey(matchId) {
  return `pendingInningsTransition:${Number(matchId)}`;
}

export async function getPendingOfflineInningsTransition(matchId) {
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readonly");
  const row = await requestToPromise(
    tx.objectStore(META_STORE).get(
      inningsTransitionMetaKey(matchId)
    )
  );
  await transactionDone(tx);

  return row?.value || null;
}

export async function queueOfflineInningsTransition(transition) {
  const matchId = Number(transition?.matchId);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    throw new Error("Invalid match id for offline innings transition.");
  }

  const payload = {
    ...transition,
    matchId,
    clientActionId:
      transition.clientActionId ||
      createClientEventId(),
    fromInnings:
      Number(
        transition.fromInnings ||
        1
      ),
    toInnings:
      Number(
        transition.toInnings ||
        2
      ),
    status: "PENDING",
    createdAt:
      transition.createdAt ||
      new Date().toISOString(),
    localOrder:
      Number(
        transition.localOrder ||
        Date.now() * 1000 +
          Math.floor(
            Math.random() * 999
          )
      ),
  };

  const db = await openDb();
  const tx = db.transaction(META_STORE, "readwrite");

  tx.objectStore(META_STORE).put({
    key: inningsTransitionMetaKey(matchId),
    value: payload,
    savedAt: new Date().toISOString(),
  });

  await transactionDone(tx);

  return payload;
}

export async function removeOfflineInningsTransition(matchId) {
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readwrite");

  tx.objectStore(META_STORE).delete(
    inningsTransitionMetaKey(matchId)
  );

  await transactionDone(tx);
}

export async function getPendingOfflineInningsTransitionCount(matchId) {
  const transition =
    await getPendingOfflineInningsTransition(
      matchId
    );

  return transition ? 1 : 0;
}


function strikeSwapMetaKey(matchId) {
  return `pendingStrikeSwaps:${Number(matchId)}`;
}

export async function listPendingOfflineStrikeSwaps(matchId) {
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readonly");
  const row = await requestToPromise(
    tx.objectStore(META_STORE).get(
      strikeSwapMetaKey(matchId)
    )
  );
  await transactionDone(tx);

  return Array.isArray(row?.value)
    ? [...row.value].sort(
        (a, b) =>
          Number(a.localOrder || 0) -
          Number(b.localOrder || 0)
      )
    : [];
}

export async function queueOfflineStrikeSwap(action) {
  const matchId = Number(action?.matchId);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    throw new Error("Invalid match id for offline strike swap.");
  }

  const db = await openDb();
  const tx = db.transaction(META_STORE, "readwrite");
  const meta = tx.objectStore(META_STORE);
  const key = strikeSwapMetaKey(matchId);
  const current = await requestToPromise(meta.get(key));

  const rows = Array.isArray(current?.value)
    ? current.value
    : [];

  const clientActionId =
    action.clientActionId ||
    createClientEventId();

  const next = [
    ...rows,
    {
      ...action,
      matchId,
      clientActionId,
      status: "PENDING",
      createdAt:
        action.createdAt ||
        new Date().toISOString(),
      localOrder:
        Number(
          action.localOrder ||
          Date.now() * 1000 +
            Math.floor(
              Math.random() * 999
            )
        ),
    },
  ];

  meta.put({
    key,
    value: next,
    savedAt: new Date().toISOString(),
  });

  await transactionDone(tx);

  return next[next.length - 1];
}

export async function removeOfflineStrikeSwap(
  matchId,
  clientActionId
) {
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readwrite");
  const meta = tx.objectStore(META_STORE);
  const key = strikeSwapMetaKey(matchId);
  const current = await requestToPromise(meta.get(key));

  const next = (
    Array.isArray(current?.value)
      ? current.value
      : []
  ).filter(
    (item) =>
      item.clientActionId !== clientActionId
  );

  if (next.length) {
    meta.put({
      key,
      value: next,
      savedAt: new Date().toISOString(),
    });
  } else {
    meta.delete(key);
  }

  await transactionDone(tx);
}

export async function getPendingOfflineStrikeSwapCount(matchId) {
  return (
    await listPendingOfflineStrikeSwaps(matchId)
  ).length;
}


function serverUndoSnapshotMetaKey(matchId) {
  return `serverUndoSnapshot:${Number(matchId)}`;
}

function pendingServerUndoMetaKey(matchId) {
  return `pendingServerUndo:${Number(matchId)}`;
}

export async function saveOfflineServerUndoSnapshot(
  matchId,
  snapshot
) {
  const numericMatchId =
    Number(matchId);

  if (
    !Number.isInteger(
      numericMatchId
    ) ||
    numericMatchId <= 0
  ) {
    throw new Error(
      "Invalid match id for offline undo snapshot."
    );
  }

  const db =
    await openDb();

  const tx =
    db.transaction(
      META_STORE,
      "readwrite"
    );

  tx.objectStore(
    META_STORE
  ).put({
    key:
      serverUndoSnapshotMetaKey(
        numericMatchId
      ),

    value: {
      ...snapshot,

      matchId:
        numericMatchId,

      savedAt:
        new Date()
          .toISOString(),
    },

    savedAt:
      new Date()
        .toISOString(),
  });

  await transactionDone(
    tx
  );
}

export async function getOfflineServerUndoSnapshot(
  matchId
) {
  const db =
    await openDb();

  const tx =
    db.transaction(
      META_STORE,
      "readonly"
    );

  const row =
    await requestToPromise(
      tx
        .objectStore(
          META_STORE
        )
        .get(
          serverUndoSnapshotMetaKey(
            matchId
          )
        )
    );

  await transactionDone(
    tx
  );

  return row?.value ||
    null;
}

export async function clearOfflineServerUndoSnapshot(
  matchId
) {
  const db =
    await openDb();

  const tx =
    db.transaction(
      META_STORE,
      "readwrite"
    );

  tx.objectStore(
    META_STORE
  ).delete(
    serverUndoSnapshotMetaKey(
      matchId
    )
  );

  await transactionDone(
    tx
  );
}

export async function queueOfflineServerUndo(
  action
) {
  const matchId =
    Number(
      action?.matchId
    );

  if (
    !Number.isInteger(
      matchId
    ) ||
    matchId <= 0
  ) {
    throw new Error(
      "Invalid match id for offline server undo."
    );
  }

  const payload = {
    ...action,

    matchId,

    clientActionId:
      action
        .clientActionId ||
      createClientEventId(),

    status:
      "PENDING",

    createdAt:
      action
        .createdAt ||
      new Date()
        .toISOString(),

    localOrder:
      Number(
        action
          .localOrder ||
        Date.now() *
          1000 +
          Math.floor(
            Math.random() *
              999
          )
      ),
  };

  const db =
    await openDb();

  const tx =
    db.transaction(
      META_STORE,
      "readwrite"
    );

  tx.objectStore(
    META_STORE
  ).put({
    key:
      pendingServerUndoMetaKey(
        matchId
      ),

    value:
      payload,

    savedAt:
      new Date()
        .toISOString(),
  });

  await transactionDone(
    tx
  );

  return payload;
}

export async function getPendingOfflineServerUndo(
  matchId
) {
  const db =
    await openDb();

  const tx =
    db.transaction(
      META_STORE,
      "readonly"
    );

  const row =
    await requestToPromise(
      tx
        .objectStore(
          META_STORE
        )
        .get(
          pendingServerUndoMetaKey(
            matchId
          )
        )
    );

  await transactionDone(
    tx
  );

  return row?.value ||
    null;
}

export async function removeOfflineServerUndo(
  matchId
) {
  const db =
    await openDb();

  const tx =
    db.transaction(
      META_STORE,
      "readwrite"
    );

  tx.objectStore(
    META_STORE
  ).delete(
    pendingServerUndoMetaKey(
      matchId
    )
  );

  await transactionDone(
    tx
  );
}

export async function getPendingOfflineServerUndoCount(
  matchId
) {
  return (
    await getPendingOfflineServerUndo(
      matchId
    )
  )
    ? 1
    : 0;
}
