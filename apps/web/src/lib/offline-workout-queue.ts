import type { WorkoutSessionInput } from '@gymhelper/types';

const LEGACY_STORAGE_KEY = 'gymhelper-offline-workouts';
const DB_NAME = 'gymhelper-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'workout-queue';
const QUEUE_RECORD_ID = 'queue';

export interface QueuedWorkout {
  id: string;
  createdAt: string;
  payload: WorkoutSessionInput & {
    sessionDate: string;
    timezoneOffsetMinutes?: number;
  };
}

interface QueueRecord {
  id: string;
  workouts: QueuedWorkout[];
}

let queueDbPromise: Promise<IDBDatabase> | null = null;
let legacyMigrationPromise: Promise<void> | null = null;

function safeParse(value: string | null): QueuedWorkout[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as QueuedWorkout[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readLegacyQueue(): QueuedWorkout[] {
  if (typeof window === 'undefined') {
    return [];
  }

  return safeParse(window.localStorage.getItem(LEGACY_STORAGE_KEY));
}

function writeLegacyQueue(workouts: QueuedWorkout[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(workouts));
}

function clearLegacyQueue() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
}

function supportsIndexedDb(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openQueueDatabase(): Promise<IDBDatabase> {
  if (!supportsIndexedDb()) {
    return Promise.reject(new Error('IndexedDB is not available'));
  }

  if (queueDbPromise) {
    return queueDbPromise;
  }

  queueDbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      queueDbPromise = null;
      reject(request.error ?? new Error('Failed to open IndexedDB'));
    };
  });

  return queueDbPromise;
}

function readQueueFromIndexedDb(db: IDBDatabase): Promise<QueuedWorkout[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(QUEUE_RECORD_ID);

    request.onsuccess = () => {
      const record = request.result as QueueRecord | undefined;
      resolve(Array.isArray(record?.workouts) ? record.workouts : []);
    };

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to read queue from IndexedDB'));
    };
  });
}

function writeQueueToIndexedDb(db: IDBDatabase, workouts: QueuedWorkout[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put({ id: QUEUE_RECORD_ID, workouts } as QueueRecord);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to write queue to IndexedDB'));
    };
  });
}

async function migrateLegacyQueueToIndexedDb(db: IDBDatabase): Promise<void> {
  if (legacyMigrationPromise) {
    await legacyMigrationPromise;
    return;
  }

  legacyMigrationPromise = (async () => {
    const legacyQueue = readLegacyQueue();
    if (legacyQueue.length === 0) {
      return;
    }

    const currentQueue = await readQueueFromIndexedDb(db);
    if (currentQueue.length === 0) {
      await writeQueueToIndexedDb(db, legacyQueue);
    }

    clearLegacyQueue();
  })();

  try {
    await legacyMigrationPromise;
  } finally {
    legacyMigrationPromise = null;
  }
}

async function withQueueStorage<T>(
  indexedDbAction: (db: IDBDatabase) => Promise<T>,
  legacyFallback: () => T | Promise<T>,
): Promise<T> {
  if (!supportsIndexedDb()) {
    return legacyFallback();
  }

  try {
    const db = await openQueueDatabase();
    await migrateLegacyQueueToIndexedDb(db);
    return indexedDbAction(db);
  } catch {
    return legacyFallback();
  }
}

export async function getQueuedWorkouts(): Promise<QueuedWorkout[]> {
  return withQueueStorage(
    async (db) => readQueueFromIndexedDb(db),
    () => readLegacyQueue(),
  );
}

export async function enqueueWorkout(
  payload: WorkoutSessionInput & { sessionDate: string; timezoneOffsetMinutes?: number },
): Promise<QueuedWorkout[]> {
  const next: QueuedWorkout = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    payload,
  };

  return withQueueStorage(
    async (db) => {
      const current = await readQueueFromIndexedDb(db);
      const updated = [next, ...current];
      await writeQueueToIndexedDb(db, updated);
      return updated;
    },
    () => {
      const current = readLegacyQueue();
      const updated = [next, ...current];
      writeLegacyQueue(updated);
      return updated;
    },
  );
}

export async function replaceQueuedWorkouts(workouts: QueuedWorkout[]): Promise<void> {
  await withQueueStorage(
    async (db) => {
      await writeQueueToIndexedDb(db, workouts);
    },
    () => {
      writeLegacyQueue(workouts);
    },
  );
}

export async function clearQueuedWorkouts(): Promise<void> {
  await replaceQueuedWorkouts([]);
}
